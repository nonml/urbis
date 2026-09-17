import { defineConfig } from 'vite';

export default defineConfig({
    base: './',
    build: {
        outDir: 'build',
        assetsDir: 'assets',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    three: ['three'],
                    three_addons: [
                        'three/addons/postprocessing/EffectComposer.js',
                        'three/addons/postprocessing/RenderPass.js',
                        'three/addons/postprocessing/UnrealBloomPass.js',
                        'three/addons/postprocessing/SSAOPass.js',
                        'three/addons/postprocessing/ShaderPass.js',
                        'three/addons/postprocessing/OutputPass.js',
                    ],
                },
            },
        },
    },
    server: {
        port: 5173,
        open: false,
    },
});
