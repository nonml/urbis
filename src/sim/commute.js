// The street follows the clock: how many walkers are out at this hour, and
// which way the commuters among them walk. Walker i stands for person
// people.list[i % people.list.length], the same person the profiler shows for
// it (main.js), so at the morning rush a walker heads for its person's job lot
// and at the evening rush for its home lot, and at 3am most of the street has
// gone indoors. Pure (law 5): main ticks it after tickStreet; render/npcs.js
// hides a walker whose `out` is false.
//
// Milestone 3 skeleton: the constants are final; shareOut, threshold,
// commuteGoal, commuteLabel and tickCommute are stubs with their test in
// tests/commute.todo.js.

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
// A commuter this near its goal's z stops steering and walks on as it was.
export const ARRIVE = 4;

// The share of walkers out at `hour` (0 <= hour < 24), from SHARE.
export function shareOut(hour) {
  void hour;
  return 1;
}

// The fractional part of i * GOLDEN.
export function threshold(i) {
  void i;
  return 0;
}

// The parcel a person is walking to at `hour`, or null: their job's parcel in
// RUSH_AM when they have a job, their home's parcel in RUSH_PM, null otherwise.
export function commuteGoal(person, parcels, hour) {
  void person;
  void parcels;
  void hour;
  return null;
}

// What the profiler says the person is doing: 'heading to work' when their goal
// at this hour is their job, 'heading home' when it is their home, else null.
export function commuteLabel(person, hour) {
  void person;
  void hour;
  return null;
}

// One tick. For each walker i in street.npcs:
// - want = threshold(i) < shareOut(hour). When n.out is undefined (the first
//   tick) n.out = want. Otherwise n.out becomes want only when the walker is at
//   least HIDE_DIST from the player (Math.hypot(n.x - px, n.z - pz) >= HIDE_DIST).
// - A walker on axis 'z' with people.list non-empty steers: goal =
//   commuteGoal(people.list[i % people.list.length], city.parcels, hour); when
//   goal is not null and Math.abs(goal.z - n.z) > ARRIVE, n.dir = Math.sign(goal.z - n.z).
//   Every other walker keeps its dir.
export function tickCommute(street, people, city, hour, px, pz) {
  void street;
  void people;
  void city;
  void hour;
  void px;
  void pz;
}
