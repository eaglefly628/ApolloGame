import json,struct
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parents[2]/'public/art/reference-rebuild-20261120/scene'
def load(path):
 d=path.read_bytes();n=struct.unpack_from('<I',d,12)[0];return json.loads(d[20:20+n]),d[28+n:]
def arr(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3}[a['type']];dt={5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];s=np.dtype(dt).itemsize;return np.ndarray((a['count'],n),dtype=dt,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',s*n),s)).copy().astype(float)
j,b=load(OUT/'street-reference-v4.glb');tri=[];names=[]
for m in j['meshes']:
 for p in m['primitives']:
  pos=arr(j,b,p['attributes']['POSITION']);ix=arr(j,b,p['indices']).astype(int).reshape(-1,3);tri.append(pos[ix]);names.extend([m['name']]*len(ix))
tri=np.concatenate(tri);e1=tri[:,1]-tri[:,0];e2=tri[:,2]-tri[:,0]
def hit(x,z,y=.2):
 d=np.array([0,-1,0]);orig=np.array([x,y,z]);h=np.cross(d,e2);det=np.sum(e1*h,axis=1);inv=np.zeros(len(det));mask=abs(det)>1e-10;inv[mask]=1/det[mask];s=orig-tri[:,0];u=np.sum(s*h,axis=1)*inv;q=np.cross(s,e1);v=np.sum(d*q,axis=1)*inv;t=np.sum(e2*q,axis=1)*inv;mask&=(u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)&(t>=0);ii=np.where(mask)[0];ii=ii[np.argsort(t[ii])];return [{'y':float(y-t[i]),'mesh':names[i]} for i in ii[:5]]
cj,cb=load(OUT/'cat-floor-idle.glb');records=[]
for node in cj['nodes']:
 if '_mesh_paw' not in node['name']:continue
 p=cj['meshes'][node['mesh']]['primitives'][0];pos=arr(cj,cb,p['attributes']['POSITION'])+np.array([5.25,-.002,.68]);low=pos[:,1].min();pts=np.unique(np.round(pos[abs(pos[:,1]-low)<1e-7],8),axis=0)
 for pp in pts:
  hits=hit(pp[0],pp[2]);records.append({'paw':node['name'],'lowest_vertex':pp.tolist(),'support_hits':hits,'support_gap_m':float(pp[1]-hits[0]['y']) if hits else None})
report={'root_probe':{'position':[5.25,-.002,.68],'hits_from_y_point2':hit(5.25,.68)},'actual_paw_support':records,'note':'Lowest paws land on 45-degree beveled tile fronts, not root XZ. Compare actual sampled surface Y, not nominal Y0.'};(ROOT/'cat-floor-support-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
