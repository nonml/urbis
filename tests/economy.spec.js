// The district economy, proven without a browser, and its readout, with one.
// The sim is pure (law 5), so ten minutes of both districts run in a blink of
// Node, ticked the way main.js ticks them: street first, then the city — which
// ticks the economy — reading the street's power. docs/ECONOMY.md is the model.
import { test, expect } from '@playwright/test';
import { createStreet, hackBlackout, isDark, tickStreet } from '../src/sim/street.js';
import { STAGE, builtHeight, createCity, tickZoning } from '../src/sim/zoning.js';
import { districtReport, tickEconomy } from '../src/sim/economy.js';

const SEED = 20260916;           // the seed main.js boots the city with
const DT = 0.05;
const TICKS_PER_SEC = Math.round(1 / DT);
const SOUTH = 0;
const NORTH = 1;

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
const inZone = (city, zone) => city.parcels.filter((p) => p.powerZone === zone);

test('the same seed runs the same economy', () => {
    const a = boot();
    const b = boot();
    for (let minute = 0; minute < 5; minute++) {
        run(a, 60);
        run(b, 60);
        expect(districtReport(a.city)).toEqual(districtReport(b.city));
    }
});

test('a blackout dents its own district, recovers, and never touches the other', () => {
    const hacked = boot();
    const twin = boot();
    run(hacked, 40);
    run(twin, 40);
    expect(hackBlackout(hacked.street, SOUTH)).toBeGreaterThan(0);

    let lowest = 1;
    let darkTicks = 0;
    const tick = () => {
        run(hacked, DT);
        run(twin, DT);
        const [h, t] = [districtReport(hacked.city), districtReport(twin.city)];
        // The other district is not merely close: it is the same district.
        expect(h[NORTH]).toEqual(t[NORTH]);
        expect(inZone(hacked.city, NORTH).map(stateOf)).toEqual(inZone(twin.city, NORTH).map(stateOf));
        lowest = Math.min(lowest, h[SOUTH].wealth);
        return [h[SOUTH], t[SOUTH]];
    };
    // Judged after each tick, by the power the district saw during it.
    for (let [h, t] = tick(); h.dark; [h, t] = tick()) {
        darkTicks++;
        expect(h.wealth).toBeLessThan(t.wealth);
    }
    expect(darkTicks).toBeGreaterThan(8 * TICKS_PER_SEC);
    // A dent, not a crash: a blackout costs the district a slice of its trade.
    expect(lowest).toBeLessThan(0.92);
    expect(lowest).toBeGreaterThan(0.8);

    // Power is back. The market reads the dent late, so the district's shops and
    // works are wanted less than in the city that was never cut, for a while.
    let dentedTicks = 0;
    for (let i = 0; i < 30 * TICKS_PER_SEC; i++) {
        const [h, t] = tick();
        if (h.demand.com < t.demand.com - 0.02) dentedTicks++;
    }
    expect(dentedTicks).toBeGreaterThan(20 * TICKS_PER_SEC);

    // And it earns it back.
    for (let i = 0; i < 30 * TICKS_PER_SEC; i++) tick();
    const [h, t] = tick();
    expect(Math.abs(h.wealth - t.wealth)).toBeLessThan(0.03);
});

test('the dent slows the sites in the district that went dark', () => {
    const hacked = boot();
    const twin = boot();
    run(hacked, 40);
    run(twin, 40);
    // Both sit through the same blackout, so their sites freeze alike; only one
    // district's books feel it. The twin's trade is held whole, so after power
    // returns the two differ by the lost trade and nothing else.
    hackBlackout(hacked.street, SOUTH);
    hackBlackout(twin.street, SOUTH);
    while (isDark(hacked.street, SOUTH)) {
        run(hacked, DT);
        run(twin, DT, () => { twin.city.economy.districts[SOUTH].wealth = 1; });
    }
    const south = (w) => inZone(w.city, SOUTH);
    const grow = (w) => {
        const start = south(w).map(builtHeight);
        run(w, 20);
        return south(w).reduce((sum, p, i) => sum + builtHeight(p) - start[i], 0);
    };
    expect(grow(hacked)).toBeLessThan(grow(twin));
});

// One district's market against lots held still: the lots in `standing` are
// finished, every other lot is bare, and no firm comes or goes — so whatever
// moves the demand is what stands on the lots.
function marketWith(standing, secs = 90) {
    const { city, street } = boot();
    for (const d of city.economy.districts) Object.assign(d, { firms: { com: 0, ind: 0 }, nextMove: Infinity });
    const finished = (p) => standing.some((lot) => lot.x === p.x && lot.z === p.z);
    const heightOf = (p) => (finished(p) ? p.heights[STAGE.HIGH] : 0);
    for (let i = 0, n = secs * TICKS_PER_SEC; i < n; i++) {
        tickStreet(street, DT);
        tickEconomy(city.economy, city.parcels, heightOf, street, DT);
    }
    return districtReport(city)[SOUTH];
}

test('what grows on one use moves the demand for the others', () => {
    const { city } = boot();
    const lot = (use) => inZone(city, SOUTH).find((p) => p.use === use);
    const bare = marketWith([]);
    const office = marketWith([lot('com')]);
    const works = marketWith([lot('ind')]);
    const worksAndHomes = marketWith([lot('ind'), lot('res')]);
    expect([bare.demand.res, bare.demand.com, bare.demand.ind].every((v) => v > 0.3 && v < 0.42)).toBe(true);

    // An office tower is jobs, and jobs want homes; its shops want stock...
    expect(office.jobs).toBeGreaterThan(bare.jobs);
    expect(office.demand.res).toBeGreaterThan(bare.demand.res + 0.2);
    expect(office.demand.ind).toBeGreaterThan(bare.demand.ind + 0.1);
    // ...and it is commercial floor the district now has to fill.
    expect(office.demand.com).toBeLessThan(bare.demand.com - 0.2);

    // Homes near work are residents with pay, and pay is spent in the shops.
    expect(works.demand.res).toBeGreaterThan(bare.demand.res + 0.2);
    expect(worksAndHomes.homes).toBeGreaterThan(works.homes);
    expect(worksAndHomes.demand.com).toBeGreaterThan(works.demand.com + 0.08);
    expect(worksAndHomes.demand.res).toBeLessThan(works.demand.res - 0.2);
});

test('when the firms leave, offices and works go first, and homes follow the jobs out', () => {
    const world = boot();
    run(world, 150);
    for (const d of world.city.economy.districts) {
        d.firms.com = 0;
        d.firms.ind = 0;
        d.nextMove = Infinity;
    }
    const south = inZone(world.city, SOUTH);
    const workplaces = south.filter((p) => p.use !== 'res' && builtHeight(p) > 0);
    const homes = south.filter((p) => p.use === 'res' && builtHeight(p) > 0);
    const before = new Map(south.map((p) => [p, builtHeight(p)]));
    expect(workplaces.length).toBeGreaterThan(0);
    expect(homes.length).toBeGreaterThan(0);

    run(world, 60);
    workplaces.forEach((p) => expect(builtHeight(p)).toBeLessThan(before.get(p)));
    // There are still as many jobs as homes, so for now the homes hold.
    expect(districtReport(world.city)[SOUTH].jobs).toBeGreaterThanOrEqual(districtReport(world.city)[SOUTH].homes);
    homes.forEach((p) => expect(builtHeight(p)).toBe(before.get(p)));

    // Then the jobs fall below the homes, and the homes empty after them.
    run(world, 120);
    const [s] = districtReport(world.city);
    expect(s.jobs).toBeLessThan(s.homes);
    homes.forEach((p) => expect(builtHeight(p)).toBeLessThan(before.get(p)));
});

test('left alone for ten minutes, the city keeps building and keeps losing', () => {
    const world = boot();
    const WINDOW_SECS = 180;
    const ups = [];
    const downs = [];
    let stages = world.city.parcels.map((p) => p.stage);
    let heights = world.city.parcels.map(builtHeight);
    let still = 0;
    let longestStill = 0;
    let t = 0;
    run(world, 600, () => {
        t += DT;
        const w = Math.floor(t / WINDOW_SECS);
        ups[w] ??= 0;
        downs[w] ??= 0;
        world.city.parcels.forEach((p, i) => {
            if (p.stage > stages[i]) ups[w]++;
            if (p.stage < stages[i]) downs[w]++;
        });
        const moved = world.city.parcels.some((p, i) => builtHeight(p) !== heights[i]);
        still = moved ? 0 : still + DT;
        longestStill = Math.max(longestStill, still);
        stages = world.city.parcels.map((p) => p.stage);
        heights = world.city.parcels.map(builtHeight);
    });
    // Every three minutes, something went up and something came down — not a
    // boom that fills the lots and freezes, not a bust that empties them.
    for (let w = 0; w < 3; w++) {
        expect(ups[w]).toBeGreaterThan(0);
        expect(downs[w]).toBeGreaterThan(0);
    }
    // And no lot in the city stood still for a minute and a half together.
    expect(longestStill).toBeLessThan(90);
});

test('the district readout is on screen and says what the economy says', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?capture=1');
    await page.waitForFunction(() => window.__game?.draws() > 0, null, { timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('#districts [data-jobs]').length === 2);

    const panel = page.locator('#districts');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('SOUTH');
    await expect(panel).toContainText('NORTH');
    const [shown, truth] = await page.evaluate(() => [
        [...document.querySelectorAll('#districts [data-jobs]')].map((e) => +e.dataset.jobs),
        window.__game.economy().map((d) => d.jobs),
    ]);
    shown.forEach((jobs, i) => expect(Math.abs(jobs - truth[i])).toBeLessThanOrEqual(truth[i] * 0.05));
    expect(errors).toEqual([]);
});
