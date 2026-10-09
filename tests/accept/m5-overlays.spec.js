// M5.T21 (M5-8, docs/ROADMAP.md): the five overlays and the coverage overlay.
// Demand, power, police cover, land value, traffic and a coverage overlay per
// service — each is the pooled lot tint of M5.T20 reading the sim's own value
// for the lot, so a sampled lot's colour is the number the sim holds, and the
// whole layer is one draw at any lot count.
//
// The Node half runs the pure sim (law 5) and checks each overlay's value on
// five sampled lots against the sim's own: demandFor, isDark, the distance to a
// police station, the land-value formula written in render/overlays.js, the
// commute flow's edgeLoad on the lot's frontage, a service's capacity, and the
// layer's own draw cost. The browser half drives the built game into the
// overview, selects every overlay in the ring and sweeps every frame's draw
// count (a 50 ms sampler misses the peaks): the overview stays inside the
// 175-draw budget whatever is showing.
import { test, expect } from '@playwright/test';
import { createMap, frontageRoad } from '../../src/sim/map.js';
import { createCity, tickZoning } from '../../src/sim/zoning.js';
import { paintOf } from '../../src/render/cityview.js';
import { createStreet, tickStreet, isDark } from '../../src/sim/street.js';
import { createCityView, tickCityView } from '../../src/sim/cityview.js';
import { demandFor } from '../../src/sim/economy.js';
import { edgeLoad } from '../../src/sim/traffic.js';
import {
  SERVICES, SERVICE_TYPES, inCatchment, placeService, serviceReach, servicesOf,
} from '../../src/sim/ops.js';
import {
  LAND_VALUE, OVERLAY_RING, buildOverlays, lotTint, overlayAt, overlayValue,
} from '../../src/render/overlays.js';

// 110 game seconds: the commute flow (30 s a game hour, laid every hour) has
// landed on the graph and the next boundary has not wiped it.
const SEED = 73, DT = 0.05, GROW_SECS = 110;
const FIVE_OF = (list) => [0, 1, 2, 3, 4].map((k) => Math.floor((k * list.length) / 5));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// A city the way main.js builds one, grown until buildings stand, with one
// service of every type on the land the seed left open and an hour of commute
// flow laid on the graph. `skip` leaves a type out, for the land-value check
// that places a station of its own.
function world(grow = GROW_SECS, skip = null) {
  const map = createMap(SEED);
  const city = createCity(SEED, map);
  const street = createStreet(SEED, map);
  const view = createCityView(city, map);
  const empties = map.parcels.filter((p) => p.kind === 'lot' && p.stage === 0);
  expect(empties.length).toBeGreaterThanOrEqual(SERVICE_TYPES.length);
  SERVICE_TYPES.filter((type) => type !== skip).forEach((type, i) => placeService(map, empties[i], type));
  for (let t = 0; t < grow; t += DT) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
    tickCityView(view, city, DT, new Set());
  }
  return { map, city, street, view };
}

const ctxOf = ({ map, street }) => ({ map, street, dark: (zone) => isDark(street, zone) });

test('M5-8: the ring, and demand, power, police cover and traffic are the sim\'s own on 5 lots', () => {
  expect(OVERLAY_RING.map((o) => o.id)).toEqual([
    'off', 'zone', 'status', 'demand', 'power', 'police', 'value', 'traffic', 'pollution',
    ...SERVICE_TYPES.map((t) => `cover:${t}`),
  ]);
  expect(overlayAt({ overlay: 3 }).id).toBe('demand');
  expect(overlayAt({ overlay: 99 }).id).toBe('off');
  expect(overlayAt({}).id).toBe('off');

  const w = world();
  const ctx = ctxOf(w);
  const stations = servicesOf(w.map.parcels, 'police');
  expect(stations.length, 'a police station stands in this city').toBeGreaterThan(0);
  for (const i of FIVE_OF(w.city.parcels)) {
    const p = w.city.parcels[i];
    // Demand: the market for this lot's use in its own district.
    expect(overlayValue('demand', w.city, w.view, i, ctx)).toBe(p.use ? demandFor(w.city, p) : null);
    // Power: the zone the lot is wired to, lit or out.
    expect(overlayValue('power', w.city, w.view, i, ctx)).toBe(isDark(w.street, p.powerZone) ? 0 : 1);
    // Police cover: metres to the nearest station.
    const near = stations.map((s) => Math.hypot(p.x - s.x, p.z - s.z)).sort((a, b) => a - b)[0];
    expect(overlayValue('police', w.city, w.view, i, ctx)).toBeCloseTo(near, 9);
    // Traffic: this hour's travellers on the edge the lot fronts.
    const road = frontageRoad(w.map, p);
    expect(overlayValue('traffic', w.city, w.view, i, ctx))
      .toBe(road ? edgeLoad(w.street.traffic, road.edge.id) : null);
    // A categorical overlay has no number; its colour is the lot's own swatch.
    expect(overlayValue('zone', w.city, w.view, i, ctx)).toBe(null);
    expect(lotTint('zone', w.city, w.view, i, ctx)).toBe(paintOf(p.zoned));
  }
  // The colours are the values: five lots the market reads differently paint
  // differently, and each overlay keeps its own palette.
  const sampled = FIVE_OF(w.city.parcels);
  expect(new Set(sampled.map((i) => lotTint('demand', w.city, w.view, i, ctx))).size)
    .toBeGreaterThan(1);
  expect(lotTint('demand', w.city, w.view, sampled[0], ctx))
    .not.toBe(lotTint('power', w.city, w.view, sampled[0], ctx));
});

test('M5-8: land value is the formula written down, every term the sim\'s own', () => {
  const w = world();
  const ctx = ctxOf(w);
  const edges = w.map.graph.edges;
  const busiest = Math.max(0, ...edges.map((e) => edgeLoad(w.street.traffic, e.id)));
  expect(busiest, 'the commute flow lays load on the graph').toBeGreaterThan(0);
  const stations = servicesOf(w.map.parcels, 'police');
  const amenity = (p) => ['clinic', 'school', 'park']
    .reduce((sum, t) => sum + (serviceReach(w.map.parcels, t).has(p) ? 1 : 0), 0) / 3;
  const term = LAND_VALUE;
  for (const i of FIVE_OF(w.city.parcels)) {
    const p = w.city.parcels[i];
    const d = w.city.economy.districts[p.powerZone];
    const near = stations.map((s) => Math.hypot(p.x - s.x, p.z - s.z)).sort((a, b) => a - b)[0];
    const road = frontageRoad(w.map, p);
    const load = road ? edgeLoad(w.street.traffic, road.edge.id) : 0;
    // The published weights on the sim's own numbers. `traffic` is a negative
    // weight, so a busy frontage lowers the value.
    const mine = clamp01(term.base
      + term.wealth * clamp01(d.wealth)
      + term.demand * clamp01(p.use ? demandFor(w.city, p) : 0)
      + term.service * amenity(p)
      + term.police * clamp01(1 - near / SERVICES.police.radius)
      + term.traffic * (busiest > 0 ? load / busiest : 0));
    expect(overlayValue('value', w.city, w.view, i, ctx)).toBeCloseTo(mine, 10);
  }
  // A station inside the catchment lifts the value it covers, by its own weight.
  const bare = world(0, 'police');
  const lot = bare.city.parcels.find((p) => p.zoned !== null);
  const at = bare.city.parcels.indexOf(lot);
  const before = overlayValue('value', bare.city, bare.view, at, ctxOf(bare));
  const site = bare.map.parcels.filter((p) => p.kind === 'lot' && p.stage === 0)
    .sort((a, b) => Math.hypot(a.x - lot.x, a.z - lot.z) - Math.hypot(b.x - lot.x, b.z - lot.z))[0];
  expect(Math.hypot(site.x - lot.x, site.z - lot.z)).toBeLessThan(SERVICES.police.radius);
  placeService(bare.map, site, 'police');
  expect(overlayValue('value', bare.city, bare.view, at, ctxOf(bare))).toBeGreaterThan(before);
});

test('M5-8: a coverage overlay per service shades its catchment by how full it is', () => {
  const w = world();
  const ctx = ctxOf(w);
  for (const type of SERVICE_TYPES) {
    const def = SERVICES[type];
    const stations = servicesOf(w.map.parcels, type);
    expect(stations.length, `${def.name} stands in this city`).toBeGreaterThan(0);
    const served = new Map();
    for (const [p, s] of serviceReach(w.map.parcels, type)) served.set(s, (served.get(s) ?? 0) + 1);
    const fill = (s) => (served.get(s) ?? 0) / def.capacity;
    const near = (p) => stations.some((s) => inCatchment(s, p));
    // A placed service is a parcel in the city's own list, so the sample is the
    // lots; the services are checked apart below.
    const lots = w.city.parcels.filter((p) => p.kind === 'lot');
    const byDist = lots.slice().sort((a, b) => Math.hypot(a.x - stations[0].x, a.z - stations[0].z)
      - Math.hypot(b.x - stations[0].x, b.z - stations[0].z));
    const covered = byDist.filter(near);
    const open = byDist.filter((p) => !near(p));
    // Five sampled lots: three the nearest station covers, then the farthest
    // lots the city has, so an open one is in the sample whenever there is one.
    const sampled = [...covered.slice(0, 3), ...byDist.slice(-(5 - Math.min(3, covered.length)))];
    expect(new Set(sampled).size, 'five different lots').toBe(5);
    expect(sampled.filter(near).length).toBeGreaterThan(0);
    if (open.length) expect(sampled.some((p) => !near(p))).toBe(true);
    for (const p of sampled) {
      const covering = stations.find((s) => inCatchment(s, p));
      const got = overlayValue(`cover:${type}`, w.city, w.view, w.city.parcels.indexOf(p), ctx);
      if (covering) expect(got, 'a covered lot reads its station\'s fill').toBeCloseTo(fill(covering), 10);
      else expect(got, 'a lot outside every catchment reads nothing').toBe(null);
    }
    // A station's own parcel reads its fill; a station is not another type's
    // customer, so another type's cover reads nothing over it.
    const own = w.city.parcels.find((p) => p.kind === 'service' && p.type === type);
    const at = w.city.parcels.indexOf(own);
    expect(overlayValue(`cover:${type}`, w.city, w.view, at, ctx)).toBeCloseTo(fill(own), 10);
    const other = SERVICE_TYPES.find((t) => t !== type);
    expect(overlayValue(`cover:${other}`, w.city, w.view, at, ctx)).toBe(null);
  }
});

test('M5-8: one pooled mesh paints every overlay, at most two draws', () => {
  const w = world();
  const view = { overlay: 0, hover: -1, trend: w.city.parcels.map(() => 0) };
  const rig = buildOverlays(w.city, view, ctxOf(w));
  expect(rig.mesh.children.length, 'one InstancedMesh carries every lot').toBe(1);
  expect(rig.draws(), 'nothing is drawn on the street').toBe(0);
  rig.frame(0);
  expect(rig.draws()).toBe(0);
  for (const o of OVERLAY_RING) {
    view.overlay = OVERLAY_RING.indexOf(o);
    rig.frame(1);
    expect(rig.draws(), `${o.id} costs at most two draws`).toBeLessThanOrEqual(2);
    expect(rig.pool().count, `${o.id} keeps an instance per lot`).toBe(w.city.parcels.length);
  }
});

test('M5-8: in the city view every overlay keeps the overview inside the budget', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/?capture=1&gen=1&seed=73');
  await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
  // The values the overlays read are the city's own and live: lots to paint, a
  // district economy behind each of them, and a power zone per lot.
  const live = await page.evaluate(() => ({
    lots: window.__game.city().parcels.length,
    districts: window.__game.economy().length, zones: window.__game.dark().length,
  }));
  expect(live.lots).toBeGreaterThan(0);
  expect(live.districts).toBeGreaterThan(0);
  expect(live.zones).toBeGreaterThan(0);
  await page.keyboard.press('z');
  await page.waitForFunction(() => {
    const v = window.__game.cityview.state();
    return v.mode === 'city' && v.lift >= 1;
  }, null, { polling: 'raf', timeout: 30000 });
  // Every frame, not a 50 ms sample: a pooled layer's peak hides between them.
  const sweep = () => page.evaluate(() => new Promise((resolve) => {
    let peak = 0, frames = 0;
    const step = () => {
      peak = Math.max(peak, window.__game.draws());
      if (++frames < 90) requestAnimationFrame(step);
      else resolve(peak);
    };
    requestAnimationFrame(step);
  }));
  const off = await sweep();
  expect(off, 'the overview with no overlay is inside the frame budget').toBeLessThanOrEqual(175);
  for (let i = 0; i < OVERLAY_RING.length; i++) {
    await page.evaluate((n) => window.__game.cityview.aim({ overlay: n }), i);
    expect(await sweep(), `${OVERLAY_RING[i].id} keeps the overview inside the frame budget`)
      .toBeLessThanOrEqual(175);
  }
});
