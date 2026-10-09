// City view: the builder's hand. Z lifts the camera off the street to an oblique
// overview of the district, Z brings it back down to the player, and up there
// the player zones lots. One world, two scales, no loading screen: the sim
// never stops and the player's body stays where it stood.
//
// This file is the tool's state and nothing else — where the camera is heading,
// how far through the move it is, where the overview looks, what is in the
// brush, which lot is under the cursor and what each lot is doing. Pure data
// and pure maths (law 5). The camera and the lot outlines are
// render/cityview.js; the pointer, the palette and the readout are
// ui/cityview.js. What zoning does to a lot is sim/zoning.js (zoneParcel).
import { STAGE, builtHeight, capOf, capParcel, zoneParcel } from './zoning.js';
import { worldMap } from './patrol.js';
import { frontageRoad, nodeAt } from './map.js';
import { SERVICES, addRoad, bulldoze, placeService, removeRoad } from './ops.js';
import { MAX_ROAD_GRADIENT } from './terrain.js';
import { ROAD_HALF_WIDTH } from './world.js';

// Seconds for the whole rise, and for the whole descent.
const LIFT_SECS = 1.6;
// The overview is oblique — a Cities: Skylines distance, never a flat map and
// never the horizon. Radians above the ground; the drag moves inside the band.
export const TILT = { start: 1, min: 0.9, max: 1.25 };
// The lift as the camera blends it (render/cityview.js holds the camera's own
// curve and sim/ never imports render/): 0 on the street, 1 at the overview,
// eased in between. The planner's lot tint fades in on the same number.
export const easeLift = (lift) => lift * lift * (3 - 2 * lift);
// Metres from the camera to the point it looks at. It starts where all ten lots
// fit on screen from most headings; the wheel moves inside the band, whose far
// end keeps the top of the frame inside the camera's 400 m reach.
export const REACH = { start: 200, min: 60, max: 220 };
// Metres a second the overview pans at its start distance. It pans faster the
// further out it stands, so a keypress always crosses the same share of screen.
const PAN_SPEED = 60;
const HURRY_PAN = 2.2;

// ---------------------------------------------------------------------------
// The tool frame (M5.T1). A tool is what a brush key selects: the operation it
// runs, what it costs the city, the mark its cursor would draw, and the first
// reason it cannot act where it is pointed. Prices are provisional — M5.T17
// gives the city a budget and M5.T19 reads them for refusal — but the
// signatures already take the map and the parcel, so a metered cost (per metre
// of road, per floor) lands without changing the frame. `preview(at)` returns
// the mark render/cityview.js draws under the cursor from M5.T3 on.
const TOOL_PRICE = { res: 100, com: 120, ind: 150, unzone: 20 };

// The treasury the city's books hold (M5.T17), or null for a city whose economy
// has not opened them. The money is what a tool is weighed against here, in the
// one place a tool's cost is priced (M5-7), so the panel, the card and the act
// all read the same number.
const TREASURY = (city) => city?.economy?.budget?.money ?? null;

// The first reason the treasury cannot pay for `cost`, or null when it can. A
// tool the city cannot pay for says so rather than acting and going without.
export function moneyRefuse(city, cost) {
  const money = TREASURY(city);
  if (money === null || !Number.isFinite(cost)) return null;
  return money < cost ? `the city cannot pay $${cost}` : null;
}

// Would the books refuse this tool for want of money, right now (M5-7)? The
// panel, the help line and the card all read this one answer, so a tool the
// money cannot pay says so in the same words wherever it is named. The two
// placeholder-priced tools — a per-metre road, a per-height teardown — are not
// weighed yet: at those prices the opening treasury cannot pay for a street or
// for taking a tower down, which would refuse M5-1 outright. They follow when
// the budget meters them; the zone brushes and the services are priced and
// refuse today.
export function affordTool(city, tool) {
  return tool.money === false ? null : moneyRefuse(city, tool.cost(city, null));
}

function zoneTool(id, key, use, name, blurb) {
  return {
    id,
    key,
    use,
    name,
    blurb,
    // zoneParcel is the op until M5.T17 brings M3's logged ops into the city
    // view (M5.T19, M5.T26): it is the one that refuses non-lots and answers
    // whether the zoning changed.
    op: (map, at) => zoneParcel(map, map.parcels.indexOf(at), use),
    cost: (map, at) => TOOL_PRICE[id],
    preview: (at) => ({
      kind: use === null ? 'unzone' : `zone ${use}`,
      use,
      box: at && { x: at.x, z: at.z, w: at.w, d: at.d },
    }),
    refuse: (city, at) => {
      if (!at) return 'no lot under the cursor';
      if (at.kind !== 'lot') return `${at.kind} buildings are bulldozed, not rezoned`;
      if (at.zoned === use) return use === null ? 'already open land' : 'already zoned that';
      return moneyRefuse(city, TOOL_PRICE[id]);
    },
  };
}

// The road drag (M5.T3) is the one tool that is not a lot brush: a press on a
// road node, a drag along one axis on the half-metre grid, a release that hands
// the snapped ends to addRoad. It has no key yet — the palette picks it up.
// Its price is still M5.T3's per-metre placeholder, so `money: false` keeps the
// budget off it until the metre is priced (affordTool).
const ROAD_PRICE = 40;          // dollars per metre, until M5.T17 meters costs

export const ROAD_TOOL = {
  id: 'road',
  use: 'road',
  name: 'road',
  blurb: 'drags a new street into open land',
  drag: true,
  money: false,
  // Its price is per metre: the palette names the unit (ui/cityview.js) and the
  // drag card shows what the dragged length comes to.
  unit: '/m',
  cost: () => ROAD_PRICE,
};

// The bulldoze tool (M5.T5) is not a lot brush: its cursor holds a whole
// parcel or a road edge, and a click runs one stage of `bulldoze` or takes the
// edge out. Its per-height price is provisional like the road's.
const BULLDOZE_PRICE = { call: 25, height: 2, road: 6 };

export const BULLDOZE_TOOL = {
  id: 'bulldoze',
  use: 'bulldoze',
  name: 'bulldoze',
  blurb: 'tears down the building or road under the cursor',
  money: false,
  cost: (map, at) => {
    if (!at) return BULLDOZE_PRICE.call;
    if (at.kind === 'road') return Math.round((at.length ?? 0) * BULLDOZE_PRICE.road);
    return Math.round(BULLDOZE_PRICE.call + builtHeight(at.parcel ?? at) * BULLDOZE_PRICE.height);
  },
  refuse: (map, at) => {
    if (!at) return 'nothing under the cursor';
    if (at.kind === 'road') return null;
    const p = at.parcel ?? at;
    return p.kind === 'lot' && p.stage === STAGE.EMPTY ? 'already open land' : null;
  },
};

// A service tool (M5.T11): one per type in SERVICES, placing a finished
// service on an empty lot. The catchment radius and the capacity live with the
// service (sim/ops.js), not on the tool; the tool carries only what the click
// needs — what it refuses and what it costs. No key: the palette picks it up.
function serviceTool(type) {
  const def = SERVICES[type];
  return {
    id: type,
    use: type,
    type,
    name: def.name,
    blurb: `builds a ${def.name} on an empty lot`,
    cost: () => def.cost,
    refuse: (city, at) => {
      if (!at) return 'no lot under the cursor';
      if (at.kind === 'service') {
        return at.type === type
          ? `${def.name} already stands here`
          : `${SERVICES[at.type]?.name ?? 'a service'} already stands here`;
      }
      if (at.kind !== 'lot') return `${at.kind} buildings are bulldozed, not built over`;
      if (at.stage !== STAGE.EMPTY) return 'bulldoze the building first';
      return moneyRefuse(city, def.cost);
    },
    preview: (at) => ({
      kind: `service ${type}`,
      box: at && { x: at.x, z: at.z, w: at.w, d: at.d },
    }),
  };
}

export const TOOLS = {
  road: ROAD_TOOL,
  bulldoze: BULLDOZE_TOOL,
  res: zoneTool('res', 'r', 'res', 'residential', 'zones a lot for homes'),
  com: zoneTool('com', 'c', 'com', 'commercial', 'zones a lot for shops'),
  ind: zoneTool('ind', 'i', 'ind', 'industrial', 'zones a lot for works'),
  unzone: zoneTool('unzone', 'x', null, 'unzone', 'clears a lot back to open land'),
  ...Object.fromEntries(Object.keys(SERVICES).map((type) => [type, serviceTool(type)])),
};

// The city view's overlays (M5.T20), in the order the O key cycles them. The
// list is the frame's one place an overlay is named: render/overlays.js maps
// each id to the pooled lot tint it draws, and the later overlay tasks
// (M5.T29's pollution, M12/M14's views) append here. `off` is first so the view
// opens unpainted, exactly as the world looks today.
//
// The ring is the whole of it, not just this sim's own three: an overlay the O
// key cannot reach is an overlay the player never sees, so the data overlays
// (M5.T21) are named here too, where the wrap is counted.
export const OVERLAYS = [
  { id: 'off', name: 'no overlay' },
  { id: 'zone', name: 'zoning' },
  { id: 'status', name: 'growth' },
  // The five data overlays (M5.T21): the market, the power, the police, the
  // land's own worth and this hour's traffic. Each is the sim's number for the
  // lot; render/overlays.js shades it on the ramp its id names.
  { id: 'demand', name: 'demand' },
  { id: 'power', name: 'power' },
  { id: 'police', name: 'police cover' },
  { id: 'value', name: 'land value' },
  { id: 'traffic', name: 'traffic' },
  // One coverage overlay per service: how full the station covering the lot is.
  ...Object.keys(SERVICES).map((type) => ({ id: `cover:${type}`, name: `${SERVICES[type].name} cover` })),
];

// The overlay the view is on, never undefined: a save or a hand-written view
// without the field reads as off.
export function overlayOf(view) {
  return OVERLAYS[view.overlay] ?? OVERLAYS[0];
}

// O: the next overlay in the ring, wrapped, and the one now showing. The wrap
// is the whole ring (OVERLAYS.length), so a keypress past the last one comes
// home through every overlay on the way.
export function cycleOverlay(view) {
  view.overlay = ((view.overlay ?? 0) + 1) % OVERLAYS.length;
  return overlayOf(view);
}

// A tool names its own key (M5.T1), so the key table the panel and `cityKey`
// read is the frame's, not a second one to keep in step. `BRUSH_KEYS` stays the
// key -> use view the palette has always exported.
const keyed = Object.values(TOOLS).filter((tool) => tool.key);
const TOOL_BY_KEY = new Map(keyed.map((tool) => [tool.key, tool]));
export const BRUSH_KEYS = Object.fromEntries(keyed.map((tool) => [tool.key, tool.use]));

// The tool the brush holds, or null once the player puts it down.
export function toolOf(view) {
  if (view.active === false) return null;
  return view.brush === null ? TOOLS.unzone : TOOLS[view.brush] ?? null;
}

// Right click or Esc: the brush is set down and stops painting until a key
// picks one up again (M5.T1), and any road drag it was holding is dropped.
export function layDownTool(view) {
  view.active = false;
  view.drag = null;
  view.pick = null;
  view.confirm = null;
}

// The rise frames the lots, whichever corner of the district it starts from.
function lotCentre(city) {
  const xs = city.parcels.flatMap((p) => [p.x - p.w / 2, p.x + p.w / 2]);
  const zs = city.parcels.flatMap((p) => [p.z - p.d / 2, p.z + p.d / 2]);
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, z: (Math.min(...zs) + Math.max(...zs)) / 2 };
}

// Where a lot is on its way from empty to tower, as one number. Its change
// from one frame to the next is the only honest answer to "is it growing?":
// the rules that move it belong to sim/zoning.js and are not repeated here.
const levelOf = (p) => p.stage + p.progress;

export function createCityView(city, map = worldMap()) {
  const home = lotCentre(city);
  const view = {
    mode: 'street',        // where the camera is heading: 'street' or 'city'
    lift: 0,               // 0 on the street rig, 1 at the overview
    home,
    x: home.x,             // the overview's pivot on the ground
    z: home.z,
    // The map's own buildable box: the generated town's graph box plus its
    // build margin (map.js M5.T3b), so the pan reaches the land a road drag can
    // use; the hand preset keeps its district floor.
    bounds: map.bounds ?? map.district.walk,
    yaw: 0,
    tilt: TILT.start,
    reach: REACH.start,
    brush: 'res',
    overlay: 0,            // the overlay the O key cycles (M5.T20): OVERLAYS
    active: true,          // false once the player lays the tool down
    shift: false,          // Shift held: a brush click paints a low cap (M5.T8)
    hover: -1,
    drag: null,            // the road drag's snapped ends, while one is held
    pick: null,            // the bulldoze cursor: a parcel or a road edge (M5.T5)
    confirm: null,         // a road removal waiting on the page's ask (M5.T5)
    level: city.parcels.map(levelOf),
    trend: city.parcels.map(() => 0),
  };
  WORLDS.set(view, { city, map });
  return view;
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Z. Going up starts a fresh overview over the lots, facing the way the street
// camera faced, so the rise is one continuous move. Reversing mid-move keeps
// the overview it had.
export function toggleCityView(view, streetYaw) {
  if (view.mode === 'city') {
    view.mode = 'street';
    view.hover = -1;
    view.drag = null;
    view.pick = null;
    view.confirm = null;
    return;
  }
  view.mode = 'city';
  if (view.lift > 0) return;
  view.x = view.home.x;
  view.z = view.home.z;
  view.yaw = streetYaw;
  view.tilt = TILT.start;
  view.reach = REACH.start;
}

// Every key this track owns. Returns whether the key was city view's.
export function cityKey(view, key, streetYaw) {
  if (key === 'z') {
    toggleCityView(view, streetYaw);
    return true;
  }
  // O cycles the lot overlays (M5.T20). The state is the view's, so the key
  // lands wherever it is pressed; the tint only shows from the overview.
  if (key === 'o') {
    cycleOverlay(view);
    return true;
  }
  const tool = view.mode === 'city' ? TOOL_BY_KEY.get(key) : null;
  if (!tool) return false;
  chooseTool(view, tool);
  return true;
}

// Picking a tool up is one rule, wherever it comes from — its key (cityKey) or
// its panel row (ui/cityview.js).
export function chooseTool(view, tool) {
  view.brush = tool.use;
  view.active = true;
  view.pick = null;
  view.confirm = null;
}

export function chooseBrush(view, use) {
  const tool = use === null ? TOOLS.unzone : TOOLS[use];
  if (tool) chooseTool(view, tool);
}

// A drag in the overview: sideways orbits, up and down tilts inside the band.
export function orbitCityView(view, dYaw, dTilt) {
  view.yaw += dYaw;
  view.tilt = clamp(view.tilt + dTilt, TILT.min, TILT.max);
}

export function zoomCityView(view, factor) {
  view.reach = clamp(view.reach * factor, REACH.min, REACH.max);
}

export function hoverLot(view, index) {
  view.hover = view.mode === 'city' ? index : -1;
}

// The bulldoze cursor (M5.T5): the parcel or road edge the renderer's picker
// found. A lot among them keeps the old hover too, so its kerbs light and the
// readout reads it; a building or a road has no lot index.
export function hoverPick(view, city, target) {
  view.pick = view.mode === 'city' ? target ?? null : null;
  if (view.mode === 'city') {
    view.hover = target?.kind === 'parcel' ? city.parcels.indexOf(target.parcel) : -1;
  }
}

// A click: the tool goes on the lot under the cursor, or — with the bulldozer —
// on the whole parcel or road the cursor holds. Returns whether the world
// changed. A tool the player put down acts nowhere. `shift` is the cap brush
// (M5.T8): a zone tool paints the lot low-rise, the eraser lifts the cap back
// off. It lands even where the zone itself is already set, so a lot the player
// has no reason to rezone can still be capped.
export function paintLot(view, city, shift = view.shift) {
  if (view.mode !== 'city' || view.lift < 1) return false;
  const tool = toolOf(view);
  if (!tool || tool.drag) return false;
  if (tool === BULLDOZE_TOOL) return demolish(view, city, WORLDS.get(view).map);
  if (tool.type) return buildService(view, city, tool);
  if (view.hover < 0) return false;
  const at = city.parcels[view.hover];
  const zoned = tool.refuse(city, at) ? false : tool.op(city, at);
  const capped = shift ? capParcel(city, view.hover, tool.use === null ? STAGE.HIGH : STAGE.LOW) : false;
  return zoned || capped;
}

// A service is an op on the map (M5.T11): the map owns the version, the dirty
// tiles and the undo, and the lot keeps its object in the city's own list, so
// the renderer and the interior read the service the same frame it lands.
function buildService(view, city, tool) {
  const { map } = WORLDS.get(view);
  const at = view.hover >= 0 ? city.parcels[view.hover] : null;
  if (tool.refuse(city, at)) return false;
  const version = map.version;
  placeService(map, at, tool.type);
  return map.version !== version;
}

// ---------------------------------------------------------------------------
// The road drag (M5.T3). A press grabs the road node nearest the cursor; the
// drag runs along one axis on the half-metre grid (ops.js); the release hands
// the snapped ends to addRoad. roadPreview() feeds the mark render/cityview.js
// draws and the metres ui/cityview.js shows.
const ROAD_PICK = 12;           // metres from the press to the node it may grab
const ROAD_MIN = 4;             // metres: shorter than this is a misclick
const ROAD_GRID = 0.5;          // the grid the road graph stands on (ops.js)
const ROAD_SAMPLE = 4;          // metres between ground samples along a drag
const WORLDS = new WeakMap();   // view -> { city, map }, for the road op

const onGrid = (v) => Math.round(v / ROAD_GRID) * ROAD_GRID;

// The live city grows the lots in city.parcels; the map is the whole record,
// and a road op plans new lots into map.parcels (ops.js). Sign them in too,
// and keep the services the player placed (M5.T11) in the live list so their
// doors and rooms stay with the city across a road op.
function adoptLots(view, city, map) {
  const lots = (map.parcels ?? []).filter((p) => p.kind === 'lot' || p.kind === 'service');
  city.parcels.length = 0;
  city.parcels.push(...lots);
  view.level = lots.map(levelOf);
  view.trend = lots.map(() => 0);
  view.hover = -1;
  view.pick = null;
}

// The map a view edits (M5.T5): the op runs on it, the picker reads its parcels.
export function mapOf(view) {
  return WORLDS.get(view)?.map ?? null;
}

// Every standing building left without a road if `edge` went (M5.T5): the same
// frontage test removeRoad reconciles with, run with the edge out and put back.
export function roadCutsOff(map, edge) {
  const at = map.graph.edges.indexOf(edge);
  if (at < 0) return [];
  map.graph.edges.splice(at, 1);
  const byId = new Map(map.graph.nodes.map((n) => [n.id, n]));
  const cut = (map.parcels ?? []).filter((p) => (p.kind !== 'lot' || p.stage > STAGE.EMPTY)
    && frontageRoad(map, p, byId) === null);
  map.graph.edges.splice(at, 0, edge);
  return cut;
}

// Taking an edge out: the page is asked first when buildings would be stranded.
function takeRoad(view, city, map, edge, confirmed) {
  if (!confirmed) {
    const cuts = roadCutsOff(map, edge);
    if (cuts.length > 0) {
      view.confirm = { edge, cuts: cuts.length };
      return false;
    }
  }
  const version = map.version;
  removeRoad(map, edge);
  if (map.version === version) return false;
  adoptLots(view, city, map);
  return true;
}

// One bulldoze click (M5.T5): the building comes down a stage, or the road
// goes. A parcel fully down keeps its id and stays live as an empty lot.
function demolish(view, city, map) {
  const target = view.pick;
  if (!target) return false;
  if (target.kind === 'road') return takeRoad(view, city, map, target.edge, false);
  const version = map.version;
  bulldoze(map, target.parcel);
  if (map.version === version) return false;
  adoptLots(view, city, map);
  return true;
}

// The page's yes on the road ask (M5.T5): now take it out.
export function confirmRoad(view, city) {
  const { map } = WORLDS.get(view);
  const ask = view.confirm;
  view.confirm = null;
  return ask ? takeRoad(view, city, map, ask.edge, true) : false;
}

// The page's no: the road stays where it is.
export function dismissRoad(view) {
  view.confirm = null;
}

// The carriageway's footprint: the drag line swept half a road to each side.
function roadBand(from, to, axis) {
  const half = ROAD_HALF_WIDTH;
  return axis === 'x'
    ? { minX: Math.min(from.x, to.x), maxX: Math.max(from.x, to.x), minZ: from.z - half, maxZ: from.z + half }
    : { minX: from.x - half, maxX: from.x + half, minZ: Math.min(from.z, to.z), maxZ: Math.max(from.z, to.z) };
}

const overlaps = (b, x0, x1, z0, z1) => b.minX < x1 && b.maxX > x0 && b.minZ < z1 && b.maxZ > z0;

// Is the ground under the drag steeper than a road may climb? A road grades its
// own corridor, so it takes the hills M4.T6 laid down; only a cliff refuses.
function roadTooSteep(map, from, to) {
  const heightAt = map.terrain?.heightAt;
  if (!heightAt) return false;
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(len / ROAD_SAMPLE));
  let prev = heightAt(from.x, from.z);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const h = heightAt(from.x + (to.x - from.x) * t, from.z + (to.z - from.z) * t);
    if (Math.abs(h - prev) > MAX_ROAD_GRADIENT * (len / steps)) return true;
    prev = h;
  }
  return false;
}

// A drag that doubles a road lays nothing, so the preview must say so.
function roadDoubles(map, from, to, axis) {
  const at = (id) => map.graph.nodes.find((n) => n.id === id);
  return map.graph.edges.some((e) => {
    const a = at(e.a);
    const b = at(e.b);
    if (!a || !b) return false;
    const fixed = axis === 'x' ? a.z === b.z && a.z === from.z : a.x === b.x && a.x === from.x;
    if (!fixed) return false;
    const lo = axis === 'x' ? Math.min(a.x, b.x) : Math.min(a.z, b.z);
    const hi = axis === 'x' ? Math.max(a.x, b.x) : Math.max(a.z, b.z);
    const d0 = axis === 'x' ? Math.min(from.x, to.x) : Math.min(from.z, to.z);
    const d1 = axis === 'x' ? Math.max(from.x, to.x) : Math.max(from.z, to.z);
    return lo < d1 && hi > d0;
  });
}

// The first reason a straight road between the snapped ends cannot stand.
function roadRefuse(map, from, to, axis) {
  const band = roadBand(from, to, axis);
  const wet = (map.water ?? []).some(([cx, cz, hw, hd]) => overlaps(band, cx - hw, cx + hw, cz - hd, cz + hd));
  if (wet) return 'over water';
  const blocked = (map.parcels ?? []).some((p) => (p.kind !== 'lot' || p.stage > 0)
    && overlaps(band, p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2));
  if (blocked) return 'through buildings';
  if (roadTooSteep(map, from, to)) return 'too steep';
  if (roadDoubles(map, from, to, axis)) return 'already a road';
  return null;
}

// The drag's live numbers, or null when no drag is on.
export function roadPreview(view) {
  const d = view.drag;
  if (!d) return null;
  const reason = d.length < ROAD_MIN
    ? `drag at least ${ROAD_MIN} m`
    : roadRefuse(WORLDS.get(view).map, d.from, d.to, d.axis);
  return { ...d, cost: Math.round(d.length * ROAD_PRICE), reason };
}

// A press with the road tool: grab the road node nearest the ground point.
export function pressRoad(view, x, z) {
  if (view.mode !== 'city' || view.lift < 1) return false;
  const hit = nodeAt(WORLDS.get(view).map, x, z);
  if (!hit || hit.dist > ROAD_PICK) return false;
  const n = hit.node;
  view.drag = { from: { x: n.x, z: n.z }, to: { x: n.x, z: n.z }, axis: null, length: 0 };
  return true;
}

// The drag's free end: the ground point on the dominant axis, grid-snapped.
export function moveRoad(view, x, z) {
  const d = view.drag;
  if (!d) return;
  const axis = Math.abs(x - d.from.x) >= Math.abs(z - d.from.z) ? 'x' : 'z';
  d.axis = axis;
  d.to = axis === 'x' ? { x: onGrid(x), z: d.from.z } : { x: d.from.x, z: onGrid(z) };
  d.length = Math.abs(d.to.x - d.from.x) + Math.abs(d.to.z - d.from.z);
}

// The release: addRoad on the snapped ends, then sign its new lots into the
// live city. A refused drag is dropped without touching the map.
export function releaseRoad(view) {
  const preview = roadPreview(view);
  view.drag = null;
  if (!preview || preview.reason) return false;
  const { map, city } = WORLDS.get(view);
  const version = map.version;
  addRoad(map, preview.from, preview.to);
  if (map.version === version) return false;
  adoptLots(view, city, map);
  return true;
}
// WASD pans the overview, relative to the way it faces, the same axes the
// player walks on. The pivot stays over the district floor.
function pan(view, keys, dt) {
  const ahead = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
  const right = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
  if (!ahead && !right) return;
  const len = Math.hypot(ahead, right);
  const step = (PAN_SPEED * (view.reach / REACH.start) * (keys.has('shift') ? HURRY_PAN : 1) * dt) / len;
  const fx = Math.sin(view.yaw);
  const fz = Math.cos(view.yaw);
  view.x = clamp(view.x + (fx * ahead - fz * right) * step, view.bounds.minX, view.bounds.maxX);
  view.z = clamp(view.z + (fz * ahead + fx * right) * step, view.bounds.minZ, view.bounds.maxZ);
}

// After tickZoning, every frame. `keys` is the set of held keys, lower-case.
export function tickCityView(view, city, dt, keys) {
  // Shift held is the cap brush (M5.T8): the held key reaches the click through
  // here, where the frame loop already reads it for the hurried pan.
  view.shift = keys.has('shift');
  const goal = view.mode === 'city' ? 1 : 0;
  const step = dt / LIFT_SECS;
  view.lift = goal > view.lift ? Math.min(goal, view.lift + step) : Math.max(goal, view.lift - step);
  if (view.mode === 'city') pan(view, keys, dt);
  city.parcels.forEach((p, i) => {
    const level = levelOf(p);
    view.trend[i] = Math.sign(level - view.level[i]);
    view.level[i] = level;
  });
}

// What a lot is doing, in the terms the readout shows (pillar 5): one of
// 'clearing' (its building does not match its zoning and is coming down),
// 'stalled' (no power: the zone is blacked out), 'growing', 'declining',
// 'complete', 'waiting' (zoned, but the market is not there yet) or 'unzoned'.
export function lotStatus(view, city, index, dark) {
  const p = city.parcels[index];
  const settled = p.use === p.zoned;
  if (settled && p.zoned === null) return 'unzoned';
  // A lot at its cap is as finished as it will ever be, not waiting on demand.
  if (settled && p.stage >= capOf(p) && view.trend[index] === 0) return 'complete';
  if (dark) return 'stalled';
  if (!settled) return 'clearing';
  if (view.trend[index] > 0) return 'growing';
  if (view.trend[index] < 0) return 'declining';
  return 'waiting';
}
