import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Builds the manager UI into dist/webview/assets/{index.js,index.css} as one classic
// script, which is what the extension's CSP-locked webview loads.
export default defineConfig({
    root: __dirname,
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
        outDir: path.resolve(__dirname, '../dist/webview'),
        emptyOutDir: true,
        target: 'es2022',
        cssCodeSplit: false,
        lib: {
            entry: path.resolve(__dirname, 'src/main.tsx'),
            formats: ['iife'],
            name: 'LaunchpadUI',
            fileName: () => 'assets/index.js',
            cssFileName: 'index',
        },
        rollupOptions: {
            output: { assetFileNames: 'assets/[name][extname]' },
        },
    },
});
