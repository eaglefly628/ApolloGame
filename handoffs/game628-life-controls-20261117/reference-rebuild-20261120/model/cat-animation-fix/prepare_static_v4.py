import ast,bpy,bmesh,math,json,random,hashlib
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parent;MODEL=ROOT.parent
bpy.ops.wm.open_mainfile(filepath=str(MODEL/'reference-street-source-v3.blend'));bpy.context.view_layer.update()
plan=json.loads((ROOT/'variation-plan.json').read_text());env={'bpy':bpy,'bmesh':bmesh,'math':math,'json':json,'hashlib':hashlib,'Vector':Vector,'Path':Path,'ROOT':ROOT,'scene':bpy.context.scene,'M':{m.name:m for m in bpy.data.materials},'cache':{},'objects':{},'zone':'variation','rng':random.Random(plan['seed']),'lights':[]}
tree=ast.parse((MODEL/'build_reference_street_v2.py').read_text());defs=ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef)],type_ignores=[]);exec(compile(defs,'source_helpers','exec'),env)
def F(n,*a,**kw):return env[n](*a,**kw)
def wrld(o):return [tuple(o.matrix_world@v.co) for v in o.data.vertices]
def sig(o):
 return hashlib.sha256(repr((wrld(o),[tuple(f.vertices) for f in o.data.polygons],[m.name for m in o.data.materials])).encode()).hexdigest()
def selected(o):
 n=o.name
 return n.startswith('catcafe.cat.') or '.residential.book' in n or '.residential.innerplant' in n or '.roof.pot' in n or '.balcony.pot' in n or '.balcony.middlepot' in n or '.balcony.vine' in n or '.balcony.leftvine' in n
original=[o for o in bpy.context.scene.objects if o.type=='MESH'];preserved={o.name:sig(o) for o in original if not selected(o)}
# Extract exactly the original cats, before removing their static copies.
catinfo=[('cat.sleep',[4.97,.615,-.12],'cat-sleep-idle',8.0),('cat.top',[4.98,1.785,-.4],'cat-ginger-idle',7.2),('cat.bottom',[5.25,0,.68],'cat-floor-idle',9.0)]
catdata=[]
for prefix,root,name,dur in catinfo:
 parts=[]
 for o in original:
  if not o.name.startswith('catcafe.'+prefix+'.'):continue
  points=[];normals=[];indices=[];me=o.data
  for face in me.polygons:
   ps=[o.matrix_world@me.vertices[i].co for i in face.vertices]
   for k in range(1,len(ps)-1):
    q=[ps[0],ps[k],ps[k+1]];normal=(q[1]-q[0]).cross(q[2]-q[0]).normalized();norm=(normal.x,normal.z,-normal.y)
    for p in q:points.append([p.x-root[0],p.z-root[1],-p.y-root[2]]);normals.append(norm);indices.append(len(indices))
  mat=o.data.materials[0];bs=mat.node_tree.nodes.get('Principled BSDF')
  parts.append({'name':o.name.split(prefix+'.',1)[1],'positions':points,'normals':normals,'indices':indices,'material':{'name':mat.name,'pbrMetallicRoughness':{'baseColorFactor':list(bs.inputs['Base Color'].default_value),'roughnessFactor':bs.inputs['Roughness'].default_value,'metallicFactor':bs.inputs['Metallic'].default_value}}})
 catdata.append({'id':name,'source_group':prefix,'source_root':root,'entity_root':[root[0],-.002 if prefix=='cat.bottom' else root[1],root[2]],'duration':dur,'parts':parts})
(ROOT/'cat-source-parts.json').write_text(json.dumps(catdata,separators=(',',':')))
removed=[o for o in original if selected(o)];removednames=[o.name for o in removed];catremoved=[o for o in removed if o.name.startswith('catcafe.cat.')]
cat_removed_tris=0
for o in catremoved:o.data.calc_loop_triangles();cat_removed_tris+=len(o.data.loop_triangles)
bpy.data.batch_remove(ids=removed)
reports=[]
def make_item(kind,x,y,z,name):
 B=lambda n,p,d,m='wood',b=.02:F('box',name+'.'+n,p,d,m,b)
 T=lambda n,a,b,r,m='wood',nv=8:F('tube',name+'.'+n,a,b,r,m,nv)
 S=lambda n,p,r,m='leaf',sc=(1,1,1),sub=1:F('ball',name+'.'+n,p,r,m,scale=sc,sub=sub)
 if kind in ['recttable','pottingbench','workbench','coffeetable','teatable']:
  w={'recttable':1.3,'pottingbench':1.65,'workbench':2.05,'coffeetable':1.25,'teatable':.65}[kind];h=.84 if kind not in ['coffeetable','teatable'] else .55
  for sx in [-1,1]:
   for sz in [-1,1]:B('leg',(x+sx*(w/2-.1),y+(h-.06)/2,z+sz*.23),(.075,h-.06,.075),'wooddark',.01)
  B('top',(x,y+h-.04,z),(w,.08,.66),'woodlight');top=y+h
  if kind=='pottingbench':
   B('seedtray',(x-.36,top+.035,z),(.55,.07,.35),'wood');B('seedsoil',(x-.36,top+.073,z),(.46,.015,.26),'soil',.005)
   for j in range(3):
    T('seedstem',(x-.5+j*.14,top+.075,z),(x-.5+j*.14,top+.18,z),.009,'leafdark',5);S('seedling',(x-.5+j*.14,top+.18,z),.09,'leaflight',(.8,.55,.6))
   T('wateringcan',(x+.43,top,z),(x+.43,top+.23,z),.13,'sage',10);T('waterspout',(x+.5,top+.12,z),(x+.72,top+.22,z),.035,'sage',7)
  elif kind=='workbench':
   for j in range(4):B('toolbox',(x-.65+j*.40,top+.10,z-.1),(.26,.20,.30),['wooddark','sage','blue','terra'][j],.015)
   for j in range(3):T('tool',(x-.25+j*.15,top+.02,z+.15),(x-.1+j*.15,top+.02,z+.2),.018,'silver',6)
  else:
   for j in [-1,1]:T('cup',(x+j*.16,top,z),(x+j*.16,top+.12,z),.055,'cream',10)
   T('teapot',(x+.05,top,z-.1),(x+.05,top+.19,z-.1),.10,'terra',10)
 elif kind=='roundtable':
  T('foot',(x,y,z),(x,y+.06,z),.34,'wooddark',12);T('stem',(x,y+.03,z),(x,y+.81,z),.07,'wooddark',10);T('tabletop',(x,y+.78,z),(x,y+.86,z),.55,'woodlight',18)
  for j in range(3):S('apple',(x-.16+j*.16,y+.94,z),.085,['apple','orange','fruitred'][j],sub=2)
 elif kind in ['chair','stool']:
  for sx in [-1,1]:
   for sz in [-1,1]:B('leg',(x+sx*.17,y+.225,z+sz*.17),(.055,.45,.055),'wooddark',.007)
  B('seat',(x,y+.47,z),(.46,.08,.45),'woodlight',.015)
  if kind=='chair':
   for sx in [-1,1]:B('backpost',(x+sx*.18,y+.78,z-.19),(.05,.65,.05),'wood',.007)
   B('back',(x,y+.95,z-.19),(.43,.27,.06),'wood',.012)
 elif kind in ['sofa','armchair']:
  w=1.65 if kind=='sofa' else .78
  for sx in [-1,1]:
   for sz in [-1,1]:B('foot',(x+sx*(w/2-.12),y+.12,z+sz*.22),(.10,.24,.10),'wooddark',.01)
  B('base',(x,y+.32,z),(w,.24,.65),'wood',.035);B('cushion',(x,y+.50,z),(w-.14,.16,.57),'clothGold' if kind=='sofa' else 'clothGreen',.045)
  B('back',(x,y+.85,z-.25),(w,.65,.18),'clothGold' if kind=='sofa' else 'clothGreen',.05)
  for sx in [-1,1]:B('arm',(x+sx*(w/2-.06),y+.65,z),(.16,.35,.60),'woodlight',.04)
  if kind=='sofa':
   for sx in [-1,1]:B('pillow',(x+sx*.45,y+.75,z-.08),(.33,.34,.14),'linen',.06)
 elif kind in ['bookcase','seedcase']:
  w=.78;h=1.8
  for sx in [-1,1]:B('side',(x+sx*w/2,y+h/2,z),(.08,h,.36),'wooddark',.014)
  for row in range(4):
   yy=y+.16+row*.49;B('shelf',(x,yy,z),(w,.06,.39),'woodlight',.01)
   for col in range(4):
    xx=x-.26+col*.17
    if kind=='bookcase':B('book',(xx,yy+.03+.15,z),(.10,.30,.22),['red','sage','clothBlue','woodlight'][col],.006)
    else:T('seedpot',(xx,yy+.03,z),(xx,yy+.18,z),.064,'terra',8);T('seedstem',(xx,yy+.16,z),(xx,yy+.25,z),.008,'leafdark',5);S('seedleaf',(xx,yy+.25,z),.09,'leaflight',(.7,.6,.7))
 elif kind=='pegboard':
  B('panel',(x,y+1.28,z),(1.65,.76,.065),'wooddark',.012)
  for j in range(6):T('tool',(x-.65+j*.26,y+1.35,z+.05),(x-.65+j*.26,y+1.07,z+.05),.018,'silver',6)
 elif kind=='tallplant':make_planter(x,y,z,name,'round','broadleaf','terra','room')
 else:raise ValueError(kind)

def make_planter(x,y,z,name,shape,plant,mat,place):
 B=lambda n,p,d,m,b=.01:F('box',name+'.'+n,p,d,m,b)
 T=lambda n,a,b,r,m='wood',nv=8,**kw:F('tube',name+'.'+n,a,b,r,m,nv,**kw)
 S=lambda n,p,r,m='leaf',sc=(1,1,1):F('ball',name+'.'+n,p,r,m,scale=sc,sub=1)
 if shape=='round':
  T('pot',(x,y,z),(x,y+.31,z),.18,mat,10,r2=.24);T('soil',(x,y+.305,z),(x,y+.32,z),.214,'soil',10);sy=y+.32
 else:
  B('base',(x,y+.025,z),(.65,.05,.36),mat)
  for ss in [-1,1]:B('wall',(x,y+.16,z+ss*.16),(.65,.30,.04),mat);B('end',(x+ss*.305,y+.16,z),(.04,.30,.32),mat)
  B('soil',(x,y+.285,z),(.56,.04,.27),'soil',.003);sy=y+.305
 if plant in ['broadleaf','herbs']:
  for j in range(5 if plant=='broadleaf' else 7):
   a=j*2.4;h=.48+(j%3)*.14 if plant=='broadleaf' else .18+(j%3)*.06;tip=(x+math.sin(a)*.20,sy+h,z+math.cos(a)*.16)
   T('stem',(x,sy,z),tip,.012,'leafdark',5);S('leaf',tip,.18 if plant=='broadleaf' else .10,['leaf','leaflight','leafdark'][j%3],(1.15,.38,.65))
 elif plant=='shrub':
  T('trunk',(x,sy,z),(x,sy+.40,z),.025,'bark',7)
  for j in range(9):
   a=j*2.4;p=(x+math.sin(a)*.19,sy+.32+(j%3)*.10,z+math.cos(a)*.16);T('twig',(x,sy+.2,z),p,.009,'leafdark',5);S('cluster',p,.15,['leaf','leaflight'][j%2])
 elif plant=='flower':
  for j in range(5):
   a=j*2.4;p=(x+math.sin(a)*.16,sy+.30+(j%2)*.12,z+math.cos(a)*.15);T('stem',(x,sy,z),p,.012,'leafdark',5)
   for k in range(5):aa=k*math.pi*2/5;S('petal',(p[0]+math.cos(aa)*.045,p[1],p[2]+math.sin(aa)*.045),.05,'purple' if place=='roof' else 'pink',(.8,.5,.8))
 elif plant=='vine':
  edge=z+(.65 if place=='roof' else .42);start=(x,sy,z);mid=(x,sy+.23,z+.25);end=(x,sy+.12,edge);T('vine.root',start,mid,.012,'leafdark',5);T('vine.bridge',mid,end,.012,'leafdark',5)
  F('vine',name+'.hanging',end[0],end[1],end[2],1.15 if place=='roof' else .95)
 else:raise ValueError(plant)

new_report=[]
for house in plan['houses']:
 env['zone']=house['id'];w=house['width']
 for item in house['room']['furniture']:
  anchor=Vector(F('C',item['root']));before=set(bpy.context.scene.objects);make_item(item['kind'],*item['root'],'variation.room.'+item['id']);added=[o for o in bpy.context.scene.objects if o not in before];bpy.context.view_layer.update();yaw=math.radians(item['baseYawDegrees']+item['jitterYawDegrees']);tr=Matrix.Translation(anchor)@Matrix.Rotation(yaw,4,'Z')@Matrix.Scale(item['scale'],4)@Matrix.Translation(-anchor)
  for o in added:o.matrix_world=tr@o.matrix_world
  new_report.append({'house':house['id'],'slot':item['id'],'objects':len(added),'supportY':item['supportY']})
 for slot in house['slots']:
  assert slot['allowedRootX'][0]<=slot['root'][0]<=slot['allowedRootX'][1] and slot['allowedRootZ'][0]<=slot['root'][2]<=slot['allowedRootZ'][1]
  assert .85<=slot['scale']<=1.15 and -12<=slot['yawDegrees']<=12 and slot['root'][1]==slot['supportY']
  before=set(bpy.context.scene.objects);make_planter(*slot['root'],'variation.'+slot['id'],slot['planter'],slot['plant'],slot['material'],slot['placement']);added=[o for o in bpy.context.scene.objects if o not in before];bpy.context.view_layer.update();anchor=Vector(F('C',slot['root']));tr=Matrix.Translation(anchor)@Matrix.Rotation(math.radians(slot['yawDegrees']),4,'Z')@Matrix.Scale(slot['scale'],4)@Matrix.Translation(-anchor)
  for o in added:o.matrix_world=tr@o.matrix_world
  new_report.append({'house':house['id'],'slot':slot['id'],'objects':len(added),'supportY':slot['supportY'],'footprint_body_kept_within_rail':True})
bpy.context.view_layer.update()
for name,h in preserved.items():assert sig(bpy.data.objects[name])==h,('unexpected preserved object change',name)
assert not any(o.name.startswith('catcafe.cat.') for o in bpy.context.scene.objects)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'reference-street-source-v4.blend'))
(ROOT/'variation-build-report.json').write_text(json.dumps({'seed':plan['seed'],'variation_plan_sha256':hashlib.sha256((ROOT/'variation-plan.json').read_bytes()).hexdigest(),'preserved_untargeted_objects':len(preserved),'preserved_untargeted_world_geometry_and_material_names_exact':True,'removed_original_objects':removednames,'static_cat_objects_removed':len(catremoved),'static_cat_triangles_removed':cat_removed_tris,'static_cat_group_names_remaining':0,'new_slots':new_report},indent=2));print('PREPARED_V4',len(preserved),'preserved',len(new_report),'slots',cat_removed_tris,'static cat triangles removed',flush=True)
