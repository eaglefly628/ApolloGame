import bpy,bmesh,math,json,hashlib,random,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parent
OUT=ROOT.parent.parent/'public/art/reference-rebuild-20261120/scene'
OUT.mkdir(parents=True,exist_ok=True)
rng=random.Random(6281120)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
M={};cache={};zone='street';objects={};lights=[];contacts=[]
def C(p):return Vector((p[0],-p[2],p[1]))
def material(key,color,rough=.78,metal=0,emit=0):
 color=tuple(c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in color)
 m=bpy.data.materials.new(key);m.use_nodes=True;m.diffuse_color=(*color,1);bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*color,1);bs.inputs['Roughness'].default_value=rough;bs.inputs['Metallic'].default_value=metal
 if emit:bs.inputs['Emission Color'].default_value=(*color,1);bs.inputs['Emission Strength'].default_value=emit
 m.use_backface_culling=True;M[key]=m;return m
for args in [
 ('plaster',(.73,.65,.48)),('cream',(.83,.75,.60)),('sandstone',(.68,.61,.49)),('brick',(.57,.25,.13)),('mortar',(.59,.50,.39)),('sage',(.28,.39,.26)),('green',(.16,.31,.23)),('blue',(.25,.39,.45)),
 ('wood',(.42,.24,.10)),('woodlight',(.59,.37,.17)),('wooddark',(.26,.15,.07)),('iron',(.12,.15,.15),.48,.45),('silver',(.49,.54,.53),.4,.65),('canvas',(.87,.76,.56)),('clothGreen',(.42,.51,.31)),('clothGold',(.81,.56,.30)),('clothBlue',(.39,.52,.61)),('red',(.63,.18,.11)),('blackboard',(.10,.14,.13)),('chalk',(.88,.83,.64)),('terra',(.58,.31,.16)),('soil',(.17,.12,.065)),('leaf',(.34,.48,.14)),('leaflight',(.48,.60,.20)),('leafdark',(.20,.34,.12)),('bark',(.27,.17,.09)),('fruitred',(.72,.14,.06),.52),('orange',(.92,.49,.045),.6),('lemon',(.91,.73,.13)),('apple',(.43,.61,.12)),('bread',(.72,.41,.14)),('breadlight',(.86,.62,.28)),('breadcut',(.96,.79,.49)),('rubber',(.035,.044,.045)),('potblue',(.20,.42,.45)),('purple',(.45,.37,.67)),('pink',(.75,.42,.58)),('linen',(.77,.79,.70)),('catcream',(.89,.78,.54)),('catginger',(.75,.39,.13)),('catwhite',(.89,.86,.73)),('catgray',(.42,.46,.43)),('bulb',(.98,.73,.32),.35,0,.18),('interior',(.63,.51,.34))]:material(*args)

def addmesh(name,verts,faces,key):
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(zone+'.'+name,mesh);scene.collection.objects.link(o);o.data.materials.append(M[key]);objects.setdefault(zone,[]).append(o);return o

def box(name,p,d,key='wood',bevel=.02):
 dims=tuple(round(float(x),5) for x in d);b=min(bevel,min(dims)*.22);ck=('box',dims,round(b,5))
 if ck not in cache:
  bm=bmesh.new();bmesh.ops.create_cube(bm,size=1)
  for v in bm.verts:v.co.x*=dims[0];v.co.y*=dims[2];v.co.z*=dims[1]
  if b:bmesh.ops.bevel(bm,geom=list(bm.edges),offset=b,segments=1,affect='EDGES')
  bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));me=bpy.data.meshes.new('beveled-box');bm.to_mesh(me);bm.free();cache[ck]=me
 o=bpy.data.objects.new(zone+'.'+name,cache[ck]);scene.collection.objects.link(o);o.location=C(p);o.data=o.data.copy();o.data.materials.append(M[key]);objects.setdefault(zone,[]).append(o);return o

def ball(name,p,r,key='leaf',scale=(1,1,1),sub=1):
 ck=('ico',sub)
 if ck not in cache:
  bm=bmesh.new();bmesh.ops.create_icosphere(bm,subdivisions=sub,radius=1);me=bpy.data.meshes.new('lowpoly-sphere');bm.to_mesh(me);bm.free();cache[ck]=me
 o=bpy.data.objects.new(zone+'.'+name,cache[ck].copy());scene.collection.objects.link(o);o.location=C(p);o.scale=(r*scale[0],r*scale[2],r*scale[1]);o.data.materials.append(M[key]);objects.setdefault(zone,[]).append(o);return o

def tube(name,a,b,r,key='iron',n=8,r2=None):
 a,b=C(a),C(b);dist=(b-a).length;r2=r if r2 is None else r2
 verts=[]
 for z,rr in [(-dist/2,r),(dist/2,r2)]:
  for i in range(n):verts.append((rr*math.cos(i*2*math.pi/n),rr*math.sin(i*2*math.pi/n),z))
 faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
 o=addmesh(name,verts,faces,key);o.location=(a+b)/2;o.rotation_mode='QUATERNION';o.rotation_quaternion=(b-a).to_track_quat('Z','Y');return o

def ring(name,p,R,r,key='iron',n=16,k=6):
 verts=[]
 for i in range(n):
  a=i*2*math.pi/n
  for j in range(k):
   b=j*2*math.pi/k;verts.append(tuple(C((p[0]+(R+r*math.cos(b))*math.cos(a),p[1]+(R+r*math.cos(b))*math.sin(a),p[2]+r*math.sin(b)))))
 faces=[(i*k+j,((i+1)%n)*k+j,((i+1)%n)*k+(j+1)%k,i*k+(j+1)%k) for i in range(n) for j in range(k)]
 return addmesh(name,verts,faces,key)

def plant(name,x,y,z,s=1,pot=True):
 if pot:
  tube(name+'.pot',(x,y,z),(x,y+.34*s,z),.19*s,'terra',10,r2=.26*s);tube(name+'.soil',(x,y+.342*s,z),(x,y+.35*s,z),.225*s,'soil',10)
 root=y+.33*s if pot else y
 for i in range(5):
  a=i*2.4;tip=(x+math.sin(a)*.24*s,root+(.30+(i%3)*.14)*s,z+math.cos(a)*.22*s)
  tube(name+'.stem',(x,root,z),tip,.015*s,'leafdark',5)
  ball(name+'.leaves',tip,.20*s,['leaf','leaflight','leafdark'][i%3],scale=(1,.5,.65))

def vine(name,x,y,z,length=1.6):
 last=(x,y,z)
 for i in range(int(length/.17)):
  p=(x+math.sin(i*.9)*.10,y-i*.17,z+.035*math.cos(i))
  if i:tube(name+'.stem',last,p,.012,'leafdark',5)
  ball(name+'.leaf',p,.105,'leaflight' if i%3 else 'leaf',scale=(1,.55,.65));last=p

def pendant(x,y,z,name):
 tube(name+'.cord',(x,y,z),(x,y+.38,z),.018,'iron',6)
 tube(name+'.shade',(x,y-.05,z),(x,y+.12,z),.22,'wooddark',12,r2=.06)
 ball(name+'.bulb',(x,y-.055,z),.09,'bulb',scale=(1,.55,1));lights.append({'id':zone+'.'+name,'position':[x,y-.12,z],'target':[x,.8,-.9],'type':'spot','angle':.58,'range':2.3,'shadowRecommendation':zone in ['bakery','noodles']})

def shelf(name,x,z,width=1.2,y=0,rows=3):
 box(name+'.left',(x-width/2,y+1,z),(.09,2,.38),'wooddark')
 box(name+'.right',(x+width/2,y+1,z),(.09,2,.38),'wooddark')
 for k in range(rows+1):box(name+'.board',(x,y+.16+k*.53,z),(width,.08,.44),'woodlight',.012)
 for row in range(rows):
  for col in range(5):
   xx=x-width*.4+col*width*.2;yy=y+.24+row*.53
   if (col+row)%3==0:tube(name+'.jar',(xx,yy,z+.03),(xx,yy+.26,z+.03),.085,'cream',8);box(name+'.jarlabel',(xx,yy+.13,z+.12),(.11,.09,.01),'sage',.002)
   elif (col+row)%3==1:box(name+'.packet',(xx,yy+.13,z+.04),(.13,.26,.15),['bread','sage','clothGold'][row%3],.015)
   else:tube(name+'.tin',(xx,yy,z+.02),(xx,yy+.19,z+.02),.075,'terra',8)

def counter(name,x,z,w=1.5,h=.85):
 box(name+'.body',(x,h/2,z),(w,h,.56),'wood',.025);box(name+'.top',(x,h+.035,z),(w+.08,.08,.65),'woodlight',.025)
 for i in range(max(2,int(w/.3))):box(name+'.face_plank',(x-w/2+.15+i*w/max(2,int(w/.3)),h*.48,z+.29),(.018,h*.85,.016),'wooddark',.003)
 return h+.075

def crate(name,x,y,z,w=.8):
 box(name+'.floor',(x,y+.035,z),(w,.07,.55),'wood',.008)
 for s in [-1,1]:
  for yy in [.15,.31]:box(name+'.longwall',(x,y+yy,z+s*.25),(w,.12,.055),'woodlight',.008)
  box(name+'.end',(x+s*(w/2-.03),y+.22,z),(.055,.40,.55),'woodlight',.008)
 return y+.10

def fruit_tray(name,x,y,z,key,w=.8):
 crate(name,x,y,z,w)
 for r in range(3):
  for c in range(5):
   px=x-w*.38+c*w*.19+rng.uniform(-.01,.01);py=y+.37+(r%2)*.025;pz=z-.16+r*.15
   ball(name+'.fruit',(px,py,pz),.115,key,scale=(1,.9,1),sub=2)
   if key=='apple':tube(name+'.stem',(px,py+.06,pz),(px+.01,py+.13,pz),.009,'wooddark',5)

def loaf(name,p,scale=(1,1,1),baguette=False):
 ball(name,p,.18,'bread',scale=(scale[0]*(2.5 if baguette else 1.45),scale[1]*.75,scale[2]*.85),sub=2)
 for i in range(3):
  xx=p[0]+(i-1)*.12*scale[0];tube(name+'.score',(xx-.025,p[1]+.12*scale[1],p[2]-.06),(xx+.035,p[1]+.13*scale[1],p[2]+.06),.014,'breadlight',5)

def chalkboard(x,z,icon='bread'):
 box('board.wood',(x,.60,z),(.66,1.05,.07),'woodlight',.02)
 box('board.slate',(x,.62,z+.045),(.53,.85,.025),'blackboard',.008)
 for s in [-1,1]:tube('board.leg',(x+s*.25,0,z-.12),(x+s*.25,1.12,z+.01),.035,'woodlight',6)
 if icon=='bread':
  ball('board.bread',(x,.74,z+.075),.17,'chalk',scale=(1.35,.7,.06),sub=2)
  for i in range(3):tube('board.score',(x-.10+i*.09,.75,z+.094),(x-.07+i*.09,.83,z+.094),.008,'bread',5)
 elif icon=='cat':
  ball('board.catface',(x,.77,z+.075),.15,'chalk',scale=(1,.9,.05),sub=2)
  for s in [-1,1]:tube('board.ear',(x+s*.10,.84,z+.075),(x+s*.11,.99,z+.075),.075,'chalk',3,r2=0)
 else:
  tube('board.bowl',(x-.19,.76,z+.075),(x+.19,.76,z+.075),.014,'chalk',6)
  for s in [-1,1]:tube('board.bowlleg',(x+s*.18,.75,z+.075),(x+s*.10,.58,z+.075),.014,'chalk',6)
 for yy in [.42,.33]:tube('board.chalkline',(x-.15,yy,z+.078),(x+.15,yy,z+.078),.008,'chalk',5)

def awning(cx,w,kind):
 top=2.82;depth=.95;N=8;T=5;verts=[]
 for layer in range(2):
  for i in range(N+1):
   for t in range(T+1):verts.append(tuple(C((cx-w/2+w*i/N,top-.34*(t/T)**1.5-layer*.035,depth*t/T))))
 stride=(N+1)*(T+1);faces=[];materials=[]
 for i in range(N):
  for t in range(T):
   a=i*(T+1)+t;b=a+T+1;faces.extend([(a,b,b+1,a+1),(a+stride,a+1+stride,b+1+stride,b+stride)]);materials.extend([i%2]*2)
 for i in range(N):
  for t in [0,T]:
   a=i*(T+1)+t;b=a+T+1;faces.append((a,a+stride,b+stride,b));materials.append(i%2)
 for i in [0,N]:
  for t in range(T):
   a=i*(T+1)+t;faces.append((a,a+1,a+1+stride,a+stride));materials.append(0)
 o=addmesh('awning.canopy',verts,faces,'canvas');o.data.materials.append(M[kind])
 for f,mi in zip(o.data.polygons,materials):f.material_index=mi
 # Individual thick scallop segments meet each other with 1mm side insertion, no coplanar overlays.
 for i in range(N):
  xx=cx-w/2+(i+.5)*w/N;bottom=2.24
  box('awning.valance',(xx,2.37,.95),(w/N+.001,.24,.045),'canvas' if i%2==0 else kind,.035)
 box('awning.wallbar',(cx,2.82,.015),(w+.04,.10,.10),'iron',.014)
 for s in [-1,1]:
  x=cx+s*(w/2-.12);tube('awning.arm',(x,2.65,.02),(x,2.46,.94),.025,'iron',7)

def upper(cx,w,style,index):
 # True wide hole in front wall; one residential floor above shop floor.
 left=cx-w/2;right=cx+w/2;wl=cx-(w-.8)/2;wr=cx+(w-.8)/2
 box('upper.leftpier',((left+wl)/2,4.85,-.13),(wl-left,3.5,.30),style,.025)
 box('upper.rightpier',((right+wr)/2,4.85,-.13),(right-wr,3.5,.30),style,.025)
 box('upper.belowwindow',(cx,3.55,-.13),(w-.77,.90,.30),style,.02)
 box('upper.abovewindow',(cx,6.30,-.13),(w-.77,.60,.30),style,.02)
 box('upper.rearwall',(cx,4.85,-2.7),(w,3.5,.20),'plaster',.02)
 box('upper.floor',(cx,3.14,-1.35),(w,.16,2.9),'sandstone',.025)
 for s in [-1,1]:box('upper.side',(cx+s*(w/2-.09),4.85,-1.4),(.18,3.5,2.8),style,.02)
 box('roof.cap',(cx,6.62,-1.3),(w+.12,.19,3.0),'sandstone',.025)
 # Reveals/stiles, mullions and top light; absolutely no opaque front window plane.
 for x in [wl,wr,cx]:box('window.vertical',(x,5.0,.025),(.065,2.02,.10),'green' if index%2==0 else 'iron',.008)
 for yy in [4.,5.67,6.0]:box('window.horizontal',(cx,yy,.025),(w-.72,.065,.10),'green' if index%2==0 else 'iron',.008)
 # Curtains beside opening, not blocking all visible interior.
 for s in [-1,1]:
  for i in range(8):box('window.curtain',(cx+s*(w/2-.55)-s*i*.060,5.02,-.12),(.055,1.85,.06),'linen',.012)
 shelf('residential.books',cx,-2.40,w*.62,y=3.25,rows=3)
 for row in range(3):
  for j in range(9):
   box('residential.book',(cx-w*.24+j*w*.06,3.66+row*.53,-2.13),(.11,.28+(j%3)*.035,.20),['woodlight','red','sage','clothBlue'][j%4],.008)
 plant('residential.innerplant',cx+w*.27,3.22,-1.82,1.15)
 pendant(cx,5.61,-1.1,'residential.light')
 # Large shallow balcony at lower window line; doors open behind it.
 box('balcony.deck',(cx,3.91,.42),(w-.45,.18,.94),'sandstone',.025)
 railtop=4.85
 for j in range(13):
  x=cx-(w-.58)/2+j*(w-.58)/12;box('balcony.bar',(x,4.43,.83),(.033,.90,.033),'iron',.005)
 box('balcony.rail',(cx,4.87,.83),(w-.46,.065,.065),'iron',.012)
 for s in [-1,1]:
  x=cx+s*(w-.52)/2;box('balcony.side_rail',(x,4.87,.40),(.065,.065,.90),'iron',.008)
  for z in [.08,.35,.60]:box('balcony.side_bar',(x,4.43,z),(.033,.90,.033),'iron',.005)
  tube('balcony.bracket',(x,3.5,.04),(x,3.93,.72),.04,'iron',8)
 plant('balcony.pot',cx-w*.28,4.0,.46,.9)
 plant('balcony.pot2',cx+w*.28,4.0,.47,.72)
 vine('balcony.vine',cx+w*.34,4.25,.89,1.20)
 plant('balcony.middlepot',cx-.18,4.0,.54,.70)
 if index%2==0:vine('balcony.leftvine',cx-w*.30,4.22,.88,.9)
 # Roof rail and planters, modestly above cap; supports in roof cap.
 for j in range(11):box('roof.railpost',(cx-(w-.4)/2+j*(w-.4)/10,7.04,.02),(.025,.70,.025),'iron',.003)
 box('roof.handrail',(cx,7.38,.02),(w-.35,.045,.045),'iron',.007)
 plant('roof.pot',cx+w*.25,6.72,-.15,.8)
 if index in [0,2,4]:
  ax=cx+w*.32;ay=5.8
  box('aircon.case',(ax,ay,.27),(.66,.48,.35),'cream',.025)
  tube('aircon.disc',(ax-.12,ay,.448),(ax-.12,ay,.466),.16,'iron',18)
  ring('aircon.guard',(ax-.12,ay,.47),.15,.012,'silver',18,6)
  for k in range(6):box('aircon.grille',(ax-.12,ay-.12+k*.047,.481),(.25,.012,.014),'cream',.002)
  tube('aircon.pipe',(ax+.29,ay-.08,.18),(ax+.37,3.38,.18),.025,'silver',8)
 # Silver drainpipes at facade edge join fittings, street-facing but not over the openings.
 px=cx-w/2+.16
 for ya,yb in [(.2,2.65),(2.65,3.4),(3.4,6.5)]:tube('drain.pipe',(px,ya,.13),(px,yb,.13),.043,'silver',8)
 for yy in [.6,2.4,3.7,5.5]:box('drain.clip',(px,yy,.115),(.13,.05,.12),'iron',.005)
 if index==4:
  tube('laundry.line',(cx-w*.32,5.48,.70),(cx+w*.30,5.48,.70),.012,'woodlight',6)
  for j in range(4):
   xx=cx-w*.25+j*w*.16;box('laundry.cloth',(xx,5.08,.72),(.45,.76,.025),'linen' if j%2==0 else 'clothBlue',.025)
   for s in [-1,1]:box('laundry.peg',(xx+s*.15,5.47,.72),(.035,.08,.04),'woodlight',.004)

def shell(cx,w,style,index):
 left=cx-w/2;right=cx+w/2
 box('shop.backwall',(cx,1.50,-2.85),(w,3.,.20),'interior',.02)
 for s in [-1,1]:box('shop.sidewall',(cx+s*(w/2-.10),1.5,-1.4),(.20,3.,2.95),style,.02)
 box('shop.floor',(cx,-.045,-1.4),(w,.09,2.9),'wooddark',.01)
 box('shop.ceiling',(cx,3.01,-1.4),(w,.15,3.),'sandstone',.02)
 for s in [-1,1]:box('shop.frontpier',(cx+s*(w/2-.13),1.5,.015),(.26,3.,.30),style,.022)
 box('shop.header',(cx,2.91,.04),(w,.30,.30),style,.018)
 box('shop.threshold',(cx,.035,.035),(w-.30,.07,.28),'sandstone',.012)
 # Storefront frames are actual narrow solids around an unobstructed shop opening.
 for s in [-1,1]:box('shop.verticalframe',(cx+s*(w/2-.30),1.37,.07),(.08,2.67,.10),'green' if index%2==0 else 'wood',.009)
 box('shop.transom',(cx,2.66,.07),(w-.50,.09,.12),'wood',.01)
 for s in [-1,1]:box('shop.lowplinth',(cx+s*(w*.30),.30,.035),(w*.30,.54,.14),'wood',.016)
 # Blank narrow sign recess, preserving image's restrained signage.
 box('shop.signback',(cx,2.92,.24),(w-.45,.24,.07),'woodlight',.012)
 box('shop.signface',(cx,2.92,.282),(w-.55,.15,.025),'sage',.005)
 upper(cx,w,style,index)

def cat(name,x,y,z,key='catginger',sleep=False):
 ball(name+'.body',(x,y+.16,z),.25,key,scale=(1.25,.62,.7),sub=2)
 ball(name+'.head',(x+.20,y+.25,z+.05),.15,key,scale=(1,.95,.9),sub=2)
 for s in [-1,1]:
  tube(name+'.ear',(x+.20+s*.09,y+.33,z+.05),(x+.20+s*.10,y+.49,z+.05),.075,key,3,r2=.005)
  ball(name+'.eye',(x+.20+s*.055,y+.27,z+.18),.014,'rubber',scale=(1,.35 if sleep else 1,.5))
  ball(name+'.paw',(x+s*.12,y+.055,z+.13),.065,'catwhite',scale=(1,.6,.8))
 ball(name+'.nose',(x+.20,y+.23,z+.193),.018,'catgray',scale=(1,.7,.4))
 tube(name+'.tail',(x-.20,y+.18,z),(x-.42,y+.31,z+.03),.06,key,8,r2=.03)

def bicycle(name,x,y,z,s=1,hanging=False):
 rear=(x-.55*s,y+.34*s,z);front=(x+.55*s,y+.34*s,z);seat=(x-.22*s,y+.85*s,z);head=(x+.35*s,y+.83*s,z);crank=(x-.03*s,y+.37*s,z)
 for label,p in [('rear',rear),('front',front)]:
  ring(name+'.'+label+'.tire',p,.30*s,.04*s,'rubber',20,6);ring(name+'.'+label+'.rim',p,.285*s,.012*s,'silver',20,6)
  for i in range(8):
   a=i*math.pi/4;tube(name+'.spoke',p,(p[0]+math.sin(a)*.285*s,p[1]+math.cos(a)*.285*s,z),.004*s,'silver',5)
  ball(name+'.hub',p,.035*s,'silver')
 for a,b in [(rear,seat),(seat,crank),(crank,rear),(crank,head),(head,seat),(head,front)]:tube(name+'.frame',a,b,.026*s,'green',8)
 tube(name+'.seatpost',seat,(seat[0],seat[1]+.07*s,z),.022*s,'silver',8);box(name+'.saddle',(seat[0],seat[1]+.10*s,z),(.28*s,.07*s,.15*s),'rubber',.015)
 tube(name+'.stem',head,(head[0],head[1]+.19*s,z),.019*s,'silver',7);tube(name+'.handlebar',(head[0],head[1]+.19*s,z-.19*s),(head[0],head[1]+.19*s,z+.19*s),.022*s,'silver',7)
 tube(name+'.crank',crank,(crank[0]+.10*s,crank[1]-.08*s,z),.012*s,'silver',6);box(name+'.pedal',(crank[0]+.10*s,crank[1]-.08*s,z+.04*s),(.13*s,.03*s,.09*s),'rubber',.004)

# ---- Five shop-specific interiors ----
SHOPS=[('grocery',-8.25,4.,'plaster','clothGreen'),('bakery',-4.35,3.8,'cream','clothGold'),('noodles',.9,3.5,'brick','clothGold'),('catcafe',4.55,3.8,'plaster','clothGreen'),('repair',8.35,3.8,'cream','clothBlue')]
for index,(name,cx,w,style,cloth) in enumerate(SHOPS):
 zone=name;shell(cx,w,style,index)
 if name!='noodles':awning(cx,w-.36,cloth)
 shelf('back.shelf',cx-w*.24,-2.47,w*.34,rows=3)
 if name=='grocery':
  shelf('right.shelf',cx+w*.24,-2.48,w*.32,rows=3)
  counter('rear.counter',cx,-1.55,w*.60,.78)
  # Layered produce counters, apples/oranges/greens visible directly from street.
  counter('produce.frontcounter',cx,.10,w-.55,.52)
  counter('produce.rearcounter',cx,-.40,w-.55,.86)
  for k,key in enumerate(['fruitred','orange','apple']):fruit_tray('produce.display',cx-w*.32+k*w*.31,.52,.10,key,w*.29)
  for k,key in enumerate(['lemon','fruitred','orange']):fruit_tray('produce.tier',cx-w*.32+k*w*.31,.88,-.36,key,w*.28)
  crate('empty.crate',cx-w*.31,.0,.65,.73);crate('side.crate',cx+w*.32,0,.64,.60)
  for i in range(5):ball('cabbage',(cx+w*.32+(i%3-1)*.12,.45,.54+(i//3)*.16),.16,'leaflight',sub=2)
  box('blue.producebox',(cx-w*.28,.16,.95),(.65,.30,.40),'blue',.015)
  pendant(cx,2.35,-.78,'shop.pendant')
 elif name=='bakery':
  shelf('right.shelf',cx+w*.24,-2.47,w*.32,rows=3)
  counter('bakery.case',cx+.25,-.23,2.28,.75)
  # Four open timber/glass mullions; no opaque sheet, contents visible.
  for s in [-1,1]:box('case.upright',(cx+.25+s*1.14,1.37,-.1),(.06,1.15,.08),'woodlight',.009)
  for yy in [.82,1.34,1.89]:box('case.shelf',(cx+.25,yy,-.12),(2.30,.055,.72),'woodlight',.009)
  for level in range(3):
   for col in range(5):loaf('case.loaf',(cx-.65+col*.43,.94+level*.52,-.03),scale=(.72,.72,.72))
  tube('baguette.basket',(cx-w*.30,.02,.32),(cx-w*.30,.48,.32),.25,'woodlight',12,r2=.30)
  for i in range(6):
   ob=ball('baguette',(cx-w*.30+(i%3-.9)*.12,.87+(i%2)*.08,.32+(i//3-.5)*.12),.18,'breadlight',scale=(.5,2.8,.5),sub=2)
  chalkboard(cx-w*.20,.94,'bread')
  for xx in [cx-.55,cx+.65]:pendant(xx,2.33,-.76,'shop.pendant')
 elif name=='noodles':
  # Small wood sloped cover and hanging split noren with a graphic bowl.
  cover=box('noren.woodcanopy',(cx,2.69,.45),(w-.20,.12,1.10),'wood',.015);cover.rotation_euler.x=math.radians(15)
  for i in range(3):box('noren.panel',(cx-.96+i*.96,2.13,.68),(.94,.77,.035),'red',.025)
  tube('noren.bowlrim',(cx-.28,2.16,.708),(cx+.28,2.16,.708),.014,'chalk',7)
  for s in [-1,1]:tube('noren.bowlside',(cx+s*.27,2.15,.708),(cx+s*.16,1.97,.708),.014,'chalk',6)
  tube('noren.bowlbase',(cx-.16,1.97,.708),(cx+.16,1.97,.708),.014,'chalk',6)
  for i in range(2):tube('noren.chopstick',(cx-.06+i*.10,2.19,.708),(cx+.19+i*.1,2.39,.708),.013,'chalk',6)
  h=counter('noodle.counter',cx,.12,2.35,.90)
  for xx in [cx-.64,cx,cx+.64]:
   tube('stool.leg',(xx,0,.86),(xx,.55,.86),.06,'iron',8);tube('stool.seat',(xx,.53,.86),(xx,.60,.86),.22,'red',12)
   tube('noodle.bowl',(xx,h,-.03),(xx,h+.13,-.03),.09,'cream',10,r2=.15)
  box('kitchen.stove',(cx+.68,.6,-1.88),(1.02,1.15,.65),'iron',.025)
  for xx in [cx+.35,cx+.92]:
   tube('kitchen.stockpot',(xx,1.18,-1.84),(xx,1.50,-1.84),.21,'silver',12);tube('kitchen.lid',(xx,1.50,-1.84),(xx,1.53,-1.84),.225,'silver',12)
   ball('kitchen.lidknob',(xx,1.57,-1.84),.05,'rubber')
  tube('kitchen.rail',(cx-.5,2.16,-2.36),(cx+1.12,2.16,-2.36),.025,'silver',8)
  for i in range(4):
   xx=cx-.3+i*.34;tube('utensil.handle',(xx,2.13,-2.31),(xx,1.82,-2.31),.018,'silver',6);ball('utensil.spoon',(xx,1.75,-2.31),.08,'silver',scale=(.7,1.3,.25))
  chalkboard(cx-w*.30,1.0,'bowl');pendant(cx,2.35,-.74,'shop.pendant')
 elif name=='catcafe':
  counter('cafe.counter',cx-w*.26,-.65,1.22,.82)
  tube('coffee.machine',(cx-w*.26,.90,-.70),(cx-w*.26,1.21,-.70),.17,'silver',12)
  for p in [(cx+.4,.58,-.12),(cx+1.03,1.16,-.22),(cx+.43,1.75,-.40)]:
   tube('cattree.post',(p[0],0,p[2]),(p[0],p[1],p[2]),.075,'woodlight',10);tube('cattree.platform',(p[0],p[1]-.035,p[2]),(p[0],p[1]+.035,p[2]),.42,'woodlight',14)
  cat('cat.sleep',cx+.42,.62,-.12,'catwhite',True);cat('cat.top',cx+.43,1.79,-.4,'catginger');cat('cat.bottom',cx+.7,.04,.68,'catcream')
  chalkboard(cx+w*.34,.82,'cat');pendant(cx,2.37,-.74,'shop.pendant')
 else:
  box('repair.pegboard',(cx,1.57,-2.64),(2.8,1.82,.12),'wooddark',.025)
  for xx in [cx-.72,cx+.66]:
   ring('repair.hangingtire',(xx,1.90,-2.50),.43,.05,'rubber',20,6);ring('repair.hangingrim',(xx,1.90,-2.49),.416,.014,'silver',20,6)
   tube('repair.hook',(xx,2.40,-2.65),(xx,2.40,-2.37),.022,'silver',7)
  for i in range(6):
   xx=cx-.8+i*.30;tube('repair.tool',(xx,1.32,-2.45),(xx,1.58,-2.45),.023,'silver',6);ring('repair.wrenchend',(xx,1.59,-2.45),.043,.012,'silver',10,5)
  counter('repair.bench',cx,-1.7,2.54,.8)
  bicycle('repair.bike',cx+.2,.025,.25,1.05)
  bicycle('repair.backbike',cx-.35,.035,-1.04,.85)
  pendant(cx,2.36,-.74,'shop.pendant')
 # Additional visible street plants at shop edges sit outside clear center walking strip.
 plant('street.planter',cx-w*.37,0,.61,.85)
 plant('street.planter2',cx+w*.38,0,.63,.65)

# ---- Brick facade inset joints and small wall texture from actual geometric brick tiles ----
# Original brick building gets a thin offset mosaic, seated against continuous supporting wall.
zone='noodles';cx=.9;w=3.5
for row in range(26):
 yy=3.18+row*.13
 for col in range(12):
  xx=cx-w/2+.08+col*.30+(row%2)*.15
  if xx>cx+w/2-.08:continue
  # Exclude true large window aperture and balcony foreground.
  if 4.0<yy<6.0 and abs(xx-cx)<(w-.8)/2+.09:continue
  box('facade.brick',(xx,yy,.035),(.288,.118,.045),'brick',.007)

# ---- Alley depth: near arch fragments, lamps and no bright billboard background ----
zone='alley';ax=-1.65
box('alley.floor',(ax,-.035,-4.5),(1.6,.07,9),'sandstone',.01)
box('alley.leftwall',(-2.43,1.45,-3.5),(.12,2.9,6.7),'plaster',.02)
box('alley.rightwall',(-.87,1.45,-3.5),(.12,2.9,6.7),'brick',.02)
box('alley.bridge',(ax,3.08,-1.2),(1.6,.20,1.5),'sandstone',.025)
plant('alley.plant',-2.10,0,-.35,.75);vine('alley.vine',-2.25,3.26,.15,2.3)
# Wall-mounted small fixture geometry, no runtime light embedded.
tube('alley.lamp.arm',(-2.37,2.65,-.2),(-1.94,2.65,.12),.025,'iron',8)
tube('alley.lamp.shade',(-1.94,2.48,.12),(-1.94,2.63,.12),.20,'iron',12,r2=.07);ball('alley.lamp.bulb',(-1.94,2.46,.12),.075,'bulb')

# ---- Pavement and real tactile-strip relief ----
zone='street'
box('pavement.foundation',(0,-.14,2.1),(22.,.22,5.0),'mortar',.01)
for r in range(8):
 for c in range(35):
  x=-10.80+c*.64+(r%2)*.32;z=-.08+r*.60
  if x>10.80:continue
  key=['sandstone','cream','plaster'][((c*13+r*7)%11)//4]
  box('pavement.tile',(x,-.025,z),(.633,.05,.592),key,.008)
for c in range(37):
 x=-10.8+c*.6
 box('curb',(x,-.09,4.72),(.593,.28,.30),'sandstone',.015)
for c in range(66):
 x=-10.7+c*.33;box('tactile.base',(x,.007,3.65),(.324,.015,.42),'clothGold',.004)
 for rr in [-.12,0,.12]:box('tactile.ridge',(x,.019,3.65+rr),(.27,.012,.025),'breadlight',.005)
for x in [-8.9,-.1,7.5]:
 tube('bollard.post',(x,0,4.04),(x,.77,4.04),.075,'iron',10);tube('bollard.foot',(x,0,4.04),(x,.065,4.04),.115,'iron',10)
 tube('bollard.reflector',(x,.60,4.04),(x,.66,4.04),.078,'sandstone',10);ball('bollard.cap',(x,.77,4.04),.078,'iron',scale=(1,.6,1))
# Foreground flowers beside frame edges, not blocking shop interiors.
for xx in [-10.5,10.4]:
 for i in range(8):
  x=xx+rng.uniform(-.45,.45);z=4.12+rng.uniform(-.25,.25);plant('foreground.leaf',x,0,z,.7,False)
  yy=.30+rng.random()*.18
  for j in range(5):
   a=j*2*math.pi/5;ball('foreground.flower',(x+math.cos(a)*.07,yy,z+math.sin(a)*.07),.09,'purple' if xx<0 else 'pink')

# ---- Large left canopy, real branch and cluster geometry casts shadows ----
zone='tree'
root=(-10.3,0,1.45);fork=(-10.15,4.35,1.05)
tube('trunk',root,fork,.29,'bark',10,r2=.20)
branches=[((-10.1,3.7,1.1),(-7.4,6.8,1.25)),((-10.0,4.2,1.0),(-10.9,7.2,1.4)),((-8.8,5.2,1.15),(-5.9,7.6,1.0)),((-9.6,4.7,1.07),(-8.8,7.4,2.1))]
for i,(a,b) in enumerate(branches):tube('branch',a,b,.17,'bark',8,r2=.065)
for i in range(22):
 x=-10.7+(i%8)*.78;y=7.0+math.sin(i*2.3)*.72;z=.90+math.sin(i*1.4)*.90
 ball('crown.cluster',(x,y,z),.62,['leaf','leaflight','leafdark'][i%3],scale=(1.18,.73,1.0),sub=1)
# Small leaves hanging down from top-left silhouette.
for i in range(9):ball('crown.leaf',(-10.6+i*.36,6.13+math.sin(i)*.35,1.15),.23,'leaflight',scale=(.7,1.2,.45))

# Forward-reaching crown: real leaves near street edge intercept the nominated sun.
tube('street.branch',(-10.10,4.15,1.08),(-9.45,5.52,3.55),.14,'bark',8,r2=.065)
tube('street.twig',(-9.45,5.52,3.55),(-7.75,5.95,4.10),.065,'bark',7,r2=.025)
for i in range(7):
 ball('street.crown',(-9.7+i*.43,5.62+math.sin(i*.9)*.28,3.72+(i%3)*.19),.52,['leaf','leaflight','leafdark'][i%3],scale=(1.10,.66,1),sub=1)

# Set UVs from actual world-space surfaces, keep simple PBR flat colors in this first geometry pass.
for zname,obs in objects.items():
 col=bpy.data.collections.new(zname);scene.collection.children.link(col)
 for o in obs:
  for old in list(o.users_collection):old.objects.unlink(o)
  col.objects.link(o)
  # Recalculate consistent shell winding; no filling intentional apertures.
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
  uv=o.data.uv_layers.new(name='UVMap')
  for poly in o.data.polygons:
   n=o.matrix_world.to_3x3()@poly.normal;axis=max(range(3),key=lambda k:abs(n[k]))
   for li in poly.loop_indices:
    p=o.matrix_world@o.data.vertices[o.data.loops[li].vertex_index].co
    uv.data[li].uv=((p.y if axis==0 else p.x)/2,(p.y if axis==2 else p.z)/2)
# Physically shaded original detail maps; pigment/pores/weave only, never illumination.
for key,m in M.items():
 texpath=ROOT/'textures'/(key+'-albedo.png')
 if not texpath.exists():continue
 nodes=m.node_tree.nodes;links=m.node_tree.links;bs=nodes.get('Principled BSDF')
 tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(texpath));tex.extension='REPEAT';links.new(tex.outputs['Color'],bs.inputs['Base Color'])
 nt=nodes.new('ShaderNodeTexImage');nt.image=bpy.data.images.load(str(ROOT/'textures'/(key+'-normal.png')));nt.image.colorspace_settings.name='Non-Color';nt.extension='REPEAT'
 nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.28;links.new(nt.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bs.inputs['Normal'])
 tex.image.pack();nt.image.pack()
# Record furniture real world bounds before merging.
def ybounds(obs):
 pts=[o.matrix_world@v.co for o in obs for v in o.data.vertices]
 return {'min':[min(p.x for p in pts),min(p.z for p in pts),min(-p.y for p in pts)],'max':[max(p.x for p in pts),max(p.z for p in pts),max(-p.y for p in pts)]} if pts else None
furniture={}
for n,obs in objects.items():
 if n not in [v[0] for v in SHOPS]:continue
 furniture[n]={'counters':ybounds([o for o in obs if ('counter' in o.name or 'case' in o.name or 'bench' in o.name) and ('.body' in o.name or '.top' in o.name)]),'backShelves':ybounds([o for o in obs if 'shelf' in o.name and 'residential' not in o.name]),'staffClearancePoint':{'grocery':[-8.25,0,-1.10],'bakery':[-4.35,0,-1.24],'noodles':[.75,0,-1.10],'catcafe':[4.1,0,-1.2],'repair':[8.25,0,-.65]}[n],'groundTopY':0}
# Save detailed editable source before drawcall-friendly merging.
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'reference-street-source-v2.blend'))
# Merge per semantic zone and material to keep the GLB manageable, preserving names for parent.
for zname,obs in objects.items():
 groups={}
 for o in obs:
  # Canopy includes two materials; retain it as its own mesh.
  key=tuple(m.name for m in o.data.materials);groups.setdefault(key,[]).append(o)
 for key,group in groups.items():
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0]
  if len(group)>1:bpy.ops.object.join()
  bpy.context.object.name=zname+'__'+'__'.join(key)
# Triangulate explicit ngons for reliable exported tangent calculation.
for o in list(scene.objects):
 if o.type=='MESH':
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
# Export no cameras, no lights; all visual shading remains runtime-driven.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'street-reference-v2.glb'),export_format='GLB',use_selection=True,export_yup=True,export_normals=True,export_tangents=True,export_materials='EXPORT',export_animations=False,export_cameras=False,export_lights=False)
# Exact whole scene evaluated bounds in glTF coordinates.
lo=[1e9]*3;hi=[-1e9]*3;tris=0
for o in scene.objects:
 if o.type!='MESH':continue
 o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
 for v in o.data.vertices:
  p=o.matrix_world@v.co;q=(p.x,p.z,-p.y)
  for k in range(3):lo[k]=min(lo[k],q[k]);hi[k]=max(hi[k],q[k])
contract={'schema':'game628.reference.street.v1','units':'meters','axis':'Y up; +Z street-facing','model':'street-reference-v2.glb','bounds':{'min':lo,'max':hi},'shopzones':[{'id':n,'center':[x,0,-1.4],'width':w,'interior':{'min':[x-w/2,0,-2.8],'max':[x+w/2,3,0]},'frontOpening':{'min':[x-w/2+.3,.1,0],'max':[x+w/2-.3,2.60,0]}} for n,x,w,_,_ in SHOPS],'alley':{'min':[-2.45,0,-8],'max':[-.85,3.1,0]},'street':{'min':[-10.25,0,0],'max':[10.25,0,5]},'residentialY':[3.1,6.6],'runtimeLightSuggestions':[{'id':n+'.interior','type':'spot','position':[x,2.30,-.74],'target':[x,.55,-.65],'distance':2.30,'angle':.58,'penumbra':.55,'castShadowRecommendation':n in ['bakery','noodles'],'note':'cone footprint remains inside shop width; bulb emissive is weak geometry only'} for n,x,w,_,_ in SHOPS if n!='grocery'],'furnitureAndClearance':furniture,'floorTopY':0,'recommendedOverviewCamera':{'position':[0,4.6,25],'target':[0,3.4,0],'verticalFovDegrees':28},'allPendantGeometry':lights,'materialColorSpace':'palette sRGB values converted to linear factors; PNG albedo remains sRGB; normals non-color','embeddedLights':0,'triangles':tris,'sourceObjects':sum(len(v) for v in objects.values()),'exportedMeshes':len([o for o in scene.objects if o.type=='MESH']),'reference':'generated_images/exec-e200c4ec-58a4-40bd-a8e6-2c5cfc5b3c19.png','status':'first_complete_geometry_draft_reimport_review_pending','sha256':hashlib.sha256((OUT/'street-reference-v2.glb').read_bytes()).hexdigest(),'limitations':['No human characters in this static asset; animation owner handles residents.','Original small-scale PBR pigment/pore/weave maps; no baked sunlight.','Distant skyline omitted from shadow-bounded near-scene GLB.','Not a pixel-exact reproduction of concept illustration; geometry and runtime lighting must be reviewed.']}
(OUT/'scene-contract-v2.json').write_text(json.dumps(contract,indent=2));(ROOT/'v2-export-contract.json').write_text(json.dumps(contract,indent=2))
print('FIRST_COMPLETE_STREET_READY',contract['sha256'],tris,flush=True)
