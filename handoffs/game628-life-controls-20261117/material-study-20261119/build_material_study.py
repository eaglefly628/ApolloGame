"""Deterministic GLB material patch. Original binary bytes and geometry retained; no Blender re-export."""
import copy,hashlib,io,json,struct,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageFilter
ROOT=Path(__file__).resolve().parent
PUBLIC=ROOT.parent/'public/art/material-study-20261119'
SOURCE=ROOT.parent/'public/art/neighborhood-v1/k-library'
PUBLIC.mkdir(parents=True,exist_ok=True)
SEED=6281119
SIZE=1536
COVER=4.0 # native model units; GLBs are deliberately not rescaled
SPECS={
 'housing-e-detail':dict(source='housing-e',wall=(192,104,65),stone=(213,199,171),wood=(119,78,44),brick=False,band=True),
 'housing-a-bakery':dict(source='housing-a',wall=(223,203,162),stone=(232,221,195),wood=(152,112,67),brick=False,band=False),
 'housing-d-noodles':dict(source='housing-d',wall=(161,79,49),stone=(190,175,144),wood=(76,48,29),brick=True,band=False),
 'housing-h-catcafe':dict(source='housing-h',wall=(145,168,131),stone=(220,213,184),wood=(172,137,87),brick=False,band=False),
 'housing-a-bikeshop':dict(source='housing-a',wall=(113,140,147),stone=(195,201,191),wood=(80,91,87),brick=False,band=False),
}
def load(path):
 raw=path.read_bytes();length,typ=struct.unpack_from('<II',raw,12);j=json.loads(raw[20:20+length]);off=20+length;blen,btype=struct.unpack_from('<II',raw,off);return j,raw[off+8:off+8+blen],raw

def accessor(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];n={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[a['type']];stride=v.get('byteStride',np.dtype(dt).itemsize*n)
 return np.ndarray((a['count'],n),dtype=dt,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,np.dtype(dt).itemsize)).copy()

def image_bytes(im):
 out=io.BytesIO();im.save(out,format='PNG',compress_level=6);return out.getvalue()

def noise(rng,shape,res):
 im=Image.fromarray(rng.integers(0,256,(res,res),dtype=np.uint8));return np.asarray(im.resize((shape[1],shape[0]),Image.Resampling.BICUBIC),dtype=np.float32)/255-.5

def textures(kind,color,spec):
 rng=np.random.default_rng(SEED+{'wall':0,'stone':1,'wood':2,'cloth':3}[kind]);n=SIZE
 y,x=np.mgrid[0:n,0:n].astype(np.float32);x=x/n*COVER-2;y=y/n*COVER
 broad=noise(rng,(n,n),20);mid=noise(rng,(n,n),150);grain=rng.random((n,n),dtype=np.float32)-.5
 h=grain*.55+mid*.48
 variation=broad*13+mid*10+grain*8
 rgb=np.broadcast_to(np.array(color,dtype=np.float32),(n,n,3)).copy()
 rough=np.full((n,n),.83,dtype=np.float32)
 if kind=='wall':
  # Small non-directional plaster pores, pigment variation, and restrained gravity runoff.
  flecks=rng.random((n,n),dtype=np.float32)<.006
  variation-=flecks*15;h-=flecks*.6;rough+=mid*.12
  rain=np.zeros((n,n),np.float32)
  for center,start,length,width in [(-.84,1.75,.18,.011),(-.39,1.75,.22,.009),(.07,1.75,.18,.010),(.53,1.75,.17,.009),(.83,1.05,.20,.011),(-.51,1.05,.14,.009)]:
   rain+=np.exp(-((x-center)/width)**2)*np.clip((start-y)/.035,0,1)*np.clip((y-start+length)/length,0,1)
  variation-=rain*19
  # A few pinprick paint wear specks, not broken plaster or new geometry.
  if spec['brick'] or spec['band']:
   bh=.065;bw=.155;row=np.floor(y/bh);xx=np.mod(x+(np.mod(row,2))*.5*bw,bw)
   joint=(np.mod(y,bh)<.005)|(xx<.005)
   region=np.ones_like(joint) if spec['brick'] else y<.26
   brickvar=np.sin(np.floor((x+np.mod(row,2)*bw/2)/bw)*12.43+row*4.3)*7
   brickrgb=np.array((160,88,58),np.float32)[None,None,:]+(mid*8+grain*5+brickvar)[...,None]
   rgb=np.where(region[...,None],brickrgb,rgb)
   rgb=np.where((joint&region)[...,None],np.array((182,165,137),np.float32),rgb)
   h=np.where(joint&region,-.9,h);rough=np.where(joint&region,.94,rough)
  variation+=np.where(y<.19,-4,0)
 elif kind=='stone':
  pits=rng.random((n,n),dtype=np.float32)<.012
  variation=broad*8+mid*9+grain*5-pits*26;h=mid*.25+grain*.15-pits*.7;rough=.78+mid*.16
 elif kind=='wood':
  fiber=np.sin(x*540+mid*5+np.sin(y*9)*2)
  variation=broad*12+fiber*7+grain*4;h=fiber*.18+grain*.1;rough=.71+mid*.1
 else:
  warp=np.sin(x*2100);weft=np.sin(y*2050);h=(warp+weft)*.15+grain*.1;variation=warp*2+weft*2+grain*3;rough=.91+mid*.04
 rgb=np.clip(rgb+variation[...,None],0,255).astype('uint8')
 # glTF tangent-space normal texture: micro surface only; does not move vertices or silhouette.
 gy,gx=np.gradient(h);strength=.78 if kind!='cloth' else .5
 normal=np.stack((-gx*strength,gy*strength,np.ones_like(h)),axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
 normal=np.uint8(np.clip((normal*.5+.5)*255,0,255))
 orm=np.zeros((n,n,3),np.uint8);orm[:,:,0]=255;orm[:,:,1]=np.uint8(np.clip(rough,0,1)*255)
 return {'albedo':Image.fromarray(rgb),'normal':Image.fromarray(normal),'roughness':Image.fromarray(orm)}

def build(name,spec):
 sj,sbin,sraw=load(SOURCE/(spec['source']+'.glb'));j=copy.deepcopy(sj);binary=bytearray(sbin);original_length=len(binary);cache={};changed=[]
 outdir=PUBLIC/name;outdir.mkdir(exist_ok=True)
 def append(data,target=None):
  binary.extend(b'\0'*(-len(binary)%4));offset=len(binary);binary.extend(data);v={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
  if target:v['target']=target
  j['bufferViews'].append(v);return len(j['bufferViews'])-1
 def newacc(a,typ):
  a=np.asarray(a,dtype='<f4');v=append(a.tobytes(),34962);j['accessors'].append({'bufferView':v,'componentType':5126,'count':len(a),'type':typ});return len(j['accessors'])-1
 def tex(im,label):
  data=image_bytes(im);(outdir/(label+'.png')).write_bytes(data);v=append(data);j['images'].append({'bufferView':v,'mimeType':'image/png','name':label});j.setdefault('samplers',[]).append({'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071});j['textures'].append({'source':len(j['images'])-1,'sampler':len(j['samplers'])-1});return len(j['textures'])-1
 def material_kind(m):
  n=m['name'].lower()
  if 'paint_wall_solid' in n:return 'wall'
  if 'concrete_solid' in n:return 'stone'
  if 'source_wood_solid' in n or 'infill_wood_sheet' in n:return 'wood'
  if 'awning_cloth' in n:return 'cloth'
  return None
 # Shared style maps, preserving every primitive's original base-color atlas unless role is unambiguous.
 for mi,m in enumerate(j['materials']):
  kind=material_kind(m)
  if not kind:continue
  if kind not in cache:
   maps=textures(kind,spec.get(kind,(220,210,188)),spec);cache[kind]={key:tex(im,kind+'-'+key) for key,im in maps.items()}
  pbr=m.setdefault('pbrMetallicRoughness',{});pbr['metallicFactor']=.45 if name=='housing-a-bikeshop' and kind=='wood' else 0;pbr['roughnessFactor']=.7 if name=='housing-a-bikeshop' and kind=='wood' else 1;pbr['metallicRoughnessTexture']={'index':cache[kind]['roughness'],'texCoord':1}
  if kind!='cloth':
   pbr['baseColorTexture']={'index':cache[kind]['albedo'],'texCoord':1};pbr['baseColorFactor']=[1,1,1,1]
  else:
   # Keep original red/cream stripe registration, adding fine woven pixels in its own atlas.
   ti=pbr['baseColorTexture']['index'];ii=j['textures'][ti]['source'];imj=j['images'][ii];v=j['bufferViews'][imj['bufferView']];im=Image.open(io.BytesIO(sbin[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB');arr=np.array(im,dtype=np.float32);yy,xx=np.mgrid[:arr.shape[0],:arr.shape[1]];detail=((xx%4==0).astype(float)+(yy%4==0).astype(float)-.5)*3
   pbr['baseColorTexture']={'index':tex(Image.fromarray(np.uint8(np.clip(arr+detail[...,None],0,255))),'cloth-original-atlas-detail')}
  m['normalTexture']={'index':cache[kind]['normal'],'texCoord':1,'scale':.65};m['name']=m['name']+'__'+name;changed.append({'material_index':mi,'kind':kind,'original_name':sj['materials'][mi]['name']})
 # New UV1 and derived tangent stream only. UV0, position, index, normal data remain untouched.
 uv_count=0
 for mesh in j['meshes']:
  for p in mesh['primitives']:
   if material_kind(sj['materials'][p.get('material',0)]) is None:continue
   pos=accessor(sj,sbin,p['attributes']['POSITION']);normal=accessor(sj,sbin,p['attributes']['NORMAL']);axis=np.argmax(abs(normal),axis=1)
   u=np.where(axis==0,-pos[:,2],pos[:,0]);v=np.where(axis==1,pos[:,2]+2,pos[:,1]);uv=np.column_stack(((u+2)/COVER,v/COVER)).astype('<f4');p['attributes']['TEXCOORD_1']=newacc(uv,'VEC2');uv_count+=1
   ix=accessor(sj,sbin,p['indices']).reshape(-1,3);tan=np.zeros_like(pos);bitan=np.zeros_like(pos)
   for ids in ix:
    a,b,c=ids;edge1=pos[b]-pos[a];edge2=pos[c]-pos[a];d1=uv[b]-uv[a];d2=uv[c]-uv[a];det=d1[0]*d2[1]-d1[1]*d2[0]
    if abs(det)<1e-12:continue
    t=(edge1*d2[1]-edge2*d1[1])/det;bt=(edge2*d1[0]-edge1*d2[0])/det;tan[ids]+=t;bitan[ids]+=bt
   nn=normal/np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-12);tan-=nn*np.sum(nn*tan,axis=1,keepdims=True);length=np.linalg.norm(tan,axis=1,keepdims=True);bad=length[:,0]<1e-9
   tan[bad]=np.cross(nn[bad],np.where((abs(nn[bad,1])<.8)[:,None],np.array([0,1,0]),np.array([1,0,0])));tan/=np.maximum(np.linalg.norm(tan,axis=1,keepdims=True),1e-12)
   w=np.where(np.sum(np.cross(nn,tan)*bitan,axis=1)<0,-1.,1.);p['attributes']['TANGENT']=newacc(np.column_stack((tan,w)),'VEC4')
 j['buffers'][0]['byteLength']=len(binary);jd=json.dumps(j,separators=(',',':')).encode();jd+=b' '*(-len(jd)%4);binary.extend(b'\0'*(-len(binary)%4));raw=struct.pack('<III',0x46546c67,2,12+8+len(jd)+8+len(binary))+struct.pack('<II',len(jd),0x4e4f534a)+jd+struct.pack('<II',len(binary),0x004e4942)+binary
 dest=PUBLIC/(name+'.glb');dest.write_bytes(raw)
 # Re-open final artifact and assert original binary prefix, every geometry value and structural field.
 fj,fb,_=load(dest);assert fb[:original_length]==sbin
 checks=[]
 for sm,fm in zip(sj['meshes'],fj['meshes']):
  assert sm['name']==fm['name'] and len(sm['primitives'])==len(fm['primitives'])
  for sp,fp in zip(sm['primitives'],fm['primitives']):
   for key in ['POSITION','NORMAL','TEXCOORD_0']:
    assert sp['attributes'][key]==fp['attributes'][key]
    a=accessor(sj,sbin,sp['attributes'][key]);b=accessor(fj,fb,fp['attributes'][key]);assert a.tobytes()==b.tobytes()
   assert sp['indices']==fp['indices'];assert accessor(sj,sbin,sp['indices']).tobytes()==accessor(fj,fb,fp['indices']).tobytes();assert sp.get('material')==fp.get('material');checks.append(len(accessor(sj,sbin,sp['indices']))//3)
 assert sj['nodes']==fj['nodes'] and sj['scenes']==fj['scenes'];assert sj['accessors']==fj['accessors'][:len(sj['accessors'])];assert sj['bufferViews']==fj['bufferViews'][:len(sj['bufferViews'])]
 report={'candidate':str(dest),'source':str(SOURCE/(spec['source']+'.glb')),'source_sha256':hashlib.sha256(sraw).hexdigest(),'candidate_sha256':hashlib.sha256(raw).hexdigest(),'original_binary_prefix_byte_count':original_length,'original_binary_prefix_identical':True,'position_normal_index_uv0_accessor_bytes_identical':True,'original_accessor_and_bufferView_metadata_identical':True,'nodes_transforms_scenes_identical':True,'mesh_primitive_material_indices_identical':True,'triangles':sum(checks),'primitives':len(checks),'new_uv1_and_tangent_streams':uv_count,'changed_materials':changed,'texture_size':SIZE,'seed':SEED,'new_lighting_baked':False,'geometry_modified':False,'status':'numeric_verified_visual_review_pending'}
 (ROOT/(name+'-report.json')).write_text(json.dumps(report,indent=2));print('READY',name,str(dest),flush=True)
 return report
if __name__=='__main__':
 names=sys.argv[1:] or list(SPECS)
 for name in names:build(name,SPECS[name])
