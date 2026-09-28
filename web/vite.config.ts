import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const apiTarget = process.env.VITE_DEV_API_URL ?? 'http://localhost:3000';
const gameTarget = process.env.VITE_DEV_GAME_URL ?? 'http://localhost';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': apiTarget,
      // Game streams are served by the Traefik stack (docker compose).
      '/play': { target: gameTarget, ws: true },
    },
  },
});
