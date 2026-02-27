import http from 'http';
import request from 'supertest';

// Mock ably before importing server so the module-level ablyRest uses the mock
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
  })),
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
