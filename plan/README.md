# Project Plan (current → 1.0.0)

This folder contains milestone-by-milestone tickets to take the repo from the **current prototype state** to a **1.0.0 playable build**.

## How to use
- Work milestone-by-milestone in order: **A → … → U**
- Each ticket includes:
  - **Objective** (what/why)
  - **Design** (how it should work)
  - **Specs** (data shapes + constraints + file targets)
  - **Implementation details** (step-by-step)
  - **Acceptance criteria** (what must be true)
  - **Definition of Done (DoD)** (how we consider it “shippable”)

## Repo assumptions
- Tech: vanilla JS + ES modules (recommended to migrate to Vite during Milestone E).
- Renderer: Three.js (prefer bundled in build; CDN acceptable for dev).
- Determinism: **all gameplay randomness uses `rng.js`**.

## Milestones Overview
- **A:** Stabilize foundations + deterministic sim + perf guardrails (0.3.x)
- **B:** Procedural city gen (districts/roads/parcels) + exploration loop (0.6.x)
- **C:** Quest/storylet system + “Case Files” side-stories (0.9.x)
- **D:** Rival AI + progression + win/lose + balance (0.10.x)
- **E:** Vertical slice alpha + internal QA + playtest pipeline (0.12.x)

- **F:** Dual-mode foundation + God Mode tools (0.14.x)
- **G:** Economy + services v1 (0.16.x)
- **H:** Infrastructure networks + Data Grid (0.18.x)
- **I:** Traffic sim + player driving (0.20.x)
- **J:** Citizen sim v2 (households/jobs/crime/social graph) (0.22.x)
- **K:** Surveillance + influence operations (Watch Dogs layer) (0.24.x)
- **L:** Factions + politics + policy system (0.26.x)
- **M:** Dynamic crises v2 + emergency response (0.28.x)
- **N:** Campaign structure + case expansion (0.30.x)
- **O:** Roguelike meta-progression + legacy (0.32.x)
- **P:** Dev tooling + content pipeline (0.34.x)
- **Q:** Performance + streaming finalization (0.36.x)
- **R:** Visual/audio polish pass (0.38.x)
- **S:** QA automation + balancing (0.40.x)
- **T:** Beta release prep (0.42.x)
- **U:** Release 1.0.0 (1.0.0)

> Date updated: 2026-02-26
