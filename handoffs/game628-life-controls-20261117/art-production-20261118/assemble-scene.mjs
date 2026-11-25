import {readFile,writeFile,copyFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=JSON.parse(await readFile(root+'art-production-20261118/k-sources.json','utf8'));
const byKey=Object.fromEntries(source.assets.map(a=>[a.key,a]));
const old=JSON.parse(await readFile(root+'public/scenes/streets.json','utf8'));
const entities={},assembly=[];
const hex=s=>parseInt(s.replace('#',''),16);
function model(id,key,x,y,z,sx=1,sy=sx,sz=sx,rotY=0,role='prop'){
 entities[id]={Transform3D:{x,y,z,scaleX:sx,scaleY:sy,scaleZ:sz,rotY},Model3D:{modelKey:key}};
 assembly.push({id,asset:key,role,transform:entities[id].Transform3D,sourceId:byKey[key]?.sourceId??'new-local-module'});return entities[id];
}
function floorModel(id,key,x,z,scale=1,y=0,rotY=0,role='prop'){
 const a=byKey[key];return model(id,key,x,y-(a?.bounds.min[1]??0)*scale,z,scale,scale,scale,rotY,role);
}
function box(id,x,y,z,w,h,d,color,material={}){entities[id]={Transform3D:{x,y,z},Mesh3D:{shape:'box',width:w,height:h,depth:d,frontTint:hex(color)},Material3D:{color:hex(color),roughness:.92,...material}};assembly.push({id,role:'architectural-assembly',geometry:'Mesh3D.box',dimensions:[w,h,d]});}
const buildings=[
 {name:'grocery',label:'果蔬铺',key:'k-housing-e',x:-9.6,width:4.25,height:6.8},
 {name:'bakery',label:'面包房',key:'k-housing-a',x:-5.15,width:4.15,height:5.9},
 {name:'noodles',label:'面馆',key:'k-housing-d',x:1.25,width:4.15,height:6.8},
 {name:'catcafe',label:'猫咖',key:'k-housing-h',x:5.65,width:4.25,height:7.7},
 {name:'bikeshop',label:'修车铺',key:'k-housing-a',x:10.05,width:4.15,height:5.9},
];
for(const b of buildings){
 const a=byKey[b.key],sx=b.width/a.bounds.size[0],sy=b.height/a.bounds.size[1],sz=3.8/a.bounds.size[2];
 const x=b.x-(a.bounds.min[0]+a.bounds.max[0])/2*sx,y=-a.bounds.min[1]*sy,z=-1.35-.6*sz;
 model(b.name+'-residence',b.key,x,y,z,sx,sy,sz,0,'residential-building');
 b.wallZ=-1.35;b.scale=[sx,sy,sz];b.position=[x,y,z];
 // A few genuine window apertures get independent, dim night-time emissive panes.
 const panes=a.windowPanels.filter(p=>p.center[2]>.45&&p.center[1]>.85).slice(0,b.name==='catcafe'?2:1);
 for(let i=0;i<panes.length;i++){
  const p=panes[i],cx=x+p.center[0]*sx,cy=y+p.center[1]*sy,cz=z+p.center[2]*sz+.014;
  box(`window-glow-${b.name}-${i}`,cx,cy,cz,p.size[0]*sx*.97,p.size[1]*sy*.97,.008,'#a27449',{transparent:true,opacity:0,emissive:0xffb564,emissiveIntensity:0});
 }
 // New modules remain separate from the copied K shell, with explicit wall/root contacts.
 model(b.name+'-sign','custom-shop-sign',b.x,2.42,-.92,.94,.94,.94,0,'shop-sign');
 if(['grocery','noodles','catcafe'].includes(b.name))model(b.name+'-balcony','custom-balcony',b.x,3.58,b.wallZ,1,1,1,0,'balcony');
 model(b.name+'-aircon','custom-aircon',b.x+1.48,4.88,b.wallZ,1,1,1,0,'air-conditioning');
 for(const side of [-1,1])floorModel(b.name+'-plant-'+side,'k-potted-bush',b.x+side*1.72,-.35,2.1);
}
// Foundation and paving are assembled from copied 2m K modules, touching without coincident surface layers.
for(let i=0;i<15;i++)for(let row=0;row<2;row++)model(`paving-${i}-${row}`,'k-pavement-base',-14+i*2,-.1,.5+row*2,1,1,1,0,'paving');
box('street-underlay',0,-.435,2,32,.25,10,'#b2ad9d');
box('walkway-support',0,-.2,1.5,30,.2,4,'#b2ad9d');
box('curb',0,-.10,3.56,30,.16,.16,'#b7afa0');
box('road',0,-.25,5.1,32,.12,2.9,'#a1a7a4');
// Grocery: separately movable crates and goods on a physical display counter.
box('grocery-counter',-9.6,.43,-.05,3.05,.86,.85,'#a87846');
for(let i=0;i<4;i++)floorModel('grocery-fruit-'+i,'k-fruit-crate',-10.7+i*.72,.06,2,.86);
for(let i=0;i<2;i++)floorModel('grocery-box-'+i,'k-market-crate',-11.65,.38+i*.53,1.6,0);
// Bakery window display: tray modules are real geometry, not a painted shop-front image.
box('bakery-table',-5.15,.49,-.02,2.9,.16,.8,'#ad7e50');
for(const x of [-6.25,-4.05])for(const z of [-.27,.22])box(`bakery-leg-${x}-${z}`,x,.23,z,.10,.46,.1,'#7d6043');
for(let i=0;i<3;i++)floorModel('bakery-bread-'+i,'k-bread-tray',-6.05+i*.86,.02,1,.57);
// Noodle counter, three stools, open pot and the cloth entry curtain are independent parts.
box('noodle-bar',1.25,.48,-.02,3.05,.96,.78,'#a1764c');
for(let i=0;i<3;i++)floorModel('noodle-stool-'+i,'k-stool',.30+i*.90,1.02,1.5);
floorModel('noodle-pot','k-cooking-pot',1.45,-.10,.53,.97);
model('noodle-awning','custom-awning',1.25,2.65,-1.35,.95,.95,.95,0,'awning');
box('noodle-curtain-rod',1.25,2.30,-.76,3.10,.055,.055,'#624a36');
for(const side of [-1,1])box('curtain-bracket-'+side,1.25+side*1.5,2.30,-1.05,.055,.055,.64,'#624a36');
for(let i=0;i<3;i++)box('noodle-curtain-'+i,.28+i*.96,2.03,-.76,.93,.53,.035,'#b85d47');
// Cat cafe: an open shelf, perch modules, bench, a bicycle and planter stand outside.
floorModel('cat-shelf','k-shelf',5.65,-.06,2.2);
floorModel('cat-bench','k-bench',5.0,1.05,1);
floorModel('cafe-planter','k-potted-bush',7.1,.55,2.1);
// A readable geometric cat sculpture marks this shop; it is a static prop, not an animated pet.
entities['cat-body']={Transform3D:{x:5.45,y:1.095,z:.09,scaleX:.72,scaleY:1,scaleZ:.65},Mesh3D:{shape:'sphere',width:.43,height:.43,frontTint:0xe3bc83},Material3D:{color:0xe3bc83,roughness:1}};
entities['cat-head']={Transform3D:{x:5.45,y:1.32,z:.14},Mesh3D:{shape:'sphere',width:.29,height:.29,frontTint:0xf3dfb8},Material3D:{color:0xf3dfb8,roughness:1}};
for(const side of [-1,1])entities['cat-ear-'+side]={Transform3D:{x:5.45+side*.09,y:1.47,z:.14},Mesh3D:{shape:'cone',width:.11,height:.16,frontTint:0xe3bc83},Material3D:{color:0xe3bc83,roughness:1}};
model('repair-bike','custom-bicycle',10.05,0,.45,1.1,1.1,1.1,0,'bicycle');
floorModel('repair-shelf','k-shelf',11.30,-.22,1.65);
floorModel('repair-stool','k-stool',8.75,.76,1.4);
for(const [x,z,scale] of [[-13.3,.7,1.05],[13.0,-.10,.95],[-1.8,-5.8,.8]])model('tree-'+x,'custom-broadleaf-tree',x,.005*scale,z,scale,scale,scale,0,'tree');
for(let i=0;i<6;i++)floorModel('balcony-green-'+i,'k-potted-bush',[-10.8,-9.4,.3,1.8,4.8,6.2][i],-.78,1.25,3.68);
// Distant city blocks are deliberately simple and cannot be mistaken for another playable street.
for(let i=0;i<10;i++)box('skyline-'+i,-22+i*4.6,2.8+(i%3)*.6,-23,3.8,5.6+(i%3)*1.2,4,['#b3c0c4','#bfc8c8','#a9b9bc'][i%3]);
entities.player=structuredClone(old.manifest.entities.player);entities.player.Transform.x=-1.3;entities.player.Transform.y=1.7;entities.player.Model3D.scale=.92;entities.player.Bounds={minX:-12.4,maxX:12.4,minY:1.7,maxY:1.7};
entities['camera-anchor']=structuredClone(old.manifest.entities['camera-anchor']);entities['camera-anchor'].Mesh3D.height=4.9;entities['camera-anchor'].Transform.x=-1.3;entities['camera-anchor'].Transform.y=1.7;
entities.camera={Camera3D:{yaw:.13,pitch:.12,distance:15.8,projection:'perspective',fov:34,near:.1,far:5000,mode:'follow',target:'camera-anchor',follow:{lag:.16,lookAhead:0}}};
entities.sky={Sky3D:{top:0x89b8d5,bottom:0xe7e4ce,clouds:true,cloudTint:0xeaece3,scroll:.0004,env:.08}};
entities.sun={Light3D:{kind:'directional',color:0xffe2b2,intensity:2.2,dirX:.65,dirY:-1,dirZ:-.9,castShadow:true}};
entities.ambient={Light3D:{kind:'ambient',color:0xc4d7e4,intensity:1.0}};
for(const [name,x] of [['bakery',-5.15],['noodles',1.25],['catcafe',5.65]])entities['interior-light-'+name]={Light3D:{kind:'point',color:0xffc28b,intensity:0,x,y:1.9,z:-.60,range:4.3,decay:2,castShadow:false}};
const glowIds=Object.keys(entities).filter(id=>id.startsWith('window-glow-'));
function preset(label,sun,ambient,sky,local,glow){return {label,patches:[
 {entity:'sun',component:'Light3D',values:sun},{entity:'ambient',component:'Light3D',values:ambient},{entity:'sky',component:'Sky3D',values:sky},
 ...['bakery','noodles','catcafe'].map(name=>({entity:'interior-light-'+name,component:'Light3D',values:{intensity:local}})),
 ...glowIds.map(entity=>({entity,component:'Material3D',values:{opacity:glow*.45,emissiveIntensity:glow*.8}}))]};}
const environment={initial:'env.afternoon',durationMs:1800,presets:{
 'env.morning':preset('早晨',{color:0xffe0ad,intensity:1.8,dirX:.9,dirY:-.65,dirZ:-.75},{color:0xc4d8e8,intensity:.92},{top:0x9bcce6,bottom:0xeee7cc,cloudTint:0xf0ede1,env:.06},0,0),
 'env.afternoon':preset('白天',{color:0xffe5bd,intensity:2.3,dirX:.55,dirY:-1,dirZ:-.8},{color:0xcad9df,intensity:1.0},{top:0x8ebbd8,bottom:0xe4e7d3,cloudTint:0xeaece3,env:.08},0,0),
 'env.evening':preset('傍晚',{color:0xffb578,intensity:1.35,dirX:-1,dirY:-.32,dirZ:-.7},{color:0xa0afc6,intensity:.60},{top:0x8798bf,bottom:0xf0c19c,cloudTint:0xc5b1ac,env:.04},6,.55),
 'env.night':preset('夜晚',{color:0x9cb6e4,intensity:.24,dirX:-.6,dirY:-.9,dirZ:-.75},{color:0x839ac0,intensity:.30},{top:0x14243f,bottom:0x46556f,cloudTint:0x29374f,env:.012},12,1),
}};
const button=(id,label,action)=>({id,type:'Button',props:{label,action,kind:'quiet',fx:[{kind:'sheen-hover'}]}});
function layout(title){return {id:'prototype',type:'Screen',props:{},layout:{direction:'column',gap:0,padding:0},children:[
 {id:'header',type:'Panel',props:{glass:true},layout:{height:88,direction:'row',align:'center',padding:16,gap:12},children:[{id:'titles',type:'Panel',props:{bare:true},layout:{flex:1,direction:'column',gap:5},children:[{id:'title',type:'Label',props:{text:title,size:21,color:'text'}},{id:'subtitle',type:'Label',props:{text:'K 线资产拼装 · 真实 3D / 昼夜动态光照 · 本地美术草案',size:12,color:'text'}}]},button('walk','漫游','host.art'),button('wide','全景','host.artWide'),button('parts','拆件','host.artParts'),button('old','控制原型','host.streets')]},
 {id:'scene-stage',type:'Panel',props:{bare:true},layout:{flex:1}},
 {id:'footer',type:'Panel',props:{glass:true},layout:{height:76,direction:'row',align:'center',padding:14,gap:10},children:[{id:'instructions',type:'Label',layout:{flex:1},props:{text:'← → 行走 · 时间预设平滑过渡 · 夜间仅三处店内补光',size:12,color:'text'}},...Object.entries(environment.presets).map(([action,p],i)=>button('time-'+i,p.label,action))]}
]};}
const custom=['balcony','aircon','awning','shop-sign','bicycle','broadleaf-tree'].map(key=>({kind:'model',key:'custom-'+key,src:'/art/neighborhood-v1/custom/'+key+'.glb'}));
const assets=[...source.assets.map(a=>a.asset),...custom,old.assets.find(a=>a.key==='resident-apricot-eyes-calm')];
const config={assets,keys:{ArrowLeft:{dx:-1},KeyA:{dx:-1},ArrowRight:{dx:1},KeyD:{dx:1},Digit1:{action:'env.morning'},Digit2:{action:'env.afternoon'},Digit3:{action:'env.evening'},Digit4:{action:'env.night'}},links:{'host.art':'art-street','host.artWide':'art-overview','host.artParts':'art-parts','host.streets':'streets'},environment,manifest:{capabilities:['t1-motion-apply','t1-hierarchy-resolve','t2-bounds-clamp'],entities},layout:layout('城市商店街 · 美术拼装样景')};
await writeFile(root+'public/scenes/art-street.json',JSON.stringify(config,null,2));
const wide=structuredClone(config);wide.manifest.entities.camera.Camera3D={yaw:.15,pitch:.20,distance:29,projection:'perspective',fov:34,near:.1,far:5000,pivotX:.2,pivotY:2.8,pivotZ:-.9};wide.layout=layout('城市商店街 · 拼装全景');await writeFile(root+'public/scenes/art-overview.json',JSON.stringify(wide,null,2));
const parts=structuredClone(config);parts.manifest.capabilities=[];parts.manifest.entities={sky:entities.sky,sun:entities.sun,ambient:entities.ambient,camera:{Camera3D:{yaw:.2,pitch:.65,distance:33,projection:'ortho',orthoSize:10.0,near:.1,far:5000,pivotX:0,pivotY:1.3,pivotZ:0}}};parts.environment=undefined;
box('parts-stage',0,-.05,0,36,.1,18,'#cfccb9');parts.manifest.entities['parts-stage']=entities['parts-stage'];delete entities['parts-stage'];
for(let i=0;i<source.assets.length+custom.length;i++){
 const key=i<source.assets.length?source.assets[i].key:custom[i-source.assets.length].key,a=byKey[key],column=i%7,row=Math.floor(i/7),x=(column-3)*4.4,z=(row-1)*4.5,s=a?Math.min(2/a.bounds.size[0],2.6/a.bounds.size[1],2.4/a.bounds.size[2]):key.includes('tree')?.5:.65;
 parts.manifest.entities['part-'+i]={Transform3D:{x,y:-(a?.bounds.min[1]??0)*s,z,scale:s},Model3D:{modelKey:key}};
 parts.manifest.entities['part-label-'+i]={Transform3D:{x,y:.15,z:z+1.3},WorldUI3D:{node:{id:'part-name-'+i,type:'Panel',props:{},layout:{padding:4},children:[{id:'part-text-'+i,type:'Label',props:{text:key.replace('custom-','新：').replace('k-','K：'),size:11,color:'text'}}]}}};
}
parts.layout=layout('拆件台 · K 线复用与新增模块');parts.layout.children.find(n=>n.id==='footer').children=[{id:'instructions',type:'Label',props:{text:'K：源模型副本，原台账不变　｜　新：此次按接缝规范制作的独立模块',size:13,color:'text'}}];await writeFile(root+'public/scenes/art-parts.json',JSON.stringify(parts,null,2));
await writeFile(root+'art-production-20261118/scene-decomposition.json',JSON.stringify({reference:'generated_images/exec-e200c4ec-58a4-40bd-a8e6-2c5cfc5b3c19.png',status:'local-scene-draft-not-final-art',kPolicy:source.policy,buildings,assembly,lighting:{method:'One dynamic directional key + ambient; three local point fills at night; sparse emissive windows; four numeric presets, 1.8s smooth transition',presets:Object.keys(environment.presets)},intentionalOpenings:[{id:'lane-entry',xRange:[-3.07,-.825],width:2.245,purpose:'visual street-switch entrance, not blocked by props'},{id:'shop-openings',purpose:'K geometry apertures retained, counters placed in front deliberately'}],contactRules:[{id:'paving',relation:'2m K bases laid edge-to-edge; topY=0; no coplanar duplicate top floor'},{id:'building-foot',relation:'Actual source minY transformed onto topY0'},{id:'balcony-root',relation:'Rear edge at building wall Z=-1.35; deliberate hidden root overlap; front edge clear of walk path'},{id:'aircon-mount',relation:'Back wall contact at Z=-1.35, no floating mount'},{id:'bread-counter',relation:'Four legs contact floor; trays contact topY.57'}]},null,2));
console.info('[scene-assembly:commit]',{kAssets:source.assets.length,newModules:custom.length,entities:Object.keys(entities).length,instanceCount:assembly.length,windowGlows:glowIds.length});
