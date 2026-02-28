// ---------------------------------------------------------------------------
// Type declarations for CDN-loaded libraries (Ably and Ably Spaces).
// These globals are injected by the <script> tags in index.html.
// ---------------------------------------------------------------------------

interface AblyConnectionEventEmitter {
  on(event: 'connected' | 'disconnected' | 'closed', callback: () => void): void;
}

interface AblyMessage {
  data: unknown;
}

interface AblyChannel {
  subscribe(event: string, callback: (msg: AblyMessage) => void): void;
  unsubscribe(): void;
}

interface AblyChannels {
  get(name: string): AblyChannel;
}

interface AblyRealtimeClient {
  connection: AblyConnectionEventEmitter;
  channels: AblyChannels;
}

interface AblyRealtimeOptions {
  // Use authUrl (recommended for web clients) so the SDK automatically fetches
  // a fresh token before the current one expires — no manual refresh needed.
  authUrl: string;
  // authParams are forwarded as query parameters to authUrl on every token
  // request, including automatic renewals.
  authParams?: Record<string, string>;
}

declare const Ably: {
  Realtime: new (options: AblyRealtimeOptions) => AblyRealtimeClient;
};

interface LocationMember {
  clientId: string;
}

interface LocationUpdate {
  member: LocationMember;
  currentLocation: unknown;
}

interface DrawLocation {
  x: number;
  y: number;
}

interface SpaceLocations {
  subscribe(event: 'update', callback: (update: LocationUpdate) => void): void;
  set(location: DrawLocation): void;
}

interface Space {
  enter(): Promise<void>;
  locations: SpaceLocations;
}

interface SpacesInstance {
  get(name: string): Promise<Space>;
}

declare const Spaces: new (client: AblyRealtimeClient) => SpacesInstance;

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

// Get connection indicator element
const indicator = document.getElementById('connectionIndicator');

// Get canvas element and set up initial sizing
const canvas = document.getElementById('canvas') as HTMLCanvasElement | null;
if (canvas) {
  const rect = canvas.parentElement!.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

// Unique ID for this browser tab — used to identify the current user and to
// filter out our own Spaces location events.
const clientId = `user-${crypto.randomUUID()}`;

// ---------------------------------------------------------------------------
// Ably client — token auth best practices
//
// • authUrl keeps the API key server-side; the browser never sees it.
// • authParams forwards clientId so the server embeds it in the token.
//   The SDK passes these params automatically on every token renewal, so
//   the clientId stays consistent across the session lifetime.
// • We do NOT set clientId in the top-level constructor options — the
//   authoritative clientId comes from the token issued by the server.
// ---------------------------------------------------------------------------
const ablyClient = new Ably.Realtime({
  authUrl: '/auth',
  authParams: { clientId },
});

// Initialise Ably Spaces on top of the Ably Realtime client
const spaces = new Spaces(ablyClient);

// ---------------------------------------------------------------------------
// Canvas + Spaces (collaborative drawing)
// ---------------------------------------------------------------------------

async function init(): Promise<void> {
  const space = await spaces.get('canvas-room');

  // Reflect Ably connection state in the indicator dot
  ablyClient.connection.on('connected', () => indicator?.classList.add('connected'));
  ablyClient.connection.on('disconnected', () => indicator?.classList.remove('connected'));
  ablyClient.connection.on('closed', () => indicator?.classList.remove('connected'));

  // Enter the space so our presence is tracked
  await space.enter();

  // Subscribe to location updates — each member's location is their last draw position
  space.locations.subscribe('update', (locationUpdate: LocationUpdate) => {
    // Ignore updates we published ourselves
    if (locationUpdate.member.clientId === clientId) return;

    const loc = locationUpdate.currentLocation as DrawLocation | null;
    if (!loc || !canvas) return;

    // Draw a blue circle at the remote member's draw position
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(loc.x, loc.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Set up click listener on canvas
  if (canvas) {
    canvas.addEventListener('click', (event: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Draw local click in orange
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Publish draw position to all other members via Ably Spaces locations
      space.locations.set({ x, y });
    });
  }
}

init().catch(console.error);

// ---------------------------------------------------------------------------
// AI Chat — Ably AI Transport (message-per-token pattern)
//
// Flow:
//   1. User submits a prompt.
//   2. A unique requestId is generated and used as the Ably channel name.
//   3. The client subscribes to `ai-stream:<requestId>` BEFORE the POST so
//      no tokens are missed regardless of network timing.
//   4. The POST /chat responds immediately with { channelName } and the server
//      begins streaming AI tokens to that channel in the background.
//   5. 'start' / 'token' / 'done' / 'error' lifecycle events let the client
//      render the response progressively and clean up when done.
// ---------------------------------------------------------------------------

const chatInput = document.getElementById('chatInput') as HTMLInputElement | null;
const chatSend = document.getElementById('chatSend') as HTMLButtonElement | null;
const chatOutput = document.getElementById('chatOutput') as HTMLDivElement | null;

async function sendChat(prompt: string): Promise<void> {
  if (!chatOutput || !chatInput) return;

  // Disable input while a request is in flight
  chatInput.disabled = true;
  if (chatSend) chatSend.disabled = true;

  const requestId = crypto.randomUUID();
  const channelName = `ai-stream:${requestId}`;

  // Render the user message immediately
  const userDiv = document.createElement('div');
  userDiv.className = 'chat-message chat-user';
  userDiv.textContent = prompt;
  chatOutput.appendChild(userDiv);

  // Placeholder for the AI response (filled in as tokens arrive)
  const aiDiv = document.createElement('div');
  aiDiv.className = 'chat-message chat-ai';
  chatOutput.appendChild(aiDiv);
  chatOutput.scrollTop = chatOutput.scrollHeight;

  // Subscribe to the AI stream channel BEFORE sending the HTTP request so
  // we're guaranteed to receive every token even if the server is very fast.
  const channel = ablyClient.channels.get(channelName);

  channel.subscribe('token', (msg: AblyMessage) => {
    const { delta } = msg.data as { delta: string };
    aiDiv.textContent += delta;
    chatOutput.scrollTop = chatOutput.scrollHeight;
  });

  channel.subscribe('done', () => {
    channel.unsubscribe();
    chatInput.disabled = false;
    if (chatSend) chatSend.disabled = false;
    chatInput.focus();
  });

  channel.subscribe('error', (msg: AblyMessage) => {
    const { message } = msg.data as { message: string };
    aiDiv.textContent += `\n[Error: ${message}]`;
    aiDiv.classList.add('chat-error');
    channel.unsubscribe();
    chatInput.disabled = false;
    if (chatSend) chatSend.disabled = false;
  });

  // POST after subscribing; server responds with { channelName } immediately
  // then publishes tokens asynchronously via Ably.
  try {
    await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, requestId }),
    });
  } catch {
    aiDiv.textContent += '\n[Network error: could not reach server]';
    aiDiv.classList.add('chat-error');
    channel.unsubscribe();
    chatInput.disabled = false;
    if (chatSend) chatSend.disabled = false;
  }
}

if (chatSend && chatInput) {
  chatSend.addEventListener('click', () => {
    const prompt = chatInput.value.trim();
    if (!prompt) return;
    chatInput.value = '';
    sendChat(prompt).catch(console.error);
  });

  chatInput.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      const prompt = chatInput.value.trim();
      if (!prompt) return;
      chatInput.value = '';
      sendChat(prompt).catch(console.error);
    }
  });
}
