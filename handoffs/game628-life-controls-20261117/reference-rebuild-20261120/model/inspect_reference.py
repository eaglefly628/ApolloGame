import bpy,bmesh,json,sys,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent.parent/'public/art/reference-rebuild-20261120/scene'
name=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'street-reference'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
scene=bpy.context.scene
report={'file':str(OUT/(name+'.glb')),'sha256':hashlib.sha256((OUT/(name+'.glb')).read_bytes()).hexdigest(),'meshes':[],'geometry_review':'actual final GLB reimport, analysis-only weld 1um','user_art_acceptance':'pending'}
for o in list(scene.objects):
 if o.type!='MESH':continue
 me=o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh();me.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);boundary=sum(e.is_boundary for e in bm.edges);nonmanifold=sum(not e.is_manifold for e in bm.edges);bm.free()
 degenerate=0
 for tri in me.loop_triangles:
  p=[o.matrix_world@me.vertices[i].co for i in tri.vertices]
  if (p[1]-p[0]).cross(p[2]-p[0]).length<1e-10:degenerate+=1
 report['meshes'].append({'name':o.name,'triangles':len(me.loop_triangles),'boundary_edges_after_analysis_weld':boundary,'nonmanifold_edges':nonmanifold,'degenerate_triangles':degenerate})
 o.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh_clear()
(ROOT/(name+'-geometry-report.json')).write_text(json.dumps(report,indent=2));print('GEOMETRY_READY',flush=True)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=4;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=2;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.use_denoising=True
scene.render.resolution_x=1000;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('inspection neutral world');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.55,.65,.8,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.45
bpy.ops.object.light_add(type='SUN',location=(-8,-12,15));sun=bpy.context.object;sun.rotation_euler=(Vector((0,0,2))-sun.location).to_track_quat('-Z','Y').to_euler();sun.data.energy=2.;sun.data.angle=.08;sun.data.color=(1,.9,.74)
for x in [-4.35,.9,4.55,8.35]:
 bpy.ops.object.light_add(type='SPOT',location=(x,.74,2.3));l=bpy.context.object;l.data.energy=90;l.data.color=(1,.71,.39);l.data.spot_size=1.16;l.data.spot_blend=.55;l.rotation_euler=(Vector((x,.65,.55))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=23.4
cam.location=(.1,-23,5.2);cam.rotation_euler=(Vector((0,0,3.55))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/(name+'-overview.png'));bpy.ops.render.render(write_still=True)
for title,x in [('fruit',-8.25),('bread',-4.35),('noodle',.9),('cats',4.55),('repair',8.35)]:
 cam.data.ortho_scale=4.8;cam.location=(x+.5,-9,3.2);cam.rotation_euler=(Vector((x,-.5,1.45))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/(name+'-'+title+'-close.png'));bpy.ops.render.render(write_still=True)
cam.data.ortho_scale=7.;cam.location=(-3,-8,5.7);cam.rotation_euler=(Vector((-4.35,0,4.8))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/(name+'-balcony-close.png'));bpy.ops.render.render(write_still=True)
print('REFERENCE_INSPECTION_COMPLETE',flush=True)
