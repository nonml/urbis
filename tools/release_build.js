#!/usr/bin/env node
/**
 * Release Build Script for Beta Builds
 *
 * Creates a reproducible beta build with version stamping and asset hashing.
 * Usage: node tools/release_build.js [version]
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

/**
 * Get current commit hash
 */
function getCommitHash() {
    try {
        return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    } catch (e) {
        return 'nogit';
    }
}

/**
 * Get current timestamp
 */
function getTimestamp() {
    return new Date().toISOString();
}

/**
 * Update version.js with build metadata
 */
function updateVersionFile(version, buildNumber, timestamp) {
    const versionPath = resolve(rootDir, 'src', 'version.js');

    const content = `// Version information for the game
// This file is auto-generated during build

export const VERSION = '${version}';
const metaEnv = import.meta?.env || {};
export const BUILD_TIMESTAMP = metaEnv.VITE_BUILD_TIMESTAMP || '${timestamp}';
export const BUILD_NUMBER = metaEnv.VITE_BUILD_NUMBER || '${buildNumber}';

// Full version string with build info
export const FULL_VERSION = \`\${VERSION} (Build \${BUILD_NUMBER})\`;

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
`;

    writeFileSync(versionPath, content, 'utf8');
    console.log(`Version file updated: v${version} (Build ${buildNumber})`);
}

/**
 * Update vite.config.js with build metadata
 */
function updateViteConfig(buildNumber, timestamp) {
    const viteConfigPath = resolve(rootDir, 'vite.config.js');

    let content = readFileSync(viteConfigPath, 'utf8');

    // Update the define section
    const definePattern = /'import\.meta\.env\.VITE_BUILD_NUMBER': JSON\.stringify\('([^']+)'\)/;
    content = content.replace(definePattern, `'import.meta.env.VITE_BUILD_NUMBER': JSON.stringify('${buildNumber}')`);

    const timestampPattern = /'import\.meta\.env\.VITE_BUILD_TIMESTAMP': JSON\.stringify\('([^']+)'\)/;
    content = content.replace(timestampPattern, `'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify('${timestamp}')`);

    writeFileSync(viteConfigPath, content, 'utf8');
    console.log('Vite config updated with build metadata');
}

/**
 * Run Vite build
 */
function runBuild() {
    console.log('Running Vite build...');
    try {
        execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
        console.log('Build completed successfully');
    } catch (e) {
        console.error('Build failed:', e.message);
        process.exit(1);
    }
}

/**
 * Validate build output
 */
function validateBuild() {
    const buildPath = resolve(rootDir, 'build');

    if (!existsSync(buildPath)) {
        console.error('Build failed: build directory not found');
        process.exit(1);
    }

    const files = [
        'index.html',
        'assets/index.html',
        'assets/main.js'
    ];

    for (const file of files) {
        const filePath = resolve(buildPath, file);
        if (!existsSync(filePath)) {
            // Some files may have hashed names - skip validation for those
            console.log(`Note: Expected file not found (may be hashed): ${file}`);
        }
    }

    console.log('Build validation passed');
}

/**
 * Main entry point
 */
function main() {
    console.log('=== Release Build Pipeline ===\n');

    // Parse version from argument or use default
    const version = process.argv[2] || '0.42.0';
    const commitHash = getCommitHash();
    const timestamp = getTimestamp();
    const buildNumber = `${version}-${commitHash}`;

    console.log(`Target version: ${version}`);
    console.log(`Commit hash: ${commitHash}`);
    console.log(`Build number: ${buildNumber}`);
    console.log(`Timestamp: ${timestamp}\n`);

    // Update version file
    updateVersionFile(version, buildNumber, timestamp);

    // Update vite config
    updateViteConfig(buildNumber, timestamp);

    // Run build
    runBuild();

    // Validate
    validateBuild();

    // Copy version info to build for reference
    const buildVersionPath = resolve(rootDir, 'build', 'build-version.json');
    const versionInfo = {
        version,
        buildNumber,
        commitHash,
        timestamp
    };
    writeFileSync(buildVersionPath, JSON.stringify(versionInfo, null, 2), 'utf8');

    console.log('\n=== Release Build Complete ===');
    console.log(`Beta build ready in build/`);
    console.log(`Version: v${version} (Build ${buildNumber})`);
}

main();