#!/usr/bin/env node
// Q11.D Instancing Audit (q11-in-audit)
//
// AST-based static analysis: lists meshes instantiated > 8× without
// instancing — `model.clone(true)` or `new THREE.Mesh/Group/Sprite` inside a
// loop over a bulk collection. Those are candidates for THREE.InstancedMesh /
// THREE.BatchedMesh conversion (q11-in-instancedmesh-pass).
//
// Usage:
//   node tools/audit_instancing.mjs           human-readable report
//   node tools/audit_instancing.mjs --ci      exit 1 on un-exempted bulk duplication
//   node tools/audit_instancing.mjs --json    machine-readable findings array
//
// A site is classified BULK when the enclosing loop provably iterates > 8
// times (map grid, length of a known collection, or a literal bound > 8).
// SMALL loops (≤ 8) and UNKNOWN loops are reported but never block CI.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as acorn from 'acorn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, '../src');
const JSON_OUTPUT = process.argv.includes('--json');
const CI_MODE = process.argv.includes('--ci');

// Known >8× duplication, acknowledged and tracked for the InstancedMesh /
// BatchedMesh conversion pass (q11-in-instancedmesh-pass). Exempted so CI
// fails only on NEW uninstanced duplicates; each entry is a reason to fix.
const CI_EXEMPTIONS = {
    'src/renderer3d.js:2939': 'building model clone — candidate for building InstancedMesh',
    'src/renderer3d.js:3048': 'building window-glow quads (4 faces × buildings) — candidate for InstancedMesh',
    'src/renderer3d.js:4225': 'decal quad pool (shared geo, per-decal Mesh) — candidate for InstancedMesh',
    'src/renderer3d.js:4615': 'vehicle model clone — candidate for InstancedMesh (keep per-vehicle LOD)',
    'src/renderer3d.js:4622': 'vehicle fallback box — candidate for InstancedMesh (keep per-vehicle LOD)',
    'src/renderer3d.js:4689': 'police unit body — candidate for InstancedMesh',
    'src/renderer3d.js:4690': 'police unit light — candidate for InstancedMesh',
    'src/renderer3d.js:4694': 'police unit group — candidate for InstancedMesh',
};

// Non-instanced constructors that signal one drawable per loop iteration.
const NON_INSTANCED_TYPES = new Set(['Mesh', 'Group', 'Sprite', 'Object3D', 'LOD']);

// Bulk collections that a plural-ending identifier heuristic could miss.
const KNOWN_BULK = new Set([
    'tiles', 'buildings', 'vehicles', 'citizens', 'npcs', 'chunks', 'blocks',
    'residents', 'props', 'decals', 'particles', 'trees', 'rocks', 'bushes',
    'tufts', 'blades', 'roadTiles', 'highwayTiles', 'bridgeTiles', 'tunnelTiles',
    'forestTiles', 'parkTiles', 'grassTiles', 'waterTiles', 'windows', 'floors',
    'markers', 'spawns', 'lamps', 'streetLights', 'roadSegments', 'furniture',
]);

// Map-grid loops iterate over tile coordinates (map-sized, always > 8).
const GRID_VARS = new Set(['x', 'y', 'z']);

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

function nodeText(source, node) {
    return source.slice(node.start, node.end);
}

// Extract loop metadata for a finding.
function loopInfo(source, node) {
    if (node.type === 'ForOfStatement' || node.type === 'ForInStatement') {
        return { iterable: nodeText(source, node.right), varName: null };
    }
    if (node.type === 'ForStatement') {
        let varName = null;
        if (node.init && node.init.type === 'VariableDeclaration') {
            const decl = node.init.declarations[0];
            if (decl && decl.id.type === 'Identifier') varName = decl.id.name;
        }
        let iterable = null;
        let boundLiteral = null;
        if (node.test && node.test.type === 'BinaryExpression') {
            iterable = nodeText(source, node.test.right);
            if (node.test.right.type === 'Literal' && typeof node.test.right.value === 'number') {
                boundLiteral = node.test.right.value;
            } else if (node.test.right.type === 'ArrayExpression') {
                return {
                    iterable,
                    varName,
                    arrayLength: node.test.right.elements.length,
                    boundLiteral,
                };
            }
        }
        return { iterable, varName, arrayLength: null, boundLiteral };
    }
    if (node.type === 'WhileStatement' || node.type === 'DoWhileStatement') {
        return { iterable: node.test ? nodeText(source, node.test) : null, varName: null };
    }
    if (node.type === 'CallExpression') {
        // forEach / map / filter / reduce callbacks iterate their callee array.
        return { iterable: nodeText(source, node.callee.object), varName: null };
    }
    return { iterable: null, varName: null, arrayLength: null, boundLiteral: null };
}

function isBulk(iterable, varName, arrayLength, boundLiteral) {
    if (typeof arrayLength === 'number') return arrayLength > 8;
    if (typeof boundLiteral === 'number') return boundLiteral > 8;
    let id = (iterable || '').replace(/\.length$/, '');
    id = id.replace(/^.*\./, '');
    if (KNOWN_BULK.has(id) || /s$/i.test(id) || /ies$/i.test(id)) return true;
    if (varName && GRID_VARS.has(varName)) return true;
    return false;
}

const IS_FUNCTION = new Set(['Program', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

// Direct `const X = [...literal...]` declarations in a statement list, used to
// prove a `for (const x of X)` loop is small (e.g. 4 window faces, 3 shelves).
function collectArrayDecls(statements) {
    const map = new Map();
    if (!statements) return map;
    for (const stmt of statements) {
        if (stmt.type !== 'VariableDeclaration') continue;
        for (const d of stmt.declarations) {
            if (d.id.type === 'Identifier' && d.init && d.init.type === 'ArrayExpression' && d.init.elements.length > 0) {
                map.set(d.id.name, d.init.elements.length);
            }
        }
    }
    return map;
}

function resolveArrayLength(iterableText, scopes) {
    const id = (iterableText || '').replace(/\.length$/, '').replace(/^.*\./, '');
    for (let i = scopes.length - 1; i >= 0; i--) {
        const len = scopes[i].get(id);
        if (len !== undefined) return len;
    }
    return null;
}

function scanFile(filePath, source, root) {
    const findings = [];
    const stack = [];
    const scopes = [];

    const isCloneSite = (node) =>
        node.type === 'CallExpression' &&
        node.callee.type === 'MemberExpression' &&
        node.callee.property.type === 'Identifier' &&
        node.callee.property.name === 'clone' &&
        node.arguments.length === 1 &&
        node.arguments[0].type === 'Literal' &&
        node.arguments[0].value === true;

    const isNewMeshSite = (node) => {
        if (node.type !== 'NewExpression' || node.callee.type === 'Super') return false;
        const name = node.callee.type === 'MemberExpression' ? node.callee.property.name : node.callee.name;
        return NON_INSTANCED_TYPES.has(name);
    };

    const walk = (node) => {
        if (!node || typeof node.type !== 'string') return;

        const isFn = IS_FUNCTION.has(node.type);
        if (isFn) {
            const stmts = node.type === 'Program'
                ? node.body
                : (node.body && node.body.type === 'BlockStatement' ? node.body.body : null);
            scopes.push(collectArrayDecls(stmts));
        }

        if (
            node.type === 'ForStatement' || node.type === 'ForInStatement' ||
            node.type === 'ForOfStatement' || node.type === 'WhileStatement' ||
            node.type === 'DoWhileStatement' ||
            (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
                node.callee.property.type === 'Identifier' &&
                ['forEach', 'map', 'filter', 'reduce', 'flatMap'].includes(node.callee.property.name))
        ) {
            stack.push(loopInfo(source, node));
        }

        const inLoop = stack.length > 0;
        if (inLoop && (isCloneSite(node) || isNewMeshSite(node))) {
            // A site inherits bulk from ANY enclosing loop (e.g. a per-tree
            // clone nested inside a per-forest-tile loop is bulk).
            const frames = stack.map((i) => {
                const resolved = resolveArrayLength(i.iterable, scopes);
                const len = resolved !== null ? resolved : i.arrayLength;
                const bulk = isBulk(i.iterable, i.varName, len, i.boundLiteral);
                const small = len !== null || i.boundLiteral !== null;
                return { bulk, small };
            });
            const bulk = frames.some((f) => f.bulk);
            const allSmall = frames.every((f) => f.small);
            const info = stack[stack.length - 1];
            findings.push({
                file: filePath,
                line: node.loc.start.line,
                kind: isCloneSite(node) ? 'clone' : 'new-mesh',
                class: bulk ? 'BULK' : allSmall ? 'SMALL' : 'UNKNOWN',
                iterable: info.iterable ? info.iterable.slice(0, 60) : '(none)',
                context: nodeText(source, node).slice(0, 80),
            });
        }

        for (const key in node) {
            if (key === 'loc' || key === 'start' || key === 'end' || key === 'sourceFile' || key === 'sourceType') continue;
            const value = node[key];
            if (Array.isArray(value)) {
                for (const child of value) if (child && typeof child.type === 'string') walk(child);
            } else if (value && typeof value.type === 'string') {
                walk(value);
            }
        }

        if (
            node.type === 'ForStatement' || node.type === 'ForInStatement' ||
            node.type === 'ForOfStatement' || node.type === 'WhileStatement' ||
            node.type === 'DoWhileStatement' ||
            (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' &&
                node.callee.property.type === 'Identifier' &&
                ['forEach', 'map', 'filter', 'reduce', 'flatMap'].includes(node.callee.property.name))
        ) {
            stack.pop();
        }

        if (isFn) scopes.pop();
    };

    walk(root);
    return findings;
}

function main() {
    const files = collectJSFiles(SRC_DIR);
    const allFindings = [];
    const skipped = [];
    const scanErrors = [];

    for (const file of files) {
        const source = fs.readFileSync(file, 'utf8');
        let ast;
        try {
            ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowAwaitOutsideFunction: true });
        } catch (e) {
            skipped.push(`${path.basename(file)} (${e.message})`);
            continue;
        }
        const rel = path.relative(path.join(__dirname, '..'), file).replace(/\\/g, '/');
        try {
            allFindings.push(...scanFile(rel, source, ast));
        } catch (e) {
            scanErrors.push(`${rel}: ${e.message}`);
        }
    }

    const bulk = allFindings.filter((f) => f.class === 'BULK');
    const small = allFindings.filter((f) => f.class === 'SMALL');
    const unknown = allFindings.filter((f) => f.class === 'UNKNOWN');

    if (JSON_OUTPUT) {
        console.log(JSON.stringify({ findings: allFindings, skipped, scanErrors }, null, 2));
        process.exit(bulk.length > 0 ? 1 : 0);
    }

    console.log('[1m=== Instancing Audit (meshes duplicated > 8× without instancing) ===[0m');
    console.log(`Scanned: ${files.length} files in src/ (${skipped.length} skipped: ${skipped.join(', ') || 'none'})`);
    if (scanErrors.length > 0) {
        console.log(`  [scan error] ${scanErrors.join(' | ')}`);
    }
    console.log();

    console.log(`[1mBULK (>8×) uninstanced meshes:[0m [31m${bulk.length}[0m`);
    for (const f of bulk) {
        console.log(`  [31m[BULK][0m ${f.file}:${f.line}`);
        console.log(`    kind:      ${f.kind}`);
        console.log(`    iterable:  ${f.iterable}`);
        console.log(`    context:   ${f.context}`);
        console.log();
    }

    if (small.length > 0) {
        console.log(`[1mSMALL (≤ 8×) uninstanced meshes:[0m [33m${small.length}[0m (acceptable, not instancing candidates)`);
        for (const f of small) {
            console.log(`  ${f.file}:${f.line}  [${f.kind}]  iterable: ${f.iterable}`);
        }
        console.log();
    }

    if (unknown.length > 0) {
        console.log(`[1mUNKNOWN duplication — review:[0m [33m${unknown.length}[0m`);
        for (const f of unknown) {
            console.log(`  ${f.file}:${f.line}  [${f.kind}]  iterable: ${f.iterable}`);
        }
        console.log();
    }

    if (CI_MODE) {
        const unexempted = bulk.filter((f) => !CI_EXEMPTIONS[`${f.file}:${f.line}`]);
        if (unexempted.length === 0) {
            console.log(`[32m[PASS][0m CI instancing audit: no new >8× uninstanced meshes. (${bulk.length} known/exempted)`);
            process.exit(0);
        } else {
            console.log(`[31m[FAIL][0m CI instancing audit: ${unexempted.length} un-exempted >8× mesh duplication(s):\n`);
            for (const f of unexempted) {
                console.log(`  ${f.file}:${f.line}  [${f.kind}]  iterable: ${f.iterable}`);
            }
            console.log('\nAdd to CI_EXEMPTIONS in tools/audit_instancing.mjs only if already tracked for q11-in-instancedmesh-pass.');
            process.exit(1);
        }
    }

    console.log(`[1mSummary:[0m ${allFindings.length} sites (${bulk.length} bulk, ${small.length} small, ${unknown.length} unknown)`);
    process.exit(0);
}

main();
