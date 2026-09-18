import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Local AppServ serves the app under /Workboard/; production (own subdomain) builds with WORKBOARD_BASE=/.
  base: process.env.WORKBOARD_BASE || '/Workboard/',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  // `npm run dev`: the API runs on PHP's built-in server (`php -S 127.0.0.1:8095 scripts/dev-router.php`).
  // changeOrigin stays false so the browser's Origin reaches the API's checkOrigin() unchanged
  // (.env APP_ORIGIN=http://localhost:5173 for this setup).
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/Workboard/api': { target: 'http://127.0.0.1:8095', changeOrigin: false } },
  },
  build: {
    outDir: 'public',
    emptyOutDir: false,
    assetsDir: 'assets',
  },
});
