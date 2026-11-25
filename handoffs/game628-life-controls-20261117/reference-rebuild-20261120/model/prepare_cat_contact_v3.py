import bpy,json
from pathlib import Path
ROOT=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'reference-street-source-v2.blend'));bpy.context.view_layer.update();records=[]
for name,target in [('cat.sleep',.615),('cat.top',1.785),('cat.bottom',0)]:
 obs=[o for o in bpy.context.scene.objects if o.name.startswith('catcafe.'+name+'.')]
 paws=[o for o in obs if '.paw' in o.name]
 low=min((o.matrix_world@v.co).z for o in paws for v in o.data.vertices);shift=target-low
 positions=[]
 for o in obs:
  for v in o.data.vertices:
   p=o.matrix_world@v.co;positions.append([p.x,p.z,-p.y])
 records.append({'group':name,'target_paw_bottom_y':target,'source_actual_paw_bottom_y':low,'uniform_delta_y':shift,'source_objects':len(obs),'source_world_vertex_positions':positions,'paw_source_positions':[[p.x,p.z,-p.y] for o in paws for v in o.data.vertices for p in [o.matrix_world@v.co]]})
 for o in obs:o.location.z+=shift
bpy.context.view_layer.update();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'reference-street-source-v3.blend'))
(ROOT/'cat-contact-v3-deltas.json').write_text(json.dumps(records,indent=2));print('CAT_DELTAS_READY',[(r['group'],r['uniform_delta_y']) for r in records],flush=True)
