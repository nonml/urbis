// The street follows the clock: how many walkers are out at this hour, and
// where the commuters among them walk. Walker i stands for person
// people.list[i % people.list.length], the same person the profiler shows for
// it (main.js): at the morning rush the walker walks door to door from its
// person's home parcel to its job's, at the evening rush the way back, tasked
// through walkers.js sendTo() — the route adopted on the walker's own
// pavement — and stays inside at either end until the next trip walks it out,
// so at 3am most of the street has gone indoors. Pure
// (law 5): main ticks it after tickStreet; render/npcs.js hides a walker
// whose `out` is false.
import { parcelSpot, sendTo, ROAM_SECS } from './walkers.js';

// The z-steer radius for a street with no graph to route on — the harness
// street in tests/commute.spec.js, which owns the import. In the game a
// commuter's trip is routed by walkers.js sendTo() and this never steers.
export const ARRIVE = 4;

// The rushes, as [from, to) in hours.
export const RUSH_AM = [7, 9.5];
export const RUSH_PM = [17, 19.5];
// The share of walkers out, by hour: the first entry whose `to` the hour is
// below wins, so [0, 5) is 0.2, [5, 7) is 0.4 and so on, and [19.5, 24) is 0.7.
export const SHARE = [
  { to: 5, share: 0.2 },
  { to: 7, share: 0.4 },
  { to: RUSH_AM[1], share: 1 },
  { to: RUSH_PM[0], share: 0.6 },
  { to: RUSH_PM[1], share: 1 },
  { to: 24, share: 0.7 },
];
// Walker i is out when threshold(i) < shareOut(hour): the fractional part of
// i * GOLDEN, which spreads the walkers who stay in evenly through the crowd.
export const GOLDEN = 0.6180339887498949;
// A walker only goes in or comes out this far (straight-line, metres) from the
// player, so nobody pops in or out of sight in front of them.
export const HIDE_DIST = 40;

// The share of walkers out at `hour` (0 <= hour < 24), from SHARE.
export function shareOut(hour) {
  return SHARE.find((b) => hour < b.to).share;
}

// The fractional part of i * GOLDEN.
export function threshold(i) {
  return (i * GOLDEN) % 1;
}

// The parcel a person is walking to at `hour`, or null: their job's parcel in
// RUSH_AM when they have a job, their home's parcel in RUSH_PM, null otherwise.
export function commuteGoal(person, parcels, hour) {
  if (hour >= RUSH_AM[0] && hour < RUSH_AM[1]) {
    return person.job === null ? null : parcels[person.job];
  }
  if (hour >= RUSH_PM[0] && hour < RUSH_PM[1]) return parcels[person.home];
  return null;
}

// What the profiler says the person is doing: 'heading to work' when their goal
// at this hour is their job, 'heading home' when it is their home, else null.
export function commuteLabel(person, hour) {
  if (hour >= RUSH_AM[0] && hour < RUSH_AM[1]) {
    return person.job === null ? null : 'heading to work';
  }
  if (hour >= RUSH_PM[0] && hour < RUSH_PM[1]) return 'heading home';
  return null;
}

// One tick. For each walker i in street.npcs:
// - want = threshold(i) < shareOut(hour). When n.out is undefined (the first
//   tick) n.out = want. Otherwise n.out becomes want only when the walker is at
//   least HIDE_DIST from the player (Math.hypot(n.x - px, n.z - pz) >= HIDE_DIST).
// - A walker held indoors stays out for its shift; a new goal elsewhere walks
//   it back out, tasked below, while its shift over sends it out strolling for
//   an errand instead. The same goal, or none, keeps it where it arrived.
// - At the rushes the walker walks its resident's commute: goal =
//   commuteGoal(people.list[i % people.list.length], city.parcels, hour); the
//   trip ends on the goal's doorstep (walkers.js sendTo), adopted on the
//   walker's own pavement and chained from there. Off-rush, or with no people
//   yet, the walker is stood down to random trips. A street carrying no graph
//   (street.walkers null — the tests' bare harness) keeps the old z-steer,
//   which is the only commute it can express.
export function tickCommute(street, people, city, hour, px, pz) {
  const share = shareOut(hour);
  const walkers = street.walkers ?? null;
  street.npcs.forEach((n, i) => {
    const want = threshold(i) < share;
    if (n.out === undefined) n.out = want;
    else if (Math.hypot(n.x - px, n.z - pz) >= HIDE_DIST) n.out = want;
    const goal = people.list.length === 0 ? null
      : commuteGoal(people.list[i % people.list.length], city.parcels, hour);
    if (!walkers) {
      // No graph: the old z-steer is all the commute this street can express
      // (tests/commute.spec.js pins it); the routed game below never steers.
      if (n.axis === 'z' && goal !== null && Math.abs(goal.z - n.z) > ARRIVE) {
        n.dir = Math.sign(goal.z - n.z);
      }
      if (n.hold !== null && n.hold !== undefined) { n.hold = null; n.out = want; }
      return;
    }
    if (people.list.length === 0) {
      if (n.hold !== null && n.hold !== undefined) { n.hold = null; n.out = want; }
      return;
    }
    if (n.hold !== null && n.hold !== undefined) {
      const outing = goal === null ? -1 : city.parcels.indexOf(goal);
      if (outing !== -1 && outing !== n.hold) {
        n.hold = null; n.out = want;
      } else if (walkers.time >= (n.freeAfter ?? Infinity)) {
        n.hold = null; n.out = want; n.roamUntil = walkers.time + ROAM_SECS;
        sendTo(walkers, n, null);
        return;
      } else {
        n.out = false;
        return;
      }
    }
    // Out for an errand: strolling, not tasked, until the stroll ends.
    if (walkers.time < (n.roamUntil ?? 0)) return;
    if (goal === null) { sendTo(walkers, n, null); return; }
    const dest = city.parcels.indexOf(goal);
    if (!parcelSpot(walkers, dest)) return;
    sendTo(walkers, n, dest);
  });
}
