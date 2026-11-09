import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const api = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': { target: api },
      '/ws': { target: api.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    target: 'es2022',
  },
});
