// Milestones (M5.T30, M5-12): the population tiers the city's tools open at.
// A new game starts with the roads, the zone brushes, the bulldozer, the
// substation and the park — everything else waits on the people the city holds,
// because a police station in an empty field is set dressing, not a city. The
// tiers and the numbers behind them are written in docs/ZONING.md.
//
// Pure (law 5): the city view ticks it, the palette, the card and the readout
// read it, and nothing here knows a pixel. One number decides every lock — the
// residents on the city's homes — so a tool that is locked says the same words
// wherever it is named.
import { lotPeople } from './people.js';

// The people the city holds: every resident on its homes, counted the one way
// the game counts people. people.js keeps a record per resident and holds the
// census to this same count each tick, so reading it off the lots gives the
// census without waiting for that pass — the city view can show the city growing
// on the tick it grows.
export function populationOf(city) {
  return (city?.parcels ?? []).reduce((sum, p) => sum + (p.use === 'res' ? lotPeople(p) : 0), 0);
}

// What the city's size is worth, in tiers and in the tools each one opens. The
// numbers are argued in docs/ZONING.md; the ids are the tools' own (TOOLS in
// sim/cityview.js), so a locked row and its refusal are the same name.
//
// A generated district opens with 50 to 178 residents on its lots (measured on
// the five seeds), so the first tier is met as the city comes to life and the
// second is the one the player builds toward: a scripted player who zones every
// free lot and nothing else holds 60 to 237 residents twenty game minutes later
// (M5.T30's check runs exactly that), which is why the first bar sits at 50 and
// the second above every opening population at 250.
export const TIERS = [
  { id: 'village', people: 50, tools: ['police', 'clinic'] },
  { id: 'town', people: 250, tools: ['fire', 'school', 'avenue', 'oneway'] },
];

// The tier the city stands on: the last one its people have reached, or -1
// before the first. A tier is met at its own number, not past it.
export function tierOf(people) {
  let at = -1;
  TIERS.forEach((tier, i) => {
    if (people >= tier.people) at = i;
  });
  return at;
}

// The tier a tool waits on, or null when the city opens with it. A tool is
// named by its use, which every tool carries (TOOLS in sim/cityview.js).
function tierOfTool(tool) {
  if (!tool) return null;
  return TIERS.find((tier) => tier.tools.includes(tool.use)) ?? null;
}

// The first reason the city's size refuses a tool, or null when it holds the
// people for it. The words are the same everywhere the tool is named — the
// palette row, the card under the cursor, the drag's own refusal — so a locked
// tool never says more than one thing about why.
export function lockRefuse(tool, people) {
  const tier = tierOfTool(tool);
  if (!tier || people >= tier.people) return null;
  return `${tool.name} unlocks at ${tier.people} people`;
}

// What the readout shows, as plain data: the people, the tier the city stands
// on and the next one to reach with the tools it opens — null once the city has
// opened everything. The city view's line paints it; its check reads it.
export function milestoneOf(city) {
  const people = populationOf(city);
  const tier = tierOf(people);
  return { people, tier, next: TIERS[tier + 1] ?? null };
}
