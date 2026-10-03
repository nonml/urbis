// Shot diff (M0-8, and the proof M3-1 needs): two folders of same-named shots
// in, the per-pose share of pixels whose colour differs by more than 8 levels
// out. Poses pair by file name. A missing counterpart, a size mismatch or any
// pose over the threshold exits 1; no browser and no package, because the shots
// are 8-bit non-interlaced RGB/RGBA PNGs and inflate + unfilter is the decoder.
//   node scripts/shotdiff.mjs <dirA> <dirB> [max percent per pose, default 0.5]
import { readdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';
const DIFF_LEVELS = 8; const DEFAULT_MAX_PCT = 0.5;
const pct = (share) => `${(share * 100).toFixed(3)}%`;

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let w = 0; let h = 0; let ch = 0;
  const idat = [];
  for (let pos = 8; pos + 12 <= buf.length;) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    if (type === 'IHDR') {
      w = buf.readUInt32BE(pos + 8); h = buf.readUInt32BE(pos + 12);
      ch = { 2: 3, 6: 4 }[buf[pos + 17]];
      if (buf[pos + 16] !== 8 || !ch || buf[pos + 20] !== 0) throw new Error('unsupported PNG');
    } else if (type === 'IDAT') idat.push(buf.subarray(pos + 8, pos + 8 + len));
    else if (type === 'IEND') break;
    pos += len + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const data = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const base = y * (stride + 1);
    const f = raw[base];
    const row = data.subarray(y * stride, (y + 1) * stride);
    const up = y ? data.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? row[x - ch] : 0;
      const b = up ? up[x] : 0;
      const c = up && x >= ch ? up[x - ch] : 0;
      let v = raw[base + 1 + x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (f !== 0) throw new Error(`unknown PNG filter ${f}`);
      row[x] = v & 0xff;
    }
  }
  return { w, h, ch, data };
}

function diffShare(a, b) {
  if (a.w !== b.w || a.h !== b.h) throw new Error(`size ${a.w}x${a.h} vs ${b.w}x${b.h}`);
  const pixels = a.w * a.h;
  let differing = 0;
  for (let i = 0; i < pixels; i++) {
    const ai = i * a.ch; const bi = i * b.ch;
    const d = Math.max(
      Math.abs(a.data[ai] - b.data[bi]),
      Math.abs(a.data[ai + 1] - b.data[bi + 1]),
      Math.abs(a.data[ai + 2] - b.data[bi + 2]),
    );
    if (d > DIFF_LEVELS) differing++;
  }
  return differing / pixels;
}

const [dirA, dirB, maxArg] = process.argv.slice(2);
if (!dirA || !dirB) {
  console.error('usage: node scripts/shotdiff.mjs <dirA> <dirB> [max percent per pose, default 0.5]');
  process.exit(2);
}
const maxPct = maxArg === undefined ? DEFAULT_MAX_PCT : Number(maxArg);
if (!(maxPct >= 0)) { console.error(`bad threshold: ${maxArg}`); process.exit(2); }
const shotNames = (dir) => readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
const read = (dir, f) => decodePng(readFileSync(join(dir, f)));
const poses = shotNames(dirA);
const remaining = new Set(shotNames(dirB));
let failures = 0; let worst = 0;
for (const f of poses) {
  const pose = f.slice(0, -4);
  if (!remaining.has(f)) { failures++; console.log(`${pose}  missing in ${dirB}`); continue; }
  remaining.delete(f);
  try {
    const share = diffShare(read(dirA, f), read(dirB, f));
    const over = share * 100 > maxPct;
    if (over) failures++;
    worst = Math.max(worst, share * 100);
    console.log(`${pose}  ${pct(share)}${over ? `  OVER ${maxPct}%` : ''}`);
  } catch (e) {
    failures++; console.log(`${pose}  ${e.message}`);
  }
}
for (const f of remaining) { failures++; console.log(`${f.slice(0, -4)}  missing in ${dirA}`); }
console.log(`${poses.length} poses, worst ${worst.toFixed(3)}%, limit ${maxPct}%`);
process.exit(failures ? 1 : 0);
