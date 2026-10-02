export default {
  publicDir: 'static',
  build: {
    outDir: 'public', emptyOutDir: true, target: 'es2022', minify: false,
    rollupOptions: { output: { entryFileNames: 'assets/index.js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } }
  }
};
