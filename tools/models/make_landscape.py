#!/usr/bin/env python3
# Landscape models (M2.F5, docs/ROADMAP.md M2-4): the mountains and the street
# trees are models, generated here and shipped as GLBs in
# public/assets/models/, so the game draws what this file wrote instead of
# boxes and cylinders wearing a model's name.
#
#   python3 tools/models/make_landscape.py     write the GLBs
#
# No Blender: the meshes are small and parametric, so the pipeline that built
# person.glb (make_person.py) would be a gigabyte of weight for a tree. Standard
# library only.
#
#   public/assets/models/tree_trunk.glb          the stem, one mesh
#   public/assets/models/tree_branch.glb         the limbs, one mesh
#   public/assets/models/tree_canopy_*.glb       three canopy models, alpha-cut cards
#   public/assets/models/mountain_massif.glb     two massif forms, rock and snow
#
# Nothing is written into the renderers: src/render/trees.js and
# src/render/landscape.js load these files, exactly as buildings.js and lamps.js
# load theirs, and the tag a mesh wears is the file it was built from.
import json
import math
import os
import random
import struct

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS = os.path.join(ROOT, 'public', 'assets', 'models')

FLOAT = 5126
USHORT = 5123

MAT_TRUNK = {'name': 'tree-trunk', 'pbrMetallicRoughness': {
    'baseColorFactor': [0.19, 0.15, 0.11, 1.0],
    'metallicFactor': 0.0, 'roughnessFactor': 0.95}, 'doubleSided': False}
MAT_BRANCH = {'name': 'tree-branch', 'pbrMetallicRoughness': {
    'baseColorFactor': [0.13, 0.10, 0.08, 1.0],
    'metallicFactor': 0.0, 'roughnessFactor': 0.95}, 'doubleSided': False}
MAT_CANOPY = {'name': 'tree-canopy', 'pbrMetallicRoughness': {
    'baseColorFactor': [1.0, 1.0, 1.0, 1.0],
    'metallicFactor': 0.0, 'roughnessFactor': 1.0}, 'doubleSided': True,
    'alphaMode': 'MASK', 'alphaCutoff': 0.5}
MAT_ROCK = {'name': 'mountain-rock', 'pbrMetallicRoughness': {
    'baseColorFactor': [1.0, 1.0, 1.0, 1.0],
    'metallicFactor': 0.0, 'roughnessFactor': 1.0}, 'doubleSided': False}


# ---------------------------------------------------------------------------
# A mesh of triangles. Normals are worked out from its own faces, so a smooth
# tube needs shared ring vertices and a card needs four of its own. Vertex
# colours carry the shading — sky occlusion in a canopy, rock to snow on a
# massif — which multiplies whatever colour the game sets per instance.
# ---------------------------------------------------------------------------
class Mesh:

    def __init__(self, name, material, uvs=False):
        self.name = name
        self.material = material
        self.uvs = uvs
        self.pos = []
        self.col = []
        self.uv = []
        self.idx = []

    def vert(self, p, c, t=(0.0, 0.0)):
        self.pos.append(p)
        self.col.append(c)
        self.uv.append(t)
        return len(self.pos) - 1

    def tri(self, pts, col, t=None):
        base = len(self.pos)
        for i, p in enumerate(pts):
            self.pos.append(p)
            self.col.append(col)
            self.uv.append(t[i] if t else (0.0, 0.0))
        self.idx.append((base, base + 1, base + 2))

    def quad(self, pts, col, t=None):
        base = len(self.pos)
        for i, p in enumerate(pts):
            self.pos.append(p)
            self.col.append(col)
            self.uv.append(t[i] if t else (0.0, 0.0))
        self.idx.append((base, base + 1, base + 2))
        self.idx.append((base, base + 2, base + 3))

    def normals(self):
        acc = [[0.0, 0.0, 0.0] for _ in self.pos]
        for a, b, c in self.idx:
            pa, pb, pc = self.pos[a], self.pos[b], self.pos[c]
            u = (pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2])
            v = (pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2])
            n = (u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0])
            ln = math.sqrt(sum(k * k for k in n)) or 1.0
            n = (n[0] / ln, n[1] / ln, n[2] / ln)
            for i in (a, b, c):
                acc[i][0] += n[0]
                acc[i][1] += n[1]
                acc[i][2] += n[2]
        out = []
        for n in acc:
            ln = math.sqrt(sum(k * k for k in n)) or 1.0
            out.append((n[0] / ln, n[1] / ln, n[2] / ln))
        return out

    def cap(self, ring, centre, col):
        """Close an open end with a fan, so nothing is seen through a trunk."""
        c = self.vert(centre, col, (0.5, 0.5))
        for i in range(len(ring)):
            j = (i + 1) % len(ring)
            self.tri([self.pos[ring[i]], self.pos[ring[j]], self.pos[c]], col)


def lerp(a, b, t):
    return a + (b - a) * t


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3 - 2 * t)


def lerp_color(a, b, t):
    return (lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def unit(v):
    ln = math.sqrt(sum(k * k for k in v))
    return (v[0] / ln, v[1] / ln, v[2] / ln) if ln else (0.0, 1.0, 0.0)


def ring_frame(tangent):
    """Two axes perpendicular to the spine at one point, so a ring is a ring
    however the stem bends."""
    n1 = cross(tangent, (0.0, 1.0, 0.0))
    if abs(n1[0]) + abs(n1[1]) + abs(n1[2]) < 1e-6:
        n1 = (1.0, 0.0, 0.0)
    return unit(n1), unit(cross(tangent, n1))


def add_tube(mesh, spine, radii, sides, col0, col1, jitter=None):
    """A tapered stem along `spine`: shared rings, smooth normals, a cap at
    each end."""
    frames = []
    for i in range(len(spine)):
        prev = spine[max(0, i - 1)]
        nxt = spine[min(len(spine) - 1, i + 1)]
        frames.append(ring_frame(unit((nxt[0] - prev[0], nxt[1] - prev[1], nxt[2] - prev[2]))))
    span = len(spine) - 1
    rings = []
    for i, p in enumerate(spine):
        n1, n2 = frames[i]
        t = i / span
        col = lerp_color(col0, col1, t)
        row = []
        for j in range(sides):
            th = 2 * math.pi * j / sides
            r = radii[i] * (1.0 + (jitter(i, j) if jitter else 0.0))
            row.append(mesh.vert(
                (p[0] + (n1[0] * math.cos(th) + n2[0] * math.sin(th)) * r,
                 p[1] + (n1[1] * math.cos(th) + n2[1] * math.sin(th)) * r,
                 p[2] + (n1[2] * math.cos(th) + n2[2] * math.sin(th)) * r),
                col, (j / sides, t)))
        rings.append(row)
    for i in range(span):
        for j in range(sides):
            k = (j + 1) % sides
            mesh.idx.append((rings[i][j], rings[i][k], rings[i + 1][j]))
            mesh.idx.append((rings[i][k], rings[i + 1][k], rings[i + 1][j]))
    mesh.cap(rings[0], spine[0], col0)
    mesh.cap(rings[-1], spine[-1], lerp_color(col0, col1, 1.0))


# ---------------------------------------------------------------------------
# GLB writer: glTF 2.0, one BIN chunk, one buffer view per attribute, unsigned
# short indices. It is the whole format the reader (src/render/models.js) has
# to understand, because this file writes nothing else.
# ---------------------------------------------------------------------------
def pad4(blob):
    return blob + b'\x00' * ((4 - len(blob) % 4) % 4)


def write_glb(path, meshes, materials):
    blob = bytearray()
    views = []
    accessors = []

    def add_view(data, target):
        views.append({'buffer': 0, 'byteOffset': len(blob), 'byteLength': len(data),
                      'target': target})
        blob.extend(pad4(bytes(data)))
        return len(views) - 1

    def add_accessor(view, ctype, atype, count, mn=None, mx=None):
        acc = {'bufferView': view, 'componentType': ctype, 'count': count, 'type': atype}
        if mn is not None:
            acc['min'] = [round(v, 5) for v in mn]
            acc['max'] = [round(v, 5) for v in mx]
        accessors.append(acc)
        return len(accessors) - 1

    nodes = []
    gltf_meshes = []
    for m in meshes:
        lo = [min(p[i] for p in m.pos) for i in range(3)]
        hi = [max(p[i] for p in m.pos) for i in range(3)]
        attrs = {
            'POSITION': add_accessor(
                add_view(b''.join(struct.pack('<3f', *p) for p in m.pos), 34962),
                FLOAT, 'VEC3', len(m.pos), lo, hi),
            'NORMAL': add_accessor(
                add_view(b''.join(struct.pack('<3f', *n) for n in m.normals()), 34962),
                FLOAT, 'VEC3', len(m.pos)),
            'COLOR_0': add_accessor(
                add_view(b''.join(struct.pack('<3f', *c) for c in m.col), 34962),
                FLOAT, 'VEC3', len(m.pos)),
        }
        if m.uvs:
            attrs['TEXCOORD_0'] = add_accessor(
                add_view(b''.join(struct.pack('<2f', *u) for u in m.uv), 34962),
                FLOAT, 'VEC2', len(m.pos))
        gltf_meshes.append({'name': m.name, 'primitives': [{
            'attributes': attrs,
            'indices': add_accessor(
                add_view(b''.join(struct.pack('<3H', *i) for i in m.idx), 34963),
                USHORT, 'SCALAR', len(m.idx) * 3),
            'material': materials.index(m.material),
            'mode': 4,
        }]})
        nodes.append({'mesh': len(gltf_meshes) - 1, 'name': m.name})

    doc = {
        'asset': {'version': '2.0', 'generator': 'tools/models/make_landscape.py',
                  'copyright': 'Urbis, generated in-house'},
        'scene': 0,
        'scenes': [{'name': 'model', 'nodes': list(range(len(nodes)))}],
        'nodes': nodes,
        'meshes': gltf_meshes,
        'materials': materials,
        'accessors': accessors,
        'bufferViews': views,
        'buffers': [{'byteLength': len(blob)}],
    }
    js = json.dumps(doc, separators=(',', ':')).encode('utf8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    bin_blob = pad4(bytes(blob))
    out = bytearray()
    out.extend(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(js) + 8 + len(bin_blob)))
    out.extend(struct.pack('<II', len(js), 0x4E4F534A))
    out.extend(js)
    out.extend(struct.pack('<II', len(bin_blob), 0x004E4942))
    out.extend(bin_blob)
    with open(path, 'wb') as fh:
        fh.write(out)
    return len(out), sum(len(m.idx) for m in meshes), sum(len(m.pos) for m in meshes)


def data_url(path):
    with open(path, 'rb') as fh:
        return 'data:model/gltf-binary;base64,' + base64.b64encode(fh.read()).decode()


# ---------------------------------------------------------------------------
# Trees: one hardwood skeleton the three canopies hang on.
# ---------------------------------------------------------------------------
LIMB_SIDES = 9
BOUGHS = 5

# Canopy forms: x, y, z, radius per leaf mass, and the band over which sky
# occlusion is baked. A mass takes CARDS cards, so a canopy is 320 triangles
# and the silhouette differs model to model.
TREES = [
    ('oak', 79, [
        [0.00, 3.05, 0.00, 1.15], [0.88, 3.30, 0.28, 0.82], [-0.78, 3.20, -0.38, 0.86],
        [0.26, 3.90, -0.72, 0.72], [-0.36, 4.02, 0.66, 0.68], [0.56, 4.48, 0.16, 0.58],
        [-0.62, 4.40, -0.22, 0.54], [0.04, 4.92, 0.06, 0.48], [1.12, 2.85, -0.52, 0.52],
        [-1.08, 2.95, 0.50, 0.58]], 2.30, 5.30),
    ('lime', 179, [
        [0.00, 3.10, 0.00, 0.95], [0.40, 3.50, 0.20, 0.70], [-0.35, 3.40, -0.20, 0.68],
        [0.15, 4.10, -0.30, 0.62], [-0.15, 4.20, 0.30, 0.60], [0.25, 4.70, 0.10, 0.50],
        [-0.25, 4.65, -0.10, 0.48], [0.05, 5.20, 0.05, 0.42], [0.50, 3.00, -0.25, 0.45],
        [-0.50, 3.10, 0.25, 0.48]], 2.40, 5.60),
    ('plane', 279, [
        [0.00, 2.90, 0.00, 1.25], [1.00, 3.10, 0.30, 0.80], [-0.95, 3.05, -0.35, 0.84],
        [0.30, 3.60, -0.80, 0.70], [-0.40, 3.70, 0.75, 0.66], [0.60, 4.10, 0.20, 0.55],
        [-0.65, 4.05, -0.20, 0.52], [0.05, 4.50, 0.05, 0.45], [1.30, 2.70, -0.55, 0.50],
        [-1.25, 2.80, 0.55, 0.54]], 2.25, 5.15),
]
CARDS = 16           # alpha-cut leaves per leaf mass
CANOPY_FLOOR = 0.42  # how dark the underside goes


def trunk_bend(t):
    """The trunk's own offset from the axis at height t (0-1 up the stem), so a
    limb starts where the stem actually is."""
    return 0.055 * math.sin(0.85 * t) + 0.03 * math.sin(2.1 * t)


def tree_trunk():
    """The stem, shared by all three trees the way a nursery tree is one
    grafted stem under a head of growth: a bend, a root flare and noise on the
    radius, so the silhouette is wood and not a pipe."""
    trunk = Mesh('tree-trunk', MAT_TRUNK)
    rings = 16
    spine = []
    radii = []
    for i in range(rings):
        t = i / (rings - 1)
        spine.append((trunk_bend(t), 3.25 * t,
                      0.04 * math.sin(1.15 * t) - 0.02 * math.sin(1.9 * t)))
        r = lerp(0.155, 0.075, smoothstep(0.0, 0.62, t))
        r += 0.15 * (1.0 - smoothstep(0.0, 0.34, t)) ** 1.6
        radii.append(max(0.03, r))
    add_tube(trunk, spine, radii, LIMB_SIDES, (0.205, 0.17, 0.13), (0.15, 0.12, 0.09),
             jitter=lambda i, j: 0.045 * math.sin(3 * j + 1.7 * i + 0.5)
             + 0.03 * math.sin(7 * j + 3.1 * i))
    return [trunk]


def tree_branches():
    """Grafted limbs, each forking once on its way into the canopy: the arm
    that holds a head of leaf cards off the trunk, so the canopy is not a ball
    balanced on a stick."""
    branch = Mesh('tree-branch', MAT_BRANCH)
    rng = random.Random(4242)
    for b in range(BOUGHS):
        t0 = 0.42 + 0.11 * b
        ang = 2 * math.pi * b / BOUGHS + 0.5
        reach = 1.35 + rng.random() * 0.5
        lift = 0.85 + rng.random() * 0.35
        n = 5
        pts = []
        for i in range(n):
            s = i / (n - 1)
            pts.append((trunk_bend(t0) + math.cos(ang) * reach * s ** 1.35,
                        3.25 * t0 + lift * s ** 1.5,
                        math.sin(ang) * reach * s ** 1.35 + 0.04 * math.sin(s * 4)))
        add_tube(branch, pts, [lerp(0.075, 0.028, i / (n - 1)) for i in range(n)],
                 6, (0.19, 0.155, 0.12), (0.12, 0.10, 0.08))
        for f in range(2):
            fa = ang + (1.2 if f else -1.2)
            fpts = []
            fn = 4
            for i in range(fn):
                s = i / (fn - 1)
                fpts.append((pts[-1][0] + math.cos(fa) * 0.55 * s,
                             pts[-1][1] + 0.35 * s,
                             pts[-1][2] + math.sin(fa) * 0.55 * s))
            add_tube(branch, fpts, [lerp(0.032, 0.016, i / (fn - 1)) for i in range(fn)],
                     5, (0.18, 0.15, 0.115), (0.115, 0.095, 0.075))
    return [branch]


def canopy_model(name, seed, clumps, low, high):
    """Counted leaves: a fixed number of tilted cards per mass, seeded, so a
    model is the same mesh every run and costs 320 triangles."""
    rng = random.Random(seed)
    mesh = Mesh(f'tree-canopy-{name}', MAT_CANOPY, uvs=True)
    for cx, cy, cz, r in clumps:
        for _ in range(CARDS):
            w = 1.1 * r
            rx = rng.random() * math.pi * 2
            ry = rng.random() * math.pi * 2
            rz = rng.random() * math.pi * 2
            ca, sa = math.cos(-ry), math.sin(-ry)
            rad = 0.8 * r * math.cbrt(rng.random())
            th = rng.random() * math.pi * 2
            ph = math.acos(2 * rng.random() - 1)
            ctr = (cx + rad * math.sin(ph) * math.cos(th),
                   cy + rad * math.cos(ph),
                   cz + rad * math.sin(ph) * math.sin(th))
            pts = []
            for ux, uy in (-1, -1), (1, -1), (1, 1), (-1, 1):
                x, y, z = ux * w * 0.5, uy * w * 0.5, 0.0
                x, z = ca * x - sa * z, sa * x + ca * z
                ca, sa = math.cos(-rx), math.sin(-rx)
                y, z = ca * y - sa * z, sa * y + ca * z
                ca, sa = math.cos(-rz), math.sin(-rz)
                x, y = ca * x - sa * y, sa * x + ca * y
                pts.append((ctr[0] + x, ctr[1] + y, ctr[2] + z))
            # Sky occlusion: leaves are dark where the sky cannot reach.
            shade = CANOPY_FLOOR + (1 - CANOPY_FLOOR) * max(
                0.0, min(1.0, (ctr[1] - low) / (high - low))) ** 0.8
            mesh.quad(pts, (shade, shade, shade),
                      [(0.08, 0.07), (0.89, 0.12), (0.85, 0.92), (0.11, 0.87)])
    return [mesh]


# ---------------------------------------------------------------------------
# Mountains: two massif forms. The game scatters copies of them along the two
# ridges that have always walled the valley and lifts each onto the terrain.
# ---------------------------------------------------------------------------
ROCK = (0.137, 0.173, 0.227)
SNOW = (0.874, 0.91, 0.949)
MASSIF_RADIUS = 80.0
MASSIF_CELL = 6.0
# The finest ridge must be more than two cells across or the grid aliases it.
MASSIF_FINEST = 13.0


def hash2(ix, iz, seed):
    h = (ix * 374761393) ^ (iz * 668265263) ^ seed
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967296


def value_noise(x, z, seed):
    ix, iz = math.floor(x), math.floor(z)
    fx, fz = x - ix, z - iz
    ux, uz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)
    a, b = hash2(ix, iz, seed), hash2(ix + 1, iz, seed)
    c, d = hash2(ix, iz + 1, seed), hash2(ix + 1, iz + 1, seed)
    top, bot = a + (b - a) * ux, c + (d - c) * ux
    return (top + (bot - top) * uz) * 2 - 1


def ridged(x, z, seed):
    return 1.0 - abs(value_noise(x, z, seed))


def massif(form):
    """One mountain: a rounded shoulder, a ridged crest, two lesser tops, and
    a foot that meets y = 0 so a copy lifted onto terrain never floats."""
    seed = form + 1
    rng = random.Random(seed)
    height = 76 + rng.random() * 24
    radius = MASSIF_RADIUS * (0.9 + rng.random() * 0.2)
    nseed = 0x9e37 + seed * 7919
    tops = [(rng.uniform(-0.35, 0.35) * radius, rng.uniform(-0.35, 0.35) * radius,
             0.34 + rng.random() * 0.22) for _ in range(2)]
    snow_line = height * (0.52 + rng.random() * 0.1)
    mesh = Mesh(f'mountain-massif-{form}', MAT_ROCK)

    # A lattice of the disc, so the whole range is one continuous sheet with no
    # gap for the sky to show through.
    steps = int(2 * radius / MASSIF_CELL) + 1
    at = {}
    for i in range(steps):
        x = -radius + i * MASSIF_CELL
        for j in range(steps):
            z = -radius + j * MASSIF_CELL
            if math.hypot(x, z) > radius:
                continue
            t = math.hypot(x, z) / radius
            h = height * (1.0 - t * t) ** 1.35
            for tx, tz, w in tops:
                d = math.hypot(x - tx, z - tz) / (0.42 * radius)
                if d < 1.0:
                    h += w * height * 0.85 * (1.0 - d * d) ** 2
            crest = ridged(x / MASSIF_FINEST, z / MASSIF_FINEST, nseed) * 0.6 \
                + ridged(x / (MASSIF_FINEST * 0.45), z / (MASSIF_FINEST * 0.45), nseed + 11) * 0.4
            h *= 0.78 + 0.36 * crest
            h *= 1.0 - smoothstep(0.80, 1.0, t)
            shade = 1.0 + 0.07 * value_noise(x / 9.0, z / 9.0, nseed + 5)
            col = (ROCK[0] * shade, ROCK[1] * shade, ROCK[2] * shade)
            at[(round(x, 3), round(z, 3))] = mesh.vert((x, h, z), col)
    for (x, z), _ in list(at.items()):
        a = at[(x, z)]
        b = at.get((round(x + MASSIF_CELL, 3), z))
        c = at.get((round(x + MASSIF_CELL, 3), round(z + MASSIF_CELL, 3)))
        d = at.get((x, round(z + MASSIF_CELL, 3)))
        if None in (a, b, c, d):
            continue
        # Wound counter-clockwise seen from above: wound the other way, every
        # baked normal points down, the faces are culled and the range is
        # invisible against the sky.
        mesh.idx.append((a, d, b))
        mesh.idx.append((b, d, c))

    # Snow settles high and flat, over the rock the noise has already darkened.
    norms = mesh.normals()
    for i, p in enumerate(mesh.pos):
        v = smoothstep(snow_line, snow_line + 11.0, p[1]) \
            * smoothstep(0.48, 0.72, norms[i][1])
        mesh.col[i] = lerp_color(mesh.col[i], SNOW, v)
    return [mesh]


# ---------------------------------------------------------------------------
# The baked models. Each is written to public/assets/models/ as a GLB; the
# renderers load it from there — over HTTP in the browser (loadModelPool, as
# buildings.js and lamps.js do), off the disk in Node, where the accept specs
# and the sweeps call the builders synchronously and there is no fetch. The
# bytes never live in the source.
# ---------------------------------------------------------------------------
def emit(filename, meshes, materials, out):
    path = os.path.join(MODELS, filename)
    size, tris, verts = write_glb(path, meshes, materials)
    out.append((filename, size, tris, verts))


def main():
    os.makedirs(MODELS, exist_ok=True)
    report = []

    emit('tree_trunk.glb', tree_trunk(), [MAT_TRUNK], report)
    emit('tree_branch.glb', tree_branches(), [MAT_BRANCH], report)
    emit('mountain_massif.glb', massif(0) + massif(1), [MAT_ROCK], report)
    for name, seed, clumps, low, high in TREES:
        emit(f'tree_canopy_{name}.glb', canopy_model(name, seed, clumps, low, high),
             [MAT_CANOPY], report)

    print('model                       bytes   tris   verts')
    for filename, size, tris, verts in report:
        print(f'{filename:<26} {size:>7} {tris:>6} {verts:>7}')
    print(f'wrote, {len(report)} GLBs')


if __name__ == '__main__':
    main()
