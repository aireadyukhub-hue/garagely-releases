import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      // Electron loads the built app from file://, where Vite's `crossorigin`
      // attribute makes Chromium block the JS bundle (CORB) → blank screen.
      // Strip it so the packaged app's scripts/styles load locally.
      name: 'electron-strip-crossorigin',
      transformIndexHtml(html) {
        return html.replace(/\s+crossorigin/g, '')
      },
    },
  ],
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
