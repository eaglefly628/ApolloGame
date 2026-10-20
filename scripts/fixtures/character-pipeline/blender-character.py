"""Free, authored test fixture; this is NOT ARP, Mixamo, or Tripo validation.

Blender 4.5: blender --background --factory-startup --python THIS -- --out-dir DIR
Creates three standalone, skinned GLBs in metres, exported from Z-up to glTF Y-up.
"""
import argparse
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector


def build_character():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = 30
    scene.render.fps_base = 1.0
    scene.frame_start, scene.frame_end = 1, 31
    # name, parent, head, tail, prism half-width. All coordinates are metres.
    specs = [
        ("Hips", None, (0, 0, .92), (0, 0, 1.04), .13),
        ("Spine", "Hips", (0, 0, 1.04), (0, 0, 1.24), .14),
        ("Chest", "Spine", (0, 0, 1.24), (0, 0, 1.46), .18),
        ("Neck", "Chest", (0, 0, 1.46), (0, 0, 1.56), .055),
        ("Head", "Neck", (0, 0, 1.56), (0, 0, 1.79), .115),
        ("LeftUpperArm", "Chest", (.18, 0, 1.43), (.46, 0, 1.43), .065),
        ("LeftLowerArm", "LeftUpperArm", (.46, 0, 1.43), (.70, 0, 1.43), .05),
        ("LeftHand", "LeftLowerArm", (.70, 0, 1.43), (.83, 0, 1.43), .045),
        ("RightUpperArm", "Chest", (-.18, 0, 1.43), (-.46, 0, 1.43), .065),
        ("RightLowerArm", "RightUpperArm", (-.46, 0, 1.43), (-.70, 0, 1.43), .05),
        ("RightHand", "RightLowerArm", (-.70, 0, 1.43), (-.83, 0, 1.43), .045),
        ("LeftUpperLeg", "Hips", (.10, 0, .92), (.10, 0, .51), .075),
        ("LeftLowerLeg", "LeftUpperLeg", (.10, 0, .51), (.10, 0, .10), .06),
        ("LeftFoot", "LeftLowerLeg", (.10, 0, .10), (.10, -.19, .10), .055),
        ("RightUpperLeg", "Hips", (-.10, 0, .92), (-.10, 0, .51), .075),
        ("RightLowerLeg", "RightUpperLeg", (-.10, 0, .51), (-.10, 0, .10), .06),
        ("RightFoot", "RightLowerLeg", (-.10, 0, .10), (-.10, -.19, .10), .055),
    ]
    data = bpy.data.armatures.new("GenericHumanoid17")
    rig = bpy.data.objects.new("GenericHumanoid17", data)
    scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    rig.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    for name, parent, head, tail, _ in specs:
        bone = data.edit_bones.new(name)
        bone.head, bone.tail = head, tail
        if parent:
            bone.parent = data.edit_bones[parent]
        bone.use_connect = False
        bone.roll = 0
    bpy.ops.object.mode_set(mode="OBJECT")

    vertices, faces, groups = [], [], []
    # One mesh with 17 closed prisms; genuine JOINTS/WEIGHTS + inverse binds.
    for name, _, head, tail, width in specs:
        direction = (Vector(tail) - Vector(head)).normalized()
        side = direction.cross(Vector((0, 1, 0))).normalized() * width
        depth = direction.cross(side).normalized() * width
        start = len(vertices)
        for end in (Vector(head), Vector(tail)):
            for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                vertices.append(tuple(end + side * a + depth * b))
        faces.extend(tuple(start + i for i in face) for face in (
            (0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4),
            (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)))
        groups.append((name, list(range(start, start + 8))))
    mesh_data = bpy.data.meshes.new("GenericSkinnedPrisms")
    mesh_data.from_pydata(vertices, [], faces)
    mesh_data.update()
    mesh = bpy.data.objects.new("GenericSkinnedPrisms", mesh_data)
    scene.collection.objects.link(mesh)
    mesh.parent = rig
    for name, indices in groups:
        mesh.vertex_groups.new(name=name).add(indices, 1.0, "REPLACE")
    modifier = mesh.modifiers.new("HumanoidSkin", "ARMATURE")
    modifier.object = rig
    material = bpy.data.materials.new("FixtureBlue")
    material.diffuse_color = (.12, .38, .7, 1)
    mesh.data.materials.append(material)
    return rig


def animate(rig, clip):
    rig.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
    for frame in range(1, 32):
        t = (frame - 1) / 30
        wave = math.sin(2 * math.pi * t)
        for bone in rig.pose.bones:
            bone.location = (0, 0, 0)
            bone.rotation_euler = (0, 0, 0)
            bone.scale = (1, 1, 1)
        p = rig.pose.bones
        if clip == "idle":
            p["Chest"].rotation_euler.z = .10 * wave
            p["Head"].rotation_euler.y = .14 * wave
            p["LeftUpperArm"].rotation_euler.x = .12 * wave
        elif clip == "walk":
            p["LeftUpperLeg"].rotation_euler.x = .65 * wave
            p["RightUpperLeg"].rotation_euler.x = -.65 * wave
            p["LeftLowerLeg"].rotation_euler.x = .35 * max(0, -wave)
            p["RightLowerLeg"].rotation_euler.x = .35 * max(0, wave)
            p["LeftUpperArm"].rotation_euler.x = -.4 * wave
            p["RightUpperArm"].rotation_euler.x = .4 * wave
        elif clip == "reach":
            reach = math.sin(math.pi * t) ** 2
            p["LeftUpperArm"].rotation_euler.x = 1.0 * reach
            p["LeftUpperArm"].rotation_euler.z = -.6 * reach
            p["LeftLowerArm"].rotation_euler.z = -.8 * reach
            p["LeftHand"].rotation_euler.y = .5 * reach
            p["Chest"].rotation_euler.y = .2 * reach
        for bone in rig.pose.bones:
            for path in ("location", "rotation_euler", "scale"):
                bone.keyframe_insert(data_path=path, frame=frame, group=bone.name)
    action = rig.animation_data.action
    action.name = clip
    # No NLA tracks or additional actions can leak into the single-clip export.
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for curve in bag.fcurves:
                    for point in curve.keyframe_points:
                        point.interpolation = "LINEAR"
    bpy.context.scene.frame_set(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out-dir", required=True)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    output = Path(args.out_dir).resolve()
    output.mkdir(parents=True, exist_ok=True)
    rig = build_character()
    for clip in ("idle", "walk", "reach"):
        animate(rig, clip)
        bpy.ops.export_scene.gltf(
            filepath=str(output / (clip + ".glb")), export_format="GLB",
            export_yup=True, export_animations=True, export_animation_mode="ACTIONS",
            export_anim_single_armature=False, export_frame_range=True,
            export_anim_slide_to_zero=True,
            export_frame_step=1, export_force_sampling=True,
            export_optimize_animation_size=False, export_rest_position_armature=True,
            export_def_bones=True, export_leaf_bone=False, export_skins=True,
            export_morph=False, export_materials="EXPORT", export_extras=False,
        )
    (output / "fixture-source.json").write_text(json.dumps({
        "source": "generic-blender-fixture", "blenderVersion": bpy.app.version_string,
        "realArpValidated": False, "realMixamoValidated": False,
        "clips": ["idle", "walk", "reach"], "fps": 30, "sampleCount": 31,
        "sourceUp": "Z", "exportUp": "Y", "unit": "metre",
        "bones": list(rig.data.bones.keys()),
    }, indent=2) + "\n")


if __name__ == "__main__":
    main()
