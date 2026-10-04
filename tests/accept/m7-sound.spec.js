// M7.T2 (M7-1): the sound set. Every CC0 file the audio system plays is pinned to a
// sha256 in tools/sounds/fetch.sh and recorded in public/assets/CREDITS.md; the check
// hashes the committed bytes itself, so a lost download cannot pass on trust. Node-only.
import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT));
const rowRe = /^([a-z0-9_]+\.mp3)\|([^\s|]+)\|([^\s|]+)\|([0-9a-f]{64})$/gm;
const rows = [...read('tools/sounds/fetch.sh').toString().matchAll(rowRe)]
  .map(([, file, page, url, sha]) => ({ file, page, url, sha }));
const ROSTER = [
  'ambience_street', 'engine_loop', 'horn', 'crane_site',
  'siren_police', 'sting_complete', 'hum_district', 'traffic_pass',
];

test('M7.T2: fetch.sh pins every sound M7-1 plays', () => {
  expect(rows.length, 'checksummed rows in fetch.sh').toBeGreaterThanOrEqual(ROSTER.length);
  const files = rows.map((r) => r.file);
  for (const name of ROSTER) expect(files, `fetch.sh pins ${name}`).toContain(`${name}.mp3`);
  expect(new Set(files).size, 'no duplicate rows').toBe(files.length);
});

test('M7.T2: every committed sound is a real MP3 whose bytes match its checksum', () => {
  for (const { file, sha } of rows) {
    const bytes = read(`public/assets/sounds/${file}`);
    expect(bytes.length, `${file} is not empty`).toBeGreaterThan(4096);
    const head = bytes.subarray(0, 3).toString('latin1');
    expect(head === 'ID3' || bytes[0] === 0xff, `${file} is an MP3`).toBe(true);
    expect(createHash('sha256').update(bytes).digest('hex'), `${file} matches fetch.sh`).toBe(sha);
  }
  const onDisk = readdirSync(new URL('public/assets/sounds/', ROOT)).filter((f) => f.endsWith('.mp3'));
  expect(onDisk.sort(), 'nothing undocumented in public/assets/sounds/').toEqual(rows.map((r) => r.file).sort());
});

test('M7.T2: every sound is in CREDITS.md with its CC0 source', () => {
  const credits = read('public/assets/CREDITS.md').toString();
  for (const { file, page } of rows) {
    const line = credits.split('\n').find((l) => l.includes(file));
    expect(line, `${file} in CREDITS.md`).toBeTruthy();
    expect(line, `${file} is CC0`).toContain('CC0');
    expect(line, `${file} names its source`).toContain(page);
  }
});
