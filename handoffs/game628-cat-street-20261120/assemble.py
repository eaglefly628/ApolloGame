from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
DEST = HERE / "site/scenes"
SOURCE = HERE.parent / "game628-activity-ik-20261120/site/scenes"
ART = "/art/reference-rebuild-20261120/scene/"
FLOOR_X, FLOOR_Z, STEP = 4.84, .52, .065
for name in ("crowd-street", "reference-street", "reference-walk", "crowd-navigation"):
    path = DEST / f"{name}.json"
    scene = json.loads((SOURCE / path.name).read_text())
    entities = scene["manifest"]["entities"]
    for cat in ("sleep", "ginger", "floor"):
        entity = entities[f"cat-{cat}-idle"]
        key = entity["Model3D"]["modelKey"]
        asset = next(item for item in scene["assets"] if item["key"] == key)
        asset["src"] = f"{ART}cat-{cat}-cafe-visible.glb"
        entity["AnimState3D"]["clip"] = "cat_cafe_route" if cat == "floor" else "cat_readable_idle"
    entities["cat-floor-idle"]["Transform3D"].update(x=FLOOR_X, y=0, z=FLOOR_Z)
    entities["cat-sleep-idle"]["Transform3D"].update(x=4.86, z=-.10, rotY=.055)
    entities["cat-ginger-idle"]["Transform3D"].update(x=5.48, y=1.195, z=-.08, rotY=-.13)
    entities["cat-cafe-low-platform"] = {
        "Transform3D": {"x": FLOOR_X+.40, "y": STEP/2, "z": FLOOR_Z},
        "Mesh3D": {"shape":"box", "width":.8, "height":STEP, "depth":.54, "frontTint":0x987c5c},
        "Material3D": {"color":0x987c5c, "roughness":.91},
    }
    lamp = entities["lamp-catcafe"]["Light3D"]
    lamp.update(x=4.93, y=2.42, z=.32, dirX=0, dirY=-1.75, dirZ=.02, range=3.1, angle=.69)
    for preset, new_intensity in [("env.day",12),("env.evening",24),("env.night",33)]:
        patch = next(item for item in scene["environment"]["presets"][preset]["patches"] if item["entity"]=="lamp-catcafe")
        patch["values"]["intensity"] = new_intensity
    path.write_text(json.dumps(scene, indent=2, ensure_ascii=False) + "\n")
