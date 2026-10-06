#!/usr/bin/env python3
# M2.T4: MPFB proportions as boxes (deterministic without Blender), CMU gait as
# ±30° thigh swing, knee bend, counter-swinging arms, 3 cm hip bob, 1 s loop.
# Writes PERSON_OUT (default public/assets/models/person.glb): one skinned
# mesh, one Walk clip, ~150 triangles of the 10,000 budget. Stdlib only.
import json, math, os, struct

TRI_BUDGET = 10000
OUT = os.environ.get('PERSON_OUT', 'public/assets/models/person.glb')

# name, parent, rest position.
BONES = [('hips', -1, (0.0, 0.95, 0.0)), ('thighL', 0, (-0.11, 0.90, 0.0)),
    ('shinL', 1, (-0.11, 0.48, 0.01)), ('thighR', 0, (0.11, 0.90, 0.0)),
    ('shinR', 3, (0.11, 0.48, 0.01)), ('spine', 0, (0.0, 1.30, 0.0)),
    ('armL', 5, (-0.30, 1.42, 0.0)), ('armR', 5, (0.30, 1.42, 0.0))]
BI = {name: i for i, (name, _, _) in enumerate(BONES)}

# bone, center, size. One bone per box, weight 1: no candy-wrapper knees.
# Symmetric pairs generated, so left and right can never drift apart.
PARTS = [('hips', (0, 0.99, 0), (0.30, 0.20, 0.19)),
    ('spine', (0, 1.30, 0), (0.34, 0.44, 0.22)),
    ('spine', (0, 1.70, 0), (0.20, 0.24, 0.22))]
for s, b in ((-1, 'L'), (1, 'R')):
    PARTS += [('thigh' + b, (s * 0.11, 0.69, 0), (0.13, 0.42, 0.15)),
        ('shin' + b, (s * 0.11, 0.27, 0.01), (0.11, 0.42, 0.13)),
        ('shin' + b, (s * 0.11, 0.035, 0.05), (0.11, 0.07, 0.26)),
        ('arm' + b, (s * 0.30, 1.25, 0), (0.09, 0.36, 0.10)),
        ('arm' + b, (s * 0.30, 1.00, 0), (0.08, 0.16, 0.09))]

# Outward-CCW quads over the 8 corners; doubleSided in the material backs it.
C = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1),
     (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
FACES = [
    ((0, 0, -1), [0, 3, 2, 0, 2, 1]), ((0, 0, 1), [4, 5, 6, 4, 6, 7]),
    ((-1, 0, 0), [0, 4, 7, 0, 7, 3]), ((1, 0, 0), [1, 2, 6, 1, 6, 5]),
    ((0, -1, 0), [0, 1, 5, 0, 5, 4]), ((0, 1, 0), [3, 7, 6, 3, 6, 2]),
]

QX = lambda a: (math.sin(a / 2), 0.0, 0.0, math.cos(a / 2))
T = [0.0, 0.25, 0.5, 0.75, 1.0]
WALK = [  # node, path, per-key values over T.
    ('thighL', 'rotation', [QX(a) for a in (0, -0.55, 0, 0.55, 0)]),
    ('thighR', 'rotation', [QX(a) for a in (0, 0.55, 0, -0.55, 0)]),
    ('shinL', 'rotation', [QX(a) for a in (-0.12, -0.55, -0.12, -0.12, -0.12)]),
    ('shinR', 'rotation', [QX(a) for a in (-0.12, -0.12, -0.12, -0.55, -0.12)]),
    ('armL', 'rotation', [QX(a) for a in (0, 0.45, 0, -0.45, 0)]),
    ('armR', 'rotation', [QX(a) for a in (0, -0.45, 0, 0.45, 0)]),
    ('hips', 'translation', [(0.0, y, 0.0) for y in (0.95, 0.92, 0.95, 0.92, 0.95)]),
]

def main():
    pos, nrm, jnt, wgt = [], [], [], []
    for bone, (cx, cy, cz), (sx, sy, sz) in PARTS:
        j = BI[bone]
        for n, quad in FACES:
            for ci in quad:
                x, y, z = C[ci]
                pos += [cx + x * sx / 2, cy + y * sy / 2, cz + z * sz / 2]
                nrm += list(n)
                jnt += [j, 0, 0, 0]
                wgt += [1.0, 0.0, 0.0, 0.0]
    n = len(pos) // 3
    tris = n // 3
    assert tris < TRI_BUDGET, f'over budget: {tris} triangles'
    ibm = []
    for _, _, (x, y, z) in BONES:
        ibm += [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]
    bin_parts, views, accs = [], [], []

    def push(data, ctype, atype, count):
        views.append({'buffer': 0, 'byteOffset': sum(map(len, bin_parts)), 'byteLength': len(data)})
        bin_parts.append(data)
        accs.append({'bufferView': len(views) - 1, 'componentType': ctype, 'type': atype, 'count': count})
        return len(accs) - 1

    F = lambda v: struct.pack('<%df' % len(v), *v)

    a_pos = push(F(pos), 5126, 'VEC3', n)
    a_nrm = push(F(nrm), 5126, 'VEC3', n)
    jd = b''.join(struct.pack('BBBB', *jnt[i:i + 4]) for i in range(0, len(jnt), 4))
    a_jnt = push(jd, 5121, 'VEC4', n)
    a_wgt = push(F(wgt), 5126, 'VEC4', n)
    a_ibm = push(F(ibm), 5126, 'MAT4', len(BONES))
    a_time = push(F(T), 5126, 'SCALAR', len(T))
    samplers, channels = [], []
    for node, path, keys in WALK:
        flat = [v for key in keys for v in key]
        a_out = push(F(flat), 5126, 'VEC4' if path == 'rotation' else 'VEC3', len(keys))
        samplers.append({'input': a_time, 'output': a_out})
        channels.append({'sampler': len(samplers) - 1, 'target': {'node': BI[node], 'path': path}})
    nodes = []
    for i, (name, p, rest) in enumerate(BONES):
        base = BONES[p][2] if p >= 0 else (0, 0, 0)
        nd = {'name': name, 'translation': [a - b for a, b in zip(rest, base)]}
        kids = [j for j, (_, q, _) in enumerate(BONES) if q == i]
        if kids:
            nd['children'] = kids
        nodes.append(nd)
    nodes.append({'name': 'PersonMesh', 'mesh': 0, 'skin': 0})
    doc = {'asset': {'version': '2.0', 'generator': 'make_person.py (M2.T4)'}, 'scene': 0,
        'scenes': [{'nodes': [0, len(nodes) - 1]}], 'nodes': nodes,
        'skins': [{'joints': list(range(len(BONES))), 'inverseBindMatrices': a_ibm}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': a_pos, 'NORMAL': a_nrm,
        'JOINTS_0': a_jnt, 'WEIGHTS_0': a_wgt}, 'material': 0}]}],
        'materials': [{'name': 'coat', 'doubleSided': True, 'pbrMetallicRoughness': {
        'baseColorFactor': [0.05, 0.13, 0.15, 1.0], 'roughnessFactor': 0.6, 'metallicFactor': 0.1}}],
        'animations': [{'name': 'Walk', 'samplers': samplers, 'channels': channels}],
        'accessors': accs, 'bufferViews': views, 'buffers': [{'byteLength': sum(len(p) for p in bin_parts)}]}
    jb = json.dumps(doc).encode()
    jb += b' ' * (-len(jb) % 4)
    bb = b''.join(bin_parts)
    bb += b'\x00' * (-len(bb) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(jb) + 8 + len(bb))
    glb += struct.pack('<I', len(jb)) + b'JSON' + jb
    glb += struct.pack('<I', len(bb)) + b'BIN\x00' + bb
    open(OUT, 'wb').write(glb)
    print(f'{OUT}: {n} verts, {tris} tris, {len(BONES)} joints, {len(glb) / 1024:.1f} KB')


if __name__ == '__main__':
    main()
