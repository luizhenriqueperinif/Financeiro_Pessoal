import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@core': path.resolve(import.meta.dirname, './src/core'),
      '@infra': path.resolve(import.meta.dirname, './src/infra'),
      '@ui': path.resolve(import.meta.dirname, './src/ui'),
    },
  },
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
