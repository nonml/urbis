/**
 * Character Pool + LOD System
 *
 * Manages a pool of detailed articulated humanoid characters for nearby
 * citizens, while distant citizens remain as instanced capsules.
 *
 * LOD tiers:
 *   NEAR  (< 20 tiles): Full articulated humanoid with walk animation
 *   FAR   (>= 20 tiles): Instanced capsule mesh (existing system)
 *
 * Pool size is capped at MAX_DETAILED_CHARACTERS. Characters are recycled
 * as citizens move in/out of the near zone.
 *
 * Mixamo/GLTF support:
 *   Set `CharacterPool.useGLTFModel(url)` to load a rigged character.
 *   The pool will clone it and use AnimationMixer for walk/idle clips.
 */

import {
    createProceduralCharacter,
    animateWalkCycle,
    disposeCharacterGeometry,
    injectTHREE,
} from './character_model.js';

let THREE = null;

const _testMode = typeof window !== 'undefined' && (navigator.webdriver || new URLSearchParams(window.location.search).has('testMode'));
const MAX_DETAILED_CHARACTERS = _testMode ? 10 : 120;
const NEAR_DISTANCE = _testMode ? 10 : 25;

export class CharacterPool {
    /**
     * @param {THREE_module} threeModule - The Three.js module
     * @param {THREE.Scene} scene
     * @param {object} game - Game instance
     */
    constructor(threeModule, scene, game) {
        THREE = threeModule;
        injectTHREE(THREE);

        this.scene = scene;
        this.game = game;

        // Pool of reusable character objects
        this._pool = [];          // { group, bones, height, materials, citizenIdx, active }
        this._freePool = [];      // indices into _pool that are not in use
        this._citizenToPool = new Map(); // citizenIdx -> pool index

        // GLTF model support
        this._gltfModel = null;
        this._gltfAnimations = null; // { walk: THREE.AnimationClip, idle: THREE.AnimationClip }
        this._mixers = [];           // AnimationMixer per active character

        // Container group for all detailed characters
        this._detailGroup = new THREE.Group();
        this._detailGroup.name = 'citizen-detail-characters';
        this.scene.add(this._detailGroup);

        // Pre-allocate pool
        this._initPool();
    }

    _initPool() {
        for (let i = 0; i < MAX_DETAILED_CHARACTERS; i++) {
            const char = createProceduralCharacter(i);
            char.group.visible = false;
            char.group.castShadow = true;
            this._detailGroup.add(char.group);
            this._pool.push({
                group: char.group,
                bones: char.bones,
                height: char.height,
                materials: char.materials,
                citizenIdx: -1,
                active: false,
                mixer: null,
            });
            this._freePool.push(i);
        }
    }

    /**
     * Load a GLTF/GLB character model for use instead of procedural characters.
     * Expects the model to contain 'walk' and 'idle' animation clips.
     * @param {string} url - Path to the GLB file (e.g. 'assets/models/character.glb')
     */
    async useGLTFModel(url) {
        let GLTFLoader;
        try {
            const mod = await import('three/addons/loaders/GLTFLoader.js');
            GLTFLoader = mod.GLTFLoader;
        } catch {
            const mod = await import('three/examples/jsm/loaders/GLTFLoader.js');
            GLTFLoader = mod.GLTFLoader;
        }
        const loader = new GLTFLoader();

        return new Promise((resolve, reject) => {
            loader.load(url, (gltf) => {
                this._gltfModel = gltf.scene;
                this._gltfAnimations = {};

                // Extract animation clips by name or index
                // Soldier.glb uses: [0]=Idle, [1]=Run, [3]=Walk
                for (const clip of gltf.animations) {
                    const name = clip.name.toLowerCase();
                    if (name.includes('walk')) {
                        this._gltfAnimations.walk = clip;
                    } else if (name.includes('run') && !this._gltfAnimations.walk) {
                        this._gltfAnimations.walk = clip; // Use run as fallback walk
                    } else if (name.includes('idle') || name.includes('stand')) {
                        this._gltfAnimations.idle = clip;
                    }
                }

                // Fallback: match by index for models without named clips
                if (!this._gltfAnimations.idle && gltf.animations.length > 0) {
                    this._gltfAnimations.idle = gltf.animations[0];
                }
                if (!this._gltfAnimations.walk && gltf.animations.length > 3) {
                    this._gltfAnimations.walk = gltf.animations[3]; // Soldier.glb walk index
                } else if (!this._gltfAnimations.walk && gltf.animations.length > 1) {
                    this._gltfAnimations.walk = gltf.animations[1]; // Run as fallback
                }

                // Rebuild pool with GLTF models
                this._rebuildPoolWithGLTF();
                console.log(`[CharacterPool] Loaded GLTF character: ${url} (${gltf.animations.length} animations)`);
                resolve();
            }, undefined, (err) => {
                console.warn(`[CharacterPool] Failed to load GLTF: ${url}`, err);
                reject(err);
            });
        });
    }

    async _rebuildPoolWithGLTF() {
        if (!this._gltfModel) return;

        // SkeletonUtils.clone is required for proper skeleton cloning
        let SkeletonUtils;
        try {
            const mod = await import('three/addons/utils/SkeletonUtils.js');
            SkeletonUtils = mod.SkeletonUtils || mod;
        } catch {
            try {
                const mod = await import('three/examples/jsm/utils/SkeletonUtils.js');
                SkeletonUtils = mod.SkeletonUtils || mod;
            } catch {
                console.warn('[CharacterPool] SkeletonUtils not available, using basic clone');
            }
        }

        for (let i = 0; i < this._pool.length; i++) {
            const entry = this._pool[i];
            // Remove procedural character
            this._detailGroup.remove(entry.group);

            // Clone GLTF model (SkeletonUtils preserves bone bindings)
            const clone = SkeletonUtils
                ? SkeletonUtils.clone(this._gltfModel)
                : this._gltfModel.clone(true);
            clone.visible = false;
            clone.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            // Scale to match expected character height (~0.35 units)
            const box = new THREE.Box3().setFromObject(clone);
            const modelHeight = box.max.y - box.min.y;
            if (modelHeight > 0) {
                const targetHeight = 0.35;
                clone.scale.setScalar(targetHeight / modelHeight);
            }

            // Set up AnimationMixer
            let mixer = null;
            if (this._gltfAnimations.walk || this._gltfAnimations.idle) {
                mixer = new THREE.AnimationMixer(clone);
                entry.mixer = mixer;
            }

            entry.group = clone;
            entry.bones = null; // GLTF uses mixer, not manual bones
            this._detailGroup.add(clone);
        }
    }

    /**
     * Allocate a detailed character for a citizen.
     * @param {number} citizenIdx
     * @param {number} seed - For appearance variation
     * @returns {number|null} Pool index, or null if pool exhausted
     */
    _allocate(citizenIdx, seed) {
        if (this._freePool.length === 0) return null;
        const poolIdx = this._freePool.pop();
        const entry = this._pool[poolIdx];

        entry.citizenIdx = citizenIdx;
        entry.active = true;
        entry.group.visible = true;

        // Recolor procedural character for this citizen
        if (entry.materials && !this._gltfModel) {
            const h = ((seed * 2654435761) >>> 0) / 4294967296;
            const h2 = (((seed + 1) * 2246822519) >>> 0) / 4294967296;
            const SKIN_TONES = [0xf5d0a9, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xd4a574];
            const SHIRT_COLORS = [
                0x2196f3, 0xe91e63, 0x4caf50, 0xff9800, 0x9c27b0,
                0x00bcd4, 0xff5722, 0x607d8b, 0x795548, 0x3f51b5,
                0xf44336, 0x009688, 0xffc107, 0x673ab7, 0x333333,
            ];
            entry.materials.skin.color.set(SKIN_TONES[Math.floor(h * SKIN_TONES.length)]);
            entry.materials.shirt.color.set(SHIRT_COLORS[Math.floor(h2 * SHIRT_COLORS.length)]);
        }

        // Start walk animation for GLTF models
        if (entry.mixer && this._gltfAnimations?.idle) {
            entry.mixer.stopAllAction();
            entry._idleAction = entry.mixer.clipAction(this._gltfAnimations.idle);
            entry._idleAction.play();
            if (this._gltfAnimations.walk) {
                entry._walkAction = entry.mixer.clipAction(this._gltfAnimations.walk);
                entry._walkAction.play();
                entry._walkAction.setEffectiveWeight(0);
            }
        }

        this._citizenToPool.set(citizenIdx, poolIdx);
        return poolIdx;
    }

    /**
     * Release a detailed character back to the pool.
     * @param {number} citizenIdx
     */
    _release(citizenIdx) {
        const poolIdx = this._citizenToPool.get(citizenIdx);
        if (poolIdx === undefined) return;

        const entry = this._pool[poolIdx];
        entry.group.visible = false;
        entry.citizenIdx = -1;
        entry.active = false;

        if (entry.mixer) {
            entry.mixer.stopAllAction();
        }

        this._citizenToPool.delete(citizenIdx);
        this._freePool.push(poolIdx);
    }

    /**
     * Main update — call once per frame.
     * Assigns/releases detailed characters based on distance to camera/player.
     *
     * @param {Array} citizens - game.citizens.citizens array
     * @param {Object} citizenPositions - _citizenPositions array from renderer
     * @param {number} playerX - Player world X
     * @param {number} playerY - Player world Y
     * @param {number} deltaTime - Frame delta in seconds
     * @returns {Set<number>} Set of citizen indices that have detailed characters (skip in instanced mesh)
     */
    update(citizens, citizenPositions, playerX, playerY, deltaTime) {
        const currentTime = performance.now() / 1000;
        const detailedSet = new Set();

        if (!citizens || citizens.length === 0) return detailedSet;

        // 1. Score all citizens by distance to player
        const scored = [];
        for (let i = 0; i < citizens.length; i++) {
            const c = citizens[i];
            const dx = c.x - playerX;
            const dy = c.y - playerY;
            const dist = Math.abs(dx) + Math.abs(dy); // Manhattan
            if (dist < NEAR_DISTANCE) {
                scored.push({ idx: i, dist });
            }
        }

        // Sort by distance (closest first), cap at pool size
        scored.sort((a, b) => a.dist - b.dist);
        const wantDetailed = new Set();
        for (let i = 0; i < Math.min(scored.length, MAX_DETAILED_CHARACTERS); i++) {
            wantDetailed.add(scored[i].idx);
        }

        // 2. Release characters that are no longer wanted
        for (const [citizenIdx] of this._citizenToPool) {
            if (!wantDetailed.has(citizenIdx)) {
                this._release(citizenIdx);
            }
        }

        // 3. Allocate characters for newly-near citizens
        for (const citizenIdx of wantDetailed) {
            if (!this._citizenToPool.has(citizenIdx)) {
                this._allocate(citizenIdx, citizens[citizenIdx].id || citizenIdx);
            }
        }

        // 4. Update positions and animations for all active characters
        for (const [citizenIdx, poolIdx] of this._citizenToPool) {
            const entry = this._pool[poolIdx];
            const cp = citizenPositions?.[citizenIdx];
            if (!entry.active || !cp) continue;

            detailedSet.add(citizenIdx);

            // Position
            const mapHalfW = this.game.map.width / 2;
            const mapHalfH = this.game.map.height / 2;
            const wx = cp.dispX - mapHalfW + 0.5;
            const wz = cp.dispY - mapHalfH + 0.5;

            entry.group.position.set(wx, 0, wz);
            entry.group.rotation.y = cp.heading || 0;

            // Animation
            if (entry.bones && !this._gltfModel) {
                // Procedural animation
                animateWalkCycle(entry.bones, currentTime, cp.isMoving, 1.0);
            } else if (entry.mixer) {
                // GLTF AnimationMixer
                entry.mixer.update(deltaTime);

                // Blend between walk and idle
                if (entry._walkAction && entry._idleAction) {
                    const walkWeight = cp.isMoving ? 1.0 : 0.0;
                    const idleWeight = 1.0 - walkWeight;
                    entry._walkAction.setEffectiveWeight(walkWeight);
                    entry._idleAction.setEffectiveWeight(idleWeight);
                }
            }
        }

        return detailedSet;
    }

    /**
     * Dispose all resources.
     */
    dispose() {
        for (const entry of this._pool) {
            this._detailGroup.remove(entry.group);
            if (entry.mixer) entry.mixer.stopAllAction();
        }
        this.scene.remove(this._detailGroup);
        this._pool = [];
        this._freePool = [];
        this._citizenToPool.clear();
        disposeCharacterGeometry();
    }
}
