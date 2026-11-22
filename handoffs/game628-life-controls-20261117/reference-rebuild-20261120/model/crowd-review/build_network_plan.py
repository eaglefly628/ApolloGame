import json,math,hashlib,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parent;source=ROOT.parent/'movement-review/obstacle-proxies.json';proxies=json.loads(source.read_text())
ox,oz,s,cols,rows=-9.4,.4,.2,94,19;N=cols*rows;R=.25
blocked=[];cost=[]
for r in range(rows):
 for c in range(cols):
  x,z=ox+c*s,oz+r*s;cx,cz=x+s/2,z+s/2;hit=False
  for p in proxies['obstacles']:
   px,pz=p['center'];sh=p['shape']
   if sh['kind']=='box':hit=not(x+s<px-sh['width']/2 or x>px+sh['width']/2 or z+s<pz-sh['height']/2 or z>pz+sh['height']/2)
   else:
    dx=max(x-px,0,px-x-s);dz=max(z-pz,0,pz-z-s);hit=dx*dx+dz*dz<=sh['radius']**2
   if hit:break
  blocked.append(int(hit));k=1 if 1.8<=cz<=3.1 else 2 if 1.6<=cz<=3.3 else 4
  if abs(cx)>8.2:k=max(k,3)
  cost.append(k)
grid={'originX':ox,'originY':oz,'cellSize':s,'cols':cols,'rows':rows,'blocked':blocked,'cost':cost}
# Exact arithmetic/formula mirror of navigation-grid.ts + rasterizeBlocked; actual engine verification follows separately.
baked=[0]*N;half=s/2;gx,gz=ox+half,oz+half
for i,v in enumerate(blocked):
 if not v:continue
 x=ox+(i%cols)*s;z=oz+(i//cols)*s
 loC=max(0,math.ceil((x-R-half-gx)/s));hiC=min(cols-1,math.floor((x+s+R+half-gx)/s));loR=max(0,math.ceil((z-R-half-gz)/s));hiR=min(rows-1,math.floor((z+s+R+half-gz)/s))
 for rr in range(loR,hiR+1):
  for cc in range(loC,hiC+1):baked[rr*cols+cc]=1
for r in range(rows):
 for c in range(cols):
  if min(c,r,cols-c-1,rows-r-1)*s<R:baked[r*cols+c]=1
nodes=[];nodeat={};edges=[]
for r in range(rows):
 for c in range(cols):
  if not baked[r*cols+c]:nodeat[(c,r)]=len(nodes);nodes.append({'x':ox+(c+.5)*s,'y':oz+(r+.5)*s})
for (c,r),i in nodeat.items():
 for dx,dz in [(1,0),(0,1),(1,1),(-1,1)]:
  if (c+dx,r+dz) not in nodeat:continue
  if dx and dz and ((c+dx,r) not in nodeat or (c,r+dz) not in nodeat):continue
  edges.append({'a':i,'b':nodeat[(c+dx,r+dz)]})
configs=[((-8.1,1.9),(8.3,2.9),(-8.1,1.9)),((8.1,3.1),(-8.3,2.1),(8.1,3.1)),((-5.7,3.1),(7.5,1.9),(-7.7,2.9)),((5.7,1.9),(-7.5,3.1),(7.7,2.1)),((-3.3,1.9),(8.5,2.5),(-7.9,2.9)),((3.3,3.1),(-8.5,2.5),(7.9,2.1)),((-.9,3.1),(6.9,1.9),(-6.7,2.9)),((.9,1.9),(-6.9,3.1),(6.7,2.1))]
residents=[{'id':'street_resident_'+str(i+1),'spawn':{'x':a[0],'y':a[1]},'waypoints':[{'x':b[0],'y':b[1]},{'x':c[0],'y':c[1]}],'routeMode':'pingpong','radius':R,'enabled':True} for i,(a,b,c) in enumerate(configs)]
adj=[[] for _ in nodes]
for e in edges:adj[e['a']].append(e['b']);adj[e['b']].append(e['a'])
components=[];seen=set()
for i in range(len(nodes)):
 if i in seen:continue
 q=[i];seen.add(i);comp=[]
 for n in q:
  comp.append(n)
  for k in adj[n]:
   if k not in seen:seen.add(k);q.append(k)
 components.append(comp)
main=set(max(components,key=len))
def ni(p):return nodeat.get((math.floor((p['x']-ox)/s),math.floor((p['y']-oz)/s)))
for person in residents:
 for p in [person['spawn']]+person['waypoints']:assert ni(p) in main,('resident point blocked/disconnected',person['id'],p)
mind=min(math.hypot(a['spawn']['x']-b['spawn']['x'],a['spawn']['y']-b['spawn']['y']) for i,a in enumerate(residents) for b in residents[i+1:]);assert mind>.5
approaches=[{'shop':'grocery','point':{'x':-8.3,'y':.9}},{'shop':'bakery','point':{'x':-4.1,'y':.9}},{'shop':'noodles','point':{'x':.9,'y':1.7}},{'shop':'catcafe','point':{'x':4.1,'y':.9}},{'shop':'repair','point':{'x':8.3,'y':.9}}]
for a in approaches:a['profileFree']=ni(a['point']) in main
j={'schema':'game628.street-crowd-network.v1','seed':6281120,'axes':'sim{x,y} equals scene{X,Z}','grid':grid,'profile':{'radius':R},'bakedGrid':{**grid,'blocked':baked},'bakedGraph':{'nodes':nodes,'edges':edges},'residents':residents,'shopApproachChecks':approaches,'costZones':[{'region':'Z1.8..3.1','cost':1,'purpose':'Main social passing corridor'},{'region':'Z1.6..1.8 or3.1..3.3','cost':2,'purpose':'Soft shoulder for ORCA sidestep'},{'region':'Z<1.6 orZ>3.3','cost':4,'purpose':'Keep shop pockets and curb edge less busy, still walkable where not blocked'},{'region':'absX>8.2','cost':3,'combine':'max','purpose':'Turnaround ends'}],'sourceObstacleFile':str(source),'sourceObstacleFileSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceObstacleCount':len(proxies['obstacles']),'blockedConstruction':'Cells intersect raw physical compound box/circle only, NO actor-radius expansion. NavigationProfile.radius .25 performs the single clearance expansion. Circle poles are blocked, not just high-cost.','rawPhysicalGridBounds':{'minX':ox,'maxX':ox+cols*s,'minZ':oz,'maxZ':oz+rows*s},'runtimePlayerCenterBounds':proxies['playerCenterBounds'],'boundaryNotes':'Profile conservatively removes full boundary cells too; padded raw grid origin compensates that. Keep existing Bounds X±8.95,Z.8..3.8, do not preblock this center-band boundary then inflate again.','validation':{'engineSourceInspected':['src/skills/tier2/navigation-grid.ts','src/engine/spatial/navmesh.ts'],'method':'source-algorithm mirror; actual bake verification pending','rawBlockedCells':sum(blocked),'derivedFreeCells':len(nodes),'derivedGraphEdges':len(edges),'components':len(components),'componentSizes':sorted([len(c) for c in components],reverse=True),'all8SpawnsAnd16WaypointsInLargestComponent':True,'minimumSpawnCenterDistance':mind,'requiredNonoverlapDistance':.5,'shopApproachFreeCount':sum(a['profileFree'] for a in approaches)},'notes':['Default8 passers plus5 shopkeepers =13 residents; do not instantiate extra disabled candidates automatically.','Routes deliberately cross in broad center zone; no simultaneous shared endpoint or bottleneck in front of shops.','Use existing ORCA radius .25, not a second raster expansion. No guarantee of runtime progress from graph connectivity alone; run the intended multi-thousand-tick crowd test.','Crowd goals avoid front pockets; optional shop approach cells carry high cost, not hard blockage.','Use actual derived full edges for debug visualization; these are not decorative straight desire lines.']}
tmp=ROOT/'network-plan.json.tmp';tmp.write_text(json.dumps(j,indent=2));tmp.replace(ROOT/'network-plan.json');print('CROWD_NETWORK_READY',j['validation'],approaches)
