import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: o mesmo build funciona em qualquer subpasta (GitHub Pages no Plano 5)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
