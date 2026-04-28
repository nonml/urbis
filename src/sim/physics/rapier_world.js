import RAPIER from '@dimforge/rapier3d-compat';

let _initialized = false;

export async function initRapier() {
    if (_initialized) return;
    await RAPIER.init();
    _initialized = true;
}

export function isRapierReady() {
    return _initialized;
}

const GRAVITY = { x: 0.0, y: -9.81, z: 0.0 };
const DEFAULT_POOL_CAP = 256;

export class RapierPhysicsWorld {
    constructor(options = {}) {
        this._world = null;
        this._bodies = new Map();
        this._order = [];
        this._nextId = 1;
        this._cap = options.poolCap ?? DEFAULT_POOL_CAP;
        if (_initialized) {
            this._world = new RAPIER.World(GRAVITY);
        }
    }

    get ready() {
        return this._world !== null;
    }

    get poolCap() {
        return this._cap;
    }

    step() {
        if (!this._world) return;
        this._world.step();
    }

    createRigidBody(desc) {
        if (!this._world) return null;
        if (this._bodies.size >= this._cap) {
            this._recycleOldest();
        }
        const body = this._world.createRigidBody(desc);
        const id = this._nextId++;
        this._bodies.set(id, body);
        this._order.push(id);
        return id;
    }

    createCollider(desc, parentHandle) {
        if (!this._world) return null;
        const parent = typeof parentHandle === 'number'
            ? this._bodies.get(parentHandle) ?? null
            : parentHandle;
        return this._world.createCollider(desc, parent);
    }

    getBodyPosition(id) {
        const body = this._bodies.get(id);
        if (!body) return null;
        const t = body.translation();
        return { x: t.x, y: t.y, z: t.z };
    }

    getBodyRotation(id) {
        const body = this._bodies.get(id);
        if (!body) return null;
        const r = body.rotation();
        return { x: r.x, y: r.y, z: r.z, w: r.w };
    }

    applyImpulse(id, impulse) {
        const body = this._bodies.get(id);
        if (!body) return;
        body.applyImpulse(impulse, true);
    }

    applyTorqueImpulse(id, torque) {
        const body = this._bodies.get(id);
        if (!body) return;
        body.applyTorqueImpulse(torque, true);
    }

    removeBody(id) {
        const body = this._bodies.get(id);
        if (!body || !this._world) return;
        this._world.removeRigidBody(body);
        this._bodies.delete(id);
        const idx = this._order.indexOf(id);
        if (idx !== -1) this._order.splice(idx, 1);
    }

    _recycleOldest() {
        while (this._order.length > 0 && this._bodies.size >= this._cap) {
            const oldest = this._order.shift();
            const body = this._bodies.get(oldest);
            if (body) {
                this._world.removeRigidBody(body);
                this._bodies.delete(oldest);
            }
        }
    }

    get bodyCount() {
        return this._bodies.size;
    }

    serialize() {
        if (!this._world) return null;
        const bodies = [];
        for (const [id, body] of this._bodies) {
            const t = body.translation();
            const r = body.rotation();
            const v = body.linvel();
            const w = body.angvel();
            const bt = body.bodyType();
            bodies.push({
                id, bt,
                t: [t.x, t.y, t.z],
                r: [r.x, r.y, r.z, r.w],
                v: [v.x, v.y, v.z],
                w: [w.x, w.y, w.z],
            });
        }
        return { bodies, order: [...this._order], nextId: this._nextId };
    }

    deserialize(data) {
        if (!data || !this._world) return;
        for (const id of [...this._bodies.keys()]) {
            this.removeBody(id);
        }
        for (const entry of data.bodies) {
            let desc;
            if (entry.bt === RAPIER.RigidBodyType.Fixed) {
                desc = RAPIER.RigidBodyDesc.fixed();
            } else if (entry.bt === RAPIER.RigidBodyType.KinematicPositionBased) {
                desc = RAPIER.RigidBodyDesc.kinematicPositionBased();
            } else {
                desc = RAPIER.RigidBodyDesc.dynamic();
            }
            desc.setTranslation(entry.t[0], entry.t[1], entry.t[2]);
            desc.setRotation({ x: entry.r[0], y: entry.r[1], z: entry.r[2], w: entry.r[3] });
            desc.setLinvel(entry.v[0], entry.v[1], entry.v[2]);
            desc.setAngvel({ x: entry.w[0], y: entry.w[1], z: entry.w[2] });
            const body = this._world.createRigidBody(desc);
            this._bodies.set(entry.id, body);
        }
        this._order = data.order ? [...data.order] : [];
        this._nextId = data.nextId ?? this._nextId;
    }

    destroy() {
        if (!this._world) return;
        this._bodies.clear();
        this._order.length = 0;
        this._world.free();
        this._world = null;
    }
}

export { RAPIER };
