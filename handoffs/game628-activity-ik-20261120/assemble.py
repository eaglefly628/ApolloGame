from copy import deepcopy
from hashlib import sha256
from pathlib import Path
import json

HERE = Path(__file__).resolve().parent
SITE = HERE / 'site'
SCENES = SITE / 'scenes'
BASE = Path('/private/tmp/game628-final.xQX8h8/extracted/site/scenes')

def read(path):
    return json.loads(path.read_text())

def scene(name):
    return read(BASE / (name + '.json'))

def write(name, value):
    (SCENES / (name + '.json')).write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n')

def panel(spec, id):
    return next(child for child in spec['layout']['children'] if child['id'] == id)

def button(id, label, action):
    return {'id': id, 'type': 'Button', 'props': {'label': label, 'action': action, 'kind': 'quiet'}}

def label(id, text):
    return {'id': id, 'type': 'Label', 'props': {'text': text, 'size': 13, 'color': 'text'}, 'layout': {'flex': 1}}

def box(x, y, z, dimensions, color):
    w, h, d = dimensions
    return {'Transform3D': {'x':x, 'y':y, 'z':z},
            'Mesh3D': {'shape':'box', 'width':w, 'height':h, 'depth':d, 'frontTint':color},
            'Material3D': {'color':color, 'roughness':.9}}

source = read(HERE / 'martial-source.json')
new_model = '/art/street-performers/traveler-martial-preview.glb'
old_model = '/art/street-performers/traveler-performances.glb'
for path, key in [(old_model, 'previousModelSha256'), (new_model, 'modelSha256')]:
    assert sha256((SITE / path[1:]).read_bytes()).hexdigest() == source[key]
crowd = scene('crowd-street')
performance = deepcopy(panel(crowd, 'performance-menu'))
performance['children'][-1:-1] = [button('perform-martial', '武术表演', 'pose.martial')]
performance['children'] += [button('inspect-cat-ik', '猫咪脚掌对照', 'host.catIK')]
standard_recipe = next(r for r in crowd['characters'] if r['entity'] == 'player')
performances = standard_recipe['performances'] + [source['action']]

for name in ['crowd-street', 'reference-street', 'reference-walk', 'crowd-navigation']:
    spec = scene(name)
    player = spec['manifest']['entities']['player']['Model3D']
    old_key = player['modelKey']
    player['modelKey'] = 'street-player-performances-martial'
    asset = {'kind':'model', 'key':player['modelKey'], 'src':new_model}
    if old_key == 'reference-traveler':
        spec['assets'].append(asset)
    else:
        spec['assets'] = [asset if a['key']==old_key else a for a in spec['assets']]
    recipe = next(r for r in spec['characters'] if r['entity'] == 'player')
    recipe.update(performances=performances, stopAction='pose.stop')
    if name != 'crowd-navigation':
        children = spec['layout']['children']
        if any(child['id']=='performance-menu' for child in children):
            children[:] = [deepcopy(performance) if c['id']=='performance-menu' else c for c in children]
        else:
            children.insert(len(children)-1, deepcopy(performance))
        spec['links']['host.catIK'] = 'cat-ik-comparison'
    write(name, spec)

template = scene('reference-characters')
entities = {key: deepcopy(template['manifest']['entities'][key]) for key in ('camera','sky','sun','ambient')}
entities['camera']['Camera3D'] = {
    'mode':'orbit', 'projection':'perspective', 'distance':4.3, 'fov':39,
    'near':.01, 'far':100, 'pitch':.31, 'yaw':0, 'pivotX':0, 'pivotY':.29, 'pivotZ':0,
}
entities['floor'] = box(0,-.08,0,(8,.16,5),0xd2c1a6)
for x, key in [(-1.19,'fk'),(1.19,'ik')]:
    entities['cat-'+key] = {
        'Transform3D': {'x':x,'y':0,'z':0},
        'Model3D': {'modelKey':'floor-cat-ik-study','scale':1},
        'AnimState3D': {'clip':'cat_paws_'+key, 'speed':1, 'loop':True},
    }
    entities['threshold-'+key] = box(x+.43,.0325,0,(.86,.065,.86),0x977959)

controls = deepcopy(performance)
controls['children'] = [
    label('cat-fk-label','左侧 · FK 脚步'),
    label('cat-ik-label','右侧 · Apollo IK 修正'),
    button('cat-street','返回梧桐街','host.crowdStreet'),
]
header = deepcopy(panel(template,'header'))
header['children'] = [label('cat-title','猫咪脚掌对照 · 原地转向与 6.5 cm 台阶')]
layout = deepcopy(template['layout'])
layout['children'] = [header, deepcopy(panel(template,'scene-stage')), controls]
write('cat-ik-comparison', {
    'quality':'reference', 'layout':layout, 'keys':{}, 'links':{'host.crowdStreet':'crowd-street'},
    'assets':[{'kind':'model','key':'floor-cat-ik-study','src':'/art/reference-rebuild-20261120/scene/cat-floor-ik-study.glb'}],
    'manifest':{'capabilities':[],'entities':entities},
})
