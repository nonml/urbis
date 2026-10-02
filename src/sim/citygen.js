// Seed -> a district's road layout: the avenues, the crossings between them and
// the bounds a person and a car may use. Pure data and pure maths (law 5).
// Stage 2 of docs/PROCGEN.md; stage 4 wires this into world.js. Every
// coordinate comes from the seed and the named constants below, never from a
// number tuned to today's hand layout.
import { mulberry32 } from './rng.js';

const HALF_STEP = 0.5; // every coordinate lands on a half-metre
const AVENUES_MIN = 2;
const AVENUES_MAX = 4;
const AVENUE_GAP_MIN = 36;
const AVENUE_GAP_MAX = 56;
const MEAN_X_LIMIT = 20; // the mean avenue x stays within this of zero
const AVENUE_Z0 = -100;
const AVENUE_Z1 = 100;
const LANES = 2;

const CROSSINGS_MIN = 1;
const CROSSINGS_MAX = 3;
const CROSSING_Z_MIN = -60; // its road band stays inside DRIVE_Z_MIN
const CROSSING_Z_MAX = 80;
const CROSSING_CLEARANCE = 40; // two crossings never come closer than this
const CROSSING_OVERHANG = 8; // a crossing ends this far past its end avenues

const DRIVE_Z_MIN = -68;
const DRIVE_Z_MAX = 100;
const PARK_WIDTH = 18; // walk bounds gain this over drive, for the pocket park

function roundHalf(value) {
    return Math.round(value / HALF_STEP) * HALF_STEP;
}

function randomInt(rand, lo, hi) {
    return lo + Math.floor(rand() * (hi - lo + 1));
}

function randomHalf(rand, lo, hi) {
    return roundHalf(lo + randomInt(rand, 0, Math.round((hi - lo) / HALF_STEP)) * HALF_STEP);
}

function generateAvenues(rand) {
    const count = randomInt(rand, AVENUES_MIN, AVENUES_MAX);
    const xs = [0];
    for (let i = 1; i < count; i++) xs.push(xs[i - 1] + randomHalf(rand, AVENUE_GAP_MIN, AVENUE_GAP_MAX));
    const mean = xs.reduce((a, b) => a + b, 0) / count;
    const shift = roundHalf(mean);
    return xs.map((x, i) => ({
        id: `av${i}`,
        x: roundHalf(x - shift),
        z0: AVENUE_Z0,
        z1: AVENUE_Z1,
        lanes: LANES,
    }));
}

function halfGrid(lo, hi) {
    const out = [];
    for (let v = lo; v <= hi + 1e-9; v += HALF_STEP) out.push(roundHalf(v));
    return out;
}

function crossingZs(rand, count) {
    const zs = [];
    while (zs.length < count) {
        const options = halfGrid(CROSSING_Z_MIN, CROSSING_Z_MAX)
            .filter((z) => zs.every((p) => Math.abs(p - z) >= CROSSING_CLEARANCE));
        // Two early picks can leave no room for a third: the district takes fewer.
        if (!options.length) break;
        zs.push(options[randomInt(rand, 0, options.length - 1)]);
    }
    return zs;
}

function avenuePair(rand, count) {
    const i = randomInt(rand, 0, count - 2);
    return [i, randomInt(rand, i + 1, count - 1)];
}

function generateCrossings(rand, avenues) {
    const count = randomInt(rand, CROSSINGS_MIN, CROSSINGS_MAX);
    return crossingZs(rand, count)
        .sort((p, q) => p - q)
        .map((z, i) => {
            // The lowest crossing always spans every avenue; the rest take a
            // random pair, which is what makes the network readable.
            const [from, to] = i === 0 ? [0, avenues.length - 1] : avenuePair(rand, avenues.length);
            return {
                id: `cr${i}`,
                z,
                x0: avenues[from].x - CROSSING_OVERHANG,
                x1: avenues[to].x + CROSSING_OVERHANG,
                lanes: LANES,
            };
        });
}

export function generateDistrict(seed) {
    const rand = mulberry32(seed);
    const avenues = generateAvenues(rand);
    const crossings = generateCrossings(rand, avenues);
    const drive = {
        minX: Math.min(...crossings.map((c) => c.x0)),
        maxX: Math.max(...crossings.map((c) => c.x1)),
        minZ: DRIVE_Z_MIN,
        maxZ: DRIVE_Z_MAX,
    };
    return {
        id: 'downtown',
        avenues,
        crossings,
        walk: {
            minX: drive.minX,
            maxX: roundHalf(drive.maxX + PARK_WIDTH),
            minZ: drive.minZ,
            maxZ: drive.maxZ,
        },
        drive,
    };
}
