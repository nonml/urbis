import { WEAPONS } from '../player/combat.js';

const WEAPON_ICONS = {
    fist: '👊',
    bat: '🏏',
    pistol: '🔫',
    shotgun: '💥',
    smg: '⚡',
};

export class WeaponWheel {
    constructor(game) {
        this.game = game;
        this._el = null;
        this._slots = [];
        this._visible = false;
        this._build();
    }

    _build() {
        this._el = document.createElement('div');
        this._el.className = 'hud-weapon-wheel';
        this._el.style.opacity = '0';
        this._el.style.pointerEvents = 'none';

        const keys = Object.keys(WEAPONS);
        for (const key of keys) {
            const w = WEAPONS[key];
            const slot = document.createElement('div');
            slot.className = 'wheel-slot';
            slot.dataset.weapon = key;

            const icon = document.createElement('span');
            icon.className = 'slot-icon';
            icon.textContent = WEAPON_ICONS[key] || '🔧';

            const label = document.createElement('span');
            label.className = 'slot-label';
            label.textContent = w.name.toUpperCase();

            slot.appendChild(icon);
            slot.appendChild(label);
            slot.addEventListener('click', () => this._select(key));
            this._el.appendChild(slot);
            this._slots.push({ el: slot, key });
        }
    }

    get element() {
        return this._el;
    }

    show() {
        if (this._visible) return;
        this._visible = true;
        this._el.style.opacity = '1';
        this._el.style.pointerEvents = 'auto';
        this._updateActive();
    }

    hide() {
        if (!this._visible) return;
        this._visible = false;
        this._el.style.opacity = '0';
        this._el.style.pointerEvents = 'none';
    }

    toggle() {
        if (this._visible) this.hide();
        else this.show();
    }

    get isVisible() {
        return this._visible;
    }

    _select(key) {
        const combat = this.game.combat ?? this.game.combatSystem;
        if (combat) combat.setWeapon(key);
        this._updateActive();
        this.hide();
    }

    _updateActive() {
        const combat = this.game.combat ?? this.game.combatSystem;
        const current = combat?.currentWeapon || 'fist';
        for (const s of this._slots) {
            s.el.classList.toggle('active', s.key === current);
        }
    }

    update() {
        if (!this._visible) return;
        this._updateActive();
    }
}
