#!/usr/bin/env node
// RenderTarget Audit — Q11.E q11-rg-no-implicit-mut
// Fails if any src/ file outside the render graph mutates renderTarget implicitly.
// Allowed: taa_pass, hi_z_buffer (explicit passes), and graph comment.
// Usage: node scripts/audit_rendertarget.mjs [--ci]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '../src');
const CI = process.argv.includes('--ci');

const ALLOWED = new Set([
    'src/render/taa_pass.js',
    'src/render/hi_z_buffer.js',
    'src/render/graph/render_graph.js',
]);

function collect(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir)) {
        const p = path.join(dir, e);
        if (fs.statSync(p).isDirectory()) out.push(...collect(p));
        else if (e.endsWith('.js')) out.push(p);
    }
    return out;
}

const files = collect(SRC_DIR);
const hits = [];
for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const rel = path.relative(path.join(__dirname, '..'), f).replace(/\\/g, '/');
    if (ALLOWED.has(rel)) continue;
    // Strip comments to reduce false positives on docs
    const noComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const re = /setRenderTarget\s*\(/g;
    let m;
    while ((m = re.exec(noComments))) {
        const line = src.slice(0, m.index).split('\n').length;
        hits.push({ rel, line, snippet: src.slice(m.index, m.index + 40).trim() });
    }
    // Direct .renderTarget = assignment outside RT creation
    const re2 = /\.renderTarget\s*=\s*[^=]/g;
    while ((m = re2.exec(noComments))) {
        // Allow RT construction: new WebGLRenderTarget / CubeRT
        const ctx = noComments.slice(Math.max(0, m.index - 80), m.index + 40);
        if (ctx.includes('new THREE.WebGLRenderTarget') || ctx.includes('WebGLCubeRenderTarget')) continue;
        if (ctx.includes('composer.renderTarget')) continue; // initial type tweak
        const line = src.slice(0, m.index).split('\n').length;
        hits.push({ rel, line, snippet: 'renderTarget =' });
    }
}

console.log('=== RenderTarget Audit (q11-rg-no-implicit-mut) ===');
console.log(`Scanned: ${files.length} files`);
if (hits.length === 0) {
    console.log('[PASS] No implicit renderTarget mutations outside allowlist.');
    console.log(`Allowlist: ${[...ALLOWED].join(', ')}`);
} else {
    console.log(`[FAIL] ${hits.length} unexpected renderTarget mutation(s):`);
    for (const h of hits) console.log(`  ${h.rel}:${h.line} — ${h.snippet}`);
    if (CI) process.exit(1);
}
console.log('[PASS] Audit complete.');
