#!/usr/bin/env bash
# tools/models/setup.sh — install the M2 model pipeline on this Mac (M2.T1):
# Blender, trellis2mlx (env + weights) and MPFB, by one script. Prints free disk
# before and after and every version (recorded in tools/models/README.md).
# Idempotent. Usage: bash tools/models/setup.sh
set -euo pipefail

ROOT="${URBIS_MODELS_DIR:-$HOME/urbis-models}"
TRELLIS="$ROOT/trellis2mlx"
WEIGHTS=(
  microsoft/TRELLIS.2-4B
  microsoft/TRELLIS-image-large
  facebook/dinov3-vitl16-pretrain-lvd1689m
)
free_gb() { df -Pk / | awk 'NR==2 {printf "%.1f", $4 / 1048576}'; }

echo "== before: $(free_gb) GB free on / =="

if ! command -v blender >/dev/null 2>&1 && [ ! -x /Applications/Blender.app/Contents/MacOS/Blender ]; then
  brew install --cask blender
fi
BLENDER="$(command -v blender || echo /Applications/Blender.app/Contents/MacOS/Blender)"
echo "blender: $("$BLENDER" --version | head -1)"

mkdir -p "$ROOT"
if [ ! -d "$TRELLIS/.git" ]; then
  git clone https://github.com/lyonsno/trellis2mlx.git "$TRELLIS"
fi
if [ ! -x "$TRELLIS/.venv/bin/python" ]; then
  uv venv "$TRELLIS/.venv" --python 3.11
fi
uv pip install -e "$TRELLIS" --python "$TRELLIS/.venv/bin/python" --quiet
echo "trellis2mlx: $(git -C "$TRELLIS" rev-parse --short HEAD)  mlx: $("$TRELLIS/.venv/bin/python" -c 'import mlx.core as mx; print(mx.__version__)')"

for repo in "${WEIGHTS[@]}"; do
  if "$TRELLIS/.venv/bin/hf" download "$repo" >/dev/null; then
    echo "weights: $repo"
  else
    echo "weights: $repo NOT downloaded — gated? run '$TRELLIS/.venv/bin/hf auth login' and re-run"
  fi
done

if ! "$BLENDER" --command extension list 2>/dev/null | grep -qi 'mpfb \[installed\]'; then
  "$BLENDER" --background --python-expr "import bpy; bpy.context.preferences.system.use_online_access = True; bpy.context.preferences.extensions.use_online_access_handled = True; bpy.ops.wm.save_userpref()" >/dev/null
  "$BLENDER" --command extension install --sync --enable mpfb
fi
echo "mpfb: $("$BLENDER" --command extension list 2>/dev/null | grep -i 'mpfb \[')"

echo "== after: $(free_gb) GB free on / =="
