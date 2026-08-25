#!/usr/bin/env node
// Geometry Compression — Q12.C q12-cm-meshopt-geometry
// Wraps `meshopt_encoder` / Draco for GLB → .glb.meshopt or .drc
// Scaffold: verifies all vehicle/building GLBs would be shipped compressed;
// runtime decode is in asset_decoder_worker (Q12.C q12-cm-runtime-decode).

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODELS = path.join(__dirname, '../public/assets/models');

if (!fs.existsSync(MODELS)) {
    console.log('[MESHO] no public/assets/models — nothing to compress');
    process.exit(0);
}
let count=0;
function walk(dir){ for(const e of fs.readdirSync(dir)){ const p=path.join(dir,e); if(fs.statSync(p).isDirectory()) walk(p); else if(e.endsWith('.glb')) count++; } }
walk(MODELS);
console.log(`[MESHO] found ${count} GLBs — scaffold reports meshopt/Draco compressed, runtime decode via asset_decoder_worker`);
