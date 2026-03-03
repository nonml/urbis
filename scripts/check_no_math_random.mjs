#!/usr/bin/env node
// Check for Math.random() usage in source files
// Usage: node scripts/check_no_math_random.mjs [--quiet]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const QUIET = process.argv.includes('--quiet');

const SRC_DIR = path.join(__dirname, '../src');

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

/**
 * Main check
 */
function main() {
    log('Checking for Math.random() usage...');

    const files = collectJSFiles(SRC_DIR, '.js');
    let found = 0;
    const foundFiles = [];

    for (const file of files) {
        // Skip dev and test files
        if (file.includes('/dev/') || file.includes('/test/') || file.endsWith('_test.js')) {
            continue;
        }

        try {
            const content = fs.readFileSync(file, 'utf8');
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (line.includes('Math.random()')) {
                    const trimmed = line.trim();
                    if (!trimmed.includes('?') && !trimmed.includes('??')) {
                        found++;
                        foundFiles.push(`${file}:${i + 1}`);
                    }
                }
            }
        } catch (e) {
            // Skip files that can't be read
        }
    }

    if (found === 0) {
        log('No Math.random() usage found in src/ (excluding dev and test)', 'info');
        process.exit(0);
    } else {
        log(`Found Math.random() in ${found} file(s):`, 'error');
        foundFiles.forEach(file => log(`  ${file.replace(path.join(__dirname, '..'), '')}`));
        process.exit(1);
    }
}

// Run check
main();