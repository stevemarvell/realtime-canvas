// Mock WebSocket for testing
export class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  sent: string[] = [];
  listeners: Map<string, Function[]> = new Map();

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(event: string, handler: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(handler);
  }

  removeEventListener(event: string, handler: Function): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  send(data: string): void {
    if (this.readyState !== 1) {
      throw new Error('WebSocket is not open: readyState ' + this.readyState);
    }
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this._triggerEvent('close', {});
  }

  // Helper methods for testing
  _triggerEvent(eventType: string, data: any): void {
    const handlers = this.listeners.get(eventType) || [];
    handlers.forEach(handler => {
      handler(data);
    });
  }

  _open(): void {
    this.readyState = 1;
    this._triggerEvent('open', {});
  }

  _simulateMessage(data: string): void {
    this._triggerEvent('message', { data });
  }

  _simulateError(error: any = {}): void {
    this._triggerEvent('error', error);
  }

  _reset(): void {
    this.sent = [];
    this.listeners.clear();
  }
}

// Global mock for WebSocket
const mockInstances: MockWebSocket[] = [];

export function createMockWebSocket(url: string): MockWebSocket {
  const ws = new MockWebSocket(url);
  mockInstances.push(ws);
  return ws;
}

export function getAllMockWebSockets(): MockWebSocket[] {
  return mockInstances;
}

export function clearMockWebSockets(): void {
  mockInstances.length = 0;
}
