import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  css: { postcss: { plugins: [tailwindcss()] } },
  server: {
    host: '127.0.0.1',
    port: 3001,
    strictPort: true,
    // FSEvents is unavailable in some agent sandboxes; keep local HMR usable.
    watch:
      process.env.CODEX_SANDBOX === 'seatbelt'
        ? { useFsEvents: false, usePolling: true }
        : undefined,
  },
});
