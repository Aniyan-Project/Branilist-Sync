import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'dist', emptyOutDir: false,
    lib: { entry: 'src/content/index.ts', name: 'BranilistSync', formats: ['iife'], fileName: () => 'assets/content.js' },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
