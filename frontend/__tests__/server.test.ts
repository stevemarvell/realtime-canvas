import http from 'http';
import WebSocket from 'ws';
import { server, wss, clients } from '../server';

let port: number;

beforeAll((done) => {
  server.listen(0, () => {
    port = (server.address() as { port: number }).port;
    done();
  });
});

afterAll((done) => {
  wss.close(() => {
    server.close(done);
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

async function closeAll(...sockets: WebSocket[]): Promise<void> {
  sockets.forEach((ws) => ws.close());
  await new Promise((r) => setTimeout(r, 100));
}

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

describe('WebSocket pub/sub', () => {
  it('adds client to set on connect and removes on disconnect', async () => {
    const sizeBefore = clients.size;
    const ws = await openClient();
    expect(clients.size).toBe(sizeBefore + 1);
    ws.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(clients.size).toBe(sizeBefore);
  });

  it('broadcasts a message to all other connected clients', async () => {
    const sender = await openClient();
    const receiver1 = await openClient();
    const receiver2 = await openClient();

    const [msg1, msg2] = await Promise.all([
      nextMessage(receiver1),
      nextMessage(receiver2),
      Promise.resolve().then(() => {
        sender.send(JSON.stringify({ type: 'draw', x: 10, y: 20 }));
      }),
    ]);

    expect(JSON.parse(msg1)).toEqual({ type: 'draw', x: 10, y: 20 });
    expect(JSON.parse(msg2)).toEqual({ type: 'draw', x: 10, y: 20 });

    await closeAll(sender, receiver1, receiver2);
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

    await closeAll(sender, receiver);
  });

  it('handles WebSocket errors without crashing', async () => {
    const ws = await openClient();

    // Find the matching server-side socket and emit an error on it
    const serverSocket = [...wss.clients].find((c) => c !== ws);
    const target = serverSocket ?? [...wss.clients][0];

    await expect(
      new Promise<void>((resolve) => {
        target.emit('error', new Error('simulated error'));
        resolve();
      })
    ).resolves.toBeUndefined();

    await closeAll(ws);
  });
});
