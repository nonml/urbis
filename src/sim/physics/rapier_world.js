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

const FIXED_DT = 1 / 30;
const GRAVITY = { x: 0.0, y: -9.81, z: 0.0 };

export class RapierPhysicsWorld {
    constructor() {
        this._world = null;
        this._bodies = new Map();
        this._nextId = 1;
        if (_initialized) {
            this._world = new RAPIER.World(GRAVITY);
        }
    }

    get ready() {
        return this._world !== null;
    }

    step() {
        if (!this._world) return;
        this._world.step();
    }

    createRigidBody(desc) {
        if (!this._world) return null;
        const body = this._world.createRigidBody(desc);
        const id = this._nextId++;
        this._bodies.set(id, body);
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

    removeBody(id) {
        const body = this._bodies.get(id);
        if (!body || !this._world) return;
        this._world.removeRigidBody(body);
        this._bodies.delete(id);
    }

    get bodyCount() {
        return this._bodies.size;
    }

    destroy() {
        if (!this._world) return;
        this._bodies.clear();
        this._world.free();
        this._world = null;
    }
}

export { RAPIER };
