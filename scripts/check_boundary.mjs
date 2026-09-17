#!/usr/bin/env node
// Enforces the sim/render boundary: src/sim/ is pure logic, zero three.js.
// Usage: node scripts/check_boundary.mjs [--quiet]
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

const QUIET = process.argv.includes('--quiet');
const SIM_DIR = new URL('../src/sim/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const BANNED = [
    { re: /^\s*import\s[^;]*from\s+['"]three(\/[^'"]*)?['"]/m, msg: "imports 'three'" },
    { re: /\bnew\s+THREE\./, msg: 'constructs a THREE object' },
    { re: /\bdocument\./, msg: 'touches the DOM' },
];

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        return path.endsWith('.js') ? [path] : [];
    });
}

const violations = [];
for (const file of walk(SIM_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const { re, msg } of BANNED) {
        const match = re.exec(source);
        if (!match) continue;
        const line = source.slice(0, match.index).split('\n').length;
        violations.push(`sim/${relative(SIM_DIR, file).split(sep).join('/')}:${line} ${msg}`);
    }
}

if (violations.length) {
    console.error(`boundary FAILED (${violations.length}):\n- ${violations.join('\n- ')}`);
    console.error('\nsrc/sim/ must stay renderer-agnostic. Move rendering into src/render/.');
    process.exit(1);
}
if (!QUIET) console.log('boundary OK — src/sim/ is free of three.js and DOM');
