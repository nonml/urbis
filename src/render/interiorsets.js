// What stands in each space: the noodle bar and its shopfront, the roof and its
// stair door. Each builder returns parts in its space's frame (interiorkit.js);
// render/interior.js merges, lights and places them. Footprints come from the
// sim's SPACES items, so what a player bumps into is what they see.
import { CELL, ball, cased, cylinder, panel, part, tag, tiled } from './interiorkit.js';

// A floor surface sits this far above its datum, the way the pavement slab's
// top sits above heightAt() (block.js WALK_RISE / 2): the hero and its contact
// shadow were tuned standing on that slab, and indoors they stand the same way.
export const SLAB = 0.12;

const PLASTER = 0xd9cbb0;
const TIMBER = 0x9a6a42;
const DARK_TIMBER = 0x3a2414;
const STEEL = 0x9ea4aa;
const STAINLESS = 0xc4c8cc;
const LACQUER = 0x9a2a22;       // the RAMEN board's red, on the seats and the fridge
const INDIGO = 0x1f2b48;

// Glow is [lamp, flame, window, emergency] — which light a part *is*, rather
// than which light falls on it. See the shader in render/interior.js.
const BULB = [7, 0, 0, 0];
const PANEL_LAMP = [4.5, 0, 0, 0];
const FLAME = [0, 5, 0, 0];
const BATTERY = [0, 0, 0, 5];

const lo = (item) => item.a[0];
const hi = (item) => item.a[1];
const mid = (range) => (range[0] + range[1]) / 2;
const span = (range) => range[1] - range[0];

// ---------------------------------------------------------------------------
// The room itself.

function shellFloorAndCeiling(place, out) {
  const { a, d } = place.room;
  out.push(...tiled(span(a), span(d), 0.5, 'up', mid(a), SLAB, mid(d), 0xffffff, CELL.floor));
  out.push(...tiled(span(a), span(d), 0.6, 'down', mid(a), place.height, mid(d), PLASTER, CELL.plain));
  for (const bd of [1.6, 3.2, 4.8, 6.4]) {
    out.push(part(cased(span(a), 0.18, 0.14, mid(a), place.height - 0.09, bd), TIMBER, CELL.wood));
  }
}

// A wall is a timber wainscot to hand height and plaster above it.
const WAINSCOT = 0.9;

function wall(out, length, facing, a, d, top) {
  const upper = top - SLAB - WAINSCOT;
  out.push(...tiled(length, WAINSCOT, 0.45, facing, a, SLAB + WAINSCOT / 2, d, 0xc08858, CELL.wood));
  out.push(...tiled(length, upper, 0.6, facing, a, SLAB + WAINSCOT + upper / 2, d, PLASTER, CELL.plain));
}

function shellWalls(place, out) {
  const { a, d } = place.room;
  const top = place.height;
  wall(out, span(d), 'right', a[0], mid(d), top);
  wall(out, span(d), 'left', a[1], mid(d), top);
  wall(out, span(a), 'out', mid(a), d[1], top);
  // The back of the kitchen: a curtained doorway through to the back.
  out.push(part(panel(0.9, 2.1, 'out', -1.45, SLAB + 1.05, d[1] - 0.005), 0x0c0907));
  out.push(part(panel(0.9, 0.62, 'out', -1.45, 1.86, d[1] - 0.02), 0xffffff, CELL.noren));
  out.push(part(panel(0.62, 0.86, 'out', 1.3, 1.85, d[1] - 0.01), 0xffffff, CELL.poster));
  const clock = cylinder(0.17, 0.17, 0.03, 0, 0, 0, 20).rotateX(Math.PI / 2);
  out.push(part(clock.translate(0.2, 2.3, -(d[1] - 0.02)), 0xf2efe6));
}

// The shopfront from inside. The street's glazing is painted on the outside of
// the podium; from in here the windows are frosted — a noodle bar's usually
// are — and they glow with whatever light the street is giving them.
const WINDOW_SILL = 0.95;
const WINDOW_HEAD = 2.6;
const FROST = [0, 0, 2.4, 0];

function frontWindow(out, a0, a1, front) {
  const h = WINDOW_HEAD - WINDOW_SILL;
  out.push(part(panel(a1 - a0, h, 'in', (a0 + a1) / 2, WINDOW_SILL + h / 2, front), 0xffffff, CELL.frost, FROST));
  for (const fa of [a0, a1]) {
    out.push(part(cased(0.08, h + 0.08, 0.1, fa, WINDOW_SILL + h / 2, front + 0.02), DARK_TIMBER));
  }
  out.push(part(cased(a1 - a0, 0.08, 0.2, (a0 + a1) / 2, WINDOW_SILL - 0.02, front + 0.07), DARK_TIMBER));
}

function shellFront(place, out) {
  const { a, d } = place.room;
  const f = d[0];
  const top = place.height;
  const piece = (a0, a1, y0, y1) => {
    out.push(...tiled(a1 - a0, y1 - y0, 0.5, 'in', (a0 + a1) / 2, (y0 + y1) / 2, f, PLASTER, CELL.plain));
  };
  piece(a[0], -1.36, SLAB, top);
  piece(1.36, 1.86, SLAB, WINDOW_HEAD);
  piece(-1.36, a[1], WINDOW_HEAD, top);
  const below = (WINDOW_SILL + SLAB) / 2;
  for (const [a0, a1] of [[-1.36, -0.55], [0.55, 1.36], [1.86, a[1]]]) {
    out.push(...tiled(a1 - a0, WINDOW_SILL - SLAB, 0.45, 'in', (a0 + a1) / 2, below, f, 0xc08858, CELL.wood));
    frontWindow(out, a0, a1, f);
  }
  // The door, seen from inside: timber below, frosted above, a brass bar.
  out.push(part(cased(1.1, 0.8, 0.06, 0, SLAB + 0.4, f + 0.03), 0x6a4426, CELL.wood));
  out.push(part(panel(0.98, 1.3, 'in', 0, SLAB + 0.8 + 0.65, f + 0.02), 0xffffff, CELL.frost, FROST));
  out.push(part(panel(1.1, 0.4, 'in', 0, WINDOW_HEAD - 0.2, f + 0.01), 0xffffff, CELL.frost, FROST));
  const jamb = WINDOW_HEAD - SLAB;
  for (const fa of [-0.55, 0.55]) out.push(part(cased(0.08, jamb, 0.12, fa, SLAB + jamb / 2, f + 0.05), DARK_TIMBER));
  out.push(part(cased(0.7, 0.04, 0.05, 0, 1.1, f + 0.12), 0xb08a3a));
}

// ---------------------------------------------------------------------------
// The kitchen: back counter and stove along the wall, the keeper's alley, the
// customers' counter with a raised pass, the menu over it, lamps over that.

function kitchenCounters(item, out) {
  const dm = mid(item.d);
  const dl = span(item.d);
  out.push(part(cased(0.6, 0.78, dl, lo(item) + 0.3, SLAB + 0.39, dm), 0x7c8288));
  out.push(part(cased(0.64, 0.04, dl, lo(item) + 0.32, 0.92, dm), STAINLESS));
  out.push(...tiled(dl, 1.3, 0.6, 'right', lo(item) + 0.005, 0.94 + 0.65, dm, 0xd8d4cc, CELL.tile));
  out.push(part(cased(0.55, 0.9, dl, hi(item) - 0.275, SLAB + 0.45, dm), 0x8a5a34, CELL.wood));
  out.push(part(cased(0.72, 0.05, dl + 0.1, hi(item) - 0.2, 1.045, dm), 0xe0c090, CELL.wood));
  out.push(part(cased(0.24, 0.05, dl + 0.1, hi(item) - 0.43, 1.27, dm), 0xe0c090, CELL.wood));
  out.push(part(cased(0.04, 0.2, dl, hi(item) - 0.31, 1.16, dm), 0x6a4426, CELL.wood));
  // Brass foot rail along the customers' side.
  out.push(part(cased(0.04, 0.04, dl, hi(item) + 0.12, 0.34, dm), 0xb08a3a));
}

function stove(item, out) {
  const a = lo(item) + 0.28;
  for (const d of [4.2, 5.05]) {
    out.push(part(cylinder(0.26, 0.25, 0.46, a, 0.94 + 0.23, d, 18), STEEL));
    out.push(part(cylinder(0.235, 0.235, 0.01, a, 1.37, d, 18), 0x6b3a16));
    out.push(part(cylinder(0.2, 0.2, 0.025, a, 0.935, d, 16), 0xff9a40, CELL.plain, FLAME));
  }
  out.push(part(cased(0.5, 0.2, 0.7, a, 1.03, 6.05), STEEL));
  for (const d of [5.85, 6.05, 6.25]) out.push(part(cased(0.03, 0.2, 0.03, a + 0.1, 1.2, d), 0x333333));
  for (const d of [2.6, 2.9, 3.2]) out.push(part(cylinder(0.1, 0.07, 0.34, a - 0.02, 0.94 + 0.17, d, 14), 0xf2eee6));
  out.push(part(cylinder(0.17, 0.17, 0.28, a, 1.08, 7.1, 16), 0xe8e2d0));
  out.push(part(cylinder(0.08, 0.08, 0.02, a + 0.05, 1.23, 7.1, 12), 0x333333));
  // The hood, and the tube under it that lights the stove.
  out.push(part(cased(0.78, 0.36, 2.0, lo(item) + 0.39, 2.36, 4.62), STAINLESS));
  out.push(part(panel(0.5, 1.7, 'down', lo(item) + 0.39, 2.175, 4.62), 0xfff4e0, CELL.plain, PANEL_LAMP));
}

function kitchenShelves(item, out) {
  const a = lo(item) + 0.16;
  const jars = [0xc98a3a, 0x6a2a18, 0xe8e0c8, 0x3a5a2a, 0x8a1f18];
  for (const [d0, d1] of [[2.4, 3.7], [5.7, 7.8]]) {
    for (const y of [1.72, 2.16]) {
      out.push(part(cased(0.3, 0.03, d1 - d0, a, y, (d0 + d1) / 2), TIMBER, CELL.wood));
      for (let k = 0; k < Math.floor((d1 - d0) / 0.22); k += 1) {
        const tall = 0.1 + ((k * 7 + y * 10) % 3) * 0.05;
        const color = jars[(k + Math.round(y * 10)) % jars.length];
        out.push(part(cylinder(0.05, 0.05, tall, a, y + 0.015 + tall / 2, d0 + 0.12 + k * 0.22, 8), color));
      }
    }
  }
}

function menuAndLamps(item, out) {
  const dm = mid(item.d);
  const dl = span(item.d) - 0.4;
  const a = hi(item) - 0.56;
  out.push(part(cased(0.03, 0.42, dl, a - 0.02, 2.52, dm), 0x1a120a));
  out.push(...tiled(dl, 0.36, 0.72, 'right', a, 2.52, dm, 0xffffff, CELL.menu));
  for (const d of [3.0, 4.4, 5.8]) {
    const la = hi(item) - 0.15;
    out.push(part(cylinder(0.008, 0.008, 0.5, la, 2.7, d, 4), 0x111111));
    out.push(part(cylinder(0.05, 0.2, 0.2, la, 2.36, d, 16), 0x8a2418));
    out.push(part(cylinder(0.19, 0.19, 0.01, la, 2.255, d, 16), 0xfff0d0, CELL.plain, PANEL_LAMP));
    out.push(part(cylinder(0.05, 0.05, 0.08, la, 2.23, d, 10), 0xfff4dc, CELL.plain, BULB));
  }
}

// ---------------------------------------------------------------------------
// People. Built from the same boxes as everything else, merged into the room:
// they breathe no more than a photograph does, but a counter with a keeper
// behind it is a shop and a counter without one is a set.

const SKIN = 0x9a7b62;

function keeper(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  for (const dd of [-0.1, 0.1]) out.push(part(cased(0.15, 0.82, 0.15, a, SLAB + 0.41, d + dd), 0x22262c));
  out.push(part(cased(0.28, 0.6, 0.44, a, 1.24, d), 0xece8e0));
  out.push(part(cased(0.03, 0.78, 0.4, a + 0.155, 0.98, d), INDIGO));
  out.push(part(cylinder(0.06, 0.07, 0.1, a, 1.58, d, 8), SKIN));
  out.push(part(ball(0.11, a + 0.01, 1.7, d), SKIN));
  out.push(part(ball(0.106, a - 0.045, 1.735, d), 0x16120e));
  out.push(part(cylinder(0.117, 0.117, 0.05, a, 1.75, d, 14), 0xf2f0ea));
  // Hands on the pass, the way a keeper stands between orders.
  for (const dd of [-0.27, 0.27]) {
    out.push(part(cased(0.1, 0.4, 0.1, a, 1.32, d + dd), 0xece8e0));
    out.push(part(cased(0.26, 0.08, 0.08, a + 0.13, 1.13, d + dd * 0.85), SKIN));
  }
}

function diner(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  const coat = 0x3d3a44;
  for (const dd of [-0.09, 0.09]) {
    out.push(part(cased(0.4, 0.14, 0.14, a - 0.12, 0.86, d + dd), 0x22262c));
    out.push(part(cased(0.12, 0.5, 0.12, a - 0.3, 0.55, d + dd), 0x22262c));
  }
  const torso = cased(0.26, 0.56, 0.42, 0, 0, 0).rotateZ(0.32);
  out.push(part(torso.translate(a - 0.04, 1.18, -d), coat));
  out.push(part(ball(0.105, a - 0.22, 1.5, d), SKIN));
  out.push(part(ball(0.108, a - 0.19, 1.53, d), 0x2a1a10));
  for (const dd of [-0.17, 0.17]) out.push(part(cased(0.42, 0.09, 0.09, a - 0.3, 1.13, d + dd), coat));
  bowl(out, -0.62, d);
  const sticks = cased(0.26, 0.012, 0.012, 0, 0, 0).rotateZ(0.5);
  out.push(part(sticks.translate(-0.5, 1.2, -(d + 0.05)), 0xd8b070));
}

function bowl(out, a, d) {
  out.push(part(cylinder(0.11, 0.065, 0.08, a, 1.1, d, 14), 0xf0ebe0));
  out.push(part(cylinder(0.1, 0.1, 0.005, a, 1.13, d, 14), 0x8a4a1c));
}

// ---------------------------------------------------------------------------
// The customers' side.

function stool(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  out.push(part(cylinder(0.17, 0.19, 0.03, a, SLAB + 0.015, d, 14), 0x2a2a2a));
  out.push(part(cylinder(0.028, 0.028, 0.6, a, SLAB + 0.3, d, 8), 0xb8bcc0));
  out.push(part(cylinder(0.18, 0.17, 0.07, a, item.top + 0.035, d, 16), LACQUER));
  out.push(part(cylinder(0.07, 0.07, 0.04, -0.52, 1.09, d + 0.2, 10), 0x2a1a10));
  out.push(part(cylinder(0.035, 0.03, 0.1, -0.42, 1.12, d - 0.16, 8), 0xcfe0e8));
}

function highStool(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  out.push(part(cylinder(0.025, 0.025, item.top - 0.06, a, SLAB + (item.top - 0.06) / 2, d, 8), 0x2a2a2a));
  out.push(part(cylinder(0.16, 0.15, 0.06, a, SLAB + item.top - 0.03, d, 14), 0x5a3a20, CELL.wood));
}

function ticketMachine(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  const h = item.top - SLAB;
  out.push(part(cased(span(item.a), h, span(item.d), a, SLAB + h / 2, d), 0xd8d2c2));
  out.push(part(panel(0.56, 0.88, 'right', hi(item) + 0.005, 1.15, d), 0xffffff, CELL.ticket, [1.4, 0, 0, 0]));
  out.push(part(cased(span(item.a) + 0.02, 0.16, span(item.d) + 0.02, a, item.top - 0.08, d), LACQUER));
}

function cooler(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  out.push(part(cased(0.34, 0.92, 0.32, a, SLAB + 0.46, d), 0xe8e8e4));
  out.push(part(cylinder(0.13, 0.13, 0.3, a, SLAB + 1.07, d, 14), 0x8fb0c8));
}

function ledge(item, out) {
  const a = mid(item.a);
  out.push(part(cased(span(item.a), 0.05, span(item.d), a, item.top - 0.025, mid(item.d)), 0xd8b890, CELL.wood));
  for (const ba of [lo(item) + 0.2, a, hi(item) - 0.2]) {
    out.push(part(cased(0.05, 0.3, 0.3, ba, item.top - 0.2, mid(item.d)), DARK_TIMBER));
  }
  out.push(part(cylinder(0.035, 0.03, 0.1, a - 0.4, item.top + 0.05, 0.85, 8), 0xcfe0e8));
}

function shelfUnit(item, out) {
  const a = mid(item.a);
  const dm = mid(item.d);
  const dl = span(item.d);
  for (const d of [item.d[0] + 0.02, dm, item.d[1] - 0.02]) {
    out.push(part(cased(0.4, item.top - SLAB, 0.04, a, (item.top + SLAB) / 2, d), DARK_TIMBER));
  }
  for (const y of [0.3, 0.8, 1.3, 1.8, item.top - 0.02]) {
    out.push(part(cased(0.4, 0.03, dl, a, y, dm), TIMBER, CELL.wood));
  }
  for (const y of [0.3, 0.8, 1.3, 1.8]) {
    out.push(...tiled(dl - 0.1, 0.42, 0.42, 'left', lo(item) + 0.1, y + 0.23, dm, 0xffffff, CELL.stock));
  }
}

function fridge(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  const h = item.top - SLAB;
  out.push(part(cased(span(item.a), h, span(item.d), a, SLAB + h / 2, d), 0xd4d8da));
  out.push(part(panel(span(item.d) - 0.14, h - 0.4, 'left', lo(item) - 0.005, SLAB + h / 2 - 0.1, d),
    0xffffff, CELL.fridge, [2.2, 0, 0, 0]));
  out.push(part(cased(span(item.a) + 0.02, 0.18, span(item.d) + 0.02, a, item.top - 0.09, d), LACQUER));
}

function crates(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  const colors = [0x2c4a30, 0x8a5a1c, 0x2c4a30];
  colors.forEach((c, k) => out.push(part(cased(0.8, 0.28, 0.55, a, SLAB + 0.15 + k * 0.29, d - (k % 2) * 0.03), c)));
}

function rightWallDressing(place, out) {
  const a = place.room.a[1] - 0.005;
  out.push(part(panel(0.58, 0.82, 'left', a, 1.8, 2.15), 0xffffff, CELL.poster));
  out.push(part(panel(0.42, 0.58, 'left', a, 1.75, 6.55), 0xffffff, CELL.menu));
}

const ROOM_BUILDERS = {
  kitchen: (it, out) => { kitchenCounters(it, out); stove(it, out); kitchenShelves(it, out); menuAndLamps(it, out); },
  keeper, diner, stool, highstool: highStool, ticket: ticketMachine, cooler, ledge, shelf: shelfUnit, fridge, crates,
};

// The ceiling lamps over the customers' side: each a flat disc in the plaster.
const CEILING_LAMPS = [[1.9, 2.6], [1.9, 5.6], [3.6, 4.1]];
// The emergency lamp: a twin-head battery box over the inside of the door,
// dark until the mains fail. Where it is, in the frame: [a, y, d].
const EMERGENCY_AT = [0.95, 2.62, 0.78];

function emergencyLamp(out) {
  const [a, y, d] = EMERGENCY_AT;
  out.push(part(cased(0.36, 0.14, 0.12, a, y, d), 0xe8e6e0));
  for (const da of [-0.12, 0.12]) {
    const head = cylinder(0.045, 0.055, 0.08, 0, 0, 0, 10).rotateX(1.1);
    out.push(part(head.translate(a + da, y - 0.1, -(d + 0.08)), 0xf4f6ff, CELL.plain, BATTERY));
  }
}

// Every part leaves tagged with its model, the way the pool loader tags its
// meshes (models.js): what stands in a room is furniture models, and the
// sweep can tell them apart (M2-5).
function asModel(out, name, build) {
  const from = out.length;
  build();
  tag(out, from, name);
}

export function ramenRoom(place) {
  const out = [];
  asModel(out, 'ramen-shell', () => {
    shellFloorAndCeiling(place, out);
    shellWalls(place, out);
    shellFront(place, out);
    rightWallDressing(place, out);
  });
  asModel(out, 'ramen-emergency', () => emergencyLamp(out));
  for (const [a, d] of CEILING_LAMPS) {
    asModel(out, 'ramen-lamp', () => {
      out.push(part(cylinder(0.24, 0.24, 0.05, a, place.height - 0.03, d, 20), 0xfff4e0, CELL.plain, PANEL_LAMP));
    });
  }
  for (const it of place.items) {
    const build = ROOM_BUILDERS[it.kind];
    if (build) asModel(out, `ramen-${it.kind}`, () => build(it, out));
  }
  return out;
}

// Where the room's light comes from, in the frame: [a, y, d, strength, reach].
export const RAMEN_LIGHTS = {
  lamp: [
    [-0.55, 2.2, 3.0, 0.8, 1.6], [-0.55, 2.2, 4.4, 0.8, 1.6], [-0.55, 2.2, 5.8, 0.8, 1.6],
    ...CEILING_LAMPS.map(([a, d]) => [a, 2.85, d, 0.95, 2.4]),
    [-1.71, 2.15, 4.62, 0.4, 1.1], [3.8, 1.0, 7.42, 0.35, 1.0],
  ],
  flame: [[-1.82, 1.0, 4.2, 1.0, 0.8], [-1.82, 1.0, 5.05, 1.0, 0.8]],
  // The frosted front: light falling off with distance from the glass.
  window: { d: 0.65, falloff: 2.2 },
  // Aimed down into the room from over the door, so it reaches the counter.
  emergency: [[EMERGENCY_AT[0], EMERGENCY_AT[1] - 0.3, EMERGENCY_AT[2] + 0.6, 0.55, 2.6]],
};

// ---------------------------------------------------------------------------
// Outside: the shopfront door, the stair door, the roof.

export function ramenFront(out = []) {
  const y0 = 0.57;                            // on the shopfront's sill (block.js)
  for (const a of [-0.6, 0.6]) out.push(part(cased(0.08, 2.2, 0.12, a, y0 + 1.1, -0.1), DARK_TIMBER));
  out.push(part(cased(1.28, 0.1, 0.14, 0, y0 + 2.25, -0.1), DARK_TIMBER));
  out.push(part(cased(1.12, 0.72, 0.05, 0, y0 + 0.36, -0.1), 0x5a3820, CELL.wood));
  out.push(part(panel(1.02, 1.38, 'out', 0, y0 + 1.41, -0.1), 0xffffff, CELL.doorglass));
  out.push(part(cased(0.03, 0.42, 0.04, 0.42, y0 + 1.0, -0.15), 0xb08a3a));
  // The noren: the curtain a noodle bar hangs out when it is open.
  out.push(part(cased(1.4, 0.03, 0.03, 0, y0 + 2.2, -0.23), DARK_TIMBER));
  out.push(part(panel(1.26, 0.78, 'out', 0, y0 + 1.8, -0.22), 0xffffff, CELL.noren));
  // A paper lantern by the door, and the step up to it.
  out.push(part(cylinder(0.17, 0.17, 0.44, -0.98, 2.3, -0.36, 14), 0xffffff, CELL.lantern));
  for (const y of [2.54, 2.06]) out.push(part(cylinder(0.12, 0.12, 0.04, -0.98, y, -0.36, 12), 0x1a1210));
  out.push(part(cased(0.04, 0.04, 0.34, -0.98, 2.62, -0.2), 0x1a1210));
  out.push(part(cased(1.3, 0.22, 0.36, 0, SLAB + 0.11, -0.42), 0x5e5a55));
  return out;
}

export function stairDoor(out = []) {
  out.push(part(cased(1.25, 0.5, 0.3, 0, 0.25, -0.23), 0x55524d));
  out.push(part(cased(1.25, 0.25, 0.3, 0, 0.125, -0.53), 0x55524d));
  for (const a of [-0.56, 0.56]) out.push(part(cased(0.08, 2.2, 0.08, a, 0.5 + 1.1, -0.08), 0x2a2e30));
  out.push(part(cased(1.2, 0.08, 0.08, 0, 2.74, -0.08), 0x2a2e30));
  out.push(part(cased(1.04, 2.14, 0.04, 0, 0.5 + 1.07, -0.07), 0x44524c));
  out.push(part(cased(0.84, 0.05, 0.05, 0, 1.55, -0.11), 0xb8bcc0));
  out.push(part(panel(0.62, 0.52, 'out', 0, 3.55, -0.1), 0xffffff, CELL.sign));
  out.push(part(cased(0.15, 0.2, 0.14, 0.82, 2.55, -0.12), 0xfff0d0, CELL.lamp));
  for (const k of [-0.05, 0.05]) out.push(part(cased(0.012, 0.22, 0.16, 0.82 + k, 2.55, -0.12), 0x1a1a1a));
  return out;
}

// ---------------------------------------------------------------------------
// The roof.

const CONCRETE = 0x6f6c67;
const COPING = 0x9a968e;
const PARAPET_H = 1.05;
const PARAPET_T = 0.22;

function parapet(place, out) {
  const [a0, a1] = [place.room.a[0] - PARAPET_T, place.room.a[1] + PARAPET_T];
  const [d0, d1] = [place.room.d[0] - PARAPET_T, place.room.d[1] + PARAPET_T];
  const y = SLAB + PARAPET_H / 2;
  const wa = a1 - a0;
  const wd = d1 - d0;
  out.push(part(cased(PARAPET_T, PARAPET_H, wd, a0 + PARAPET_T / 2, y, (d0 + d1) / 2, 1), CONCRETE));
  out.push(part(cased(PARAPET_T, PARAPET_H, wd, a1 - PARAPET_T / 2, y, (d0 + d1) / 2, 1), CONCRETE));
  out.push(part(cased(wa, PARAPET_H, PARAPET_T, (a0 + a1) / 2, y, d0 + PARAPET_T / 2, 1), CONCRETE));
  out.push(part(cased(wa, PARAPET_H, PARAPET_T, (a0 + a1) / 2, y, d1 - PARAPET_T / 2, 1), CONCRETE));
  const cy = SLAB + PARAPET_H + 0.03;
  out.push(part(cased(0.32, 0.06, wd + 0.1, a0 + PARAPET_T / 2, cy, (d0 + d1) / 2), COPING));
  out.push(part(cased(0.32, 0.06, wd + 0.1, a1 - PARAPET_T / 2, cy, (d0 + d1) / 2), COPING));
  out.push(part(cased(wa + 0.1, 0.06, 0.32, (a0 + a1) / 2, cy, d0 + PARAPET_T / 2), COPING));
  out.push(part(cased(wa + 0.1, 0.06, 0.32, (a0 + a1) / 2, cy, d1 - PARAPET_T / 2), COPING));
  out.push(...tiled(wa, wd, 0.9, 'up', (a0 + a1) / 2, SLAB, (d0 + d1) / 2, 0xffffff, CELL.pavers));
  // Conduit along the back parapet on stubby legs.
  out.push(part(cased(wa - 1, 0.08, 0.1, (a0 + a1) / 2, 0.75, d1 - PARAPET_T - 0.05), 0x3a3e42));
}

function bulkhead(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  const h = item.top - SLAB;
  out.push(part(cased(span(item.a), h, span(item.d), a, SLAB + h / 2, d, 1), 0x7a746c));
  out.push(part(cased(span(item.a) + 0.2, 0.12, span(item.d) + 0.2, a, item.top + 0.06, d), 0x3a3a3a));
  const face = hi(item);
  out.push(part(cased(0.05, 2.06, 0.96, face + 0.02, SLAB + 1.03, 6.4), 0x44524c));
  for (const dd of [-0.52, 0.52]) out.push(part(cased(0.08, 2.14, 0.08, face + 0.03, SLAB + 1.07, 6.4 + dd), 0x2a2e30));
  out.push(part(cased(0.05, 0.05, 0.7, face + 0.07, 1.15, 6.4), 0xb8bcc0));
  out.push(part(panel(0.5, 0.42, 'right', face + 0.01, 2.43, 6.4), 0xffffff, CELL.sign));
  out.push(part(cased(0.14, 0.18, 0.14, face + 0.08, 2.35, 5.72), 0xfff0d0, CELL.lamp));
}

function tank(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  for (const [da, dd] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) {
    out.push(part(cased(0.1, 1.05, 0.1, a + da, SLAB + 0.52, d + dd), 0x2c3034));
  }
  out.push(part(cased(2.0, 0.1, 2.0, a, SLAB + 1.1, d), 0x2c3034));
  out.push(part(cylinder(1.0, 1.0, 1.85, a, SLAB + 2.08, d, 22), 0x8a8f94));
  out.push(part(cylinder(0.12, 1.02, 0.28, a, item.top - 0.05, d, 22), 0x7a7f84));
  for (const r of [0.6, 1.1, 1.6]) out.push(part(cylinder(1.02, 1.02, 0.04, a, SLAB + 1.2 + r, d, 22), 0x6a6f74));
  for (const dd of [-0.18, 0.18]) out.push(part(cased(0.04, 2.2, 0.04, a - 1.08, SLAB + 1.9, d + dd), 0x2c3034));
  for (let k = 0; k < 7; k += 1) out.push(part(cased(0.03, 0.03, 0.4, a - 1.08, SLAB + 1.2 + k * 0.3, d), 0x2c3034));
}

function condenser(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  const h = item.top - SLAB;
  out.push(part(cased(span(item.a), h, span(item.d), a, SLAB + h / 2, d), 0xc9c6bc));
  out.push(part(cylinder(0.32, 0.32, 0.02, a, item.top + 0.01, d, 18), 0x1c1c1c));
  out.push(part(cased(0.06, 0.06, 1.1, a - 0.3, 0.3, d - 0.9), 0x3a3e42));
}

function vent(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  out.push(part(cylinder(0.12, 0.12, item.top - SLAB - 0.1, a, (item.top + SLAB - 0.1) / 2, d, 12), 0x8a8f94));
  out.push(part(cylinder(0.22, 0.22, 0.06, a, item.top - 0.05, d, 12), 0x5a5f64));
}

function dish(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  out.push(part(cylinder(0.04, 0.04, 1.0, a, SLAB + 0.5, d, 8), 0x3a3e42));
  const face = cylinder(0.45, 0.06, 0.16, 0, 0, 0, 20).rotateZ(-1.1);
  out.push(part(face.translate(a + 0.1, SLAB + 1.1, -d), 0xdad8d0));
}

// Somebody comes up here: a chair, a crate for a table, a tin for the ends,
// and two pots somebody waters.
function smokers(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  out.push(part(cased(0.42, 0.04, 0.42, a + 0.3, SLAB + 0.45, d), 0x2e5a7a));
  out.push(part(cased(0.42, 0.45, 0.04, a + 0.3, SLAB + 0.7, d + 0.21), 0x2e5a7a));
  for (const [da, dd] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    out.push(part(cased(0.03, 0.45, 0.03, a + 0.3 + da, SLAB + 0.225, d + dd), 0x2a2a2a));
  }
  out.push(part(cased(0.42, 0.32, 0.32, a - 0.3, SLAB + 0.16, d - 0.1), 0x4a5a6a));
  out.push(part(cylinder(0.06, 0.06, 0.12, a - 0.3, SLAB + 0.38, d - 0.1, 10), 0x9a9a9a));
  for (const [da, dd] of [[-0.55, 0.45], [0.7, -0.45]]) {
    out.push(part(cylinder(0.16, 0.12, 0.3, a + da, SLAB + 0.15, d + dd, 12), 0x8a4a2a));
    out.push(part(cylinder(0.2, 0.14, 0.34, a + da, SLAB + 0.45, d + dd, 10), 0x3d5730));
  }
}

function beacon(item, out) {
  out.push(part(cylinder(0.2, 0.26, 0.32, mid(item.a), SLAB + 0.16, mid(item.d), 14), 0x2a2d33));
}

const ROOF_BUILDERS = { bulkhead, tank, condenser, vent, dish, smokers, beacon };

export function roofTop(place) {
  const out = [];
  parapet(place, out);
  for (const it of place.items) ROOF_BUILDERS[it.kind]?.(it, out);
  return out;
}

// ---------------------------------------------------------------------------
// Grown lots: a shop, a residential lobby, a workshop. Authored in the parcel's
// own facade frame, the same convention the hand-placed spaces use, so the sim's
// item footprints and the built furniture cannot drift.

function shopCounter(item, out) {
  const dm = mid(item.d);
  const dl = span(item.d);
  out.push(part(cased(0.5, 0.92, dl, lo(item) + 0.25, SLAB + 0.46, dm), 0x8a5a34, CELL.wood));
  out.push(part(cased(0.58, 0.05, dl + 0.06, lo(item) + 0.29, 0.96, dm), 0xe0c090, CELL.wood));
  out.push(part(cased(0.04, 0.04, dl, lo(item) + 0.53, 0.34, dm), 0xb08a3a));
  out.push(part(cased(0.5, 0.3, 0.5, lo(item) + 0.25, 1.35, item.d[0] + 0.45), 0x2a2a2a));
}

function mailboxes(item, out) {
  const a = lo(item) + 0.2;
  const dl = span(item.d);
  const h = item.top - SLAB;
  out.push(part(cased(0.4, h, dl, a, SLAB + h / 2, mid(item.d)), 0x6a6f74));
  const n = Math.max(2, Math.floor(dl / 0.38));
  for (let k = 0; k < n; k += 1) {
    const d = item.d[0] + 0.2 + (k * (dl - 0.4)) / Math.max(1, n - 1);
    out.push(part(cased(0.44, 0.3, 0.3, a + 0.03, SLAB + 0.5 + (k % 2) * 0.55, d), 0xb8bcc0));
  }
}

function stairCore(item, out) {
  const a = mid(item.a);
  const dm = mid(item.d);
  const h = item.top - SLAB;
  out.push(part(cased(span(item.a), h, span(item.d), a, SLAB + h / 2, dm, 0.7), 0x8a8f94));
  for (let k = 1; k * 0.22 < h; k += 1) {
    out.push(part(cased(span(item.a) + 0.04, 0.04, 0.06, a, SLAB + k * 0.22, item.d[0] + k * 0.24), 0x6a6f74));
  }
  out.push(part(cased(0.05, 0.05, span(item.d), item.a[0] + 0.12, 0.95, dm), 0x3a3e42));
}

function flatDoor(item, out) {
  const h = item.top - SLAB;
  out.push(part(cased(span(item.a), h, 0.05, mid(item.a), SLAB + h / 2, mid(item.d)), 0x6a4a2a, CELL.wood));
  out.push(part(cased(span(item.a) + 0.12, 0.1, 0.07, mid(item.a), item.top + 0.03, mid(item.d)), DARK_TIMBER));
  out.push(part(cased(0.04, 0.22, 0.08, mid(item.a) + 0.24, 1.02, mid(item.d)), 0xb08a3a));
}

function plantPot(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  out.push(part(cylinder(0.2, 0.15, 0.5, a, SLAB + 0.25, d, 12), 0x8a8378));
  out.push(part(ball(0.32, a, SLAB + 0.88, d), 0x3d5730));
  out.push(part(ball(0.22, a + 0.18, SLAB + 0.72, d - 0.1), 0x466b36));
}

function forklift(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  const w = span(item.a);
  out.push(part(cased(w * 0.8, 0.5, 1.1, a, SLAB + 0.55, d), 0xd8a01c));
  out.push(part(cased(0.5, 0.7, 0.6, a, SLAB + 1.15, d - 0.25), 0x3a3e42));
  for (const da of [-0.36, 0.36]) out.push(part(cylinder(0.18, 0.18, 0.14, a + da, SLAB + 0.18, d + 0.3, 12), 0x1a1a1a));
  out.push(part(cased(0.08, 1.6, 0.08, a - w * 0.45, SLAB + 0.8, d - 0.9), 0x4a4e54));
  out.push(part(cased(0.8, 0.06, 0.5, a - w * 0.45, SLAB + 0.06, d - 1.05), 0x4a4e54));
}

function rollerDoor(item, out) {
  const a = mid(item.a);
  const h = item.top - SLAB;
  out.push(part(panel(span(item.a), h, 'in', a, SLAB + h / 2, mid(item.d)), 0x9a958c, CELL.plain));
  for (let y = 0.15; y < h; y += 0.3) {
    out.push(part(cased(span(item.a), 0.04, 0.05, a, SLAB + y, mid(item.d) - 0.03), 0x7a756c));
  }
}

function cafeSet(item, out) {
  const a = mid(item.a);
  const d = mid(item.d);
  out.push(part(cylinder(0.04, 0.04, 0.72, a, SLAB + 0.36, d, 8), 0x2a2a2a));
  out.push(part(cylinder(0.42, 0.42, 0.05, a, SLAB + 0.74, d, 18), 0x9a6a42, CELL.wood));
  for (const da of [-0.68, 0.68]) {
    out.push(part(cased(0.4, 0.05, 0.4, a + da, SLAB + 0.46, d), 0x5a3a20, CELL.wood));
    out.push(part(cased(0.4, 0.5, 0.05, a + da, SLAB + 0.7, d - 0.18), 0x5a3a20, CELL.wood));
    for (const [qa, qd] of [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]]) {
      out.push(part(cylinder(0.03, 0.03, 0.46, a + da + qa, SLAB + 0.23, d + qd, 6), 0x2a2a2a));
    }
  }
}

const PARCEL_BUILDERS = {
  counter: shopCounter, mailboxes, stair: stairCore, flatdoor: flatDoor, plant: plantPot,
  forklift, roller: rollerDoor, cafe: cafeSet, shelf: shelfUnit, fridge, crates,
};

const PARCEL_GLASS = [0, 0, 1.6, 0];
const DOOR_HALF = 0.75;

function parcelFront(place, out) {
  const { a, d } = place.room;
  const f = d[0];
  const top = place.height;
  const piece = (a0, a1, y0, y1) => {
    out.push(...tiled(a1 - a0, y1 - y0, 0.5, 'in', (a0 + a1) / 2, (y0 + y1) / 2, f, PLASTER, CELL.plain));
  };
  if (a[0] < -DOOR_HALF) piece(a[0], -DOOR_HALF, SLAB, top);
  if (a[1] > DOOR_HALF) piece(DOOR_HALF, a[1], SLAB, top);
  piece(-DOOR_HALF, DOOR_HALF, 2.35, top);
  out.push(part(cased(1.4, 2.3, 0.07, 0, SLAB + 1.15, f + 0.04), 0x5a3820, CELL.wood));
  out.push(part(panel(1.12, 1.5, 'in', 0, SLAB + 1.35, f + 0.02), 0xffffff, CELL.frost, PARCEL_GLASS));
  out.push(part(cased(0.03, 0.3, 0.05, 0.5, SLAB + 1.0, f + 0.08), 0xb08a3a));
  // A shop and a lobby open their front with frosted glazing; a workshop keeps
  // the wall, so its only opening is the personnel door.
  if (place.use === 'ind') return;
  for (const [a0, a1] of [[a[0] + 0.15, -DOOR_HALF - 0.1], [DOOR_HALF + 0.1, a[1] - 0.15]]) {
    if (a1 - a0 > 0.5) {
      out.push(part(panel(a1 - a0, 1.5, 'in', (a0 + a1) / 2, SLAB + 1.25, f + 0.02), 0xffffff, CELL.frost, PARCEL_GLASS));
    }
  }
}

function parcelShell(place, out) {
  const { a, d } = place.room;
  const top = place.height;
  out.push(...tiled(span(a), span(d), 0.5, 'up', mid(a), SLAB, mid(d), 0xffffff, CELL.floor));
  out.push(...tiled(span(a), span(d), 0.6, 'down', mid(a), top, mid(d), PLASTER, CELL.plain));
  wall(out, span(d), 'right', a[0], mid(d), top);
  wall(out, span(d), 'left', a[1], mid(d), top);
  wall(out, span(a), 'out', mid(a), d[1], top);
  parcelFront(place, out);
}

export function parcelRoom(place) {
  const out = [];
  asModel(out, 'parcel-shell', () => parcelShell(place, out));
  const A = place.room.a[1];
  const dm = mid(place.room.d);
  // Ceiling lamps, directly above the baked sources in sim/interior.js.
  for (const a of [-A * 0.55, A * 0.55]) {
    asModel(out, 'parcel-lamp', () => {
      out.push(part(cylinder(0.22, 0.22, 0.05, a, place.height - 0.03, dm, 20), 0xfff4e0, CELL.plain, PANEL_LAMP));
    });
  }
  for (const it of place.items) {
    const build = PARCEL_BUILDERS[it.kind];
    if (build) asModel(out, `parcel-${it.kind}`, () => build(it, out));
  }
  return out;
}

// ---------------------------------------------------------------------------
// The street door hung on every grown lot, its parts authored at the frame's
// origin and instanced by render/interior.js. One geometry, one draw, per
// instance a use tint and a power zone.

export function parcelDoor(out = []) {
  out.push(part(cased(2.2, 0.5, 0.9, 0, 0.25, 0.25), 0x5e5a55));
  for (const a of [-0.8, 0.8]) out.push(part(cased(0.1, 2.5, 0.16, a, 0.5 + 1.25, 0.06), DARK_TIMBER));
  out.push(part(cased(1.7, 0.12, 0.18, 0, 3.0, 0.06), DARK_TIMBER));
  out.push(part(cased(1.3, 1.9, 0.06, 0, 0.5 + 0.95, 0.04), 0x5a3820, CELL.wood));
  out.push(part(panel(1.15, 1.4, 'out', 0, 0.5 + 1.2, 0.08), 0xffffff, CELL.doorglass));
  out.push(part(cased(0.03, 0.34, 0.05, 0.5, 0.5 + 0.95, 0.1), 0xb08a3a));
  out.push(part(panel(1.5, 0.42, 'out', 0, 3.32, 0.08), 0xffffff, CELL.lamp));
  out.push(part(cased(2.4, 0.1, 0.7, 0, 3.6, 0.25), DARK_TIMBER));
  return out;
}
