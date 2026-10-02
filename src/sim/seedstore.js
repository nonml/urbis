// The world's seed and whether to generate from it. Set once, before
// world.js is evaluated (src/boot.js in the browser, the checker in Node).
let state = { seed: 20260916, generate: false };
export function setWorldSeed(seed, generate) { state = { seed, generate }; }
export function worldSeed() { return state; }
