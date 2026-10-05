# Model pipeline (M2)

Every model the city stands on is generated on this Mac by the scripts in this
directory. Nothing here runs in the game or in the gate; it is the off-line
pipeline behind M2-0. One script installs it:

```bash
bash tools/models/setup.sh
```

It installs, in order:

| Tool | How | Where | Installed size |
|---|---|---|---|
| Blender | `brew install --cask blender` | `/Applications/Blender.app` | 907 MB |
| trellis2mlx | git clone + `uv venv` (Python 3.11) + `uv pip install -e .` | `$HOME/urbis-models/trellis2mlx` | 825 MB |
| TRELLIS.2-4B weights | `hf download` | `~/.cache/huggingface` | 15 GB |
| TRELLIS-image-large weights | `hf download` | `~/.cache/huggingface` | 3.1 GB |
| MPFB 2.0.17 | Blender extension platform | Blender's user extensions | 83 MB |

The script is idempotent: re-run it to finish or repair a step. `URBIS_MODELS_DIR`
overrides the install root. **DINOv3 is a gated Hugging Face repo** — request access
at <https://huggingface.co/facebook/dinov3-vitl16-pretrain-lvd1689m>, then
`$HOME/urbis-models/trellis2mlx/.venv/bin/hf auth login`, then re-run. Until then
the script installs everything else and names the missing repo.

## Measured

Recorded by `setup.sh` on the operator's Mac (Apple M3, 16 GB, macOS 26.6.2),
2026-10-06. Free disk is `df -Pk /`, before and after the whole install:

| | Free disk on `/` |
|---|---|
| Before | 68.5 GB |
| After | 46.9 GB |
| Used | 21.6 GB |

Versions: Blender 5.2.2 LTS · trellis2mlx `cddaf3c` · MLX 0.32.3 · Python 3.11.15 · MPFB 2.0.17.

**The weights are 18.1 GB, not the ~5 GB `ROADMAP.md` estimated** (TRELLIS.2-4B alone
is 15 GB). With Blender and the environment the pipeline needs about 22 GB of disk;
the "16 GB free" machine the roadmap planned around could not have held it. DINOv3 is
gated and not yet downloaded — M2.T3 needs the access request above before its
image-conditioned car run.

## Per-model cost (M2-0)

M2.T3's car (`clean_car.py`) and M2.T4's person (`make_person.py`) append their
minutes and peak memory here when they land; peak memory is `/usr/bin/time -l`'s
maximum resident set size.
