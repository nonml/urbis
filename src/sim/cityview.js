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
// ui/cityview.js. What zoning does to a lot is sim/ops.js (zone); what a
// junction control does to the traffic is sim/traffic.js, whose own record on
// the map the click writes (M5.T31).
import { STAGE, builtHeight, capOf, capParcel, zoneParcel } from './zoning.js';
import { worldMap } from './patrol.js';
import { frontageRoad, nodeAt, ROAD_TYPES, roadTypeOf } from './map.js';
import {
  JUNCTION_CONTROLS, junctionControl, junctionWait, setJunctionControl,
} from './traffic.js';
import {
  SERVICES, addRoad, bulldoze, placeService, removeRoad, undo, upgradeCost, upgradeRoad,
  zone as zoneOp,
} from './ops.js';
import { lockRefuse, milestoneOf, populationOf } from './milestones.js';
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

// ---------------------------------------------------------------------------
// The charge and the refund (M5.T26, M5-7). An act is charged what its tool
// costs the moment it lands, and Ctrl+Z walks it back through M3's own undo
// (ops.js) and refunds the charge in full while the act is still inside
// UNDO_SECS of game time. The window is the mistake's, not the decision's: a
// rezone ten seconds later is a plan, and it stands, charged.
const UNDO_SECS = 10;

// How many ops ran, which is 0 when the map did not move: an op that was
// refused leaves the version where it was (ops.js), so the version's move is
// both how a click knows an act happened and how much of the map's history the
// act pushed (a road drag of an avenue is one act and two ops).
function moved(map, op) {
  const version = map.version;
  op();
  return map.version - version;
}

// What a tool charges the treasury: nothing for a tool the books do not meter
// — a per-metre road, a per-height teardown — whose prices stay provisional.
const priceOf = (tool, map, at) => (tool.money === false ? 0 : tool.cost(map, at));

// Charge the city for an act and remember it as the one Ctrl+Z takes back: its
// cost, its hour and the map version it started on.
function chargeAct(view, city, cost, version) {
  const books = city?.economy?.budget;
  if (!books || !Number.isFinite(cost)) return;
  if (cost > 0) books.money -= cost;
  view.act = { at: books.time, cost, version };
}

// Ctrl+Z in the overview: the last act undone and its cost refunded in full.
// Nothing to take back, or an act past the window, is nothing at all.
export function undoAct(view, city) {
  const act = view.act;
  view.act = null;
  const books = city?.economy?.budget;
  if (!act || !books || books.time - act.at > UNDO_SECS) return false;
  const { map } = WORLDS.get(view);
  // Back to the version the act started on, and no further: the act's own ops,
  // never a click the player made before it.
  let took = false;
  while (map.version > act.version) {
    if (!undo(map)) break;
    took = true;
  }
  if (!took) return false;
  if (act.cost > 0) books.money += act.cost;
  return true;
}

function zoneTool(id, key, use, name, blurb) {
  return {
    id,
    key,
    use,
    name,
    blurb,
    // A brush marks the lot tools a drag zones across (M5.T33): the road, the
    // bulldozer, the services and the junction controls hold no stroke.
    brush: true,
    // M3's own zone op (ops.js) is the act: it refuses non-lots, answers
    // whether the zoning changed and leaves the undo Ctrl+Z walks back
    // (M5.T26). A map that logs no op — the hand preset, which has no dirty
    // tiles for one to mark and takes no other op either — is zoned in place,
    // lot for lot, as it always was.
    op: (map, at) => (map.dirty ? zoneOp(map, at, use)
      : zoneParcel(map, map.parcels.indexOf(at), use)),
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

// ---------------------------------------------------------------------------
// The zone stroke (M5.T33). A brush is held and the mouse dragged: every empty
// lot the stroke crosses is zoned on the release, for the brush's price each,
// and the stroke is charged as one act, so Ctrl+Z takes the whole of it back in
// one press (M5.T26). Its total cost is on the card before the release, the way
// the road drag's length and cost are (roadPreview).
const STROKE_SAMPLE = 4;   // metres between the ground samples along a stroke

// Land a brush may paint in a stroke: an empty lot whose zoning would change
// today. A lot already zoned for this use is not crossed twice, and a lot with a
// building on it is not a zone brush's to move.
const paintable = (p, use) => p.kind === 'lot' && p.stage === STAGE.EMPTY && p.zoned !== use;

// The empty lots a stroke from `from` to `to` crosses, in the order the brush
// meets them. A lot is one lot however many samples land inside it.
export function strokeLots(city, from, to, use) {
  const len = Math.hypot(to.x - from.x, to.z - from.z);
  const steps = Math.max(1, Math.ceil(len / STROKE_SAMPLE));
  const met = new Set();
  const lots = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const hit = city.parcels.find((p) => paintable(p, use)
      && Math.abs(x - p.x) <= p.w / 2 && Math.abs(z - p.z) <= p.d / 2);
    if (hit && !met.has(hit)) {
      met.add(hit);
      lots.push(hit);
    }
  }
  return lots;
}

// A press with a brush held starts a stroke on the ground under it. Any other
// tool holds no stroke, and a drag is still the overview's orbit without one.
export function pressStroke(view, x, z) {
  if (view.mode !== 'city' || view.lift < 1) return false;
  const tool = toolOf(view);
  if (!tool?.brush) return false;
  view.stroke = { from: { x, z }, to: { x, z }, use: tool.use };
  return true;
}

// The stroke's free end, at wherever the cursor's ground point is now.
export function moveStroke(view, x, z) {
  if (view.stroke) view.stroke.to = { x, z };
}

// The stroke's live numbers for the card: the empty lots it crosses, what they
// cost and the first reason the treasury cannot pay for them. The price is the
// brush's own, so the card names the zoning the release paints.
export function strokePreview(view, city) {
  const s = view.stroke;
  if (!s) return null;
  const tool = toolOf(view);
  const lots = strokeLots(city, s.from, s.to, s.use);
  const cost = lots.length * tool.cost(city, null);
  return { lots, count: lots.length, cost, reason: moneyRefuse(city, cost) };
}

// The release: every empty lot the stroke crossed is zoned, and the stroke is
// charged once what its lots cost. A city that cannot pay for the whole stroke
// has said so on the card, and lands none of it, as a click refuses the same way.
export function releaseStroke(view, city) {
  const preview = strokePreview(view, city);
  view.stroke = null;
  if (!preview || preview.reason || preview.count === 0) return false;
  const { map } = WORLDS.get(view);
  const tool = toolOf(view);
  const version = map.version;
  let painted = 0;
  for (const at of preview.lots) {
    const was = at.zoned;
    tool.op(map, at);
    if (at.zoned !== was) painted += 1;
  }
  if (!painted) return false;
  chargeAct(view, city, priceOf(tool, map, null) * painted, version);
  return true;
}

// The road drag (M5.T3) is the one tool that is not a lot brush: a press on a
// road node, a drag along one axis on the half-metre grid, a release that hands
// the snapped ends to addRoad. The drag picks a type (M5.T25, M5-10): the
// palette holds a row per road type, and the row holds the drag, the price per
// metre and the cross-section the road is drawn at. Prices are ROAD_TYPES' own
// per metre; `money: false` keeps the budget off the drag until the metre is
// metered, as it has been since M5.T3 — at these prices the opening treasury
// cannot pay for a street, which would refuse M5-1 outright.
const ROAD_TOOL = (id, type) => {
  const def = ROAD_TYPES[type];
  return {
    id,
    use: id,
    type,
    name: def.name,
    blurb: `drags a new ${def.name} into open land`,
    drag: true,
    money: false,
    unit: '/m',
    cost: () => def.cost,
  };
};

// The street is the palette's own row, so the id the panel has always given the
// road tool stays with the two-lane street; an avenue and a one-way are the two
// rows beside it. A held tool's `type` is what it lays.
const ROAD_TOOL_STREET = ROAD_TOOL('road', 'street');
const ROAD_TOOL_AVENUE = ROAD_TOOL('avenue', 'avenue');
const ROAD_TOOL_ONEWAY = ROAD_TOOL('oneway', 'oneway');
export const ROAD_TOOLS = [ROAD_TOOL_STREET, ROAD_TOOL_AVENUE, ROAD_TOOL_ONEWAY];

// The half-width a road type is drawn and refused at: a lane is
// ROAD_HALF_WIDTH's metres, so a street's two stand 3.5 m each side of its
// centre line and an avenue's four twice as far. One number, so the drag
// refuses at the width the pools then draw.
const halfWidth = (type) => ((ROAD_TYPES[type]?.lanes ?? 2) / 2) * ROAD_HALF_WIDTH;

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

// The junction controls (M5.T31, M5-14), named once: the palette's chips, the
// cursor's card and the traffic's own answer all read these words. A city's
// junctions are its own to run, so a control costs nothing.
const CONTROL_TEXT = {
  lights: { name: 'traffic lights', blurb: 'runs a two-phase light at a junction' },
  stop: { name: 'stop sign', blurb: 'holds every car at the line' },
  yield: { name: 'yield', blurb: 'holds a car only for traffic it would cross' },
};

// A junction control tool: a click on a junction sets it to the control this
// tool holds (sim/traffic.js setJunctionControl), and does nothing where there
// is no junction under the cursor.
const junctionTool = (id) => ({
  id,
  use: id,
  name: CONTROL_TEXT[id].name,
  blurb: CONTROL_TEXT[id].blurb,
  junction: true,
  money: false,
  cost: () => 0,
  refuse: (city, at) => (at ? null : 'no junction under the cursor'),
  preview: (at) => ({ kind: `junction to ${CONTROL_TEXT[id].name}`, use: id }),
});

export const JUNCTION_TOOLS = JUNCTION_CONTROLS.map(junctionTool);

// A service tool (M5.T11): one per type in SERVICES, placing a finished
// service on an empty lot. The catchment radius and the capacity live with the
// service (sim/ops.js), not on the tool; the tool carries only what the click
// needs — what it refuses and what it costs. No key: the palette picks it up.
function serviceTool(type) {
  const def = SERVICES[type];
  const tool = {
    id: type,
    use: type,
    type,
    name: def.name,
    blurb: `builds a ${def.name} on an empty lot`,
    cost: () => def.cost,
    // Every reason this click will not act, in one line (M5-7 priced them and
    // M5-12's tiers add one): a city that has not the people for a police
    // station says so, and so does a treasury that cannot pay for it. A player
    // refused both should not be told half of it.
    refuse: (city, at) => both(siteRefuse(def, type, at) ?? moneyRefuse(city, def.cost),
      lockRefuse(tool, populationOf(city))),
    preview: (at) => ({
      kind: `service ${type}`,
      box: at && { x: at.x, z: at.z, w: at.w, d: at.d },
    }),
  };
  return tool;
}

// Why a service cannot stand where the cursor points, or null when the site is
// clear and only the money and the tier stand in the way.
function siteRefuse(def, type, at) {
  if (!at) return 'no lot under the cursor';
  if (at.kind === 'service') {
    return at.type === type
      ? `${def.name} already stands here`
      : `${SERVICES[at.type]?.name ?? 'a service'} already stands here`;
  }
  if (at.kind !== 'lot') return `${at.kind} buildings are bulldozed, not built over`;
  return at.stage !== STAGE.EMPTY ? 'bulldoze the building first' : null;
}

// The two reasons a tool refuses, as the one line the card shows: the tier the
// city has not the people for (M5.T30) beside whatever else stands in the way.
const both = (why, locked) => (why && locked ? `${why} · ${locked}` : why ?? locked);

export const TOOLS = {
  road: ROAD_TOOL_STREET,
  avenue: ROAD_TOOL_AVENUE,
  oneway: ROAD_TOOL_ONEWAY,
  bulldoze: BULLDOZE_TOOL,
  res: zoneTool('res', 'r', 'res', 'residential', 'zones a lot for homes'),
  com: zoneTool('com', 'c', 'com', 'commercial', 'zones a lot for shops'),
  ind: zoneTool('ind', 'i', 'ind', 'industrial', 'zones a lot for works'),
  unzone: zoneTool('unzone', 'x', null, 'unzone', 'clears a lot back to open land'),
  ...Object.fromEntries(Object.keys(SERVICES).map((type) => [type, serviceTool(type)])),
  ...Object.fromEntries(JUNCTION_TOOLS.map((tool) => [tool.id, tool])),
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
  // The sixth data overlay (M5.T29): the pollution field, clean air to soot.
  { id: 'pollution', name: 'pollution' },
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
// picks one up again (M5.T1), and any road drag or zone stroke it was holding
// is dropped.
export function layDownTool(view) {
  view.active = false;
  view.drag = null;
  view.stroke = null;
  view.pick = null;
  view.road = null;
  view.junction = null;
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
    stroke: null,          // the zone stroke's ends, while one is dragged (M5.T33)
    pick: null,            // the bulldoze cursor: a parcel or a road edge (M5.T5)
    road: null,            // the road a road tool holds under its cursor (M5.T25)
    junction: null,        // the junction a control tool holds (M5.T31)
    confirm: null,         // a road removal waiting on the page's ask (M5.T5)
    act: null,             // the last act, with its cost and its hour (M5.T26)
    level: city.parcels.map(levelOf),
    trend: city.parcels.map(() => 0),
    // The population tier the city stands on (M5.T30), and the tier note the
    // screen is still saying: { tier, at }. Settled by the first tick.
    tier: null,
    unlock: null,
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
    view.stroke = null;
    view.pick = null;
    view.road = null;
    view.junction = null;
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
  view.drag = null;
  view.stroke = null;
  view.pick = null;
  view.road = null;
  view.junction = null;
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

// The junction under the cursor (M5.T31): the node nearest the ground point
// that two ways meet at, with the control it runs and what it has cost the cars
// that crossed it. It is a control tool's own cursor — a zone brush, a road
// drag and the bulldozer never hold one — so a junction cursor and a lot cursor
// are never both live.
const JUNCTION_PICK = 14;   // metres from the cursor to the node it may grab

export function hoverJunction(view, city, at, traffic) {
  hoverLot(view, -1);
  hoverPick(view, city, null);
  view.junction = null;
  if (!at || !traffic || !toolOf(view)?.junction) return null;
  if (view.mode !== 'city' || view.lift < 1) return null;
  const hit = nodeAt(WORLDS.get(view).map, at.x, at.z);
  if (!hit || hit.dist > JUNCTION_PICK) return null;
  const control = junctionControl(traffic, hit.node.id);
  if (control === null) return null;
  view.junction = { id: hit.node.id, control, wait: junctionWait(traffic, hit.node.id) };
  return view.junction;
}

// A click: the tool goes on the lot under the cursor, on the whole parcel or
// road the cursor holds with the bulldozer, or — with a road tool held (M5.T25)
// — on the road under it. Returns whether the world changed. A tool the player
// put down acts nowhere. `shift` is the cap brush (M5.T8): a zone tool paints
// the lot low-rise, the eraser lifts the cap back off. It lands even where the
// zone itself is already set, so a lot the player has no reason to rezone can
// still be capped. A click that ran an op is an act: it is charged what its
// tool costs and Ctrl+Z takes it back (M5.T26).
export function paintLot(view, city, shift = view.shift) {
  if (view.mode !== 'city' || view.lift < 1) return false;
  // A press starts a stroke (M5.T33) wherever a brush is held, and a press that
  // barely travels is a click on the lot under it: the stroke is put down here,
  // so a click never leaves a half-drawn one over the card.
  view.stroke = null;
  const tool = toolOf(view);
  if (!tool) return false;
  if (tool.junction) return setJunction(view, tool);
  if (tool.drag) return changeRoad(view, tool);
  if (tool === BULLDOZE_TOOL) return demolish(view, city, WORLDS.get(view).map);
  if (tool.type) return buildService(view, city, tool);
  if (view.hover < 0) return false;
  const { map } = WORLDS.get(view);
  const at = city.parcels[view.hover];
  const was = at.zoned;
  const laid = tool.refuse(city, at) ? 0 : moved(map, () => tool.op(map, at));
  const capped = shift ? capParcel(city, view.hover, tool.use === null ? STAGE.HIGH : STAGE.LOW) : false;
  if (laid) chargeAct(view, city, priceOf(tool, map, at), map.version - laid);
  return at.zoned !== was || capped;
}

// A click on a junction with a control tool held (M5.T31): the control is
// written to the map's own record, where the traffic and the render both read
// it, and the cars at that junction obey it from the next tick. Returns whether
// the control changed.
function setJunction(view, tool) {
  const at = view.junction;
  if (!at) return false;
  return setJunctionControl(WORLDS.get(view).map, at.id, tool.use);
}

// A service is an op on the map (M5.T11): the map owns the version, the dirty
// tiles and the undo, and the lot keeps its object in the city's own list, so
// the renderer and the interior read the service the same frame it lands.
function buildService(view, city, tool) {
  const { map } = WORLDS.get(view);
  const at = view.hover >= 0 ? city.parcels[view.hover] : null;
  if (tool.refuse(city, at)) return false;
  const laid = moved(map, () => placeService(map, at, tool.type));
  if (laid) chargeAct(view, city, priceOf(tool, map, at), map.version - laid);
  return laid > 0;
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
  view.road = null;   // the op renames the edges: nothing under the cursor now
  view.junction = null;
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
  const laid = moved(map, () => removeRoad(map, edge));
  if (!laid) return false;
  chargeAct(view, city, priceOf(BULLDOZE_TOOL, map, edge), map.version - laid);
  adoptLots(view, city, map);
  return true;
}

// One bulldoze click (M5.T5): the building comes down a stage, or the road
// goes. A parcel fully down keeps its id and stays live as an empty lot.
function demolish(view, city, map) {
  const target = view.pick;
  if (!target) return false;
  if (target.kind === 'road') return takeRoad(view, city, map, target.edge, false);
  const laid = moved(map, () => bulldoze(map, target.parcel));
  if (!laid) return false;
  chargeAct(view, city, priceOf(BULLDOZE_TOOL, map, target.parcel), map.version - laid);
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

// The carriageway's footprint: the drag line swept half a road to each side, at
// the width the laid type is drawn with (M5.T25) — an avenue refuses a building
// standing where its own lanes would run.
function roadBand(from, to, axis, half) {
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
function roadRefuse(map, from, to, axis, type = 'street') {
  const band = roadBand(from, to, axis, halfWidth(type));
  const wet = (map.water ?? []).some(([cx, cz, hw, hd]) => overlaps(band, cx - hw, cx + hw, cz - hd, cz + hd));
  if (wet) return 'over water';
  const blocked = (map.parcels ?? []).some((p) => (p.kind !== 'lot' || p.stage > 0)
    && overlaps(band, p.x - p.w / 2, p.x + p.w / 2, p.z - p.d / 2, p.z + p.d / 2));
  if (blocked) return 'through buildings';
  if (roadTooSteep(map, from, to)) return 'too steep';
  if (roadDoubles(map, from, to, axis)) return 'already a road';
  return null;
}

// The drag's live numbers, or null when no drag is on. The price is the type's
// own per metre (ROAD_TYPES), so the card names the same road the release lays.
// A type the city has not the people for refuses here, in the tier's own words,
// and the release lays nothing.
export function roadPreview(view) {
  const d = view.drag;
  if (!d) return null;
  const { map, city } = WORLDS.get(view);
  const type = d.type ?? 'street';
  const locked = lockRefuse(toolOf(view), populationOf(city));
  const reason = locked ?? (d.length < ROAD_MIN
    ? `drag at least ${ROAD_MIN} m`
    : roadRefuse(map, d.from, d.to, d.axis, type));
  return { ...d, cost: Math.round(d.length * ROAD_TYPES[type].cost), reason };
}

// A press with a road tool: grab the road node nearest the ground point, and
// remember the type the brush holds so the release lays the road it picked.
export function pressRoad(view, x, z) {
  if (view.mode !== 'city' || view.lift < 1) return false;
  const hit = nodeAt(WORLDS.get(view).map, x, z);
  if (!hit || hit.dist > ROAD_PICK) return false;
  const n = hit.node;
  const type = toolOf(view)?.type ?? 'street';
  view.drag = { from: { x: n.x, z: n.z }, to: { x: n.x, z: n.z }, axis: null, length: 0, type };
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
// live city. addRoad lays a street (ops.js), so a drag of another type changes
// the pieces it just laid to the type the drag picked — the fresh `op` edges
// only, never a piece cut out of a standing road, which keeps its own lanes.
export function releaseRoad(view) {
  const preview = roadPreview(view);
  view.drag = null;
  if (!preview || preview.reason) return false;
  const { map, city } = WORLDS.get(view);
  const laid = map.graph.edges.slice();
  const version = map.version;
  addRoad(map, preview.from, preview.to);
  if (map.version === version) return false;
  if (preview.type !== 'street') {
    for (const e of map.graph.edges) {
      if (e.way === 'op' && !laid.includes(e)) upgradeRoad(map, e, preview.type);
    }
  }
  chargeAct(view, city, priceOf(toolOf(view), map, null), version);
  adoptLots(view, city, map);
  return true;
}

// What a click on the road under the cursor offers (M5.T25, M5-10): the change
// to the held type, and what it costs on top of the road standing there — the
// difference per metre (ops.js upgradeCost), negative for a cheaper type. Null
// when no road tool is held or no road is under the cursor.
export function roadOffer(view) {
  const tool = toolOf(view);
  const held = view.road;
  if (!tool?.type || !held || held.kind !== 'road') return null;
  const from = roadTypeOf(held.edge);
  const to = tool.type;
  if (from === to) return { from, to, cost: 0, same: true };
  return { from, to, cost: upgradeCost(WORLDS.get(view).map, held.edge, to) };
}

// A click on a road with a road tool held: the road changes to the held type in
// place, for the difference in cost (M5-10). A click on open land is not a
// drag's press, so it does nothing. A type the city has not the people for
// (M5.T30) refuses in the tier's own words.
function changeRoad(view, tool) {
  const held = view.road;
  if (!held || held.kind !== 'road' || roadTypeOf(held.edge) === tool.type) return false;
  const { map, city } = WORLDS.get(view);
  if (lockRefuse(tool, populationOf(city))) return false;
  const version = map.version;
  const laid = moved(map, () => upgradeRoad(map, held.edge, tool.type));
  if (!laid) return false;
  chargeAct(view, city, priceOf(tool, map, held), version);
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
  tickMilestones(view, city);
}

// The population tier the city stands on (M5.T30, M5-12), and the note the
// screen says when the city climbs onto a higher one. The view settles its
// opening tier on its first tick rather than announcing it: a city that opens
// above a tier has already earned it, and the note is for what the city just
// did. The tier is the city's own size, not a record — a city that empties
// stands on the tier it is worth now, and the note comes again when it climbs
// back.
function tickMilestones(view, city) {
  const tier = milestoneOf(city).tier;
  if (view.tier !== null && tier > view.tier) view.unlock = { tier, at: city.time };
  view.tier = tier;
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
