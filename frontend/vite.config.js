import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:8000'
const backendWsUrl = process.env.VITE_BACKEND_WS_URL || 'ws://localhost:8000'

export default defineConfig({
  plugins: [react()],
  build: { sourcemap: true },
  server: {
    port: 3000,
    host: '0.0.0.0',
    allowedHosts: ['crm.taperpay.com', 'localhost', '178.105.76.158'],
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/static': {
        target: backendUrl,
        changeOrigin: true,
      },
      '/ws': {
        target: backendWsUrl,
        ws: true,
      },
    },
  },
})
