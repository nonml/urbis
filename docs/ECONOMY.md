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

The price of a use is `0.36 + 3 × (need − have) / district size`, clamped to 0..1:
balance sits in zoning's hold band (lots neither start nor shed work), and a gap of
a tenth of the district moves it 0.3 — enough to break ground or shed a stage.
**Demand chases the price with a 20 s lag**: developers build on the last twenty
seconds' numbers, not today's, so a boom overshoots into a glut and a glut into a
shortage, instead of parking at a balance.

### Why it never settles (pillar 2)

A closed deterministic loop settles; this one is kicked. Every 25–70 s per district
a firm moves in or out — offices or works, 6–15 % of the district's size in jobs.
The odds lean back toward the usual level (12 % of the district per kind), so the
district wanders without drifting to empty or full. The district boots with twice
the usual firms queueing: the boom the first minutes build into.

Measured with the pure sim, ticked the way `main.js` ticks it (50 ms steps):

- **The game's seed, 30 idle minutes:** some lot changed stage in 29 of the 30
  minutes — a lot went up in 20 of them and one came down in 20; the whole city
  never stood still for more than 49 s; some lot was moving on 90 % of ticks.
- **Twelve seeds, 10 idle minutes each:** longest city-wide stillness 11–142 s
  (median 28 s), lots moving on 64–97 % of ticks, ending between a third and four
  fifths of the way to fully built — never frozen full, never emptied.

What a slump looks like, from `tests/economy.spec.js`: when the firms leave, the
offices and works come down first; the homes hold while jobs still match them,
then empty once the jobs fall below the homes. That is the chain a player can read
— and name: *the works left the south district, then the jobs, then the people.*

### A blackout (pillar 4)

While a zone is dark its district trades nothing: wealth drains with a 60 s time
constant and recovers with 25 s. One blackout (8.9 s dark) costs the south about
13 % of its wealth (1.00 → 0.87); commercial demand then runs up to 0.08 below a
never-cut twin for about a minute after the power returns — the sites there build
slower (`growthRate` scales with demand) — and wealth is back within 0.03 of the
twin a minute after. The other district is **bit-identical** to the twin
throughout: the firms draw a fixed four numbers from the `sim` stream per move
whatever happens, so one district's fortunes can never reach the other's through
the RNG either.

A single blackout is a dent. A campaign is not. Rehacking the south as fast as its
cooldown allows for three minutes (16 hacks) holds its wealth near 0.45 and its
commercial and industrial demand near zero. Its sites are frozen while dark, so
the damage lands when the lights stay on: a minute after the campaign ends, the
south's offices and works stand a third lower than its never-cut twin's, and its
homes have started to follow. Big acts spread; small acts stay local.

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

`tests/zoning.spec.js`'s slump test now holds every district's market at zero
each tick instead of freezing the old sine at its trough — the same claim.

## What this deliberately does not do

- **No trade or commuting between districts.** It is the obvious next step for
  "big acts spread", and it has to keep one blackout local.
- **No prices, taxes or money the player holds.** The mission balance is separate.
- **No per-citizen simulation.** A handful of quantities per district, by design.
- **No draws.** The economy is sim and DOM; what it changes on screen is the lots.
