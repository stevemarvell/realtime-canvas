import express from 'express';
import path from 'path';
import http from 'http';
import Ably from 'ably';

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Route for root path - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Ably token auth endpoint - issues token requests to browser clients,
// keeping the API key server-side only
const ablyRest = new Ably.Rest(process.env.ABLY_API_KEY ?? '');

app.get('/auth', async (req, res) => {
  try {
    const clientId = (req.query.clientId as string) || `user-${Date.now()}`;
    const tokenRequest = await ablyRest.auth.createTokenRequest({ clientId });
    res.json(tokenRequest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create token' });
  }
});

// Create HTTP server from Express app
const server = http.createServer(app);

export { app, server };

// Start server only when run directly
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}
