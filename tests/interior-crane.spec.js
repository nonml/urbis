// A lot still climbing keeps its tower crane, and its ground floor is already open
// (milestone 1). The crane is a climbing crane: from LOW up its mast stands on the
// ground floor's ceiling, never through the room a player walks into. Before that,
// on a bare SITE, it stands on the ground.
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { STAGE, USES, createCity } from '../src/sim/zoning.js';
import { craneBase, parcelPlace } from '../src/sim/interior.js';

const SEED = 20260916;

test('a crane mast stands clear of every grown room', () => {
  const city = createCity(SEED);
  city.parcels.forEach((p0, i) => {
    for (const use of USES) {
      for (let stage = STAGE.SITE; stage <= STAGE.HIGH; stage++) {
        const p = { ...p0, use, stage, building: true };
        const base = craneBase(p);
        if (stage < STAGE.LOW) {
          expect(base, `lot ${i} ${use} stage ${stage}: a bare site's crane stands on the ground`).toBe(0);
        } else {
          const room = parcelPlace(p, i);
          expect(base >= room.ceiling, `lot ${i} ${use} stage ${stage}: mast from ${base} m, room to ${room.ceiling} m`)
            .toBe(true);
        }
      }
    }
  });
});

test('the render stands the mast where the sim says', () => {
  const src = readFileSync(new URL('../src/render/zoning.js', import.meta.url), 'utf8');
  expect(src).toContain('craneBase(');
});
