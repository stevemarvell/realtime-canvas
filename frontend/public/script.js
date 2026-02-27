// Get connection indicator element
const indicator = document.getElementById('connectionIndicator');

// Get canvas element and set up initial sizing
const canvas = document.getElementById('canvas');
if (canvas) {
  // Set canvas resolution to match container size
  const rect = canvas.parentElement.getBoundingClientRect();
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

async function init() {
  const space = await spaces.get('canvas-room');

  // Reflect Ably connection state in the indicator dot
  ablyClient.connection.on('connected', () => indicator.classList.add('connected'));
  ablyClient.connection.on('disconnected', () => indicator.classList.remove('connected'));
  ablyClient.connection.on('closed', () => indicator.classList.remove('connected'));

  // Enter the space so our presence is tracked
  await space.enter();

  // Subscribe to location updates — each member's location is their last draw position
  space.locations.subscribe('update', (locationUpdate) => {
    // Ignore updates we published ourselves
    if (locationUpdate.member.clientId === clientId) return;

    const loc = locationUpdate.currentLocation;
    if (!loc || canvas === null) return;

    // Draw a blue circle at the remote member's draw position
    if (canvas.getContext) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(loc.x, loc.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Set up click listener on canvas
  if (canvas) {
    canvas.addEventListener('click', (event) => {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      // Draw local click in orange
      if (canvas.getContext) {
        const ctx = canvas.getContext('2d');
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
