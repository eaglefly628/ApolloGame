"""Independent finite geometry/UV/tangent, texture and current scene-asset reference checks."""
import hashlib
import importlib.util
import json
import math
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('material_review',ROOT/'material-study-20261119/review-materials.py')
review=importlib.util.module_from_spec(spec);spec.loader.exec_module(review)
data=json.loads((ROOT/'public/scenes/reference-street.json').read_text())
report=[]
for asset in data['assets']:
    assert asset['kind']=='model'
    path=ROOT/'public'/asset['src'].lstrip('/')
    g,binary=review.glb(path);primitive_count=0;vertex_count=0;uv_sets=set();tangent_count=0
    for mesh in g.get('meshes',[]):
        for p in mesh['primitives']:
            primitive_count+=1;attrs=p['attributes'];count=g['accessors'][attrs['POSITION']]['count'];vertex_count+=count
            for semantic,index in attrs.items():
                meta,payload=review.payload(g,binary,index)
                if semantic.startswith(('POSITION','NORMAL','TEXCOORD','TANGENT','COLOR')):
                    assert meta[2]==count
                    assert meta[0]==5126, (asset['key'],semantic,'finite verifier expects float')
                    assert all(math.isfinite(v[0]) for v in struct.iter_unpack('<f',payload)), (asset['key'],semantic,'non-finite')
                if semantic=='NORMAL':
                    for normal in struct.iter_unpack('<fff',payload):assert abs(sum(v*v for v in normal)-1)<5e-4
                if semantic.startswith('TEXCOORD'):uv_sets.add(semantic)
                if semantic=='TANGENT':
                    tangent_count+=count
                    for x,y,z,w in struct.iter_unpack('<ffff',payload):assert abs(x*x+y*y+z*z-1)<5e-4 and abs(abs(w)-1)<1e-5
            if 'indices'in p:
                a=g['accessors'][p['indices']];_,payload=review.payload(g,binary,p['indices']);fmt={5121:'B',5123:'H',5125:'I'}[a['componentType']]
                assert max(v[0] for v in struct.iter_unpack('<'+fmt,payload))<count
            material=g.get('materials',[{}])[p.get('material',0)]
            maps=[material.get(k)for k in ('normalTexture','occlusionTexture','emissiveTexture')]
            maps.extend(material.get('pbrMetallicRoughness',{}).get(k)for k in ('baseColorTexture','metallicRoughnessTexture'))
            for texture in filter(None,maps):
                assert 0<=texture['index']<len(g['textures'])
                uv=texture.get('extensions',{}).get('KHR_texture_transform',{}).get('texCoord',texture.get('texCoord',0))
                assert 'TEXCOORD_'+str(uv)in attrs
    images=[]
    for image in g.get('images',[]):
        if 'bufferView'in image:
            view=g['bufferViews'][image['bufferView']];offset=view.get('byteOffset',0);payload=binary[offset:offset+view['byteLength']]
        else:payload=(path.parent/image['uri']).read_bytes()
        images.append(review.png(payload))
    for texture in g.get('textures',[]):assert 0<=texture['source']<len(g.get('images',[]))
    report.append({'key':asset['key'],'file':asset['src'],'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'primitives':primitive_count,'vertices':vertex_count,'uvSets':sorted(uv_sets),'tangentVertices':tangent_count,'validatedPngImages':len(images),'animations':[a.get('name')for a in g.get('animations',[])],'emissiveMaterials':[m.get('name')for m in g.get('materials',[])if max(m.get('emissiveFactor',[0,0,0]))>0]})
print(json.dumps({'status':'pass','assets':report},indent=2))
