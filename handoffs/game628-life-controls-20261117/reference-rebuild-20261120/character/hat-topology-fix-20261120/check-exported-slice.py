from pathlib import Path
import json,struct
import numpy as np
R=Path(__file__).resolve().parent;A=R.parents[2]/'public/art/reference-rebuild-20261120/character'
def load(variant):
 b=(A/f'traveler-{variant}.glb').read_bytes();l=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+l]);buf=b[28+l:];node=next(x for x in j['nodes']if x.get('name')=='cap-visor');p=j['meshes'][node['mesh']]['primitives'][0];a=j['accessors'][p['attributes']['POSITION']];v=j['bufferViews'][a['bufferView']];return np.frombuffer(buf,dtype='<f4',count=a['count']*3,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape((-1,3))
def cross(a,b,c):
 u,v=b-a,c-a;return float(u[0]*v[1]-u[1]*v[0])
out={}
for variant in ['v3','v4']:
 for zslice in [0,.095,.10,.11,.115,.119,.1199,-.1199]:
  ps=load(variant).copy();ps[:,2]-=zslice;segments=[]
  for i in range(0,len(ps),3):
   tri=ps[i:i+3];hits=[]
   for k in range(3):
    a,b=tri[k],tri[(k+1)%3]
    if a[2]*b[2]<0:
     t=-a[2]/(b[2]-a[2]);hits.append((a+(b-a)*t)[:2])
   if len(hits)==2:segments.append((hits[0],hits[1],i//3))
  crossing=[]
  for i,(a,b,faceA)in enumerate(segments):
   for c,d,faceB in segments[i+1:]:
    if min(np.linalg.norm(a-c),np.linalg.norm(a-d),np.linalg.norm(b-c),np.linalg.norm(b-d))<1e-6:continue
    if cross(a,b,c)*cross(a,b,d)<-1e-18 and cross(c,d,a)*cross(c,d,b)<-1e-18:crossing.append([faceA,faceB])
  out[variant+'@'+str(zslice)]={'plane':'actual exported cap-visor section','triangleSegments':len(segments),'properSidewallCrossings':crossing}
(R/'exported-hat-slice-check.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out,indent=2))
