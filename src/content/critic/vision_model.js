export class VisionModel {
    constructor(opts = {}) {
        this._backend = opts.backend || 'stub';
        this._endpoint = opts.endpoint || null;
        this._ready = false;
    }

    get ready() { return this._ready; }
    get backend() { return this._backend; }

    async init() {
        if (this._backend === 'stub') {
            this._ready = true;
            return true;
        }
        if (this._backend === 'http' && this._endpoint) {
            try {
                const res = await fetch(`${this._endpoint}/health`);
                this._ready = res.ok;
            } catch {
                this._ready = false;
            }
            return this._ready;
        }
        return false;
    }

    async analyze(screenshotPath, prompt) {
        if (!this._ready) return { success: false, error: 'model not ready' };

        if (this._backend === 'stub') {
            return this._stubAnalyze(prompt);
        }

        if (this._backend === 'http') {
            return this._httpAnalyze(screenshotPath, prompt);
        }

        return { success: false, error: `unknown backend: ${this._backend}` };
    }

    _stubAnalyze(prompt) {
        return {
            success: true,
            findings: [],
            score: 0.85,
            summary: 'Stub analysis — no real model loaded.',
        };
    }

    async _httpAnalyze(screenshotPath, prompt) {
        try {
            const body = JSON.stringify({ image: screenshotPath, prompt });
            const res = await fetch(`${this._endpoint}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body,
            });
            if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
            return await res.json();
        } catch (e) {
            return { success: false, error: e.message };
        }
    }
}
