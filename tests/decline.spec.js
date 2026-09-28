// Decline you can read, proven without a browser: what a lot reports about
// itself while its market collapses, while its zone is dark, and while demand
// sits between the bands. Ticked the way main.js ticks it, street first.
// The browser half — the boards, the dark floors, the line on screen — is the
// evidence in docs/shots/wave2-decline-*.png.
import { test, expect } from '@playwright/test';
import { createStreet, hackBlackout, isDark, tickStreet } from '../src/sim/street.js';
import { STAGE, USES, builtHeight, createCity, tickZoning } from '../src/sim/zoning.js';
import { CAUSE, TREND, describe, focusParcel, hasFloors, pinDemand } from '../src/sim/decline.js';

const SEED = 20260916;           // the seed main.js boots the city with
const DT = 0.05;
const TICKS_PER_SEC = Math.round(1 / DT);
// Between the floor a market sheds buildings under and the bar it builds over.
const THIN = 0.35;
const SLUMP = 0.1;
const BOOM = 0.9;

function boot() {
    return { city: createCity(SEED), street: createStreet(SEED) };
}

function run({ city, street }, secs, each = () => {}) {
    for (let i = 0, n = Math.round(secs * TICKS_PER_SEC); i < n; i++) {
        tickStreet(street, DT);
        tickZoning(city, DT, street);
        each();
    }
}

const holdAll = (city, level) => USES.forEach((use) => pinDemand(city, use, level));

// A district with buildings standing on it: two minutes of a held boom.
function builtUp() {
    const world = boot();
    holdAll(world.city, BOOM);
    run(world, 120);
    return world;
}

test('a slumping building reports declining and why, and empties before it loses a floor', () => {
    const world = builtUp();
    const { city } = world;
    const standing = city.parcels.filter((p) => hasFloors(p) && p.vacancy === 0);
    expect(standing.length).toBeGreaterThan(1);
    const heights = standing.map(builtHeight);

    holdAll(city, SLUMP);
    run(world, 10);
    for (const p of standing) {
        expect(p.trend).toBe(TREND.DECLINING);
        expect(p.why).toBe(CAUSE.MARKET_LOW);
        expect(p.vacancy).toBeGreaterThan(0);
        expect(describe(p)).toMatch(/emptying — \w+ demand collapsed$/);
    }
    // Emptying is the warning: not a centimetre has come off yet.
    expect(standing.map(builtHeight)).toEqual(heights);

    run(world, 40);
    for (const [i, p] of standing.entries()) {
        expect(p.vacancy).toBe(1);
        expect(builtHeight(p)).toBeLessThan(heights[i]);
        expect(describe(p)).toMatch(/(coming down|being cleared) — /);
    }
});

test('a dark lot reports stalled for want of power, never declining', () => {
    const world = builtUp();
    const { city, street } = world;
    holdAll(city, SLUMP);
    run(world, 5);
    const south = city.parcels.filter((p) => p.powerZone === 0 && p.trend === TREND.DECLINING);
    expect(south.length).toBeGreaterThan(0);

    expect(hackBlackout(street, 0)).toBeGreaterThan(0);
    const held = south.map((p) => [p.stage, p.progress, p.vacancy]);
    let darkTicks = 0;
    for (run(world, DT); isDark(street, 0); run(world, DT)) {
        darkTicks++;
        for (const p of south) {
            expect(p.trend).toBe(TREND.STALLED);
            expect(p.why).toBe(CAUSE.NO_POWER);
            expect(describe(p)).toMatch(/— no power$/);
        }
        // The blackout freezes the decline as it froze the growth.
        expect(south.map((p) => [p.stage, p.progress, p.vacancy])).toEqual(held);
    }
    expect(darkTicks).toBeGreaterThan(8 * TICKS_PER_SEC);

    run(world, 1);
    for (const p of south) expect(p.trend).toBe(TREND.DECLINING);
});

test('a site between the bands reports stalled on thin demand, and holds', () => {
    const world = boot();
    const { city } = world;
    holdAll(city, BOOM);
    run(world, 30);
    const sites = city.parcels.filter((p) => p.building);
    expect(sites.length).toBeGreaterThan(0);

    holdAll(city, THIN);
    run(world, 1);
    const held = sites.map((p) => [p.stage, p.progress, p.vacancy]);
    run(world, 20);
    for (const p of sites) {
        expect(p.trend).toBe(TREND.STALLED);
        expect(p.why).toBe(CAUSE.MARKET_THIN);
        expect(describe(p)).toMatch(/stopped — too little \w+ demand to carry on$/);
    }
    expect(sites.map((p) => [p.stage, p.progress, p.vacancy])).toEqual(held);
});

test('when the market comes back, an emptying building lets again', () => {
    const world = builtUp();
    const { city } = world;
    holdAll(city, SLUMP);
    run(world, 15);
    const emptying = city.parcels.filter((p) => hasFloors(p) && p.vacancy > 0 && p.vacancy < 1);
    expect(emptying.length).toBeGreaterThan(0);

    holdAll(city, BOOM);
    run(world, 1);
    for (const p of emptying) {
        expect(p.trend).toBe(TREND.GROWING);
        expect(describe(p)).toMatch(/filling up again — \w+ demand is strong$/);
    }
    run(world, 30);
    for (const p of emptying) expect(p.vacancy).toBe(0);
});

test('the line follows the lot the player stands beside or looks at', () => {
    const world = builtUp();
    const { city } = world;
    holdAll(city, SLUMP);
    run(world, 5);
    // The declining building standing furthest from any other lot, so no
    // neighbour is nearer to the places the player stands below.
    const gap = (p) => Math.min(...city.parcels.filter((q) => q !== p).map((q) => Math.hypot(q.x - p.x, q.z - p.z)));
    const [lot] = city.parcels.filter((p) => p.trend === TREND.DECLINING && p.stage >= STAGE.LOW)
        .sort((a, b) => gap(b) - gap(a));
    expect(lot).toBeTruthy();

    // Across the street, looking straight at it.
    const back = lot.w / 2 + 30;
    expect(focusParcel(city.parcels, lot.x - back, lot.z, 1, 0)).toBe(lot);
    // Same spot, looking the other way down the street: nothing to say about it.
    expect(focusParcel(city.parcels, lot.x - back, lot.z, -1, 0)).not.toBe(lot);
    // Beside it, facing anywhere.
    expect(focusParcel(city.parcels, lot.x - lot.w / 2 - 3, lot.z, -1, 0)).toBe(lot);
    // A lot with nothing happening says nothing.
    holdAll(city, THIN);
    run(world, 1);
    const quiet = city.parcels.filter((p) => !p.building && p.vacancy === 0);
    for (const p of quiet) expect(describe(p)).toBeNull();
});
