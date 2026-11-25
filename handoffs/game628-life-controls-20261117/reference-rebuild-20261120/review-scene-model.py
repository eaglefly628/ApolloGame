"""Independent GLB bounds, open-front rays and pavement-contact probes; no asset writes."""
import hashlib
import itertools
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public/art/reference-rebuild-20261120/scene'
active = json.loads((ROOT / 'public/scenes/reference-street.json').read_text())
model_name = next(a['src'].split('/')[-1] for a in active['assets'] if a['key'] == 'reference-street')
contract_name = model_name.replace('street-reference', 'scene-contract').replace('.glb', '.json')
contract = json.loads((PUBLIC / contract_name).read_text())
raw = (PUBLIC / contract['model']).read_bytes()
assert hashlib.sha256(raw).hexdigest() == contract['sha256']
length = struct.unpack_from('<I', raw, 12)[0]
g = json.loads(raw[20:20+length]); offset = 20+length
binary = raw[offset+8:offset+8+struct.unpack_from('<I', raw, offset)[0]]
cache = {}

def accessor(index):
    if index in cache: return cache[index]
    a = g['accessors'][index]; b = g['bufferViews'][a['bufferView']]
    code = {5121:'B',5123:'H',5125:'I',5126:'f'}[a['componentType']]
    count = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']]
    stride = b.get('byteStride', struct.calcsize('<'+code)*count)
    start = b.get('byteOffset',0)+a.get('byteOffset',0)
    cache[index] = [struct.unpack_from('<'+code*count,binary,start+i*stride) for i in range(a['count'])]
    return cache[index]

I = [[int(i==j) for j in range(4)] for i in range(4)]
def mul(a,b): return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def matrix(n):
    if 'matrix' in n: return [[n['matrix'][j*4+i] for j in range(4)] for i in range(4)]
    x,y,z,w=n.get('rotation',[0,0,0,1]); sx,sy,sz=n.get('scale',[1,1,1]); tx,ty,tz=n.get('translation',[0,0,0])
    return [[(1-2*y*y-2*z*z)*sx,(2*x*y-2*z*w)*sy,(2*x*z+2*y*w)*sz,tx],[(2*x*y+2*z*w)*sx,(1-2*x*x-2*z*z)*sy,(2*y*z-2*x*w)*sz,ty],[(2*x*z-2*y*w)*sx,(2*y*z+2*x*w)*sy,(1-2*x*x-2*y*y)*sz,tz],[0,0,0,1]]
def point(m,p): return tuple(sum(m[i][j]*(*p,1)[j] for j in range(4)) for i in range(3))
triangles=[]; positions=[]
def walk(index,parent):
    n=g['nodes'][index]; m=mul(parent,matrix(n))
    if 'mesh' in n:
        for p in g['meshes'][n['mesh']]['primitives']:
            assert p.get('mode',4)==4
            vertices=[point(m,v) for v in accessor(p['attributes']['POSITION'])]
            assert all(math.isfinite(x) for v in vertices for x in v)
            positions.extend(vertices)
            ids=[v[0] for v in accessor(p['indices'])] if 'indices' in p else list(range(len(vertices)))
            for i in range(0,len(ids),3): triangles.append((n.get('name',''),vertices[ids[i]],vertices[ids[i+1]],vertices[ids[i+2]]))
    for child in n.get('children',[]): walk(child,m)
for index in g['scenes'][g.get('scene',0)]['nodes']: walk(index,I)
actual={'min':[min(v[i] for v in positions) for i in range(3)],'max':[max(v[i] for v in positions) for i in range(3)]}
for side in ('min','max'):
    for a,b in zip(actual[side],contract['bounds'][side]): assert abs(a-b)<1e-4, (side,a,b)
assert len(triangles)==contract['triangles']
assert not g.get('extensions',{}).get('KHR_lights_punctual',{}).get('lights'), 'Unexpected embedded runtime lights'
boxes=[(tuple(min(v[i] for v in (a,b,c)) for i in range(3)),tuple(max(v[i] for v in (a,b,c)) for i in range(3))) for _,a,b,c in triangles]

def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def hits(origin,direction,max_distance):
    output=[]
    for (name,a,b,c),(low,high) in zip(triangles,boxes):
        if direction[2] and not (low[0]-1e-7<=origin[0]<=high[0]+1e-7 and low[1]-1e-7<=origin[1]<=high[1]+1e-7): continue
        if direction[1] and not (low[0]-1e-7<=origin[0]<=high[0]+1e-7 and low[2]-1e-7<=origin[2]<=high[2]+1e-7): continue
        if direction[0] and not (low[1]-1e-7<=origin[1]<=high[1]+1e-7 and low[2]-1e-7<=origin[2]<=high[2]+1e-7): continue
        e1,e2=sub(b,a),sub(c,a); h=cross(direction,e2); det=dot(e1,h)
        if abs(det)<1e-9: continue
        s=sub(origin,a); u=dot(s,h)/det
        if u < -1e-7 or u > 1.0000001: continue
        q=cross(s,e1); v=dot(direction,q)/det
        if v < -1e-7 or u+v > 1.0000001: continue
        distance=dot(e2,q)/det
        if 0 <= distance <= max_distance: output.append({'mesh':name,'distance':distance,'point':tuple(origin[i]+direction[i]*distance for i in range(3))})
    return sorted(output,key=lambda r:r['distance'])

opening_results=[]
for zone in contract['shopzones']:
    x=zone['center'][0]
    found=hits((x,1.5,2.6),(0,0,-1),3.8)
    opening_results.append({'shop':zone['id'],'centralEyeRayBeforeInterior':found[:3]})
alley=contract['alley']; x=(alley['min'][0]+alley['max'][0])/2
alley_hits=hits((x,1.5,2.6),(0,0,-1),8.0)
floor=[]; footprint=[]
for i in range(21):
    x=-9.2+i*18.4/20; found=hits((x,.3,2.6),(0,-1,0),.8)
    assert found, f'No floor below player lane at {x}'
    height=found[0]['point'][1]
    floor.append({'x':round(x,3),'floorY':height})
    if height < -.015:
        heights=[]
        for dx in (-.09,0,.09):
            for dz in (-.14,0,.14):
                patch=hits((x+dx,.3,2.6+dz),(0,-1,0),.8)
                assert patch, f'Missing floor under footprint at {x+dx},{2.6+dz}'
                heights.append(patch[0]['point'][1])
        assert -.015 <= max(heights) <= .025, f'Unsupported footprint at {x}'
        footprint.append({'x':round(x,3),'sampleCount':len(heights),'minY':min(heights),'supportY':max(heights)})
actor_checks=[]
for id,entity in active['manifest']['entities'].items():
    if not id.startswith('shopkeeper-'):continue
    t=entity['Transform3D'];nearby=[]
    for y in (.35,.65,1.0):
        for direction,reach in [((1,0,0),.22),((-1,0,0),.22),((0,0,1),.20),((0,0,-1),.20)]:
            found=hits((t['x'],t['y']+y,t['z']),direction,reach)
            nearby.extend(found[:1])
    floor_hits=hits((t['x'],t['y']+.15,t['z']),(0,-1,0),.5)
    assert floor_hits, f'Missing interior floor under {id}'
    actor_checks.append({'id':id,'position':[t['x'],t['y'],t['z']],'floorY':floor_hits[0]['point'][1],'coreClearanceHits':nearby})
print(json.dumps({'sha256':contract['sha256'],'bounds':actual,'triangles':len(triangles),'openings':opening_results,'alleyRay':alley_hits[:4],'walkingFloorSamples':floor,'groutFootprintChecks':footprint,'actorChecks':actor_checks},indent=2))
