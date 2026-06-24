let THREE = null;

const FADE_FRACTION = 0.2;

export class DecalManager {
    constructor(threeModule, scene, options = {}) {
        THREE = threeModule;
        this._scene = scene;
        this._maxTotal = options.maxTotal ?? 512;
        this._maxPerChunk = options.maxPerChunk ?? 64;
        this._chunkSize = options.chunkSize ?? 32;
        this._mapHalfW = options.mapHalfW ?? 0;
        this._mapHalfH = options.mapHalfH ?? 0;
        this._elevFn = options.elevFn ?? null;

        this._chunks = new Map();
        this._allDecals = [];
        this._DecalGeometry = null;
        this._weatherFadeMult = 1;

        this._groundGeo = new THREE.PlaneGeometry(1, 1);
        this._groundGeo.rotateX(-Math.PI / 2);

        this._baseMat = new THREE.MeshStandardMaterial({
            transparent: true,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
            side: THREE.DoubleSide,
            roughness: 0.9,
            metalness: 0.0,
        });
    }

    spawnGround(wx, wz, opts = {}) {
        const {
            color = 0x880000,
            size = 0.15,
            duration = 5000,
            rotation = 0,
            opacity = 1,
            weatherFade = false,
            roughness,
            metalness,
        } = opts;

        const y = this._elevFn ? this._elevFn(wx, wz) + 0.01 : 0.02;
        const mat = this._baseMat.clone();
        mat.color.setHex(color);
        mat.opacity = opacity;
        if (roughness !== undefined) mat.roughness = roughness;
        if (metalness !== undefined) mat.metalness = metalness;

        const mesh = new THREE.Mesh(this._groundGeo, mat);
        mesh.scale.set(size, 1, size);
        mesh.position.set(wx, y, wz);
        mesh.rotation.y = rotation;
        mesh.renderOrder = 1;

        return this._register({
            mesh, life: 0, duration, wx, wz,
            baseOpacity: opacity, weatherFade,
        });
    }

    spawnWall(wx, y, wz, normalX, normalZ, opts = {}) {
        const {
            color = 0xcccccc,
            width = 0.2,
            height = 0.2,
            duration = Infinity,
            opacity = 1,
            weatherFade = false,
        } = opts;

        if (!this._wallGeo) this._wallGeo = new THREE.PlaneGeometry(1, 1);

        const mat = this._baseMat.clone();
        mat.color.setHex(color);
        mat.opacity = opacity;

        const mesh = new THREE.Mesh(this._wallGeo, mat);
        mesh.scale.set(width, height, 1);
        const offset = 0.01;
        mesh.position.set(wx + normalX * offset, y, wz + normalZ * offset);
        mesh.lookAt(wx + normalX, y, wz + normalZ);
        mesh.renderOrder = 1;

        return this._register({
            mesh, life: 0, duration, wx, wz,
            baseOpacity: opacity, weatherFade,
        });
    }

    async spawnProjected(targetMesh, position, orientation, size, opts = {}) {
        const { color = 0x444444, duration = Infinity, opacity = 1 } = opts;

        if (!this._DecalGeometry) {
            const mod = await import('three/addons/geometries/DecalGeometry.js');
            this._DecalGeometry = mod.DecalGeometry;
        }

        const geo = new this._DecalGeometry(targetMesh, position, orientation, size);
        const mat = this._baseMat.clone();
        mat.color.setHex(color);
        mat.opacity = opacity;

        const mesh = new THREE.Mesh(geo, mat);
        mesh.renderOrder = 1;

        return this._register({
            mesh,
            life: 0,
            duration,
            wx: position.x,
            wz: position.z,
            projected: true,
            baseOpacity: opacity,
            weatherFade: false,
        });
    }

    _register(entry) {
        const chunkId = this._chunkIdFromWorld(entry.wx, entry.wz);
        let chunk = this._chunks.get(chunkId);
        if (!chunk) {
            const group = new THREE.Group();
            group.name = `decals_${chunkId}`;
            this._scene.add(group);
            chunk = { group, decals: [] };
            this._chunks.set(chunkId, chunk);
        }

        if (chunk.decals.length >= this._maxPerChunk) {
            this._remove(chunk.decals[0]);
        }
        if (this._allDecals.length >= this._maxTotal) {
            this._remove(this._allDecals[0]);
        }

        chunk.group.add(entry.mesh);
        chunk.decals.push(entry);
        this._allDecals.push(entry);
        entry._chunkId = chunkId;
        return entry;
    }

    _remove(entry) {
        const chunk = this._chunks.get(entry._chunkId);
        if (chunk) {
            chunk.group.remove(entry.mesh);
            const idx = chunk.decals.indexOf(entry);
            if (idx >= 0) chunk.decals.splice(idx, 1);
            if (chunk.decals.length === 0) {
                this._scene.remove(chunk.group);
                this._chunks.delete(entry._chunkId);
            }
        }
        const gi = this._allDecals.indexOf(entry);
        if (gi >= 0) this._allDecals.splice(gi, 1);

        if (entry.projected) entry.mesh.geometry?.dispose();
        entry.mesh.material?.dispose();
    }

    update(dt) {
        if (!dt || dt <= 0) return;
        const wfm = this._weatherFadeMult ?? 1;
        for (let i = this._allDecals.length - 1; i >= 0; i--) {
            const d = this._allDecals[i];
            if (!Number.isFinite(d.duration)) continue;
            const mult = d.weatherFade ? wfm : 1;
            d.life += dt * mult;
            if (d.life >= d.duration) {
                this._remove(d);
                continue;
            }
            const fadeStart = d.duration * (1 - FADE_FRACTION);
            if (d.life > fadeStart) {
                d.mesh.material.opacity =
                    d.baseOpacity * (1 - (d.life - fadeStart) / (d.duration * FADE_FRACTION));
            }
        }
    }

    syncChunkVisibility(activeChunkIds) {
        for (const [id, chunk] of this._chunks) {
            chunk.group.visible = activeChunkIds.has(id);
        }
    }

    get count() {
        return this._allDecals.length;
    }

    _chunkIdFromWorld(wx, wz) {
        const tx = Math.floor(wx + this._mapHalfW);
        const ty = Math.floor(wz + this._mapHalfH);
        return `${Math.floor(tx / this._chunkSize)},${Math.floor(ty / this._chunkSize)}`;
    }

    setLimits(maxTotal, maxPerChunk) {
        this._maxTotal = maxTotal;
        this._maxPerChunk = maxPerChunk;
    }

    dispose() {
        for (let i = this._allDecals.length - 1; i >= 0; i--) {
            this._remove(this._allDecals[i]);
        }
        this._groundGeo.dispose();
        this._wallGeo?.dispose();
        this._baseMat.dispose();
    }
}
