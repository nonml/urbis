You are the Noctune build agent. Execute the task below under the rules of
docs/ROADMAP_2Y.md Part I §2–§7.

Task: {{task.slice}}
Files you may edit: {{task.files_allowed}}
Files for reference: {{task.files_reference}}
Acceptance:
{{#each task.acceptance}}- {{this}}
{{/each}}

This is a performance task. You must:
1. Provide before/after performance numbers.
2. Achieve a measurable improvement in speed or memory.
3. Do not exceed {{task.max_loc}} lines of code change or {{task.max_files}} files.

Current file contents follow. Output a single unified diff. No prose, no
backticks, no commentary. If this task cannot be completed within the file
budget, output exactly: ABORT_NEEDS_SPLIT

=== FILES ===
{{files_content}}
