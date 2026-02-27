/**
 * esbuild build script for the browser-side TypeScript.
 *
 * Usage:
 *   node build.mjs           # single build
 *   node build.mjs --watch   # rebuild on file changes
 */

import * as esbuild from 'esbuild';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/script.ts'],
  outfile: 'public/script.js',
  // No bundling – Ably and Ably Spaces are loaded via CDN <script> tags and
  // are available as globals (window.Ably, window.Spaces). esbuild still
  // strips TypeScript syntax and down-transpiles the output.
  bundle: false,
  target: 'es2020',
  logLevel: 'info',
});

if (watch) {
  await ctx.watch();
  console.log('Watching src/ for changes…');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
