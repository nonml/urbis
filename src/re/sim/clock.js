// Pure sim state for re-001. No three.js here — ever.
// Render reads this; only main ticks it.

export function createClock() {
  return {
    elapsed: 0,
    // Locked look for slice 001: dead of night, full rain.
    nightFactor: 1.0,
    rainFactor: 1.0,
  };
}

// Advance sim time. dt is seconds, clamped by caller.
export function tickClock(clock, dt) {
  clock.elapsed += dt;
}
