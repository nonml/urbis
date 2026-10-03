# Stage 5: merge the mechanics (by section; above 40 rows, batches of 40 then a join)

## Merge

Read `IN`. It lists K things that Cities: Skylines (IDs `CS-`), GTA (`GTA-`), Watch Dogs
(`WD-`) or Cyberpunk 2077 (`CP-`) have and the Urbis game lacks, all in the section
"SECNAME". Many rows name the same mechanic in different words. Write `OUT`, one row per
distinct mechanic, with one write:

`| # | Mechanic | What the player does or sees | In | Urbis | Sources |`

- #: 1, 2, 3, ...
- Mechanic: a short generic name, plain words, no names from any game.
- What the player does or sees: one plain sentence.
- In: the games that have it: `S` Skylines, `G` GTA, `W` Watch Dogs, `C` Cyberpunk,
  e.g. `G W C`.
- Urbis: `missing`, or `partial: <what Urbis lacks>` when any merged row is `partial`.
- Sources: every input ID merged into this row, comma-separated.

Rules:
1. Two rows are one mechanic when a player would call them the same thing. Do not merge
   things that are only related: spike strips and roadblocks stay two rows.
2. Every input ID appears in exactly one Sources cell. None lost, none twice.
3. Sort by how many games have it, most first.
4. Read no other file. Write only `OUT`. Then stop.

## Join

Read `IN`. Each row is a mechanic that one or more of Cities: Skylines (`S`), GTA (`G`),
Watch Dogs (`W`) or Cyberpunk 2077 (`C`) have and the Urbis game lacks, all in the
section "SECNAME". The rows were merged in separate batches, so some rows still name the
same mechanic. Write `OUT`, one row per distinct mechanic, with one write, in the same
format:

`| # | Mechanic | What the player does or sees | In | Urbis | Sources |`

- Rows that name the same mechanic become one row: keep the clearer name and sentence,
  join their `In` letters and their Sources, and keep `partial: ...` if either is partial.
- Rows that are not the same stay as they are.
- #: 1, 2, 3, ...; sort by how many games have it, most first.

Rules:
1. Two rows are one mechanic when a player would call them the same thing. Do not merge
   things that are only related: spike strips and roadblocks stay two rows.
2. Every source ID in the input appears in exactly one Sources cell of the output.
3. Read no other file. Write only `OUT`. Then stop.
