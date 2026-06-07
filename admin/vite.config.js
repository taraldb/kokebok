import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ command }) => ({
  plugins: [tailwindcss()],
  root: path.resolve(__dirname),
  base: command === 'serve' ? '/' : '/admin/',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api':     { target: 'http://localhost:3001', changeOrigin: true },
      '/r':       { target: 'http://localhost:3001', changeOrigin: true },
      '/recipes': { target: 'http://localhost:3001', changeOrigin: true },
      '/assets':  { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
}))
