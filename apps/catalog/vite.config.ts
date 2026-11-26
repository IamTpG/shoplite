import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  define: { 'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development') },
  build: {
    lib: { entry: 'src/entry.tsx', formats: ['es'], fileName: () => 'main.js' },
  },
}))
