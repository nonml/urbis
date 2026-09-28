// Growth, proven without a browser. The sim is pure (law 5), so two minutes of the
// district run in a few milliseconds of Node, ticked the way main.js ticks it:
// street first, then the city reading the street's power. The browser half — that
// the city grows while a player stands in it — is the idle test in gate.spec.js.
//
// It lives in tests/ and uses the @playwright/test runner so it runs under the same
// `npm test` as the gate, with no new tooling and no new package.
import { test, expect } from '@playwright/test';
import { createStreet, hackBlackout, isDark, tickStreet } from '../src/sim/street.js';
import { STAGE, USES, builtHeight, createCity, tickZoning } from '../src/sim/zoning.js';

const SEED = 20260916;           // the seed main.js boots the city with
const DT = 0.05;
const TICKS_PER_SEC = Math.round(1 / DT);
// A building rises and falls; it never pops. At the fastest pace a stage allows,
// one tick moves a roofline by centimetres, so a jump bigger than this is a pop.
const MAX_STEP = 0.1;

function boot() {
    return { city: createCity(SEED), street: createStreet(SEED) };
}

// Ticks `secs` of game time; `each` sees the world after every tick.
function run({ city, street }, secs, each = () => {}) {
    for (let i = 0, n = Math.round(secs * TICKS_PER_SEC); i < n; i++) {
        tickStreet(street, DT);
        tickZoning(city, DT, street);
        each();
    }
}

const stateOf = (p) => ({ stage: p.stage, progress: p.progress });

test('two idle minutes build the district, and nothing pops', () => {
    const world = boot();
    const start = world.city.parcels.map(stateOf);
    const heights = world.city.parcels.map(builtHeight);
    let worstStep = 0;
    run(world, 120, () => {
        world.city.parcels.forEach((p, i) => {
            worstStep = Math.max(worstStep, Math.abs(builtHeight(p) - heights[i]));
            heights[i] = builtHeight(p);
        });
    });

    const advanced = world.city.parcels.filter((p, i) => p.stage > start[i].stage);
    expect(advanced.length).toBeGreaterThanOrEqual(3);
    // Not only sites finishing: land that was bare at boot has a building on it.
    const raised = world.city.parcels.filter((p, i) => start[i].stage === STAGE.EMPTY && builtHeight(p) > 0);
    expect(raised.length).toBeGreaterThan(0);
    expect(worstStep).toBeLessThan(MAX_STEP);
});

test('a blacked-out site stops dead, and starts again when the power returns', () => {
    const world = boot();
    const { city, street } = world;
    run(world, 40);
    const south = city.parcels.filter((p) => p.powerZone === 0);
    const north = city.parcels.filter((p) => p.powerZone === 1);
    expect(south.some((p) => p.building)).toBe(true);

    expect(hackBlackout(street, 0)).toBeGreaterThan(0);
    const heldSouth = south.map(stateOf);
    const heldNorth = north.map(stateOf);
    let darkTicks = 0;
    // Judged after each tick, by the power the city saw during it.
    for (run(world, DT); isDark(street, 0); run(world, DT)) {
        darkTicks++;
        // Frozen, not declining: the blackout stops the crane, it does not undo work.
        expect(south.map(stateOf)).toEqual(heldSouth);
    }
    expect(darkTicks).toBeGreaterThan(8 * TICKS_PER_SEC);
    // The other side of the street kept building through it.
    expect(north.map(stateOf)).not.toEqual(heldNorth);

    run(world, 5);
    expect(south.map(stateOf)).not.toEqual(heldSouth);
});

test('a slump takes buildings back down, a little at a time', () => {
    const world = boot();
    run(world, 150);
    // Hold every market at the bottom: whatever the district economy would say,
    // each tick starts from no demand for anything, in either district.
    const slump = () => world.city.economy.districts.forEach((d) => USES.forEach((use) => { d.demand[use] = 0; }));
    slump();
    const standing = world.city.parcels.filter((p) => p.stage > STAGE.EMPTY);
    const before = standing.map(builtHeight);
    const stages = standing.map((p) => p.stage);
    const heights = standing.map(builtHeight);
    let worstStep = 0;
    run(world, 60, () => {
        slump();
        standing.forEach((p, i) => {
            worstStep = Math.max(worstStep, Math.abs(builtHeight(p) - heights[i]));
            heights[i] = builtHeight(p);
        });
    });

    expect(standing.length).toBeGreaterThan(0);
    standing.forEach((p, i) => expect(builtHeight(p)).toBeLessThan(before[i]));
    // A minute of slump costs a stage, not the building.
    expect(standing.some((p, i) => p.stage < stages[i])).toBe(true);
    expect(worstStep).toBeLessThan(MAX_STEP);
});

test('the same seed grows the same city', () => {
    const a = boot();
    const b = boot();
    run(a, 90);
    run(b, 90);
    expect(a.city.parcels).toEqual(b.city.parcels);
    expect(a.city.demand).toEqual(b.city.demand);
});
