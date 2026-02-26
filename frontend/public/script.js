// Establish WebSocket connection
const ws = new WebSocket('ws://localhost:3000/connect');

// Handle WebSocket connection open
ws.addEventListener('open', () => {
  console.log('WebSocket connection established');
});

// Handle WebSocket connection close
ws.addEventListener('close', () => {
  console.log('WebSocket connection closed');
});

// Handle WebSocket errors
ws.addEventListener('error', (event) => {
  console.error('WebSocket error:', event);
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

    // Send press event to server if WebSocket is open
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(pressEvent));
      console.log('Press event sent:', pressEvent);
    } else {
      console.warn('WebSocket not connected');
    }
  });
}
