import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/content/netflix-bridge.ts',
      name: 'BranilistSyncNetflixBridge',
      formats: ['iife'],
      fileName: () => 'assets/netflix-bridge.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
