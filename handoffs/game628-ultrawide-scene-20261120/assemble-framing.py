"""Author render-only end scenery from the shipped street manifests."""
import json
from pathlib import Path

scenes = Path(__file__).resolve().parent / "public/scenes"

def box(entities, name, xyz, dimensions, color):
    x, y, z = xyz
    w, h, d = dimensions
    entities["uw-" + name] = {
        "Transform3D": {"x": x, "y": y, "z": z},
        "Mesh3D": {"shape": "box", "width": w, "height": h, "depth": d, "frontTint": color},
        "Material3D": {"color": color, "roughness": .92},
    }

for name in ("reference-street", "reference-walk", "crowd-street", "reference-lighting"):
    path = scenes / (name + ".json")
    scene = json.loads(path.read_text())
    entities = scene["manifest"]["entities"]
    scene["wideStreetFrame"] = {
        "minimumAspect": 1.7, "centerX": 0, "centerY": 3.2, "centerZ": 1.6,
        "halfWidth": 10.7, "minimumHalfHeight": 4.05, "distance": 23, "pitch": .135,
    }
    for side, sign, plaster in (("west", -1, 0xab937d), ("east", 1, 0xb3997e)):
        box(entities, side + "-walkway", (sign * 15.075, -.095, 2.14), (9.65, .16, 5.46), 0xbfb09a)
        box(entities, side + "-curb", (sign * 15.075, -.106, 4.88), (9.65, .15, .18), 0xb4a38c)
        for i in range(9):
            x = sign * (10.25 + (i + .5) * 1.07)
            box(entities, f"{side}-seam-{i}", (x, -.012, 2.14), (.018, .004, 5.42), 0xa69987)
        box(entities, side + "-corner-terrace", (sign * 15.07, 3.42, -2.63), (9.63, 6.84, 4.3), plaster)
        box(entities, side + "-parapet", (sign * 15.07, 6.91, -2.63), (9.75, .27, 4.45), 0xd6bea0)
        box(entities, side + "-storefront-base", (sign * 15.07, .27, -.42), (9.62, .54, .19), 0x746a5e)
        box(entities, side + "-floor-band", (sign * 15.07, 3.24, -.40), (9.62, .18, .26), 0xd3b796)
        for i in range(3):
            x = sign * (11.66 + i * 2.45)
            for floor, y in enumerate((1.92, 4.84)):
                key = f"{side}-window-{i}-{floor}"
                box(entities, key + "-frame", (x, y, -.43), (1.6, 1.72, .18), 0x514943)
                box(entities, key + "-glass", (x, y, -.328), (1.42, 1.52, .035), 0x657875)
                box(entities, key + "-mullion", (x, y, -.303), (.055, 1.52, .025), 0x514943)
                box(entities, key + "-sill", (x, y - .85, -.335), (1.77, .09, .27), 0xbba48b)
    box(entities, "rear-ground", (0, -.36, -12), (58, .22, 25), 0x8b877a)
    path.write_text(json.dumps(scene, ensure_ascii=False, indent=2) + "\n")
