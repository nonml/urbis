// Time of day: nightFactor 1 = dead of night, 0 = afternoon.
// Transitions glide over ~3s. Render reads nightFactor every frame.
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
