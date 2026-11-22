import bpy,bmesh,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parents[2]/'public/art/reference-rebuild-20261120/scene'
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(OUT/'street-reference-v4.glb'));static=[o for o in scene.objects if o.type=='MESH'];rows=[]
for o in static:
 me=o.data;me.calc_loop_triangles();bm=bmesh.new();bm.from_mesh(me);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);boundary=sum(e.is_boundary for e in bm.edges);bm.free();deg=sum((me.vertices[f.vertices[1]].co-me.vertices[f.vertices[0]].co).cross(me.vertices[f.vertices[2]].co-me.vertices[f.vertices[0]].co).length<1e-10 for f in me.loop_triangles);rows.append({'name':o.name,'triangles':len(me.loop_triangles),'boundary_after_analysis_1um_weld':boundary,'degenerate':deg})
assert not any('catcafe__cat' in o.name for o in static)
assert sum(r['boundary_after_analysis_1um_weld'] for r in rows)==0 and sum(r['degenerate'] for r in rows)==0
geo={'sha256':hashlib.sha256((OUT/'street-reference-v4.glb').read_bytes()).hexdigest(),'actual_glb_reimported':True,'rows':rows,'original_static_cat_mesh_groups_absent':True,'note':'Independent closed-part joins may be nonmanifold after analysis weld; not claiming a watertight Boolean scene union.'};(ROOT/'static-v4-reimport-report.json').write_text(json.dumps(geo,indent=2));print('STATIC_V4_GEOMETRY_VERIFIED',sum(r['triangles'] for r in rows),flush=True)
contracts=json.loads((ROOT/'cat-entities-contract.json').read_text());catobjects={}
for c in contracts:
 before=set(scene.objects);bpy.ops.import_scene.gltf(filepath=str(OUT/(c['id']+'.glb')));new=[o for o in scene.objects if o not in before];root=next(o for o in new if o.name.startswith(c['id']) and o.name.endswith('_Root'));root.location=(c['root'][0],-c['root'][2],c['root'][1]);catobjects[c['id']]=new
scene.frame_set(0);bpy.context.view_layer.update()
def points(o):return [tuple(o.matrix_world@v.co) for v in o.data.vertices]
base={o.name:points(o) for oo in catobjects.values() for o in oo if o.type=='MESH'}
scene.frame_set(41);bpy.context.view_layer.update();animation=[]
for c in contracts:
 paws=[o for o in catobjects[c['id']] if '_mesh_paw' in o.name];allmesh=[o for o in catobjects[c['id']] if o.type=='MESH'];pawdelta=max((Vector(p)-Vector(q)).length for o in paws for p,q in zip(points(o),base[o.name]));motion=max((Vector(p)-Vector(q)).length for o in allmesh for p,q in zip(points(o),base[o.name]));assert pawdelta<1e-6 and motion>.001,(c['id'],'imported animation inactive',motion)
 low=min(p[2] for o in paws for p in points(o));assert abs(low-c['root'][1])<3e-7;animation.append({'id':c['id'],'actual_blender_imported_clip_frame0_to41_mesh_delta_m':motion,'paw_delta_m':pawdelta,'actual_paw_min_y':low,'expected_support_y':c['root'][1]})
(ROOT/'cats-blender-playback-report.json').write_text(json.dumps(animation,indent=2));print('BLENDER_CAT_ANIMATION_PLAYBACK_VERIFIED',animation,flush=True)
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=4;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=2;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.world=bpy.data.worlds.new('neutral sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.75,.9,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.7
bpy.ops.object.light_add(type='SUN',location=(-8,-12,15));l=bpy.context.object;l.rotation_euler=(Vector((0,0,2))-l.location).to_track_quat('-Z','Y').to_euler();l.data.energy=2;l.data.angle=.08
bpy.ops.object.light_add(type='AREA',location=(0,-6,6));l=bpy.context.object;l.data.energy=250;l.data.shape='RECTANGLE';l.data.size=18;l.data.size_y=4;l.rotation_euler=(Vector((0,0,4.5))-l.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='POINT',location=(4.55,.75,2.3));bpy.context.object.data.energy=70;bpy.context.object.data.color=(1,.75,.45)
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO'
scene.render.resolution_x=1600;scene.render.resolution_y=520;scene.render.resolution_percentage=100;cam.data.ortho_scale=22.8;cam.location=(.1,-20,6.4);cam.rotation_euler=(Vector((0,0,5.65))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'v4-domestic-variation-strip.png');bpy.ops.render.render(write_still=True)
scene.render.resolution_x=800;scene.render.resolution_y=650;cam.data.ortho_scale=3.9;cam.location=(4.9,-9,2.7);cam.rotation_euler=(Vector((4.55,-.2,1.22))-cam.location).to_track_quat('-Z','Y').to_euler()
for frame in [0,72]:
 scene.frame_set(frame);scene.render.filepath=str(ROOT/('v4-cat-idle-frame'+str(frame)+'.png'));bpy.ops.render.render(write_still=True)
print('V4_VISUALS_READY',flush=True)
