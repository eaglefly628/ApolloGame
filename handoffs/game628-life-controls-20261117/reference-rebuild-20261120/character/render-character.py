import bpy,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
for role in ['traveler','shopkeeper']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(ROOT/(role+'-pose.glb')))
 for o in bpy.data.objects:
  if o.type=='MESH':
   for mat in o.data.materials:
    if mat.use_nodes:
     for n in mat.node_tree.nodes:
      if n.type=='BSDF_PRINCIPLED': n.inputs['Roughness'].default_value=.85
 bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.012));p=bpy.context.object
 mat=bpy.data.materials.new('neutral_floor');mat.diffuse_color=(.61,.65,.60,1);p.data.materials.append(mat)
 world=bpy.data.worlds.new('World');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.58,.67,.76,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;bpy.context.scene.world=world
 bpy.ops.object.light_add(type='AREA',location=(-3,-4,6));bpy.context.object.data.energy=550;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=3
 bpy.ops.object.camera_add(location=(3.0,-5.0,2.7));cam=bpy.context.object;target=Vector((0,0,.88));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=2.35;bpy.context.scene.camera=cam
 sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.cycles.device='CPU';sc.render.resolution_x=720;sc.render.resolution_y=880;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.render.filepath=str(ROOT/(role+'-front.png'));sc.view_settings.view_transform='AgX';bpy.ops.render.render(write_still=True)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/(role+'-visual.blend')))
