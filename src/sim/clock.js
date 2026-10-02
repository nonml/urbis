// Time of day: nightFactor 1 = dead of night, 0 = afternoon.
// Transitions glide over ~3s. Render reads nightFactor every frame.
//
// Milestone 3: the day runs on its own. `hour` (0..24) advances DAY_SECS of real
// time per day at `rate` 1; `day` counts the midnights passed; rate 0 holds the
// clock (capture shots, probes). nightTarget follows nightOf(hour). T jumps to
// DAY_HOUR or NIGHT_HOUR. Skeleton: the constants are final; nightOf is a stub
// and createClock, tickClock and toggleDay still run the old toggle, all with
// tests in tests/day.todo.js.
export const DAY_SECS = 720;
export const START_HOUR = 22;
// Night lifts across DAWN and falls across DUSK, smoothly; full night before
// DAWN[0] and from DUSK[1], full day from DAWN[1] to DUSK[0].
export const DAWN = [5, 8];
export const DUSK = [17.5, 20.5];
export const DAY_HOUR = 12;
export const NIGHT_HOUR = 22;

export function nightOf(hour) {
  void hour;
  return 1;
}
export function createClock() {
  return {
    elapsed: 0,
    nightFactor: 1.0,
    nightTarget: 1.0,
    rainFactor: 1.0,
  };
}

export function toggleDay(clock) {
  clock.nightTarget = clock.nightTarget > 0.5 ? 0.0 : 1.0;
}

// Advance sim time. dt is seconds, clamped by caller.
export function tickClock(clock, dt) {
  clock.elapsed += dt;
  const d = clock.nightTarget - clock.nightFactor;
  clock.nightFactor += d * Math.min(1, dt * 0.9);
  if (Math.abs(d) < 0.002) clock.nightFactor = clock.nightTarget;
}
