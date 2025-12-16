import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true, // Clears the dist folder before starting
  },
  server: {
    port: 5175,
    strictPort: true,
    cors: true
  }
})