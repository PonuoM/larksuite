import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/Workboard/',
  publicDir: false,
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    assetsDir: 'assets',
  },
});
