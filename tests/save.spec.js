// Save and continue, proven without a browser. The save is plain data (law 5),
// so a two-minute city runs in a few milliseconds of Node, gets serialized the
// way main.js saves it — through JSON, as the store carries it — and is ticked
// on from there. The browser half (the player standing where they stood) is
// the save test in gate.spec.js.
//
// It lives in tests/ and uses the @playwright/test runner so it runs under the
// same `npm test` as the gate, with no new tooling and no new package.
import { test, expect } from '@playwright/test';
import { createClock, tickClock } from '../src/sim/clock.js';
import { createInterior } from '../src/sim/interior.js';
import { createMission, missionOnEnterCar } from '../src/sim/mission.js';
import { createPlayer, tickPlayer } from '../src/sim/player.js';
import { createStreet, hackBlackout, isDark, tickStreet } from '../src/sim/street.js';
import { createPlayerCar, tickPlayerCar } from '../src/sim/vehicle.js';
import { createCity, tickZoning } from '../src/sim/zoning.js';
import { SAVE_VERSION, deserialize, serialize } from '../src/sim/save.js';

const SEED = 20260916;           // the seed main.js boots the city with
const DT = 0.05;

function boot() {
    return {
        seed: SEED,
        clock: createClock(),
        street: createStreet(SEED),
        city: createCity(SEED),
        player: Object.assign(createPlayer(), { mode: 'foot' }),
        car: createPlayerCar(),
        interior: createInterior(),
        mission: createMission(),
    };
}

// Ticks `secs` of game time the way main.js's frame loop does.
function run(world, secs) {
    for (let t = 0; t < secs; t += DT) {
        tickClock(world.clock, DT);
        tickStreet(world.street, DT);
        tickZoning(world.city, DT, world.street);
    }
}

// Through JSON, exactly as the store carries it.
const roundTrip = (world) => deserialize(JSON.parse(JSON.stringify(serialize(world))));

test('a save continues the district exactly where it stood', () => {
    const world = boot();
    run(world, 120);
    // The player walks, drives somewhere else, takes a contract and banks money.
    for (let i = 0; i < 40; i++) {
        tickPlayer(world.player, { mx: 0.6, mz: 0.8, hurry: true }, DT);
        tickPlayerCar(world.car, { throttle: 1, steer: 0.15 }, DT);
    }
    missionOnEnterCar(world.mission);
    world.mission.balance = 500;

    const restored = roundTrip(world);
    expect(restored).not.toBeNull();

    run(world, 60);
    run(restored, 60);
    expect(restored.city.parcels).toEqual(world.city.parcels);
    expect(restored.city.economy.districts).toEqual(world.city.economy.districts);
    expect(restored.city.economy.time).toBe(world.city.economy.time);
    expect(restored.clock).toEqual(world.clock);
    expect(restored.street.time).toBe(world.street.time);
    expect(restored.player).toEqual(world.player);
    expect(restored.car).toEqual(world.car);
    expect(restored.interior).toEqual(world.interior);
    expect(restored.mission).toEqual(world.mission);
});

test('a blackout in hand is still running when the game comes back', () => {
    const world = boot();
    run(world, 30);
    hackBlackout(world.street, 0);
    run(world, 1);

    const restored = roundTrip(world);
    expect(restored).not.toBeNull();
    expect(isDark(restored.street, 0)).toBe(true);
    run(world, 2);
    run(restored, 2);
    expect(restored.street.zones).toEqual(world.street.zones);
    expect(restored.city.parcels).toEqual(world.city.parcels);
});

test('a bad version and garbage JSON both return null', () => {
    const world = boot();
    run(world, 5);
    const data = serialize(world);
    expect(deserialize({ ...data, version: SAVE_VERSION + 1 })).toBeNull();
    expect(deserialize({ ...data, version: '1' })).toBeNull();
    expect(deserialize({ ...data, seed: 'bananas' })).toBeNull();
    expect(deserialize({ ...data, city: { ...data.city, parcels: [] } })).toBeNull();
    expect(deserialize({ ...data, mission: { ...data.mission, idx: 99 } })).toBeNull();
    expect(deserialize('{"version":')).toBeNull();
    expect(deserialize('not json at all')).toBeNull();
    expect(deserialize(null)).toBeNull();
});
