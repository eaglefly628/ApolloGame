import json,struct,hashlib
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent.parent/'public/art/reference-rebuild-20261120/scene';path=OUT/'street-reference-v2.glb';raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);binary=raw[28+n:]
def a(ix):
 v=j['accessors'][ix];bv=j['bufferViews'][v['bufferView']];dt={5123:'<u2',5125:'<u4',5126:'<f4'}[v['componentType']];nc={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[v['type']];sz=np.dtype(dt).itemsize;return np.ndarray((v['count'],nc),dtype=dt,buffer=binary,offset=bv.get('byteOffset',0)+v.get('byteOffset',0),strides=(bv.get('byteStride',nc*sz),sz)).copy()
# Fast finalizer emits geometry in world coordinates, identity scene nodes.
assert all(not any(k in node for k in ['matrix','translation','rotation','scale']) for node in j['nodes'])
tri=[];mats=[];names=[]
for mesh in j['meshes']:
 for p in mesh['primitives']:
  pts=a(p['attributes']['POSITION']);indices=a(p['indices']).reshape(-1,3);tri.append(pts[indices]);mats.extend([j['materials'][p['material']]['name']]*len(indices));names.extend([mesh['name']]*len(indices))
tri=np.concatenate(tri).astype(float);mats=np.array(mats);names=np.array(names);p0=tri[:,0];e1=tri[:,1]-p0;e2=tri[:,2]-p0

def hit(origin,direction,select=None):
 orig=np.array(origin);d=np.array(direction);h=np.cross(np.broadcast_to(d,e2.shape),e2);det=np.sum(e1*h,axis=1);mask=abs(det)>1e-10;inv=np.zeros(len(det));inv[mask]=1/det[mask];s=orig-p0;u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv;mask&=(u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)&(t>1e-6)
 if select is not None:mask&=select
 idx=np.where(mask)[0];idx=idx[np.argsort(t[idx])];return [(float(t[i]),str(mats[i]),str(names[i]),(orig+d*t[i]).tolist()) for i in idx]
contract=json.loads((OUT/'scene-contract-v2.json').read_text());checks=[]
for z in contract['shopzones']:
 n=z['id'];p=contract['furnitureAndClearance'][n]['staffClearancePoint'];hh=hit((p[0],1.7,p[2]),(0,-1,0));checks.append({'id':n+'.staff_floor_ray','from':[p[0],1.7,p[2]],'first_hit':hh[0] if hh else None,'passed':bool(hh) and abs(hh[0][3][1])<1e-4,'scope':'Centerline below standing upper body clear to Y0; full animation envelope remains parent review.'})
 cx=z['center'][0];hh=hit((cx,1.62,2.0),(0,0,-1));checks.append({'id':n+'.eye_visibility','first_hit':hh[0] if hh else None,'passed':bool(hh) and hh[0][3][2]<.15,'scope':'Opening has no opaque front sheet at representative staff face height; frames and props may occlude elsewhere.'})
# Surface crossing coordinates confirm balcony bar/deck/rail insertion from final GLB.
iron=(mats=='iron')&np.char.startswith(names,'bakery__')
hh=hit((-4.35,5.2,.83),(0,-1,0),iron);ys=sorted(set(round(v[3][1],5) for v in hh),reverse=True)
checks.append({'id':'BAL-03.actual_final_surface_crossings','vertical_probe':[-4.35,.83],'iron_crossing_heights':ys,'expected_bar_y':[3.98,4.88],'expected_rail_y':[4.8375,4.9025],'hidden_overlap_m':.0425,'passed':all(any(abs(y-q)<1e-4 for y in ys) for q in [3.98,4.88,4.8375,4.9025]),'scope':'Sample of middle bar/rail, not proof of every full assembly interface.'})
quant=np.rint(tri*1e6).astype(np.int64);seen=set();duplicates=0
for points in quant:
 key=tuple(sorted(tuple(int(i) for i in p) for p in points))
 if key in seen:duplicates+=1
 seen.add(key)
report={'file':str(path),'sha256':hashlib.sha256(raw).hexdigest(),'checks':checks,'exact_coordinate_duplicate_triangle_occurrences_at_1um':duplicates,'duplicate_interpretation':'Controlled hidden cap/corner overlaps can duplicate triangles; not globally removed, does not prove absence of visible Z-fighting. Producer images and source declaration used for review.','status':'sampled_geometry_contact_review','no_whole_scene_art_acceptance_claim':True}
(ROOT/'v2-contact-report.json').write_text(json.dumps(report,indent=2));print('FINAL_CONTACT_REPORT',len(checks),'failed',[x['id'] for x in checks if not x['passed']],'duplicates',duplicates)
