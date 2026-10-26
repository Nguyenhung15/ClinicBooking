import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // required to expose the dev server from a Docker container
    port: 5173,
    watch: { usePolling: true }, // reliable HMR with bind mounts on macOS/Windows
  },
})
