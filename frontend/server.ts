import 'dotenv/config';
import express from 'express';
import path from 'path';
import http from 'http';
import crypto from 'crypto';
import Ably from 'ably';
import { streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route for root path - serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------------------------
// Ably REST client — uses the API key server-side only, never exposed to
// browsers. Shared across auth and AI publishing.
// ---------------------------------------------------------------------------
const ablyRest = new Ably.Rest(process.env.ABLY_API_KEY ?? '');

// ---------------------------------------------------------------------------
// GET /auth — issues short-lived Ably token requests to browser clients.
//
// Best practices applied:
//   • API key stays server-side; clients receive a time-limited token.
//   • TTL is set to 1 hour (Ably's maximum for revocable tokens is 1 h).
//   • Capability scopes restrict what channels/operations the token permits:
//       - Collaboration channels: full pub/sub + presence.
//       - AI stream channels: subscribe-only (clients must not publish here).
//   • The Ably SDK on the client automatically requests a fresh token before
//     expiry when authUrl is used, so sessions stay alive without re-auth.
// ---------------------------------------------------------------------------
app.get('/auth', async (req, res) => {
  try {
    // Accept client-supplied clientId (e.g. a UUID generated in the browser)
    // or generate one server-side as a fallback.
    const clientId =
      (req.query.clientId as string)?.trim() || `user-${crypto.randomUUID()}`;

    const tokenRequest = await ablyRest.auth.createTokenRequest({
      clientId,
      // 1 hour TTL — short enough to limit exposure if a token leaks, long
      // enough that automatic renewal is infrequent for normal sessions.
      ttl: 60 * 60 * 1000,
      capability: {
        // Canvas collaboration channels (Ably Spaces uses wildcard sub-channels
        // under the space name, so we need the trailing wildcard).
        '[space]canvas-room*': ['subscribe', 'publish', 'presence', 'history'],
        // AI response streams: clients may only subscribe, never publish.
        'ai-stream:*': ['subscribe'],
      },
    });

    res.json(tokenRequest);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create token' });
  }
});

// ---------------------------------------------------------------------------
// POST /chat — streams an AI response to a dedicated Ably channel.
//
// Ably AI Transport pattern (message-per-token):
//   1. Client subscribes to `ai-stream:<requestId>` BEFORE calling this route.
//   2. This endpoint responds with { channelName } immediately, decoupling the
//      HTTP connection lifetime from the AI stream.
//   3. The server then streams tokens from the LLM and publishes each one to
//      the Ably channel in real time.
//   4. Lifecycle events ('start', 'token', 'done', 'error') give the client
//      clear stream boundaries so it can render progressively.
//
// The server publishes via Ably REST (no persistent WebSocket needed), keeping
// the server footprint minimal. echoMessages is not relevant for REST clients.
// ---------------------------------------------------------------------------
app.post('/chat', async (req, res) => {
  const { prompt, requestId } = req.body as {
    prompt?: string;
    requestId?: string;
  };

  if (!prompt || !requestId) {
    res.status(400).json({ error: 'prompt and requestId are required' });
    return;
  }

  const channelName = `ai-stream:${requestId}`;
  const channel = ablyRest.channels.get(channelName);

  // Respond immediately so the client knows which channel to watch.
  // Actual tokens arrive asynchronously via Ably.
  res.json({ channelName });

  try {
    await channel.publish('start', null);

    const result = streamText({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: anthropic('claude-haiku-4-5-20251001') as any,
      prompt,
    });

    // Iterate the full event stream; publish each text-delta as it arrives.
    // In ai@6 the text-delta event exposes the incremental text as `delta`.
    for await (const event of result.fullStream) {
      if (event.type === 'text-delta') {
        // `delta` is the field name in ai@6 (was `textDelta` in earlier versions)
        const delta = (event as unknown as { delta: string }).delta;
        await channel.publish('token', { delta });
      } else if (event.type === 'error') {
        await channel.publish('error', { message: String(event.error) });
        return;
      }
    }

    await channel.publish('done', null);
  } catch (err) {
    // Best-effort error signal; client handles graceful degradation.
    await channel.publish('error', { message: 'AI response failed' }).catch(() => {});
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
