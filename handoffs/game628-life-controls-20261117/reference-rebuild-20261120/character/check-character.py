import json,struct,hashlib,math
from pathlib import Path
import numpy as np
R=Path(__file__).resolve().parent;P=R.parents[1]/'public/art/reference-rebuild-20261120/character';L=Path('/Users/junbaili/ApolloAssets/motion-lib-full-frames')
def glb(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);return j,b[28+n:],hashlib.sha256(b).hexdigest()
def acc(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']];dt={5126:'<f4',5123:'<u2',5125:'<u4',5121:'u1'}[a['componentType']]
 return np.frombuffer(b,dtype=dt,count=a['count']*n,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape((-1,n))
C=json.loads((R/'character-contract-v2.json').read_text());report={'variants':[],'scope':'local offline foot samples, not collision/turning/engine state blend validation'}
for role in ['traveler','shopkeeper']:
 j,b,sha=glb(P/(role+'-v2.glb'));assert sha==next(v['sha256']for v in C['variants']if v['role']==role)
 tris=0
 for m in j['meshes']:
  for p in m['primitives']:
   for key in ['POSITION','NORMAL']:
    assert np.isfinite(acc(j,b,p['attributes'][key])).all()
   tris+=(len(acc(j,b,p['indices']))if 'indices'in p else len(acc(j,b,p['attributes']['POSITION'])))//3
 checks=[]
 for a in j['animations']:
  source=C['sources'][a['name']];sj,sb,ssha=glb(L/'clips'/(source['id']+'.glb'));assert ssha==source['sha256']
  sourceRot={sj['nodes'][c['target']['node']]['name']:acc(sj,sb,sj['animations'][0]['samplers'][c['sampler']]['output'])for c in sj['animations'][0]['channels']if c['target']['path']=='rotation'}
  angles=[];count=0
  for c in a['channels']:
   s=a['samplers'][c['sampler']];t=acc(j,b,s['input']).ravel();v=acc(j,b,s['output']);assert np.isfinite(v).all()and(t[1:]>t[:-1]).all()
   if c['target']['path']=='rotation':
    bone=j['nodes'][c['target']['node']]['name'];assert np.array_equal(v,sourceRot[bone]);count+=1
    dot=abs(float(np.dot(v[0],v[-1])));angles.append(2*math.acos(min(1,dot)))
  checks.append({'clip':a['name'],'unchangedSourceQuaternionTracks':count,'maxFirstLastRotationRadians':max(angles)})
 samples=json.loads((R/(role+'-v2-foot-samples.json')).read_text());foot=[]
 for d in samples:
  for side in ['Left','Right']:
   f=[dict(t=x['t'],**next(v for v in x['feet']if v['side']==side))for x in d['frames']];windows=[]
   for i in range(len(f)-6):
    if not all(v['toe'][1]<.08 for v in f[i:i+7]):continue
    a,z=f[i],f[i+6];speed=d['nominalSpeed']if d['clip']=='walk'else 0;windows.append(math.hypot(z['toe'][0]-a['toe'][0],z['toe'][2]-a['toe'][2]+speed*(z['t']-a['t'])))
   foot.append({'clip':d['clip'],'side':side,'criterion':'ToeBase Y<0.08m for entire 200ms; only low forefoot stance; heel roll/swing excluded','windows':len(windows),'maxTangentialDrift200msM':max(windows)if windows else None,'minSoleY':min(v['minY']for v in f)})
 assert max(v['maxTangentialDrift200msM']for v in foot if v['maxTangentialDrift200msM']is not None)<.02
 assert min(v['minSoleY']for v in foot)>-1e-6
 report['variants'].append({'role':role,'sha256':sha,'triangles':tris,'sourceRotationChecks':checks,'footChecks':foot})
(R/'character-verification-v2.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
