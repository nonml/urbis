# Hacking

The phone's toolset, and the one meter that pays for it. Three things are
recorded here because a player feels them before they measure them: what every
hack costs, how fast the meter comes back, and what Focus does. They are feel
values (docs/ROADMAP.md rule 10) tuned in play, and `src/sim/battery.js` holds
them; `tests/accept/m6-battery.test.js` reads this file's own table and fails if
the two ever disagree.

## What a hack costs

Every registered thing offers its own hacks (`src/sim/hackables.js`). The cost
is what one firing takes off the meter, and the reach is what it can touch.

| Hack | Cost | Reach |
|---|---|---|
| BLACKOUT | 6 | one district's lamps, signs and windows |
| PROFILE | 1 | the person you are looking at |
| EAVESDROP | 1 | that person's next call |
| BANK TRANSFER | 2 | their balance, into yours |
| ALL-GREEN | 2 | every signal at one junction |
| BOLLARDS | 2 | posts across that junction |
| HIJACK | 2 | one car brakes, swerves or floors it |
| BURST PIPE | 2 | one street shut by steam |
| CUT CAMERA | 1 | one camera, and the police's view of that street |
| CAMERA VIEW | 1 | the view through it |
| STOP CRANE | 1 | the site above a lot stalls |
| DROP LOAD | 2 | the lot loses a stage and the site shuts |
| FIRE ALARM | 1 | a building empties onto the pavement |
| RAISE SPAN | 3 | nothing crosses the bridge |
| FAST-TRACK | 2 | a permit at full pace for a minute |
| FREEZE | 2 | a permit with no progress for two minutes |

A hack the meter cannot pay for does not fire. The HUD names the cost it was
short of, and nothing else happens: no lamps go out, no signal turns.

## The meter

| Rate | Value | Why |
|---|---|---|
| REFILL | 1 | point per game second, always, whether or not you are hacking |

A full meter is 100% — 100 points at the rate above — so it holds about sixteen
blackouts or a hundred profiles. It refills while you walk, drive and talk, and
nothing spends it faster than a point in six except a blackout, which a
district's own recharge (12 s) already paces. The meter is what stops a player
hacking everything in sight in the same minute — a camera cut, a profile, an
eavesdrop, a bank transfer — and what makes them choose.

## Focus (Q)

Held, Q slows the game to 0.3x and drains the meter while it is held.

| Rate | Value | Why |
|---|---|---|
| FOCUS | 0.3 | slow enough to read a street, fast enough to steer in it |
| FOCUS TIME | 4 | seconds of holding one press buys, then the pace comes back |
| FOCUS DRAIN | 25 | points per second of slow motion, so four presses empty a meter |

The battery, not a timer, ends a focus: at 25 points a second of slow motion a
full meter lasts about four presses of four seconds, and an empty one gives
nothing. So Focus is a considered slow motion you choose to spend, not
something you walk around inside. It reads as a phone straining, which is what
it is.
