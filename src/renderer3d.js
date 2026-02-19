// Third-person 3D renderer (Three.js via ESM CDN)
// Renders:
// - Terrain: Instanced boxes with per-instance colors
// - Buildings: Instanced boxes per building type
// - Citizens: Instanced spheres
// - Player: simple capsule-like stack

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN, BUILDING_TYPES, BUILDING_3D } from './constants.js';

// Non-deterministic float (no Math.random). Used ONLY for VFX jitter.
function rand01() {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && cryptoObj.getRandomValues) {
        const b = new Uint32Array(1);
        cryptoObj.getRandomValues(b);
        return (b[0] >>> 0) / 4294967296;
    }
    return 0.5;
}


export class Renderer3D {
    constructor(game, canvas) {
        this.game = game;
        this.canvas = canvas;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xb9d6ff);

        // Camera
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        this.yaw = 0;
        this.pitch = -0.35;
        this.followDist = 7;
        this.followHeight = 4;
        this.mouseSensitivity = 0.005;
        this.invertY = false;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.renderer.shadowMap.enabled = false;
        this.renderScale = 1.0;
        this.setRenderScale(1.0);

        // Lighting
        const amb = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(amb);
        const sun = new THREE.DirectionalLight(0xffffff, 0.8);
        sun.position.set(12, 20, 8);
        this.scene.add(sun);

        // Internal
        this._mapHalfW = 0;
        this._mapHalfH = 0;
        this._raycaster = new THREE.Raycaster();
        this._mouseNDC = new THREE.Vector2();

        this._terrainMesh = null;
        this._buildingsMeshes = new Map(); // type -> InstancedMesh
        this._citizensMesh = null;
        this._player = null;

        this._buildingsDirty = true;
        this._citizensDirty = true;

        // VFX - Floating text and progress rings
        this._vfxGroup = new THREE.Group();
        this._vfxTextGroup = new THREE.Group();
        this._vfxRingGroup = new THREE.Group();
        this._vfxGroup.add(this._vfxTextGroup);
        this._vfxGroup.add(this._vfxRingGroup);
        this.scene.add(this._vfxGroup);
        this._vfxEntries = [];
        this._vfxRings = [];

        this._groundPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this._groundPlane.rotation.x = -Math.PI / 2;
        this.scene.add(this._groundPlane);

        this.rebuildWorld();
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.renderer.setSize(rect.width, rect.height, false);
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
    }

    rebuildWorld() {
        // Cleanup
        if (this._terrainMesh) {
            this.scene.remove(this._terrainMesh);
            this._terrainMesh.geometry.dispose();
        }
        for (const mesh of this._buildingsMeshes.values()) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this._buildingsMeshes.clear();
        if (this._citizensMesh) {
            this.scene.remove(this._citizensMesh);
            this._citizensMesh.geometry.dispose();
        }
        if (this._player) {
            this.scene.remove(this._player);
        }

        // Map offsets
        this._mapHalfW = this.game.map.width / 2;
        this._mapHalfH = this.game.map.height / 2;

        // Terrain
        this._terrainMesh = this.buildTerrainInstanced();
        this.scene.add(this._terrainMesh);

        // Buildings
        this._buildingsDirty = true;
        this.rebuildBuildings();

        // Citizens
        this._citizensDirty = true;
        this.rebuildCitizens();

        // Player
        this._player = this.buildPlayer();
        this.scene.add(this._player);
        this.syncPlayer();
    }

    buildTerrainInstanced() {
        const w = this.game.map.width;
        const h = this.game.map.height;
        const count = w * h;

        const geom = new THREE.BoxGeometry(1, 0.12, 1);
        const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
        const mesh = new THREE.InstancedMesh(geom, mat, count);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        let i = 0;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const t = this.game.map.getTileAt(x, y);
                const wx = x - this._mapHalfW + 0.5;
                const wz = y - this._mapHalfH + 0.5;
                const isWater = t === TERRAIN_WATER;
                dummy.position.set(wx, isWater ? -0.06 : 0, wz);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);

                color.setHex(terrainHex(t));
                mesh.setColorAt(i, color);
                i++;
            }
        }
        mesh.instanceColor.needsUpdate = true;
        return mesh;
    }

    buildPlayer() {
        const group = new THREE.Group();
        const mat = new THREE.MeshLambertMaterial({ color: 0x333333 });

        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.8, 10), mat);
        body.position.y = 0.55;
        group.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), new THREE.MeshLambertMaterial({ color: 0xf2c7a3 }));
        head.position.y = 1.1;
        group.add(head);

        return group;
    }

    syncPlayer() {
        const p = this.game.player;
        // player.wx/wz are in tile-space coordinates (0..width) continuous.
        const wx = (p.wx ?? (p.x + 0.5)) - this._mapHalfW;
        const wz = (p.wz ?? (p.y + 0.5)) - this._mapHalfH;
        if (this._player) this._player.position.set(wx, 0, wz);
    }

    markBuildingsDirty() {
        this._buildingsDirty = true;
    }

    markCitizensDirty() {
        this._citizensDirty = true;
    }

    rebuildBuildings() {
        // Clear existing meshes
        for (const mesh of this._buildingsMeshes.values()) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
        }
        this._buildingsMeshes.clear();

        const byType = new Map();
        for (const b of this.game.buildings.buildings) {
            if (!byType.has(b.type)) byType.set(b.type, []);
            byType.get(b.type).push(b);
        }

        for (const [type, arr] of byType.entries()) {
            const h = (BUILDING_3D[type]?.height ?? 0.6);
            const geom = new THREE.BoxGeometry(0.85, h, 0.85);
            const mat = new THREE.MeshLambertMaterial({ color: buildingHex(type) });
            const mesh = new THREE.InstancedMesh(geom, mat, arr.length);
            const dummy = new THREE.Object3D();

            for (let i = 0; i < arr.length; i++) {
                const b = arr[i];
                const wx = b.x - this._mapHalfW + 0.5;
                const wz = b.y - this._mapHalfH + 0.5;
                dummy.position.set(wx, h / 2, wz);
                dummy.rotation.y = ((b.id || i) % 4) * (Math.PI / 2);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
            this._buildingsMeshes.set(type, mesh);
            this.scene.add(mesh);
        }

        this._buildingsDirty = false;
    }

    rebuildCitizens() {
        if (this._citizensMesh) {
            this.scene.remove(this._citizensMesh);
            this._citizensMesh.geometry.dispose();
        }

        const n = this.game.citizens.citizens.length;
        const geom = new THREE.SphereGeometry(0.15, 10, 10);
        const mat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
        this._citizensMesh = new THREE.InstancedMesh(geom, mat, Math.max(1, n));

        const dummy = new THREE.Object3D();
        for (let i = 0; i < n; i++) {
            const c = this.game.citizens.citizens[i];
            const wx = c.x - this._mapHalfW + 0.5;
            const wz = c.y - this._mapHalfH + 0.5;
            dummy.position.set(wx, 0.18, wz);
            dummy.updateMatrix();
            this._citizensMesh.setMatrixAt(i, dummy.matrix);
        }
        this._citizensMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this._citizensMesh);
        this._citizensDirty = false;
    }

    updateCitizens() {
        if (!this._citizensMesh) return;
        const n = this.game.citizens.citizens.length;
        if (this._citizensMesh.count !== Math.max(1, n)) {
            this._citizensDirty = true;
            return;
        }
        const dummy = new THREE.Object3D();
        for (let i = 0; i < n; i++) {
            const c = this.game.citizens.citizens[i];
            const wx = c.x - this._mapHalfW + 0.5;
            const wz = c.y - this._mapHalfH + 0.5;
            dummy.position.set(wx, 0.18, wz);
            dummy.updateMatrix();
            this._citizensMesh.setMatrixAt(i, dummy.matrix);
        }
        this._citizensMesh.instanceMatrix.needsUpdate = true;
    }

    // Convert mouse pixel coords to tile (or null)
    pickTile(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * 2 - 1;
        const y = -(((clientY - rect.top) / rect.height) * 2 - 1);
        this._mouseNDC.set(x, y);
        this._raycaster.setFromCamera(this._mouseNDC, this.camera);
        const hits = this._raycaster.intersectObject(this._groundPlane, false);
        if (!hits || hits.length === 0) return null;
        const p = hits[0].point;

        const mx = Math.floor(p.x + this._mapHalfW);
        const my = Math.floor(p.z + this._mapHalfH);
        if (mx < 0 || my < 0 || mx >= this.game.map.width || my >= this.game.map.height) return null;
        return { x: mx, y: my };
    }

    updateCamera() {
        // Follow player
        if (!this._player) return;

        const p = this._player.position;
        const cos = Math.cos(this.yaw);
        const sin = Math.sin(this.yaw);
        const back = new THREE.Vector3(-sin, 0, -cos);
        const camPos = new THREE.Vector3(
            p.x + back.x * this.followDist,
            p.y + this.followHeight,
            p.z + back.z * this.followDist
        );
        this.camera.position.lerp(camPos, 0.2);
        this.camera.lookAt(p.x, p.y + 1.0, p.z);
    }

    render() {
        const now = performance.now();
        if (this.fpsElement && this.fpsTimes !== undefined) {
            this.fpsTimes.push(now);
            while (this.fpsTimes.length > 60) this.fpsTimes.shift();
            if (this.fpsTimes.length >= 2) {
                const fps = Math.round(1000 / ((now - this.fpsTimes[0]) / (this.fpsTimes.length - 1)));
                this.fpsElement.textContent = `FPS: ${fps}`;
            }
        }

        if (this._buildingsDirty) this.rebuildBuildings();
        if (this._citizensDirty) this.rebuildCitizens();
        else this.updateCitizens();

        this.syncPlayer();
        this.updateCamera();
        this.updateVFX();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Set render scale (for performance)
     */
    setRenderScale(scale) {
        this.renderScale = scale;
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.renderer.setSize(width * scale, height * scale, false);
    }

    /**
     * Toggle FPS overlay
     */
    setShowFPS(show) {
        if (show) {
            if (!this.fpsElement) {
                this.fpsElement = document.createElement('div');
                this.fpsElement.id = 'fps-overlay';
                this.fpsElement.className = 'fps-overlay hidden';
                this.fpsElement.style.cssText = 'position:fixed;bottom:10px;left:10px;padding:8px 12px;background:rgba(0,0,0,0.7);color:#fff;font-family:monospace;font-size:12px;border-radius:4px;z-index:1000;';
                document.body.appendChild(this.fpsElement);
                this.fpsTimes = [];
            }
            this.fpsElement.classList.remove('hidden');
        } else {
            if (this.fpsElement) {
                this.fpsElement.classList.add('hidden');
            }
        }
    }

    /**
     * Show floating build confirmation text
     */
    showBuildFeedback(x, y, type, success) {
        const text = success ? `Built ${type}` : 'Build Failed';
        const color = success ? '#4caf50' : '#f44336';
        this.showFloatingText(x, y, text, color, 1500);
    }

    /**
     * Show hack progress ring
     */
    showHackProgress(x, y, progress) {
        // Remove existing ring for same position
        this._vfxRings = this._vfxRings.filter(r => r.x !== x || r.y !== y);
        this._vfxRingGroup.remove(ringMesh);

        // Create ring at position
        const ringGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0x3b7a57,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
        const ringMesh = new THREE.Mesh(ringGeometry, ringMaterial);
        const wx = x - this._mapHalfW + 0.5;
        const wz = y - this._mapHalfH + 0.5;
        ringMesh.position.set(wx, 0.2, wz);
        ringMesh.rotation.x = -Math.PI / 2;
        this._vfxRingGroup.add(ringMesh);

        this._vfxRings.push({ x, y, mesh: ringMesh, progress: 0 });
    }

    /**
     * Update hack progress ring
     */
    updateHackProgress(x, y, progress) {
        const ring = this._vfxRings.find(r => r.x === x && r.y === y);
        if (ring) {
            // Update ring material to show progress
            const size = Math.min(0.4, 0.3 + progress * 0.1);
            ring.mesh.scale.setScalar(1 + progress * 0.2);
            ring.mesh.material.color.setHSL(0.33 + progress * 0.1, 0.7, 0.5);
            ring.mesh.material.opacity = 0.8 - progress * 0.3;
        }
    }

    /**
     * Show hack completion/failed effect
     */
    showHackResult(x, y, success) {
        // Remove existing rings
        this._vfxRings = this._vfxRings.filter(r => r.x !== x || r.y !== y);

        const color = success ? '#4caf50' : '#f44336';
        const text = success ? 'Success!' : 'Failed';
        this.showFloatingText(x, y, text, color, 2000);

        // Simple particle burst
        this.showParticleBurst(x, y, color, 10);
    }

    /**
     * Show floating text (billboarded sprite text)
     */
    showFloatingText(x, y, text, color = '#fff', duration = 2000) {
        const container = document.createElement('div');
        container.className = 'build-feedback';
        container.textContent = text;
        container.style.color = color;
        container.style.left = '';
        container.style.top = '';

        // Add to DOM
        const rect = this.canvas.getBoundingClientRect();
        const wx = x - this._mapHalfW + 0.5;
        const wz = y - this._mapHalfH + 0.5;

        // Project world position to screen
        const vector = new THREE.Vector3(wx, 0.5, wz);
        vector.project(this.camera);

        const screenX = (vector.x * 0.5 + 0.5) * rect.width;
        const screenY = (-(vector.y * 0.5) + 0.5) * rect.height;

        container.style.left = screenX + 'px';
        container.style.top = screenY + 'px';
        document.body.appendChild(container);

        // Cleanup after animation
        setTimeout(() => {
            if (container.parentNode) {
                container.parentNode.removeChild(container);
            }
        }, duration);

        this._vfxEntries.push({
            type: 'text',
            element: container,
            endTime: performance.now() + duration
        });
    }

    /**
     * Show particle burst at position
     */
    showParticleBurst(x, y, color, count = 10) {
        const wx = x - this._mapHalfW + 0.5;
        const wz = y - this._mapHalfH + 0.5;

        for (let i = 0; i < count; i++) {
            const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8);
            const particleMaterial = new THREE.MeshBasicMaterial({ color });
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);

            particle.position.set(
                wx + (rand01() - 0.5) * 0.5,
                0.2,
                wz + (rand01() - 0.5) * 0.5
            );

            particle.userData = {
                velocity: new THREE.Vector3(
                    (rand01() - 0.5) * 0.1,
                    (rand01() * 0.1 + 0.05),
                    (rand01() - 0.5) * 0.1
                ),
                life: 1.0
            };

            this._vfxGroup.add(particle);

            this._vfxEntries.push({
                type: 'particle',
                mesh: particle,
                endTime: performance.now() + 1000
            });
        }
    }

    /**
     * Update VFX entries (particles, floating text cleanup)
     */
    updateVFX() {
        const now = performance.now();

        // Clean up expired entries
        this._vfxEntries = this._vfxEntries.filter(entry => {
            if (now >= entry.endTime) {
                if (entry.type === 'text' && entry.element.parentNode) {
                    entry.element.parentNode.removeChild(entry.element);
                } else if (entry.type === 'particle') {
                    this._vfxGroup.remove(entry.mesh);
                }
                return false;
            }
            return true;
        });

        // Update particles
        for (const entry of this._vfxEntries) {
            if (entry.type === 'particle' && entry.mesh.userData.velocity) {
                const data = entry.mesh.userData;
                entry.mesh.position.add(data.velocity);
                data.velocity.y -= 0.005; // gravity
                data.life -= 0.02;
                entry.mesh.material.opacity = data.life;

                if (entry.mesh.position.y < 0) {
                    entry.mesh.position.y = 0;
                    data.velocity.y *= -0.5; // bounce
                }
            }
        }
    }
}

function terrainHex(t) {
    switch (t) {
        case TERRAIN_WATER: return 0x4da6ff;
        case TERRAIN_GRASS: return 0x66cdaa;
        case TERRAIN_FOREST: return 0x2d6a4f;
        case TERRAIN_MOUNTAIN: return 0x8b4513;
        default: return 0x444444;
    }
}

function buildingHex(type) {
    // Stable per building type
    switch (type) {
        case 'house': return 0xe8d5b0;
        case 'farm': return 0xf0c808;
        case 'lumber-mill': return 0x8b5a2b;
        case 'market': return 0x4a90e2;
        case 'town-hall': return 0x3b7a57;
        case 'warehouse': return 0x9e9e9e;
        case 'barracks': return 0x7e4d1a;
        case 'school': return 0x6ab0de;
        default: return 0xffffff;
    }
}