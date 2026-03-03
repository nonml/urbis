import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'build',
        assetsDir: 'assets',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            input: 'index.html'
        }
    },
    server: {
        port: 5173,
        open: true
    },
    define: {
        'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(new Date().toISOString()),
        'import.meta.env.VITE_BUILD_NUMBER': JSON.stringify('0.42.0-13d04a2')
    }
});