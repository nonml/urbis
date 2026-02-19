// Version information for the game
// This file is auto-generated during build

export const VERSION = '1.0.0';
const metaEnv = import.meta?.env || {};
export const BUILD_TIMESTAMP = metaEnv.VITE_BUILD_TIMESTAMP || new Date().toISOString();
export const BUILD_NUMBER = metaEnv.VITE_BUILD_NUMBER || 'local';

// Full version string with build info
export const FULL_VERSION = `${VERSION} (Build ${BUILD_NUMBER})`;

/**
 * Get version info as object
 */
export function getVersionInfo() {
    return {
        version: VERSION,
        buildTimestamp: BUILD_TIMESTAMP,
        buildNumber: BUILD_NUMBER,
        fullVersion: FULL_VERSION
    };
}
