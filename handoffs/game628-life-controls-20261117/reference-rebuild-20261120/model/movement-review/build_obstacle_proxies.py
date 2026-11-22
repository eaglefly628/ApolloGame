import json,hashlib,math
from pathlib import Path
ROOT=Path(__file__).resolve().parent;MODEL=ROOT.parent;OUT=MODEL.parent.parent/'public/art/reference-rebuild-20261120/scene'
source=json.loads((ROOT/'source-entrance-measurements.json').read_text());rows=source['objects'];cat=json.loads((ROOT/'animated-floor-cat-envelope.json').read_text());proxies=[]
def group(patterns):return [o for o in rows if any(o['name'].startswith(p) for p in patterns)]
def box(ident,patterns,reason,extra=None):
 oo=group(patterns);assert oo;lo=[min(o['min'][i] for o in oo) for i in range(3)];hi=[max(o['max'][i] for o in oo) for i in range(3)]
 if extra:
  lo=[min(lo[i],extra['min'][i]) for i in range(3)];hi=[max(hi[i],extra['max'][i]) for i in range(3)]
 v={'id':ident,'center':[(lo[0]+hi[0])/2,(lo[2]+hi[2])/2],'shape':{'kind':'box','width':hi[0]-lo[0],'height':hi[2]-lo[2]},'rawBounds':{'min':lo,'max':hi},'sourceObjects':[o['name'] for o in oo],'reason':reason,'playerRadiusAlreadyAdded':False}
 if extra:v['animationEnvelope']={'asset':'cat-floor-idle.glb','clip':'cat_idle','sampleHz':120,'samples':cat['sample_count'],'bounds':extra}
 proxies.append(v)
for x,tag in [(-8.9,'left'),(-.1,'middle'),(7.5,'right')]:
 oo=[o for o in group(['street.bollard.']) if abs((o['min'][0]+o['max'][0])/2-x)<.2];pts=[p for o in oo for p in o['vertices']];radius=max(math.hypot(p[0]-x,p[2]-4.04) for p in pts);proxies.append({'id':'bollard_'+tag,'center':[x,4.04],'shape':{'kind':'circle','radius':radius},'sourceObjects':[o['name'] for o in oo],'reason':'Foot ring is widest part; actual pole Z4.04, not nominal street limit.','playerRadiusAlreadyAdded':False})
box('grocery_left_crate_and_planter',['grocery.street.planter.','grocery.empty.crate','grocery.blue.producebox'],'Overlapping loose crate/blue box/plant at street edge; one compound avoids invisible narrow collision pockets.')
box('grocery_right_bakery_left_entrance_cluster',['grocery.street.planter2.','grocery.side.crate','grocery.cabbage','bakery.street.planter.','bakery.baguette.basket','bakery.board.'],'Cabbage crate, shared-edge pots, baguette basket and bakery chalkboard. Their remaining gaps are below .5m avatar diameter, so conservatively closed as one compound.')
box('bakery_right_planter',['bakery.street.planter2.'],'One entrance planter; does not close alley center.')
box('noodles_stools_sign_and_neighbor_pots',['noodles.street.planter','noodles.board.','noodles.stool.','catcafe.street.planter.'],'Three stools leave only about .2m between seats, below .5m avatar diameter. Combined with sign and adjacent pots; approach noodles from Z>=1.40.')
box('cat_sign_animated_cat_and_repair_edge_plant',['catcafe.board.','catcafe.street.planter2.','repair.street.planter.'],'Includes full measured idle envelope of pavement cat, chalkboard and adjoining pots. Narrow gaps are closed; cat-cafe approach remains clear left of cat.',cat['actual_animated_bounds'])
R=.25
bounds={'minX':-8.95,'maxX':8.95,'minZ':.8,'maxZ':3.8}
def blocked(x,z):
 for p in proxies:
  cx,cz=p['center'];s=p['shape']
  if s['kind']=='circle':
   if (x-cx)**2+(z-cz)**2<(s['radius']+R)**2-1e-9:return p['id']
  else:
   dx=max(abs(x-cx)-s['width']/2,0);dz=max(abs(z-cz)-s['height']/2,0)
   if dx*dx+dz*dz<R*R-1e-9:return p['id']
 return None
approach=[{'shop':'grocery','centerXZ':[-8.25,.90]},{'shop':'bakery','centerXZ':[-4.15,.90]},{'shop':'noodles','centerXZ':[.90,1.42]},{'shop':'catcafe','centerXZ':[4.10,.90]},{'shop':'repair','centerXZ':[8.35,.85]}]
for p in approach:assert not blocked(*p['centerXZ']),('approach blocked',p)
count=0
for i in range(181):
 x=bounds['minX']+i*(bounds['maxX']-bounds['minX'])/180
 for k in range(43):
  z=1.5+k*(3.6-1.5)/42;assert not blocked(x,z),('through lane blocked',x,z,blocked(x,z));count+=1
j={'schema':'game628.movement-obstacles.v1','status':'finite_final_prototype_proxy_set','sourceStaticAsset':'street-reference-v4.glb','sourceStaticSha256':hashlib.sha256((OUT/'street-reference-v4.glb').read_bytes()).hexdigest(),'sourceEditableBlend':source['source'],'sourceEditableBlendSha256':source['source_sha256'],'sourceVerticalSlab':source['vertical_slice'],'playerRadius':R,'inflation':'All shape radii/width/depth are uninflated physical compound bounds. Engine adds player radius once. shape.height is Z depth, not world Y.','playerCenterBounds':bounds,'boundsRecommendation':'Center Z.8..3.8 is feasible with these entrance/pole proxies; do not subtract player radius from this already-effective center Bounds again.','preferredContinuousThroughLane':{'minZ':1.5,'maxZ':3.6,'minX':-8.95,'maxX':8.95,'gridSamplesVerifiedFree':count,'note':'Wide uninterrupted route. Smaller Z used for approaching a shop in open pockets; larger Z detours around bollards.'},'safeApproachCenters':approach,'obstacles':proxies,'omittedDeliberately':[{'object':'repair front bicycle','reason':'Largest Z about.473; with playerR.25 this ends atcenterZ.723, below effective minZ.8. Do not add another wide bike collider that blocks safe approach.'},{'object':'store counters / elevated cats / balcony / awning','reason':'Counters and elevated cats lie behind center-band clearance; awning valances start above avatar height1.79. Street-only movement, no indoor traversal.'},{'object':'far-end plants and tree trunk','reason':'Beyond X center Bounds±8.95 plus .25m avatar clearance; not part of this finite prototype set.'}],'limits':['XZ proxies are intentionally conservative and finite, not a navigation mesh or exact concave collision mesh.','Compound boxes close physical gaps too small for a .5m diameter avatar; do not also add each source component separately.','Do not spawn inside a proxy; preserve axis-separated sliding/rejection behavior of existing movement capabilities.','NPC interaction range may need to account for noodle counter/stool separation; closest free approach is roughly Z1.4, not storefront Z0.']}
tmp=ROOT/'obstacle-proxies.json.tmp';tmp.write_text(json.dumps(j,indent=2));tmp.replace(ROOT/'obstacle-proxies.json');print('FINAL_PROXY_SET_READY',len(proxies),'obstacles;',count,'through-lane samples free')
