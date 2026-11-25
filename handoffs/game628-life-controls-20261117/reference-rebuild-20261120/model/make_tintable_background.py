import json,struct,hashlib,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent.parent/'public/art/reference-rebuild-20261120/scene'
def load(p):
 raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);k=20+n;bn=struct.unpack_from('<I',raw,k)[0];return j,raw[k+8:k+8+bn],raw
sj,sb,sraw=load(OUT/'background-reference.glb');j=copy.deepcopy(sj);binary=bytearray(sb);records=[]
for mesh in j['meshes']:
 for p in mesh['primitives']:
  count=j['accessors'][p['attributes']['POSITION']]['count'];mi=p['material'];col=sj['materials'][mi]['pbrMetallicRoughness'].get('baseColorFactor',[1,1,1,1])[:3]
  binary.extend(b'\0'*(-len(binary)%4));off=len(binary);binary.extend(struct.pack('<'+'f'*(count*3),*(col*count)));j['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':count*12,'target':34962});j['accessors'].append({'bufferView':len(j['bufferViews'])-1,'componentType':5126,'count':count,'type':'VEC3','min':col,'max':col});p['attributes']['COLOR_0']=len(j['accessors'])-1;records.append({'material_index':mi,'linear_vertex_color':col,'vertex_count':count})
for m in j['materials']:m['pbrMetallicRoughness']['baseColorFactor']=[1,1,1,1]
j['buffers'][0]['byteLength']=len(binary);jb=json.dumps(j,separators=(',',':')).encode();jb+=b' '*(-len(jb)%4);binary.extend(b'\0'*(-len(binary)%4));raw=struct.pack('<III',0x46546c67,2,28+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary
p=OUT/'background-reference-tintable.glb';p.write_bytes(raw);fj,fb,_=load(p)
assert fb[:len(sb)]==sb and fj['nodes']==sj['nodes'] and fj['scenes']==sj['scenes'];assert fj['accessors'][:len(sj['accessors'])]==sj['accessors']
mins=[];maxs=[]
for mesh,sm in zip(fj['meshes'],sj['meshes']):
 for pr,sp in zip(mesh['primitives'],sm['primitives']):
  for k,v in sp['attributes'].items():assert pr['attributes'][k]==v
  a=fj['accessors'][pr['attributes']['POSITION']];mins.append(a['min']);maxs.append(a['max'])
report={'source':str(OUT/'background-reference.glb'),'candidate':str(p),'source_sha256':hashlib.sha256(sraw).hexdigest(),'candidate_sha256':hashlib.sha256(raw).hexdigest(),'source_original_bin_prefix_identical':True,'position_normal_geometry_and_node_transforms_identical':True,'colors':records,'base_color_factors':'all white [1,1,1,1]','unlit_preserved':all('KHR_materials_unlit' in m.get('extensions',{}) for m in fj['materials']),'color_encoding':'COLOR_0 float VEC3 linear; exact original linear baseColorFactor moved per vertex','bounds':{'min':[min(a[i] for a in mins) for i in range(3)],'max':[max(a[i] for a in maxs) for i in range(3)]},'runtimeUsage':'Model3D.tint white daytime, warm dusk, dark blue night; final tint replaces white factor and multiplies retained vertex color. Runtime casts cannot be disabled by data: geometry is entirely behind street and dirZ<0 projects further back.','original_background_unchanged':hashlib.sha256((OUT/'background-reference.glb').read_bytes()).hexdigest()==hashlib.sha256(sraw).hexdigest()}
(ROOT/'background-tintable-report.json').write_text(json.dumps(report,indent=2));print('TINTABLE_BACKGROUND_READY',report['candidate_sha256'],report['bounds'])
