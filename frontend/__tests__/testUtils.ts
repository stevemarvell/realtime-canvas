import * as http from 'http';
import express, { Express } from 'express';
import WebSocket from 'ws';
import path from 'path';

/**
 * Start a test server instance
 * Returns server, port, and cleanup function
 */
export async function startTestServer(
  port: number = 0
): Promise<{ server: http.Server; port: number; cleanup: () => Promise<void> }> {
  const app = express();

  // Serve static files
  app.use(express.static(path.join(__dirname, '../public')));
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
  });

  const server = http.createServer(app);

  // Use dynamic require to avoid TypeScript issues
  const WebSocketModule = require('ws');
  const WSServer = WebSocketModule.Server || WebSocketModule.WebSocketServer;
  const wss = new WSServer({ server, path: '/connect' });

  const clients = new Set<any>();

  wss.on('connection', (ws: any) => {
    clients.add(ws);

    ws.on('message', (data: any) => {
      try {
        const messageStr = typeof data === 'string' ? data : data.toString();
        const message = JSON.parse(messageStr);
        clients.forEach((client: any) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', (error: any) => {
      console.error('WebSocket error:', error);
    });
  });

  return new Promise(resolve => {
    server.listen(port, () => {
      const actualPort = (server.address() as any).port;
      resolve({
        server,
        port: actualPort,
        cleanup: async () => {
          return new Promise<void>(innerResolve => {
            clients.forEach((client: any) => {
              if (client.readyState === WebSocket.OPEN) {
                client.close();
              }
            });
            wss.close(() => {
              server.close(() => {
                innerResolve();
              });
            });
          });
        },
      });
    });
  });
}

/**
 * Create a WebSocket client and connect to server
 */
export async function createAndConnectClient(
  url: string
): Promise<{ ws: WebSocket; close: () => void }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket connection timeout'));
    }, 5000);

    ws.on('open', () => {
      clearTimeout(timeout);
      resolve({
        ws,
        close: () => ws.close(),
      });
    });

    ws.on('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * Wait for message on WebSocket
 */
export async function waitForMessage(
  ws: WebSocket,
  timeout: number = 1000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for message'));
    }, timeout);

    const handler = (event: any) => {
      clearTimeout(timer);
      (ws as any).removeEventListener('message', handler);
      try {
        const data = event.data || event;
        resolve(JSON.parse(data.toString ? data.toString() : data));
      } catch (error) {
        reject(error);
      }
    };

    (ws as any).addEventListener('message', handler);
  });
}

/**
 * Get all messages received by client
 */
export function getReceivedMessages(ws: WebSocket): any[] {
  const messages: any[] = [];
  // This would need to be tracked during test, using event listener
  return messages;
}

/**
 * Assert circle was drawn with specific properties
 */
export function assertCircleDrawn(
  mockContext: any,
  x: number,
  y: number,
  radius: number,
  color?: string,
  opacity?: number
): void {
  expect(mockContext.arc).toHaveBeenCalledWith(
    x,
    y,
    radius,
    0,
    Math.PI * 2
  );
  expect(mockContext.fill).toHaveBeenCalled();
  if (color !== undefined) {
    expect(mockContext.fillStyle).toContain(color);
  }
  if (opacity !== undefined) {
    expect(mockContext.globalAlpha).toBe(opacity);
  }
}

/**
 * Create mock canvas context
 */
export function createMockCanvasContext(): any {
  return {
    arc: jest.fn(),
    fill: jest.fn(),
    fillStyle: '',
    globalAlpha: 1,
  };
}

/**
 * Create mock canvas element
 */
export function createMockCanvas(): any {
  const mockContext = createMockCanvasContext();
  return {
    width: 800,
    height: 600,
    addEventListener: jest.fn(),
    getContext: jest.fn(() => mockContext),
    getBoundingClientRect: jest.fn(() => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })),
  };
}

/**
 * Parse event message
 */
export function parseEventMessage(data: string): { x: number; y: number; timestamp: string } {
  return JSON.parse(data);
}

/**
 * Validate event message structure
 */
export function validateEventMessage(data: any): boolean {
  return (
    typeof data === 'object' &&
    typeof data.x === 'number' &&
    typeof data.y === 'number' &&
    typeof data.timestamp === 'string'
  );
}
