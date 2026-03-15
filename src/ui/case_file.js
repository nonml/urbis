import { caseFileStore } from '../stores/case_file.js';

export class CaseFileUI {
    constructor(game) {
        this.game = game;
        this.selectedCaseId = null;
        this.open = false;
    }

    toggle(force = null) {
        this.open = force !== null ? force : !this.open;
        if (this.open) this.refresh();
        else caseFileStore.update(s => ({ ...s, open: false }));
    }

    openCase(caseId) {
        this.selectedCaseId = caseId;
        this.open = true;
        this.refresh();
    }

    refresh() {
        const active = this.game.state.cases?.active ?? [];
        const cases = active.map(c => ({ id: c.id, label: `${c.type} (D${c.difficulty})` }));
        if (!this.selectedCaseId && active.length > 0) this.selectedCaseId = active[0].id;

        const selected = this._buildSelected(this.selectedCaseId);
        caseFileStore.set({ open: true, cases, selectedId: this.selectedCaseId, selected });
    }

    _buildSelected(caseId) {
        if (!caseId) return null;
        const c = this.game.caseManager?.getCaseById?.(caseId);
        if (!c) return null;

        const currentQuestId = c.questIds?.[c.questIds.length - 1];
        const quest = currentQuestId ? this.game.questEngine?.getQuestById?.(currentQuestId) : null;
        const step  = quest?.steps?.[quest.currentStepIndex];

        const evidence = (this.game.state.cases?.evidence ?? []).filter(x => x.caseId === c.id);

        return {
            title:     `${c.type.replace('_', ' ')} #${c.caseSeed}`,
            meta:      `District ${c.districtId} • Chapter ${Math.min(c.currentChapter + 1, c.chapters.length)}/${c.chapters.length}`,
            objective: step?.text || 'Awaiting next objective',
            suspects:  c.suspects ?? [],
            evidence,
        };
    }

    // Legacy compat
    create() {}
    renderSelected() {}
}
