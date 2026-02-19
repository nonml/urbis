export const HEAT_THRESHOLDS = {
    alert: 25,
    search: 50,
    pursuit: 75,
};

export class HeatSystem {
    constructor(game) {
        this.game = game;
        this.maxHeat = 100;
        this.decayPerTick = 0.5;
        this.state = 'calm';
    }

    getHeat() {
        return this.game.state.player.heat || 0;
    }

    setHeat(value) {
        const clamped = Math.max(0, Math.min(this.maxHeat, value));
        this.game.state.player.heat = clamped;
        this.state = this.getStateForHeat(clamped);
        this.game.state.player.heatState = this.state;
        return clamped;
    }

    addHeat(delta) {
        return this.setHeat(this.getHeat() + delta);
    }

    decay(seen = false) {
        if (seen) return this.getHeat();
        const m = this.game.factionSystem?.getPerkSnapshot?.()?.modifiers?.heatDecayMultiplier ?? 1;
        return this.setHeat(this.getHeat() - (this.decayPerTick * m));
    }

    getStateForHeat(heat) {
        if (heat >= HEAT_THRESHOLDS.pursuit) return 'pursuit';
        if (heat >= HEAT_THRESHOLDS.search) return 'search';
        if (heat >= HEAT_THRESHOLDS.alert) return 'alert';
        return 'calm';
    }
}
