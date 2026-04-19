# Roo Code Workspace Config

This directory configures Roo Code to run as the Noctune build agent.

## Files

- `rules/01-noctune-agent.md` — binding rules (always loaded).
- `rules/02-loop-protocol.md` — the pick-task → commit → next loop.
- `rules/03-model-tuning.md` — 27B local model guardrails.

## Required Roo Code setup

1. **Provider:** Ollama (or llama.cpp HTTP).
2. **Endpoint:** `http://localhost:11434` (Ollama default).
3. **Model:** `gemma3:27b` or equivalent 27B local model.
4. **Auto-approve:**
   - Read files: ON
   - Write files: ON (scoped to this workspace)
   - Execute commands: ON for the allowlist below
   - Browser actions: OFF (not needed)
5. **Command allowlist (auto-approve):**
   - `npm run lint:basic`
   - `npm run check:no-math-random`
   - `npm run validate`
   - `npm test`
   - `npm run test:e2e` (only if explicitly in the task)
   - `git status`, `git diff`, `git log`, `git show`
   - `git add`, `git commit` (no `git push`)
   - `node scripts/*.mjs`
6. **Max requests per task:** 30 (enough for read → edit → gate → commit).
7. **Context window:** 24k tokens (see `rules/03-model-tuning.md`).

## One-time kickoff

After configuring Roo Code, send a single message in the chat:

```
go
```

The agent reads the manual, picks the highest-priority READY task from
`tools/agent/queue.json`, executes it end-to-end (edit → gate → commit →
tick checklist), then picks the next, and the next, until the queue is
empty or an escalation triggers. No further prompting needed.

## Alternative: headless loop (no Roo Code)

If you prefer a terminal-only loop (for cron / background / CI), the
Node implementation in `tools/agent/` can drive the same pipeline:

```
MODEL_URL=http://localhost:11434 MODEL_NAME=gemma3:27b \
  node tools/agent/loop.mjs
```

See `tools/agent/runner.mjs` for the single-iteration entry point and
`tools/agent/loop.mjs` for the forever-loop wrapper.
