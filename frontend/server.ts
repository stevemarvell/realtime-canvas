import express from 'express';
import path from 'path';
import http from 'http';
import WebSocket from 'ws';

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for root path - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create HTTP server from Express app
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: '/connect' });

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Handle incoming messages from client
  ws.on('message', (data: string) => {
    const message = JSON.parse(data);
    console.log('Received press event:', message);
  });

  // Handle client disconnect
  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
