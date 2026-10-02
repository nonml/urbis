// Which world a session plays, decided once at boot (src/boot.js) before
// anything is built: the seed, whether the city is generated from it, and
// whether this session reads and writes the save.
//
// A new game is a new generated city (AGENTS.md, milestone 2). A continued game
// is the world it was saved in: a save written before saves carried `generate`
// is a hand-preset game and continues as one. Automated runs (webdriver) play the
// hand preset at FIXED_SEED unless the URL says otherwise, so the gate and shots
// stay comparable, and never touch the save except behind ?savetest=1. ?seed=N
// replays one city; ?gen=1 / ?gen=0 force generated / hand. A URL that picks the
// world (?seed or ?gen) never touches the save, so it can never overwrite a
// player's city with a different one.
// Pure (law 5): no DOM; boot.js hands it location.search, navigator.webdriver,
// the raw saved string and Date.now().

export const FIXED_SEED = 20260916;
// Seeds are 1 .. SEED_LIMIT - 1.
export const SEED_LIMIT = 2 ** 31;

const seedOk = (n) => Number.isInteger(n) && n > 0 && n < SEED_LIMIT;

const readSaved = (raw) => {
  try {
    const s = JSON.parse(raw);
    return seedOk(s?.seed) ? { seed: s.seed, generate: s.generate === true } : null;
  } catch {
    return null;
  }
};

// { seed, generate, saving } for one boot. `search` is location.search, `webdriver`
// navigator.webdriver, `saved` the raw string in the save slot or null, `now`
// Date.now().
// - urlSeed: ?seed=N when N is all digits and 0 < N < SEED_LIMIT, else null.
// - gen: ?gen=1 is true, ?gen=0 false, anything else (or none) null.
// - saving: urlSeed === null and gen === null and (?savetest is present or not
//   webdriver).
// - savedWorld, read only when saving: the saved JSON's seed when it is an integer
//   with 0 < seed < SEED_LIMIT, with generate = (its `generate` === true); null
//   when the string is missing, not JSON, or has no valid seed.
// - seed: savedWorld.seed, else urlSeed, else FIXED_SEED when webdriver, else
//   now % 2147483647, or 1 when that is 0.
// - generate: gen when not null, else savedWorld.generate when there is a saved
//   world, else !webdriver.
export function pickWorld({ search, webdriver, saved, now }) {
  const params = new URLSearchParams(search);
  const rawSeed = params.get('seed');
  const urlSeed = /^\d+$/.test(rawSeed) && seedOk(Number(rawSeed)) ? Number(rawSeed) : null;
  const rawGen = params.get('gen');
  const gen = rawGen === '1' ? true : rawGen === '0' ? false : null;
  const saving = urlSeed === null && gen === null && (params.has('savetest') || !webdriver);
  const savedWorld = saving ? readSaved(saved) : null;
  const seed = savedWorld?.seed ?? urlSeed ?? (webdriver ? FIXED_SEED : now % 2147483647 || 1);
  const generate = gen ?? savedWorld?.generate ?? !webdriver;
  return { seed, generate, saving };
}
