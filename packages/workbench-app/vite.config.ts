import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // This matches any request starting with /zen-api
      '/zen-api': {
        target: 'https://opencode.ai/zen/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/zen-api/, ''),
        secure: true,
      },
    },
  },
});
