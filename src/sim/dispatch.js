// Police radio: what the wanted sim did, said as short lines with a speaker —
// the player's running explanation of why the net is closing or has lost them
// (pillar 5). There is no audio yet; these lines are the whole feature. The
// wording is data (src/content/dispatch.json), picked with the sim stream so a
// replay says the same thing.
import CHATTER from '../content/dispatch.json' with { type: 'json' };
import { createStreams } from './rng.js';
import { streetAt, worldMap } from './patrol.js';
import { streetName } from './streetnames.js';

export { CHATTER };

// One voice at a time on a radio channel.
const LINE_GAP = 1.6;
// A call not made within this is news nobody needs any more.
const STALE_SECS = 5;
// The same kind of call no more often than this, or a suspect hovering at the
// edge of sight turns the channel into a stutter.
const REPEAT_SECS = 6;
const HISTORY = 3;

export function createDispatch(seed, map = worldMap()) {
  return { rng: createStreams(seed).sim, map, queue: [], lines: [], nextAt: 0, lastSaid: {}, said: 0 };
}

function headingOf(yaw) {
  const east = Math.sin(yaw);
  const north = Math.cos(yaw);
  if (Math.abs(north) >= Math.abs(east)) return north >= 0 ? 'n' : 's';
  return east >= 0 ? 'e' : 'w';
}

// The street at (x, z) as the radio says it, by the name the lot note and the
// news line use (sim/streetnames.js): an avenue is `${streetName(way)} Avenue`,
// a crossing `${streetName(way)} Street`, where way is the avenue or crossing
// whose id is streetAt(x, z).
export function streetWord(x, z, map = worldMap()) {
  const id = streetAt(x, z, map);
  const avenue = map.district.avenues.find((w) => w.id === id);
  if (avenue) return `${streetName(avenue)} Avenue`;
  const crossing = map.district.crossings.find((w) => w.id === id);
  return crossing ? `${streetName(crossing)} Street` : '';
}

function fill(template, e, map) {
  const words = {
    street: streetWord(e.x, e.z, map),
    heading: CHATTER.headings[headingOf(e.yaw ?? 0)],
    mode: CHATTER.modes[e.inCar ? 'car' : 'foot'],
    cause: CHATTER.causes[e.cause],
  };
  return template.replace(/\{(\w+)\}/g, (_, k) => words[k] ?? '');
}

function say(d, e, time) {
  const options = CHATTER.lines[e.type];
  const pick = options[Math.floor(d.rng() * options.length)];
  return { speaker: CHATTER.speakers[pick.by], text: fill(pick.say, e, d.map), kind: e.type, at: time };
}

// events: drained from the wanted sim this tick. Lines land in d.lines, newest
// last; d.said counts them so a reader can tell when something new was said.
export function tickDispatch(d, events, time) {
  for (const e of events) {
    if (!CHATTER.lines[e.type]) continue;
    if (time - (d.lastSaid[e.type] ?? -Infinity) < REPEAT_SECS) continue;
    d.lastSaid[e.type] = time;
    d.queue.push({ e, at: time });
  }
  d.queue = d.queue.filter((q) => time - q.at <= STALE_SECS);
  if (!d.queue.length || time < d.nextAt) return;
  const { e } = d.queue.shift();
  d.lines.push(say(d, e, time));
  if (d.lines.length > HISTORY) d.lines.shift();
  d.nextAt = time + LINE_GAP;
  d.said++;
}
