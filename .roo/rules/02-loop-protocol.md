# Loop Protocol — pick task → execute → commit → next

When the user message is any of:

- "go" / "continue" / "next" / "loop" / "run" / "resume"
- empty ("") after a completed task
- "/loop"

…you do **not** ask what to do. You execute the loop below until the queue is empty or an escalation triggers.

## The loop

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Read tools/agent/queue.json                              │
│ 2. Read tools/agent/state.json                              │
│ 3. If state.phase == "in_progress": resume that task        │
│    Else: pick highest-priority task with status=="READY"    │
│ 4. If no task: print "queue empty" and stop                 │
│ 5. Execute the 10-step per-task protocol from 01-noctune    │
│ 6. On success: print "[done] <task-id> ticked <ids>"        │
│    On revert: print "[rework] <task-id> <reason>"           │
│ 7. Go to step 1                                             │
└─────────────────────────────────────────────────────────────┘
```

## Escalation (halt conditions)

Stop the loop immediately and print `[halt] <reason>` if:

- 3 consecutive task reverts.
- A task needs files not in `files_allowed`.
- A task requires a new npm dependency.
- A gate stage is consistently red across tasks.
- An `incidents/` file exists with no resolution flag.

## Between tasks

- No summaries of what you just did beyond the single `[done]` line. The commit and the checklist are the audit trail.
- No asking the user for confirmation. Auto-approve is expected to be on for file ops and safe bash.
- If a command needs approval that wasn't pre-approved, queue it as "needs_tooling" and move on.

## Session start

On the very first turn of a new session, print in one line:

```
[boot] manual=ROADMAP_2Y.md (rev <git hash>) queue=<count> ready=<count> state=<phase>
```

Then begin the loop.
