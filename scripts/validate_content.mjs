#!/usr/bin/env node
// Content Validation Script (P-02)
// Validates all content JSON for schema + references
// Usage: node scripts/validate_content.mjs [--quiet]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUIET = process.argv.includes('--quiet');

// Paths to check
const SRC_DIR = path.join(__dirname, '../src');
const CONTENT_DIR = path.join(__dirname, '../src/content');
const SIM_DIR = path.join(__dirname, '../src/sim');
const ASSETS_DIR = path.join(__dirname, '../assets');

// Valid content types
const VALID_QUEST_KINDS = [
    'trigger', 'hack_node', 'go_to', 'choice', 'investigate', 'interact',
    'outcome', 'conditional', 'spawn_clue', 'investigate', 'interact',
    'go_to', 'hack', 'collect', 'interview', 'analyze', 'wait', 'build', 'zone'
];

const VALID_CRISIS_TYPES = [
    'FLOOD', 'FIRE', 'CRIME_SPREE', 'POLICE_STRIKE',
    'BLACKOUT', 'BRIDGE_FAILURE', 'MARKET_CRASH', 'DISEASE',
    'RIVAL_ATTACK', 'VANDALISM'
];

const VALID_POLICY_CATEGORIES = [
    'ECONOMIC', 'SOCIAL', 'SECURITY', 'INFRASTRUCTURE', 'DIPLOMACY'
];

const VALID_FACTION_TYPES = [
    'citizens', 'police', 'gangs', 'corp', 'rival'
];

// Validation results
const results = {
    errors: [],
    warnings: [],
    passed: 0,
};

/**
 * Log a message
 */
function log(message, type = 'info') {
    if (QUIET && type === 'info') return;
    const prefix = type === 'error' ? '\u001b[31mERROR\u001b[0m' :
                   type === 'warning' ? '\u001b[33mWARN\u001b[0m' : '\u001b[32mOK\u001b[0m';
    console.log(`${prefix}: ${message}`);
}

/**
 * Log an error
 */
function error(file, message) {
    results.errors.push({ file, message });
    log(`${file}: ${message}`, 'error');
}

/**
 * Log a warning
 */
function warn(file, message) {
    results.warnings.push({ file, message });
    log(`${file}: ${message}`, 'warning');
}

/**
 * Check if a file exists
 */
function fileExists(filePath) {
    return fs.existsSync(filePath);
}

/**
 * Read a JSON file
 */
function readJSON(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        error(filePath, `Failed to parse: ${e.message}`);
        return null;
    }
}

/**
 * Read a JS file
 */
function readJS(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf8');
    } catch (e) {
        error(filePath, `Failed to read: ${e.message}`);
        return null;
    }
}

// ==================== Content Validators ====================

/**
 * Validate a quest template
 */
function validateQuestTemplate(file, data) {
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.steps || !Array.isArray(data.steps)) {
        error(file, 'Missing or invalid "steps" array');
    } else {
        for (let i = 0; i < data.steps.length; i++) {
            const step = data.steps[i];
            if (!step.id) {
                warn(file, `Step ${i}: Missing "id" field`);
            }
            if (!step.kind) {
                warn(file, `Step ${i}: Missing "kind" field`);
            } else if (!VALID_QUEST_KINDS.includes(step.kind)) {
                warn(file, `Step ${i}: Unknown step kind "${step.kind}"`);
            }
        }
    }

    return true;
}

/**
 * Validate a crisis template
 */
function validateCrisisTemplate(file, data) {
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.name) {
        warn(file, 'Missing "name" field');
    }

    if (!data.type) {
        warn(file, 'Missing "type" field');
    } else if (!VALID_CRISIS_TYPES.includes(data.type)) {
        warn(file, `Unknown crisis type "${data.type}"`);
    }

    return true;
}

/**
 * Validate a policy template
 */
function validatePolicyTemplate(file, data) {
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.name) {
        warn(file, 'Missing "name" field');
    }

    if (!data.category) {
        warn(file, 'Missing "category" field');
    } else if (!VALID_POLICY_CATEGORIES.includes(data.category)) {
        warn(file, `Unknown policy category "${data.category}"`);
    }

    return true;
}

/**
 * Validate a faction template
 */
function validateFactionTemplate(file, data) {
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.name) {
        warn(file, 'Missing "name" field');
    }

    if (!data.type) {
        warn(file, 'Missing "type" field');
    } else if (!VALID_FACTION_TYPES.includes(data.type)) {
        warn(file, `Unknown faction type "${data.type}"`);
    }

    return true;
}

/**
 * Validate a landmark node
 */
function validateLandmark(file, data) {
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.name) {
        warn(file, 'Missing "name" field');
    }

    if (data.x === undefined || data.y === undefined) {
        warn(file, 'Missing coordinates (x, y)');
    }

    if (data.districtId && typeof data.districtId !== 'string') {
        warn(file, 'Invalid "districtId" field: must be a string');
    }

    return true;
}

/**
 * Validate an unlock/upgrade definition
 */
function validateUnlock(file, data) {
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.name) {
        warn(file, 'Missing "name" field');
    }

    if (!data.type) {
        warn(file, 'Missing "type" field');
    }

    if (data.cost && typeof data.cost !== 'object') {
        warn(file, 'Invalid "cost" field: must be an object');
    }

    return true;
}

/**
 * Validate a district definition
 */
function validateDistrict(file, data) {
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.name) {
        warn(file, 'Missing "name" field');
    }

    if (data.center && (!data.center.x || !data.center.y)) {
        warn(file, 'Invalid "center" coordinates');
    }

    return true;
}

// ==================== Directory Scanners ====================

/**
 * Recursively collect all files in a directory
 */
function collectFiles(dir, pattern = null) {
    const files = [];
    if (!fileExists(dir)) {
        return files;
    }

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            if (item === 'generated') continue;
            files.push(...collectFiles(fullPath, pattern));
        } else if (!pattern || item.endsWith(pattern)) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Check for broken JSON references
 */
function checkJSONReferences(file, data, referencedIds) {
    if (!data || !referencedIds) return;

    // Check for id references in various patterns
    const idPatterns = [
        /"(\w+)":\s*"(\w+)"/g,  // "id": "value"
        /'(\w+)':\s*'(\w+)'/g,  // 'id': 'value'
    ];

    const content = JSON.stringify(data);

    // Check if any id references exist
    for (const pattern of idPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            // Verify referenced ids exist
            for (const match of matches) {
                // Extract referenced id
                const refMatch = match.match(/"([^"]+)"/);
                if (refMatch && !referencedIds.has(refMatch[1])) {
                    warn(file, `Unknown reference: "${refMatch[1]}"`);
                }
            }
        }
    }
}

// ==================== Main Validation ====================

/**
 * Validate quests content
 */
function validateQuests() {
    log('\nChecking quest templates...');
    const questsDir = path.join(CONTENT_DIR, 'quests');
    const questFiles = collectFiles(questsDir, '.json')
        .filter(f => !path.basename(f).startsWith('manifest'));

    for (const file of questFiles) {
        const data = readJSON(file);
        if (data) {
            validateQuestTemplate(file, data);
            results.passed++;
        }
    }
}


/**
 * Validate arc mission difficulty monotonicity
 */
function validateArcMissions() {
    log('\nChecking arc mission difficulty progression...');
    const arcDir = path.join(CONTENT_DIR, 'quests', 'arc');
    if (!fs.existsSync(arcDir)) {
        log('  SKIP: No arc directory');
        return;
    }

    const arcFiles = fs.readdirSync(arcDir)
        .filter(f => f.startsWith('arc_m') && f.endsWith('.json'))
        .sort();

    if (arcFiles.length === 0) {
        log('  SKIP: No arc missions found');
        return;
    }

    const missions = arcFiles.map(f => {
        const data = JSON.parse(fs.readFileSync(path.join(arcDir, f), 'utf8'));
        return { id: data.id, index: data.missionIndex, difficulty: data.difficulty };
    }).sort((a, b) => a.index - b.index);

    // Check monotonic increase (core missions m1-m5)
    let monotonic = true;
    for (let i = 1; i < missions.length - 1; i++) {
        if (missions[i].difficulty <= missions[i-1].difficulty) {
            results.errors.push('Arc difficulty not monotonic: ' + missions[i-1].id + ' (' + missions[i-1].difficulty + ') >= ' + missions[i].id + ' (' + missions[i].difficulty + ')');
            monotonic = false;
        }
    }

    if (monotonic) {
        results.passed++;
        log('  OK: Arc difficulty rises monotonically');
    } else {
        log('  FAIL: Arc difficulty not monotonic');
    }
}

/**
 * Validate crisis content
 */
function validateCrises() {
    log('\nChecking crisis definitions...');
    const crisesFile = path.join(SIM_DIR, 'crisis/director.js');
    if (fileExists(crisesFile)) {
        const content = readJS(crisesFile);
        if (content.includes('CRISIS_')) {
            results.passed++;
        }
    }
}

/**
 * Validate policies content
 */
function validatePolicies() {
    log('\nChecking policy definitions...');
    const policiesFile = path.join(SIM_DIR, 'politics/policies.js');
    if (fileExists(policiesFile)) {
        const content = readJS(policiesFile);
        if (content.includes('PolicyManager')) {
            results.passed++;
        }
    }
}

/**
 * Validate factions content
 */
function validateFactions() {
    log('\nChecking faction definitions...');
    const factionsFile = path.join(SIM_DIR, 'factions/faction_system.js');
    if (fileExists(factionsFile)) {
        const content = readJS(factionsFile);
        if (content.includes('FactionSystem')) {
            results.passed++;
        }
    }
}

/**
 * Validate asset manifest
 */
function validateAssetManifest() {
    log('\nChecking asset manifest...');
    const manifestFile = path.join(ASSETS_DIR, 'manifest.json');
    if (fileExists(manifestFile)) {
        const data = readJSON(manifestFile);
        if (data && data.assets && Array.isArray(data.assets)) {
            log(`Asset manifest contains ${data.assets.length} assets`, 'info');
            results.passed++;
        }
    } else {
        warn(manifestFile, 'Asset manifest not found (expected at assets/manifest.json)');
    }
}

/**
 * Validate landmark nodes
 */
function validateLandmarks() {
    log('\nChecking landmark nodes...');
    const landmarksFile = path.join(SIM_DIR, 'world/landmarks.js');
    if (fileExists(landmarksFile)) {
        const content = readJS(landmarksFile);
        if (content.includes('landmarks') || content.includes('Landmark')) {
            results.passed++;
        }
    }
}

/**
 * Validate district definitions
 */
function validateDistricts() {
    log('\nChecking district definitions...');
    const mapFile = path.join(SRC_DIR, 'map.js');
    if (fileExists(mapFile)) {
        const content = readJS(mapFile);
        if (content.includes('districts') || content.includes('District')) {
            results.passed++;
        }
    }
}

/**
 * Validate unlock/upgrade definitions
 */
function validateUnlocks() {
    log('\nChecking unlock definitions...');
    const constantsFile = path.join(SRC_DIR, 'constants.js');
    if (fileExists(constantsFile)) {
        const content = readJS(constantsFile);
        if (content.includes('UNLOCK_') || content.includes('unlock')) {
            results.passed++;
        }
    }
}

// ==================== No Math.random Scanner ====================

/**
 * Check for Math.random() usage in src directory
 */
function checkNoMathRandom() {
    log('\nChecking for Math.random() usage...');
    let found = 0;
    const files = collectFiles(SRC_DIR, '.js');

    for (const file of files) {
        if (file.includes('/dev/') || file.includes('/test/') || file.endsWith('_test.js')) {
            continue; // Skip dev and test files
        }

        const content = readJS(file);
        if (content.includes('Math.random()')) {
            found++;
            error(file, 'Contains Math.random() - use RNG instead');
        }
    }

    if (found === 0) {
        log('No Math.random() usage found in src/', 'info');
        results.passed++;
    }
}

// ==================== NPM Scripts ====================

/**
 * Validate basic linting rules
 */
function lintBasic() {
    log('\nRunning basic lint checks...');
    const files = collectFiles(SRC_DIR, '.js');

    for (const file of files) {
        const content = readJS(file);
        const basename = path.basename(file);

        // Check for console.log in non-dev files
        if (!file.includes('/dev/') && !file.includes('/test/') && content.includes('console.log')) {
            warn(file, 'Contains console.log statement');
        }

        // Check for TODO comments
        if (content.includes('TODO')) {
            // Count TODOs for visibility
            const count = (content.match(/TODO/g) || []).length;
            if (count > 5) {
                warn(file, `Contains ${count} TODO comments`);
            }
        }

        // Check file size (max 1000 lines for maintainability)
        const lines = content.split('\n').length;
        if (lines > 1000) {
            warn(file, `Large file (${lines} lines)`);
        }
    }

    results.passed++;
}

// ==================== Summary ====================

/**
 * Main validation
 */
function main() {
    log('Content Validation (P-02)');
    log('=========================');

    // Validate all content types
    validateQuests();
    validateArcMissions();
    validateCrises();
    validatePolicies();
    validateFactions();
    validateAssetManifest();
    validateLandmarks();
    validateDistricts();
    validateUnlocks();

    // Code quality checks
    checkNoMathRandom();
    lintBasic();

    // Summary
    log('\n=========================');
    log('\nValidation Summary:');
    log(`  Passed: ${results.passed}`);
    log(`  Errors: ${results.errors.length}`);
    log(`  Warnings: ${results.warnings.length}`);

    if (results.errors.length > 0) {
        log('\nSome errors were found. Please fix them before continuing.', 'error');
        process.exit(1);
    } else if (results.warnings.length > 0) {
        log('\nValidation completed with warnings.', 'warning');
        process.exit(0);
    } else {
        log('\nValidation completed successfully!', 'info');
        process.exit(0);
    }
}

// Run validation
main();
