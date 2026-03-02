// Third-person 3D renderer (Three.js via ESM CDN)
// Renders:
// - Terrain: Instanced boxes with per-instance colors
// - Buildings: Instanced boxes per building type
// - Citizens: Instanced spheres
// - Player: simple capsule-like stack
// - Camera rig: Orbit + Follow + Collision

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { TERRAIN_WATER, TERRAIN_GRASS, TERRAIN_FOREST, TERRAIN_MOUNTAIN, BUILDING_TYPES, BUILDING_3D, ZONE_TYPES } from './constants.js';

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

        // Camera rig (Ticket B-2: Orbit + Follow + Collision)
        this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
        this.yaw = 0;
        this.pitch = -0.4;
        this.followDist = 8;
        this.followHeight = 4;
        this.minFollowDist = 4;
        this.maxFollowDist = 15;
        this.mouseSensitivity = 0.005;
        this.invertY = false;
        this.cameraCollision = true;
        this.cameraCollisionRadius = 1.0;

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

        this._chunkMeshes = new Map(); // chunkId -> { group, center, radius, terrainCount, buildingCount }
        this._citizensMesh = null;
        this._player = null;
        this._buildGhost = null;
        this._buildGhostType = null;
        this._frustum = new THREE.Frustum();
        this._projScreenMatrix = new THREE.Matrix4();

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
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.renderer.setSize(rect.width, rect.height, false);
        this.camera.aspect = rect.width / rect.height;
        this.camera.updateProjectionMatrix();
    }

    handleWheel(e) {
        const delta = Math.sign(e.deltaY);
        this.followDist = Math.max(this.minFollowDist, Math.min(this.maxFollowDist, this.followDist - delta * 0.5));
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
        const byType = new Map();
        for (const b of buildings) {
            if (b.x < bounds.minX || b.x > bounds.maxX || b.y < bounds.minY || b.y > bounds.maxY) continue;
            if (!byType.has(b.type)) byType.set(b.type, []);
            byType.get(b.type).push(b);
        }

        const meshes = [];
        const dummy = new THREE.Object3D();
        for (const [type, arr] of byType.entries()) {
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
            meshes.push(mesh);
        }
        return meshes;
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
            buildingCount: buildingMeshes.reduce((n, mesh) => n + mesh.count, 0),
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
            child.geometry?.dispose?.();
            child.material?.dispose?.();
        }
        const meshes = this._buildBuildingMeshesForChunk(entry.bounds, this.game.buildings.buildings);
        for (const mesh of meshes) {
            mesh.userData.kind = 'building';
            entry.group.add(mesh);
        }
        entry.buildingCount = meshes.reduce((n, mesh) => n + mesh.count, 0);
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
        for (const entry of this._chunkMeshes.values()) {
            const sphere = new THREE.Sphere(entry.center, entry.radius);
            entry.group.visible = this._frustum.intersectsSphere(sphere);
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

        // Calculate ideal camera position from orbit
        const cos = Math.cos(this.yaw);
        const sin = Math.sin(this.yaw);

        // Camera position relative to player (orbit)
        const idealX = p.x - sin * this.followDist;
        const idealZ = p.z - cos * this.followDist;

        // Height based on pitch (more pitch = lower height)
        // Pitch range: -1.2 (look down) to -0.1 (look up)
        const targetHeight = p.y + Math.sin(this.pitch) * this.followDist + this.followHeight;

        // Apply pitch smoothing (damped oscillation)
        const pitchDamp = 0.15;
        this.pitch = this.pitch + (Math.max(-1.2, Math.min(-0.1, this.pitch)) - this.pitch) * pitchDamp;

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

        // Smoothly interpolate camera position (damped follow)
        this.camera.position.lerp(idealCamPos, 0.15);
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

        if (this._citizensDirty) this.rebuildCitizens();
        else this.updateCitizens();

        this.syncPlayer();
        this.updateCamera();
        this.syncChunkStreaming();
        if (this._debugMode === 'services') {
            this.updateDebugOverlay();
        }
        if (this._zoneMode !== 'none') {
            this.updateZoneOverlay();
        }
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
        }
        const wx = x - this._mapHalfW + 0.5;
        const wz = y - this._mapHalfH + 0.5;
        this._buildGhost.position.set(wx, h / 2, wz);
        this._buildGhost.rotation.y = ((rotation % 4) + 4) % 4 * (Math.PI / 2);
        this._buildGhost.material.color.setHex(ok ? 0x3ecf8e : 0xe25555);
        this._buildGhost.visible = true;
    }

    clearBuildGhost() {
        if (!this._buildGhost) return;
        this._buildGhost.visible = false;
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
