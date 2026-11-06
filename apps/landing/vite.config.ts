import { defineConfig } from 'vite';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    {
      name: 'copy-static-pages',
      closeBundle() {
        // Copy install.html so all "Install Free" links work on Vercel
        copyFileSync(
          resolve(__dirname, 'install.html'),
          resolve(__dirname, 'dist/install.html'),
        );
        console.log('[landing] ✅ install.html copied to dist/');

        copyFileSync(
          resolve(__dirname, 'success.html'),
          resolve(__dirname, 'dist/success.html'),
        );
        console.log('[landing] ✅ success.html copied to dist/');
      },
    },
  ],
});
