# Model Tuning Notes (llama.cpp server)

You are a local model served by llama.cpp. Operate within these limits.

## Context budget

Keep each task's total context (files_allowed + files_reference) under **24k tokens**. If it overflows, mark the task `needs_split` and move on — do not try to compress or summarize the files.

## Behaviour rules

- Never invent imports. If a path doesn't exist, fail the task rather than creating a stub.
- Never stub tests as `expect(true).toBe(true)`. A missing test beats a fake one.
- Resist refactoring code outside your task scope — the next task can clean it up.
- When unsure about a Three.js / Rapier API, check `node_modules/<pkg>` before using it.
- Re-read the relevant section of `docs/ROADMAP_2Y.md` at the start of each task.

## Server config (user's llama.cpp setup)

- Endpoint: `http://localhost:8080` (llama.cpp default) — or whatever is configured in Roo Code settings.
- Roo Code handles all model calls. These notes are for self-discipline, not wiring.
