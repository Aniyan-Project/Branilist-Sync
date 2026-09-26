import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/content/network-bridge.ts',
      name: 'BranilistSyncNetworkBridge',
      formats: ['iife'],
      fileName: () => 'assets/network-bridge.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});
