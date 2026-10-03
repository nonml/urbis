# M3.S2 — Can traffic run on the graph?

Spike for **M3-9** (one 50 ms sim step ≤ 4 ms) and the traffic tasks M3.T29-T35.
Prototype: `spikes/m3-traffic/proto.js` — Node, no browser, no three.js, never in
`src/`. Checks and the measurement run with:

```bash
npx playwright test -c spikes/m3-traffic/playwright.config.js
```

Machine: Apple M3, 8 cores, macOS (darwin arm64), Node v24.13.0. Numbers below are
three warmed runs of the test; the prototype is deterministic (all seeds via
`mulberry32`), so only GC noise moves.

## What the prototype runs

- **Graph:** 4 N-S avenues × 3 E-W crossings = 6 districts, 12 nodes, 17 edges of
  200 m. Every edge carries two lanes; `lanePoint` offsets 2.4 m to the *right* of
  travel, settling `world.js:laneCenterLine`'s today-mixed sides.
- **Trips:** 2,000 parcels on the edges, 60 cars on A* routes between parcel nodes.
  A car drives right-hand lanes with a following gap `(gap − 2.5 m) × 1.5`, brakes on
  a `sqrt(2·a·distance)` arrival curve at stop lines, and interpolates through each
  junction over 0.6 s. Verified: no step moves a car more than 1.2 m (VMAX 13.5 m/s ⇒
  0.675 m/step; assertion in the test), 614 trips completed in 500 s of the 60-car run.
- **Signals:** every junction of two ways is two-phase, 24 s cycle, 11 s green + 1 s
  all-red; one car claims a junction at a time.
- **Commute flow:** every resident's home→job trip as one count on each edge of its
  route; 5,000 residents over the 2,000 parcels, only 144 distinct node pairs, so 132
  A* runs cold. Busiest edge carries 1,218 of the 5,000 residents.

## Measured step cost (10,000 steps at 50 ms, flow relaid every game hour)

| visible cars | mean step | p95 step | worst step | flow cold | flow warm |
|---|---|---|---|---|---|
| 60 (M3-9's count) | 0.030 ms | 0.047 ms | 3.6 ms | 3.0–3.6 ms | 1.6–1.7 ms |
| 300 | 0.16 ms | 0.23 ms | 2.3 ms | 2.1–2.8 ms | 1.7 ms |
| 600 | 0.38 ms | 0.52–0.57 ms | 2.8–5.1 ms | 2.0–2.2 ms | 2.0–2.1 ms |

Verdict: **the traffic tick is not the risk.** At M3-9's 60 cars a step is ~0.05 ms,
two orders under the 4 ms budget, and holds its p95 at 10× the count. The risk is the
**hourly commute relayout**: 5,000 residents cold costs 2–3.6 ms and warm (cached
routes) 1.6–2.1 ms. If M3.T35 rebuilds the whole flow inside one step, that step alone
blows M3-9's 4 ms. Keep the OD route cache and either amortise the rebuild, update the
per-edge counts incrementally, or apply the hour weight to a stored table. Walkers are
not in this prototype (M3.T33); at these margins 150 of them cannot fill 4 ms.

## Failure cases found

1. **A car with no route.** With the three `x = 200…400` crossing edges closed, 2,611
   of 5,000 residents have no route: `findRoute` returns `null`, `buildCommute` reports
   `noRoute`, and `spawnCar` counts and skips rather than dropping a car in place. This
   is the honest signal M3.T30/T35 must carry, not a silently empty street.
2. **Gridlock at a junction.** With signals and the "don't block the box" rule (a green
   still stops when the next lane's first 8 m are full), 300 cars produce **0** cars
   stalled in a junction mouth. Remove both (all-green, no box rule) and 10,000 steps
   leave 22 cars in mouths, **21 stopped > 10 s, longest 396 s**. Signals and the box
   rule are load-bearing, not polish.

## Decisions for the tasks

- **M3.T29:** lift `lanePoint` (right-hand, 2.4 m), gap, arrival-curve braking and the
  0.6 s turn interpolation as the shape; keep one junction claim at a time.
- **M3.T30:** routes come from A* `findRoute(map, from, to, closed)`; cache per
  `map.version` and invalidate on every road op, or a removed road keeps carrying cars.
- **M3.T31:** two-phase 24 s/11 s + 1 s all-red is enough for 60–600 cars; the
  one-vehicle junction becomes the bottleneck above ~1,000 cars.
- **M3.T32:** position and yaw are continuous from `lanePoint`/turn interpolation, so
  `render/traffic.js` can read them directly; no jump correction needed.
- **M3.T35:** the flow is a per-edge count (busiest 1,218 residents), not per-car
  simulation. Budget its relayout as above; a closed road that strands 2,611 commuters
  is exactly the kind of cause the economy should feel.
- **M3-9 / M3.T39:** `scripts/simbench.mjs` must include the flow rebuild as a step and
  assert the p95, not the mean; add the 150 walkers and re-run.

## Not covered

Walkers, drawing, parcels with true frontage, per-hour arrival curve and the economy's
reaction to late workers are M3.T33-T35; this spike only proves the traffic cost and
the two failure modes. The prototype stays in `spikes/` and is not wired to the game.
