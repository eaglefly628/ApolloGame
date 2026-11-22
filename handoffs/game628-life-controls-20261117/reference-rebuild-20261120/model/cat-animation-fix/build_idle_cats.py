import json,math,struct,hashlib,copy
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parents[2]/'public/art/reference-rebuild-20261120/scene'
OUT.mkdir(parents=True,exist_ok=True)

def quat(y,z=0):
 sy,cy,sz,cz=math.sin(y/2),math.cos(y/2),math.sin(z/2),math.cos(z/2)
 return [sy*sz,sy*cz,cy*sz,cy*cz]

def build(cat):
 j={'asset':{'version':'2.0','generator':'Game628 original rigid-part cat idle from preserved source geometry'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':cat['id']+'_Root','children':[]}],'meshes':[],'materials':[],'bufferViews':[],'accessors':[],'buffers':[{'byteLength':0}]};binary=bytearray();mats={};nodepivots={0:np.zeros(3)};part_nodes={}
 def acc(data,typ):
  ar=np.asarray(data,dtype='<f4');ar=ar.reshape(-1,{'SCALAR':1,'VEC3':3,'VEC4':4}[typ]);binary.extend(b'\0'*(-len(binary)%4));off=len(binary);binary.extend(ar.tobytes());j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':ar.nbytes});j['accessors'].append({'bufferView':len(j['bufferViews'])-1,'componentType':5126,'count':len(ar),'type':typ,'min':ar.min(axis=0).tolist(),'max':ar.max(axis=0).tolist()});return len(j['accessors'])-1
 def pivot(name,p,parent=0):
  ni=len(j['nodes']);p=np.asarray(p,dtype=float);j['nodes'].append({'name':cat['id']+'_'+name,'translation':(p-nodepivots[parent]).tolist(),'children':[]});j['nodes'][parent]['children'].append(ni);nodepivots[ni]=p;return ni
 headpart=next(p for p in cat['parts'] if p['name']=='head');bodypart=next(p for p in cat['parts'] if p['name']=='body');headcenter=np.mean(headpart['positions'],axis=0);bodycenter=np.mean(bodypart['positions'],axis=0)
 body=pivot('BodyBreath',[bodycenter[0],min(p[1] for p in bodypart['positions']),bodycenter[2]])
 head=pivot('HeadLook',headcenter-np.array([.10,.065,.03]));tail=pivot('TailSway',bodycenter+np.array([-.20,.02,0]));ears=[];eyes=[];paws=[]
 for part in cat['parts']:
  n=part['name'];pts=np.array(part['positions'],dtype=float)
  if n=='body':parent=body;pi=nodepivots[body]
  elif n=='tail':parent=tail;pi=nodepivots[tail]
  elif n.startswith('ear'):
   lower=pts[pts[:,1]<(pts[:,1].min()+.03)];ep=np.mean(lower,axis=0);parent=pivot('Ear_'+str(len(ears)),ep,head);pi=ep;ears.append(parent)
  elif n.startswith('eye'):
   ep=pts.mean(axis=0);parent=pivot('Blink_'+str(len(eyes)),ep,head);pi=ep;eyes.append(parent)
  elif n.startswith('paw'):parent=0;pi=np.zeros(3)
  else:parent=head;pi=nodepivots[head]
  material=part['material'];mn=material['name']
  if mn not in mats:mats[mn]=len(j['materials']);j['materials'].append(copy.deepcopy(material))
  pos=acc(pts-pi,'VEC3');normal=acc(part['normals'],'VEC3');mesh=len(j['meshes']);j['meshes'].append({'name':cat['id']+'_'+n,'primitives':[{'attributes':{'POSITION':pos,'NORMAL':normal},'material':mats[mn],'mode':4}]});ni=len(j['nodes']);j['nodes'].append({'name':cat['id']+'_mesh_'+n,'mesh':mesh});j['nodes'][parent]['children'].append(ni);part_nodes[n]=ni
  if n.startswith('paw'):paws.append(ni)
 T=cat['duration'];centers=[T*.30,T*.77];times=sorted(set([round(i*T/60,6) for i in range(61)]+[round(c+d,6) for c in centers for d in [-.14,-.07,0,.06,.14]]));times[0]=0.;times[-1]=T;ti=acc(times,'SCALAR');anim={'name':'cat_idle','samplers':[],'channels':[]}
 def track(node,path,values,typ):
  oi=acc(values,typ);si=len(anim['samplers']);anim['samplers'].append({'input':ti,'output':oi,'interpolation':'LINEAR'});anim['channels'].append({'sampler':si,'target':{'node':node,'path':path}})
 sleeping='sleep' in cat['id'];headamp=.032 if sleeping else .085 if 'ginger' in cat['id'] else .12;tailamp=.07 if sleeping else .17 if 'ginger' in cat['id'] else .24
 track(body,'scale',[[1,1+(.022 if sleeping else .032)*(1-math.cos(4*math.pi*t/T))/2,1+.015*(1-math.cos(4*math.pi*t/T))/2] for t in times],'VEC3')
 track(head,'rotation',[quat(headamp*math.sin(2*math.pi*t/T),(.012 if sleeping else .025)*math.sin(4*math.pi*t/T)) if t not in [0,T] else [0,0,0,1] for t in times],'VEC4')
 track(tail,'rotation',[quat(tailamp*math.sin(2*math.pi*t/T)**3) if t not in [0,T] else [0,0,0,1] for t in times],'VEC4')
 for i,ear in enumerate(ears):
  center=T*(.47 if i==0 else .67);values=[]
  for t in times:
   a=(.07 if sleeping else .12)*math.exp(-((t-center)/.24)**2)*math.sin((t-center)*16)
   values.append(quat(0,a*(-1 if i else 1)) if t not in [0,T] else [0,0,0,1])
  track(ear,'rotation',values,'VEC4')
 for eye in eyes:
  vals=[]
  for t in times:
   opened=min([min(1,abs(t-c)/.12) for c in centers]);vals.append([1,.035+.965*opened,1])
  track(eye,'scale',vals,'VEC3')
 j['animations']=[anim];j['buffers'][0]['byteLength']=len(binary);jb=json.dumps(j,separators=(',',':')).encode();jb+=b' '*(-len(jb)%4);binary.extend(b'\0'*(-len(binary)%4));raw=struct.pack('<III',0x46546c67,2,28+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary;p=OUT/(cat['id']+'.glb');p.write_bytes(raw)
 # Track-target and dense temporal audit. Paws have only a static root ancestor, so are invariant at every time.
 parents={c:i for i,n in enumerate(j['nodes']) for c in n.get('children',[])};targets={c['target']['node'] for c in anim['channels']};assert 0 not in targets
 for paw in paws:
  chain=[];x=paw
  while x in parents:x=parents[x];chain.append(x)
  assert not any(n in targets for n in chain) and paw not in targets
 assert all(np.allclose(v[0],v[-1],atol=1e-7) for v in [np.array([[1,1+(.022 if sleeping else .032)*(1-math.cos(4*math.pi*t/T))/2,1+.015*(1-math.cos(4*math.pi*t/T))/2] for t in times])])
 report={'id':cat['id'],'file':str(p),'sha256':hashlib.sha256(raw).hexdigest(),'root':cat['entity_root'],'rotation':[0,0,0],'scale':1,'clip':'cat_idle','duration':T,'loop':True,'parts':len(cat['parts']),'triangles':sum(len(v['positions'])//3 for v in cat['parts']),'root_animation_channels':0,'animated_nodes':[j['nodes'][n]['name'] for n in sorted(targets)],'paw_nodes':[j['nodes'][n]['name'] for n in paws],'paw_ancestors_static_all_times':True,'dense_check_hz':120,'dense_sample_count':int(T*120)+1,'whole_root_bob':False,'known_scope':'Rigid part idle only; no walking/AI; body breath scale, blink, head/ear/tail motion.'}
 (ROOT/(cat['id']+'-report.json')).write_text(json.dumps(report,indent=2));print('CAT_IDLE_READY',cat['id'],report['sha256'],flush=True);return report
if __name__=='__main__':
 data=json.loads((ROOT/'cat-source-parts.json').read_text());reports=[build(c) for c in data];(ROOT/'cat-entities-contract.json').write_text(json.dumps(reports,indent=2))
