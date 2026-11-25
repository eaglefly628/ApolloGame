"""Prove the optional background cannot shadow near receivers for current light recipes."""
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public/art/reference-rebuild-20261120/scene'
scene=json.loads((ROOT/'public/scenes/reference-street.json').read_text())
near_file=next(a['src'].split('/')[-1] for a in scene['assets'] if a['key']=='reference-street')
near=json.loads((PUBLIC/near_file.replace('street-reference','scene-contract').replace('.glb','.json')).read_text())
contract=json.loads((PUBLIC/'background-contract.json').read_text())
assert hashlib.sha256((PUBLIC/contract['model']).read_bytes()).hexdigest()==contract['sha256']
background_file=next((a['src'].split('/')[-1] for a in scene['assets'] if a['key']=='reference-background'),contract['model'])
raw=(PUBLIC/background_file).read_bytes()
length=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+length]);binary=raw[20+length+8:]
vertices=[]
for node in g['nodes']:
    assert not node.get('children') and not node.get('matrix') and not node.get('rotation'), 'Background transform needs a fuller verifier'
    if 'mesh' not in node:continue
    offset=node.get('translation',[0,0,0]);scale=node.get('scale',[1,1,1])
    for primitive in g['meshes'][node['mesh']]['primitives']:
        a=g['accessors'][primitive['attributes']['POSITION']];v=g['bufferViews'][a['bufferView']]
        assert a['componentType']==5126 and a['type']=='VEC3'
        start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12)
        for i in range(a['count']):vertices.append(tuple(p*s+t for p,s,t in zip(struct.unpack_from('<fff',binary,start+i*stride),scale,offset)))
bounds={'min':[min(v[i]for v in vertices)for i in range(3)],'max':[max(v[i]for v in vertices)for i in range(3)]}
assert bounds['max'][2]<near['bounds']['min'][2], 'Background overlaps near depth; directional-shadow proof invalid'
for material in g['materials']:
    assert 'KHR_materials_unlit' in material.get('extensions',{})
    if 'tintable' in background_file:assert material.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])==[1,1,1,1]
if 'tintable' in background_file:
    for mesh in g['meshes']:
        for primitive in mesh['primitives']:assert 'COLOR_0' in primitive['attributes']
assert not g.get('extensions',{}).get('KHR_lights_punctual',{}).get('lights')
sun_z=[scene['manifest']['entities']['sun']['Light3D']['dirZ']]
for preset in scene['environment']['presets'].values():
    for patch in preset['patches']:
        if patch['entity']=='sun' and 'dirZ'in patch['values']:sun_z.append(patch['values']['dirZ'])
assert all(math.isfinite(v)and v<0 for v in sun_z)
local=[]
for id,entity in scene['manifest']['entities'].items():
    light=entity.get('Light3D',{})
    if light.get('kind')not in ('point','spot'):continue
    position=[light[k]for k in ('x','y','z')]
    distance=math.sqrt(sum(max(bounds['min'][i]-position[i],0,position[i]-bounds['max'][i])**2 for i in range(3)))
    assert light['range']>0 and distance>light['range'], 'A local light can reach background geometry'
    local.append({'id':id,'range':light['range'],'minimumBackgroundDistance':distance})
entity=scene['manifest']['entities'].get('distant-skyline')
if entity:
    assert entity['Transform3D']=={'x':0,'y':0,'z':0}, 'Non-identity background invalidates depth proof'
print(json.dumps({'backgroundFile':background_file,'backgroundHash':hashlib.sha256(raw).hexdigest(),'preservedRawBackgroundHash':contract['sha256'],'bounds':bounds,'unlitMaterials':len(g['materials']),'nearMinZ':near['bounds']['min'][2],'depthSeparation':near['bounds']['min'][2]-bounds['max'][2],'sunDirZValues':sun_z,'localLightDistances':local,'directionalShadowProof':'All ray directions have negative Z while all near receivers have greater Z than every background vertex','tintable': 'tintable' in background_file},indent=2))
