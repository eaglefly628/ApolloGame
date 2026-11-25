import bpy,json,hashlib
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent.parent/'public/art/reference-rebuild-20261120/scene'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'street-reference-v3.glb'));bpy.context.view_layer.update()
def key(p):return tuple(int(round(float(v)*1e6)) for v in p)
positions={}
tri=0
for o in bpy.context.scene.objects:
 if o.type!='MESH':continue
 o.data.calc_loop_triangles();tri+=len(o.data.loop_triangles)
 for v in o.data.vertices:
  p=o.matrix_world@v.co;q=(p.x,p.z,-p.y);positions[key(q)]=q
rows=[]
for r in json.loads((ROOT/'cat-contact-v3-deltas.json').read_text()):
 expected={key((p[0],p[1]+r['uniform_delta_y'],p[2])) for p in r['paw_source_positions']};assert expected<=set(positions)
 low=min(positions[k][1] for k in expected);assert abs(low-r['target_paw_bottom_y'])<2e-7;rows.append({'group':r['group'],'actual_reimported_paw_min_y':low,'support_y':r['target_paw_bottom_y'],'absolute_error_m':abs(low-r['target_paw_bottom_y']),'unique_paw_positions_checked':len(expected)})
j={'sha256':hashlib.sha256((OUT/'street-reference-v3.glb').read_bytes()).hexdigest(),'blender_reimport_verified':True,'triangles':tri,'contacts':rows,'all_original_v2_index_normal_uv_material_streams_identical':'see v3-cat-contact-report.json'};(ROOT/'v3-reimport-report.json').write_text(json.dumps(j,indent=2));print('V3_REIMPORT_CONTACT_VERIFIED',j,flush=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=4;scene.cycles.max_bounces=4;scene.cycles.diffuse_bounces=2;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=800;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('neutral sky');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.75,.9,1);scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.55
bpy.ops.object.light_add(type='SUN',location=(-8,-12,15));l=bpy.context.object;l.rotation_euler=(Vector((0,0,2))-l.location).to_track_quat('-Z','Y').to_euler();l.data.energy=2.;l.data.angle=.08
bpy.ops.object.light_add(type='POINT',location=(4.55,.75,2.3));bpy.context.object.data.energy=55;bpy.context.object.data.color=(1,.72,.43)
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.9;cam.location=(4.9,-9,2.7);cam.rotation_euler=(Vector((4.55,-.2,1.22))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'street-reference-v3-cat-contact.png');bpy.ops.render.render(write_still=True);print('V3_CAT_VISUAL_READY',flush=True)
