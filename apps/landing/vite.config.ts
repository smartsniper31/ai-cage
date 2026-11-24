import { defineConfig } from 'vite';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
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

        // Copy public assets (og-image.png, favicon.png, version.json)
        const publicDir = resolve(__dirname, 'public');
        const distDir   = resolve(__dirname, 'dist');
        const assets = ['og-image.png', 'favicon.png', 'version.json'];
        assets.forEach(file => {
          const src  = resolve(publicDir, file);
          const dest = resolve(distDir, file);
          if (existsSync(src)) {
            copyFileSync(src, dest);
            console.log(`[landing] ✅ ${file} copied to dist/`);
          }
        });
      },
    },
  ],
});
