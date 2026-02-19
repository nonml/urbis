export class CaseFileUI {
    constructor(game) {
        this.game = game;
        this.selectedCaseId = null;
        this.open = false;
        this.container = null;
        this.create();
    }

    create() {
        this.container = document.createElement('div');
        this.container.id = 'case-file-panel';
        this.container.className = 'quest-log-panel';
        this.container.style.display = 'none';
        this.container.innerHTML = `
            <div class="quest-log-header">
                <h2>Case Files</h2>
                <button class="quest-log-close" id="case-file-close">&times;</button>
            </div>
            <div class="quest-log-content">
                <div class="quest-list">
                    <h3>Active Cases</h3>
                    <div id="case-file-list"></div>
                </div>
                <div class="quest-details">
                    <h3 id="case-file-title">Select a Case</h3>
                    <p id="case-file-meta" class="quest-desc"></p>
                    <h4>Objectives</h4>
                    <ul id="case-file-objectives"></ul>
                    <h4>Suspects</h4>
                    <ul id="case-file-suspects"></ul>
                    <h4>Evidence Board</h4>
                    <ul id="case-file-evidence"></ul>
                </div>
            </div>
        `;
        document.body.appendChild(this.container);
        const close = this.container.querySelector('#case-file-close');
        close?.addEventListener('click', () => this.toggle(false));
    }

    toggle(force = null) {
        this.open = force !== null ? force : !this.open;
        this.container.style.display = this.open ? 'block' : 'none';
        if (this.open) this.refresh();
    }

    refresh() {
        const list = this.container.querySelector('#case-file-list');
        if (!list) return;
        list.innerHTML = '';
        const active = this.game.state.cases?.active || [];
        for (const c of active) {
            const row = document.createElement('div');
            row.className = 'quest-list-item';
            row.textContent = `${c.type} (D${c.difficulty})`;
            row.addEventListener('click', () => {
                this.selectedCaseId = c.id;
                this.renderSelected();
            });
            list.appendChild(row);
        }
        if (!this.selectedCaseId && active.length > 0) this.selectedCaseId = active[0].id;
        this.renderSelected();
    }

    renderSelected() {
        const c = this.game.caseManager?.getCaseById?.(this.selectedCaseId);
        const title = this.container.querySelector('#case-file-title');
        const meta = this.container.querySelector('#case-file-meta');
        const objectives = this.container.querySelector('#case-file-objectives');
        const suspects = this.container.querySelector('#case-file-suspects');
        const evidence = this.container.querySelector('#case-file-evidence');
        if (!title || !meta || !objectives || !suspects || !evidence) return;

        if (!c) {
            title.textContent = 'Select a Case';
            meta.textContent = '';
            objectives.innerHTML = '';
            suspects.innerHTML = '';
            evidence.innerHTML = '';
            return;
        }

        title.textContent = `${c.type.replace('_', ' ')} #${c.caseSeed}`;
        meta.textContent = `District ${c.districtId} • Chapter ${Math.min(c.currentChapter + 1, c.chapters.length)}/${c.chapters.length}`;

        objectives.innerHTML = '';
        const currentQuestId = c.questIds?.[c.questIds.length - 1];
        const quest = currentQuestId ? this.game.questEngine.getQuestById(currentQuestId) : null;
        const step = quest?.steps?.[quest.currentStepIndex];
        const li = document.createElement('li');
        li.textContent = step?.text || 'Awaiting next objective';
        objectives.appendChild(li);

        suspects.innerHTML = '';
        for (const s of c.suspects || []) {
            const l = document.createElement('li');
            l.textContent = `${s.name} (risk ${s.risk})`;
            suspects.appendChild(l);
        }

        evidence.innerHTML = '';
        const ev = (this.game.state.cases?.evidence || []).filter((x) => x.caseId === c.id);
        for (const item of ev) {
            const l = document.createElement('li');
            l.textContent = `${item.clueId} [${item.type}]`;
            evidence.appendChild(l);
        }
    }
}
