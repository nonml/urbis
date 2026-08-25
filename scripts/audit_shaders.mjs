#!/usr/bin/env node
// Shader Uber-Audit — Q11.E q11-sh-uber-audit
// Counts shader permutations (onBeforeCompile injections, ShaderMaterial
// definitions, flag-defines) and fails if obvious collapse opportunities remain.
// Usage: node scripts/audit_shaders.mjs [--ci]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '../src');
const CI_MODE = process.argv.includes('--ci');

function collectJS(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir)) {
        const p = path.join(dir, e);
        if (fs.statSync(p).isDirectory()) out.push(...collectJS(p));
        else if (e.endsWith('.js')) out.push(p);
    }
    return out;
}

const files = collectJS(SRC_DIR);
let onBefore = 0;
let shaderMat = 0;
let defines = 0;
const details = [];

for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(path.join(__dirname, '..'), f).replace(/\\/g, '/');
    const ob = (src.match(/onBeforeCompile/g) || []).length;
    const sm = (src.match(/new\s+(?:THREE\.)?ShaderMaterial/g) || []).length;
    const df = (src.match(/\.defines\s*\[|\#define|\.define\b/g) || []).length;
    if (ob || sm) {
        details.push({ rel, ob, sm, df });
        onBefore += ob;
        shaderMat += sm;
        defines += df;
    }
}

console.log('=== Shader Uber Audit (q11-sh-uber-audit) ===');
console.log(`Scanned: ${files.length} files`);
console.log(`onBeforeCompile injections: ${onBefore}`);
console.log(`ShaderMaterial instances:   ${shaderMat}`);
console.log(`define usages:              ${defines}`);
console.log('');
for (const d of details) {
    console.log(`  ${d.rel} — onBefore:${d.ob} shaderMat:${d.sm} defines:${d.df}`);
}
console.log('');

// Heuristic: >12 onBeforeCompile sites is a collapse candidate
const budget = 12;
if (onBefore > budget) {
    console.log(`[WARN] ${onBefore} onBeforeCompile sites > ${budget} — consider collapsing flag-defines into RenderGraph passes.`);
    if (CI_MODE) process.exit(1);
} else {
    console.log(`[PASS] onBeforeCompile count within budget (${onBefore} <= ${budget}).`);
}
if (CI_MODE && shaderMat > 18) {
    console.log(`[FAIL] ShaderMaterial count ${shaderMat} > 18`);
    process.exit(1);
}
console.log('[PASS] Shader audit complete.');
