import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
  ,
  // Temporary debug build settings: produce sourcemaps and avoid minification
  // so runtime stacks are easier to trace. Remove or revert these before final
  // production releases if you prefer minified assets.
  build: {
    sourcemap: true,
    minify: false
  }
})
