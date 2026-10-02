// The district road generator, proven without a browser. citygen.js is pure
// (law 5), so 500 seeds run in a few milliseconds of Node and every layout rule
// becomes a cheap invariant. Same runner as the gate — no new tooling.
import { test, expect } from '@playwright/test';
import { generateDistrict } from '../src/sim/citygen.js';

const SEEDS = Array.from({ length: 500 }, (_, i) => i + 1);
const GAP_MIN = 36;
const GAP_MAX = 56;
const MEAN_X_LIMIT = 20;
const CROSSING_Z_MIN = -60;
const CROSSING_Z_MAX = 80;
const CROSSING_CLEARANCE = 40;
const OVERHANG = 8;
const isHalf = (v) => Math.round(v * 2) / 2 === v;

test('every seed obeys the district road rules', () => {
    for (const seed of SEEDS) {
        const d = generateDistrict(seed);
        const at = (msg) => `seed ${seed}: ${msg}`;

        expect(d.id, at('id')).toBe('downtown');

        expect(d.avenues.length >= 2 && d.avenues.length <= 4, at('avenue count')).toBe(true);
        expect(d.avenues.map((a) => a.id), at('avenue ids')).toEqual(d.avenues.map((_, i) => `av${i}`));
        expect(d.avenues.map((a) => a.x), at('avenues sorted by x')).toEqual(
            d.avenues.map((a) => a.x).slice().sort((p, q) => p - q),
        );
        const gaps = d.avenues.slice(1).map((a, i) => a.x - d.avenues[i].x);
        expect(gaps.every((g) => g >= GAP_MIN && g <= GAP_MAX), at('avenue gaps 36..56')).toBe(true);
        const meanX = d.avenues.reduce((s, a) => s + a.x, 0) / d.avenues.length;
        expect(Math.abs(meanX) <= MEAN_X_LIMIT, at('mean avenue x within 20 of 0')).toBe(true);
        expect(d.avenues.every((a) => a.z0 === -100 && a.z1 === 100 && a.lanes === 2), at('avenue span/lanes')).toBe(true);
        expect(d.avenues.every((a) => isHalf(a.x)), at('avenue x on 0.5 m')).toBe(true);

        expect(d.crossings.length >= 1 && d.crossings.length <= 3, at('crossing count')).toBe(true);
        expect(d.crossings.map((c) => c.id), at('crossing ids')).toEqual(d.crossings.map((_, i) => `cr${i}`));
        expect(d.crossings.map((c) => c.z), at('crossings sorted by z')).toEqual(
            d.crossings.map((c) => c.z).slice().sort((p, q) => p - q),
        );
        expect(
            d.crossings.every((c) => c.z >= CROSSING_Z_MIN && c.z <= CROSSING_Z_MAX && isHalf(c.z)),
            at('crossing z in [-60,80] on 0.5 m'),
        ).toBe(true);
        const spread = d.crossings.every((c, i) =>
            d.crossings.every((o, j) => i === j || Math.abs(o.z - c.z) >= CROSSING_CLEARANCE));
        expect(spread, at('crossings 40 m apart')).toBe(true);

        const ends = d.crossings.every((c) =>
            d.avenues.some((a, i) =>
                d.avenues.some((b, j) => j > i && c.x0 === a.x - OVERHANG && c.x1 === b.x + OVERHANG)));
        expect(ends, at('crossing endpoints on an avenue pair')).toBe(true);
        const first = d.avenues[0];
        const last = d.avenues[d.avenues.length - 1];
        expect(
            d.crossings.some((c) => c.x0 === first.x - OVERHANG && c.x1 === last.x + OVERHANG),
            at('a crossing spans every avenue'),
        ).toBe(true);

        expect(d.drive, at('drive bounds')).toEqual({
            minX: Math.min(...d.crossings.map((c) => c.x0)),
            maxX: Math.max(...d.crossings.map((c) => c.x1)),
            minZ: -68,
            maxZ: 100,
        });
        expect(d.walk, at('walk bounds')).toEqual({ ...d.drive, maxX: d.drive.maxX + 18 });
    }
});

test('different seeds generate different districts', () => {
    expect(generateDistrict(1)).not.toEqual(generateDistrict(2));
});

test('the same seed always generates the same district', () => {
    expect(generateDistrict(20260916)).toEqual(generateDistrict(20260916));
});
