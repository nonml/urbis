// Version information for the game
// This file is auto-generated during build

export const VERSION = '0.42.0';
const metaEnv = import.meta?.env || {};
export const BUILD_TIMESTAMP = metaEnv.VITE_BUILD_TIMESTAMP || '2026-03-03T18:07:56.012Z';
export const BUILD_NUMBER = metaEnv.VITE_BUILD_NUMBER || '0.42.0-13d04a2';

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
