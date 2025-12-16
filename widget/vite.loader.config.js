import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // Important: Don't delete the App files we just built!
    lib: {
      entry: path.resolve(__dirname, 'src/widget-loader.js'),
      name: 'QuellAIWidget',
      fileName: (format) => `widget.js`,
      formats: ['iife'] // Creates a self-executing script for browsers
    },
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true
      }
    }
  }
});