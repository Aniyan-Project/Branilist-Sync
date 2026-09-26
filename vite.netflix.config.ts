import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/content/netflix.ts',
      name: 'BranilistSyncNetflix',
      formats: ['iife'],
      fileName: () => 'assets/netflix-content.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
