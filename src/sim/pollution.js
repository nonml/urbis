// Pollution and noise (M5-11, docs/ROADMAP.md): what a works lot puts out as it
// grows, what a busy road carries down the street, and how far either reaches.
// Pure (law 5): the economy reads it through demandFor, the news reads it to name
// the cause, the overlays read the same field (M5.T29). Nothing here decides
// anything — it is a field, 0 to 1, at a point in the city, measured between
// parcel centres: a home lot 40 m from a works lot stands in its smoke, one 200 m
// away in none of it.
import { STAGE, projectOnSegment } from './map.js';
import { zoneAt } from './street.js';
import { edgeLoad, hourOf } from './traffic.js';

// How far the smoke and the noise carry: the 60 m the roadmap names. Inside it a
// home lot reads less; outside it nothing.
export const POLLUTION_REACH = 60;

// What a works lot puts out at each stage (EMPTY to HIGH): a crane is a nuisance, a
// finished block of workshops is the thing itself. The smoke arrives with the
// work, not with the zone.
const STAGE_POWER = [0, 0.05, 0.15, 0.4, 1];
const power = (p) => STAGE_POWER[Math.min(p.stage, STAGE.HIGH)];

// A road is busy at this share of the city's busiest edge's load — the denominator
// the traffic overlay reads too (M5.T21), so one hour reads the same in both.
const BUSY_SHARE = 0.25;

// The works lots putting smoke out: the lots the city grows, in works, that have
// broken ground. A standing works row is a fixed parcel the market never moves
// (M3.T15) and not a lot's own doing, so it is not a source.
const smoke = (city) => (city?.parcels ?? [])
  .filter((p) => p.kind === 'lot' && p.use === 'ind' && p.stage > STAGE.EMPTY);

// The busy roads, each with its share of the busiest edge's load — the
// denominator the traffic overlay reads too (M5.T21), so one hour reads the
// same in both. A road network and its loudness are the map's, so the table is
// held per map and carries the game hour it was read at. A street publishes only
// once it has laid its hour out — traffic.js walks a flow from 'match' through
// 'routes' to 'ready', and a table handed over any other way (a probe's hour,
// say) stands as one already laid out — and only from an hour later than the
// map's table already is. Two streets on one map, the hand preset or a Node A/B
// ticked beside its twin, therefore hear one street rather than two readings of
// the same network a tick or a minute apart, and a twin runs the same economy as
// its twin.
const MUTES = new WeakMap();
const laidOut = (flow) => Boolean(flow?.load) && flow.stage !== 'match' && flow.stage !== 'routes';

function noise(street) {
  const t = street?.traffic;
  const map = t?.map;
  if (!map) return [];
  const hour = Math.floor(hourOf(t.time));
  const held = MUTES.get(map);
  if (!laidOut(t?.flow) || hour <= (held?.hour ?? -1)) return held?.sources ?? [];
  const graph = map.graph;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const busiest = graph.edges.reduce((max, e) => Math.max(max, edgeLoad(t, e.id)), 0);
  const sources = [];
  for (const e of graph.edges) {
    const share = busiest > 0 ? edgeLoad(t, e.id) / busiest : 0;
    const [a, b] = [byId.get(e.a), byId.get(e.b)];
    if (share >= BUSY_SHARE && a && b) sources.push({ a, b, share });
  }
  MUTES.set(map, { hour, sources });
  return sources;
}

// A source's weight at `d` metres: full where it stands, nothing at the reach.
const falloff = (d) => (d >= POLLUTION_REACH ? 0 : 1 - d / POLLUTION_REACH);

// A nuisance is its district's own: the smoke of a works lot and the noise of a
// busy road reach the homes within POLLUTION_REACH on the source's own side of
// the district line. The district is the neighbourhood and the market that
// prices a home is the one standing on it, so a works lot costs the block it
// stands in and the block across the line keeps its own air (M5-11: a home lot
// 200 m off, in the twin's other half, reads exactly what the untouched twin
// reads). A lot zoned on one side hears the road it fronts, which is the
// district the road runs in beside it.
const aside = (z, sourceZ) => zoneAt(z) === zoneAt(sourceZ);

// How bad the air and the street are at a point, 0 to 1: what the works lots put
// out plus what the busy roads carry, each fading to nothing at the reach.
export function pollutionAt(x, z, city, street) {
  let total = 0;
  for (const p of smoke(city)) {
    if (!aside(z, p.z)) continue;
    total += power(p) * falloff(Math.hypot(x - p.x, z - p.z));
  }
  for (const road of noise(street)) {
    const near = projectOnSegment(x, z, road.a, road.b);
    if (!aside(z, near.z)) continue;
    total += road.share * falloff(near.dist);
  }
  return Math.min(1, total);
}

// The same field at the parcel's own centre, and the homes a works lot's smoke
// reaches — which the news reads to name the cost of it topping out beside them.
export const pollutionOf = (p, city, street) => pollutionAt(p.x, p.z, city, street);
export function homesInReach(works, parcels) {
  return parcels.filter((p) => p !== works && p.use === 'res'
    && aside(p.z, works.z) && Math.hypot(p.x - works.x, p.z - works.z) < POLLUTION_REACH);
}
