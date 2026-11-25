import copy,hashlib,json,struct
from pathlib import Path
import numpy as np
ROOT=Path(__file__).resolve().parent;OUT=ROOT.parent.parent/'public/art/reference-rebuild-20261120/scene'
def load(p):
 raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);k=20+n;nn=struct.unpack_from('<I',raw,k)[0];return j,raw[k+8:k+8+nn],raw
sj,sb,sraw=load(OUT/'street-reference-v2.glb');j=copy.deepcopy(sj);binary=bytearray(sb);groups=json.loads((ROOT/'cat-contact-v3-deltas.json').read_text());lookup={};pawkeys={};seen={r['group']:set() for r in groups};rows={r['group']:[] for r in groups}
def key(p):return tuple(int(round(float(x)*1e6)) for x in p)
for r in groups:
 for p in r['source_world_vertex_positions']:
  k=key(p)
  if k in lookup:assert lookup[k][0]==r['group']
  lookup[k]=(r['group'],r['uniform_delta_y'])
 pawkeys[r['group']]={key(p) for p in r['paw_source_positions']}
positions=sorted({p['attributes']['POSITION'] for m in j['meshes'] for p in m['primitives']});allowed_bytes=set();changed_accessors=[];changed_vertices=0
for ix in positions:
 a=j['accessors'][ix];v=j['bufferViews'][a['bufferView']];assert a['componentType']==5126 and a['type']=='VEC3';off=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12);vals=[];nchanged=0
 for i in range(a['count']):
  at=off+i*stride;p=struct.unpack_from('<fff',binary,at);k=key(p)
  if k in lookup:
   name,delta=lookup[k];newy=np.float32(float(p[1])+delta).item();struct.pack_into('<f',binary,at+4,newy);allowed_bytes.update(range(at+4,at+8));nchanged+=1;changed_vertices+=1;seen[name].add(k)
   if k in pawkeys[name]:rows[name].append(newy)
  vals.append(struct.unpack_from('<fff',binary,at))
 if nchanged:
  a['min']=[min(p[i] for p in vals) for i in range(3)];a['max']=[max(p[i] for p in vals) for i in range(3)];changed_accessors.append({'index':ix,'vertices_shifted':nchanged})
for r in groups:
 expected={key(p) for p in r['source_world_vertex_positions']};assert seen[r['group']]==expected,(r['group'],'unmatched source vertices',len(expected-seen[r['group']]))
 assert abs(min(rows[r['group']])-r['target_paw_bottom_y'])<2e-7,(r['group'],'paw bottom mismatch')
actual_diffs={i for i,(a,b) in enumerate(zip(sb,binary)) if a!=b};assert actual_diffs<=allowed_bytes;assert len(sb)==len(binary)
assert j['materials']==sj['materials'] and j['meshes']==sj['meshes'] and j['nodes']==sj['nodes'] and j['bufferViews']==sj['bufferViews']
# Only accessor POSITION min/max metadata may vary; indices/normals/UV/tangent streams and metadata unchanged.
for i,(a,b) in enumerate(zip(sj['accessors'],j['accessors'])):
 aa=copy.deepcopy(a);bb=copy.deepcopy(b)
 if i in [v['index'] for v in changed_accessors]:
  aa.pop('min',None);aa.pop('max',None);bb.pop('min',None);bb.pop('max',None)
 assert aa==bb
jb=json.dumps(j,separators=(',',':')).encode();jb+=b' '*(-len(jb)%4);binary.extend(b'\0'*(-len(binary)%4));raw=struct.pack('<III',0x46546c67,2,28+len(jb)+len(binary))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(binary),0x004e4942)+binary
path=OUT/'street-reference-v3.glb';path.write_bytes(raw);fj,fb,_=load(path);assert fb==bytes(binary)
report={'source_sha256':hashlib.sha256(sraw).hexdigest(),'candidate_sha256':hashlib.sha256(raw).hexdigest(),'source':str(OUT/'street-reference-v2.glb'),'candidate':str(path),'scope':'Only whole-cat vertical translations for 3 static cats, preserving every other model property','changed_position_accessors':changed_accessors,'changed_vertex_occurrences':changed_vertices,'changed_bin_byte_count':len(actual_diffs),'all_bin_differences_restricted_to_known_cat_position_Y_components':True,'all_other_position_components_and_noncat_positions_byte_identical':True,'all_normals_indices_uv_tangents_and_materials_byte_identical':True,'all_meshes_nodes_transforms_materials_bufferViews_identical':True,'contacts':[{'group':r['group'],'delta_y':r['uniform_delta_y'],'final_paw_min_y':min(rows[r['group']]),'support_top_y':r['target_paw_bottom_y'],'absolute_contact_error_m':abs(min(rows[r['group']])-r['target_paw_bottom_y']),'actual_glb_paw_vertex_occurrences_checked':len(rows[r['group']]),'source_vertex_keys_all_matched':len(seen[r['group']])} for r in groups],'v2_unchanged':hashlib.sha256((OUT/'street-reference-v2.glb').read_bytes()).hexdigest()==hashlib.sha256(sraw).hexdigest()}
(ROOT/'v3-cat-contact-report.json').write_text(json.dumps(report,indent=2));contract=json.loads((OUT/'scene-contract-v2.json').read_text());contract['schema']='game628.reference.street.v3';contract['model']=path.name;contract['sha256']=report['candidate_sha256'];contract['changesFromV2']='Only 3 whole-cat Y translations to put actual paw minima onto supporting surfaces; other geometry/material streams unchanged.';contract['catContactRepair']=report['contacts'];contract['status']='frozen_v3_exact_cat_contact_numeric_verified_reimport_pending';(OUT/'scene-contract-v3.json').write_text(json.dumps(contract,indent=2));print('FINAL_V3_READY',report['candidate_sha256'],changed_vertices,report['contacts'])
