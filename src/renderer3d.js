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
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN, TERRAIN_ROAD, TERRAIN_SIDEWALK, TERRAIN_PARK, TERRAIN_HIGHWAY, TERRAIN_BRIDGE, TERRAIN_TUNNEL, BUILDING_TYPES, BUILDING_3D } from './constants.js';
import { eventBus, EVENT_TYPES } from './sim/events.js';
import { ZONE_TYPES } from './sim/zoning/zoning.js';
import { createDayNightCycle, DAY_PHASES } from './sim/day_night.js';
import { createLightingManager, LIGHTING_PRESETS } from './render/lighting/day_night.js';
import { PRESETS, DEFAULT_PRESET, applyPreset } from './render/presets.js';
import { createFXSystem } from './render/fx/fx_system.js';
import { createVFXTriggerManager, setVFXTriggerManager } from './render/fx/vfx_triggers.js';
import { createParticleSystem } from './world/particle_pool.js';
import { CharacterPool } from './render/character_pool.js';

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
        // Auto-detect: measure first-frame timing to pick appropriate preset
        this._detectPreset().then((detected) => {
            if (detected && detected !== DEFAULT_PRESET) {
                this._preset = detected;
                applyPreset(this, detected);
            }
        });
        this.setRenderScale(1.0);

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

        // Weather FX: rain particles
        this._rainGroup = null;
        this._rainDrops = null;
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

    /**
     * Always-on gradient sky dome. Unlike the Preetham `_sky` (which lives in the
     * post-processing path and is skipped under testMode / the low preset and
     * hidden top-down in god mode), this renders in every mode and preset, so the
     * sky is a proper zenith→horizon gradient instead of a flat fill color. The
     * Preetham sky, when present, simply layers on top in street view.
     */
    _createSkyDome() {
        const mat = new THREE.ShaderMaterial({
            side: THREE.BackSide,
            depthWrite: false,
            fog: false,
            uniforms: {
                topColor:     { value: new THREE.Color(0x2c6bb0) }, // deep zenith blue
                horizonColor: { value: new THREE.Color(0xbcd8ea) }, // pale horizon
                exponent:     { value: 0.7 },
            },
            vertexShader: `
                varying vec3 vDir;
                void main() {
                    vDir = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 horizonColor;
                uniform float exponent;
                varying vec3 vDir;
                void main() {
                    float h = clamp(normalize(vDir).y, 0.0, 1.0);
                    vec3 col = mix(horizonColor, topColor, pow(h, exponent));
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16), mat);
        dome.renderOrder = -10;
        dome.frustumCulled = false;
        this._skyDome = dome;
        this.scene.add(dome);
    }

    /** 3-cascade CSM: replace single sun shadow with cascaded shadows */
    _setupCSM() {
        // Disable single shadow on sun light; use cascades instead
        this.sunLight.castShadow = false;
        this.sunLight.shadow.mapSize.width = 0;
        this.sunLight.shadow.mapSize.height = 0;

        // Cascade config: [near, far, resolution]
        const cascades = [
            { near: 1, far: 25, res: 1024 },   // Close: high detail
            { near: 25, far: 75, res: 512 },    // Mid: medium detail
            { near: 75, far: 150, res: 256 },   // Far: low detail
        ];

        this._csmLights = [];
        this._csmCameras = [];

        for (let i = 0; i < cascades.length; i++) {
            const c = cascades[i];
            const light = new THREE.DirectionalLight(0xfffbe0, 1.8 / (i + 1));
            light.position.copy(this.sunLight.position);
            light.castShadow = true;
            light.shadow.mapSize.width = c.res;
            light.shadow.mapSize.height = c.res;
            light.shadow.camera.near = c.near;
            light.shadow.camera.far = c.far;
            light.shadow.camera.left = -50 * (i + 1);
            light.shadow.camera.right = 50 * (i + 1);
            light.shadow.camera.top = 50 * (i + 1);
            light.shadow.camera.bottom = -50 * (i + 1);
            light.shadow.bias = -0.001;
            light.shadow.normalBias = 0.02;
            light.shadow.radius = 2; // PCF soft
            this.scene.add(light);
            this._csmLights.push(light);
            this._csmCameras.push(light.shadow.camera);
        }
    }

    /** Update CSM frustums based on camera position */
    _updateCSM() {
        if (!this._csmLights || this._csmLights.length === 0) return;

        const camPos = this.camera.position;
        const sunDir = this.sunLight.position.clone().normalize();

        for (let i = 0; i < this._csmLights.length; i++) {
            const light = this._csmLights[i];
            const cam = this._csmCameras[i];

            // Position light to follow sun direction relative to camera
            const offset = sunDir.clone().multiplyScalar(30 + i * 10);
            light.position.copy(camPos).add(offset);
            light.target.position.copy(camPos);
            light.target.updateMatrix();
            cam.updateMatrixWorld();
        }
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

        // Chunked terrain + buildings
        this._buildingsDirty = true;
        this.syncChunkStreaming(true);

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
                    this._vehicleModels.set(type, root);
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
                    // Tone down road markings: very bright/white surfaces → muted gray
                    root.traverse((child) => {
                        if (child.isMesh && child.material) {
                            const m = child.material;
                            if (m.color) {
                                const lum = m.color.r * 0.299 + m.color.g * 0.587 + m.color.b * 0.114;
                                if (lum > 0.60) m.color.multiplyScalar(0.38); // aggressively dim road markings
                                else if (lum > 0.35) m.color.multiplyScalar(0.72); // moderate dim for mid tones
                            }
                            if (m.roughness !== undefined) m.roughness = Math.min(0.99, m.roughness + 0.15);
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
                this.composer.addPass(ssaoPass);
                this._ssaoPass = ssaoPass;
            }

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
                    this.composer.addPass(fxaaPass);
                    this._fxaaPass = fxaaPass;
                } catch { /* FXAA shader not available */ }
            }

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
                    },
                    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
                    fragmentShader: `
                        uniform sampler2D tDiffuse;
                        uniform float vignetteStrength;
                        uniform float vignetteRadius;
                        uniform float saturation;
                        uniform float contrast;
                        uniform vec3 tintColor;
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
                            // Tint
                            col.rgb*=tintColor;
                            // LUT-based color grading (per-time-of-day)
                            col.rgb*=lutColor;
                            // Weather tint overlay
                            col.rgb=mix(col.rgb,weatherTint,weatherTintStrength);
                            gl_FragColor=col;
                        }
                    `,
                };
                const vignettePass = new ShaderPass(VignetteColorGradeShader);
                this.composer.addPass(vignettePass);
                this._vignettePass = vignettePass;
                // LUT color grades per time of day
                this._lutGrades = {
                    dawn:  { tint: new THREE.Color(1.1, 0.85, 0.7),  weatherTint: new THREE.Color(1.0, 1.0, 1.0) },
                    day:   { tint: new THREE.Color(1.0, 1.0, 0.95),  weatherTint: new THREE.Color(1.0, 1.0, 1.0) },
                    dusk:  { tint: new THREE.Color(1.15, 0.8, 0.65), weatherTint: new THREE.Color(1.0, 1.0, 1.0) },
                    night: { tint: new THREE.Color(0.7, 0.75, 1.0),  weatherTint: new THREE.Color(1.0, 1.0, 1.0) },
                };
                this._lutCurrent = new THREE.Color(1.0, 1.0, 1.0);
                this._weatherTint = new THREE.Color(1.0, 1.0, 1.0);
                this._weatherTintStrength = 0.0;
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
                            if (nightFactor > 0.01 && starField) {
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
     */
    _updateSkyForTime(timeOfDay) {
        if (!this._sky) return;

        // Map time (0-24h) to sun elevation angle
        // Sun rises at 6h, peaks at 12h, sets at 18h
        const sunPhase = ((timeOfDay - 6) / 12) * Math.PI; // 0 at 6h, PI at 18h
        const elevation = Math.sin(sunPhase); // -1..1, peaks at noon
        const azimuth = 0.25; // fixed azimuth for consistent shadow direction

        // Below horizon at night
        const phi = THREE.MathUtils.degToRad(90 - elevation * 60); // 30° to 150° range
        const theta = THREE.MathUtils.degToRad(180 * azimuth);

        this._sunPosition.setFromSphericalCoords(1, phi, theta);
        this._sky.material.uniforms['sunPosition'].value.copy(this._sunPosition);

        // Also move the directional lights to match sky sun position
        if (this.sunLight) {
            const lightDist = 40;
            this.sunLight.position.set(
                this._sunPosition.x * lightDist,
                Math.max(5, this._sunPosition.y * lightDist),
                this._sunPosition.z * lightDist
            );
        }
        if (this.sunLightFar) {
            const lightDist = 40;
            this.sunLightFar.position.set(
                this._sunPosition.x * lightDist,
                Math.max(5, this._sunPosition.y * lightDist),
                this._sunPosition.z * lightDist
            );
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
                opacity: 0.82,
                roughness: 0.05,       // very reflective
                metalness: 0.1,
                transmission: 0.4,
                thickness: 1.2,
                clearcoat: 1.0,
                clearcoatRoughness: 0.05,
                envMapIntensity: 1.5,
                side: THREE.FrontSide,
            });
            // Inject vertex displacement for waves
            this._waterMaterial.onBeforeCompile = (shader) => {
                shader.uniforms.uTime = { value: 0 };
                this._waterShaderRef = shader;
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <common>',
                    `#include <common>
                    uniform float uTime;`
                );
                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `#include <begin_vertex>
                    float wave1 = sin(position.x * 3.0 + uTime * 1.2) * 0.06;
                    float wave2 = sin(position.z * 2.5 + uTime * 0.9) * 0.05;
                    float wave3 = cos((position.x + position.z) * 2.0 + uTime * 0.7) * 0.03;
                    float wave4 = sin(position.x * 6.0 - position.z * 3.0 + uTime * 2.0) * 0.015;
                    transformed.y += wave1 + wave2 + wave3 + wave4;`
                );
            };
        }

        const dummy = new THREE.Object3D();
        const instancedMesh = new THREE.InstancedMesh(geom, this._waterMaterial, tiles.length);
        instancedMesh.receiveShadow = true;
        instancedMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);

        for (let i = 0; i < tiles.length; i++) {
            const tile = tiles[i];
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;
            dummy.position.set(wx, -0.35, wz);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;
        meshes.push(instancedMesh);

        // Track water meshes for time uniform updates
        if (!this._waterMeshes) this._waterMeshes = [];
        this._waterMeshes.push(instancedMesh);

        return meshes;
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

        for (const tile of tiles) {
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;

            // Calculate connectivity bitmask from neighbors
            const n = this.game.map.getTileAt(tile.x, tile.y - 1) === TERRAIN_ROAD ? 1 : 0;
            const e = this.game.map.getTileAt(tile.x + 1, tile.y) === TERRAIN_ROAD ? 2 : 0;
            const s = this.game.map.getTileAt(tile.x, tile.y + 1) === TERRAIN_ROAD ? 4 : 0;
            const w = this.game.map.getTileAt(tile.x - 1, tile.y) === TERRAIN_ROAD ? 8 : 0;
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

            const model = this._roadModels.get(modelName);
            if (model) {
                const clone = model.clone(true);
                clone.position.set(wx, 0.09, wz);
                clone.rotation.y = rotation;
                clone.traverse((child) => {
                    if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
                });
                objects.push(clone);
            } else {
                // Fallback: flat gray box
                const geom = new THREE.BoxGeometry(1, 0.18, 1);
                const mat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.8, metalness: 0.0 });
                const mesh = new THREE.Mesh(geom, mat);
                mesh.position.set(wx, 0.09, wz);
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                objects.push(mesh);
            }

            // Street props: only in urban core (radius ≤ 14 from map center)
            const dcx = tile.x - this._mapHalfW, dcz = tile.y - this._mapHalfH;
            const distFromCenter = Math.sqrt(dcx * dcx + dcz * dcz);
            if (distFromCenter <= 14 && hash(tile.x, tile.y, 200) < 0.18) {
                const lightModel = this._propModels.get('light-square');
                const side = hash(tile.x, tile.y, 210) > 0.5 ? 1 : -1;
                const terrainYL = this._smoothTerrainY(tile.x, tile.y);
                if (lightModel) {
                    const lightClone = lightModel.clone(true);
                    const px = wx + side * 0.42;
                    const pz = wz;
                    lightClone.position.set(px, terrainYL, pz);
                    // Orient arm toward road center
                    lightClone.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
                    lightClone.traverse((child) => {
                        if (child.isMesh) { child.castShadow = true; }
                    });
                    objects.push(lightClone);
                    // Glowing lamp-head sphere
                    const bbox = new THREE.Box3();
                    bbox.setFromObject(lightModel);
                    const lampTopY = terrainYL + bbox.max.y * 0.60;
                    const glowGeom = new THREE.SphereGeometry(0.042, 6, 4);
                    const glowMat = new THREE.MeshStandardMaterial({
                        color: 0xffd060, emissive: 0xffaa20, emissiveIntensity: 0.65,
                        roughness: 0.4, metalness: 0.0,
                    });
                    const glowSphere = new THREE.Mesh(glowGeom, glowMat);
                    glowSphere.position.set(px, lampTopY, pz);
                    objects.push(glowSphere);
                } else {
                    // Fallback: pole + glow sphere
                    const terrainYL2 = this._smoothTerrainY(tile.x, tile.y);
                    const px = wx + side * 0.42;
                    const pz = wz;
                    const poleGeom = new THREE.CylinderGeometry(0.022, 0.022, 0.75, 5);
                    const poleMat = new THREE.MeshStandardMaterial({ color: 0x303030, roughness: 0.7 });
                    const pole = new THREE.Mesh(poleGeom, poleMat);
                    pole.position.set(px, terrainYL2 + 0.375, pz);
                    objects.push(pole);
                    const glowGeom = new THREE.SphereGeometry(0.042, 6, 4);
                    const glowMat = new THREE.MeshStandardMaterial({
                        color: 0xffd060, emissive: 0xffaa20, emissiveIntensity: 0.65,
                    });
                    const glowSphere = new THREE.Mesh(glowGeom, glowMat);
                    glowSphere.position.set(px, terrainYL2 + 0.78, pz);
                    objects.push(glowSphere);
                }
            }

            // Traffic lights at 4-way road intersections
            {
                const n  = this.game.map.getTileAt(tile.x,     tile.y - 1);
                const s  = this.game.map.getTileAt(tile.x,     tile.y + 1);
                const e  = this.game.map.getTileAt(tile.x + 1, tile.y    );
                const w  = this.game.map.getTileAt(tile.x - 1, tile.y    );
                const isIntersection = [n, s, e, w].every(t =>
                    t === TERRAIN_ROAD || t === TERRAIN_HIGHWAY
                );
                if (isIntersection && hash(tile.x, tile.y, 300) < 0.5) {
                    const terrainY = this._smoothTerrainY(tile.x, tile.y);
                    const tl = this._buildTrafficLight(wx + 0.45, terrainY, wz + 0.45);
                    objects.push(...tl);
                }
            }
        }
        return objects;
    }

    /** Procedural city bus model built from THREE primitives */
    _createProceduralBus() {
        const group = new THREE.Group();
        // Main body — elongated box
        const bodyGeom = new THREE.BoxGeometry(0.38, 0.22, 0.88);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a4a8a, roughness: 0.6, metalness: 0.05 });
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
        const highwayTiles = [];
        const bridgeTiles = [];
        const tunnelTiles = [];

        const width = bounds.maxX - bounds.minX + 1;
        const height = bounds.maxY - bounds.minY + 1;

        // Collect water/road tiles separately; build a smooth heightmap for the rest
        const tileGrid = [];
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            const row = [];
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const terrain = this.game.map.getTileAt(x, y);
                row.push(terrain);
                if (terrain === TERRAIN_WATER) waterTiles.push({ x, y });
                if (terrain === TERRAIN_ROAD) roadTiles.push({ x, y });
                if (terrain === TERRAIN_HIGHWAY) highwayTiles.push({ x: x, y: y });
                if (terrain === TERRAIN_BRIDGE) bridgeTiles.push({ x: x, y: y });
                if (terrain === TERRAIN_TUNNEL) tunnelTiles.push({ x: x, y: y });
            }
            tileGrid.push(row);
        }

        // Water: animated plane
        if (waterTiles.length > 0) {
            meshes.push(...this._buildWaterMeshForTiles(waterTiles));
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
        const baseTex = this._terrainTextures.get(dominantTerrain) ?? this._terrainTextures.get(TERRAIN_GRASS) ?? this._terrainTextures.get(0);
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

        const terrainMesh = new THREE.Mesh(geom, mat);
        terrainMesh.castShadow = false;
        terrainMesh.receiveShadow = true;
        meshes.push(terrainMesh);

        // Road fallback: flat asphalt slabs for roads when no GLTF models loaded
        if (roadTiles.length > 0 && this._roadModels.size === 0) {
            // Asphalt base — dark gray with slight roughness variation
            const roadGeom = new THREE.PlaneGeometry(1, 1);
            roadGeom.rotateX(-Math.PI / 2);
            const roadMat = new THREE.MeshStandardMaterial({
                color: 0x323232,  // dark asphalt
                roughness: 0.95,
                metalness: 0.0,
            });
            const roadMesh = new THREE.InstancedMesh(roadGeom, roadMat, roadTiles.length);
            roadMesh.receiveShadow = true;
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

    /**
     * Additive rolling-hills height (≥ 0) at continuous tile coordinates.
     * Three octaves: broad swells, medium folds, fine surface detail.
     */
    _baseElevation(gx, gz) {
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
                const clone = model.clone(true);
                // Skyscraper variants load at scale=1.0; apply type scale here
                if (useSkyscraperScale) {
                    const baseScale = Renderer3D.MODEL_SCALE[b.type] ?? Renderer3D.MODEL_SCALE.default;
                    // Per-building height variation — CBD pyramid profile: taller downtown, shorter suburbs
                    const heightHash = (((b.x * 2654435761) ^ (b.y * 2246822519)) >>> 0) / 4294967296;
                    const distFromCenter = Math.sqrt(
                        (b.x - this._mapHalfW) ** 2 + (b.y - this._mapHalfH) ** 2
                    );
                    const centerFactor = Math.max(0, 1.0 - distFromCenter / 18);
                    const heightMult = 0.55 + heightHash * 0.55 + centerFactor * 0.55;
                    clone.scale.setScalar(baseScale * heightMult);
                } else {
                    // Per-building proportional jitter so same-type rows (houses,
                    // shops, farms) don't read as stamped clones. Deterministic
                    // per tile; base stays grounded since models pivot at y=0.
                    const j1 = (((b.x * 2654435761) ^ (b.y * 2246822519)) >>> 0) / 4294967296;
                    const j2 = (((b.x * 40503) ^ (b.y * 12289) ^ 0x9e3779b9) >>> 0) / 4294967296;
                    clone.scale.x *= 0.90 + j1 * 0.20;          // ±10% width
                    clone.scale.z *= 0.90 + (1 - j1) * 0.20;    // ±10% depth (anti-correlated)
                    clone.scale.y *= 0.82 + j2 * 0.55;          // 0.82–1.37 height
                }
                const wx = b.x - this._mapHalfW + 0.5;
                const wz = b.y - this._mapHalfH + 0.5;
                const terrainY = this._smoothTerrainY(b.x, b.y);
                clone.position.set(wx, terrainY, wz);
                clone.rotation.y = ((b.rotation ?? ((b.id || 0) % 4)) % 4) * (Math.PI / 2);
                const bldColor = new THREE.Color(buildingPaletteColor(b.type, b.id));
                // Darker roof — avoids washout under bright sun
                const roofColor = bldColor.clone().multiplyScalar(0.62);
                // Glass/steel buildings get more reflective material
                const isGlassType = Renderer3D.SKYSCRAPER_TYPES.has(b.type);
                clone.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            const applyMat = (m) => {
                                if (!m.color) return m;
                                const nm = m.clone();
                                // Recolor all light-colored (non-dark) meshes
                                const brightness = nm.color.r * 0.299 + nm.color.g * 0.587 + nm.color.b * 0.114;
                                if (brightness > 0.25) {
                                    // Assign palette color based on mesh role
                                    const box = new THREE.Box3().setFromObject(child);
                                    const size = box.getSize(new THREE.Vector3());
                                    const isSmall = size.x < 0.15 && size.z < 0.15;
                                    if (isSmall) {
                                        // Window: emissive warm glow (intensity driven by day/night)
                                        nm.color.set(0xffee88);
                                        nm.emissive = new THREE.Color(0xffcc44);
                                        nm.emissiveIntensity = 0.8;
                                        nm.roughness = 0.1;
                                        nm.metalness = 0.0;
                                        nm.userData = { isWindow: true };
                                    } else if (size.y < 0.08) {
                                        // Flat/roof mesh
                                        nm.color.set(roofColor);
                                        nm.roughness = 0.85;
                                        nm.metalness = 0.0;
                                    } else {
                                        nm.color.set(bldColor);
                                        // Glass/steel tower facades get a reflective sheen
                                        nm.roughness = isGlassType ? 0.35 : 0.65;
                                        nm.metalness = isGlassType ? 0.18 : 0.03;
                                    }
                                    nm.envMapIntensity = isGlassType ? 1.2 : 0.6;
                                }
                                return nm;
                            };
                            if (Array.isArray(child.material)) {
                                child.material = child.material.map(applyMat);
                            } else {
                                child.material = applyMat(child.material);
                            }
                        }
                    }
                });
                objects.push(clone);

                // Rooftop clutter (AC units, vents, water tanks) enriches the
                // skyline of commercial / civic / industrial buildings.
                if (Renderer3D.ROOFTOP_DETAIL_TYPES.has(b.type)) {
                    this._addRooftopProps(clone, b, objects);
                }

                // Add lit-window glow overlay to tall skyscraper buildings
                if (useSkyscraperScale) {
                    const bbox = new THREE.Box3().setFromObject(clone);
                    const bs = bbox.getSize(new THREE.Vector3());
                    if (bs.y > 1.2) {
                        const bc = bbox.getCenter(new THREE.Vector3());
                        const winTex = this._getWindowTexture();
                        const winMat = new THREE.MeshBasicMaterial({
                            map: winTex,
                            transparent: true,
                            depthWrite: false,
                            blending: THREE.AdditiveBlending,
                            opacity: 0.55,
                        });
                        // Four cardinal faces: +Z -Z +X -X
                        const faces = [
                            [bs.x * 0.88, bs.y * 0.90, bc.x, bc.y, bbox.max.z + 0.018, 0, 0],
                            [bs.x * 0.88, bs.y * 0.90, bc.x, bc.y, bbox.min.z - 0.018, 0, Math.PI],
                            [bs.z * 0.88, bs.y * 0.90, bbox.max.x + 0.018, bc.y, bc.z, 0, Math.PI / 2],
                            [bs.z * 0.88, bs.y * 0.90, bbox.min.x - 0.018, bc.y, bc.z, 0, -Math.PI / 2],
                        ];
                        for (const [pw, ph, px, py, pz, rx, ry] of faces) {
                            const g = new THREE.PlaneGeometry(pw, ph);
                            const m = new THREE.Mesh(g, winMat.clone());
                            m.position.set(px, py, pz);
                            m.rotation.set(rx, ry, 0);
                            objects.push(m);
                        }
                    }
                }
            } else {
                if (!boxGroups.has(b.type)) boxGroups.set(b.type, []);
                boxGroups.get(b.type).push(b);
            }
        }

        // Box instanced mesh fallback for types without a loaded model
        const dummy = new THREE.Object3D();
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
    _addRooftopProps(clone, b, out) {
        const bbox = new THREE.Box3().setFromObject(clone);
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

    /**
     * Build instanced vegetation (trees) for forest and park tiles in a chunk.
     * Uses a deterministic seeded RNG based on tile coordinates for consistency.
     */
    _buildVegetationForChunk(bounds) {
        const objects = [];
        const treeLarge = this._vegetationModels.get('tree-large');
        const treeSmall = this._vegetationModels.get('tree-small');
        if (!treeLarge && !treeSmall) return objects;

        // Collect forest/park/grass tile positions
        const forestTiles = [];
        const parkTiles = [];
        const grassTiles = [];
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const terrain = this.game.map.getTileAt(x, y);
                if (terrain === TERRAIN_FOREST) forestTiles.push({ x, y });
                else if (terrain === TERRAIN_PARK) parkTiles.push({ x, y });
                else if (terrain === TERRAIN_GRASS) grassTiles.push({ x, y });
            }
        }

        // Simple deterministic hash for seeded pseudo-random per tile
        const hash = (x, y, salt) => {
            let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
            h = ((h ^ (h >> 13)) * 1274126177) | 0;
            return ((h ^ (h >> 16)) >>> 0) / 4294967296;
        };

        // Place trees on forest tiles (1-3 per tile)
        for (const tile of forestTiles) {
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;
            const treeCount = 1 + Math.floor(hash(tile.x, tile.y, 0) * 3); // 1-3 trees

            for (let t = 0; t < treeCount; t++) {
                const model = hash(tile.x, tile.y, t + 10) > 0.4 ? treeLarge : treeSmall;
                if (!model) continue;
                const clone = model.clone(true);
                const offsetX = (hash(tile.x, tile.y, t + 20) - 0.5) * 0.6;
                const offsetZ = (hash(tile.x, tile.y, t + 30) - 0.5) * 0.6;
                const rotY = hash(tile.x, tile.y, t + 40) * Math.PI * 2;
                const scale = 0.7 + hash(tile.x, tile.y, t + 50) * 0.8; // 0.7-1.5x
                const treeY = this._smoothTerrainY(tile.x, tile.y);
                clone.position.set(wx + offsetX, treeY, wz + offsetZ);
                clone.rotation.y = rotY;
                clone.scale.multiplyScalar(scale);
                // Color the tree: foliage green, trunk brown
                const foliageColors = [0x2d8a2d, 0x1e7a1e, 0x3a9a3a, 0x2e7d32, 0x388e3c];
                const trunkColor = 0x6d4c3a;
                const foliageHex = foliageColors[(tile.x * 7 + tile.y * 13 + t * 3) % foliageColors.length];
                clone.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                        if (child.material) {
                            const applyTreeColor = (m) => {
                                if (!m.color) return m;
                                const nm = m.clone();
                                const box = new THREE.Box3().setFromObject(child);
                                const size = box.getSize(new THREE.Vector3());
                                // Trunk: narrow cylinder, Foliage: wider cone/sphere
                                if (size.x < 0.25 && size.z < 0.25) {
                                    nm.color.setHex(trunkColor); // trunk
                                } else {
                                    nm.color.setHex(foliageHex); // foliage
                                }
                                nm.roughness = 0.9;
                                nm.metalness = 0.0;
                                return nm;
                            };
                            if (Array.isArray(child.material)) {
                                child.material = child.material.map(applyTreeColor);
                            } else {
                                child.material = applyTreeColor(child.material);
                            }
                        }
                    }
                });
                objects.push(clone);
            }
        }

        // Place trees on park tiles (0-1 per tile + some open space)
        for (const tile of parkTiles) {
            if (hash(tile.x, tile.y, 100) > 0.6) continue; // 60% of park tiles get a tree
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;
            const model = hash(tile.x, tile.y, 110) > 0.5 ? treeLarge : treeSmall;
            if (!model) continue;
            const clone = model.clone(true);
            const offsetX = (hash(tile.x, tile.y, 120) - 0.5) * 0.4;
            const offsetZ = (hash(tile.x, tile.y, 130) - 0.5) * 0.4;
            const parkY = this._smoothTerrainY(tile.x, tile.y);
            clone.position.set(wx + offsetX, parkY, wz + offsetZ);
            clone.rotation.y = hash(tile.x, tile.y, 140) * Math.PI * 2;
            clone.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                    if (child.material) {
                        const applyParkTreeColor = (m) => {
                            if (!m.color) return m;
                            const nm = m.clone();
                            const box = new THREE.Box3().setFromObject(child);
                            const size = box.getSize(new THREE.Vector3());
                            nm.color.setHex(size.x < 0.25 && size.z < 0.25 ? 0x6d4c3a : 0x4caf50);
                            nm.roughness = 0.9; nm.metalness = 0.0;
                            return nm;
                        };
                        if (Array.isArray(child.material)) {
                            child.material = child.material.map(applyParkTreeColor);
                        } else {
                            child.material = applyParkTreeColor(child.material);
                        }
                    }
                }
            });
            objects.push(clone);
        }

        // Sparse trees dotting the open grassland — brings the rolling hills to
        // life without the density (or draw cost) of a full forest.
        const grassFoliage = [0x4e9a3a, 0x3f8a30, 0x57a544, 0x6aae4e];
        for (const tile of grassTiles) {
            if (hash(tile.x, tile.y, 200) > 0.05) continue; // ~5% of grass tiles
            const model = hash(tile.x, tile.y, 210) > 0.45 ? treeLarge : treeSmall;
            if (!model) continue;
            const wx = tile.x - this._mapHalfW + 0.5;
            const wz = tile.y - this._mapHalfH + 0.5;
            const clone = model.clone(true);
            const ox = (hash(tile.x, tile.y, 220) - 0.5) * 0.5;
            const oz = (hash(tile.x, tile.y, 230) - 0.5) * 0.5;
            clone.position.set(wx + ox, this._smoothTerrainY(tile.x, tile.y), wz + oz);
            clone.rotation.y = hash(tile.x, tile.y, 240) * Math.PI * 2;
            clone.scale.multiplyScalar(0.8 + hash(tile.x, tile.y, 250) * 0.7);
            const foliageHex = grassFoliage[(tile.x * 5 + tile.y * 11) % grassFoliage.length];
            clone.traverse((child) => {
                if (!child.isMesh) return;
                child.castShadow = true; child.receiveShadow = true;
                if (!child.material) return;
                const tint = (m) => {
                    if (!m.color) return m;
                    const nm = m.clone();
                    const sz = new THREE.Box3().setFromObject(child).getSize(new THREE.Vector3());
                    nm.color.setHex(sz.x < 0.25 && sz.z < 0.25 ? 0x6d4c3a : foliageHex);
                    nm.roughness = 0.9; nm.metalness = 0.0;
                    return nm;
                };
                child.material = Array.isArray(child.material) ? child.material.map(tint) : tint(child.material);
            });
            objects.push(clone);
        }

        return objects;
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
        for (let y = bounds.minY; y <= bounds.maxY; y++) {
            for (let x = bounds.minX; x <= bounds.maxX; x++) {
                const t = this.game.map.getTileAt(x, y);
                const isGrass = t === TERRAIN_GRASS;
                const isMtn = t === TERRAIN_MOUNTAIN;
                if (!isGrass && !isMtn) continue;
                const y0 = this._smoothTerrainY(x, y);
                const wx = x - this._mapHalfW + 0.5;
                const wz = y - this._mapHalfH + 0.5;
                if (hash(x, y, 1) < (isMtn ? 0.32 : 0.05)) {
                    rocks.push({ x: wx + (hash(x, y, 2) - 0.5) * 0.6, y: y0, z: wz + (hash(x, y, 3) - 0.5) * 0.6,
                        s: 0.5 + hash(x, y, 4) * (isMtn ? 1.4 : 0.8), rx: hash(x, y, 5), ry: hash(x, y, 6), c: hash(x, y, 7) });
                }
                if (isGrass && hash(x, y, 10) < 0.07) {
                    bushes.push({ x: wx + (hash(x, y, 11) - 0.5) * 0.6, y: y0, z: wz + (hash(x, y, 12) - 0.5) * 0.6,
                        s: 0.6 + hash(x, y, 13) * 0.8, ry: hash(x, y, 14), c: hash(x, y, 15) });
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

            const clone = model.clone(true);
            clone.position.set(wx + side * Math.cos(rotY), terrainY, wz + side * Math.sin(rotY));
            clone.rotation.y = rotY + (hash(b.x, b.y, 530) - 0.5) * 0.3;
            clone.traverse((child) => {
                if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
            });
            objects.push(clone);
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
                    if (child.userData?.kind === 'building' || child.userData?.kind === 'vegetation') {
                        child.visible = !terrainOnly;
                    }
                }
            }
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

    _renderDecals() {
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
            const wx = cp.dispX - this._mapHalfW + 0.5;
            const wz = cp.dispY - this._mapHalfH + 0.5;
            const groundY = this._elevAtWorld(wx, wz);

            if (anim) {
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
                dummy.position.set(wx, 0.12 + groundY, wz);
                dummy.rotation.set(0, 0, 0);
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

        // Rebuild vehicle group when count changes
        if (this._vehicleGroup.children.length !== vehicles.length) {
            this._vehicleGroup.clear();
            for (const v of vehicles) {
                const model = this._vehicleModels.get(v.type);
                if (model) {
                    const clone = model.clone(true);
                    clone.userData.vehicleId = v.id;
                    this._vehicleGroup.add(clone);
                } else {
                    // Fallback: colored box
                    const mesh = new THREE.Mesh(
                        new THREE.BoxGeometry(0.45, 0.18, 0.22),
                        new THREE.MeshStandardMaterial({ color: 0x607d8b, roughness: 0.4, metalness: 0.3 })
                    );
                    mesh.castShadow = true;
                    mesh.userData.vehicleId = v.id;
                    this._vehicleGroup.add(mesh);
                }
            }
        }

        // Update positions every frame
        for (let i = 0; i < vehicles.length; i++) {
            const v = vehicles[i];
            const child = this._vehicleGroup.children[i];
            if (!child) continue;
            const wx = v.x - this._mapHalfW + 0.5;
            const wz = v.y - this._mapHalfH + 0.5;
            child.position.set(wx, 0.06 + this._elevAtWorld(wx, wz), wz);
            child.rotation.y = v.angle ?? 0;
        }
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
                this._policeBodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 });
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

        // --- Wet ground accumulation (persists briefly after rain stops) ---
        if (!this._wetness) this._wetness = 0;
        if (isRain || isStorm) {
            this._wetness = Math.min(1.0, this._wetness + 0.008 * intensity);
        } else {
            this._wetness = Math.max(0, this._wetness - 0.002); // slow dry
        }

        // Apply wetness to road/terrain materials in visible chunks
        if (this._wetness > 0.01 || this._prevWetness > 0.01) {
            const targetMetal = this._wetness * 0.45;
            const targetRough = 1.0 - this._wetness * 0.3;
            for (const [, entry] of this._chunkMeshes) {
                entry.group.traverse((obj) => {
                    if (obj.isMesh && obj.userData?.kind === 'terrain' && obj.material && !Array.isArray(obj.material)) {
                        obj.material.metalness = THREE.MathUtils.lerp(obj.material.metalness, targetMetal, 0.1);
                        obj.material.roughness = THREE.MathUtils.lerp(obj.material.roughness, targetRough, 0.1);
                    }
                });
            }
        }
        this._prevWetness = this._wetness;

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
            const RAIN_COUNT = 4000;
            if (!this._rainGroup) {
                const positions = new Float32Array(RAIN_COUNT * 6); // line segments: start+end per drop
                for (let i = 0; i < RAIN_COUNT; i++) {
                    const bx = (rand01() - 0.5) * 40;
                    const by = rand01() * 12;
                    const bz = (rand01() - 0.5) * 40;
                    const streakLen = 0.15 + rand01() * 0.2;
                    const j = i * 6;
                    positions[j] = bx; positions[j + 1] = by; positions[j + 2] = bz;
                    positions[j + 3] = bx; positions[j + 4] = by - streakLen; positions[j + 5] = bz;
                }
                const geom = new THREE.BufferGeometry();
                geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const mat = new THREE.LineBasicMaterial({
                    color: 0x99bbdd,
                    transparent: true,
                    opacity: 0.5,
                    linewidth: 1,
                });
                this._rainGroup = new THREE.LineSegments(geom, mat);
                this._rainDrops = positions;
                this._rainStreakLens = new Float32Array(RAIN_COUNT);
                for (let i = 0; i < RAIN_COUNT; i++) this._rainStreakLens[i] = 0.15 + rand01() * 0.2;
                this.scene.add(this._rainGroup);
            }

            this._rainGroup.visible = true;
            const p = this._player?.position;
            if (p) this._rainGroup.position.set(p.x, 0, p.z);

            const positions = this._rainDrops;
            const fallSpeed = (isStorm ? 0.45 : 0.25) * intensity;
            const windX = Math.cos(windDir) * windSpeed * 0.02;
            const windZ = Math.sin(windDir) * windSpeed * 0.02;
            for (let i = 0; i < RAIN_COUNT; i++) {
                const j = i * 6;
                positions[j + 1] -= fallSpeed;
                positions[j + 4] -= fallSpeed;
                positions[j] += windX;
                positions[j + 3] += windX;
                positions[j + 2] += windZ;
                positions[j + 5] += windZ;
                if (positions[j + 4] < 0) {
                    const bx = (rand01() - 0.5) * 40;
                    const by = 10 + rand01() * 3;
                    const bz = (rand01() - 0.5) * 40;
                    const len = this._rainStreakLens[i];
                    positions[j] = bx; positions[j + 1] = by; positions[j + 2] = bz;
                    positions[j + 3] = bx; positions[j + 4] = by - len; positions[j + 5] = bz;
                }
            }
            this._rainGroup.geometry.attributes.position.needsUpdate = true;
            this._rainGroup.material.opacity = 0.25 + intensity * 0.45;
        }

        // --- Snow particle system ---
        if (isSnow) {
            const SNOW_COUNT = 2000;
            if (!this._snowGroup) {
                const positions = new Float32Array(SNOW_COUNT * 3);
                for (let i = 0; i < SNOW_COUNT; i++) {
                    positions[i * 3] = (rand01() - 0.5) * 40;
                    positions[i * 3 + 1] = rand01() * 12;
                    positions[i * 3 + 2] = (rand01() - 0.5) * 40;
                }
                const geom = new THREE.BufferGeometry();
                geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                const mat = new THREE.PointsMaterial({
                    color: 0xeeeeff,
                    size: 0.06,
                    transparent: true,
                    opacity: 0.85,
                });
                this._snowGroup = new THREE.Points(geom, mat);
                this._snowDrops = positions;
                this.scene.add(this._snowGroup);
            }

            this._snowGroup.visible = true;
            const p = this._player?.position;
            if (p) this._snowGroup.position.set(p.x, 0, p.z);

            const positions = this._snowDrops;
            const t = performance.now() * 0.001;
            const fallSpeed = 0.04 * intensity;
            for (let i = 0; i < SNOW_COUNT; i++) {
                const j = i * 3;
                // Gentle wobble drift
                positions[j] += Math.sin(t + i * 0.7) * 0.003 + Math.cos(windDir) * windSpeed * 0.005;
                positions[j + 1] -= fallSpeed;
                positions[j + 2] += Math.cos(t + i * 1.1) * 0.003 + Math.sin(windDir) * windSpeed * 0.005;
                if (positions[j + 1] < 0) {
                    positions[j] = (rand01() - 0.5) * 40;
                    positions[j + 1] = 10 + rand01() * 3;
                    positions[j + 2] = (rand01() - 0.5) * 40;
                }
            }
            this._snowGroup.geometry.attributes.position.needsUpdate = true;
            this._snowGroup.material.opacity = 0.5 + intensity * 0.4;
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
        spring: { sky: 0x5a9ac6, fog: 0x6aadcc, fogDensity: 0.005,  ambient: 0xffffff,  sun: 0xfff5e0 },
        summer: { sky: 0x4a90b8, fog: 0x5aa0c0, fogDensity: 0.004,  ambient: 0xfff5e0,  sun: 0xffd87a },
        autumn: { sky: 0x8a7060, fog: 0x9a8878, fogDensity: 0.006,  ambient: 0xffd090,  sun: 0xffa040 },
        winter: { sky: 0x7088a0, fog: 0x8098ac, fogDensity: 0.007,  ambient: 0xd0e0ff,  sun: 0xffffff },
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
            this.fxSystem.update();
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

        // Lightning exposure decay
        this._updateLightningExposure();

        // Keep the gradient sky dome centered on the camera so it never clips.
        if (this._skyDome) this._skyDome.position.copy(this.camera.position);

        // Render via post-processing composer if available, else direct
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
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
        }
    }

    /**
     * Set render scale (for performance)
     */
    setRenderScale(scale) {
        this.renderScale = scale;
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        this.renderer.setSize(width * scale, height * scale, false);
        if (this.composer) {
            this.composer.setSize(width * scale, height * scale);
        }
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
