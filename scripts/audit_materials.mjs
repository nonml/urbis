#!/usr/bin/env node
// Material Audit Script — Q9.A
// Lists every non-PBR material usage in src/
// Usage: node scripts/audit_materials.mjs [--json] [--ci]

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '../src');
const JSON_OUTPUT = process.argv.includes('--json');
const CI_MODE = process.argv.includes('--ci');

// Non-PBR material classes that should be flagged
const NON_PBR_SURFACE = {
    MeshBasicMaterial:  'No lighting — ignores all lights. Use MeshStandardMaterial.',
    MeshLambertMaterial: 'Deprecated Lambert shading. Use MeshStandardMaterial.',
    MeshPhongMaterial:   'Deprecated Phong shading. Use MeshStandardMaterial.',
};

// Acceptable non-surface materials (not flagged as errors, but noted)
const ACCEPTABLE_SPECIAL = {
    LineBasicMaterial:   'Line rendering — acceptable for wireframes, outlines, debug.',
    PointsMaterial:      'Particle rendering — acceptable for rain, snow, stars, dust.',
    SpriteMaterial:      'Sprite rendering — acceptable for 2D overlays.',
};

// PBR materials (no flag)
const PBR_MATERIALS = new Set([
    'MeshStandardMaterial',
    'MeshPhysicalMaterial',
]);

// CI exemptions: known acceptable non-PBR usages (file:line -> reason)
// These are debug overlays, FX effects, god mode, sky — not game content.
const CI_EXEMPTIONS = {
    'src/render/lighting/day_night.js:140': 'Stars (PointsMaterial, sky)',
    'src/renderer3d.js:385': 'Ground plane (invisible)',
    'src/renderer3d.js:2010': 'Building window glow (additive emissive)',
    'src/renderer3d.js:2482': 'Muzzle flash FX',
    'src/renderer3d.js:2499': 'Visibility ring FX',
    'src/renderer3d.js:2578': 'Debug wireframe (LineBasicMaterial)',
    'src/renderer3d.js:2624': 'Decal overlay (Q10)',
    'src/renderer3d.js:3153': 'Debug wireframe (LineBasicMaterial)',
    'src/renderer3d.js:3207': 'Weather particles (PointsMaterial)',
    'src/renderer3d.js:3540': 'Debug overlay',
    'src/renderer3d.js:3557': 'Scaffolding (debug)',
    'src/renderer3d.js:4064': 'Debug overlay (vertex colors)',
    'src/renderer3d.js:4377': 'Zone overlay (debug)',
    'src/renderer3d.js:4491': 'Build ghost (god mode)',
    'src/renderer3d.js:4504': 'Footprint outline (god mode)',
    'src/renderer3d.js:4566': 'Hover highlight (god mode)',
    'src/renderer3d.js:4676': 'Hack placement ring (FX)',
    'src/renderer3d.js:4786': 'Particle material (FX)',
};

/**
 * Recursively collect all JS files in a directory
 */
function collectJSFiles(dir) {
    const files = [];
    if (!fs.existsSync(dir)) return files;
    for (const item of fs.readdirSync(dir)) {
        const full = path.join(dir, item);
        if (fs.statSync(full).isDirectory()) {
            files.push(...collectJSFiles(full));
        } else if (item.endsWith('.js')) {
            files.push(full);
        }
    }
    return files;
}

/**
 * Extract material class names from a line.
 */
function extractMaterials(line) {
    const materials = [];
    const directMatches = line.matchAll(/new\s+(?:THREE\.)?(\w+Material)\s*\(/g);
    for (const m of directMatches) {
        materials.push(m[1]);
    }
    const ternaryMatches = line.matchAll(/\?\s*THREE\.(\w+Material)\s*:/g);
    for (const m of ternaryMatches) {
        materials.push(m[1]);
    }
    return materials;
}

/**
 * Scan a file for material instantiations
 */
function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const findings = [];
    const projectRoot = path.join(__dirname, '..');
    const relative = filePath.replace(projectRoot + '/', '');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const materials = extractMaterials(line);

        for (const matClass of materials) {
            if (NON_PBR_SURFACE[matClass]) {
                findings.push({
                    file: relative,
                    line: i + 1,
                    material: matClass,
                    severity: 'ERROR',
                    suggestion: NON_PBR_SURFACE[matClass],
                    context: line.trim(),
                });
            } else if (ACCEPTABLE_SPECIAL[matClass]) {
                findings.push({
                    file: relative,
                    line: i + 1,
                    material: matClass,
                    severity: 'NOTE',
                    suggestion: ACCEPTABLE_SPECIAL[matClass],
                    context: line.trim(),
                });
            } else if (!PBR_MATERIALS.has(matClass)) {
                findings.push({
                    file: relative,
                    line: i + 1,
                    material: matClass,
                    severity: 'UNKNOWN',
                    suggestion: 'Unknown material type. Verify intent.',
                    context: line.trim(),
                });
            }
        }
    }

    return findings;
}

/**
 * Main
 */
function main() {
    const files = collectJSFiles(SRC_DIR);
    const allFindings = [];

    for (const file of files) {
        try {
            allFindings.push(...scanFile(file));
        } catch (e) {
            // Skip unreadable files
        }
    }

    if (JSON_OUTPUT) {
        console.log(JSON.stringify(allFindings, null, 2));
        process.exit(allFindings.filter(f => f.severity === 'ERROR').length > 0 ? 1 : 0);
    }

    // CI mode: check for non-exempted non-PBR materials
    if (CI_MODE) {
        const errors = allFindings.filter(f => f.severity === 'ERROR');
        const unexempted = errors.filter(e => {
            const key = `${e.file}:${e.line}`;
            return !CI_EXEMPTIONS[key];
        });

        if (unexempted.length === 0) {
            console.log('[PASS] CI material audit: all non-PBR materials are exempted.');
            console.log(`  ${errors.length} exempted, ${allFindings.length - errors.length} notes.`);
            process.exit(0);
        } else {
            console.log(`[FAIL] CI material audit: ${unexempted.length} non-exempted non-PBR material(s):\n`);
            for (const e of unexempted) {
                console.log(`  ${e.file}:${e.line} — ${e.material}`);
                console.log(`  Context: ${e.context}`);
                console.log(`  Fix: ${e.suggestion}`);
                console.log();
            }
            console.log('To add an exemption, update CI_EXEMPTIONS in scripts/audit_materials.mjs');
            process.exit(1);
        }
    }

    // Human-readable report (non-CI mode)
    const errors = allFindings.filter(f => f.severity === 'ERROR');
    const notes  = allFindings.filter(f => f.severity === 'NOTE');
    const unknown = allFindings.filter(f => f.severity === 'UNKNOWN');

    console.log('\u001b[1m=== Material Audit Report ===\u001b[0m');
    console.log(`Scanned: ${files.length} files in src/\n`);

    if (errors.length === 0) {
        console.log('\u001b[32m✓ No non-PBR surface materials found.\u001b[0m');
    } else {
        console.log(`\u001b[31m${errors.length} non-PBR surface material(s) found:\u001b[0m`);
        for (const e of errors) {
            console.log(`  \u001b[31m[${e.severity}]\u001b[0m ${e.file}:${e.line}`);
            console.log(`    Material: ${e.material}`);
            console.log(`    Context:  ${e.context}`);
            console.log(`    Fix:      ${e.suggestion}`);
            console.log();
        }
    }

    if (notes.length > 0) {
        console.log(`\u001b[33m${notes.length} acceptable special material(s) (noted):\u001b[0m`);
        for (const n of notes) {
            console.log(`  \u001b[33m[${n.severity}]\u001b[0m ${n.file}:${n.line}`);
            console.log(`    Material: ${n.material}`);
            console.log(`    Note:     ${n.suggestion}`);
        }
        console.log();
    }

    if (unknown.length > 0) {
        console.log(`\u001b[33m${unknown.length} unknown material(s):\u001b[0m`);
        for (const u of unknown) {
            console.log(`  ${u.file}:${u.line} — ${u.material}`);
        }
        console.log();
    }

    // Summary by material type
    const byType = {};
    for (const f of allFindings) {
        byType[f.material] = (byType[f.material] || 0) + 1;
    }
    console.log('\u001b[1mSummary by type:\u001b[0m');
    for (const [mat, count] of Object.entries(byType)) {
        const sev = allFindings.find(f => f.material === mat)?.severity;
        const color = sev === 'ERROR' ? '\u001b[31m' : sev === 'NOTE' ? '\u001b[33m' : '\u001b[36m';
        console.log(`  ${color}${count}x ${mat}\u001b[0m (${sev})`);
    }

    console.log(`\nTotal findings: ${allFindings.length} (${errors.length} errors, ${notes.length} notes, ${unknown.length} unknown)\n`);

    // Exit with error code if non-PBR surface materials found
    process.exit(errors.length > 0 ? 1 : 0);
}

main();
