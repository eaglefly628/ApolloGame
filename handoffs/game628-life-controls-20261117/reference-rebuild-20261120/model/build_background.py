import json,struct,math,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent.parent/'public/art/reference-rebuild-20261120/scene'
cols=[(.43,.55,.58),(.49,.61,.64),(.54,.66,.69),(.58,.68,.69),(.39,.52,.48),(.45,.57,.52)]
groups=[([],[]) for _ in cols]
def poly(points,faces,mat):
 pp,nn=groups[mat]
 for face in faces:
  a,b,c=[points[i] for i in face[:3]];u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];l=math.sqrt(sum(i*i for i in n));n=[i/l for i in n]
  for k in range(1,len(face)-1):
   for i in [face[0],face[k],face[k+1]]:pp.extend(points[i]);nn.extend(n)
def box(x,y,z,w,h,d,mi):
 p=[(x+sx*w/2,y+sy*h/2,z+sz*d/2) for sx in [-1,1] for sy in [-1,1] for sz in [-1,1]]
 poly(p,[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)],mi)
# Low detailed skyline is deliberately a separate non-shadow background asset.
for i in range(20):
 x=-5.1+i*.37;h=1.0+(i*13%11)*.17
 box(x,2.9+h/2,-21-(i%3)*.3,.25+(i%2)*.07,h,.38,i%4)
 if i%4==0:box(x,2.9+h+.05,-21-(i%3)*.3,.045,.35,.045,i%4)
# Landmark-like original thin signal tower, no copied third-party silhouette.
box(-1.42,5.75,-22,.10,3.4,.10,1);box(-1.42,7.5,-22,.035,.65,.035,2)
# Closed faceted hills behind skyline.
for x,peak,mi in [(-4.2,6.7,4),(-.9,7.8,5),(2.4,6.2,4)]:
 poly([(x-3,2.4,-27),(x+3,2.4,-27),(x+3,2.4,-31),(x-3,2.4,-31),(x-.5,peak,-29)],[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(0,3,2,1)],mi)
binary=bytearray();views=[];acc=[];prims=[]
def accessor(data,typ):
 while len(binary)%4:binary.append(0)
 start=len(binary);binary.extend(struct.pack('<'+'f'*len(data),*data));views.append({'buffer':0,'byteOffset':start,'byteLength':len(binary)-start,'target':34962});n=3;row={'bufferView':len(views)-1,'componentType':5126,'count':len(data)//n,'type':typ,'min':[min(data[i::n]) for i in range(n)],'max':[max(data[i::n]) for i in range(n)]};acc.append(row);return len(acc)-1
for mi,(p,n) in enumerate(groups):
 if not p:continue
 prims.append({'attributes':{'POSITION':accessor(p,'VEC3'),'NORMAL':accessor(n,'VEC3')},'material':mi,'mode':4})
def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
j={'asset':{'version':'2.0','generator':'Original offline Game628 background study'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0,'name':'optional_distant_city_hills_NO_CAST_SHADOW'}],'meshes':[{'name':'distant_silhouette','primitives':prims}],'extensionsUsed':['KHR_materials_unlit'],'materials':[{'extensions':{'KHR_materials_unlit':{}},'name':'haze_'+str(i),'pbrMetallicRoughness':{'baseColorFactor':[*(linear(c) for c in col),1],'metallicFactor':0,'roughnessFactor':1}} for i,col in enumerate(cols)],'buffers':[{'byteLength':len(binary)}],'bufferViews':views,'accessors':acc}
jb=json.dumps(j,separators=(',',':')).encode();jb+=b' '*(-len(jb)%4);raw=struct.pack('<III',0x46546c67,2,28+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary
p=OUT/'background-reference.glb';p.write_bytes(raw);(OUT/'background-contract.json').write_text(json.dumps({'model':p.name,'sha256':hashlib.sha256(raw).hexdigest(),'transform':'identity; same coordinates as near street','materialMode':'KHR_materials_unlit','runtimeCastReceiveFlagsAvailable':False,'requestedFlagsNotApplied':True,'geometryMaxZ':-20.81,'nearStreetMinZ':-9,'sunDirectionZMustRemainNegative':True,'shadowReasoning':'With directional ray dirZ<0, background geometry entirely behind near scene can only project farther negative Z, not onto near street. Runtime local light ranges2.3 cannot reach it.','collision':False,'mustKeepSeparateFromNearCasterBounds':True,'purpose':'Original distant skyline/hills seen through open alley; optional ambient diffuse, no embedded lights or baked illumination'},indent=2));print('BACKGROUND_READY',len(raw))
