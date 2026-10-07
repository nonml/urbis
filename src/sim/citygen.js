// Seed -> a district's road layout: the avenues, the crossings between them and
// the bounds a person and a car may use. A district is a cell of the town plan
// (M4.T4): its kind sets the avenue gap, the crossing count and the height and
// style range its buildings may take. Pure data and pure maths (law 5). Every
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

// A cell's roads stay this far inside its bounds, clear of the boundary
// arterials the town plan lays on the cell lines.
const CELL_MARGIN = 30;
// A cell crossing keeps this far from its cell's z edges.
const CELL_CROSSING_MARGIN = 24;

// How each kind lays its cell out (M4.T4). `avenues` is the count range, the
// gap range the avenues take, the crossing count range, and the height and
// style range its buildings may wear (M4.T5 reads heights and styles; the
// style names are layout.js's). Gaps and heights are metres.
export const KIND_SPECS = {
    towers: {
        avenues: [4, 6], avenueGap: [56, 84], crossings: [2, 4],
        heights: [18, 52], styles: ['core', 'glass', 'tower'],
    },
    housing: {
        avenues: [3, 5], avenueGap: [72, 104], crossings: [2, 3],
        heights: [10, 26], styles: ['brick', 'tower'],
    },
    works: {
        avenues: [2, 4], avenueGap: [104, 150], crossings: [1, 3],
        heights: [7, 16], styles: ['brick'],
    },
    suburb: {
        avenues: [2, 4], avenueGap: [120, 176], crossings: [1, 2],
        heights: [6, 12], styles: ['brick'],
    },
};

const KIND_NAMES = { towers: 'Heights', housing: 'Homes', works: 'Yards', suburb: 'Gardens' };

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

function crossingZs(rand, count, zMin = CROSSING_Z_MIN, zMax = CROSSING_Z_MAX) {
    const zs = [];
    while (zs.length < count) {
        const options = halfGrid(zMin, zMax)
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

// The handless town district world.js builds from `generateDistrict(seed)`
// (docs/PROCGEN.md stage 4): one district across the whole play box, kept
// byte-identical while the cell districts replace it one stage at a time.
function townDistrict(seed) {
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

// One cell's seed, mixed from the town seed so two cells never roll the same
// grid and every seed gives the same town.
function cellSeed(seed, id) {
    return (seed ^ Math.imul(id + 1, 0x9e3779b1)) >>> 0;
}

// A cell's avenues, spread across its width by the kind's gap range and
// centred; when the gaps overrun the cell they scale down together, so no
// avenue ever crosses a boundary arterial.
function cellAvenues(rand, cell, spec) {
    const count = randomInt(rand, spec.avenues[0], spec.avenues[1]);
    const gaps = [];
    let total = 0;
    for (let i = 1; i < count; i++) {
        gaps.push(randomHalf(rand, spec.avenueGap[0], spec.avenueGap[1]));
        total += gaps[gaps.length - 1];
    }
    const span = Math.max(1, cell.drive.maxX - cell.drive.minX - 2 * CELL_MARGIN);
    const scale = total > span ? span / total : 1;
    let x = roundHalf(cell.drive.minX + CELL_MARGIN + (span - total * scale) / 2);
    const xs = [x];
    for (const gap of gaps) {
        x = roundHalf(x + gap * scale);
        xs.push(x);
    }
    return xs.map((px, i) => ({
        id: `d${cell.id}-av${i}`, x: px,
        z0: cell.drive.minZ, z1: cell.drive.maxZ, lanes: LANES,
    }));
}

// A cell's crossings, each spanning its first to its last avenue so every
// avenue meets every crossing and the cell's own grid stays whole.
function cellCrossings(rand, cell, spec, avenues) {
    const count = randomInt(rand, spec.crossings[0], spec.crossings[1]);
    const zs = crossingZs(rand, count,
        cell.drive.minZ + CELL_CROSSING_MARGIN, cell.drive.maxZ - CELL_CROSSING_MARGIN)
        .sort((p, q) => p - q);
    if (!zs.length) zs.push(roundHalf((cell.drive.minZ + cell.drive.maxZ) / 2));
    const x0 = avenues[0].x;
    const x1 = avenues[avenues.length - 1].x;
    return zs.map((z, i) => ({ id: `d${cell.id}-cr${i}`, z, x0, x1, lanes: LANES }));
}

// One cell as a district: the kind names it, gives it its grid and carries the
// height and style range its buildings take.
function cellDistrict(seed, cell, kind) {
    const spec = KIND_SPECS[kind] ?? KIND_SPECS.towers;
    const rand = mulberry32(cellSeed(seed, cell.id));
    const avenues = cellAvenues(rand, cell, spec);
    const crossings = cellCrossings(rand, cell, spec, avenues);
    return {
        id: `d${cell.id}`,
        kind,
        name: `${KIND_NAMES[kind] ?? kind} ${cell.id}`,
        avenues,
        crossings,
        walk: { ...cell.walk },
        drive: { ...cell.drive },
        heights: spec.heights.slice(),
        styles: spec.styles.slice(),
    };
}

// `seed` alone is the handless town district (docs/PROCGEN.md stage 4); `seed`
// plus a town-plan cell and its kind is one district of the generated town
// (M4.T4), every road placed inside the cell.
export function generateDistrict(seed, cell = null, kind = 'towers') {
    return cell ? cellDistrict(seed, cell, kind) : townDistrict(seed);
}
