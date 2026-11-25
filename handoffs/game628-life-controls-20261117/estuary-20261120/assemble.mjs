import {readFileSync,writeFileSync} from 'node:fs';
const root = new URL('../', import.meta.url);
const base = JSON.parse(readFileSync(new URL('public/scenes/reference-walk.json',root),'utf8'));
const entities = {};
const palette = {sand:0xe4ce9d,grass:0x94b990,river:0x68bcb0,sea:0x4a91b2,foam:0xe6f3dc,wood:0x9b7854};
function box(id,x,y,z,w,h,d,color,anim){
 entities[id]={
  Transform3D:{x,y,z},
  Mesh3D:{shape:'box',width:w,height:h,depth:d,frontTint:color,edgeTint:color},
  Material3D:{preset:'matte',color,roughness:0.95},
  ...(anim?{Anim3D:{channels:anim}}:{}),
 };
}
function round(id,x,y,z,w,h,d,color){
 box(id,x,y,z,w,h,d,color);
 entities[id].Mesh3D={shape:'sphere',width:1,height:1,frontTint:color};
 entities[id].Transform3D={x,y,z,scaleX:w,scaleY:h,scaleZ:d};
}
entities.camera={Camera3D:{yaw:0,pitch:0.37,distance:19,fov:34,near:0.1,far:5000,mode:'follow',target:'camera-anchor',follow:{lag:0.22,lookAhead:0.12},pitchMin:0.37,pitchMax:0.37}};
entities.sky={Sky3D:{top:0x8ec7d6,bottom:0xe6e5cb,clouds:true,cloudTint:0xf5edda,scroll:0,env:0.3}};
entities.sun={Light3D:{kind:'directional',color:0xffe9ba,intensity:1.5,dirX:-0.4,dirY:-1,dirZ:-0.7,castShadow:true}};
entities.ambient={Light3D:{kind:'ambient',color:0xd3e6e4,intensity:0.55}};
entities.fog={Fog3D:{color:0xc7e0d9,near:50,far:135}};
for(const id of ['player','camera-anchor','camera-focus-offset'])entities[id]=structuredClone(base.manifest.entities[id]);
entities.player.Transform={x:-10,y:2.45,rotation:0,scaleX:1,scaleY:1};
entities.player.Bounds={minX:-11,maxX:10.15,minY:2.45,maxY:2.45};
delete entities.player.Shape;
entities.player.Controllable.speed=0.045;
entities['camera-anchor'].Transform={x:-10,y:2.45,rotation:0,scaleX:1,scaleY:1};
entities['camera-anchor'].Bounds={minX:-7,maxX:5,minY:2.45,maxY:2.45};
entities['camera-focus-offset'].Transform3D.y=1.4;
box('river',-8,-0.16,-0.8,24,0.13,4.4,palette.river);
box('sea',64,-0.18,0,120,0.13,200,palette.sea);
box('river-bank',-8,-0.13,3.3,24,0.26,4.8,palette.sand);
box('walkway',-5.75,-0.07,2.45,20.5,0.14,1.8,0xdccbac);
box('pier',7.5,-0.08,2.45,6,0.16,1.8,palette.wood);
for(let i=0;i<40;i++)box('board-'+i,4.55+i*0.15,0.012,2.45,0.025,0.012,1.76,0x775e48);
box('far-bank',-48,0.03,-5.7,104,0.7,6,palette.grass);
for(let i=0;i<12;i++){
 round('dune-'+i,-15+i*1.9,0.15,-4.0-(i%3)*0.3,2.2,0.65,1.8,0xa9bd91);
 round('near-rock-'+i,-14+i*1.5,-0.05,1.05,0.55,0.24,0.38,0xc5be9e);
}
for(let i=0;i<32;i++){
 const z=-2.45+(i%7)*0.51;
 box('flow-'+i,-7,0.005,z,0.42+(i%4)*0.09,0.018,0.035,0xc2e8cb,[
  {kind:'osc',field:'x',wave:'saw',amp:11.5,freq:0.38+(i%3)*0.015,phase:i*2.39996},
 ]);
}
for(let i=0;i<18;i++){
 const x=5+(i%6)*2.8,z=-6+Math.floor(i/6)*2.3;
 box('sea-wave-'+i,x,-0.02,z,1.5+(i%3)*0.4,0.018,0.065,0x91c6cd,[
  {kind:'bob',field:'y',amp:0.025,freq:0.65,phase:i*1.1},
  {kind:'osc',field:'z',wave:'sine',amp:0.24,freq:0.5,phase:i*0.8},
 ]);
}
for(let i=0;i<20;i++){
 const x=-15+i*1.0;
 round('bank-foam-'+i,x,0.025,1.32,0.72,0.025,0.09,palette.foam);
 entities['bank-foam-'+i].Anim3D={channels:[
  {kind:'bob',field:'scaleZ',amp:0.035,freq:0.8,phase:i*0.7},
  {kind:'bob',field:'y',amp:0.012,freq:0.8,phase:i*0.7},
 ]};
}
for(let i=0;i<5;i++){
 round('sea-bank-foam-'+i,4.05,0.015,3.6+i*0.43,0.11,0.025,0.42,palette.foam);
 entities['sea-bank-foam-'+i].Anim3D={channels:[{kind:'bob',field:'x',amp:0.025,freq:0.6,phase:i}]};
}
for(let i=0;i<7;i++){
 round('mouth-foam-'+i,4.2+(i%3)*0.6,0.02,-2.8+i*0.63,0.6,0.025,0.10,palette.foam);
 entities['mouth-foam-'+i].Anim3D={channels:[{kind:'bob',field:'x',amp:0.16,freq:0.48,phase:i}]};
}
for(let i=0;i<12;i++){
 const x=-13+i*1.8;
 box('post-'+i,x,0.4,3.65,0.10,0.8,0.10,0x927b56);
}
box('rail',-3,0.72,3.65,21,0.065,0.075,0xb19c73);
box('sign-post',2,0.8,3.5,0.12,1.6,0.12,0x7b765b);
box('sign',2,1.4,3.5,1.25,0.45,0.10,0xd9d2a7);
box('sign-arrow',2.1,1.4,3.57,0.6,0.035,0.02,0x42645d);
for(let i=0;i<6;i++){
 const x=-13+i*3.5;
 box('reed-'+i,x,0.36,0.87,0.035,0.72,0.035,0x6a9b72);
 box('reed-head-'+i,x,0.74,0.87,0.07,0.20,0.07,0x9c865a);
}
for(let i=0;i<6;i++)round('hill-'+i,-16+i*3.6,0.3,-10.2,5.0,1.5+(i%3)*0.5,3.2,0x9fbaa3);
round('far-island',20,-0.05,-23,12,1.7,3.2,0x8eb3a6);
const config={
 assets:base.assets.filter(a=>a.key===entities.player.Model3D.modelKey),
 characters:base.characters.filter(c=>c.entity==='player'),
 manifest:{capabilities:['t1-motion-apply','t1-hierarchy-resolve','t2-bounds-clamp','t2-face-rotate'],entities},
 keys:{ArrowLeft:{dx:-1},KeyA:{dx:-1},ArrowRight:{dx:1},KeyD:{dx:1},Space:{action:'pose.wave'}},
 links:{},
 layout:{type:'Screen',id:'estuary-screen',props:{},layout:{direction:'column',padding:0,gap:0},children:[
  {type:'Panel',id:'header',props:{},layout:{height:44,direction:'row',padding:10,align:'center'},children:[
   {type:'Label',id:'estuary-title',props:{text:'河口散步',size:18,color:'text'}},
  ]},
  {type:'Panel',id:'scene-stage',props:{bare:true},layout:{flex:1}},
  {type:'Panel',id:'footer',props:{},layout:{height:42,direction:'row',padding:10,align:'center'},children:[
   {type:'Label',id:'instructions',props:{text:'← → / A D 沿岸散步 · 向右走到入海处 · 空格招呼',color:'text',size:13}},
  ]},
 ]},
};
writeFileSync(new URL('public/scenes/estuary.json',root),JSON.stringify(config,null,2)+'\n');
console.log('Generated estuary scene',Object.keys(entities).length,'entities');
