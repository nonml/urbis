#!/usr/bin/env python3
# M2.T8: walker bake. 4 MPFB bodies x walk and idle, baked to a vertex
# animation texture (VAT) plus a base mesh.
#
# Bodies: MPFB macro presets (average / tall slim / short stocky / heavy) as
# parametric height/width scales on the M2.T4 topology (same vertex order for
# every body, so one texture column serves all four). Deterministic without
# Blender, like make_person.py. MPFB stays the source of the proportions when
# the art pass re-cuts these meshes; the scales here are its stand-ins.
# Motion: the CMU walk gait from make_person.py (thigh swing, knee bend,
# counter-swinging arms, hip bob, 1 s loop) sampled at 32 frames, plus a 16
# frame idle (breath and weight shift). Baked on the CPU by forward kinematics;
# every vertex is rigid-bound to one bone, so a frame is one matrix per bone.
# Normals ride from the base mesh (crowd distance; baking them doubles the
# texture for no visible gain).
#
# Outputs (public/assets/models/):
#   walkers.glb      base mesh: body 0 bind pose, POSITION/NORMAL/TEXCOORD_0,
#                    TEXCOORD_1.x carries the vertex id for the VAT lookup.
#   walkers_vat.png  16-bit RGB PNG, width = verts, rows = 4 bodies x 48
#                    frames (32 walk + 16 idle). Texel = baked position.
#   walkers_vat.json manifest: clips, bounds, and the shader formula.
# M2.T9 draws every walker from one InstancedMesh reading this texture:
# one main draw + one shadow draw = 2 draws for all walkers.
# New clips (M13 combat) extend CLIPS and the idle/walk samplers, nothing else.
import json, math, os, struct, zlib

WALK_N, IDLE_N = 32, 16
GLB_OUT = os.environ.get('WALKERS_OUT', 'public/assets/models/walkers.glb')
PNG_OUT = os.environ.get('WALKERS_VAT_OUT', 'public/assets/models/walkers_vat.png')
JSON_OUT = os.environ.get('WALKERS_MANIFEST_OUT', 'public/assets/models/walkers_vat.json')
CLIPS = {'walk': {'n': WALK_N, 'fps': 30}, 'idle': {'n': IDLE_N, 'fps': 30}}
# name, height scale, width scale. MPFB macro presets, parametric stand-ins.
BODIES = [('average', 1.00, 1.00), ('tall', 1.06, 0.92),
          ('stocky', 0.94, 1.12), ('heavy', 0.98, 1.22)]

BONES = [('hips', -1, (0.0, 0.95, 0.0)), ('thighL', 0, (-0.11, 0.90, 0.0)),
    ('shinL', 1, (-0.11, 0.48, 0.01)), ('thighR', 0, (0.11, 0.90, 0.0)),
    ('shinR', 3, (0.11, 0.48, 0.01)), ('spine', 0, (0.0, 1.30, 0.0)),
    ('armL', 5, (-0.30, 1.42, 0.0)), ('armR', 5, (0.30, 1.42, 0.0))]
PARENT = [p for _, p, _ in BONES]
REST = [r for _, _, r in BONES]
BI = {name: i for i, (name, _, _) in enumerate(BONES)}

PARTS = [('hips', (0, 0.99, 0), (0.30, 0.20, 0.19)),
    ('spine', (0, 1.30, 0), (0.34, 0.44, 0.22)),
    ('spine', (0, 1.70, 0), (0.20, 0.24, 0.22))]
for s, b in ((-1, 'L'), (1, 'R')):
    PARTS += [('thigh' + b, (s * 0.11, 0.69, 0), (0.13, 0.42, 0.15)),
        ('shin' + b, (s * 0.11, 0.27, 0.01), (0.11, 0.42, 0.13)),
        ('shin' + b, (s * 0.11, 0.035, 0.05), (0.11, 0.07, 0.26)),
        ('arm' + b, (s * 0.30, 1.25, 0), (0.09, 0.36, 0.10)),
        ('arm' + b, (s * 0.30, 1.00, 0), (0.08, 0.16, 0.09))]

C = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
     (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
FACES = [
    ((0, 0, -1), [0, 3, 2, 0, 2, 1]), ((0, 0, 1), [4, 5, 6, 4, 6, 7]),
    ((-1, 0, 0), [0, 4, 7, 0, 7, 3]), ((1, 0, 0), [1, 2, 6, 1, 6, 5]),
    ((0, -1, 0), [0, 1, 5, 0, 5, 4]), ((0, 1, 0), [3, 7, 6, 3, 6, 2]),
]

KT = [0.0, 0.25, 0.5, 0.75, 1.0]
WALK_ANG = {  # CMU gait: per-key X-rotation over KT, same curves as make_person.
    'thighL': (0, -0.55, 0, 0.55, 0), 'thighR': (0, 0.55, 0, -0.55, 0),
    'shinL': (-0.12, -0.55, -0.12, -0.12, -0.12),
    'shinR': (-0.12, -0.12, -0.12, -0.55, -0.12),
    'armL': (0, 0.45, 0, -0.45, 0), 'armR': (0, -0.45, 0, 0.45, 0)}
WALK_HIP = (0.95, 0.92, 0.95, 0.92, 0.95)


def sample_keys(keys, t):
    for i in range(4):
        if t <= KT[i + 1]:
            u = (t - KT[i]) / (KT[i + 1] - KT[i])
            return keys[i] + (keys[i + 1] - keys[i]) * u
    return keys[-1]


def walk_pose(f, hs):
    t = f / WALK_N
    angs = {b: sample_keys(WALK_ANG[b], t) for b in WALK_ANG}
    return angs, sample_keys(WALK_HIP, t) * hs


def idle_pose(f, hs):
    ph = 2 * math.pi * f / IDLE_N
    angs = {'spine': 0.02 * math.sin(ph), 'armL': 0.03 * math.sin(ph),
        'armR': -0.03 * math.sin(ph), 'thighL': 0.015 * math.sin(ph),
        'thighR': -0.015 * math.sin(ph)}
    return angs, 0.95 * hs + 0.008 * math.sin(2 * ph)


def mmul(a, b):
    return [sum(a[i * 4 + k] * b[k * 4 + j] for k in range(4)) for i in range(4) for j in range(4)]


def fk_mats(R, angs, hips_y):
    W = [None] * len(BONES)
    W[0] = [1, 0, 0, R[0][0], 0, 1, 0, hips_y, 0, 0, 1, R[0][2], 0, 0, 0, 1]
    for i in range(1, len(BONES)):
        lx, ly, lz = (a - b for a, b in zip(R[i], R[PARENT[i]]))
        an = angs.get(BONES[i][0], 0.0)
        c, s = math.cos(an), math.sin(an)
        M = mmul([1, 0, 0, lx, 0, 1, 0, ly, 0, 0, 1, lz, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, c, -s, 0, 0, s, c, 0, 0, 0, 0, 1])
        W[i] = mmul(W[PARENT[i]], M)
    return W


def body_bind(ws, hs):
    pos, nrm, vbone = [], [], []
    for bone, (cx, cy, cz), (sx, sy, sz) in PARTS:
        cx, sx = cx * ws, sx * ws
        cy, sy = cy * hs, sy * hs
        for n, quad in FACES:
            for ci in quad:
                x, y, z = C[ci]
                pos += [cx + x * sx / 2, cy + y * sy / 2, cz + z * sz / 2]
                nrm += list(n)
                vbone.append(BI[bone])
    return pos, nrm, vbone


def bake_body(bi):
    ws, hs = BODIES[bi][2], BODIES[bi][1]
    R = [(x * ws, y * hs, z) for x, y, z in REST]
    pos, _, vbone = body_bind(ws, hs)
    frames = []
    for f in range(WALK_N):
        angs, hy = walk_pose(f, hs)
        frames.append(pose_positions(pos, vbone, R, angs, hy))
    for f in range(IDLE_N):
        angs, hy = idle_pose(f, hs)
        frames.append(pose_positions(pos, vbone, R, angs, hy))
    return frames


def pose_positions(bind, vbone, R, angs, hips_y):
    W = fk_mats(R, angs, hips_y)
    out = []
    for i in range(len(vbone)):
        b = vbone[i]
        qx = bind[3 * i] - R[b][0]
        qy = bind[3 * i + 1] - R[b][1]
        qz = bind[3 * i + 2] - R[b][2]
        M = W[b]
        out += [M[0] * qx + M[1] * qy + M[2] * qz + M[3],
            M[4] * qx + M[5] * qy + M[6] * qz + M[7],
            M[8] * qx + M[9] * qy + M[10] * qz + M[11]]
    return out


def png16_rgb(w, h, pixels):
    raw = b''.join(b'\x00' + struct.pack('>%dH' % (w * 3),
        *[c for px in row for c in px]) for row in pixels)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data))
    ihdr = struct.pack('>IIBBBBB', w, h, 16, 2, 0, 0, 0)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
        + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def write_glb(path, pos, nrm):
    n = len(pos) // 3
    uv0, uv1 = [], []
    for i in range(n):
        uv0 += [pos[3 * i] + pos[3 * i + 2], pos[3 * i + 1]]
        uv1 += [i / (n - 1), 0.0]
    F = lambda v: struct.pack('<%df' % len(v), *v)
    parts, views, accs = [], [], []

    def push(data, ctype, atype, count):
        views.append({'buffer': 0, 'byteOffset': sum(map(len, parts)), 'byteLength': len(data)})
        parts.append(data)
        accs.append({'bufferView': len(views) - 1, 'componentType': ctype, 'type': atype, 'count': count,
            **({'min': list(map(float, (min(pos[0::3]), min(pos[1::3]), min(pos[2::3])))),
                'max': list(map(float, (max(pos[0::3]), max(pos[1::3]), max(pos[2::3]))))} if atype == 'VEC3' and ctype == 5126 and len(parts) == 1 else {})})
        return len(accs) - 1

    a_pos = push(F(pos), 5126, 'VEC3', n)
    a_nrm = push(F(nrm), 5126, 'VEC3', n)
    a_uv0 = push(F(uv0), 5126, 'VEC2', n)
    a_uv1 = push(F(uv1), 5126, 'VEC2', n)
    doc = {'asset': {'version': '2.0', 'generator': 'bake_vat.py (M2.T8)'}, 'scene': 0,
        'scenes': [{'nodes': [0]}], 'nodes': [{'name': 'WalkerBase', 'mesh': 0}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': a_pos, 'NORMAL': a_nrm,
        'TEXCOORD_0': a_uv0, 'TEXCOORD_1': a_uv1}, 'material': 0}]}],
        'materials': [{'name': 'walker', 'doubleSided': True, 'pbrMetallicRoughness': {
        'baseColorFactor': [0.05, 0.13, 0.15, 1.0], 'roughnessFactor': 0.6, 'metallicFactor': 0.1}}],
        'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': sum(len(p) for p in parts)}]}
    jb = json.dumps(doc).encode()
    jb += b' ' * (-len(jb) % 4)
    bb = b''.join(parts)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(bb))
    glb += struct.pack('<I', len(jb)) + b'JSON' + jb
    glb += struct.pack('<I', len(bb)) + b'BIN\x00' + bb
    open(path, 'wb').write(glb)
    return len(glb)


def main():
    baked = [bake_body(bi) for bi in range(len(BODIES))]
    n = len(baked[0][0]) // 3
    rows_per = WALK_N + IDLE_N
    flat = [fr for body in baked for fr in body]
    lo = [min(fr[3 * i + k] for fr in flat for i in range(n)) for k in range(3)]
    hi = [max(fr[3 * i + k] for fr in flat for i in range(n)) for k in range(3)]
    span = [b - a or 1.0 for a, b in zip(lo, hi)]
    pixels = []
    for fr in flat:
        pixels.append([tuple(min(65535, int(round((fr[3 * i + k] - lo[k]) / span[k] * 65535))) for k in range(3))
            for i in range(n)])
    open(PNG_OUT, 'wb').write(png16_rgb(n, len(flat), pixels))
    pos0, nrm0, _ = body_bind(BODIES[0][2], BODIES[0][1])
    glb_bytes = write_glb(GLB_OUT, pos0, nrm0)
    manifest = {'generator': 'bake_vat.py (M2.T8)', 'verts': n,
        'tris': n // 3, 'bodies': [{'name': nm, 'height': h, 'width': w} for nm, h, w in BODIES],
        'clips': {k: {'start': 0 if k == 'walk' else WALK_N, **v} for k, v in CLIPS.items()},
        'rowsPerBody': rows_per, 'rows': len(flat),
        'bounds': {'min': lo, 'max': hi}, 'texture': os.path.basename(PNG_OUT),
        'baseMesh': os.path.basename(GLB_OUT),
        'decode': 'pos = min + texel * (max - min); '
        'u = (TEXCOORD_1.x * (verts - 1) + 0.5) / verts; '
        'v = (body * rowsPerBody + clip.start + frame + 0.5) / rows; '
        'texture: linear values, NearestFilter, flipY = false'}
    open(JSON_OUT, 'w').write(json.dumps(manifest, indent=1))
    print(f'{GLB_OUT}: {n} verts, {n // 3} tris, {glb_bytes / 1024:.1f} KB; '
        f'{PNG_OUT}: {n}x{len(flat)} VAT, clips walk/{WALK_N} idle/{IDLE_N} x {len(BODIES)} bodies')


if __name__ == '__main__':
    main()
