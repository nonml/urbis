// Time of day: nightFactor 1 = dead of night, 0 = afternoon.
// Transitions glide over ~3s. Render reads nightFactor every frame.
//
// Milestone 3: the day runs on its own. `hour` (0..24) advances DAY_SECS of real
// time per day at `rate` 1; `day` counts the midnights passed; rate 0 holds the
// clock (capture shots, probes). nightTarget follows nightOf(hour). T jumps to
// DAY_HOUR or NIGHT_HOUR. The constants are final; tests are in tests/day.spec.js.
export const DAY_SECS = 720;
export const START_HOUR = 22;
// Night lifts across DAWN and falls across DUSK, smoothly; full night before
// DAWN[0] and from DUSK[1], full day from DAWN[1] to DUSK[0].
export const DAWN = [5, 8];
export const DUSK = [17.5, 20.5];
export const DAY_HOUR = 12;
export const NIGHT_HOUR = 22;

export function nightOf(hour) {
  if (hour < DAWN[0]) return 1;
  if (hour < DAWN[1]) {
    const t = (hour - DAWN[0]) / (DAWN[1] - DAWN[0]);
    return 1 - t * t * (3 - 2 * t);
  }
  if (hour < DUSK[0]) return 0;
  if (hour < DUSK[1]) {
    const t = (hour - DUSK[0]) / (DUSK[1] - DUSK[0]);
    return t * t * (3 - 2 * t);
  }
  return 1;
}

// `hour` and `day` are views of `elapsed`, so a save that carries only elapsed
// (sim/save.js) restores the day exactly. elapsed advances by dt * rate.
function applyHours(clock) {
  const total = START_HOUR + (clock.elapsed * 24) / DAY_SECS;
  clock.hour = total % 24;
  clock.day = Math.floor(total / 24);
}

export function createClock() {
  return {
    elapsed: 0,
    hour: START_HOUR,
    day: 0,
    rate: 1,
    nightFactor: nightOf(START_HOUR),
    nightTarget: nightOf(START_HOUR),
    rainFactor: 1.0,
  };
}

export function toggleDay(clock) {
  if (nightOf(clock.hour) > 0.5) {
    if (clock.hour > DAY_HOUR) clock.day += 1;
    clock.hour = DAY_HOUR;
  } else {
    clock.hour = NIGHT_HOUR;
  }
  clock.elapsed = ((clock.hour + clock.day * 24 - START_HOUR) * DAY_SECS) / 24;
  clock.nightTarget = nightOf(clock.hour);
}

// Advance sim time. dt is seconds, clamped by caller.
export function tickClock(clock, dt) {
  if (clock.rate > 0) {
    clock.elapsed += dt * clock.rate;
    applyHours(clock);
    clock.nightTarget = nightOf(clock.hour);
  }
  const d = clock.nightTarget - clock.nightFactor;
  clock.nightFactor += d * Math.min(1, dt * 0.9);
  if (Math.abs(d) < 0.002) clock.nightFactor = clock.nightTarget;
}
