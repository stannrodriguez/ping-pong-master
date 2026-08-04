import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // GitHub Pages serves a project site from a subdirectory, so the built asset
  // URLs need that prefix. It comes from the environment rather than being
  // hard-coded so local dev keeps serving from `/` — set by the deploy workflow.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
