// M5-15 (docs/ROADMAP.md): the city's history (M5.T32). The economy keeps one
// sample a closed game day — population, jobs, the jobless, the city's money and
// demand per use — and the panel (src/ui/history.js) draws that series and
// nothing else, on a 2D canvas.
//
// Node only: the sim is pure (law 5), so seven game days of the two districts
// run in a blink of Node ticked the way main.js ticks them — street first, then
// the city, which ticks the economy — and the panel is driven with the smallest
// DOM and 2D context it touches (m7-hints.spec.js's shape). What each sample
// must hold is recomputed here from the world as it stood on the day that
// closed, never read back out of the series; the panel is then held to what it
// painted, point for point.
import { test, expect } from '@playwright/test';
import { createStreet, tickStreet } from '../../src/sim/street.js';
import { createCity, tickZoning } from '../../src/sim/zoning.js';
import { cityDemand, HISTORY_DAYS } from '../../src/sim/economy.js';
import { DAY_SECS } from '../../src/sim/clock.js';
import { buildHistoryPanel, PANEL_SERIES, PANEL_W } from '../../src/ui/history.js';

const SEED = 20260916;             // the seed main.js boots the city with
const DT = 0.05;
// Two days more than the panel holds, so the window has to slide.
const DAYS = HISTORY_DAYS + 2;
const KEYS = ['population', 'jobs', 'jobless', 'money'];
const USES = ['res', 'com', 'ind'];

// What the sim itself says at one instant, recomputed from the districts and the
// books: the people, the work that stands, the city's money, the market.
const snapshot = (e) => {
  const population = e.districts.reduce((s, d) => s + d.homes, 0);
  const jobs = e.districts.reduce((s, d) => s + d.jobs, 0);
  const busy = e.districts.reduce((s, d) => s + Math.min(d.jobs, d.homes), 0);
  return {
    // The day the sim's own clock says has closed, not the series' count of it.
    day: Math.floor(e.time / DAY_SECS), population, jobs,
    jobless: population - busy, money: e.budget.money, demand: cityDemand(e),
  };
};

// Every row is a day of the sim's own numbers, sample for sample.
const expectRow = (row, want) => {
  expect(row.day, `day ${want.day}`).toBe(want.day);
  for (const key of KEYS) expect(row[key], `day ${want.day} ${key}`).toBeCloseTo(want[key], 6);
  for (const use of USES) {
    expect(row.demand[use], `day ${want.day} demand.${use}`).toBeCloseTo(want.demand[use], 6);
  }
};

let RUN = null;
// Seven game days of the city, with what the sim said on the day each one closed.
function run() {
  if (RUN) return RUN;
  const city = createCity(SEED), street = createStreet(SEED);
  const seen = [];
  // Day zero is the opening city and no day has closed, so the series is watched
  // from the first closed one.
  let day = city.economy.history.day;
  for (let i = 0, n = Math.round((DAYS * DAY_SECS) / DT); i < n; i++) {
    tickStreet(street, DT);
    tickZoning(city, DT, street);
    if (city.economy.history.day > day) {
      day = city.economy.history.day;
      seen.push(snapshot(city.economy));
    }
  }
  RUN = { city, seen };
  return RUN;
}

// A canvas and its 2D context: the calls the paint made, and nothing else.
function fakeCanvas() {
  const calls = [];
  const ctx = {
    calls, setTransform() {}, clearRect() { calls.push(['clearRect']); },
    beginPath() {}, moveTo(...a) { calls.push(['moveTo', a]); },
    lineTo(...a) { calls.push(['lineTo', a]); },
    fillRect() {}, stroke() { calls.push(['stroke']); },
    fillText(text) { calls.push(['fillText', text]); },
  };
  return { tag: 'canvas', width: 0, height: 0, style: {}, ctx, getContext: () => ctx };
}

function mounted(economy) {
  const host = { children: [], appendChild(kid) { this.children.push(kid); } };
  globalThis.document = { createElement: () => fakeCanvas() };
  const panel = buildHistoryPanel(host);
  panel.frame(economy);
  const calls = host.children[0].ctx.calls;
  return { panel, canvas: host.children[0], calls };
}

// One polyline per series, in the order the panel paints them.
const polylines = (calls) => {
  const lines = [];
  let now = null;
  for (const [op, a] of calls) {
    if (op === 'moveTo') now = [a];
    else if (op === 'lineTo' && now) now.push(a);
    else if (op === 'stroke' && now) { lines.push(now); now = null; }
  }
  return lines;
};

test('M5-15: the economy keeps the last five game days, sample for sample', () => {
  const { city, seen } = run();
  expect(seen.length, `${DAYS} game days closed`).toBe(DAYS);
  const rows = city.economy.history.rows;
  expect(rows.length, 'the window is five days and no more').toBe(HISTORY_DAYS);
  expect(rows.map((r) => r.day), 'the window holds the last five days').toEqual(
    seen.slice(-HISTORY_DAYS).map((r) => r.day));
  rows.forEach((row, i) => expectRow(row, seen[seen.length - HISTORY_DAYS + i]));
});

test('M5-15: the panel draws that series on a 2D canvas, point for point', () => {
  const { city } = run();
  const rows = city.economy.history.rows;
  const { panel, canvas, calls } = mounted(city.economy);
  expect(panel.el, 'the panel is a canvas').toBe(canvas);
  expect(canvas.tag).toBe('canvas');
  expect(calls.some(([op]) => op === 'clearRect'), 'the panel paints').toBe(true);

  // What the panel reads out, against the series it was given.
  const last = rows[rows.length - 1];
  const texts = calls.filter(([op]) => op === 'fillText').map(([, text]) => text);
  for (const [key, want] of [['POP', last.population], ['JOBS', last.jobs],
    ['JOBLESS', last.jobless], ['MONEY', last.money]]) {
    expect(texts.some((t) => t.startsWith(key) && t.includes(String(Math.round(want)))),
      `the panel reads ${key} as ${Math.round(want)}`).toBe(true);
  }
  for (const use of USES) {
    expect(texts.some((t) => t.startsWith(PANEL_SERIES.find((s) => s.use === use).label)
      && t.includes(last.demand[use].toFixed(2))),
    `the panel reads demand.${use} as ${last.demand[use].toFixed(2)}`).toBe(true);
  }

  // One line per series, in order, one point per sample of the window.
  const lines = polylines(calls);
  expect(lines.length, 'every series the criterion names is plotted').toBe(PANEL_SERIES.length);
  PANEL_SERIES.forEach((s, i) => {
    const values = rows.map((r) => (s.use ? r.demand[s.use] : r[s.key]));
    const line = lines[i];
    expect(line.length, `${s.label}: one point per day of the window`).toBe(values.length);
    expect(line.at(-1)[0] - line[0][0], `${s.label}: the window runs left to right`)
      .toBeGreaterThan(PANEL_W * 0.6);
    // The plot is a faithful function of the value: a rise in the series is a
    // rise on the canvas, because canvas y runs the other way.
    values.slice(1).forEach((v, k) => {
      const up = v - values[k];
      const dy = line[k + 1][1] - line[k][1];
      if (up === 0) expect(Math.abs(dy), `${s.label} day ${k}: a flat series plots flat`).toBeLessThan(1e-6);
      else expect(Math.sign(dy), `${s.label} day ${k}: a rising series plots higher`).toBe(-Math.sign(up));
    });
  });
});
