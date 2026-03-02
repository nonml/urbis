// Performance overlay - toggle with F3 key
// Shows FPS, instance counts, and tick time

const FPS_UPDATE_INTERVAL = 500;
const OVERLAY_Z_INDEX = 10000;

export class PerfOverlay {
    constructor(game) {
        this.game = game;
        this.enabled = false;
        this.container = null;
        this.fpsElement = null;
        this.tickElement = null;
        this.drawCallsElement = null;
        this.terrainInstancesElement = null;
        this.buildingInstancesElement = null;
        this.citizenInstancesElement = null;
        this.activeChunksElement = null;

        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.currentFps = 0;

        // Store handler reference for cleanup
        this.toggleHandler = (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                this.toggle();
            }
        };

        this.createDOM();
        this.bindEvents();
    }

    createDOM() {
        // Prevent duplicate IDs by removing existing overlay if present
        const existing = document.getElementById('perf-overlay');
        if (existing) {
            existing.parentNode?.removeChild(existing);
        }

        // Create overlay container
        this.container = document.createElement('div');
        this.container.id = 'perf-overlay';
        this.container.className = 'hidden';
        this.container.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: #0f0;
            font-family: 'Courier New', monospace;
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            z-index: ${OVERLAY_Z_INDEX};
            pointer-events: none;
        `;

        this.container.innerHTML = `
            <div style="margin-bottom: 5px; border-bottom: 1px solid #0f0; padding-bottom: 5px;">Performance Overlay (F3 to toggle)</div>
            <div>FPS: <span id="perf-fps">0</span></div>
            <div>Tick: <span id="perf-tick">0</span> ms</div>
            <div>Draw Calls: <span id="perf-draw">0</span></div>
            <div>Terrain: <span id="perf-terrain">0</span> instances</div>
            <div>Buildings: <span id="perf-buildings">0</span> instances</div>
            <div>Citizens: <span id="perf-citizens">0</span> instances</div>
            <div>Active Chunks: <span id="perf-chunks">0</span></div>
        `;

        document.body.appendChild(this.container);

        // Cache elements
        this.fpsElement = this.container.querySelector('#perf-fps');
        this.tickElement = this.container.querySelector('#perf-tick');
        this.drawCallsElement = this.container.querySelector('#perf-draw');
        this.terrainInstancesElement = this.container.querySelector('#perf-terrain');
        this.buildingInstancesElement = this.container.querySelector('#perf-buildings');
        this.citizenInstancesElement = this.container.querySelector('#perf-citizens');
        this.activeChunksElement = this.container.querySelector('#perf-chunks');
    }

    bindEvents() {
        window.addEventListener('keydown', this.toggleHandler);
    }

    toggle() {
        if (!this.container) return;

        this.enabled = !this.enabled;
        if (this.enabled) {
            this.container.classList.remove('hidden');
            this.lastFrameTime = performance.now();
            this.frameCount = 0;
            this.lastFpsUpdate = performance.now();
        } else {
            this.container.classList.add('hidden');
        }
    }

    update(frameDt, renderer) {
        if (!this.enabled) return;

        // Update FPS
        this.frameCount++;
        const now = performance.now();
        if (now - this.lastFpsUpdate >= FPS_UPDATE_INTERVAL) { // Update every 500ms
            this.currentFps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }

        this.fpsElement.textContent = this.currentFps;

        // Update tick time
        this.tickElement.textContent = Math.round(frameDt);

        const perf = renderer?.getPerfStats?.() || {};
        this.drawCallsElement.textContent = perf.drawCalls ?? 0;
        this.terrainInstancesElement.textContent = perf.terrainInstances ?? 0;
        this.buildingInstancesElement.textContent = perf.buildingInstances ?? 0;
        this.citizenInstancesElement.textContent = perf.citizenInstances ?? (this.game?.citizens?.citizens?.length ?? 0);
        this.activeChunksElement.textContent = perf.activeChunks ?? 0;
    }

    destroy() {
        // Remove event listener to prevent memory leaks
        if (this.toggleHandler) {
            window.removeEventListener('keydown', this.toggleHandler);
        }

        // Remove DOM node
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        // Clear references to help GC
        this.container = null;
        this.toggleHandler = null;
    }
}
