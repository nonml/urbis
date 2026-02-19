import { eventBus, EVENT_TYPES } from '../events.js';

export class EvidenceSystem {
    constructor(game) {
        this.game = game;
        this.collected = new Set();
        this.ensureState();
    }

    ensureState() {
        const cases = this.game.state.cases || (this.game.state.cases = {});
        cases.active = cases.active || [];
        cases.completed = cases.completed || [];
        cases.evidence = cases.evidence || [];
        for (const e of cases.evidence) {
            if (e.collected) this.collected.add(e.id);
        }
    }

    makeEvidenceId(caseId, clueId, sourcePoiId = 'unknown', suspectId = 'none') {
        return `${caseId}:${clueId}:${sourcePoiId}:${suspectId}`;
    }

    hasEvidence(caseId, clueId) {
        const state = this.game.state.cases?.evidence || [];
        return state.some((e) => e.caseId === caseId && e.clueId === clueId && e.collected);
    }

    registerEvidence({ caseId, clueId, sourcePoiId, suspectId, type = 'log', collected = true }) {
        if (!caseId || !clueId) return null;
        this.ensureState();
        const id = this.makeEvidenceId(caseId, clueId, sourcePoiId, suspectId);
        const existing = this.game.state.cases.evidence.find((e) => e.id === id);
        if (existing) {
            if (collected && !existing.collected) existing.collected = true;
            if (existing.collected) this.collected.add(existing.id);
            return existing;
        }

        const item = {
            id,
            caseId,
            clueId,
            type,
            sourcePoiId: sourcePoiId || null,
            suspectId: suspectId || null,
            collected: !!collected,
            collectedAtTick: this.game.state.time?.tick || 0,
        };
        this.game.state.cases.evidence.push(item);
        if (item.collected) this.collected.add(item.id);
        eventBus.emit(EVENT_TYPES.EVIDENCE_ADDED, { evidence: item, caseId });
        return item;
    }

    registerClueEvidence(quest, clueId) {
        const caseId = this.game.caseManager?.getCaseIdByQuest?.(quest.id);
        if (!caseId) return null;
        return this.registerEvidence({
            caseId,
            clueId,
            sourcePoiId: quest.id,
            suspectId: quest.context?.suspectId || null,
            type: this.inferTypeFromClue(clueId),
            collected: true,
        });
    }

    inferTypeFromClue(clueId) {
        const c = String(clueId || '').toLowerCase();
        if (c.includes('cctv') || c.includes('clip')) return 'cctv';
        if (c.includes('witness')) return 'witness';
        if (c.includes('photo') || c.includes('sample')) return 'physical';
        return 'log';
    }
}
