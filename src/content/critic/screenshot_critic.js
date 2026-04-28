import { VisionModel } from './vision_model.js';

const PROMPTS = {
    ui_check: 'Analyze this game screenshot. Report any UI issues: overlapping elements, unreadable text, missing HUD components, visual glitches.',
    scene_check: 'Analyze this game screenshot. Report any scene issues: z-fighting, missing textures, floating objects, lighting artifacts.',
    layout_check: 'Analyze this game screenshot. Report any layout issues: elements off-screen, incorrect alignment, broken responsive layout.',
};

export class ScreenshotCritic {
    constructor(opts = {}) {
        this._model = opts.model || new VisionModel({ backend: 'stub' });
        this._findings = [];
        this._falsePositives = 0;
        this._truePositives = 0;
        this._totalChecks = 0;
    }

    get findings() { return this._findings; }
    get totalChecks() { return this._totalChecks; }

    get falsePositiveRate() {
        const total = this._falsePositives + this._truePositives;
        if (total === 0) return 0;
        return this._falsePositives / total;
    }

    async init() {
        return this._model.init();
    }

    async checkScreenshot(path, checkType = 'ui_check') {
        const prompt = PROMPTS[checkType] || PROMPTS.ui_check;
        const result = await this._model.analyze(path, prompt);
        this._totalChecks++;

        if (!result.success) {
            return { blocker: false, findings: [], error: result.error };
        }

        const entry = {
            path,
            checkType,
            findings: result.findings || [],
            score: result.score || 0,
            timestamp: Date.now(),
            blocker: (result.findings || []).some(f => f.severity === 'blocker'),
        };

        this._findings.push(entry);
        return entry;
    }

    markFinding(index, isFalsePositive) {
        if (isFalsePositive) this._falsePositives++;
        else this._truePositives++;
    }

    meetsQualityTarget() {
        return this.falsePositiveRate < 0.05;
    }

    getStats() {
        return {
            totalChecks: this._totalChecks,
            findingsCount: this._findings.length,
            falsePositives: this._falsePositives,
            truePositives: this._truePositives,
            falsePositiveRate: this.falsePositiveRate,
            meetsTarget: this.meetsQualityTarget(),
            modelBackend: this._model.backend,
            modelReady: this._model.ready,
        };
    }
}
