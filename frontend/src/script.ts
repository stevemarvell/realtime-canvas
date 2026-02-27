// ---------------------------------------------------------------------------
// Type declarations for CDN-loaded libraries (Ably and Ably Spaces).
// These globals are injected by the <script> tags in index.html.
// ---------------------------------------------------------------------------

interface AblyConnectionEventEmitter {
  on(event: 'connected' | 'disconnected' | 'closed', callback: () => void): void;
}

interface AblyRealtimeClient {
  connection: AblyConnectionEventEmitter;
}

interface AblyRealtimeOptions {
  authUrl: string;
  authParams: Record<string, string>;
  clientId: string;
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
  // Set canvas resolution to match container size
  const rect = canvas.parentElement!.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

// Unique ID for this browser tab, used to filter out our own Spaces events
const clientId = `user-${crypto.randomUUID()}`;

// Connect to Ably using server-side token auth (keeps API key off the client)
const ablyClient = new Ably.Realtime({
  authUrl: '/auth',
  authParams: { clientId },
  clientId,
});

// Initialise Ably Spaces on top of the Ably Realtime client
const spaces = new Spaces(ablyClient);

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
