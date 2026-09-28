// The builder's hand, proven without a browser: what zoning does to a lot, and
// the city-view tool that applies it. The sim is pure (law 5), so minutes of the
// district run in milliseconds of Node, ticked the way main.js ticks it: street,
// then the city reading the street's power, then city view watching the city.
// The rules under test are written up in docs/CITYVIEW.md.
import { test, expect } from '@playwright/test';
import { createStreet, hackBlackout, isDark, tickStreet } from '../src/sim/street.js';
import { STAGE, USES, builtHeight, createCity, tickZoning, zoneParcel } from '../src/sim/zoning.js';
import {
    REACH, cityKey, createCityView, hoverLot, lotStatus, paintLot, tickCityView,
} from '../src/sim/cityview.js';

const SEED = 20260916;           // the seed main.js boots the city with
const DT = 0.05;
const TICKS_PER_SEC = Math.round(1 / DT);
const MAX_STEP = 0.1;            // a roofline moving more than this in a tick popped
const NO_KEYS = new Set();

function boot() {
    const city = createCity(SEED);
    return { city, street: createStreet(SEED), view: createCityView(city) };
}

function run(world, secs, each = () => {}) {
    for (let i = 0, n = Math.round(secs * TICKS_PER_SEC); i < n; i++) {
        tickStreet(world.street, DT);
        tickZoning(world.city, DT, world.street);
        tickCityView(world.view, world.city, DT, NO_KEYS);
        each();
    }
}

const otherUse = (use) => USES[(USES.indexOf(use) + 1) % USES.length];

test('the district arrives zoned for what it is building, so idle growth is untouched', () => {
    const { city } = boot();
    for (const p of city.parcels) expect(p.zoned).toBe(p.use);
    // Painting a lot the zoning it already has is not a change.
    expect(zoneParcel(city, 0, city.parcels[0].use)).toBe(false);
    expect(zoneParcel(city, 0, 'shops')).toBe(false);
});

test('zoning an empty lot changes what grows there', () => {
    const painted = boot();
    const control = boot();
    const empty = painted.city.parcels.flatMap((p, i) => (p.stage === STAGE.EMPTY ? [i] : []));
    expect(empty.length).toBeGreaterThan(0);
    const to = empty.map((i) => otherUse(painted.city.parcels[i].use));
    empty.forEach((i, k) => expect(zoneParcel(painted.city, i, to[k])).toBe(true));
    run(painted, 150);
    run(control, 150);

    // Every painted lot that broke ground did so as the use it was painted.
    const raised = empty.filter((i) => painted.city.parcels[i].stage > STAGE.EMPTY);
    expect(raised.length).toBeGreaterThan(0);
    empty.forEach((i, k) => {
        const p = painted.city.parcels[i];
        if (p.stage > STAGE.EMPTY) expect(p.use).toBe(to[k]);
    });
    // And the same land left alone grew, or waited, as what it started as.
    const before = empty.map((i) => control.city.parcels[i].use);
    expect(empty.map((i) => painted.city.parcels[i].use)).not.toEqual(before);
});

test('an unzoned lot clears, and never breaks ground', () => {
    const world = boot();
    const { city } = world;
    city.parcels.forEach((_, i) => zoneParcel(city, i, null));
    const heights = city.parcels.map(builtHeight);
    let rose = 0;
    let worstStep = 0;
    run(world, 240, () => {
        city.parcels.forEach((p, i) => {
            const h = builtHeight(p);
            if (h > heights[i] + 1e-9) rose++;
            worstStep = Math.max(worstStep, Math.abs(h - heights[i]));
            heights[i] = h;
        });
    });
    expect(rose).toBe(0);
    expect(worstStep).toBeLessThan(MAX_STEP);
    for (const p of city.parcels) {
        expect(p.stage).toBe(STAGE.EMPTY);
        expect(p.use).toBe(null);
        expect(p.building).toBe(false);
    }
    expect(city.parcels.map((_, i) => lotStatus(world.view, city, i, false))).toEqual(city.parcels.map(() => 'unzoned'));
});

test('a rezoned building comes down to empty land before it breaks ground as the new use', () => {
    const probe = boot();
    const lot = probe.city.parcels.findIndex((p) => p.stage >= STAGE.LOW);
    expect(lot).toBeGreaterThanOrEqual(0);
    const from = probe.city.parcels[lot].use;
    let grewAs = 0;
    // Each other use in its own world: whether the new use then breaks ground
    // is the market's call, but how the old building leaves is the rule's.
    for (const to of USES.filter((u) => u !== from)) {
        const world = boot();
        const p = world.city.parcels[lot];
        expect(zoneParcel(world.city, lot, to)).toBe(true);
        let height = builtHeight(p);
        let worstStep = 0;
        let clearedAt = -1;
        let seenStatus = null;
        let t = 0;
        run(world, 200, () => {
            t += DT;
            const h = builtHeight(p);
            worstStep = Math.max(worstStep, Math.abs(h - height));
            if (clearedAt < 0) {
                // Coming down, still as what it was: no building changes use standing.
                expect(h).toBeLessThanOrEqual(height + 1e-9);
                if (h > 0) expect(p.use).toBe(from);
                seenStatus = seenStatus ?? lotStatus(world.view, world.city, lot, false);
                if (p.stage === STAGE.EMPTY && p.use === to) clearedAt = t;
            } else if (p.stage > STAGE.EMPTY) {
                expect(p.use).toBe(to);
            }
            height = h;
        });
        expect(seenStatus).toBe('clearing');
        expect(worstStep).toBeLessThan(MAX_STEP);
        // A demolition, not a slump: a stage a quarter-minute, whatever the market.
        expect(clearedAt).toBeGreaterThan(0);
        expect(clearedAt).toBeLessThan(60);
        if (p.stage > STAGE.EMPTY) grewAs++;
    }
    expect(grewAs).toBeGreaterThan(0);
});

test('a blackout stops a clearing, like any other site', () => {
    const world = boot();
    const { city, street } = world;
    const lot = city.parcels.findIndex((p) => p.stage >= STAGE.LOW && p.powerZone === 0);
    expect(lot).toBeGreaterThanOrEqual(0);
    const p = city.parcels[lot];
    zoneParcel(city, lot, otherUse(p.use));
    run(world, 2);
    expect(hackBlackout(street, 0)).toBeGreaterThan(0);
    run(world, 1.5);
    const held = { stage: p.stage, progress: p.progress };
    for (; isDark(street, 0); run(world, DT)) {
        expect({ stage: p.stage, progress: p.progress }).toEqual(held);
        expect(lotStatus(world.view, city, lot, true)).toBe('stalled');
    }
});

test('the same seed and the same strokes build the same city', () => {
    const strokes = [[5, 'res', 10], [0, 'ind', 25], [8, null, 40], [5, 'com', 70]];
    const play = () => {
        const world = boot();
        let t = 0;
        for (const [lot, use, at] of strokes) {
            run(world, at - t);
            zoneParcel(world.city, lot, use);
            t = at;
        }
        run(world, 60);
        return world;
    };
    const a = play();
    const b = play();
    expect(a.city.parcels).toEqual(b.city.parcels);
    expect(a.city.demand).toEqual(b.city.demand);
    expect(a.view.trend).toEqual(b.view.trend);
});

test('city view goes up and comes back down, and only paints from up there', () => {
    const world = boot();
    const { city, view } = world;
    const lot = 3;
    const was = city.parcels[lot].zoned;
    const to = otherUse(was);
    const brushKey = { res: 'r', com: 'c', ind: 'i' }[to];

    // At street level the palette keys belong to nobody, and a click paints nothing.
    expect(cityKey(view, brushKey, 0)).toBe(false);
    hoverLot(view, lot);
    expect(view.hover).toBe(-1);

    expect(cityKey(view, 'z', 1.25)).toBe(true);
    expect(view.mode).toBe('city');
    expect(view.yaw).toBe(1.25);
    expect(view.reach).toBe(REACH.start);
    expect(cityKey(view, brushKey, 0)).toBe(true);
    hoverLot(view, lot);
    // Mid-rise the tool is not live yet: the camera is still moving.
    run(world, 0.5);
    expect(view.lift).toBeGreaterThan(0);
    expect(view.lift).toBeLessThan(1);
    expect(paintLot(view, city)).toBe(false);
    run(world, 2);
    expect(view.lift).toBe(1);
    expect(paintLot(view, city)).toBe(true);
    expect(city.parcels[lot].zoned).toBe(to);

    cityKey(view, 'x', 0);
    expect(paintLot(view, city)).toBe(true);
    expect(city.parcels[lot].zoned).toBe(null);

    cityKey(view, 'z', 0);
    expect(view.mode).toBe('street');
    expect(view.hover).toBe(-1);
    run(world, 2);
    expect(view.lift).toBe(0);
});

test('WASD pans the overview and it stays over the district', () => {
    const world = boot();
    const { view } = world;
    cityKey(view, 'z', 0);            // facing +z
    const start = { x: view.x, z: view.z };
    run(world, 0);
    for (let i = 0; i < 20; i++) tickCityView(view, world.city, DT, new Set(['w']));
    expect(view.z).toBeGreaterThan(start.z);
    expect(view.x).toBeCloseTo(start.x, 6);
    for (let i = 0; i < 2000; i++) tickCityView(view, world.city, DT, new Set(['d', 'shift']));
    expect(view.x).toBe(-52);        // WALK_BOUNDS.minX: +z ahead puts "right" at -x
});
