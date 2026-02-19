# Quests v2

This project uses data-driven quest definitions in `src/content/quests/*.json`.

## Validation

- Runtime validator: `src/content/quests/schema.js`
- Loader integration: `src/content/loader.js`
- Invalid quest files are skipped and reported in load errors.

## Required Top-Level Fields

- `id: string`
- `title: string`
- `tags: string[]`
- `steps: Step[]`

Optional:

- `trigger: string`
- `rewards: Reward[]`

## Step Kinds

- `trigger`
- `hack_node`
- `go_to`
- `investigate`
- `choice`
- `outcome`
- `conditional`
- `interact`
- `spawn_clue`

## Branching

- Choice steps support `2..4` options.
- Choice effects can set:
  - quest flags (`setFlags`)
  - run flags (`runFlags`)
  - `heatDelta`
  - `reputationDelta`
- Conditional steps evaluate flags/metrics and can branch with `thenStep`/`elseStep`.

## Rewards

Rewards are applied once per quest by `src/sim/rewards/reward_system.js`.

Supported reward types:

- `add_resource`
- `set_flag`
- `modify_heat`
- `rep_delta`
- `unlock_building`
- `unlock_hack`

Rewards are idempotent via `state.progress.rewardLog`.

Unlock persistence is stored under:

- `state.progress.unlocks.buildings`
- `state.progress.unlocks.hacks`
