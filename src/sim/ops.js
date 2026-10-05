// What the player builds: edits on the map (M3.T18). Three building ops — zone,
// bulldoze and place — each acts on one parcel, bumps map.version, marks the
// 64 m tiles the parcel's footprint touches and returns its own undo. The undo
// restores the parcel and the version and leaves the same tiles dirty, so a run
// of ops can be walked backwards to the map it started on (M3-4).
//
// An op is pure logic on the map (law 5) and deterministic given its state, so
// the save's op log (M3.T38) replays. Road ops join these in M3.T19.
import { STAGE, USES, USE_BY_KIND, markDirty } from './map.js';

// A placed building is sized from its footprint with the rule the city rolls
// for a lot (zoning.js makeParcel): three storeys at the least, slender enough
// to stand, inside the band the shipped towers use. The roll's jitter is left
// out — an op is deterministic. The stage profile lets a later bulldoze step
// the height down a stage at a time instead of holding the top until it goes
// (M5-2).
const STOREY = 3.5;
const LOW_HEIGHT = 3 * STOREY;
const SLENDERNESS = 3.6;
const TOP_MIN = 22;
const TOP_MAX = 46;
const MID_SHARE = 0.45;

function topFor(w, d) {
  return Math.min(TOP_MAX, Math.max(TOP_MIN, Math.min(w, d) * SLENDERNESS));
}

function stagedHeights(top) {
  return [0, 0, LOW_HEIGHT, LOW_HEIGHT + (top - LOW_HEIGHT) * MID_SHARE, top];
}

// A parcel by object (the live city's own entry), index or id.
function parcelOf(map, ref) {
  if (typeof ref === 'number') return map.parcels[ref] ?? null;
  if (ref && typeof ref === 'object' && map.parcels.includes(ref)) return ref;
  const id = ref && typeof ref === 'object' ? ref.id : ref;
  return map.parcels.find((p) => p.id === id) ?? null;
}

function parcelBox(p) {
  return { minX: p.x - p.w / 2, maxX: p.x + p.w / 2, minZ: p.z - p.d / 2, maxZ: p.z + p.d / 2 };
}

// Undo histories live beside the maps, keyed weakly, so the map itself carries
// only game state: mapHash must not see a log of how it got there.
const HISTORY = new WeakMap();

function history(map) {
  let stack = HISTORY.get(map);
  if (!stack) {
    stack = [];
    HISTORY.set(map, stack);
  }
  return stack;
}

const NOOP = () => {};

// Apply one change as an edit: snapshot the parcel, bump the version, mark the
// touched tiles and return the closure that puts all three back.
function edit(map, p, change) {
  const before = { ...p };
  const version = map.version;
  change(p);
  map.version = version + 1;
  markDirty(map, parcelBox(p));
  const reverse = () => {
    for (const key of Object.keys(p)) delete p[key];
    Object.assign(p, before);
    map.version = version;
    markDirty(map, parcelBox(p));
  };
  history(map).push(reverse);
  return reverse;
}

// Zone a parcel's land the way the city view does: the lot answers over the
// ticks that follow (zoning.js clearLot/growth), it does not change here. `use`
// null unzones. Any parcel can be zoned; only a lot grows by itself.
export function zone(map, ref, use) {
  const p = parcelOf(map, ref);
  if (!p || (use !== null && !USES.includes(use)) || p.zoned === use) return NOOP;
  return edit(map, p, (q) => {
    q.zoned = use;
    if (use !== null) q.painted = true;
  });
}

// One stage down, the step clearLot takes over time: a finished tower becomes
// MID, then LOW, then a SITE, and at EMPTY its land is an empty lot keeping the
// use its zoning last named. A lot's profile already steps; a standing
// building's flat one is restaged so its height follows it down.
export function bulldoze(map, ref) {
  const p = parcelOf(map, ref);
  if (!p || p.stage === STAGE.EMPTY) return NOOP;
  return edit(map, p, (q) => {
    if (q.kind !== 'lot' && q.heights[STAGE.LOW] === q.heights[STAGE.HIGH]) {
      q.heights = stagedHeights(q.heights[STAGE.HIGH] > 0 ? q.heights[STAGE.HIGH] : topFor(q.w, q.d));
    }
    q.stage -= 1;
    q.progress = 0;
    q.building = q.stage > STAGE.EMPTY;
    if (q.stage === STAGE.EMPTY) {
      q.kind = 'lot';
      q.use = q.zoned;
    }
  });
}

// A finished building of `kind` on a parcel: it stands at HIGH, keeps the
// parcel's own top height (or takes one from its footprint) and carries the
// use its kind names. The empty lot is bulldoze's job, so 'lot' is refused.
export function place(map, kind, ref) {
  const p = parcelOf(map, ref);
  if (!p || typeof kind !== 'string' || !kind || kind === 'lot') return NOOP;
  const top = p.heights[STAGE.HIGH] > 0 ? p.heights[STAGE.HIGH] : topFor(p.w, p.d);
  return edit(map, p, (q) => {
    q.kind = kind;
    q.stage = STAGE.HIGH;
    q.progress = 0;
    q.building = false;
    q.heights = stagedHeights(top);
    q.use = USE_BY_KIND[kind] ?? USES[0];
    q.zoned = q.use;
    q.painted = false;
  });
}

// Undo the last op on a map. The handle an op returned does the same; this is
// for a caller that kept only the map (the city view's Ctrl+Z, M5-7).
export function undo(map) {
  const stack = HISTORY.get(map);
  if (!stack || stack.length === 0) return false;
  stack.pop()();
  return true;
}
