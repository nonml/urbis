// Asset Manager (P-04)
// Handles asset loading, caching, and manifest management
// Provides deterministic asset access without hard-coded paths

// Asset manifest - loaded from assets/manifest.json
let assetManifest = null;
let assetCache = new Map();
let assetsLoaded = false;

/**
 * Load asset manifest from path
 */
export async function loadAssetManifest(path = '/assets/manifest.json') {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            console.warn(`Failed to load asset manifest: ${response.statusText}`);
            return null;
        }
        assetManifest = await response.json();
        assetsLoaded = true;
        return assetManifest;
    } catch (e) {
        console.error(`Error loading asset manifest: ${e.message}`);
        return null;
    }
}

/**
 * Get asset by ID
 */
export function getAsset(assetId) {
    if (!assetManifest) {
        console.warn('Asset manifest not loaded');
        return null;
    }

    const [category, id] = assetId.split(':');
    if (!category || !id) {
        console.warn(`Invalid asset ID: ${assetId}`);
        return null;
    }

    const categoryAssets = assetManifest.assets[category];
    if (!categoryAssets) {
        console.warn(`Unknown asset category: ${category}`);
        return null;
    }

    const asset = categoryAssets[id];
    if (!asset) {
        console.warn(`Unknown asset: ${category}:${id}`);
        return null;
    }

    return asset;
}

/**
 * Get asset path by ID
 */
export function getAssetPath(assetId) {
    const asset = getAsset(assetId);
    return asset ? asset.path : null;
}

/**
 * Get asset metadata by ID
 */
export function getAssetMetadata(assetId) {
    const asset = getAsset(assetId);
    return asset || null;
}

/**
 * Check if asset exists in manifest
 */
export function hasAsset(assetId) {
    return getAsset(assetId) !== null;
}

/**
 * Cache an asset (audio, image, etc.)
 */
export function cacheAsset(assetId, asset) {
    assetCache.set(assetId, asset);
}

/**
 * Get cached asset
 */
export function getCachedAsset(assetId) {
    return assetCache.get(assetId);
}

/**
 * Clear asset cache
 */
export function clearCache() {
    assetCache.clear();
}

/**
 * Load an audio asset
 */
export async function loadAudioAsset(assetId) {
    const path = getAssetPath(assetId);
    if (!path) return null;

    try {
        const audio = new Audio(path);
        const metadata = getAssetMetadata(assetId);

        if (metadata?.loop) {
            audio.loop = true;
        }
        if (metadata?.volume) {
            audio.volume = metadata.volume;
        }

        cacheAsset(assetId, audio);
        return audio;
    } catch (e) {
        console.warn(`Failed to load audio asset ${assetId}: ${e.message}`);
        return null;
    }
}

/**
 * Load an image texture
 */
export async function loadTextureAsset(assetId) {
    const path = getAssetPath(assetId);
    if (!path) return null;

    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            cacheAsset(assetId, img);
            resolve(img);
        };
        img.onerror = () => {
            console.warn(`Failed to load texture asset ${assetId}`);
            resolve(null);
        };
        img.src = path;
    });
}

/**
 * Get all assets of a category
 */
export function getCategoryAssets(category) {
    if (!assetManifest) return [];
    return assetManifest.assets[category] || {};
}

/**
 * Get all asset IDs
 */
export function getAllAssetIds() {
    if (!assetManifest) return [];

    const ids = [];
    for (const category of Object.keys(assetManifest.assets)) {
        for (const id of Object.keys(assetManifest.assets[category])) {
            ids.push(`${category}:${id}`);
        }
    }
    return ids;
}

/**
 * Validate asset references in code
 * Returns list of asset IDs that are referenced but not in manifest
 */
export function validateReferences(referencedIds) {
    if (!assetManifest) {
        return { missing: [], unknown: [] };
    }

    const manifestIds = new Set(getAllAssetIds());
    const missing = [];
    const unknown = [];

    for (const id of referencedIds) {
        if (!id.includes(':')) {
            unknown.push(id);
            continue;
        }
        if (!manifestIds.has(id)) {
            missing.push(id);
        }
    }

    return { missing, unknown };
}

/**
 * Create placeholder asset for missing assets
 */
export function createPlaceholderAsset(type = 'texture') {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    if (type === 'texture') {
        ctx.fillStyle = '#888888';
        ctx.fillRect(0, 0, 64, 64);
        ctx.strokeStyle = '#aaaaaa';
        ctx.strokeRect(0, 0, 64, 64);
        ctx.fillStyle = '#666666';
        ctx.font = '12px monospace';
        ctx.fillText('PLACEHOLDER', 8, 32);
    } else if (type === 'audio') {
        // Return a dummy object
        return {
            id: 'audio:placeholder',
            type: 'placeholder',
            src: null,
            play: () => {},
            pause: () => {},
            stop: () => {},
            volume: 0,
            loop: false
        };
    }

    const placeholder = new Image();
    placeholder.src = canvas.toDataURL();

    return placeholder;
}

/**
 * Get asset by ID with fallback
 */
export function getAssetWithFallback(assetId) {
    const asset = getAsset(assetId);
    if (asset) {
        return asset;
    }

    // Use fallback
    const [category] = assetId.split(':');
    const fallback = assetManifest?.fallback?.[category];
    if (fallback) {
        console.warn(`Asset ${assetId} not found, using fallback: ${fallback}`);
        return {
            id: assetId,
            path: fallback,
            type: category,
            isFallback: true
        };
    }

    console.warn(`Asset ${assetId} not found, no fallback available`);
    return null;
}

/**
 * Check if assets have been loaded
 */
export function isAssetsLoaded() {
    return assetsLoaded;
}

/**
 * Get asset manifest
 */
export function getManifest() {
    return assetManifest;
}

/**
 * Initialize asset system with default manifest
 */
export function initAssets() {
    if (assetManifest) {
        return Promise.resolve(assetManifest);
    }
    return loadAssetManifest();
}

/**
 * Export all asset IDs for validation
 */
export function exportAssetIds() {
    return getAllAssetIds();
}

/**
 * Import asset IDs from external source
 */
export function importAssetIds(ids) {
    const manifestIds = new Set(getAllAssetIds());
    const missing = [];

    for (const id of ids) {
        if (!manifestIds.has(id)) {
            missing.push(id);
        }
    }

    return { missing };
}