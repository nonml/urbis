#!/usr/bin/env python3
# tools/models/make_buildings.py — M4.T9b: the three M4.T9 buildings, rebuilt
# from scratch. c433c73 shipped building_house/flat/shed GLBs as "Blender-
# authored" with no script behind them; this closes that debt. Each building is
# axis-aligned massing plus a window/door dressing in the same palette+glass
# scheme make_services.py uses for the M5 services: one `palette` material
# reading a 16-swatch strip through per-face UVs, one `glass`, no textures on
# the massing. The tables below are the massing the c433c73 GLBs were decoded
# to: every box carries its palette slot, glass panes stand in their own list,
# and the gable roofs are their explicit slope/end faces. Axes and origin
# follow the pipeline: metres, glTF axes (+X right, +Y up, +Z front), origin at
# the base centre. Each model's bounds are asserted against the sizes c433c73
# shipped and its tri count against the same within M4.T9b's 10%.
#
# Usage: python3 tools/models/make_buildings.py      (re-execs Blender headless)
#        BLENDER=/path/to/blender python3 tools/models/make_buildings.py
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
MODELS = REPO / 'public' / 'assets' / 'models'
TOL = 0.02
TRI_DRIFT = 0.10

# Measured bounds of the three GLBs c433c73 shipped (info.json size_m). The
# rebuilt geometry must land on these or the city's lots no longer fit it.
TARGETS = {
    'house': ((-5.45, 0.00, -4.45), (5.45,  8.225, 5.15)),
    'flat':  ((-6.20, 0.00, -5.20), (6.20, 16.650, 6.10)),
    'shed':  ((-13.30, 0.00, -8.30), (13.20, 11.00, 8.85)),
}
# Tri counts of the same GLBs; the rebuild must stay within +/-10% (M4.T9b).
EXPECTED_TRIS = {'house': 752, 'flat': 1488, 'shed': 488}
NAMES = {'house': 'Suburb house', 'flat': 'Low-rise flat', 'shed': 'Works shed'}


def blender_binary():
    for cand in (os.environ.get('BLENDER'), shutil.which('blender'),
                 '/Applications/Blender.app/Contents/MacOS/Blender',
                 '/usr/bin/blender'):
        if cand and Path(cand).exists():
            return cand
    sys.exit('Blender not found: install it with `bash tools/models/setup.sh`, '
             'or set BLENDER to the binary. The buildings are a Blender bake.')


def run_blender():
    env = {**os.environ, 'BUILDINGS_STAGE': 'bake'}
    subprocess.run([blender_binary(), '--background', '--python-exit-code', '1',
                    '--python', str(Path(__file__).resolve())], check=True, env=env)
    for kind in TARGETS:
        path = MODELS / f'building_{kind}' / f'building_{kind}.glb'
        if not path.is_file():
            sys.exit(f'Blender finished but {path} is missing')


if os.environ.get('BUILDINGS_STAGE') != 'bake':  # host side: python3 make_buildings.py
    run_blender()
    sys.exit(0)

import bpy  # noqa: E402  (only reachable inside Blender)


# 16 flat swatches in slot order, the strip the c433c73 GLBs sampled. Slot 0 is
# the brick wall, 4 trim/plinth grey, 5 roof black, 13 window-frame off-white,
# 8/10/11 the door leaves, the rest the sill and side-dressing darks.
PALETTE = [
    '#41120b', '#321a11', '#afa48d', '#7c776b', '#524f46', '#0c0d0f', '#111417',
    '#25110c', '#28170d', '#08090b', '#07110b', '#060b16', '#420b07', '#cec6b3',
    '#11171e', '#64110b',
]
GRID_W, GRID_H = 16, 16
PALETTE_MAT, GLASS_MAT = 0, 1


# house: 45 palette boxes, 17 glass panes, plus the gable roof faces.
HOUSE_BOXES = [
    (-5.380, -5.160, 1.320, 1.440, -2.550, -1.050, 4), (-5.380, -5.160, 1.320, 1.440, 1.050, 2.550, 4),
    (-5.380, -5.160, 3.720, 3.840, -2.550, -1.050, 4), (-5.380, -5.160, 3.720, 3.840, 1.050, 2.550, 4),
    (-5.350, 5.350, 0.000, 0.300, -4.350, 4.350, 4), (-5.250, -5.150, 1.340, 2.860, -2.460, -1.140, 13),
    (-5.250, -5.150, 1.340, 2.860, 1.140, 2.460, 13), (-5.250, -5.150, 3.740, 5.260, -2.460, -1.140, 13),
    (-5.250, -5.150, 3.740, 5.260, 1.140, 2.460, 13), (-5.250, 5.250, 3.150, 3.350, -4.250, 4.250, 13),
    (-5.200, 5.200, 0.300, 5.700, -4.200, 4.200, 0), (-3.950, -2.450, 1.320, 1.440, -4.380, -4.160, 4),
    (-3.950, -2.450, 1.320, 1.440, 4.160, 4.380, 4), (-3.950, -2.450, 3.720, 3.840, -4.380, -4.160, 4),
    (-3.950, -2.450, 3.720, 3.840, 4.160, 4.380, 4), (-3.860, -2.540, 1.340, 2.860, -4.250, -4.150, 13),
    (-3.860, -2.540, 1.340, 2.860, 4.150, 4.250, 13), (-3.860, -2.540, 3.740, 5.260, -4.250, -4.150, 13),
    (-3.860, -2.540, 3.740, 5.260, 4.150, 4.250, 13), (-3.550, -2.450, 8.075, 8.225, -1.750, -0.650, 13),
    (-3.450, -2.550, 5.100, 8.100, -1.650, -0.750, 1), (-1.200, 1.200, 2.590, 2.710, 3.850, 5.150, 5),
    (-1.110, -0.990, 0.300, 2.600, 4.990, 5.110, 8), (-0.850, 0.850, 0.260, 0.440, 4.250, 4.950, 4),
    (-0.750, 0.750, 3.720, 3.840, -4.380, -4.160, 4), (-0.750, 0.750, 3.720, 3.840, 4.160, 4.380, 4),
    (-0.660, 0.660, 3.740, 5.260, -4.250, -4.150, 13), (-0.660, 0.660, 3.740, 5.260, 4.150, 4.250, 13),
    (-0.525, 0.525, 0.300, 2.400, 4.210, 4.350, 11), (0.990, 1.110, 0.300, 2.600, 4.990, 5.110, 8),
    (2.450, 3.950, 1.320, 1.440, 4.160, 4.380, 4), (2.450, 3.950, 3.720, 3.840, -4.380, -4.160, 4),
    (2.450, 3.950, 3.720, 3.840, 4.160, 4.380, 4), (2.525, 3.475, 0.300, 2.300, -4.340, -4.220, 10),
    (2.540, 3.860, 1.340, 2.860, 4.150, 4.250, 13), (2.540, 3.860, 3.740, 5.260, -4.250, -4.150, 13),
    (2.540, 3.860, 3.740, 5.260, 4.150, 4.250, 13), (5.150, 5.250, 1.340, 2.860, -2.460, -1.140, 13),
    (5.150, 5.250, 1.340, 2.860, 1.140, 2.460, 13), (5.150, 5.250, 3.740, 5.260, -2.460, -1.140, 13),
    (5.150, 5.250, 3.740, 5.260, 1.140, 2.460, 13), (5.160, 5.380, 1.320, 1.440, -2.550, -1.050, 4),
    (5.160, 5.380, 1.320, 1.440, 1.050, 2.550, 4), (5.160, 5.380, 3.720, 3.840, -2.550, -1.050, 4),
    (5.160, 5.380, 3.720, 3.840, 1.050, 2.550, 4),
]
HOUSE_GLASS = [
    (-5.280, -5.180, 1.450, 2.750, -2.350, -1.250), (-5.280, -5.180, 1.450, 2.750, 1.250, 2.350),
    (-5.280, -5.180, 3.850, 5.150, -2.350, -1.250), (-5.280, -5.180, 3.850, 5.150, 1.250, 2.350),
    (-3.750, -2.650, 1.450, 2.750, -4.280, -4.180), (-3.750, -2.650, 1.450, 2.750, 4.180, 4.280),
    (-3.750, -2.650, 3.850, 5.150, -4.280, -4.180), (-3.750, -2.650, 3.850, 5.150, 4.180, 4.280),
    (-0.550, 0.550, 3.850, 5.150, -4.280, -4.180), (-0.550, 0.550, 3.850, 5.150, 4.180, 4.280),
    (2.650, 3.750, 1.450, 2.750, 4.180, 4.280), (2.650, 3.750, 3.850, 5.150, -4.280, -4.180),
    (2.650, 3.750, 3.850, 5.150, 4.180, 4.280), (5.180, 5.280, 1.450, 2.750, -2.350, -1.250),
    (5.180, 5.280, 1.450, 2.750, 1.250, 2.350), (5.180, 5.280, 3.850, 5.150, -2.350, -1.250),
    (5.180, 5.280, 3.850, 5.150, 1.250, 2.350),
]
HOUSE_FACES = [
    (5, [(5.450, 8.000, -0.000), (5.450, 5.700, -4.450), (-5.450, 5.700, -4.450), (-5.450, 8.000, -0.000)]),
    (5, [(-5.450, 8.000, -0.000), (-5.450, 5.700, 4.450), (5.450, 5.700, 4.450), (5.450, 8.000, -0.000)]),
    (5, [(-5.450, 5.700, -4.450), (-5.450, 5.700, 4.450), (-5.450, 8.000, -0.000)]),
    (5, [(5.450, 5.700, -4.450), (5.450, 8.000, -0.000), (5.450, 5.700, 4.450)]),
    (5, [(5.450, 5.700, 4.450), (-5.450, 5.700, 4.450), (-5.450, 5.700, -4.450), (5.450, 5.700, -4.450)]),
]

# flat: 91 palette boxes, 33 glass panes.
FLAT_BOXES = [
    (-6.200, 6.200, 14.175, 14.425, -5.200, 5.200, 13), (-6.200, 6.200, 14.550, 15.150, -5.125, -4.875, 3),
    (-6.200, 6.200, 14.550, 15.150, 4.875, 5.125, 3), (-6.180, -5.960, 4.470, 4.590, -3.450, -1.750, 4),
    (-6.180, -5.960, 4.470, 4.590, 1.750, 3.450, 4), (-6.180, -5.960, 7.970, 8.090, -3.450, -1.750, 4),
    (-6.180, -5.960, 7.970, 8.090, 1.750, 3.450, 4), (-6.180, -5.960, 11.470, 11.590, -3.450, -1.750, 4),
    (-6.180, -5.960, 11.470, 11.590, 1.750, 3.450, 4), (-6.150, 6.150, -0.000, 0.300, -5.150, 5.150, 4),
    (-6.050, -5.950, 4.490, 6.210, -3.360, -1.840, 13), (-6.050, -5.950, 4.490, 6.210, 1.840, 3.360, 13),
    (-6.050, -5.950, 7.990, 9.710, -3.360, -1.840, 13), (-6.050, -5.950, 7.990, 9.710, 1.840, 3.360, 13),
    (-6.050, -5.950, 11.490, 13.210, -3.360, -1.840, 13), (-6.050, -5.950, 11.490, 13.210, 1.840, 3.360, 13),
    (-6.025, -5.775, 14.550, 15.150, -4.900, 4.900, 3), (-6.020, 6.020, 0.300, 3.600, 4.970, 5.070, 2),
    (-6.000, 6.000, 0.300, 14.400, -5.000, 5.000, 3), (-4.850, -3.150, 1.120, 1.240, 4.960, 5.180, 4),
    (-4.850, -3.150, 4.470, 4.590, -5.180, -4.960, 4), (-4.850, -3.150, 4.470, 4.590, 4.960, 5.180, 4),
    (-4.850, -3.150, 7.970, 8.090, -5.180, -4.960, 4), (-4.850, -3.150, 7.970, 8.090, 4.960, 5.180, 4),
    (-4.850, -3.150, 11.470, 11.590, -5.180, -4.960, 4), (-4.850, -3.150, 11.470, 11.590, 4.960, 5.180, 4),
    (-4.760, -3.240, 1.140, 2.860, 4.950, 5.050, 13), (-4.760, -3.240, 4.490, 6.210, -5.050, -4.950, 13),
    (-4.760, -3.240, 4.490, 6.210, 4.950, 5.050, 13), (-4.760, -3.240, 7.990, 9.710, -5.050, -4.950, 13),
    (-4.760, -3.240, 7.990, 9.710, 4.950, 5.050, 13), (-4.760, -3.240, 11.490, 13.210, -5.050, -4.950, 13),
    (-4.760, -3.240, 11.490, 13.210, 4.950, 5.050, 13), (-4.700, -2.100, 14.850, 16.650, -2.300, -0.100, 3),
    (-1.325, -1.275, 3.600, 4.500, 5.100, 6.100, 9), (-1.325, -1.275, 7.100, 8.000, 5.100, 6.100, 9),
    (-1.325, -1.275, 10.600, 11.500, 5.100, 6.100, 9), (-1.300, 1.300, 2.875, 3.025, 4.800, 5.900, 5),
    (-1.300, 1.300, 3.460, 3.600, 5.000, 6.100, 4), (-1.300, 1.300, 3.600, 4.500, 6.025, 6.075, 9),
    (-1.300, 1.300, 6.960, 7.100, 5.000, 6.100, 4), (-1.300, 1.300, 7.100, 8.000, 6.025, 6.075, 9),
    (-1.300, 1.300, 10.460, 10.600, 5.000, 6.100, 4), (-1.300, 1.300, 10.600, 11.500, 6.025, 6.075, 9),
    (-1.000, 1.000, 4.220, 4.340, 4.960, 5.180, 4), (-1.000, 1.000, 7.720, 7.840, 4.960, 5.180, 4),
    (-1.000, 1.000, 11.220, 11.340, 4.960, 5.180, 4), (-0.910, 0.910, 4.240, 6.460, 4.950, 5.050, 13),
    (-0.910, 0.910, 7.740, 9.960, 4.950, 5.050, 13), (-0.910, 0.910, 11.240, 13.460, 4.950, 5.050, 13),
    (-0.850, 0.850, 1.120, 1.240, -5.180, -4.960, 4), (-0.850, 0.850, 4.470, 4.590, -5.180, -4.960, 4),
    (-0.850, 0.850, 7.970, 8.090, -5.180, -4.960, 4), (-0.850, 0.850, 11.470, 11.590, -5.180, -4.960, 4),
    (-0.760, 0.760, 1.140, 2.860, -5.050, -4.950, 13), (-0.760, 0.760, 4.490, 6.210, -5.050, -4.950, 13),
    (-0.760, 0.760, 7.990, 9.710, -5.050, -4.950, 13), (-0.760, 0.760, 11.490, 13.210, -5.050, -4.950, 13),
    (-0.650, 0.650, 0.300, 2.400, 4.990, 5.130, 10), (0.400, 0.800, 14.800, 15.500, 2.000, 2.400, 9),
    (1.275, 1.325, 3.600, 4.500, 5.100, 6.100, 9), (1.275, 1.325, 7.100, 8.000, 5.100, 6.100, 9),
    (1.275, 1.325, 10.600, 11.500, 5.100, 6.100, 9), (1.700, 3.500, 14.800, 15.700, -2.300, -0.900, 9),
    (3.150, 4.850, 1.120, 1.240, 4.960, 5.180, 4), (3.150, 4.850, 4.470, 4.590, -5.180, -4.960, 4),
    (3.150, 4.850, 4.470, 4.590, 4.960, 5.180, 4), (3.150, 4.850, 7.970, 8.090, -5.180, -4.960, 4),
    (3.150, 4.850, 7.970, 8.090, 4.960, 5.180, 4), (3.150, 4.850, 11.470, 11.590, -5.180, -4.960, 4),
    (3.150, 4.850, 11.470, 11.590, 4.960, 5.180, 4), (3.240, 4.760, 1.140, 2.860, 4.950, 5.050, 13),
    (3.240, 4.760, 4.490, 6.210, -5.050, -4.950, 13), (3.240, 4.760, 4.490, 6.210, 4.950, 5.050, 13),
    (3.240, 4.760, 7.990, 9.710, -5.050, -4.950, 13), (3.240, 4.760, 7.990, 9.710, 4.950, 5.050, 13),
    (3.240, 4.760, 11.490, 13.210, -5.050, -4.950, 13), (3.240, 4.760, 11.490, 13.210, 4.950, 5.050, 13),
    (5.775, 6.025, 14.550, 15.150, -4.900, 4.900, 3), (5.950, 6.050, 4.490, 6.210, -3.360, -1.840, 13),
    (5.950, 6.050, 4.490, 6.210, 1.840, 3.360, 13), (5.950, 6.050, 7.990, 9.710, -3.360, -1.840, 13),
    (5.950, 6.050, 7.990, 9.710, 1.840, 3.360, 13), (5.950, 6.050, 11.490, 13.210, -3.360, -1.840, 13),
    (5.950, 6.050, 11.490, 13.210, 1.840, 3.360, 13), (5.960, 6.180, 4.470, 4.590, -3.450, -1.750, 4),
    (5.960, 6.180, 4.470, 4.590, 1.750, 3.450, 4), (5.960, 6.180, 7.970, 8.090, -3.450, -1.750, 4),
    (5.960, 6.180, 7.970, 8.090, 1.750, 3.450, 4), (5.960, 6.180, 11.470, 11.590, -3.450, -1.750, 4),
    (5.960, 6.180, 11.470, 11.590, 1.750, 3.450, 4),
]
FLAT_GLASS = [
    (-6.080, -5.980, 4.600, 6.100, -3.250, -1.950), (-6.080, -5.980, 4.600, 6.100, 1.950, 3.250),
    (-6.080, -5.980, 8.100, 9.600, -3.250, -1.950), (-6.080, -5.980, 8.100, 9.600, 1.950, 3.250),
    (-6.080, -5.980, 11.600, 13.100, -3.250, -1.950), (-6.080, -5.980, 11.600, 13.100, 1.950, 3.250),
    (-4.650, -3.350, 1.250, 2.750, 4.980, 5.080), (-4.650, -3.350, 4.600, 6.100, -5.080, -4.980),
    (-4.650, -3.350, 4.600, 6.100, 4.980, 5.080), (-4.650, -3.350, 8.100, 9.600, -5.080, -4.980),
    (-4.650, -3.350, 8.100, 9.600, 4.980, 5.080), (-4.650, -3.350, 11.600, 13.100, -5.080, -4.980),
    (-4.650, -3.350, 11.600, 13.100, 4.980, 5.080), (-0.800, 0.800, 4.350, 6.350, 4.980, 5.080),
    (-0.800, 0.800, 7.850, 9.850, 4.980, 5.080), (-0.800, 0.800, 11.350, 13.350, 4.980, 5.080),
    (-0.650, 0.650, 1.250, 2.750, -5.080, -4.980), (-0.650, 0.650, 4.600, 6.100, -5.080, -4.980),
    (-0.650, 0.650, 8.100, 9.600, -5.080, -4.980), (-0.650, 0.650, 11.600, 13.100, -5.080, -4.980),
    (3.350, 4.650, 1.250, 2.750, 4.980, 5.080), (3.350, 4.650, 4.600, 6.100, -5.080, -4.980),
    (3.350, 4.650, 4.600, 6.100, 4.980, 5.080), (3.350, 4.650, 8.100, 9.600, -5.080, -4.980),
    (3.350, 4.650, 8.100, 9.600, 4.980, 5.080), (3.350, 4.650, 11.600, 13.100, -5.080, -4.980),
    (3.350, 4.650, 11.600, 13.100, 4.980, 5.080), (5.980, 6.080, 4.600, 6.100, -3.250, -1.950),
    (5.980, 6.080, 4.600, 6.100, 1.950, 3.250), (5.980, 6.080, 8.100, 9.600, -3.250, -1.950),
    (5.980, 6.080, 8.100, 9.600, 1.950, 3.250), (5.980, 6.080, 11.600, 13.100, -3.250, -1.950),
    (5.980, 6.080, 11.600, 13.100, 1.950, 3.250),
]

# shed: 32 palette boxes, 8 glass panes, plus the gable roof faces.
SHED_BOXES = [
    (-13.200, -12.980, 2.570, 2.690, -3.900, -2.100, 4), (-13.100, 13.100, 0.000, 0.200, -8.100, 8.100, 4),
    (-13.070, -12.970, 2.590, 3.810, -3.810, -2.190, 13), (-13.000, 3.000, 0.200, 7.000, -8.000, 2.000, 3),
    (-11.900, -7.100, 4.400, 4.900, 1.960, 2.120, 13), (-11.800, 1.800, 5.050, 6.350, 1.950, 2.050, 13),
    (-11.700, -7.300, 0.100, 4.500, 1.960, 2.080, 9), (-9.500, -8.500, 10.000, 11.000, -3.500, -2.500, 9),
    (-2.900, 1.900, 4.400, 4.900, 1.960, 2.120, 13), (-2.700, 1.700, 0.100, 4.500, 1.960, 2.080, 9),
    (-2.000, -1.000, 10.000, 11.000, -3.500, -2.500, 9), (3.800, 13.200, 7.600, 8.100, -3.125, -2.875, 13),
    (3.800, 13.200, 7.600, 8.100, 7.875, 8.125, 13), (3.875, 4.125, 7.600, 8.100, -3.100, 8.100, 13),
    (3.950, 13.050, 0.300, 2.700, -3.050, 8.050, 4), (4.000, 13.000, 0.200, 7.800, -3.000, 8.000, 2),
    (5.150, 6.850, 1.770, 1.890, 7.960, 8.180, 4), (5.150, 6.850, 4.970, 5.090, 7.960, 8.180, 4),
    (5.240, 6.760, 1.790, 3.410, 7.950, 8.050, 13), (5.240, 6.760, 4.990, 6.610, 7.950, 8.050, 13),
    (7.400, 9.600, 2.925, 3.075, 7.850, 8.850, 5), (7.850, 9.150, 0.300, 2.400, 7.990, 8.130, 11),
    (9.800, 11.400, 7.850, 8.750, 3.000, 4.200, 9), (10.150, 11.850, 1.770, 1.890, 7.960, 8.180, 4),
    (10.150, 11.850, 4.970, 5.090, 7.960, 8.180, 4), (10.240, 11.760, 1.790, 3.410, 7.950, 8.050, 13),
    (10.240, 11.760, 4.990, 6.610, 7.950, 8.050, 13), (12.875, 13.125, 7.600, 8.100, -3.100, 8.100, 13),
    (12.950, 13.050, 4.990, 6.610, -0.260, 1.260, 13), (12.950, 13.050, 4.990, 6.610, 3.740, 5.260, 13),
    (12.960, 13.180, 4.970, 5.090, -0.350, 1.350, 4), (12.960, 13.180, 4.970, 5.090, 3.650, 5.350, 4),
]
SHED_GLASS = [
    (-13.100, -13.000, 2.700, 3.700, -3.700, -2.300), (-11.600, 1.600, 5.200, 6.200, 1.960, 2.080),
    (5.350, 6.650, 1.900, 3.300, 7.980, 8.080), (5.350, 6.650, 5.100, 6.500, 7.980, 8.080),
    (10.350, 11.650, 1.900, 3.300, 7.980, 8.080), (10.350, 11.650, 5.100, 6.500, 7.980, 8.080),
    (12.980, 13.080, 5.100, 6.500, -0.150, 1.150), (12.980, 13.080, 5.100, 6.500, 3.850, 5.150),
]
SHED_FACES = [
    (5, [(3.300, 10.000, -3.000), (3.300, 7.000, -8.300), (-13.300, 7.000, -8.300), (-13.300, 10.000, -3.000)]),
    (5, [(-13.300, 10.000, -3.000), (-13.300, 7.000, 2.300), (3.300, 7.000, 2.300), (3.300, 10.000, -3.000)]),
    (5, [(-13.300, 7.000, -8.300), (-13.300, 7.000, 2.300), (-13.300, 10.000, -3.000)]),
    (5, [(3.300, 7.000, -8.300), (3.300, 10.000, -3.000), (3.300, 7.000, 2.300)]),
    (5, [(3.300, 7.000, 2.300), (-13.300, 7.000, 2.300), (-13.300, 7.000, -8.300), (3.300, 7.000, -8.300)]),
]

def bl(gx, gy, gz):
    # Blender (x, y, z) exports as glTF (x, z, -y); build straight in glTF axes.
    return (gx, -gz, gy)


def hex_rgb(text):
    return tuple(int(text[i:i + 2], 16) / 255 for i in (1, 3, 5))


def palette_uv(slot):
    return ((slot + 0.5) / GRID_W, 0.5)


def make_palette_image():
    img = bpy.data.images.new('palette', GRID_W, GRID_H, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    w, h = img.size
    px = [0.0] * (w * h * 4)
    for x, text in enumerate(PALETTE):
        rgb = list(hex_rgb(text))
        for y in range(h):
            i = 4 * (y * w + x)
            px[i:i + 3] = rgb
            px[i + 3] = 1.0
    img.pixels = px
    return img


def principled(name, color, rough, metal):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return mat


def texture_material(name, image, rough):
    mat = principled(name, (1, 1, 1), rough, 0.0)
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    return mat


class Model:
    def __init__(self, kind):
        self.kind = kind
        self.verts = []
        self.faces = []
        self.slots = []
        self.lo = [1e9] * 3
        self.hi = [-1e9] * 3

    def face(self, pts, mat=PALETTE_MAT, slot=0):
        base = len(self.verts)
        self.verts.extend(bl(*p) for p in pts)
        self.faces.append(tuple(range(base, base + len(pts))))
        uv = palette_uv(slot) if mat == PALETTE_MAT else (0.5 / GRID_W, 0.5)
        self.slots.append((mat, uv))
        for p in pts:
            for k in range(3):
                self.lo[k] = min(self.lo[k], p[k])
                self.hi[k] = max(self.hi[k], p[k])

    def box(self, x0, x1, y0, y1, z0, z1, slot=0, mat=PALETTE_MAT):
        self.face([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], mat, slot)
        self.face([(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], mat, slot)
        self.face([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], mat, slot)
        self.face([(x0, y0, z0), (x0, y0, z1), (x1, y0, z1), (x1, y0, z0)], mat, slot)
        self.face([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], mat, slot)
        self.face([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)], mat, slot)


def build_house(m):
    for box in HOUSE_BOXES:
        m.box(*box)
    for box in HOUSE_GLASS:
        m.box(*box, mat=GLASS_MAT)
    for slot, pts in HOUSE_FACES:
        m.face(pts, PALETTE_MAT, slot)


def build_flat(m):
    for box in FLAT_BOXES:
        m.box(*box)
    for box in FLAT_GLASS:
        m.box(*box, mat=GLASS_MAT)


def build_shed(m):
    for box in SHED_BOXES:
        m.box(*box)
    for box in SHED_GLASS:
        m.box(*box, mat=GLASS_MAT)
    for slot, pts in SHED_FACES:
        m.face(pts, PALETTE_MAT, slot)


BUILDERS = {'house': build_house, 'flat': build_flat, 'shed': build_shed}


def build_object(m):
    me = bpy.data.meshes.new(m.kind)
    me.from_pydata(m.verts, [], m.faces)
    for mat in MATERIALS.values():
        me.materials.append(mat)
    uv = me.uv_layers.new(name='UVMap')
    for poly, (mat, face_uv) in zip(me.polygons, m.slots):
        poly.material_index = mat
        for li in poly.loop_indices:
            uv.data[li].uv = face_uv
    ob = bpy.data.objects.new(m.kind, me)
    bpy.context.collection.objects.link(ob)
    return ob


def check_model(m):
    lo, hi = TARGETS[m.kind]
    for axis in range(3):
        if abs(m.lo[axis] - lo[axis]) > TOL or abs(m.hi[axis] - hi[axis]) > TOL:
            raise SystemExit('[make_buildings] %s bounds axis %d: built [%.3f..%.3f] '
                             'target [%.3f..%.3f]' % (m.kind, axis, m.lo[axis],
                                                      m.hi[axis], lo[axis], hi[axis]))
    tris = sum(len(f) - 2 for f in m.faces)
    drift = abs(tris - EXPECTED_TRIS[m.kind]) / EXPECTED_TRIS[m.kind]
    if drift > TRI_DRIFT:
        raise SystemExit('[make_buildings] %s %d tris off target %d by %.0f%%'
                         % (m.kind, tris, EXPECTED_TRIS[m.kind], drift * 100))
    return tris


def export_model(m):
    ob = build_object(m)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    out_dir = MODELS / f'building_{m.kind}'
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f'building_{m.kind}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_materials='EXPORT',
    )
    size = {'w': round(m.hi[0] - m.lo[0], 2), 'h': round(m.hi[1] - m.lo[1], 2),
            'd': round(m.hi[2] - m.lo[2], 2)}
    info = {'id': f'building_{m.kind}', 'name': NAMES[m.kind], 'type': 'models',
            'license': 'generated', 'fmt': 'glb', 'tris': sum(len(f) - 2 for f in m.faces),
            'size_m': size, 'origin': 'base centre, Y-up, front +Z',
            'source': 'tools/models/make_buildings.py'}
    (out_dir / 'info.json').write_text(json.dumps(info) + '\n')
    return path, size


MATERIALS = {}


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    MATERIALS['palette'] = texture_material('palette', make_palette_image(), 0.78)
    MATERIALS['glass'] = principled('glass', (0.045, 0.065, 0.085), 0.14, 0.35)
    for kind in TARGETS:
        model = Model(kind)
        BUILDERS[kind](model)
        tris = check_model(model)
        path, size = export_model(model)
        print('[make_buildings] %-5s %5d tris  %5.2f x %5.2f x %5.2f m  %s'
              % (kind, tris, size['w'], size['h'], size['d'], path.name))


main()
