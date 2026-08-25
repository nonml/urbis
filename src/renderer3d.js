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
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN, TERRAIN_ROAD, TERRAIN_SIDEWALK, TERRAIN_PARK, TERRAIN_HIGHWAY, TERRAIN_BRIDGE, TERRAIN_TUNNEL, TERRAIN_COLORS, BUILDING_TYPES, BUILDING_3D } from './constants.js';
import { eventBus, EVENT_TYPES } from './sim/events.js';
import { ZONE_TYPES } from './sim/zoning/zoning.js';
import { createDayNightCycle, DAY_PHASES } from './sim/day_night.js';
import { createLightingManager, LIGHTING_PRESETS } from './render/lighting/day_night.js';
import { PRESETS, DEFAULT_PRESET, applyPreset } from './render/presets.js';
import { GIProbeGrid } from './render/gi_probe_grid.js';
import { cullChunkChildren, cullByPosition } from './render/frustum_culler.js';
import { HiZBuffer } from './render/hi_z_buffer.js';
import { LOD_DIST, createVehicleLOD, createChunkImposter, buildChunkLOD1Proxies } from './render/lod_system.js';
import { VEHICLE_TYPES } from './vehicles/vehicle_state.js';
import { createFXSystem } from './render/fx/fx_system.js';
import { createVFXTriggerManager, setVFXTriggerManager } from './render/fx/vfx_triggers.js';
import { createParticleSystem } from './world/particle_pool.js';
import { CharacterPool } from './render/character_pool.js';
import { RenderGraph } from './render/graph/render_graph.js';
import { createCSM, updateCSM } from './render/graph/csm.js';
import { createSkyDome, updateSkyDomeForPhase } from './render/graph/sky.js';

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
        this._THREE = THREE; // expose for external consumers (action_hud profiler)
        this.testMode = navigator.webdriver || new URLSearchParams(window.location.search).has('testMode');

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x4a8ab5);
        this.scene.fog = new THREE.FogExp2(0x7ab0d0, 0.006);
        this._createSkyDome();

        // Camera rig (Ticket B-2: Orbit + Follow + Collision)
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
        this.yaw = 0;
        this.pitch = -0.4;
        this.followDist = 8;
        this.targetFollowDist = 8;
        this.followHeight = 4;
        this.minFollowDist = 4;
        this.maxFollowDist = 50;
        this.mouseSensitivity = 0.005;
        this.invertY = false;
        this.cameraCollision = true;
        this.cameraCollisionRadius = 1.0;
        this.zoomSensitivity = 0.1;
        this.zoomDampening = 0.15;

        // LOD thresholds (world units from camera to chunk center)
        // Full detail below LOD_FULL_DIST; terrain-only between FULL and TERRAIN_ONLY; hidden beyond FAR.
        this.LOD_FULL_DIST = 60;
        this.LOD_TERRAIN_ONLY_DIST = 150;
        
        // Camera mode settings (God vs Street)
        this.cameraMode = 'god'; // 'street' or 'god'
        this.cameraModeTransition = 1; // 0 = street, 1 = god
        this.cameraModeTarget = 0; // target for smooth transition
        this.cameraModeTransitionTimer = 0; // for 400ms transition
        
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
            pitch: -1.0,
            followDist: 25,
            followHeight: 20,
            fov: 45,
            yawSpeed: 0.003,
            pitchSpeed: 0.003
        };
        this.vehicleCamera = {
            pitch: -0.25,
            followDist: 6,
            followHeight: 2.5,
            fov: 70,
            yawSpeed: 0.004,
            pitchSpeed: 0.003,
            maxSpeedFOV: 85, // FOV at max vehicle speed
        };
        this._vehicleCamYaw = 0; // smooth yaw that tracks vehicle heading

        // Camera shake system with severity levels
        this.shakeIntensity = 0;
        this.shakeDuration = 0;
        this.shakeDecay = 1.0;
        this.shakeOffset = new THREE.Vector3(0, 0, 0);
        this.shakeSeverity = 'none'; // 'none', 'light', 'medium', 'heavy', 'extreme'
        
        // Shake severity configuration
        this.shakeConfig = {
            light: { intensity: 0.5, decay: 0.985, durationScale: 1.0 },
            medium: { intensity: 1.5, decay: 0.975, durationScale: 1.2 },
            heavy: { intensity: 3.0, decay: 0.96, durationScale: 1.5 },
            extreme: { intensity: 6.0, decay: 0.94, durationScale: 2.0 }
        };

        // Citizen animation
        this._citizenAnimTimes = [];
        
        // Building hover feedback
        this._hoveredTile = null;
        this._hoverHighlight = null;

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: false });
        this.renderer.setPixelRatio(this.testMode ? 1 : Math.min(1.5, window.devicePixelRatio || 1));
        this.renderer.shadowMap.enabled = !this.testMode;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.3;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderScale = 1.0;
        this._preset = DEFAULT_PRESET;
        this._drsMinScale = 0.70;
        this._drsBudget = 16.6;
        this._drsOver = 0;
        this._drsUnder = 0;
        this._drsEnabled = true;
        // Auto-detect: measure first-frame timing to pick appropriate preset
        this._detectPreset().then((detected) => {
            if (detected && detected !== DEFAULT_PRESET) {
                this._preset = detected;
                applyPreset(this, detected);
            }
        });
        this.setRenderScale(1.0);
        this._initVRS();

        // Lighting — hemisphere light for natural sky/ground fill.
        // Base intensity is modulated by time of day so night actually goes dark.
        this._hemiBaseIntensity = 1.1;
        this.hemiLight = new THREE.HemisphereLight(0xb8e4ff, 0x6aaa60, this._hemiBaseIntensity);
        this.scene.add(this.hemiLight);

        this.ambientLight = new THREE.AmbientLight(0xfff8f0, 0.55);
        this.scene.add(this.ambientLight);

        // Primary sun light — tighter frustum for sharper nearby shadows
        this.sunLight = new THREE.DirectionalLight(0xfffbe0, 1.8);
        this.sunLight.position.set(30, 50, 20);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 1024;
        this.sunLight.shadow.mapSize.height = 1024;
        this.sunLight.shadow.camera.near = 1;
        this.sunLight.shadow.camera.far = 150;
        this.sunLight.shadow.camera.left = -50;
        this.sunLight.shadow.camera.right = 50;
        this.sunLight.shadow.camera.top = 50;
        this.sunLight.shadow.camera.bottom = -50;
        this.sunLight.shadow.bias = -0.0005;
        this.sunLight.shadow.normalBias = 0.03;
        this.scene.add(this.sunLight);

        // Secondary distant sun — wider fill light, no shadow (perf)
        this.sunLightFar = new THREE.DirectionalLight(0xfff4e0, 0.4);
        this.sunLightFar.position.set(30, 40, 20);
        this.sunLightFar.castShadow = false;
        this.sunLightFar.shadow.mapSize.width = 512;
        this.sunLightFar.shadow.mapSize.height = 512;
        this.sunLightFar.shadow.camera.near = 1;
        this.sunLightFar.shadow.camera.far = 200;
        this.sunLightFar.shadow.camera.left = -80;
        this.sunLightFar.shadow.camera.right = 80;
        this.sunLightFar.shadow.camera.top = 80;
        this.sunLightFar.shadow.camera.bottom = -80;
        this.sunLightFar.shadow.bias = -0.003;
        this.sunLightFar.shadow.normalBias = 0.08;
        this.scene.add(this.sunLightFar);
        this._setupCSM();

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

        // Post-processing composer (initialized async in _initPostProcessing)
        this.composer = null;
        this._sky = null;
        this._sunPosition = new THREE.Vector3();
        // Reusable vectors for per-frame camera math (avoid GC pressure)
        this._camIdeal = new THREE.Vector3();
        this._camPlayerPos = new THREE.Vector3();
        this._camRayDir = new THREE.Vector3();
        this._camCheckPos = new THREE.Vector3();
        this._camRaycaster = new THREE.Raycaster();

        // Internal
        this._mapHalfW = 0;
        this._mapHalfH = 0;
        this._raycaster = new THREE.Raycaster();
        this._mouseNDC = new THREE.Vector2();

        this._chunkMeshes = new Map(); // chunkId -> { group, center, radius, terrainCount, buildingCount }
        this._decalManager = null;
        this._presetConfig = null;
        this._citizensMesh = null;
        this._player = null;
        this._buildGhost = null;
        this._buildGhostType = null;
        this._frustum = new THREE.Frustum();
        this._projScreenMatrix = new THREE.Matrix4();
        this._hiZBuffer = new HiZBuffer(); // Q11.B: depth RT + mip-pyramid scaffold

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
        this._windowTexture = null; // lazy-created canvas texture for window glow

        // Vegetation model library: modelName -> THREE.Group
        this._vegetationModels = new Map();
        // Road model library: modelName -> THREE.Group
        this._roadModels = new Map();
        // Street prop model library: propName -> THREE.Group
        this._propModels = new Map();
        // Urban detail models: detailName -> THREE.Group (awnings, parasols, fences)
        this._detailModels = new Map();
        this._bridgeModels = new Map();  // road-bridge, bridge-pillar
        this._transitModels = new Map(); // bus, metro entrance geometry

        // Vehicle GLTF model library: vehicleType -> THREE.Group
        this._vehicleModels = new Map();
        // Vehicle mesh group (updated every frame from vehicleSystem)
        this._vehicleGroup = new THREE.Group();
        this.scene.add(this._vehicleGroup);

        // Police unit meshes
        this._policeGroup = new THREE.Group();
        this.scene.add(this._policeGroup);

        // Weather FX: rain particles (GPU)
        this._rainGroup = null;
        this._lightningTimer = 0;
        this._lightningFlash = 0;

        // Terrain texture library: terrainType -> THREE.Texture (loaded async)
        this._terrainTextures = new Map();

        // Debug overlays
        this._debugMode = 'none'; // 'none', 'districts', 'roads', 'parcels', 'pois', 'nav', 'services'
        this._debugOverlayMesh = null;
        this._cameraHack = null;

        // Zone overlay
        this._zoneOverlayMesh = null;
        this._zoneMode = 'none'; // 'none', 'zones', 'zoned'

        // Interior scene swap
        this._interiorGroup = new THREE.Group();
        this._interiorGroup.visible = false;
        this._outdoorChildrenHidden = false;
        this._outdoorVisibility = new Map();

        this._groundPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshBasicMaterial({ visible: false })
        );
        this._groundPlane.rotation.x = -Math.PI / 2;
        this._groundPlane.position.y = 0.12; // Match terrain surface for raycasting
        this.scene.add(this._groundPlane);

        // Visible ground beneath terrain — prevents seeing black void
        const visibleGround = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshStandardMaterial({ color: 0x3d5c3a, roughness: 1.0 })
        );
        visibleGround.rotation.x = -Math.PI / 2;
        visibleGround.position.y = -0.3;
        visibleGround.receiveShadow = true;
        this.scene.add(visibleGround);

        this.rebuildWorld();
        this.resize();
        window.addEventListener('resize', () => this.resize());
        window.addEventListener('wheel', (e) => this.handleWheel(e));

        // Init sky + post-processing (skipped in test mode to save CPU)
        if (!this.testMode) this._initPostProcessing();
        // Async: load Kenney GLB models + terrain textures, then rebuild once ready
        this._preloadAssets();
    }

    _createSkyDome() {
        const dome = createSkyDome(THREE);
        this._skyDome = dome;
        this.scene.add(dome);
    }

    _setupCSM() {
        const { lights, cams } = createCSM(THREE, this.scene, this.sunLight);
        this._csmLights = lights;
        this._csmCameras = cams;
        this._csm = { lights, cams };
    }

    _updateCSM() {
        if (!this._csmLights || this._csmLights.length === 0) return;
        updateCSM(this._csm, this.camera, this.sunLight);
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const w = rect.width || window.innerWidth;
        const h = rect.height || window.innerHeight;
        if (w === 0 || h === 0) return;
        this.renderer.setSize(w, h, true);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        if (this.composer) {
            this.composer.setSize(w, h);
        }
        if (this._fxaaPass) {
            this._fxaaPass.material.uniforms['resolution'].value.set(1 / w, 1 / h);
        }
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

        // Realtime GI probe grid (Q10.G) — one per world, sized to the map.
        this._gi = new GIProbeGrid(this.game.map.width, this.game.map.height, 4);
        // District theme lookup for per-district GI mood tints (Q10.H).
        this._districtThemes = new Map((this.game.map.districts || []).map((d) => [d.id, d.theme]));

        // Projected decal system (Q10)
        this._initDecalManager();

        // Chunked terrain + buildings
        this._buildingsDirty = true;
        this.syncChunkStreaming(true);

        // Shared planar-reflection mirror for water (Q10.D)
        this._buildWaterReflector().catch(() => {});

        // Ambient boats + wake on the harbor (Q10.D)
        this._buildAmbientBoats();

        // Citizens
        this._citizensDirty = true;
        this.rebuildCitizens();

        // Detailed character pool (LOD: articulated humanoids for nearby citizens)
        this._characterPool = new CharacterPool(THREE, this.scene, this.game);
        this._characterPool.groundHeightAt = (wx, wz) => this._elevAtWorld(wx, wz);
        this._detailedCitizenSet = new Set();
        this._lastFrameTime = performance.now() / 1000;

        // Try loading rigged GLTF character (Soldier model with Walk/Idle animations)
        this._characterPool.useGLTFModel('assets/models/characters/Soldier.glb').catch(() => {
            console.log('[Renderer] GLTF character not found, using procedural humanoids');
        });

        // Player + sky hidden in god mode (default start mode)
        this._player = this.buildPlayer();
        this._player.visible = (this.cameraMode !== 'god');
        if (this._sky) this._sky.visible = (this.cameraMode !== 'god');
        this.scene.add(this._player);
        this.syncPlayer();

        // Update debug overlay
        this.updateDebugOverlay();
    }

    // -----------------------------------------------------------------------
    // Kenney GLB model loader
    // -----------------------------------------------------------------------
    /** Road model paths — keyed by connectivity bitmask (N=1,E=2,S=4,W=8) */
    static ROAD_MODEL_MAP = {
        'road-straight':    'assets/models/kenney_roads/road-straight.glb',
        'road-bend':        'assets/models/kenney_roads/road-bend.glb',
        'road-intersection':'assets/models/kenney_roads/road-intersection.glb',
        'road-crossroad':   'assets/models/kenney_roads/road-crossroad.glb',
        'road-end':         'assets/models/kenney_roads/road-end.glb',
    };

    /** Street prop model paths */
    static PROP_MODEL_MAP = {
        'light-square':       'assets/models/kenney_roads/light-square.glb',
        'light-curved':       'assets/models/kenney_roads/light-curved.glb',
        'construction-cone':  'assets/models/kenney_roads/construction-cone.glb',
        'construction-barrier':'assets/models/kenney_roads/construction-barrier.glb',
        'construction-light': 'assets/models/kenney_roads/construction-light.glb',
        'sign-highway':       'assets/models/kenney_roads/sign-highway.glb',
        'sign-highway-wide':  'assets/models/kenney_roads/sign-highway-wide.glb',
        'bridge-pillar':      'assets/models/kenney_roads/bridge-pillar.glb',
    };

    /** Urban detail prop model paths — scattered near commercial buildings */
    static DETAIL_MODEL_MAP = {
        'awning':             'assets/models/kenney_commercial/detail-awning.glb',
        'awning-wide':        'assets/models/kenney_commercial/detail-awning-wide.glb',
        'overhang':           'assets/models/kenney_commercial/detail-overhang.glb',
        'parasol-a':          'assets/models/kenney_commercial/detail-parasol-a.glb',
        'parasol-b':          'assets/models/kenney_commercial/detail-parasol-b.glb',
        'fence':              'assets/models/kenney_suburban/fence.glb',
        'fence-low':          'assets/models/kenney_suburban/fence-low.glb',
    };

    /** Vegetation model paths */
    static VEGETATION_MODEL_MAP = {
        'tree-large':  'assets/models/kenney_suburban/tree-large.glb',
        'tree-small':  'assets/models/kenney_suburban/tree-small.glb',
        'planter':     'assets/models/kenney_suburban/planter.glb',
    };

    /** Maps game building types → Kenney GLB asset paths (in public/) */
    static VEHICLE_MODEL_MAP = {
        'sedan':           'assets/models/kenney_vehicles/sedan.glb',
        'taxi':            'assets/models/kenney_vehicles/taxi.glb',
        'suv':             'assets/models/kenney_vehicles/suv.glb',
        'van':             'assets/models/kenney_vehicles/van.glb',
        'truck':           'assets/models/kenney_vehicles/truck.glb',
        'police':          'assets/models/kenney_vehicles/police.glb',
        'hatchback-sports':'assets/models/kenney_vehicles/hatchback-sports.glb',
        'delivery':        'assets/models/kenney_vehicles/delivery.glb',
        'firetruck':       'assets/models/kenney_vehicles/firetruck.glb',
        'garbage-truck':   'assets/models/kenney_vehicles/garbage-truck.glb',
    };

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
        // Extended building types
        'hospital':          'assets/models/kenney_commercial/building-f.glb',
        'fire-station':      'assets/models/kenney_commercial/building-g.glb',
        'stadium':           'assets/models/kenney_commercial/building-skyscraper-d.glb',
        'university':        'assets/models/kenney_commercial/building-h.glb',
        'research-lab':      'assets/models/kenney_commercial/building-i.glb',
        'airport':           'assets/models/kenney_commercial/building-skyscraper-b.glb',
        'port':              'assets/models/kenney_commercial/building-j.glb',
        'library':           'assets/models/kenney_commercial/building-k.glb',
        'shopping-mall':     'assets/models/kenney_commercial/building-skyscraper-c.glb',
        'apartment':         'assets/models/kenney_commercial/building-l.glb',
        'factory':           'assets/models/kenney_commercial/building-m.glb',
        'water-treatment':   'assets/models/kenney_commercial/building-n.glb',
        'nuclear-plant':     'assets/models/kenney_commercial/building-skyscraper-e.glb',
        'power-plant':       'assets/models/kenney_suburban/building-type-h.glb',
        'substation':        'assets/models/kenney_suburban/building-type-e.glb',
        // Extended types mapped to available commercial models (reuse existing)
        'hotel':             'assets/models/kenney_commercial/building-skyscraper-a.glb',
        'theater':           'assets/models/kenney_commercial/building-a.glb',
        'museum':            'assets/models/kenney_commercial/building-b.glb',
        'courthouse':        'assets/models/kenney_commercial/building-c.glb',
        'prison':            'assets/models/kenney_commercial/building-d.glb',
        'restaurant':        'assets/models/kenney_suburban/building-type-f.glb',
        'nightclub':         'assets/models/kenney_suburban/building-type-i.glb',
        'recycling-plant':   'assets/models/kenney_commercial/building-e.glb',
        'solar-farm':        'assets/models/kenney_commercial/low-detail-building-a.glb',
        'wind-farm':         'assets/models/kenney_commercial/low-detail-building-b.glb',
        // Transit / infrastructure (reuse suitable existing models)
        'bus-stop':          'assets/models/kenney_suburban/building-type-f.glb',
        'bus-depot':         'assets/models/kenney_commercial/building-d.glb',
        'metro-station':     'assets/models/kenney_commercial/building-b.glb',
        'tollway-gate':      'assets/models/kenney_suburban/building-type-d.glb',
        'highway-ramp':      'assets/models/kenney_commercial/low-detail-building-a.glb',
        'subway-shaft':      'assets/models/kenney_suburban/building-type-e.glb',
    };

    /** All 5 kenney_commercial skyscraper models — rotated through tall building types */
    static SKYSCRAPER_VARIANTS = [
        'assets/models/kenney_commercial/building-skyscraper-a.glb',
        'assets/models/kenney_commercial/building-skyscraper-b.glb',
        'assets/models/kenney_commercial/building-skyscraper-c.glb',
        'assets/models/kenney_commercial/building-skyscraper-d.glb',
        'assets/models/kenney_commercial/building-skyscraper-e.glb',
    ];

    /** Building types that cycle through all skyscraper variants */
    static SKYSCRAPER_TYPES = new Set([
        'apartment', 'hotel', 'town-hall', 'shopping-mall', 'stadium',
        'university', 'airport', 'nuclear-plant',
    ]);

    /** Building types that get procedural rooftop clutter (not homes/farms) */
    static ROOFTOP_DETAIL_TYPES = new Set([
        'market', 'shopping-mall', 'hotel', 'hospital', 'police-station',
        'fire-station', 'school', 'library', 'courthouse', 'museum', 'theater',
        'warehouse', 'factory', 'research-lab', 'university', 'town-hall',
        'apartment', 'power-plant', 'water-treatment', 'recycling-plant',
    ]);

    /** Variant models for 'house' type — all 21 kenney_suburban building types */
    static HOUSE_VARIANTS = [
        'assets/models/kenney_suburban/building-type-a.glb',
        'assets/models/kenney_suburban/building-type-b.glb',
        'assets/models/kenney_suburban/building-type-c.glb',
        'assets/models/kenney_suburban/building-type-d.glb',
        'assets/models/kenney_suburban/building-type-e.glb',
        'assets/models/kenney_suburban/building-type-f.glb',
        'assets/models/kenney_suburban/building-type-g.glb',
        'assets/models/kenney_suburban/building-type-h.glb',
        'assets/models/kenney_suburban/building-type-i.glb',
        'assets/models/kenney_suburban/building-type-j.glb',
        'assets/models/kenney_suburban/building-type-k.glb',
        'assets/models/kenney_suburban/building-type-l.glb',
        'assets/models/kenney_suburban/building-type-m.glb',
        'assets/models/kenney_suburban/building-type-n.glb',
        'assets/models/kenney_suburban/building-type-o.glb',
        'assets/models/kenney_suburban/building-type-p.glb',
        'assets/models/kenney_suburban/building-type-q.glb',
        'assets/models/kenney_suburban/building-type-r.glb',
        'assets/models/kenney_suburban/building-type-s.glb',
        'assets/models/kenney_suburban/building-type-t.glb',
        'assets/models/kenney_suburban/building-type-u.glb',
    ];

    /** Uniform scale per type so models fit inside a 1-unit tile */
    static MODEL_SCALE = {
        // Skyscrapers — tall iconic downtown buildings
        'town-hall':        1.5,
        'apartment':        1.45,
        'shopping-mall':    1.7,
        'hotel':            1.5,
        'stadium':          1.4,
        'university':       1.3,
        'airport':          1.5,
        'nuclear-plant':    1.3,
        // Mid-rise commercial
        'hospital':         1.0,
        'school':           0.9,
        'market':           0.95,
        'police-station':   0.9,
        'fire-station':     0.9,
        'research-lab':     1.05,
        'library':          0.9,
        'theater':          1.0,
        'museum':           1.05,
        'courthouse':       1.0,
        'prison':           0.95,
        // Industrial
        'warehouse':        0.85,
        'factory':          0.95,
        'lumber-mill':      0.8,
        // Transit / infrastructure
        'bus-stop':         0.60,
        'bus-depot':        0.88,
        'metro-station':    0.92,
        'tollway-gate':     0.58,
        'highway-ramp':     0.72,
        'subway-shaft':     0.68,
        // Default residential
        default:            0.72,
    };

    /** Map terrain type constant -> texture asset path */
    static get TERRAIN_TEXTURE_MAP() {
        // Returning null for all types — pure vertex colors give cleaner city-sim look
        return {};
    }

    /** Normal maps for terrain textures */
    static get TERRAIN_NORMAL_MAP() {
        return {};
    }

    async _preloadAssets() {
        const tl = new THREE.TextureLoader();
        this._terrainNormals = new Map();
        const loadTex = (terrainKey, url) => new Promise((resolve) => {
            tl.load(url, (tex) => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(1, 1);
                tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                this._terrainTextures.set(terrainKey, tex);
                resolve();
            }, undefined, () => resolve());
        });
        const loadNormal = (terrainKey, url) => new Promise((resolve) => {
            tl.load(url, (tex) => {
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(1, 1);
                tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
                this._terrainNormals.set(terrainKey, tex);
                resolve();
            }, undefined, () => resolve());
        });

        let GLTFLoader;
        try {
            const mod = await import('three/addons/loaders/GLTFLoader.js');
            GLTFLoader = mod.GLTFLoader;
        } catch {
            // three/addons not available — keep box fallback
        }

        const jobs = [
            ...Object.entries(Renderer3D.TERRAIN_TEXTURE_MAP)
                .filter(([, url]) => url != null)
                .map(([k, url]) => loadTex(Number(k), url)),
            ...Object.entries(Renderer3D.TERRAIN_NORMAL_MAP)
                .map(([k, url]) => loadNormal(Number(k), url)),
        ];

        if (GLTFLoader) {
            const silentManager = new THREE.LoadingManager();
            silentManager.onError = () => {};
            const loader = new GLTFLoader(silentManager);
            const loadBuilding = (type, url) => new Promise((resolve) => {
                loader.load(url, (gltf) => {
                    const root = gltf.scene;
                    const scale = Renderer3D.MODEL_SCALE[type] ?? Renderer3D.MODEL_SCALE.default;
                    root.scale.setScalar(scale);
                    const box = new THREE.Box3().setFromObject(root);
                    const center = box.getCenter(new THREE.Vector3());
                    root.position.x -= center.x;
                    root.position.z -= center.z;
                    root.position.y -= box.min.y;
                    this._enforcePBR(root);
                    this._gltfModels.set(type, root);
                    resolve();
                }, undefined, () => resolve());
            });
            const loadVehicle = (type, url) => new Promise((resolve) => {
                loader.load(url, (gltf) => {
                    const root = gltf.scene;
                    root.scale.setScalar(0.28); // cars fit in ~0.9 tiles
                    const box = new THREE.Box3().setFromObject(root);
                    const center = box.getCenter(new THREE.Vector3());
                    root.position.x -= center.x;
                    root.position.z -= center.z;
                    root.position.y -= box.min.y;
                    this._enforcePBR(root);
                    this._applyVehicleAtlas(root);
                    this._vehicleModels.set(type, root);
                    this._vehicleModelsDirty = true;
                    resolve();
                }, undefined, () => resolve());
            });
            for (const [type, url] of Object.entries(Renderer3D.MODEL_MAP)) {
                jobs.push(loadBuilding(type, url));
            }
            // Load house variants for visual diversity
            for (let i = 0; i < Renderer3D.HOUSE_VARIANTS.length; i++) {
                const url = Renderer3D.HOUSE_VARIANTS[i];
                const variantKey = `house-variant-${i}`;
                jobs.push(loadBuilding(variantKey, url));
            }
            // Load skyscraper variants at scale=1.0; scale applied per-type at placement
            for (let i = 0; i < Renderer3D.SKYSCRAPER_VARIANTS.length; i++) {
                const url = Renderer3D.SKYSCRAPER_VARIANTS[i];
                jobs.push(new Promise((resolve) => {
                    loader.load(url, (gltf) => {
                        const root = gltf.scene;
                        root.scale.setScalar(1.0);
                        const box = new THREE.Box3().setFromObject(root);
                        const center = box.getCenter(new THREE.Vector3());
                        root.position.x -= center.x;
                        root.position.z -= center.z;
                        root.position.y -= box.min.y;
                        this._gltfModels.set(`skyscraper-variant-${i}`, root);
                        resolve();
                    }, undefined, () => resolve());
                }));
            }
            for (const [type, url] of Object.entries(Renderer3D.VEHICLE_MODEL_MAP)) {
                jobs.push(loadVehicle(type, url));
            }
            // Load road models
            const loadRoad = (name, url) => new Promise((resolve) => {
                loader.load(url, (gltf) => {
                    const root = gltf.scene;
                    root.scale.setScalar(0.5);
                    const box = new THREE.Box3().setFromObject(root);
                    const center = box.getCenter(new THREE.Vector3());
                    root.position.x -= center.x;
                    root.position.z -= center.z;
                    root.position.y -= box.min.y;
                    // GTA dark asphalt: asphalt → near-black, markings stay bright white
                    root.traverse((child) => {
                        if (child.isMesh && child.material) {
                            const m = child.material;
                            if (m.color) {
                                const lum = m.color.r * 0.299 + m.color.g * 0.587 + m.color.b * 0.114;
                                if (lum > 0.85) m.color.multiplyScalar(0.88); // lane markings stay white
                                else if (lum > 0.60) m.color.multiplyScalar(0.32); // light asphalt → dark
                                else if (lum > 0.30) m.color.multiplyScalar(0.28); // mid asphalt → very dark
                                else if (lum > 0.12) m.color.multiplyScalar(0.45);
                            }
                            if (m.roughness !== undefined) m.roughness = Math.min(0.99, m.roughness + 0.18);
                            if (m.metalness !== undefined) m.metalness = 0;
                        }
                    });
                    this._roadModels.set(name, root);
                    resolve();
                }, undefined, () => resolve());
            });
            for (const [name, url] of Object.entries(Renderer3D.ROAD_MODEL_MAP)) {
                jobs.push(loadRoad(name, url));
            }
            // Load street prop models
            const loadProp = (name, url) => new Promise((resolve) => {
                loader.load(url, (gltf) => {
                    const root = gltf.scene;
                    root.scale.setScalar(0.45);
                    const box = new THREE.Box3().setFromObject(root);
                    const center = box.getCenter(new THREE.Vector3());
                    root.position.x -= center.x;
                    root.position.z -= center.z;
                    root.position.y -= box.min.y;
                    // Tone down bright white/chrome surfaces on props
                    root.traverse((child) => {
                        if (child.isMesh && child.material?.color) {
                            const m = child.material;
                            const lum = m.color.r * 0.299 + m.color.g * 0.587 + m.color.b * 0.114;
                            if (lum > 0.70) m.color.multiplyScalar(0.60);
                            if (m.roughness !== undefined) m.roughness = Math.max(0.55, m.roughness);
                        }
                    });
                    this._enforcePBR(root);
                    this._propModels.set(name, root);
                    resolve();
                }, undefined, () => resolve());
            });
            for (const [name, url] of Object.entries(Renderer3D.PROP_MODEL_MAP)) {
                jobs.push(loadProp(name, url));
            }
            // Load vegetation models
            const loadVegetation = (name, url) => new Promise((resolve) => {
                loader.load(url, (gltf) => {
                    const root = gltf.scene;
                    root.scale.setScalar(1.4);
                    const box = new THREE.Box3().setFromObject(root);
                    const center = box.getCenter(new THREE.Vector3());
                    root.position.x -= center.x;
                    root.position.z -= center.z;
                    root.position.y -= box.min.y;
                    this._enforcePBR(root);
                    this._vegetationModels.set(name, root);
                    resolve();
                }, undefined, () => resolve());
            });
            for (const [name, url] of Object.entries(Renderer3D.VEGETATION_MODEL_MAP)) {
                jobs.push(loadVegetation(name, url));
            }
            // Load urban detail models (awnings, parasols, fences)
            const loadDetail = (name, url) => new Promise((resolve) => {
                loader.load(url, (gltf) => {
                    const root = gltf.scene;
                    root.scale.setScalar(0.40);
                    const box = new THREE.Box3().setFromObject(root);
                    const center = box.getCenter(new THREE.Vector3());
                    root.position.x -= center.x;
                    root.position.z -= center.z;
                    root.position.y -= box.min.y;
                    this._enforcePBR(root);
                    this._detailModels.set(name, root);
                    resolve();
                }, undefined, () => resolve());
            });
            for (const [name, url] of Object.entries(Renderer3D.DETAIL_MODEL_MAP)) {
                jobs.push(loadDetail(name, url));
            }
        }

        await Promise.all(jobs);

        // Procedural bus (no bus.glb in asset pack)
        this._vehicleModels.set('bus', this._createProceduralBus());

        this._initEnvMap();
        this._lastEnvCapture = 0;
        this._envProbeReady = true; // non-blocking HDR env map

        this.rebuildWorld();
    }

    /**
     * Auto-detect hardware capability and pick appropriate preset.
     * Renders a test scene and measures frame time.
     */
    async _detectPreset() {
        try {
            // Quick test: render a frame and measure time
            const start = performance.now();
            // Wait for next frame
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const frameTime = performance.now() - start;

            // Pick preset based on frame time
            if (frameTime < 4) return 'ultra';      // <4ms = very fast
            if (frameTime < 8) return 'high';       // <8ms = fast
            if (frameTime < 16) return 'medium';    // <16ms = moderate
            return 'low';                            // slow
        } catch {
            return DEFAULT_PRESET;
        }
    }

    /**
     * Initialize post-processing pipeline (EffectComposer + Bloom) and procedural Sky.
     * Imports Three.js addons lazily to match the lazy-load pattern used elsewhere.
     */
    async _initPostProcessing() {
        try {
            const imports = await Promise.allSettled([
                import('three/addons/postprocessing/EffectComposer.js'),
                import('three/addons/postprocessing/RenderPass.js'),
                import('three/addons/postprocessing/UnrealBloomPass.js'),
                import('three/addons/objects/Sky.js'),
                import('three/addons/postprocessing/SSAOPass.js'),
                import('three/addons/postprocessing/ShaderPass.js'),
            ]);
            const [EffectComposerMod, RenderPassMod, BloomMod, SkyMod, SSAOMod, ShaderPassMod] = imports.map(r => r.status === 'fulfilled' ? r.value : null);
            if (!EffectComposerMod || !RenderPassMod || !BloomMod || !SkyMod) throw new Error('core addons missing');
            const { EffectComposer } = EffectComposerMod;
            const { RenderPass } = RenderPassMod;
            const { UnrealBloomPass } = BloomMod;
            const { Sky } = SkyMod;

            // --- Effect Composer ---
            const rect = this.canvas.getBoundingClientRect();
            this.composer = new EffectComposer(this.renderer);
            this.composer.setSize(rect.width, rect.height);

            // HDR: switch render targets to HalfFloatType for tone mapping
            this.composer.renderTarget1.type = THREE.HalfFloatType;
            this.composer.renderTarget2.type = THREE.HalfFloatType;
            const renderPass = new RenderPass(this.scene, this.camera);
            this.composer.addPass(renderPass);

            // SSAO — ambient occlusion for depth (tuned for perf: half-res, small kernel)
            if (SSAOMod) {
                const { SSAOPass } = SSAOMod;
                const ssaoW = Math.round(rect.width * 0.5);
                const ssaoH = Math.round(rect.height * 0.5);
                const ssaoPass = new SSAOPass(this.scene, this.camera, ssaoW, ssaoH);
                ssaoPass.kernelRadius = 4;
                ssaoPass.minDistance = 0.001;
                ssaoPass.maxDistance = 0.15;
                ssaoPass.output = SSAOPass.OUTPUT.Default;
                // SSAO is the fallback occluder — disabled where GTAO is active.
                ssaoPass.enabled = !this._presetConfig?.gtao;
                this.composer.addPass(ssaoPass);
                this._ssaoPass = ssaoPass;
            }

            // GTAO — ground-truth ambient occlusion for high/ultra. Computes its
            // own depth + normals and denoises with a separable poisson (bilateral)
            // blur. Mutually exclusive with SSAO so AO is never applied twice.
            try {
                const { GTAOPass } = await import('three/addons/postprocessing/GTAOPass.js');
                const gtaoPass = new GTAOPass(this.scene, this.camera, rect.width, rect.height, {},
                    { radius: 0.25, distanceExponent: 1.0, thickness: 1.0, scale: 1.0, samples: 16, distanceFallOff: 1.0, screenSpaceRadius: false },
                    { lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 4, samples: 16 });
                gtaoPass.output = GTAOPass.OUTPUT.Default;
                gtaoPass.blendIntensity = 1.0;
                gtaoPass.enabled = !!this._presetConfig?.gtao;
                this.composer.addPass(gtaoPass);
                this._gtaoPass = gtaoPass;
            } catch { /* GTAO pass unavailable */ }

            // Bloom — subtle glow on bright surfaces (sun, water, street lights)
            // Volumetric fog — half-res raymarched light scattering
            if (ShaderPassMod) {
                const { ShaderPass } = ShaderPassMod;
                const volFogW = Math.round(rect.width * 0.5);
                const volFogH = Math.round(rect.height * 0.5);
                const volFogShader = {
                    uniforms: {
                        tDiffuse: { value: null },
                        fogDensity: { value: 0.006 },
                        fogColor: { value: new THREE.Color(0x7ab0d0) },
                        sunDirection: { value: new THREE.Vector3(1, 1, 0) },
                        lightIntensity: { value: 1.0 },
                        sunAngle: { value: 0.5 },
                        uTime: { value: 0 },
                        screenWidth: { value: volFogW },
                        screenHeight: { value: volFogH },
                    },
                    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `
                        uniform sampler2D tDiffuse;
                        uniform float fogDensity;
                        uniform vec3 fogColor;
                        uniform vec3 sunDirection;
                        uniform float lightIntensity;
                        uniform float sunAngle;
                        uniform float uTime;
                        uniform float screenWidth;
                        uniform float screenHeight;
                        varying vec2 vUv;

                        float hash(vec2 p){
                            return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453);
                        }

                        float noise2d(vec2 p){
                            vec2 i = floor(p);
                            vec2 f = fract(p);
                            float a = hash(i);
                            float b = hash(i + vec2(1.0, 0.0));
                            float c = hash(i + vec2(0.0, 1.0));
                            float d = hash(i + vec2(1.0, 1.0));
                            return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
                        }

                        // Improved god rays with screen-space light scattering
                        float godRays(vec2 uv, vec3 sunDir, float intensity){
                            // Direction from screen center toward sun
                            vec2 dir = uv - vec2(0.5);
                            float sunDot = dot(dir, normalize(sunDir.xy));

                            // Low sun angle = more dramatic shafts
                            float lowSun = 1.0 - abs(sunDir.y);
                            float shaftStrength = max(0.0, sunDot) * intensity * (0.5 + lowSun * 1.5);

                            // Noise-based volumetric scattering
                            float n = noise2d(uv * 4.0 + vec2(sin(uTime*0.15), cos(uTime*0.12)));
                            shaftStrength *= n;

                            // Falloff from center
                            float dist = length(dir);
                            shaftStrength *= exp(-dist * 1.5);

                            return shaftStrength;
                        }

                        // Streetlight cone approximation: bright areas get volumetric fog
                        float lightCones(vec2 uv, vec4 color){
                            // Sample brightness — bright pixels suggest nearby lights
                            float bright = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                            // Threshold: only bright areas get volumetric treatment
                            float cone = smoothstep(0.3, 0.8, bright);
                            // Noise for volumetric appearance
                            float n = noise2d(uv * 6.0 + vec2(sin(uTime*0.2), cos(uTime*0.15)));
                            return cone * n * 0.2;
                        }

                        void main(){
                            vec4 col = texture2D(tDiffuse, vUv);

                            // Volumetric noise (slowly animated)
                            vec2 noiseUV = vUv * 3.0;
                            noiseUV += vec2(sin(uTime * 0.3), cos(uTime * 0.2)) * 0.5;
                            float fogNoise = noise2d(noiseUV);
                            float density = fogDensity * (1.0 + fogNoise * 0.3);

                            // Distance-based fog falloff
                            vec2 centerDir = vUv - vec2(0.5);
                            float dist = length(centerDir);
                            float fogFactor = 1.0 - exp(-density * dist * 80.0);

                            // God rays from sun
                            float shafts = godRays(vUv, sunDirection, lightIntensity);

                            // Streetlight cones from bright areas
                            float cones = lightCones(vUv, col);

                            // Composite fog
                            vec3 fogContrib = fogColor * (fogFactor + shafts + cones);
                            col.rgb = mix(col.rgb, fogContrib, fogFactor * 0.5 + shafts * 0.3 + cones * 0.2);

                            gl_FragColor = col;
                        }
                    `,
                };
                const volFogPass = new ShaderPass(volFogShader);
                volFogPass.setSize(volFogW, volFogH);
                this.composer.addPass(volFogPass);
                this._volFogPass = volFogPass;
            }

            // SSR — screen-space reflections for wet surfaces
            if (ShaderPassMod) {
                const { ShaderPass } = ShaderPassMod;
                const ssrShader = {
                    uniforms: {
                        tDiffuse: { value: null },
                        tDepth: { value: null },
                        wetness: { value: 0.0 },
                        maxTrace: { value: 128.0 },
                        stepSize: { value: 0.02 },
                        fadePower: { value: 0.5 },
                        temporalAlpha: { value: 0.3 },
                        prevSSR: { value: null },
                    },
                    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `
                        uniform sampler2D tDiffuse;
                        uniform sampler2D tDepth;
                        uniform float wetness;
                        uniform float maxTrace;
                        uniform float stepSize;
                        uniform float fadePower;
                        uniform float temporalAlpha;
                        uniform sampler2D prevSSR;
                        varying vec2 vUv;

                        void main(){
                            vec4 col = texture2D(tDiffuse, vUv);
                            float depth = texture2D(tDepth, vUv).r;

                            // Skip if no wetness or no geometry
                            if (wetness < 0.01 || depth > 0.99) {
                                gl_FragColor = col;
                                return;
                            }

                            // Estimate normal from depth derivatives
                            vec2 texelSize = vec2(1.0) / vec2(textureSize(tDepth, 0));
                            float dL = texture2D(tDepth, vUv - vec2(texelSize.x, 0.0)).r;
                            float dR = texture2D(tDepth, vUv + vec2(texelSize.x, 0.0)).r;
                            float dD = texture2D(tDepth, vUv - vec2(0.0, texelSize.y)).r;
                            float dU = texture2D(tDepth, vUv + vec2(0.0, texelSize.y)).r;
                            vec3 normal = normalize(vec3(
                                dR - dL,
                                2.0 * depth,
                                dU - dD
                            ));

                            // View direction and reflection
                            vec3 viewDir = normalize(vec3(0.0, 0.0, 1.0));
                            vec3 reflectDir = reflect(-viewDir, normal);

                            // Only reflect for surfaces facing camera (horizontal surfaces)
                            float reflectStrength = abs(normal.y);
                            if (reflectStrength < 0.3) {
                                gl_FragColor = col;
                                return;
                            }

                            // Ray march for reflection
                            vec2 rayStep = reflectDir.xz * stepSize / max(0.001, abs(reflectDir.y));
                            vec2 uv = vUv;
                            vec3 reflection = vec3(0.0);
                            float traceDist = 0.0;
                            float reflectionWeight = 0.0;

                            for (float i = 0.0; i < maxTrace; i++) {
                                uv += rayStep * 0.01;
                                traceDist += stepSize;

                                // Out of bounds check
                                if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) break;

                                float sampleDepth = texture2D(tDepth, uv).r;
                                vec3 sampleCol = texture2D(tDiffuse, uv).rgb;

                                // Hit test: check if ray is at surface level
                                float heightDiff = abs(sampleDepth - depth);
                                if (heightDiff < 0.1 * traceDist) {
                                    reflection = sampleCol;
                                    reflectionWeight = 1.0 / (1.0 + traceDist * 0.5);
                                    break;
                                }
                            }

                            // Env-probe fallback: use sky color when rays miss
                            if (reflectionWeight < 0.1) {
                                reflection = mix(col.rgb, vec3(0.1, 0.12, 0.15), 0.3);
                                reflectionWeight = 0.1;
                            }

                            // Wetness modulation
                            float reflectionAmount = wetness * reflectionWeight * reflectStrength;
                            vec3 finalCol = mix(col.rgb, reflection, reflectionAmount * fadePower);

                            // Temporal accumulation with previous frame
                            vec4 prev = texture2D(prevSSR, vUv);
                            finalCol = mix(finalCol, prev.rgb, temporalAlpha * 0.5);

                            gl_FragColor = vec4(finalCol, col.a);
                        }
                    `,
                };
                const ssrPass = new ShaderPass(ssrShader);
                this.composer.addPass(ssrPass);
                this._ssrPass = ssrPass;
                // Temporal accumulation buffer
                this._ssrPrevRT = new THREE.WebGLRenderTarget(
                    rect.width, rect.height, THREE.RGBAFormat
                );
            }

            const bloomPass = new UnrealBloomPass(
                new THREE.Vector2(rect.width, rect.height),
                0.25,   // strength — boosted at night dynamically
                0.4,    // radius — tighter for multi-mip clarity
                0.75    // threshold — only bright surfaces bloom
            );
            // Multi-mip: bloom decays through mip levels for natural falloff
            bloomPass.resolution = 0.5;     // half-res bloom target
            bloomPass.threshold = 0.75;      // only bright surfaces
            bloomPass.smithLage = 0.5;       // decay rate per mip
            this.composer.addPass(bloomPass);
            this._bloomPass = bloomPass;
            // Store base bloom values for day/night interpolation
            this._bloomDayStrength = 0.20;
            this._bloomNightStrength = 0.55;
            this._bloomDayThreshold = 0.75;  // day: only very bright surfaces
            this._bloomNightThreshold = 0.40; // night: more surfaces bloom

            // FXAA anti-aliasing
            if (ShaderPassMod) {
                try {
                    const { FXAAShader } = await import('three/addons/shaders/FXAAShader.js');
                    const { ShaderPass } = ShaderPassMod;
                    const fxaaPass = new ShaderPass(FXAAShader);
                    fxaaPass.material.uniforms['resolution'].value.set(1 / rect.width, 1 / rect.height);
                    // FXAA is the fallback AA: active only when TAA is not (low/medium).
                    fxaaPass.enabled = !this._presetConfig?.taa;
                    this.composer.addPass(fxaaPass);
                    this._fxaaPass = fxaaPass;
                } catch { /* FXAA shader not available */ }
            }

            // TAA — temporal anti-aliasing (jitter + history + neighborhood clamp).
            // Enabled on high/ultra; gated to off on lower presets (FXAA fallback).
            try {
                const { TAAPass } = await import('./render/taa_pass.js');
                const taaPass = new TAAPass(rect.width, rect.height);
                taaPass.enabled = !!this._presetConfig?.taa;
                this.composer.addPass(taaPass);
                this._taaPass = taaPass;
            } catch { /* TAA pass unavailable */ }

            // Vignette + color grading (single custom pass)
            if (ShaderPassMod) {
                const { ShaderPass } = ShaderPassMod;
                const VignetteColorGradeShader = {
                    uniforms: {
                        tDiffuse: { value: null },
                        vignetteStrength: { value: 0.35 },
                        vignetteRadius: { value: 0.85 },
                        saturation: { value: 1.08 },
                        contrast: { value: 1.05 },
                        tintColor: { value: new THREE.Vector3(1.0, 0.98, 0.95) },
                        weatherTint: { value: new THREE.Vector3(0.78, 0.82, 0.9) },
                        weatherTintStrength: { value: 0.0 },
                    },
                    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `
                        uniform sampler2D tDiffuse;
                        uniform float vignetteStrength;
                        uniform float vignetteRadius;
                        uniform float saturation;
                        uniform float contrast;
                        uniform vec3 tintColor;
                        uniform vec3 weatherTint;
                        uniform float weatherTintStrength;
                        varying vec2 vUv;
                        void main(){
                            vec4 col=texture2D(tDiffuse,vUv);
                            // Vignette
                            vec2 uv=vUv*2.0-1.0;
                            float d=length(uv);
                            float vig=smoothstep(vignetteRadius,vignetteRadius-0.45,d);
                            col.rgb*=mix(1.0-vignetteStrength,1.0,vig);
                            // Saturation
                            float lum=dot(col.rgb,vec3(0.299,0.587,0.114));
                            col.rgb=mix(vec3(lum),col.rgb,saturation);
                            // Contrast
                            col.rgb=(col.rgb-0.5)*contrast+0.5;
                            // Time-of-day tint
                            col.rgb*=tintColor;
                            // Weather tint overlay (cool/desaturated under rain, snow, fog)
                            col.rgb=mix(col.rgb,col.rgb*weatherTint,weatherTintStrength);
                            gl_FragColor=col;
                        }
                    `,
                };
                const vignettePass = new ShaderPass(VignetteColorGradeShader);
                this.composer.addPass(vignettePass);
                this._vignettePass = vignettePass;
            }

            // --- Procedural Sky ---
            const sky = new Sky();
            sky.scale.setScalar(400);
            sky.frustumCulled = false;
            sky.renderOrder = -1; // Render before everything else
            this.scene.add(sky);
            this._sky = sky;
            // Preetham sky is street-only (washed out top-down); god mode + low
            // preset rely on the always-on gradient dome instead.
            sky.visible = (this.cameraMode !== 'god');

            const skyUniforms = sky.material.uniforms;
            skyUniforms['turbidity'].value = 3.2;       // touch of horizon warmth, still clean
            skyUniforms['rayleigh'].value = 2.6;        // deeper, richer blue zenith
            skyUniforms['mieCoefficient'].value = 0.004;
            skyUniforms['mieDirectionalG'].value = 0.78;

            // Initial sun position (will be updated by day/night cycle)
            this._updateSkyForTime(12); // noon


            // --- Star field (night only) ---
            if (ShaderPassMod) {
                const { ShaderPass } = ShaderPassMod;
                const starShader = {
                    uniforms: {
                        tDiffuse: { value: null },
                        nightFactor: { value: 0.0 },
                        starField: { value: null },
                    },
                    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `
                        uniform sampler2D tDiffuse;
                        uniform float nightFactor;
                        uniform sampler2D starField;
                        varying vec2 vUv;
                        void main(){
                            vec4 col = texture2D(tDiffuse, vUv);
                            if (nightFactor > 0.01) {
                                vec3 stars = texture2D(starField, vUv).rgb;
                                col.rgb += stars * nightFactor;
                            }
                            gl_FragColor = col;
                        }
                    `,
                };
                const starPass = new ShaderPass(starShader);
                this.composer.addPass(starPass);
                this._starPass = starPass;
            }

            // --- Render Graph: explicit ordering + dependency tracking (Q11.E) ---
            try {
                this._renderGraph = new RenderGraph(this.composer);
                this._renderGraph.add('render', renderPass);
                if (this._ssaoPass) this._renderGraph.add('ssao', this._ssaoPass);
                if (this._gtaoPass) this._renderGraph.add('gtao', this._gtaoPass);
                if (this._volFogPass) this._renderGraph.add('volumetric', this._volFogPass);
                if (this._ssrPass) this._renderGraph.add('ssr', this._ssrPass);
                this._renderGraph.add('bloom', bloomPass);
                if (this._taaPass) this._renderGraph.add('taa', this._taaPass);
                if (this._fxaaPass) this._renderGraph.add('fxaa', this._fxaaPass);
                if (this._vignettePass) this._renderGraph.add('vignette', this._vignettePass);
                if (this._starPass) this._renderGraph.add('starfield', this._starPass);
                this._renderGraph.validate();
                this._renderGraph.applyOrder();
            } catch (e) {
                console.warn('[RenderGraph]', e.message);
            }

            // --- Lightning exposure spike ---
            this._lightningExposure = 1.0;
            this._lightningFlashTime = 0;

            // Keep scene.background as fallback color — sky mesh renders on top

        } catch (e) {
            // Addons not available — fall back to direct rendering (no post-processing)
            console.warn('Post-processing addons not available, using direct rendering:', e.message);
        }
    }

    /**
     * Periodic environment cube capture for IBL on metals/glass.
     * Captures every 30 seconds or when lighting changes significantly.
     */
    _captureEnvProbe() {
        if (!this._envProbeReady || this.testMode) return;
        const now = performance.now();
        if (now - this._lastEnvCapture < 30000) return; // 30s interval
        this._lastEnvCapture = now;

        try {
            // Reuse a single cube camera + render target to avoid per-capture allocation.
            if (!this._envCubeRT) {
                this._envCubeRT = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
                this._envCubeCam = new THREE.CubeCamera(0.5, 1000, this._envCubeRT);
            }
            this._envCubeCam.position.copy(this.camera.position);
            this._envCubeCam.update(this.renderer, this.scene);
            this._envMap = this._envCubeRT.texture;
            // Apply to all materials that already declare an env map slot
            for (const [, entry] of this._chunkMeshes) {
                entry.group.traverse((obj) => {
                    if (obj.isMesh && obj.material) {
                        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                        for (const m of mats) {
                            if (m.envMap) m.envMap = this._envMap;
                        }
                    }
                });
            }
        } catch {
            // Env probe capture failed — use default
        }
    }

    /**
     * Load HDR environment map from Poly Haven and apply to scene.
     * Improves reflections on water, glass buildings, and provides IBL lighting.
     */
    async _initEnvMap() {
        try {
            const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
            const loader = new RGBELoader();
            loader.load('assets/env.hdr', (hdr) => {
                const pmrem = new THREE.PMREMGenerator(this.renderer);
                pmrem.compileEquirectangularShader();
                const envMap = pmrem.fromEquirectangular(hdr).texture;
                this.scene.environment = envMap;  // IBL for all materials
                pmrem.dispose();
                hdr.dispose();
            }, undefined, () => {}); // silent fail if not found
        } catch { /* addon not available */ }
    }

    /**
     * Update procedural sky sun position based on time of day (0-24).
     * Also drives the always-on dome so night stays deep navy even when
     * the Preetham sky is hidden (god mode / low preset).
     */
    _updateSkyForTime(timeOfDay) {
        const sunPhase = ((timeOfDay - 6) / 12) * Math.PI;
        const elevation = Math.sin(sunPhase);
        const azimuth = 0.25;
        const phi = THREE.MathUtils.degToRad(90 - elevation * 60);
        const theta = THREE.MathUtils.degToRad(180 * azimuth);
        this._sunPosition.setFromSphericalCoords(1, phi, theta);

        if (this._sky) {
            this._sky.material.uniforms['sunPosition'].value.copy(this._sunPosition);
        }

        if (this._skyDome) {
            let phase = 'night';
            if (timeOfDay >= 5 && timeOfDay < 7) phase = 'dawn';
            else if (timeOfDay >= 7 && timeOfDay < 18) phase = 'day';
            else if (timeOfDay >= 18 && timeOfDay < 20) phase = 'dusk';
            updateSkyDomeForPhase(this._skyDome, phase);
        }

        if (this.sunLight) {
            const lightDist = 40;
            this.sunLight.position.set(
                this._sunPosition.x * lightDist,
                Math.max(5, this._sunPosition.y * lightDist),
                this._sunPosition.z * lightDist,
            );
        }
        if (this.sunLightFar) {
            const lightDist = 40;
            this.sunLightFar.position.set(
                this._sunPosition.x * lightDist,
                Math.max(5, this._sunPosition.y * lightDist),
                this._sunPosition.z * lightDist,
            );
        }

        const dayBright = 1.15;
        const nightBright = 0.62;
        const isNight = timeOfDay < 5 || timeOfDay >= 20;
        const isDay = timeOfDay >= 7 && timeOfDay < 18;
        let target = dayBright;
        if (isNight) target = nightBright;
        else if (!isDay) target = (dayBright + nightBright) * 0.5;
        if (timeOfDay >= 18 && timeOfDay < 20) {
            const u = (timeOfDay - 18) / 2;
            target = dayBright + (nightBright - dayBright) * u;
        } else if (timeOfDay >= 5 && timeOfDay < 7) {
            const u = (timeOfDay - 5) / 2;
            target = nightBright + (dayBright - nightBright) * u;
        }
        if (this.renderer) {
            const cur = this.renderer.toneMappingExposure;
            this.renderer.toneMappingExposure = cur + (target - cur) * 0.04;
        }
        if (isNight && this._bloomPass) {
            this._bloomPass.strength += (this._bloomNightStrength - this._bloomPass.strength) * 0.02;
            this._bloomPass.threshold += (this._bloomNightThreshold - this._bloomPass.threshold) * 0.02;
        } else if (!isNight && this._bloomPass) {
            this._bloomPass.strength += (this._bloomDayStrength - this._bloomPass.strength) * 0.02;
            this._bloomPass.threshold += (this._bloomDayThreshold - this._bloomPass.threshold) * 0.02;
        }

        const nightT = isNight ? 1 : isDay ? 0 : timeOfDay >= 18 ? (timeOfDay - 18) / 2 : (7 - timeOfDay) / 2;
        if (this._highwayLightStrips) {
            const want = nightT * 0.9;
            for (const m of this._highwayLightStrips) {
                m.material.emissiveIntensity += (want - m.material.emissiveIntensity) * 0.06;
            }
        }
        if (this._windowGlowMeshes) {
            const wantOpacity = 0.22 + nightT * 0.58;
            for (const m of this._windowGlowMeshes) {
                m.material.opacity += (wantOpacity - m.material.opacity) * 0.04;
            }
        }
        if (this.scene?.fog) {
            const fogNight = 0.012;
            const fogDay = 0.006;
            const wantFog = fogDay + nightT * (fogNight - fogDay);
            this.scene.fog.density += (wantFog - this.scene.fog.density) * 0.02;
        }
        if (typeof document !== 'undefined' && document.body) {
            document.body.classList.toggle('night', isNight);
            document.body.classList.toggle('dusk', timeOfDay >= 18 && timeOfDay < 20);
            document.body.classList.toggle('dawn', timeOfDay >= 5 && timeOfDay < 7);
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
        // Q11.C: dispose LOD1 box proxies and imposter sprite
        if (entry.lod1Group) {
            this.scene.remove(entry.lod1Group);
            entry.lod1Group.traverse((obj) => {
                if (obj.isMesh) { obj.geometry?.dispose?.(); obj.material?.dispose?.(); }
            });
        }
        if (entry.imposter) {
            this.scene.remove(entry.imposter);
            entry.imposter.material?.map?.dispose?.();
            entry.imposter.material?.dispose?.();
        }
    }

    /**
     * Build animated water plane(s) for a set of water tiles.
     * Creates a single flat plane per contiguous row of water tiles, with a
     * custom vertex shader for gentle wave animation.
     */
    _buildWaterMeshForTiles(tiles) {
        const meshes = [];
        // Create one plane per water tile — cheap with shared geometry + material
        const geom = new THREE.PlaneGeometry(1, 1, 8, 8);
        geom.rotateX(-Math.PI / 2);

        // Shared animated water material
        if (!this._waterMaterial) {
            this._waterMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x3aa0e0,       // bright tropical blue
                transparent: true,
                opacity: 0.5,          // translucent so the planar mirror reads through the waves
                roughness: 0.05,       // very reflective
                metalness: 0.1,
                transmission: 0.4,
                thickness: 1.2,
                clearcoat: 1.0,
                clearcoatRoughness: 0.05,
                envMapIntensity: 1.5,
                side: THREE.FrontSide,
            });
            // Inject vertex displacement for waves + depth-based color absorption
            this._waterMaterial.onBeforeCompile = (shader) => {
                shader.uniforms.uTime = { value: 0 };
                // Depth-absorption palette (Q10.D): grazing views travel a longer
                // path through the water and read darker/bluer; top-down reads as a
                // bright turquoise shallow. Deep color keeps ~0.2 blue (WD
                // MaxDepthDarknessFactor) so water never goes pure black.
                shader.uniforms.uShallowColor = { value: new THREE.Color(0x46c2d8) };
                shader.uniforms.uDeepColor = { value: new THREE.Color(0x0a3553) };
                shader.uniforms.uAbsorb = { value: 0.85 };
                shader.uniforms.uWaterDepth = { value: 1.15 };
                this._waterShaderRef = shader;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <common>',
                    `#include <common>
                    uniform float uTime;
                    attribute vec4 aShore;
                    varying vec4 vShore;
                    varying vec2 vFoamUv;
                    varying vec3 vWaterWorldPos;`
                );
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>
                    float wave1 = sin(position.x * 3.0 + uTime * 1.2) * 0.06;
                    float wave2 = sin(position.z * 2.5 + uTime * 0.9) * 0.05;
                    float wave3 = cos((position.x + position.z) * 2.0 + uTime * 0.7) * 0.03;
                    float wave4 = sin(position.x * 6.0 - position.z * 3.0 + uTime * 2.0) * 0.015;
                    transformed.y += wave1 + wave2 + wave3 + wave4;
                    vShore = aShore;
                    vFoamUv = uv;
                    #ifdef USE_INSTANCING
                        vWaterWorldPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
                    #else
                        vWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                    #endif`
                );
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <common>',
                    `#include <common>
                    uniform float uTime;
                    uniform vec3 uShallowColor;
                    uniform vec3 uDeepColor;
                    uniform float uAbsorb;
                    uniform float uWaterDepth;
                    varying vec4 vShore;
                    varying vec2 vFoamUv;
                    varying vec3 vWaterWorldPos;`
                );
                shader.fragmentShader = shader.fragmentShader.replace(
                    '#include <color_fragment>',
                    `#include <color_fragment>
                    float cosV = max(0.10, normalize(cameraPosition - vWaterWorldPos).y);
                    float pathLen = uWaterDepth / cosV;
                    float trans = clamp(exp(-pathLen * uAbsorb), 0.0, 1.0);
                    diffuseColor.rgb = mix(uDeepColor, uShallowColor, trans);
                    // Caustics: animated interference web, brightest in shallow water
                    // (trans high). Reads as sunlight refracting onto the bed.
                    vec2 cp = vWaterWorldPos.xz * 1.6;
                    float cw = abs(sin(cp.x * 3.0 + uTime * 1.3) * sin(cp.y * 3.0 - uTime * 1.1)
                                   + sin((cp.x + cp.y) * 2.3 + uTime * 0.9) * 0.5);
                    float caustic = pow(1.0 - clamp(cw * 0.6, 0.0, 1.0), 3.0);
                    diffuseColor.rgb += caustic * trans * 0.28 * vec3(0.72, 0.95, 1.0);
                    // Shoreline foam: animated band hugging the edges that touch land.
                    float eN = vShore.x * smoothstep(0.32, 0.0, vFoamUv.y);
                    float eS = vShore.z * smoothstep(0.68, 1.0, vFoamUv.y);
                    float eW = vShore.w * smoothstep(0.32, 0.0, vFoamUv.x);
                    float eE = vShore.y * smoothstep(0.68, 1.0, vFoamUv.x);
                    float foam = max(max(eN, eS), max(eW, eE));
                    float foamN = 0.5 + 0.5 * sin(vWaterWorldPos.x * 9.0 + uTime * 2.3)
                                            * sin(vWaterWorldPos.z * 9.0 - uTime * 1.9);
                    foam *= 0.55 + 0.45 * foamN;
                    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.97, 1.0), clamp(foam, 0.0, 1.0) * 0.85);`
                );
            };
        }

        const dummy = new THREE.Object3D();
        const instancedMesh = new THREE.InstancedMesh(geom, this._waterMaterial, tiles.length);
        instancedMesh.receiveShadow = true;
        instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        // Per-instance shore-edge flags (N,E,S,W) drive the foam band where water
        // meets land — 1 if that neighbour tile is not water (or off-map).
        const map = this.game.map;
        const isWater = (x, y) => map.getTileAt(x, y) === TERRAIN_WATER;
        const shore = new Float32Array(tiles.length * 4);
        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;
            dummy.position.set(wx, Renderer3D.WATER_PLANE_Y, wz);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
            shore[i * 4 + 0] = isWater(tile.x, tile.y - 1) ? 0 : 1; // N
            shore[i * 4 + 1] = isWater(tile.x + 1, tile.y) ? 0 : 1; // E
            shore[i * 4 + 2] = isWater(tile.x, tile.y + 1) ? 0 : 1; // S
            shore[i * 4 + 3] = isWater(tile.x - 1, tile.y) ? 0 : 1; // W
        }
        geom.setAttribute('aShore', new THREE.InstancedBufferAttribute(shore, 4));
        instancedMesh.instanceMatrix.needsUpdate = true;
        meshes.push(instancedMesh);

        // Track water meshes for time uniform updates
        if (!this._waterMeshes) this._waterMeshes = [];
        this._waterMeshes.push(instancedMesh);

        return meshes;
    }

    /**
     * Build one shared real-time planar reflection mirror for all water (Q10.D).
     * A single flat Reflector at the water surface; land terrain sits above it and
     * occludes it, so the mirror only reads over water tiles. The translucent
     * animated wave plane blends on top. Skipped in test mode (the Reflector
     * re-renders the whole scene from a mirrored camera — black under swiftshader)
     * and toggled off on low presets via `planarReflections`.
     */
    async _buildWaterReflector() {
        if (this._waterReflector) {
            this.scene.remove(this._waterReflector);
            this._waterReflector.dispose?.();
            this._waterReflector.geometry?.dispose();
            this._waterReflector = null;
        }
        if (this.testMode) return;

        // Only pay for a reflector if the map actually has water.
        const map = this.game.map;
        let hasWater = false;
        for (let y = 0; y < map.height && !hasWater; y++) {
            for (let x = 0; x < map.width; x++) {
                if (map.getTileAt(x, y) === TERRAIN_WATER) { hasWater = true; break; }
            }
        }
        if (!hasWater) return;

        const { Reflector } = await import('three/examples/jsm/objects/Reflector.js');
        // Guard against a world rebuild that finished while the import was in flight.
        if (this.game.map !== map) return;

        const geom = new THREE.PlaneGeometry(map.width, map.height);
        const reflector = new Reflector(geom, {
            textureWidth: 512,
            textureHeight: 512,
            color: 0x4a6b7a,     // steel-blue tint pulls reflections toward water tone
            clipBias: 0.003,
        });
        reflector.rotation.x = -Math.PI / 2;   // lay flat → reflection normal points +Y
        reflector.position.set(0, Renderer3D.WATER_SURFACE_Y, 0);
        reflector.renderOrder = -1;            // draw before the translucent wave plane
        reflector.visible = this._presetConfig ? !!this._presetConfig.planarReflections : true;
        this.scene.add(reflector);
        this._waterReflector = reflector;
    }

    /**
     * Spawn a couple of render-only ambient boats drifting on the largest water
     * body, each trailing an animated V-foam wake (Q10.D). Deterministic via the
     * vfx RNG stream; no sim state — purely cosmetic life on the harbor.
     */
    _buildAmbientBoats() {
        this._disposeAmbientBoats();

        // Collect water tiles → bounding box of the water body.
        const map = this.game.map;
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, count = 0;
        for (let y = 0; y < map.height; y++) {
            for (let x = 0; x < map.width; x++) {
                if (map.getTileAt(x, y) !== TERRAIN_WATER) continue;
                count++;
                if (x < minX) minX = x; if (x > maxX) maxX = x;
                if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
        }
        // Need a real water body to be worth it.
        if (count < 40 || (maxX - minX) < 6 || (maxY - minY) < 6) return;

        const rng = this.game?.rngStreams?.vfx;
        const rand = () => (rng ? rng.next() : 0.5);
        const cx = (minX + maxX) / 2 - this._mapHalfW + 0.5;
        const cz = (minY + maxY) / 2 - this._mapHalfH + 0.5;
        const rx = Math.max(2, (maxX - minX) * 0.30);
        const rz = Math.max(2, (maxY - minY) * 0.30);

        this._ambientBoats = [];
        const n = Math.min(2, 1 + Math.floor(rand() * 2));
        for (let i = 0; i < n; i++) {
            const group = new THREE.Group();
            group.add(this._buildBoatHull());
            const wake = this._buildBoatWake();
            group.add(wake);
            this.scene.add(group);
            this._ambientBoats.push({
                group, wakeMat: wake.material,
                cx, cz, rx, rz,
                phase: rand() * Math.PI * 2,
                speed: 0.05 + rand() * 0.05,   // rad/s — slow drift
                dir: rand() < 0.5 ? 1 : -1,
            });
        }
    }

    /** Simple low-poly hull + cabin, bow pointing local +Z. */
    _buildBoatHull() {
        const g = new THREE.Group();
        const hullMat = new THREE.MeshStandardMaterial({ color: 0xe8ebee, roughness: 0.6, metalness: 0.1 });
        const hull = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 1.2), hullMat);
        hull.position.y = 0.02;
        g.add(hull);
        const bow = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 4), hullMat);
        bow.rotation.x = Math.PI / 2;
        bow.rotation.y = Math.PI / 4;
        bow.position.set(0, 0.02, 0.75);
        bow.scale.set(1, 0.36, 1);
        g.add(bow);
        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(0.34, 0.2, 0.5),
            new THREE.MeshStandardMaterial({ color: 0x5b7a8c, roughness: 0.5 })
        );
        cabin.position.set(0, 0.18, -0.1);
        g.add(cabin);
        return g;
    }

    /** Animated translucent V-wake trailing behind the stern (local -Z). */
    _buildBoatWake() {
        const geo = new THREE.PlaneGeometry(1.6, 5, 1, 1);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: { uTime: { value: 0 } },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }`,
            fragmentShader: `
                uniform float uTime;
                varying vec2 vUv;
                void main() {
                    float v = vUv.y;                       // 0 stern .. 1 tail
                    float spread = mix(0.12, 0.95, v);     // V widens behind
                    float dx = abs(vUv.x - 0.5) / 0.5;
                    float arm = smoothstep(spread, spread - 0.22, dx);
                    float churn = 0.5 + 0.5 * sin(vUv.x * 34.0 + v * 22.0 - uTime * 6.0);
                    float a = arm * (1.0 - v) * (0.55 + 0.45 * churn);
                    gl_FragColor = vec4(vec3(0.95, 0.98, 1.0), clamp(a, 0.0, 1.0) * 0.7);
                }`,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, 0.03, -3.1);   // behind the stern, just above the wave plane
        mesh.renderOrder = 2;
        return mesh;
    }

    _updateAmbientBoats(dt) {
        if (!this._ambientBoats?.length) return;
        const y = Renderer3D.WATER_PLANE_Y + 0.04;
        const t = performance.now() / 1000;
        for (const b of this._ambientBoats) {
            b.phase += b.dir * b.speed * dt;
            const a = b.phase;
            const x = b.cx + b.rx * Math.cos(a);
            const z = b.cz + b.rz * Math.sin(a);
            // Tangent (travel direction) for heading; local forward is +Z.
            const vx = -b.rx * Math.sin(a) * b.dir;
            const vz = b.rz * Math.cos(a) * b.dir;
            b.group.position.set(x, y, z);
            b.group.rotation.y = Math.atan2(vx, vz);
            b.wakeMat.uniforms.uTime.value = t;
        }
    }

    _disposeAmbientBoats() {
        if (!this._ambientBoats) return;
        for (const b of this._ambientBoats) {
            this.scene.remove(b.group);
            b.group.traverse((o) => {
                if (o.geometry) o.geometry.dispose();
                if (o.material) o.material.dispose();
            });
        }
        this._ambientBoats = null;
    }

    _createGlassMaterial() {
        const mat = new THREE.MeshPhysicalMaterial({
            color: 0x88ccff,
            transparent: true,
            opacity: 0.45,
            roughness: 0.05,
            metalness: 0.15,
            transmission: 0.6,
            thickness: 0.3,
            envMapIntensity: 1.4,
            side: THREE.DoubleSide,
        });
        mat.userData = { shatterRef: null };
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uShatter = { value: 0.0 };
            mat.userData.shatterRef = shader;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform float uShatter;
                vec2 _glHash(vec2 p) {
                    p = vec2(dot(p, vec2(127.1, 311.7)),
                             dot(p, vec2(269.5, 183.3)));
                    return fract(sin(p) * 43758.5453);
                }
                float _glVoronoi(vec2 uv, float scale) {
                    vec2 g = floor(uv * scale);
                    vec2 f = fract(uv * scale);
                    float minDist = 1.0;
                    for (int y = -1; y <= 1; y++) {
                        for (int x = -1; x <= 1; x++) {
                            vec2 neighbor = vec2(float(x), float(y));
                            vec2 point = _glHash(g + neighbor);
                            vec2 diff = neighbor + point - f;
                            minDist = min(minDist, length(diff));
                        }
                    }
                    return minDist;
                }`
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>
                if (uShatter > 0.01) {
                    vec2 uv = vUv;
                    float cracks = _glVoronoi(uv, 6.0 + uShatter * 10.0);
                    float edge = smoothstep(0.02, 0.06, cracks);
                    float fade = 1.0 - uShatter * 0.7;
                    gl_FragColor.rgb = mix(vec3(0.9), gl_FragColor.rgb, edge) * fade;
                    gl_FragColor.a *= mix(1.0, 0.2, uShatter * (1.0 - edge));
                }`
            );
        };
        return mat;
    }

    /**
     * Build 3D road models for road tiles based on neighbor connectivity.
     * Neighbor bitmask: N=1, E=2, S=4, W=8
     */
    _buildRoadMeshesForTiles(tiles, bounds) {
        const objects = [];
        const hash = (x, y, salt) => {
            let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
            h = ((h ^ (h >> 13)) * 1274126177) | 0;
            return ((h ^ (h >> 16)) >>> 0) / 4294967296;
        };

        // Collect per-variant road tiles and street lights, then instance them
        // (Q11.D): one InstancedMesh per road variant replaces per-tile clones.
        const roadInstances = new Map();
        const fallbackRoads = [];
        const streetLights = [];
        const lightGlows = [];
        const fallbackPoles = [];
        const fallbackGlows = [];

        // Base asphalt under every road tile — dark continuous slab so streets read as asphalt, not tiles on grass.
        const baseAsphalt = [];
        for (const t of tiles) {
            const wx2 = t.x - this._mapHalfW + 0.5;
            const wz2 = t.y - this._mapHalfH + 0.5;
            baseAsphalt.push({ x: wx2, y: this._smoothTerrainY(t.x, t.y) + 0.006, z: wz2 });
        }
        if (baseAsphalt.length > 0) {
            const baseGeom = new THREE.PlaneGeometry(1, 1);
            baseGeom.rotateX(-Math.PI / 2);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.95, metalness: 0.0 });
            const baseMesh = new THREE.InstancedMesh(baseGeom, baseMat, baseAsphalt.length);
            baseMesh.receiveShadow = true;
            baseMesh.userData.isRoad = true;
            const d2 = new THREE.Object3D();
            for (let i = 0; i < baseAsphalt.length; i++) {
                const b = baseAsphalt[i];
                d2.position.set(b.x, b.y, b.z);
                d2.rotation.set(0, 0, 0);
                d2.scale.set(1, 1, 1);
                d2.updateMatrix();
                baseMesh.setMatrixAt(i, d2.matrix);
            }
            baseMesh.instanceMatrix.needsUpdate = true;
            objects.push(baseMesh);
        }

        for (const tile of tiles) {
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;

            // Calculate connectivity bitmask from neighbors — roadMap OR terrain
            const isRoadAt = (x, y) => this.game.map.getTileAt(x, y) === TERRAIN_ROAD || this.game.map.roadMap?.[y * this.game.map.width + x] === 1;
            const n = isRoadAt(tile.x, tile.y - 1) ? 1 : 0;
            const e = isRoadAt(tile.x + 1, tile.y) ? 2 : 0;
            const s = isRoadAt(tile.x, tile.y + 1) ? 4 : 0;
            const w = isRoadAt(tile.x - 1, tile.y) ? 8 : 0;
            const mask = n | e | s | w;
            const count = ((mask & 1) + ((mask >> 1) & 1) + ((mask >> 2) & 1) + ((mask >> 3) & 1));

            let modelName = 'road-straight';
            let rotation = 0;

            if (count === 4) {
                modelName = 'road-crossroad';
                rotation = 0;
            } else if (count === 3) {
                modelName = 'road-intersection';
                // T-junction: rotate so the missing direction is at the back
                if (!(mask & 1)) rotation = Math.PI;       // missing N -> face S
                else if (!(mask & 2)) rotation = -Math.PI / 2; // missing E -> face W
                else if (!(mask & 4)) rotation = 0;         // missing S -> face N
                else rotation = Math.PI / 2;                  // missing W -> face E
            } else if (count === 2) {
                // Two neighbors: straight or bend
                if ((mask & 5) === 5 || (mask & 10) === 10) {
                    // Opposite sides: straight
                    modelName = 'road-straight';
                    rotation = (mask & 5) === 5 ? 0 : Math.PI / 2; // N-S or E-W
                } else {
                    // Adjacent: bend
                    modelName = 'road-bend';
                    if ((mask & 3) === 3) rotation = 0;           // N+E
                    else if ((mask & 6) === 6) rotation = Math.PI / 2;  // E+S
                    else if ((mask & 12) === 12) rotation = Math.PI;     // S+W
                    else rotation = -Math.PI / 2;                         // W+N
                }
            } else if (count === 1) {
                modelName = 'road-end';
                if (mask & 1) rotation = 0;            // N
                else if (mask & 2) rotation = Math.PI / 2;  // E
                else if (mask & 4) rotation = Math.PI;      // S
                else rotation = -Math.PI / 2;                // W
            } else {
                // Isolated road: just use straight
                modelName = 'road-straight';
            }

            const terrainY = this._smoothTerrainY(tile.x, tile.y);
            const model = this._roadModels.get(modelName);
            if (model) {
                if (!roadInstances.has(modelName)) roadInstances.set(modelName, []);
                roadInstances.get(modelName).push({ x: wx, y: terrainY + 0.02, z: wz, rotY: rotation });
            } else {
                fallbackRoads.push({ x: wx, y: terrainY + 0.015, z: wz });
            }

            // Street props: only in urban core (radius ≤ 14 from map center)
            const dcx = tile.x - this._mapHalfW, dcz = tile.y - this._mapHalfH;
            const distFromCenter = Math.sqrt(dcx * dcx + dcz * dcz);
            if (distFromCenter <= 14 && hash(tile.x, tile.y, 200) < 0.18) {
                const lightModel = this._propModels.get('light-square');
                const side = hash(tile.x, tile.y, 210) > 0.5 ? 1 : -1;
                const terrainYL = this._smoothTerrainY(tile.x, tile.y);
                const px = wx + side * 0.42;
                const pz = wz;
                if (lightModel) {
                    streetLights.push({
                        x: px, y: terrainYL, z: pz,
                        rotY: side > 0 ? -Math.PI / 2 : Math.PI / 2,
                    });
                    const headH = this._lightHeadTop ?? (this._lightHeadTop = new THREE.Box3().setFromObject(lightModel).max.y * 0.60);
                    lightGlows.push({ x: px, y: terrainYL + headH, z: pz });
                } else {
                    // Fallback: pole + glow sphere (only when the light model is missing)
                    fallbackPoles.push({ x: px, y: terrainYL + 0.375, z: pz });
                    fallbackGlows.push({ x: px, y: terrainYL + 0.78, z: pz });
                }
            }

            // Traffic lights at every road intersection (4-way and 3-way T) — check both terrain and roadMap
            {
                const isRoadAt2 = (x, y) => {
                    const t = this.game.map.getTileAt(x, y);
                    return t === TERRAIN_ROAD || t === TERRAIN_HIGHWAY || this.game.map.roadMap?.[y * this.game.map.width + x] === 1;
                };
                const n = isRoadAt2(tile.x, tile.y - 1) ? 1 : 0;
                const s = isRoadAt2(tile.x, tile.y + 1) ? 1 : 0;
                const e = isRoadAt2(tile.x + 1, tile.y) ? 1 : 0;
                const w = isRoadAt2(tile.x - 1, tile.y) ? 1 : 0;
                const deg = n + s + e + w;
                const isIntersection = deg >= 3;
                if (isIntersection && hash(tile.x, tile.y, 300) < 0.90) {
                    const terrainY = this._smoothTerrainY(tile.x, tile.y);
                    // corner offset so light clears the road
                    const ox = e ? 0.42 : w ? -0.42 : 0.35;
                    const oz = s ? 0.42 : n ? -0.42 : 0.35;
                    const tl = this._buildTrafficLight(wx + ox, terrainY, wz + oz);
                    objects.push(...tl);
                }
            }
        }

        // Instance the collected road variants + street lights (Q11.D).
        for (const [modelName, insts] of roadInstances) {
            const model = this._roadModels.get(modelName);
            objects.push(...this._buildInstancedModelParts(model, insts));
        }
        if (fallbackRoads.length > 0) {
            objects.push(this._buildInstancedRoadFallback(fallbackRoads));
        }
        if (streetLights.length > 0) {
            const lightModel = this._propModels.get('light-square');
            objects.push(...this._buildInstancedModelParts(lightModel, streetLights, { promote: false, isRoad: false }));
            objects.push(this._buildInstancedGlowSphere(lightGlows));
        }
        if (fallbackPoles.length > 0) {
            objects.push(this._buildInstancedPole(fallbackPoles));
            objects.push(this._buildInstancedGlowSphere(fallbackGlows));
        }

        return objects;
    }

    _promoteRoadMaterial(mat) {
        if (mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial) {
            // Promote to physical so wet weather can raise road clearcoat.
            // Copy at the *standard* level — MeshPhysicalMaterial.copy()
            // reads clearcoat vectors the source lacks and would crash.
            const phys = new THREE.MeshPhysicalMaterial();
            THREE.MeshStandardMaterial.prototype.copy.call(phys, mat);
            phys.clearcoat = 0;
            phys.clearcoatRoughness = 0.4;
            return phys;
        }
        return mat.clone();
    }

    _buildInstancedModelParts(model, instances, { promote = true, isRoad = true, receiveShadow } = {}) {
        model.updateWorldMatrix(true, false);
        const dummy = new THREE.Object3D();
        const meshes = [];

        model.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            const baseMat = Array.isArray(child.material) ? child.material[0] : child.material;
            if (!baseMat) return;
            const geo = child.geometry.clone();
            geo.applyMatrix4(child.matrixWorld);
            const mat = promote ? this._promoteRoadMaterial(baseMat) : baseMat.clone();
            const im = new THREE.InstancedMesh(geo, mat, instances.length);
            im.castShadow = true;
            im.receiveShadow = receiveShadow ?? isRoad;
            if (isRoad) im.userData.isRoad = true;
            for (let i = 0; i < instances.length; i++) {
                const t = instances[i];
                dummy.position.set(t.x, t.y, t.z);
                dummy.rotation.y = t.rotY;
                dummy.scale.setScalar(1);
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
            }
            im.instanceMatrix.needsUpdate = true;
            im.computeBoundingSphere();
            meshes.push(im);
        });

        return meshes;
    }

    _buildInstancedRoadFallback(instances) {
        const geo = new THREE.PlaneGeometry(1, 1);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({ color: 0x2e2e2e, roughness: 0.92, metalness: 0.0 });
        const im = new THREE.InstancedMesh(geo, mat, instances.length);
        im.castShadow = false;
        im.receiveShadow = true;
        im.userData.isRoad = true;
        const dummy = new THREE.Object3D();
        for (let i = 0; i < instances.length; i++) {
            const t = instances[i];
            dummy.position.set(t.x, t.y, t.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
        }
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        return im;
    }

    _buildInstancedGlowSphere(instances) {
        const geo = new THREE.SphereGeometry(0.042, 6, 4);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffd060, emissive: 0xffaa20, emissiveIntensity: 0.65,
            roughness: 0.4, metalness: 0.0,
        });
        const im = new THREE.InstancedMesh(geo, mat, instances.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < instances.length; i++) {
            const t = instances[i];
            dummy.position.set(t.x, t.y, t.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
        }
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        return im;
    }

    _buildInstancedPole(instances) {
        const geo = new THREE.CylinderGeometry(0.022, 0.022, 0.75, 5);
        const mat = new THREE.MeshStandardMaterial({ color: 0x303030, roughness: 0.7 });
        const im = new THREE.InstancedMesh(geo, mat, instances.length);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < instances.length; i++) {
            const t = instances[i];
            dummy.position.set(t.x, t.y, t.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.setScalar(1);
            dummy.updateMatrix();
            im.setMatrixAt(i, dummy.matrix);
        }
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        return im;
    }

    /**
     * Brushed-metal car-paint material (Q10.F). A metallic flake base under a
     * clearcoat with anisotropic specular, so the highlight streaks along the
     * body instead of forming a round hotspot — the signature look of
     * automotive paint and brushed metal.
     */
    _carPaintMaterial(hex, { roughness = 0.4, metalness = 0.55 } = {}) {
        return new THREE.MeshPhysicalMaterial({
            color: hex,
            roughness,
            metalness,
            clearcoat: 0.6,
            clearcoatRoughness: 0.2,
            anisotropy: 0.5,
            anisotropyRotation: Math.PI / 2,
        });
    }

    /** Procedural city bus model built from THREE primitives */
    _createProceduralBus() {
        const group = new THREE.Group();
        // Main body — elongated box
        const bodyGeom = new THREE.BoxGeometry(0.38, 0.22, 0.88);
        const bodyMat = this._carPaintMaterial(0x1a4a8a, { roughness: 0.5, metalness: 0.35 });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.set(0, 0.14, 0);
        body.castShadow = true;
        group.add(body);
        // Roof
        const roofGeom = new THREE.BoxGeometry(0.36, 0.04, 0.86);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x143a70, roughness: 0.7 });
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.set(0, 0.27, 0);
        group.add(roof);
        // Windows — side strips
        const winGeom = new THREE.BoxGeometry(0.01, 0.08, 0.72);
        const winMat = new THREE.MeshStandardMaterial({ color: 0xaaccee, roughness: 0.2, metalness: 0.1, emissive: 0x334455, emissiveIntensity: 0.2 });
        for (const side of [-0.195, 0.195]) {
            const win = new THREE.Mesh(winGeom, winMat);
            win.position.set(side, 0.17, 0);
            group.add(win);
        }
        // Wheels (4)
        const wheelGeom = new THREE.CylinderGeometry(0.06, 0.06, 0.05, 8);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9 });
        for (const [zOff, xOff] of [[-0.30, -0.20], [-0.30, 0.20], [0.30, -0.20], [0.30, 0.20]]) {
            const w = new THREE.Mesh(wheelGeom, wheelMat);
            w.rotation.z = Math.PI / 2;
            w.position.set(xOff, 0.06, zOff);
            group.add(w);
        }
        // Front destination sign (yellow strip)
        const signGeom = new THREE.BoxGeometry(0.28, 0.05, 0.01);
        const signMat = new THREE.MeshStandardMaterial({ color: 0xffdd00, emissive: 0xddaa00, emissiveIntensity: 0.4, roughness: 0.4 });
        const sign = new THREE.Mesh(signGeom, signMat);
        sign.position.set(0, 0.22, -0.445);
        group.add(sign);
        return group;
    }


    /** Enforce PBR materials on GLTF meshes (vehicles, buildings, props) */
    _enforcePBR(group) {
        group.traverse((child) => {
            if (!child.isMesh) return;
            const mat = child.material;
            if (!mat) return;
            // Already PBR — keep as-is
            if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) {
                // Ensure roughness/metalness defaults
                if (mat.roughness === undefined) mat.roughness = 0.7;
                if (mat.metalness === undefined) mat.metalness = 0.0;
                if (this._gi) this._gi.applyTo(mat);
                return;
            }
            // Convert non-PBR to MeshStandardMaterial
            const color = mat.color ? mat.color.getHex() : 0xcccccc;
            const emissive = mat.emissive ? mat.emissive.getHex() : 0x000000;
            const emissiveIntensity = mat.emissiveIntensity || 0;
            const transparent = mat.transparent || false;
            const opacity = mat.opacity ?? 1.0;
            const map = mat.map || null;
            const wireframe = mat.wireframe || false;
            const side = mat.side || THREE.FrontSide;
            const newMat = new THREE.MeshStandardMaterial({
                color, emissive, emissiveIntensity, transparent, opacity,
                map, wireframe, side, roughness: 0.7, metalness: 0.0,
            });
            if (this._gi) this._gi.applyTo(newMat);
            child.material = newMat;
        });
    }
    /** Procedural traffic light: pole + housing + 3 signal lenses */
    _buildTrafficLight(px, py, pz) {
        const objects = [];
        // Pole
        const poleGeom = new THREE.CylinderGeometry(0.018, 0.018, 0.60, 5);
        const poleMat  = new THREE.MeshStandardMaterial({ color: 0x252525, roughness: 0.7 });
        const pole = new THREE.Mesh(poleGeom, poleMat);
        pole.position.set(px, py + 0.30, pz);
        pole.castShadow = true;
        objects.push(pole);
        // Housing box
        const boxGeom = new THREE.BoxGeometry(0.06, 0.16, 0.06);
        const boxMat  = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
        const box = new THREE.Mesh(boxGeom, boxMat);
        box.position.set(px, py + 0.60 + 0.08, pz);
        box.castShadow = true;
        objects.push(box);
        // Red light
        const redGeom = new THREE.SphereGeometry(0.020, 6, 4);
        const redMat  = new THREE.MeshStandardMaterial({ color: 0xdd2222, emissive: 0xcc1111, emissiveIntensity: 0.5, roughness: 0.3 });
        const red = new THREE.Mesh(redGeom, redMat);
        red.position.set(px, py + 0.60 + 0.14, pz + 0.032);
        objects.push(red);
        // Amber light
        const amberGeom = new THREE.SphereGeometry(0.020, 6, 4);
        const amberMat  = new THREE.MeshStandardMaterial({ color: 0x666600, emissive: 0x442200, emissiveIntensity: 0.2, roughness: 0.3 });
        const amber = new THREE.Mesh(amberGeom, amberMat);
        amber.position.set(px, py + 0.60 + 0.08, pz + 0.032);
        objects.push(amber);
        // Green light (active)
        const greenGeom = new THREE.SphereGeometry(0.020, 6, 4);
        const greenMat  = new THREE.MeshStandardMaterial({ color: 0x22bb22, emissive: 0x118811, emissiveIntensity: 0.5, roughness: 0.3 });
        const green = new THREE.Mesh(greenGeom, greenMat);
        green.position.set(px, py + 0.60 + 0.02, pz + 0.032);
        objects.push(green);
        return objects;
    }

    /** Procedural tunnel portal arch placed at tunnel entry/exit points */
    _buildTunnelPortal(px, py, pz, rotY) {
        const objects = [];
        // Arch frame
        const archMat = new THREE.MeshStandardMaterial({ color: 0x484038, roughness: 0.88 });
        // Left pillar
        const pilGeom = new THREE.BoxGeometry(0.12, 0.55, 0.14);
        const leftPil = new THREE.Mesh(pilGeom, archMat);
        leftPil.position.set(-0.38, py + 0.28, 0);
        leftPil.castShadow = true;
        // Right pillar
        const rightPil = new THREE.Mesh(pilGeom, archMat);
        rightPil.position.set(0.38, py + 0.28, 0);
        rightPil.castShadow = true;
        // Top beam
        const beamGeom = new THREE.BoxGeometry(0.90, 0.12, 0.14);
        const beam = new THREE.Mesh(beamGeom, archMat);
        beam.position.set(0, py + 0.50, 0);
        beam.castShadow = true;
        // Dark interior
        const intGeom = new THREE.BoxGeometry(0.68, 0.36, 0.05);
        const intMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1.0 });
        const interior = new THREE.Mesh(intGeom, intMat);
        interior.position.set(0, py + 0.23, 0.025);
        const group = new THREE.Group();
        group.add(leftPil, rightPil, beam, interior);
        group.position.set(px, 0, pz);
        group.rotation.y = rotY;
        objects.push(group);
        return objects;
    }

    /** Height per terrain type for the smooth heightmap */
    static TERRAIN_HEIGHT = {
        [TERRAIN_WATER]: -0.3,
        [TERRAIN_GRASS]: 0.05,
        [TERRAIN_FOREST]: 0.18,
        [TERRAIN_MOUNTAIN]: 1.4,
        [TERRAIN_ROAD]: 0.04,
        [TERRAIN_SIDEWALK]: 0.06,
        [TERRAIN_PARK]: 0.07,
        [TERRAIN_HIGHWAY]: 0.12,   // slightly elevated above road
        [TERRAIN_BRIDGE]:  0.35,   // raised for bridge
        [TERRAIN_TUNNEL]:  0.04,   // same as road (goes underground)
    };

    _buildTerrainMeshesForChunk(bounds) {
        const meshes = [];
        const waterTiles = [];
        const roadTiles = [];
        const sidewalkTiles = [];
        const highwayTiles = [];
        const bridgeTiles = [];
        const tunnelTiles = [];

        const width = bounds.maxX - bounds.minX + 1;
        const height = bounds.maxY - bounds.minY + 1;

        // Collect water/road tiles separately; build a smooth heightmap for the rest
        const tileGrid = [];
        const mapW = this.game.map.width;
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            const row = [];
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const terrain = this.game.map.getTileAt(x, y);
                row.push(terrain);
                if (terrain === TERRAIN_WATER) waterTiles.push({ x, y });
                // Real city grid lives in roadMap — terrain is all grass in new urban maps.
                const onRoadMap = this.game.map.roadMap?.[y * mapW + x] === 1;
                const onWalk = this.game.map.sidewalkMap?.[y * mapW + x] === 1;
                if (terrain === TERRAIN_ROAD || onRoadMap) roadTiles.push({ x, y });
                else if (onWalk || terrain === TERRAIN_SIDEWALK) sidewalkTiles.push({ x, y });
                if (terrain === TERRAIN_HIGHWAY) highwayTiles.push({ x: x, y: y });
                if (terrain === TERRAIN_BRIDGE) bridgeTiles.push({ x: x, y: y });
                if (terrain === TERRAIN_TUNNEL) tunnelTiles.push({ x: x, y: y });
            }
            tileGrid.push(row);
        }
        // De-duplicate (roadMap+terrain overlap)
        if (roadTiles.length > 1) {
            const seen = new Set();
            const uniq = [];
            for (const t of roadTiles) { const k = `${t.x},${t.y}`; if (!seen.has(k)) { seen.add(k); uniq.push(t); } }
            roadTiles.length = 0; roadTiles.push(...uniq);
        }
        if (sidewalkTiles.length > 1) {
            const seen = new Set();
            const uniq = [];
            for (const t of sidewalkTiles) { const k = `${t.x},${t.y}`; if (!seen.has(k)) { seen.add(k); uniq.push(t); } }
            sidewalkTiles.length = 0; sidewalkTiles.push(...uniq);
        }

        // Water: animated plane
        if (waterTiles.length > 0) {
            meshes.push(...this._buildWaterMeshForTiles(waterTiles));
        }

        // Sidewalks: light concrete slabs framing the streets (GTA curb)
        if (sidewalkTiles.length > 0) {
            const swGeom = new THREE.PlaneGeometry(1, 1);
            swGeom.rotateX(-Math.PI / 2);
            const swMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.9, metalness: 0.0 });
            const swMesh = new THREE.InstancedMesh(swGeom, swMat, sidewalkTiles.length);
            swMesh.receiveShadow = true;
            swMesh.userData.isRoad = true;
            const dSw = new THREE.Object3D();
            for (let i = 0; i < sidewalkTiles.length; i++) {
                const t = sidewalkTiles[i];
                const wx = t.x - this._mapHalfW + 0.5;
                const wz = t.y - this._mapHalfH + 0.5;
                dSw.position.set(wx, this._smoothTerrainY(t.x, t.y) + 0.012, wz);
                dSw.updateMatrix();
                swMesh.setMatrixAt(i, dSw.matrix);
            }
            swMesh.instanceMatrix.needsUpdate = true;
            meshes.push(swMesh);
        }

        // Roads: 3D road models
        if (roadTiles.length > 0 && this._roadModels.size > 0) {
            meshes.push(...this._buildRoadMeshesForTiles(roadTiles, bounds));
        }

        // --- Smooth heightmap terrain ---
        // One extra vertex per edge for smooth interpolation (segs = tiles)
        const segsX = width;
        const segsZ = height;
        const geom = new THREE.PlaneGeometry(width, height, segsX, segsZ);
        geom.rotateX(-Math.PI / 2);

        const pos = geom.getAttribute('position');
        const colors = new Float32Array(pos.count * 3);
        const terrainHeights = Renderer3D.TERRAIN_HEIGHT;
        const tmpColor = new THREE.Color();

        // Helper: get terrain height with bounds clamping
        const getH = (gx, gy) => {
            const t = this.game.map.getTileAt(
                Math.max(0, Math.min(this.game.map.width - 1, gx)),
                Math.max(0, Math.min(this.game.map.height - 1, gy))
            );
            return terrainHeights[t] ?? 0.05;
        };

        const getColor = (gx, gy) => {
            const t = this.game.map.getTileAt(
                Math.max(0, Math.min(this.game.map.width - 1, gx)),
                Math.max(0, Math.min(this.game.map.height - 1, gy))
            );
            return terrainTint(t);
        };

        // Offset: position the plane so its tiles align with world coordinates
        const originX = bounds.minX - this._mapHalfW;
        const originZ = bounds.minY - this._mapHalfH;
        const dryColor = new THREE.Color(0xc2bd92); // pale, sun-dried tint for high ground
        const meadowColor = new THREE.Color(0x6f9a48); // deeper meadow green for tonal patches
        const grimeColor = new THREE.Color(0x55605a); // wet, algae-grey film for the docks
        const oilColor = new THREE.Color(0x231f1d); // scorched oil-stain near-black for industry

        for (let iz = 0; iz <= segsZ; iz++) {
            for (let ix = 0; ix <= segsX; ix++) {
                const vi = iz * (segsX + 1) + ix;

                // World position
                const wx = originX + ix;
                const wz = originZ + iz;

                // Grid position (tile coords)
                const gx = bounds.minX + ix;
                const gy = bounds.minY + iz;

                // Smooth height: average with neighbors for interpolation
                const h0 = getH(gx, gy);
                const hN = getH(gx, gy - 1);
                const hS = getH(gx, gy + 1);
                const hE = getH(gx + 1, gy);
                const hW = getH(gx - 1, gy);
                const smoothH = h0 * 0.5 + (hN + hS + hE + hW) * 0.125;

                // Water tiles should be flat and low (water plane handles visuals)
                const t = this.game.map.getTileAt(
                    Math.min(gx, this.game.map.width - 1),
                    Math.min(gy, this.game.map.height - 1)
                );
                const elev = this._baseElevation(gx, gy);
                const finalH = t === TERRAIN_WATER ? -0.2 : smoothH + elev;

                pos.setXYZ(vi, wx, finalH, wz);

                // Vertex color based on terrain type, broken up so the ground
                // never reads as a flat uniform sheet.
                tmpColor.setHex(getColor(gx, gy));
                if (t !== TERRAIN_WATER) {
                    // Large-scale brightness drift (±7%) + drier, paler crests.
                    const drift = 0.93 + this._valueNoise(gx / 13 + 50, gy / 13 + 50) * 0.14;
                    tmpColor.multiplyScalar(drift);
                    tmpColor.lerp(dryColor, Math.min(0.16, elev * 0.11));
                    // Soft, large-scale meadow patches on planted ground so the
                    // green has natural tonal variation instead of one flat hue.
                    if (t === TERRAIN_GRASS || t === TERRAIN_FOREST || t === TERRAIN_PARK) {
                        const patch = this._valueNoise(gx / 19 + 200, gy / 19 + 200);
                        tmpColor.lerp(meadowColor, patch * 0.30);
                    }
                    // Docks bias (Q10.H): wet grime film — darkened ground broken up
                    // by puddle-shaped patches so the dockside reads damp and worked.
                    const districtTheme = this._districtThemes?.get(this.game.map.getDistrictAt(gx, gy));
                    if (districtTheme === 'docks') {
                        const puddle = this._valueNoise(gx / 7 + 400, gy / 7 + 400);
                        tmpColor.lerp(grimeColor, 0.3 + puddle * 0.35);
                        tmpColor.multiplyScalar(0.82); // damp surfaces sit darker
                    } else if (districtTheme === 'industrial') {
                        // Industrial bias (Q10.H): scorch/oil staining — high-frequency
                        // dark blotches where spills and burns have soaked the ground.
                        const stain = this._valueNoise(gx / 5 + 600, gy / 5 + 600);
                        if (stain > 0.5) tmpColor.lerp(oilColor, (stain - 0.5) * 1.4);
                        tmpColor.multiplyScalar(0.88); // sooty, light-starved ground
                    }
                }
                colors[vi * 3] = tmpColor.r;
                colors[vi * 3 + 1] = tmpColor.g;
                colors[vi * 3 + 2] = tmpColor.b;
            }
        }

        pos.needsUpdate = true;
        geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geom.computeVertexNormals();

        // Material: vertex colors blended with tiling PBR terrain texture (1 repeat per tile)
        // Determine terrain texture: prefer grass/forest unless heavily mountainous
        const typeCount = new Map();
        for (const row of tileGrid) for (const t of row) typeCount.set(t, (typeCount.get(t) || 0) + 1);
        const totalNonWater = [...typeCount.entries()].filter(([t]) => t !== TERRAIN_WATER).reduce((s, [, c]) => s + c, 0);
        const mountainFrac = (typeCount.get(TERRAIN_MOUNTAIN) || 0) / Math.max(1, totalNonWater);
        // Only use rock texture if chunk is >60% mountain
        const dominantTerrain = mountainFrac > 0.6 ? TERRAIN_MOUNTAIN : TERRAIN_GRASS;

        const cloneTex = (src) => {
            if (!src) return null;
            const t = src.clone();
            t.wrapS = t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(width, height);
            t.needsUpdate = true;
            return t;
        };
        let baseTex = this._terrainTextures.get(dominantTerrain)
            ?? this._terrainTextures.get(TERRAIN_GRASS)
            ?? this._terrainTextures.get(0);
        if (!baseTex) baseTex = this._getProceduralTerrainTexture(dominantTerrain);
        const baseNorm = this._terrainNormals?.get(dominantTerrain) ?? this._terrainNormals?.get(TERRAIN_GRASS);
        const tex = cloneTex(baseTex);
        const normTex = cloneTex(baseNorm);

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            map: tex || null,
            normalMap: normTex || null,
            normalScale: new THREE.Vector2(0.6, 0.6),
            roughness: 0.88,
            metalness: 0.0,
            envMapIntensity: 0.4,
        });
        // Terrain is the dominant GI receiver — sample the bounce grid (Q10.G).
        if (this._gi) this._gi.applyTo(mat);

        const terrainMesh = new THREE.Mesh(geom, mat);
        terrainMesh.castShadow = false;
        terrainMesh.receiveShadow = true;
        meshes.push(terrainMesh);

        // Bake GI bounce albedo for this chunk's probes from the ground tint
        // beneath each one (Q10.G irradiance volumes, loaded at chunk-load).
        if (this._gi) {
            const giTmp = new THREE.Color();
            const moodTmp = new THREE.Color();
            this._gi.bakeRegion(
                bounds.minX - this._mapHalfW, bounds.minY - this._mapHalfH,
                bounds.maxX - this._mapHalfW + 1, bounds.maxY - this._mapHalfH + 1,
                (wx, wz) => {
                    const tx = Math.round(wx + this._mapHalfW - 0.5);
                    const ty = Math.round(wz + this._mapHalfH - 0.5);
                    const cx = Math.max(0, Math.min(this.game.map.width - 1, tx));
                    const cy = Math.max(0, Math.min(this.game.map.height - 1, ty));
                    giTmp.setHex(terrainTint(this.game.map.getTileAt(cx, cy)));
                    // Pull the bounce toward this district's mood colour (Q10.H).
                    const theme = this._districtThemes?.get(this.game.map.getDistrictAt(cx, cy));
                    const tint = theme && Renderer3D.DISTRICT_GI_TINT[theme];
                    if (tint) giTmp.lerp(moodTmp.setHex(tint.hex), tint.amt);
                    return giTmp;
                });
        }

        // Road fallback: flat asphalt slabs for roads when no GLTF models loaded
        if (roadTiles.length > 0 && this._roadModels.size === 0) {
            const roadGeom = new THREE.PlaneGeometry(1, 1);
            roadGeom.rotateX(-Math.PI / 2);
            const roadMat = new THREE.MeshPhysicalMaterial({
                color: 0x323232,
                roughness: 0.9,
                metalness: 0.0,
                clearcoat: 0,
                clearcoatRoughness: 0.4,
                // Anisotropic specular (Q10.F): asphalt aggregate streaks the
                // highlight lengthwise down the road, strongest when wet.
                anisotropy: 0.55,
                anisotropyRotation: Math.PI / 2,
            });
            const roadMesh = new THREE.InstancedMesh(roadGeom, roadMat, roadTiles.length);
            roadMesh.receiveShadow = true;
            roadMesh.userData.isRoad = true;
            roadMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
            const dummy = new THREE.Object3D();
            for (let i = 0; i < roadTiles.length; i++) {
                const tile = roadTiles[i];
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                dummy.position.set(wx, 0.09, wz);
                dummy.updateMatrix();
                roadMesh.setMatrixAt(i, dummy.matrix);
            }
            roadMesh.instanceMatrix.needsUpdate = true;
            meshes.push(roadMesh);
        }

        // Highway: elevated dark slab + optional center barrier
        if (highwayTiles.length > 0) {
            const hwGeom = new THREE.BoxGeometry(1.0, 0.06, 1.0);
            const hwMat = new THREE.MeshStandardMaterial({ color: 0x484050, roughness: 0.95, metalness: 0.0 });
            const hwMesh = new THREE.InstancedMesh(hwGeom, hwMat, highwayTiles.length);
            hwMesh.receiveShadow = true;
            const dummy = new THREE.Object3D();
            for (let i = 0; i < highwayTiles.length; i++) {
                const tile = highwayTiles[i];
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                dummy.position.set(wx, 0.12, wz);
                dummy.updateMatrix();
                hwMesh.setMatrixAt(i, dummy.matrix);
            }
            hwMesh.instanceMatrix.needsUpdate = true;
            meshes.push(hwMesh);
            // White lane markings on highway
            const markGeom = new THREE.PlaneGeometry(0.08, 0.40);
            markGeom.rotateX(-Math.PI / 2);
            const markMat = new THREE.MeshStandardMaterial({ color: 0xe8e4d0, roughness: 0.9 });
            const markMesh = new THREE.InstancedMesh(markGeom, markMat, highwayTiles.length * 2);
            markMesh.receiveShadow = false;
            let mi = 0;
            for (const tile of highwayTiles) {
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                for (const side of [-0.25, 0.25]) {
                    dummy.position.set(wx + side, 0.125, wz);
                    dummy.updateMatrix();
                    markMesh.setMatrixAt(mi++, dummy.matrix);
                }
            }
            markMesh.instanceMatrix.needsUpdate = true;
            meshes.push(markMesh);
            
            // Glowing edge strips for night lighting (runway-style lights)
            const stripGeom = new THREE.BoxGeometry(1.0, 0.05, 0.08);
            const stripMat = new THREE.MeshStandardMaterial({
                color: 0xffee88,
                emissive: 0xffee88,
                emissiveIntensity: 0.0,
                roughness: 0.3,
                metalness: 0.0
            });
            const stripMesh = new THREE.InstancedMesh(stripGeom, stripMat, highwayTiles.length * 2);
            stripMesh.receiveShadow = false;
            stripMesh.castShadow = true;
            let si = 0;
            for (const tile of highwayTiles) {
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                for (const offset of [-0.48, 0.48]) {
                    dummy.position.set(wx + offset, 0.18, wz);
                    dummy.updateMatrix();
                    stripMesh.setMatrixAt(si++, dummy.matrix);
                }
            }
            stripMesh.instanceMatrix.needsUpdate = true;
            meshes.push(stripMesh);
            
            // Store reference for day/night updates
            if (!this._highwayLightStrips) this._highwayLightStrips = [];
            this._highwayLightStrips.push(stripMesh);
            
            // Center divider (median strip) - raised barrier down the middle
            const medianGeom = new THREE.BoxGeometry(0.12, 0.08, 1.0);
            const medianMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.85, metalness: 0.0 });
            const medianMesh = new THREE.InstancedMesh(medianGeom, medianMat, highwayTiles.length);
            medianMesh.receiveShadow = true;
            medianMesh.castShadow = true;
            let medIdx = 0;
            for (const tile of highwayTiles) {
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                dummy.position.set(wx, 0.12 + 0.04, wz); // highwayElevation + 0.04
                dummy.updateMatrix();
                medianMesh.setMatrixAt(medIdx++, dummy.matrix);
            }
            medianMesh.instanceMatrix.needsUpdate = true;
            meshes.push(medianMesh);
        }

        // Bridge tiles — raised concrete slab with side railings
        if (bridgeTiles.length > 0) {
            const brGeom = new THREE.BoxGeometry(1.0, 0.10, 1.0);
            const brMat = new THREE.MeshStandardMaterial({ color: 0x8a7a60, roughness: 0.88, metalness: 0.05 });
            const brMesh = new THREE.InstancedMesh(brGeom, brMat, bridgeTiles.length);
            brMesh.receiveShadow = true;
            brMesh.castShadow = true;
            const dummy2 = new THREE.Object3D();
            for (let i = 0; i < bridgeTiles.length; i++) {
                const tile = bridgeTiles[i];
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                dummy2.position.set(wx, 0.35, wz);
                dummy2.updateMatrix();
                brMesh.setMatrixAt(i, dummy2.matrix);
            }
            brMesh.instanceMatrix.needsUpdate = true;
            meshes.push(brMesh);
            // Bridge railings (low wall on each side)
            const railGeom = new THREE.BoxGeometry(1.0, 0.12, 0.05);
            const railMat = new THREE.MeshStandardMaterial({ color: 0x707060, roughness: 0.85 });
            const railMesh = new THREE.InstancedMesh(railGeom, railMat, bridgeTiles.length * 2);
            let ri = 0;
            for (const tile of bridgeTiles) {
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                for (const side of [-0.48, 0.48]) {
                    dummy2.position.set(wx, 0.44, wz + side);
                    dummy2.rotation.set(0, 0, 0);
                    dummy2.updateMatrix();
                    railMesh.setMatrixAt(ri++, dummy2.matrix);
                }
            }
            railMesh.instanceMatrix.needsUpdate = true;
            railMesh.castShadow = true;
            meshes.push(railMesh);
            // Bridge support pillars (vertical box below bridge deck)
            const pilGeom = new THREE.BoxGeometry(0.18, 0.35, 0.18);
            const pilMat = new THREE.MeshStandardMaterial({ color: 0x706858, roughness: 0.90 });
            const pilMesh = new THREE.InstancedMesh(pilGeom, pilMat, bridgeTiles.length * 2);
            let pi = 0;
            for (const tile of bridgeTiles) {
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                for (const offset of [-0.28, 0.28]) {
                    dummy2.position.set(wx + offset, 0.175, wz);
                    dummy2.rotation.set(0, 0, 0);
                    dummy2.updateMatrix();
                    pilMesh.setMatrixAt(pi++, dummy2.matrix);
                }
            }
            pilMesh.instanceMatrix.needsUpdate = true;
            pilMesh.castShadow = true;
            meshes.push(pilMesh);
        }

        // Tunnel tiles — dark slab flush with terrain + archway portals at open edges
        if (tunnelTiles.length > 0) {
            const tunGeom = new THREE.PlaneGeometry(1, 1);
            tunGeom.rotateX(-Math.PI / 2);
            const tunMat = new THREE.MeshStandardMaterial({ color: 0x282828, roughness: 0.98, metalness: 0 });
            const tunMesh = new THREE.InstancedMesh(tunGeom, tunMat, tunnelTiles.length);
            tunMesh.receiveShadow = true;
            const dummy3 = new THREE.Object3D();
            for (let i = 0; i < tunnelTiles.length; i++) {
                const tile = tunnelTiles[i];
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                dummy3.position.set(wx, 0.05, wz);
                dummy3.updateMatrix();
                tunMesh.setMatrixAt(i, dummy3.matrix);
            }
            tunMesh.instanceMatrix.needsUpdate = true;
            meshes.push(tunMesh);

            // Archway portals at each tunnel edge that borders a non-tunnel tile
            const PORTAL_DIRS = [
                { dx:  0, dy: -1, rotY: 0            },  // N edge → face north
                { dx:  0, dy:  1, rotY: Math.PI       },  // S edge → face south
                { dx:  1, dy:  0, rotY: -Math.PI / 2  },  // E edge → face east
                { dx: -1, dy:  0, rotY:  Math.PI / 2  },  // W edge → face west
            ];
            for (const tile of tunnelTiles) {
                const wx = tile.x - this._mapHalfW + 0.5;
                const wz = tile.y - this._mapHalfH + 0.5;
                const terrainY = this._smoothTerrainY(tile.x, tile.y);
                for (const { dx, dy, rotY } of PORTAL_DIRS) {
                    const nb = this.game.map.getTileAt(tile.x + dx, tile.y + dy);
                    if (nb !== TERRAIN_TUNNEL) {
                        const portals = this._buildTunnelPortal(
                            wx + dx * 0.5, terrainY, wz + dy * 0.5, rotY
                        );
                        meshes.push(...portals);
                    }
                }
            }
        }

        return meshes;
    }

    /** Returns the smoothed terrain Y for a given tile (matches heightmap vertex logic) */
    // -------------------------------------------------------------------------
    // Continuous ground elevation — gentle rolling hills layered on top of the
    // per-tile terrain heights so the city sits in real, undulating land instead
    // of on a flat board. Pure hash-based value noise: deterministic from the
    // world seed, no RNG-stream consumption, no Math.random. Sampled by the
    // terrain mesh AND by every object that rests on the ground (buildings,
    // roads, trees, citizens, vehicles, the player) so nothing floats or sinks.
    // -------------------------------------------------------------------------

    /** Max added height (world units) of the rolling-hills field. */
    static ELEV_AMPLITUDE = 1.75;

    /** Y of the shared planar-reflection mirror — just above the -0.2 water bed. */
    static WATER_SURFACE_Y = -0.18;
    /** Y of the translucent animated wave plane — sits just above the mirror. */
    static WATER_PLANE_Y = -0.16;

    /**
     * Per-district art-direction mood tint (Q10.H), baked into the GI bounce so
     * each district reads as its own place: docks greenish-overcast, industrial
     * smoggy, suburbs warm-lawn, oldtown saturated-warm stone. `amt` is how far
     * the local ground albedo is pulled toward the mood colour.
     */
    static DISTRICT_GI_TINT = {
        docks: { hex: 0x8fa39a, amt: 0.38 },
        industrial: { hex: 0x9a8d77, amt: 0.38 },
        suburbs: { hex: 0xd7c886, amt: 0.32 },
        oldtown: { hex: 0xc78a52, amt: 0.34 },
    };

    /** Integer hash → [0,1), seeded once from the world seed. */
    _elevHash(ix, iz) {
        if (this._elevSeed === undefined) {
            this._elevSeed = ((this.game?.state?.meta?.seed ?? 1) >>> 0) || 1;
        }
        let h = (Math.imul(ix | 0, 374761393) + Math.imul(iz | 0, 668265263) + Math.imul(this._elevSeed, 2246822519)) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    }

    /** Smooth bilinear value noise at continuous tile coordinates. */
    _valueNoise(x, z) {
        const x0 = Math.floor(x), z0 = Math.floor(z);
        const fx = x - x0, fz = z - z0;
        const sx = fx * fx * (3 - 2 * fx);
        const sz = fz * fz * (3 - 2 * fz);
        const n00 = this._elevHash(x0, z0), n10 = this._elevHash(x0 + 1, z0);
        const n01 = this._elevHash(x0, z0 + 1), n11 = this._elevHash(x0 + 1, z0 + 1);
        return (n00 + (n10 - n00) * sx) * (1 - sz) + (n01 + (n11 - n01) * sx) * sz;
    }

    _getProceduralTerrainTexture(type) {
        if (!this._procTerrainCache) this._procTerrainCache = new Map();
        if (this._procTerrainCache.has(type)) return this._procTerrainCache.get(type);
        const hex = TERRAIN_COLORS[type] ?? '#5a7f3a';
        const base = new THREE.Color(hex);
        const cv = document.createElement('canvas');
        cv.width = cv.height = 256;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = `rgb(${base.r * 255 | 0},${base.g * 255 | 0},${base.b * 255 | 0})`;
        ctx.fillRect(0, 0, 256, 256);
        const isMountain = type === TERRAIN_MOUNTAIN;
        const isForest = type === TERRAIN_FOREST;
        for (let y = 0; y < 256; y += 2) {
            for (let x = 0; x < 256; x += 2) {
                const n = this._valueNoise(x * 0.08 + type * 19, y * 0.08 + type * 27);
                const v = (n - 0.5) * (isMountain ? 38 : isForest ? 22 : 18);
                const spots = isMountain ? (n > 0.72 ? 1 : 0) : 0;
                if (spots || Math.abs(v) > 5) {
                    const a = isMountain ? 0.22 : 0.12;
                    ctx.fillStyle = v > 0
                        ? `rgba(255,255,255,${a})`
                        : `rgba(0,0,0,${a})`;
                    ctx.fillRect(x, y, 2, 2);
                }
                if (isForest && n > 0.68 && (x % 16 === 0) && (y % 16 === 0)) {
                    ctx.fillStyle = 'rgba(18,38,22,0.16)';
                    ctx.fillRect(x - 2, y - 2, 6, 6);
                }
            }
        }
        if (isMountain) {
            ctx.strokeStyle = 'rgba(0,0,0,0.10)';
            ctx.lineWidth = 1;
            for (let i = 0; i < 16; i++) {
                const x = (this._valueNoise(i * 7.3, type * 3.1) * 256) | 0;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x + 8 - this._valueNoise(i * 2.1, 19) * 16, 256);
                ctx.stroke();
            }
        }
        const tex = new THREE.CanvasTexture(cv);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = 4;
        this._procTerrainCache.set(type, tex);
        return tex;
    }

    /**
     * Additive rolling-hills height (≥ 0) at continuous tile coordinates.
     * Three octaves: broad swells, medium folds, fine surface detail.
     * Urban maps (CITY/MEGA) are flat — Watch Dogs/GTA don't put skyscrapers on mountains.
     */
    _baseElevation(gx, gz) {
        // Flat slab for any urban-sized map; hills only for tiny test maps.
        if ((this.game?.map?.width ?? 0) >= 40) return 0;
        const o1 = this._valueNoise(gx / 24, gz / 24);
        const o2 = this._valueNoise(gx / 9, gz / 9);
        const o3 = this._valueNoise(gx / 3.5, gz / 3.5);
        let n = o1 * 0.60 + o2 * 0.28 + o3 * 0.12;
        n = n * n * (3 - 2 * n); // smoothstep — flatter lowlands, rounded crests
        return n * Renderer3D.ELEV_AMPLITUDE;
    }

    /** Ground elevation at a world-space (x, z) position. */
    _elevAtWorld(wx, wz) {
        return this._baseElevation(wx + this._mapHalfW, wz + this._mapHalfH);
    }

    _smoothTerrainY(tx, ty) {
        const th = Renderer3D.TERRAIN_HEIGHT;
        const getH = (x, y) => {
            const t = this.game.map.getTileAt(
                Math.max(0, Math.min(this.game.map.width - 1, x)),
                Math.max(0, Math.min(this.game.map.height - 1, y))
            );
            return th[t] ?? 0.1;
        };
        const h0 = getH(tx, ty);
        const hN = getH(tx, ty - 1);
        const hS = getH(tx, ty + 1);
        const hE = getH(tx + 1, ty);
        const hW = getH(tx - 1, ty);
        return h0 * 0.5 + (hN + hS + hE + hW) * 0.125 + this._baseElevation(tx + 0.5, ty + 0.5);
    }

    _buildBuildingMeshesForChunk(bounds, buildings) {
        const objects = [];
        const boxGroups = new Map(); // type -> building[]
        // Variant -> instance records for the instanced build (Q11.D).
        const buildingInstances = new Map();
        const glowBuildings = []; // world bboxes of tall skyscrapers for window glow
        const dummy = new THREE.Object3D();

        for (const b of buildings) {
            if (b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY) continue;
            // Select model variant for visual diversity
            let model = this._gltfModels.get(b.type);
            let useSkyscraperScale = false;
            if (b.type === 'house' && Renderer3D.HOUSE_VARIANTS.length > 0) {
                const variantIdx = (b.id || 0) % Renderer3D.HOUSE_VARIANTS.length;
                const variantModel = this._gltfModels.get(`house-variant-${variantIdx}`);
                if (variantModel) model = variantModel;
            } else if (Renderer3D.SKYSCRAPER_TYPES.has(b.type)) {
                // Pick skyscraper variant by position hash for spatial variety
                const h = (((b.x * 374761393 + b.y * 668265263) >>> 0) % Renderer3D.SKYSCRAPER_VARIANTS.length);
                const variantModel = this._gltfModels.get(`skyscraper-variant-${h}`);
                if (variantModel) { model = variantModel; useSkyscraperScale = true; }
            }
            if (model) {
                const wx = b.x - this._mapHalfW + 0.5;
                const wz = b.y - this._mapHalfH + 0.5;
                const terrainY = this._smoothTerrainY(b.x, b.y);
                const rotY = ((b.rotation ?? ((b.id || 0) % 4)) % 4) * (Math.PI / 2);
                const bldColor = new THREE.Color(buildingPaletteColor(b.type, b.id));
                const isGlassType = Renderer3D.SKYSCRAPER_TYPES.has(b.type);

                dummy.position.set(wx, terrainY, wz);
                dummy.rotation.y = rotY;
                if (useSkyscraperScale) {
                    const baseScale = Renderer3D.MODEL_SCALE[b.type] ?? Renderer3D.MODEL_SCALE.default;
                    // CBD pyramid: taller downtown, shorter suburbs
                    const heightHash = (((b.x * 2654435761) ^ (b.y * 2246822519)) >>> 0) / 4294967296;
                    const distFromCenter = Math.sqrt((b.x - this._mapHalfW) ** 2 + (b.y - this._mapHalfH) ** 2);
                    const centerFactor = Math.max(0, 1.0 - distFromCenter / 18);
                    dummy.scale.setScalar(baseScale * (0.55 + heightHash * 0.55 + centerFactor * 0.55));
                } else {
                    // Per-building proportional jitter (deterministic per tile) so
                    // same-type rows don't read as stamped clones.
                    const j1 = (((b.x * 2654435761) ^ (b.y * 2246822519)) >>> 0) / 4294967296;
                    const j2 = (((b.x * 40503) ^ (b.y * 12289) ^ 0x9e3779b9) >>> 0) / 4294967296;
                    dummy.scale.set(
                        model.scale.x * (0.90 + j1 * 0.20),
                        model.scale.y * (0.82 + j2 * 0.55),
                        model.scale.z * (0.90 + (1 - j1) * 0.20)
                    );
                }
                dummy.updateMatrix();

                if (!buildingInstances.has(model)) buildingInstances.set(model, []);
                buildingInstances.get(model).push({
                    matrix: dummy.matrix.clone(),
                    bldColor, isGlassType,
                    facadeTile: Renderer3D.FACADE_TILE[b.type] ?? 2,
                });

                // Rooftop clutter + lit-window glow derive from the world bbox.
                if (Renderer3D.ROOFTOP_DETAIL_TYPES.has(b.type) || useSkyscraperScale) {
                    if (!this._buildingModelBoxes) this._buildingModelBoxes = new Map();
                    let modelBox = this._buildingModelBoxes.get(model);
                    if (!modelBox) {
                        modelBox = new THREE.Box3().setFromObject(model);
                        this._buildingModelBoxes.set(model, modelBox);
                    }
                    const worldBox = modelBox.clone().applyMatrix4(dummy.matrix);
                    if (Renderer3D.ROOFTOP_DETAIL_TYPES.has(b.type)) {
                        this._addRooftopPropsForBox(worldBox, b, objects);
                    }
                    if (useSkyscraperScale && worldBox.getSize(new THREE.Vector3()).y > 1.2) {
                        glowBuildings.push(worldBox);
                    }
                }
            } else {
                if (!boxGroups.has(b.type)) boxGroups.set(b.type, []);
                boxGroups.get(b.type).push(b);
            }
        }

        // Instance each building variant — one InstancedMesh per part per chunk
        // replaces per-building clones (Q11.D).
        for (const [model, instances] of buildingInstances) {
            objects.push(...this._buildInstancedBuildingModel(model, instances));
        }
        if (glowBuildings.length > 0) {
            const glow = this._buildInstancedWindowGlow(glowBuildings);
            if (glow) {
                objects.push(glow);
                if (!this._windowGlowMeshes) this._windowGlowMeshes = [];
                this._windowGlowMeshes.push(glow);
            }
        }

        // Box instanced mesh fallback for types without a loaded model
        const winTex = this._getWindowTexture();
        for (const [type, arr] of boxGroups.entries()) {
            if (arr.length === 0) continue;
            const baseH = (BUILDING_3D[type]?.height ?? 0.6) * 3.5;
            const isTall = baseH >= 1.2; // only office/commercial towers get window overlay
            const geom = new THREE.BoxGeometry(0.85, baseH, 0.85);
            const mat = new THREE.MeshStandardMaterial({
                color: buildingHex(type),
                roughness: isTall ? 0.55 : 0.75,
                metalness: isTall ? 0.08 : 0.02,
                map: isTall ? winTex : null,
                emissive: isTall ? new THREE.Color(0xffcc44) : new THREE.Color(0),
                emissiveMap: isTall ? winTex : null,
                emissiveIntensity: isTall ? 0.15 : 0,
            });
            const mesh = new THREE.InstancedMesh(geom, mat, arr.length);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            for (let i = 0; i < arr.length; i++) {
                const b = arr[i];
                const heightHash = (((b.x * 2654435761) ^ (b.y * 2246822519)) >>> 0) / 4294967296;
                const hVar = baseH * (0.75 + heightHash * 0.5);
                const wx = b.x - this._mapHalfW + 0.5;
                const wz = b.y - this._mapHalfH + 0.5;
                const terrainY = this._smoothTerrainY(b.x, b.y);
                dummy.position.set(wx, hVar / 2 + terrainY, wz);
                dummy.scale.set(1, hVar / baseH, 1);
                dummy.rotation.y = ((b.rotation ?? ((b.id || i) % 4)) % 4) * (Math.PI / 2);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
            objects.push(mesh);

            // Rooftop details for tall box-fallback buildings
            if (baseH >= 1.5) {
                const roofGeom = new THREE.BoxGeometry(0.25, 0.18, 0.25);
                const roofMat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.9 });
                const roofMesh = new THREE.InstancedMesh(roofGeom, roofMat, arr.length);
                roofMesh.castShadow = true;
                for (let i = 0; i < arr.length; i++) {
                    const b = arr[i];
                    const heightHash = (((b.x * 2654435761) ^ (b.y * 2246822519)) >>> 0) / 4294967296;
                    const hVar = baseH * (0.75 + heightHash * 0.5);
                    const wx = b.x - this._mapHalfW + 0.5;
                    const wz = b.y - this._mapHalfH + 0.5;
                    const terrainY = this._smoothTerrainY(b.x, b.y);
                    const offsetX = (heightHash - 0.5) * 0.3;
                    dummy.position.set(wx + offsetX, hVar + 0.09 + terrainY, wz);
                    dummy.scale.set(1, 1, 1);
                    dummy.rotation.y = 0;
                    dummy.updateMatrix();
                    roofMesh.setMatrixAt(i, dummy.matrix);
                }
                roofMesh.instanceMatrix.needsUpdate = true;
                objects.push(roofMesh);
            }
        }
        return objects;
    }

    /**
     * Add deterministic rooftop clutter (AC units, a water tank, a vent) on top
     * of a placed building. Props are world-space siblings pushed into `out`, so
     * they dispose with the chunk group and aren't distorted by the building's
     * per-instance scale. Shared geometry + materials keep them cheap.
     */
    _addRooftopPropsForBox(bbox, b, out) {
        const sx = bbox.max.x - bbox.min.x;
        const sz = bbox.max.z - bbox.min.z;
        const sy = bbox.max.y - bbox.min.y;
        if (sy < 0.45 || sx < 0.25 || sz < 0.25) return; // too small to read
        const topY = bbox.max.y;
        const cx = (bbox.min.x + bbox.max.x) * 0.5;
        const cz = (bbox.min.z + bbox.max.z) * 0.5;

        if (!this._roofBoxGeo) {
            this._roofBoxGeo = new THREE.BoxGeometry(1, 1, 1);
            this._roofCylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
            this._roofMetalMat = new THREE.MeshStandardMaterial({ color: 0x9097a0, roughness: 0.65, metalness: 0.35 });
            this._roofDarkMat = new THREE.MeshStandardMaterial({ color: 0x565b63, roughness: 0.8, metalness: 0.2 });
        }
        const hash = (salt) => {
            let h = ((b.x * 374761393 + b.y * 668265263 + salt * 2147483647) >>> 0);
            h = ((h ^ (h >> 13)) * 1274126177) >>> 0;
            return ((h ^ (h >> 16)) >>> 0) / 4294967296;
        };
        const insetX = sx * 0.32, insetZ = sz * 0.32;
        const place = (geo, mat, px, pz, w, h, d) => {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(cx + px, topY + h * 0.5, cz + pz);
            m.scale.set(w, h, d);
            m.castShadow = true; m.receiveShadow = true;
            out.push(m);
        };
        // 1–3 AC units
        const acN = 1 + Math.floor(hash(1) * 3);
        for (let i = 0; i < acN; i++) {
            const w = 0.10 + hash(i * 7 + 4) * 0.08;
            place(this._roofBoxGeo, this._roofDarkMat,
                (hash(i * 7 + 2) - 0.5) * insetX * 2, (hash(i * 7 + 3) - 0.5) * insetZ * 2,
                w, 0.06 + hash(i * 7 + 5) * 0.05, w);
        }
        // Occasional water tank
        if (hash(20) > 0.55) {
            const r = 0.07 + hash(21) * 0.05;
            place(this._roofCylGeo, this._roofMetalMat,
                (hash(22) - 0.5) * insetX, (hash(23) - 0.5) * insetZ,
                r * 2, 0.16 + hash(24) * 0.10, r * 2);
        }
        // Vent pipe
        if (hash(30) > 0.4) {
            place(this._roofBoxGeo, this._roofMetalMat,
                (hash(31) - 0.5) * insetX, (hash(32) - 0.5) * insetZ,
                0.04, 0.10 + hash(33) * 0.08, 0.04);
        }
    }

    // Building part role: the per-building recolor logic (brightness gate then
    // size class) is replayed per variant once; per-building colours land in
    // instanceColor so one InstancedMesh serves many buildings.
    _classifyBuildingPart(baseMat, child) {
        if (!baseMat.color) return 'keep';
        const lum = baseMat.color.r * 0.299 + baseMat.color.g * 0.587 + baseMat.color.b * 0.114;
        if (lum <= 0.25) return 'keep';
        const size = new THREE.Box3().setFromObject(child).getSize(new THREE.Vector3());
        if (size.x < 0.15 && size.z < 0.15) return 'window';
        if (size.y < 0.08) return 'roof';
        return 'facade';
    }

    _makeBuildingRoleMaterial(baseMat, role, isGlass) {
        const m = baseMat.clone();
        if (role === 'window') {
            m.color.set(0xffee88);
            m.emissive = new THREE.Color(0xffcc44);
            m.emissiveIntensity = 0.8;
            m.roughness = 0.1;
            m.metalness = 0.0;
        } else if (role === 'roof') {
            m.color.set(0xffffff); // tinted via instanceColor (bldColor * 0.62)
            m.roughness = 0.85;
            m.metalness = 0.0;
        } else if (role === 'facade') {
            m.color.set(0xffffff); // tinted via instanceColor (palette colour)
            m.map = this._getFacadeAtlas();
            m.roughness = isGlass ? 0.35 : 0.65;
            m.metalness = isGlass ? 0.18 : 0.03;
            m.envMapIntensity = isGlass ? 1.2 : 0.6;
        }
        return m;
    }

    // Replace a part's UVs with a box projection into its atlas tile: the
    // dominant normal axis picks the projection plane, so each face samples the
    // tile continuously. Used for building facades and vehicle surfaces.
    _regenerateBoxUVs(geo, tileIndex, grid, freq) {
        const pos = geo.getAttribute('position');
        const norm = geo.getAttribute('normal');
        if (!pos || !norm) return;
        const tw = 1 / grid, th = 1 / grid;
        const tx = tileIndex % grid, ty = Math.floor(tileIndex / grid);
        const uvs = new Float32Array(pos.count * 2);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
            const ax = Math.abs(norm.getX(i)), ay = Math.abs(norm.getY(i)), az = Math.abs(norm.getZ(i));
            let u, v;
            if (ax >= ay && ax >= az) { u = z; v = y; }
            else if (az >= ay && az >= ax) { u = x; v = y; }
            else { u = x; v = z; }
            uvs[i * 2] = tx * tw + (u * freq - Math.floor(u * freq)) * tw;
            uvs[i * 2 + 1] = ty * th + (v * freq - Math.floor(v * freq)) * th;
        }
        geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }

    /** Number of vehicle-atlas tiles along each axis (2×2 grid). */
    static VEHICLE_ATLAS_GRID = 2;

    /** Shared vehicle-surface atlas (q11-tx-atlas-vehicles): paint/tire/glass/chrome. */
    _getVehicleAtlas() {
        if (this._vehicleAtlas) return this._vehicleAtlas;
        const grid = Renderer3D.VEHICLE_ATLAS_GRID;
        const size = 256;
        const cv = document.createElement('canvas');
        cv.width = cv.height = grid * size;
        const ctx = cv.getContext('2d');
        for (let i = 0; i < grid * grid; i++) {
            const tx = i % grid, ty = Math.floor(i / grid);
            ctx.save();
            ctx.translate(tx * size, ty * size);
            this._drawVehicleTile(ctx, size, i);
            ctx.restore();
        }
        this._vehicleAtlas = new THREE.CanvasTexture(cv);
        this._vehicleAtlas.anisotropy = 4;
        return this._vehicleAtlas;
    }

    _drawVehicleTile(ctx, s, idx) {
        const h2 = (x, y) => {
            let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) >>> 0;
            h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
            return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
        };
        const fill = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
        const noise = (x, y, amp) => (h2(Math.floor(x), Math.floor(y)) - 0.5) * amp;

        if (idx === 0) {
            // Car paint: light metallic base (tinted per vehicle) with panel
            // seams and a sheen so bodies don't read as flat plastic.
            fill(0, 0, s, s, '#c8cdd4');
            for (let y = 0; y < s; y += 3) {
                for (let x = 0; x < s; x += 3) {
                    const n = noise(x, y, 12);
                    fill(x, y, 3, 3, `rgba(${200 + n | 0},${206 + n | 0},${214 + n | 0},0.6)`);
                }
            }
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            for (const px of [s * 0.2, s * 0.6]) ctx.fillRect(px, 0, 2, s);
            ctx.fillRect(s * 0.4 - 2, 0, 2, s);
            ctx.fillRect(s * 0.4, s * 0.5, s * 0.2, 2);
            const g = ctx.createLinearGradient(0, s * 0.18, 0, s * 0.5);
            g.addColorStop(0, 'rgba(255,255,255,0.28)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, s * 0.12, s, s * 0.45);
        } else if (idx === 1) {
            // Tire: near-black rubber with vertical ribs.
            fill(0, 0, s, s, '#1a1a1c');
            const ribs = 12, rw = s / ribs;
            for (let i = 0; i < ribs; i++) {
                const shade = (h2(i, 31) - 0.5) * 14;
                fill(i * rw, 0, rw, s, `rgb(${30 + shade | 0},${30 + shade | 0},${33 + shade | 0})`);
            }
            fill(0, 0, s, 3, 'rgba(0,0,0,0.5)');
        } else if (idx === 2) {
            // Glass: dark tinted with a faint window grid.
            fill(0, 0, s, s, '#1c2630');
            const step = s / 5;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    const sh = (h2(r * 3 + c, 7) - 0.5) * 12;
                    fill(c * step + 2, r * step + 2, step - 4, step - 4, `rgb(${34 + sh | 0},${46 + sh | 0},${58 + sh | 0})`);
                }
            }
            ctx.fillStyle = 'rgba(8,12,18,0.8)';
            for (let i = 0; i <= 5; i++) {
                ctx.fillRect(i * step - 1, 0, 2, s);
                ctx.fillRect(0, i * step - 1, s, 2);
            }
        } else {
            // Chrome trim: light metal with vertical streaks.
            fill(0, 0, s, s, '#c6ccd4');
            const bands = 10, bw = s / bands;
            for (let i = 0; i < bands; i++) {
                const sh = (h2(i, 41) - 0.5) * 30;
                fill(i * bw, 0, bw, s, `rgb(${198 + sh | 0},${204 + sh | 0},${212 + sh | 0})`);
            }
        }
    }

    // Vehicle part role → atlas tile, by node name (Kenney nodes are named:
    // "body", "wheel-front-right", "grill", …). Wheels → tire; everything else
    // → car paint, tinted per-vehicle.
    _applyVehicleAtlas(root) {
        const atlas = this._getVehicleAtlas();
        const grid = Renderer3D.VEHICLE_ATLAS_GRID;
        root.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            const name = (child.name || '').toLowerCase();
            const tile = name.includes('wheel') ? 1 : 0;
            this._regenerateBoxUVs(child.geometry, tile, grid, 2);
            const mat = Array.isArray(child.material) ? child.material[0] : child.material;
            if (mat) mat.map = atlas;
        });
    }

    // Deterministic car colour per vehicle (id hash → palette) so the fleet
    // isn't one shade of grey; explicit v.color wins.
    _vehicleColor(v) {
        if (v.color) return v.color;
        const id = v.id || String(v.type);
        let h = 0;
        for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) >>> 0;
        return Renderer3D.CAR_COLORS[h % Renderer3D.CAR_COLORS.length];
    }

    _buildInstancedBuildingModel(model, instances) {
        const isGlass = instances[0].isGlassType;
        model.updateWorldMatrix(true, false);
        const color = new THREE.Color();
        const meshes = [];

        model.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            const baseMat = Array.isArray(child.material) ? child.material[0] : child.material;
            if (!baseMat) return;
            const role = this._classifyBuildingPart(baseMat, child);
            const geo = child.geometry.clone();
            geo.applyMatrix4(child.matrixWorld);
            // Low tiling frequency so bricks/windows are coarse enough to
            // resolve at city camera distances (fine patterns wash to flat).
            if (role === 'facade') this._regenerateBoxUVs(geo, instances[0].facadeTile, Renderer3D.FACADE_ATLAS_GRID, 1.25);
            const mat = this._makeBuildingRoleMaterial(baseMat, role, isGlass);
            const im = new THREE.InstancedMesh(geo, mat, instances.length);
            im.castShadow = true;
            im.receiveShadow = true;
            for (let i = 0; i < instances.length; i++) {
                const t = instances[i];
                im.setMatrixAt(i, t.matrix);
                if (role === 'facade') color.copy(t.bldColor);
                else if (role === 'roof') color.copy(Renderer3D.ROOF_COLOR);
                else continue; // keep/window use a fixed material colour
                im.setColorAt(i, color);
            }
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            im.computeBoundingSphere();
            meshes.push(im);
        });

        return meshes;
    }

    _buildInstancedWindowGlow(glowBoxes) {
        const geo = new THREE.PlaneGeometry(1, 1);
        const winMat = new THREE.MeshBasicMaterial({
            map: this._getWindowTexture(),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            opacity: 0.55,
        });
        const im = new THREE.InstancedMesh(geo, winMat, glowBoxes.length * 4);
        const dummy = new THREE.Object3D();
        const c = new THREE.Vector3();
        const s = new THREE.Vector3();
        let idx = 0;
        for (const box of glowBoxes) {
            c.copy(box.min).add(box.max).multiplyScalar(0.5);
            s.subVectors(box.max, box.min);
            // +Z, -Z, +X, -X cardinal faces, scaled to the building's extent.
            const faces = [
                [c.x, c.y, box.max.z + 0.018, 0, 0, s.x, s.y],
                [c.x, c.y, box.min.z - 0.018, 0, Math.PI, s.x, s.y],
                [box.max.x + 0.018, c.y, c.z, 0, Math.PI / 2, s.z, s.y],
                [box.min.x - 0.018, c.y, c.z, 0, -Math.PI / 2, s.z, s.y],
            ];
            for (const [px, py, pz, rx, ry, w, h] of faces) {
                dummy.position.set(px, py, pz);
                dummy.rotation.set(rx, ry, 0);
                dummy.scale.set(w * 0.88, h * 0.90, 1);
                dummy.updateMatrix();
                im.setMatrixAt(idx++, dummy.matrix);
            }
        }
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
        return im;
    }

    /**
     * Returns a lazily-created CanvasTexture of a window grid for building glow overlays.
     * Warm-yellow and cool-white window squares on a transparent background.
     */
    _getWindowTexture() {
        if (this._windowTexture) return this._windowTexture;
        const W = 128, H = 256;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const ctx = cv.getContext('2d');
        ctx.clearRect(0, 0, W, H);
        const cols = 5, rows = 14;
        const pw = W / cols, ph = H / rows;
        const sw = pw * 0.55, sh = ph * 0.48;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Deterministic: ~78% of windows lit, varied warm/cool
                const seed = ((r * cols + c) * 2654435761) >>> 0;
                if ((seed & 0x7) > 1) {
                    const warm = (seed & 0x3) > 0;
                    ctx.fillStyle = warm ? 'rgba(255,228,110,0.88)' : 'rgba(210,230,255,0.75)';
                    ctx.fillRect(
                        c * pw + (pw - sw) / 2,
                        r * ph + (ph - sh) / 2,
                        sw, sh
                    );
                }
            }
        }
        this._windowTexture = new THREE.CanvasTexture(cv);
        return this._windowTexture;
    }

    /** Number of facade-atlas tiles along each axis (4×4 grid). */
    static FACADE_ATLAS_GRID = 4;

    /**
     * Shared building-facade texture atlas (q11-tx-atlas-buildings). One
     * 1024×1024 canvas holds a 4×4 grid of seamless facade patterns; instanced
     * building facade parts regenerate their UVs (box projection) into the tile
     * for their type, so every building binds this single texture. Kept in
     * muted tones so the per-building palette instanceColor tint still reads.
     */
    _getFacadeAtlas() {
        if (this._facadeAtlas) return this._facadeAtlas;
        const grid = Renderer3D.FACADE_ATLAS_GRID;
        const size = 256;
        const cv = document.createElement('canvas');
        cv.width = cv.height = grid * size;
        const ctx = cv.getContext('2d');
        const h2 = (x, y) => {
            let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) >>> 0;
            h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
            return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
        };
        const noise = (x, y, amp) => (h2(Math.floor(x), Math.floor(y)) - 0.5) * amp;

        for (let i = 0; i < grid * grid; i++) {
            const tx = i % grid, ty = Math.floor(i / grid);
            ctx.save();
            ctx.translate(tx * size, ty * size);
            this._drawFacadeTile(ctx, size, i, h2, noise);
            ctx.restore();
        }
        this._facadeAtlas = new THREE.CanvasTexture(cv);
        this._facadeAtlas.anisotropy = 4;
        return this._facadeAtlas;
    }

    _drawFacadeTile(ctx, s, idx, h2, noise) {
        const fillRect = (x, y, w, h, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, w, h);
        };
        // Tiles are light-based (near-white base with dark architectural detail)
        // so the per-building palette instanceColor tint reads as a colour wash
        // that keeps windows/mortar/seams, instead of muddying a mid-grey tile.
        // eslint-disable-next-line no-unused-vars
        const brick = (base, mortar) => {
            const rows = 8, cols = 6, mh = 5;
            fillRect(0, 0, s, s, mortar);
            for (let r = 0; r < rows; r++) {
                const off = (r % 2) * (s / cols / 2);
                const y = r * (s / rows);
                for (let c = 0; c <= cols; c++) {
                    const x = c * (s / cols) - off;
                    const shade = (h2(r * 7 + c * 13, 3) - 0.5) * 30;
                    fillRect(x, y + mh / 2, s / cols + 1, s / rows - mh, `rgb(${base + shade | 0},${base * 0.62 + shade | 0},${base * 0.5 + shade | 0})`);
                }
            }
        };
        // eslint-disable-next-line no-unused-vars
        const concrete = (base, seams) => {
            fillRect(0, 0, s, s, `rgb(${base},${base},${base})`);
            for (let y = 0; y < s; y += 4) {
                for (let x = 0; x < s; x += 4) {
                    const n = noise(x, y, 16);
                    ctx.fillStyle = `rgba(${base + n | 0},${base + n | 0},${base + n | 0},0.5)`;
                    ctx.fillRect(x, y, 4, 4);
                }
            }
            if (seams) {
                ctx.strokeStyle = 'rgba(0,0,0,0.22)';
                ctx.lineWidth = 3;
                const step = s / 4;
                for (let i = 0; i <= 4; i++) {
                    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, s); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(s, i * step); ctx.stroke();
                }
            }
        };
        // eslint-disable-next-line no-unused-vars
        const glass = (base, gridLines) => {
            fillRect(0, 0, s, s, `rgb(${base},${base + 10},${base + 20})`);
            const step = s / 8;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const g = ctx.createLinearGradient(0, r * step, 0, r * step + step);
                    const shade = (h2(r * 5 + c, 7) - 0.5) * 28;
                    g.addColorStop(0, `rgb(${base + 32 + shade | 0},${base + 42 + shade | 0},${base + 56 + shade | 0})`);
                    g.addColorStop(1, `rgb(${base - 4 + shade | 0},${base + 6 + shade | 0},${base + 18 + shade | 0})`);
                    ctx.fillStyle = g;
                    ctx.fillRect(c * step + 2, r * step + 2, step - 4, step - 4);
                }
            }
            if (gridLines) {
                ctx.strokeStyle = 'rgba(12,18,30,0.85)';
                ctx.lineWidth = 3;
                for (let i = 0; i <= 8; i++) {
                    ctx.beginPath(); ctx.moveTo(i * step, 0); ctx.lineTo(i * step, s); ctx.stroke();
                    ctx.beginPath(); ctx.moveTo(0, i * step); ctx.lineTo(s, i * step); ctx.stroke();
                }
            }
        };
        // eslint-disable-next-line no-unused-vars
        const wood = () => {
            fillRect(0, 0, s, s, '#c9a878');
            const planks = 10, ph = s / planks;
            for (let p = 0; p < planks; p++) {
                const shade = (h2(p, 11) - 0.5) * 28;
                const base = 208 + shade | 0;
                fillRect(0, p * ph, s, ph, `rgb(${base},${base * 0.78 | 0},${base * 0.52 | 0})`);
                for (let g = 0; g < 8; g++) {
                    const gy = p * ph + h2(p * 3 + g, 12) * ph;
                    ctx.fillStyle = `rgba(60,34,12,${0.08 + h2(p + g, 13) * 0.12})`;
                    ctx.fillRect(0, gy, s, 1 + h2(p * 5 + g, 14) * 2);
                }
            }
            ctx.strokeStyle = 'rgba(45,26,10,0.7)';
            ctx.lineWidth = 2;
            for (let p = 1; p < planks; p++) {
                ctx.beginPath(); ctx.moveTo(0, p * ph); ctx.lineTo(s, p * ph); ctx.stroke();
            }
        };
        // eslint-disable-next-line no-unused-vars
        const stone = (base) => {
            fillRect(0, 0, s, s, `rgb(${base},${base},${base})`);
            const rows = 5, cols = 4, mw = 5, mh = 5;
            for (let r = 0; r < rows; r++) {
                const off = (r % 2) * (s / cols / 2);
                for (let c = 0; c <= cols; c++) {
                    const x = c * (s / cols) - off;
                    const shade = (h2(r * 11 + c * 17, 5) - 0.5) * 26;
                    fillRect(x + mw / 2, r * (s / rows) + mh / 2, s / cols - mw, s / rows - mh, `rgb(${base + shade | 0},${base + shade | 0},${base + shade | 0})`);
                }
            }
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 3;
            for (let r = 0; r <= rows; r++) {
                ctx.beginPath(); ctx.moveTo(0, r * (s / rows)); ctx.lineTo(s, r * (s / rows)); ctx.stroke();
            }
            for (let c = 0; c <= cols; c++) {
                ctx.beginPath(); ctx.moveTo(c * (s / cols), 0); ctx.lineTo(c * (s / cols), s); ctx.stroke();
            }
        };
        // eslint-disable-next-line no-unused-vars
        const corrugated = (base) => {
            fillRect(0, 0, s, s, `rgb(${base},${base},${base})`);
            const ribs = 16, rw = s / ribs;
            for (let i = 0; i < ribs; i++) {
                const shade = Math.sin(i * 0.9) * 26;
                fillRect(i * rw, 0, rw + 1, s, `rgb(${base + shade | 0},${base + shade | 0},${base + shade | 0})`);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(0, 0, s, 2);
        };
        // eslint-disable-next-line no-unused-vars
        const stucco = (r, g, b) => {
            fillRect(0, 0, s, s, `rgb(${r},${g},${b})`);
            for (let y = 0; y < s; y += 4) {
                for (let x = 0; x < s; x += 4) {
                    const n = noise(x, y, 16);
                    ctx.fillStyle = `rgba(${r + n | 0},${g + n | 0},${b + n | 0},0.6)`;
                    ctx.fillRect(x, y, 4, 4);
                }
            }
        };
        // eslint-disable-next-line no-unused-vars
        const office = () => {
            // Light tintable facade between a fine dark window grid.
            fillRect(0, 0, s, s, '#e6e6e6');
            const rows = 14, cols = 9, cw = s / cols, rh = s / rows;
            ctx.fillStyle = 'rgba(28,34,46,0.88)';
            for (let r = 0; r <= rows; r++) ctx.fillRect(0, r * rh - 1, s, 2);
            for (let c = 0; c <= cols; c++) ctx.fillRect(c * cw - 1, 0, 2, s);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const seed = h2(r * 13 + c * 7, 9);
                    if (seed > 0.22) {
                        const warm = seed > 0.65;
                        const glow = warm
                            ? `rgb(${232 + seed * 18 | 0},${206 + seed * 12 | 0},${140 + seed * 8 | 0})`
                            : `rgb(${148 + seed * 28 | 0},${184 + seed * 16 | 0},${222 + seed * 12 | 0})`;
                        fillRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4, glow);
                    } else {
                        fillRect(c * cw + 2, r * rh + 2, cw - 4, rh - 4, 'rgba(40,50,66,0.85)');
                    }
                }
            }
        };
        // eslint-disable-next-line no-unused-vars
        const metal = () => {
            fillRect(0, 0, s, s, '#aeb4bc');
            const bands = 12, bh = s / bands;
            for (let b = 0; b < bands; b++) {
                const shade = (h2(b, 15) - 0.5) * 18;
                fillRect(0, b * bh, s, bh, `rgb(${178 + shade | 0},${184 + shade | 0},${192 + shade | 0})`);
            }
            ctx.fillStyle = 'rgba(0,0,0,0.28)';
            for (let b = 1; b < bands; b++) ctx.fillRect(0, b * bh, s, 2);
        };

        // Tile → pattern (index stable so the atlas is deterministic).
        switch (idx) {
            case 0: brick(206, '#b5a287'); break;        // red brick
            case 1: brick(216, '#c4b394'); break;        // tan brick
            case 2: concrete(220, true); break;          // gray concrete
            case 3: concrete(238, false); break;         // white concrete
            case 4: glass(64, true); break;              // blue glass
            case 5: glass(42, true); break;              // dark glass
            case 6: wood(); break;                        // house wood
            case 7: stone(216); break;                    // ashlar stone
            case 8: corrugated(204); break;               // warehouse corrugated
            case 9: corrugated(168); break;               // ribbed panel
            case 10: stucco(226, 198, 160); break;        // warm stucco
            case 11: brick(214, '#a89270'); break;        // terracotta
            case 12: office(); break;                      // office window grid
            case 13: metal(); break;                       // metal clad
            case 14: stone(228); break;                    // limestone
            case 15: concrete(234, false); break;          // light panel
            default: concrete(220, true); break;
        }
    }

    /** Map building type → facade-atlas tile index (q11-tx-atlas-buildings). */
    static FACADE_TILE = {
        house: 6, apartment: 2, farm: 6, market: 0, restaurant: 10,
        hotel: 4, 'shopping-mall': 3, theater: 12, museum: 7, library: 14,
        hospital: 3, 'town-hall': 14, warehouse: 8, barracks: 13, school: 7,
        factory: 9, 'lumber-mill': 9, 'bus-depot': 2, 'metro-station': 2,
        skyscraper: 4, office: 12, nightclub: 13, penthouse: 5,
    };

    /**
     * Build instanced vegetation (trees) for forest and park tiles in a chunk.
     * Uses a deterministic seeded RNG based on tile coordinates for consistency.
     */
    _applyTreeWindShader(mat) {
        if (!this._windUniforms) {
            this._windUniforms = {
                uWindTime: { value: 0 },
                uWindStrength: { value: 0.02 },
                uWindDir: { value: new THREE.Vector2(1, 0) },
            };
        }
        const uniforms = this._windUniforms;
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uWindTime = uniforms.uWindTime;
            shader.uniforms.uWindStrength = uniforms.uWindStrength;
            shader.uniforms.uWindDir = uniforms.uWindDir;
            shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>
                uniform float uWindTime;
                uniform float uWindStrength;
                uniform vec2 uWindDir;`
            );
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                float heightFactor = max(0.0, transformed.y) * 2.0;
                float phase = dot(vec2(modelMatrix[3][0], modelMatrix[3][2]), uWindDir) * 3.0;
                float sway = sin(uWindTime * 2.5 + phase) * uWindStrength * heightFactor;
                float gust = sin(uWindTime * 5.7 + phase * 1.3) * uWindStrength * 0.3 * heightFactor;
                transformed.x += (sway + gust) * uWindDir.x;
                transformed.z += (sway + gust) * uWindDir.y;`
            );
        };
        mat.customProgramCacheKey = () => 'tree_wind';
        // Foliage gets translucent SSS on top of the wind sway; trunks don't.
        if (mat.userData?.isTreeFoliage) this._applySubsurface(mat, 0x6abf3a, 0.22);
    }

    /**
     * Wrap-shading subsurface scattering (Q10.F). Cheap translucency: a wrapped
     * diffuse term lets light bleed around the terminator, and a view-aligned
     * back-scatter term glows when the light is behind the surface — skin and
     * leaves both light up at the edges. Composes with any existing
     * onBeforeCompile (e.g. the tree wind sway) instead of replacing it.
     * Reads a shared view-space light direction updated once per frame.
     */
    _applySubsurface(mat, colorHex, strength) {
        if (!this._sssLightDir) this._sssLightDir = { value: new THREE.Vector3(0, 1, 0) };
        const prevOBC = mat.onBeforeCompile;
        const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
        const lightDir = this._sssLightDir;
        mat.onBeforeCompile = (shader, renderer) => {
            if (prevOBC) prevOBC.call(mat, shader, renderer);
            shader.uniforms.uSubColor = { value: new THREE.Color(colorHex) };
            shader.uniforms.uSubStrength = { value: strength };
            shader.uniforms.uSubLightDir = lightDir;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>
                uniform vec3 uSubColor; uniform float uSubStrength; uniform vec3 uSubLightDir;`
            ).replace(
                '#include <lights_fragment_end>',
                `#include <lights_fragment_end>
                {
                    vec3 sssL = normalize(uSubLightDir);
                    float wrap = clamp((dot(geometryNormal, sssL) + 0.5) / 1.5, 0.0, 1.0);
                    float back = pow(clamp(dot(normalize(vViewPosition), -sssL), 0.0, 1.0), 3.0);
                    reflectedLight.directDiffuse += uSubColor * uSubStrength * (wrap * 0.5 + back * 0.5) * diffuseColor.rgb;
                }`
            );
        };
        mat.customProgramCacheKey = () => `sss_${strength.toFixed(2)}_${prevKey}`;
        mat.needsUpdate = true;
    }

    /** Refresh the shared SSS light direction (sun, in view space). */
    _updateSubsurfaceLight() {
        if (!this._sssLightDir || !this.sunLight) return;
        this._sssLightDir.value.copy(this.sunLight.position).transformDirection(this.camera.matrixWorldInverse);
    }

    /** Recompute the GI probe grid irradiance from current lighting (Q10.G). */
    _updateGI(dtSec = 0.033) {
        if (!this._gi) return;
        const sky = (this.scene.background && this.scene.background.isColor)
            ? this.scene.background : { r: 0.4, g: 0.6, b: 0.8 };
        const ground = this.hemiLight?.groundColor ?? { r: 0.4, g: 0.6, b: 0.4 };
        const sun = this.sunLight?.color ?? { r: 1, g: 1, b: 0.9 };
        const sunInt = Math.min(1, (this.sunLight?.intensity ?? 1.8) / 1.8);
        this._gi.update(sky, ground, sun, sunInt, this._collectGIDeltas(dtSec));
    }

    _updateWindUniforms() {
        if (!this._windUniforms) return;
        const ws = this.game?.weatherSystem?.state;
        const speed = ws?.windSpeed ?? 1;
        const dir = ws?.windDirection ?? 0;
        this._windUniforms.uWindTime.value = performance.now() / 1000;
        this._windUniforms.uWindStrength.value = 0.01 + speed * 0.03;
        this._windUniforms.uWindDir.value.set(Math.cos(dir), Math.sin(dir)).normalize();
    }

    _buildVegetationForChunk(bounds) {
        const objects = [];
        const treeLarge = this._vegetationModels.get('tree-large');
        const treeSmall = this._vegetationModels.get('tree-small');
        if (!treeLarge && !treeSmall) return objects;

        // Collect tile positions by terrain type
        const forestTiles = [], parkTiles = [], grassTiles = [];
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const terrain = this.game.map.getTileAt(x, y);
                if (terrain === TERRAIN_FOREST) forestTiles.push({ x, y });
                else if (terrain === TERRAIN_PARK) parkTiles.push({ x, y });
                else if (terrain === TERRAIN_GRASS) grassTiles.push({ x, y });
            }
        }

        // Deterministic hash per tile
        const hash = (x, y, salt) => {
            let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
            h = ((h ^ (h >> 13)) * 1274126177) | 0;
            return ((h ^ (h >> 16)) >>> 0) / 4294967296;
        };

        // Collect tree instances (variant + transform + foliage tint). Trees are
        // instanced (Q11.D) instead of cloned: a handful of InstancedMesh per
        // chunk replaces hundreds of per-tree clones, with identical placement.
        const treeInstances = [];
        const FOLIAGE = {
            forest: [0x2d8a2d, 0x1e7a1e, 0x3a9a3a, 0x2e7d32, 0x388e3c],
            park: [0x4caf50],
            grass: [0x4e9a3a, 0x3f8a30, 0x57a544, 0x6aae4e],
        };

        // Forest tiles (1-3 trees per tile)
        for (const tile of forestTiles) {
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;
            const treeCount = 1 + Math.floor(hash(tile.x, tile.y, 0) * 3);

            for (let t = 0; t < treeCount; t++) {
                const model = hash(tile.x, tile.y, t + 10) > 0.4 ? treeLarge : treeSmall;
                if (!model) continue;
                treeInstances.push({
                    model,
                    x: wx + (hash(tile.x, tile.y, t + 20) - 0.5) * 0.6,
                    z: wz + (hash(tile.x, tile.y, t + 30) - 0.5) * 0.6,
                    y: this._smoothTerrainY(tile.x, tile.y),
                    rotY: hash(tile.x, tile.y, t + 40) * Math.PI * 2,
                    scale: 0.7 + hash(tile.x, tile.y, t + 50) * 0.8,
                    foliageHex: FOLIAGE.forest[(tile.x * 7 + tile.y * 13 + t * 3) % FOLIAGE.forest.length],
                });
            }
        }

        // Park tiles (0-1 per tile, ~40% get one)
        for (const tile of parkTiles) {
            if (hash(tile.x, tile.y, 100) > 0.6) continue;
            const model = hash(tile.x, tile.y, 110) > 0.5 ? treeLarge : treeSmall;
            if (!model) continue;
            treeInstances.push({
                model,
                x: tile.x - this._mapHalfW + 0.5 + (hash(tile.x, tile.y, 120) - 0.5) * 0.4,
                z: tile.y - this._mapHalfH + 0.5 + (hash(tile.x, tile.y, 130) - 0.5) * 0.4,
                y: this._smoothTerrainY(tile.x, tile.y),
                rotY: hash(tile.x, tile.y, 140) * Math.PI * 2,
                scale: 1,
                foliageHex: FOLIAGE.park[0],
            });
        }

        // Sparse trees dotting the open grassland — ~5% normally, 0.6% in urban (don't hide GTA streets)
        const grassChance = (this.game?.map?.width ?? 0) >= 40 ? 0.006 : 0.05;
        for (const tile of grassTiles) {
            if (hash(tile.x, tile.y, 200) > grassChance) continue;
            const model = hash(tile.x, tile.y, 210) > 0.45 ? treeLarge : treeSmall;
            if (!model) continue;
            treeInstances.push({
                model,
                x: tile.x - this._mapHalfW + 0.5 + (hash(tile.x, tile.y, 220) - 0.5) * 0.5,
                z: tile.y - this._mapHalfH + 0.5 + (hash(tile.x, tile.y, 230) - 0.5) * 0.5,
                y: this._smoothTerrainY(tile.x, tile.y),
                rotY: hash(tile.x, tile.y, 240) * Math.PI * 2,
                scale: 0.8 + hash(tile.x, tile.y, 250) * 0.7,
                foliageHex: FOLIAGE.grass[(tile.x * 5 + tile.y * 11) % FOLIAGE.grass.length],
            });
        }

        // Instance per variant so a chunk renders all its trees in ~2 draws.
        for (const model of [treeLarge, treeSmall]) {
            if (!model) continue;
            const instances = treeInstances.filter((t) => t.model === model);
            if (instances.length === 0) continue;
            objects.push(...this._buildInstancedTrees(model, instances));
        }

        // Instanced grass billboards — skip in urban (clutters GTA streets)
        if ((this.game?.map?.width ?? 0) < 40) {
            const grassCandidates = [...grassTiles, ...parkTiles];
            if (grassCandidates.length > 0) {
                const blades = [];
                for (const tile of grassCandidates) {
                    const count = 2 + Math.floor(hash(tile.x, tile.y, 300) * 4);
                    for (let i = 0; i < count; i++) {
                        const ox = (hash(tile.x, tile.y, 310 + i) - 0.5) * 0.8;
                        const oz = (hash(tile.x, tile.y, 320 + i) - 0.5) * 0.8;
                        const rot = hash(tile.x, tile.y, 330 + i) * Math.PI;
                        const h = 0.06 + hash(tile.x, tile.y, 340 + i) * 0.08;
                        blades.push({ x: tile.x, y: tile.y, ox, oz, rot, h });
                    }
                }
                if (blades.length > 0) {
                    const grassMesh = this._buildGrassBillboards(blades, hash);
                    if (grassMesh) objects.push(grassMesh);
                }
            }
        }

        return objects;
    }

    _buildInstancedTrees(model, instances) {
        // Flatten the tree model into per-mesh InstancedMesh so a chunk draws
        // all its trees of this variant in a handful of draw calls. Each part's
        // local transform is baked into its geometry; per-tree placement lands
        // in the instance matrix and the foliage tint in instanceColor.
        model.updateWorldMatrix(true, false);
        const dummy = new THREE.Object3D();
        const meshes = [];

        model.traverse((child) => {
            if (!child.isMesh || !child.geometry) return;
            const size = new THREE.Box3().setFromObject(child).getSize(new THREE.Vector3());
            const isFoliage = !(size.x < 0.25 && size.z < 0.25);
            const baseMat = Array.isArray(child.material) ? child.material[0] : child.material;
            if (!baseMat || !baseMat.color) return;

            const geo = child.geometry.clone();
            geo.applyMatrix4(child.matrixWorld);
            const mat = baseMat.clone();
            mat.color.setHex(0xffffff); // tint via instanceColor so textures keep detail
            mat.roughness = 0.9;
            mat.metalness = 0.0;
            if (isFoliage) mat.userData.isTreeFoliage = true;

            const im = new THREE.InstancedMesh(geo, mat, instances.length);
            im.castShadow = true;
            im.receiveShadow = true;
            const color = new THREE.Color();
            for (let i = 0; i < instances.length; i++) {
                const t = instances[i];
                dummy.position.set(t.x, t.y, t.z);
                dummy.rotation.y = t.rotY;
                dummy.scale.setScalar(t.scale);
                dummy.updateMatrix();
                im.setMatrixAt(i, dummy.matrix);
                color.setHex(isFoliage ? t.foliageHex : 0x6d4c3a);
                im.setColorAt(i, color);
            }
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            im.computeBoundingSphere();
            this._applyTreeWindShader(mat);
            meshes.push(im);
        });

        return meshes;
    }

    _buildGrassBillboards(blades, hash) {
        if (!this._grassGeo) {
            this._grassGeo = new THREE.PlaneGeometry(0.06, 0.1);
            this._grassGeo.translate(0, 0.05, 0);
        }
        if (!this._grassMat) {
            this._grassMat = new THREE.MeshStandardMaterial({
                color: 0x4a8a3a,
                roughness: 0.95,
                metalness: 0.0,
                side: THREE.DoubleSide,
                alphaTest: 0.1,
            });
            this._applyTreeWindShader(this._grassMat);
        }
        const mesh = new THREE.InstancedMesh(this._grassGeo, this._grassMat, blades.length);
        mesh.receiveShadow = true;
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < blades.length; i++) {
            const b = blades[i];
            const wx = b.x - this._mapHalfW + 0.5 + b.ox;
            const wz = b.y - this._mapHalfH + 0.5 + b.oz;
            const gy = this._smoothTerrainY(b.x, b.y);
            dummy.position.set(wx, gy, wz);
            dummy.rotation.set(0, b.rot, 0);
            dummy.scale.set(1, b.h / 0.1, 1);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        return mesh;
    }

    /**
     * Instanced ground scatter — low-poly rocks (grass + mountain) and bushes
     * (grass) for natural ground detail. One draw call per type per chunk;
     * deterministic per tile; sits on _smoothTerrainY so it rides the terrain.
     */
    _buildGroundScatterForChunk(bounds) {
        const objects = [];
        const hash = (x, y, salt) => {
            let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
            h = ((h ^ (h >> 13)) * 1274126177) | 0;
            return ((h ^ (h >> 16)) >>> 0) / 4294967296;
        };
        const rocks = [];
        const bushes = [];
        const tufts = [];
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const t = this.game.map.getTileAt(x, y);
                const isGrass = t === TERRAIN_GRASS;
                const isMtn = t === TERRAIN_MOUNTAIN;
                if (!isGrass && !isMtn) continue;
                const y0 = this._smoothTerrainY(x, y);
                const wx = x - this._mapHalfW + 0.5;
                const wz = y - this._mapHalfH + 0.5;
                // Suburbs read as manicured lawn: denser shrubs + scattered grass tufts.
                const isSuburb = isGrass &&
                    this._districtThemes?.get(this.game.map.getDistrictAt(x, y)) === 'suburbs';
                if (hash(x, y, 1) < (isMtn ? 0.32 : 0.05)) {
                    rocks.push({ x: wx + (hash(x, y, 2) - 0.5) * 0.6, y: y0, z: wz + (hash(x, y, 3) - 0.5) * 0.6,
                        s: 0.5 + hash(x, y, 4) * (isMtn ? 1.4 : 0.8), rx: hash(x, y, 5), ry: hash(x, y, 6), c: hash(x, y, 7) });
                }
                if (isGrass && hash(x, y, 10) < (isSuburb ? 0.18 : 0.07)) {
                    bushes.push({ x: wx + (hash(x, y, 11) - 0.5) * 0.6, y: y0, z: wz + (hash(x, y, 12) - 0.5) * 0.6,
                        s: 0.6 + hash(x, y, 13) * 0.8, ry: hash(x, y, 14), c: hash(x, y, 15) });
                }
                // Lawn grass tufts — multiple per suburb tile so the ground reads as kept turf.
                if (isSuburb) {
                    for (let g = 0; g < 4; g++) {
                        if (hash(x, y, 20 + g) > 0.6) continue;
                        tufts.push({ x: wx + (hash(x, y, 30 + g) - 0.5) * 0.85, y: y0, z: wz + (hash(x, y, 40 + g) - 0.5) * 0.85,
                            s: 0.7 + hash(x, y, 50 + g) * 0.7, ry: hash(x, y, 60 + g), c: hash(x, y, 70 + g) });
                    }
                }
            }
        }
        const dummy = new THREE.Object3D();
        const tmp = new THREE.Color();
        if (rocks.length) {
            const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0.0, flatShading: true });
            const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.11, 0), mat, rocks.length);
            im.castShadow = true; im.receiveShadow = true;
            for (let i = 0; i < rocks.length; i++) {
                const r = rocks[i];
                dummy.position.set(r.x, r.y + 0.03 * r.s, r.z);
                dummy.rotation.set(r.rx * 6.283, r.ry * 6.283, r.rx * 3.14);
                dummy.scale.set(r.s, r.s * 0.7, r.s);
                dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
                tmp.setHSL(0.09, 0.06, 0.42 + r.c * 0.16); // warm gray, slight value drift
                im.setColorAt(i, tmp);
            }
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            objects.push(im);
        }
        if (bushes.length) {
            const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0.0, flatShading: true });
            const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 1), mat, bushes.length);
            im.castShadow = true; im.receiveShadow = true;
            for (let i = 0; i < bushes.length; i++) {
                const bsh = bushes[i];
                dummy.position.set(bsh.x, bsh.y + 0.07 * bsh.s, bsh.z);
                dummy.rotation.set(0, bsh.ry * 6.283, 0);
                dummy.scale.set(bsh.s, bsh.s * 0.8, bsh.s);
                dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
                tmp.setHSL(0.28, 0.45, 0.30 + bsh.c * 0.12); // foliage green variation
                im.setColorAt(i, tmp);
            }
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            objects.push(im);
        }
        if (tufts.length) {
            const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0, flatShading: true });
            const im = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.22, 4), mat, tufts.length);
            im.castShadow = true; im.receiveShadow = true;
            for (let i = 0; i < tufts.length; i++) {
                const tf = tufts[i];
                dummy.position.set(tf.x, tf.y + 0.11 * tf.s, tf.z);
                dummy.rotation.set(0, tf.ry * 6.283, 0);
                dummy.scale.set(tf.s, tf.s, tf.s);
                dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix);
                tmp.setHSL(0.26, 0.55, 0.34 + tf.c * 0.1); // fresh lawn green
                im.setColorAt(i, tmp);
            }
            im.instanceMatrix.needsUpdate = true;
            if (im.instanceColor) im.instanceColor.needsUpdate = true;
            objects.push(im);
        }
        return objects;
    }

    /**
     * Scatter urban detail props (awnings, parasols, fences) near commercial/residential buildings.
     */
    _buildDetailPropsForChunk(bounds, buildings) {
        const objects = [];
        if (this._detailModels.size === 0) return objects;

        const hash = (x, y, salt) => {
            let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
            h = ((h ^ (h >> 13)) * 1274126177) | 0;
            return ((h ^ (h >> 16)) >>> 0) / 4294967296;
        };

        // Commercial building types get awnings/parasols; residential get fences
        const commercialTypes = new Set([
            'market', 'restaurant', 'nightclub', 'shopping-mall', 'hotel', 'theater',
            'museum', 'library', 'hospital',
        ]);
        const residentialTypes = new Set([
            'house', 'apartment', 'farm',
        ]);

        // Collect per-variant detail props, then instance them (Q11.D).
        const detailInstances = new Map();

        for (const b of buildings) {
            if (b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY) continue;
            const h = hash(b.x, b.y, 500);
            if (h > 0.35) continue; // only 35% of buildings get a detail prop

            const wx = b.x - this._mapHalfW + 0.5;
            const wz = b.y - this._mapHalfH + 0.5;
            const terrainY = this._smoothTerrainY(b.x, b.y);
            const side = hash(b.x, b.y, 510) > 0.5 ? 0.52 : -0.52;
            const rotY = ((b.rotation ?? ((b.id || 0) % 4)) % 4) * (Math.PI / 2);

            let modelName = null;
            if (commercialTypes.has(b.type)) {
                const pick = hash(b.x, b.y, 520);
                if (pick < 0.35) modelName = 'awning';
                else if (pick < 0.55) modelName = 'parasol-a';
                else if (pick < 0.75) modelName = 'parasol-b';
                else modelName = 'awning-wide';
            } else if (residentialTypes.has(b.type)) {
                modelName = hash(b.x, b.y, 520) > 0.5 ? 'fence' : 'fence-low';
            }

            if (!modelName) continue;
            const model = this._detailModels.get(modelName);
            if (!model) continue;
            if (!detailInstances.has(modelName)) detailInstances.set(modelName, []);
            detailInstances.get(modelName).push({
                x: wx + side * Math.cos(rotY),
                y: terrainY,
                z: wz + side * Math.sin(rotY),
                rotY: rotY + (hash(b.x, b.y, 530) - 0.5) * 0.3,
            });
        }

        for (const [modelName, instances] of detailInstances) {
            const model = this._detailModels.get(modelName);
            objects.push(...this._buildInstancedModelParts(model, instances, { promote: false, isRoad: false, receiveShadow: true }));
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
        // Vegetation (trees on forest/park tiles)
        const vegMeshes = this._buildVegetationForChunk(bounds);
        for (const mesh of vegMeshes) {
            mesh.userData.kind = 'vegetation';
            group.add(mesh);
        }
        // Ground scatter (instanced rocks + bushes) — natural ground detail
        const scatterMeshes = this._buildGroundScatterForChunk(bounds);
        for (const mesh of scatterMeshes) {
            mesh.userData.kind = 'vegetation';
            group.add(mesh);
        }
        // Urban detail props (awnings, parasols, fences near buildings)
        const detailMeshes = this._buildDetailPropsForChunk(bounds, this.game.buildings.buildings);
        for (const mesh of detailMeshes) {
            mesh.userData.kind = 'detail';
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

        // Q11.C LOD1: box-proxy group shown at mid distance (no shadows, flat mats)
        const lod1Group = buildChunkLOD1Proxies(
            bounds, this.game.buildings.buildings,
            this._mapHalfW, this._mapHalfH, (wx, wz) => this._smoothTerrainY(wx + this._mapHalfW - 0.5, wz + this._mapHalfH - 0.5)
        );
        lod1Group.visible = false;
        this.scene.add(lod1Group);

        // Q11.C LOD imposter: billboard sprite shown at far distance
        const imposter = createChunkImposter(center, 0x886644, Math.max(width, height));
        imposter.visible = false;
        this.scene.add(imposter);

        this.scene.add(group);
        return {
            group,
            bounds,
            center,
            radius,
            lod1Group,
            imposter,
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

    static GRIME_BIAS = {
        industrial: 0.8, docks: 0.7, oldtown: 0.9, waterfront: 0.5,
        commercial: 0.35, residential: 0.2, suburbs: 0.1, elite: 0.05,
    };

    static POSTER_BIAS = {
        oldtown: 0.8, commercial: 0.6, industrial: 0.3, docks: 0.25,
        residential: 0.15, waterfront: 0.2, suburbs: 0.05, elite: 0.1,
    };

    // Posters layered per building — oldtown walls plaster over with bills.
    static POSTER_LAYERS = { oldtown: 3, commercial: 2 };

    static POSTER_COLORS = [0xcc4444, 0x44aacc, 0xcccc44, 0xcc8844, 0x8844cc, 0x44cc88];

    static GRAFFITI_FACTION = {
        industrial: { color: 0xcc3333, chance: 0.4 },
        docks:      { color: 0xcc3333, chance: 0.35 },
        oldtown:    { color: 0xcc5533, chance: 0.5 },
        commercial: { color: 0x8888cc, chance: 0.15 },
        residential:{ color: 0x44aa44, chance: 0.1 },
        waterfront: { color: 0xcc5533, chance: 0.2 },
        suburbs:    { color: 0x44aa44, chance: 0.05 },
        elite:      { color: 0x8888cc, chance: 0.08 },
    };

    _spawnGrimeForChunk(chunkId) {
        if (!this._decalManager) return;
        if (!this._grimeSpawnedChunks) this._grimeSpawnedChunks = new Set();
        if (this._grimeSpawnedChunks.has(chunkId)) return;
        this._grimeSpawnedChunks.add(chunkId);

        const rng = this.game?.rngStreams?.vfx;
        if (!rng) return;
        const bounds = this.game.chunks.getChunkBounds(chunkId);
        const allBuildings = this.game.buildings?.buildings ?? [];
        const buildings = allBuildings.filter(
            b => b.x >= bounds.minX && b.x <= bounds.maxX && b.y >= bounds.minY && b.y <= bounds.maxY
        );

        for (const b of buildings) {
            const distId = this.game.map.getDistrictAt(b.x, b.y);
            const dist = this.game.map.districts?.[distId];
            const bias = Renderer3D.GRIME_BIAS[dist?.theme] ?? 0.3;
            const cond = (b.condition ?? 100) / 100;
            const grimeChance = bias * (1.2 - cond);
            if (rng.next() > grimeChance) continue;
            const wx = b.x - this._mapHalfW + 0.5;
            const wz = b.y - this._mapHalfH + 0.5;
            const count = 1 + Math.floor(rng.next() * (bias > 0.5 ? 3 : 2));
            for (let i = 0; i < count; i++) {
                const ox = (rng.next() - 0.5) * 0.8;
                const oz = (rng.next() - 0.5) * 0.8;
                this._decalManager.spawnGround(wx + ox, wz + oz, {
                    decalType: 'grime',
                    size: 0.12 + rng.next() * 0.2,
                    duration: Infinity,
                    rotation: rng.next() * Math.PI * 2,
                    opacity: 0.3 + bias * 0.4,
                });
            }
        }
    }

    _spawnPostersForChunk(chunkId) {
        if (!this._decalManager) return;
        if (!this._posterSpawnedChunks) this._posterSpawnedChunks = new Set();
        if (this._posterSpawnedChunks.has(chunkId)) return;
        this._posterSpawnedChunks.add(chunkId);

        const rng = this.game?.rngStreams?.vfx;
        if (!rng) return;
        const bounds = this.game.chunks.getChunkBounds(chunkId);
        const allBuildings = this.game.buildings?.buildings ?? [];
        const buildings = allBuildings.filter(
            b => b.x >= bounds.minX && b.x <= bounds.maxX && b.y >= bounds.minY && b.y <= bounds.maxY
        );

        const normals = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const b of buildings) {
            const distId = this.game.map.getDistrictAt(b.x, b.y);
            const dist = this.game.map.districts?.[distId];
            const bias = Renderer3D.POSTER_BIAS[dist?.theme] ?? 0.2;
            if (rng.next() > bias) continue;
            const wx = b.x - this._mapHalfW + 0.5;
            const wz = b.y - this._mapHalfH + 0.5;
            const terrainY = this._smoothTerrainY(b.x, b.y);
            // Density bias: oldtown plasters layered bills over each wall (Q10.H).
            const layers = Renderer3D.POSTER_LAYERS[dist?.theme] ?? 1;
            for (let l = 0; l < layers; l++) {
                const face = normals[Math.floor(rng.next() * 4)];
                const color = Renderer3D.POSTER_COLORS[Math.floor(rng.next() * Renderer3D.POSTER_COLORS.length)];
                const wallY = terrainY + 0.15 + rng.next() * 0.3;
                this._decalManager.spawnWall(
                    wx + face[0] * 0.45, wallY, wz + face[1] * 0.45,
                    face[0], face[1],
                    { decalType: 'poster', width: 0.12 + rng.next() * 0.08, height: 0.1 + rng.next() * 0.08, duration: Infinity, opacity: 0.75 }
                );
            }
        }
    }

    _spawnGraffitiForChunk(chunkId) {
        if (!this._decalManager) return;
        if (!this._graffitiSpawnedChunks) this._graffitiSpawnedChunks = new Set();
        if (this._graffitiSpawnedChunks.has(chunkId)) return;
        this._graffitiSpawnedChunks.add(chunkId);

        const rng = this.game?.rngStreams?.vfx;
        if (!rng) return;
        const bounds = this.game.chunks.getChunkBounds(chunkId);
        const allBuildings = this.game.buildings?.buildings ?? [];
        const buildings = allBuildings.filter(
            b => b.x >= bounds.minX && b.x <= bounds.maxX && b.y >= bounds.minY && b.y <= bounds.maxY
        );

        const normals = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (const b of buildings) {
            const distId = this.game.map.getDistrictAt(b.x, b.y);
            const dist = this.game.map.districts?.[distId];
            const cfg = Renderer3D.GRAFFITI_FACTION[dist?.theme];
            if (!cfg || rng.next() > cfg.chance) continue;
            const wx = b.x - this._mapHalfW + 0.5;
            const wz = b.y - this._mapHalfH + 0.5;
            const terrainY = this._smoothTerrainY(b.x, b.y);
            const face = normals[Math.floor(rng.next() * 4)];
            const wallY = terrainY + 0.08 + rng.next() * 0.25;
            this._decalManager.spawnWall(
                wx + face[0] * 0.45, wallY, wz + face[1] * 0.45,
                face[0], face[1],
                { decalType: 'graffiti', width: 0.18 + rng.next() * 0.15, height: 0.12 + rng.next() * 0.1, duration: Infinity, opacity: 0.55 }
            );
        }
    }

    syncChunkStreaming(forceInitial = false) {
        if (!this.game.chunks) return;
        const p = this.game.player;
        const pinnedTiles = this.game.getPinnedChunkTiles?.() || [];
        const result = this.game.chunks.update({ x: p.x, y: p.y }, pinnedTiles, performance.now());

        for (const chunkId of result.loadedNow) {
            const entry = this._createChunkEntry(chunkId);
            this._chunkMeshes.set(chunkId, entry);
            this._spawnGrimeForChunk(chunkId);
            this._spawnPostersForChunk(chunkId);
            this._spawnGraffitiForChunk(chunkId);
        }
        for (const chunkId of result.unloadedNow) {
            const entry = this._chunkMeshes.get(chunkId);
            this._disposeChunkEntry(entry);
            this._chunkMeshes.delete(chunkId);
            this._grimeSpawnedChunks?.delete(chunkId);
            this._posterSpawnedChunks?.delete(chunkId);
            this._graffitiSpawnedChunks?.delete(chunkId);
        }
        if (forceInitial) {
            for (const chunkId of result.active) {
                if (!this._chunkMeshes.has(chunkId)) {
                    const entry = this._createChunkEntry(chunkId);
                    this._chunkMeshes.set(chunkId, entry);
                    this._spawnGrimeForChunk(chunkId);
                    this._spawnPostersForChunk(chunkId);
                    this._spawnGraffitiForChunk(chunkId);
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
            const lod1 = entry.lod1Group ?? null;
            const imp  = entry.imposter   ?? null;

            if (!inFrustum) {
                entry.group.visible = false;
                if (lod1) lod1.visible = false;
                if (imp)  imp.visible  = false;
                continue;
            }

            const dist = camPos.distanceTo(entry.center);

            if (dist > this.LOD_TERRAIN_ONLY_DIST) {
                // Tier 4: chunk fully hidden
                entry.group.visible = false;
                if (lod1) lod1.visible = false;
                if (imp)  imp.visible  = false;
            } else if (dist > LOD_DIST.buildings.imposter) {
                // Tier 3: terrain + billboard imposter only
                entry.group.visible = true;
                for (const child of entry.group.children) {
                    if (child.userData?.kind === 'building' || child.userData?.kind === 'vegetation') child.visible = false;
                }
                if (lod1) lod1.visible = false;
                if (imp)  imp.visible  = true;
            } else if (dist > LOD_DIST.buildings.lod2) {
                // Tier 2: terrain + LOD1 box proxies, no imposter
                entry.group.visible = true;
                for (const child of entry.group.children) {
                    if (child.userData?.kind === 'building' || child.userData?.kind === 'vegetation') child.visible = false;
                }
                if (lod1) lod1.visible = true;
                if (imp)  imp.visible  = false;
            } else if (dist > LOD_DIST.buildings.lod1) {
                // Tier 1: full group but skip per-mesh cull (close enough for simple test)
                entry.group.visible = true;
                for (const child of entry.group.children) {
                    if (child.userData?.kind === 'building' || child.userData?.kind === 'vegetation') child.visible = true;
                }
                if (lod1) lod1.visible = false;
                if (imp)  imp.visible  = false;
            } else {
                // Tier 0: full detail with per-mesh frustum cull
                entry.group.visible = true;
                for (const child of entry.group.children) {
                    if (child.userData?.kind === 'building' || child.userData?.kind === 'vegetation') child.visible = true;
                }
                if (lod1) lod1.visible = false;
                if (imp)  imp.visible  = false;
                // Q11.B per-mesh frustum cull — only within close range where it matters
                cullChunkChildren(entry.group, this._frustum);
            }
        }

        if (this._decalManager) {
            const activeSet = new Set(result.active);
            this._decalManager.syncChunkVisibility(activeSet);
        }
    }

    buildPlayer() {
        const group = new THREE.Group();
        // Scale player to ~0.5 units tall so buildings (0.7-2.1) look proportional
        const s = 0.45;

        // Jacket / torso — dark hoodie look
        const torsoMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.75, metalness: 0.05 });
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.19 * s, 0.55 * s, 10), torsoMat);
        torso.castShadow = true;
        torso.position.y = 0.37 * s + 0.05;
        group.add(torso);

        // Legs — slightly lighter
        const legMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.7 });
        const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.12 * s, 0.45 * s, 8), legMat);
        legs.castShadow = true;
        legs.position.y = 0.22 * s + 0.05;
        group.add(legs);

        // Head — small, proportional
        const headMat = new THREE.MeshPhysicalMaterial({ color: 0xd4a574, roughness: 0.55, metalness: 0.0, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x332211), sheen: 1.0 });
        // Skin translucency: warm back-scatter glow around the terminator/edges.
        this._applySubsurface(headMat, 0xff6644, 0.16);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.10 * s, 10, 8), headMat);
        head.castShadow = true;
        head.position.y = 0.72 * s + 0.05;
        group.add(head);

        // Cap / hood brim
        const capMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.11 * s, 0.06 * s, 10), capMat);
        cap.castShadow = true;
        cap.position.y = 0.79 * s + 0.05;
        group.add(cap);

        // Muzzle flash billboard quad
        const flashMat = new THREE.MeshBasicMaterial({
            color: 0xffdd44,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const flashGeo = new THREE.PlaneGeometry(0.15, 0.15);
        this._muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
        this._muzzleFlashMesh.position.set(0.12 * s, 0.42 * s + 0.05, -0.18 * s);
        this._muzzleFlashMesh.visible = false;
        group.add(this._muzzleFlashMesh);

        // Visibility ring (stealth detection radius)
        const ringGeo = new THREE.RingGeometry(0.95, 1.0, 32);
        ringGeo.rotateX(-Math.PI / 2);
        const ringMat = new THREE.MeshBasicMaterial({
            color: 0x44aaff,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide,
            depthWrite: false,
        });
        this._visibilityRing = new THREE.Mesh(ringGeo, ringMat);
        this._visibilityRing.visible = false;
        group.add(this._visibilityRing);

        // Muzzle flash point light
        this._muzzleFlashLight = new THREE.PointLight(0xffdd44, 0, 3, 2);
        this._muzzleFlashLight.position.copy(this._muzzleFlashMesh.position);
        group.add(this._muzzleFlashLight);

        return group;
    }

    syncPlayer() {
        const p = this.game.player;
        // player.wx/wz are in tile-space coordinates (0..width) continuous.
        const wx = (p.wx ?? (p.x + 0.5)) - this._mapHalfW;
        const wz = (p.wz ?? (p.y + 0.5)) - this._mapHalfH;
        if (this._player) this._player.position.set(wx, 0.12 + this._elevAtWorld(wx, wz), wz);

        // Muzzle flash billboard
        if (this._muzzleFlashMesh) {
            const flash = this.game.combat?._muzzleFlash === true;
            this._muzzleFlashMesh.visible = flash;
            if (flash && this.camera) {
                this._muzzleFlashMesh.quaternion.copy(this.camera.quaternion);
            }
            if (this._muzzleFlashLight) {
                this._muzzleFlashLight.intensity = flash ? 2.5 : 0;
            }
        }

        // Visibility ring (stealth detection radius)
        if (this._visibilityRing) {
            const st = this.game.stealth;
            const showRing = st && this.game.mode === 'street';
            this._visibilityRing.visible = showRing;
            if (showRing) {
                const radius = st.getDetectionRadius() * 0.1;
                this._visibilityRing.scale.set(radius, radius, radius);
                const vis = st.visibility;
                const c = vis === 'hidden' ? 0x44ff44 : vis === 'low_profile' ? 0xffaa00 : 0xff4444;
                this._visibilityRing.material.color.setHex(c);
            }
        }

        // Move shadow cameras to follow player so shadows stay sharp nearby
        if (this.sunLight?.shadow) {
            this.sunLight.target.position.set(wx, 0, wz);
            this.sunLight.target.updateMatrixWorld();
            this.sunLight.position.set(wx + 30, 40, wz + 20);
        }
        if (this.sunLightFar?.shadow) {
            this.sunLightFar.target.position.set(wx, 0, wz);
            this.sunLightFar.target.updateMatrixWorld();
            this.sunLightFar.position.set(wx + 30, 40, wz + 20);
        }
    }

    _renderTracers() {
        const tracers = this.fxSystem?.getTracers();
        if (!tracers?.length) {
            if (this._tracerLines?.length) {
                for (const l of this._tracerLines) l.visible = false;
            }
            return;
        }
        if (!this._tracerLines) this._tracerLines = [];
        for (let i = 0; i < tracers.length; i++) {
            let line = this._tracerLines[i];
            if (!line) {
                const geo = new THREE.BufferGeometry();
                geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0], 3));
                const mat = new THREE.LineBasicMaterial({
                    transparent: true,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending,
                });
                line = new THREE.Line(geo, mat);
                this._tracerLines.push(line);
                this.scene.add(line);
            }
            const t = tracers[i];
            const progress = t.life / t.duration;
            const positions = line.geometry.attributes.position.array;
            const headT = Math.min(1, progress * 3);
            const tailT = Math.max(0, headT - t.length);
            positions[0] = t.sx + (t.ex - t.sx) * tailT;
            positions[1] = t.sy + (t.ey - t.sy) * tailT;
            positions[2] = t.sz + (t.ez - t.sz) * tailT;
            positions[3] = t.sx + (t.ex - t.sx) * headT;
            positions[4] = t.sy + (t.ey - t.sy) * headT;
            positions[5] = t.sz + (t.ez - t.sz) * headT;
            line.geometry.attributes.position.needsUpdate = true;
            line.material.color.setHex(t.color);
            line.material.opacity = 1 - progress;
            line.visible = true;
        }
        for (let i = tracers.length; i < this._tracerLines.length; i++) {
            this._tracerLines[i].visible = false;
        }
    }

    async _initDecalManager() {
        if (this._decalManager) {
            this._decalManager.dispose();
        }
        const { DecalManager } = await import('./render/fx/decal_manager.js');
        const preset = this._presetConfig || {};
        this._decalManager = new DecalManager(THREE, this.scene, {
            maxTotal: preset.decalCap ?? 512,
            maxPerChunk: preset.decalPerChunkCap ?? 64,
            chunkSize: this.game.map?.chunkManager?.chunkSize ?? 32,
            mapHalfW: this._mapHalfW,
            mapHalfH: this._mapHalfH,
            elevFn: (wx, wz) => this._elevAtWorld(wx, wz),
        });
        if (this.fxSystem) {
            this.fxSystem.setDecalManager(this._decalManager);
        }
    }

    _renderDecals() {
        if (this._decalManager) return;
        const decals = this.fxSystem?.getDecals();
        if (!decals?.length) {
            if (this._decalMeshes?.length) {
                for (const m of this._decalMeshes) m.visible = false;
            }
            return;
        }
        if (!this._decalMeshes) this._decalMeshes = [];
        if (!this._decalGeo) {
            this._decalGeo = new THREE.PlaneGeometry(0.15, 0.15);
            this._decalGeo.rotateX(-Math.PI / 2);
        }
        for (let i = 0; i < decals.length; i++) {
            let mesh = this._decalMeshes[i];
            if (!mesh) {
                const mat = new THREE.MeshBasicMaterial({
                    transparent: true,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                });
                mesh = new THREE.Mesh(this._decalGeo, mat);
                this._decalMeshes.push(mesh);
                this.scene.add(mesh);
            }
            const d = decals[i];
            mesh.position.set(d.x, d.y, d.z);
            mesh.material.color.setHex(d.color);
            mesh.material.opacity = 1 - (d.life / d.duration);
            mesh.visible = true;
        }
        for (let i = decals.length; i < this._decalMeshes.length; i++) {
            this._decalMeshes[i].visible = false;
        }
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

    /** Citizen clothing/appearance color palette */
    static CITIZEN_COLORS = [
        0x2196f3, 0xe91e63, 0x4caf50, 0xff9800, 0x9c27b0,
        0x00bcd4, 0xff5722, 0x607d8b, 0x795548, 0x3f51b5,
        0xcddc39, 0xf44336, 0x009688, 0xffc107, 0x673ab7,
    ];

    /** Neutral slate for roofs — kept out of the per-building palette tint so
     * walls and roofs separate instead of being the same muddy colour. */
    static ROOF_COLOR = 0x4a4e55;

    /** Car-paint palette for vehicles without an explicit colour. */
    static CAR_COLORS = [
        0xcc3333, 0x3366cc, 0x339933, 0xf0a030, 0x666699,
        0x2a6b6b, 0x884444, 0x777788, 0x8833aa, 0x334455,
        0xb0b0c0, 0xbb6622, 0x446644, 0x9955aa, 0x222244,
    ];

    rebuildCitizens() {
        if (this._citizensMesh) {
            this.scene.remove(this._citizensMesh);
            this._citizensMesh.geometry.dispose();
        }
        if (!this.game.citizens?.citizens) { this._citizensDirty = false; return; }

        const n = this.game.citizens.citizens.length;

        // Capsule-like geometry: cylinder body + sphere head (merged)
        const bodyGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.22, 8);
        bodyGeom.translate(0, 0.11, 0);
        const headGeom = new THREE.SphereGeometry(0.065, 8, 6);
        headGeom.translate(0, 0.26, 0);

        // Merge into one BufferGeometry for instancing
        const mergedGeom = this._mergeBufferGeometries([bodyGeom, headGeom]);
        bodyGeom.dispose();
        headGeom.dispose();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.6, metalness: 0.05,
            vertexColors: false,
        });
        this._citizensMesh = new THREE.InstancedMesh(mergedGeom, mat, Math.max(1, n));
        this._citizensMesh.castShadow = true;
        this._citizensMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Per-citizen colors for variety
        const colors = Renderer3D.CITIZEN_COLORS;
        for (let i = 0; i < n; i++) {
            const color = new THREE.Color(colors[i % colors.length]);
            this._citizensMesh.setColorAt(i, color);
        }
        if (this._citizensMesh.instanceColor) {
            this._citizensMesh.instanceColor.needsUpdate = true;
        }

        // Initialize animation timing for each citizen (random offset for variety)
        this._citizenAnimTimes = [];
        for (let i = 0; i < n; i++) {
            this._citizenAnimTimes.push({
                phase: rand01() * Math.PI * 2,
                speed: 2 + rand01() * 2,
                amplitude: 0.03 + rand01() * 0.02,
                wobblePhase: rand01() * Math.PI * 2,
            });
        }

        const dummy = new THREE.Object3D();
        for (let i = 0; i < n; i++) {
            const c = this.game.citizens.citizens[i];
            const wx = c.x - this._mapHalfW + 0.5;
            const wz = c.y - this._mapHalfH + 0.5;
            dummy.position.set(wx, 0.12 + this._elevAtWorld(wx, wz), wz);
            dummy.updateMatrix();
            this._citizensMesh.setMatrixAt(i, dummy.matrix);
        }
        this._citizensMesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this._citizensMesh);
        this._citizensDirty = false;

        // Build pets — ~20% of citizens own a pet
        this._rebuildPets(n);
    }

    /** Pet types with geometry and color configs */
    static PET_TYPES = [
        { name: 'dog',  bodyW: 0.10, bodyH: 0.06, bodyD: 0.05, headR: 0.03, color: 0x8d6e4c, tailLen: 0.04 },
        { name: 'cat',  bodyW: 0.08, bodyH: 0.05, bodyD: 0.04, headR: 0.025, color: 0xff8c42, tailLen: 0.05 },
        { name: 'dog2', bodyW: 0.09, bodyH: 0.055, bodyD: 0.045, headR: 0.028, color: 0xf5f5dc, tailLen: 0.035 },
        { name: 'cat2', bodyW: 0.07, bodyH: 0.045, bodyD: 0.035, headR: 0.022, color: 0x333333, tailLen: 0.045 },
    ];

    _rebuildPets(citizenCount) {
        // Clean up old pet meshes
        if (this._petMesh) {
            this.scene.remove(this._petMesh);
            this._petMesh.geometry.dispose();
            this._petMesh = null;
        }

        // Determine which citizens have pets (deterministic by citizen index)
        this._petOwners = [];
        this._petData = [];
        for (let i = 0; i < citizenCount; i++) {
            // ~20% chance based on hash of citizen index
            const hash = ((i * 2654435761) >>> 0) / 4294967296;
            if (hash < 0.20) {
                const petType = Renderer3D.PET_TYPES[Math.floor(hash * 20) % Renderer3D.PET_TYPES.length];
                this._petOwners.push(i);
                this._petData.push({
                    ownerIdx: i,
                    type: petType,
                    offsetAngle: hash * Math.PI * 2, // orbit angle behind owner
                    dispX: 0, dispY: 0,              // interpolated display position
                    phase: hash * Math.PI * 4,        // animation phase
                    trailDist: 0.3 + hash * 0.2,     // distance behind owner
                });
            }
        }

        const petCount = this._petOwners.length;
        if (petCount === 0) return;

        // Build a small body+head geometry for pets (similar to citizen but smaller)
        const bodyGeom = new THREE.BoxGeometry(0.10, 0.05, 0.05);
        bodyGeom.translate(0, 0.025, 0);
        const headGeom = new THREE.SphereGeometry(0.025, 6, 4);
        headGeom.translate(0.04, 0.04, 0);
        const tailGeom = new THREE.CylinderGeometry(0.005, 0.003, 0.04, 4);
        tailGeom.rotateZ(Math.PI * 0.3);
        tailGeom.translate(-0.05, 0.04, 0);
        const mergedGeom = this._mergeBufferGeometries([bodyGeom, headGeom, tailGeom]);
        bodyGeom.dispose();
        headGeom.dispose();
        tailGeom.dispose();

        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff, roughness: 0.7, metalness: 0.0,
            vertexColors: false,
        });
        this._petMesh = new THREE.InstancedMesh(mergedGeom, mat, petCount);
        this._petMesh.castShadow = true;
        this._petMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        // Set per-pet colors
        for (let i = 0; i < petCount; i++) {
            this._petMesh.setColorAt(i, new THREE.Color(this._petData[i].type.color));
        }
        if (this._petMesh.instanceColor) {
            this._petMesh.instanceColor.needsUpdate = true;
        }

        this.scene.add(this._petMesh);
    }

    updatePets() {
        if (!this._petMesh || !this._petData || !this._citizenPositions) return;
        const currentTime = performance.now() / 1000;
        const dummy = new THREE.Object3D();
        const lerpSpeed = 0.06; // Slightly slower than citizen for trailing effect

        for (let i = 0; i < this._petData.length; i++) {
            const pet = this._petData[i];
            const cp = this._citizenPositions[pet.ownerIdx];
            if (!cp) continue;

            // Pet target: offset behind owner based on heading
            const targetX = cp.dispX - Math.sin(cp.heading) * pet.trailDist;
            const targetY = cp.dispY - Math.cos(cp.heading) * pet.trailDist;

            // First frame init
            if (pet.dispX === 0 && pet.dispY === 0) {
                pet.dispX = targetX;
                pet.dispY = targetY;
            }

            // Smooth follow
            pet.dispX += (targetX - pet.dispX) * lerpSpeed;
            pet.dispY += (targetY - pet.dispY) * lerpSpeed;

            const wx = pet.dispX - this._mapHalfW + 0.5;
            const wz = pet.dispY - this._mapHalfH + 0.5;
            const groundY = this._elevAtWorld(wx, wz);

            // Pet heading: face toward owner
            const dx = cp.dispX - pet.dispX;
            const dy = cp.dispY - pet.dispY;
            const petHeading = Math.atan2(dx, dy);

            // Animation: trotting bob when owner is moving, idle sniff when stationary
            const isMoving = cp.isMoving;
            if (isMoving) {
                const trot = Math.sin(currentTime * 8 + pet.phase);
                const yBob = 0.02 + Math.abs(trot) * 0.015;
                dummy.position.set(wx, yBob + groundY, wz);
                dummy.rotation.set(0, petHeading, trot * 0.1);
            } else {
                // Idle: slight head movement (simulated via small rotation)
                const sniff = Math.sin(currentTime * 1.5 + pet.phase) * 0.06;
                dummy.position.set(wx, 0.02 + groundY, wz);
                dummy.rotation.set(0, petHeading + sniff, 0);
            }

            dummy.updateMatrix();
            this._petMesh.setMatrixAt(i, dummy.matrix);
        }
        this._petMesh.instanceMatrix.needsUpdate = true;
    }

    /** Merge multiple BufferGeometry objects into one (simple position+normal merge) */
    _mergeBufferGeometries(geometries) {
        let totalVerts = 0;
        let totalIndex = 0;
        for (const g of geometries) {
            totalVerts += g.getAttribute('position').count;
            totalIndex += g.index ? g.index.count : g.getAttribute('position').count;
        }
        const positions = new Float32Array(totalVerts * 3);
        const normals = new Float32Array(totalVerts * 3);
        const indices = new Uint32Array(totalIndex);
        let vertOffset = 0, idxOffset = 0, vertCountOffset = 0;
        for (const g of geometries) {
            const pos = g.getAttribute('position');
            const norm = g.getAttribute('normal');
            for (let i = 0; i < pos.count * 3; i++) {
                positions[vertOffset * 3 + i] = pos.array[i];
                if (norm) normals[vertOffset * 3 + i] = norm.array[i];
            }
            if (g.index) {
                for (let i = 0; i < g.index.count; i++) {
                    indices[idxOffset + i] = g.index.array[i] + vertCountOffset;
                }
                idxOffset += g.index.count;
            } else {
                for (let i = 0; i < pos.count; i++) {
                    indices[idxOffset + i] = i + vertCountOffset;
                }
                idxOffset += pos.count;
            }
            vertCountOffset += pos.count;
            vertOffset += pos.count;
        }
        const merged = new THREE.BufferGeometry();
        merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        merged.setIndex(new THREE.BufferAttribute(indices, 1));
        return merged;
    }

    updateCitizens() {
        if (!this._citizensMesh || !this.game.citizens?.citizens) return;
        const n = this.game.citizens.citizens.length;
        if (this._citizensMesh.count !== Math.max(1, n)) {
            this._citizensDirty = true;
            return;
        }

        const dummy = new THREE.Object3D();
        const currentTime = performance.now() / 1000;
        const lerpSpeed = 0.08; // Smoothing factor for position interpolation

        // Lazy-init per-citizen interpolation state
        if (!this._citizenPositions || this._citizenPositions.length !== n) {
            this._citizenPositions = [];
            for (let i = 0; i < n; i++) {
                const c = this.game.citizens.citizens[i];
                this._citizenPositions.push({
                    dispX: c.x, dispY: c.y,   // displayed (interpolated) position
                    prevX: c.x, prevY: c.y,   // last known sim position
                    heading: 0,                // facing angle (radians)
                    isMoving: false,
                    moveStartTime: 0,
                });
            }
        }

        for (let i = 0; i < n; i++) {
            const c = this.game.citizens.citizens[i];
            const cp = this._citizenPositions[i];
            const anim = this._citizenAnimTimes?.[i];

            // Update interpolation state (needed for both capsule and detailed characters)
            // Detect sim-level movement (citizen tile changed)
            if (c.x !== cp.prevX || c.y !== cp.prevY) {
                const dx = c.x - cp.prevX;
                const dy = c.y - cp.prevY;
                cp.heading = Math.atan2(dx, dy);
                cp.isMoving = true;
                cp.moveStartTime = currentTime;
                cp.prevX = c.x;
                cp.prevY = c.y;
            }

            // Smooth interpolation toward target tile
            cp.dispX += (c.x - cp.dispX) * lerpSpeed;
            cp.dispY += (c.y - cp.dispY) * lerpSpeed;
            if (Math.abs(c.x - cp.dispX) < 0.01) cp.dispX = c.x;
            if (Math.abs(c.y - cp.dispY) < 0.01) cp.dispY = c.y;

            const isMoving = cp.dispX !== c.x || cp.dispY !== c.y ||
                             (currentTime - cp.moveStartTime) < 0.5;
            cp.isMoving = isMoving;

            // Q11.C: character LOD — 4 tiers by camera distance.
            // LOD0 (<8): DetailedCharacter from CharacterPool (handled below via _detailedCitizenSet)
            // LOD1 (8-20): capsule with full walk animation (current)
            // LOD2 (20-40): capsule in static T-pose (skip anim calc)
            // LOD3 (>40): hidden
            const cwx = cp.dispX - this._mapHalfW + 0.5;
            const cwz = cp.dispY - this._mapHalfH + 0.5;
            const camDist = this.camera
                ? Math.sqrt((this.camera.position.x - cwx) ** 2 + (this.camera.position.z - cwz) ** 2)
                : 0;

            if (camDist > LOD_DIST.characters.far) {
                // LOD3: hidden beyond far threshold
                dummy.position.set(0, -10, 0); dummy.scale.set(0, 0, 0);
                dummy.updateMatrix(); this._citizensMesh.setMatrixAt(i, dummy.matrix);
                continue;
            }

            // Hide instanced capsule if this citizen has a detailed character model
            if (this._detailedCitizenSet?.has(i)) {
                dummy.position.set(0, -10, 0);
                dummy.scale.set(0, 0, 0);
                dummy.updateMatrix();
                this._citizensMesh.setMatrixAt(i, dummy.matrix);
                continue;
            }

            // Capsule rendering for far citizens
            dummy.scale.set(1, 1, 1);
            const wx = cwx;
            const wz = cwz;
            const groundY = this._elevAtWorld(wx, wz);

            const useLOD2 = camDist > LOD_DIST.characters.mid;
            if (!useLOD2 && anim) {
                // LOD1: full walk animation
                if (isMoving) {
                    const walkSpeed = anim.speed * 2.5;
                    const stride = Math.sin(currentTime * walkSpeed + anim.phase);
                    const yBob = 0.12 + Math.abs(stride) * 0.035;
                    const lean = stride * 0.12;
                    dummy.position.set(wx, yBob + groundY, wz);
                    dummy.rotation.set(0, cp.heading, lean);
                } else {
                    const breathe = Math.sin(currentTime * anim.speed * 0.5 + anim.phase) * 0.01;
                    dummy.position.set(wx, 0.12 + breathe + groundY, wz);
                    dummy.rotation.set(0, cp.heading, 0);
                }
            } else {
                // LOD2: static T-pose, no animation calc
                dummy.position.set(wx, 0.12 + groundY, wz);
                dummy.rotation.set(0, cp.heading, 0);
            }

            dummy.updateMatrix();
            this._citizensMesh.setMatrixAt(i, dummy.matrix);
        }
        this._citizensMesh.instanceMatrix.needsUpdate = true;
    }

    updateVehicles() {
        const vs = this.game.vehicleSystem;
        if (!vs) return;
        const vehicles = vs.vehicles;

        // Rebuild when count changes or when a model finished loading late
        // (vehicles can spawn before the GLBs resolve, leaving box fallbacks).
        if (this._vehicleModelsDirty || this._vehicleGroup.children.length !== vehicles.length) {
            this._vehicleModelsDirty = false;
            this._vehicleGroup.clear();
            for (const v of vehicles) {
                // System type (PASSENGER…) → model key (sedan…) via VEHICLE_TYPES.
                const model = this._vehicleModels.get(VEHICLE_TYPES[v.type]?.modelKey ?? v.type);
                if (model) {
                    const clone = model.clone(true);
                    // Q11.D: per-vehicle paint tint. The atlas map + box-projected
                    // UVs are baked into the shared model; clone the material so
                    // each vehicle's colour doesn't bleed across the fleet.
                    const paint = this._vehicleColor(v);
                    clone.traverse((child) => {
                        if (!child.isMesh || !child.material) return;
                        const base = Array.isArray(child.material) ? child.material[0] : child.material;
                        if (!base) return;
                        const m = base.clone();
                        m.color.set(((child.name || '').toLowerCase().includes('wheel')) ? 0x1a1a1c : paint);
                        child.material = m;
                    });
                    // Q11.C: wrap in 4-tier LOD (full model → box → tiny box → hidden)
                    const lodNode = createVehicleLOD(clone, paint);
                    lodNode.userData.vehicleId = v.id;
                    this._vehicleGroup.add(lodNode);
                } else {
                    // Fallback: colored box wrapped in LOD (no model for this type)
                    const paint = this._vehicleColor(v);
                    const mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.45, 0.18, 0.22),
                        new THREE.MeshStandardMaterial({ color: paint, roughness: 0.4, metalness: 0.3 })
                    );
                    mesh.castShadow = true;
                    const lodNode = createVehicleLOD(mesh, paint);
                    lodNode.userData.vehicleId = v.id;
                    this._vehicleGroup.add(lodNode);
                }
            }
        }

        // Update positions every frame + tire skid decals
        for (let i = 0; i < vehicles.length; i++) {
            const v = vehicles[i];
            const child = this._vehicleGroup.children[i];
            if (!child) continue;
            const wx = v.x - this._mapHalfW + 0.5;
            const wz = v.y - this._mapHalfH + 0.5;
            child.position.set(wx, 0.06 + this._elevAtWorld(wx, wz), wz);
            child.rotation.y = v.angle ?? 0;

            // GPU spark+smoke burst once, on the frame a vehicle explodes (Q10.E)
            if (v._exploded) {
                if (!this._burstSeen) this._burstSeen = new Set();
                if (!this._burstSeen.has(v.id)) {
                    this._burstSeen.add(v.id);
                    this._spawnGPUBurst(wx, 0.35 + this._elevAtWorld(wx, wz), wz);
                }
            }

            if (this._decalManager && (v.driftFactor ?? 0) > 0.3 && Math.abs(v.speed ?? 0) > 2) {
                this._decalManager.spawnGround(wx, wz, {
                    decalType: 'skid',
                    size: 0.06,
                    duration: 20000,
                    rotation: v.angle ?? 0,
                    opacity: Math.min(0.6, (v.driftFactor ?? 0) * 0.7),
                    weatherFade: true,
                });
            }
        }
        // Q11.B: per-vehicle frustum cull using freshly-set positions (one-frame-lag
        // frustum from previous syncChunkStreaming is intentional and harmless).
        cullByPosition(this._vehicleGroup.children, this._frustum, 0.5);
    }

    updatePoliceUnits() {
        const ps = this.game.policeSystem;
        if (!ps) return;
        const units = ps.units || [];

        // No police = hide and skip
        if (units.length === 0) {
            if (this._policeGroup.children.length > 0) this._policeGroup.clear();
            return;
        }

        // Rebuild police meshes only when count changes — reuse shared geometry/material
        if (this._policeGroup.children.length !== units.length) {
            this._policeGroup.clear();
            if (!this._policeBodyGeo) {
                this._policeBodyGeo = new THREE.BoxGeometry(0.45, 0.15, 0.22);
                this._policeBodyMat = this._carPaintMaterial(0xffffff, { roughness: 0.3, metalness: 0.4 });
                this._policeLightGeo = new THREE.BoxGeometry(0.2, 0.06, 0.22);
            }
            for (const u of units) {
                const body = new THREE.Mesh(this._policeBodyGeo, this._policeBodyMat);
                const lights = new THREE.Mesh(this._policeLightGeo,
                    new THREE.MeshStandardMaterial({ color: 0x2255ff, emissive: 0x2255ff, emissiveIntensity: 0.8 })
                );
                lights.position.y = 0.1;
                const group = new THREE.Group();
                group.add(body);
                group.add(lights);
                this._policeGroup.add(group);
            }
        }

        // Update positions
        const flash = Math.sin(performance.now() * 0.01) > 0;
        for (let i = 0; i < units.length; i++) {
            const u = units[i];
            const child = this._policeGroup.children[i];
            if (!child) continue;
            const pwx = u.x - this._mapHalfW + 0.5;
            const pwz = u.y - this._mapHalfH + 0.5;
            child.position.set(pwx, 0.06 + this._elevAtWorld(pwx, pwz), pwz);
            child.rotation.y = (u.heading || 0) * Math.PI / 180;

            if (u.state === 'pursuit') {
                const lights = child.children[1];
                if (lights?.material) {
                    const hex = flash ? 0x2255ff : 0xff2222;
                    lights.material.color.setHex(hex);
                    lights.material.emissive.setHex(hex);
                }
            }
        }
    }

    static WETNESS_ACCUM = {
        [TERRAIN_ROAD]: 0.015, [TERRAIN_SIDEWALK]: 0.012, [TERRAIN_PARK]: 0.008,
        [TERRAIN_GRASS]: 0.008, [TERRAIN_HIGHWAY]: 0.013, [TERRAIN_BRIDGE]: 0.010,
        [TERRAIN_TUNNEL]: 0.004, [TERRAIN_FOREST]: 0.005, [TERRAIN_MOUNTAIN]: 0.003,
        [TERRAIN_WATER]: 0,
    };

    static WETNESS_DRAIN = {
        [TERRAIN_ROAD]: 0.003, [TERRAIN_SIDEWALK]: 0.004, [TERRAIN_PARK]: 0.006,
        [TERRAIN_GRASS]: 0.006, [TERRAIN_HIGHWAY]: 0.004, [TERRAIN_BRIDGE]: 0.008,
        [TERRAIN_TUNNEL]: 0.002, [TERRAIN_FOREST]: 0.010, [TERRAIN_MOUNTAIN]: 0.015,
        [TERRAIN_WATER]: 0,
    };

    _updateWetnessMap(isRaining, intensity) {
        const map = this.game?.map;
        if (!map) return;
        if (!this._wetnessMap) {
            this._wetnessMap = new Float32Array(map.width * map.height);
        }
        if (!this._wetness) this._wetness = 0;

        const wm = this._wetnessMap;
        const w = map.width;
        for (const [, entry] of this._chunkMeshes) {
            const b = entry.bounds;
            for (let ty = b.minY; ty <= b.maxY; ty++) {
                for (let tx = b.minX; tx <= b.maxX; tx++) {
                    const idx = ty * w + tx;
                    const terrain = map.getTileAt(tx, ty);
                    if (isRaining) {
                        const acc = Renderer3D.WETNESS_ACCUM[terrain] ?? 0.005;
                        wm[idx] = Math.min(1, wm[idx] + acc * intensity);
                    } else {
                        const drain = Renderer3D.WETNESS_DRAIN[terrain] ?? 0.005;
                        wm[idx] = Math.max(0, wm[idx] - drain);
                    }
                }
            }
        }

        if (isRaining) {
            this._wetness = Math.min(1.0, this._wetness + 0.008 * intensity);
        } else {
            this._wetness = Math.max(0, this._wetness - 0.002);
        }
    }

    _chunkAvgWetness(chunkId) {
        if (!this._wetnessMap) return this._wetness ?? 0;
        const entry = this._chunkMeshes.get(chunkId);
        if (!entry) return this._wetness ?? 0;
        const b = entry.bounds;
        const w = this.game.map.width;
        let sum = 0, count = 0;
        for (let ty = b.minY; ty <= b.maxY; ty++) {
            for (let tx = b.minX; tx <= b.maxX; tx++) {
                sum += this._wetnessMap[ty * w + tx];
                count++;
            }
        }
        return count > 0 ? sum / count : 0;
    }

    getWetness(tx, ty) {
        if (!this._wetnessMap) return this._wetness ?? 0;
        const w = this.game?.map?.width ?? 0;
        if (w === 0) return 0;
        return this._wetnessMap[ty * w + tx] ?? 0;
    }

    _spawnPuddleDecals(isRain, intensity) {
        if (!this._decalManager || !isRain || this._wetness < 0.3) return;
        if (!this._puddleTimer) this._puddleTimer = 0;
        this._puddleTimer++;
        if (this._puddleTimer < 30) return;
        this._puddleTimer = 0;

        const p = this.game.player;
        const rng = this.game?.rngStreams?.vfx;
        if (!rng) return;
        const radius = 8;
        const puddleTerrain = new Set([TERRAIN_ROAD, TERRAIN_SIDEWALK, TERRAIN_PARK]);
        const spawned = Math.min(3, Math.ceil(intensity * 4));

        for (let n = 0; n < spawned; n++) {
            const ox = Math.floor(rng.next() * radius * 2) - radius;
            const oz = Math.floor(rng.next() * radius * 2) - radius;
            const tx = Math.floor(p.x) + ox;
            const ty = Math.floor(p.y) + oz;
            const terrain = this.game.map.getTileAt(tx, ty);
            if (!puddleTerrain.has(terrain)) continue;
            const wx = tx - this._mapHalfW + 0.5 + (rng.next() - 0.5) * 0.6;
            const wz = ty - this._mapHalfH + 0.5 + (rng.next() - 0.5) * 0.6;
            const size = 0.25 + rng.next() * 0.35;
            this._decalManager.spawnGround(wx, wz, {
                decalType: 'puddle',
                size,
                duration: 30000 + rng.next() * 30000,
                rotation: rng.next() * Math.PI * 2,
                opacity: 0.35 + this._wetness * 0.35,
            });
        }
    }

    /**
     * GPU rain (Q10.E): per-drop attributes are uploaded once; the vertex shader
     * evaluates fall + wind-slant + wrap as a closed-form function of uTime, so
     * there is no per-frame CPU loop and no buffer re-upload. Streaks are kept by
     * giving the two LineSegments verts of each drop a shared phase but different
     * vertical offsets. WebGL2 equivalent of compute-emulated particles.
     */
    /**
     * Particle-count multiplier from the active quality preset (Q10.E "50x").
     * Because every drop/flake animates closed-form in the vertex shader, the
     * per-frame CPU cost is a single uTime uniform write regardless of count —
     * so the count budget can scale 50x+ with zero frame-cost change. Clamped
     * for sanity; an explicit override (verification/benchmark) wins.
     */
    _particleDensity() {
        if (this._particleDensityOverride > 0) return this._particleDensityOverride;
        const d = this._presetConfig?.particleDensity;
        return Math.max(0.25, Math.min(60, typeof d === 'number' ? d : 1));
    }

    _buildGPURain() {
        const COUNT = Math.round(4000 * this._particleDensity()), AREA = 40, RANGE = 14;
        const verts = COUNT * 2;
        const aBase = new Float32Array(verts * 3);
        const aPhase = new Float32Array(verts);
        const aVertOffset = new Float32Array(verts);
        for (let i = 0; i < COUNT; i++) {
            const bx = (rand01() - 0.5) * AREA;
            const bz = (rand01() - 0.5) * AREA;
            const phase = rand01() * RANGE;
            const streak = 0.2 + rand01() * 0.35;
            for (let v = 0; v < 2; v++) {
                const k = (i * 2 + v) * 3;
                aBase[k] = bx; aBase[k + 1] = 0; aBase[k + 2] = bz;
                aPhase[i * 2 + v] = phase;
                aVertOffset[i * 2 + v] = v === 0 ? 0 : streak; // top vs bottom of the streak
            }
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
        geom.setAttribute('aBase', new THREE.BufferAttribute(aBase, 3));
        geom.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
        geom.setAttribute('aVertOffset', new THREE.BufferAttribute(aVertOffset, 1));
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: {
                uTime: { value: 0 }, uFallSpeed: { value: 8 }, uRange: { value: RANGE },
                uWind: { value: new THREE.Vector2() }, uOpacity: { value: 0.5 },
                uColor: { value: new THREE.Color(0x99bbdd) },
            },
            vertexShader: `
                uniform float uTime, uFallSpeed, uRange;
                uniform vec2 uWind;
                attribute vec3 aBase;
                attribute float aPhase, aVertOffset;
                void main() {
                    float yFall = mod(uFallSpeed * uTime + aPhase, uRange);
                    vec3 pos = aBase;
                    pos.y = uRange - yFall - aVertOffset;
                    pos.xz = aBase.xz + uWind * yFall;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }`,
            fragmentShader: `
                uniform vec3 uColor; uniform float uOpacity;
                void main() { gl_FragColor = vec4(uColor, uOpacity); }`,
        });
        const group = new THREE.LineSegments(geom, mat);
        group.frustumCulled = false;
        this.scene.add(group);
        return group;
    }

    /**
     * GPU snow (Q10.E): static per-flake attributes; the vertex shader does fall +
     * wobble + wrap from uTime with no CPU loop. Soft round points via gl_PointCoord.
     */
    _buildGPUSnow() {
        const COUNT = Math.round(2000 * this._particleDensity()), AREA = 40, RANGE = 14;
        const aBase = new Float32Array(COUNT * 3);
        const aPhase = new Float32Array(COUNT);
        for (let i = 0; i < COUNT; i++) {
            aBase[i * 3] = (rand01() - 0.5) * AREA;
            aBase[i * 3 + 1] = 0;
            aBase[i * 3 + 2] = (rand01() - 0.5) * AREA;
            aPhase[i] = rand01() * RANGE;
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
        geom.setAttribute('aBase', new THREE.BufferAttribute(aBase, 3));
        geom.setAttribute('aPhase', new THREE.BufferAttribute(aPhase, 1));
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false,
            uniforms: {
                uTime: { value: 0 }, uFallSpeed: { value: 1.4 }, uRange: { value: RANGE },
                uWind: { value: new THREE.Vector2() }, uOpacity: { value: 0.85 },
                uSize: { value: 14 }, uColor: { value: new THREE.Color(0xeeeeff) },
            },
            vertexShader: `
                uniform float uTime, uFallSpeed, uRange, uSize;
                uniform vec2 uWind;
                attribute vec3 aBase;
                attribute float aPhase;
                void main() {
                    float yFall = mod(uFallSpeed * uTime + aPhase, uRange);
                    vec3 pos = aBase;
                    pos.y = uRange - yFall;
                    pos.x = aBase.x + sin(uTime * 0.5 + aPhase * 6.0) * 0.4 + uWind.x * yFall;
                    pos.z = aBase.z + cos(uTime * 0.4 + aPhase * 6.0) * 0.4 + uWind.y * yFall;
                    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = uSize * (1.0 / max(0.1, -mv.z));
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform vec3 uColor; uniform float uOpacity;
                void main() {
                    float d = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
                    gl_FragColor = vec4(uColor, uOpacity * d);
                }`,
        });
        const group = new THREE.Points(geom, mat);
        group.frustumCulled = false;
        this.scene.add(group);
        return group;
    }

    /**
     * GPU spark + smoke bursts (Q10.E). A small round-robin pool of Points clouds;
     * each particle's trajectory is uploaded once and animated entirely in the
     * vertex shader from a per-burst uElapsed (sparks = ballistic + gravity, smoke
     * = buoyant expanding puffs). No CPU per-particle work — 50x count headroom.
     */
    _buildGPUBurstSlot() {
        const PER = 64;   // half spark, half smoke
        const aDir = new Float32Array(PER * 3);
        const aSpeed = new Float32Array(PER);
        const aKind = new Float32Array(PER);
        const rng = this.game?.rngStreams?.vfx;
        const rnd = () => (rng ? rng.next() : rand01());
        for (let i = 0; i < PER; i++) {
            // Random direction on a hemisphere (biased upward).
            const theta = rnd() * Math.PI * 2;
            const phi = rnd() * Math.PI * 0.55;
            aDir[i * 3] = Math.cos(theta) * Math.sin(phi);
            aDir[i * 3 + 1] = Math.cos(phi) + 0.3;
            aDir[i * 3 + 2] = Math.sin(theta) * Math.sin(phi);
            const kind = i < PER / 2 ? 0 : 1;
            aKind[i] = kind;
            aSpeed[i] = kind === 0 ? (3 + rnd() * 5) : (0.6 + rnd() * 0.8);
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PER * 3), 3));
        geom.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));
        geom.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
        geom.setAttribute('aKind', new THREE.BufferAttribute(aKind, 1));
        const mat = new THREE.ShaderMaterial({
            transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
            uniforms: {
                uElapsed: { value: 0 }, uLife: { value: 1.4 }, uOrigin: { value: new THREE.Vector3() },
                uSparkColor: { value: new THREE.Color(0xffd070) },
                uSmokeColor: { value: new THREE.Color(0x6a5a4a) },
            },
            vertexShader: `
                uniform float uElapsed, uLife;
                uniform vec3 uOrigin;
                attribute vec3 aDir;
                attribute float aSpeed, aKind;
                varying float vKind, vAge;
                void main() {
                    float t = uElapsed;
                    vAge = clamp(t / uLife, 0.0, 1.0);
                    vKind = aKind;
                    vec3 pos = uOrigin;
                    if (aKind < 0.5) { pos += aDir * aSpeed * t; pos.y -= 4.0 * t * t; }
                    else { pos += aDir * aSpeed * 0.3 * t; pos.y += 1.2 * t; }
                    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
                    float size = (aKind < 0.5) ? 9.0 : (16.0 + 70.0 * vAge);
                    gl_PointSize = size * (1.0 / max(0.1, -mv.z));
                    gl_Position = projectionMatrix * mv;
                }`,
            fragmentShader: `
                uniform vec3 uSparkColor, uSmokeColor;
                varying float vKind, vAge;
                void main() {
                    float d = length(gl_PointCoord - 0.5);
                    if (vKind < 0.5) {
                        float a = smoothstep(0.5, 0.1, d) * (1.0 - vAge);
                        gl_FragColor = vec4(uSparkColor, a);
                    } else {
                        float a = smoothstep(0.5, 0.0, d) * (1.0 - vAge) * 0.45;
                        gl_FragColor = vec4(uSmokeColor, a);
                    }
                }`,
        });
        const pts = new THREE.Points(geom, mat);
        pts.frustumCulled = false;
        pts.visible = false;
        this.scene.add(pts);
        return { pts, mat, active: false };
    }

    /** Fire a spark+smoke burst at a world position (round-robin pool). */
    _spawnGPUBurst(wx, wy, wz) {
        if (this.testMode) return;
        if (!this._gpuBursts) {
            this._gpuBursts = [];
            for (let i = 0; i < 10; i++) this._gpuBursts.push(this._buildGPUBurstSlot());
            this._gpuBurstNext = 0;
        }
        const slot = this._gpuBursts[this._gpuBurstNext];
        this._gpuBurstNext = (this._gpuBurstNext + 1) % this._gpuBursts.length;
        slot.mat.uniforms.uOrigin.value.set(wx, wy, wz);
        slot.mat.uniforms.uElapsed.value = 0;
        slot.active = true;
        slot.pts.visible = true;
        // Explosions throw a warm light pulse into the GI grid (Q10.G delta).
        if (!this._giPulses) this._giPulses = [];
        this._giPulses.push({ wx, wz, radius: 7, color: { r: 1.0, g: 0.5, b: 0.18 }, base: 1.1, t: 0, life: 0.9 });
    }

    /** Advance + collect this frame's dynamic GI light deltas (Q10.G). */
    _collectGIDeltas(dtSec) {
        if (!this._giPulses || this._giPulses.length === 0) return null;
        const out = [];
        for (const p of this._giPulses) {
            p.t += dtSec;
            if (p.t >= p.life) continue;
            out.push({ wx: p.wx, wz: p.wz, radius: p.radius, color: p.color, intensity: p.base * (1 - p.t / p.life) });
        }
        this._giPulses = this._giPulses.filter((p) => p.t < p.life);
        return out.length ? out : null;
    }

    _updateGPUBursts(dt) {
        if (!this._gpuBursts) return;
        for (const slot of this._gpuBursts) {
            if (!slot.active) continue;
            const u = slot.mat.uniforms;
            u.uElapsed.value += dt;
            if (u.uElapsed.value >= u.uLife.value) {
                slot.active = false;
                slot.pts.visible = false;
            }
        }
    }

    updateWeatherFX(dt) {
        const ws = this.game?.weatherSystem;
        if (!ws) return;

        const weatherType = ws.state?.type;
        const intensity = ws.state?.intensity || 0;
        const windDir = ws.state?.windDirection || 0;
        const windSpeed = ws.state?.windSpeed || 0;
        const isRain = weatherType === 'rain' || weatherType === 'storm';
        const isStorm = weatherType === 'storm';
        const isFog = weatherType === 'fog';
        const isSnow = weatherType === 'snow';

        // Hide particles when not needed
        if (this._rainGroup && !isRain) this._rainGroup.visible = false;
        if (this._snowGroup && !isSnow) this._snowGroup.visible = false;

        // --- Per-tile wetness map (weather + drainage driven) ---
        this._updateWetnessMap(isRain || isStorm, intensity);

        // Apply per-chunk average wetness to terrain materials (Fresnel via clearcoat on roads)
        if (this._wetness > 0.01 || this._prevWetness > 0.01) {
            for (const [chunkId, entry] of this._chunkMeshes) {
                const chunkW = this._chunkAvgWetness(chunkId);
                const targetMetal = chunkW * 0.45;
                const targetRough = 1.0 - chunkW * 0.3;
                entry.group.traverse((obj) => {
                    if (!obj.isMesh || obj.userData?.kind !== 'terrain' || !obj.material || Array.isArray(obj.material)) return;
                    obj.material.metalness = THREE.MathUtils.lerp(obj.material.metalness, targetMetal, 0.1);
                    obj.material.roughness = THREE.MathUtils.lerp(obj.material.roughness, targetRough, 0.1);
                    if (obj.userData.isRoad && obj.material.clearcoat !== undefined) {
                        obj.material.clearcoat = THREE.MathUtils.lerp(obj.material.clearcoat, chunkW * 0.8, 0.1);
                        obj.material.clearcoatRoughness = THREE.MathUtils.lerp(obj.material.clearcoatRoughness, 0.15 + (1 - chunkW) * 0.35, 0.1);
                    }
                });
            }
        }
        this._prevWetness = this._wetness;

        // --- Puddle decals on flat ground during rain ---
        this._spawnPuddleDecals(isRain, intensity);

        // --- Fog density adapts to weather ---
        if (this.scene.fog) {
            let targetDensity = 0.006; // default — tighter fog to hide tile edges
            if (isFog) targetDensity = 0.010 + intensity * 0.008;
            else if (isRain) targetDensity = 0.007 + intensity * 0.003;
            else if (isSnow) targetDensity = 0.008 + intensity * 0.004;
            this.scene.fog.density = THREE.MathUtils.lerp(this.scene.fog.density, targetDensity, 0.05);
            // Fog color shifts for weather mood
            if (isFog) {
                this.scene.fog.color.lerp(new THREE.Color(0x9aacb8), 0.03);
            } else if (isRain || isStorm) {
                this.scene.fog.color.lerp(new THREE.Color(0x556677), 0.03);
            } else {
                this.scene.fog.color.lerp(new THREE.Color(0x7ab0d0), 0.02);
            }
        }

        // Skip particle updates when weather is clear or in test mode
        if (this.testMode) return;
        if (!isRain && !isFog && !isStorm && !isSnow && this._wetness < 0.01) return;

        // --- Lightning flash trigger (storms only) ---
        if (isStorm && !this._lightningFlashActive) {
            const rng = this.game?.rngStreams?.sim;
            if (rng && rng.next() < 0.02) { // ~2% chance per tick
                this._triggerLightningFlash();
            }
        }

        // --- Rain particle system (streaks with wind) ---
        if (isRain) {
            if (!this._rainGroup) this._rainGroup = this._buildGPURain();
            this._rainGroup.visible = true;
            const p = this._player?.position;
            if (p) this._rainGroup.position.set(p.x, 0, p.z);
            const u = this._rainGroup.material.uniforms;
            u.uTime.value = performance.now() / 1000;
            u.uFallSpeed.value = (isStorm ? 14.0 : 8.0) * Math.max(0.2, intensity);
            u.uWind.value.set(Math.cos(windDir) * windSpeed * 0.06, Math.sin(windDir) * windSpeed * 0.06);
            u.uOpacity.value = 0.25 + intensity * 0.45;
        }

        // --- Snow particle system (GPU) ---
        if (isSnow) {
            if (!this._snowGroup) this._snowGroup = this._buildGPUSnow();
            this._snowGroup.visible = true;
            const p = this._player?.position;
            if (p) this._snowGroup.position.set(p.x, 0, p.z);
            const u = this._snowGroup.material.uniforms;
            u.uTime.value = performance.now() / 1000;
            u.uFallSpeed.value = 1.4 * Math.max(0.2, intensity);
            u.uWind.value.set(Math.cos(windDir) * windSpeed * 0.05, Math.sin(windDir) * windSpeed * 0.05);
            u.uOpacity.value = 0.5 + intensity * 0.4;
        }

        // --- Leaf fall in autumn ---
        const isAutumn = this.game?.weatherSystem?.state?.season === 'autumn';
        if (this._leafGroup && !isAutumn) this._leafGroup.visible = false;
        if (isAutumn) {
            const LEAF_COUNT = 600;
            if (!this._leafGroup) {
                const positions = new Float32Array(LEAF_COUNT * 3);
                for (let i = 0; i < LEAF_COUNT; i++) {
                    positions[i * 3] = (rand01() - 0.5) * 40;
                    positions[i * 3 + 1] = rand01() * 8;
                    positions[i * 3 + 2] = (rand01() - 0.5) * 40;
                }
                const geom = new THREE.BufferGeometry();
                geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                this._leafGroup = new THREE.Points(geom, new THREE.PointsMaterial({
                    color: 0xcc8833, size: 0.04, transparent: true, opacity: 0.8, depthWrite: false,
                }));
                this.scene.add(this._leafGroup);
            }
            this._leafGroup.visible = true;
            if (this._player) this._leafGroup.position.copy(this._player.position);
            const lp = this._leafGroup.geometry.attributes.position.array;
            const t = performance.now() / 1000;
            for (let i = 0; i < LEAF_COUNT; i++) {
                const j = i * 3;
                lp[j + 1] -= 0.02 + Math.sin(t * 0.8 + i * 0.7) * 0.01;
                lp[j] += Math.sin(t * 1.2 + i * 0.5) * 0.008 + Math.cos(windDir) * windSpeed * 0.004;
                lp[j + 2] += Math.cos(t * 0.9 + i * 0.6) * 0.006 + Math.sin(windDir) * windSpeed * 0.004;
                if (lp[j + 1] < 0) {
                    lp[j] = (rand01() - 0.5) * 40;
                    lp[j + 1] = 6 + rand01() * 4;
                    lp[j + 2] = (rand01() - 0.5) * 40;
                }
            }
            this._leafGroup.geometry.attributes.position.needsUpdate = true;
        }

        // --- Lightning flashes during storms (with screen shake + thunder timing) ---
        if (isStorm && this.ambientLight) {
            if (!this._lightningTimer) this._lightningTimer = 5000;
            this._lightningTimer -= dt;
            if (this._lightningTimer <= 0) {
                this._lightningTimer = 2000 + rand01() * 7000;
                this._lightningFlash = 250;
                // Screen shake for close strikes
                if (rand01() < 0.4) {
                    this.shakeCamera(0.8, 400);
                }
            }
            if (this._lightningFlash > 0) {
                this._lightningFlash -= dt;
                const flashIntensity = Math.max(0, this._lightningFlash / 250);
                // Flash the sun light for dramatic shadow recalculation
                if (this.sunLight) {
                    this.sunLight.intensity = Math.max(this.sunLight.intensity, flashIntensity * 4.0);
                }
                this.ambientLight.intensity = Math.min(4, this.ambientLight.intensity + flashIntensity * 3);
            }
        }

        // --- Sky darkening during weather ---
        if (this._sky) {
            const skyUniforms = this._sky.material.uniforms;
            if (isRain || isStorm) {
                skyUniforms['turbidity'].value = THREE.MathUtils.lerp(skyUniforms['turbidity'].value, 12 + intensity * 6, 0.02);
                skyUniforms['rayleigh'].value = THREE.MathUtils.lerp(skyUniforms['rayleigh'].value, 1.5, 0.02);
            } else if (isFog) {
                skyUniforms['turbidity'].value = THREE.MathUtils.lerp(skyUniforms['turbidity'].value, 10, 0.02);
                skyUniforms['rayleigh'].value = THREE.MathUtils.lerp(skyUniforms['rayleigh'].value, 2.0, 0.02);
            } else {
                skyUniforms['turbidity'].value = THREE.MathUtils.lerp(skyUniforms['turbidity'].value, 4, 0.01);
                skyUniforms['rayleigh'].value = THREE.MathUtils.lerp(skyUniforms['rayleigh'].value, 3, 0.01);
            }
        }
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

        // Smooth camera mode transition with 400ms delta-time based animation
        if (this.cameraModeTransition !== this.cameraModeTarget) {
            this.cameraModeTransitionTimer += dt;
            const transitionProgress = Math.min(this.cameraModeTransitionTimer / 400, 1);
            // Apply ease-in-out smoothing
            const easedProgress = transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
            this.cameraModeTransition = THREE.MathUtils.lerp(
                this.cameraModeTransition,
                this.cameraModeTarget,
                easedProgress
            );
            if (transitionProgress >= 1) {
                this.cameraModeTransition = this.cameraModeTarget;
                this.cameraModeTransitionTimer = 0;
            }
        } else {
            this.cameraModeTransitionTimer = 0;
        }
        const t = this.cameraModeTransition; // 0 = street, 1 = god

        // Vehicle camera override when player is driving
        const vc = this.game.vehicleController;
        const isDriving = vc && vc.isDriving;
        let currentPitch, currentFollowDist, currentFollowHeight, currentFOV;

        if (isDriving) {
            const vehicle = vc.getActiveVehicle();
            const speed = vehicle ? (vehicle.speed || 0) : 0;
            const maxSpeed = vehicle ? (vehicle.maxSpeed || 22) : 22;
            const speedRatio = Math.min(1, speed / maxSpeed);

            currentPitch = this.vehicleCamera.pitch;
            // Camera pulls back at high speed for wider view
            currentFollowDist = this.vehicleCamera.followDist + speedRatio * 2.5;
            currentFollowHeight = this.vehicleCamera.followHeight + speedRatio * 0.8;
            // Speed-based FOV widening
            currentFOV = THREE.MathUtils.lerp(this.vehicleCamera.fov, this.vehicleCamera.maxSpeedFOV, speedRatio);

            // Auto-rotate camera yaw to follow vehicle heading (lag behind)
            if (vehicle && vehicle.angle !== undefined) {
                const targetYaw = vehicle.angle + Math.PI; // behind the vehicle
                let diff = targetYaw - this._vehicleCamYaw;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                // Faster follow at low speed, laggier at high speed for cinematic feel
                const followRate = THREE.MathUtils.lerp(0.12, 0.05, speedRatio);
                this._vehicleCamYaw += diff * followRate;
                this.yaw = this._vehicleCamYaw;
            }

            // Speed-based camera shake (stronger off-road)
            if (speedRatio > 0.5) {
                const offRoad = (vehicle && !vehicle._onRoad) ? 2.0 : 1.0;
                const shakeAmt = (speedRatio - 0.5) * 0.018 * offRoad;
                this.shakeIntensity = Math.max(this.shakeIntensity, shakeAmt);
            }

            // Collision screen shake
            if (vc._lastCollision && vc._lastImpactSpeed > 3) {
                this.shakeCamera(Math.min(2.5, vc._lastImpactSpeed * 0.3), 300);
            }
        } else {
            // Interpolate camera settings based on mode transition
            currentPitch = THREE.MathUtils.lerp(this.streetCamera.pitch, this.godCamera.pitch, t);
            currentFollowDist = THREE.MathUtils.lerp(this.streetCamera.followDist, this.godCamera.followDist, t);
            currentFollowHeight = THREE.MathUtils.lerp(this.streetCamera.followHeight, this.godCamera.followHeight, t);
            currentFOV = THREE.MathUtils.lerp(this.streetCamera.fov, this.godCamera.fov, t);
        }

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

        // Build ideal camera position (reuse cached vector)
        let idealCamPos = this._camIdeal.set(idealX, targetHeight, idealZ);

        // Collision detection: raycast from player to camera position
        // Check for obstacles (mountains, buildings) along the line
        if (this.cameraCollision) {
            const playerPos = this._camPlayerPos.set(p.x, p.y + 1.5, p.z);
            const rayDirection = this._camRayDir.copy(idealCamPos).sub(playerPos).normalize();

            // Check terrain collisions by sampling heights along the path
            let collisionFound = false;
            const steps = Math.ceil(this.followDist);
            const stepSize = this.followDist / steps;

            for (let i = 1; i < steps; i++) {
                const distance = i * stepSize;
                const checkPos = this._camCheckPos.set(
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

        // Apply camera shake with delta-time based decay
        if (this.shakeIntensity > 0 && this.shakeDuration > 0) {
            // Delta-time based duration decay
            this.shakeDuration -= dt;
            if (this.shakeDuration <= 0) {
                this.shakeDuration = 0;
                this.shakeIntensity = 0;
                this.shakeDecay = 1.0;
                this.shakeSeverity = 'none';
            } else {
                // Exponential decay based on severity configuration
                const config = this.shakeConfig[this.shakeSeverity] || this.shakeConfig.light;
                this.shakeDecay *= config.decay;
                const currentShake = this.shakeIntensity * this.shakeDecay;
                
                // Generate random shake offset with severity-based intensity
                this.shakeOffset.x = (rand01() - 0.5) * currentShake;
                this.shakeOffset.y = (rand01() - 0.5) * currentShake * 0.5; // Less vertical shake
                this.shakeOffset.z = (rand01() - 0.5) * currentShake;
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
    // Seasonal visuals (6B: living city feel)
    // -----------------------------------------------------------------------

    static SEASON_PALETTES = {
        spring: { sky: 0x5a9ac6, fog: 0x6aadcc, fogDensity: 0.005, ambient: 0xffffff, sun: 0xfff5e0, vegTint: 0x55bb55 },
        summer: { sky: 0x4a90b8, fog: 0x5aa0c0, fogDensity: 0.004, ambient: 0xfff5e0, sun: 0xffd87a, vegTint: 0x3a8a2a },
        autumn: { sky: 0x8a7060, fog: 0x9a8878, fogDensity: 0.006, ambient: 0xffd090, sun: 0xffa040, vegTint: 0xbb8833 },
        winter: { sky: 0x7088a0, fog: 0x8098ac, fogDensity: 0.007, ambient: 0xd0e0ff, sun: 0xffffff, vegTint: 0x667766 },
    };

    _applySeasonalColors(season) {
        const p = Renderer3D.SEASON_PALETTES[season] ?? Renderer3D.SEASON_PALETTES.spring;
        this._seasonFogDensity = p.fogDensity;
        if (this.scene.background) {
            this.scene.background.setHex(p.sky);
        }
        if (this.scene.fog) {
            this.scene.fog.color.setHex(p.fog);
            this.scene.fog.density = p.fogDensity;
        }
        this.ambientLight.color.setHex(p.ambient);
        this.sunLight.color.setHex(p.sun);

        if (p.vegTint) {
            const tint = new THREE.Color(p.vegTint);
            for (const [, entry] of this._chunkMeshes) {
                entry.group.traverse((obj) => {
                    if (!obj.isMesh) return;
                    const k = obj.userData?.kind;
                    if (k !== 'vegetation') return;
                    const applyTint = (m) => {
                        if (m.userData?.isTreeFoliage || m === this._grassMat) {
                            m.color.lerp(tint, 0.4);
                        }
                    };
                    if (Array.isArray(obj.material)) obj.material.forEach(applyTint);
                    else applyTint(obj.material);
                });
            }
        }
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

        // Hide player model in god mode (no avatar needed for city builder view)
        if (this._player) {
            this._player.visible = (mode !== 'god');
        }
        if (this._sky) {
            this._sky.visible = (mode !== 'god');
        }

        // Update mode indicator UI if available
        if (this.game.ui && this.game.ui.modeIndicator) {
            this.game.ui.modeIndicator.setMode(mode);
        }
    }

    // Trigger camera shake with severity-based configuration
    shakeCamera(intensity, duration, severity = 'medium') {
        this.shakeIntensity = intensity;
        this.shakeDuration = duration;
        this.shakeDecay = 1.0;
        this.shakeSeverity = severity;
    }
    
    // Convenience methods for triggering shake by severity level
    shakeLight(duration = 500) {
        const config = this.shakeConfig.light;
        this.shakeCamera(config.intensity, duration * config.durationScale, 'light');
    }
    
    shakeMedium(duration = 500) {
        const config = this.shakeConfig.medium;
        this.shakeCamera(config.intensity, duration * config.durationScale, 'medium');
    }
    
    shakeHeavy(duration = 800) {
        const config = this.shakeConfig.heavy;
        this.shakeCamera(config.intensity, duration * config.durationScale, 'heavy');
    }
    
    shakeExtreme(duration = 1000) {
        const config = this.shakeConfig.extreme;
        this.shakeCamera(config.intensity, duration * config.durationScale, 'extreme');
    }
    
    // Shake by game event type
    shakeForEvent(eventType, severity = 1) {
        const baseDurations = {
            'building_placed': 300,
            'building_demolished': 400,
            'crisis_alert': 800,
            'crisis_resolved': 500,
            'explosion': 1000,
            'vehicle_collision': 400,
            'hack_success': 200,
            'hack_fail': 300
        };
        
        const duration = (baseDurations[eventType] || 500) * severity;
        
        if (severity <= 0.5) {
            this.shakeLight(duration);
        } else if (severity <= 1.0) {
            this.shakeMedium(duration);
        } else if (severity <= 2.0) {
            this.shakeHeavy(duration);
        } else {
            this.shakeExtreme(duration);
        }
    }

    render() {
        // Auto-resize whenever the canvas layout changes (handles Electron startup timing)
        const cw = this.canvas.clientWidth;
        const ch = this.canvas.clientHeight;
        if (cw > 0 && ch > 0) {
            const pr = this.renderer.getPixelRatio();
            if (Math.abs(this.renderer.domElement.width - cw * pr) > 2 ||
                Math.abs(this.renderer.domElement.height - ch * pr) > 2) {
                this.resize();
            }
        }

        const now = performance.now();
        const dt = this._lastRenderTime ? Math.min(50, now - this._lastRenderTime) : 16.67;
        this._lastRenderTime = now;
        this._updateDRS(dt);
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
        this._captureEnvProbe();
        this._updateWindUniforms();

        if (this._citizensDirty) this.rebuildCitizens();
        else this.updateCitizens();
        this.updatePets();

        // Update detailed character pool (articulated humanoids near camera)
        if (this._characterPool && this.game.citizens?.citizens) {
            const now = performance.now() / 1000;
            const frameDelta = now - (this._lastFrameTime || now);
            this._lastFrameTime = now;
            const px = this.game.state?.player?.x ?? 0;
            const py = this.game.state?.player?.y ?? 0;
            this._detailedCitizenSet = this._characterPool.update(
                this.game.citizens.citizens,
                this._citizenPositions,
                px, py,
                frameDelta
            );
        }

        this.updateVehicles();
        this.updatePoliceUnits();
        this.updateWeatherFX(dt);
        this._updateVolumetricFog();
        this._updateSSR();

        this.syncPlayer();
        this.updateCamera(dt);
        this._updateCSM();
        this.syncChunkStreaming();
        if (this._debugMode === 'services') {
            this.updateDebugOverlay();
        }
        if (this._zoneMode !== 'none') {
            this.updateZoneOverlay();
        }
        
        // Seasonal sky/fog/light palette (6B — changes once per season)
        const season = this.game?.weatherSystem?.state?.season;
        if (season && season !== this._lastSeason) {
            this._lastSeason = season;
            this._applySeasonalColors(season);
        }

        // Blackout effect: dim scene when player is in a blacked-out district
        const wh = this.game?.worldHacks;
        if (wh && wh._blackoutDistricts.size > 0 && this.ambientLight) {
            const playerDistrict = this.game.map.getDistrictAt?.(this.game.player.x, this.game.player.y) ?? -1;
            if (wh.isBlackedOut(playerDistrict)) {
                this.ambientLight.intensity = Math.max(0.05, this.ambientLight.intensity * 0.3);
                if (this.scene.fog) {
                    this.scene.fog.density = Math.max(this.scene.fog.density, 0.004);
                }
            }
        }

        // Sync fog density from weather system — overrides seasonal base (6B)
        const wfx = this.game?.weatherSystem?.currentEffects;
        if (this.scene.fog && wfx) {
            this.scene.fog.density = wfx.fogDensity ?? (this._seasonFogDensity ?? 0.005);
            if (wfx.ambientColor != null) {
                if (this.scene.background) {
                    this.scene.background.setHex(wfx.ambientColor);
                }
                this.scene.fog.color.setHex(wfx.ambientColor);
            }
        }

        // Update VFX systems
        this.updateVFX();
        if (this.fxSystem) {
            const ws = this.game?.weatherSystem?.state;
            const rainMult = (ws?.type === 'rain' || ws?.type === 'storm')
                ? 1 + (ws.intensity || 0) * 2 : 1;
            if (this._decalManager) this._decalManager._weatherFadeMult = rainMult;
            this.fxSystem.update(dt);
            this._renderTracers();
            this._renderDecals();
        }
        
        // Update building spawn flashes (1D)
        if (this._spawnFlashes?.length) this._updateSpawnFlashes(dt);

        // Update construction scaffolding (6B)
        if (this._scaffolds?.length) this._updateScaffolding(dt);

        // Update build ghost animation
        this._updateBuildGhostAnim(dt);
        
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

        // Update water shader animation
        if (this._waterShaderRef) {
            this._waterShaderRef.uniforms.uTime.value = performance.now() / 1000;
        }

        // Drift ambient boats + animate their wakes (Q10.D)
        this._updateAmbientBoats(dt / 1000);

        // Advance GPU spark/smoke bursts (Q10.E)
        this._updateGPUBursts(dt / 1000);

        // Refresh shared SSS light direction (skin/foliage translucency, Q10.F)
        this._updateSubsurfaceLight();

        // Recompute the GI probe grid from current sky/sun (Q10.G dynamic delta)
        this._updateGI(dt / 1000);

        // Lightning exposure decay
        this._updateLightningExposure();

        // Keep the gradient sky dome centered on the camera so it never clips.
        if (this._skyDome) this._skyDome.position.copy(this.camera.position);

        // Render via post-processing composer if available, else direct.
        // TAA jitters the camera projection per frame; restore it after so game
        // logic (raycasts, picking) always sees the un-jittered projection.
        if (this.composer) {
            const restoreJitter = (this._taaPass && this._taaPass.enabled)
                ? this._taaPass.applyJitter(this.camera) : null;
            this.composer.render();
            if (restoreJitter) restoreJitter();
        } else {
            this.renderer.render(this.scene, this.camera);
        }

        // Q11.B Hi-Z: capture depth pre-pass every 4 frames for occlusion pyramid.
        // Phase 1 — infrastructure only; testSphere is a passthrough until WebGPU.
        if (!this._hiZFrameCount) this._hiZFrameCount = 0;
        if ((++this._hiZFrameCount & 3) === 0) {
            this._hiZBuffer.capture(this.scene, this.camera, this.renderer, this._hiZFrameCount);
        }
    }

    /**
     * Trigger lightning flash — brief exposure spike
     */
    _triggerLightningFlash() {
        this._lightningFlashTime = performance.now();
        this._lightningFlashActive = true;
        // Exposure spike: 3x normal for 100-300ms
        this.renderer.toneMappingExposure = this._bloomPass ? 3.0 : 2.0;
        // Reset after flash duration
        setTimeout(() => {
            this._lightningFlashActive = false;
            this.renderer.toneMappingExposure = 1.3;
        }, 200);
    }

    /**
     * Update lightning exposure decay
     */
    _updateLightningExposure() {
        if (!this._lightningFlashActive) return;
        const elapsed = performance.now() - this._lightningFlashTime;
        if (elapsed > 300) {
            this._lightningFlashActive = false;
            this.renderer.toneMappingExposure = THREE.MathUtils.lerp(
                this.renderer.toneMappingExposure,
                1.3,
                0.1
            );
        }
    }

    /**
     * Update SSR uniforms from wetness and camera state
     */
    _updateSSR() {
        if (!this._ssrPass) return;
        const u = this._ssrPass.material.uniforms;
        // Wetness drives reflection intensity
        u.wetness.value = this._wetness ?? 0.0;
        // Disable SSR when wetness is very low (perf optimization)
        u.enabled = (this._wetness ?? 0.0) > 0.05;
    }

    /**
     * Update volumetric fog uniforms from weather + day/night state
     */
    _updateVolumetricFog() {
        if (!this._volFogPass) return;
        const u = this._volFogPass.material.uniforms;
        // Sun direction (normalized)
        if (this._sunPosition) {
            u.sunDirection.value.copy(this._sunPosition).normalize();
        }
        // Density from weather system
        const ws = this.game?.weatherSystem;
        if (ws && ws.currentEffects) {
            u.fogDensity.value = ws.currentEffects.fogDensity ?? 0.006;
        } else if (this.scene.fog) {
            u.fogDensity.value = this.scene.fog.density;
        }
        // Fog color follows scene fog
        if (this.scene.fog) {
            u.fogColor.value.copy(this.scene.fog.color);
        }
        // Light intensity: dawn/dusk = strong, night = dim
        const phase = this.currentPhase;
        if (phase === DAY_PHASES.DAWN || phase === DAY_PHASES.DUSK) {
            u.lightIntensity.value = 1.5;
        } else if (phase === DAY_PHASES.NIGHT) {
            u.lightIntensity.value = 0.2;
        } else {
            u.lightIntensity.value = 0.8;
        }
        // Sun angle: vertical component (low sun = more dramatic shafts)
        if (this._sunPosition) {
            u.sunAngle.value = Math.abs(this._sunPosition.y);
        }
        // Time for noise animation
        u.uTime.value = performance.now() / 1000;
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

        // Hemisphere fill must dim at night too, or it daylights the scene and
        // night looks like day regardless of the ambient/sun presets.
        if (this.hemiLight) {
            const fill = (lighting.phase === DAY_PHASES.NIGHT) ? 0.12
                : (lighting.phase === DAY_PHASES.DUSK) ? 0.45
                : (lighting.phase === DAY_PHASES.DAWN) ? 0.55
                : 1.0;
            const targetHemi = this._hemiBaseIntensity * fill;
            this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, targetHemi, 0.08);
        }

        // Drive sky + fog color from the day/night system so the sky actually
        // darkens at night. Season sets a daytime base; weather overrides later
        // in the frame for storms, so this only governs the clear-sky tint.
        if (this.scene.background && lighting.skyColor) {
            this.scene.background.lerp(lighting.skyColor, 0.08);
        }
        if (this.scene.fog && lighting.fogColor) {
            this.scene.fog.color.lerp(lighting.fogColor, 0.08);
        }

        // Gradient sky dome: horizon tracks the day/night sky tint, zenith is a
        // deeper, bluer version of it so the gradient reads at every time of day.
        if (this._skyDome && lighting.skyColor) {
            const sc = lighting.skyColor; // plain {r,g,b} in 0..1, not a THREE.Color
            const u = this._skyDome.material.uniforms;
            u.horizonColor.value.lerp(sc, 0.08);
            const top = new THREE.Color(sc.r, sc.g, sc.b).multiplyScalar(0.55).lerp(new THREE.Color(0x16345f), 0.45);
            u.topColor.value.lerp(top, 0.08);
        }

        // Apply tint effect to ambient light for color grading
        const grading = this.lightingManager.getColorGrading();
        if (grading && this.ambientLight) {
            // Blend tint color with ambient based on tint strength
            const tintColor = new THREE.Color(grading.tint);
            const blendFactor = grading.tintStrength;
            this.ambientLight.color.lerp(tintColor, blendFactor * 0.3); // Subtle tint effect
        }
        
        // Update procedural sky sun position to match time of day.
        // timeOfDay is a 0-1 fraction; _updateSkyForTime expects game hours.
        const cycleLength = this.lightingManager?.config?.cycleLength ?? 24;
        this._updateSkyForTime(timeOfDay * cycleLength);

        // Store current phase for debugging
        this.currentPhase = lighting.phase;
        
        // Update highway edge light strips based on day/night
        if (this._highwayLightStrips) {
            const isNight = lighting.phase === DAY_PHASES.NIGHT || lighting.phase === DAY_PHASES.DUSK;
            const targetIntensity = isNight ? 2.0 : 0.0;
            for (const stripMesh of this._highwayLightStrips) {
                if (stripMesh.material) {
                    stripMesh.material.emissiveIntensity = THREE.MathUtils.lerp(
                        stripMesh.material.emissiveIntensity,
                        targetIntensity,
                        0.1
                    );
                }
            }
        }

        // Window emission scaling — bright at night, dim during day
        {
            const nightFactor = (lighting.phase === DAY_PHASES.NIGHT) ? 1.0
                : (lighting.phase === DAY_PHASES.DUSK) ? 0.7
                : (lighting.phase === DAY_PHASES.DAWN) ? 0.4
                : 0.05;
            const targetEmissive = 0.1 + nightFactor * 0.9; // 0.1 day → 1.0 night
            if (this._windowEmissiveTarget === undefined) this._windowEmissiveTarget = 0.8;
            this._windowEmissiveTarget = THREE.MathUtils.lerp(this._windowEmissiveTarget, targetEmissive, 0.05);
            // Apply to all building window materials in loaded chunks (throttled: every 30 frames)
            if (!this._windowUpdateCounter) this._windowUpdateCounter = 0;
            if (++this._windowUpdateCounter >= 30) {
                this._windowUpdateCounter = 0;
                for (const [, entry] of this._chunkMeshes) {
                    entry.group.traverse((obj) => {
                        if (obj.isMesh && obj.material && !Array.isArray(obj.material) && obj.material.userData?.isWindow) {
                            obj.material.emissiveIntensity = this._windowEmissiveTarget;
                        } else if (obj.isMesh && Array.isArray(obj.material)) {
                            for (const m of obj.material) {
                                if (m.userData?.isWindow) m.emissiveIntensity = this._windowEmissiveTarget;
                            }
                        }
                    });
                }
            }
        }

        // Night-adaptive bloom — stronger glow from street lights and windows at night
        if (this._bloomPass) {
            const nightFactor = (lighting.phase === DAY_PHASES.NIGHT) ? 1.0
                : (lighting.phase === DAY_PHASES.DUSK || lighting.phase === DAY_PHASES.DAWN) ? 0.5
                : 0.0;
            const targetBloom = THREE.MathUtils.lerp(
                this._bloomDayStrength ?? 0.20,
                this._bloomNightStrength ?? 0.55,
                nightFactor
            );
            this._bloomPass.strength = THREE.MathUtils.lerp(this._bloomPass.strength, targetBloom, 0.08);
        }

        // Night vignette and color grading tint shift
        if (this._vignettePass) {
            const isNightPhase = lighting.phase === DAY_PHASES.NIGHT;
            const isDusk = lighting.phase === DAY_PHASES.DUSK;
            const isDawn = lighting.phase === DAY_PHASES.DAWN;
            const u = this._vignettePass.material.uniforms;
            // Stronger vignette at night for cinematic framing
            u.vignetteStrength.value = THREE.MathUtils.lerp(
                u.vignetteStrength.value,
                isNightPhase ? 0.55 : 0.30,
                0.06
            );
            // Warm tint at dusk/dawn, cool blue at night, neutral during day
            if (isNightPhase) {
                u.tintColor.value.lerp(new THREE.Vector3(0.85, 0.90, 1.05), 0.04);
            } else if (isDusk) {
                u.tintColor.value.lerp(new THREE.Vector3(1.08, 0.95, 0.88), 0.04);
            } else if (isDawn) {
                u.tintColor.value.lerp(new THREE.Vector3(1.05, 0.97, 0.92), 0.04);
            } else {
                u.tintColor.value.lerp(new THREE.Vector3(1.0, 0.98, 0.95), 0.04);
            }
            // Weather grade: cool, desaturated overlay strengthens under bad weather.
            const wType = this.game?.weatherSystem?.state?.type;
            const wInten = this.game?.weatherSystem?.state?.intensity ?? 1;
            const targetWeather = (wType === 'rain' || wType === 'storm') ? 0.35 * wInten
                : (wType === 'snow') ? 0.22 * wInten
                    : (wType === 'fog') ? 0.30 * wInten : 0.0;
            u.weatherTintStrength.value = THREE.MathUtils.lerp(u.weatherTintStrength.value, targetWeather, 0.05);
        }
    }

    /**
     * Set render scale (for performance)
     */
    setRenderScale(scale) {
        const clamped = Math.max(this._drsMinScale ?? 0.7, Math.min(1.0, scale));
        this.renderScale = clamped;
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.renderer.setSize(width * clamped, height * clamped, false);
        if (this.composer) {
            this.composer.setSize(width * clamped, height * clamped);
        }
    }

    _updateDRS(frameMs) {
        if (!this._drsEnabled || this.testMode) return;
        if (frameMs > this._drsBudget) {
            this._drsUnder = 0;
            this._drsOver += 1;
            if (this._drsOver >= 30) {
                const ns = Math.max(this._drsMinScale, this.renderScale - 0.05);
                if (ns !== this.renderScale) this.setRenderScale(ns);
                this._drsOver = 0;
            }
        } else if (frameMs < this._drsBudget * 0.70) {
            this._drsOver = 0;
            this._drsUnder += 1;
            if (this._drsUnder >= 90) {
                const ns = Math.min(1.0, this.renderScale + 0.05);
                if (ns !== this.renderScale) this.setRenderScale(ns);
                this._drsUnder = 0;
            }
        } else {
            this._drsOver = Math.max(0, this._drsOver - 1);
            this._drsUnder = Math.max(0, this._drsUnder - 1);
        }
    }

    _initVRS() {
        try {
            const gl = this.renderer.getContext();
            const ext = gl.getExtension('WEBGL_fragment_shading_rate')
                || gl.getExtension('EXT_fragment_shading_rate')
                || gl.getExtension('WEBGL_shading_rate');
            this._vrsSupported = !!ext;
            this._vrsExt = ext;
            const isPerf = this._preset === 'low';
            if (isPerf && this._vrsSupported) {
                // Sky and out-of-focus regions could run at 2×2; stubbed as enabled flag.
                this._vrsEnabled = true;
            } else {
                this._vrsEnabled = false;
            }
        } catch {
            this._vrsSupported = false;
            this._vrsEnabled = false;
        }
    }

    getPerPassTimings() {
        const base = this._renderGraph ? this._renderGraph.perPassTimings() : {};
        base._drawCalls = this.renderer?.info?.render?.calls ?? 0;
        base._triangles = this.renderer?.info?.render?.triangles ?? 0;
        base._renderScale = this.renderScale;
        base._vrs = !!this._vrsEnabled;
        return base;
    }

    /**
     * Apply a named quality preset (low / medium / high / ultra).
     * @param {string} presetName - key from PRESETS
     */
    setPreset(presetName) {
        if (!PRESETS[presetName]) return false;
        applyPreset(this, presetName);
        return true;
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
     * @param {string} mode - 'none', 'districts', 'roads', 'parcels', 'pois', 'nav', 'services', 'growth'
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

                    case 'growth': {
                        const zt = this.game.zoningManager?.getZone(x, y) ?? 0;
                        if (zt === 0) break;
                        const dem = this.game.demandCalculator?.getDemand?.() || {};
                        const names = { 1: 'residential', 2: 'commercial', 3: 'industrial' };
                        const pressure = (dem[names[zt]] ?? 0.5) - 0.5;
                        const t = (pressure + 0.5);
                        const rb = Math.floor(t * 255);
                        const gb = Math.floor((1 - Math.abs(pressure) * 2) * 200);
                        const bb = Math.floor((1 - t) * 255);
                        colorHex = (rb << 16) | (gb << 8) | bb;
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

    enterInterior(templateId) {
        if (this._outdoorChildrenHidden) return;
        this._outdoorVisibility.clear();
        for (const child of this.scene.children) {
            if (child === this._interiorGroup) continue;
            this._outdoorVisibility.set(child, child.visible);
            child.visible = false;
        }
        this._outdoorChildrenHidden = true;
        this._interiorGroup.clear();
        this._buildInteriorScene(templateId);
        this._interiorGroup.visible = true;
        this.scene.add(this._interiorGroup);
    }

    exitInterior() {
        if (!this._outdoorChildrenHidden) return;
        this._interiorGroup.visible = false;
        for (const [child, vis] of this._outdoorVisibility) {
            child.visible = vis;
        }
        this._outdoorVisibility.clear();
        this._outdoorChildrenHidden = false;
    }

    _buildInteriorScene(templateId) {
        this._buildInteriorShell(10, 10, 3);
        if (templateId === 'shop') this._buildShopProps();
        else if (templateId === 'safehouse') this._buildSafehouseProps();
        else if (templateId === 'subway') this._buildSubwayProps();
    }

    _buildInteriorShell(w, d, h) {
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this._interiorGroup.add(floor);

        const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7 });
        const wallGeo = new THREE.BoxGeometry(w, h, 0.1);
        const sideGeo = new THREE.BoxGeometry(d, h, 0.1);
        const hw = w / 2;
        const hd = d / 2;
        const hh = h / 2;
        const walls = [
            { geo: wallGeo, pos: [0, hh, -hd], rot: [0, 0, 0] },
            { geo: wallGeo, pos: [0, hh, hd], rot: [0, 0, 0] },
            { geo: sideGeo, pos: [-hw, hh, 0], rot: [0, Math.PI / 2, 0] },
            { geo: sideGeo, pos: [hw, hh, 0], rot: [0, Math.PI / 2, 0] },
        ];
        for (const wl of walls) {
            const m = new THREE.Mesh(wl.geo, wallMat);
            m.position.set(...wl.pos);
            m.rotation.set(...wl.rot);
            m.castShadow = true;
            m.receiveShadow = true;
            this._interiorGroup.add(m);
        }

        const light = new THREE.PointLight(0xffeedd, 1.0, 14);
        light.position.set(0, h - 0.5, 0);
        this._interiorGroup.add(light);
    }

    _buildShopProps() {
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.8 });
        const shelfGeo = new THREE.BoxGeometry(3, 1.5, 0.4);
        const positions = [[-3, 0.75, -3], [3, 0.75, -3], [-3, 0.75, 0]];
        for (const p of positions) {
            const shelf = new THREE.Mesh(shelfGeo, shelfMat);
            shelf.position.set(...p);
            shelf.castShadow = true;
            this._interiorGroup.add(shelf);
        }
        const counterMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.5 });
        const counter = new THREE.Mesh(
            new THREE.BoxGeometry(4, 1, 0.6), counterMat
        );
        counter.position.set(2, 0.5, 3.5);
        counter.castShadow = true;
        this._interiorGroup.add(counter);

        const neon = new THREE.PointLight(0x00ffcc, 0.5, 8);
        neon.position.set(0, 2.5, -4.5);
        this._interiorGroup.add(neon);
    }

    _buildSafehouseProps() {
        const mat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.8 });
        const desk = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1), mat);
        desk.position.set(-3, 0.4, -3);
        desk.castShadow = true;
        this._interiorGroup.add(desk);

        const bedMat = new THREE.MeshStandardMaterial({ color: 0x334455, roughness: 0.9 });
        const bed = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 3), bedMat);
        bed.position.set(3, 0.25, -2.5);
        bed.castShadow = true;
        this._interiorGroup.add(bed);

        const screenMat = new THREE.MeshStandardMaterial({
            color: 0x111111, emissive: new THREE.Color(0x00aaff),
            emissiveIntensity: 0.6,
        });
        const screen = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 0.05), screenMat);
        screen.position.set(-3, 1.2, -4.4);
        this._interiorGroup.add(screen);

        const warm = new THREE.PointLight(0xffaa55, 0.4, 6);
        warm.position.set(-3, 2, -3);
        this._interiorGroup.add(warm);
    }

    _buildSubwayProps() {
        const platformMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.85 });
        const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.3, 3), platformMat);
        platform.position.set(0, 0.15, -2);
        platform.receiveShadow = true;
        this._interiorGroup.add(platform);

        const trackMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 });
        const rail1 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.06), trackMat);
        rail1.position.set(0, 0.025, 2);
        this._interiorGroup.add(rail1);
        const rail2 = new THREE.Mesh(new THREE.BoxGeometry(10, 0.05, 0.06), trackMat);
        rail2.position.set(0, 0.025, 3);
        this._interiorGroup.add(rail2);

        const pillarMat = new THREE.MeshStandardMaterial({ color: 0x777777, roughness: 0.6 });
        const pillarGeo = new THREE.CylinderGeometry(0.15, 0.15, 3, 8);
        for (let i = -3; i <= 3; i += 3) {
            const p = new THREE.Mesh(pillarGeo, pillarMat);
            p.position.set(i, 1.5, -0.5);
            p.castShadow = true;
            this._interiorGroup.add(p);
        }

        const strip = new THREE.PointLight(0xccddff, 0.6, 10);
        strip.position.set(0, 2.8, 0);
        this._interiorGroup.add(strip);
        const warn = new THREE.PointLight(0xffaa00, 0.3, 5);
        warn.position.set(-4, 2.5, -2);
        this._interiorGroup.add(warn);
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

    setBuildGhost(type, x, y, rotation = 0, ok = true, warning = false) {
        const h = (BUILDING_3D[type]?.height ?? 0.6);
        
        // Determine color based on state: green (valid), red (invalid), yellow (warning)
        let ghostColor;
        if (!ok) {
            ghostColor = 0xe25555; // Red for invalid
        } else if (warning) {
            ghostColor = 0xffaa00; // Yellow/orange for warning (insufficient funds)
        } else {
            ghostColor = 0x3ecf8e; // Green for valid
        }
        
        if (!this._buildGhost || this._buildGhostType !== type) {
            if (this._buildGhost) {
                this.scene.remove(this._buildGhost);
                this._buildGhost.geometry.dispose();
                this._buildGhost.material.dispose();
            }
            if (this._buildGhostOutline) {
                this.scene.remove(this._buildGhostOutline);
                this._buildGhostOutline.geometry.dispose();
                this._buildGhostOutline.material.dispose();
            }
            
            const geom = new THREE.BoxGeometry(0.85, h, 0.85);
            const mat = new THREE.MeshLambertMaterial({
                color: ghostColor,
                transparent: true,
                opacity: 0.5,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
            });
            this._buildGhost = new THREE.Mesh(geom, mat);
            this._buildGhostType = type;
            this.scene.add(this._buildGhost);
            
            // Create footprint outline
            const outlineGeom = new THREE.RingGeometry(0.48, 0.52, 16);
            const outlineMat = new THREE.MeshBasicMaterial({
                color: ghostColor,
                transparent: true,
                opacity: 0.8,
                side: THREE.DoubleSide,
                depthWrite: false,
            });
            this._buildGhostOutline = new THREE.Mesh(outlineGeom, outlineMat);
            this._buildGhostOutline.rotation.x = -Math.PI / 2;
            this.scene.add(this._buildGhostOutline);
            
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
        this._buildGhost.material.color.setHex(ghostColor);
        
        // Update outline position and color
        this._buildGhostOutline.position.set(wx, 0.02, wz);
        this._buildGhostOutline.material.color.setHex(ghostColor);
        
        // Trigger snap animation if ghost was not visible
        if (!this._buildGhost.visible) {
            this._buildGhostAnim.currentScale.set(0, 0, 0);
            this._buildGhostAnim.targetScale.set(1, 1, 1);
            this._buildGhostAnim.progress = 0;
            this._buildGhostAnim.active = true;
        }
        
        this._buildGhost.visible = true;
        this._buildGhostOutline.visible = true;
    }

    clearBuildGhost() {
        if (!this._buildGhost) return;
        this._buildGhost.visible = false;
        if (this._buildGhostOutline) {
            this._buildGhostOutline.visible = false;
        }
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
    
    // Update build ghost snap animation (200ms duration)
    _updateBuildGhostAnim(dt = 16.67) {
        if (!this._buildGhost || !this._buildGhostAnim || !this._buildGhostAnim.active) return;
        
        const anim = this._buildGhostAnim;
        
        // Ease-in-out cubic function for smooth snap
        const easeInOutCubic = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
        // Update animation progress based on delta time (200ms duration)
        // dt is in milliseconds, so we divide by 200 to get progress per frame
        anim.progress += (dt / 200);
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
     * Show floating build confirmation text with particle burst and SFX
     */
    showBuildFeedback(x, y, type, success) {
        const text = success ? `Built ${type}` : 'Build Failed';
        const color = success ? '#4caf50' : '#f44336';
        this.showFloatingText(x, y, text, color, 1500);
        
        if (success) {
            // Show particle burst on successful placement
            const wx = x - this._mapHalfW + 0.5;
            const wz = y - this._mapHalfH + 0.5;
            const buildingColor = buildingHex(type) || 0x4caf50;
            this.showParticleBurst(x, y, buildingColor, 12);
            
            // Trigger building placement SFX
            if (this.game?.audioManager) {
                this.game.audioManager.playBuildingPlace(type);
            }
        } else {
            // Trigger invalid placement SFX
            if (this.game?.audioManager) {
                this.game.audioManager.playBuildingInvalid();
            }
        }
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

/** Multiplicative tint applied on top of the texture map */
function terrainTint(t) {
    switch (t) {
        case TERRAIN_GRASS:    return 0x88c870; // fresh grass green
        case TERRAIN_FOREST:   return 0x3a7a32; // deep forest green
        case TERRAIN_MOUNTAIN: return 0x686e62; // darker olive-grey alpine rock
        case TERRAIN_ROAD:     return 0x484848; // dark asphalt
        case TERRAIN_SIDEWALK: return 0x626058; // dark warm concrete — avoid glare under bright sun
        case TERRAIN_PARK:     return 0x60c850; // vivid park green
        case TERRAIN_WATER:    return 0x1878b8; // deep ocean blue
        case TERRAIN_HIGHWAY:  return 0x484050; // dark grey-purple highway asphalt
        case TERRAIN_BRIDGE:   return 0x8a7a60; // concrete tan
        case TERRAIN_TUNNEL:   return 0x282828; // near-black tunnel
        default: return 0x90a070;               // olive-green fill
    }
}

/** Per-type color palettes — muted/realistic architectural tones like Cities: Skylines */
const BUILDING_PALETTES = {
    // Residential — warm brick, terracotta, slate, cream, sage
    'house':           [0xb87050, 0xc4886a, 0x9a7860, 0x8898b0, 0xc09870, 0xa07868, 0x788898, 0xb0a080,
                        0xc8a888, 0x7890a0, 0xd4b090, 0x9880a0],
    'farm':            [0xc8944a, 0xd4a860, 0xb88038, 0xe0b860],
    'lumber-mill':     [0x906040, 0x7a4a28, 0xa87050],
    // Commercial — glass blue, steel, bronze, warm gray
    'market':          [0x4a6888, 0x5878a0, 0x385878, 0x6888a8, 0x607070, 0x486080],
    'shopping-mall':   [0x3a5870, 0x486078, 0x507080, 0x607888, 0x3a5060, 0x5a7080],
    'restaurant':      [0xa05838, 0xb06848, 0x906030, 0xc87040],
    'nightclub':       [0x2a2848, 0x383660, 0x484870, 0x302850],
    // Hotel — warm earth tones, gold glass, stone
    'hotel':           [0x907050, 0x9c8060, 0x806040, 0xa08060, 0x785040, 0x886050],
    // Civic — warm gold stone, marble, classical
    'town-hall':       [0x8a7848, 0x9a8858, 0x7a6838, 0xa89060, 0x90804a, 0x988858],
    'school':          [0x7098b8, 0x8090a0, 0x6088a8, 0x90a8c0],
    'hospital':        [0x4a6878, 0x3e5c6c, 0x547080, 0x3a5468],
    'police-station':  [0x384870, 0x485880, 0x283860, 0x506888],
    'fire-station':    [0xb83028, 0xa82020, 0xc84040, 0xd04030],
    'library':         [0x8a6840, 0x7a5830, 0x9a7850, 0xb08858],
    'courthouse':      [0x786850, 0x685840, 0x887860, 0x907858],
    'museum':          [0x806888, 0x907898, 0x705878, 0xa08898],
    'theater':         [0x703848, 0x804858, 0x602838, 0x906858],
    'prison':          [0x585850, 0x686860, 0x484840, 0x707060],
    // Apartments — wide palette: blue glass, dark steel, warm concrete, teal, slate
    'apartment':       [0x384858, 0x3e5060, 0x2c3e4e, 0x485e6e,
                        0x584840, 0x4a4038, 0x4e6070, 0x5a5040,
                        0x526076, 0x3e4830, 0x485e70, 0x604838],
    // Office/tech
    'university':      [0x5a5080, 0x6a6090, 0x4a4070, 0x7a70a0],
    'research-lab':    [0x485868, 0x586878, 0x384858, 0x607088],
    // Infrastructure
    'warehouse':       [0x8090a0, 0x90a0b0, 0x708090, 0xa0b0c0],
    'barracks':        [0x607050, 0x506040, 0x708060],
    'airport':         [0x7888a0, 0x8898b0, 0x687890, 0x9aaabb],
    'factory':         [0x7a7060, 0x8a8070, 0x6a6050],
    'nuclear-plant':   [0x8898a8, 0x98a8b8, 0x788898],
    'power-plant':     [0x707880, 0x808890, 0x606070],
    'water-treatment': [0x5878a8, 0x6888b8, 0x486898],
    'solar-farm':      [0x203858, 0x2a4868, 0x183048],
    'wind-farm':       [0xa0b0c0, 0x90a0b0, 0xb0c0d0],
    'port':            [0x8a7a5a, 0x9a8a6a, 0x7a6a4a],
    'stadium':         [0x406880, 0x507890, 0x305870, 0x6080a0],
    'recycling-plant': [0x406840, 0x507850, 0x305830],
    'bus-stop':        [0x3a6080, 0x486888, 0x304e70, 0x5878a0],
    'bus-depot':       [0x5a6840, 0x4a5830, 0x6a7850, 0x3a4820],
    'metro-station':   [0x203040, 0x283848, 0x182838, 0x304058],
    'tollway-gate':    [0x484838, 0x585848, 0x383828, 0x686858],
    'highway-ramp':    [0x404040, 0x505050, 0x303030, 0x606060],
    'subway-shaft':    [0x303838, 0x404848, 0x202828, 0x505858],
    'default':         [0xa09880, 0xb0a890, 0x908870, 0xc0b8a0],
};

function buildingPaletteColor(type, id) {
    const palette = BUILDING_PALETTES[type] || BUILDING_PALETTES['default'];
    const hex = palette[(id || 0) % palette.length];
    // Boost palette colors: shift dark colors up and allow up to 0.72 luminance
    const r = ((hex >> 16) & 0xff) / 255;
    const g = ((hex >>  8) & 0xff) / 255;
    const b = ( hex        & 0xff) / 255;
    const lum = r * 0.299 + g * 0.587 + b * 0.114;
    // Boost dark colors (lum < 0.25) up toward 0.35 so buildings aren't black
    let sr = r, sg = g, sb = b;
    if (lum < 0.25 && lum > 0) {
        const boost = 0.35 / lum;
        sr = Math.min(1, r * boost); sg = Math.min(1, g * boost); sb = Math.min(1, b * boost);
    }
    // Cap very bright colors at 0.72 so they don't blow out
    const lum2 = sr * 0.299 + sg * 0.587 + sb * 0.114;
    if (lum2 > 0.72) {
        const s = 0.72 / lum2;
        sr *= s; sg *= s; sb *= s;
    }
    return (Math.round(sr * 255) << 16) | (Math.round(sg * 255) << 8) | Math.round(sb * 255);
}

function buildingHex(type) {
    // Use first palette color for consistent box fallback colors
    const palette = BUILDING_PALETTES[type] || BUILDING_PALETTES['default'];
    return palette[0];
}
