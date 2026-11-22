import json,struct,hashlib,math
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parents[2]/'public/art/reference-rebuild-20261120/scene'
def read(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);return j,raw[28+n:],raw

def quaternion_matrix(q):
 x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
def slerp(a,b,t):
 dot=float(a@b)
 if dot<0:b=-b;dot=-dot
 if dot>.9995:q=a+(b-a)*t;return q/np.linalg.norm(q)
 theta=math.acos(min(1,dot));return (math.sin((1-t)*theta)*a+math.sin(t*theta)*b)/math.sin(theta)

def audit(info):
 j,b,raw=read(OUT/(info['id']+'.glb'))
 def acc(i):
  a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];nc={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];return np.frombuffer(b,dtype='<f4',count=a['count']*nc,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,nc).astype(float)
 parents={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])};meshpoints={};node_names={i:n['name'] for i,n in enumerate(j['nodes'])}
 for i,n in enumerate(j['nodes']):
  if 'mesh' in n:meshpoints[i]=acc(j['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION'])
 anim=j['animations'][0];tracks=[]
 for c in anim['channels']:
  s=anim['samplers'][c['sampler']];tracks.append((c['target']['node'],c['target']['path'],acc(s['input'])[:,0],acc(s['output'])))
 assert all(n!=0 and p!='translation' for n,p,_,_ in tracks)
 T=max(x[2][-1] for x in tracks);root=np.array(info['root'],dtype=float);footnodes=[n for n in meshpoints if '_mesh_paw' in node_names[n]];bodymesh=next(n for n in meshpoints if node_names[n].endswith('_mesh_body'));headmesh=next(n for n in meshpoints if node_names[n].endswith('_mesh_head'));headpivot=next(n for n,v in node_names.items() if v.endswith('_HeadLook'));tailpivot=next(n for n,v in node_names.items() if v.endswith('_TailSway'));earpivots=[n for n,v in node_names.items() if '_Ear_' in v and '_mesh_' not in v]
 def evaluate(t):
  states={i:{'translation':np.array(n.get('translation',[0,0,0]),float),'rotation':np.array(n.get('rotation',[0,0,0,1]),float),'scale':np.array(n.get('scale',[1,1,1]),float)} for i,n in enumerate(j['nodes'])}
  for n,p,ts,vs in tracks:
   k=min(len(ts)-2,max(0,np.searchsorted(ts,t,side='right')-1));f=max(0,min(1,(t-ts[k])/(ts[k+1]-ts[k])));states[n][p]=slerp(vs[k],vs[k+1],f) if p=='rotation' else vs[k]*(1-f)+vs[k+1]*f
  world={}
  def mat(n):
   if n in world:return world[n]
   st=states[n];m=np.eye(4);m[:3,:3]=quaternion_matrix(st['rotation'])@np.diag(st['scale']);m[:3,3]=st['translation'];world[n]=(mat(parents[n])@m) if n in parents else m;return world[n]
  verts={n:p@mat(n)[:3,:3].T+mat(n)[:3,3]+root for n,p in meshpoints.items()};return verts,{n:mat(n)[:3,3]+root for n in [headpivot,tailpivot]+earpivots}
 def outside(verts,p):
  q=verts.reshape(-1,3,3);normal=np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0]);normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-10);return float(np.max(np.sum((p-q[:,0])*normal,axis=1)))
 base,_=evaluate(0);maxpaw=0;maxmotion={node_names[n]:0 for n in meshpoints};maxoutside=-1e9;minpaw=1e9;maxpawY=-1e9
 count=int(round(T*120))+1
 for t in np.linspace(0,T,count):
  pose,piv=evaluate(float(t))
  for n,p in pose.items():maxmotion[node_names[n]]=max(maxmotion[node_names[n]],float(np.max(np.linalg.norm(p-base[n],axis=1))))
  for n in footnodes:
   maxpaw=max(maxpaw,float(np.max(np.linalg.norm(pose[n]-base[n],axis=1))));low=float(pose[n][:,1].min());minpaw=min(minpaw,low);maxpawY=max(maxpawY,low)
  maxoutside=max(maxoutside,outside(pose[bodymesh],piv[headpivot]),outside(pose[bodymesh],piv[tailpivot]),*[outside(pose[headmesh],piv[e]) for e in earpivots])
 end,_=evaluate(T);loop=max(float(np.max(np.linalg.norm(end[n]-base[n],axis=1))) for n in base)
 assert maxpaw<1e-10 and abs(minpaw-root[1])<2e-7 and abs(maxpawY-root[1])<2e-7
 assert maxoutside<1e-5,('neck/ear/tail root left host surface',maxoutside)
 assert loop<1e-6 and max(maxmotion.values())>.005
 report={'asset':info['id'],'sha256':hashlib.sha256(raw).hexdigest(),'duration':T,'sample_hz':120,'sample_count':count,'actual_gltf_linear_and_quaternion_slerp_evaluated':True,'max_paw_world_displacement_m':maxpaw,'paw_min_world_y_range':[minpaw,maxpawY],'support_y':root[1],'max_joint_anchor_outside_host_surface_m':maxoutside,'all_neck_ear_tail_anchor_points_remain_inside_host_convex_mesh':True,'loop_vertex_delta_m':loop,'maximum_vertex_motion_by_part_m':maxmotion,'status':'numeric_idle_contact_and_motion_passed_visual_review_pending','limits':'Anchor containment does not prove absence of every surface self-intersection; visual review required.'}
 (ROOT/(info['id']+'-audit.json')).write_text(json.dumps(report,indent=2));print('IDLE_AUDIT_PASS',info['id'],count,'pawDisplacement',maxpaw,'jointOutside',maxoutside,'maxMotion',max(maxmotion.values()),flush=True);return report
if __name__=='__main__':
 reports=[audit(c) for c in json.loads((ROOT/'cat-entities-contract.json').read_text())];(ROOT/'idle-audit-summary.json').write_text(json.dumps(reports,indent=2))
