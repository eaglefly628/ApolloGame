import bpy,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT.parent/'public/art/material-study-20261119'
names=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else ['housing-e-detail']
for name in names:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(PUBLIC/(name+'.glb')))
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True
 scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100
 scene.world=bpy.data.worlds.new('neutral world');scene.world.color=(.25,.25,.25)
 scene.view_settings.view_transform='AgX'
 bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,.09));floor=bpy.context.object
 floor.name='inspection floor only';mat=bpy.data.materials.new('neutral floor');mat.diffuse_color=(.38,.37,.34,1);floor.data.materials.append(mat)
 for loc,power,size in [((-2,-4,6),330,5),((4,1,4),160,4)]:
  bpy.ops.object.light_add(type='AREA',location=loc);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size;lamp.rotation_euler=(Vector((0,0,1.2))-lamp.location).to_track_quat('-Z','Y').to_euler()
 bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO'
 height=3.05 if 'catcafe' in name else 1.65 if ('bakery' in name or 'bikeshop' in name) else 2.35
 for suffix,loc,target,scale in [('front-oblique',(3,-7,3.6),(0,0,height/2),height*1.65),('material-close',(2.1,-6,2.7),(.25,-.55,height*.68),height*.88)]:
  cam.location=loc;cam.data.ortho_scale=scale;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/(name+'-'+suffix+'.png'));bpy.ops.render.render(write_still=True)
 print('VISUAL_CHECK_RENDERED',name,flush=True)
