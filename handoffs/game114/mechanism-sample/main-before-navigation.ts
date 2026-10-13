// Sample host only: the world and all visual motion are engine component data.
import {Engine} from '@zerocraft/engine/runtime/engine.js';
import {ThreeRenderer} from '@zerocraft/engine/renderer/three-renderer.js';
import {AssetManager,ModelAssetLoader,ImageAssetLoader} from '@zerocraft/engine/assets/index.js';
import type {WorldBlueprint} from '@zerocraft/engine/assembly/demo.assembly.js';
const entities:WorldBlueprint['entities']={};
let seq=0;
function block(x:number,y:number,z:number,w:number,h:number,d:number,color:number){entities['block-'+seq++]={Transform3D:{x,y,z},Mesh3D:{shape:'box',width:w,height:h,depth:d},Material3D:{preset:'matte',color,shading:'toon',toonSteps:3}};}
function model(key:string,x:number,z:number,scale=1,rotY=0){const id=key+'-'+seq++;entities[id]={Transform3D:{x,y:0,z,rotY,scale},Model3D:{modelKey:'mechanism/'+key}};return id;}
entities.camera={Camera3D:{yaw:.5,pitch:.83,distance:62,projection:'ortho',orthoSize:15,pivotX:0,pivotY:0,pivotZ:0,near:.1,far:160}};
entities.sun={Light3D:{kind:'directional',color:0xfff1d8,intensity:1.6,castShadow:true}};
entities.fill={Light3D:{kind:'ambient',color:0xdce6ff,intensity:.65}};
block(0,-.3,0,65,.5,65,0x95a76c);
block(0,-.015,-13,70,.1,7,0x5b9ba6);
block(-1,.012,0,4,.03,33,0xc5a16a);
// Low timber bridge and rails; scene dressing uses Mesh3D + toon material.
block(-1,.2,-13,4,.35,9,0xa47b48);
for(const x of [-3,1]){block(x,.8,-13,.15,.13,9,0x735235);for(const z of [-16,-14,-12,-10])block(x,.5,z,.13,1,.13,0x735235);}
for(const [x,z]of [[-14,-4],[-18,-5],[-17,-.7]])model('house',x,z,1.05,-.2);
for(const [x,z,w,d]of [[-13,11,8,5],[15,-8,7,4]]){block(x,.02,z,w,.07,d,0xbaaf52);for(let i=0;i<8;i++)block(x-w/2+.5+i*w/8,.17,z,.10,.27,d-.3,0xe3cc63);for(const sz of [-1,1])block(x,.02,z+sz*d/2,w+.4,.06,.25,0x729ba2);}
for(let i=0;i<26;i++){const side=i%2?-1:1;const x=side*(14+(i*7%8)),z=-18+(i*11%37);model('tree',x,z,.75+(i%4)*.2,i*.7);}
for(let i=0;i<16;i++){const x=(i%2?-1:1)*(16+i%7),z=-20+(i*9%39);model('rock',x,z,.65+(i%3)*.4,i);}
for(const [x,z]of [[-6,5],[6,1],[9,7],[-3,-6],[11,-4]])model('pickup',x,z);
for(let i=0;i<45;i++){const x=-22+(i*13%45),z=-19+(i*17%40);if(Math.abs(x)<9&&Math.abs(z)<8)continue;block(x,.03,z,.4,.03,.3,i%2?0xa6b77a:0x879e60);}
const hero=model('turtle',-4,1,1.5,0);entities[hero].AnimState3D={clip:'mechanical-loop',loop:true};entities[hero].Path3D={points:[[-5,0,3],[1,0,6],[6,0,2],[3,0,-4],[-5,0,-3]],duration:36,loop:'loop',mode:'smooth',faceDir:true};
for(let i=0;i<3;i++){const ox=model('ox',8+i*2,3-i*3,.95,i);entities[ox].AnimState3D={clip:'walk',speed:1-i*.12,loop:true};entities[ox].Path3D={points:[[9+i,0,4-i*3],[6+i,0,-1-i*2],[11+i,0,-4+i],[13+i,0,3+i]],duration:24+i*4,loop:'loop',faceDir:true};}
const ml=new ModelAssetLoader(),il=new ImageAssetLoader();
const assets=new AssetManager({load:d=>d.kind==='model'?ml.load(d):il.load(d)});
assets.register({kind:'texture',key:'mechanism/grass',src:'textures/grass.png',colorSpace:'srgb'});
entities['block-0'].Material3D={preset:'matte',shading:'toon',toonSteps:3,map:'mechanism/grass',tiling:{repeat:12}};
for(const key of ['turtle','house','tree','rock','ox','pickup'])assets.register({kind:'model',key:'mechanism/'+key,src:'models/'+key+'.glb'});
await assets.loadAll();
const engine=new Engine();engine.load({capabilities:[],entities});
const host=document.getElementById('stage')!;
const renderer=new ThreeRenderer({width:innerWidth,height:innerHeight,background:0x95a76c,assets,dprCap:1.5,shadowMapSize:4096});
engine.attachRenderer(renderer,host);engine.start();
// Lifecycle diagnostics for automated browser verification, no sim modifications.
Object.assign(window,{sampleReady:true,sampleInfo:{engine:'ApolloGame ThreeRenderer',modelCount:6,entityCount:Object.keys(entities).length,camera:'fixed orthographic',animation:'GLB mechanical-loop + Path3D'}});
addEventListener('resize',()=>renderer.resize(innerWidth,innerHeight));
addEventListener('pagehide',()=>{engine.stop();renderer.destroy();},{once:true});
