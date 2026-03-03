#!/usr/bin/env node
/**
 * Content Completeness Validation Script
 *
 * Validates that content meets minimum targets for beta release:
 * - 3+ main campaign templates
 * - 30+ minor storylets
 * - 10+ operations
 * - 12+ policies
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

// Content targets for beta
const CONTENT_TARGETS = {
    cases: {
        label: 'Main Campaign Templates',
        min: 3,
        path: 'src/content/quests',
        pattern: '*.json'
    },
    storylets: {
        label: 'Minor Storylets',
        min: 30,
        path: 'src/content/storylets',
        pattern: '*.json'
    },
    operations: {
        label: 'Operations',
        min: 10,
        path: 'src/content/operations',
        pattern: '*.json'
    },
    policies: {
        label: 'Policies',
        min: 12,
        path: 'src/sim/politics/policies.js',
        pattern: null // JS file, count manually
    }
};

/**
 * Load JSON from file
 */
function loadJson(path) {
    try {
        if (!existsSync(path)) return null;
        const content = readFileSync(path, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        console.error(`Error loading ${path}:`, e.message);
        return null;
    }
}

/**
 * Count quest templates in directory
 */
function countQuests(directory) {
    const pattern = resolve(rootDir, directory, '*.json');
    const files = globSync(pattern);
    let count = 0;
    let errors = [];

    for (const file of files) {
        const data = loadJson(file);
        if (data && data.id) {
            count++;
        } else if (data) {
            errors.push({ file, reason: 'Missing id field' });
        }
    }

    return { count, errors };
}

/**
 * Count storylets in directory
 */
function countStorylets(directory) {
    const pattern = resolve(rootDir, directory, '*.json');
    const files = globSync(pattern);
    let count = 0;
    let errors = [];

    for (const file of files) {
        const data = loadJson(file);
        if (data && (data.id || data.storyletId)) {
            count++;
        } else if (data) {
            errors.push({ file, reason: 'Missing id field' });
        }
    }

    return { count, errors };
}

/**
 * Count operations in directory
 */
function countOperations(directory) {
    const pattern = resolve(rootDir, directory, '*.json');
    const files = globSync(pattern);
    let count = 0;
    let errors = [];

    for (const file of files) {
        const data = loadJson(file);
        if (data && (data.id || data.operationId)) {
            count++;
        } else if (data) {
            errors.push({ file, reason: 'Missing id field' });
        }
    }

    return { count, errors };
}

/**
 * Count policies in JS file
 */
function countPolicies(filePath) {
    try {
        const content = readFileSync(filePath, 'utf8');
        // Count POLICY_* definitions
        const matches = content.match(/POLICY_[A-Z_]+\s*=/g);
        return {
            count: matches ? matches.length : 0,
            errors: []
        };
    } catch (e) {
        return { count: 0, errors: [{ file: filePath, reason: e.message }] };
    }
}

/**
 * Validate policies file for required fields
 */
function validatePolicies(filePath) {
    const content = readFileSync(filePath, 'utf8');
    const errors = [];
    const policies = [];

    // Parse policy definitions
    const policyRegex = /POLICY_(\w+)\s*=\s*\{([^}]+)\}/g;
    let match;

    while ((match = policyRegex.exec(content)) !== null) {
        const policyName = match[1];
        const policyContent = match[0];

        // Check required fields
        const requiredFields = ['id', 'title', 'description', 'category', 'cost'];

        for (const field of requiredFields) {
            if (!policyContent.includes(`${field}:`)) {
                errors.push({
                    policy: policyName,
                    field: field,
                    message: `Missing required field: ${field}`
                });
            }
        }

        policies.push({ name: policyName, fields: requiredFields });
    }

    return { policies, errors };
}

/**
 * Validate cases for required fields
 */
function validateCases(questsDir) {
    const pattern = resolve(rootDir, questsDir, '*.json');
    const files = globSync(pattern);
    const errors = [];

    for (const file of files) {
        const data = loadJson(file);
        if (!data) continue;

        const requiredFields = ['id', 'title', 'description', 'chapters', 'outcomes'];
        const missing = requiredFields.filter(f => !data[f]);

        if (missing.length > 0) {
            errors.push({
                file,
                missing,
                message: `Missing fields: ${missing.join(', ')}`
            });
        }

        // Check chapters
        if (data.chapters && !Array.isArray(data.chapters)) {
            errors.push({
                file,
                missing: ['chapters'],
                message: 'chapters must be an array'
            });
        }
    }

    return errors;
}

/**
 * Validate storylets for required fields
 */
function validateStorylets(storyletsDir) {
    const pattern = resolve(rootDir, storyletsDir, '*.json');
    const files = globSync(pattern);
    const errors = [];

    for (const file of files) {
        const data = loadJson(file);
        if (!data) continue;

        const requiredFields = ['id', 'title', 'description', 'effects'];
        const missing = requiredFields.filter(f => !data[f]);

        if (missing.length > 0) {
            errors.push({
                file,
                missing,
                message: `Missing fields: ${missing.join(', ')}`
            });
        }
    }

    return errors;
}

/**
 * Main validation function
 */
function main() {
    console.log('=== Content Completeness Validation ===\n');

    const results = {
        cases: countQuests('src/content/quests'),
        storylets: countStorylets('src/content/storylets'),
        operations: countOperations('src/content/operations'),
        policies: countPolicies(resolve(rootDir, 'src/sim/politics/policies.js'))
    };

    let allPassed = true;
    let issues = [];

    // Report results
    for (const [key, data] of Object.entries(results)) {
        const target = CONTENT_TARGETS[key];
        const passed = data.count >= target.min;
        const status = passed ? '✅' : '❌';

        console.log(`${status} ${target.label}: ${data.count}/${target.min}`);

        if (!passed) {
            allPassed = false;
            issues.push({
                category: key,
                count: data.count,
                min: target.min,
                label: target.label
            });
        }

        if (data.errors?.length) {
            console.log(`   ⚠️  Validation errors: ${data.errors.length}`);
            data.errors.forEach(e => console.log(`      - ${e.file}: ${e.reason}`));
        }
    }

    // Detailed validation
    console.log('\n--- Detailed Validation ---\n');

    const caseErrors = validateCases('src/content/quests');
    if (caseErrors.length > 0) {
        console.log(`Cases with missing fields: ${caseErrors.length}`);
        caseErrors.slice(0, 5).forEach(e => {
            console.log(`   ${e.file}: ${e.message}`);
        });
        if (caseErrors.length > 5) {
            console.log(`   ... and ${caseErrors.length - 5} more`);
        }
        allPassed = false;
    } else {
        console.log('Cases: All required fields present');
    }

    const storyletErrors = validateStorylets('src/content/storylets');
    if (storyletErrors.length > 0) {
        console.log(`Storylets with missing fields: ${storyletErrors.length}`);
        storyletErrors.slice(0, 5).forEach(e => {
            console.log(`   ${e.file}: ${e.message}`);
        });
        if (storyletErrors.length > 5) {
            console.log(`   ... and ${storyletErrors.length - 5} more`);
        }
        allPassed = false;
    } else {
        console.log('Storylets: All required fields present');
    }

    const policyValidation = validatePolicies(resolve(rootDir, 'src/sim/politics/policies.js'));
    if (policyValidation.errors.length > 0) {
        console.log(`Policy validation errors: ${policyValidation.errors.length}`);
        policyValidation.errors.slice(0, 5).forEach(e => {
            console.log(`   ${e.policy}: ${e.message}`);
        });
        if (policyValidation.errors.length > 5) {
            console.log(`   ... and ${policyValidation.errors.length - 5} more`);
        }
        allPassed = false;
    } else {
        console.log(`Policies: ${policyValidation.policies.length} policies validated`);
    }

    // Summary
    console.log('\n=== Summary ===\n');

    if (allPassed) {
        console.log('✅ Content completeness targets met!');
        console.log('\nNext steps:');
        console.log('  - Run beta build: npm run build:beta');
        console.log('  - Test with multiple seeds');
        console.log('  - Verify onboarding flow');
    } else {
        console.log('❌ Content completeness targets NOT met.');
        console.log('\nIssues to fix:');
        issues.forEach(issue => {
            console.log(`  - ${issue.label}: ${issue.count}/${issue.min}`);
        });
        console.log('\nRun with --fix to auto-populate placeholder content.');
    }

    // Exit code
    process.exit(allPassed ? 0 : 1);
}

// Run if executed directly (check for CLI invocation)
if (import.meta.url && import.meta.url.startsWith('file://')) {
    const args = process.argv.slice(2);
    // Only run main if the script is invoked directly without a preceding module
    if (args.length === 0 || args[0] !== '--export-only') {
        main();
    }
}

// Export for programmatic use
export { main, CONTENT_TARGETS };