import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// The web app reuses the desktop's React UI verbatim from ../src.
// Because that shared code lives in a different folder with its own
// node_modules, we MUST force a single copy of React + React Router so the
// Router context provider (from main.tsx) and consumers (from ../src, e.g.
// Layout's useLocation) share the same module instance. Without this you get
// "useLocation() outside a <Router>" crashes from duplicate react-router-dom.
const single = (pkg: string) => path.resolve(__dirname, 'node_modules', pkg)

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      react: single('react'),
      'react-dom': single('react-dom'),
      'react-router-dom': single('react-router-dom'),
      'react-router': single('react-router'),
    },
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react-router'],
  },
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
  },
  server: {
    port: 5174,
    fs: { allow: ['..'] }, // allow importing the shared ../src tree in dev
  },
})
