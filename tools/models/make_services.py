#!/usr/bin/env python3
# tools/models/make_services.py — M5.T10b: the six M5 service buildings, rebuilt
# from scratch. 9a66150 shipped the GLBs with no script behind them; this closes
# that debt. Every building is axis-aligned massing plus a window/door dressing,
# all in the same palette+glass scheme the M2 pipeline expects: one `palette`
# material reading an 8x4 swatch texture through per-face UVs, one `glass`, and
# (park only) one alpha-cut `leaf` card material.
#
# Axes and origin follow the rest of the pipeline: metres, glTF axes (+X right,
# +Y up, +Z front), origin at the base centre of the site. The scene is built in
# glTF coordinates through bl() so the exported GLB needs no extra rotation.
# Each model's bounds are asserted against the sizes M5.T10 shipped, and each is
# under the 15,000-triangle cap. The clinic's cross is green on white — the red
# cross is the protected Geneva emblem and never appears.
#
# The same run renders all six to docs/shots/m5-services.png (grey ground, sun,
# an orthographic camera over the row) so the slice has its screenshot.
#
# Usage: python3 tools/models/make_services.py      (re-execs Blender headless)
#        BLENDER=/path/to/blender python3 tools/models/make_services.py
import json
import os
import shutil
import struct
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
MODELS = REPO / 'public' / 'assets' / 'models'
SHOT = REPO / 'docs' / 'shots' / 'm5-services.png'
MAX_TRIS = 15000

# Measured bounds of the six GLBs M5.T10 shipped (info.json size_m). The rebuilt
# geometry must land on these or the city's lots no longer fit it.
TARGETS = {
    'clinic':     ((-5.40, 0.00, -4.70), ( 6.45,  9.70,  6.45)),
    'fire':       ((-5.86, 0.00, -4.80), ( 5.60, 10.70,  6.10)),
    'park':       ((-5.80, 0.00, -5.90), ( 6.10,  3.75,  5.90)),
    'police':     ((-5.50, 0.00, -4.80), ( 5.50,  8.85,  5.95)),
    'school':     ((-5.80, 0.00, -5.20), ( 6.23,  7.75,  5.20)),
    'substation': ((-5.20, 0.00, -5.50), ( 5.20,  5.49,  5.64)),
}
ORDER = ['substation', 'police', 'fire', 'clinic', 'school', 'park']
NAMES = {
    'substation': 'Substation', 'police': 'Police station', 'fire': 'Fire station',
    'clinic': 'Clinic', 'school': 'School', 'park': 'Park',
}
TOL = 0.012


def blender_binary():
    for cand in (os.environ.get('BLENDER'), shutil.which('blender'),
                 '/Applications/Blender.app/Contents/MacOS/Blender',
                 '/usr/bin/blender'):
        if cand and Path(cand).exists():
            return cand
    sys.exit('Blender not found: install it with `bash tools/models/setup.sh`, '
             'or set BLENDER to the binary. The services are a Blender bake.')


def run_blender():
    env = {**os.environ, 'SERVICES_STAGE': 'bake'}
    subprocess.run([blender_binary(), '--background', '--python-exit-code', '1',
                    '--python', str(Path(__file__).resolve())], check=True, env=env)
    missing = [k for k in ORDER if not (MODELS / f'service_{k}' / f'service_{k}.glb').is_file()]
    if missing:
        sys.exit(f'Blender finished but these GLBs are missing: {missing}')
    print(f'{SHOT}: {SHOT.stat().st_size / 1024:.1f} KB')


if os.environ.get('SERVICES_STAGE') != 'bake':  # host side: python3 make_services.py
    run_blender()
    sys.exit(0)

import bpy  # noqa: E402  (only reachable inside Blender)
import math  # noqa: E402
import random  # noqa: E402

PALETTE = [
    # 8 columns x 4 rows of flat swatches; index order is the slot order below.
    ('wall_white', '#f5f4f2'), ('wall_light', '#e7e4de'), ('wall_mid', '#dcdad4'),
    ('concrete', '#ccd0d4'),   ('plinth', '#bbb8b3'),     ('grey', '#93999f'),
    ('steel_dark', '#666c72'), ('steel', '#83868b'),      ('path', '#c2a08d'),
    ('brick', '#b9655d'),      ('red_accent', '#d0786e'), ('blue', '#7393af'),
    ('blue_light', '#88afd4'), ('water', '#7e98a3'),      ('grass', '#96b886'),
    ('grass_light', '#85a778'),('leaf_a', '#6f9c5a'),     ('leaf_b', '#4f7a43'),
    ('ochre', '#e6d184'),      ('sand', '#e7dbc2'),       ('trim', '#af8d7c'),
    ('wood', '#9f8d7d'),       ('wood_light', '#b48f83'), ('clinic_green', '#2e8b57'),
    ('sage', '#77ad8f'),       ('dark', '#3a3f45'),       ('white', '#ffffff'),
    ('sign_green', '#3f9d5a'), ('roof_dark', '#4a4f55'),  ('brick_light', '#cf8a72'),
    ('black', '#22262a'),      ('grey_light', '#adb5be'),
]
(WALL_WHITE, WALL_LIGHT, WALL_MID, CONCRETE, PLINTH, GREY, STEEL_DARK, STEEL,
 PATH, BRICK, RED, BLUE, BLUE_LIGHT, WATER, GRASS, GRASS_L, LEAF_A, LEAF_B,
 OCHRE, SAND, TRIM, WOOD, WOOD_L, CLINIC_GREEN, SAGE, DARK, WHITE, SIGN_GREEN,
 ROOF_DARK, BRICK_L, BLACK, GREY_L) = range(32)
GRID_W, GRID_H = 8, 4
PALETTE_MAT, GLASS_MAT, LEAF_MAT = 0, 1, 2
LEAF_CARDS = 13          # cards per canopy clump
CARD_SIZE = 1.05         # card side as a fraction of its clump radius


def bl(gx, gy, gz):
    # Blender (x, y, z) exports as glTF (x, z, -y); build straight in glTF axes.
    return (gx, -gz, gy)


def hex_rgb(text):
    return tuple(int(text[i:i + 2], 16) / 255 for i in (1, 3, 5))


def palette_uv(slot):
    return ((slot % GRID_W + 0.5) / GRID_W, (slot // GRID_W + 0.5) / GRID_H)


def fill_image(img, painter):
    img.pixels = painter(img.size[0], img.size[1])


def make_palette_image():
    img = bpy.data.images.new('palette', 256, 128, alpha=False)
    img.colorspace_settings.name = 'sRGB'
    w, h = img.size
    px = [0.0] * (w * h * 4)
    for slot, (_, text) in enumerate(PALETTE):
        rgb = list(hex_rgb(text))
        cx, cy = slot % GRID_W, slot // GRID_W
        for y in range(cy * (h // GRID_H), (cy + 1) * (h // GRID_H)):
            for x in range(cx * (w // GRID_W), (cx + 1) * (w // GRID_W)):
                i = 4 * (y * w + x)
                px[i:i + 3] = rgb
                px[i + 3] = 1.0
    img.pixels = px
    return img


def make_leaf_image():
    # Alpha-cut foliage: white-to-dark green ellipses on transparent, the same
    # cut-out street trees use. The tint lives in the texture so cards keep
    # their colour variation without vertex attributes (models.js drops them).
    rng = random.Random(418)
    img = bpy.data.images.new('leaf', 128, 128, alpha=True)
    img.colorspace_settings.name = 'sRGB'
    w, h = img.size
    px = [0.0] * (w * h * 4)
    shades = [hex_rgb(s) for s in ('#3f6b34', '#4f7a43', '#5f8c4b', '#6f9c5a', '#82a968')]
    blobs = [(rng.uniform(8, w - 8), rng.uniform(8, h - 8),
              rng.uniform(6, 13), rng.uniform(3.5, 6.5), rng.uniform(0, math.pi),
              shades[rng.randrange(len(shades))]) for _ in range(34)]
    for y in range(h):
        for x in range(w):
            i = 4 * (y * w + x)
            for bx, by, rx, ry, ang, rgb in blobs:
                dx, dy = x - bx, y - by
                u = dx * math.cos(ang) + dy * math.sin(ang)
                v = -dx * math.sin(ang) + dy * math.cos(ang)
                if (u / rx) ** 2 + (v / ry) ** 2 <= 1.0:
                    px[i:i + 3] = rgb
                    px[i + 3] = 1.0
                    break
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


def texture_material(name, image, rough, alpha=False):
    mat = principled(name, (1, 1, 1), rough, 0.0)
    nt = mat.node_tree
    bsdf = nt.nodes['Principled BSDF']
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if alpha:
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        mat.blend_method = 'CLIP'          # glTF alphaMode patched to MASK below
        mat.alpha_threshold = 0.5
        mat.use_backface_culling = False
    return mat


class Model:
    def __init__(self, kind):
        self.kind = kind
        self.verts = []
        self.faces = []
        self.mats = []
        self.uvs = []
        self.lo = [1e9] * 3
        self.hi = [-1e9] * 3

    def face(self, pts, slot=None, mat=PALETTE_MAT, uvs=None):
        if len(pts) < 3:
            return
        base = len(self.verts)
        self.verts.extend(bl(*p) for p in pts)
        self.faces.append(tuple(range(base, base + len(pts))))
        self.mats.append(mat)
        if uvs is not None:
            self.uvs.append(list(uvs))
        elif slot is not None:
            self.uvs.append(palette_uv(slot))
        else:
            self.uvs.append((0.0, 0.0))
        for p in pts:
            for k in range(3):
                self.lo[k] = min(self.lo[k], p[k])
                self.hi[k] = max(self.hi[k], p[k])

    def box(self, x0, x1, y0, y1, z0, z1, slot=None, mat=PALETTE_MAT):
        self.face([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], slot, mat)
        self.face([(x1, y0, z0), (x1, y0, z1), (x1, y1, z1), (x1, y1, z0)], slot, mat)
        self.face([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], slot, mat)
        self.face([(x0, y0, z0), (x0, y0, z1), (x1, y0, z1), (x1, y0, z0)], slot, mat)
        self.face([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], slot, mat)
        self.face([(x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (x1, y0, z0)], slot, mat)

    def pyramid(self, x0, x1, z0, z1, eave, ridge, slot):
        # Ridge along Z, centred on X. The shell sits on a wall top, so no
        # underside quad: it would z-fight the wall's own top face.
        xm = (x0 + x1) / 2
        self.face([(x0, eave, z0), (x0, eave, z1), (xm, ridge, z1), (xm, ridge, z0)], slot)
        self.face([(x1, eave, z0), (xm, ridge, z0), (xm, ridge, z1), (x1, eave, z1)], slot)
        self.face([(x0, eave, z0), (xm, ridge, z0), (x1, eave, z0)], slot)
        self.face([(x0, eave, z1), (x1, eave, z1), (xm, ridge, z1)], slot)

    def gable_x(self, x0, x1, z0, z1, eave, ridge, slot):
        # Ridge along X, centred on Z. No underside, as above.
        zm = (z0 + z1) / 2
        self.face([(x0, eave, z0), (x1, eave, z0), (x1, ridge, zm), (x0, ridge, zm)], slot)
        self.face([(x0, eave, z1), (x0, ridge, zm), (x1, ridge, zm), (x1, eave, z1)], slot)
        self.face([(x0, eave, z0), (x0, ridge, zm), (x0, eave, z1)], slot)
        self.face([(x1, eave, z0), (x1, eave, z1), (x1, ridge, zm)], slot)

    def window(self, axis, plane, u0, u1, v0, v1, out=1, frame=PLINTH):
        # A proud frame slab with a glass panel standing in its face. axis 'z':
        # the wall plane is z=plane, u=x, v=y; axis 'x': u=z, v=y.
        a, b = sorted((plane, plane + out * 0.12))
        g0, g1 = sorted((plane + out * 0.10, plane + out * 0.15))
        if axis == 'z':
            self.box(u0 - 0.10, u1 + 0.10, v0 - 0.10, v1 + 0.10, a, b, frame)
            self.box(u0, u1, v0, v1, g0, g1, None, GLASS_MAT)
        else:
            self.box(a, b, v0 - 0.10, v1 + 0.10, u0 - 0.10, u1 + 0.10, frame)
            self.box(g0, g1, v0, v1, u0, u1, None, GLASS_MAT)

    def cylinder(self, cx, cz, y0, y1, r0, r1, segs, slot):
        pts_lo, pts_hi = [], []
        for s in range(segs):
            ang = 2 * math.pi * s / segs
            pts_lo.append((cx + math.cos(ang) * r0, y0, cz + math.sin(ang) * r0))
            pts_hi.append((cx + math.cos(ang) * r1, y1, cz + math.sin(ang) * r1))
        for s in range(segs):
            t = (s + 1) % segs
            self.face([pts_lo[s], pts_lo[t], pts_hi[t], pts_hi[s]], slot)
        self.face(list(reversed(pts_lo)), slot)
        self.face(pts_hi, slot)

    def cyl_between(self, p0, p1, r0, r1, segs, slot):
        ax = [p1[i] - p0[i] for i in range(3)]
        length = math.sqrt(sum(c * c for c in ax))
        if length < 1e-6:
            return
        u = [c / length for c in ax]
        helper = (0, 1, 0) if abs(u[1]) < 0.9 else (1, 0, 0)
        n1 = [u[1] * helper[2] - u[2] * helper[1],
              u[2] * helper[0] - u[0] * helper[2],
              u[0] * helper[1] - u[1] * helper[0]]
        n1 = [c / math.sqrt(sum(v * v for v in n1)) for c in n1]
        n2 = [u[1] * n1[2] - u[2] * n1[1],
              u[2] * n1[0] - u[0] * n1[2],
              u[0] * n1[1] - u[1] * n1[0]]
        lo, hi = [], []
        for s in range(segs):
            ang = 2 * math.pi * s / segs
            d = [n1[i] * math.cos(ang) + n2[i] * math.sin(ang) for i in range(3)]
            lo.append(tuple(p0[i] + d[i] * r0 for i in range(3)))
            hi.append(tuple(p1[i] + d[i] * r1 for i in range(3)))
        for s in range(segs):
            t = (s + 1) % segs
            self.face([lo[s], lo[t], hi[t], hi[s]], slot)
        self.face(list(reversed(lo)), slot)
        self.face(hi, slot)


# Canopy clumps in tree-height fractions: (dx, dy, dz, radius).
TREE_CLUMPS = [
    (0.00, 0.58, 0.00, 0.20), (0.20, 0.66, 0.08, 0.16), (-0.18, 0.64, -0.09, 0.15),
    (0.08, 0.78, -0.14, 0.13), (-0.09, 0.80, 0.13, 0.12), (0.00, 0.92, 0.00, 0.10),
]


def tree(m, x, z, height, seed, base=0.20):
    rng = random.Random(seed)
    local = []
    trunk_h = height * 0.40
    segs = 6

    def collect(pts, slot):
        local.append((pts, slot, PALETTE_MAT, None))
    lo = [(math.cos(2 * math.pi * s / segs) * 0.10, 0.0, math.sin(2 * math.pi * s / segs) * 0.10)
          for s in range(segs)]
    hi = [(math.cos(2 * math.pi * s / segs) * 0.05, trunk_h, math.sin(2 * math.pi * s / segs) * 0.05)
          for s in range(segs)]
    for s in range(segs):
        t = (s + 1) % segs
        collect([lo[s], lo[t], hi[t], hi[s]], DARK)
    collect(list(reversed(lo)), DARK)
    collect(hi, DARK)
    for _ in range(3):
        ang = rng.uniform(0, 2 * math.pi)
        root = (0.0, trunk_h * 0.72, 0.0)
        tip = (math.cos(ang) * height * 0.20, height * (0.60 + rng.random() * 0.08),
               math.sin(ang) * height * 0.20)
        _branch(local, root, tip, rng)
    for dx, dy, dz, r in TREE_CLUMPS:
        rx, ry, rz, rr = dx * height, dy * height, dz * height, r * height
        for _ in range(LEAF_CARDS):
            _card(local, rx, base + ry, rz, rr, rng)
    _emit_scaled(m, local, x, z, height, base)


def _branch(local, root, tip, rng):
    # A thin tapered limb, eight points along, five-sided.
    segs = 5
    ax = [tip[i] - root[i] for i in range(3)]
    length = math.sqrt(sum(c * c for c in ax))
    u = [c / length for c in ax]
    helper = (0, 1, 0) if abs(u[1]) < 0.9 else (1, 0, 0)
    n1 = [u[1] * helper[2] - u[2] * helper[1], u[2] * helper[0] - u[0] * helper[2],
          u[0] * helper[1] - u[1] * helper[0]]
    n1 = [c / math.sqrt(sum(v * v for v in n1)) for c in n1]
    n2 = [u[1] * n1[2] - u[2] * n1[1], u[2] * n1[0] - u[0] * n1[2], u[0] * n1[1] - u[1] * n1[0]]
    rings = []
    for k in range(2):
        p = root if k == 0 else tip
        r = 0.045 * (1.0 if k == 0 else 0.5)
        rings.append([tuple(p[i] + (n1[i] * math.cos(2 * math.pi * s / segs) +
                                    n2[i] * math.sin(2 * math.pi * s / segs)) * r
                             for i in range(3)) for s in range(segs)])
    for s in range(segs):
        t = (s + 1) % segs
        local.append(([rings[0][s], rings[0][t], rings[1][t], rings[1][s]], DARK,
                      PALETTE_MAT, None))
    local.append((rings[0], DARK, PALETTE_MAT, None))
    local.append((rings[1], DARK, PALETTE_MAT, None))


def _card(local, cx, cy, cz, radius, rng):
    # One leaf card: a random-oriented quad inside the clump, leaf material.
    a = [rng.gauss(0, 1) for _ in range(3)]
    b = [rng.gauss(0, 1) for _ in range(3)]
    na = math.sqrt(sum(c * c for c in a)) or 1.0
    a = [c / na for c in a]
    dot = sum(a[i] * b[i] for i in range(3))
    b = [b[i] - a[i] * dot for i in range(3)]
    nb = math.sqrt(sum(c * c for c in b)) or 1.0
    b = [c / nb for c in b]
    half = radius * CARD_SIZE / 2
    off = [c * radius * 0.55 * (rng.random() ** (1 / 3)) for c in a]
    mid = (cx + off[0], cy + off[1], cz + off[2])
    corners = []
    for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        corners.append(tuple(mid[i] + (a[i] * su + b[i] * sv) * half for i in range(3)))
    local.append((corners, None, LEAF_MAT, [(0, 0), (1, 0), (1, 1), (0, 1)]))


def _emit_scaled(m, local, x, z, height, base):
    top = max(p[1] for pts, _, _, _ in local for p in pts)
    scale = (height - base) / top if top > 0 else 1.0
    for pts, slot, mat, uvs in local:
        m.face([(x + p[0] * scale, base + p[1] * scale, z + p[2] * scale) for p in pts],
               slot, mat, uvs)


def shrub(m, x, z, radius, seed):
    rng = random.Random(seed)
    for _ in range(9):
        _card_front(m, x, z, 0.20 + radius * 1.15, radius, rng)
    for _ in range(2):
        m.cyl_between((x, 0.20, z), (x + rng.uniform(-0.2, 0.2), 0.20 + radius * 0.8,
                                     z + rng.uniform(-0.2, 0.2)), 0.04, 0.02, 5, DARK)


def _card_front(m, x, z, y, radius, rng):
    local = []
    _card(local, x, y, z, radius, rng)
    for pts, slot, mat, uvs in local:
        m.face(pts, slot, mat, uvs)


def bench(m, x, z):
    m.box(x - 0.85, x + 0.85, 0.55, 0.64, z - 0.24, z + 0.24, WOOD)
    m.box(x - 0.85, x + 0.85, 0.64, 0.98, z + 0.16, z + 0.26, WOOD)
    m.box(x - 0.75, x - 0.63, 0.20, 0.55, z - 0.20, z + 0.22, STEEL)
    m.box(x + 0.63, x + 0.75, 0.20, 0.55, z - 0.20, z + 0.22, STEEL)


def build_clinic(m):
    m.box(-5.40, 6.45, 0.00, 0.25, -4.70, 6.45, PLINTH)
    m.box(-5.10, 5.10, 0.25, 8.90, -4.40, 4.50, WALL_WHITE)
    m.box(-5.20, 5.20, 8.90, 9.70, -4.50, 4.60, WALL_MID)
    m.box(-5.40, -3.60, 0.25, 4.60, -2.20, 2.20, WALL_MID)
    m.box(-5.40, -3.50, 4.60, 4.85, -2.30, 2.30, CONCRETE)
    m.box(4.60, 6.45, 0.25, 6.20, -1.00, 2.00, WALL_WHITE)
    m.box(4.70, 6.45, 6.20, 6.50, -1.10, 2.10, CONCRETE)
    m.box(2.00, 5.30, 0.25, 6.90, 4.52, 6.10, WALL_LIGHT)
    m.box(1.70, 5.60, 4.20, 4.50, 6.10, 6.45, CONCRETE)
    m.box(1.90, 2.15, 0.25, 4.20, 6.20, 6.42, STEEL)
    m.box(5.15, 5.40, 0.25, 4.20, 6.20, 6.42, STEEL)
    m.window('z', 6.10, 2.90, 4.40, 0.40, 2.80, 1, STEEL)
    for cx in (-4.30, -2.30):
        for cy in (1.60, 4.00, 6.40):
            m.window('z', 4.50, cx - 0.75, cx + 0.75, cy, cy + 1.50)
    for cx in (-3.60, -1.20, 1.20, 3.60):
        for cy in (1.60, 4.00, 6.40):
            m.window('z', -4.40, cx - 0.75, cx + 0.75, cy, cy + 1.50)
    for cz in (-2.60, 0.00, 2.60):
        for cy in (1.60, 4.00, 6.40):
            m.window('x', 5.10, cz - 0.75, cz + 0.75, cy, cy + 1.50)
            m.window('x', -5.10, cz - 0.75, cz + 0.75, cy, cy + 1.50)
    for cx in (3.20, 4.60):
        m.window('z', 6.10, cx - 0.55, cx + 0.55, 2.60, 4.00)
    sign = m.box
    sign(2.30, 3.70, 6.95, 8.35, 4.50, 4.62, WHITE)
    sign(2.85, 3.15, 7.05, 8.25, 4.62, 4.72, SIGN_GREEN)
    sign(2.40, 3.60, 7.50, 7.80, 4.62, 4.72, SIGN_GREEN)
    for cx in (5.20, 5.85):
        m.window('z', 2.00, cx - 0.45, cx + 0.45, 2.60, 4.00)


def build_fire(m):
    m.box(-5.60, 5.60, 0.00, 0.15, -4.80, 6.10, CONCRETE)
    m.box(-5.30, 5.30, 0.15, 8.20, -4.60, 3.45, WALL_WHITE)
    m.box(-5.40, 5.40, 8.20, 8.60, -4.70, 3.55, WALL_MID)
    m.box(-5.86, -3.70, 0.15, 9.60, -1.50, 0.90, STEEL_DARK)
    m.pyramid(-5.86, -3.70, -1.50, 0.90, 9.60, 10.70, ROOF_DARK)
    m.box(-5.32, 5.32, 6.45, 6.75, 3.40, 3.70, RED)
    for x0, x1 in ((-4.30, -0.50), (0.50, 4.30)):
        m.box(x0 - 0.15, x1 + 0.15, 0.10, 4.45, 3.45, 3.58, STEEL_DARK)
        m.box(x0, x1, 0.15, 4.30, 3.58, 3.68, RED)
        for k in range(4):
            m.box(x0 + 0.10, x1 - 0.10, 0.72 + k * 1.0, 0.80 + k * 1.0, 3.68, 3.71, STEEL)
    for cx in (-3.90, -1.30, 1.30, 3.90):
        for cy in (4.90, 6.90):
            m.window('z', 3.45, cx - 0.80, cx + 0.80, cy, cy + 1.30)
    for cz in (-2.60, 0.30):
        for cy in (0.90, 3.10, 5.30):
            m.window('x', 5.30, cz - 0.80, cz + 0.80, cy, cy + 1.40)
            m.window('x', -5.30, cz - 0.80, cz + 0.80, cy, cy + 1.40)
    for cx in (-4.00, -1.60, 1.60, 4.00):
        m.window('z', -4.60, cx - 0.80, cx + 0.80, 1.70, 3.10)
    m.box(-2.90, -1.20, 5.00, 5.70, 3.71, 3.78, WHITE)
    m.box(-2.70, -1.40, 5.22, 5.48, 3.78, 3.82, RED)
    for cy in (2.20, 5.20, 7.60):
        m.window('z', 0.90, -5.60, -4.90, cy, cy + 1.10)


def build_police(m):
    m.box(-5.50, 5.50, 0.00, 0.35, -4.80, 5.10, PLINTH)
    m.box(-5.30, 5.30, 0.35, 8.40, -4.50, 4.40, WALL_LIGHT)
    m.box(-5.40, 5.40, 8.40, 8.85, -4.60, 4.50, CONCRETE)
    for cx in (-4.30, -2.60, -0.90, 0.80, 2.50, 4.20):
        for cy in (0.90, 2.90, 5.00, 6.90):
            m.window('z', 4.40, cx - 0.65, cx + 0.65, cy, cy + 1.40)
            m.window('z', -4.50, cx - 0.65, cx + 0.65, cy, cy + 1.40)
    for cz in (-3.60, -1.80, 0.00, 1.80, 3.40):
        for cy in (0.90, 2.90, 5.00, 6.90):
            m.window('x', 5.30, cz - 0.65, cz + 0.65, cy, cy + 1.40)
            m.window('x', -5.30, cz - 0.65, cz + 0.65, cy, cy + 1.40)
    m.box(-1.60, 1.60, 3.60, 4.30, 4.42, 5.95, CONCRETE)
    m.box(-1.55, -1.25, 0.35, 3.60, 5.60, 5.90, STEEL)
    m.box(1.25, 1.55, 0.35, 3.60, 5.60, 5.90, STEEL)
    m.box(-1.70, 1.70, 3.70, 4.20, 5.80, 5.92, BLUE)
    m.box(-1.35, 1.35, 3.86, 4.04, 5.92, 5.95, WHITE)
    m.window('z', 4.40, -1.00, 1.00, 0.35, 2.90, 1, STEEL)
    m.box(-2.00, 2.00, 0.35, 0.65, 4.50, 5.10, CONCRETE)
    m.box(-1.80, 1.80, 0.65, 0.95, 4.50, 4.95, CONCRETE)


def build_school(m):
    m.box(-5.80, 5.80, 0.00, 0.20, -5.20, 5.20, PATH)
    m.box(-5.40, 5.40, 0.20, 6.30, -3.90, 3.00, BRICK)
    m.box(-5.50, 5.50, 6.30, 6.55, -4.00, 3.10, CONCRETE)
    m.box(-5.00, 5.00, 0.20, 5.90, 3.02, 4.70, WALL_WHITE)
    m.box(-5.10, 5.10, 5.90, 6.15, 2.90, 4.80, CONCRETE)
    m.box(1.40, 5.80, 0.20, 6.60, -4.80, 0.80, BRICK)
    m.gable_x(1.40, 5.80, -4.80, 0.80, 6.60, 7.75, ROOF_DARK)
    for cx in (-4.10, -2.50, -0.90, 0.90, 2.50, 4.10):
        for cy in (1.30, 3.50):
            m.window('z', 4.70, cx - 0.60, cx + 0.60, cy, cy + 1.40)
    for cx in (-4.30, -2.80, -1.30):
        m.window('z', 3.00, cx - 0.60, cx + 0.60, 1.60, 3.00)
    m.box(-1.60, 1.60, 0.20, 4.40, 4.70, 4.80, BLUE)
    m.box(-1.40, 1.40, 0.30, 4.20, 4.75, 4.82, None, GLASS_MAT)
    m.box(-2.00, 2.00, 0.20, 0.34, 4.80, 5.20, CONCRETE)
    m.box(-1.80, 1.80, 0.34, 0.48, 4.80, 5.05, CONCRETE)
    m.cylinder(5.70, 4.20, 0.20, 6.15, 0.05, 0.04, 6, GREY)
    m.box(5.60, 6.23, 5.20, 5.52, 4.15, 4.25, RED)
    m.box(5.62, 6.21, 5.28, 5.44, 4.15, 4.26, WHITE)


def build_substation(m):
    m.box(-5.20, 5.20, 0.00, 0.12, -5.50, 5.50, STEEL)
    m.box(-5.05, -1.35, 0.12, 2.30, 5.35, 5.50, CONCRETE)
    m.box(1.35, 5.05, 0.12, 2.30, 5.35, 5.50, CONCRETE)
    m.box(-5.05, 5.05, 0.12, 2.30, -5.50, -5.35, CONCRETE)
    m.box(-5.20, -5.05, 0.12, 2.30, -5.50, 5.50, CONCRETE)
    m.box(5.05, 5.20, 0.12, 2.30, -5.50, 5.50, CONCRETE)
    m.box(-1.40, -1.00, 0.12, 2.90, 5.40, 5.64, STEEL_DARK)
    m.box(1.00, 1.40, 0.12, 2.90, 5.40, 5.64, STEEL_DARK)
    m.box(-1.05, -0.05, 0.12, 2.30, 5.40, 5.48, STEEL)
    m.box(0.05, 1.05, 0.12, 2.30, 5.40, 5.48, STEEL)
    for xa, xb in ((-3.05, -0.55), (0.55, 3.05)):
        m.box(xa - 0.20, xb + 0.20, 0.12, 0.35, -1.60, 0.40, PLINTH)
        m.box(xa, xb, 0.35, 1.90, -1.40, 0.20, CONCRETE)
        for k in range(5):
            fx = xa + 0.15 + k * (xb - xa - 0.35) / 4
            m.box(fx, fx + 0.07, 0.45, 1.80, 0.20, 0.34, GREY_L)
        for k in range(3):
            m.cylinder(xa + 0.55 + k * 0.75, -0.60, 1.90, 2.35, 0.07, 0.05, 6, GREY)
    m.box(-4.90, -1.50, 0.12, 3.22, -4.90, -2.10, WALL_LIGHT)
    m.box(-5.00, -1.40, 3.22, 3.40, -5.00, -2.00, ROOF_DARK)
    m.box(-3.60, -2.80, 0.12, 2.20, -2.10, -2.02, STEEL_DARK)
    m.box(-4.55, -3.95, 1.50, 2.50, -2.10, -2.02, None, GLASS_MAT)
    for px, pz in ((-3.60, -3.20), (3.40, -3.20)):
        m.cyl_between((px, 0.12, pz), (px, 5.10, pz), 0.10, 0.07, 6, STEEL)
    m.cyl_between((-3.60, 4.85, -3.20), (3.40, 4.85, -3.20), 0.07, 0.07, 6, STEEL)
    m.cyl_between((-3.60, 2.60, -3.20), (-2.20, 4.85, -3.20), 0.05, 0.04, 5, STEEL)
    m.cyl_between((3.40, 2.60, -3.20), (2.00, 4.85, -3.20), 0.05, 0.04, 5, STEEL)
    m.cyl_between((-3.60, 0.20, -3.20), (-2.20, 2.40, -3.20), 0.05, 0.04, 5, STEEL)
    m.cyl_between((3.40, 0.20, -3.20), (2.00, 2.40, -3.20), 0.05, 0.04, 5, STEEL)
    m.cylinder(3.40, -3.20, 5.10, 5.49, 0.04, 0.02, 5, STEEL_DARK)


def build_park(m):
    m.box(-5.80, 6.10, 0.00, 0.20, -5.90, 5.90, GRASS)
    m.box(-0.90, 0.90, 0.20, 0.26, -5.90, 3.10, PATH)
    m.box(-4.60, 4.60, 0.20, 0.26, -0.80, 0.80, PATH)
    m.box(-4.90, -1.80, 0.20, 0.42, -4.90, -2.20, SAND)
    m.box(-4.70, -2.00, 0.20, 0.38, -4.70, -2.40, WATER)
    for px in (2.10, 4.90):
        for pz in (2.00, 4.80):
            m.box(px - 0.09, px + 0.09, 0.20, 2.90, pz - 0.09, pz + 0.09, WOOD)
    m.box(1.90, 5.10, 2.90, 3.06, 1.90, 2.06, WOOD_L)
    m.box(1.90, 5.10, 2.90, 3.06, 4.74, 4.90, WOOD_L)
    for k in range(9):
        sx = 2.05 + k * 0.36
        m.box(sx, sx + 0.10, 3.06, 3.14, 1.95, 4.85, WOOD_L)
    bench(m, -3.60, 2.40)
    bench(m, 2.40, -2.60)
    bench(m, 0.20, 3.80)
    m.box(4.10, 4.20, 0.20, 2.00, -1.80, -1.70, WOOD)
    m.box(4.70, 4.80, 0.20, 2.00, -1.80, -1.70, WOOD)
    m.box(4.20, 4.70, 1.30, 1.95, -1.76, -1.70, None, GLASS_MAT)
    tree(m, 3.50, -4.60, 3.75, 11)
    tree(m, -3.00, 3.90, 3.45, 23)
    tree(m, 0.90, 4.50, 3.30, 37)
    tree(m, 4.70, -1.00, 3.20, 51)
    tree(m, -3.40, -1.60, 3.55, 67)
    tree(m, -4.00, 1.60, 2.90, 83)
    shrub(m, 1.90, -3.50, 0.55, 101)
    shrub(m, -2.60, -2.00, 0.45, 103)
    shrub(m, 1.70, 1.60, 0.50, 107)
    shrub(m, -4.60, -1.00, 0.50, 109)


BUILDERS = {
    'clinic': build_clinic, 'fire': build_fire, 'police': build_police,
    'school': build_school, 'substation': build_substation, 'park': build_park,
}


def build_object(m):
    me = bpy.data.meshes.new(m.kind)
    me.from_pydata(m.verts, [], m.faces)
    for mat in (MATERIALS['palette'], MATERIALS['glass'], MATERIALS['leaf']):
        me.materials.append(mat)
    for poly, mat_index in zip(me.polygons, m.mats):
        poly.material_index = mat_index
    uv = me.uv_layers.new(name='UVMap')
    for poly, face_uv in zip(me.polygons, m.uvs):
        per_loop = isinstance(face_uv, list) and isinstance(face_uv[0], tuple)
        for k, li in enumerate(poly.loop_indices):
            uv.data[li].uv = face_uv[k] if per_loop else face_uv
    ob = bpy.data.objects.new(m.kind, me)
    bpy.context.collection.objects.link(ob)
    return ob


def check_bounds(m):
    lo, hi = TARGETS[m.kind]
    for axis, name in enumerate('xyz'):
        if abs(m.lo[axis] - lo[axis]) > TOL or abs(m.hi[axis] - hi[axis]) > TOL:
            raise SystemExit('[make_services] %s bounds %s: built [%.2f..%.2f] '
                             'target [%.2f..%.2f]' % (m.kind, name, m.lo[axis],
                                                      m.hi[axis], lo[axis], hi[axis]))
    tris = sum(len(f) - 2 for f in m.faces)
    if tris > MAX_TRIS:
        raise SystemExit('[make_services] %s %d tris over cap %d' % (m.kind, tris, MAX_TRIS))
    return tris


def glb_report(path):
    data = Path(path).read_bytes()
    jlen = struct.unpack_from('<I', data, 12)[0]
    js = json.loads(data[20:20 + jlen])
    lo, hi, tris = [1e9] * 3, [-1e9] * 3, 0
    for mesh in js['meshes']:
        for prim in mesh['primitives']:
            acc = js['accessors'][prim['attributes']['POSITION']]
            for i in range(3):
                lo[i] = min(lo[i], acc['min'][i])
                hi[i] = max(hi[i], acc['max'][i])
            if 'indices' in prim:
                tris += js['accessors'][prim['indices']]['count'] // 3
            else:
                tris += acc['count'] // 3
    return lo, hi, tris


def patch_leaf_mask(path):
    # Blender 5.2 exports a CLIP material as alphaMode BLEND; the game's pool
    # loader only sets alphaTest for MASK, so make the leaf material MASK here.
    data = Path(path).read_bytes()
    magic, version, total = struct.unpack_from('<III', data, 0)
    jlen, jtype = struct.unpack_from('<II', data, 12)
    js = json.loads(data[20:20 + jlen])
    changed = False
    for mat in js.get('materials', []):
        if mat.get('name') == 'leaf' and mat.get('alphaMode') != 'MASK':
            mat['alphaMode'] = 'MASK'
            mat['alphaCutoff'] = 0.5
            changed = True
    if not changed:
        return
    raw = json.dumps(js, separators=(',', ':')).encode()
    raw += b' ' * ((4 - len(raw) % 4) % 4)
    rest = data[20 + jlen:]
    out = struct.pack('<III', magic, version, 12 + 8 + len(raw) + len(rest))
    out += struct.pack('<II', len(raw), jtype) + raw + rest
    Path(path).write_bytes(out)


def export_model(ob, kind):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    out_dir = MODELS / f'service_{kind}'
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f'service_{kind}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_materials='EXPORT',
    )
    patch_leaf_mask(path)
    lo, hi, tris = glb_report(path)
    target_lo, target_hi = TARGETS[kind]
    for axis, name in enumerate('xyz'):
        if (abs(lo[axis] - target_lo[axis]) > TOL or abs(hi[axis] - target_hi[axis]) > TOL):
            raise SystemExit('[make_services] %s GLB %s [%.2f..%.2f] != target [%.2f..%.2f]'
                             % (kind, name, lo[axis], hi[axis], target_lo[axis], target_hi[axis]))
    size = {'w': round(hi[0] - lo[0], 2), 'h': round(hi[1] - lo[1], 2),
            'd': round(hi[2] - lo[2], 2)}
    info = {'id': f'service_{kind}', 'name': NAMES[kind], 'type': 'models',
            'license': 'generated', 'fmt': 'glb', 'tris': tris, 'size_m': size,
            'origin': 'base centre, Y-up, front +Z',
            'source': 'tools/models/make_services.py'}
    (out_dir / 'info.json').write_text(json.dumps(info) + '\n')
    return path, tris, size


def render_sheet(paths):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    grey = principled('ground', (0.30, 0.31, 0.32), 0.95, 0.0)
    bpy.ops.mesh.primitive_plane_add(size=100, location=(0, 0, 0))
    ground = bpy.context.view_layer.objects.active
    ground.data.materials.append(grey)
    world = bpy.data.worlds.new('sheet')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.65, 0.70, 1)
    bpy.context.scene.world = world
    bpy.ops.object.light_add(type='SUN', location=(0, -12, 22))
    sun = bpy.context.view_layer.objects.active
    sun.data.energy = 4.0
    sun.data.angle = math.radians(6)
    sun.rotation_euler = (math.radians(50), 0, math.radians(38))
    for i, kind in enumerate(ORDER):
        before = set(bpy.data.objects)
        bpy.ops.import_scene.gltf(filepath=str(paths[kind]))
        roots = [o for o in bpy.data.objects if o not in before and o.parent is None]
        for root in roots:
            root.location.x += -32.5 + i * 13
    bpy.ops.object.camera_add(location=(0, -38, 20))
    cam = bpy.context.view_layer.objects.active
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 96
    cam.rotation_euler = (math.radians(64), 0, 0)
    bpy.context.scene.camera = cam
    sc = bpy.context.scene
    for engine in ('BLENDER_EEVEE_NEXT', 'BLENDER_EEVEE', 'CYCLES'):
        try:
            sc.render.engine = engine
            break
        except TypeError:
            continue
    if sc.render.engine == 'CYCLES':
        sc.cycles.samples = 48
    try:
        sc.view_settings.view_transform = 'Standard'
    except TypeError:
        pass
    sc.render.resolution_x, sc.render.resolution_y = 1600, 900
    sc.render.image_settings.file_format = 'PNG'
    sc.render.filepath = str(SHOT)
    bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.unit_settings.scale_length = 1.0
    MATERIALS['palette'] = texture_material('palette', make_palette_image(), 0.78)
    MATERIALS['glass'] = principled('glass', (0.045, 0.065, 0.085), 0.14, 0.35)
    MATERIALS['leaf'] = texture_material('leaf', make_leaf_image(), 0.90, alpha=True)
    paths, total = {}, 0
    for kind in ORDER:
        model = Model(kind)
        BUILDERS[kind](model)
        tris = check_bounds(model)
        ob = build_object(model)
        paths[kind], glb_tris, size = export_model(ob, kind)
        total += glb_tris
        print('[make_services] %-11s %5d tris  %5.2f x %5.2f x %5.2f m' %
              (kind, glb_tris, size['w'], size['h'], size['d']))
    render_sheet(paths)
    print('[make_services] total %d tris, shot %s' % (total, SHOT))


MATERIALS = {}
main()
