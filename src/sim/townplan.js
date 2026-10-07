// The town plan (M4.T3): one seed -> the coarse town the districts are cut
// from. A grid of 4-6 cells about 600 m across, each with a kind (towers,
// housing, works, suburb); one east-west river corridor of 60 m — 30 m of
// water, 7 m banks and an 8 m building setback each side; arterial roads along
// the cell boundaries, joining the cells and crossing the river. Pure data and
// pure maths (law 5): no three, no DOM.
//
// M4.T4 cuts the cells into districts and joins their roads through these
// arterials; M4.T5 places buildings, asking terrain.buildable first; M4.T7
// turns every arterial crossing of the corridor into a bridge.
import { mulberry32 } from './rng.js';

const HALF_STEP = 0.5;
const rngInt = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const roundHalf = (v) => Math.round(v / HALF_STEP) * HALF_STEP;

// The four kinds a cell can be.
export const KINDS = ['towers', 'housing', 'works', 'suburb'];

// A cell is about this across, not exactly: the jitter keeps two seeds' grids
// from reading as the same lattice.
const CELL_MIN = 560;
const CELL_MAX = 640;
// The plan always holds between these many cells, in two columns.
const CELLS_MIN = 4;
const CELLS_MAX = 6;
const COLS = 2;

// The river targets (world-scale-design.md, "Siting the river"): a 60 m
// corridor is 30 m of water, 7 m of bank and 8 m of setback, each side.
export const WATER_WIDTH = 30;
export const BANK_RUN = 7;
export const SETBACK = 8;
export const RIVER_CORRIDOR = WATER_WIDTH + 2 * BANK_RUN + 2 * SETBACK;

// The river runs past the built cells so it reads across the whole map; an
// arterial runs this far past them to meet whatever M5 lays outside.
const RIVER_OVERHANG = 300;
const ARTERIAL_MARGIN = 100;
const ARTERIAL_LANES = 4;

// The row bands, south (front) row first: full rows, then the remainder, so a
// five-cell town is 2 + 2 + 1 and never a hole in the middle.
function rowCounts(rand) {
  const count = rngInt(rand, CELLS_MIN, CELLS_MAX);
  const rows = count > CELLS_MIN ? 3 : 2;
  const counts = [];
  let left = count;
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(COLS, left - (rows - 1 - r));
    counts.push(inRow);
    left -= inRow;
  }
  return counts;
}

// District kinds, shuffled so a four-cell town shows all four and a six-cell
// town repeats two: never fewer than three kinds.
function kindList(rand, count) {
  const kinds = KINDS.slice();
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = rngInt(rand, 0, i);
    [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
  }
  return Array.from({ length: count }, (_, i) => kinds[i % kinds.length]);
}

// One cell's box and centre. Column c is centred on the town's own x = 0.
function makeCell(id, kind, c, cz, cellW, cellD) {
  const cx = roundHalf((c - (COLS - 1) / 2) * cellW);
  const box = {
    minX: roundHalf(cx - cellW / 2), maxX: roundHalf(cx + cellW / 2),
    minZ: roundHalf(cz - cellD / 2), maxZ: roundHalf(cz + cellD / 2),
  };
  return { id, kind, cx, cz, w: cellW, d: cellD, walk: { ...box }, drive: { ...box } };
}

// The river: the corridor band, the water band, and the water as the
// [cx, cz, half-width, half-depth] rects terrain.buildable reads.
function makeRiver(riverZ, minX, maxX) {
  return {
    z: riverZ,
    waterWidth: WATER_WIDTH,
    bankRun: BANK_RUN,
    setback: SETBACK,
    corridor: RIVER_CORRIDOR,
    minZ: roundHalf(riverZ - RIVER_CORRIDOR / 2),
    maxZ: roundHalf(riverZ + RIVER_CORRIDOR / 2),
    water: {
      minX: minX - RIVER_OVERHANG, maxX: maxX + RIVER_OVERHANG,
      minZ: roundHalf(riverZ - WATER_WIDTH / 2),
      maxZ: roundHalf(riverZ + WATER_WIDTH / 2),
    },
    rects: [[0, riverZ, (maxX - minX) / 2 + RIVER_OVERHANG, WATER_WIDTH / 2]],
  };
}

// The arterial grid: north-south lines along the column boundaries (they cross
// the river; M4.T7 makes each crossing a bridge) and east-west lines along the
// row boundaries, including both edges of the corridor.
function makeArterials(avenueXs, zLines, minX, maxX, minZ, maxZ) {
  const avenues = avenueXs.map((x, i) => ({
    id: `art-ns${i}`, kind: 'arterial', x,
    z0: roundHalf(minZ - ARTERIAL_MARGIN), z1: roundHalf(maxZ + ARTERIAL_MARGIN),
    lanes: ARTERIAL_LANES,
  }));
  const crossings = zLines.map((z, i) => ({
    id: `art-ew${i}`, kind: 'arterial', z: roundHalf(z),
    x0: roundHalf(minX - ARTERIAL_MARGIN), x1: roundHalf(maxX + ARTERIAL_MARGIN),
    lanes: ARTERIAL_LANES,
  }));
  return { avenues, crossings };
}

export function planTown(seed) {
  const rand = mulberry32(seed);
  const counts = rowCounts(rand);
  const cellW = roundHalf(CELL_MIN + rand() * (CELL_MAX - CELL_MIN));
  const cellD = roundHalf(CELL_MIN + rand() * (CELL_MAX - CELL_MIN));
  const kinds = kindList(rand, counts.reduce((a, b) => a + b, 0));
  // The river sits on a boundary between two row bands, so it always has cells
  // on both sides. Where the short final row leaves open land, water crosses it.
  const riverRow = rngInt(rand, 0, counts.length - 2);
  const depth = counts.length * cellD + RIVER_CORRIDOR;
  const zShift = -depth / 2;
  // Rows north of the river start above the corridor; the town centres on z = 0.
  const rowBase = (r) => r * cellD + (r > riverRow ? RIVER_CORRIDOR : 0) + zShift;
  const riverZ = roundHalf(rowBase(riverRow) + cellD + RIVER_CORRIDOR / 2);

  const cells = [];
  for (let r = 0; r < counts.length; r++) {
    for (let c = 0; c < counts[r]; c++) {
      const id = cells.length;
      cells.push(makeCell(id, kinds[id], c, rowBase(r) + cellD / 2, cellW, cellD));
    }
  }

  const minX = roundHalf(-cellW);
  const maxX = roundHalf(cellW);
  const minZ = roundHalf(zShift);
  const maxZ = roundHalf(zShift + depth);
  const zLines = new Set();
  for (let r = 0; r < counts.length; r++) {
    zLines.add(rowBase(r));
    zLines.add(rowBase(r) + cellD);
  }
  const sortedZ = [...zLines].sort((a, b) => a - b);
  return {
    seed,
    cellSize: { w: cellW, d: cellD },
    bounds: { minX, maxX, minZ, maxZ },
    cells,
    river: makeRiver(riverZ, minX, maxX),
    arterials: makeArterials([minX, 0, maxX], sortedZ, minX, maxX, minZ, maxZ),
  };
}
