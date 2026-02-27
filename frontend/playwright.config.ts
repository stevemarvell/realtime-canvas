import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 15000,
  use: {
    baseURL: 'http://localhost:3001',
  },
  webServer: {
    command: 'PORT=3001 ABLY_API_KEY=test-key node build.mjs && PORT=3001 ABLY_API_KEY=test-key ts-node --project tsconfig.json server.ts',
    port: 3001,
    reuseExistingServer: !process.env.CI,
  },
});
