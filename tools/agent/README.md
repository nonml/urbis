# tools/agent/

Roo Code reads and writes these files directly — there are no Node scripts.

| Path | Purpose |
|------|---------|
| `queue.json` | Task backlog — array of task objects with `status`, `files_allowed`, `acceptance`, `checklist_items` |
| `state.json` | Cross-session state — `{phase, current_id}` |
| `prompts/` | Reference prompt skeletons by task type (bugfix, feature, content, hud, perf, test, refactor, critic, curator) |
| `schemas/` | JSON Schema definitions for queue entries and changelog snippets |
| `templates/` | Content-generation templates — populated in Q5 |
| `baselines/` | Reference screenshots (PNG) for visual regression |
| `pending_changes/` | CHANGELOG snippets — one `.md` per shipped task, cleared at release |
| `logs/` | Session transcripts — gitignored |
| `incidents/` | Halt files — Roo writes here when escalating to operator |
| `approvals/` | Operator approval files — `qN.json` per quarter to unlock the major tag |

Operating rules: `.roo/rules/` and `docs/ROADMAP_2Y.md`.
