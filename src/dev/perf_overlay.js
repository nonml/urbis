// Performance overlay - toggle with F3 key
// Shows FPS, instance counts, and tick time

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

        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.lastFpsUpdate = 0;
        this.currentFps = 0;

        this.createDOM();
        this.bindEvents();
    }

    createDOM() {
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
            z-index: 10000;
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
        `;

        document.body.appendChild(this.container);

        // Cache elements
        this.fpsElement = this.container.querySelector('#perf-fps');
        this.tickElement = this.container.querySelector('#perf-tick');
        this.drawCallsElement = this.container.querySelector('#perf-draw');
        this.terrainInstancesElement = this.container.querySelector('#perf-terrain');
        this.buildingInstancesElement = this.container.querySelector('#perf-buildings');
        this.citizenInstancesElement = this.container.querySelector('#perf-citizens');
    }

    bindEvents() {
        window.addEventListener('keydown', (e) => {
            if (e.key === 'F3') {
                e.preventDefault();
                this.toggle();
            }
        });
    }

    toggle() {
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
        if (now - this.lastFpsUpdate >= 500) { // Update every 500ms
            this.currentFps = Math.round(this.frameCount * 1000 / (now - this.lastFpsUpdate));
            this.frameCount = 0;
            this.lastFpsUpdate = now;
        }

        this.fpsElement.textContent = this.currentFps;

        // Update tick time
        this.tickElement.textContent = Math.round(frameDt * 1000);

        // Approximate draw calls (One per terrain, one per building type, one per citizen type)
        let drawCalls = 1; // terrain
        drawCalls += this.game.buildings.buildings.length > 0 ? 1 : 0; // buildings mesh
        drawCalls += this.game.citizens.citizens.length > 0 ? 1 : 0; // citizens mesh

        this.drawCallsElement.textContent = drawCalls;

        // Instance counts
        this.terrainInstancesElement.textContent = this.game.map.width * this.game.map.height;
        this.buildingInstancesElement.textContent = this.game.buildings.buildings.length;
        this.citizenInstancesElement.textContent = this.game.citizens.citizens.length;
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}