#!/usr/bin/env bash
# tools/models/trellis_cpp.sh — M2.E1: evaluate trellis.cpp (GGML/Metal) against
# the installed trellis2mlx, so the operator can decide the M2 pipeline.
# Builds trellis.cpp from source, fetches the Q8 GGUF set outside the repo,
# generates one car from a pre-cut RGBA reference at --res 512 --seed 42, then
# measures wall time, peak RSS and disk and renders the GLB. Idempotent; every
# artifact and log lands in tools/models/evidence/. Python for the reference cut
# and the renders is $URBIS_MODELS_DIR/tools-venv (numpy, pillow, scipy).
#   usage: bash tools/models/trellis_cpp.sh
#   TRELLIS_FORCE=1   regenerate even if evidence/car.glb already exists
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
EVID="$HERE/evidence"
ROOT_DIR="${URBIS_MODELS_DIR:-$HOME/urbis-models}"
SRC="$ROOT_DIR/trellis.cpp"
GGUF_DIR="$ROOT_DIR/trellis2-gguf/q8"
Q8=(birefnet.gguf dinov3.gguf shape_dec.gguf shape_flow_512.gguf shape_flow_1024.gguf
    ss_dec.gguf ss_flow.gguf tex_dec.gguf tex_flow_512.gguf tex_flow_1024.gguf)
REF_URL="https://raw.githubusercontent.com/pwilkin/trellis.cpp/main/assets/showcase/racer/racer.png"
PY="$ROOT_DIR/tools-venv/bin/python"
[ -x "$PY" ] || PY="$ROOT_DIR/trellis2mlx/.venv/bin/python"
[ -x "$PY" ] || PY="$(command -v python3)"
HF="$ROOT_DIR/trellis2mlx/.venv/bin/hf"; [ -x "$HF" ] || HF="$(command -v hf)"
free_gb() { df -Pk / | awk 'NR==2 {printf "%.1f", $4/1048576}'; }
log() { printf '[trellis_cpp] %s\n' "$*"; }
have_q8() { for f in "${Q8[@]}"; do [ -s "$GGUF_DIR/$f" ] || return 1; done; }

mkdir -p "$EVID"
log "free disk before: $(free_gb) GB"

# 1. Source + build. macOS gets Metal automatically (GGML_METAL defaults ON);
# there is no prebuilt Mac binary. The ggml submodule is a separate clone.
if [ ! -d "$SRC/.git" ]; then git clone https://github.com/pwilkin/trellis.cpp "$SRC"; fi
git -C "$SRC" submodule update --init --recursive
cmake -S "$SRC" -B "$SRC/build" -G Ninja -DCMAKE_BUILD_TYPE=Release
cmake --build "$SRC/build" -j
CLI="$SRC/build/trellis-cli"
[ -x "$CLI" ] || { log "no $CLI after build"; exit 1; }
log "trellis.cpp $(git -C "$SRC" rev-parse --short HEAD) / ggml $(git -C "$SRC/thirdparty/ggml" rev-parse --short HEAD); build $(du -sh "$SRC/build" | cut -f1)"

# 2. Q8 GGUF set, outside the repo. birefnet.gguf is fetched but never run: a
# pre-matted RGBA input makes auto background removal keep its alpha.
mkdir -p "$GGUF_DIR"
if have_q8; then
  log "Q8 weights already present in $GGUF_DIR"
else
  [ -x "$HF" ] || { log "hf not found and Q8 weights missing; install huggingface_hub first"; exit 1; }
  "$HF" download ilintar/trellis2-gguf --include 'q8/*.gguf' --local-dir "$ROOT_DIR/trellis2-gguf"
  have_q8 || { log "missing $GGUF_DIR file after download"; exit 1; }
fi
log "Q8 weights: $(du -sh "$ROOT_DIR/trellis2-gguf" | cut -f1) in $ROOT_DIR/trellis2-gguf"

# 3. Reference. No pre-cut, trademark-free CC0 car photo exists in the free
# sources checked (Commons/Openverse): the CC0 cut-outs there are branded or
# cartoon. trellis.cpp's own showcase source is used instead: an AI-generated
# (Z-Image-Turbo) red concept racer, no trademark, no copyright claim, in the
# MIT repo. The URL above is the provenance; the local clone copy is pinned.
# The cut floods in from the border through near-white/light-grey pixels, so
# specular highlights inside the car stay opaque — the threshold matte's bug.
if [ ! -s "$EVID/ref_car_src.png" ]; then
  cp "$SRC/assets/showcase/racer/racer.png" "$EVID/ref_car_src.png" 2>/dev/null ||
    curl -fsSL "$REF_URL" -o "$EVID/ref_car_src.png"
fi
"$PY" - "$EVID/ref_car_src.png" "$EVID/ref_car.png" <<'PY'
import sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert("RGB")
a = np.asarray(im).astype(np.int16)
mx, mn = a.max(2), a.min(2)
dist = np.sqrt(((a - np.array([255, 254, 253])) ** 2).sum(2))
light = (dist < 70) | ((mx - mn < 22) & (mx > 185))
border = np.zeros(light.shape, bool)
border[0, :] = border[-1, :] = border[:, 0] = border[:, -1] = True
labels, _ = ndi.label(light)
bg = np.unique(labels[light & border]); bg = bg[bg > 0]
obj = ~np.isin(labels, bg)
lab, n = ndi.label(obj)
sizes = ndi.sum(obj, lab, range(1, n + 1))
obj = lab == 1 + int(np.argmax(sizes))
obj = ndi.binary_opening(ndi.binary_fill_holes(obj), np.ones((3, 3)))
alpha = np.asarray(Image.fromarray((obj * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.0)))
Image.fromarray(np.dstack([np.asarray(im), alpha]), "RGBA").save(dst)
print("reference %s: %dx%d, alpha%.1f%% of frame" % (dst, im.width, im.height, 100 * obj.mean()))
PY

# 4. One car, timed. --models points at the directory holding the .gguf files.
if [ ! -s "$EVID/car.glb" ] || [ "${TRELLIS_FORCE:-0}" = "1" ]; then
  t0=$(date +%s)
  /usr/bin/time -l -o "$EVID/run_time.log" \
    "$CLI" "$EVID/ref_car.png" "$EVID/car.glb" --models "$GGUF_DIR" --res 512 --seed 42 \
    > "$EVID/run.log" 2>&1
  log "generated in $(( $(date +%s) - t0 )) s"
fi
real=$(awk '/ real /{print $1; exit}' "$EVID/run_time.log" 2>/dev/null || true)
rss=$(awk '/maximum resident set size/{print $1; exit}' "$EVID/run_time.log" 2>/dev/null || true)
log "wall ${real}s, peak RSS $(awk -v b="$rss" 'BEGIN{printf "%.2f", b/1073741824}') GB, GLB $(du -h "$EVID/car.glb" | cut -f1)"

# 5. Renders: upstream's fixed four-view sheet, plus the three-view strip.
"$PY" "$SRC/tools/render_glb.py" "$EVID/car.glb" "$EVID/car_render_4view.png" > "$EVID/render.log" 2>&1
"$PY" "$EVID/render_3view.py" "$EVID/car.glb" "$EVID/car_render_3view.png" >> "$EVID/render.log" 2>&1
cat "$EVID/render.log"
log "free disk after: $(free_gb) GB"
