import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Don't empty — avoids unlink permission errors on some filesystems
    sourcemap: false,
  },
  server: {
    port: 5173,
  },
})
