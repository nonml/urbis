# Stage 2: review a list (GLM; Watch Dogs again with DeepSeek)

Followed by the game's stage 1 brief.

`FILE` lists every feature of TITLE (scope and format in the brief below). Another model
wrote it, a few hundred rows. Your job: add what it missed and flag what is wrong.

## How to work: one category at a time

The file is too long to review in your head at once. If you think it all through before
writing, you run out of output and lose everything. So, for each `##` category in order:

1. Read only that category's rows (use the Read tool's offset and limit).
2. Think only about that category: what feature of TITLE belongs here and is missing?
3. With one edit, append the missing rows at the end of that category, in the same
   format, numbering on from its last row. Mark wrong rows in the same edit.
4. Go to the next category. Never review more than one category before writing.

## Marks

- A wrong row (the feature does not exist, or not in the entry named): set its Where cell
  to `WRONG: <one-line reason>`. Never delete a row.
- A row that repeats another: set its Where cell to `DUPLICATE of <ID>`.
- Follow the brief's rules: plain words, real features only, edit only `FILE`.

When every category is done, print per category how many rows you added, marked wrong
and marked duplicate, and stop.

The original brief follows.
