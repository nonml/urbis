#!/usr/bin/env python3
# M2.F2 (M2-0, M2-2): the player person, a real model instead of boxes.
# Plain `python3 make_person.py` locates Blender and runs this same file inside
# `blender --background`; the bpy half is the PERSON_STAGE=bake branch below.
#
# In Blender: MPFB builds a realistic human body and its cmu_mb rig; the CMU
# mocap walk vendored at tools/models/mocap/cmu-08_01-walk.bvh has its joints
# copied pose-for-pose onto the rig for one full gait cycle, grounded every
# frame; the body is decimated under the tri budget, vertex-coloured and
# exported to PERSON_OUT (default public/assets/models/person.glb): one skinned
# mesh, one `Walk` clip, one material.
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BVH = ROOT / 'mocap' / 'cmu-08_01-walk.bvh'
DEFAULT_OUT = 'public/assets/models/person.glb'
TRI_BUDGET = 10000

# Skin, coat, trousers, shoes, in linear RGB (glTF COLOR_0 is linear).
SKIN = (0.31, 0.21, 0.145)
COAT = (0.024, 0.075, 0.09)
TROUSERS = (0.016, 0.02, 0.026)
SHOES = (0.01, 0.01, 0.012)


def blender_binary():
    for cand in (os.environ.get('BLENDER'), shutil.which('blender'),
                 '/Applications/Blender.app/Contents/MacOS/Blender',
                 '/usr/bin/blender'):
        if cand and Path(cand).exists():
            return cand
    sys.exit('Blender not found: install it with `bash tools/models/setup.sh`, '
             'or set BLENDER to the binary. The person is a Blender bake.')


def configured_out():
    return Path(os.environ.get('PERSON_OUT', DEFAULT_OUT)).resolve()


def run_blender():
    if not BVH.is_file():
        sys.exit(f'CMU walk clip missing: {BVH}')
    env = {**os.environ, 'PERSON_STAGE': 'bake', 'PERSON_OUT': str(configured_out())}
    subprocess.run([blender_binary(), '--background', '--python-exit-code', '1',
                    '--python', str(Path(__file__).resolve())], check=True, env=env)
    out = configured_out()
    if not out.is_file():
        sys.exit(f'Blender finished but {out} was not written')
    print(f'{out}: {out.stat().st_size / 1024:.1f} KB')


if os.environ.get('PERSON_STAGE') != 'bake':  # host side: python3 make_person.py
    run_blender()
    sys.exit(0)

import bpy  # noqa: E402  (only reachable inside Blender)
from mathutils import Vector  # noqa: E402

try:  # Blender 4.2+ extensions load under bl_ext.
    from bl_ext.blender_org.mpfb.services.humanservice import HumanService
except ImportError:  # older MPFB installs
    try:
        from mpfb.services.humanservice import HumanService
    except ImportError as exc:
        sys.exit('MPFB is not installed in Blender: run `bash tools/models/setup.sh` '
                 f'({exc})')


def clear_scene():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


def import_walk():
    bpy.ops.import_anim.bvh(filepath=str(BVH), axis_forward='-Z', axis_up='Y',
                            rotate_mode='XYZ', global_scale=1.0, use_fps_scale=False,
                            update_scene_fps=False, update_scene_duration=True)
    source = bpy.context.object
    source.name = 'CMU walk'
    return source


def gait_window(source):
    """One full gait cycle: the lag at which the two feet's forward separation
    best repeats itself, so the clip loops seam-free instead of playing the
    whole trial. start is the stride's widest frame, where a cycle begins."""
    end = bpy.context.scene.frame_end
    sep = []
    for f in range(1, end + 1):
        bpy.context.scene.frame_set(f)
        bpy.context.view_layer.update()
        sep.append(source.pose.bones['LeftFoot'].head.y
                   - source.pose.bones['RightFoot'].head.y)
    mean = sum(sep) / len(sep)
    signal = [v - mean for v in sep]
    best_lag = max(range(20, len(signal) // 2),
                   key=lambda lag: sum(signal[i] * signal[i + lag]
                                       for i in range(len(signal) - lag)) / (len(signal) - lag))
    start = max(range(10, len(signal) - 10), key=lambda i: signal[i])
    return start + 1, best_lag


def retarget(source, rig, frame):
    """Copy each joint's world orientation from the CMU skeleton to the fitted
    rig: same topology, same facing, so the pose transfers exactly and the
    mesh's own joint lengths produce a human of its own build."""
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()

    def visit(pb, parent_pose):
        desired = pb.matrix.to_3x3()
        target = rig.pose.bones.get(pb.name)
        if target:
            rest = target.bone.matrix_local.to_3x3()
            if pb.parent is None:
                basis = rest.inverted() @ desired
            else:
                parent_rest = target.parent.bone.matrix_local.to_3x3()
                basis = rest.inverted() @ parent_rest @ parent_pose.inverted() @ desired
            target.rotation_mode = 'QUATERNION'
            target.rotation_quaternion = basis.to_quaternion()
        for child in pb.children:
            visit(child, desired)

    for pb in source.pose.bones:
        if pb.parent is None:
            visit(pb, None)
    bpy.context.view_layer.update()


def ground(rig, body):
    """Put the lowest point of the posed body on z = 0: feet on the pavement."""
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = body.evaluated_get(deps).to_mesh()
    low = min((body.matrix_world @ v.co).z for v in mesh.vertices)
    body.evaluated_get(deps).to_mesh_clear()
    hips = rig.pose.bones['Hips']
    rest = hips.bone.matrix_local.to_3x3()
    hips.location = hips.location + rest.inverted() @ Vector((0.0, 0.0, -low))
    bpy.context.view_layer.update()


def bake_walk(source, rig, body, start, cycle):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    for frame in range(start, start + cycle + 1):
        retarget(source, rig, frame)
        ground(rig, body)
        for pb in rig.pose.bones:
            pb.keyframe_insert(data_path='rotation_quaternion', frame=frame)
        rig.pose.bones['Hips'].keyframe_insert(data_path='location', frame=frame)
    action = rig.animation_data.action
    action.name = 'Walk'
    return action


def decimate(body):
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    if body.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for mod in list(body.modifiers):
        if mod.type == 'MASK':
            bpy.ops.object.modifier_apply(modifier=mod.name)
    tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
    mod = body.modifiers.new('Budget', 'DECIMATE')
    mod.ratio = min(1.0, (TRI_BUDGET - 500) / max(1, tris))
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return sum(len(p.vertices) - 2 for p in body.data.polygons)


def paint(body):
    groups = {g.index: g.name for g in body.vertex_groups}
    layer = body.data.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    for v in body.data.vertices:
        best = max(v.groups, key=lambda g: g.weight, default=None)
        name = groups.get(best.group, '') if best else ''
        if any(k in name for k in ('Hand', 'Head', 'Neck')):
            col = SKIN
        elif any(k in name for k in ('Arm', 'Shoulder')):
            col = COAT
        elif any(k in name for k in ('UpLeg', 'Leg')):
            col = TROUSERS
        elif any(k in name for k in ('Foot', 'Toe')):
            col = SHOES
        else:
            col = COAT if v.co.z > 1.04 else TROUSERS
        layer.data[v.index].color = (*col, 1.0)
    mat = bpy.data.materials.new('person')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    vcol = nodes.new('ShaderNodeVertexColor')
    vcol.layer_name = 'Col'
    mat.node_tree.links.new(vcol.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.65
    body.data.materials.clear()
    body.data.materials.append(mat)


def export(body, rig, out):
    for ob in bpy.data.objects:
        ob.select_set(False)
    body.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(out), export_format='GLB', use_selection=True, export_apply=True,
        export_texcoords=False, export_normals=True, export_skins=True,
        export_animations=True, export_animation_mode='ACTIONS',
        export_optimize_animation_size=True, export_anim_slide_to_zero=True,
        export_vertex_color='MATERIAL')


def main():
    out = configured_out()
    out.parent.mkdir(parents=True, exist_ok=True)
    clear_scene()
    # The CMU trials are captured at 120 fps; keep the clip a real second long.
    bpy.context.scene.render.fps = 120
    bpy.context.scene.render.fps_base = 1.0
    body = HumanService.create_human()
    rig = HumanService.add_builtin_rig(body, 'cmu_mb')
    source = import_walk()
    bvh_action = bpy.data.actions.get(source.animation_data.action.name)
    start, cycle = gait_window(source)
    bake_walk(source, rig, body, start, cycle)
    bpy.data.objects.remove(source, do_unlink=True)
    if bvh_action and bvh_action.users == 0:
        bpy.data.actions.remove(bvh_action)
    tris = decimate(body)
    paint(body)
    export(body, rig, out)
    print(f'M2.F2 person: {len(body.data.vertices)} verts, {tris} tris, '
          f'{len(rig.data.bones)} joints, walk frames {start}..{start + cycle}, '
          f'{out.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()
