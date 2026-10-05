# The district economy

Feature slice 2 in `docs/CHARTER.md`, and the third step of `docs/ZONING.md`
("demand stops being a sine wave"). Read `AGENTS.md` first; this assumes it.

## Why this exists

Since slice 046 the lots grow and decline, but the demand that moves them was a
seeded double sine: the city breathed on a timer, and nothing the city built or
the player did could change what it built next. Pillar 3 wants a cause the player
can reach; pillar 4 wants consequences sized to the act. Neither is possible while
demand is a wave.

Now demand is what a small, deterministic economy says. What stands on the lots
moves it, what happens in a district moves it, and it decides what grows next.

## What a district is

**A district is a power zone** — `zoneAt(z)` in `street.js`, split at `z = 0`:
`south` (zone 0) and `north` (zone 1). Five lots each.

- It is the unit the player can already act on. The blackout hack cuts exactly
  one zone, so a zone is the natural size for a consequence to land on (pillar 4).
- It needs no new geometry and no new table: every parcel already carries
  `powerZone`, and every renderer already groups by it.
- Something smaller (a block, a lot) would be too small to have an economy with
  five lots in it; something bigger (the city) would make every act city-wide.

Districts do not trade with each other in this slice. That is deliberate: a
blackout in one must never touch the other, and it is tested bit-for-bit.

## The model — five named quantities

Per district, in people (a resident or a worker per 25 m² of floor):

| Quantity | What it is |
|---|---|
| **homes** | the established district's homes plus the residential floor on its lots |
| **jobs** | the established district's jobs plus the commercial and industrial floor on its lots |
| **wealth** | spending power, 0..1. Chases employment (`min(jobs, homes) / homes`); drains while the district is dark |
| **firms** | offices and works from beyond the map wanting floor in the district, in the jobs they would bring |
| **demand** | per use, 0..1 — what each lot reads (`demandFor(city, parcel)`) |

The *established district* is the shipped towers. They are fixed and balanced (as
many jobs as homes, shops for its spending, workshops for its shops), sized at
`0.4` people per m² of lot land — about what the lots hold at full build. So a
finished district is roughly twice the one it started as, and every lot is felt.

### The loop

```
  firms move in / out ──► offices wanted (com), works wanted (ind)
  (beyond the map)                     │
                                       ▼  commercial / industrial floor goes up
          ┌──────────────────────►  JOBS ──► homes wanted (res)
          │                                        │
          │                                        ▼  homes go up
          │                         HOMES × WEALTH ──► shops wanted (com)
          │                                        │
          │                                        ▼  shops go up
          └── more jobs ◄── SHOPS × WEALTH ──► workshops wanted (ind)

  Any use with more floor than its driver needs: its demand falls, its lots shed it.
  A dark district trades nothing: WEALTH drains, and with it shops and workshops.
```

Need against have, per use:

| Use | Need | Have |
|---|---|---|
| `res` | jobs | homes |
| `com` | homes × wealth × 0.35 + office firms | commercial floor |
| `ind` | commercial floor × wealth × 0.4 + works firms | industrial floor |

The price of a use is `0.36 + 1.5 × (need − have) / district size`, clamped to 0..1:
balance sits in zoning's hold band (lots neither start nor shed work). M1.T3 took
`GAP_GAIN` from `3` to `1.5`: a finished lot is 3–21 % of its district's size, so
at `3` one lot swung demand across most of the 0.28–0.55 band and uses sat pinned
or idle; at `1.5` a lot moves demand 0.04–0.31 and a firm move 0.05–0.11 — a nudge
across a band edge, not a slam. The fixed hand preset keeps gain `3`.
**Demand chases the price with a 20 s lag**: developers build on the last twenty
seconds' numbers, not today's, so a boom overshoots into a glut and a glut into a
shortage, instead of parking at a balance.

### The lot mix — jobs about equal homes (zoning.js)

In a generated city the mix is fixed when the city is made — `balanceUses` in
`zoning.js` — and the uniform roll of one use in three was the second half of the
bang-bang: two lots in three were workplaces, so lot jobs outran lot homes, homes
demand pinned while offices and works idled. `balanceUses` aims each district at
the full-build equilibrium — homes 48 % of the lots' floor, shops 29 %, works
23 %, then lots, and pairs trading uses, walk while that lowers the worst of the
three full-build gaps against `USE_ROOM = 0.04`, the price each use sits at full
(`0.36 + 1.5 × 0.04 = 0.42`, the top of the hold band). It measures each lot at
its full height, so lumpy lots land as close to the centre as their shapes allow.
Unzoned free lots are left for the player: zoning one is how the balance shifts,
which M1-2 measures.

### The credit line, and the pace M1-2 reads (M1-2, M1-3)

A rezone earns a news line when the floor it added lifts a use the chain pulls
where the district can see it: the pulled use's demand reaches `BREAK_GROUND_AT`,
or the district's need for it grows 2 % of the district — the jobs the new floor
itself added, because `need.res` moves with real floor, never with a firm's queue
— while that use's demand is in the building band. The first pulled use the
rezone lifts is credited; the line gives up at 300 s so an old rezone cannot
claim the market's own swing.

The last stage had to slow for that A/B to read at minute 5. At 45 game seconds
a finished lot's tower stage, every res lot on seeds 7 and 22 stood finished
before the check, so no rezone could show a storey there at all: the five seeds'
gains were 0, +5, 0, +22, +7. The last stage is 90 s (`STAGE_SECS` in
`zoning.js`); the first stages are unchanged, so a player's zoned lot still
raises its first floor inside 60 game seconds (M1-1). On seeds 7, 11, 22, 33 and
73 the A/B now reads **0, +1, +1, +22, +4** — 4 of 5 (M1-2) — and the credit
line lands on every seed that passes, never on the untouched control (M1-3).

### Why it never settles (pillar 2)

A closed deterministic loop settles; this one is kicked. In a generated city,
every 25–70 s a firm moves in or out — offices or works, **3–7 % of the
district's size in jobs** (was 6–15 %), the kind furthest from its usual level
taking the move (within `FIRM_TIE = 2 %`, the draw picks), so neither kind can
starve while the other absorbs every turn. The odds lean back toward the usual
level (12 % of the district per kind, `FIRMS_PULL = 8`), so the district wanders
without drifting, inside the band the 1.5 gain leaves. The generated city still
boots with twice the usual firms queueing — the boom the first minutes build
into — but the surplus above the usual level is served off as the market works
(`BOOT_THIN_SECS = 240`), so it no longer leaves one use pinned for the whole run.

Measured with the pure sim, ticked the way `main.js` ticks it (50 ms steps):
`node scripts/economy-probe.mjs --seeds 1-5 --minutes 10` before and after the
constant changes, same sitting; the per-district check is
`tests/accept/m1-calm.test.js`:

| Demand state | before (gain 3, firms 6–15 %) | after, generated city (gain 1.5, firms 3–7 %, balanced mix) |
|---|---|---|
| pinned ≥ `BREAK_GROUND_AT`, per district, seeds 1–5 | up to **100 %** (four seeds; the fifth 92 %) | worst seat **33 %** (seed 3, south, industrial) |
| idle < `DECLINE_AT`, per district, seeds 1–5 | worst **37 %** (seed 3, north, commercial) | worst **6 %** |
| in band, median pooled over both districts | res **2 %** | res, com, ind **89 %, 91 %, 85 %** |
| A/B rezone, flat storeys at minute 5, zoned − untouched | **0, 0, 0, 0, 0** | **+3, +3, +9, 0, +1** — 4 of 5 seeds (M1-2) |

What a slump looks like, from `tests/economy.spec.js`: when the firms leave, the
offices and works come down first; the homes hold while jobs still match them,
then empty once the jobs fall below the homes. That is the chain a player can read
— and name: *the works left the south district, then the jobs, then the people.*

### A blackout (pillar 4)

While a zone is dark its district trades nothing: wealth drains with a 60 s time
constant and recovers with 25 s. One blackout (8.9 s dark) costs the south about
14 % of its wealth (1.00 → 0.86); commercial demand then runs up to 0.08 below a
never-cut twin for about a minute after the power returns — the sites there build
slower (`growthRate` scales with demand) — and wealth is back within 0.02 of the
twin a minute after. The other district is **bit-identical** to the twin
throughout: the firms draw a fixed four numbers from the `sim` stream per move
whatever happens, so one district's fortunes can never reach the other's through
the RNG either.

A single blackout is a dent. A campaign is not. Rehacking the south as fast as its
cooldown allows for three minutes (16 hacks) holds its wealth at 0.43–0.79 and
swings its commercial and industrial demand between nothing and pinned. Its sites
are frozen while dark, so the damage lands when the lights stay on: a minute after
the campaign ends, the south's offices and works stand at about a sixth of its
never-cut twin's, and its homes at half — the homes follow the jobs out. Big acts
spread; small acts stay local.

## The readout (law 6)

The lots are the main readout: cranes, rising shells, buildings coming down. The
panel bottom-left (`#districts`, `src/render/economy.js`) says why, per district:

- **jobs / homes** — bars on one scale (the district at full build), with counts.
- **wealth** — goes amber while the district is dark.
- **demand res / com / ind** — the market's want for each use, and what that use's
  lots are doing right now: ▲ rising, ▼ coming down, · holding, – no lot of it here.
- **firms** — the latest move: `works out −26 · 12s`.

It refreshes four times a second, is DOM only (+0 draws), and reads nothing but
`districtReport(city)`.

## For other tracks

- `demandFor(city, parcel)` — the one accessor a parcel should use. It reads the
  parcel's own district and its current `use`, so a rezoned lot is priced at once.
- `city.demand[use]` — kept, now the mean of the two districts. For a glance only.
- `districtReport(city)` — plain data: `jobs`, `homes`, `wealth`, `dark`, `firms`,
  `demand`, `need`, `have`, `lots`, `trend` and `last` (the latest firm move:
  `use`, signed `jobs`, `ago` seconds). Also `window.__game.economy()`.
- **A decline reason is derivable from that state.** For a parcel of use `u` in
  district `d`: `need[u] < have[u]` is *too much u for the district*; for `res`,
  `jobs < homes` is *jobs left the {d} district*; a recent `last` with negative
  `jobs` is *an office / works left the {d} district*; `wealth` well under 1 with
  `dark` or a recent blackout is *trade lost to the blackout*.

## Tests

`tests/economy.spec.js`, pure sim in Node except the last:

- the same seed runs the same economy;
- a blackout dents its own district, recovers, and never touches the other
  (bit-identical twin);
- the dent slows the sites in the district that went dark;
- what grows on one use moves the demand for the others (an office tower wants
  homes and stock; homes with pay want shops; each use's own glut depresses it);
- when the firms leave, offices and works go first, and homes follow the jobs out;
- left alone for ten minutes, the city keeps building and keeps losing;
- the readout is on screen and says what the economy says.

Each was mutation-checked: a blackout reaching both districts, no trade lost in the
dark, firms that never move, residents that do not spend, jobs that do not pull
homes and a market with no lag each fail at least one of them.

M1's own checks: `tests/accept/m1-calm.test.js` and
`tests/accept/m1-rezone-ab.test.js` — no district's use pinned or idle past 40 %
of ten minutes; the works rezone adds a flat storey on 4 of 5 seeds (7, 11, 22,
33, 73) and earns its credit line on every seed that passes, the untouched
control never showing the line — each one seed per process on the A/B runner.
`tests/economy.spec.js` keeps its hand-preset expectations, unchanged.

`tests/zoning.spec.js`'s slump test now holds every district's market at zero
each tick instead of freezing the old sine at its trough — the same claim.

## What this deliberately does not do

- **No trade or commuting between districts.** It is the obvious next step for
  "big acts spread", and it has to keep one blackout local.
- **No prices, taxes or money the player holds.** The mission balance is separate.
- **No per-citizen simulation.** A handful of quantities per district, by design.
- **No draws.** The economy is sim and DOM; what it changes on screen is the lots.
