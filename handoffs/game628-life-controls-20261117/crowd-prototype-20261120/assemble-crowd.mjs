import fs from 'node:fs/promises';import path from 'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'..'),scenes=path.join(root,'public/scenes');
const source=await fs.readFile(path.join(scenes,'reference-walk.json'),'utf8'),plan=JSON.parse(await fs.readFile(path.join(here,'network-plan.json'),'utf8')),base=JSON.parse(source),scene=structuredClone(base),e=scene.manifest.entities;
const performers = JSON.parse(await fs.readFile(path.join(here, 'performers.json'), 'utf8'));
const residents = plan.residents.slice(0, performers.residents.length);
const grid=plan.grid??plan.NavigationGrid;
if(!residents||!grid)throw Error('network-plan requires grid and residents');
scene.manifest.capabilities=[...new Set([...scene.manifest.capabilities,'t2-navigation-grid','t2-pathfind','t2-crowd-avoidance'])];
const topology=plan.bakedGraph,cellCost=n=>grid.cost[Math.floor((n.y-grid.originY)/grid.cellSize)*grid.cols+Math.floor((n.x-grid.originX)/grid.cellSize)];e['crowd-routing']={NavGraph:{nodes:topology.nodes,edges:topology.edges.map(edge=>{const a=topology.nodes[edge.a],b=topology.nodes[edge.b];return{a:edge.a,b:edge.b,cost:Math.hypot(b.x-a.x,b.y-a.y)*(cellCost(a)+cellCost(b))/2};})}};
e['crowd-grid']={NavigationGrid:grid};e['crowd-profile']={NavigationProfile:{gridId:'crowd-grid',radius:.25,goals:[residents[0].waypoints[0]]}};
e.player.Mass={value:1};e.player.CrowdAvoidance={radius:.25,maxSpeed:.02,timeHorizon:35,maxNeighbors:12,neighborDistance:2,group:'street'};
const modelKeys = performers.residents.map(({key}) => key);
for (const {key, src} of performers.residents) scene.assets.push({kind: 'model', key, src});
scene.assets.push({kind: 'model', key: 'street-player-performances', src: performers.playerSrc});
e.player.Model3D.modelKey = 'street-player-performances';
const playerPresentation = scene.characters.find(recipe => recipe.entity === 'player');
playerPresentation.performances = performers.actions;
playerPresentation.stopAction = 'pose.stop';
const ids=[];for(let i=0;i<residents.length;i++){const r=residents[i],id='resident-'+String(i+1).padStart(2,'0'),p=r.spawn??r.start??r, speed=.012+(i%4)*.001;ids.push(id);e[id]={Transform:{x:p.x,y:p.y,rotation:0,scaleX:1,scaleY:1},Velocity:{vx:0,vy:0,angular:0},Mass:{value:1},Bounds:{minX:-9.2,maxX:9.2,minY:.55,maxY:4.05},Model3D:{modelKey:modelKeys[i%modelKeys.length],scale:1},AnimState3D:{clip:'idle',speed:1,loop:true},FaceDir:{x:i%2?-1:1,y:0},FaceRotate:{source:'velocity'},Shape:{kind:'circle',radius:.25,category:4,mask:6},NavAgent:{graphId:'crowd-routing',speed,arriveRange:.16,waypointRange:.15,repathPeriod:90,patrol:{waypoints:r.waypoints,index:0,loop:true}},CrowdAvoidance:{radius:.25,maxSpeed:speed,timeHorizon:35,maxNeighbors:12,neighborDistance:2,group:'street',yieldAfterTicks:90,minRadiusScale:1,zeroEscape:true}};scene.characters.push({entity:id,idle:'idle',walk:'walk',nominalSpeedPerTick:.015369101474231043});}
// Include player in hard contacts and ORCA; retain the original static obstacle pair masks.
e.player.Shape.mask=2;for(const[id,v]of Object.entries(e))if(id.startsWith('walk-blocker-'))v.Shape.mask=5;
const button=(id,label,action)=>({id,type:'Button',props:{label,action,kind:'quiet'}}),label=(id,text)=>({id,type:'Label',props:{text,size:13,color:'text'}});
function layout(debug){return{id:'prototype',type:'Screen',props:{},layout:{direction:'column',padding:0,gap:0},children:[{id:'header',type:'Panel',props:{glass:true},layout:{height:48,direction:'row',align:'center',padding:8,gap:8},children:[{...label('title',debug?'街坊路网 · 实际导航成本':'梧桐街 · 街坊来来往往'),layout:{flex:1}},button('street','居民街景','host.crowdStreet'),button('network','路网与权重','host.crowdNavigation'),button('back','街景总览','host.referenceOverview')]},{id:'scene-stage',type:'Panel',props:{bare:true},layout:{flex:1}},{id:'footer',type:'Panel',props:{glass:true},layout:{height:44,padding:8,direction:'row',align:'center'},children:[label('instructions',debug?'红色：规划禁入与净空余量格；绿色：成本1；橙色：高成本；细蓝线：实际导航边；黄色：巡逻端点示意。':'WASD / 方向键散步 · 居民自动往返并相互避让 · 空格招呼')]}]};}
function withWeather(layout){const panel=base.layout.children.find(n=>n.id==='weather-controls');if(panel)layout.children.splice(2,0,structuredClone(panel));const footer=layout.children.find(n=>n.id==='footer'),old=base.layout.children.find(n=>n.id==='footer');footer.layout.gap=8;footer.children[0].layout={flex:1};footer.children.push(...structuredClone((old?.children??[]).filter(n=>n.type==='Button')));return layout;}
scene.links = {'host.crowdStreet':'crowd-street', 'host.crowdNavigation':'crowd-navigation', 'host.referenceOverview':'reference-street'};
scene.layout = withWeather(layout(false));
const weatherIndex = scene.layout.children.findIndex(node => node.id === 'footer');
scene.layout.children.splice(weatherIndex, 0, {
  id: 'performance-menu', type: 'Panel', props: {glass: true},
  layout: {height: 44, direction: 'row', align: 'center', padding: 8, gap: 8},
  children: [
    label('performance-title', '主角表演'),
    ...performers.actions.map(({clip, label, action}) => button('perform-' + clip, label, action)),
    button('perform-wave', '招手', 'pose.wave'),
    button('perform-stop', '停止', 'pose.stop'),
  ],
});
scene.crowdPrototype={version:2,residentIds:ids,identities:performers.residents,gridEntity:'crowd-grid',profileEntity:'crowd-profile',routingEntity:'crowd-routing',originalObstacleIds:Object.keys(e).filter(id=>id.startsWith('walk-blocker-')),sourceSha256:createHash('sha256').update(source).digest('hex'),navigation:'radius .25 actual NavigationGrid → NavigationProfile → baked graph topology → explicit weighted NavGraph; A* edge cost = world length × mean endpoint source-cell cost',bounds:{minX:-9.2,maxX:9.2,minY:.55,maxY:4.05,note:'Shape bounds, reused original street; red planning clearance cells are not physical walls'},animation:'existing CharacterPresentation uses accepted XZ movement',networkPlan:'crowd-prototype-20261120/network-plan.json'};
await fs.writeFile(path.join(scenes,'crowd-street.json'),JSON.stringify(scene,null,2));
// Debug overlays describe the same radius-baked cells; plan carries the actual engine bake result.
const debug=structuredClone(scene),de=debug.manifest.entities;debug.layout=withWeather(layout(true));de.camera.Camera3D={yaw:0,pitch:1.08,distance:14,projection:'perspective',fov:35,near:.1,far:5000,pivotX:0,pivotY:0,pivotZ:1.5};
const baked=plan.bakedGrid??plan.derivedGrid;if(!baked)throw Error('network-plan requires bakedGrid for faithful debug overlay');
for(let row=0;row<grid.rows;row++){let col=0;while(col<grid.cols){const i=row*grid.cols+col,b=!!baked.blocked[i],cost=grid.cost[i],end=(()=>{let n=col+1;while(n<grid.cols&&!!baked.blocked[row*grid.cols+n]===b&&grid.cost[row*grid.cols+n]===cost)n++;return n;})();const x=grid.originX+col*grid.cellSize,z=grid.originY+row*grid.cellSize,x2=grid.originX+end*grid.cellSize,z2=z+grid.cellSize;de[`nav-cell-${row}-${col}`]={Line3D:{points:[[x,.035,z],[x2,.035,z],[x2,.035,z2],[x,.035,z2],[x,.035,z]],color:b?0xe76767:cost>1?0xf6ac48:0x40d19b,width:.018,opacity:.85}};col=end;}}
if(plan.bakedGraph){const g=plan.bakedGraph,adj=g.nodes.map(()=>[]);g.edges.forEach((v,i)=>{adj[v.a].push([v.b,i]);adj[v.b].push([v.a,i]);});const seen=new Set(),points=[];function walk(a){const n=g.nodes[a];points.push([n.x,.06,n.y]);for(const[b,i]of adj[a])if(!seen.has(i)){seen.add(i);walk(b);points.push([n.x,.06,n.y]);}}walk(0);de['actual-navgraph']={Line3D:{points,color:0x5db8db,width:.012,opacity:.4}};}
for(let i=0;i<residents.length;i++){const w=residents[i].waypoints;de['nav-patrol-'+i]={Line3D:{points:w.map(p=>[p.x,.08,p.y]),color:i%2?0x77adff:0xeec45d,width:.025,opacity:.65,closed:true}};}
await fs.writeFile(path.join(scenes,'crowd-navigation.json'),JSON.stringify(debug,null,2));await fs.writeFile(path.join(here,'crowd-contract.json'),JSON.stringify({...scene.crowdPrototype,residents:residents.map((r,i)=>({id:ids[i],...r,modelKey:e[ids[i]].Model3D.modelKey})),grid:{cols:grid.cols,rows:grid.rows,cellSize:grid.cellSize},hardCollision:'Mass1 player; player category1/mask2; residents category4/mask6; static category2/mask5; player/resident ORCA-only'},null,2));console.log('Generated crowd scenes:',ids.length,'moving residents');
