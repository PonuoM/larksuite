import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Local AppServ serves the app under /Workboard/; production (own subdomain) builds with WORKBOARD_BASE=/.
  base: process.env.WORKBOARD_BASE || '/Workboard/',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    assetsDir: 'assets',
  },
});
