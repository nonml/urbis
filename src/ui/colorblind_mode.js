/**
 * Colorblind Mode — toggles colorblind palettes for accessibility.
 * Supports deuteranopia, protanopia, and tritanopia modes.
 */

export const COLORBLIND_MODES = {
    none: 'none',
    deutan: 'deutan',
    protan: 'protan',
    tritan: 'tritan',
};

export class ColorblindMode {
    constructor() {
        this.mode = COLORBLIND_MODES.none;
        this._apply();
    }

    setMode(mode) {
        if (COLORBLIND_MODES[mode] !== undefined) {
            this.mode = mode;
            this._apply();
        }
    }

    cycle() {
        const modes = Object.keys(COLORBLIND_MODES);
        const idx = modes.indexOf(this.mode);
        this.mode = modes[(idx + 1) % modes.length];
        this._apply();
    }

    _apply() {
        const root = document.documentElement;
        if (this.mode === COLORBLIND_MODES.none) {
            root.removeAttribute('data-colorblind');
        } else {
            root.setAttribute('data-colorblind', this.mode);
        }
    }
}
