#!/usr/bin/env node
/**
 * Deterministic scenario runner — headless "consequence cascade" prover.
 *
 * Usage:
 *   node scripts/scenario.mjs <scenario.json>     # run a scenario file
 *   node scripts/scenario.mjs                      # run the built-in demo
 *   node scripts/scenario.mjs <scenario.json> --json   # machine-readable only
 *
 * A scenario is a JSON file:
 *   {
 *     "name": "blackout ripples",
 *     "seed": 12345,
 *     "mapPreset": "CITY",        // SMALL | CITY | MEGA
 *     "mode": "standard",          // standard | sandbox
 *     "steps": [ { "op": "...", ... }, ... ]
 *   }
 *
 * Supported ops (each maps to a real headless Game method — see src/headless_game.js):
 *   { "op": "ticks",     "n": 10 }
 *   { "op": "build",     "type": "house", "x": 12, "y": 12, "rotation": 0 }
 *   { "op": "hack",      "nodeIndex": 0, "success": true }
 *   { "op": "hack",      "nodeType": "POWER_SUBSTATION", "success": true }
 *   { "op": "spawnCase", "type": "missing_person" }
 *   { "op": "setHeat",   "value": 60 }
 *   { "op": "modifyRep", "faction": "police", "delta": -15 }
 *
 * The runner snapshots world state before and after, then prints a diff so the
 * agent can answer the only question that matters: did the world remember what
 * you did? Same seed + same steps => same diff, every time.
 */

import { readFileSync } from 'fs';
import { Game } from '../src/headless_game.js';

// Suppress Worker-not-defined rejections from PathfindingProxy in headless Node.
process.on('unhandledRejection', (reason) => {
    if (reason instanceof ReferenceError && /Worker/.test(reason.message)) return;
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});

const DEMO_SCENARIO = {
    name: 'demo: blackout + failed breach ripples',
    seed: 130130,
    mapPreset: 'CITY',
    mode: 'standard',
    steps: [
        { op: 'ticks', n: 3 },
        { op: 'hack', nodeType: 'POWER_SUBSTATION', success: true },
        { op: 'hack', nodeIndex: 0, success: false },
        { op: 'ticks', n: 5 },
    ],
};

/** Capture the world-state fields that prove consequence and memory. */
function snapshot(game) {
    const s = game.state;
    const world = s.world || {};
    return {
        tick: s.time.tick,
        day: game.getDay(),
        gold: s.resources.gold,
        food: s.resources.food,
        wood: s.resources.wood,
        population: s.resources.population,
        buildings: game.buildings.buildings.length,
        heat: s.player.heat || 0,
        heatState: s.player.heatState || 'calm',
        rep: { ...(s.factions?.reputation || {}) },
        blackouts: (world.blackouts || []).length,
        trafficSwitches: (world.trafficSwitches || []).length,
        unlockedDoors: (world.unlockedDoors || []).length,
        anomalies: (world.anomalies || []).length,
        factionEncounters: (world.factionEncounters || []).length,
        casesActive: (s.cases?.active || []).length,
        casesCompleted: (s.cases?.completed || []).length,
    };
}

/** Shallow diff of two snapshots; nested rep objects compared per-faction. */
function diff(before, after) {
    const out = {};
    for (const key of Object.keys(after)) {
        const a = before[key];
        const b = after[key];
        if (key === 'rep') {
            const repDelta = {};
            for (const f of Object.keys(b)) {
                if ((a?.[f] ?? 0) !== b[f]) repDelta[f] = { from: a?.[f] ?? 0, to: b[f] };
            }
            if (Object.keys(repDelta).length) out.rep = repDelta;
            continue;
        }
        if (a !== b) out[key] = { from: a, to: b };
    }
    return out;
}

function findNode(game, step) {
    const nodes = game.interactables.interactables;
    if (typeof step.nodeIndex === 'number') return nodes[step.nodeIndex] || null;
    if (step.nodeType) return nodes.find((n) => n.type === step.nodeType) || null;
    return nodes[0] || null;
}

function applyStep(game, step) {
    switch (step.op) {
        case 'ticks':
            game.runTicks(step.n ?? 1);
            return { op: 'ticks', n: step.n ?? 1, ok: true };
        case 'build': {
            const r = game.attemptBuild(step.type, step.x, step.y, { rotation: step.rotation ?? 0 });
            return { op: 'build', type: step.type, ok: r.ok, reason: r.reason };
        }
        case 'hack': {
            const node = findNode(game, step);
            if (!node) return { op: 'hack', ok: false, reason: 'no matching node' };
            const r = game.executeHack(node, step.success !== false);
            return { op: 'hack', nodeType: node.type, success: step.success !== false, ok: r.ok, action: r.action, reason: r.reason };
        }
        case 'spawnCase': {
            const c = game.spawnCase(step.type, step.options || {});
            return { op: 'spawnCase', type: step.type, ok: !!c };
        }
        case 'setHeat':
            game.heatSystem.setHeat(step.value ?? 0);
            return { op: 'setHeat', value: step.value ?? 0, ok: true };
        case 'modifyRep':
            game.factionSystem.modifyRep(step.faction, step.delta ?? 0, 'scenario', 'scenario');
            return { op: 'modifyRep', faction: step.faction, delta: step.delta ?? 0, ok: true };
        default:
            return { op: step.op, ok: false, reason: 'unknown op' };
    }
}

function runScenario(scenario) {
    const game = new Game({
        mapPreset: scenario.mapPreset || 'CITY',
        seed: scenario.seed ?? 12345,
        mode: scenario.mode || 'standard',
    });
    game.init();

    const before = snapshot(game);
    const stepResults = (scenario.steps || []).map((step) => applyStep(game, step));
    const after = snapshot(game);

    return { before, after, delta: diff(before, after), stepResults };
}

// --- entry point ---
const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const file = args.find((a) => !a.startsWith('--'));

const scenario = file
    ? JSON.parse(readFileSync(file, 'utf8'))
    : DEMO_SCENARIO;

const result = runScenario(scenario);
const report = { scenario: scenario.name || file || 'demo', seed: scenario.seed, ...result };

if (jsonOnly) {
    console.log(JSON.stringify(report, null, 2));
} else {
    console.log('='.repeat(60));
    console.log(`Scenario: ${report.scenario}  (seed ${report.seed})`);
    console.log('='.repeat(60));
    report.stepResults.forEach((r, i) => console.log(`  step ${i}: ${JSON.stringify(r)}`));
    console.log('\nWorld delta (what the world remembers):');
    const changed = Object.keys(report.delta);
    if (changed.length === 0) {
        console.log('  ⚠ nothing changed — no consequence cascade detected');
    } else {
        console.log(JSON.stringify(report.delta, null, 2));
    }
    console.log('='.repeat(60));
}
