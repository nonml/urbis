// Walking into any grown lot frames the player (milestone 1). Every room the sim can
// grow is checked: each hand lot as it stands and at every lot size a generated
// district makes, for every use and every stage with a door. Through the door the
// player lands on clear floor, and the follow cam behind them, turned up to 45° either
// way, stays far enough back to show the body.
import { test, expect } from '@playwright/test';
import { STAGE, USES, createCity } from '../src/sim/zoning.js';
import { createInterior, frameCamera, standable, syncInterior } from '../src/sim/interior.js';

const SEED = 20260916;
// Generated lots run 8 to 14 m on a side (src/sim/layout.js).
const SIZES = [8, 10, 12, 14];
const TURNS = [-Math.PI / 4, 0, Math.PI / 4];
// The camera's pivot is the head (CAM_PIVOT in main.js), and closer than this it
// shows the back of the skull instead of the player.
const HEAD = 1.6;
const FRAMED = 1.0;

// Every room the sim can build: [tag, state standing in it, the room, its inside door end].
function rooms() {
  const city = createCity(SEED);
  const out = [];
  city.parcels.forEach((p0, i) => {
    const shapes = [[p0.w, p0.d], ...SIZES.flatMap((w) => SIZES.map((d) => [w, d]))];
    for (const [w, d] of shapes) {
      for (const use of USES) {
        for (let stage = STAGE.LOW; stage <= STAGE.HIGH; stage++) {
          const p = { ...p0, w, d, use, stage, building: false };
          const state = createInterior({ parcels: city.parcels.map((q, j) => (j === i ? p : q)) });
          syncInterior(state);
          const place = state.places.get(`lot:${i}`);
          const inside = state.links.find((l) => l.id === `lot:${i}-door`).ends[1];
          state.space = place.id;
          out.push([`lot ${i} ${w}x${d} ${use} stage ${stage}`, state, place, inside]);
        }
      }
    }
  });
  return out;
}

test('every grown room lands the player on clear floor', () => {
  const all = rooms();
  expect(all.length).toBeGreaterThan(1000);
  for (const [tag, , place, inside] of all) {
    expect(standable(place, inside.arrive.x, inside.arrive.z), `${tag}: arrives inside furniture`).toBe(true);
    expect(standable(place, inside.x, inside.z), `${tag}: the way out is blocked`).toBe(true);
  }
});

test('the follow cam frames the player on arrival in every grown room', () => {
  for (const [tag, state, place, inside] of rooms()) {
    const { x, z, yaw } = inside.arrive;
    const { dist, pitch } = place.rig;
    const pivot = { x, y: place.floor + HEAD, z };
    for (const turn of TURNS) {
      // The eye main.js asks for: behind the heading, raised by the rig's pitch.
      const eye = {
        x: x - Math.sin(yaw + turn) * dist * Math.cos(pitch),
        y: place.floor + 0.6 + Math.sin(pitch) * dist,
        z: z - Math.cos(yaw + turn) * dist * Math.cos(pitch),
      };
      const c = frameCamera(state, pivot, eye);
      const back = Math.hypot(c.x - pivot.x, c.y - pivot.y, c.z - pivot.z);
      const b = place.bounds;
      const label = `${tag}, turned ${Math.round((turn * 180) / Math.PI)}°`;
      expect(back >= FRAMED, `${label}: camera ${back.toFixed(2)} m from the head`).toBe(true);
      expect(c.x > b.minX && c.x < b.maxX && c.z > b.minZ && c.z < b.maxZ, `${label}: camera outside the room`)
        .toBe(true);
    }
  }
});
