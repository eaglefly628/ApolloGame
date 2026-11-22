import bpy
from pathlib import Path
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'neighborhood-modules.blend'))
for o in bpy.data.objects:
 if o.name.startswith(('balcony.front_bar.','balcony.side_bar.')):
  o.location.z=.56;o.dimensions.z=.89
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.collections['balcony'].objects:o.select_set(True)
bpy.context.view_layer.objects.active=next(iter(bpy.data.collections['balcony'].objects))
bpy.ops.export_scene.gltf(filepath=str(ROOT.parent.parent/'public/art/neighborhood-v1/custom/balcony.glb'),export_format='GLB',use_selection=True,export_yup=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_animations=False)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'neighborhood-modules.blend'))
print('BALCONY_REPAIRED')
