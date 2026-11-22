"""Build the Game 628 seaside scene with Blender 5.2.

Run from the repository root: blender -b --python handoffs/game628-life-controls-20261117/build-seaside.py
"""
import json
from copy import deepcopy
from math import cos, pi, sin
from pathlib import Path
from random import Random

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parent
ART = ROOT / "public/art/seaside-v1"
RANDOM = Random(628)
STREET = json.loads((ROOT / "public/scenes/streets.json").read_text())
STREET_ENTITIES = STREET["manifest"]["entities"]

# Ocean and dune coordinates are authored with sea level at zero. In the
# game scene the promenade is at street level, and the beach lies below it.
PROMENADE_Z = 7.6
PROMENADE_Y = 1.58
PROMENADE_DEPTH = 3.2
JETTY_X = -5.0
bpy.ops.wm.read_factory_settings(use_empty=True)


def mix(a, b, t):
    return tuple(low + (high - low) * t for low, high in zip(a, b))


def clamp(value):
    return min(1., max(0., value))


def smooth(value):
    t = clamp(value)
    return t*t*(3 - 2*t)


def shore(x):
    return 1.9 * sin(x * .14) - 1.5 * cos(x * .067) + .35 * sin(x * .41)


def land_height(depth):
    return min(1.5, .17 * depth + .12 * smooth(depth / 5))


class Surface:
    def __init__(self):
        self.vertices = []
        self.colors = []
        self.faces = []

    def point(self, x, z, y, color):
        index = len(self.vertices)
        self.vertices.append((x, -z, y))
        self.colors.append(color)
        return index

    def grid(self, rows):
        for front, back in zip(rows, rows[1:]):
            for i in range(len(front) - 1):
                self.faces.append((front[i], back[i], back[i+1], front[i+1]))

    def box(self, x, z, bottom, width, depth, height, color):
        start = len(self.vertices)
        for y in (bottom, bottom + height):
            for dx, dz in [(-1, 1), (1, 1), (1, -1), (-1, -1)]:
                self.point(x + width * dx / 2, z + depth * dz / 2, y, color)
        for corners in [(3, 2, 1, 0), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5),
                        (2, 3, 7, 6), (3, 0, 4, 7)]:
            self.faces.append(tuple(start + i for i in corners))

    def object(self, name, roughness, specular=.32):
        mesh = bpy.data.meshes.new(name)
        mesh.from_pydata(self.vertices, [], self.faces)
        assert not mesh.validate()
        colors = mesh.color_attributes.new(name="Color", type="BYTE_COLOR", domain="POINT")
        mesh.color_attributes.active_color = colors
        for value, rgb in zip(colors.data, self.colors):
            value.color_srgb = (*map(clamp, rgb), 1)
        obj = bpy.data.objects.new(name, mesh)
        bpy.context.collection.objects.link(obj)
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        graph = material.node_tree
        attribute = graph.nodes.new("ShaderNodeVertexColor")
        attribute.layer_name = "Color"
        shader = graph.nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = roughness
        shader.inputs["Specular IOR Level"].default_value = specular
        graph.links.new(attribute.outputs["Color"], shader.inputs["Base Color"])
        mesh.materials.append(material)
        return obj


lateral = [-600, -100, -60, *range(-48, 49), 60, 100, 600]
beach = Surface()
rows = []
for depth in [-2, -.8, 0, .85, 2.5, 5, 8, 12, 20, 40]:
    row = []
    for x in lateral:
        d = depth + .16*sin(x*.61)*smooth(depth / 6)
        sand = mix((.63, .51, .38), (.93, .79, .58), smooth((d+.15)/3.4))
        grass = mix((.57, .62, .33), (.34, .52, .29), smooth((d-9)/10))
        color = mix(sand, grass, smooth((d-6.4 + 1.5 * sin(x*.15)) / 4))
        grain = .015 * sin(x*.91 + d*.75)
        row.append(beach.point(x, shore(x) + d, land_height(d), tuple(c + grain for c in color)))
    rows.append(row)
beach.grid(rows)

# The jetty is planted in the seabed. Posts meet the deck above high tide.
for i in range(33):
    z = shore(JETTY_X) + 5.25 - .31*i
    beach.box(JETTY_X, z, 1.0, 2.25, .298, .16, mix((.53, .33, .22), (.77, .55, .37), RANDOM.random()))
for depth in (5.25, 3.5, 1.5, -.5, -2.5, -4.55):
    z = shore(JETTY_X) + depth
    for x in (-5.9, -4.1):
        beach.box(x, z, -1.0, .24, .24, 2.52, (.53, .34, .23))
# The inner end of the jetty meets the promenade through a short ramp.
# Its top is continuous across both joins. The underground overlap is deliberate.
ramp_start = shore(JETTY_X) + 5.25 + .145
ramp_end = PROMENADE_Z - PROMENADE_DEPTH / 2 + .012
ramp = []
for z, y in [(ramp_start, 1.16), (ramp_end, PROMENADE_Y)]:
    ramp.append([beach.point(JETTY_X + side * 1.125, z, y, (.67, .47, .32)) for side in (-1, 1)])
beach.grid(ramp)
beach.object("Dunes and jetty", .91)

ocean = Surface()
rows = []
for depth in [1.6, .3, -.65, -1.5, -2.8, -4.2, -6.5, -10, -16, -27, -48, -88, -165, -320, -675]:
    row = []
    for x in lateral:
        shallow = mix((.49, .83, .75), (.10, .66, .69), smooth(-depth / 9))
        water = mix(shallow, (.075, .39, .59), smooth((-depth-5)/62))
        tone = .012 * sin(x*.22 + depth*.27) * smooth(-depth/4)
        row.append(ocean.point(x, shore(x) + depth, 0, tuple(c + tone for c in water)))
    rows.append(row)
# Reverse the offshore rows to keep their normals facing up.
ocean.grid(rows[::-1])
ocean.object("Shallows and open sea", .30, specular=.48)

# Three broken crests roll shoreward. Each ribbon grows and tapers before
# its cycle wraps. The first crest crosses from water onto the sloping sand.
patches = []
for layer, offset in enumerate((0., .3125, .625)):
    x = -40.
    while x < 40:
        length = RANDOM.uniform(3.3, 7.2)
        patches.append((layer, offset, x, length, RANDOM.uniform(0, 2*pi)))
        x += length + RANDOM.uniform(.25, 1.8)


def wave_pose(phase):
    foam = Surface()
    for layer, offset, start, length, shift in patches:
        p = (phase + offset) % 1
        gain = smooth((p-.07)/.15) * smooth((.93-p)/.15)
        rows = [[], []]
        for i in range(11):
            t = i / 10
            x = start + t * length
            depth = -7.2 + 7.58*p + .32*sin(x*.41 + shift) + .09*sin(x*1.15 + shift)
            width = (.15 + .12*sin(t*pi)) * sin(t*pi) * gain * (.74 if layer else 1)
            for edge, row in enumerate(rows):
                d = depth + (edge-.5) * width
                tint = (.60, .89, .85) if edge == 0 else (.88, .98, .91)
                row.append(foam.point(x, shore(x) + d, max(0, land_height(d)) + .018, tint))
        foam.grid(rows)
    return foam


waves = wave_pose(0).object("Rolling sea foam", .82)
waves.shape_key_add(name="Basis")
frames, stride = 16, 12
for step in range(1, frames):
    key = waves.shape_key_add(name=f"Crest {step:02}")
    for vertex, point in zip(key.data, wave_pose(step/frames).vertices):
        vertex.co = point
    for frame, value in [(1, 0), (1+(step-1)*stride, 0), (1+step*stride, 1), (1+(step+1)*stride, 0)]:
        key.value = value
        key.keyframe_insert(data_path="value", frame=frame)
animation = waves.data.shape_keys.animation_data
animation.action.name = "Seaside swell"
for channel in animation.action.layers[0].strips[0].channelbag(animation.action_slot).fcurves:
    for point in channel.keyframe_points:
        point.interpolation = "LINEAR"
bpy.context.scene.frame_start = 1
bpy.context.scene.frame_end = frames*stride+1
bpy.context.scene.frame_set(1)
bpy.ops.export_scene.gltf(filepath=str(ART / "coast.glb"), export_format="GLB",
                         export_yup=True, export_frame_range=True, export_morph_normal=False)

# Derive placements from the shipped K model bounds. The lowest root point is
# the local ground anchor, with a small hidden overlap on the sloping dunes.
assets = [{"kind": "model", "key": "seaside-coast", "src": "/art/seaside-v1/coast.glb"}]
player_model = STREET_ENTITIES["player"]["Model3D"]["modelKey"]
assets.append(next(asset for asset in STREET["assets"] if asset["key"] == player_model))
player = deepcopy(STREET_ENTITIES["player"])
camera_anchor = deepcopy(STREET_ENTITIES["camera-anchor"])
for entity in (player, camera_anchor):
    entity["Transform"]["x"] = JETTY_X
camera = deepcopy(STREET_ENTITIES["camera"]["Camera3D"])
camera.update(yaw=.03, pitch=.17, distance=15.5, fov=31, near=.45, far=2400)
promenade = deepcopy(STREET_ENTITIES["ground"])
promenade["Mesh3D"]["depth"] = PROMENADE_DEPTH

# Keep the curb on both sides of the jetty opening. Its height and tint
# match the street curb, so the path can continue beyond either frame edge.
def curb_between(left, right):
    curb = deepcopy(STREET_ENTITIES["curb"])
    curb["Transform3D"].update(x=(left + right) / 2, z=-1.45)
    curb["Mesh3D"]["width"] = right - left
    return curb
entities = {
    "coast": {"Transform3D": {"x": 0, "y": -PROMENADE_Y, "z": -PROMENADE_Z}, "Model3D": {"modelKey": "seaside-coast", "scale": 1},
              "AnimState3D": {"clip": "Seaside swell", "loop": True}},
    "camera": {"Camera3D": camera},
    "camera-anchor": camera_anchor,
    "player": player,
    "promenade": promenade,
    "curb-west": curb_between(-20, JETTY_X - 1.16),
    "curb-east": curb_between(JETTY_X + 1.16, 20),
    "sky": {"Sky3D": {"top": 0x55a9da, "bottom": 0xc6e7ed, "clouds": False, "env": .22}},
    "sun": {"Light3D": {"kind": "directional", "color": 0xffe0b5, "intensity": 2.1,
                       "dirX": .6, "dirY": -1, "dirZ": -.65, "castShadow": True}},
    "ambient": {"Light3D": {"kind": "ambient", "color": 0xcfe3fc, "intensity": .95}},
    "post": {"Post3D": {"aa": True}},
}
for variant, placements in [
    ("A", [(-11, 3.6, 3.2, -.7), (3.9, 3.4, 2.9, .6), (-18, 4.6, 3.9, 1.4)]),
    ("B", [(11, 3.1, 3.4, .7), (-8.8, 4.1, 2.9, -.45)]),
]:
    filename = f"tree_single_{variant}.glb"
    key = f"seaside-tree-{variant.lower()}"
    assets.append({"kind": "model", "key": key, "src": f"/art/seaside-v1/{filename}"})
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ART / filename))
    points = [obj.matrix_world @ Vector(corner) for obj in set(bpy.data.objects) - before
              if obj.type == "MESH" for corner in obj.bound_box]
    floor = min(p.z for p in points)
    height = max(p.z for p in points) - floor
    for i, (x, depth, target_height, turn) in enumerate(placements):
        scale = target_height / height
        entities[f"{key}-{i}"] = {
            "Transform3D": {"x": x, "y": land_height(depth) - floor*scale - .10 - PROMENADE_Y,
                            "z": shore(x) + depth - PROMENADE_Z, "rotY": turn},
            "Model3D": {"modelKey": key, "scale": scale},
        }

layout = {
    "id": "screen", "type": "Screen", "props": {"bg": "panel"},
    "layout": {"direction": "column", "padding": 0, "gap": 0},
    "children": [
        {"id": "header", "type": "Panel", "props": {}, "layout": {"direction": "row", "align": "center", "padding": 10, "gap": 12},
         "children": [
             {"id": "title", "type": "Label", "props": {"text": "Game 628 · 海滨", "size": 17}},
             {"id": "return-to-town", "type": "Button", "props": {"label": "回街坊", "action": "host.town", "kind": "quiet"}},
         ]},
        {"id": "scene-stage", "type": "Panel", "props": {"bare": True}, "layout": {"flex": 1}},
    ],
}
scene = {
    "assets": assets,
    "keys": {key: binding for key, binding in STREET["keys"].items() if "dx" in binding},
    "links": {"host.town": "streets"},
    "manifest": {"capabilities": ["t1-motion-apply", "t1-hierarchy-resolve", "t2-bounds-clamp"],
                 "entities": entities},
    "layout": layout,
}
(ROOT / "public/scenes/seaside.json").write_text(json.dumps(scene, ensure_ascii=False, indent=2)+"\n")
