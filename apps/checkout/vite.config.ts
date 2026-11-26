import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [vue()],
  define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development') },
  build: {
    lib: { entry: 'src/entry.ts', formats: ['es'], fileName: () => 'main.js' },
  },
}))
