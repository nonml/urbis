const TRACKED_RESOURCES = ['gold', 'food', 'wood', 'power', 'water', 'materials'];

export class EconomyLedger {
    constructor(historySize = 30) {
        this.historySize = historySize;
        this.history = [];
    }

    beginTick(tick) {
        return {
            tick,
            byResource: Object.create(null),
        };
    }

    addDelta(bucket, resource, delta, source) {
        if (!Number.isFinite(delta) || delta === 0) return;
        if (!bucket.byResource[resource]) {
            bucket.byResource[resource] = {
                total: 0,
                contributors: new Map(),
            };
        }
        const rec = bucket.byResource[resource];
        rec.total += delta;
        rec.contributors.set(source, (rec.contributors.get(source) || 0) + delta);
    }

    commitTick(bucket) {
        this.history.push(bucket);
        if (this.history.length > this.historySize) {
            this.history.shift();
        }
    }

    getLastTick() {
        return this.history[this.history.length - 1] || null;
    }

    getResourceReport(resources) {
        const latest = this.getLastTick();
        const report = {};

        for (const resource of TRACKED_RESOURCES) {
            const current = Number.isFinite(resources?.[resource]) ? resources[resource] : 0;
            const rec = latest?.byResource?.[resource];
            const contributors = rec
                ? Array.from(rec.contributors.entries())
                    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                    .slice(0, 5)
                    .map(([source, delta]) => ({ source, delta }))
                : [];

            report[resource] = {
                current,
                net: rec?.total || 0,
                contributors,
            };
        }

        return {
            tick: latest?.tick ?? 0,
            report,
            historyLength: this.history.length,
        };
    }
}
