#!/usr/bin/env bash
# Fetch the M7-1 sound set (M7.T2) and the M7.T17 music: CC0 files from
# Freesound and FreePD, each pinned to its sha256, so a re-run repairs a corrupt
# download and `--check` proves the committed set offline. Music rows carry a
# leading `music|` tag and land in public/assets/music/, apart from the sounds
# directory M7.T2's roster owns whole. Sources and licences:
# public/assets/CREDITS.md.
#   bash tools/sounds/fetch.sh [--check]
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=public/assets/sounds
MUSIC_OUT=public/assets/music
# file|page|fetch-url|sha256
MANIFEST='
ambience_street.mp3|https://freesound.org/people/qubodup/sounds/223093/|https://cdn.freesound.org/previews/223/223093_71257-hq.mp3|f2ac02efee5250abf15b5bbff7ad7aae7a56c29d8b966f07281995b92c34a371
engine_loop.mp3|https://freesound.org/people/RichieMcMullen/sounds/386793/|https://cdn.freesound.org/previews/386/386793_7236624-hq.mp3|e48f220fdcdea1b3195913b45e5e3bf0e2fd1e61a9534e6dd27e5c0c2a95e7fb
horn.mp3|https://freesound.org/people/DeVern/sounds/349922/|https://cdn.freesound.org/previews/349/349922_2866779-hq.mp3|9c273b1dbabd7286e84ee3814c4219b3a36ad714714a1307371307a8eb56f5ba
crane_site.mp3|https://freesound.org/people/bruno.auzet/sounds/524579/|https://cdn.freesound.org/previews/524/524579_11519060-hq.mp3|394ea4d33dba1b756f0d6b6b36257ba93e8d3a1be80302382f5d00c50362f104
siren_police.mp3|https://freesound.org/people/TitanKaempfer/sounds/746302/|https://cdn.freesound.org/previews/746/746302_9713112-hq.mp3|0d4926f0ce01980fe245ef29c89462060c2d88b2f98e25d961a5708f292b9b0e
sting_complete.mp3|https://freesound.org/people/Rolly-SFX/sounds/626259/|https://cdn.freesound.org/previews/626/626259_6303715-hq.mp3|0f1ec0c1412973beda433ecd946717c9e7a9828cac4fb7f5841d0c427aedbec5
hum_district.mp3|https://freesound.org/people/Smice_6/sounds/536527/|https://cdn.freesound.org/previews/536/536527_5546157-hq.mp3|b02dcf0dd5ece221969f7e9f8871545fabddbe73672be81e73188b7c04e44521
traffic_pass.mp3|https://freesound.org/people/sengjinn/sounds/176215/|https://cdn.freesound.org/previews/176/176215_2979997-hq.mp3|14450ac8b1b4779aa37c98eec4180ed7ffc6c074c7dc9b63988a55efaf2add1f
'
# music|file|page|fetch-url|sha256 — the tag keeps M7.T2's roster (every file
# in public/assets/sounds/ is a sound) from swallowing the music.
MUSIC='
music|music_title.mp3|https://github.com/0lhi/FreePD/blob/cf011c7016595833b550a88ff127f089188b25f8/Zoned/Intro.mp3|https://raw.githubusercontent.com/0lhi/FreePD/cf011c7016595833b550a88ff127f089188b25f8/Zoned/Intro.mp3|9655bde0b1f7ab2eba95930d1925a8cceab2c173d80ee21c29ae0ab84d0e5d59
music|music_calm.mp3|https://github.com/0lhi/FreePD/blob/cf011c7016595833b550a88ff127f089188b25f8/Scoring/Slice%20of%20Life.mp3|https://raw.githubusercontent.com/0lhi/FreePD/cf011c7016595833b550a88ff127f089188b25f8/Scoring/Slice%20of%20Life.mp3|39e0543fbeb06ced8a5f023daf7375385235238ea9063677f3ff71ab15bc04dc
music|music_urgent.mp3|https://github.com/0lhi/FreePD/blob/cf011c7016595833b550a88ff127f089188b25f8/Scoring/City%20Run.mp3|https://raw.githubusercontent.com/0lhi/FreePD/cf011c7016595833b550a88ff127f089188b25f8/Scoring/City%20Run.mp3|69a845f45d876c4d4e7fa08eca576ee667f3fef5022b3a569b3d33a4faeefe7f
music|music_radio_a.mp3|https://github.com/0lhi/FreePD/blob/cf011c7016595833b550a88ff127f089188b25f8/Electronic/Backbeat.mp3|https://raw.githubusercontent.com/0lhi/FreePD/cf011c7016595833b550a88ff127f089188b25f8/Electronic/Backbeat.mp3|576aa0268ab27ce486f9238df3845ce104c3e05bad015ea08048ba79e88ac79a
music|music_radio_b.mp3|https://github.com/0lhi/FreePD/blob/cf011c7016595833b550a88ff127f089188b25f8/Zoned/80s%20Smooth%20Rocker.mp3|https://raw.githubusercontent.com/0lhi/FreePD/cf011c7016595833b550a88ff127f089188b25f8/Zoned/80s%20Smooth%20Rocker.mp3|e399be4db3707b8c8515e9d0cb2a094ad616ca27f1f403e83cf57551bb8c479e
'
HASH=sha256sum
command -v sha256sum >/dev/null 2>&1 || HASH='shasum -a 256'
hash() { $HASH "$1" | cut -d' ' -f1; }
status=0
CHECK="${1:-}"
# rows are [tag|]file|page|fetch-url|sha256; a tagged set takes the leading
# field off before the name.
fetch_set() {
  local out="$1" tagged="$2" a b c d e file name page url want
  mkdir -p "$out"
  while IFS='|' read -r a b c d e; do
    [ -n "$a" ] || continue
    if [ -n "$tagged" ]; then name="$b"; page="$c"; url="$d"; want="$e"; else name="$a"; page="$b"; url="$c"; want="$d"; fi
    file="$out/$name"
    if [ -f "$file" ] && [ "$(hash "$file")" = "$want" ]; then
      echo "ok       $name"
    elif [ -n "$CHECK" ]; then
      echo "MISMATCH $name" >&2
      status=1
    else
      echo "fetch    $name"
      curl -fsSL "$url" -o "$file.part"
      [ "$(hash "$file.part")" = "$want" ] || { echo "checksum failed: $name" >&2; rm -f "$file.part"; exit 1; }
      mv "$file.part" "$file"
    fi
  done
}
fetch_set "$OUT" "" <<< "$MANIFEST"
fetch_set "$MUSIC_OUT" mus <<< "$MUSIC"
exit "$status"
