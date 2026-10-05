// The people of the lots: one record per person who lives or works on a zoned
// lot, so a resident has a real home and a real job the player can trace, and a
// lot that empties sends real people away. Counts come from the same floor the
// economy measures (sim/economy.js); this is the per-person view of it, never a
// second idea of how many people there are. The established towers' population
// stays the economy's abstract base and is not modelled here.
// Pure (law 5): main ticks it after zoning, the profiler reads it.
//
// Milestone 3 skeleton: the constants and shapes are final; moveHomes and
// matchJobs are stubs that each have a test in tests/people-*.todo.js.
import { builtHeight } from './zoning.js';
import { floorPeople } from './economy.js';
import { mulberry32 } from './rng.js';

export const FIRST = [
  'Ana', 'Ben', 'Chloe', 'Daniel', 'Elif', 'Farid', 'Grace', 'Hiro', 'Ines', 'Jonah', 'Kemi', 'Liam',
  'Maya', 'Nikhil', 'Olga', 'Pablo', 'Rosa', 'Sami', 'Tess', 'Umar', 'Vera', 'Wen', 'Yara', 'Zoe',
];
export const LAST = [
  'Adams', 'Baker', 'Chen', 'Diaz', 'Evans', 'Fischer', 'Garcia', 'Haddad', 'Ito', 'Jensen', 'Kowalski',
  'Lopez', 'Moreau', 'Nakamura', 'Okafor', 'Patel', 'Quinn', 'Rossi', 'Silva', 'Tanaka', 'Usman', 'Varga',
];
// Everyone on the lots is a working-age adult who wants a job.
export const AGE = [18, 66];
export const USE_NAMES = { res: 'flats', com: 'shop', ind: 'workshop' };

// How many people a lot holds right now: residents on a res lot, workers on a
// com or ind lot. Its built floor at the economy's density, less what stands
// empty. A lot with no use holds nobody.
export function lotPeople(p) {
  if (!p.use) return 0;
  return Math.round(floorPeople(p, builtHeight) * (1 - p.vacancy));
}

// `list` holds every person, oldest first: { id, name, age, home, job }. `home` is
// the index of a res parcel; `job` is the index of a com or ind parcel, or null.
export function createPeople(seed) {
  return { list: [], nextId: 1, rand: mulberry32(seed >>> 0) };
}

// A new person moving in to parcel `home`, drawn from the people's own stream.
export function newPerson(people, home) {
  const { rand } = people;
  const name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
  const age = AGE[0] + Math.floor(rand() * (AGE[1] - AGE[0] + 1));
  return { id: people.nextId++, name, age, home, job: null };
}

// Homes: every res lot ends the tick housing exactly lotPeople(p) people, and no
// one lives anywhere else. A lot short of people takes newPerson()s, appended to
// the list in parcel order; a lot over takes its newest residents away (the
// list's last ones with that home) — they leave the city, their job with them.
// Everyone who stays keeps their record untouched.
export function moveHomes(people, city) {
  const want = city.parcels.map((p) => (p.use === 'res' ? lotPeople(p) : 0));
  const have = new Array(want.length).fill(0);
  const kept = [];
  for (const q of people.list) {
    if (have[q.home] < want[q.home]) {
      have[q.home] += 1;
      kept.push(q);
    }
  }
  for (let i = 0; i < want.length; i++) {
    for (let n = have[i]; n < want[i]; n++) kept.push(newPerson(people, i));
  }
  people.list = kept;
}

// Jobs: every com and ind lot ends the tick with at most lotPeople(p) workers.
// A lot over keeps its longest-serving workers (earliest in the list) and lets
// the newest go: their job becomes null. Then every open place is filled from
// the people out of work, the one living nearest the job lot first (centre to
// centre; ties go to the earlier in the list), until places or people run out.
// A person in work keeps their job while their lot keeps them.
export function matchJobs(people, city) {
  const places = city.parcels.map((p) => (p.use === 'com' || p.use === 'ind' ? lotPeople(p) : 0));
  const staff = new Array(places.length).fill(0);
  for (const q of people.list) {
    if (q.job === null) continue;
    if (staff[q.job] < places[q.job]) staff[q.job] += 1;
    else q.job = null;
  }
  const dist = (home, job) => Math.hypot(home.x - job.x, home.z - job.z);
  for (let j = 0; j < places.length; j++) {
    const open = places[j] - staff[j];
    if (open <= 0) continue;
    const at = city.parcels[j];
    const idle = people.list.filter((q) => q.job === null);
    idle.sort((a, b) => dist(city.parcels[a.home], at) - dist(city.parcels[b.home], at));
    for (let k = 0; k < open && k < idle.length; k++) idle[k].job = j;
  }
}

export function tickPeople(people, city) {
  moveHomes(people, city);
  matchJobs(people, city);
}

export function census(people) {
  const workers = people.list.filter((q) => q.job !== null).length;
  return { residents: people.list.length, workers, unemployed: people.list.length - workers };
}

// What the profiler shows for a person: home and work as the player reads them.
export function describe(person) {
  return {
    name: person.name,
    age: person.age,
    home: `LOT ${person.home}`,
    work: person.job === null ? 'out of work' : `LOT ${person.job}`,
  };
}
