// Offline asset/data production only. Runtime gameplay is interpreted by existing capabilities.
import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const dir=fileURLToPath(new URL('./public/',import.meta.url));
await mkdir(dir+'art',{recursive:true});await mkdir(dir+'scenes',{recursive:true});
globalThis.FileReader=class{readAsArrayBuffer(b){b.arrayBuffer().then(v=>{this.result=v;this.onloadend?.();});}readAsDataURL(b){b.arrayBuffer().then(v=>{this.result=`data:${b.type};base64,${Buffer.from(v).toString('base64')}`;this.onloadend?.();});}};
const c=v=>parseInt(v.replace('#',''),16);
const profiles=[
  {id:'apricot',label:'围裙 · 圆头 · 大耳',skin:'#f0bd9b',coat:'#d88158',hair:'#433c38',head:[.48,.49,.40],ear:.15,height:1,wide:1},
  {id:'sage',label:'外套 · 长头 · 小耳',skin:'#d4a17d',coat:'#849e8a',hair:'#473c34',head:[.42,.56,.38],ear:.105,height:1.10,wide:.90},
  {id:'indigo',label:'针织 · 宽头 · 垂耳',skin:'#e6bb9f',coat:'#7789a0',hair:'#645449',head:[.55,.46,.40],ear:.13,height:.94,wide:1.12},
];
const moods=['calm','joy','sad','angry','surprise'];
function avatar(p,eyes,mood){
  const root=new T.Group();root.name='resident';
  const skin=new T.MeshStandardMaterial({color:p.skin,roughness:1});
  const ink=new T.MeshStandardMaterial({color:'#403b37',roughness:1});
  const cloth=new T.MeshStandardMaterial({color:p.coat,roughness:1});
  const cream=new T.MeshStandardMaterial({color:'#f2e5ce',roughness:1});
  const hair=new T.MeshStandardMaterial({color:p.hair,roughness:1});
  function ell(parent,name,pos,scale,mat){const m=new T.Mesh(new T.SphereGeometry(1,24,16),mat);m.name=name;m.position.set(...pos);m.scale.set(...scale);parent.add(m);return m;}
  const hips=new T.Group();hips.name='hips';root.add(hips);
  ell(hips,'torso',[0,.94,0],[.30*p.wide,.40,.20],cloth);
  ell(hips,'neck',[0,1.30,0],[.12,.15,.12],skin);
  const h=new T.Group();h.name='head';h.position.y=1.71;hips.add(h);
  ell(h,'head-shape',[0,0,0],p.head,skin);
  for(const s of [-1,1]){
    ell(h,'ear-'+s,[s*(p.head[0]+.035),-.035,0],[p.ear,p.ear*1.3,.10],skin);
    ell(h,'ear-inner-'+s,[s*(p.head[0]+.052),-.035,.077],[p.ear*.5,p.ear*.70,.022],new T.MeshStandardMaterial({color:'#d18e7b',roughness:1}));
  }
  // A cropped cap and asymmetric fringe preserve visible forehead and ears.
  const cap=new T.Mesh(new T.SphereGeometry(1,24,12,0,Math.PI*2,0,Math.PI*.29),hair);
  cap.scale.set(p.head[0]*1.035,p.head[1]*1.035,p.head[2]*1.035);h.add(cap);
  ell(h,'fringe',[-p.head[0]*.48,p.head[1]*.88,.18],[p.head[0]*.55,.095,.19],hair).rotation.z=-.25;
  function curve(name,points,width=.018){
    const pts=points.map(([x,y])=>new T.Vector3(x,y,p.head[2]*Math.sqrt(Math.max(.05,1-(x/p.head[0])**2-(y/p.head[1])**2))+.016));
    const line=new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,width,7,false),ink);line.name=name;h.add(line);
  }
  for(const s of [-1,1]){
    const center=s*.19;
    const brow=mood==='angry'?[[-.09,-.04],[0,0],[.09,.05]].map(([x,y])=>[center+s*x,.15+y]):mood==='sad'?[[-.09,-.01],[0,.02],[.09,.055]].map(([x,y])=>[center-s*x,.15+y]):mood==='surprise'?[[-.09,0],[0,.045],[.09,0]].map(([x,y])=>[center+x,.24+y]):mood==='joy'?[[-.09,0],[0,.035],[.09,0]].map(([x,y])=>[center+x,.17+y]):[[-.085,0],[0,.012],[.085,0]].map(([x,y])=>[center+x,.16+y]);
    curve('brow-'+s,brow,.019);
    if(eyes){if(mood==='joy')curve('eye-'+s,[[center-.055,.015],[center,.055],[center+.055,.015]],.015);else ell(h,'eye-'+s,[center,.025,p.head[2]*.94],[.026,mood==='surprise'?.045:.029,.020],ink);}
  }
  if(mood==='surprise'){
    const loop=[];for(let i=0;i<=16;i++){const a=i/16*Math.PI*2;loop.push([Math.sin(a)*.055,-.17+Math.cos(a)*.075]);}curve('mouth',loop,.016);
  }else if(mood==='joy')curve('mouth',[[-.12,-.12],[0,-.20],[.12,-.12]],.022);
  else if(mood==='sad'||mood==='angry')curve('mouth',[[-.09,-.21],[0,-.17],[.09,-.21]],.018);
  else curve('mouth',[[-.08,-.17],[0,-.184],[.08,-.17]],.017);
  if(p.id==='apricot')ell(hips,'apron',[0,.89,.175],[.22,.29,.045],cream);
  if(p.id==='sage')for(const y of [.83,1.02,1.20])ell(hips,'button-'+y,[.04,y,.202],[.023,.023,.012],cream);
  if(p.id==='indigo')for(const x of [-.16,0,.16])ell(hips,'knit-'+x,[x,.96,.194],[.012,.24,.015],cream);
  const tracks=[];
  for(const s of [-1,1]){
    const leg=new T.Group();leg.name=s<0?'legL':'legR';leg.position.set(s*.145,.66,0);hips.add(leg);
    ell(leg,'trouser',[0,-.22,0],[.115,.29,.125],ink);ell(leg,'shoe',[0,-.55,.055],[.13,.085,.20],cream);
    const arm=new T.Group();arm.name=s<0?'armL':'armR';arm.position.set(s*.30,1.17,0);hips.add(arm);
    ell(arm,'sleeve',[s*.025,-.17,0],[.105,.25,.105],cloth);ell(arm,'hand',[s*.04,-.41,.01],[.085,.105,.08],skin);
    const times=[0,.2,.4,.6,.8];
    const rotations=angles=>angles.flatMap(angle=>new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),angle).toArray());
    tracks.push(new T.QuaternionKeyframeTrack(`${leg.name}.quaternion`,times,rotations([0,s*.40,0,-s*.40,0])));
    tracks.push(new T.QuaternionKeyframeTrack(`${arm.name}.quaternion`,times,rotations([0,-s*.30,0,s*.30,0])));
  }
  root.scale.y=p.height;
  const walk=new T.AnimationClip('walk',.8,tracks);
  return {root,walk};
}
const assets=[];
for(const p of profiles)for(const eyes of [false,true])for(const mood of moods){
  const key=`resident-${p.id}-${eyes?'eyes':'minimal'}-${mood}`;
  const {root,walk}=avatar(p,eyes,mood);
  const glb=await new GLTFExporter().parseAsync(root,{binary:true,animations:[walk]});
  await writeFile(dir+`art/${key}.glb`,Buffer.from(glb));assets.push({kind:'model',key,src:`/art/${key}.glb`});
}
const shops=[['TEA & LETTERS','#e6cfab','#6c8f80'],['BAKERY','#e6b8a3','#b26f56'],['CAT CORNER','#b9c7bd','#526f65'],['BOOKS & DAYS','#d8c5a6','#7c7164'],['FLOWER ROOM','#d2bbb4','#88718c']];
for(let i=0;i<shops.length;i++){
  const [name,wall,trim]=shops[i];
  const windows=[72,320].map(x=>`<rect x="${x}" y="62" width="120" height="117" rx="45" fill="${trim}"/><rect x="${x+8}" y="70" width="104" height="101" rx="38" fill="#b7c6c1"/><path d="M${x+60} 72v97M${x+10} 126h100" stroke="#eee2c9" stroke-width="8"/>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="384" viewBox="0 0 512 384"><defs><pattern id="p" width="37" height="29" patternUnits="userSpaceOnUse"><path d="M0 27h17M23 8h11" stroke="#fff4dc" stroke-opacity=".23" stroke-width="2"/></pattern></defs><rect width="512" height="384" fill="${wall}"/><rect width="512" height="384" fill="url(#p)"/>${windows}<rect x="40" y="202" width="432" height="46" rx="8" fill="${trim}"/><text x="256" y="232" font-family="serif" font-size="25" letter-spacing="3" text-anchor="middle" fill="#fff1d5">${name.replace('&','&amp;')}</text><rect x="208" y="263" width="96" height="121" rx="7" fill="${trim}"/><rect x="220" y="275" width="72" height="77" rx="30" fill="#a1b7b1"/><circle cx="286" cy="362" r="4" fill="#eaca80"/><g fill="#9aaea2" stroke="${trim}" stroke-width="7"><rect x="48" y="270" width="130" height="92" rx="6"/><rect x="334" y="270" width="130" height="92" rx="6"/></g><path d="M112 273v86m286-86v86" stroke="#eee2c9" stroke-width="6"/><path d="M27 254h458" stroke="#f4e6cb" stroke-width="11"/></svg>`;
  await writeFile(dir+`art/facade-${i}.svg`,svg);assets.push({kind:'texture',key:`facade-${i}`,src:`/art/facade-${i}.svg`,width:512,height:384});
}
const tf=(x=0,y=0)=>({x,y,rotation:0,scaleX:1,scaleY:1});
function box(e,id,x,y,z,w,h,d,color,material={}){e[id]={Transform3D:{x,y,z},Mesh3D:{shape:'box',width:w,height:h,depth:d,frontTint:c(color),edgeTint:c(color)},Material3D:{color:c(color),shading:'toon',toonSteps:3,roughness:1,...material}};}
function sphere(e,id,x,y,z,r,color){e[id]={Transform3D:{x,y,z},Mesh3D:{shape:'sphere',width:r*2,height:r*2,frontTint:c(color)},Material3D:{color:c(color),shading:'toon',toonSteps:3}};}
function basics(){return {
  'camera':{Camera3D:{yaw:0,pitch:.48,distance:25,projection:'ortho',orthoSize:6.5,near:.1,far:120,pivotX:0,pivotY:1,pivotZ:-4}},
  'sky':{Sky3D:{top:0xd8e4de,bottom:0xf2e8d7,clouds:.12}},
  'sun':{Light3D:{kind:'directional',color:0xffe7c1,intensity:2.2,x:-8,y:16,z:12,castShadow:true}},
  'fill':{Light3D:{kind:'ambient',color:0xe1e9e4,intensity:1.8}},
};}
const label=(id,text,size=14)=>({id,type:'Label',props:{text,size,color:'text'}});
const button=(id,text,action)=>({id,type:'Button',props:{label:text,action,kind:'quiet',fx:[{kind:'sheen-hover'}]}});
function layout(title,subtitle,footer,buttons=[]){return {id:'prototype',type:'Screen',props:{},layout:{direction:'column',gap:0,padding:0},children:[
  {id:'header',type:'Panel',layout:{height:90,direction:'row',align:'center',gap:18,padding:18},props:{glass:true},children:[{id:'titles',type:'Panel',layout:{flex:1,direction:'column',gap:5},props:{bare:true},children:[label('title',title,22),label('subtitle',subtitle,12)]},button('streets-tab','街坊行走','host.streets'),button('people-tab','人物观察','host.people')]},
  {id:'scene-stage',type:'Panel',layout:{flex:1},props:{bare:true}},
  {id:'footer',type:'Panel',layout:{height:80,direction:'row',align:'center',gap:10,padding:16},props:{glass:true},children:[{...label('instructions',footer,13),layout:{flex:1}},...buttons]}
]};}
const links={'host.streets':'streets','host.people':'people'};
const streetNames=['梧桐街','花园街','河岸街'];
const flag=id=>({kind:'flag',id,equals:true});
const sceneName=(street,entry)=>`${street===0?'streets':`street-${street+1}`}${entry==='center'?'':`-${entry}`}`;
for(let street=0;street<3;street++)for(const entry of ['center','west','east']){
 const e=basics(),routes=[];
 e.camera.Camera3D={yaw:.26,pitch:.17,distance:13.5,projection:'perspective',fov:28,near:.1,far:100,mode:'follow',target:'camera-anchor',follow:{lag:.14,lookAhead:0}};
 box(e,'ground',0,-.15,0,42,.3,13,'#c8c6ac');
 box(e,'street',0,-.01,.6,40,.08,2.5,['#d8c5a8','#c8cbb6','#c1cfca'][street]);
 box(e,'curb',0,.035,-.6,40,.14,.42,'#ede0c7');
 for(let k=0;k<8;k++){
   const x=[-16,-12,-8.25,-3.75,3.75,8.25,12,16][k],i=(k+street*2)%5;
   box(e,`house-${k}`,x,1.55,-2.15,3.45,3.1,2.45,shops[i][1]);
   // Side windows and projecting trim make actual depth legible beyond the illustrated frontage.
   box(e,`side-window-${k}`,x+1.735,1.85,-2.12,.06,.83,.84,shops[i][2]);
   box(e,`side-glass-${k}`,x+1.773,1.85,-2.12,.025,.67,.66,'#b8c9c5');
   box(e,`side-sill-${k}`,x+1.82,1.40,-2.12,.23,.10,1.02,'#eee1c8');
   box(e,`foundation-${k}`,x,.11,-2.1,3.62,.22,2.60,'#b4aa94');
   e[`facade-${k}`]={Transform3D:{x,y:1.55,z:-.915},Mesh3D:{shape:'plane',width:3.45,height:3.1,frontTint:0xffffff},Material3D:{color:0xffffff,shading:'flat',map:`facade-${i}`}};
   box(e,`roof-${k}`,x,3.19,-2.15,3.65,.22,2.7,shops[i][2]);
   box(e,`awning-${k}`,x,1.20,-.70,3.56,.13,.55,shops[i][2]);
   for(const side of [-1,1]){box(e,`pot-${k}-${side}`,x+side*1.33,.18,-.40,.28,.34,.28,'#b77f61');sphere(e,`plant-${k}-${side}`,x+side*1.33,.49,-.40,.26,'#7c9675');}
 }
 // Distant vegetation is scenery only: no other street is present in this scene.
 for(let i=0;i<12;i++){sphere(e,`distant-tree-${i}`,-22+i*4,2.4,-8.8,1.8,['#a0b2a1','#b0bea7','#b7c3ad'][i%3]);}
 const spawn=entry==='west'?-6:entry==='east'?6:0;
 e.player={Transform:tf(spawn,0),Velocity:{vx:0,vy:0,angular:0},Controllable:{playerId:'p1',speed:.065},Bounds:{minX:-18,maxX:18,minY:0,maxY:0},Model3D:{modelKey:'resident-apricot-eyes-calm',scale:.82},AnimState3D:{clip:'walk',speed:1,loop:true,speedAtVelocity:.065}};
 // An existing hierarchy follows the actor; its transparent render mesh places camera focus above ground.
 e['camera-anchor']={Transform:tf(spawn,0),Hierarchy:{parentId:'player',localX:0,localY:0,localRotation:0,localScaleX:1,localScaleY:1},Mesh3D:{shape:'box',width:.001,height:2,depth:.001,frontTint:0xffffff},Material3D:{transparent:true,opacity:0}};
 for(const direction of ['up','down']){
   e[`request-${direction}`]={Flag:{id:`request-${direction}`,active:false}};
   e[`key-${direction}`]={KeyBinding:{key:`travel.${direction}`,signal:`request.${direction}`}};
   e[`arm-${direction}`]={Effect:{onSignal:`request.${direction}`,kind:'set-flag',targetId:`request-${direction}`,value:true}};
   e[`clear-event-${direction}`]={EventWhen:{when:flag(`request-${direction}`),signal:`clear.${direction}`,mode:'level',armed:false}};
   e[`clear-${direction}`]={Effect:{onSignal:`clear.${direction}`,kind:'set-flag',targetId:`request-${direction}`,value:false}};
 }
 for(const side of ['west','east']){
   const x=side==='west'?-6:6;
   box(e,`portal-marker-${side}`,x,.075,0,1.15,.04,.65,'#f4e6c9');
   e[`portal-${side}`]={Flag:{id:`portal-${side}`,active:false},Zone:{outFlag:`portal-${side}`,minX:x-.65,maxX:x+.65,minY:-.1,maxY:.1,requiredEntities:['player']}};
   const destinations=[];
   for(const direction of ['up','down']){
     const next=street+(direction==='up'?1:-1);if(next<0||next>2)continue;
     const travel=`travel-${side}-${direction}`;
     e[travel]={Flag:{id:travel,active:false}};
     e[`gate-${side}-${direction}`]={EventWhen:{when:{kind:'and',of:[flag(`portal-${side}`),flag(`request-${direction}`)]},signal:travel,mode:'edge',armed:false}};
     e[`commit-${side}-${direction}`]={Effect:{onSignal:travel,kind:'set-flag',targetId:travel,value:true}};
     routes.push({flagEntity:travel,scene:sceneName(next,side),departure:{durationMs:1150,camera:{yaw:.04,pitch:.15,distance:9.5,tween:{trigger:1,dur:.9,ease:'inOut'}},components:[{entity:'player',type:'AnimState3D',value:{clip:'walk',speed:1,loop:true}}],paths:[{entity:'player',height:0,points:[[x,0,-.45],[x,0,-2.1]],faceDir:true},{entity:'camera-anchor',height:1,points:[[x,1,-.45],[x,1,-1.8]]}]}});
     destinations.push(`${direction==='up'?'↑':'↓'} ${streetNames[next]}`);
   }
   e[`sign-${side}`]={Transform3D:{x,y:2.8,z:.1},WorldUI3D:{text:destinations.join('  ·  '),offsetY:0}};
 }
 const config={assets:assets.filter(a=>a.kind==='texture'||a.key==='resident-apricot-eyes-calm'),manifest:{capabilities:['t1-motion-apply','t1-hierarchy-resolve','t2-bounds-clamp','t2-zone-occupancy','t2-event-when','t2-keybind','t2-effect-apply'],entities:e},keys:{ArrowLeft:{dx:-1},KeyA:{dx:-1},ArrowRight:{dx:1},KeyD:{dx:1},ArrowUp:{action:'travel.up'},KeyW:{action:'travel.up'},ArrowDown:{action:'travel.down'},KeyS:{action:'travel.down'}},links,routes,layout:layout(streetNames[street]+' · 今天慢慢走','横向街景与换街转场研究 · 当前只加载这一条街 · 人物与建筑均为草案','← → / A D 行走　站在路牌处，按一下 ↑ ↓ 换街')};
 config.layout.children.find(n=>n.id==='scene-stage').layout={flex:1,anim:'fadeIn',animMs:180};
 if(entry!=='center')config.arrival={durationMs:950,camera:{yaw:.04,pitch:.15,distance:9.5},cameraAfter:{yaw:.26,pitch:.17,distance:13.5,tween:{trigger:2,dur:.85,ease:'inOut'}},components:[{entity:'player',type:'AnimState3D',value:{clip:'walk',speed:1,loop:true}}],paths:[{entity:'player',from:[spawn,0,-2.1],points:[[spawn,0,-.45],[spawn,0,0]],faceDir:true},{entity:'camera-anchor',from:[spawn,1,-1.8],points:[[spawn,1,-.45],[spawn,1,0]]}],restore:[{entity:'player',type:'AnimState3D',value:{clip:'walk',speed:1,loop:true,speedAtVelocity:.065}}]};
 await writeFile(dir+`scenes/${sceneName(street,entry)}.json`,JSON.stringify(config,null,2));
}
const p=basics();p.camera.Camera3D={yaw:0,pitch:.15,distance:22,projection:'ortho',orthoSize:2.15,near:.1,far:80,pivotX:0,pivotY:1.25,pivotZ:0};
box(p,'gallery-floor',0,-.10,0,18,.20,9,'#e6ddcc');
for(let face=0;face<2;face++)for(let i=0;i<profiles.length;i++){
 const x=-5.75+face*6.8+i*2.35;
 box(p,`plinth-${face}-${i}`,x,.03,0,1.8,.08,1.6,'#f1e9d8');
 for(let m=0;m<moods.length;m++)p[`person-${face}-${i}-${m}`]={Transform:tf(x,0),Model3D:{modelKey:`resident-${profiles[i].id}-${face?'eyes':'minimal'}-${moods[m]}`,scale:1},Visibility:{visible:m===0},Tag:{flags:1<<m}};
 p[`caption-${face}-${i}`]={Transform3D:{x,y:.12,z:.85},WorldUI3D:{node:{id:`name-${face}-${i}`,type:'Panel',layout:{padding:5},props:{},children:[label(`name-label-${face}-${i}`,profiles[i].label,12)]},offsetY:0}};
}
for(let m=0;m<moods.length;m++){
 const signal=`mood.${moods[m]}`;
 p[`key-${m}`]={KeyBinding:{key:signal,signal}};
 p[`hide-${m}`]={Effect:{onSignal:signal,kind:'set-visible-tagged',tagMask:31,value:false,order:0}};
 p[`show-${m}`]={Effect:{onSignal:signal,kind:'set-visible-tagged',tagMask:1<<m,value:true,order:1}};
}
const people={assets:assets.filter(a=>a.kind==='model'),framing:{minHalfWidth:6.8,minHalfHeight:2.35},manifest:{capabilities:['t2-keybind','t2-effect-apply'],entities:p},keys:{Digit1:{action:'mood.calm'},Digit2:{action:'mood.joy'},Digit3:{action:'mood.sad'},Digit4:{action:'mood.angry'},Digit5:{action:'mood.surprise'}},links,layout:layout('人物构造 · 两种五官方案','左：嘴巴＋眉毛　｜　右：嘴巴＋眼睛＋眉毛　｜　原创体块候选，未定稿','三种头型、耳朵与衣着',[button('calm','1 平静','mood.calm'),button('joy','2 开心','mood.joy'),button('sad','3 难过','mood.sad'),button('angry','4 生气','mood.angry'),button('surprise','5 惊讶','mood.surprise')])};
await writeFile(dir+'scenes/people.json',JSON.stringify(people,null,2));
await writeFile(dir+'art/provenance.json',JSON.stringify({status:'local-draft-not-approved',method:'Original procedural geometry and authored SVG facade illustrations; no third-party character or facade assets; no AI-generated bitmap artwork used.',profiles,moods,assetCount:assets.length},null,2));
console.info('[production:commit]',JSON.stringify({models:30,facades:5,scenes:10}));
