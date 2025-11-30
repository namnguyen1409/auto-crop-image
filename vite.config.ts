import { defineConfig } from 'vite'
import tailwindcss from "@tailwindcss/vite"
import react from '@vitejs/plugin-react'
import path from 'path'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    allowedHosts: ['localhost', 'sync.telecomic.top'],
    host: true,
  },
    esbuild: {
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  },
})
