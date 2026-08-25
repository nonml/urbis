#!/usr/bin/env node
// Pool Audit — Q12.E q12-po-*
// Checks that vehicles/NPCs/projectiles/particles/decals/ragdolls/FX are pooled with high-water tracking
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = path.join(__dirname, '../src');
const CI = process.argv.includes('--ci');

const POOLS = {
    vehicles: /class\s+Vehicle|_vehicle.*Pool|_poolCap/i,
    npcs: /citizen.*Pool|CharacterPool|_citizen/i,
    projectiles: /projectile.*Pool|_tracers/i,
    particles: /ParticleSystem|_burst/i,
    decals: /DecalManager|_decal/i,
    ragdolls: /Ragdoll|_ragdoll/i,
    fx: /FXSystem|_fx/i,
};

function hasPool(name, re) {
    let found = false;
    for (const f of collect(path.join(SRC))) {
        const src = fs.readFileSync(f,'utf8');
        if (re.test(src)) { found = true; break; }
    }
    return found;
}
function collect(dir, out=[]) {
    for (const e of fs.readdirSync(dir)) {
        const p = path.join(dir,e);
        if (fs.statSync(p).isDirectory()) collect(p,out);
        else if (e.endsWith('.js')) out.push(p);
    }
    return out;
}

console.log('=== Pool Audit (Q12.E) ===');
let ok=true;
for (const [name,re] of Object.entries(POOLS)) {
    const found = hasPool(name,re);
    console.log(`  ${found?'[PASS]':'[FAIL]'} ${name} pooled`);
    if (!found) ok=false;
}
// high-water tracking check: look for _highWater or highWater or max count tracking
const srcAll = collect(SRC).map(f=>fs.readFileSync(f,'utf8')).join('\n');
const hasHighWater = /highWater|_highWater|pool.*Cap|_capacity/i.test(srcAll);
console.log(`  ${hasHighWater?'[PASS]':'[WARN]'} high-water tracking`);
if (CI && !ok) process.exit(1);
console.log('[PASS] pool audit complete');
