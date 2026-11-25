// Apollo manifest host: rules remain JSON; loading, input and render-only transitions live here.
import {Engine} from '../../src/runtime/engine.js';
import {parseManifest} from '../../src/assembly/manifest.js';
import {ThreeRenderer} from '../../src/renderer/three-renderer.js';
import {AssetManager,ModelAssetLoader,ImageAssetLoader} from '../../src/assets/index.js';
import {KeyboardInputSource} from '../../src/net/host/local-input.js';
import {QueuedInputSource} from '../../src/net/host/queued-input.js';
import {MultiInputSource} from '../../src/net/commands.js';
import {mountUI,validateLayoutNode,apolloOnyx} from '../../src/ui/components/index.js';
import type {Camera3D,Transform,Transform3D} from '../../src/engine/protocol/components.js';
import {sceneLayout,SceneCompositor} from '../game628-life-controls-20261117/transition-layout.js';
import {RenderEnvironment} from '../game628-life-controls-20261117/environment.js';
import {CharacterPresentation,installStreetResponse} from './scene-adapter.js';
const frame=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
const delay=(ms:number)=>new Promise<void>(resolve=>window.setTimeout(resolve,ms));
const BLEND_MS=320;
async function main(){
 const configs=new Map<string,Promise<any>>(),errors:string[]=[];
 window.addEventListener('error',e=>errors.push(e.message));
 window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
 const models=new ModelAssetLoader(),images=new ImageAssetLoader();
 const assets=new AssetManager({load:d=>d.kind==='model'?models.load(d):images.load(d)});
 async function configFor(name:string){
  if(!/^[a-z0-9-]+$/.test(name))throw Error('Invalid scene name');
  if(!configs.has(name))configs.set(name,(async()=>{
   const r=await fetch(`/scenes/${name}.json`);if(!r.ok)throw Error(`Scene missing: ${name}`);
   const c=await r.json();const issues=validateLayoutNode(c.layout);if(issues.length)throw Error(JSON.stringify(issues));
   for(const a of c.assets)if(!assets.has(a.key))assets.register(a);
   await Promise.all(c.assets.map((a:any)=>assets.load(a.key)));return c;
  })().catch(e=>{configs.delete(name);throw e;}));
  return configs.get(name)!;
 }
 const requestedPage = new URLSearchParams(location.search).get('scene') ?? 'streets';
 const page = requestedPage === 'reference-walk' ? 'crowd-street' : requestedPage;
 const initial = await configFor(page);
 type View={page:string;config:any;slot:number;engine:Engine;renderer:ThreeRenderer;keys:KeyboardInputSource;queue:QueuedInputSource;enabled:boolean;blocked:Set<string>;environment?:RenderEnvironment;characters?:CharacterPresentation;off:()=>void};
 let active:View,transitioning=false,stopped=false;
 let selectedWeather:string|undefined;
 function selectEnvironment(view:View,name:string,now:number):boolean{
  if(!view.environment?.select(name,now))return false;
  if(name.startsWith('weather.'))selectedWeather=name;
  else if(name.startsWith('env.'))selectedWeather='weather.clear';
  return true;
 }
 const views=new Set<View>();
 const navigation={};
 const ui=mountUI(document.getElementById('root')!,sceneLayout(initial.layout),navigation,apolloOnyx,{enqueueAction:(name,value)=>{if(!active?.enabled)return;const target=active.config.links[name];if(target){void switchScene(target);return;}if(active.config.streetResponse && Object.hasOwn(active.config.streetResponse.rules.actions,name)){active.queue.enqueueAction(name,value);return;}if(!selectEnvironment(active,name,performance.now())&&!active.characters?.select(name,performance.now()))active.queue.enqueueAction(name,value);}});
 const stage=document.getElementById('scene-stage')!;
 const compositor=new SceneCompositor([0,1].map(slot=>document.getElementById(`scene-surface-${slot}`)!),0);
 function setPresentationComponent(v:View,item:any){
  if(item.type!=='AnimState3D'){console.error('[presentation:reject]',item.type);throw Error('Presentation accepts AnimState3D overrides only');}
  v.engine.world.addComponent(item.entity,{...item.value,type:'AnimState3D'});
 }
 function present(v:View,spec:any){
  for(const p of spec.paths??[]){
   const t=v.engine.world.getComponent<Transform>(p.entity,'Transform')!,first=p.from??[t.x,p.height??0,t.y];
   v.engine.world.addComponent(p.entity,{type:'Transform3D',x:first[0],y:first[1],z:first[2]} as Transform3D);
   v.engine.world.addComponent(p.entity,{type:'Path3D',points:[first,...p.points],duration:spec.durationMs/1000,loop:'none',mode:'smooth',faceDir:p.faceDir??false});
  }
  for(const item of spec.components??[])setPresentationComponent(v,item);
  if(spec.camera)Object.assign(v.engine.world.getComponent<Camera3D>('camera','Camera3D')!,spec.camera);
 }
 function finish(v:View,spec:any){
  for(const p of spec.paths??[]){v.engine.world.removeComponent(p.entity,'Path3D');v.engine.world.removeComponent(p.entity,'Transform3D');}
  for(const item of spec.restore??[])setPresentationComponent(v,item);
 }
 function holdArrival(v:View,previous:View){
  const spec=v.config.arrival;if(!spec)return;
  for(const p of spec.paths??[]){
   const from=p.from,previousPose=previous.engine.world.getComponent<Transform3D>(p.entity,'Transform3D');
   v.engine.world.addComponent(p.entity,{type:'Transform3D',x:from[0],y:from[1],z:from[2],rotY:previousPose?.rotY??0} as Transform3D);
  }
  // Match the doorway camera before blending; only pull out after the old view has retired.
  for(const item of spec.components??[])setPresentationComponent(v,{...item,value:{...item.value,speed:0}});
  if(spec.camera)Object.assign(v.engine.world.getComponent<Camera3D>('camera','Camera3D')!,spec.camera);
 }
 function fit(v:View){if(v.config.framing){const f=v.config.framing;v.engine.world.getComponent<Camera3D>('camera','Camera3D')!.orthoSize=Math.max(f.minHalfHeight,f.minHalfWidth*stage.clientHeight/Math.max(1,stage.clientWidth));}}
 function dispose(v:View){v.enabled=false;v.off();v.keys.dispose();v.engine.stop();v.renderer.destroy(true);views.delete(v);}
 async function createView(name:string,slot:number):Promise<View>{
  const config=await configFor(name),blueprint=parseManifest(config.manifest),queue=new QueuedInputSource('p1');
  let v:View;
  let input:MultiInputSource;
  const engine=new Engine({tickRate:60,input:{commandsForTick:tick=>{const commands=input.commandsForTick(tick);if(v?.enabled){for(const command of commands)for(const action of command.actions??[])if(action.key){selectEnvironment(v,action.key,performance.now());v.characters?.select(action.key,performance.now());}return commands;}return [];}}});engine.load(blueprint);installStreetResponse(engine,config.streetResponse);
  const keys=new KeyboardInputSource('p1',window,config.keys);input=new MultiInputSource([keys,queue]);
  const container=document.getElementById(`scene-surface-${slot}`)!;
  let renderer:ThreeRenderer;
  try{renderer=new ThreeRenderer({width:container.clientWidth,height:container.clientHeight,assets,background:0xece4d5,dprCap:config.quality==='reference'?2:1.5,shadowMapSize:config.quality==='reference'?4096:1024});}
  catch(error){keys.dispose();throw error;}
  v={page:name,config,slot,engine,renderer,keys,queue,enabled:false,blocked:new Set(),off:()=>{}};views.add(v);fit(v);
  try{
   if(config.environment)v.environment=new RenderEnvironment(engine.world,config.environment);
   if(selectedWeather&&v.environment){v.environment.select(selectedWeather,0,0);v.environment.update(0);}
   if(config.characters)v.characters=new CharacterPresentation(engine,config.characters);
   engine.attachRenderer(renderer,container);
   v.off=engine.subscribe(()=>{v.environment?.update(performance.now());v.characters?.update(performance.now());if(v!==active||transitioning||!v.enabled)return;for(const route of config.routes??[]){if(!v.blocked.has(route.flagEntity)&&engine.world.getComponent<{type:'Flag';active:boolean}>(route.flagEntity,'Flag')?.active){void switchScene(route.scene,route);break;}}});
   engine.start();
   const expected=Object.values(config.manifest.entities).filter((e:any)=>e.Model3D&&e.Visibility?.visible!==false).length,deadline=performance.now()+8000;
   do{await frame();if(stopped)throw Error('Preview closed');if(performance.now()>deadline)throw Error(`Model warm-up timed out: ${name}`);}while(renderer.readStats().models<expected);
   await frame();await frame();
  }catch(e){dispose(v);throw e;}
  console.info('[scene:ready]',name,{models:renderer.readStats().models,slot});return v;
 }
 function prefetch(v:View){
  const targets=new Set<string>((v.config.routes??[]).map((r:any)=>r.scene));
  for(const name of Object.values(v.config.links))targets.add(String(name));targets.delete(v.page);
  for(const target of targets)void configFor(target).catch(e=>console.warn('[scene:prefetch-retry]',target,String(e)));
 }
 async function arrival(v:View){
  const spec=v.config.arrival;if(!spec){v.enabled=true;return;}
  present(v,spec);await delay(80);if(stopped)return;
  Object.assign(v.engine.world.getComponent<Camera3D>('camera','Camera3D')!,spec.cameraAfter);
  await delay(spec.durationMs+30-80);if(stopped)return;
  finish(v,spec);v.enabled=true;console.info('[scene:arrival]',v.page);
 }
 async function switchScene(name:string,route?:any){
  if (name === 'reference-walk') name = 'crowd-street';
  if (name === active.page && !route && name === 'crowd-street') return;
  if(transitioning||stopped)return;
  transitioning=true;const previous=active;previous.enabled=false;let next:View|undefined;
  try{
   if(route){present(previous,route.departure);console.info('[scene:departure]',previous.page,name);}
   const prepared=createView(name,1-previous.slot);
   [next]=await Promise.all([prepared,delay(route?.departure.durationMs??0)]);
   if(stopped){dispose(next);return;}
   previous.engine.stop();holdArrival(next,previous);await frame();await frame();
   ui.update(sceneLayout(next.config.layout));await compositor.blend(previous.slot,next.slot,BLEND_MS);
   await arrival(next);
   if(stopped)return;
   // Commit only after the incoming motion has completed; keep the previous framebuffer for rollback.
   active=next;history.replaceState(null,'',`?scene=${encodeURIComponent(name)}`);dispose(previous);
   console.info('[scene:seamless]',previous.page,name,{documentRetained:true,opaqueBackgroundRetained:true});prefetch(next);
  }catch(e){
   if(next&&next!==active)dispose(next);
   if(!stopped){
    if(route){previous.blocked.add(route.flagEntity);finish(previous,route.departure);Object.assign(previous.engine.world.getComponent<Camera3D>('camera','Camera3D')!,previous.config.manifest.entities.camera.Camera3D);}
    previous.enabled=true;previous.engine.start();compositor.show(previous.slot);
    const fallback=sceneLayout(previous.config.layout),footer=fallback.children?.find(n=>n.id==='footer'),message=footer?.children?.find(n=>n.id==='instructions');
    if(message)message.props={...message.props,text:'暂时未能换街，仍可在当前街行走；点上方「街坊行走」重新进入。'};
    ui.update(fallback);errors.push(String(e));console.error('[scene:transition-rejected]',name,e);
   }
  }finally{transitioning=false;}
 }
 active=await createView(page,0);
 const observer=new ResizeObserver(()=>{for(const v of views)fit(v);});observer.observe(stage);
 await arrival(active);prefetch(active);
 Object.defineProperty(window,'apolloPrototype',{value:{snapshot:()=>active.engine.world.snapshot(),action:(name:string)=>{if(active.enabled)active.queue.enqueueAction(name);},stats:()=>active.renderer.readStats(),errors:()=>[...errors],config:()=>structuredClone(active.config)}});
 window.addEventListener('pagehide',()=>{stopped=true;observer.disconnect();for(const v of [...views])dispose(v);ui();assets.clear();});
}
void main().catch(e=>{console.error('[prototype-load]',e);mountUI(document.getElementById('root')!,{id:'failure',type:'Screen',props:{},children:[{id:'message',type:'Label',props:{text:String(e),color:'danger'}}]}, {},apolloOnyx);});
