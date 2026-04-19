# 27B Local Model Tuning Notes

You are a 27B-class local model (Gemma-3 27B / Mistral-Small 3 / Qwen2.5-Coder 32B or similar). Operate within these limits.

## Context budget

- Keep prompt ≤ 24k tokens. Degradation past that is severe.
- If a task's `files_allowed` + `files_reference` exceed this, mark the task `needs_split` and move on. Do NOT try to compress — curator will split.

## Temperature

- Code tasks (`bugfix`, `feature`, `refactor`, `perf`, `test`, `hud`): temp 0.15.
- Content tasks (`content`): temp 0.5.
- Quest flavor text or dialogue: temp 0.8.
- Critic reviews: temp 0.2.

## Output discipline

- Never produce speculative code. If you are unsure what a function does, read it — don't guess.
- Never invent imports. If an import path doesn't resolve, fail fast.
- Never stub tests as `expect(true).toBe(true)`. A missing test is better than a fake one.
- When the gate fails, fix the real cause; do not loosen the gate.

## Known weaknesses you must guard against

1. Over-eager refactoring — resist the urge to "clean up" code outside your task scope.
2. Hallucinated APIs — when in doubt about a Three.js / Rapier / Tone API, check `node_modules/<pkg>/package.json` or `.d.ts` before using.
3. Drift from the manual — re-read the relevant section of `docs/ROADMAP_2Y.md` at the start of each task, not once per session.
4. Long diff rewrites — prefer minimal targeted edits over full-file rewrites. Roo Code's `apply_diff` is your friend.
