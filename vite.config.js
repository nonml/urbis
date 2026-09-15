import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
    plugins: [svelte()],
    base: './',
    assetsInclude: ['**/*.ktx2', '**/*.opus', '**/*.drc'],
    build: {
        outDir: 'build',
        assetsDir: 'assets',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            input: { main: 'index.html', re: 're.html' },
            output: {
                manualChunks: {
                    three: ['three'],
                    three_addons: [
                        'three/addons/postprocessing/EffectComposer.js',
                        'three/addons/postprocessing/RenderPass.js',
                        'three/addons/postprocessing/UnrealBloomPass.js',
                        'three/addons/objects/Sky.js',
                    ],
                    rapier: ['@dimforge/rapier3d-compat'],
                    svelte: ['svelte'],
                },
            },
        }
    },
    server: {
        port: 5173,
        open: false
    },
    define: {
        'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(new Date().toISOString()),
        'import.meta.env.VITE_BUILD_NUMBER': JSON.stringify('0.42.0-13d04a2')
    }
});