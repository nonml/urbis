import { codexStore } from '../stores/codex.js';
export { CODEX_CONTENT } from './codex_content.js';

export class CodexUI {
    constructor(game) {
        this.game = game;
        this.isOpen = false;
    }

    open()   { this.isOpen = true;  codexStore.update(s => ({ ...s, open: true })); }
    close()  { this.isOpen = false; codexStore.update(s => ({ ...s, open: false })); }
    toggle() { this.isOpen ? this.close() : this.open(); }

    // Legacy compat
    init()         {}
    updateContent(){}
    selectCategory(cat) { codexStore.update(s => ({ ...s, category: cat })); }
    filterContent(search) { codexStore.update(s => ({ ...s, search: search.toLowerCase() })); }
    ensureStyles() {}
}

export function createCodexUI(game) { return new CodexUI(game); }
