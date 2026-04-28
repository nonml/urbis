/**
 * Radial Hack Menu — Watch Dogs-style radial selector around a hackable target.
 * Shows available hack actions as segments of a circle, with cooldown rings.
 */

const SEGMENT_GAP = 4;
const RING_RADIUS = 60;

export class RadialHackMenu {
    constructor(game) {
        this.game = game;
        this._el = null;
        this._visible = false;
        this._target = null;
        this._options = [];
        this._selectedIndex = 0;
        this._init();
    }

    _init() {
        document.getElementById('radial-hack-menu')?.remove();

        this._el = document.createElement('div');
        this._el.id = 'radial-hack-menu';
        this._el.className = 'rhm-container';

        if (!document.getElementById('rhm-css')) {
            const s = document.createElement('style');
            s.id = 'rhm-css';
            s.textContent = `
                .rhm-container {
                    position: absolute;
                    width: 160px;
                    height: 160px;
                    pointer-events: none;
                    z-index: 30;
                    opacity: 0;
                    transition: opacity 0.15s;
                    transform: translate(-50%, -50%);
                }
                .rhm-container.on {
                    opacity: 1;
                    pointer-events: auto;
                }
                .rhm-segment {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    width: 52px;
                    height: 28px;
                    margin-left: -26px;
                    margin-top: -14px;
                    background: rgba(0,10,20,0.85);
                    border: 1px solid rgba(0,255,255,0.3);
                    border-radius: 4px;
                    color: rgba(255,255,255,0.85);
                    font-size: 10px;
                    font-family: 'Consolas', monospace;
                    text-align: center;
                    line-height: 28px;
                    cursor: pointer;
                    transition: border-color 0.15s, background 0.15s;
                    backdrop-filter: blur(3px);
                }
                .rhm-segment.selected {
                    border-color: #00ffff;
                    background: rgba(0,255,255,0.15);
                    color: #00ffff;
                    font-weight: 700;
                }
                .rhm-segment.cooldown {
                    opacity: 0.4;
                    pointer-events: none;
                }
                .rhm-center {
                    position: absolute;
                    left: 50%;
                    top: 50%;
                    width: 20px;
                    height: 20px;
                    margin-left: -10px;
                    margin-top: -10px;
                    border-radius: 50%;
                    border: 2px solid rgba(0,255,255,0.5);
                    background: rgba(0,10,20,0.7);
                }
            `;
            document.head.appendChild(s);
        }

        const anchor = document.getElementById('main-area') || document.body;
        anchor.appendChild(this._el);
    }

    open(target, screenX, screenY) {
        this._target = target;
        this._selectedIndex = 0;
        this._options = this._getOptionsForTarget(target);
        this._render();
        this._el.style.left = screenX + 'px';
        this._el.style.top = screenY + 'px';
        this._el.classList.add('on');
        this._visible = true;
    }

    close() {
        this._el.classList.remove('on');
        this._visible = false;
        this._target = null;
        this._options = [];
    }

    get isOpen() {
        return this._visible;
    }

    get selectedOption() {
        return this._options[this._selectedIndex] || null;
    }

    selectNext() {
        if (this._options.length === 0) return;
        this._selectedIndex = (this._selectedIndex + 1) % this._options.length;
        this._updateSelection();
    }

    selectPrev() {
        if (this._options.length === 0) return;
        this._selectedIndex = (this._selectedIndex - 1 + this._options.length) % this._options.length;
        this._updateSelection();
    }

    confirm() {
        const opt = this.selectedOption;
        if (!opt || opt.onCooldown) return null;
        this.close();
        return opt;
    }

    selectByNumber(num) {
        const idx = num - 1;
        if (idx < 0 || idx >= this._options.length) return null;
        this._selectedIndex = idx;
        this._updateSelection();
        return this.confirm();
    }

    handleKey(key) {
        if (!this._visible) return null;
        if (key === 'ArrowRight' || key === 'ArrowDown') {
            this.selectNext();
            return 'navigate';
        }
        if (key === 'ArrowLeft' || key === 'ArrowUp') {
            this.selectPrev();
            return 'navigate';
        }
        if (key === 'Enter' || key === ' ') {
            return this.confirm();
        }
        if (key === 'Escape') {
            this.close();
            return 'close';
        }
        const num = parseInt(key, 10);
        if (num >= 1 && num <= 9) {
            return this.selectByNumber(num);
        }
        return null;
    }

    _getOptionsForTarget(target) {
        if (!target) return [];
        const actions = [];
        switch (target.type) {
            case 'CCTV_POLE':
                actions.push({ id: 'camera_takeover', label: 'View' });
                actions.push({ id: 'cctv_disable', label: 'Disable' });
                break;
            case 'POWER_SUBSTATION':
                actions.push({ id: 'district_blackout_ping', label: 'Blackout' });
                break;
            case 'TELECOM_BOX':
                actions.push({ id: 'traffic_light_switch', label: 'Traffic' });
                actions.push({ id: 'comms_jam', label: 'Jam' });
                break;
            default:
                actions.push({ id: 'door_unlock', label: 'Unlock' });
                break;
        }

        const tick = this.game.state?.time?.tick ?? 0;
        const wh = this.game.worldHacks;
        for (const a of actions) {
            a.onCooldown = wh ? wh._isOnCooldown(a.id, tick) : false;
        }
        return actions;
    }

    _render() {
        this._el.innerHTML = '<div class="rhm-center"></div>';
        const count = this._options.length;
        if (count === 0) return;

        const angleStep = (Math.PI * 2) / count;
        for (let i = 0; i < count; i++) {
            const opt = this._options[i];
            const angle = -Math.PI / 2 + i * angleStep;
            const x = Math.cos(angle) * RING_RADIUS;
            const y = Math.sin(angle) * RING_RADIUS;

            const seg = document.createElement('div');
            seg.className = 'rhm-segment';
            if (i === this._selectedIndex) seg.classList.add('selected');
            if (opt.onCooldown) seg.classList.add('cooldown');
            seg.textContent = `${i + 1}. ${opt.label}`;
            seg.style.transform = `translate(${x}px, ${y}px)`;
            this._el.appendChild(seg);
        }
    }

    _updateSelection() {
        const segments = this._el.querySelectorAll('.rhm-segment');
        segments.forEach((seg, i) => {
            seg.classList.toggle('selected', i === this._selectedIndex);
        });
    }

    destroy() {
        this._el?.remove();
    }
}
