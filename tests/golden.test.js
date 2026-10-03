// Golden maps (M0-7): each seed's map is frozen in tests/golden/map-<seed>.json.
// A derivation that moves a road, lot, pinned tower, lamp, sign, parked car,
// story place or spawn fails here until the commit declares it and rewrites the
// file with `node scripts/map-golden.mjs`.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// "Five seeds" always means 7, 11, 22, 33 and 73, generated (docs/ROADMAP.md).
const SEEDS = [7, 11, 22, 33, 73];

const liveMap = (seed) => JSON.parse(execFileSync(
    process.execPath,
    ['scripts/map-golden.mjs', '--seed', String(seed), '--print'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
));

for (const seed of SEEDS) {
    test(`seed ${seed}'s map matches tests/golden/map-${seed}.json`, () => {
        const golden = JSON.parse(readFileSync(`tests/golden/map-${seed}.json`, 'utf8'));
        expect(liveMap(seed)).toEqual(golden);
    });
}
