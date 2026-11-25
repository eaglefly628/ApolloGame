"""Offline scene recipes only; existing Apollo host/rendering consumes unchanged protocols."""
import json,hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SCENES=ROOT/'public/scenes'
base=json.loads((SCENES/'art-overview.json').read_text())
links={'host.matOriginalDay':'material-original-day','host.matDetailDay':'material-detail-day','host.matOriginalEvening':'material-original-evening','host.matDetailEvening':'material-detail-evening','host.matStreet':'material-street','host.matParts':'art-parts','host.matOriginalStreet':'art-overview','host.matClose':'material-close-detail-day'}

def button(id,label,action):return {'id':id,'type':'Button','props':{'label':label,'action':action,'kind':'quiet','fx':[{'kind':'sheen-hover'}]}}
def layout(title,subtitle,street=False):
 c=json.loads(json.dumps(base['layout']))
 header=c['children'][0];header['children']=header['children'][:1]+[button('street','五店材质','host.matStreet'),button('single','单栋对照','host.matDetailDay'),button('close','材质近景','host.matClose'),button('original-street','原街区','host.matOriginalStreet')]
 titles=header['children'][0]['children'];titles[0]['props']['text']=title;titles[1]['props']['text']=subtitle
 foot=c['children'][-1]
 if street:
  foot['children'][0]['props']['text']='果蔬铺 / 面包房 / 面馆 / 猫咖 / 修车铺 · 五种材质身份 · 同一套K线结构'
 else:
  foot['children']=[{'id':'compare-notes','type':'Label','layout':{'flex':1},'props':{'text':'同机位 · 同光照 · 原模型几何保持','size':12,'color':'text'}},button('original-day','原版白天','host.matOriginalDay'),button('detail-day','实验白天','host.matDetailDay'),button('original-evening','原版傍晚','host.matOriginalEvening'),button('detail-evening','实验傍晚','host.matDetailEvening')]
 return c

# Isolate the same existing grocery assembly; every baseline and variant shares all transforms, lighting and geometry.
keep={'sky','sun','ambient','street-underlay','walkway-support','curb','road'}
keep.update(k for k in base['manifest']['entities'] if k.startswith(('grocery-','paving-','window-glow-grocery')))
original=json.loads(json.dumps({k:v for k,v in base['manifest']['entities'].items() if k in keep}))
for v in original.values():
 if 'Transform3D' in v:v['Transform3D']['x']+=9.6
# Center the existing paving/platform for an isolated building view.
for k in ['street-underlay','walkway-support','curb','road']:
 original[k]['Transform3D']['x']=0
 original[k]['Mesh3D']['width']=9
for k in list(original):
 if k.startswith('paving-') and abs(original[k]['Transform3D']['x'])>4.3:del original[k]
original['camera']={'Camera3D':{'yaw':.22,'pitch':.10,'distance':14.4,'projection':'perspective','fov':34,'near':.1,'far':5000,'pivotX':0,'pivotY':3.2,'pivotZ':-1.1}}
# Select only relevant global preset fields; no new light introduced in isolated comparison.
for variant in ['original','detail']:
 for time in ['day','evening']:
  c=json.loads(json.dumps(base));c['manifest']['entities']=json.loads(json.dumps(original));c['manifest']['capabilities']=[];c['keys']={};c.pop('environment',None);c['links']=links
  preset=base['environment']['presets']['env.afternoon' if time=='day' else 'env.evening']
  for patch in preset['patches']:
   if patch['entity'] in c['manifest']['entities']:c['manifest']['entities'][patch['entity']][patch['component']].update(patch['values'])
  if variant=='detail':c['manifest']['entities']['grocery-residence']['Model3D']['modelKey']='mat-grocery'
  used={v['Model3D']['modelKey'] for v in c['manifest']['entities'].values() if 'Model3D' in v}
  c['assets']=[a for a in c['assets'] if a['key'] in used]
  if variant=='detail':c['assets'].append({'kind':'model','key':'mat-grocery','src':'/art/material-study-20261119/housing-e-detail.glb'})
  c['layout']=layout('果蔬铺住宅 · '+('原版' if variant=='original' else '材质实验')+' · '+('白天' if time=='day' else '傍晚'),'真实引擎对照 · 本地材质草案 · 仅替换建筑材质与贴图坐标')
  (SCENES/f'material-{variant}-{time}.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
# Close views use identical cameras to inspect surface detail, without changing geometry.
for variant in ['original','detail']:
 for time in ['day','evening']:
  c=json.loads((SCENES/f'material-{variant}-{time}.json').read_text())
  c['manifest']['entities']['camera']['Camera3D'].update(distance=8.3,pivotY=4.65,pivotZ=-1.1)
  for key,value in c['links'].items():
   if value.startswith('material-original-') or value.startswith('material-detail-'):c['links'][key]=value.replace('material-','material-close-',1)
  c['layout']['children'][0]['children'][0]['children'][0]['props']['text']+=' · 近景'
  (SCENES/f'material-close-{variant}-{time}.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
# Separate street candidate; preserve the prior art-overview and all control manifests.
street=json.loads(json.dumps(base));street['links']=links;street['layout']=layout('五间店铺 · 各有材质身份','同一套K线建筑 · 五种表面材质方案 · 本地实机草案',True)
for name,file in [('grocery','housing-e-detail'),('bakery','housing-a-bakery'),('noodles','housing-d-noodles'),('catcafe','housing-h-catcafe'),('bikeshop','housing-a-bikeshop')]:
 key='mat-'+name;street['manifest']['entities'][name+'-residence']['Model3D']['modelKey']=key;street['assets'].append({'kind':'model','key':key,'src':'/art/material-study-20261119/'+file+'.glb'})
used={v['Model3D']['modelKey'] for v in street['manifest']['entities'].values() if 'Model3D' in v}
street['assets']=[a for a in street['assets'] if a['key'] in used]
(SCENES/'material-street.json').write_text(json.dumps(street,ensure_ascii=False,indent=2)+'\n')
print('[material-study:commit] 4 controlled views + separate five-shop candidate; existing scenes preserved')
