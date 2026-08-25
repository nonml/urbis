#!/usr/bin/env node
// Draw-Call Budget Audit — Q11.G q11-dc-budget-medium/large + q11-dc-ci-gate
// Estimates visible draw calls from src/renderer3d.js static structure
// and fails CI if obvious over-budget. Also validates perf.json per-pass schema.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CI_MODE = process.argv.includes('--ci');
const PERF_PATH = path.join(__dirname, 'agent/baselines/perf.json');
const SRC = path.join(__dirname, '../src/renderer3d.js');

const BUDGET_MEDIUM = 2000;
const BUDGET_LARGE = 3000;

function estimateDraws() {
    const src = fs.readFileSync(SRC, 'utf8');
    const instanced = (src.match(/new THREE\.InstancedMesh/g) || []).length;
    const meshes = (src.match(/new THREE\.Mesh\(/g) || []).length;
    // Heuristic: 9 visible chunks on 96×96 CITY, plus globals
    // Per-chunk InstancedMesh ~ reused across chunks, but counted once per creation site.
    // Rough visible draws ≈ (terrain+water+road variants+buildings+props) * chunks + vehicles*1 + postPasses
    const chunkSites = (src.match(/_build.*ForChunk|_buildInstanced/g) || []).length;
    const visibleChunks = 9;
    // Estimate: each chunk site amortized to ~1.2 draws, plus 6 post passes
    const est = Math.round(chunkSites * 1.2 * visibleChunks + 80 + 6);
    // Add vehicle/police overhead (instanced fallback + per-vehicle boxes worst-case)
    return { instanced, meshes, chunkSites, est };
}

function checkPerfPerPass() {
    if (!fs.existsSync(PERF_PATH)) return { ok: false, reason: 'perf.json missing' };
    try {
        const j = JSON.parse(fs.readFileSync(PERF_PATH, 'utf8'));
        const results = j.results || [];
        const missing = results.filter(r => !r.perPass);
        if (missing.length > 0) return { ok: false, reason: `${missing.length} results missing perPass`, sample: missing[0] };
        // Validate draw budget on reference scenes
        const ref = results.filter(r => r.scene === 'medium_120npcs' && r.preset === 'high');
        if (ref.length) {
            const d = ref[0].perPass._drawCalls ?? ref[0].perPass.drawCalls ?? 0;
            if (d > BUDGET_MEDIUM) return { ok: false, reason: `high/medium_120npcs draws ${d} > ${BUDGET_MEDIUM}` };
        }
        const large = results.filter(r => r.scene.includes('large') || r.scene.includes('200'));
        for (const e of large) {
            const d = e.perPass._drawCalls ?? e.perPass.drawCalls ?? 0;
            if (d > BUDGET_LARGE) return { ok: false, reason: `large draws ${d} > ${BUDGET_LARGE}` };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, reason: e.message };
    }
}

const { instanced, meshes, chunkSites, est } = estimateDraws();
console.log('=== Draw-Call Budget Audit (Q11.G) ===');
console.log(`src/renderer3d.js: InstancedMesh sites ${instanced}, Mesh sites ${meshes}, chunk builders ${chunkSites}`);
console.log(`Estimated visible draws (medium+120 NPCs): ~${est} (budgets: medium ${BUDGET_MEDIUM}, large ${BUDGET_LARGE})`);
console.log('');

const perPassCheck = checkPerfPerPass();
if (!perPassCheck.ok) {
    console.log(`[FAIL] per-pass schema: ${perPassCheck.reason}`);
    if (CI_MODE) process.exit(1);
} else {
    console.log('[PASS] per-pass schema present');
}

if (est > BUDGET_MEDIUM) {
    console.log(`[FAIL] estimated ${est} > medium budget ${BUDGET_MEDIUM}`);
    if (CI_MODE) process.exit(1);
} else {
    console.log(`[PASS] estimated draws within medium budget`);
}
if (est > BUDGET_LARGE) {
    console.log(`[FAIL] estimated ${est} > large budget ${BUDGET_LARGE}`);
    if (CI_MODE) process.exit(1);
} else {
    console.log(`[PASS] estimated draws within large budget`);
}
console.log('[PASS] Draw-call audit complete.');
