import http from 'http';
import WebSocket from 'ws';
import { app, server, wss, clients } from '../server';

let testServer: http.Server;
let port: number;

beforeAll((done) => {
  testServer = server.listen(0, () => {
    port = (testServer.address() as { port: number }).port;
    done();
  });
});

afterAll((done) => {
  wss.close(() => {
    testServer.close(done);
  });
});

function openClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}/connect`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.once('message', (data) => resolve(data.toString()));
  });
}

describe('HTTP server', () => {
  it('GET / returns 200', (done) => {
    http.get(`http://localhost:${port}/`, (res) => {
      expect(res.statusCode).toBe(200);
      res.resume();
      done();
    });
  });
});

describe('WebSocket pub/sub', () => {
  it('tracks connected clients', async () => {
    const ws = await openClient();
    expect(clients.size).toBeGreaterThanOrEqual(1);
    ws.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(clients.has(ws)).toBe(false);
  });

  it('broadcasts a message to other connected clients', async () => {
    const sender = await openClient();
    const receiver = await openClient();

    const msgPromise = nextMessage(receiver);

    const payload = { type: 'draw', x: 10, y: 20 };
    sender.send(JSON.stringify(payload));

    const received = await msgPromise;
    expect(JSON.parse(received)).toEqual(payload);

    sender.close();
    receiver.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('does not echo message back to sender', async () => {
    const sender = await openClient();
    const receiver = await openClient();

    let senderReceived = false;
    sender.on('message', () => { senderReceived = true; });

    const receiverMsgPromise = nextMessage(receiver);
    sender.send(JSON.stringify({ type: 'draw', x: 5, y: 5 }));

    await receiverMsgPromise;
    await new Promise((r) => setTimeout(r, 50));

    expect(senderReceived).toBe(false);

    sender.close();
    receiver.close();
    await new Promise((r) => setTimeout(r, 50));
  });

  it('removes client from set on disconnect', async () => {
    const ws = await openClient();
    const sizeBefore = clients.size;
    ws.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(clients.size).toBe(sizeBefore - 1);
  });
});
