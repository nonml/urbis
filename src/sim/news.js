// The city tells the player what just changed (milestone 3): a lot breaking
// ground, topping out or coming down, firms moving jobs in or out of a district,
// the power going and coming back, people moving in or out. A city that changes
// where nobody is looking might as well not change; this is the line that says
// so, top right, for a few seconds (render/news.js).
// Pure (law 5): main ticks it after the city and the people, render reads
// liveNews. It only compares snapshots; it never decides anything.
//
// Milestone 3 skeleton: the constants, createNews and snapshot are final;
// newsBetween, tickNews and liveNews are stubs with their test in
// tests/news.todo.js.
import { address } from './decline.js';
import { STAGE } from './zoning.js';
import { isDark } from './street.js';

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

export function createNews() {
  return { items: [], last: null, residents: null };
}

// What the news compares, one frame's worth: each lot's stage, each district's
// last firm move (economy.js replaces d.last with a new object on every move, so
// a move is a change of identity), whether each district is dark, and how many
// people live on the lots.
export function snapshot(city, people, street) {
  return {
    stages: city.parcels.map((p) => p.stage),
    moves: city.economy.districts.map((d) => d.last),
    dark: city.economy.districts.map((d) => isDark(street, d.id)),
    residents: people.list.length,
  };
}

// The lines between two snapshots, in this order, with name =
// city.economy.districts[i].name:
// 1. Each district i, in order: lit before and dark after gives `Power cut in the
//    ${name} district`; dark before and lit after gives `Power back in the ${name}
//    district`.
// 2. Each lot i, in order, whose stage changed, with p = city.parcels[i], noun =
//    NOUN[p.use] and at = address(p.x, p.z): EMPTY before and SITE after gives
//    `${noun} breaking ground at ${at}`; HIGH after gives `${noun} topped out at
//    ${at}`; EMPTY after gives `${noun} at ${at} came down`. Any other change says
//    nothing.
// 3. Each district i, in order, whose move after is not null and is not the same
//    object as its move before, with m = that move and n =
//    Math.round(Math.abs(m.jobs)), when n > 0: m.jobs > 0 gives `${n} ${JOBS[m.use]}
//    jobs moved into the ${name} district`, else `${n} ${JOBS[m.use]} jobs left the
//    ${name} district`, and when m.cause === 'dark' (economy.js flee: the firm a
//    power cut drove out) that line ends ` after the power cut`, so the chain
//    reads in one line after the cut's own line has scrolled off.
export function newsBetween(before, after, city) {
  const lines = [];
  const { districts } = city.economy;
  districts.forEach((d, i) => {
    if (!before.dark[i] && after.dark[i]) lines.push(`Power cut in the ${d.name} district`);
    if (before.dark[i] && !after.dark[i]) lines.push(`Power back in the ${d.name} district`);
  });
  city.parcels.forEach((p, i) => {
    const was = before.stages[i];
    const now = after.stages[i];
    if (was === now) return;
    const noun = NOUN[p.use];
    const at = address(p.x, p.z);
    if (was === STAGE.EMPTY && now === STAGE.SITE) lines.push(`${noun} breaking ground at ${at}`);
    else if (now === STAGE.HIGH) lines.push(`${noun} topped out at ${at}`);
    else if (now === STAGE.EMPTY) lines.push(`${noun} at ${at} came down`);
  });
  districts.forEach((d, i) => {
    const m = after.moves[i];
    if (m === null || m === before.moves[i]) return;
    const n = Math.round(Math.abs(m.jobs));
    if (n === 0) return;
    lines.push(m.jobs > 0
      ? `${n} ${JOBS[m.use]} jobs moved into the ${d.name} district`
      : `${n} ${JOBS[m.use]} jobs left the ${d.name} district`);
  });
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
