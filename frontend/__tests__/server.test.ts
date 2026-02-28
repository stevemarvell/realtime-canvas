import http from 'http';
import request from 'supertest';

// ---------------------------------------------------------------------------
// Mock ably before importing server so the module-level ablyRest uses the mock
// ---------------------------------------------------------------------------
const mockPublish = jest.fn().mockResolvedValue(undefined);
const mockChannelGet = jest.fn().mockReturnValue({ publish: mockPublish });

jest.mock('ably', () => ({
  Rest: jest.fn().mockImplementation(() => ({
    auth: {
      createTokenRequest: jest.fn().mockResolvedValue({
        keyName: 'test-key',
        timestamp: 1234567890000,
        nonce: 'abc123',
        mac: 'fakemac',
      }),
    },
    channels: {
      get: mockChannelGet,
    },
  })),
}));

// ---------------------------------------------------------------------------
// Mock Vercel AI SDK and Anthropic provider
// ---------------------------------------------------------------------------
jest.mock('ai', () => ({
  streamText: jest.fn().mockReturnValue({
    fullStream: (async function* () {
      yield { type: 'text-delta', textDelta: 'Hello' };
      yield { type: 'text-delta', textDelta: ' world' };
      yield { type: 'finish', finishReason: 'stop', usage: {} };
    })(),
  }),
}));

jest.mock('@ai-sdk/anthropic', () => ({
  anthropic: jest.fn().mockReturnValue('mock-model'),
}));

import { app, server } from '../server';

let port: number;

beforeAll((done) => {
  server.listen(0, () => {
    port = (server.address() as { port: number }).port;
    done();
  });
});

afterAll((done) => {
  server.close(done);
});

describe('HTTP server', () => {
  it('GET / returns 200 with HTML content-type', (done) => {
    http.get(`http://localhost:${port}/`, (res) => {
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      res.resume();
      done();
    });
  });
});

describe('GET /auth', () => {
  it('returns a JSON token request with a clientId param', async () => {
    const res = await request(app).get('/auth').query({ clientId: 'test-user' });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toHaveProperty('keyName');
    expect(res.body).toHaveProperty('nonce');
    expect(res.body).toHaveProperty('mac');
  });

  it('returns a JSON token request when no clientId is provided', async () => {
    const res = await request(app).get('/auth');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('keyName');
  });
});

describe('POST /chat', () => {
  beforeEach(() => {
    mockPublish.mockClear();
    mockChannelGet.mockClear();
  });

  it('returns 400 when prompt is missing', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ requestId: 'test-request-id' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when requestId is missing', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ prompt: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns channelName immediately without waiting for AI stream', async () => {
    const res = await request(app)
      .post('/chat')
      .send({ prompt: 'Hello', requestId: 'req-123' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('channelName', 'ai-stream:req-123');
  });

  it('opens the correct Ably channel for the requestId', async () => {
    await request(app)
      .post('/chat')
      .send({ prompt: 'Hello', requestId: 'req-abc' });
    expect(mockChannelGet).toHaveBeenCalledWith('ai-stream:req-abc');
  });
});
