/**
 * In-car radio tuning UI.
 *
 * A small DOM widget that appears while driving, shows the current
 * channel name + frequency + mood, and accepts three keybinds:
 *
 *   `[`   previous channel
 *   `]`   next channel
 *   `\\`  toggle on/off
 *
 * The HUD is render-only — it asks a RadioManager for state and
 * forwards key presses to it.  If constructed without a `parent`
 * element (e.g. in tests), it operates in state-only mode: no DOM
 * is created, but `handleKey` and `getRenderState` still work.
 */

const RADIO_KEYS = {
    next: ']',
    previous: '[',
    toggle: '\\',
};

const HIDDEN_OPACITY = 0;
const VISIBLE_OPACITY = 1;

export class RadioHUD {
    constructor({ parent, radio } = {}) {
        if (!radio) throw new Error('RadioHUD requires a RadioManager');
        this.radio = radio;
        this._driving = false;
        this._lastRenderedId = null;
        this._lastVisible = false;

        if (parent && typeof parent.appendChild === 'function' && typeof document !== 'undefined') {
            this._mountDom(parent);
        } else {
            this._el = null;
        }
    }

    _mountDom(parent) {
        const el = document.createElement('div');
        el.className = 'radio-hud';
        el.style.cssText = [
            'position:absolute', 'right:16px', 'bottom:108px',
            'min-width:160px', 'padding:8px 10px',
            'background:rgba(0,0,0,0.55)', 'border:1px solid #555',
            'border-radius:6px', 'color:#eee', 'font-family:monospace',
            'font-size:12px', 'opacity:0', 'transition:opacity 200ms',
            'pointer-events:none',
        ].join(';');
        el.innerHTML = `
            <div class="radio-hud-name" style="font-weight:bold;font-size:14px"></div>
            <div class="radio-hud-meta" style="opacity:0.75"></div>
            <div class="radio-hud-keys" style="opacity:0.5;margin-top:4px;font-size:10px">[ ] tune  \\ off</div>
        `;
        parent.appendChild(el);
        this._el = el;
        this._nameEl = el.querySelector('.radio-hud-name');
        this._metaEl = el.querySelector('.radio-hud-meta');
    }

    setDriving(isDriving) {
        this._driving = !!isDriving;
        this._render();
    }

    handleKey(key) {
        if (!this._driving) return false;
        if (key === RADIO_KEYS.next) { this.radio.next(); this._render(); return true; }
        if (key === RADIO_KEYS.previous) { this.radio.previous(); this._render(); return true; }
        if (key === RADIO_KEYS.toggle) {
            if (this.radio.isOn()) this.radio.turnOff();
            else this.radio.next();
            this._render();
            return true;
        }
        return false;
    }

    getRenderState() {
        const ch = this.radio.currentChannel();
        const visible = this._driving;
        if (!ch) return { visible, on: false, name: 'Radio Off', mood: null, color: '#888', frequency: null };
        return {
            visible,
            on: true,
            name: ch.name,
            mood: ch.mood,
            color: ch.color,
            frequency: (ch.frequencyKHz / 1000).toFixed(1),
        };
    }

    _render() {
        const s = this.getRenderState();
        if (!this._el) {
            this._lastVisible = s.visible;
            this._lastRenderedId = s.on ? s.name : 'off';
            return;
        }
        if (s.visible !== this._lastVisible) {
            this._lastVisible = s.visible;
            this._el.style.opacity = s.visible ? VISIBLE_OPACITY : HIDDEN_OPACITY;
        }
        const id = s.on ? s.name : 'off';
        if (id !== this._lastRenderedId) {
            this._lastRenderedId = id;
            this._nameEl.textContent = s.on ? s.name : '— off —';
            this._metaEl.textContent = s.on ? `${s.frequency} kHz · ${s.mood}` : '';
            this._el.style.borderColor = s.on ? s.color : '#555';
        }
    }

    destroy() {
        if (this._el && this._el.parentElement) {
            this._el.parentElement.removeChild(this._el);
        }
        this._el = null;
    }
}

export { RADIO_KEYS };
