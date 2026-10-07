#!/usr/bin/env python3
# M2.F2c: the player person, dressed. MPFB builds a realistic human and its
# cmu_mb rig from the installed MakeHuman system asset pack (makehuman_system_
# assets_cc0, CC0): skin material, low-poly eyes, short hair, a casual suit and
# shoes, all fitted and weight-copied onto the body. The CMU mocap walk vendored
# at tools/models/mocap/cmu-08_01-walk.bvh has its joints copied pose-for-pose
# onto the rig for one full gait cycle, grounded every frame; M2.F2d: a second
# `Idle` clip is the mean of that cycle — arms hanging where the swing centres
# them, the walk's own slight elbow bend, both legs under the hips — keyed twice
# so a still frame is a relaxed stand and not a cadence frozen mid-step. M2.F2e:
# that mean is only a stand from the waist up. A knee only flexes, so the
# cycle's mean is a permanent crouch, its mean ankle is plantarflexed (heels
# up), and the CMU finger joints fan the hand open. The Idle's hips, legs,
# feet and fingers are the rig's own rest stance instead — straight knees,
# level pelvis, ankles a stance apart, soles flat, fingers together — with the
# walk's hanging arms kept from M2.F2d. All parts are merged, decimated under
# the tri budget, vertex-coloured and exported to PERSON_OUT (default
# public/assets/models/person.glb): one skinned mesh, one material, `Walk` +
# `Idle`.
import math
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
# M2.F2e: the walk's swing averages to a stand only from the shoulders down.
# These bones take the rig's rest stance in Idle instead of the walk mean:
# pelvis level, torso upright, knees straight, feet flat, fingers together.
# The hips go back to rest too — the mean pelvis leans, and the mean spine
# only cancelled that lean; reset both and the body stands straight.
STAND_REST = ('Hips', 'LowerBack', 'Spine', 'Spine1', 'Neck', 'Neck1', 'Head',
              'LHipJoint', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
              'RHipJoint', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase',
              'LeftFingerBase', 'LeftHandFinger1', 'LThumb',
              'RightFingerBase', 'RightHandFinger1', 'RThumb')
# M2.F2d's hanging arms are a world pose, not a local one: under the rest
# torso the mean locals would swing them back with the chest. These keep the
# world orientation the mean gave them.
ARM_CHAIN = ('LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
             'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand')
# The rest stance leaves the ankles 0.36 m apart — a T-pose, not a stand. Lean
# each leg inward about the world forward (Y) axis until the ankles land in the
# 0.2-0.3 m range a relaxed stand wants. The foot is counter-rolled by the same
# angle, so the sole stays level instead of rolling onto its outer edge.
LEG_ADDUCT_DEG = 3.4
# Both sole ends this low above the ground count as flat, in metres.
SOLE_TOLERANCE = 0.03


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
from mathutils import Matrix, Vector  # noqa: E402

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


def dressed_low(objs):
    """Lowest world z of every dressed part in the current pose. The bare body
    stops at its own sole; the fitted shoes hang past it once the feet are
    posed, so grounding on the body alone left the dressed figure ankle-deep
    in the pavement."""
    deps = bpy.context.evaluated_depsgraph_get()
    low = None
    for ob in objs:
        mesh = ob.evaluated_get(deps).to_mesh()
        z = min((ob.matrix_world @ v.co).z for v in mesh.vertices)
        ob.evaluated_get(deps).to_mesh_clear()
        low = z if low is None else min(low, z)
    return low


def ground(rig, objs):
    """Put the lowest point of the posed, dressed figure on z = 0: soles on
    the pavement."""
    low = dressed_low(objs)
    hips = rig.pose.bones['Hips']
    rest = hips.bone.matrix_local.to_3x3()
    hips.location = hips.location + rest.inverted() @ Vector((0.0, 0.0, -low))
    bpy.context.view_layer.update()


def lean_bone(rig, name, degrees):
    """Rotate a posed bone about the world forward (Y) axis without moving its
    head: the whole leg below the hip leans, the knee stays straight."""
    pb = rig.pose.bones[name]
    rot = Matrix.Rotation(math.radians(degrees), 3, Vector((0.0, 1.0, 0.0)))
    m = pb.matrix.copy()
    leaned = (rot @ m.to_3x3()).to_4x4()
    leaned.translation = m.to_translation()
    pb.matrix = leaned
    bpy.context.view_layer.update()


def rest_stand(rig, objs):
    """M2.F2e: the Idle's lower body. The walk mean crouches (knees only
    flex), rolls the pelvis and points the toes; the rig's own rest stance is
    the relaxed stand, so those bones go back to it, the ankles lean to a
    stance width, and the dressed figure is grounded on flat soles."""
    for name in STAND_REST:
        pb = rig.pose.bones[name]
        # LeftHandFinger1 and RightHandFinger1 are not in the CMU skeleton, so
        # retarget never set their mode; force it or the quaternion keys are
        # written but not evaluated.
        pb.rotation_mode = 'QUATERNION'
        pb.rotation_quaternion = (1.0, 0.0, 0.0, 0.0)
    rig.pose.bones['Hips'].location = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    # Left is +x (the rig faces -y): a positive lean about +y carries the left
    # ankle toward the centre line, and the mirrored negative does the right.
    for side, sign in (('Left', 1.0), ('Right', -1.0)):
        lean_bone(rig, f'{side}UpLeg', sign * LEG_ADDUCT_DEG)
        lean_bone(rig, f'{side}Foot', -sign * LEG_ADDUCT_DEG)
    ground(rig, objs)


def aim_bone(rig, name, direction):
    """Swing a posed bone's axis to `direction` (armature space) about its
    head; the roll follows the shortest arc."""
    pb = rig.pose.bones[name]
    current = (pb.matrix.to_3x3() @ Vector((0.0, 1.0, 0.0))).normalized()
    swing = current.rotation_difference(direction.normalized()).to_matrix()
    m = pb.matrix.copy()
    aimed = (swing @ m.to_3x3()).to_4x4()
    aimed.translation = m.to_translation()
    pb.matrix = aimed
    bpy.context.view_layer.update()


def finger_local_normal(rig, body, side):
    """The fan plane's normal in the finger bone's rest frame, measured from
    the bind mesh itself: the fingers are a flat, wide set, so the thinnest
    principal axis of their vertices is the palm normal."""
    import numpy as np
    wanted = {f'{side}FingerBase', f'{side}HandFinger1'}
    ids = [g.index for g in body.vertex_groups if g.name in wanted]
    pts = [rig.matrix_world.inverted() @ body.matrix_world @ v.co
           for v in body.data.vertices
           if sum(g.weight for g in v.groups if g.group in ids) > 0.5]
    if len(pts) < 8:
        return None
    arr = np.array([[p.x, p.y, p.z] for p in pts])
    _, vecs = np.linalg.eigh(np.cov((arr - arr.mean(axis=0)).T))
    normal = Vector(vecs[:, 0])
    fb = rig.data.bones[f'{side}FingerBase']
    return (fb.matrix_local.to_3x3().inverted() @ normal).normalized()


def relax_hands(rig, body):
    """M2.F2e: the bind hand fans its fingers open, and the CMU rig's one bone
    per finger set cannot close the fan. Hang the fingers down with the fan
    edge-on to the street and the palm to the thigh — a loose hand with the
    fingers together — then curl the tips and rest the thumb along the index."""
    down = Vector((0.0, 0.0, -1.0))
    for side, medial, curl in (('Left', -1.0, 1.0), ('Right', 1.0, -1.0)):
        n_local = finger_local_normal(rig, body, side)
        if n_local is None:
            continue
        base = rig.pose.bones[f'{side}FingerBase']
        to_body = Vector((medial, 0.0, 0.0))
        u1 = Vector((0.0, 1.0, 0.0))
        u2 = (n_local - u1 * u1.dot(n_local)).normalized()
        u3 = u1.cross(u2)
        wanted = Matrix((down, to_body, down.cross(to_body))).transposed()
        local = Matrix((u1, u2, u3)).transposed()
        m = (wanted @ local.transposed()).to_4x4()
        m.translation = base.matrix.to_translation()
        base.matrix = m
        bpy.context.view_layer.update()
        lean_bone(rig, f'{side}HandFinger1', 16.0 * curl)
        thumb = 'LThumb' if side == 'Left' else 'RThumb'
        aim_bone(rig, thumb, Vector((medial * 0.18, -0.38, -0.91)))


def hang_arms(rig, objs, hang):
    """Re-apply the mean pose's shoulder-to-hand world orientations over the
    rest torso, so the arms hang exactly as M2.F2d shipped them while the
    chest stands straight. The fingers stay at rest under the posed hands:
    together, not fanned by the CMU finger joints."""
    for name in ARM_CHAIN:
        pb = rig.pose.bones[name]
        hung = hang[name].to_4x4()
        hung.translation = (pb.matrix.to_translation())
        pb.matrix = hung
        bpy.context.view_layer.update()
    ground(rig, objs)


def report_stand(rig, shoes):
    """Print the Idle stance the task is judged on: ankle separation in
    0.2-0.3 m, both sole ends within SOLE_TOLERANCE of the ground."""
    left = rig.matrix_world @ rig.pose.bones['LeftFoot'].head
    right = rig.matrix_world @ rig.pose.bones['RightFoot'].head
    print(f'  [idle] ankle separation {abs(left.x - right.x):.3f} m')
    deps = bpy.context.evaluated_depsgraph_get()
    mesh = shoes.evaluated_get(deps).to_mesh()
    pts = [shoes.matrix_world @ v.co for v in mesh.vertices]
    shoes.evaluated_get(deps).to_mesh_clear()
    for label, sign in (('left', 1.0 if left.x > right.x else -1.0),
                        ('right', -1.0 if left.x > right.x else 1.0)):
        foot = [p for p in pts if p.x * sign > 0.0]
        if not foot:
            continue
        lo = min(p.y for p in foot)
        span = max(p.y for p in foot) - lo
        heel = min(p.z for p in foot if p.y > lo + span * 0.66)
        toe = min(p.z for p in foot if p.y < lo + span * 0.33)
        flat = 'flat' if max(heel, toe) <= SOLE_TOLERANCE else 'RAISED'
        print(f'  [idle] {label} sole heel {heel:+.3f} m, toe {toe:+.3f} m — {flat}')


def key_pose(rig, frame):
    bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
    for pb in rig.pose.bones:
        pb.keyframe_insert(data_path='rotation_quaternion', frame=frame)
    rig.pose.bones['Hips'].keyframe_insert(data_path='location', frame=frame)


def bake_walk(source, rig, objs, start, cycle):
    for frame in range(start, start + cycle + 1):
        retarget(source, rig, frame)
        ground(rig, objs)
        key_pose(rig, frame)
    action = rig.animation_data.action
    action.name = 'Walk'
    return action


def mean_walk_pose(source, rig, objs, start, cycle):
    """The stand the walk itself implies: each joint's mean orientation over
    one gait cycle, hips averaged too. The swing's centre leaves the arms
    hanging by the sides with the walk's own slight elbow bend, and both legs
    average under the hips, so the weight rests on both feet. A held walk frame
    keeps one foot mid-step whatever frame is picked; the mean has no step in
    it."""
    quats = {pb.name: [] for pb in rig.pose.bones}
    hips = Vector((0.0, 0.0, 0.0))
    for frame in range(start, start + cycle):
        retarget(source, rig, frame)
        ground(rig, objs)
        for pb in rig.pose.bones:
            q = pb.rotation_quaternion.copy()
            # Quaternions are a double cover: average one hemisphere or the
            # sum of two mirrored samples cancels to zero.
            if quats[pb.name] and q.dot(quats[pb.name][0]) < 0.0:
                q.negate()
            quats[pb.name].append(q)
        hips = hips + rig.pose.bones['Hips'].location
    for pb in rig.pose.bones:
        avg = quats[pb.name][0]
        for q in quats[pb.name][1:]:
            avg = avg + q
        pb.rotation_quaternion = avg.normalized()
    rig.pose.bones['Hips'].location = hips / cycle
    # ground() reads the evaluated mesh; without this the depsgraph still holds
    # the last sampled walk frame, and the correction grounds the wrong pose.
    bpy.context.view_layer.update()
    ground(rig, objs)


def bake_idle(rig, source, objs, start, cycle):
    """A new action, not the still-active walk: the mean stand keyed at two
    identical frames — a held pose that loops cleanly, so standing still reads
    as standing, not as a walk frozen mid-cadence. The mean hangs the arms;
    rest_stand puts the hips, legs, feet and fingers back to a stand (M2.F2e)."""
    idle = bpy.data.actions.new('Idle')
    bpy.context.view_layer.objects.active = rig
    rig.animation_data.action = idle
    mean_walk_pose(source, rig, objs, start, cycle)
    hang = {name: rig.pose.bones[name].matrix.to_3x3().copy() for name in ARM_CHAIN}
    body = objs[0]
    rest_stand(rig, objs)
    hang_arms(rig, objs, hang)
    relax_hands(rig, body)
    key_pose(rig, 1)
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
        hair = equip(body, 'hair', 'short02', asset_type='hair',
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
    dress = (body, hair, suit, shoes)
    walk = bake_walk(source, rig, dress, start, cycle)
    idle = bake_idle(rig, source, dress, start, cycle)
    report_stand(rig, shoes)
    bpy.data.objects.remove(source, do_unlink=True)
    if bvh_action and bvh_action.users == 0:
        bpy.data.actions.remove(bvh_action)
    stash(rig, idle)
    rig.animation_data.action = walk

    parts = {'eyes': ObjectService.find_object_of_type_amongst_nearest_relatives(body, 'Eyes'),
             'hair': hair, 'suit': suit, 'shoes': shoes}
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
