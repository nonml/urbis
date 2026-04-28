#!/usr/bin/env node
/**
 * Cinematic Camera Shot Preview CLI
 *
 * Usage:
 *   node tools/preview_shot.mjs <path-to-script.json> [--samples=N]
 *
 * Loads a camera script, validates it, then samples poses across the
 * total duration so a human can eyeball the path before wiring it into
 * a mission.  Anchors are resolved to a stub `[0,0,0]` so the CLI is
 * usable without a running game.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { validateCameraScript, totalDuration } from '../src/render/cinematic/script_schema.js';
import { CameraScriptPlayer } from '../src/render/cinematic/script_player.js';

const STUB_ANCHOR = { pos: [0, 0, 0], lookAt: [1, 0, 0] };

function fmtVec(v) {
    return `[${v.map(n => n.toFixed(2).padStart(7)).join(', ')}]`;
}

export function previewScript(script, opts = {}) {
    const samples = Math.max(2, opts.samples ?? 20);
    const lines = [];
    const v = validateCameraScript(script);
    if (!v.valid) {
        lines.push(`✗ Invalid camera script:`);
        for (const err of v.errors) lines.push(`  - ${err}`);
        return { ok: false, output: lines.join('\n') };
    }
    const total = totalDuration(script);
    lines.push(`Camera Script: ${script.name} (${script.id})`);
    if (script.description) lines.push(`  ${script.description}`);
    lines.push(`Shots: ${script.shots.length}, total duration: ${total.toFixed(2)}s`);
    lines.push(`Sampling ${samples} frames:`);

    const player = new CameraScriptPlayer(script, () => STUB_ANCHOR);
    player.start();
    const step = total / (samples - 1);
    let elapsed = 0;
    for (let i = 0; i < samples; i++) {
        if (i > 0) player.update(step);
        elapsed = Math.min(total, i * step);
        const pose = player.getPose();
        lines.push(
            `  t=${elapsed.toFixed(2).padStart(5)}s  shot=${player.currentShotIndex}  ` +
            `pos=${fmtVec(pose.pos)}  lookAt=${fmtVec(pose.lookAt)}  fov=${pose.fov.toFixed(1)}`
        );
    }
    lines.push(`✓ Valid`);
    return { ok: true, output: lines.join('\n') };
}

function parseArgs(argv) {
    const args = { path: null, samples: 20 };
    for (const a of argv) {
        if (a.startsWith('--samples=')) {
            const n = parseInt(a.slice('--samples='.length), 10);
            if (Number.isFinite(n) && n >= 2) args.samples = n;
        } else if (!a.startsWith('--') && !args.path) {
            args.path = a;
        }
    }
    return args;
}

function main() {
    const argv = process.argv.slice(2);
    if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
        console.log('Usage: node tools/preview_shot.mjs <path-to-script.json> [--samples=N]');
        process.exit(argv.length === 0 ? 1 : 0);
    }
    const args = parseArgs(argv);
    if (!args.path) {
        console.error('Error: missing script path');
        process.exit(1);
    }
    let script;
    try {
        script = JSON.parse(readFileSync(resolve(args.path), 'utf8'));
    } catch (e) {
        console.error(`Error: could not read or parse '${args.path}': ${e.message}`);
        process.exit(1);
    }
    const { ok, output } = previewScript(script, { samples: args.samples });
    console.log(output);
    process.exit(ok ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    main();
}
