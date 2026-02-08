import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Lokaler Dev-Proxy: /api/* → Backend-Worker
    proxy: {
      '/api': {
        target: 'https://cf-ai-workspace.ourark.workers.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
