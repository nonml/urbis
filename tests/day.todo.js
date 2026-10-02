// The day runs on its own (milestone 3): night lifts at dawn and falls at dusk
// over a DAY_SECS day, T still jumps between day and night, and a held clock
// (capture shots, probes) stays exactly where it was put.
import { test, expect } from '@playwright/test';
import {
  DAWN, DAY_HOUR, DAY_SECS, DUSK, NIGHT_HOUR, START_HOUR, createClock, nightOf, tickClock, toggleDay,
} from '../src/sim/clock.js';

const DT = 0.05;
const run = (clock, secs) => { for (let i = 0, n = Math.round(secs / DT); i < n; i++) tickClock(clock, DT); };

test('night is full before dawn and after dusk, gone at midday, and never jumps', () => {
  for (const h of [0, 3, DAWN[0] - 0.01, DUSK[1], 22, 23.99]) expect(nightOf(h), `hour ${h}`).toBe(1);
  for (const h of [DAWN[1], 10, 12, 15, DUSK[0] - 0.01]) expect(nightOf(h), `hour ${h}`).toBe(0);
  for (let h = 0; h < 24; h += 0.01) {
    const a = nightOf(h);
    const b = nightOf(h + 0.01);
    expect(a >= 0 && a <= 1, `hour ${h}`).toBe(true);
    if (h + 0.01 < 24) expect(Math.abs(b - a) < 0.02, `hour ${h.toFixed(2)}: ${a} to ${b}`).toBe(true);
    if (h >= DAWN[0] && h + 0.01 <= DAWN[1]) expect(b <= a, `dawn at ${h.toFixed(2)}`).toBe(true);
    if (h >= DUSK[0] && h + 0.01 <= DUSK[1]) expect(b >= a, `dusk at ${h.toFixed(2)}`).toBe(true);
  }
});

test('a new clock starts at night on day 0, running', () => {
  const clock = createClock();
  expect([clock.hour, clock.day, clock.rate]).toEqual([START_HOUR, 0, 1]);
  expect(clock.nightFactor).toBe(nightOf(START_HOUR));
});

test('an hour passes in a twenty-fourth of DAY_SECS, and a whole day comes round', () => {
  const clock = createClock();
  run(clock, DAY_SECS / 24);
  expect(clock.hour).toBeCloseTo(START_HOUR + 1, 2);
  let brightest = 1;
  for (let i = 0, n = Math.round((DAY_SECS * 23) / 24 / DT); i < n; i++) {
    tickClock(clock, DT);
    brightest = Math.min(brightest, clock.nightFactor);
  }
  expect(clock.hour).toBeCloseTo(START_HOUR, 1);
  expect(clock.day).toBe(1);
  expect(brightest, 'the day got light').toBeLessThan(0.02);
  expect(clock.nightFactor, 'and it is night again').toBeGreaterThan(0.98);
});

test('a held clock stays exactly where it was put', () => {
  const clock = createClock();
  clock.rate = 0;
  clock.nightTarget = 0.3;
  run(clock, 30);
  expect(clock.hour).toBe(START_HOUR);
  expect(clock.nightTarget).toBe(0.3);
  expect(clock.nightFactor).toBeCloseTo(0.3, 2);
});

test('T jumps from night to midday and back to night', () => {
  const clock = createClock();
  toggleDay(clock);
  expect([clock.hour, clock.day, clock.nightTarget]).toEqual([DAY_HOUR, 1, 0]);
  run(clock, 6);
  expect(clock.nightFactor).toBeLessThan(0.05);
  toggleDay(clock);
  expect([clock.hour, clock.day, clock.nightTarget]).toEqual([NIGHT_HOUR, 1, 1]);
});
