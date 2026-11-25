"""Offline Apollo scene composition. No new game systems or renderer changes."""
import json,copy
from pathlib import Path
R=Path(__file__).resolve().parents[1];OUT=R/'public/scenes';A=R/'public/art/reference-rebuild-20261120'
old=json.loads((OUT/'art-street.json').read_text())
contract_path=A/'scene/scene-contract-v4.json'
contract=json.loads(contract_path.read_text()) if contract_path.exists() else {}
chars_path=Path(__file__).resolve().parent/'character/character-contract-current.json'
chars=json.loads(chars_path.read_text()) if chars_path.exists() else {}
traveler=next((v for v in chars.get('variants',[]) if v['role']=='traveler'),{})
nominal=traveler.get('nominalWalkSpeed',.922146)/60
wave_duration=next((c['duration'] for c in traveler.get('clips',[]) if c['name']=='wave'),4.7333)*1000
E={'reference-street':{'Transform3D':{'x':0,'y':0,'z':0},'Model3D':{'modelKey':'reference-street'}},
 'camera':{'Camera3D':{'yaw':.025,'pitch':.10,'distance':20,'projection':'perspective','fov':28,'near':.1,'far':5000,'pivotX':0,'pivotY':3.1,'pivotZ':1.0}},
 'sky':{'Sky3D':{'top':0x4fa5ed,'bottom':0x9bd4f2,'clouds':False,'cloudTint':0xf2eee1,'scroll':0,'env':.12}},
 'sun':{'Light3D':{'kind':'directional','color':0xffe2ad,'intensity':3.35,'dirX':.65,'dirY':-1.0,'dirZ':-.75,'castShadow':True}},
 'ambient':{'Light3D':{'kind':'ambient','color':0xb9cce4,'intensity':.95}},
 'ground-continuation':{'Transform3D':{'x':0,'y':-.30,'z':9},'Mesh3D':{'shape':'box','width':80,'height':.24,'depth':20,'frontTint':0x89918b},'Material3D':{'color':0x89918b,'roughness':.94}},
 'post':{'Post3D':{'ao':{'intensity':.45,'radius':.35,'scale':.8},'grade':{'contrast':1.0,'saturation':1.05,'exposure':1.08},'aa':True}}}
# Current renderer frames shadows by entity positions, not imported GLB extents.
# Transparent 1mm framing anchors declare the full asset bounds through existing render data.
bb=contract.get('bounds',{'min':[-11.5,-.25,-9],'max':[11.2,8.3,4.9]})
for i,(x,y,z) in enumerate([bb['min'],bb['max']]):
 E['shadow-framing-'+str(i)]={'Transform3D':{'x':x,'y':y,'z':z},'Mesh3D':{'shape':'box','width':.001,'height':.001,'depth':.001,'frontTint':0xffffff},'Material3D':{'transparent':True,'opacity':0}}
# Closed local-light budget: four lamps, two shadow casters, finite cones/ranges.
suggestions=contract.get('runtimeLightSuggestions',[])
if not suggestions:suggestions=[{'id':name+'.interior','position':[x,2.3,-.74],'target':[x,.55,-.65],'distance':2.3,'angle':.58,'penumbra':.55,'castShadowRecommendation':i<2} for i,(name,x) in enumerate([('bakery',-4.35),('noodles',.9),('catcafe',4.55),('repair',8.35)])]
lamps=[]
for i,l in enumerate(suggestions[:4]):
 name=l['id'].split('.')[0];x,y,z=l['position'];tx,ty,tz=l['target'];lamps.append((name,x,y,z))
 E['lamp-'+name]={'Light3D':{'kind':'point' if i<2 else 'spot','color':0xffc484,'intensity':18 if i<2 else 10,'x':x,'y':y,'z':z,'dirX':tx-x,'dirY':ty-y,'dirZ':tz-z,'range':3.0 if i<2 else l['distance'],'decay':2,'angle':l['angle'],'penumbra':l['penumbra'],'castShadow':i<2}}
player=copy.deepcopy(old['manifest']['entities']['player']);player['Transform']['x']=-1.6;player['Transform']['y']=2.6;player['Model3D']={'modelKey':'reference-traveler','scale':1};player['AnimState3D']={'clip':'walk','speed':1,'loop':True,'speedAtVelocity':1.2};player['Bounds']={'minX':-9.2,'maxX':9.2,'minY':.55,'maxY':4.05}
if (A/'scene/background-reference.glb').exists():E['distant-skyline']={'Transform3D':{'x':0,'y':0,'z':0},'Model3D':{'modelKey':'reference-background'}}
# Set a comfortable life-sim stroll speed; the character contract can calibrate the final gait.
player['Controllable']['speed']=.02
player['FaceDir']={'x':1,'y':0};player['FaceRotate']={'source':'velocity'}
player['Shape']={'kind':'circle','radius':.25,'category':1,'mask':2}
E['player']=player
obstacles_path=R/'reference-rebuild-20261120/model/movement-review/obstacle-proxies.json'
if obstacles_path.exists():
 obstacles=json.loads(obstacles_path.read_text())
 for obstacle in obstacles['obstacles']:
  E['walk-blocker-'+obstacle['id']]={'Transform':{'x':obstacle['center'][0],'y':obstacle['center'][1],'rotation':0,'scaleX':1,'scaleY':1},'Shape':{**obstacle['shape'],'category':2,'mask':1}}
E['camera-anchor']=copy.deepcopy(old['manifest']['entities']['camera-anchor']);E['camera-anchor']['Transform'].update(x=-1.6,y=2.6);E['camera-anchor']['Mesh3D'].update(width=.00001,height=.00001,depth=.00001)
E['camera-anchor']['Bounds']={'minX':-8.95,'maxX':8.95,'minY':.8,'maxY':3.8}
E['camera-focus-offset']={'Transform3D':{'x':0,'y':2.3-.000005,'z':0},'Pivot3D':{'children':['camera-anchor']}}
for i,(x,z) in enumerate([(-8.25,-.97),(-4.35,-1.24),(.75,-1.10),(4.4,-1.3),(8.9,-.5)]):
 E['shopkeeper-'+str(i)]={'Transform3D':{'x':x,'y':0,'z':z,'rotY':0},'Model3D':{'modelKey':'reference-shopkeeper','scale':.95},'AnimState3D':{'clip':'idle' if i!=1 else 'wave','speed':1,'loop':True}}

face_path=R/'face-studio-20261120/face-contract.json'
face_contract=json.loads(face_path.read_text()) if face_path.exists() else {}
for i,npc in enumerate(face_contract.get('npcs',[])):
 E['shopkeeper-'+str(i)]['Model3D']['modelKey']=npc['modelKey']

def preset(label,sun,ambient,sky,local):
 return {'label':label,'patches':[{'entity':'sun','component':'Light3D','values':sun},{'entity':'ambient','component':'Light3D','values':ambient},{'entity':'sky','component':'Sky3D','values':sky},*[{'entity':'lamp-'+name,'component':'Light3D','values':{'intensity':local*(1.8 if name in ['bakery','noodles'] else 1)}} for name,*_ in lamps]]}
env={'initial':'env.day','durationMs':1800,'presets':{
 'env.day':preset('晴日',{'color':0xffe2ad,'intensity':3.35,'dirX':.65,'dirY':-1,'dirZ':-.75},{'color':0xb9cce4,'intensity':.95},{'top':0x4fa5ed,'bottom':0x9bd4f2,'cloudTint':0xf2eee1,'env':.12},10),
 'env.evening':preset('黄昏',{'color':0xffbf85,'intensity':1.75,'dirX':-.85,'dirY':-.45,'dirZ':-.7},{'color':0x9ba7c3,'intensity':.65},{'top':0x868fb9,'bottom':0xe7baa0,'cloudTint':0xbaabba,'env':.07},16),
 'env.night':preset('入夜',{'color':0xa6c1e5,'intensity':.32,'dirX':-.6,'dirY':-.9,'dirZ':-.75},{'color':0x8b9fbe,'intensity':.48},{'top':0x182d4a,'bottom':0x344d69,'cloudTint':0x26354c,'env':.035},21)}}
if 'distant-skyline' in E and (A/'scene/background-reference-tintable.glb').exists():
 E['distant-skyline']['Model3D']['tint']=0xffffff
 for key,tint in [('env.day',0xffffff),('env.evening',0xcbb7bb),('env.night',0x34445e)]:env['presets'][key]['patches'].append({'entity':'distant-skyline','component':'Model3D','values':{'tint':tint}})
links={'host.reference':'reference-street','host.referenceWalk':'reference-walk','host.referenceCharacters':'reference-characters','host.referenceLight':'reference-lighting','host.previous':'material-street'}
B=lambda id,label,action:{'id':id,'type':'Button','props':{'label':label,'action':action,'kind':'quiet','fx':[{'kind':'sheen-hover'}]}}
layout={'id':'prototype','type':'Screen','props':{},'layout':{'direction':'column','padding':0,'gap':0},'children':[
 {'id':'header','type':'Panel','props':{'glass':True},'layout':{'height':44,'direction':'row','align':'center','padding':8,'gap':8},'children':[{'id':'title','type':'Label','layout':{'flex':1},'props':{'text':'梧桐街 · 生活在这里','size':18,'color':'text'}},B('full','街景','host.reference'),B('walk','散步','host.referenceWalk'),B('actors','街坊动作','host.referenceCharacters'),B('light','光影对照','host.referenceLight'),B('previous','上一版','host.previous')]},
 {'id':'scene-stage','type':'Panel','props':{'bare':True},'layout':{'flex':1}},
 {'id':'footer','type':'Panel','props':{'glass':True},'layout':{'height':40,'direction':'row','align':'center','padding':8,'gap':8},'children':[{'id':'instructions','type':'Label','layout':{'flex':1},'props':{'text':'WASD / 方向键 街道前后左右走 · 空格招呼','size':12,'color':'text'}},*[B('time-'+str(i),p['label'],key)for i,(key,p)in enumerate(env['presets'].items())]]}]}
if (OUT/'crowd-street.json').exists():
 links['host.crowd']='crowd-street'
 layout['children'][0]['children'].insert(-1,B('crowd','街坊人群','host.crowd'))
c={'quality':'reference','characters':[{'entity':'player','idle':'idle','walk':'walk','nominalSpeedPerTick':nominal,'gesture':{'action':'pose.wave','clip':'wave','durationMs':wave_duration}}],'assets':[{'kind':'model','key':'reference-street','src':'/art/reference-rebuild-20261120/scene/'+contract.get('model','street-reference.glb')},{'kind':'model','key':'reference-traveler','src':'/art/reference-rebuild-20261120/character/'+next((v['file']for v in chars.get('variants',[]) if v['role']=='traveler'),'traveler-v2.glb')},{'kind':'model','key':'reference-shopkeeper','src':'/art/reference-rebuild-20261120/character/'+next((v['file']for v in chars.get('variants',[]) if v['role']=='shopkeeper'),'shopkeeper-v2.glb')}], 'manifest':{'capabilities':['t1-motion-apply','d1-overlap-detect','t2-collision-resolve','t1-hierarchy-resolve','t2-bounds-clamp','t2-face-rotate'],'entities':E},'keys':{'Space':{'action':'pose.wave'},'ArrowLeft':{'dx':-1},'KeyA':{'dx':-1},'ArrowRight':{'dx':1},'KeyD':{'dx':1},'ArrowUp':{'dy':-1},'KeyW':{'dy':-1},'ArrowDown':{'dy':1},'KeyS':{'dy':1},'Digit1':{'action':'env.day'},'Digit2':{'action':'env.evening'},'Digit3':{'action':'env.night'}},'links':links,'environment':env,'layout':layout}
c['npcFaces']=[{'entity':'shopkeeper-'+str(i),**npc}for i,npc in enumerate(face_contract.get('npcs',[]))]
for npc in face_contract.get('npcs',[]):c['assets'].append({'kind':'model','key':npc['modelKey'],'src':npc['src']})
for cat in contract.get('catEntities',[]):
 x,y,z=cat['position']; key='reference-'+cat['id']
 E[cat['id']]={'Transform3D':{'x':x,'y':y,'z':z},'Model3D':{'modelKey':key,'scale':cat['scale']},'AnimState3D':{'clip':cat['clips'][0]['name'],'speed':1,'loop':True}}
 c['assets'].append({'kind':'model','key':key,'src':'/art/reference-rebuild-20261120/scene/'+cat['asset']})
if 'distant-skyline' in E:c['assets'].append({'kind':'model','key':'reference-background','src':'/art/reference-rebuild-20261120/scene/'+('background-reference-tintable.glb' if (A/'scene/background-reference-tintable.glb').exists() else 'background-reference.glb')})
(OUT/'reference-street.json').write_text(json.dumps(c,ensure_ascii=False,indent=2)+'\n')
walk=copy.deepcopy(c);walk['manifest']['entities']['camera']['Camera3D']={'yaw':.03,'pitch':.1,'distance':14.4,'projection':'perspective','fov':31,'near':.1,'far':5000,'mode':'follow','target':'camera-anchor','follow':{'lag':.18,'lookAhead':.1}};(OUT/'reference-walk.json').write_text(json.dumps(walk,ensure_ascii=False,indent=2)+'\n')
light=copy.deepcopy(c);light['manifest']['entities']['post']['Post3D'].pop('grade');light['layout']['children'][0]['children'][0]['props']['text']='梧桐街 · 光影对照';(OUT/'reference-lighting.json').write_text(json.dumps(light,ensure_ascii=False,indent=2)+'\n')
print('[reference-scene:commit] 3 scene recipes; existing scenes preserved')
# Character library inspection uses the same renderer, light direction and new actors.
people=copy.deepcopy(c)
people['assets']=[a for a in people['assets'] if a['key'] in ['reference-traveler','reference-shopkeeper']]
people.pop('npcFaces',None)
people['manifest']['entities']={k:v for k,v in people['manifest']['entities'].items() if k in ['player','sky','sun','ambient','post','camera']}
pe=people['manifest']['entities'];pe['player'].pop('Shape',None)
for key in ['ArrowUp','KeyW','ArrowDown','KeyS']:people['keys'].pop(key,None)
people['layout']['children'][-1]['children'][0]['props']['text']='← → / A D 走路 · 空格招呼'
pe['player']['Transform'].update(x=-1.3,y=0);pe['player']['Bounds']={'minX':-2.2,'maxX':0,'minY':0,'maxY':0}
pe['player']['FaceDir']={'x':.4,'y':1}
pe['standing-neighbor']={'Transform3D':{'x':1.3,'y':0,'z':0},'Model3D':{'modelKey':'reference-shopkeeper'},'AnimState3D':{'clip':'wave','speed':1,'loop':True}}
pe['floor']={'Transform3D':{'x':0,'y':-.08,'z':0},'Mesh3D':{'shape':'box','width':8,'height':.16,'depth':6,'frontTint':0xcbbd9e},'Material3D':{'color':0xcbbd9e,'roughness':.9}}
pe['camera']['Camera3D']={'yaw':.03,'pitch':.12,'distance':6.3,'projection':'perspective','fov':34,'near':.1,'far':5000,'pivotX':0,'pivotY':.9,'pivotZ':0}
people['environment']['presets']={k:{'label':v['label'],'patches':[p for p in v['patches'] if p['entity'] in pe]}for k,v in people['environment']['presets'].items()}
people['layout']['children'][0]['children'][0]['props']['text']='街坊居民 · 动作库实机观察'
(OUT/'reference-characters.json').write_text(json.dumps(people,ensure_ascii=False,indent=2)+'\n')
# Preserve the independently authored weather overlay when regenerating base scenes.
# Adapt its v1 collision input to the actual current GLB, without editing its source.
if (R/'weather/assemble.mjs').exists():
 import subprocess
 subprocess.run(['node',str(Path(__file__).resolve().parent/'refresh-weather.mjs')],check=True)
