import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-build-to-static-and-templates',
      closeBundle() {
        try {
          const distAssets = path.resolve(__dirname, 'dist/assets');
          const staticAssets = path.resolve(__dirname, 'static/assets');
          if (fs.existsSync(distAssets)) {
            if (!fs.existsSync(staticAssets)) {
              fs.mkdirSync(staticAssets, { recursive: true });
            }
            const files = fs.readdirSync(distAssets);
            for (const file of files) {
              fs.copyFileSync(path.join(distAssets, file), path.join(staticAssets, file));
            }
            console.log(' Successfully copied dist/assets to static/assets');
          }
          const distHtml = path.resolve(__dirname, 'dist/index.html');
          const templateHtml = path.resolve(__dirname, 'templates/index.html');
          if (fs.existsSync(distHtml)) {
            fs.copyFileSync(distHtml, templateHtml);
            console.log(' Successfully synced dist/index.html to templates/index.html');
          }
        } catch (err) {
          console.error('Error copying build files:', err);
        }
      }
    }
  ],
  base: '/static/', // Set base to /static/ so FastAPI's static mount can serve assets
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/transcribe_and_compare': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/data': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/audio': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
});

