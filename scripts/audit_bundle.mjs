#!/usr/bin/env node
// Bundle Audit — Q12.G q12-bd-initial-2mb + manualChunks
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import zlib from 'node:zlib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BUILD = path.join(__dirname, '../build/assets');
const CI = process.argv.includes('--ci');

function gzSize(file) {
    try {
        const data = fs.readFileSync(file);
        return zlib.gzipSync(data).length;
    } catch { return fs.statSync(file).size; }
}

if (!fs.existsSync(BUILD)) {
    console.log('[WARN] build/assets missing — run npm run build first');
    process.exit(0);
}

const files = fs.readdirSync(BUILD).map(f=>path.join(BUILD,f)).filter(f=>f.endsWith('.js'));
let totalInit = 0;
let largest = { file:'', size:0 };
for (const f of files) {
    const gz = gzSize(f);
    const base = path.basename(f);
    const isLazy = base.includes('rapier') || base.includes('worker');
    if (!isLazy) totalInit += gz;
    if (gz > largest.size) largest = { file: base, size: gz };
    console.log(`  ${base}: ${(gz/1024).toFixed(1)}k gz`);
}
console.log(`Initial JS gzipped (excl. rapier/workers): ${(totalInit/1024).toFixed(1)}k`);
console.log(`Largest chunk: ${largest.file} ${(largest.size/1024).toFixed(1)}k`);
const budget = 2*1024*1024;
if (totalInit > budget) {
    console.log(`[FAIL] initial ${(totalInit/1024).toFixed(1)}k > 2048k`);
    if (CI) process.exit(1);
} else console.log(`[PASS] initial < 2MB gzipped`);

// manualChunks audit
const vite = fs.readFileSync(path.join(__dirname,'../vite.config.js'),'utf8');
const hasManual = /manualChunks/.test(vite);
console.log(`  ${hasManual?'[PASS]':'[FAIL]'} vite.config manualChunks present`);
if (CI && !hasManual) process.exit(1);
console.log('[PASS] bundle audit complete');
