export class BreachMinigame {
    constructor(game) {
        this.game = game;
        this.overlay = null;
        this.active = false;
        this.node = null;
        this.difficulty = 1;
        this.needle = 0;
        this.speed = 0.015;
        this.windowSize = 0.2;
        this.successFrom = 0.4;
        this.holdFrames = 0;
        this.raf = null;
        this.onComplete = null;
        this.bindings = null;
        this.mount();
    }

    mount() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'breach-overlay';
        this.overlay.className = 'overlay hidden';
        this.overlay.innerHTML = `
            <div class="overlay-content breach-content">
                <h2>Breach Sync</h2>
                <p id="breach-label"></p>
                <div class="breach-track"><div id="breach-window"></div><div id="breach-needle"></div></div>
                <p>Hold SPACE inside the green window</p>
            </div>
        `;
        document.body.appendChild(this.overlay);
    }

    start(node, onComplete) {
        if (this.active) return;
        this.active = true;
        this.node = node;
        this.onComplete = onComplete;
        this.difficulty = Math.max(1, node.securityLevel || 1);
        this.speed = 0.012 + (this.difficulty * 0.006);
        this.windowSize = Math.max(0.08, 0.26 - (this.difficulty * 0.03));
        this.successFrom = 0.5 - (this.windowSize / 2);
        this.needle = 0;
        this.holdFrames = 0;

        const label = this.overlay.querySelector('#breach-label');
        const win = this.overlay.querySelector('#breach-window');
        if (label) label.textContent = `${node.name} / Security ${this.difficulty}`;
        if (win) {
            win.style.left = `${this.successFrom * 100}%`;
            win.style.width = `${this.windowSize * 100}%`;
        }

        this.overlay.classList.remove('hidden');
        this.bindings = {
            down: (e) => {
                if (e.code === 'Space') {
                    e.preventDefault();
                    this.holding = true;
                }
                if (e.code === 'Escape') {
                    e.preventDefault();
                    this.finish(false);
                }
            },
            up: (e) => {
                if (e.code === 'Space') this.holding = false;
            },
        };
        window.addEventListener('keydown', this.bindings.down);
        window.addEventListener('keyup', this.bindings.up);
        this.tick();
    }

    tick() {
        if (!this.active) return;
        this.needle += this.speed;
        if (this.needle > 1) this.needle -= 1;

        const needleEl = this.overlay.querySelector('#breach-needle');
        if (needleEl) needleEl.style.left = `${this.needle * 100}%`;

        const inWindow = this.needle >= this.successFrom && this.needle <= (this.successFrom + this.windowSize);
        if (this.holding && inWindow) this.holdFrames++;
        else this.holdFrames = Math.max(0, this.holdFrames - 2);

        if (this.holdFrames >= (20 + (this.difficulty * 8))) {
            this.finish(true);
            return;
        }
        this.raf = requestAnimationFrame(() => this.tick());
    }

    finish(success) {
        if (!this.active) return;
        this.active = false;
        this.holding = false;
        if (this.raf) cancelAnimationFrame(this.raf);
        this.raf = null;
        this.overlay.classList.add('hidden');
        if (this.bindings) {
            window.removeEventListener('keydown', this.bindings.down);
            window.removeEventListener('keyup', this.bindings.up);
            this.bindings = null;
        }
        const cb = this.onComplete;
        this.onComplete = null;
        if (cb) cb(success, this.node);
        this.node = null;
    }
}

