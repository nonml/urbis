# M28 — Radio, music, voices and sound

From: `docs/plan/features/mechanics.md` GAP-16-003 to GAP-16-020; `docs/plan/CAPABILITIES.md`
G23, and CS-20-001 and CS-20-005. M7 brings the audio system, two stations of
instrumental music and a score; M28 brings what the three street games and Skylines have:
sixteen stations with DJs, adverts, news and talk made from the sim, a score that follows
the action, voiced people, places with their own music, the phone's music, and a full
mixer. Pillars: the city lives (its radio talks about it); live in it.

Needs first: M7-1 and M7-10 (audio, the first stations), M24-3 (the voice decision),
M27 (the phone, TV, the assistant), M21 (people's lines), M5's news. Lane: front door.

## Keys

- **B** tapped in a car cycles the stations (M7-10); **B held** opens the radio wheel
  with each station's name and what is playing (the tap-and-hold rule).
- **City view:** the radio is a panel in the tool bar; no new key.

## Criteria

| ID | Pass when | Checked by | Today | Covers |
|---|---|---|---|---|
| M28-1 | **Sixteen stations:** each with a name, a logo, a genre and at least 12 tracks, together covering every genre the four games' stations play (pop, rock, hip-hop, soul and funk, house, techno, ambient, country, latin, reggae and dub, metal and industrial, jazz and lounge, classical, indie, a story band's own songs, and talk); the wheel shows the track playing; radio off; a car stereo with a bass boost (M18's mod shop); a handheld radio on foot; the city view's radio panel plays while building. A station plays on as if live: getting back in finds it later in the same track. A "packs" folder loads extra stations and music the game ships later. The player's own audio files play on an "own music" station | `tests/m28-radio.test.js`, `tests/accept/m28-radio.spec.js` | partial: M7-10 plans two instrumental stations | GAP-16-006, GAP-16-007, GAP-16-008, GAP-16-015 |
| M28-2 | **DJs, adverts, news and talk:** between songs each station's DJ speaks lines made from the sim (the hour, the weather, the city's news, the player's latest act, the builder's last building); adverts for the city's own firms (M22-9); a news bulletin each game hour from M5's news; two talk shows with callers about the city's state; voices as M24-3 decides, always with subtitles | `tests/m28-dj.test.js`, `tests/accept/m28-dj.spec.js` | red | GAP-16-005 |
| M28-3 | **The score:** the city view has its own soundtrack while building; each mission has a score in layers that rise with the action (sneaking, fighting, a chase) and settle after; a chase has its own music by the wanted level; scenes cut the radio and play their music, and the radio comes back after; the pause menu and loading have their own music | `tests/accept/m28-score.spec.js` | partial: M7-10 plans one score that turns urgent in a chase | GAP-16-014 |
| M28-4 | **Voices:** people speak their lines aloud (greetings, reactions, insults, calls for help: 300 lines per voice, 12 voices), the player and the cast speak in missions and scenes, eavesdropped calls (M6) are voiced, the assistant (M27-9) speaks, and the police scanner plays dispatch as radio chatter; all as M24-3 decides, all with subtitles | `tests/accept/m28-voices.spec.js` | partial: dispatch subtitles (`sim/dispatch.js`, `ui/dispatch.js`) | GAP-16-003, GAP-16-016, GAP-16-017 |
| M28-5 | **Places sound like places:** bars, clubs and shops play their own music in the room; a club has DJ sets on its nights; a story mission has a live band on a stage; big screens in squares play the news with sound; a protest chants with sirens around it; every interior has its own room sound | `tests/accept/m28-places.spec.js` | red | GAP-16-009, GAP-16-010, GAP-16-012, GAP-16-019 |
| M28-6 | **The phone's music:** a music app plays the stations and the player's saved songs anywhere; a song heard nearby can be named by the phone and saved to a playlist; contacts have ringtones the player picks | `tests/accept/m28-phonemusic.spec.js` | red | GAP-16-013 |
| M28-7 | **Every act has a sound:** each vehicle class's engine, horn and crash; every weapon's shot, reload and the shot's echo by place; footsteps by surface and shoe; doors, lifts, trains, planes, boats; weather (M26) by kind; each animal; each city-view tool's click and each building's placing; a sound list per pose shows none missing | `tests/accept/m28-sounds.spec.js` | partial: M7-1 plans ambience, engine, horn, crane, sirens, a sting and the blackout | — |
| M28-8 | **The mix:** sounds are placed in 3D with distance, walls between dull them, tunnels and rooms echo; volume sliders for master, music, radio, voices, effects and ambience; a streamer mode swaps every track that is not the game's own for one that is; subtitles name important sounds out of sight ("[shots, left]") | `tests/accept/m28-mix.spec.js` | red: M7-4 plans one volume | GAP-16-018, GAP-16-020 |
| M28-9 | A saved game keeps the station, where each station is in its loop, playlists, ringtones and the mixer, and continues the same | `tests/accept/m28-save.spec.js` | red | — |
| M28-10 | The sweep of every station, voice, place and sound, in a car, on foot and in the city view, has 0 open defects | the sweep | — | — |

## Tasks

| ID | Task | Files | Needs | Proves | Size |
|---|---|---|---|---|---|
| M28.T1 | **Checks, red.** `m28-radio.test.js`, `m28-radio.spec.js`, `m28-dj.test.js`, `m28-dj.spec.js`, `m28-score.spec.js`, `m28-voices.spec.js`, `m28-places.spec.js`, `m28-phonemusic.spec.js`, `m28-sounds.spec.js`, `m28-mix.spec.js`, `m28-save.spec.js` | new `tests/m28-radio.test.js`, new `tests/accept/m28-radio.spec.js`, new `tests/m28-dj.test.js`, new `tests/accept/m28-dj.spec.js`, new `tests/accept/m28-score.spec.js`, new `tests/accept/m28-voices.spec.js`, new `tests/accept/m28-places.spec.js`, new `tests/accept/m28-phonemusic.spec.js`, new `tests/accept/m28-sounds.spec.js`, new `tests/accept/m28-mix.spec.js`, new `tests/accept/m28-save.spec.js` | M7.T18 | M28-1 to M28-9 red | S |
| M28.T2 | **The music** (the operator's source, below). Sixteen stations' tracks in `content/radio/`, each in `CREDITS.md` | new `content/radio/`, `CREDITS.md` | M28.T1 | M28-1 (part) | M |
| M28.T3 | **Stations.** Live play, the wheel and track display, off, the stereo and bass boost, the handheld radio, the city view's panel, packs, own music | `src/audio/radio.js`, new `src/ui/radiowheel.js`, `src/ui/cityview.js` | M28.T2 | M28-1 | M |
| M28.T4 | **DJs, adverts, news and talk.** Lines from the sim; adverts for firms; hourly bulletins; two talk shows | new `src/sim/broadcast.js`, `src/sim/news.js`, `src/audio/radio.js` | M28.T3, M24.T7 | M28-2 | M |
| M28.T5 | **The score.** The city view's soundtrack; layered mission scores; chase music by level; scene override; pause and loading music | new `src/audio/score.js`, `src/sim/mission.js` | M28.T1 | M28-3 | M |
| M28.T6 | **Voices.** People's lines, the cast, eavesdropped calls, the assistant, the scanner | new `src/audio/voices.js`, `src/sim/talk.js`, `src/sim/dispatch.js` | M28.T1, M24.T7 | M28-4 | M |
| M28.T7 | **Places and the phone's music.** Room music and room sounds; DJ nights; the band; screens' news; protests; the music app, song naming, ringtones | new `src/audio/ambience.js`, `src/ui/phone.js` | M28.T3, M27.T2, M27.T5 | M28-5, M28-6 | M |
| M28.T8 | **Every act's sound.** The list by act; the missing ones recorded or sourced CC0 | `src/audio/`, `CREDITS.md` | M28.T1 | M28-7 | M |
| M28.T9 | **The mix.** 3D placement, occlusion and echo; six sliders; streamer mode; sound subtitles | new `src/audio/mixer.js`, `src/ui/settings.js`, `src/game/hud.js` | M28.T8 | M28-8 | M |
| M28.T10 | **Save** keeps everything in M28-9 | `src/sim/save.js` | M28.T9 | M28-9 | S |
| M28.T11 | **Close.** The sweep of every station, voice, place and sound; one commit per defect; B held in the hints | the sweep, `content/hints.json` | all of the above | M28-10 | M |

## Decisions for the operator

- **Where the music comes from** (M28-1): CC0 libraries only (free, fewer genres),
  commissioned tracks (paid), licensed tracks (paid, and streamer mode matters), or a
  music generator on a machine that can run one.
- **Music packs** (M28-1): whether extra stations are sold later or given free.

## What each criterion delivers from the four games

| Criterion | Features |
|---|---|
| M28-1 | CS-20-002, CS-20-003, GTA-02-012, GTA-02-013, GTA-04-058, GTA-14-018, GTA-17-001 to GTA-17-026, GTA-17-046, GTA-17-047, GTA-17-048, WD-19-001, WD-19-003, WD-19-007, WD-19-009, WD-19-012, CP-02-068, CP-17-001 to CP-17-014, CP-17-016, CP-17-018, CP-17-025 |
| M28-2 | CS-20-004, GTA-13-038, GTA-17-027, GTA-17-028, GTA-17-029, GTA-17-049, CP-17-017 |
| M28-3 | CS-20-001, GTA-17-030, GTA-17-031, GTA-17-043, GTA-17-044 |
| M28-4 | GTA-17-039, GTA-17-040 |
| M28-5 | GTA-17-033, GTA-17-034, WD-19-010 |
| M28-6 | WD-17-004, WD-17-024, GTA-17-041 |
| M28-8 | CS-20-005, CP-17-015 |
