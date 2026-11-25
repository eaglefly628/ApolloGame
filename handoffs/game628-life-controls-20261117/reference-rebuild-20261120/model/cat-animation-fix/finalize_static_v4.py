"""Fast deterministic world-mesh grouping from editable source; avoids repeated operator joins."""
import bpy,bmesh,json,math,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parents[2]/'public/art/reference-rebuild-20261120/scene'
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'reference-street-source-v4.blend'));bpy.context.view_layer.update()
assert abs(bpy.data.materials['fruitred'].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value[0]-.477)<.02,'source must be corrected sRGB v2'
obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];groups={}
for o in obs:
 z=o.name.split('.')[0];key=(z,tuple(m.name for m in o.data.materials));groups.setdefault(key,[]).append(o)
def bounds(objects):
 pts=[o.matrix_world@v.co for o in objects for v in o.data.vertices]
 return {'min':[min(p.x for p in pts),min(p.z for p in pts),min(-p.y for p in pts)],'max':[max(p.x for p in pts),max(p.z for p in pts),max(-p.y for p in pts)]} if pts else None
SHOPS=[('grocery',-8.25,4),('bakery',-4.35,3.8),('noodles',.9,3.5),('catcafe',4.55,3.8),('repair',8.35,3.8)]
furniture={}
for n,x,w in SHOPS:
 oo=[o for o in obs if o.name.startswith(n+'.')]
 furniture[n]={'counters':bounds([o for o in oo if ('counter' in o.name or 'case' in o.name or 'bench' in o.name) and ('.body' in o.name or '.top' in o.name)]),'backShelves':bounds([o for o in oo if ('.back.shelf' in o.name or '.right.shelf' in o.name)]),'staffClearancePoint':{'grocery':[-8.25,0,-.97],'bakery':[-4.35,0,-1.24],'noodles':[.75,0,-1.10],'catcafe':[4.4,0,-1.3],'repair':[8.9,0,-.5]}[n],'groundTopY':0}
merged=[];removed=0
for (z,mnames),group in groups.items():
 verts=[];faces=[];mis=[]
 for o in group:
  off=len(verts);verts.extend(tuple(o.matrix_world@v.co) for v in o.data.vertices);faces.extend(tuple(off+i for i in f.vertices) for f in o.data.polygons);mis.extend(f.material_index for f in o.data.polygons)
 me=bpy.data.meshes.new(z+'__'+'__'.join(mnames));me.from_pydata(verts,[],faces);me.update()
 for m in mnames:me.materials.append(bpy.data.materials[m])
 for p,ix in zip(me.polygons,mis):p.material_index=ix
 bm=bmesh.new();bm.from_mesh(me);bmesh.ops.triangulate(bm,faces=list(bm.faces));bad=[f for f in bm.faces if f.calc_area()<5e-11];removed+=len(bad)
 if bad:bmesh.ops.delete(bm,geom=bad,context='FACES')
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(me);bm.free();me.update()
 uv=me.uv_layers.new(name='UVMap')
 for poly in me.polygons:
  a=max(range(3),key=lambda k:abs(poly.normal[k]))
  for li in poly.loop_indices:
   p=me.vertices[me.loops[li].vertex_index].co;uv.data[li].uv=((p.y if a==0 else p.x)/2,(p.y if a==2 else p.z)/2)
 o=bpy.data.objects.new(me.name,me);bpy.context.scene.collection.objects.link(o);merged.append(o)
bpy.data.batch_remove(ids=obs);bpy.context.view_layer.update()
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'reference-street-final-v4.blend'))
bpy.ops.export_scene.gltf(filepath=str(OUT/'street-reference-v4.glb'),export_format='GLB',use_selection=True,export_yup=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_animations=False,export_cameras=False,export_lights=False)
j={'schema':'game628.reference.street.v4','units':'meters','axis':'Y up; +Z street-facing','model':'street-reference-v4.glb','bounds':bounds(merged),'floorTopY':0,'shopzones':[{'id':n,'center':[x,0,-1.4],'width':w,'interior':{'min':[x-w/2,0,-2.8],'max':[x+w/2,3,0]},'frontOpening':{'min':[x-w/2+.3,.1,0],'max':[x+w/2-.3,2.60,0]}} for n,x,w in SHOPS],'furnitureAndClearance':furniture,'alley':{'min':[-2.45,0,-9],'max':[-.85,3.1,0]},'street':{'min':[-10.25,0,0],'max':[10.25,0,5]},'residentialY':[3.1,6.6],'runtimeLightSuggestions':[{'id':n+'.interior','type':'spot','position':[x,2.30,-.74],'target':[x,.55,-.65],'distance':2.30,'angle':.58,'penumbra':.55,'castShadowRecommendation':n in ['bakery','noodles'],'note':'Cone radius remains below half shop width; no embedded actual lights'} for n,x,w in SHOPS if n!='grocery'],'materialColorSpace':'palette sRGB converted to linear; PNG albedo remains sRGB; normal maps non-color','embeddedLights':0,'triangles':sum(len(o.data.polygons) for o in merged),'meshes':len(merged),'sourceObjects':len(obs),'removedDegenerateTriangles':removed,'sha256':hashlib.sha256((OUT/'street-reference-v4.glb').read_bytes()).hexdigest(),'status':'complete_v2_producer_reimport_visual_review_pending','limitations':['No humans in static asset; animation task separate.','Runtime sun and 4 interior lights are parent scene responsibility.','Distant skyline separate optional GLB and must not cast shadow.','Not pixel-exact reproduction; source reference is an AI illustration.']}
(OUT/'scene-contract-v4.json').write_text(json.dumps(j,indent=2));(ROOT/'v4-export-contract.json').write_text(json.dumps(j,indent=2));print('FINAL_V4_READY',j['sha256'],j['triangles'],'removedDegenerate',removed,flush=True)

# Preserve completed v3 scene metadata while declaring the new explicit variation/animation interface.
contract_path=OUT/'scene-contract-v4.json';j=json.loads(contract_path.read_text());cats=json.loads((ROOT/'cat-entities-contract.json').read_text());variation=json.loads((ROOT/'variation-build-report.json').read_text());j['catEntities']=[{'id':c['id'],'asset':Path(c['file']).name,'position':c['root'],'rotation':c['rotation'],'scale':c['scale'],'clips':[{'name':c['clip'],'duration':c['duration'],'loop':True,'speed':1}],'driver':'AnimState3D','rootUnanimated':True,'pawSupportY':c['root'][1]} for c in cats];j['staticOriginalCatGroupsRemoved']=True;j['staticOriginalCatObjectsRemoved']=variation['static_cat_objects_removed'];j['staticOriginalCatTrianglesRemoved']=variation['static_cat_triangles_removed'];j['untargetedSourceObjectsVerifiedUnchanged']=variation['preserved_untargeted_objects'];j['variationPlan']='variation-plan-v4.json';j['variationSeed']=variation['seed'];j['status']='complete_v4_first_candidate_numeric_and_visual_review_pending';(OUT/'variation-plan-v4.json').write_text((ROOT/'variation-plan.json').read_text());contract_path.write_text(json.dumps(j,indent=2));(ROOT/'v4-export-contract.json').write_text(json.dumps(j,indent=2));print('V4_CONTRACT_CATS_VARIATION_READY',j['sha256'],flush=True)
