// Intel system - tracks intelligence about rivals and world state
import { eventBus, EVENT_TYPES } from '../events.js';

export const INTEL_SOURCES = {
    CAMERA_HACK: { name: 'Camera Hack', amount: 5, category: 'surveillance' },
    SAFEHOUSE: { name: 'Safehouse Visit', amount: 10, category: 'infrastructure' },
    CASE_COMPLETE: { name: 'Case Completed', amount: 15, category: 'investigation' },
    RIVAL_INTEL_SPEND: { name: 'Rival Intel Revealed', amount: -10, category: 'action' },
};

export const INTEL_THRESHOLDS = {
    REVEAL_DISTRICT: 30,
    REVEAL_POI: 50,
    REVEAL_RIVAL_PLAN: 75,
};

export class IntelSystem {
    constructor(game) {
        this.game = game;
        this.intel = 0;
        this.maxIntel = 100;
        this.revealedItems = new Set();
        this.sourceLog = [];
        this.ensureState();
    }

    ensureState() {
        const intelState = this.game.state.intel || (this.game.state.intel = {});
        intelState.intel = intelState.intel ?? 0;
        intelState.revealed = intelState.revealed ?? [];
        intelState.sources = intelState.sources ?? [];
        this.intel = intelState.intel;
        this.revealedItems = new Set(intelState.revealed);
        this.sourceLog = intelState.sources;
    }

    getIntel() {
        return Math.max(0, Math.min(this.maxIntel, this.intel));
    }

    addIntel(amount, sourceKey, reason = null) {
        const sourceInfo = INTEL_SOURCES[sourceKey] || { name: 'Unknown', amount };
        const clamped = Math.max(0, Math.min(this.maxIntel, this.intel + amount));
        const delta = clamped - this.intel;
        this.intel = clamped;

        // Log source if amount > 0
        if (amount > 0 && reason) {
            this.sourceLog.push({
                key: sourceKey,
                amount,
                reason,
                tick: this.game.state.time?.tick || 0,
            });
            while (this.sourceLog.length > 20) this.sourceLog.shift();
        }

        this.updateState();
        return delta;
    }

    spendIntel(cost) {
        const current = this.getIntel();
        if (current < cost) return 0;
        this.intel = current - cost;
        this.updateState();
        return cost;
    }

    updateState() {
        const intelState = this.game.state.intel || (this.game.state.intel = {});
        intelState.intel = this.intel;
        intelState.revealed = Array.from(this.revealedItems);
        intelState.sources = this.sourceLog;
        intelState.band = this.getBand();
        intelState.nextThreshold = this.getNextThreshold();
    }

    getBand() {
        const intel = this.getIntel();
        if (intel >= INTEL_THRESHOLDS.REVEAL_RIVAL_PLAN) return 'comprehensive';
        if (intel >= INTEL_THRESHOLDS.REVEAL_POI) return 'detailed';
        if (intel >= INTEL_THRESHOLDS.REVEAL_DISTRICT) return 'partial';
        return 'minimal';
    }

    getNextThreshold() {
        const intel = this.getIntel();
        if (intel < INTEL_THRESHOLDS.REVEAL_DISTRICT) return INTEL_THRESHOLDS.REVEAL_DISTRICT;
        if (intel < INTEL_THRESHOLDS.REVEAL_POI) return INTEL_THRESHOLDS.REVEAL_POI;
        if (intel < INTEL_THRESHOLDS.REVEAL_RIVAL_PLAN) return INTEL_THRESHOLDS.REVEAL_RIVAL_PLAN;
        return null;
    }

    revealDistrict(districtId) {
        const key = `district:${districtId}`;
        if (this.revealedItems.has(key)) return false;
        this.revealedItems.add(key);
        this.updateState();
        eventBus.emit(EVENT_TYPES.INTEL_REVEALED, { type: 'district', id: districtId, tick: this.game.state.time?.tick || 0 });
        return true;
    }

    revealPOI(poiId) {
        const key = `poi:${poiId}`;
        if (this.revealedItems.has(key)) return false;
        this.revealedItems.add(key);
        this.updateState();
        eventBus.emit(EVENT_TYPES.INTEL_REVEALED, { type: 'poi', id: poiId, tick: this.game.state.time?.tick || 0 });
        return true;
    }

    revealRivalPlan() {
        if (this.revealedItems.has('rival_plan')) return false;
        this.revealedItems.add('rival_plan');
        this.updateState();
        eventBus.emit(EVENT_TYPES.INTEL_REVEALED, { type: 'rival_plan', tick: this.game.state.time?.tick || 0 });
        return true;
    }

    applyRivalIntelReveal() {
        // When rival takes an action, reveal next district/poi
        const district = this.game.map.districts?.[0];
        if (district) {
            this.revealDistrict(district.id);
        }
    }

    decay() {
        // Intel slowly decays if not maintained
        const decayRate = 0.2;
        const current = this.getIntel();
        if (current > 0) {
            this.intel = Math.max(0, current - decayRate);
            this.updateState();
        }
    }

    update() {
        this.ensureState();
        this.decay();
    }
}