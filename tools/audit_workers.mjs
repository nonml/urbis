#!/usr/bin/env node
// Q12.A Web Worker Audit — q12-wk-pathfind-worker .. q12-wk-asset-decoder
// Verifies all 6 workers exist, are wired via worker_pool, and that
// pathfinding is fully worker-only when the worker is active (no sync block).
//
// Usage:
//   node tools/audit_workers.mjs          human report
//   node tools/audit_workers.mjs --ci     exit 1 on missing wiring
//   node tools/audit_workers.mjs --json   machine JSON

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const CI = process.argv.includes('--ci');
const JSON_OUT = process.argv.includes('--json');

const EXPECTED_WORKERS = [
    'src/workers/pathfinding_worker.js',
    'src/workers/schedule_worker.js',
    'src/workers/citizen_worker.js',
    'src/workers/faction_worker.js',
    'src/workers/audio_worker.js',
    'src/workers/save_worker.js',
    'src/workers/asset_decoder_worker.js',
];

function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function read(rel) { try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch { return ''; } }

const findings = [];
const passes = [];

function check(label, ok, detail) {
    if (ok) passes.push(label);
    else findings.push({ label, detail });
}

// 1. Files exist
for (const w of EXPECTED_WORKERS) {
    check(`worker file ${w}`, exists(w), `missing ${w}`);
}

// 2. Worker_pool wiring
const pool = read('src/workers/worker_pool.js');
check('worker_pool exports getFactionWorker', pool.includes('getFactionWorker'), 'worker_pool missing faction');
check('worker_pool exports getAudioWorker', pool.includes('getAudioWorker'), 'missing audio');
check('worker_pool exports getSaveWorker', pool.includes('getSaveWorker'), 'missing save');
check('worker_pool exports getAssetWorker', pool.includes('getAssetWorker'), 'missing asset');
check('worker_pool exports getScheduleWorker', pool.includes('getScheduleWorker'), 'missing schedule');
check('worker_pool exports getPathfindingWorkerRef', pool.includes('getPathfindingWorkerRef'), 'missing pathfinding ref');
check('worker_pool has tickFactionsViaWorker', pool.includes('tickFactionsViaWorker'), 'missing tickFactionsViaWorker');
check('worker_pool has serializeSaveViaWorker', pool.includes('serializeSaveViaWorker'), 'missing serializeSaveViaWorker');
check('worker_pool has decodeAssetViaWorker', pool.includes('decodeAssetViaWorker'), 'missing decodeAssetViaWorker');
check('worker_pool has requestScheduleTargetViaWorker', pool.includes('requestScheduleTargetViaWorker'), 'missing schedule request');

// 3. PathfindingProxy fully worker — worker owns the grid, no SAB, no main-thread rebuild
const proxy = read('src/sim/nav/pathfinding_proxy.js');
const worker = read('src/workers/pathfinding_worker.js');
check('pathfinding_proxy has isWorkerActive()', proxy.includes('isWorkerActive'), 'missing isWorkerActive()');
check('pathfinding_proxy spawns new Worker', proxy.includes('new Worker('), 'missing new Worker spawn');
check('proxy sends INIT with terrain', proxy.includes("type: 'INIT'") && proxy.includes('terrain'), 'proxy missing terrain INIT');
check('proxy flushes blocked tiles via UPDATE', proxy.includes("type: 'UPDATE'") && proxy.includes('blocked'), 'proxy missing blocked UPDATE');
check('proxy has no main-thread grid rebuild', !proxy.includes('_buildWalkability'), 'proxy still builds walkability grid on main thread');
check('proxy has no SAB dependency', !proxy.includes('new SharedArrayBuffer('), 'proxy still depends on SharedArrayBuffer (fails without COOP/COEP headers)');
check('proxy guards stale results by epoch', proxy.includes('_epoch'), 'proxy missing epoch guard');
check('proxy caches no-path results', proxy.includes('_noPath'), 'proxy missing no-path cache');
check('worker exports buildGrid (owns grid)', worker.includes('export function buildGrid'), 'worker does not build its own grid');
check('worker exports solveWalkable (pure A*)', worker.includes('export function solveWalkable'), 'worker missing pure A* core');
check('worker applies blocked in UPDATE', worker.includes('e.data.blocked'), 'worker ignores blocked updates');
check('worker has FIND handler', worker.includes("type === 'FIND'"), 'worker missing FIND handler');

// 4. ScheduleManager worker-only when active (no sync block)
const sched = read('src/sim/schedule.js');
check('schedule uses pfProxy.isWorkerActive()', sched.includes('pfProxy.isWorkerActive') || sched.includes('pfProxy?.isWorkerActive'), 'schedule not checking pfProxy isWorkerActive');
check('schedule stalls on worker cache miss (no sync)', sched.includes('prefetch(citizen.id, start, target)') && sched.includes('isWorkerActive'), 'schedule missing worker-only stall path');
check('schedule retains sync fallback for headless', sched.includes('Sync NavGrid fallback') || sched.includes('fallback'), 'schedule missing fallback comment/path');
check('schedule has isSchedWorkerActive()', sched.includes('isSchedWorkerActive'), 'schedule missing isSchedWorkerActive');
check('schedule has schedule_worker wiring', sched.includes('schedule_worker.js') && sched.includes('_schedWorker'), 'schedule missing schedule_worker wiring');
check('schedule has _consumeSchedTarget cache', sched.includes('_consumeSchedTarget'), 'schedule missing _consumeSchedTarget');
check('schedule has _prefetchSchedTarget', sched.includes('_prefetchSchedTarget'), 'schedule missing _prefetchSchedTarget');
check('schedule handles UPDATE_BUILDINGS in worker', sched.includes('UPDATE_BUILDINGS'), 'schedule missing UPDATE_BUILDINGS push');
check('schedule_worker has FIND_TARGET handler', read('src/workers/schedule_worker.js').includes('FIND_TARGET'), 'schedule_worker missing FIND_TARGET');
check('schedule_worker has UPDATE_BUILDINGS', read('src/workers/schedule_worker.js').includes('UPDATE_BUILDINGS'), 'schedule_worker missing UPDATE_BUILDINGS');
const schedWorker = read('src/workers/schedule_worker.js');
check('schedule_worker exports pure target core', schedWorker.includes('export function getTargetLocation'), 'schedule_worker target logic not exportable/testable');
check('schedule_worker self-guarded handler', schedWorker.includes("typeof self !== 'undefined'"), 'schedule_worker handler not import-safe in Node');
check('schedule_worker mirrors main at-tile fallback', schedWorker.includes('|| at[0]'), 'schedule_worker findNearestBuilding diverges from main thread');

// 5. CitizenSim uses citizen_worker
const citizenSim = read('src/sim/citizens/citizen_sim.js');
check('citizen_sim imports citizen_worker', citizenSim.includes('citizen_worker'), 'citizen_sim not using citizen_worker');
check('citizen_sim dispatches to worker', citizenSim.includes('_dispatchToWorker') && citizenSim.includes('UPDATE_CITIZENS'), 'citizen_sim missing dispatch');

// 6. Faction/audio/save/asset workers have protocol
check('faction_worker PROTOCOL TICK', read('src/workers/faction_worker.js').includes("type === 'TICK'") || read('src/workers/faction_worker.js').includes('TICK'), 'faction_worker missing TICK');
check('faction_system has isWorkerActive()', read('src/sim/factions/faction_system.js').includes('isWorkerActive'), 'faction_system missing isWorkerActive');
check('faction_system dispatches TICK to worker', read('src/sim/factions/faction_system.js').includes("_dispatchWorker") && read('src/sim/factions/faction_system.js').includes("type: 'TICK'"), 'faction_system missing dispatch');
check('faction_system applies pending worker result', read('src/sim/factions/faction_system.js').includes('_applyPendingWorkerResult'), 'faction_system missing apply pending');
check('faction_system has sync fallback drift', read('src/sim/factions/faction_system.js').includes('Sync fallback') || read('src/sim/factions/faction_system.js').includes('drift'), 'faction_system missing fallback drift');
check('audio_worker PROTOCOL PLAY/DUCK', read('src/workers/audio_worker.js').includes('PLAY') && read('src/workers/audio_worker.js').includes('DUCK'), 'audio_worker missing PLAY/DUCK');
check('save_worker PROTOCOL SERIALIZE', read('src/workers/save_worker.js').includes('SERIALIZE'), 'save_worker missing SERIALIZE');
check('asset_decoder PROTOCOL DECODE', read('src/workers/asset_decoder_worker.js').includes('DECODE'), 'asset_decoder missing DECODE');

if (JSON_OUT) {
    console.log(JSON.stringify({ passes, findings, ok: findings.length === 0 }, null, 2));
    process.exit(findings.length ? 1 : 0);
}

console.log('=== Worker Audit (Q12.A — 6+1 workers) ===');
console.log(`Passes: ${passes.length}  Failures: ${findings.length}`);
for (const p of passes) console.log(`  [PASS] ${p}`);
if (findings.length) {
    for (const f of findings) console.log(`  [FAIL] ${f.label} — ${f.detail}`);
}
if (findings.length === 0) console.log('[PASS] all workers wired, pathfinding + schedule fully on worker when active');
else console.log(`[FAIL] ${findings.length} worker audit failure(s)`);

if (CI && findings.length) process.exit(1);
process.exit(0);
