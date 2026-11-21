import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: process.env.RADIOGRAPHER_BUILD_OUT_DIR ? {outDir:process.env.RADIOGRAPHER_BUILD_OUT_DIR,emptyOutDir:false} : {},
  optimizeDeps: { entries: ['index.html'] },
  server: {
    host: '127.0.0.1',
    watch: { ignored: ['**/_work_extracted*/**', '**/assets*/**', '**/dist*/**', '**/.venv/**', '**/.cache/**', '**/src/uploads/**', '**/public/uploads/**'] },
  },
})
