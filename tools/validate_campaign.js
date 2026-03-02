#!/usr/bin/env node
// Campaign Content Validation Script
// Validates campaign-related content files for proper structure and syntax
// Usage: node tools/validate_campaign.js [--quiet]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUIET = process.argv.includes('--quiet');

// Paths to check
const CAMPAIGN_DIR = path.join(__dirname, '../src/sim/campaign');
const QUESTS_DIR = path.join(__dirname, '../src/content/quests');
const STORYLETS_DIR = path.join(__dirname, '../src/content/storylets');
const TEMPLATE_DIR = path.join(__dirname, '../src/content/cases/templates');

// Valid case types
const VALID_CASE_TYPES = [
    'missing_person',
    'corruption',
    'extortion',
    'gang',
    'sabotage',
    'whistleblower',
];

// Valid tags
const VALID_TAGS = [
    'missing',
    'corruption',
    'gang',
    'sabotage',
    'cctv',
    'telecom',
    'missing_person',
    'missing_building',
];

// Valid step types
const VALID_STEP_TYPES = [
    'investigate',
    'interact',
    'go_to',
    'hack',
    'collect',
    'interview',
    'analyze',
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
 * Validate a case template
 */
function validateCaseTemplate(file, data) {
    const basename = path.basename(file);

    // Check required fields
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.type) {
        error(file, 'Missing "type" field');
    } else if (!VALID_CASE_TYPES.includes(data.type)) {
        warn(file, `Unknown case type "${data.type}"`);
    }

    if (!data.title) {
        warn(file, 'Missing "title" field');
    }

    if (!data.description) {
        warn(file, 'Missing "description" field');
    }

    // Validate steps
    if (data.steps) {
        for (let i = 0; i < data.steps.length; i++) {
            const step = data.steps[i];
            if (!step.id) {
                warn(file, `Step ${i}: Missing "id" field`);
            }
            if (!step.type) {
                warn(file, `Step ${i}: Missing "type" field`);
            } else if (!VALID_STEP_TYPES.includes(step.type)) {
                warn(file, `Step ${i}: Unknown step type "${step.type}"`);
            }
        }
    }

    // Validate tags
    if (data.tags) {
        for (const tag of data.tags) {
            if (!VALID_TAGS.includes(tag)) {
                warn(file, `Unknown tag "${tag}"`);
            }
        }
    }

    return true;
}

/**
 * Validate a storylet
 */
function validateStorylet(file, data) {
    const basename = path.basename(file);

    // Check required fields
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.title) {
        warn(file, 'Missing "title" field');
    }

    // Validate steps
    if (data.steps) {
        for (let i = 0; i < data.steps.length; i++) {
            const step = data.steps[i];
            if (!step.id) {
                warn(file, `Step ${i}: Missing "id" field`);
            }
        }
    }

    return true;
}

/**
 * Validate a case generator template
 */
function validateGeneratorTemplate(file, data) {
    const basename = path.basename(file);

    // Check required fields
    if (!data.id) {
        error(file, 'Missing "id" field');
    }

    if (!data.type) {
        error(file, 'Missing "type" field');
    } else if (!VALID_CASE_TYPES.includes(data.type)) {
        warn(file, `Unknown case type "${data.type}"`);
    }

    // Check weight
    if (data.weight !== undefined && typeof data.weight !== 'number') {
        error(file, 'Invalid "weight" field: must be a number');
    }

    return true;
}

/**
 * Validate a campaign model
 */
function validateModelFile(file) {
    if (!fileExists(file)) {
        warn(file, 'Campaign model file not found');
        return false;
    }

    const content = fs.readFileSync(file, 'utf8');

    // Check for required methods
    const requiredMethods = [
        'startCase',
        'completeCase',
        'triggerChapter',
        'triggerDialogue',
        'generateBriefing',
    ];

    for (const method of requiredMethods) {
        if (!content.includes(`\n    ${method}(`) && !content.includes(` ${method}(`)) {
            warn(file, `Missing method: ${method}`);
        }
    }

    return true;
}

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
            files.push(...collectFiles(fullPath, pattern));
        } else if (!pattern || item.endsWith(pattern)) {
            files.push(fullPath);
        }
    }

    return files;
}

/**
 * Main validation
 */
function main() {
    log('Campaign Content Validation');
    log('=============================');

    // Validate campaign model files
    log('\nChecking campaign model files...');
    const modelFile = path.join(CAMPAIGN_DIR, 'model.js');
    validateModelFile(modelFile);

    // Validate case templates
    log('\nChecking case templates...');
    const templates = collectFiles(TEMPLATE_DIR, '.json');
    for (const template of templates) {
        const basename = path.basename(template);
        // Skip manifest files
        if (basename === 'manifest.json') continue;

        const data = readJSON(template);
        if (data) {
            validateCaseTemplate(template, data);
            results.passed++;
        }
    }

    // Validate quest templates (used for cases)
    log('\nChecking quest templates...');
    const quests = collectFiles(QUESTS_DIR, '.json');
    for (const quest of quests) {
        const data = readJSON(quest);
        if (data) {
            validateCaseTemplate(quest, data);
            results.passed++;
        }
    }

    // Validate storylets
    log('\nChecking storylets...');
    const storylets = collectFiles(STORYLETS_DIR, '.json');
    for (const storylet of storylets) {
        const data = readJSON(storylet);
        if (data) {
            validateStorylet(storylet, data);
            results.passed++;
        }
    }

    // Check case generator
    log('\nChecking case generator...');
    const generatorFile = path.join(CAMPAIGN_DIR, 'case_generator.js');
    if (fileExists(generatorFile)) {
        const content = fs.readFileSync(generatorFile, 'utf8');
        if (content.includes('CaseGeneratorV2')) {
            log('CaseGeneratorV2 class found', 'info');
            results.passed++;
        } else {
            error(generatorFile, 'CaseGeneratorV2 class not found');
        }

        // Check for main generation methods
        const requiredMethods = ['generateMainCase', 'generateMinorCase', 'pickTemplate'];
        for (const method of requiredMethods) {
            if (content.includes(method)) {
                results.passed++;
            } else {
                warn(generatorFile, `Missing method: ${method}`);
            }
        }
    } else {
        error(generatorFile, 'Case generator file not found');
    }

    // Check dialogue system
    log('\nChecking dialogue system...');
    const dialogueFile = path.join(CAMPAIGN_DIR, 'dialogue.js');
    if (fileExists(dialogueFile)) {
        const content = fs.readFileSync(dialogueFile, 'utf8');
        if (content.includes('DialogueManager')) {
            log('DialogueManager class found', 'info');
            results.passed++;
        }

        const requiredMethods = ['startDialogue', 'resolveChoice', 'applyEffect'];
        for (const method of requiredMethods) {
            if (content.includes(method)) {
                results.passed++;
            }
        }
    } else {
        error(dialogueFile, 'Dialogue system file not found');
    }

    // Check news feed
    log('\nChecking news feed...');
    const newsFile = path.join(CAMPAIGN_DIR, 'news_feed.js');
    if (fileExists(newsFile)) {
        const content = fs.readFileSync(newsFile, 'utf8');
        if (content.includes('NewsFeed') && content.includes('BriefingSystem')) {
            log('NewsFeed and BriefingSystem classes found', 'info');
            results.passed++;
        }
    } else {
        error(newsFile, 'News feed file not found');
    }

    // Summary
    log('\n=============================');
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