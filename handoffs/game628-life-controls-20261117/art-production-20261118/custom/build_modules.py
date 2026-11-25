import bpy, math, json, hashlib, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import bmesh
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parents[1]/'public/art/neighborhood-v1/custom'
# ROOT = handoff/art-production/custom; resolve handoff explicitly.
OUT=ROOT.parent.parent/'public/art/neighborhood-v1/custom'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
# Convert engine X,Y,Z to Blender X,-Z,Y. Exporter's glTF conversion reverses this exactly.
def C(p):return Vector((p[0],-p[2],p[1]))
def mat(name,color,metal=0,rough=.72):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Metallic'].default_value=metal;bs.inputs['Roughness'].default_value=rough;m.use_backface_culling=True;return m
M={
 'green':mat('sage painted metal',(.19,.36,.29),.12,.65),'iron':mat('soft graphite iron',(.12,.15,.15),.5,.5),
 'wood':mat('warm honey timber',(.47,.27,.13),0,.78),'edge':mat('warm timber endgrain',(.64,.40,.20),0,.8),
 'cream':mat('warm canvas cream',(.85,.78,.62),0,.9),'cloth':mat('sage canvas stripe',(.36,.48,.32),0,.95),
 'case':mat('aged ivory enamel',(.73,.73,.64),.12,.65),'black':mat('rubber and recess',(.035,.045,.045),0,.9),
 'silver':mat('muted brushed alloy',(.48,.54,.51),.65,.45),'terracotta':mat('weathered terracotta',(.56,.28,.16),0,.9),
 'soil':mat('potting soil',(.12,.085,.055),0,1),'bark':mat('warm tree bark',(.30,.18,.09),0,.9),
 'leaf':mat('broadleaf green',(.31,.48,.17),0,.95),'leafLight':mat('sunlit green',(.45,.59,.24),0,.95),'leafDark':mat('leaf underside',(.20,.34,.14),0,.95),
}
modules={};current=[]
def finish_obj(o,name,material):
 o.name=name;o.data.materials.append(M[material]);current.append(o);return o

def box(name,center,dims,material,bevel=0):
 bpy.ops.mesh.primitive_cube_add(size=1,location=C(center));o=bpy.context.object;o.dimensions=(dims[0],dims[2],dims[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('soft crafted edges','BEVEL');mod.width=bevel;mod.segments=1;mod.affect='EDGES';bpy.ops.object.modifier_apply(modifier=mod.name)
 return finish_obj(o,name,material)

def ball(name,p,r,material,scale=(1,1,1),sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=r,location=C(p));o=bpy.context.object;o.scale=(scale[0],scale[2],scale[1]);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish_obj(o,name,material)

def tube(name,a,b,r,material,verts=8):
 a,b=C(a),C(b);d=b-a;bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d.length,end_fill_type='NGON',location=(a+b)*.5);o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=d.to_track_quat('Z','Y');bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish_obj(o,name,material)

def ring(name,p,r,t,material):
 bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=t,major_segments=20,minor_segments=6,location=C(p),rotation=(math.pi/2,0,0));return finish_obj(bpy.context.object,name,material)

def custom(name,verts,faces,material,indices=None):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata([C(v) for v in verts],[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o)
 finish_obj(o,name,material)
 if indices:
  for material in ['cream','cloth']:
   if M[material].name not in o.data.materials:o.data.materials.append(M[material])
  for f,ix in zip(mesh.polygons,indices):f.material_index=ix
 return o

def make_balcony():
 box('balcony.deck',(0,.06,.425),(3.6,.12,.85),'cream',.015)
 for i in range(15):
  x=-1.70+i*3.4/14;box('balcony.front_bar.%02d'%i,(x,.56,.805),(.035,.89,.035),'iron')
 box('balcony.front_rail',(0,1.025,.805),(3.52,.055,.065),'green',.01)
 for s in [-1,1]:
  box('balcony.side_rail.'+str(s),(s*1.73,1.025,.41),(.055,.055,.85),'green',.008)
  for z in [.08,.35,.60]:box('balcony.side_bar.'+str(s)+'.'+str(z),(s*1.73,.56,z),(.035,.89,.035),'iron')
  box('balcony.wall_plate.'+str(s),(s*1.30,-.20,.02),(.16,.50,.08),'iron',.008)
  tube('balcony.bracket.'+str(s),(s*1.30,-.40,.055),(s*1.30,.07,.70),.04,'iron')

def make_aircon():
 box('aircon.casing',(0,0,.14),(.65,.45,.28),'case',.025)
 tube('aircon.fan_recess',(-.105,0,.274),(-.105,0,.288),.153,'black',20)
 ring('aircon.fan_guard',(-.105,0,.292),.145,.013,'silver')
 for i in range(7):
  y=-.12+i*.04;w=math.sqrt(max(0,.135**2-y*y))*2
  box('aircon.grille.%02d'%i,(-.105,y,.294),(w,.010,.012),'case')
 for i in range(6):box('aircon.vents.%02d'%i,(.205,-.14+i*.055,.286),(.125,.018,.014),'iron')
 for s in [-1,1]:box('aircon.wall_pad.'+str(s),(s*.24,-.24,.05),(.10,.08,.20),'silver',.006)

def make_awning():
 # One watertight canopy with shared strip seams and deterministic planar material UV.
 verts=[];N=8;T=6
 for layer in [0,1]:
  for i in range(N+1):
   for j in range(T+1):
    t=j/T;verts.append((-1.8+i*3.6/N,-.18*t*t-layer*.035,.95*t))
 stride=(N+1)*(T+1);faces=[];mi=[]
 for i in range(N):
  for j in range(T):
   a=i*(T+1)+j;b=a+T+1
   faces.extend([(a,b,b+1,a+1),(a+stride,a+1+stride,b+1+stride,b+stride)]);mi.extend([1 if i%2 else 0]*2)
 for i in range(N):
  for j in [0,T]:
   a=i*(T+1)+j;b=a+T+1;faces.append((a,a+stride,b+stride,b));mi.append(1 if i%2 else 0)
 for i in [0,N]:
  for j in range(T):
   a=i*(T+1)+j;faces.append((a,a+1,a+1+stride,a+stride));mi.append(0)
 o=custom('awning.continuous_canopy',verts,faces,'cream',mi)
 # Scalloped skirt is a closed thin extrusion, overlapping the canopy at its top.
 vs=[];S=64
 for z in [.935,.965]:
  for edge in [0,1]:
   for i in range(S+1):
    x=-1.8+3.6*i/S;y=-.17 if edge==0 else -.36-.045*math.sin((i%8)/8*math.pi)
    vs.append((x,y,z))
 fs=[];idx=[];L=S+1
 for i in range(S):
  fs.extend([(i,i+1,L+i+1,L+i),(2*L+i,3*L+i,3*L+i+1,2*L+i+1),(i,2*L+i,2*L+i+1,i+1),(L+i,L+i+1,3*L+i+1,3*L+i)])
  idx.extend([1 if (i//8)%2 else 0]*4)
 fs.extend([(0,L,3*L,2*L),(S,2*L+S,3*L+S,L+S)]);idx.extend([0,1])
 custom('awning.scalloped_valance',vs,fs,'cream',idx)
 box('awning.wall_rail',(0,0,.02),(3.6,.10,.10),'iron',.009)
 for s in [-1,1]:
  box('awning.mount.'+str(s),(s*1.4,-.16,.03),(.12,.35,.09),'iron',.006)
  tube('awning.support.'+str(s),(s*1.4,-.29,.05),(s*1.4,-.21,.94),.025,'iron')

def make_sign():
 box('sign.timber_backboard',(0,0,.04),(3.2,.4,.08),'wood',.018)
 box('sign.green_face',(0,0,.087),(2.99,.26,.018),'green',.008)
 for s in [-1,1]:
  box('sign.horizontal_frame.'+str(s),(0,s*.175,.09),(3.12,.05,.05),'edge',.006)
  box('sign.side_frame.'+str(s),(s*1.565,0,.09),(.05,.35,.05),'edge',.006)
  for y in [-.15,.15]:ball('sign.screw.'+str(s)+'.'+str(y),(s*1.54,y,.12),.014,'iron',sub=1)

def make_bicycle():
 rear=(-.53,.31,0);front=(.53,.31,0);crank=(-.02,.34,0);seat=(-.21,.79,0);head=(.36,.76,0)
 for name,p in [('rear',rear),('front',front)]:
  ring('bicycle.'+name+'_tire',p,.273,.037,'black');ring('bicycle.'+name+'_rim',p,.259,.012,'silver')
  tube('bicycle.'+name+'_hub',(p[0],p[1],-.06),(p[0],p[1],.06),.025,'silver')
  for i in range(8):
   a=i*math.pi/4;tube('bicycle.'+name+'_spoke.%02d'%i,p,(p[0]+math.sin(a)*.26,p[1]+math.cos(a)*.26,0),.004,'silver',6)
 for i,(a,b) in enumerate([(rear,crank),(crank,seat),(seat,rear),(seat,head),(head,crank),(head,front)]):tube('bicycle.frame.%02d'%i,a,b,.025,'green')
 for i,p in enumerate([rear,front,crank,seat,head]):ball('bicycle.lug.%02d'%i,p,.030,'green')
 tube('bicycle.seatpost',seat,(-.21,.86,0),.02,'silver');box('bicycle.saddle',(-.23,.875,0),(.28,.065,.14),'black',.018)
 tube('bicycle.handle_stem',head,(.40,.98,0),.020,'silver');tube('bicycle.handlebar',(.40,.98,-.21),(.40,.98,.21),.018,'silver')
 for s in [-1,1]:tube('bicycle.grip.'+str(s),(.40,.98,s*.13),(.40,.98,s*.22),.024,'black')
 tube('bicycle.crank_arm',(-.02,.34,-.04),(.075,.30,-.04),.012,'silver');box('bicycle.pedal',(.075,.30,-.09),(.12,.035,.10),'black',.005)
 # Rear rack and a legible shallow front basket, open above and around the bars.
 box('bicycle.basket_floor',(.60,.70,0),(.34,.025,.34),'wood',.006)
 for x in [.44,.76]:
  for z in [-.16,.16]:tube('bicycle.basket_corner', (x,.69,z),(x,.89,z),.010,'wood')
 for y in [.78,.89]:
  for z in [-.16,.16]:tube('bicycle.basket_side',(.44,y,z),(.76,y,z),.010,'wood')
  for x in [.44,.76]:tube('bicycle.basket_end',(x,y,-.16),(x,y,.16),.010,'wood')
 tube('bicycle.basket_mount',(head[0],.76,0),(.44,.71,0),.018,'iron')

def make_planter():
 box('planter.base',(0,.04,0),(.65,.08,.40),'terracotta',.012)
 for s in [-1,1]:
  box('planter.long_wall.'+str(s),(0,.22,s*.18),(.65,.32,.04),'terracotta',.008)
  box('planter.end_wall.'+str(s),(s*.305,.22,0),(.04,.32,.36),'terracotta',.008)
 box('planter.soil',(0,.325,0),(.565,.04,.315),'soil',.004)
 for s in [-1,1]:
  box('planter.long_rim.'+str(s),(0,.38,s*.18),(.65,.045,.06),'cream',.006)
  box('planter.end_rim.'+str(s),(s*.305,.38,0),(.06,.045,.36),'cream',.006)

def make_tree():
 tube('tree.trunk',(0,.13,0),(.06,2.9,.015),.13,'bark',9)
 ball('tree.root',(0,.13,0),.15,'bark',scale=(1,.9,1),sub=1)
 clusters=[((0,3.42,0),1.0,'leaf'),((-.68,3.28,.08),.85,'leafDark'),((.64,3.40,.02),.87,'leaf'),((-.32,3.92,-.12),.62,'leafLight'),((.22,3.04,.65),.78,'leaf'),((.02,3.20,-.65),.80,'leafDark'),((.65,3.71,.38),.63,'leafLight')]
 for i,(p,r,m) in enumerate(clusters):ball('tree.crown.%02d'%i,p,r,m,scale=(1,.85,1),sub=1)
 for i,p in enumerate([(-.68,3.28,.08),(.64,3.4,.02),(.22,3.04,.65),(.02,3.2,-.65)]):tube('tree.branch.%02d'%i,(.04,2.15,0),p,.065,'bark',8)

BUILDERS={'balcony':make_balcony,'aircon':make_aircon,'awning':make_awning,'shop-sign':make_sign,'bicycle':make_bicycle,'street-planter':make_planter,'broadleaf-tree':make_tree}
if "--check-only" not in sys.argv:
 for name,build in BUILDERS.items():
  current=[];build();modules[name]=list(current)
  # Correct winding consistently and add UV data for portable normals/tangents even without bitmap textures.
  for o in current:
   bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
   if not o.data.uv_layers:
    uv=o.data.uv_layers.new(name='UVMap')
    for poly in o.data.polygons:
     for li in poly.loop_indices:
      co=o.data.vertices[o.data.loops[li].vertex_index].co;uv.data[li].uv=(co.x,co.z)
  bpy.ops.object.select_all(action='DESELECT')
  for o in current:o.select_set(True)
  bpy.context.view_layer.objects.active=current[0]
  bpy.ops.export_scene.gltf(filepath=str(OUT/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_animations=False)
 # Preserve editable source with all objects in named collections.
 for name,objects in modules.items():
  collection=bpy.data.collections.new(name);scene.collection.children.link(collection)
  for o in objects:
   for old in list(o.users_collection):old.objects.unlink(o)
   collection.objects.link(o)
 bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'neighborhood-modules.blend'))
# Reimport actual final GLBs into a clean scene, then inspect geometry and render that result.
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene;scene.unit_settings.system='METRIC'
report={'status':'producer_checked_local_draft','units':'meters','axis':'glTF +Y up; street-facing +Z','assets':[],'connection_declarations':str(ROOT/'CONNECTIONS.md'),'user_art_review':'pending'}
placements={name:((i%3)*5,(i//3)*4.0) for i,name in enumerate(BUILDERS)}
for name in BUILDERS:
 bpy.ops.object.select_all(action='DESELECT');bpy.ops.import_scene.gltf(filepath=str(OUT/(name+'.glb')))
 objects=[o for o in bpy.context.selected_objects if o.type=='MESH']
 lo=[float('inf')]*3;hi=[float('-inf')]*3;tri=0;boundary=0;rawboundary=0;degenerate=0;duplicate=0
 for o in objects:
  dg=bpy.context.evaluated_depsgraph_get();mesh=o.evaluated_get(dg).to_mesh();mesh.calc_loop_triangles();seen=set()
  for v in mesh.vertices:
   q=o.matrix_world@v.co;p=(q.x,q.z,-q.y)
   for i in range(3):lo[i]=min(lo[i],p[i]);hi[i]=max(hi[i],p[i])
  for face in mesh.loop_triangles:
   tri+=1;ps=[o.matrix_world@mesh.vertices[i].co for i in face.vertices]
   if (ps[1]-ps[0]).cross(ps[2]-ps[0]).length<1e-10:degenerate+=1
   key=tuple(sorted(tuple(round(x,7) for x in p) for p in ps))
   if key in seen:duplicate+=1
   seen.add(key)
  bm=bmesh.new();bm.from_mesh(mesh);rawboundary+=sum(e.is_boundary for e in bm.edges);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6);boundary+=sum(e.is_boundary for e in bm.edges);bm.free();o.evaluated_get(dg).to_mesh_clear()
 if tri>=3500:raise RuntimeError((name,'triangle budget exceeded',tri))
 if boundary or degenerate or duplicate:raise RuntimeError((name,'geometry check',boundary,degenerate,duplicate))
 row={'name':name,'file':str(OUT/(name+'.glb')),'sha256':hashlib.sha256((OUT/(name+'.glb')).read_bytes()).hexdigest(),'triangles':tri,'mesh_parts':len(objects),'bounds_Yup':{'min':lo,'max':hi},'raw_split_boundary_edges':rawboundary,'boundary_edges_after_analysis_weld_1um':boundary,'degenerate_triangles':degenerate,'duplicate_triangles':duplicate,'reimported':True,'materials':sorted({m.name for o in objects for m in o.data.materials if m})}
 report['assets'].append(row)
 # Gallery layout in Blender XY, source origins remain recorded above.
 x,y=placements[name]
 for o in bpy.context.selected_objects:o.location.x+=x;o.location.y+=y
(ROOT/'geometry-report.json').write_text(json.dumps(report,indent=2))
print('GEOMETRY_REPORT_READY',flush=True)
# Tiny finite CPU visual checks of the actual reimported assembly.
scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12;scene.cycles.use_denoising=True
scene.render.resolution_x=900;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('inspection world');scene.world.color=(.16,.16,.16)
bpy.ops.mesh.primitive_plane_add(size=200,location=(4,3,-.65));floor=bpy.context.object
floor.data.materials.append(mat('neutral inspection floor',(.42,.43,.42),0,.9))
for loc,power,size in [((2,-6,12),1800,8),((10,8,8),1100,6)]:
 bpy.ops.object.light_add(type='AREA',location=loc);lamp=bpy.context.object;lamp.data.energy=power;lamp.data.shape='DISK';lamp.data.size=size;lamp.rotation_euler=(Vector((5,3,1))-lamp.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=19
for name,eye in [('front-oblique',(15,-17,14)),('back-oblique',(-11,18,12)),('low-front',(14,-18,5))]:
 cam.location=eye;cam.rotation_euler=(Vector((5,3,1.4))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/(name+'.png'));bpy.ops.render.render(write_still=True)
# Close views retain each complete assembly, isolating only other unrelated gallery assets.
all_meshes=[o for o in scene.objects if o.type=='MESH' and o!=floor]
for name in BUILDERS:
 x,y=placements[name]
 for o in all_meshes:o.hide_render=not o.name.startswith({'shop-sign':'sign.','street-planter':'planter.','broadleaf-tree':'tree.'}.get(name,name+'.'))
 height={'balcony':.4,'aircon':0,'awning':-.1,'shop-sign':0,'bicycle':.5,'street-planter':.2,'broadleaf-tree':2.3}[name]
 size={'aircon':1.2,'bicycle':2.5,'street-planter':1.0,'broadleaf-tree':5.5}.get(name,4.4)
 cam.data.ortho_scale=size
 for side,v in [('front',(1,-2.6,1.4)),('rear',(-1,2.6,.7))]:
  target=Vector((x,y,height));cam.location=target+Vector(v)*size;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/(name+'-contact-'+side+'.png'));bpy.ops.render.render(write_still=True)
print('MODULE_BUILD_COMPLETED',len(report['assets']))
