# Stage 4: sort what Urbis lacks (DeepSeek, 40 rows per call)

Read `IN`. It lists N features of GAME that the Urbis game (a city builder and an
open-world street game in one) lacks, or has only in part. Write `OUT` with exactly one
row per input row, in the same order, with one write:

`| ID | Feature | Mark | Class | Section | Mechanic |`

- ID, Feature, Mark: copied from the input row.
- Class:
  - `system`: a mechanic, tool, rule, screen, setting or kind of activity that another
    game could have (spike strips, photo mode, a romance option, fishing).
  - `content`: only this game's own story, characters, places, brands, named missions or
    named items, with nothing in it another row doesn't already cover (a named quest's
    plot, a named district, a weapon brand).
  - A named thing that carries a mechanic is `system`, named by the mechanic. Johnny
    Silverhand is "A companion who talks in your head"; a named gang is "Gangs that own
    turf".
- Section: for `system` rows, one number from the list below; for `content` rows, `-`.
- Mechanic: for `system` rows, a short generic name, 3-8 plain words, no names from the
  game ("Spike strips stop a fleeing car"). For a `partial` row, name the part Urbis
  lacks (the last input column says what Urbis has). For `content` rows, `-`.

Sections (use the number):
1 Building the city · 2 Utilities and services · 3 Traffic and transport · 4 On foot ·
5 Driving and vehicles · 6 Police and crime · 7 Hacking · 8 Combat and weapons ·
9 People and talking · 10 Money, property and shops · 11 Progression and unlocks ·
12 Missions and activities · 13 Character and customisation · 14 World, weather and nature ·
15 Interface and map · 16 Audio and radio · 17 Settings, saves and platform ·
18 Online and multiplayer · 19 Modding and editors · 20 Other


Read no other file. Write only `OUT`. Then stop.
