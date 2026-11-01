// D1 actual AssetIndex -> Engine -> AssetManager -> ModelPool -> ThreeRenderer.
// Synthetic triangle rig only; no provider/artistic/locomotion acceptance claim.
import * as THREE from 'three';
import { ThreeRenderer } from '../../../src/renderer/three-renderer.ts';
import { createManifestAssets } from '../../../src/services/scene-game-assets.ts';
import { parseAssetIndex, registerAssetIndex } from '../../../src/assets/asset-index.ts';
import { Engine } from '../../../src/runtime/engine.ts';
import { animationDriverCapability } from '../../../src/skills/tier2/animation-driver.ts';
import { hashSnapshot } from '../../../src/net/determinism.ts';
const ensure=(v,m)=>{if(!v)throw new Error(m);};
const assets=createManifestAssets(),renderer=new ThreeRenderer({assets,width:720,height:480,dprCap:1,antialias:false,shadowMapSize:256});
renderer.init(document.getElementById('stage'));
const engine=new Engine({tickRate:30}),replica=new Engine({tickRate:30}),world=engine.world;
const config={type:'AnimationDriver3D',version:1,tickRate:30,initialState:'pose',graph:{type:'AnimGraph3D',clips:{move:{asset:'motion/probe',clip:'probe',loop:false}},states:{pose:{clip:'move'}},params:{speed:'speed'},transitions:[]},clips:{move:{durationTicks:30,notifies:[{id:'contact',atTick:10}]}}};
const entities={camera:{Camera3D:{yaw:.2,pitch:.3,distance:4,pivotX:0,pivotY:.9,pivotZ:0,near:.1,far:30}},floor:{Transform3D:{x:0,y:-.06,z:0},Mesh3D:{shape:'box',width:5,height:.1,depth:3,frontTint:0x708090}}};
for(const [id,x] of [['a',-.5],['b',.5]])entities[id]={Transform:{x,y:0,rotation:0,scaleX:1,scaleY:1},Velocity:{vx:0,vy:0,angular:0},Model3D:{modelKey:'model/probe'},AnimationDriver3D:structuredClone(config)};
engine.load({entities,capabilities:[animationDriverCapability]});replica.load({entities:structuredClone(entities),capabilities:[animationDriverCapability]});
let renderChecks=0,hashChecks=0;
function sync(){const before=JSON.stringify(world.snapshot()),hash=hashSnapshot(world.snapshot()),version=world.getVersion();renderer.sync(world.readView());ensure(JSON.stringify(world.snapshot())===before&&hashSnapshot(world.snapshot())===hash&&world.getVersion()===version,'Renderer changed authoritative world');renderChecks++;}
function tick(n=1){for(let i=0;i<n;i++){world.tick();replica.world.tick();ensure(hashSnapshot(world.snapshot())===hashSnapshot(replica.world.snapshot()),'Rendered/non-rendered simulation differs');hashChecks++;}}
function command(seq,op,more={}){for(const w of [world,replica.world])w.addComponent('a',{type:'AnimationDriverCommand3D',version:1,commands:[{seq,op,...more}]});}
function object(id){return renderer.models.instances.get(id);}
function pose(id){let mesh;object(id)?.traverse(n=>{if(n.isSkinnedMesh)mesh=n;});ensure(mesh,'No actual SkinnedMesh');object(id).updateMatrixWorld(true);mesh.skeleton.update();const h=mesh.skeleton.bones.find(b=>b.name==='Hips');ensure(h,'No Hips bone');const v=mesh.applyBoneTransform(0,new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position,0));return {hips:h.position.toArray(),vertex:v.toArray(),gpuBoneTexture:!!mesh.skeleton.boneTexture&&renderer.gl.getContext().isTexture(renderer.gl.properties.get(mesh.skeleton.boneTexture).__webglTexture)};}
function pixels(){const gl=renderer.gl.getContext(),bytes=new Uint8Array(720*480*4);gl.readPixels(0,0,720,480,gl.RGBA,gl.UNSIGNED_BYTE,bytes);let h=2166136261;for(const b of bytes)h=Math.imul(h^b,16777619);return (h>>>0).toString(16);}
const close=(a,b)=>Math.abs(a-b)<1e-6;
window.d1Probe={async run(){
 const index=parseAssetIndex(await(await fetch('/fixtures/index.json')).json());registerAssetIndex(assets,index,'/');await assets.preloadGroup('cast');
 tick(12);
 for(let i=0;i<300;i++){sync();if(['a','b'].every(id=>renderer.models.drivers.get(id)?.sampler))break;await new Promise(r=>requestAnimationFrame(r));}
 ensure(['a','b'].every(id=>renderer.models.drivers.get(id)?.sampler),'D1 actual pipeline readiness timeout');
 sync();const at12=pose('a');ensure(close(at12.hips[0],.02),'Delayed model did not catch up to tick12');ensure(at12.gpuBoneTexture,'No native GPU bone texture upload');const pixel12=pixels();
 ensure(object('a')!==object('b'),'Model instances shared');
 for(let i=0;i<30;i++)sync();ensure(JSON.stringify(pose('a'))===JSON.stringify(at12),'Repeated render advanced animation');
 command(1,'pause');tick(3);sync();ensure(close(pose('a').hips[0],.02),'Paused cursor moved');ensure(pose('b').hips[0]>.02,'Other actor was paused with first actor');
 for(const w of [world,replica.world])w.addComponent('b',{type:'AnimationDriverCommand3D',version:1,commands:[{seq:1,op:'pause'}]});
 tick();sync();const pixelBeforeSeek=pixels(),bBeforeSeek=JSON.stringify(pose('b'));
 const saved=JSON.parse(JSON.stringify(world.snapshot())),order=world.snapshotOrder();
 command(2,'seek',{tick:27});tick();sync();const at27=pose('a'),pixel27=pixels();ensure(close(at27.hips[0],.045),'Seek failed to sample absolute pose');ensure(JSON.stringify(pose('b'))===bBeforeSeek,'Second actor changed during isolated seek');ensure(pixelBeforeSeek!==pixel27,'Isolated seek did not change GPU pixels');ensure(world.getComponent('a','AnimationDriverPlayback3D').events.length===0,'Seek emitted animation events');
 command(3,'play',{state:'pose'});tick();sync();ensure(close(pose('a').hips[0],0),'Retrigger retained old clip cursor');
 world.restore(saved,order);replica.world.restore(structuredClone(saved),order);sync();ensure(close(pose('a').hips[0],.02),'JSON restore did not rewind native pose');
 command(2,'resume');let completes=0;for(let i=0;i<35;i++){tick();sync();completes+=world.getComponent('a','AnimationDriverPlayback3D').events.filter(e=>e.kind==='complete').length;}
 ensure(completes===1,'Nonloop completion not exactly once');ensure(close(pose('a').hips[0],.05),'End frame not preserved');
 const gl=renderer.gl.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
 const report={ok:true,source:'synthetic-triangle-rig',realMixamoValidated:false,artisticQualityValidated:false,locomotionValidated:false,webgl:gl.getParameter(gl.VERSION),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderChecks,hashChecks,at12,at27,pixel12,pixelBeforeSeek,pixel27,isolatedSeekPixels:true,completionEvents:completes,pausedAndRestore:true,twoIndependentActors:true};
 window.d1Report=report;return report;
},cleanup(){for(const id of ['a','b']){world.destroyEntity(id);replica.world.destroyEntity(id);}sync();ensure(renderer.models.drivers.size===0&&renderer.models.instances.size===0,'Driver instance resources leaked');return true;},dispose(){renderer.destroy();assets.clear();}};
