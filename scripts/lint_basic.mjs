#!/usr/bin/env node
// Basic Lint Script (P-02)
// Runs basic code quality checks on source files
// Usage: node scripts/lint_basic.mjs [--quiet]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUIET = process.argv.includes('--quiet');

const SRC_DIR = path.join(__dirname, '../src');

// Severity levels
const SEVERITY = {
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
};

// Validation results
const results = {
    errors: [],
    warnings: [],
    passed: 0
};

/**
 * Log a message
 */
function log(message, type = SEVERITY.INFO) {
    if (QUIET && type === SEVERITY.INFO) return;
    const prefix = type === SEVERITY.ERROR ? '\u001b[31mERROR\u001b[0m' :
                   type === SEVERITY.WARNING ? '\u001b[33mWARN\u001b[0m' : '\u001b[32mOK\u001b[0m';
    console.log(`${prefix}: ${message}`);
}

/**
 * Log an error
 */
function error(file, message) {
    results.errors.push({ file, message });
    log(`${file}: ${message}`, SEVERITY.ERROR);
}

/**
 * Log a warning
 */
function warn(file, message) {
    results.warnings.push({ file, message });
    log(`${file}: ${message}`, SEVERITY.WARNING);
}

/**
 * Recursively collect all JS files in a directory
 */
function collectJSFiles(dir, pattern = null) {
    const files = [];
    if (!fs.existsSync(dir)) {
        return files;
    }

    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            files.push(...collectJSFiles(fullPath, pattern));
        } else if (!pattern || item.endsWith(pattern)) {
            files.push(fullPath);
        }
    }

    return files;
}

// ==================== Lint Rules ====================

/**
 * Check for console.log in production code
 */
function checkConsoleLog(file, content) {
    // Skip dev files and test files
    if (file.includes('/dev/') || file.includes('/test/') || file.endsWith('_test.js')) {
        return;
    }

    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        // Allow console.log in dev-only contexts
        if (line.includes('console.log') && !line.includes('console.log(`[Dev]')) {
            warn(file, `console.log at line ${idx + 1}`);
        }
    });
}

/**
 * Check for console.error/warn in production code
 */
function checkConsoleErrors(file, content) {
    if (file.includes('/dev/') || file.includes('/test/')) {
        return;
    }

    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('console.error') || line.includes('console.warn')) {
            warn(file, `console.error/warn at line ${idx + 1}`);
        }
    });
}

/**
 * Check for TODO comments
 */
function checkTODOs(file, content) {
    const lines = content.split('\n');
    let todoCount = 0;
    const todos = [];

    lines.forEach((line, idx) => {
        if (line.includes('TODO') || line.includes('FIXME')) {
            todoCount++;
            // Extract the TODO comment
            const match = line.match(/\/\/\s*(TODO|FIXME):?\s*(.*)/);
            if (match) {
                todos.push({ line: idx + 1, comment: match[2] });
            }
        }
    });

    if (todoCount > 10) {
        error(file, `Contains ${todoCount} TODO/FIXME comments`);
    } else if (todoCount > 0) {
        // Just note them for visibility
        results.warnings.push({ file, message: `${todoCount} TODO/FIXME comments` });
    }
}

/**
 * Check for Math.random() usage
 */
function checkMathRandom(file, content) {
    // Skip dev files
    if (file.includes('/dev/') || file.includes('/test/')) {
        return;
    }

    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.includes('Math.random()')) {
            error(file, `Math.random() usage at line ${idx + 1} - use RNG instead`);
        }
    });
}

/**
 * Check for duplicate code patterns
 */
function checkDuplicatePatterns(file, content) {
    // Check for overly long lines (max 120 chars)
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
        if (line.length > 120) {
            warn(file, `Line ${idx + 1} exceeds 120 characters (${line.length})`);
        }
    });
}

/**
 * Check for missing exports
 */
function checkExports(file, content) {
    // Skip test files
    if (file.endsWith('_test.js')) {
        return;
    }

    // Check for default exports in JS files
    if (content.includes('export default') || content.includes('export {') || content.includes('export ')) {
        results.passed++;
    }
}

/**
 * Check for proper file naming conventions
 */
function checkFileNaming(file) {
    const basename = path.basename(file);

    // JS files should be snake_case or camelCase
    if (basename.includes(' ') || basename.includes('-') && basename.endsWith('.js')) {
        warn(file, 'File name contains spaces or hyphens');
    }

    // Test files should end with _test.js
    if (basename.includes('test') && !basename.endsWith('_test.js')) {
        warn(file, 'Test file should end with _test.js');
    }
}

// ==================== Main Lint ====================

/**
 * Main lint check
 */
function main() {
    log('Basic Lint Check');
    log('================');

    const files = collectJSFiles(SRC_DIR, '.js');

    for (const file of files) {
        const basename = path.basename(file);

        // Check file naming
        checkFileNaming(file);

        // Read file content
        let content;
        try {
            content = fs.readFileSync(file, 'utf8');
        } catch (e) {
            error(file, `Failed to read: ${e.message}`);
            continue;
        }

        // Apply lint rules
        checkConsoleLog(file, content);
        checkConsoleErrors(file, content);
        checkTODOs(file, content);
        checkMathRandom(file, content);
        checkDuplicatePatterns(file, content);
        checkExports(file, content);
    }

    // Summary
    log('\n================');
    log('\nLint Summary:');
    log(`  Passed checks: ${results.passed}`);
    log(`  Errors: ${results.errors.length}`);
    log(`  Warnings: ${results.warnings.length}`);

    if (results.errors.length > 0) {
        log('\nSome errors were found. Please fix them before continuing.', SEVERITY.ERROR);
        process.exit(1);
    } else if (results.warnings.length > 0) {
        log('\nLint completed with warnings.', SEVERITY.WARNING);
        process.exit(0);
    } else {
        log('\nLint completed successfully!', SEVERITY.INFO);
        process.exit(0);
    }
}

// Run lint
main();