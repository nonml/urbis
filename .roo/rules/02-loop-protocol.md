# Loop Protocol

When the user sends "go", "continue", "next", or any equivalent — do not ask for clarification. Execute the loop.

## The loop

```
1. Read docs/CHECKLIST_2Y.md — find the first unchecked [ ] item
2. If none: print "checklist complete" and stop
3. Print: [boot] next=<item-id>  open=<count remaining>
4. Execute the 10-step protocol from 01-noctune-agent.md
5. Print: [done] <item-id>  or  [rework] <item-id> <reason>
6. Return to step 1
```

## Session start line (print once)

```
[boot] reading checklist...  open=<N>  next=<first-open-id>
```

## Halt — stop and explain when

- 3 consecutive reverts
- Task needs files outside `files_allowed`
- Task needs a new npm package
- `npm test` is consistently failing across multiple unrelated tasks (infra problem, not code problem)

## Between tasks

No summaries. No "here's what I did." The commit message and checklist tick are the record. Stay silent and move to the next task.
