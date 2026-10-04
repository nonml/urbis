#!/usr/bin/env bash
# Fetch the M7-1 sound set (M7.T2): CC0 files from Freesound, each pinned to its
# sha256, so a re-run repairs a corrupt download and `--check` proves the committed
# set offline. Sources and licences: public/assets/CREDITS.md.
#   bash tools/sounds/fetch.sh [--check]
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT=public/assets/sounds
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
HASH=sha256sum
command -v sha256sum >/dev/null 2>&1 || HASH='shasum -a 256'
hash() { $HASH "$1" | cut -d' ' -f1; }
mkdir -p "$OUT"
status=0
while IFS='|' read -r name page url want; do
  [ -n "$name" ] || continue
  file="$OUT/$name"
  if [ -f "$file" ] && [ "$(hash "$file")" = "$want" ]; then
    echo "ok       $name"
  elif [ -n "${1:-}" ]; then
    echo "MISMATCH $name" >&2
    status=1
  else
    echo "fetch    $name"
    curl -fsSL "$url" -o "$file.part"
    [ "$(hash "$file.part")" = "$want" ] || { echo "checksum failed: $name" >&2; rm -f "$file.part"; exit 1; }
    mv "$file.part" "$file"
  fi
done <<< "$MANIFEST"
exit "$status"
