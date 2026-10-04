import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' lets the built app run from any sub-path (GitHub Pages, a folder, etc.)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 1000 },
})
