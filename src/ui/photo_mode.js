/**
 * Photo Mode (6C)
 * - Pauses the game and unlocks the camera for free movement
 * - WASD + mouse-drag to navigate, scroll to zoom
 * - Exports the current frame as a PNG download
 */

export class PhotoMode {
    constructor(game) {
        this.game = game;
        this.active = false;
        this._wasPaused = false;
        this._overlay = null;
        this._bindings = null;
        // Free-camera state (stored separately from game camera)
        this._freeYaw = 0;
        this._freePitch = -0.5;
        this._freePos = null; // THREE.Vector3 set on activate
        this._freeDragStart = null;
        this._keys = new Set();
        this._raf = null;
        this._mount();
    }

    _mount() {
        this._overlay = document.createElement('div');
        this._overlay.id = 'photo-mode-overlay';
        this._overlay.className = 'hidden';
        this._overlay.innerHTML = `
            <div id="photo-mode-hud">
                <span id="photo-mode-label">📷 PHOTO MODE</span>
                <div id="photo-mode-controls">
                    <span>WASD – move &nbsp;|&nbsp; drag – look &nbsp;|&nbsp; scroll – zoom</span>
                </div>
                <div id="photo-mode-actions">
                    <button id="photo-capture-btn">📸 Capture</button>
                    <button id="photo-timelapse-btn">⏩ Timelapse</button>
                    <button id="photo-exit-btn">Exit (P)</button>
                </div>
                <div id="photo-timelapse-status" style="display:none;color:#ffcc00;font-size:11px;">
                    ⏩ Recording… <span id="photo-timelapse-count">0</span> frames
                </div>
            </div>
        `;
        Object.assign(this._overlay.style, {
            position: 'fixed', inset: '0', zIndex: '9000',
            pointerEvents: 'none',
        });
        const hud = this._overlay.querySelector('#photo-mode-hud');
        Object.assign(hud.style, {
            position: 'absolute', bottom: '24px', left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)',
            color: '#fff', padding: '10px 20px', borderRadius: '12px',
            display: 'flex', alignItems: 'center', gap: '20px',
            pointerEvents: 'all', userSelect: 'none',
            fontFamily: 'monospace', fontSize: '13px',
        });
        const captureBtn = this._overlay.querySelector('#photo-capture-btn');
        const exitBtn = this._overlay.querySelector('#photo-exit-btn');
        for (const btn of [captureBtn, exitBtn]) {
            Object.assign(btn.style, {
                padding: '6px 14px', borderRadius: '6px', border: 'none',
                cursor: 'pointer', background: 'rgba(255,255,255,0.15)',
                color: '#fff', fontFamily: 'monospace',
            });
        }
        captureBtn.addEventListener('click', () => this.capture());
        exitBtn.addEventListener('click', () => this.deactivate());
        const timelapseBtn = this._overlay.querySelector('#photo-timelapse-btn');
        Object.assign(timelapseBtn.style, {
            padding: '6px 14px', borderRadius: '6px', border: 'none',
            cursor: 'pointer', background: 'rgba(255,200,0,0.2)',
            color: '#fff', fontFamily: 'monospace',
        });
        timelapseBtn.addEventListener('click', () => this.toggleTimelapse());
        document.body.appendChild(this._overlay);

        this._timelapseActive = false;
        this._timelapseInterval = null;
        this._timelapseFrames = 0;
        this._timelapseSpeedBefore = 1;
    }

    activate() {
        if (this.active) return;
        this.active = true;
        this._wasPaused = !!this.game.state?.time?.paused;
        if (this.game.state?.time) this.game.state.time.paused = true;

        // Snapshot current camera state
        const r = this.game.ui?.renderer3d;
        if (r?.camera) {
            const THREE = r.camera.constructor.prototype.constructor;
            // Use duck-typed Vector3
            this._freePos = { x: r.camera.position.x, y: r.camera.position.y, z: r.camera.position.z };
            this._freeYaw = r.yaw ?? 0;
            this._freePitch = r.pitch ?? -0.4;
        }

        this._overlay.classList.remove('hidden');
        this._setupListeners();
        this._tick();
        this.game.ui?.showMessage('📷 Photo Mode — P to exit', 'normal');
    }

    deactivate() {
        if (!this.active) return;
        if (this._timelapseActive) this._stopTimelapse();
        this.active = false;
        if (this.game.state?.time) this.game.state.time.paused = this._wasPaused;
        this._overlay.classList.add('hidden');
        this._removeListeners();
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
        // Restore normal camera
        const r = this.game.ui?.renderer3d;
        if (r) r._photoMode = false;
    }

    capture() {
        // Render one frame then export canvas as PNG
        const r = this.game.ui?.renderer3d;
        const canvas = r?.renderer?.domElement ?? r?.canvas ?? document.querySelector('#game-canvas');
        if (!canvas) return;
        // Force a render if possible
        if (r?.renderer && r?.scene && r?.camera) {
            r.renderer.render(r.scene, r.camera);
        }
        const link = document.createElement('a');
        link.download = `city_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this.game.ui?.showMessage('📸 Screenshot saved!', 'success');
    }

    _setupListeners() {
        const canvas = document.querySelector('#game-canvas');
        this._bindings = {
            keydown: (e) => {
                this._keys.add(e.code);
                if (e.code === 'KeyP') this.deactivate();
            },
            keyup: (e) => this._keys.delete(e.code),
            mousedown: (e) => {
                if (e.button === 0 || e.button === 2) {
                    this._freeDragStart = { x: e.clientX, y: e.clientY, yaw: this._freeYaw, pitch: this._freePitch };
                    e.preventDefault();
                }
            },
            mousemove: (e) => {
                if (this._freeDragStart) {
                    const dx = (e.clientX - this._freeDragStart.x) * 0.005;
                    const dy = (e.clientY - this._freeDragStart.y) * 0.005;
                    this._freeYaw = this._freeDragStart.yaw + dx;
                    this._freePitch = Math.max(-1.5, Math.min(-0.05, this._freeDragStart.pitch - dy));
                }
            },
            mouseup: () => { this._freeDragStart = null; },
            wheel: (e) => {
                // zoom = move forward/back along look direction
                const speed = e.deltaY > 0 ? 1 : -1;
                this._moveFreeCamera(0, 0, speed * 0.5);
            },
            contextmenu: (e) => e.preventDefault(),
        };
        window.addEventListener('keydown', this._bindings.keydown);
        window.addEventListener('keyup', this._bindings.keyup);
        const el = canvas ?? window;
        el.addEventListener('mousedown', this._bindings.mousedown);
        window.addEventListener('mousemove', this._bindings.mousemove);
        window.addEventListener('mouseup', this._bindings.mouseup);
        window.addEventListener('wheel', this._bindings.wheel, { passive: false });
        canvas?.addEventListener('contextmenu', this._bindings.contextmenu);
    }

    _removeListeners() {
        if (!this._bindings) return;
        window.removeEventListener('keydown', this._bindings.keydown);
        window.removeEventListener('keyup', this._bindings.keyup);
        window.removeEventListener('mousemove', this._bindings.mousemove);
        window.removeEventListener('mouseup', this._bindings.mouseup);
        window.removeEventListener('wheel', this._bindings.wheel);
        this._bindings = null;
    }

    _moveFreeCamera(dx, dy, dz) {
        if (!this._freePos) return;
        const cos = Math.cos(this._freeYaw), sin = Math.sin(this._freeYaw);
        // Strafe (dx), up/down (dy), forward (dz)
        this._freePos.x += cos * dx - sin * dz;
        this._freePos.z += sin * dx + cos * dz;
        this._freePos.y += dy;
    }

    _tick() {
        if (!this.active) return;
        // Move from WASD
        const speed = 0.15;
        if (this._keys.has('KeyW') || this._keys.has('ArrowUp'))    this._moveFreeCamera(0, 0, -speed);
        if (this._keys.has('KeyS') || this._keys.has('ArrowDown'))  this._moveFreeCamera(0, 0,  speed);
        if (this._keys.has('KeyA') || this._keys.has('ArrowLeft'))  this._moveFreeCamera(-speed, 0, 0);
        if (this._keys.has('KeyD') || this._keys.has('ArrowRight')) this._moveFreeCamera( speed, 0, 0);
        if (this._keys.has('KeyQ')) this._moveFreeCamera(0, -speed, 0);
        if (this._keys.has('KeyE')) this._moveFreeCamera(0,  speed, 0);

        // Push free-camera state into the renderer
        const r = this.game.ui?.renderer3d;
        if (r?.camera && this._freePos) {
            r._photoMode = true;
            r.camera.position.set(this._freePos.x, this._freePos.y, this._freePos.z);
            // Look direction from yaw+pitch
            const lookX = this._freePos.x + Math.sin(this._freeYaw) * Math.cos(this._freePitch) * 5;
            const lookY = this._freePos.y + Math.sin(this._freePitch) * 5;
            const lookZ = this._freePos.z + Math.cos(this._freeYaw) * Math.cos(this._freePitch) * 5;
            r.camera.lookAt(lookX, lookY, lookZ);
        }
        this._raf = requestAnimationFrame(() => this._tick());
    }

    /**
     * Timelapse: un-pause game, ramp speed to max, auto-capture a frame every 2 ticks (6C).
     * Pressing the button again stops the timelapse and restores speed.
     */
    toggleTimelapse() {
        if (this._timelapseActive) {
            this._stopTimelapse();
        } else {
            this._startTimelapse();
        }
    }

    _startTimelapse() {
        this._timelapseActive = true;
        this._timelapseFrames = 0;

        const timeState = this.game.state?.time;
        if (timeState) {
            this._timelapseSpeedBefore = timeState.speed ?? 1;
            // Un-pause and run at maximum speed (speed 4 = fastest preset)
            timeState.paused = false;
            timeState.speed = 4;
        }

        // Update HUD
        const btn = this._overlay.querySelector('#photo-timelapse-btn');
        if (btn) { btn.textContent = '⏹ Stop'; btn.style.background = 'rgba(255,80,80,0.3)'; }
        const status = this._overlay.querySelector('#photo-timelapse-status');
        if (status) status.style.display = 'block';

        // Capture a frame every 1.5s
        this._timelapseInterval = setInterval(() => {
            if (!this.active) { this._stopTimelapse(); return; }
            this._captureTimelapseFrame();
        }, 1500);

        this.game.ui?.showMessage('⏩ Timelapse started — stop with the button', 'normal');
    }

    _stopTimelapse() {
        this._timelapseActive = false;
        clearInterval(this._timelapseInterval);
        this._timelapseInterval = null;

        const timeState = this.game.state?.time;
        if (timeState) {
            timeState.speed = this._timelapseSpeedBefore;
            timeState.paused = true; // re-pause since we're still in photo mode
        }

        const btn = this._overlay.querySelector('#photo-timelapse-btn');
        if (btn) { btn.textContent = '⏩ Timelapse'; btn.style.background = 'rgba(255,200,0,0.2)'; }
        const status = this._overlay.querySelector('#photo-timelapse-status');
        if (status) status.style.display = 'none';

        this.game.ui?.showMessage(`⏹ Timelapse stopped — ${this._timelapseFrames} frames captured`, 'success');
    }

    _captureTimelapseFrame() {
        const r = this.game.ui?.renderer3d;
        const canvas = r?.renderer?.domElement ?? document.querySelector('#game-canvas');
        if (!canvas) return;
        if (r?.renderer && r?.scene && r?.camera) r.renderer.render(r.scene, r.camera);
        const link = document.createElement('a');
        link.download = `timelapse_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        this._timelapseFrames++;
        const counter = this._overlay.querySelector('#photo-timelapse-count');
        if (counter) counter.textContent = this._timelapseFrames;
    }

    toggle() {
        this.active ? this.deactivate() : this.activate();
    }
}
