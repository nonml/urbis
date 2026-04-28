/**
 * Cover System — tags static geometry edges as cover points.
 * NPCs and player can snap to cover for combat advantage.
 */

const COVER_HEIGHT = {
    LOW: 'low',
    HIGH: 'high',
};

const COVER_TYPES = {
    WALL: 'wall',
    VEHICLE: 'vehicle',
    BARRIER: 'barrier',
    CRATE: 'crate',
};

export class CoverSystem {
    constructor(game) {
        this._game = game;
        this._coverPoints = [];
        this._dirty = true;
    }

    rebuild() {
        this._coverPoints = [];
        this._tagBuildingEdges();
        this._tagBarriers();
        this._dirty = false;
    }

    _tagBuildingEdges() {
        const buildings = this._game.buildings?.buildings || [];
        for (const b of buildings) {
            const x = b.x ?? 0;
            const y = b.y ?? 0;
            const edges = [
                { x: x - 1, y, nx: -1, ny: 0 },
                { x: x + 1, y, nx: 1, ny: 0 },
                { x, y: y - 1, nx: 0, ny: -1 },
                { x, y: y + 1, nx: 0, ny: 1 },
            ];
            for (const edge of edges) {
                this._coverPoints.push({
                    x: edge.x,
                    y: edge.y,
                    nx: edge.nx,
                    ny: edge.ny,
                    height: COVER_HEIGHT.HIGH,
                    type: COVER_TYPES.WALL,
                    sourceId: b.id,
                });
            }
        }
    }

    _tagBarriers() {
        const breakables = this._game.breakableManager;
        if (!breakables) return;
        const props = breakables._props;
        if (!props) return;
        for (const prop of props.values()) {
            this._coverPoints.push({
                x: prop.x,
                y: prop.y,
                nx: 0,
                ny: -1,
                height: COVER_HEIGHT.LOW,
                type: COVER_TYPES.CRATE,
                sourceId: prop.id,
            });
        }
    }

    getNearest(x, y, maxDist = 3) {
        if (this._dirty) this.rebuild();
        let best = null;
        let bestDist = maxDist * maxDist;
        for (const cp of this._coverPoints) {
            const dx = cp.x - x;
            const dy = cp.y - y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist) {
                bestDist = d2;
                best = cp;
            }
        }
        return best;
    }

    getInRadius(x, y, radius) {
        if (this._dirty) this.rebuild();
        const r2 = radius * radius;
        return this._coverPoints.filter(cp => {
            const dx = cp.x - x;
            const dy = cp.y - y;
            return dx * dx + dy * dy < r2;
        });
    }

    markDirty() {
        this._dirty = true;
    }

    get count() {
        return this._coverPoints.length;
    }
}

export { COVER_HEIGHT, COVER_TYPES };
