// The city tells the player what just changed (milestone 3): a lot breaking
// ground, topping out or coming down, firms moving jobs in or out of a district,
// the power going and coming back, people moving in or out, and the city's books
// shutting a service they cannot pay for (M5-6, budget.js). A city that changes
// where nobody is looking might as well not change; this is the line that says
// so, top right, for a few seconds (render/news.js).
// Pure (law 5): main ticks it after the city and the people, render reads
// liveNews. It only compares snapshots; it never decides anything.
import { address } from './decline.js';
import { NO_ROAD, STAGE } from './zoning.js';
import { isDark } from './street.js';
import { SERVICES } from './ops.js';
import { homesInReach, POLLUTION_REACH } from './pollution.js';

// Lines kept, oldest first.
export const NEWS_MAX = 4;
// Seconds of street time a line stays on screen.
export const NEWS_SECS = 12;
// A change in the number of residents this big, since the last time it was news,
// is news.
export const CROWD = 5;
// What a lot's building is called in a line, by use.
export const NOUN = { res: 'Flats', com: 'Offices', ind: 'Workshops' };
// What a moved firm's jobs are called, by use.
export const JOBS = { com: 'office', ind: 'workshop' };
// How a firm's leaving line ends, by its cause (economy.js flee): the chain
// reads in one line after the poke's own line has scrolled off.
export const WHY = { dark: ' after the power cut', chase: ' after the police chase' };
// What the use a rezone added is called in the credit line (economy.js d.credit):
// the demand it set off is wanted "for the new workshops".
export const CREDIT_NOUN = { res: 'homes', com: 'offices', ind: 'workshops' };
// What the books say about a service they shut and one they bring back
// (budget.js lastShut / lastBack): the reason, in the player's words.
const SHUT_WHY = 'shut down — the city is in debt';
const BACK_WHY = 'open again — the books can pay for it';

// A service type's name as a line starts it.
function serviceName(type) {
  const name = SERVICES[type]?.name ?? 'Service';
  return `${name[0].toUpperCase()}${name.slice(1)}`;
}

// What a works lot topping out costs the homes standing in its smoke (M5-11,
// pollution.js): the same field the economy prices those homes' demand with,
// named on the lot that put it there. Offices top out beside homes and say
// nothing — it is the works a home wants less of.
const smokeClause = (p, all) => (p.use === 'ind' && homesInReach(p, all).length > 0
  ? ` — homes within ${POLLUTION_REACH} m want less`
  : '');

export function createNews() {
  return { items: [], last: null, residents: null };
}

// The parcels the news watches: the city's own lots, then the standing buildings
// a road op can cut off (zoning.js createCity). Snapshot and diff index with the
// same list, so one frame's arrays line up.
function watched(city) {
  return city.standing ? [...city.parcels, ...city.standing] : city.parcels;
}

// What the news compares, one frame's worth: each lot's stage and each parcel's
// decline cause (p.why; zoning.js sets 'no-road' on one the roads cut off), each
// district's last firm move (economy.js replaces d.last with a new object on
// every move, so a move is a change of identity), whether each district is dark,
// the demand change a rezone was credited with (economy.js d.credit, a new
// object when it lands), the service the city's books last shut and the one they
// last brought back (budget.js lastShut / lastBack, a new object each time), and
// how many people live on the lots.
export function snapshot(city, people, street) {
  const all = watched(city);
  const budget = city.economy?.budget;
  return {
    stages: all.map((p) => p.stage),
    whys: all.map((p) => p.why),
    moves: city.economy.districts.map((d) => d.last),
    credits: city.economy.districts.map((d) => d.credit),
    dark: city.economy.districts.map((d) => isDark(street, d.id)),
    shut: budget?.lastShut ?? null,
    back: budget?.lastBack ?? null,
    residents: people.list.length,
  };
}

// The lines between two snapshots, in this order, with name =
// city.economy.districts[i].name:
// 1. Each district i, in order: lit before and dark after gives `Power cut in the
//    ${name} district`; dark before and lit after gives `Power back in the ${name}
//    district`.
// 2. Each watched parcel i, in order, whose stage changed, with p = watched[i],
//    noun = NOUN[p.use] and at = address(p.x, p.z): EMPTY before and SITE after
//    gives `${noun} breaking ground at ${at}`; HIGH after gives `${noun} topped
//    out at ${at}`, ending smokeClause(p, all) when a works lot tops out with
//    homes inside POLLUTION_REACH of it; EMPTY after gives `${noun} at ${at}
//    came down`. Any other change says nothing.
// 3. Each watched parcel i, in order, whose cause changed to the no-road cut
//    (NO_ROAD, zoning.js): `${NOUN[p.use]} at ${at} declining — no road`.
// 4. Each district i, in order, whose move after is not null and is not the same
//    object as its move before, with m = that move and n =
//    Math.round(Math.abs(m.jobs)), when n > 0: m.jobs > 0 gives `${n} ${JOBS[m.use]}
//    jobs moved into the ${name} district`, else `${n} ${JOBS[m.use]} jobs left the
//    ${name} district`, and when m.cause is set (economy.js flee: the firm a
//    power cut or a chase drove out) that line ends WHY[m.cause].
// 5. Each district i, in order, whose credit after is set and is not the same
// object as its credit before, with c = that credit (economy.js creditRezone:
// a rezone that moved the district over the build bar): `More ${NOUN[c.use],
// lower case} wanted in the ${name} district for the new ${CREDIT_NOUN[c.source]}`.
// 6. When the service the books shut after is set and is not the same object as
// the one before, with s = that service (budget.js lastShut): `${the service's
// name} at ${address(s.x, s.z)} ${SHUT_WHY}`; and the same for the one they
// brought back, with b = after.back, `${the service's name} at ${address(b.x,
// b.z)} ${BACK_WHY}`.
export function newsBetween(before, after, city) {
  const lines = [];
  const { districts } = city.economy;
  const all = watched(city);
  districts.forEach((d, i) => {
    if (!before.dark[i] && after.dark[i]) lines.push(`Power cut in the ${d.name} district`);
    if (before.dark[i] && !after.dark[i]) lines.push(`Power back in the ${d.name} district`);
  });
  all.forEach((p, i) => {
    const was = before.stages[i];
    const now = after.stages[i];
    if (was === now) return;
    const noun = NOUN[p.use];
    const at = address(p.x, p.z);
    if (was === STAGE.EMPTY && now === STAGE.SITE) lines.push(`${noun} breaking ground at ${at}`);
    else if (now === STAGE.HIGH) lines.push(`${noun} topped out at ${at}${smokeClause(p, all)}`);
    else if (now === STAGE.EMPTY) lines.push(`${noun} at ${at} came down`);
  });
  all.forEach((p, i) => {
    if (after.whys[i] !== NO_ROAD || before.whys[i] === NO_ROAD || !(p.use in NOUN)) return;
    lines.push(`${NOUN[p.use]} at ${address(p.x, p.z)} declining — no road`);
  });
  districts.forEach((d, i) => {
    const m = after.moves[i];
    if (m === null || m === before.moves[i]) return;
    const n = Math.round(Math.abs(m.jobs));
    if (n === 0) return;
    lines.push(m.jobs > 0
      ? `${n} ${JOBS[m.use]} jobs moved into the ${d.name} district`
      : `${n} ${JOBS[m.use]} jobs left the ${d.name} district${WHY[m.cause] ?? ''}`);
  });
  districts.forEach((d, i) => {
    const c = after.credits[i];
    if (c == null || c === before.credits[i]) return;
    const noun = NOUN[c.use].toLowerCase();
    lines.push(`More ${noun} wanted in the ${d.name} district for the new ${CREDIT_NOUN[c.source]}`);
  });
  const s = after.shut;
  if (s != null && s !== before.shut) {
    lines.push(`${serviceName(s.type)} at ${address(s.x, s.z)} ${SHUT_WHY}`);
  }
  const b = after.back;
  if (b != null && b !== before.back) {
    lines.push(`${serviceName(b.type)} at ${address(b.x, b.z)} ${BACK_WHY}`);
  }
  return lines;
}

// One frame: now = snapshot(city, people, street). When news.last is not null,
// every line of newsBetween(news.last, now, city) is pushed to news.items as {
// at: street.time, text }. Then residents: when news.residents is null it
// becomes now.residents; otherwise moved = now.residents - news.residents, and
// when Math.abs(moved) >= CROWD the line `${moved} people moved into the city`
// (moved > 0) or `${-moved} people moved out of the city` is pushed the same way
// and news.residents becomes now.residents. Then news.last = now, and the oldest
// items are dropped until there are at most NEWS_MAX.
export function tickNews(news, city, people, street) {
  const now = snapshot(city, people, street);
  const push = (text) => news.items.push({ at: street.time, text });
  if (news.last !== null) newsBetween(news.last, now, city).forEach(push);
  if (news.residents === null) news.residents = now.residents;
  else {
    const moved = now.residents - news.residents;
    if (Math.abs(moved) >= CROWD) {
      push(moved > 0 ? `${moved} people moved into the city` : `${-moved} people moved out of the city`);
      news.residents = now.residents;
    }
  }
  news.last = now;
  if (news.items.length > NEWS_MAX) news.items.splice(0, news.items.length - NEWS_MAX);
}

// The texts of the items younger than NEWS_SECS at street time `now` (now - at <
// NEWS_SECS), oldest first.
export function liveNews(news, now) {
  return news.items.filter((i) => now - i.at < NEWS_SECS).map((i) => i.text);
}
