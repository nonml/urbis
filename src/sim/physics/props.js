import { RAPIER, isRapierReady } from './rapier_world.js';

export const PROP_TYPES = {
    traffic_cone: {
        name: 'Traffic Cone',
        model: 'traffic_cone',
        mass: 1.5,
        restitution: 0.2,
        friction: 0.6,
        collider: 'cone',
        radius: 0.2,
        halfHeight: 0.35,
    },
    trashcan: {
        name: 'Trash Can',
        model: 'trashcan',
        mass: 8,
        restitution: 0.15,
        friction: 0.5,
        collider: 'cylinder',
        radius: 0.3,
        halfHeight: 0.45,
    },
    sign: {
        name: 'Freestanding Sign',
        model: 'sign',
        mass: 12,
        restitution: 0.1,
        friction: 0.7,
        collider: 'cuboid',
        hx: 0.4,
        hy: 1.0,
        hz: 0.08,
    },
    chair: {
        name: 'Chair',
        model: 'chair',
        mass: 4,
        restitution: 0.2,
        friction: 0.5,
        collider: 'cuboid',
        hx: 0.25,
        hy: 0.45,
        hz: 0.25,
    },
    crate: {
        name: 'Wooden Crate',
        model: 'crate',
        mass: 15,
        restitution: 0.1,
        friction: 0.8,
        collider: 'cuboid',
        hx: 0.35,
        hy: 0.35,
        hz: 0.35,
    },
};

export class PhysicsPropManager {
    constructor(physics, rng) {
        this._physics = physics;
        this._rng = rng;
        this._props = new Map();
        this._nextId = 1;
    }

    spawn(type, x, y, z) {
        const def = PROP_TYPES[type];
        if (!def || !this._physics.ready || !isRapierReady()) return null;

        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setAdditionalMass(def.mass);

        const bodyId = this._physics.createRigidBody(bodyDesc);
        if (bodyId === null) return null;

        const colliderDesc = this._buildCollider(def);
        if (colliderDesc) {
            colliderDesc.setRestitution(def.restitution);
            colliderDesc.setFriction(def.friction);
            this._physics.createCollider(colliderDesc, bodyId);
        }

        const id = this._nextId++;
        const prop = { id, type, bodyId, x, y, z };
        this._props.set(id, prop);
        return prop;
    }

    _buildCollider(def) {
        switch (def.collider) {
            case 'cone':
                return RAPIER.ColliderDesc.cone(def.halfHeight, def.radius);
            case 'cylinder':
                return RAPIER.ColliderDesc.cylinder(def.halfHeight, def.radius);
            case 'cuboid':
                return RAPIER.ColliderDesc.cuboid(def.hx, def.hy, def.hz);
            default:
                return RAPIER.ColliderDesc.ball(def.radius || 0.3);
        }
    }

    applyImpulse(id, impulse) {
        const prop = this._props.get(id);
        if (!prop) return;
        this._physics.applyImpulse(prop.bodyId, impulse);
    }

    getPosition(id) {
        const prop = this._props.get(id);
        if (!prop) return null;
        return this._physics.getBodyPosition(prop.bodyId);
    }

    getRotation(id) {
        const prop = this._props.get(id);
        if (!prop) return null;
        return this._physics.getBodyRotation(prop.bodyId);
    }

    remove(id) {
        const prop = this._props.get(id);
        if (!prop) return;
        this._physics.removeBody(prop.bodyId);
        this._props.delete(id);
    }

    getAll() {
        return [...this._props.values()];
    }

    getById(id) {
        return this._props.get(id) ?? null;
    }

    get propCount() {
        return this._props.size;
    }

    serialize() {
        return {
            nextId: this._nextId,
            props: this.getAll(),
        };
    }

    deserialize(data) {
        if (!data) return;
        this._props.clear();
        this._nextId = data.nextId ?? 1;
        for (const p of (data.props || [])) {
            this._props.set(p.id, p);
        }
    }
}
