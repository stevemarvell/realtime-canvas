import { test, expect, Page, BrowserContext } from '@playwright/test';

// ---------------------------------------------------------------------------
// Minimal mock for the Ably Realtime CDN script.
// Immediately fires the 'connected' event so the indicator turns green.
// ---------------------------------------------------------------------------
const ABLY_MOCK = `
(function () {
  window.Ably = {
    Realtime: class {
      constructor() {
        this.connection = {
          on: function (event, fn) {
            if (event === 'connected') setTimeout(fn, 10);
          },
        };
        // Stub the channels API used by the AI chat feature.
        // subscribe/unsubscribe are no-ops in these tests.
        this.channels = {
          get: function () {
            return {
              subscribe: function () {},
              unsubscribe: function () {},
            };
          },
        };
      }
    },
  };
})();
`;

// ---------------------------------------------------------------------------
// Minimal mock for the Ably Spaces CDN script.
// Uses BroadcastChannel so that a locations.set() call in one page is
// received as a locations 'update' event in all OTHER pages of the same
// browser context (BroadcastChannel does not echo to the sender).
// ---------------------------------------------------------------------------
const SPACES_MOCK = `
(function () {
  window.Spaces = class {
    constructor() {}
    async get(name) {
      const bc = new BroadcastChannel('spaces-mock-' + name);
      const handlers = [];
      bc.onmessage = function (e) {
        handlers.forEach(function (fn) { fn(e.data); });
      };
      return {
        enter: async function () {},
        locations: {
          subscribe: function (event, handler) {
            handlers.push(handler);
          },
          set: function (data) {
            // Use a fixed remote clientId so the receiving page never filters
            // the message out (its own clientId starts with 'user-').
            bc.postMessage({
              member: { clientId: 'remote-user' },
              currentLocation: data,
            });
          },
        },
      };
    }
  };
})();
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setupPage(page: Page): Promise<void> {
  await page.route('https://cdn.ably.com/lib/ably.min-2.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body: ABLY_MOCK })
  );
  await page.route(
    'https://cdn.ably.com/spaces/0.5.2/iife/index.bundle.js',
    (route) =>
      route.fulfill({ contentType: 'application/javascript', body: SPACES_MOCK })
  );
}

/** Read the RGBA pixel at canvas-relative coordinates (x, y). */
function getCanvasPixel(
  page: Page,
  x: number,
  y: number
): Promise<{ r: number; g: number; b: number; a: number }> {
  return page.evaluate(
    ({ x, y }) => {
      const canvas = document.getElementById('canvas') as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      const d = ctx.getImageData(x, y, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] };
    },
    { x, y }
  );
}

async function openConnectedPage(
  context: BrowserContext,
  baseURL: string
): Promise<Page> {
  const page = await context.newPage();
  await setupPage(page);
  await page.goto(baseURL);
  await page.locator('#connectionIndicator.connected').waitFor({ timeout: 5000 });
  return page;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('local click draws an orange dot on the same page', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await openConnectedPage(context, 'http://localhost:3001');

  await page.locator('#canvas').click({ position: { x: 100, y: 100 } });

  const pixel = await getCanvasPixel(page, 100, 100);
  // Orange: high red, low blue
  expect(pixel.r).toBeGreaterThan(200);
  expect(pixel.b).toBeLessThan(100);
  expect(pixel.a).toBeGreaterThan(0);

  await context.close();
});

test('click on page1 draws a blue dot on page2', async ({ browser }) => {
  // Both pages must share the same context so BroadcastChannel is shared.
  const context = await browser.newContext();
  const [page1, page2] = await Promise.all([
    openConnectedPage(context, 'http://localhost:3001'),
    openConnectedPage(context, 'http://localhost:3001'),
  ]);

  await page1.locator('#canvas').click({ position: { x: 150, y: 150 } });

  // Allow the BroadcastChannel message to propagate and the canvas to repaint.
  await page2.waitForTimeout(300);

  const pixel = await getCanvasPixel(page2, 150, 150);
  // Blue: high blue, low red
  expect(pixel.b).toBeGreaterThan(100);
  expect(pixel.r).toBeLessThan(150);
  expect(pixel.a).toBeGreaterThan(0);

  await context.close();
});

test('click on page1 does not draw on page1 as a remote dot', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const [page1, page2] = await Promise.all([
    openConnectedPage(context, 'http://localhost:3001'),
    openConnectedPage(context, 'http://localhost:3001'),
  ]);

  // Click at a position that has not been touched yet.
  await page1.locator('#canvas').click({ position: { x: 200, y: 200 } });
  await page1.waitForTimeout(300);

  const pixel = await getCanvasPixel(page1, 200, 200);
  // Must be orange (local), not blue (remote).
  expect(pixel.r).toBeGreaterThan(200);
  expect(pixel.b).toBeLessThan(100);

  await page2.close();
  await context.close();
});
