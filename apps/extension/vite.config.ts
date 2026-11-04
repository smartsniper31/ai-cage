import { defineConfig, build } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';

const alias = {
  '@ai-cage/core': resolve(__dirname, '../../packages/core/src/index.ts'),
  '@ai-cage/presidio-lite': resolve(__dirname, '../../packages/presidio-lite/src/index.ts'),
};

const distDir = resolve(__dirname, 'dist');

/**
 * Chrome Extension MV3 — three separate IIFE bundles.
 *
 * MV3 requires each script (background SW, content, popup) to be a
 * self-contained file with no dynamic imports. We achieve this by building
 * each entry independently as an IIFE, then merging into dist/.
 *
 * The default export drives the popup entry. background and content are
 * built via a custom plugin that spawns two additional Vite builds.
 */
export default defineConfig({
  build: {
    outDir: distDir,
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/popup.ts'),
      name: 'AiCagePopup',
      formats: ['iife'],
      fileName: () => 'popup.js',
    },
  },

  resolve: { alias },

  plugins: [
    {
      name: 'build-extension-entries',
      async closeBundle() {
        // Build background.ts
        await build({
          configFile: false,
          resolve: { alias },
          build: {
            outDir: distDir,
            emptyOutDir: false,
            minify: false,
            lib: {
              entry: resolve(__dirname, 'src/background.ts'),
              name: 'AiCageBackground',
              formats: ['iife'],
              fileName: () => 'background.js',
            },
          },
        });

        // Build content.ts
        await build({
          configFile: false,
          resolve: { alias },
          build: {
            outDir: distDir,
            emptyOutDir: false,
            minify: false,
            lib: {
              entry: resolve(__dirname, 'src/content.ts'),
              name: 'AiCageContent',
              formats: ['iife'],
              fileName: () => 'content.js',
            },
          },
        });

        // Build injected.ts — runs in PAGE context (not extension context)
        // This intercepts fetch/XHR at the network level, bypassing React state
        await build({
          configFile: false,
          resolve: { alias },
          build: {
            outDir: distDir,
            emptyOutDir: false,
            minify: false,
            lib: {
              entry: resolve(__dirname, 'src/injected.ts'),
              name: 'AiCageInjected',
              formats: ['iife'],
              fileName: () => 'injected.js',
            },
          },
        });

        // Copy static assets
        mkdirSync(distDir, { recursive: true });

        copyFileSync(
          resolve(__dirname, 'src/manifest.json'),
          resolve(distDir, 'manifest.json'),
        );

        copyFileSync(
          resolve(__dirname, 'src/popup.html'),
          resolve(distDir, 'popup.html'),
        );

        copyFileSync(
          resolve(__dirname, 'src/welcome.html'),
          resolve(distDir, 'welcome.html'),
        );

        const iconsDir = resolve(__dirname, 'src/icons');
        const distIconsDir = resolve(distDir, 'icons');
        mkdirSync(distIconsDir, { recursive: true });
        if (existsSync(iconsDir)) {
          for (const file of readdirSync(iconsDir)) {
            copyFileSync(resolve(iconsDir, file), resolve(distIconsDir, file));
          }
        }
      },
    },
  ],
});
