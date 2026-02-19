# Plan (Milestones A → U)
This folder is the step-by-step ticket plan from the current prototype to **1.0.0 (Milestone U)**.
Rules:
- Work milestones in order.
- Every ticket must meet its Acceptance + DoD before merging.
- Run `npm run test` before every PR.
- Keep determinism: sim must never depend on render/UI timing.

## Milestone index
- **Milestone A** — Foundation: deterministic core, state/schema, dev workflow
- **Milestone B** — Third-person playable avatar + camera + interaction baseline
- **Milestone C** — Procedural city generation v1 (districts, roads, parcels, POIs)
- **Milestone D** — Mega-city performance: chunk streaming, instancing, navigation grid
- **Milestone E** — Core city-builder loop v1 (build, zone, services, economy, goals)
- **Milestone F** — Citizen simulation v2 (needs, schedules, jobs, pathing, stories)
- **Milestone G** — Hacking gameplay v1 (scan, breach, cameras, traffic control, heat)
- **Milestone H** — Quest framework v2 (data-driven steps, markers, branching, rewards)
- **Milestone I** — Case Files v1 (side-story chains, evidence, suspects, investigations)
- **Milestone J** — Factions + reputation + world rules
- **Milestone K** — Rival AI v2 (strategic pressure + counterplay + intel)
- **Milestone L** — Player vehicles v1 (driving, entering/exiting, road adherence)
- **Milestone M** — Police + Heat + Chase v1 (detection, pursuit, evasion, hacks)
- **Milestone N** — Traffic + ambient vehicles + pedestrians (city life layer)
- **Milestone O** — Dynamic crisis director v2 + world events (systems-driven storytelling)
- **Milestone P** — UI/UX overhaul (HUD, minimap, menus, accessibility)
- **Milestone Q** — Content pipeline + tooling (editors, validation, debug spawners)
- **Milestone R** — Audio pass (SFX, ambience, music layers, mix)
- **Milestone S** — VFX + feedback pass (hacks, chases, crises, UI polish)
- **Milestone T** — Balance + tutorial + QA hardening (pre-1.0)
- **Milestone U** — 1.0.0 Release build (packaging, polish locks, release process)
