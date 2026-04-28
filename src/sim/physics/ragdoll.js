import { RAPIER, isRapierReady } from './rapier_world.js';

const BONE = {
    hip:   { hy: 0.2, radius: 0.15, mass: 8, y: 0.0 },
    chest: { hy: 0.25, radius: 0.18, mass: 12, y: 0.5 },
    head:  { hy: 0.12, radius: 0.12, mass: 4, y: 0.95 },
};

const JOINT_LIMITS = {
    hipChest:  { minAngle: -0.3, maxAngle: 0.3 },
    chestHead: { minAngle: -0.5, maxAngle: 0.5 },
};

const BLEND_IN_TICKS = 5;
const BLEND_OUT_TICKS = 45;

export class Ragdoll {
    constructor(physics, x, y, z) {
        this._physics = physics;
        this.bones = {};
        this.joints = [];
        this._alive = false;
        this._activeTick = -1;
        this._restTick = -1;
        this._state = 'idle';
        if (!isRapierReady() || !physics.ready) return;
        this._build(x, y, z);
    }

    _build(x, y, z) {
        const hip = this._createBone('hip', x, y + BONE.hip.y, z);
        const chest = this._createBone('chest', x, y + BONE.chest.y, z);
        const head = this._createBone('head', x, y + BONE.head.y, z);

        this.bones = { hip, chest, head };

        this._createJoint(hip, chest, BONE.hip.hy, BONE.chest.hy, JOINT_LIMITS.hipChest);
        this._createJoint(chest, head, BONE.chest.hy, BONE.head.hy, JOINT_LIMITS.chestHead);

        this._alive = true;
    }

    _createBone(name, x, y, z) {
        const def = BONE[name];
        const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setAdditionalMass(def.mass);
        const bodyId = this._physics.createRigidBody(bodyDesc);
        const colliderDesc = RAPIER.ColliderDesc.capsule(def.hy, def.radius);
        this._physics.createCollider(colliderDesc, bodyId);
        return bodyId;
    }

    _createJoint(parentId, childId, parentHy, childHy, limits) {
        const world = this._physics._world;
        if (!world) return;
        const parentBody = this._physics._bodies.get(parentId);
        const childBody = this._physics._bodies.get(childId);
        if (!parentBody || !childBody) return;

        const anchor1 = { x: 0, y: parentHy, z: 0 };
        const anchor2 = { x: 0, y: -childHy, z: 0 };
        const axis = { x: 1, y: 0, z: 0 };

        const params = RAPIER.JointData.revolute(anchor1, anchor2, axis);
        const joint = world.createImpulseJoint(params, parentBody, childBody, true);
        if (joint.setLimits) {
            joint.setLimits(limits.minAngle, limits.maxAngle);
        }
        this.joints.push(joint);
    }

    get alive() {
        return this._alive;
    }

    getPositions() {
        if (!this._alive) return null;
        return {
            hip: this._physics.getBodyPosition(this.bones.hip),
            chest: this._physics.getBodyPosition(this.bones.chest),
            head: this._physics.getBodyPosition(this.bones.head),
        };
    }

    getRotations() {
        if (!this._alive) return null;
        return {
            hip: this._physics.getBodyRotation(this.bones.hip),
            chest: this._physics.getBodyRotation(this.bones.chest),
            head: this._physics.getBodyRotation(this.bones.head),
        };
    }

    activate(tick) {
        if (!this._alive) return;
        this._activeTick = tick;
        this._state = 'blending_in';
    }

    beginRest(tick) {
        if (this._state !== 'active') return;
        this._restTick = tick;
        this._state = 'blending_out';
    }

    update(tick) {
        if (this._state === 'blending_in') {
            if (tick - this._activeTick >= BLEND_IN_TICKS) {
                this._state = 'active';
            }
        } else if (this._state === 'blending_out') {
            if (tick - this._restTick >= BLEND_OUT_TICKS) {
                this._state = 'rest';
            }
        }
    }

    blendFactor(tick) {
        if (this._state === 'idle') return 0;
        if (this._state === 'blending_in') {
            const elapsed = tick - this._activeTick;
            return Math.min(1, elapsed / BLEND_IN_TICKS);
        }
        if (this._state === 'active') return 1;
        if (this._state === 'blending_out') {
            const elapsed = tick - this._restTick;
            return Math.max(0, 1 - elapsed / BLEND_OUT_TICKS);
        }
        return 0;
    }

    get state() {
        return this._state;
    }

    applyImpulse(boneName, impulse) {
        const bodyId = this.bones[boneName];
        if (bodyId == null) return;
        this._physics.applyImpulse(bodyId, impulse);
    }

    applyExplosiveKnockback(epicenter, force) {
        if (!this._alive) return;
        for (const name of ['hip', 'chest', 'head']) {
            const pos = this._physics.getBodyPosition(this.bones[name]);
            if (!pos) continue;
            const dx = pos.x - epicenter.x;
            const dy = pos.y - epicenter.y;
            const dz = pos.z - epicenter.z;
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
            const scale = force / (dist * dist + 1);
            this._physics.applyImpulse(this.bones[name], {
                x: (dx / dist) * scale,
                y: (dy / dist) * scale + force * 0.3,
                z: (dz / dist) * scale,
            });
        }
    }

    destroy() {
        if (!this._alive) return;
        for (const name of ['head', 'chest', 'hip']) {
            const id = this.bones[name];
            if (id != null) this._physics.removeBody(id);
        }
        this.bones = {};
        this.joints = [];
        this._alive = false;
    }
}
