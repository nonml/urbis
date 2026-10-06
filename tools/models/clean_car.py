#!/usr/bin/env python3
# tools/models/clean_car.py — M2.T3: evidence/car.glb (M2.E1, trellis.cpp,
# 147k tris, square plinth + fused blobs) to a game car.
#
# What it does, and why:
# - Drops the flat SDF plinth (faces at the floor) and the lower valance with
#   the fused wheel blobs, then closes the tub with a dark underbody plane.
#   A generated mesh has no separable wheels, so the four wheels are new
#   Blender cylinders on separate nodes (they must spin later).
# - Fits the tub to metres non-uniformly: the reference photo owns the side
#   profile, so length and height share one scale (4.4 m long); only the
#   hallucinated width is squeezed (1.82 m wide). Uniform scale would ship a
#   4.5 m wide square car.
# - Length ends on Blender Y (glTF +Z forward, matching traffic.js), origin
#   of the body at the ground centre, wheels' origins at their axles.
# - Decimates the tub to ~6,500 tris; file total stays under 8,000.
# - Exports public/assets/models/car/car.glb (Y-up, applied transforms) plus
#   info.json. Two materials: paint (the 1024 atlas) and dark trim.
#
# Usage: blender --background --python tools/models/clean_car.py
# Idempotent — three runs on the operator's Mac (Apple M3, 16 GB, 2026-10-07)
# each wrote byte-identical car.glb: 646,044 B, 6,806 tris, wall 1.7-2.9 s
# (cold caches cost the extra second), peak RSS 499-501 MB (`/usr/bin/time -l`).
# (The 16 min 35 s / 2.81 GB generation it cleans is M2.E1's, already logged in
# tools/models/README.md.)
import os
import bpy
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "evidence", "car.glb")
DST_DIR = os.path.abspath(os.path.join(HERE, "..", "..", "public", "assets", "models", "car"))
DST = os.path.join(DST_DIR, "car.glb")

TARGET_LEN = 4.4    # metres, saloon length
TARGET_W = 1.82     # metres, saloon width
BODY_TRIS = 6500    # tub budget; wheels + floor take ~600, file < 8000
MAX_TRIS = 8000     # M2.T3 ceiling: fail the run rather than ship over it
WHEEL_R = 0.33
WHEEL_W = 0.24
RIDE = 0.18         # tub floor above ground


def wipe_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for x in list(coll):
            coll.remove(x)


def import_body():
    bpy.ops.import_scene.gltf(filepath=SRC)
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "Body"
    return body


def delete_low_faces(obj, frac):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bm = bmesh.from_edit_mesh(obj.data)
    zs = [v.co.z for v in bm.verts]
    lo, hi = min(zs), max(zs)
    cut = lo + frac * (hi - lo)
    for f in bm.faces:
        if all(v.co.z < cut for v in f.verts):
            bm.faces.remove(f)
    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.delete_loose()
    bpy.ops.object.mode_set(mode="OBJECT")


def bounds(obj):
    ws = [obj.matrix_world @ v.co for v in obj.data.vertices]
    return (
        min(v.x for v in ws), max(v.x for v in ws),
        min(v.y for v in ws), max(v.y for v in ws),
        min(v.z for v in ws), max(v.z for v in ws),
    )


def orient_scale_drop(body):
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=False)
    x0, x1, y0, y1, _, _ = bounds(body)
    if (x1 - x0) > (y1 - y0):
        body.rotation_euler[2] += 1.5707963  # length onto Y (game +Z)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    x0, x1, y0, y1, z0, z1 = bounds(body)
    s_side = TARGET_LEN / (y1 - y0)
    body.scale = (TARGET_W / (x1 - x0), s_side, s_side)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    x0, x1, y0, y1, z0, z1 = bounds(body)
    body.location.x -= (x0 + x1) / 2
    body.location.y -= (y0 + y1) / 2
    body.location.z += RIDE - z0
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=False)
    bpy.context.scene.cursor.location = (0.0, 0.0, 0.0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")


def decimate_to(body, target):
    tris = sum(len(v) - 2 for v in [p.vertices for p in body.data.polygons])
    ratio = min(1.0, target / max(1, tris))
    mod = body.modifiers.new("Dec", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.modifier_apply(modifier=mod.name)
    mod2 = body.modifiers.new("Tri", "TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=mod2.name)
    tris = len(body.data.polygons)
    if tris > target:  # corrective second pass, rarely needed
        mod = body.modifiers.new("Dec2", "DECIMATE")
        mod.decimate_type = "COLLAPSE"
        mod.ratio = target / tris
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod2 = body.modifiers.new("Tri2", "TRIANGULATE")
        bpy.ops.object.modifier_apply(modifier=mod2.name)


def dark_mat():
    m = bpy.data.materials.new("Trim")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.03, 0.03, 0.035, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.8
    bsdf.inputs["Metallic"].default_value = 0.1
    return m


def close_and_wheels(body, mat):
    x0, x1, y0, y1, z0, _ = bounds(body)
    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.mesh.primitive_plane_add(size=1, location=((x0 + x1) / 2, (y0 + y1) / 2, z0 + 0.001))
    floor = bpy.context.view_layer.objects.active
    floor.name = "Underbody"
    floor.scale = (x1 - x0, y1 - y0, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    floor.data.materials.append(mat)
    body.select_set(True)
    floor.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    wheels = []
    for name, sx, sy in (("Wheel_FL", -1, 1), ("Wheel_FR", 1, 1), ("Wheel_RL", -1, -1), ("Wheel_RR", 1, -1)):
        bpy.ops.object.select_all(action="DESELECT")
        bpy.ops.mesh.primitive_cylinder_add(
            vertices=20, radius=WHEEL_R, depth=WHEEL_W,
            location=(sx * (TARGET_W / 2 - WHEEL_W / 2 - 0.02), sy * TARGET_LEN * 0.32, WHEEL_R),
        )
        w = bpy.context.view_layer.objects.active
        w.name = name
        w.rotation_euler[1] = 1.5707963  # axle across the width
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        w.data.materials.append(mat)
        wheels.append(w)
    return wheels


def main():
    wipe_scene()
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    sc.unit_settings.length_unit = "METERS"
    sc.unit_settings.scale_length = 1.0
    body = import_body()
    delete_low_faces(body, 0.02)   # the flat SDF plinth
    delete_low_faces(body, 0.18)   # valance + fused wheel blobs
    for p in body.data.polygons:
        p.use_smooth = True
    orient_scale_drop(body)
    decimate_to(body, BODY_TRIS)
    wheels = close_and_wheels(body, dark_mat())
    tris_of = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
    total = tris_of(body) + sum(tris_of(w) for w in wheels)
    if total > MAX_TRIS:
        raise SystemExit("[clean_car] %d tris over budget %d" % (total, MAX_TRIS))
    bpy.ops.object.select_all(action="SELECT")
    os.makedirs(DST_DIR, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=DST, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True, export_materials="EXPORT",
    )
    with open(os.path.join(DST_DIR, "info.json"), "w") as f:
        f.write('{"id": "car", "name": "Concept saloon", "type": "models", '
                '"license": "generated", "fmt": "glb", '
                '"source": "trellis.cpp showcase racer via tools/models/clean_car.py"}\n')
    x0, x1, y0, y1, z0, z1 = bounds(body)
    print("[clean_car] WROTE %s (%d bytes)" % (DST, os.path.getsize(DST)))
    print("[clean_car] tris body=%d total=%d nodes=%d mats=%d" % (
        tris_of(body), total, 1 + len(wheels), len(body.data.materials)))
    print("[clean_car] metres x=%.2f y=%.2f z=%.2f base_z=%.3f" % (x1 - x0, y1 - y0, z1 - z0, z0))


main()
