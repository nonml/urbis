import { eventBus, EVENT_TYPES } from '../sim/events.js';

const BARKS = {
    alert: [
        'Dispatch: All units, suspicious activity reported.',
        'Dispatch: Responding to disturbance call.',
        'Unit 7: Copy, en route.',
    ],
    search: [
        'Dispatch: Suspect last seen in the area. Begin search.',
        'Unit 4: Requesting additional units.',
        'Dispatch: Expanding perimeter. All units converge.',
    ],
    pursuit: [
        'Dispatch: Suspect is fleeing! All units pursue!',
        'Unit 12: In pursuit, heading east.',
        'Dispatch: Requesting air support.',
        'Dispatch: Deploy roadblocks on all exits!',
    ],
    encounter: [
        'Unit 9: Contact! Suspect in sight!',
        'Unit 3: Engaging!',
        'Dispatch: Backup is en route.',
    ],
    arrest: [
        'Dispatch: Suspect in custody. Stand down.',
        'Unit 7: Area secured. Returning to patrol.',
    ],
};

const DISPLAY_DURATION = 3500;
const FADE_DURATION = 500;

export class DispatchRadio {
    constructor(game) {
        this.game = game;
        this._el = null;
        this._timer = 0;
        this._queue = [];
        this._lastBarkTime = 0;
        this._build();
        this._listen();
    }

    _build() {
        this._el = document.createElement('div');
        this._el.className = 'dispatch-radio';
        this._el.style.cssText = [
            'position:fixed;bottom:80px;left:50%;transform:translateX(-50%)',
            'font-family:var(--font-mono,monospace);font-size:12px',
            'color:var(--neon-cyan,#0ff);background:rgba(0,0,0,0.6)',
            'padding:6px 16px;border-radius:4px;z-index:40',
            'opacity:0;transition:opacity 0.3s;pointer-events:none',
            'white-space:nowrap;letter-spacing:0.05em',
        ].join(';');
    }

    get element() {
        return this._el;
    }

    _listen() {
        eventBus.on(EVENT_TYPES.PLAYER_FIRED_WEAPON, () => {
            this._queueBark('alert');
        });
        eventBus.on(EVENT_TYPES.POLICE_ENCOUNTER, () => {
            this._queueBark('encounter');
        });
    }

    _queueBark(category) {
        const now = performance.now();
        if (now - this._lastBarkTime < 4000) return;
        const list = BARKS[category];
        if (!list || list.length === 0) return;
        const idx = Math.floor((this.game.rng?.next?.() ?? 0) * list.length);
        this._queue.push(list[idx % list.length]);
    }

    showForHeatLevel(level) {
        if (level === 'search') this._queueBark('search');
        else if (level === 'pursuit') this._queueBark('pursuit');
    }

    showArrest() {
        this._queueBark('arrest');
    }

    update(dt) {
        if (this._timer > 0) {
            this._timer -= dt;
            if (this._timer <= FADE_DURATION) {
                this._el.style.opacity = String(this._timer / FADE_DURATION);
            }
            if (this._timer <= 0) {
                this._el.style.opacity = '0';
            }
            return;
        }
        if (this._queue.length > 0) {
            const text = this._queue.shift();
            this._el.textContent = text;
            this._el.style.opacity = '1';
            this._timer = DISPLAY_DURATION;
            this._lastBarkTime = performance.now();
        }
    }
}
