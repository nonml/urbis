// Weather sim (M2-7): each game day rolls a run of clear/overcast/rain states
// off its own RNG stream (createStreams().weather), and the day's rain drives a
// 0-1 wetness that the rain, the puddle mirrors and the road gloss read.
import { createStreams } from './rng.js';

export const WEATHER_STATES = ['clear', 'overcast', 'rain'];
export const DRY_SECS = 120; // 2 game minutes from soaked to dry (M2-7)
const SOAK_SECS = 60; // dry to soaked in the rain
const SEGS = 3; // a day: 0-8 h, 8-16 h, 16-24 h
const SEG_HOURS = 24 / SEGS;

const draw = (rng) => WEATHER_STATES[Math.floor(rng() * WEATHER_STATES.length)];

// Three states a day, never all the same: M2-7 wants at least two.
function rollDay(rng) {
  const states = [draw(rng), draw(rng), draw(rng)];
  if (states[0] === states[1] && states[1] === states[2]) {
    states[1] = WEATHER_STATES[(WEATHER_STATES.indexOf(states[0]) + 1) % WEATHER_STATES.length];
  }
  return states;
}

// `?weather=` (the sweep) is a search string, as sim/newgame.js takes one.
// Anything that is not one of the three states is ignored.
export function weatherPin(search) {
  const raw = new URLSearchParams(search ?? '').get('weather');
  return WEATHER_STATES.includes(raw) ? raw : null;
}

// `pinned` holds one state regardless of the day. A pinned rain arrives wet so
// a capture shot does not have to sit through the soak.
export function createWeather(seed, pinned = null) {
  const rng = createStreams(seed).weather;
  const weather = { rng, pinned, day: 0, states: [], state: 'clear', wetness: 0 };
  weather.states = rollDay(rng);
  weather.state = pinned ?? weather.states[0];
  if (pinned === 'rain') weather.wetness = 1;
  return weather;
}

// The clock's civil day steps the schedule. Every skipped day is still rolled
// so the stream a replay consumes keeps the same sequence however the clock
// jumped (T can pass a midnight).
function rollTo(weather, day) {
  while (weather.day < day) {
    weather.states = rollDay(weather.rng);
    weather.day += 1;
  }
}

export function tickWeather(weather, dt, clock) {
  if (!weather.pinned) {
    if (clock.day !== weather.day) rollTo(weather, clock.day);
    const seg = Math.min(SEGS - 1, Math.floor(clock.hour / SEG_HOURS));
    weather.state = weather.states[seg];
  }
  const target = weather.state === 'rain' ? 1 : 0;
  const rate = dt / (target > weather.wetness ? SOAK_SECS : DRY_SECS);
  const gap = Math.abs(target - weather.wetness);
  weather.wetness = gap <= rate ? target : weather.wetness + Math.sign(target - weather.wetness) * rate;
}
