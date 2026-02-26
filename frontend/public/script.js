// Get connection indicator element
const indicator = document.getElementById('connectionIndicator');

// Establish WebSocket connection
const ws = new WebSocket('ws://localhost:3000/connect');

// Handle WebSocket connection open
ws.addEventListener('open', () => {
  console.log('WebSocket connection established');
  indicator.classList.add('connected');
});

// Handle WebSocket connection close
ws.addEventListener('close', () => {
  console.log('WebSocket connection closed');
  indicator.classList.remove('connected');
});

// Handle WebSocket errors
ws.addEventListener('error', (event) => {
  console.error('WebSocket error:', event);
});

// Handle incoming messages from other clients
ws.addEventListener('message', (event) => {
  const remoteEvent = JSON.parse(event.data);
  console.log('Received remote event:', remoteEvent);

  // Draw a circle at the remote click location
  if (canvas && canvas.getContext) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(0, 150, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(remoteEvent.x, remoteEvent.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }
});

// Get canvas element and set up click listener
const canvas = document.getElementById('canvas');
if (canvas) {
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const timestamp = new Date().toISOString();

    const pressEvent = { x, y, timestamp };

    // Draw local click
    if (canvas && canvas.getContext) {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(255, 100, 0, 0.8)';
      ctx.beginPath();
      ctx.arc(x, y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Send press event to server if WebSocket is open
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(pressEvent));
      console.log('Press event sent:', pressEvent);
    } else {
      console.warn('WebSocket not connected');
    }
  });
}
