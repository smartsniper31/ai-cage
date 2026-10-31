import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite config for the AI CAGE Tauri desktop app.
 *
 * Tauri expects the web frontend to be served at localhost:1420 in dev,
 * and built into dist/ for production embedding in the binary.
 */
export default defineConfig({
  // Tauri dev server port
  server: {
    port: 1420,
    strictPort: true,
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Tauri handles minification at the Rust level
    minify: process.env['TAURI_DEBUG'] ? false : 'esbuild',
    sourcemap: !!process.env['TAURI_DEBUG'],
    target: ['es2021', 'chrome105', 'safari13'],
  },

  resolve: {
    alias: {
      '@ai-cage/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@ai-cage/presidio-lite': resolve(
        __dirname,
        '../../packages/presidio-lite/src/index.ts',
      ),
    },
  },
});
