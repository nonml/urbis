# The arc — six missions about who gets this city

Feature slice 5 in `docs/CHARTER.md` was "Arc + radio". This is the arc. The radio
is deferred, and the reason is at the bottom of this file.

The game is *build a city, then live in it*. The arc is what living in it costs.
Downtown is being rebuilt lot by lot, on its own, by the growth sim (slice 046). The
story asks the question the growth sim cannot: **who builds it, who profits, and who
gets pushed out.** It borrows Cyberpunk 2077's depth — people with a voice, choices
that stay made — and none of its look.

Everything here is data in `src/content/arc.json`, validated by
`scripts/validate_content.mjs`, run by `src/sim/arc.js` on top of the step verbs in
`src/sim/mission.js`.

---

## The cast

| Contact | Who they are | Voice | Wants |
|---|---|---|---|
| **Ruf Tamm** | Lineman for the district grid. The one who put the blackout rig in your hands. | Short sentences, a tradesman's tiredness. "Every light on this district runs down a wire, and I'm the man they call when the wire goes." | Money, and out. |
| **Celeste Marrow** | Acquisitions, Arden Holdings — the developer buying the empty lots the city is growing on. | Polished, patient, never raises her voice; euphemism as a profession. "Without paper, the tenants are just people who are upset. That passes." | The plaza lot, and the West Avenue block behind it. |
| **Nell Adeyemi** | Runs West Ave Books (the `BOOKS · USED` sign on West Avenue) and the tenants' committee on that block. | Dry, funny, stubborn. "First book's free. The second one, I'll judge you by." | To not be priced out of a third neighbourhood. |

Each contact has an **attitude** — hostile, cold, wary, neutral, warm, ally — that
starts neutral and is moved by what you choose. The journal (`J`) shows where each of
them stands, in words and in colour.

## The six missions

Every way through the arc is six missions. Two missions are one of a pair, decided
by the choice before them. The validator plays every path and fails the build if
any path is not exactly six missions, loops, or leaves a branch unresolved.

| # | Mission | Contact | What you do | Verbs |
|---|---|---|---|---|
| 1 | **LIVE WIRE** | Ruf | The audition. Take the car to the south substation and put the south block in the dark, then get clean. | `enter_car` `go_to` `blackout_zone` `lose_heat` |
| 2 | **SITE VISIT** | Celeste | Meet her at the Hotel on Main, walk the plaza lot with her — **she talks about whatever is actually standing on it** — then go to West Avenue and put names to three people there. Nell notices. **Choice 1.** | `go_to` `read_lot` `profile_count` `choose` |
| 3a | **STOP WORK** *(if you warned Nell)* | Nell | Arden's permit on the south lots lapses if the site sits idle. Find a crane that is working and black out its block while you watch it stop. | `stall_site` `lose_heat` |
| 3b | **QUIET TITLE** *(if you sold the names)* | Celeste | Be at the bookshop when the tenants meet and kill the north block so Arden's people can take the lawyer's files. | `go_to` `blackout_zone` `lose_heat` |
| 4 | **DEAD AIR** | Ruf | The plaza lot goes to auction. Chain two blackouts, north then south, to kill the registry and its backup. Ruf tells it from the side you took. | `enter_car` `go_to` `blackout_chain` `lose_heat` |
| 5 | **CROSSED WIRES** | Ruf | Ruf was Arden's man the whole time. Find him at the Tavern on Main. He has a ledger of every payment Arden ever made. **Choice 2.** | `go_to` `choose` |
| 6a | **COMMON GROUND** *(if the ledger went to Nell)* | Nell | The land trust has the plaza lot. Meet her there; what she says depends on the lot and on choice 1. | `read_lot` |
| 6b | **TOPPING OUT** *(if the ledger went back to Arden)* | Celeste | Arden has the plaza lot. Meet her there; same. | `read_lot` |

## The city in the story

Two missions read or move the city itself, and neither writes to it — the city
belongs to the zoning, economy and decline tracks, and the arc only looks.

- **`read_lot`** (missions 2 and 6) stands the player at the plaza lot and reads the
  parcel nearest it: its stage (`EMPTY` → `HIGH`) and its use. The dialogue picks the
  line for what is really there — "Mud and a fence" on an empty lot, "Watch it climb"
  while the shell goes up, "Topped out and let before the glass went in" once it is
  finished. The stage is remembered as a `lot:<STAGE>` flag for later lines.
- **`stall_site`** (mission 3a) is a blackout at the right moment. It completes only
  when a lot in the named power zone is **under construction** (`parcel.building`), that
  zone is dark, and the player is within a block of it. The blackout's existing
  cascade does the rest: `tickZoning` skips a dark parcel, so the crane stops dead in
  front of the player (slice 046). The marker stands on the working site nearest the
  player, so the player is led to a crane that is actually turning.

## The branches, and what each choice changes

Pillar 4: consequence fits the act. Both choices are about one block and one lot, so
everything they change is local — one bookshop, one lot, three people, one wallet.
None of it is city-wide.

### Choice 1 — the names (end of SITE VISIT, asked by Nell)

| | **1 · "It's a job. The names go to Arden."** | **2 · "She wants the whole block. Here's what I know."** |
|---|---|---|
| Next mission | QUIET TITLE (Celeste) | STOP WORK (Nell) |
| Money | +₡800 on top of the ₡200 fee | the ₡200 fee only |
| People | Nell → hostile, Celeste → warm | Nell → ally, Celeste → cold |
| **The street** | A yellow vinyl **CLOSING SALE · LEASE NOT RENEWED** banner goes up across West Ave Books | A painted cloth **NOT FOR SALE · WEST AVE TENANTS' COMMITTEE** banner goes up across West Ave Books |
| Later lines | Ruf's plan in DEAD AIR: "The trust misses its deadline. Arden won't." Nell's last word, whatever happens: "We're square now. Don't come to West Avenue again." | Ruf: "No filings for a week. Nell gets her week." Nell's last word: "The shop stays open. Come by." |
| Who tells you about Ruf | Celeste | Nell |

### Choice 2 — the ledger (CROSSED WIRES, asked by Ruf)

| | **1 · "Sell the ledger back to Arden."** | **2 · "Give the ledger to Nell."** |
|---|---|---|
| Next mission | TOPPING OUT (Celeste) | COMMON GROUND (Nell) |
| Money | +₡1500 | nothing |
| People | Ruf +1, Celeste +1, Nell −3 | Ruf −3, Celeste −3, Nell +2 |
| **The street** | A navy site board on the plaza lot: **PLAZA TOWER · ARDEN HOLDINGS · NOW LEASING** | A green site board on the plaza lot: **LAND TRUST · 40 HOMES · WEST AVE** |

The two choices compound along one attitude scale. Nell ends the arc an **ally** if you
warned her and gave her the ledger, **hostile** if you did neither, and **wary** if you did
one of the two — she remembers both. Celeste ends as an **ally**, **wary**, **cold** or
**hostile**, one for each path. The four endings leave four different streets: the
bookshop banner and the lot board are set by different choices.

### A choice is never taken back

Getting busted (`wanted.js`) rewinds the mission in hand, like the contracts board
resets its contract — but only back to just past the last choice that mission
recorded. The choice, its money, its flags, its signs and everyone's attitude stay.
If you are busted *before* answering, you are asked again when you get back.

---

## Reading it on screen (pillar 5)

- **Objective line** (`#arc-objective`, top centre): the mission, its contact, the step
  in hand, and the distance to its place. Mission-complete and busted notes flash above it.
- **Dialogue** (`#arc-dialogue`, bottom left, clear of the hero at the centre of the frame): the speaker's name in
  their colour, the lines, and either `1 · continue` or the two answers. A plain line
  leaves on its own after a reading pause (2.5 s + 55 ms per character); `1` moves it
  along. A choice stays up until it is answered — nothing on the street decides for you.
- **Journal** (`J`, `#arc-journal`): what is in hand, the missions done and what they
  paid, every choice made in the words of what it did, and the three people with their
  attitude.
- **World marker** (VGA-065): a warm amber column over the place in hand, 60 m tall so it
  clears a tower from a block away, with a ring at its foot. It steps aside once the
  player arrives. For `stall_site` it stands on the working crane.

**Keys.** `J` toggles the journal (the hint line reads `j · log` — the longer word wrapped
the centred hint at 1280 px). `1` and `2` do something **only while a dialogue is open** —
`1` continues a plain line, `1`/`2` answer a choice. With no dialogue open they are inert;
a headless test holds the whole arc state byte-identical across both, and
`tests/arc-game.spec.js` presses them in the running game.

## Draw cost

One `InstancedMesh`, **one draw**, for the marker (four crossed quads and a ring) and
every sign the arc can put up. Each instance carries its atlas cell in an instanced
attribute; a small `onBeforeCompile` patch offsets the UV and scales fog per instance so
the column still reads through the haze. The mesh is hidden — zero draws — when there is
no place in hand and no sign up. Dialogue, objective and journal are DOM.

Measured on this branch against its base (`69ff023`), every `requestAnimationFrame`,
SwiftShader (draw counts only — never fps here), same actions on both builds, two page
loads each, both runs agreeing exactly:

| Pose | Base | Arc | Δ |
|---|---|---|---|
| Gate pose, on foot, night (the arc's first step has no place: marker hidden) | 147 / 152 / 152 (min/med/max) | 147 / 152 / 152 | **+0** |
| In the hero car at the spawn, night — the marker up over the substation | 144 | 145 | **+1** |
| Same, hack fired: collapse, dark, mirror re-shoot — every-frame peak | 160 | 161 | **+1** |

Day was not measured: the `T` glide takes over a minute of wall clock on a software
rasteriser, longer than the shared browser lock allowed. Nothing in the marker reads the
time of day except its sign tint, which is a colour write, not a draw.

## Evidence

All at the normal play camera, 1280×720, night, SwiftShader (`?capture=1`), staged with
the capture probe (steps skipped, every choice answered with `choose()`):

| File | What it proves |
|---|---|
| `docs/shots/wave2-arc-choice.png` | Nell's question on West Avenue, both answers on screen, the hero clear of the panel |
| `docs/shots/wave2-arc-marker.png` | LIVE WIRE, in the car at the spawn: the amber column over the south substation 48 m down Main, the objective line counting it down |
| `docs/shots/wave2-arc-lot-arden-night.png` | Choice 2 answered "sell the ledger back to Arden": the navy PLAZA TOWER board on the plaza lot, the marker over the lot beyond it |
| `docs/shots/wave2-arc-lot-trust-night.png` | The other answer, the other street: the green LAND TRUST board on the same lot |
| `docs/shots/wave2-arc-ending-arden.png` | The last mission done on the lot: Celeste's closing lines, read off the lot's stage and choice 1, over the board |
| `docs/shots/wave2-arc-journal.png` | `J` at the end of a playthrough: six missions and what they paid, both choices in the words of what they did, the three people and where they ended |

## Adding to the arc

A mission is an entry in `arc.json → missions`:

```json
{ "id": "site_visit", "title": "SITE VISIT", "contact": "celeste", "payout": 200,
  "brief": [{ "who": "celeste", "text": "…" }],
  "steps": [{ "verb": "go_to", "place": "hotel_main", "label": "Meet Celeste…",
              "say": [{ "who": "celeste", "text": "…" }] }],
  "debrief": [{ "who": "celeste", "if": "sold_names", "text": "…" }],
  "next": { "sold_names": "quiet_title", "warned_nell": "stop_work" } }
```

- **Lines** carry `who` (a contact id, or `you`) and an optional `if`: a flag, `!flag`,
  or a list meaning any one of them. Flags are what an answer `set`s, plus `lot:<STAGE>`.
- **Steps run in order.** A step already true when it comes up completes at once. `say`
  on a step plays when it completes; on a `choose` step it is the question.
- **A choice** has exactly two options (keys 1 and 2), each with `set`, a journal
  `note`, and optionally `money`, `trust` (steps along the attitude scale per contact) and
  `reply`.
- **Places** are named in `arc.json → places` and must lie inside the walkable district.
- **Signs** in `arc.json → signs` go up when their `if` flag is set: `banner` (cloth,
  hung on a wall) or `board` (a site board on posts). Text is painted on a canvas, never
  generated (`docs/ASSETS.md`, rule 1).
- **New verbs** go in `src/sim/mission.js` (`WORLD_VERBS`) and the validator's `VERBS`
  list together (AGENTS.md). `go_to`, `read_lot`, `stall_site` and `choose` are
  arc-only: they are polled against where the player stands and what the city is doing,
  and the contracts board only hears events. The validator rejects them in `missions.json`.

The validator (`npm run validate`) is the schema, and `node scripts/validate_content.mjs
--dir <copy>` checks a copy — which is how `tests/arc.spec.js` proves a broken arc fails.

## Probe

`window.__game.arc()` returns the arc as plain data — mission, step, objective, marker
target, flags, each person's attitude, missions done, choices made, the open dialogue,
the signs up, and money earned. `__game.choose(key)` presses 1 or 2. Behind
`?capture=1` only, `__game.arcSkip()` finishes the step in hand as if it had been played
(it never answers a choice) — that is how the evidence frames are staged.

## Tests

`tests/arc.spec.js` drives the arc with a synthetic player — a world snapshot built to
satisfy the step in hand — in milliseconds of Node:

- all four paths run start to finish: six missions each, the right six, the right
  money, attitudes and signs;
- later lines, Nell's last word and the journal notes read the first choice;
- the plaza-lot line is the one for the lot's real stage, on all five stages, and on the
  real seeded city the arc finds a real lot and a real crane;
- busted rewinds steps but never an answered choice; busted before a choice asks again;
- `1`/`2` change nothing with no dialogue open; a choice waits for an answer;
- `stall_site` needs dark, a working crane and a player close enough to see it;
- the same answers play the same arc;
- the shipped content validates, an untouched copy validates, and eight kinds of broken
  arc each fail with the right message.

---

## The radio is deferred

The charter paired the arc with a three-channel radio. It is not built, by the lead's
decision, and it should not be until something can play in it:

- The game has **no audio system at all** — no mixer, no listener, not one sound.
- `docs/ASSETS.md` sources radio music from AceStep.cpp and DJ voices from OpenMOSS,
  both offline, GPU-backed local models. They are not installed, and they cannot run on
  the machine this wave was built on.
- A radio with nothing to play is a tuning UI over silence — dead tech by law 6.

The arc does not depend on it. When the audio pipeline exists, the radio is its own
slice: channels as data, DJ lines that can read the arc's flags (a station that reports
Arden's tower or the land trust), and a draw cost of zero.

## What the old design gave us

The pre-rewrite Q7 arc (`archive/pre-rewrite`, `955d662`) was a generic heist —
setup, recruitment, planning, the heist, betrayal, resolution — about a "fixer" and a
package. The shape survived: a recruiter, a job for someone, the big job, the betrayal
by the one who brought you in, and a resolution that depends on you. Everything else
was rewritten around this city: the heist became a lot, the package became a ledger of
who paid for the permits, and the factions became a developer and the people on the
block. No code was taken.
