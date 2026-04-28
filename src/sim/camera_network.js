/**
 * Camera Network — indexes CCTV_POLE interactables with facing, view cone,
 * and district-level network grouping.  Foundation for Q6.A camera traversal.
 */

const TWO_PI = Math.PI * 2;
const FACING_COUNT = 8;
const DEFAULT_VIEW_ANGLE = Math.PI / 3;
const DEFAULT_VIEW_RANGE = 12;

export class CameraNetwork {
    constructor(game) {
        this.game = game;
        this._cameras = [];
        this._byDistrict = new Map();
        this._dirty = true;
    }

    rebuild() {
        this._cameras = [];
        this._byDistrict.clear();

        const im = this.game.interactables;
        if (!im) return;

        const rng = this.game.rngStreams?.sim;

        for (const node of im.interactables) {
            if (node.type !== 'CCTV_POLE') continue;

            if (node._cam === undefined) {
                const facingIndex = rng
                    ? Math.floor(rng.next() * FACING_COUNT)
                    : (node.x * 7 + node.y * 13) % FACING_COUNT;
                node._cam = {
                    facing: (facingIndex / FACING_COUNT) * TWO_PI,
                    viewAngle: DEFAULT_VIEW_ANGLE,
                    viewRange: DEFAULT_VIEW_RANGE,
                    networkId: node.districtId ?? 0,
                    active: true,
                };
            }

            this._cameras.push(node);

            const nid = node._cam.networkId;
            let bucket = this._byDistrict.get(nid);
            if (!bucket) {
                bucket = [];
                this._byDistrict.set(nid, bucket);
            }
            bucket.push(node);
        }

        this._dirty = false;
    }

    update(tick) {
        if (this._dirty) {
            this.rebuild();
        }

        for (const cam of this._cameras) {
            const meta = cam._cam;
            if (!meta) continue;
            meta.active = cam.state !== 'success' ||
                (cam.cameraActiveUntil > 0 && tick < cam.cameraActiveUntil);
        }
    }

    markDirty() {
        this._dirty = true;
    }

    get cameras() {
        if (this._dirty) this.rebuild();
        return this._cameras;
    }

    getCamerasInDistrict(districtId) {
        if (this._dirty) this.rebuild();
        return this._byDistrict.get(districtId) || [];
    }

    getNearbyCameras(x, y, radius = 20) {
        if (this._dirty) this.rebuild();
        const r2 = radius * radius;
        const result = [];
        for (const cam of this._cameras) {
            const dx = cam.x - x;
            const dy = cam.y - y;
            if (dx * dx + dy * dy <= r2) {
                result.push(cam);
            }
        }
        return result;
    }

    isInViewCone(cam, tx, ty) {
        const meta = cam._cam;
        if (!meta || !meta.active) return false;

        const dx = tx - cam.x;
        const dy = ty - cam.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > meta.viewRange || dist < 0.01) return false;

        const angle = Math.atan2(dy, dx);
        let diff = angle - meta.facing;
        diff = ((diff % TWO_PI) + TWO_PI) % TWO_PI;
        if (diff > Math.PI) diff -= TWO_PI;
        return Math.abs(diff) <= meta.viewAngle / 2;
    }

    serialize() {
        const entries = [];
        for (const cam of this._cameras) {
            if (!cam._cam) continue;
            entries.push({
                id: cam.id,
                facing: cam._cam.facing,
                viewAngle: cam._cam.viewAngle,
                viewRange: cam._cam.viewRange,
                networkId: cam._cam.networkId,
                active: cam._cam.active,
            });
        }
        return { cameras: entries };
    }

    deserialize(data) {
        if (!data?.cameras) return;
        const lookup = new Map();
        for (const entry of data.cameras) {
            lookup.set(entry.id, entry);
        }

        const im = this.game.interactables;
        if (!im) return;

        for (const node of im.interactables) {
            if (node.type !== 'CCTV_POLE') continue;
            const saved = lookup.get(node.id);
            if (saved) {
                node._cam = {
                    facing: saved.facing,
                    viewAngle: saved.viewAngle ?? DEFAULT_VIEW_ANGLE,
                    viewRange: saved.viewRange ?? DEFAULT_VIEW_RANGE,
                    networkId: saved.networkId ?? node.districtId ?? 0,
                    active: saved.active !== false,
                };
            }
        }

        this._dirty = true;
    }
}
