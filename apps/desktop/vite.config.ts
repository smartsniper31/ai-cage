import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite config for the AI CAGE Tauri desktop app.
 *
 * IMPORTANT — single source of truth for HTML:
 *   - Entry point: apps/desktop/index.html  (THIS file, at root level)
 *   - There is NO src/index.html — only one HTML file exists
 *   - Tauri distDir: "../dist" (relative to src-tauri/)
 *
 * This explicit `root` declaration prevents Vite from ever using
 * a wrong working directory when launched from monorepo root via pnpm --filter.
 */
export default defineConfig({
  // Explicit root — always uses apps/desktop/ regardless of cwd
  root: resolve(__dirname),

  // Tauri dev server port
  server: {
    port: 1420,
    strictPort: true,
  },

  build: {
    outDir:     resolve(__dirname, 'dist'),
    emptyOutDir: true,
    // Tauri handles minification at the Rust level
    minify:    process.env['TAURI_DEBUG'] ? false : 'esbuild',
    sourcemap: !!process.env['TAURI_DEBUG'],
    target:    ['es2021', 'chrome105', 'safari13'],
  },

  resolve: {
    alias: {
      '@ai-cage/core':          resolve(__dirname, '../../packages/core/src/index.ts'),
      '@ai-cage/presidio-lite': resolve(__dirname, '../../packages/presidio-lite/src/index.ts'),
    },
  },
});
