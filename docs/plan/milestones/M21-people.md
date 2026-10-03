# M21 — People, friends and the crew

From: `docs/plan/features/mechanics.md` GAP-09-001 to GAP-09-060 (GAP-09-011, -012, -015
and -016 are M15's, GAP-09-022 is M14-20's); `docs/plan/CAPABILITIES.md` C13, W24, G11's
friend perks, and G13's street characters. When it closes, the people of the city live
whole days (shopping, drinking, resting, jogging, filming the player), react to what they
see, remember the player as a hero or a villain, and can become the player's friends,
partners, companions and crew. Watch Dogs: Legion's "play as anyone" becomes the crew: any
person in the city can be recruited and played. Pillars: the city lives; talking is a
tool.

Needs first: M11-8 (talk to anyone), M15 (happiness, health, life cycle, education),
M13 (combat, weapons drawn), M27 (the phone: calls and messages), M3-6 (walkers on
routes), M2's people pipeline. Lane: street.

## Keys

- **E** talks (M11-8). In a conversation, **1 to 4** pick a line (1 and 2 already pick the
  arc's choices); **Space held** fast-forwards spoken lines (Space is the mode's own
  action); a timed reply's ring empties and silence is an answer.
- **Crew orders** sit on M13's Tab wheel: follow, hold here, attack my target, get in.
- The **megaphone** is a gadget on the wheel (M20-13), used with G.
- **Swapping to another crew member** is done at a safehouse, on M27's phone.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M21-1 | **Whole days:** every resident's day follows needs (food, goods, rest, fun, services) met at real places in the sim: they shop, eat, drink, go to the park, visit the clinic. Shops and stalls open and close at their hours, and their shutters show it. Every worker works for a named firm (M14's firms), shown on their profile. Crowds follow where people are: a busy shopping street at 18:00 has at least 3 times the walkers of a home street *(provisional)*. Children, teens and seniors (M15-8) walk at their own speeds and go where they go (school, skate park, bench) | `tests/m21-days.test.js`, `tests/accept/m21-days.spec.js` | partial: walkers commute home to job and thin by hour (`sim/commute.js`) | GAP-09-003, GAP-09-009, GAP-09-010, GAP-09-013, GAP-09-017 |
| M21-2 | **The everyday street:** people chat in pairs and threes and remark on what is near (a crash, a fire, the player's car); sit to read or smoke; browse windows; text, call and use cash machines; open umbrellas when rain starts; jog and cycle set routes in parks; ride skateboards and BMX bikes; stagger out of bars after 23:00; and fill a beach in sun (sunbathers, swimmers, a ball game, a lifeguard). Every prop (phone, umbrella, board, bike, cigarette) rides on the walker pool at no more than 2 more draws in all | `tests/accept/m21-street.spec.js` | partial: walkers walk, idle and run (M2) | GAP-09-001, GAP-09-007, GAP-09-019, GAP-09-020, GAP-09-021, GAP-09-025, GAP-09-026, GAP-09-032 |
| M21-3 | **Characters of the street:** buskers and living statues with onlookers; preachers shouting on a corner; leafleting groups collecting money; protests that gather on a cause from the news (M27) and grow; a film set with a famous actor, photographers who chase them, and crowds round anyone the city knows (the player too, once famous, M21-5); bouncers, bartenders and dancers in clubs (M33's club); homeless people who sleep, beg and gather in camps under bridges, and to whom the player can give ₡, food or a bed at a shelter (M15-12); street sex workers who can be hired, behind the age rating (M13's decision) | `tests/accept/m21-characters.spec.js` | red | GAP-09-002, GAP-09-006, GAP-09-023, GAP-09-024, GAP-09-029, GAP-09-030, GAP-09-031, GAP-09-044, GAP-09-045, GAP-09-047 |
| M21-4 | **Reactions:** a drawn gun within 15 m makes people raise their hands, cower or flee; one in four takes out a phone and films a crime or fight, and that footage raises heat if it reaches the police (M19); a street fight gathers a ring of people who cheer, and one may step in; the hurt crawl, bleed and get up or call for help; passengers in a car the player takes scream, plead, and jump out under 20 km/h; people look up at a drone within 10 m. In the city view a resident shows a small bubble of what they like or lack | `tests/accept/m21-react.spec.js` | partial: M10-4 plans flight from danger and witnesses' calls | GAP-09-004, GAP-09-008, GAP-09-018, GAP-09-027, GAP-09-028, GAP-09-046, GAP-09-048 |
| M21-5 | **Reputation:** a public score from hero to villain moves with what the player is seen to do (stopping crimes, saving people, killing, robbing); at hero people greet and help, at villain they flee and call the police sooner (M10-4's 5 s becomes 2). The profiler shows criminal records and each person's partner, friends and family | `tests/m21-reputation.test.js`, `tests/accept/m21-reputation.spec.js` | partial: a district the player hurt answers short (M11-8) | GAP-09-040, GAP-09-042, GAP-09-043 |
| M21-6 | **Friends:** 6-10 people per game become friends through the arc, gigs and talk; each has a friendship level 0-100 that rises when the player meets them and falls when they cancel or hurt them. Friends call or text to meet; the player calls them. Meeting is an activity (M24: drinks, darts, pool, bowling, a meal, a club, a game); family members call about their lives and ask for errands and outings. At 70 a friend gives a perk: weapons delivered to the player, a car bomb fitted, armed back-up who come, a crew who do a drive-by | `tests/m21-friends.test.js`, `tests/accept/m21-friends.spec.js` | red: the arc's three people hold attitudes that nothing raises (`sim/arc.js`) | GAP-09-033, GAP-09-034, GAP-09-035, GAP-09-036, GAP-09-038, GAP-12-034 |
| M21-7 | **Allies:** a friend, a crew member or a gang ally (M19) follows the player; the wheel's orders (follow, hold, attack, get in) work within 1 s; up to 3 at once; they fight with their own weapons (M13) | `tests/accept/m21-allies.spec.js` | red | GAP-09-037 |
| M21-8 | **Partners:** 8 people per city (from the seed, of every gender) can be dated: flirt lines in talk, dates (a meal, a drink, a drive, a show), gifts, texts, a dating site on the phone; at a high level they become a partner who gives a perk and has scenes in their home; ending it is a conversation. The arc's cast are among them. Rated by M13's decision | `tests/m21-romance.test.js`, `tests/accept/m21-romance.spec.js` | red | — |
| M21-9 | **A companion:** one of the arc's cast (or a partner) rides along by choice, talks about the place the player is in and the choices they make, and keeps a hidden regard that changes their lines and the arc's ending (M24); in a conversation the player can let them answer | `tests/accept/m21-companion.spec.js` | red | GAP-09-049, GAP-09-050, GAP-09-054 |
| M21-10 | **Conversations:** a conversation frames its speakers in turn (over the shoulder, two-shot) and returns the camera after; some lines need a skill or cred (M23) and show what they need; some replies are timed (4 s); questions can be asked before going on; Space fast-forwards spoken lines. At a bar the player sits and orders a drink (₡, and too many make M17-12's drunk walk) | `tests/accept/m21-talk.spec.js` | partial: three lines from the sim (M11-8); a continue button in the arc | GAP-09-051, GAP-09-052, GAP-09-053, GAP-09-055, GAP-09-056, GAP-09-060 |
| M21-11 | **Calls and messages:** a call opens with the caller's portrait or a video of them; texts offer 2-3 replies that change what follows; a text can carry a map mark or an item to pick up at a place | `tests/accept/m21-messages.spec.js` | red: the journal only (`ARC.md`) | GAP-09-057, GAP-09-058, GAP-09-059 |
| M21-12 | **Voice and command:** the megaphone carries the player's voice 40 m: "go home" scatters a crowd, "with me" gathers a protest behind them for 60 s. A hack on an enemy's earpiece (cred unlock) gives a false order: they turn on their squad for 10 s | `tests/accept/m21-voice.spec.js` | red | GAP-09-039, GAP-09-041 |
| M21-13 | **Recruiting anyone:** any person the profiler reads shows their recruit offer: a job they want done (made from their sim life, as a gig is), after which they join the crew. A person the player hurt refuses; some ask for a second job first | `tests/accept/m21-recruit.spec.js` | red: one protagonist | — |
| M21-14 | **The crew:** up to 20 members, each with a class (fighter, sneak, hacker, driver), traits and gear from their sim job (a paramedic heals faster, a construction worker calls a cargo drone, a police officer can call off a chase, a hacker has more battery, a getaway driver drives faster cars), their own clothes and portrait, and a level that grows. The team menu lists them | `tests/m21-crew.test.js` | red | — |
| M21-15 | **Playing as one:** at a safehouse, or anywhere outside a mission from the phone, the player swaps to any crew member and plays them (the camera pulls up and drops on them, found doing something of their day: at work, at home, out), with their body, clothes, walk, gear and traits; the protagonist of the arc is one of them, and the arc's missions need them. A downed member is hurt and out for 1 game day; with the permadeath setting, killed for good, and a memorial lists the fallen; a member can retire | `tests/accept/m21-swap.spec.js` | red | GAP-13-002 |
| M21-16 | **Draws:** every new person comes from the walker pool; outfits are tints and the crew's bodies are M2's MPFB bodies; M21 adds at most 3 draws | the ledger | — | — |
| M21-17 | A saved game keeps every friend, partner, companion regard, reputation, crew member and who the player is playing as, and continues the same | `tests/accept/m21-save.spec.js` | red | — |
| M21-18 | The sweep of street life, reactions, talk and the crew, day and night, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M21.T1 | **Checks, red: the street.** `m21-days.test.js`, `m21-days.spec.js`, `m21-street.spec.js`, `m21-characters.spec.js`, `m21-react.spec.js`, `m21-reputation.test.js`, `m21-reputation.spec.js` | new `tests/m21-days.test.js`, new `tests/accept/m21-days.spec.js`, new `tests/accept/m21-street.spec.js`, new `tests/accept/m21-characters.spec.js`, new `tests/accept/m21-react.spec.js`, new `tests/m21-reputation.test.js`, new `tests/accept/m21-reputation.spec.js` | M11.T15 | M21-1 to M21-5 red | S |
| M21.T2 | **Needs and days.** Needs per resident; trips to meet them; opening hours; named firms; crowds by place and hour; age groups' routes and speeds | `src/sim/people.js`, `src/sim/commute.js`, new `src/sim/needs.js`, `src/sim/economy.js` | M21.T1, M15.T9, M15.T14, M15.T19 | M21-1 (part) | M |
| M21.T3 | **Shutters and crowds, drawn.** Shop shutters by hour; walker density from the sim | `src/render/zoning.js`, `src/render/npcs.js` | M21.T2 | M21-1 | S |
| M21.T4 | **The everyday street, sim.** Chatter groups and remarks, sitting, browsing, phones and cash machines, umbrellas, joggers, cyclists, skaters, drunks, the beach | `src/sim/walkers.js`, `src/sim/talk.js`, `src/sim/street.js` | M21.T2 | M21-2 (part) | M |
| M21.T5 | **Walker props and clips** (lane: assets). Phone, umbrella, board, bike, cigarette, book as pooled attachments; the clips for each on M2's person | `src/render/npcs.js`, `tools/models/bake_vat.py`, `public/assets/models/` | M21.T4, M2.T9 | M21-2, M21-16 (part) | M |
| M21.T6 | **Characters of the street.** Buskers, statues, preachers, leafleters, protests from the news, the film set and photographers, fame crowds, club staff, the homeless and helping them, sex workers behind the rating | new `src/sim/streetlife.js`, `src/sim/walkers.js`, `src/sim/news.js` | M21.T4, M13.T21 | M21-3 | M |
| M21.T7 | **Reactions.** Hands up, cowering, fleeing; filming and its heat; the fight ring; the hurt; panicked passengers; looking at drones; the bubbles in the city view | `src/sim/walkers.js`, `src/sim/wanted.js`, `src/render/cityview.js` | M21.T4, M19.T7 | M21-4 | M |
| M21.T8 | **Reputation and records.** The public score and its effects; records and relationships in the profile | new `src/sim/reputation.js`, `src/sim/street.js`, `src/sim/people.js` | M21.T1 | M21-5 | M |
| M21.T9 | **Checks, red: friends and talk.** `m21-friends.test.js`, `m21-friends.spec.js`, `m21-allies.spec.js`, `m21-romance.test.js`, `m21-romance.spec.js`, `m21-companion.spec.js`, `m21-talk.spec.js`, `m21-messages.spec.js`, `m21-voice.spec.js` | new `tests/m21-friends.test.js`, new `tests/accept/m21-friends.spec.js`, new `tests/accept/m21-allies.spec.js`, new `tests/m21-romance.test.js`, new `tests/accept/m21-romance.spec.js`, new `tests/accept/m21-companion.spec.js`, new `tests/accept/m21-talk.spec.js`, new `tests/accept/m21-messages.spec.js`, new `tests/accept/m21-voice.spec.js` | M21.T1 | M21-6 to M21-12 red | S |
| M21.T10 | **Friends.** Who becomes a friend; the level and what moves it; calls and invites both ways; family calls; perks at 70 | new `src/sim/friends.js`, `src/sim/arc.js`, `src/ui/phone.js` | M21.T9, M27.T2 | M21-6 | M |
| M21.T11 | **Allies.** Following, the four orders on the wheel, up to 3, their fighting | `src/sim/friends.js`, `src/sim/combatai.js`, `src/ui/weaponwheel.js` | M21.T10, M13.T28 | M21-7 | M |
| M21.T12 | **Partners.** Eight from the seed; flirting, dates, gifts, texts, the dating site; scenes at home; the perk; ending it | new `src/sim/romance.js`, `src/sim/friends.js`, `src/sim/talk.js` | M21.T10 | M21-8 | M |
| M21.T13 | **The companion.** Riding along, lines on place and choice, the hidden regard, answering for the player | `src/sim/friends.js`, `src/sim/talk.js`, `src/sim/arc.js` | M21.T10 | M21-9 | M |
| M21.T14 | **Conversations.** Framing shots, gated lines, timed replies, questions, fast-forward, 1-4 to pick; bars and drinks | `src/sim/talk.js`, `src/game/camera.js`, new `src/ui/dialogue.js`, `src/sim/interior.js` | M21.T9 | M21-10 | M |
| M21.T15 | **Calls and messages.** Portraits and video in calls; reply choices; marks and items in texts | `src/ui/phone.js`, `src/sim/talk.js`, `src/sim/friends.js` | M21.T14, M27.T2 | M21-11 | M |
| M21.T16 | **Voice and command.** The megaphone's scatter and gather; the earpiece order | `src/sim/gadgets.js`, `src/sim/walkers.js`, `src/sim/hackables.js` | M21.T9, M20.T6 | M21-12 | S |
| M21.T17 | **Checks, red: the crew.** `m21-recruit.spec.js`, `m21-crew.test.js`, `m21-swap.spec.js`, `m21-save.spec.js` | new `tests/accept/m21-recruit.spec.js`, new `tests/m21-crew.test.js`, new `tests/accept/m21-swap.spec.js`, new `tests/accept/m21-save.spec.js` | M21.T9 | M21-13 to M21-15, M21-17 red | S |
| M21.T18 | **Recruiting.** The offer on the profile; the recruit job made from their life; refusals and second jobs | new `src/sim/crew.js`, `src/sim/gigs.js`, `src/sim/street.js` | M21.T17, M11.T2 | M21-13 | M |
| M21.T19 | **The crew.** Classes, traits and gear from sim jobs in `traits.json`, levels, the team menu | `src/sim/crew.js`, new `src/content/traits.json`, new `src/ui/crew.js` | M21.T18 | M21-14 | M |
| M21.T20 | **Playing as one.** Swapping at a safehouse; body, clothes, walk and traits on the player; the arc needs its protagonist; hurt, permadeath, the memorial, retiring | `src/sim/crew.js`, `src/sim/player.js`, `src/render/player.js`, `src/sim/arc.js` | M21.T19, M25.T3, M25.T8 | M21-15 | M |
| M21.T21 | **The draw cost.** The ledger with the busiest street at 18:00 and a fight ring | `perf.json` | M21.T20 | M21-16 | S |
| M21.T22 | **Save** keeps everything in M21-17 | `src/sim/save.js` | M21.T21 | M21-17 | M |
| M21.T23 | **Close.** The sweep of street life, reactions, talk and the crew; one commit per defect; the talk keys in the hints | the sweep, `content/hints.json` | all of the above | M21-18 | M |

## Decisions for the operator

None beyond M13's age rating, which also covers M21-3's sex workers and M21-8's scenes.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M21-3 | CP-12-043, CP-13-011 |
| M21-4 | GTA-08-006 |
| M21-6 | GTA-15-005, GTA-15-006, GTA-15-008 |
| M21-7 | GTA-15-017 |
| M21-8 | GTA-15-010 to GTA-15-014, GTA-15-025, GTA-15-026, CP-10-019 to CP-10-026, CP-10-031 |
| M21-13 | WD-11-003 to WD-11-006, WD-10-074, WD-09-033 |
| M21-14 | WD-11-007, WD-11-011, WD-11-013, WD-11-014, WD-11-015, WD-11-016 to WD-11-018, WD-11-020 to WD-11-071, WD-11-076, WD-11-079, WD-10-083, WD-06-018, WD-15-012 to WD-15-016, WD-16-018, WD-17-030, WD-17-034 |
| M21-15 | WD-11-008, WD-11-009, WD-11-010, WD-11-012, WD-11-019, WD-20-019, WD-21-012 |
