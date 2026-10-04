// M2-7 (docs/ROADMAP.md): every full game day carries at least two of clear,
// overcast and rain, drawn from the seed's own weather stream; the roads are
// dry in clear weather, soak to 1 in rain and dry to 0 over 2 game minutes once
// it stops; `?weather=` pins a state for the sweep. Node only: no page opens.
import { test, expect } from '@playwright/test';
import { createClock, tickClock, DAY_SECS } from '../../src/sim/clock.js';
import { createStreams } from '../../src/sim/rng.js';
import {
  createWeather, tickWeather, weatherPin, WEATHER_STATES, DRY_SECS,
} from '../../src/sim/weather.js';
import { readWeather } from '../../src/game/loop.js';

const DT = 0.05;              // game/loop.js STEP
const SEEDS = [1, 2, 3, 4, 5];

function run(seed, secs, pinned = null) {
  const clock = createClock();
  const weather = createWeather(seed, pinned);
  const days = new Map();
  for (let i = 0; i < Math.round(secs / DT); i++) {
    tickClock(clock, DT);
    tickWeather(weather, DT, clock);
    const seen = days.get(clock.day) ?? days.set(clock.day, new Set()).get(clock.day);
    seen.add(weather.state);
  }
  return { weather, days };
}

// Run until a rain spell has soaked the roads and the next dry spell has
// finished: returns the top wetness and the seconds from rain's end to 0.
function soakThenDry(seed) {
  const clock = createClock();
  const weather = createWeather(seed);
  let soaked = 0, stop = null;
  for (let i = 0; i < (6 * DAY_SECS) / DT; i++) {
    tickClock(clock, DT);
    tickWeather(weather, DT, clock);
    if (weather.state === 'rain') { soaked = Math.max(soaked, weather.wetness); stop = null; continue; }
    if (soaked >= 1 && stop === null) stop = { step: i, wet: weather.wetness };
    if (stop && weather.wetness === 0) return { soaked, wetAtStop: stop.wet, drySecs: (i - stop.step) * DT };
  }
  return null;
}

test('M2-7: every full game day has two states out of clear, overcast and rain', () => {
  for (const seed of SEEDS) {
    const { days } = run(seed, 3 * DAY_SECS);
    // Day 0 is boot's two hours (START_HOUR 22); days 1 and 2 run whole.
    for (const day of [1, 2]) {
      const states = [...(days.get(day) ?? [])];
      expect(states.length, `seed ${seed} day ${day} rolled ${states}`).toBeGreaterThanOrEqual(2);
      for (const s of states) expect(WEATHER_STATES).toContain(s);
    }
  }
});

test('M2-7: the day is the seed\'s, and the weather stream is its own', () => {
  // Golden first draws of the existing streams: adding `weather` must not have
  // moved them, or every replay recorded before this change would shift.
  const s = createStreams(1);
  expect(s.world()).toBe(0.6270739405881613);
  expect(s.sim()).toBe(0.18967728852294385);
  const drain = createWeather(1);
  for (let d = 0; d < 8; d++) tickWeather(drain, 30, { day: d, hour: 0 });
  expect(s.world()).toBe(0.002735721180215478);
  expect(s.sim()).toBe(0.31778763560578227);
  // Same seed, same schedule; a second draw is the stream's job.
  const a = run(7, DAY_SECS * 2), b = run(7, DAY_SECS * 2);
  expect([...a.days]).toEqual([...b.days]);
});

test('M2-7: rain soaks to 1 and the roads dry over two game minutes', () => {
  for (const seed of SEEDS) {
    const r = soakThenDry(seed);
    expect(r, `seed ${seed} never saw rain then a dry spell`).toBeTruthy();
    expect(r.soaked, `seed ${seed} rain never soaked the roads`).toBe(1);
    expect(r.wetAtStop).toBeGreaterThan(0.9);
    expect(r.drySecs).toBeGreaterThanOrEqual(DRY_SECS - 2 * DT);
    expect(r.drySecs).toBeLessThanOrEqual(DRY_SECS + 2 * DT);
  }
});

test('M2-7: ?weather= pins a state for the sweep', () => {
  expect(weatherPin('?weather=clear')).toBe('clear');
  expect(weatherPin('?weather=overcast')).toBe('overcast');
  expect(weatherPin('?weather=rain')).toBe('rain');
  expect(weatherPin('?weather=snow')).toBe(null);
  expect(weatherPin('')).toBe(null);
  const saved = globalThis.location;
  try {
    globalThis.location = { search: '?weather=overcast' };
    expect(readWeather()).toBe('overcast');
    globalThis.location = { search: '' };
    expect(readWeather()).toBe(null);
  } finally {
    globalThis.location = saved;
  }
  // Pinned holds across day rolls; a pinned rain arrives wet (a capture shot
  // must not wait out the soak).
  const { weather } = run(4, 3 * DAY_SECS, 'rain');
  expect(weather.state).toBe('rain');
  expect(weather.wetness).toBe(1);
  const dry = run(4, 3 * DAY_SECS, 'clear').weather;
  expect(dry.state).toBe('clear');
  expect(dry.wetness).toBe(0);
});
