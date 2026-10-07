#!/usr/bin/env python3
# M2.F2c: the player person, dressed. MPFB builds a realistic human and its
# cmu_mb rig from the installed MakeHuman system asset pack (makehuman_system_
# assets_cc0, CC0): skin material, low-poly eyes, short hair, a casual suit and
# shoes, all fitted and weight-copied onto the body. The CMU mocap walk vendored
# at tools/models/mocap/cmu-08_01-walk.bvh has its joints copied pose-for-pose
# onto the rig for one full gait cycle, grounded every frame; a second `Idle`
# clip holds the cycle's closest-to-rest frame, two identical keys, so the
# avatar stands still instead of walking in place while it is not moving. All
# parts are merged, decimated under the tri budget, vertex-coloured and
# exported to PERSON_OUT (default public/assets/models/person.glb): one skinned
# mesh, one material, `Walk` + `Idle`.
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BVH = ROOT / 'mocap' / 'cmu-08_01-walk.bvh'
DEFAULT_OUT = 'public/assets/models/person.glb'
# Whole character — head/hands skin, suit, trousers, shoes, hair, eyes — under
# the 15k-tri / 1.5 MB budget, with slack for the export.
TRI_BUDGET = 14500

# Skin, jacket, trousers, shoes, hair, eyes, in linear RGB (glTF COLOR_0 is
# linear). A dark worn navy suit, near-black shoes, chestnut hair, warm skin:
# grounded modern, no neon.
SKIN = (0.35, 0.24, 0.17)
EYE = (0.72, 0.74, 0.76)
JACKET = (0.028, 0.062, 0.082)
TROUSERS = (0.016, 0.021, 0.027)
SHOES = (0.012, 0.012, 0.014)
HAIR = (0.052, 0.030, 0.016)
# Below this height the suit reads as trousers; above it, jacket.
HIP_Y = 0.95


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
    from bl_ext.blender_org.mpfb.services.locationservice import LocationService
    from bl_ext.blender_org.mpfb.services.objectservice import ObjectService
except ImportError:  # older MPFB installs
    try:
        from mpfb.services.humanservice import HumanService
        from mpfb.services.locationservice import LocationService
        from mpfb.services.objectservice import ObjectService
    except ImportError as exc:
        sys.exit('MPFB is not installed in Blender: run `bash tools/models/setup.sh` '
                 f'({exc})')


class AssetMissing(Exception):
    pass


def pack_path(kind):
    """Where MPFB serves the makehuman_system_assets pack from. The pack is a
    separate download from the extension; without it there is nothing to wear."""
    root = LocationService.get_user_data(kind)
    if not Path(root).is_dir():
        raise AssetMissing(
            f'MPFB system asset pack not installed: no {kind}/ under its user '
            'data dir. Download makehuman_system_assets_cc0.zip from '
            'static.makehumancommunity.org/assets/assetpacks.html and unpack '
            "it into Blender's MPFB user data dir.")
    return Path(root)


def asset(kind, name):
    path = pack_path(kind) / name / f'{name}.mhclo'
    if not path.is_file():
        raise AssetMissing(f'{kind}/{name}.mhclo not found in the '
                           'makehuman_system_assets pack')
    return str(path)


def equip(basemesh, kind, name, **kw):
    print(f'  equip {kind}/{name}')
    return HumanService.add_mhclo_asset(
        asset(kind, name), basemesh, subdiv_levels=0, import_subrig=False, **kw)


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


def foot_separation(source, frame):
    bpy.context.scene.frame_set(frame)
    bpy.context.view_layer.update()
    return (source.pose.bones['LeftFoot'].head.y
            - source.pose.bones['RightFoot'].head.y)


def gait_window(source):
    """One full gait cycle: the lag at which the two feet's forward separation
    best repeats itself, so the clip loops seam-free instead of playing the
    whole trial. start is the stride's widest frame, where a cycle begins."""
    end = bpy.context.scene.frame_end
    sep = [foot_separation(source, f) for f in range(1, end + 1)]
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


def key_pose(rig, frame):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    for pb in rig.pose.bones:
        pb.keyframe_insert(data_path='rotation_quaternion', frame=frame)
    rig.pose.bones['Hips'].keyframe_insert(data_path='location', frame=frame)


def bake_walk(source, rig, body, start, cycle):
    for frame in range(start, start + cycle + 1):
        retarget(source, rig, frame)
        ground(rig, body)
        key_pose(rig, frame)
    action = rig.animation_data.action
    action.name = 'Walk'
    return action


def bake_idle(rig, source, body, rest_frame):
    """A new action, not the still-active one: the walk's closest-to-rest
    frame, retargeted and keyed at two identical frames — a held stand that
    loops cleanly, so standing still reads as standing, not as a walk frozen
    mid-cadence."""
    idle = bpy.data.actions.new('Idle')
    bpy.context.view_layer.objects.active = rig
    rig.animation_data.action = idle
    retarget(source, rig, rest_frame)
    ground(rig, body)
    key_pose(rig, 1)
    retarget(source, rig, rest_frame)
    key_pose(rig, 2)
    return idle


def stash(rig, action):
    """Put a clip on a single-strip, unmuted NLA track: the exporter's ACTIONS
    mode collects only strips that are unmuted and carry an action slot, and
    skips any track with more than one strip (io_scene_gltf2 action.py)."""
    track = rig.animation_data.nla_tracks.new()
    track.name = action.name
    strip = track.strips.new(action.name, max(1, int(action.frame_start)), action)
    strip.action_slot = action.slots[0]
    strip.action_frame_start = action.frame_start
    strip.action_frame_end = action.frame_end
    bpy.context.view_layer.update()


def tri_count(body):
    return sum(len(p.vertices) - 2 for p in body.data.polygons)


def decimate(body):
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    if body.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for mod in list(body.modifiers):
        if mod.type == 'MASK':
            bpy.context.view_layer.objects.active = body
            bpy.ops.object.modifier_apply(modifier=mod.name)
    mod = body.modifiers.new('Budget', 'DECIMATE')
    mod.ratio = min(1.0, (TRI_BUDGET - 500) / max(1, tri_count(body)))
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return tri_count(body)


def paint(body, parts):
    """Vertex colours on every part before the join, one material after:
    skin by bone group on the body, one value per garment, jacket vs
    trousers split by height."""
    def wipe_colors(ob):
        # MPFB meshes ship tens of thousands of embedded color layers; all of
        # them are dead weight in the GLB, ours is the only one that matters.
        for name in list(ob.data.color_attributes.keys()):
            try:
                ob.data.color_attributes.remove(ob.data.color_attributes[name])
            except Exception as exc:
                sys.exit(f'could not drop color layer {name} ({exc})')
    wipe_colors(body)
    groups = {g.index: g.name for g in body.vertex_groups}
    layer = body.data.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
    seen = {}
    # Skin, then shoes, then trousers: the first keyword a weighted group
    # matches wins, so aggregate side groups ('Left'...) can't shadow a real
    # bone's smaller weight.
    parts_ = ((SKIN, ('Hand', 'Finger', 'Thumb', 'Eye', 'Head', 'Neck')),
              (SHOES, ('Foot', 'Toe')),
              (TROUSERS, ('UpLeg', 'Leg', 'Hip')))
    for v in body.data.vertices:
        names = (groups.get(g.group, '') for g in v.groups if g.weight > 0.01)
        col = None
        for want, keys in parts_:
            if any(any(k in n for k in keys) for n in names):
                col = want
                break
        if col is None:
            col = JACKET if v.co.z > 1.04 else TROUSERS
        layer.data[v.index].color = (*col, 1.0)
        key = tuple(round(x, 3) for x in col)
        seen[key] = seen.get(key, 0) + 1
    print(f'  [paint] body: {seen}')
    for ob, col, split in ((parts['eyes'], EYE, False), (parts['hair'], HAIR, False),
                           (parts['suit'], None, True), (parts['shoes'], SHOES, False)):
        if ob is None:
            continue
        wipe_colors(ob)
        lay = ob.data.color_attributes.new(name='Col', type='FLOAT_COLOR', domain='POINT')
        seen = {}
        for v in ob.data.vertices:
            if split:
                c = TROUSERS if v.co.z <= HIP_Y else JACKET
            else:
                c = col
            lay.data[v.index].color = (*c, 1.0)
            c = tuple(round(x, 3) for x in c)
            seen[c] = seen.get(c, 0) + 1
        print(f'  [paint] {ob.name}: {seen}')


def single_material():
    mat = bpy.data.materials.new('person')
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    bsdf = nodes.get('Principled BSDF')
    vcol = nodes.new('ShaderNodeVertexColor')
    vcol.layer_name = 'Col'
    mat.node_tree.links.new(vcol.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.95
    return mat


def merge(body, parts):
    """Join the dressed parts into one skinned mesh. Vertex groups survive the
    join by name; every part was weight-copied to the body's own rig."""
    apply_masks(body)
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    for key in ('hair', 'eyes', 'suit', 'shoes'):
        ob = parts.get(key)
        if ob is None:
            continue
        apply_masks(ob)
        ob.select_set(True)
        print(f'  [merge] {key}: {len(ob.data.color_attributes)} color attrs, '
              f'{tri_count(ob)} tris')
    bpy.context.view_layer.objects.active = body
    bpy.context.view_layer.update()
    bpy.ops.object.join()
    print(f'  [merge] after join: {len(body.data.color_attributes)} color attrs')


def apply_masks(ob):
    """Shape keys block modifier_apply; the mixed result replaces them."""
    if ob.data.shape_keys:
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for mod in list(ob.modifiers):
        if mod.type == 'MASK':
            bpy.context.view_layer.objects.active = ob
            bpy.ops.object.modifier_apply(modifier=mod.name)


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
    try:
        body = HumanService.create_human()
        HumanService.set_character_skin(
            str(pack_path('skins') / 'middleage_caucasian_male' / 'middleage_caucasian_male.mhmat'),
            body, skin_type='MAKESKIN')
        rig = HumanService.add_builtin_rig(body, 'cmu_mb')
        # The low-poly eyes join without usable weights and their pale sphere
        # spread over the torso; the sockets read fine at game distance, so the
        # eyes stay unequipped until eyetrack is a real thing.
        equip(body, 'hair', 'short02', asset_type='hair',
              material_type='MAKESKIN')
        suit = equip(body, 'clothes', 'male_casualsuit02', asset_type='Clothes',
                     material_type='MAKESKIN')
        shoes = equip(body, 'clothes', 'shoes05', asset_type='Clothes',
                      material_type='MAKESKIN')
    except AssetMissing as exc:
        sys.exit(f'{exc} (download and install the system assets pack, '
                 'then re-run this script)')

    source = import_walk()
    bvh_action = bpy.data.actions.get(source.animation_data.action.name)
    start, cycle = gait_window(source)
    walk = bake_walk(source, rig, body, start, cycle)
    rest_frame = min(range(start, start + cycle),
                     key=lambda f: abs(foot_separation(source, f)))
    idle = bake_idle(rig, source, body, rest_frame)
    bpy.data.objects.remove(source, do_unlink=True)
    if bvh_action and bvh_action.users == 0:
        bpy.data.actions.remove(bvh_action)
    stash(rig, idle)
    rig.animation_data.action = walk

    parts = {'eyes': ObjectService.find_object_of_type_amongst_nearest_relatives(body, 'Eyes'),
             'hair': ObjectService.find_object_of_type_amongst_nearest_relatives(body, 'Hair'),
             'suit': suit, 'shoes': shoes}
    paint(body, parts)
    merge(body, parts)
    tris = decimate(body)
    body.data.materials.clear()
    body.data.materials.append(single_material())
    export(body, rig, out)
    print(f'M2.F2c person: {len(body.data.vertices)} verts, {tris} tris, '
          f'{len(rig.data.bones)} joints, walk frames {start}..{start + cycle}, '
          f'clips Walk+Idle, {out.stat().st_size / 1024:.1f} KB')


if __name__ == '__main__':
    main()
