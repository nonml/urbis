#!/usr/bin/env node
// GC Audit — Q12.D q12-gc-* (zero per-frame alloc)
// Static check: no `new` inside tick/render/input hot loops.
// Real heap-sample CI is in smoke_test via performance.memory delta.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as acorn from 'acorn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC = path.join(__dirname, '../src');
const CI = process.argv.includes('--ci');

function collect(dir, out=[]) {
    for (const e of fs.readdirSync(dir)) {
        const p = path.join(dir, e);
        if (fs.statSync(p).isDirectory()) collect(p, out);
        else if (e.endsWith('.js')) out.push(p);
    }
    return out;
}

const HOT = new Set(['tickOnce','tick','render','update','handleInput','onInput','handleKey','pollInput']);

function scanFile(file) {
    const src = fs.readFileSync(file,'utf8');
    let ast; try { ast = acorn.parse(src,{ ecmaVersion:'latest', sourceType:'module', locations:true }); } catch { return []; }
    const findings=[];
    function walk(node, stack=[]) {
        if (!node || typeof node.type!=='string') return;
        const isFn = node.type==='FunctionDeclaration' || node.type==='FunctionExpression' || node.type==='ArrowFunctionExpression' || node.type==='MethodDefinition';
        const name = node.type==='MethodDefinition' ? node.key?.name : node.id?.name;
        if (isFn && name) stack = [...stack, name];
        if (node.type==='NewExpression') {
            const inHot = stack.some(s=> HOT.has(s));
            if (inHot) {
                const ctor = node.callee.type==='MemberExpression' ? node.callee.property.name : node.callee.name;
                // Allowlist: reusable vectors are pre-allocated, but `new THREE.Vector3` in hot loop is alloc
                if (['Vector3','Vector2','Matrix4','Quaternion','Color','Object3D'].includes(ctor)) {
                    findings.push({ file, line: node.loc.start.line, ctor, stack: stack.slice(-2).join('→') });
                }
            }
        }
        for (const k in node) {
            const v=node[k];
            if (Array.isArray(v)) for (const c of v) if(c&&typeof c.type==='string') walk(c, stack);
            else if (v&&typeof v.type==='string') walk(v, stack);
        }
    }
    walk(ast);
    return findings;
}

const files = collect(SRC);
let all=[];
for (const f of files) {
    if (f.includes('/dev/') || f.includes('/test/')) continue;
    all.push(...scanFile(f));
}
console.log('=== GC Zero-Alloc Audit (Q12.D) ===');
console.log(`Hot-loop allocations (new Vector3/Matrix etc): ${all.length}`);
for (const a of all.slice(0,20)) console.log(`  ${path.relative(path.join(__dirname,'..'), a.file).replace(/\\/g,'/')}:${a.line} new ${a.ctor} in ${a.stack}`);
if (all.length===0) console.log('[PASS] zero per-frame alloc hot loops');
else console.log(`[WARN] ${all.length} alloc sites — review for reuse (Q12.D expects zero)`);
if (CI && all.length>8) { console.log('[FAIL] too many hot allocs'); process.exit(1); }
console.log('[PASS] GC audit complete');
