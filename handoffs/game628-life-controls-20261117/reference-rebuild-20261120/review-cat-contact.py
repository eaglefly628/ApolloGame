"""Independent v2/v3 binary delta audit plus actual supporting-surface rays below the cats."""
import contextlib
import hashlib
import importlib.util
import io
import json
import runpy
import struct
from pathlib import Path

HERE=Path(__file__).resolve().parent;ROOT=HERE.parent
loader=importlib.util.spec_from_file_location('cat_glb_reader',ROOT/'material-study-20261119/review-materials.py')
reader=importlib.util.module_from_spec(loader);loader.loader.exec_module(reader)
PUBLIC=ROOT/'public/art/reference-rebuild-20261120/scene'
a,old=reader.glb(PUBLIC/'street-reference-v2.glb');b,new=reader.glb(PUBLIC/'street-reference-v3.glb')
groups=json.loads((HERE/'model/cat-contact-v3-deltas.json').read_text())
key=lambda p:tuple(round(float(x)*1e6) for x in p)
lookup={key(p):(r['group'],r['uniform_delta_y']) for r in groups for p in r['source_world_vertex_positions']}
paws={r['group']:{key(p) for p in r['paw_source_positions']} for r in groups}
found={r['group']:set() for r in groups};paw_positions={r['group']:[] for r in groups};final_cat_keys=set();expected=bytearray(old)
assert len(old)==len(new)
for field in ('meshes','nodes','scenes','materials','bufferViews','textures','images'):assert a.get(field)==b.get(field),f'Unexpected v3 change: {field}'
assert all(not any(k in n for k in ('matrix','translation','rotation','scale')) for n in b['nodes'])
for index in sorted({p['attributes']['POSITION'] for m in a['meshes'] for p in m['primitives']}):
    acc=a['accessors'][index];view=a['bufferViews'][acc['bufferView']];base=view.get('byteOffset',0)+acc.get('byteOffset',0);stride=view.get('byteStride',12)
    for i in range(acc['count']):
        offset=base+i*stride;p=struct.unpack_from('<fff',old,offset);q=struct.unpack_from('<fff',new,offset);entry=lookup.get(key(p))
        if entry:
            name,delta=entry;found[name].add(key(p));struct.pack_into('<f',expected,offset+4,p[1]+delta);final_cat_keys.add(key(q))
            if key(p) in paws[name]:paw_positions[name].append(q)
        else:assert p==q,'Non-cat position changed'
assert bytes(expected)==new,'Changed non-cat binary stream or changed a coordinate other than approved cat Y'
for r in groups:assert found[r['group']]=={key(p) for p in r['source_world_vertex_positions']}
with contextlib.redirect_stdout(io.StringIO()):geometry=runpy.run_path(str(HERE/'review-scene-model.py'))
triangles=geometry['triangles'];boxes=geometry['boxes']
source_positions={}
def positions(index):
    if index not in source_positions:source_positions[index]=list(struct.iter_unpack('<fff',reader.payload(a,old,index)[1]))
    return source_positions[index]
cat_mask=[]
for node_index in a['scenes'][a.get('scene',0)]['nodes']:
    node=a['nodes'][node_index];assert not node.get('children')
    if 'mesh'not in node:continue
    for primitive in a['meshes'][node['mesh']]['primitives']:
        points=positions(primitive['attributes']['POSITION']);acc=a['accessors'][primitive['indices']];fmt={5121:'B',5123:'H',5125:'I'}[acc['componentType']]
        indices=[v[0]for v in struct.iter_unpack('<'+fmt,reader.payload(a,old,primitive['indices'])[1])]
        for i in range(0,len(indices),3):cat_mask.append(any(key(points[j])in lookup for j in indices[i:i+3]))
assert len(cat_mask)==len(triangles)
kept=[(t,box) for t,box,cat in zip(triangles,boxes,cat_mask) if not cat]
triangles[:]=[t for t,_ in kept];boxes[:]=[box for _,box in kept]
results=[]
for r in groups:
    name=r['group'];points=paw_positions[name];minimum=min(p[1] for p in points)
    assert abs(minimum-r['target_paw_bottom_y'])<2e-7
    contacts=[]
    for x,z in sorted({(p[0],p[2]) for p in points if abs(p[1]-minimum)<1e-7}):
        hits=geometry['hits']((x,minimum+.025,z),(0,-1,0),.1)
        assert hits,f'No supporting geometry beneath {name}'
        contacts.append({'x':x,'z':z,'surfaceY':hits[0]['point'][1],'mesh':hits[0]['mesh'],'gap':minimum-hits[0]['point'][1]})
    assert contacts and min(abs(c['gap']) for c in contacts)<2e-7,f'No actual surface contact for {name}: {contacts}'
    results.append({'group':name,'actualPawOccurrences':len(points),'matchedSourceKeys':len(found[name]),'pawMinY':minimum,'targetY':r['target_paw_bottom_y'],'absoluteTargetError':abs(minimum-r['target_paw_bottom_y']),'surfaceProbes':contacts})
print(json.dumps({'status':'pass','modelHash':hashlib.sha256((PUBLIC/'street-reference-v3.glb').read_bytes()).hexdigest(),'onlyApprovedWholeCatYChanged':True,'contacts':results},indent=2))
