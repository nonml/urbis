#!/usr/bin/env python3
# tools/models/make_saloon.py — M2.F4: a believable modern four-door saloon,
# built directly in Blender (bpy) — the fallback docs/ROADMAP.md M2 allows when
# a generated mesh comes out wrong. The trellis "showcase racer" was shards on
# a flat plinth; this is a lofted body instead: bonnet, raked windscreen, glass
# cabin with A/B/C pillars, boot, wheel arches cut as side pockets so the
# wheels sit in them, bumpers, grille, mirrors and lamps.
#
# Metres, glTF axes (+X right, +Y up, +Z nose), origin at the base. The Blender
# scene is built in glTF coordinates through bl() below, so the exported GLB
# needs no extra rotation. Four wheel objects are separate nodes named
# Wheel_FL/FR/RL/RR; their object transforms are applied so the acceptance
# test, which reads raw accessor bounds, sees true metre coordinates.
#
# Usage: blender --background --python tools/models/make_saloon.py
# Writes public/assets/models/car/car.glb and info.json. Deterministic.
import bpy
import bmesh
import math
import os
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DST_DIR = os.path.abspath(os.path.join(HERE, "..", "..", "public", "assets", "models", "car"))
DST = os.path.join(DST_DIR, "car.glb")

LEN = 4.60          # metres, bumper to bumper (test window 4.3-4.9)
WID = 1.80          # metres, mirror to mirror is 1.90 below
HGT = 1.45          # metres, ground to roof
WHEEL_R = 0.33
WHEEL_W = 0.24
TRACK_X = 0.77      # wheel centres, the same nodes the trellis body left (M2.T3)
AXLE_F = 1.408
AXLE_R = -1.408
ARCH_R = 0.41       # wheel-arch pocket radius: 8 cm of gap over the tyre
ARCH_IN = 0.47      # pocket inner wall; the body centre stays solid
ARCH_OUT = 1.05     # cutter outer end, past the body flank
BODY_FRONT = 2.06   # the painted nose panel, recessed behind the bumper
BODY_BACK = -2.10   # the painted tail panel, lamps sit just proud of it
BUMPER_F = 2.30     # bumpers are the length: 4.60 m overall
BUMPER_B = -2.30
MAX_TRIS = 6500

# The ring: 24 points of a superellipse (m = 4). A box section would read as a
# toy; the rounded square gives shoulders, a flat roof plateau and a waist
# without any sculpting. Index 0 is the right waist, 6 the roof centre.
RING = 24
RING_UV = []
for _k in range(RING):
    _a = 2 * math.pi * _k / RING
    _cu, _cv = math.cos(_a), math.sin(_a)
    RING_UV.append((
        math.copysign(abs(_cu) ** 0.5, _cu) if _cu else 0.0,
        math.copysign(abs(_cv) ** 0.5, _cv) if _cv else 0.0,
    ))

# (z, y_bottom, y_top, half_width_bottom, half_width_top). yb/yt carry the
# bonnet and boot lines; wb/wt carry the tumblehome; the windscreen and rear
# screen are the steep top-band climbs between the cowl/roof stations.
STATIONS = [
    ( 2.06, 0.22, 0.88, 0.78, 0.80),   # nose panel
    ( 2.00, 0.19, 0.93, 0.83, 0.84),
    ( 1.88, 0.18, 0.96, 0.87, 0.88),
    ( 1.70, 0.17, 0.98, 0.89, 0.90),
    ( 1.408, 0.17, 0.99, 0.90, 0.90),  # front axle
    ( 1.10, 0.17, 1.00, 0.90, 0.90),
    ( 0.80, 0.17, 1.01, 0.90, 0.89),
    ( 0.62, 0.17, 1.03, 0.90, 0.87),
    ( 0.55, 0.17, 1.05, 0.90, 0.86),   # cowl: windscreen base
    ( 0.40, 0.17, 1.13, 0.90, 0.83),
    ( 0.26, 0.17, 1.24, 0.90, 0.79),
    ( 0.12, 0.17, 1.35, 0.90, 0.74),
    ( 0.00, 0.17, 1.43, 0.90, 0.71),
    (-0.12, 0.17, 1.45, 0.90, 0.70),   # roof front
    (-0.32, 0.17, 1.45, 0.90, 0.70),
    (-0.40, 0.17, 1.45, 0.90, 0.70),   # B pillar
    (-0.54, 0.17, 1.45, 0.90, 0.70),
    (-0.90, 0.17, 1.45, 0.90, 0.70),
    (-1.06, 0.17, 1.43, 0.90, 0.71),   # roof rear: rear screen base
    (-1.18, 0.17, 1.38, 0.90, 0.73),
    (-1.32, 0.17, 1.30, 0.90, 0.76),
    (-1.48, 0.17, 1.20, 0.90, 0.80),
    (-1.64, 0.17, 1.10, 0.90, 0.85),
    (-1.82, 0.18, 1.03, 0.90, 0.88),   # boot lid
    (-1.98, 0.20, 0.99, 0.89, 0.87),
    (-2.05, 0.21, 0.97, 0.88, 0.86),
    (-2.10, 0.23, 0.95, 0.86, 0.84),   # tail panel
]


def bl(gx, gy, gz):
    # Blender (x, y, z) exports as glTF (x, z, -y): glTF +Z nose is Blender -Y.
    return (gx, -gz, gy)


def wipe_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for x in list(coll):
            coll.remove(x)


def principled(name, color, rough, metal, emission=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emission and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (*color, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emission
    return m


def paint_texture(material):
    # The game's hero/traffic sort classifies a part as paint by the presence
    # of a baseColorTexture (render/traffic.js heroSort), so the paint material
    # must carry one. A near-white 8x8 lets the fleet's per-car instanceColor
    # tint it; the hero car reads as the light grey the pixel holds.
    path = os.path.join(tempfile.gettempdir(), "urbis_saloon_paint.png")
    img = bpy.data.images.new("SaloonPaint", 8, 8, alpha=False)
    img.pixels = [0.82, 0.83, 0.85, 1.0] * (8 * 8)
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    tex = bpy.data.images.load(path)
    node = material.node_tree.nodes.new("ShaderNodeTexImage")
    node.image = tex
    node.location = (-420, 220)
    bsdf = material.node_tree.nodes["Principled BSDF"]
    material.node_tree.links.new(node.outputs["Color"], bsdf.inputs["Base Color"])


def build_body(paint, glass, trim):
    bm = bmesh.new()
    rings = []
    for z, yb, yt, wb, wt in STATIONS:
        ring = []
        for u, v in RING_UV:
            w = (wb + wt) * 0.5 + (wt - wb) * 0.5 * v
            gy = (yb + yt) * 0.5 + (yt - yb) * 0.5 * v
            ring.append(bm.verts.new(bl(w * u, gy, z)))
        rings.append(ring)
    for s in range(len(rings) - 1):
        for k in range(RING):
            a = rings[s][k]
            b = rings[s][(k + 1) % RING]
            c = rings[s + 1][(k + 1) % RING]
            d = rings[s + 1][k]
            bm.faces.new((a, b, c, d))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("SaloonBody")
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("Body", mesh)
    bpy.context.collection.objects.link(obj)
    for m in (paint, glass, trim):
        obj.data.materials.append(m)
    return obj


def cut_arch(body, trim):
    # A cylinder whose axis runs across the car, stopped at ARCH_IN so the
    # pocket never tunnels through: the wheels sit in wells, the belly stays
    # closed. The cutter's Trim becomes the dark liner.
    for wx, wz in ((TRACK_X, AXLE_F), (-TRACK_X, AXLE_F), (TRACK_X, AXLE_R), (-TRACK_X, AXLE_R)):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=32, radius=ARCH_R, depth=(ARCH_OUT - ARCH_IN),
            location=bl(math.copysign((ARCH_IN + ARCH_OUT) / 2, wx), WHEEL_R, wz),
            rotation=(0.0, math.pi / 2, 0.0), calc_uvs=True,
        )
        cutter = bpy.context.view_layer.objects.active
        cutter.data.materials.append(trim)
        mod = body.modifiers.new("Arch", "BOOLEAN")
        mod.operation = "DIFFERENCE"
        mod.solver = "EXACT"
        mod.object = cutter
        bpy.context.view_layer.objects.active = body
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cutter, do_unlink=True)


def classify_body(body):
    # 0 paint, 1 glass, 2 trim. Rules are geometric, in glTF coordinates.
    for poly in body.data.polygons:
        c = poly.center
        n = poly.normal
        cx, cy, cz = c.x, c.z, -c.y
        nx, ny, nz = n.x, n.z, -n.y
        mat = 0
        for wz in (AXLE_F, AXLE_R):
            if abs(cx) > ARCH_IN - 0.02 and (cy - WHEEL_R) ** 2 + (cz - wz) ** 2 < (ARCH_R + 0.03) ** 2:
                mat = 2
                break
        if mat == 0 and cy < 0.34:
            mat = 2  # sills and underbody
        if mat == 0 and nz > 0.45 and cy > 0.98 and cz > 0.0 and abs(cx) < 0.82:
            mat = 1  # windscreen
        if mat == 0 and nz < -0.45 and cy > 0.98 and cz < -1.0:
            mat = 1  # rear screen
        if mat == 0 and abs(nx) > 0.40 and 1.00 < cy < 1.43:
            a_line = 0.42 - 0.55 * (cy - 1.02)
            c_line = -1.10 - 1.0 * (1.42 - cy)
            if a_line > cz > c_line and not (-0.44 < cz < -0.33):
                mat = 1  # side windows, split by the B pillar
        poly.material_index = mat


def boxes(name, specs, material):
    parts = []
    for (gx, gy, gz), (sx, sy, sz) in specs:
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=bl(gx, gy, gz))
        o = bpy.context.view_layer.objects.active
        o.scale = (sx, sz, sy)
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=True)
        o.data.materials.append(material)
        parts.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    return joined


def make_wheel(name, gx, gz, tyre):
    parts = []
    for radius, depth in ((WHEEL_R, WHEEL_W), (0.19, WHEEL_W + 0.03)):
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=24, radius=radius, depth=depth,
            location=bl(gx, WHEEL_R, gz), rotation=(0.0, math.pi / 2, 0.0), calc_uvs=True,
        )
        o = bpy.context.view_layer.objects.active
        o.data.materials.append(tyre)
        parts.append(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    wheel = bpy.context.view_layer.objects.active
    wheel.name = name
    # Applied, so raw accessor bounds are the real metre positions (the M2.F4
    # acceptance test reads accessors, not node transforms).
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return wheel


def add_uvs(obj):
    mesh = obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    uv = mesh.uv_layers.active.data
    for poly in mesh.polygons:
        for li in poly.loop_indices:
            v = mesh.vertices[mesh.loops[li].vertex_index].co
            uv[li].uv = (v.x / WID + 0.5, v.z / HGT)


def crease_and_smooth(obj):
    mod = obj.modifiers.new("Crease", "EDGE_SPLIT")
    mod.use_edge_angle = True
    mod.use_edge_sharp = True
    mod.split_angle = math.radians(40.0)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.shade_smooth()


def stats(objs):
    return sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)


def main():
    wipe_scene()
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.length_unit = "METERS"
    sc.unit_settings.scale_length = 1.0

    paint = principled("Paint", (0.80, 0.81, 0.83), 0.30, 0.15)
    paint_texture(paint)
    glass = principled("Glass", (0.02, 0.03, 0.05), 0.08, 0.35)
    tyre = principled("Tyre", (0.018, 0.018, 0.02), 0.92, 0.0)
    trim = principled("Trim", (0.035, 0.038, 0.042), 0.45, 0.35)
    light = principled("Light", (0.92, 0.90, 0.82), 0.15, 0.0, emission=0.8)

    body = build_body(paint, glass, trim)
    cut_arch(body, trim)
    classify_body(body)

    lights = boxes("Lights", [
        ((0.55, 0.70, 2.04), (0.38, 0.20, 0.12)),
        ((-0.55, 0.70, 2.04), (0.38, 0.20, 0.12)),
        ((0.55, 0.75, -2.075), (0.38, 0.20, 0.10)),
        ((-0.55, 0.75, -2.075), (0.38, 0.20, 0.10)),
    ], light)

    trim_parts = boxes("TrimParts", [
        ((0.0, 0.38, 2.18), (1.72, 0.40, 0.24)),    # front bumper
        ((0.0, 0.52, 2.12), (0.72, 0.20, 0.12)),    # grille
        ((0.0, 0.37, -2.16), (1.72, 0.38, 0.28)),   # rear bumper
        ((0.855, 0.30, 0.0), (0.07, 0.14, 2.0)),    # right rocker
        ((-0.855, 0.30, 0.0), (0.07, 0.14, 2.0)),   # left rocker
        ((0.90, 1.02, 0.40), (0.13, 0.09, 0.17)),   # right mirror
        ((-0.90, 1.02, 0.40), (0.13, 0.09, 0.17)),  # left mirror
        ((0.0, 1.10, -1.62), (0.30, 0.05, 0.10)),   # boot handle
    ], trim)

    wheels = [
        make_wheel("Wheel_FL", -TRACK_X, AXLE_F, tyre),
        make_wheel("Wheel_FR", TRACK_X, AXLE_F, tyre),
        make_wheel("Wheel_RL", -TRACK_X, AXLE_R, tyre),
        make_wheel("Wheel_RR", TRACK_X, AXLE_R, tyre),
    ]

    objs = [body, lights, trim_parts] + wheels
    for o in objs:
        add_uvs(o)
        crease_and_smooth(o)
    total = stats(objs)
    if total > MAX_TRIS:
        raise SystemExit("[make_saloon] %d tris over budget %d" % (total, MAX_TRIS))

    bpy.ops.object.select_all(action="SELECT")
    os.makedirs(DST_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=DST, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True, export_materials="EXPORT",
    )
    with open(os.path.join(DST_DIR, "info.json"), "w") as f:
        f.write('{"id": "car", "name": "Modern saloon", "type": "models", '
                '"license": "CC0", "fmt": "glb", '
                '"source": "tools/models/make_saloon.py"}\n')
    lo = [min(v.co[i] for o in objs for v in o.data.vertices) for i in range(3)]
    hi = [max(v.co[i] for o in objs for v in o.data.vertices) for i in range(3)]
    print("[make_saloon] WROTE %s (%d bytes)" % (DST, os.path.getsize(DST)))
    print("[make_saloon] tris=%d nodes=%d mats=%d" % (total, len(objs), len(bpy.data.materials)))
    print("[make_saloon] metres x=%.2f y=%.2f z=%.2f" % (hi[0] - lo[0], hi[2] - lo[2], hi[1] - lo[1]))


main()
