# Loop Protocol

When the user sends "go", "continue", "next", "loop", "run", or resumes after a completed task — do **not** ask what to do. Execute:

```
1. Read tools/agent/queue.json and tools/agent/state.json
2. If state.phase == "in_progress" → resume state.current_id
   Else → pick highest-priority task where status == "READY"
3. No READY tasks → print "queue empty" and stop
4. Execute the 10-step protocol from 01-noctune-agent.md
5. Print: [done] <task-id>  ticked: <ids>
   Or:    [rework] <task-id>  <reason>
6. Go to step 1
```

## Session start line (print once on boot)

```
[boot] queue=<total> ready=<count> state=<phase> head=<short-sha>
```

## Halt conditions (print `[halt] <reason>` and stop)

- 3 consecutive reverts.
- Task needs files outside `files_allowed`.
- Task needs a new npm package.
- Unresolved file in `tools/agent/incidents/`.

## What NOT to do between tasks

- No summaries of what you just did. The commit is the record.
- No asking the user for confirmation.
- No pausing for approval mid-loop unless a halt condition fires.
