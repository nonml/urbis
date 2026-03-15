// Third-person 3D renderer (Three.js)
// Renders:
// - Terrain: Instanced boxes with per-instance colors
// - Buildings: Instanced boxes per building type
// - Citizens: Instanced spheres
// - Player: simple capsule-like stack
// - Camera rig: Orbit + Follow + Collision

// IMPORTANT: Do NOT import Three.js from a single CDN at module-load time.
// Many users run behind corporate firewalls / adblockers that block unpkg.
// If that static import fails, the entire module fails to load and the UI
// can never upgrade from the compatibility renderer.
//
// Instead, we lazy-load Three.js at runtime with multiple fallbacks:
//  1) local dependency ("three") when running under Vite / npm
//  2) a small list of CDNs

let THREE = null;

function isWebGLAvailable() {
    try {
        const canvas = document.createElement('canvas');
        const gl2 = canvas.getContext('webgl2');
        if (gl2) return true;
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
    } catch {
        return false;
    }
}

async function loadThreeJS() {
    if (THREE) return THREE;

    const attempts = [];

    // 1) Preferred: local dependency (works with Vite bundling)
    try {
        THREE = await import('three');
        return THREE;
    } catch (e) {
        attempts.push({ target: 'three (local dependency)', error: e });
    }

    // 2) CDN fallbacks (ESM)
    const cdns = [
        'https://unpkg.com/three@0.160.0/build/three.module.js',
        'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
        'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.160.0/three.module.js',
    ];

    for (const url of cdns) {
        try {
            THREE = await import(/* @vite-ignore */ url);
            return THREE;
        } catch (e) {
            attempts.push({ target: url, error: e });
        }
    }

    const last = attempts[attempts.length - 1];
    const msg = [
        'Failed to load Three.js.\n',
        'Fix options:\n',
        '  - Recommended: run `npm install` (this project expects `three` as a dependency under Vite)\n',
        '  - Or allow a CDN (unpkg/jsdelivr/cdnjs) through your firewall/adblock\n',
        '',
        'Attempted sources:',
        ...attempts.map((a) => `- ${a.target}: ${String(a.error?.message || a.error)}`),
    ].join('\n');

    const err = new Error(msg);
    // Keep the last error for console debugging
    err.cause = last?.error;
    throw err;
}

export async function createRenderer3D(game, canvas) {
    if (!isWebGLAvailable()) {
        throw new Error('WebGL is unavailable or disabled in this browser/device.');
    }
    await loadThreeJS();
    return new Renderer3D(game, canvas);
}
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN, BUILDING_TYPES, BUILDING_3D } from './constants.js';
import { eventBus, EVENT_TYPES } from './sim/events.js';
import { ZONE_TYPES } from './sim/zoning/zoning.js';
import { createDayNightCycle, DAY_PHASES } from './sim/day_night.js';
import { createLightingManager, LIGHTING_PRESETS } from './render/lighting/day_night.js';
import { createFXSystem } from './render/fx/fx_system.js';
import { createVFXTriggerManager, setVFXTriggerManager } from './render/fx/vfx_triggers.js';
import { createParticleSystem } from './world/particle_pool.js';

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
        this.scene.fog = new THREE.FogExp2(0xb9d6ff, 0.0001);

        // Camera rig (Ticket B-2: Orbit + Follow + Collision)
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);
        this.yaw = 0;
        this.pitch = -0.4;
        this.followDist = 8;
        this.targetFollowDist = 8;
        this.followHeight = 4;
        this.minFollowDist = 4;
        this.maxFollowDist = 15;
        this.mouseSensitivity = 0.005;
        this.invertY = false;
        this.cameraCollision = true;
        this.cameraCollisionRadius = 1.0;
        this.zoomSensitivity = 0.1;
        this.zoomDampening = 0.15;

        // LOD thresholds (world units from camera to chunk center)
        // Full detail below LOD_FULL_DIST; terrain-only between FULL and TERRAIN_ONLY; hidden beyond FAR.
        this.LOD_FULL_DIST = 40;
        this.LOD_TERRAIN_ONLY_DIST = 100;
        
        // Camera mode settings (God vs Street)
        this.cameraMode = 'street'; // 'street' or 'god'
        this.cameraModeTransition = 0; // 0 = street, 1 = god
        this.cameraModeTarget = 0; // target for smooth transition
        
        // Mode-specific camera settings
        this.streetCamera = {
            pitch: -0.4,
            followDist: 8,
            followHeight: 4,
            fov: 60,
            yawSpeed: 0.005,
            pitchSpeed: 0.005
        };
        this.godCamera = {
            pitch: -0.8,
            followDist: 15,
            followHeight: 12,
            fov: 70,
            yawSpeed: 0.003,
            pitchSpeed: 0.003
        };
        
        // Camera shake
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeDecay = 1.0;
        this.shakeOffset = new THREE.Vector3(0, 0, 0);

        // Citizen animation
        this._citizenAnimTimes = [];
        
        // Building hover feedback
        this._hoveredTile = null;
        this._hoverHighlight = null;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
        this.renderer.shadowMap.enabled = false;
        this.renderScale = 1.0;
        this.setRenderScale(1.0);

        // Lighting
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(this.ambientLight);
        this.sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.sunLight.position.set(12, 20, 8);
        this.scene.add(this.sunLight);
        
        // Day/Night cycle
        this.dayNightCycle = createDayNightCycle();
        
        // Lighting manager for enhanced visual effects
        this.lightingManager = createLightingManager(this.scene, this.renderer);
        
        // VFX system
        this.fxSystem = createFXSystem(this.scene, this.renderer);
        window.fxSystem = this.fxSystem;
        
        // Wire camera shake from FXSystem to renderer
        this.fxSystem.onShakeCamera = (intensity, duration) => {
            this.shakeCamera(intensity, duration);
        };
        
        // VFX trigger manager - wires game events to visual effects
        this.vfxTriggerManager = createVFXTriggerManager(this.fxSystem, this.game);
        this.vfxTriggerManager.setupListeners();
        window.vfxTriggerManager = this.vfxTriggerManager;
        setVFXTriggerManager(this.vfxTriggerManager);
        
        // Particle system
        this.particleSystem = createParticleSystem(this.scene, this.renderer);
        window.particleSystem = this.particleSystem;
        
        // Internal
        this._mapHalfW = 0;
        this._mapHalfH = 0;
        this._raycaster = new THREE.Raycaster();
        this._mouseNDC = new THREE.Vector2();

        this._chunkMeshes = new Map(); // chunkId -> { group, center, radius, terrainCount, buildingCount }
        this._citizensMesh = null;
        this._player = null;
        this._buildGhost = null;
        this._buildGhostType = null;
        this._frustum = new THREE.Frustum();
        this._projScreenMatrix = new THREE.Matrix4();

        this._buildingsDirty = true;
        this._citizensDirty = true;

        // Building spawn flash animations (1D: game feel)
        this._spawnFlashes = [];
        eventBus.on(EVENT_TYPES.PLAYER_BUILT_BUILDING, (data) => {
            if (data.x != null && data.y != null) {
                this._addSpawnFlash(data.x, data.y);
            }
        });

        // Cinematic camera state (1B: crisis zoom)
        this._cinematic = {
            active: false,
            startPos: new THREE.Vector3(),
            targetPos: new THREE.Vector3(),
            startLook: new THREE.Vector3(),
            targetLook: new THREE.Vector3(),
            duration: 0,
            elapsed: 0,
            returnDelay: 0,    // ms to hold at target before returning
            returning: false,
        };
        this._setupCinematicListeners();

        // Create hover highlight ring
        this._createHoverHighlight();

        // VFX - Floating text and progress rings
        this._vfxGroup = new THREE.Group();
        this._vfxTextGroup = new THREE.Group();
        this._vfxRingGroup = new THREE.Group();
        this._vfxGroup.add(this._vfxTextGroup);
        this._vfxGroup.add(this._vfxRingGroup);
        this.scene.add(this._vfxGroup);
        this._vfxEntries = [];
        this._vfxRings = [];

        // GLTF model library: type -> THREE.Group (set after async _preloadModels)
        this._gltfModels = new Map();

        // Debug overlays
        this._debugMode = 'none'; // 'none', 'districts', 'roads', 'parcels', 'pois', 'nav', 'services'
        this._debugOverlayMesh = null;
        this._cameraHack = null;

        // Zone overlay
        this._zoneOverlayMesh = null;
        this._zoneMode = 'none'; // 'none', 'zones', 'zoned'

        this._groundPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this._groundPlane.rotation.x = -Math.PI / 2;
        this.scene.add(this._groundPlane);

        this.rebuildWorld();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('wheel', (e) => this.handleWheel(e));

        // Async: load Kenney GLB models, then rebuild once ready
        this._preloadModels();
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.renderer.setSize(rect.width, rect.height, false);
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
    }

    handleWheel(e) {
        const delta = Math.sign(e.deltaY);
        this.targetFollowDist = Math.max(this.minFollowDist, Math.min(this.maxFollowDist, this.targetFollowDist - delta * this.zoomSensitivity * 5));
    }

    rebuildWorld() {
        // Cleanup
        if (this._debugOverlayMesh) {
            this.scene.remove(this._debugOverlayMesh);
            this._debugOverlayMesh.geometry.dispose();
            this._debugOverlayMesh = null;
        }
        if (this._zoneOverlayMesh) {
            this.scene.remove(this._zoneOverlayMesh);
            this._zoneOverlayMesh.geometry.dispose();
            this._zoneOverlayMesh = null;
        }
        for (const entry of this._chunkMeshes.values()) {
            this._disposeChunkEntry(entry);
        }
        this._chunkMeshes.clear();
        if (this._citizensMesh) {
            this.scene.remove(this._citizensMesh);
            this._citizensMesh.geometry.dispose();
        }
        if (this._player) {
            this.scene.remove(this._player);
        }
        if (this._buildGhost) {
            this.scene.remove(this._buildGhost);
            this._buildGhost.geometry.dispose();
            this._buildGhost.material.dispose();
            this._buildGhost = null;
            this._buildGhostType = null;
        }

        // Map offsets
        this._mapHalfW = this.game.map.width / 2;
        this._mapHalfH = this.game.map.height / 2;

        // Chunked terrain + buildings
        this._buildingsDirty = true;
        this.syncChunkStreaming(true);

        // Citizens
        this._citizensDirty = true;
        this.rebuildCitizens();

        // Player
        this._player = this.buildPlayer();
        this.scene.add(this._player);
        this.syncPlayer();

        // Update debug overlay
        this.updateDebugOverlay();
    }

    // -----------------------------------------------------------------------
    // Kenney GLB model loader
    // -----------------------------------------------------------------------
    /** Maps game building types → Kenney GLB asset paths (in public/) */
    static MODEL_MAP = {
        'house':             'assets/models/kenney_suburban/building-type-a.glb',
        'farm':              'assets/models/kenney_suburban/building-type-c.glb',
        'lumber-mill':       'assets/models/kenney_commercial/building-d.glb',
        'market':            'assets/models/kenney_commercial/building-a.glb',
        'town-hall':         'assets/models/kenney_commercial/building-skyscraper-a.glb',
        'warehouse':         'assets/models/kenney_suburban/building-type-g.glb',
        'barracks':          'assets/models/kenney_suburban/building-type-m.glb',
        'school':            'assets/models/kenney_suburban/building-type-b.glb',
        'police-station':    'assets/models/kenney_commercial/building-b.glb',
        'cctv-network':      'assets/models/kenney_suburban/building-type-d.glb',
        'counterintel':      'assets/models/kenney_commercial/building-c.glb',
        'propaganda-office': 'assets/models/kenney_commercial/building-e.glb',
    };

    /** Uniform scale per type so models fit inside a 1-unit tile */
    static MODEL_SCALE = {
        'town-hall': 0.28,
        default:     0.38,
    };

    async _preloadModels() {
        let GLTFLoader;
        try {
            const mod = await import('three/addons/loaders/GLTFLoader.js');
            GLTFLoader = mod.GLTFLoader;
        } catch {
            // three/addons not available — keep box fallback forever
            return;
        }

        const loader = new GLTFLoader();
        const loadOne = (type, url) => new Promise((resolve) => {
            loader.load(url, (gltf) => {
                const root = gltf.scene;
                const scale = Renderer3D.MODEL_SCALE[type] ?? Renderer3D.MODEL_SCALE.default;
                root.scale.setScalar(scale);
                // Sit flat on Y=0 and center on XZ
                const box = new THREE.Box3().setFromObject(root);
                const center = box.getCenter(new THREE.Vector3());
                root.position.x -= center.x;
                root.position.z -= center.z;
                root.position.y -= box.min.y;
                this._gltfModels.set(type, root);
                resolve();
            }, undefined, () => resolve()); // on error, skip silently
        });

        await Promise.all(
            Object.entries(Renderer3D.MODEL_MAP).map(([type, url]) => loadOne(type, url))
        );

        // Swap boxes → real models across all loaded chunks
        if (this._gltfModels.size > 0) {
            this.rebuildWorld();
        }
    }

    _disposeChunkEntry(entry) {
        if (!entry) return;
        this.scene.remove(entry.group);
        entry.group.traverse((obj) => {
            if (obj.isMesh) {
                obj.geometry?.dispose?.();
                obj.material?.dispose?.();
            }
        });
    }

    _buildTerrainMeshesForChunk(bounds) {
        const byTerrain = new Map();
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const terrain = this.game.map.getTileAt(x, y);
                if (!byTerrain.has(terrain)) byTerrain.set(terrain, []);
                byTerrain.get(terrain).push({ x, y });
            }
        }

        const meshes = [];
        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        for (const [terrain, tiles] of byTerrain.entries()) {
            if (tiles.length === 0) continue;
            const geom = new THREE.BoxGeometry(1, 0.12, 1);
            const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
            const mesh = new THREE.InstancedMesh(geom, mat, tiles.length);
            mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

            for (let i = 0; i < tiles.length; i++) {
                const tile = tiles[i];
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                const isWater = terrain === TERRAIN_WATER;
                dummy.position.set(wx, isWater ? -0.06 : 0, wz);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
                color.setHex(terrainHex(terrain));
                mesh.setColorAt(i, color);
            }

            mesh.instanceColor.needsUpdate = true;
            meshes.push(mesh);
        }
        return meshes;
    }

    _buildBuildingMeshesForChunk(bounds, buildings) {
        const objects = [];
        const boxGroups = new Map(); // type -> building[]

        for (const b of buildings) {
            if (b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY) continue;
            const model = this._gltfModels.get(b.type);
            if (model) {
                const clone = model.clone(true);
                const wx = b.x - this._mapHalfW + 0.5;
                const wz = b.y - this._mapHalfH + 0.5;
                clone.position.set(wx, 0, wz);
                clone.rotation.y = ((b.rotation ?? ((b.id || 0) % 4)) % 4) * (Math.PI / 2);
                objects.push(clone);
            } else {
                if (!boxGroups.has(b.type)) boxGroups.set(b.type, []);
                boxGroups.get(b.type).push(b);
            }
        }

        // Box instanced mesh fallback for types without a loaded model
        const dummy = new THREE.Object3D();
        for (const [type, arr] of boxGroups.entries()) {
            if (arr.length === 0) continue;
            const h = (BUILDING_3D[type]?.height ?? 0.6);
            const geom = new THREE.BoxGeometry(0.85, h, 0.85);
            const mat = new THREE.MeshLambertMaterial({ color: buildingHex(type) });
            const mesh = new THREE.InstancedMesh(geom, mat, arr.length);
            for (let i = 0; i < arr.length; i++) {
                const b = arr[i];
                const wx = b.x - this._mapHalfW + 0.5;
                const wz = b.y - this._mapHalfH + 0.5;
                dummy.position.set(wx, h / 2, wz);
                dummy.rotation.y = ((b.rotation ?? ((b.id || i) % 4)) % 4) * (Math.PI / 2);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
            objects.push(mesh);
        }
        return objects;
    }

    _createChunkEntry(chunkId) {
        const bounds = this.game.chunks.getChunkBounds(chunkId);
        const group = new THREE.Group();
        const terrainMeshes = this._buildTerrainMeshesForChunk(bounds);
        for (const mesh of terrainMeshes) {
            mesh.userData.kind = 'terrain';
            group.add(mesh);
        }
        const buildingMeshes = this._buildBuildingMeshesForChunk(bounds, this.game.buildings.buildings);
        for (const mesh of buildingMeshes) {
            mesh.userData.kind = 'building';
            group.add(mesh);
        }

        const center = new THREE.Vector3(
            ((bounds.minX + bounds.maxX + 1) / 2) - this._mapHalfW,
            0,
            ((bounds.minY + bounds.maxY + 1) / 2) - this._mapHalfH
        );
        const width = (bounds.maxX - bounds.minX + 1);
        const height = (bounds.maxY - bounds.minY + 1);
        const radius = Math.sqrt(width * width + height * height) * 0.75;

        this.scene.add(group);
        return {
            group,
            bounds,
            center,
            radius,
            terrainCount: terrainMeshes.reduce((n, mesh) => n + mesh.count, 0),
            buildingCount: buildingMeshes.reduce((n, m) => n + (m.count ?? 1), 0),
        };
    }

    _rebuildChunkBuildings(chunkId) {
        const entry = this._chunkMeshes.get(chunkId);
        if (!entry) return;
        const toRemove = [];
        entry.group.children.forEach((child) => {
            if (child.userData?.kind === 'building') {
                toRemove.push(child);
            }
        });
        for (const child of toRemove) {
            entry.group.remove(child);
            // Traverse handles both InstancedMesh and cloned GLTF groups
            child.traverse?.((obj) => {
                if (obj.isMesh) {
                    obj.geometry?.dispose?.();
                    if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
                    else obj.material?.dispose?.();
                }
            });
        }
        const meshes = this._buildBuildingMeshesForChunk(entry.bounds, this.game.buildings.buildings);
        for (const mesh of meshes) {
            mesh.userData.kind = 'building';
            entry.group.add(mesh);
        }
        entry.buildingCount = meshes.reduce((n, m) => n + (m.count ?? 1), 0);
    }

    syncChunkStreaming(forceInitial = false) {
        if (!this.game.chunks) return;
        const p = this.game.player;
        const pinnedTiles = this.game.getPinnedChunkTiles?.() || [];
        const result = this.game.chunks.update({ x: p.x, y: p.y }, pinnedTiles, performance.now());

        for (const chunkId of result.loadedNow) {
            const entry = this._createChunkEntry(chunkId);
            this._chunkMeshes.set(chunkId, entry);
        }
        for (const chunkId of result.unloadedNow) {
            const entry = this._chunkMeshes.get(chunkId);
            this._disposeChunkEntry(entry);
            this._chunkMeshes.delete(chunkId);
        }
        if (forceInitial) {
            for (const chunkId of result.active) {
                if (!this._chunkMeshes.has(chunkId)) {
                    const entry = this._createChunkEntry(chunkId);
                    this._chunkMeshes.set(chunkId, entry);
                }
            }
        }

        if (this._buildingsDirty) {
            for (const chunkId of this._chunkMeshes.keys()) {
                this._rebuildChunkBuildings(chunkId);
            }
            this._buildingsDirty = false;
        }

        this._projScreenMatrix.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
        this._frustum.setFromProjectionMatrix(this._projScreenMatrix);
        const camPos = this.camera.position;
        for (const entry of this._chunkMeshes.values()) {
            const sphere = new THREE.Sphere(entry.center, entry.radius);
            const inFrustum = this._frustum.intersectsSphere(sphere);
            if (!inFrustum) {
                entry.group.visible = false;
                continue;
            }
            // Distance-based LOD: hide buildings on distant chunks to reduce draw calls
            const dist = camPos.distanceTo(entry.center);
            if (dist > this.LOD_TERRAIN_ONLY_DIST) {
                entry.group.visible = false;
            } else {
                entry.group.visible = true;
                const terrainOnly = dist > this.LOD_FULL_DIST;
                for (const child of entry.group.children) {
                    if (child.userData?.kind === 'building') {
                        child.visible = !terrainOnly;
                    }
                }
            }
        }
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
        this._buildingsDirty = true;
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

        // Initialize animation timing for each citizen (random offset for variety)
        this._citizenAnimTimes = [];
        for (let i = 0; i < n; i++) {
            this._citizenAnimTimes.push({
                phase: Math.random() * Math.PI * 2, // Random start phase
                speed: 2 + Math.random() * 2, // Random speed between 2-4 rad/s
                amplitude: 0.03 + Math.random() * 0.02 // Random amplitude between 0.03-0.05
            });
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
        const currentTime = performance.now() / 1000; // Current time in seconds
        
        for (let i = 0; i < n; i++) {
            const c = this.game.citizens.citizens[i];
            const wx = c.x - this._mapHalfW + 0.5;
            const wz = c.y - this._mapHalfH + 0.5;
            
            // Add subtle vertical bobbing animation to make citizens appear alive
            let yPos = 0.18; // Base height
            if (this._citizenAnimTimes[i]) {
                const anim = this._citizenAnimTimes[i];
                // Sine wave bobbing based on time, phase, and speed
                const bobOffset = Math.sin(currentTime * anim.speed + anim.phase) * anim.amplitude;
                yPos = 0.18 + bobOffset;
            }
            
            dummy.position.set(wx, yPos, wz);
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

    updateCamera(dt = 16.67) {
        // Photo mode: camera position driven externally by PhotoMode._tick()
        if (this._photoMode) return;

        // Cinematic camera takeover (crisis zoom)
        if (this._cinematic?.active) {
            this._updateCinematic(dt);
            if (this._cinematic.active && !this._cinematic.returning) return;
        }

        // Temporary camera takeover from hacked nodes.
        if (this._cameraHack && this.game.state.time.tick < this._cameraHack.untilTick) {
            const wx = this._cameraHack.x - this._mapHalfW + 0.5;
            const wz = this._cameraHack.y - this._mapHalfH + 0.5;
            this.camera.position.set(wx, 4.5, wz + 0.2);
            this.camera.lookAt(wx, 0, wz);
            return;
        }
        if (this._cameraHack && this.game.state.time.tick >= this._cameraHack.untilTick) {
            this._cameraHack = null;
        }

        // Follow player with camera rig (Ticket B-2: Orbit + Follow + Collision)
        if (!this._player) return;

        const p = this._player.position;

        // Smooth camera mode transition
        const transitionSpeed = 0.08;
        this.cameraModeTransition += (this.cameraModeTarget - this.cameraModeTransition) * transitionSpeed;
        const t = this.cameraModeTransition; // 0 = street, 1 = god

        // Interpolate camera settings based on mode transition
        const currentPitch = THREE.MathUtils.lerp(this.streetCamera.pitch, this.godCamera.pitch, t);
        const currentFollowDist = THREE.MathUtils.lerp(this.streetCamera.followDist, this.godCamera.followDist, t);
        const currentFollowHeight = THREE.MathUtils.lerp(this.streetCamera.followHeight, this.godCamera.followHeight, t);
        const currentFOV = THREE.MathUtils.lerp(this.streetCamera.fov, this.godCamera.fov, t);

        // Calculate ideal camera position from orbit
        const cos = Math.cos(this.yaw);
        const sin = Math.sin(this.yaw);

        // Camera position relative to player (orbit)
        const idealX = p.x - sin * currentFollowDist;
        const idealZ = p.z - cos * currentFollowDist;

        // Height based on pitch (more pitch = lower height)
        // Pitch range: -1.2 (look down) to -0.1 (look up)
        const targetHeight = p.y + Math.sin(currentPitch) * currentFollowDist + currentFollowHeight;

        // Apply pitch smoothing (damped oscillation)
        const pitchDamp = 0.15;
        this.pitch = this.pitch + (Math.max(-1.2, Math.min(-0.1, currentPitch)) - this.pitch) * pitchDamp;

        // Build ideal camera position
        let idealCamPos = new THREE.Vector3(idealX, targetHeight, idealZ);

        // Collision detection: raycast from player to camera position
        // Check for obstacles (mountains, buildings) along the line
        if (this.cameraCollision) {
            const playerPos = new THREE.Vector3(p.x, p.y + 1.5, p.z);
            const rayOrigin = playerPos.clone();
            const rayDirection = idealCamPos.clone().sub(playerPos).normalize();

            // Raycast length = follow distance
            const raycaster = new THREE.Raycaster(rayOrigin, rayDirection);
            raycaster.near = 0.1;
            raycaster.far = this.followDist;

            // Check terrain collisions by sampling heights along the path
            let collisionFound = false;
            const steps = Math.ceil(this.followDist);
            const stepSize = this.followDist / steps;

            for (let i = 1; i < steps; i++) {
                const distance = i * stepSize;
                const checkPos = new THREE.Vector3(
                    playerPos.x + rayDirection.x * distance,
                    0,
                    playerPos.z + rayDirection.z * distance
                );

                // Get terrain height at this position
                const tx = Math.floor(checkPos.x + this._mapHalfW);
                const tz = Math.floor(checkPos.z + this._mapHalfH);

                if (tx >= 0 && tz >= 0 && tx < this.game.map.width && tz < this.game.map.height) {
                    const tile = this.game.map.getTileAt(tx, tz);
                    let terrainHeight = 0;

                    switch (tile) {
                        case 0: // Water
                            terrainHeight = -0.06;
                            break;
                        case 1: // Grass
                            terrainHeight = 0;
                            break;
                        case 2: // Forest
                            terrainHeight = 0.05;
                            break;
                        case 3: // Mountain
                            terrainHeight = 0.3;
                            break;
                    }

                    // If terrain is too high, move camera up
                    if (terrainHeight > 0.2) {
                        const heightDiff = terrainHeight - checkPos.y;
                        if (heightDiff > 0.3) {
                            checkPos.y += heightDiff + 0.5;
                            collisionFound = true;
                        }
                    }
                }
            }

            // If collision found, adjust camera position
            if (collisionFound) {
                idealCamPos.y = Math.max(idealCamPos.y, playerPos.y + this.followHeight + 1);
            }
        }

        // Update FOV smoothly
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, currentFOV, 0.1);
        this.camera.updateProjectionMatrix();

        this.followDist += (this.targetFollowDist - this.followDist) * this.zoomDampening;

        // Apply camera shake
        if (this.shakeIntensity > 0 && this.shakeDuration > 0) {
            this.shakeDuration -= 16.67; // Assume ~60fps
            if (this.shakeDuration <= 0) {
                this.shakeDuration = 0;
                this.shakeIntensity = 0;
            } else {
                // Decay shake intensity
                this.shakeDecay = Math.max(0, this.shakeDecay - 0.02);
                const currentShake = this.shakeIntensity * this.shakeDecay;
                
                // Generate random shake offset
                this.shakeOffset.x = (Math.random() - 0.5) * currentShake;
                this.shakeOffset.y = (Math.random() - 0.5) * currentShake * 0.5; // Less vertical shake
                this.shakeOffset.z = (Math.random() - 0.5) * currentShake;
            }
        } else {
            this.shakeOffset.set(0, 0, 0);
        }

        // Apply camera position with shake
        const finalCamPos = idealCamPos.clone().add(this.shakeOffset);
        this.camera.position.lerp(finalCamPos, 0.15);
        this.camera.lookAt(p.x, p.y + 1.0, p.z);
    }

    // -----------------------------------------------------------------------
    // Building spawn flash (1D: game feel)
    // -----------------------------------------------------------------------

    _addSpawnFlash(tileX, tileY) {
        const wx = tileX - this._mapHalfW + 0.5;
        const wz = tileY - this._mapHalfH + 0.5;
        const geom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(wx, 0.45, wz);
        mesh.scale.set(0, 0, 0);
        this.scene.add(mesh);
        this._spawnFlashes.push({ mesh, elapsed: 0, duration: 450 });

        // Add scaffolding: wireframe cage that lingers during construction (6B)
        this._addScaffolding(wx, wz);
    }

    /** Construction scaffolding — yellow wireframe cage that fades over 2.5s (6B) */
    _addScaffolding(wx, wz) {
        if (!this._scaffolds) this._scaffolds = [];
        const geom = new THREE.BoxGeometry(0.92, 0.92, 0.92);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffcc00, wireframe: true, transparent: true, opacity: 0.7
        });
        const cage = new THREE.Mesh(geom, mat);
        cage.position.set(wx, 0.46, wz);
        cage.scale.set(0.01, 0.01, 0.01);
        this.scene.add(cage);
        this._scaffolds.push({ mesh: cage, elapsed: 0, duration: 2500 });
    }

    _updateScaffolding(dt) {
        if (!this._scaffolds) return;
        for (let i = this._scaffolds.length - 1; i >= 0; i--) {
            const s = this._scaffolds[i];
            s.elapsed += dt;
            const t = Math.min(1, s.elapsed / s.duration);
            // Grow up quickly, then hold, then fade out
            const scaleT = Math.min(1, t * 5); // reaches full scale in first 20% of duration
            s.mesh.scale.setScalar(scaleT);
            // Fade out in last 40%
            const fadeT = Math.max(0, (t - 0.6) / 0.4);
            s.mesh.material.opacity = 0.7 * (1 - fadeT);
            if (t >= 1) {
                this.scene.remove(s.mesh);
                s.mesh.geometry.dispose();
                s.mesh.material.dispose();
                this._scaffolds.splice(i, 1);
            }
        }
    }

    _updateSpawnFlashes(dt) {
        for (let i = this._spawnFlashes.length - 1; i >= 0; i--) {
            const f = this._spawnFlashes[i];
            f.elapsed += dt;
            const t = Math.min(1, f.elapsed / f.duration);
            // Scale up quickly then shrink (bounce)
            const scale = t < 0.5
                ? (t / 0.5) * 1.15
                : 1.15 - ((t - 0.5) / 0.5) * 1.15;
            f.mesh.scale.setScalar(scale);
            f.mesh.material.opacity = 0.85 * (1 - t * t);
            if (t >= 1) {
                this.scene.remove(f.mesh);
                f.mesh.geometry.dispose();
                f.mesh.material.dispose();
                this._spawnFlashes.splice(i, 1);
            }
        }
    }

    // -----------------------------------------------------------------------
    // Cinematic Camera (1B)
    // -----------------------------------------------------------------------

    _setupCinematicListeners() {
        eventBus.on(EVENT_TYPES.CRISIS_STARTED, (data) => {
            const wx = (data.x != null) ? (data.x - this._mapHalfW + 0.5) : 0;
            const wz = (data.y != null) ? (data.y - this._mapHalfH + 0.5) : 0;
            this.startCinematic(wx, wz, 3500, 1500);
        });
        eventBus.on(EVENT_TYPES.INCIDENT_CREATED, (data) => {
            const wx = (data.x != null) ? (data.x - this._mapHalfW + 0.5) : null;
            const wz = (data.y != null) ? (data.y - this._mapHalfH + 0.5) : null;
            if (wx != null) this.startCinematic(wx, wz, 2500, 1000);
        });
    }

    /**
     * Smoothly pan+zoom camera to look at a world-space point.
     * @param {number} wx - World X
     * @param {number} wz - World Z
     * @param {number} duration - Travel time in ms
     * @param {number} holdMs - How long to hold at target before auto-returning
     */
    startCinematic(wx, wz, duration = 3000, holdMs = 1500) {
        const cin = this._cinematic;
        cin.active = true;
        cin.returning = false;
        cin.elapsed = 0;
        cin.duration = duration;
        cin.returnDelay = holdMs;
        cin.startPos.copy(this.camera.position);
        cin.startLook.set(
            this.camera.position.x + Math.sin(this.yaw) * 5,
            this.camera.position.y - 2,
            this.camera.position.z + Math.cos(this.yaw) * 5
        );
        // Target: elevated position above the crisis point, angled down
        cin.targetPos.set(wx - Math.sin(this.yaw) * 14, 18, wz - Math.cos(this.yaw) * 14);
        cin.targetLook.set(wx, 0, wz);
    }

    _updateCinematic(dt) {
        const cin = this._cinematic;
        if (!cin.active) return false;
        cin.elapsed += dt;

        if (!cin.returning) {
            const raw = Math.min(1, cin.elapsed / cin.duration);
            const t = raw * raw * (3 - 2 * raw); // smoothstep
            this.camera.position.lerpVectors(cin.startPos, cin.targetPos, t);
            const lookAt = new THREE.Vector3().lerpVectors(cin.startLook, cin.targetLook, t);
            this.camera.lookAt(lookAt);
            if (raw >= 1) {
                // Hold phase
                if (cin.elapsed >= cin.duration + cin.returnDelay) {
                    cin.returning = true;
                    cin.elapsed = 0;
                    cin.startPos.copy(this.camera.position);
                    cin.startLook.copy(cin.targetLook);
                }
            }
        } else {
            // Return to player: just fade cinematic out over 1s
            const t = Math.min(1, cin.elapsed / 1000);
            if (t >= 1) {
                cin.active = false;
                cin.returning = false;
            }
            // Blend weight: lerp toward zero cinematic influence
            // Actual position handled by normal updateCamera with extra lerp weight
            this._cinematicReturnT = 1 - t;
        }
        return true;
    }

    // Set camera mode with smooth transition
    setCameraMode(mode) {
        if (mode === this.cameraMode) return;
        
        this.cameraMode = mode;
        this.cameraModeTarget = (mode === 'god') ? 1 : 0;
        
        // Update mode indicator UI if available
        if (this.game.ui && this.game.ui.modeIndicator) {
            this.game.ui.modeIndicator.setMode(mode);
        }
    }

    // Trigger camera shake
    shakeCamera(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeDecay = 1.0;
    }

    render() {
        const now = performance.now();
        const dt = this._lastRenderTime ? Math.min(50, now - this._lastRenderTime) : 16.67;
        this._lastRenderTime = now;
        if (this.fpsElement && this.fpsTimes !== undefined) {
            this.fpsTimes.push(now);
            while (this.fpsTimes.length > 60) this.fpsTimes.shift();
            if (this.fpsTimes.length >= 2) {
                const fps = Math.round(1000 / ((now - this.fpsTimes[0]) / (this.fpsTimes.length - 1)));
                this.fpsElement.textContent = `FPS: ${fps}`;
            }
        }

        // Update day/night cycle lighting
        this._updateDayNightLighting();

        if (this._citizensDirty) this.rebuildCitizens();
        else this.updateCitizens();

        this.syncPlayer();
        this.updateCamera(dt);
        this.syncChunkStreaming();
        if (this._debugMode === 'services') {
            this.updateDebugOverlay();
        }
        if (this._zoneMode !== 'none') {
            this.updateZoneOverlay();
        }
        
        // Sync fog density from weather system (6B)
        const wfx = this.game?.weatherSystem?.currentEffects;
        if (this.scene.fog && wfx) {
            this.scene.fog.density = wfx.fogDensity ?? 0.0001;
            if (wfx.ambientColor != null) {
                this.scene.background.setHex(wfx.ambientColor);
                this.scene.fog.color.setHex(wfx.ambientColor);
            }
        }

        // Update VFX systems
        this.updateVFX();
        if (this.fxSystem) {
            this.fxSystem.update();
        }
        
        // Update building spawn flashes (1D)
        if (this._spawnFlashes?.length) this._updateSpawnFlashes(dt);

        // Update construction scaffolding (6B)
        if (this._scaffolds?.length) this._updateScaffolding(dt);

        // Update build ghost animation
        this._updateBuildGhostAnim();
        
        // Update hover highlight pulse animation
        if (this._hoverHighlight && this._hoveredTile) {
            const pulseTime = (performance.now() / 500) % (Math.PI * 2);
            const pulseScale = 1 + Math.sin(pulseTime) * 0.15;
            this._hoverHighlight.scale.set(pulseScale, pulseScale, pulseScale);
        }
        
        // Update particle system
        if (this.particleSystem) {
            this.particleSystem.update();
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Update lighting based on day/night cycle
     */
    _updateDayNightLighting() {
        if (!this.dayNightCycle || !this.game?.state?.time) return;
        
        const timeOfDay = this.game.state.time.timeOfDay || 0;
        
        // Update lighting manager with current time
        const lighting = this.lightingManager.update(timeOfDay);
        
        // Apply lighting to scene lights
        this.lightingManager.applyToScene(this.ambientLight, this.sunLight);
        
        // Apply tint effect to ambient light for color grading
        const grading = this.lightingManager.getColorGrading();
        if (grading && this.ambientLight) {
            // Blend tint color with ambient based on tint strength
            const tintColor = new THREE.Color(grading.tint);
            const blendFactor = grading.tintStrength;
            this.ambientLight.color.lerp(tintColor, blendFactor * 0.3); // Subtle tint effect
        }
        
        // Store current phase for debugging
        this.currentPhase = lighting.phase;
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
     * Set debug overlay mode
     * @param {string} mode - 'none', 'districts', 'roads', 'parcels', 'pois', 'nav', 'services'
     */
    setDebugMode(mode) {
        this._debugMode = mode;
        this.updateDebugOverlay();
    }

    /**
     * Update debug overlay based on current mode
     */
    updateDebugOverlay() {
        if (this._debugOverlayMesh) {
            this.scene.remove(this._debugOverlayMesh);
            this._debugOverlayMesh.geometry.dispose();
            this._debugOverlayMesh = null;
        }

        if (this._debugMode === 'none') return;

        const map = this.game.map;
        const width = map.width;
        const height = map.height;
        const count = width * height;

        const geom = new THREE.BoxGeometry(1, 0.05, 1);
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3 });
        this._debugOverlayMesh = new THREE.InstancedMesh(geom, mat, count);
        this._debugOverlayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();
        const center = new THREE.Vector3();

        let i = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const wx = x - this._mapHalfW + 0.5;
                const wz = y - this._mapHalfH + 0.5;
                const idx = y * width + x;

                let colorHex = 0x000000;

                switch (this._debugMode) {
                    case 'districts':
                        if (map.districtMap && map.districtMap[idx] !== 255) {
                            const districtId = map.districtMap[idx];
                            const district = map.districts.find(d => d.id === districtId);
                            if (district) {
                                // Color by district theme
                                const themeColors = {
                                    residential: 0xffcc80,
                                    commercial: 0xe0f7fa,
                                    industrial: 0xcfd8dc,
                                    waterfront: 0x81d4fa,
                                    elite: 0xffd700
                                };
                                colorHex = themeColors[district.theme] || 0x888888;
                            }
                        }
                        break;

                    case 'roads':
                        if (map.roadMap && map.roadMap[idx] === 1) {
                            colorHex = 0x888888; // Road
                        } else if (map.sidewalkMap && map.sidewalkMap[idx] === 1) {
                            colorHex = 0xcccccc; // Sidewalk
                        }
                        break;

                    case 'parcels':
                        if (map.parcelMap && map.parcelMap[idx] !== 65535) {
                            const parcelId = map.parcelMap[idx];
                            // Color by zone type
                            const parcel = map.parcels.find(p => p.id === parcelId);
                            if (parcel) {
                                const zoneColors = {
                                    residential: 0xffcc80,
                                    commercial: 0xe0f7fa,
                                    industrial: 0xcfd8dc,
                                    park: 0x81c784
                                };
                                colorHex = zoneColors[parcel.zoneType] || 0x888888;
                            }
                        }
                        break;

                    case 'pois':
                        const poi = map.pois ? map.pois.find(p => {
                            const w = p.size?.width || 1;
                            const h = p.size?.height || 1;
                            return x >= p.x && x < p.x + w && y >= p.y && y < p.y + h;
                        }) : null;
                        if (poi) {
                            const typeColors = {
                                landmark: 0xff0000,
                                hack_node: 0x00ff00,
                                safehouse: 0x0000ff,
                                camera_tower: 0xffff00,
                                terminal_hub: 0xff00ff
                            };
                            colorHex = typeColors[poi.type] || 0xffffff;
                        }
                        break;

                    case 'nav': {
                        const px = this.game.player?.x ?? 0;
                        const py = this.game.player?.y ?? 0;
                        if (Math.abs(x - px) <= 24 && Math.abs(y - py) <= 24) {
                            const walkable = this.game.scheduleManager?.isWalkable(x, y);
                            colorHex = walkable ? 0x4caf50 : 0xe53935;
                        }
                        break;
                    }

                    case 'services': {
                        const service = this.game.servicesManager?.getOverlayService?.() || 'power';
                        const q = this.game.servicesManager?.getTileCoverage?.(x, y, service) || 0;
                        if (q > 0.01) {
                            const r = Math.floor((1 - q) * 255);
                            const g = Math.floor(q * 255);
                            colorHex = (r << 16) | (g << 8) | 0x22;
                        } else {
                            colorHex = 0x991b1b;
                        }
                        break;
                    }
                }

                if (colorHex !== 0x000000) {
                    dummy.position.set(wx, 0, wz);
                    dummy.scale.set(1, 1, 1);
                    dummy.updateMatrix();
                    this._debugOverlayMesh.setMatrixAt(i, dummy.matrix);

                    color.setHex(colorHex);
                    this._debugOverlayMesh.setColorAt(i, color);
                    i++;
                }
            }
        }

        if (i > 0) {
            this._debugOverlayMesh.instanceColor.needsUpdate = true;
            this._debugOverlayMesh.count = i;
            this.scene.add(this._debugOverlayMesh);
        }
    }

    /**
     * Set zone overlay mode
     * @param {string} mode - 'none', 'zones', 'zoned'
     */
    setZoneMode(mode) {
        this._zoneMode = mode;
        this.updateZoneOverlay();
    }

    /**
     * Update zone overlay based on current mode
     */
    updateZoneOverlay() {
        if (this._zoneOverlayMesh) {
            this.scene.remove(this._zoneOverlayMesh);
            this._zoneOverlayMesh.geometry.dispose();
            this._zoneOverlayMesh = null;
        }

        if (this._zoneMode === 'none' || !this.game.zoningManager) return;

        const map = this.game.map;
        const width = map.width;
        const height = map.height;
        const count = width * height;

        const geom = new THREE.BoxGeometry(1, 0.05, 1);
        const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 });
        this._zoneOverlayMesh = new THREE.InstancedMesh(geom, mat, count);
        this._zoneOverlayMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        const dummy = new THREE.Object3D();
        const color = new THREE.Color();

        let i = 0;

        // Zone colors
        const zoneColors = {
            0: 0x333333, // NONE - dark gray
            1: 0xffcc80, // RESIDENTIAL - light orange
            2: 0xe0f7fa, // COMMERCIAL - light cyan
            3: 0xcfd8dc  // INDUSTRIAL - light gray
        };

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const wx = x - this._mapHalfW + 0.5;
                const wz = y - this._mapHalfH + 0.5;
                const idx = y * width + x;

                let zoneType = this.game.zoningManager.getZone(x, y);

                // For 'zoned' mode, only show tiles with zones
                if (this._zoneMode === 'zoned' && zoneType === 0) continue;

                const colorHex = zoneColors[zoneType] || 0x333333;

                dummy.position.set(wx, 0, wz);
                dummy.scale.set(1, 1, 1);
                dummy.updateMatrix();
                this._zoneOverlayMesh.setMatrixAt(i, dummy.matrix);

                color.setHex(colorHex);
                this._zoneOverlayMesh.setColorAt(i, color);
                i++;
            }
        }

        if (i > 0) {
            this._zoneOverlayMesh.instanceColor.needsUpdate = true;
            this._zoneOverlayMesh.count = i;
            this.scene.add(this._zoneOverlayMesh);
        }
    }

    /**
     * Get nearest POI distance for debug display
     */
    getNearestPOIDistance() {
        const p = this.game.player;
        const x = p.x || 0;
        const y = p.y || 0;
        if (!this.game.map.pois || this.game.map.pois.length === 0) return -1;

        let minDist = Infinity;
        for (const poi of this.game.map.pois) {
            const dx = poi.x - x;
            const dy = poi.y - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) minDist = dist;
        }
        return minDist === Infinity ? -1 : Math.round(minDist);
    }

    getPerfStats() {
        let terrainInstances = 0;
        let buildingInstances = 0;
        let visibleChunks = 0;

        for (const entry of this._chunkMeshes.values()) {
            terrainInstances += entry.terrainCount;
            buildingInstances += entry.buildingCount;
            if (entry.group.visible) visibleChunks++;
        }

        return {
            terrainInstances,
            buildingInstances,
            citizenInstances: this.game.citizens.citizens.length,
            activeChunks: this.game.chunks?.getActiveChunkCount?.() ?? 0,
            visibleChunks,
            drawCalls: this.renderer?.info?.render?.calls ?? 0,
        };
    }

    setBuildGhost(type, x, y, rotation = 0, ok = true) {
        const h = (BUILDING_3D[type]?.height ?? 0.6);
        if (!this._buildGhost || this._buildGhostType !== type) {
            if (this._buildGhost) {
                this.scene.remove(this._buildGhost);
                this._buildGhost.geometry.dispose();
                this._buildGhost.material.dispose();
            }
            const geom = new THREE.BoxGeometry(0.85, h, 0.85);
            const mat = new THREE.MeshLambertMaterial({
                color: ok ? 0x3ecf8e : 0xe25555,
                transparent: true,
                opacity: 0.45,
                depthWrite: false,
            });
            this._buildGhost = new THREE.Mesh(geom, mat);
            this._buildGhostType = type;
            this.scene.add(this._buildGhost);
            
            // Initialize animation state
            this._buildGhostAnim = {
                targetPos: new THREE.Vector3(),
                targetScale: new THREE.Vector3(1, 1, 1),
                currentScale: new THREE.Vector3(0, 0, 0),
                progress: 0,
                active: false
            };
        }
        
        const wx = x - this._mapHalfW + 0.5;
        const wz = y - this._mapHalfH + 0.5;
        
        // Set target position
        this._buildGhost.position.set(wx, h / 2, wz);
        this._buildGhostAnim.targetPos.set(wx, h / 2, wz);
        
        // Set rotation
        this._buildGhost.rotation.y = ((rotation % 4) + 4) % 4 * (Math.PI / 2);
        
        // Update color
        this._buildGhost.material.color.setHex(ok ? 0x3ecf8e : 0xe25555);
        
        // Trigger snap animation if ghost was not visible
        if (!this._buildGhost.visible) {
            this._buildGhostAnim.currentScale.set(0, 0, 0);
            this._buildGhostAnim.targetScale.set(1, 1, 1);
            this._buildGhostAnim.progress = 0;
            this._buildGhostAnim.active = true;
        }
        
        this._buildGhost.visible = true;
    }

    clearBuildGhost() {
        if (!this._buildGhost) return;
        this._buildGhost.visible = false;
        this._buildGhostAnim = null;
    }
    
    // Create hover highlight ring mesh
    _createHoverHighlight() {
        const geom = new THREE.RingGeometry(0.45, 0.55, 16);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        this._hoverHighlight = new THREE.Mesh(geom, mat);
        this._hoverHighlight.rotation.x = -Math.PI / 2;
        this.scene.add(this._hoverHighlight);
    }
    
    // Set hovered tile for building highlight feedback
    setHoveredTile(tile) {
        if (!tile) {
            this._hoveredTile = null;
            if (this._hoverHighlight) {
                this._hoverHighlight.material.opacity = 0;
            }
            return;
        }
        
        // Check if there's a building at this tile
        const building = this.game.buildings.buildings.find(b => b.x === tile.x && b.y === tile.y);
        if (!building) {
            this._hoveredTile = null;
            if (this._hoverHighlight) {
                this._hoverHighlight.material.opacity = 0;
            }
            return;
        }
        
        this._hoveredTile = tile;
        if (this._hoverHighlight) {
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;
            this._hoverHighlight.position.set(wx, 0.05, wz);
            this._hoverHighlight.material.opacity = 0.8;
        }
    }
    
    // Update build ghost snap animation
    _updateBuildGhostAnim() {
        if (!this._buildGhost || !this._buildGhostAnim || !this._buildGhostAnim.active) return;
        
        const anim = this._buildGhostAnim;
        
        // Ease-in-out cubic function for smooth snap
        const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
        // Update animation progress
        anim.progress += 0.15; // Animation speed
        if (anim.progress >= 1) {
            anim.progress = 1;
            anim.active = false;
        }
        
        // Apply eased scale
        const easedProgress = easeInOutCubic(anim.progress);
        const targetScale = anim.targetScale;
        this._buildGhost.scale.set(
            targetScale.x * easedProgress,
            targetScale.y * easedProgress,
            targetScale.z * easedProgress
        );
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
        const existing = this._vfxRings.find((r) => r.x === x && r.y === y);
        if (existing?.mesh) {
            this._vfxRingGroup.remove(existing.mesh);
            existing.mesh.geometry?.dispose?.();
            existing.mesh.material?.dispose?.();
            this._vfxRings = this._vfxRings.filter((r) => r !== existing);
        }

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

        this._vfxRings.push({ x, y, mesh: ringMesh, progress: progress || 0 });
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
        const removed = this._vfxRings.filter((r) => r.x === x && r.y === y);
        for (const ring of removed) {
            this._vfxRingGroup.remove(ring.mesh);
            ring.mesh.geometry?.dispose?.();
            ring.mesh.material?.dispose?.();
        }
        this._vfxRings = this._vfxRings.filter((r) => r.x !== x || r.y !== y);

        const color = success ? '#4caf50' : '#f44336';
        const text = success ? 'Success!' : 'Failed';
        this.showFloatingText(x, y, text, color, 2000);

        // Simple particle burst
        this.showParticleBurst(x, y, color, 10);
    }

    setCameraHackView(x, y, durationTicks = 8) {
        const start = this.game.state.time.tick || 0;
        this._cameraHack = {
            x,
            y,
            untilTick: start + Math.max(1, durationTicks),
        };
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
