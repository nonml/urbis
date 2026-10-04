// Seeded RNG streams. No Math.random — sim must be deterministic per seed.
export function mulberry32(seed) {
  let a = seed;
  const next = () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // A save picks a stream up mid-run (sim/save.js): the whole state is one number.
  next.dump = () => a | 0;
  next.load = (state) => { a = state | 0; };
  return next;
}

export function createStreams(seed) {
  return {
    world: mulberry32(seed),
    sim: mulberry32(seed ^ 0x9e3779b9),
    weather: mulberry32(seed ^ 0x85ebca6b),
  };
}
