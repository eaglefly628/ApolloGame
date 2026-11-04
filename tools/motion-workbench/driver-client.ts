import {validateDriverStory,type DriverStory} from './driver-story.js';
import {mountUI} from '../../src/ui/components/index.js';
import {workbenchTheme} from './theme.js';
import {driverLayout,type DriverLayoutState,type DriverActorRow} from './driver-layout.js';
import {Engine} from '../../src/runtime/engine.js';
import {CinematicPreviewSession,type CinematicPreviewProgram} from '../../src/runtime/cinematic-preview.js';
import {parseManifest} from '../../src/assembly/manifest.js';
import {ThreeRenderer} from '../../src/renderer/three-renderer.js';
import type {AnimationDiagnostic as NativeDiagnostic} from '../../src/renderer/three/animation-diagnostics.js';
import {AssetManager,ModelAssetLoader,type AssetDescriptor} from '../../src/assets/index.js';
import {FixedStepClock} from '../../src/net/fixed-step.js';
import type {WorldSnapshot} from '../../src/engine/core/types.js';
interface Profile {id:string;label:string;description:string;status:'numeric-candidate';manifest:unknown;program:CinematicPreviewProgram;assets:AssetDescriptor[]}

interface Active {engine:Engine;renderer:ThreeRenderer;session:CinematicPreviewSession;assets:AssetManager;release:()=>void}
interface DriverClientOptions {fetcher?:typeof fetch;requestFrame?:typeof requestAnimationFrame;cancelFrame?:typeof cancelAnimationFrame;captureConsole?:boolean}
const record=(v:unknown):Record<string,any>=>v&&typeof v==='object'?v as Record<string,any>:{};
function actors(snapshot:WorldSnapshot):DriverActorRow[]{return Object.entries(snapshot).filter(([,r])=>r.AnimationDriverPlayback3D||r.LocomotionPlayback3D||r.AnimationPerformancePlayback3D||r.RootMotionPlayback3D).map(([id,r])=>{
 const base=record(r.AnimationDriverPlayback3D),loco=record(record(r.LocomotionPlayback3D).playback),performance=record(r.AnimationPerformancePlayback3D),motor=record(r.CharacterMotorPlayback3D),root=record(r.RootMotionPlayback3D),result=record(motor.result),feedback=record(root.lastFeedback);
 const v=(a:unknown)=>{const p=record(a);return `(${((p.x??0)/10000).toFixed(3)}, ${((p.z??0)/10000).toFixed(3)})m`;};
 const slots=Object.entries(record(performance.slots)).map(([key,value])=>{const s=record(value);return `${key}: ${s.montage} #${s.sectionIndex} ${(s.weightQ/1000000).toFixed(2)}${s.outgoing?' + 淡出源':''}`;}).join('；');
 const weights=Object.entries(record(base.weights)).filter(([,w])=>Number(w)>0).map(([key,w])=>`${key} ${Number(w).toFixed(2)}`).join('；');
 const cues=[...(base.events??[]),...(performance.events??[]),...(record(r.LocomotionPlayback3D).events??[])].filter(e=>e.kind==='notify'||e.cueId||e.notifyId).slice(0,8).map(e=>e.cueId??e.notifyId??e.kind).join('、');
 return{id,base:String(base.state??loco.state??'—'),slots:slots||'—',weights:weights||'—',cues:cues||'—',root:r.RootMotionPlayback3D?`${v(result.desiredDeltaQ)} → ${v(feedback.acceptedDeltaQ??result.acceptedDeltaQ)}`:'未启用根运动',rejections:[...(result.blockedReasons??[]),...(feedback.blocked?['根运动受阻']:[])].join('、')||'—'};
});}
/** Page host only. World advancement always goes through CinematicPreviewSession. */
export async function bootDriverWorkbench(root:HTMLElement,options:DriverClientOptions={}){
 const fetcher=options.fetcher??fetch,raf=options.requestFrame??requestAnimationFrame,caf=options.cancelFrame??cancelAnimationFrame;
 let consoleMessages:string[]=[];
 let profiles:Profile[]=[],generation=0,disposed=false,active:Active|undefined,pendingRelease:(()=>void)|undefined,lastTime:number|undefined,clock=new FixedStepClock(30),rafId=0;
 const state:DriverLayoutState={profiles:[],selectedId:'',description:'',loading:true,playing:false,frame:-1,durationFrames:0,tickRate:30,seekValue:'0',message:'',diagnostics:[],actors:[],models:0};
 let story:DriverStory|undefined,storyEpoch=0,storyPlaying=false,storyWaiting=false;
 let requiredNative:{entityId:string;kind:NativeDiagnostic['kind']}[]=[];
 const storyState=()=>{state.story=story;state.storyIndex=story?.chapters.findIndex(c=>c.profileId===state.selectedId);state.storyPlaying=storyPlaying;state.storyWaiting=storyWaiting;};
 const stopStory=()=>{storyEpoch++;storyPlaying=false;storyWaiting=false;storyState();};
 const update=()=>{storyState();if(!disposed)mounted.update(driverLayout(state));};
 const read=()=>{if(!active)return;state.frame=active.session.frame;state.playing=active.session.playing;const diagnostics=active.renderer.getAnimationDiagnostics();const kind:Record<NativeDiagnostic['kind'],string>={base:'基础',locomotion:'移动',performance:'表演',root:'根运动',socket:'挂点',ik:'关节约束',face:'面部'},status={loading:'装载中',ready:'就绪',rejected:'不兼容'};const text=(d:NativeDiagnostic)=>`${kind[d.kind]}${status[d.status]}`;state.actors=actors(active.engine.world.snapshot()).map(row=>({...row,native:diagnostics.filter(d=>d.entityId===row.id).map(text).join(' · ')||'动作未就绪',rejections:[row.rejections==='—'?'':row.rejections,...diagnostics.filter(d=>d.entityId===row.id&&d.status==='rejected').map(d=>`${kind[d.kind]}动作不兼容`)].filter(Boolean).join('；')||'—'}));state.nativeSummary=diagnostics.length?diagnostics.map(d=>`${d.entityId} ${text(d)}`).join('；'):'动作未就绪：等待原生绑定状态';const rejected=diagnostics.filter(d=>d.status==='rejected');if(rejected.length){stopStory();active.session.pause();state.playing=false;state.message='动作不兼容：'+rejected.map(d=>`${d.entityId} ${kind[d.kind]}`).join('、');}else if(state.message.startsWith('动作不兼容：'))state.message='';state.diagnostics=[...consoleMessages,...diagnostics.filter(d=>d.status!=='ready'&&d.reason).map(d=>`${d.entityId} ${text(d)}：${d.reason}`)].slice(-8);state.models=active.renderer.readStats().models;};
 const reject=(error:unknown)=>{stopStory();state.message='无法继续：'+String(error);state.loading=false;active?.session.pause();read();update();};
 const act=(fn:()=>void)=>()=>{try{state.message='';fn();read();update();}catch(error){reject(error);}};
 const mounted=mountUI(root,driverLayout(state),{profile:(id?:string)=>{if(id)void selectProfile(id);},'story-play':()=>{void startStory();},'story-previous':()=>{void jumpChapter(-1);},'story-next':()=>{void jumpChapter(1);},play:act(()=>{stopStory();active?.session.play();lastTime=undefined;clock=new FixedStepClock(state.tickRate);}),pause:act(()=>{stopStory();active?.session.pause();lastTime=undefined;clock=new FixedStepClock(state.tickRate);}),step:act(()=>{stopStory();active?.session.pause();active?.session.step();}),reset:act(()=>{stopStory();active?.session.pause();active?.session.seek(0);state.seekValue='0';}),'frame-input':(v?:string)=>{state.seekValue=v??'';update();},seek:act(()=>{stopStory();const f=Number(state.seekValue);if(!state.seekValue.trim()||!Number.isInteger(f)||f<0||f>state.durationFrames)throw Error('帧位置必须在场景范围内');active?.session.pause();active?.session.seek(f);}),scrub:(v?:string)=>{state.seekValue=String(v??'');act(()=>{stopStory();const f=Number(v);if(!Number.isInteger(f)||f<0||f>state.durationFrames)throw Error('帧位置超出范围');active?.session.pause();active?.session.seek(f);})();},'profiles-json':()=>location.assign('/driver/profiles.json'),home:()=>location.assign('/')},workbenchTheme());
 function clear(){pendingRelease?.();pendingRelease=undefined;active?.release();active=undefined;lastTime=undefined;}
 async function selectProfile(id:string,continuationEpoch?:number){const profile=profiles.find(p=>p.id===id);if(!profile||disposed)return;if(continuationEpoch===undefined)stopStory();else if(continuationEpoch!==storyEpoch||!storyPlaying)return;const run=++generation;clear();state.selectedId=id;state.description=profile.description;state.loading=true;state.playing=false;state.frame=-1;state.actors=[];state.models=0;state.message='';state.diagnostics=[];consoleMessages=[];state.nativeSummary='动作未就绪：正在装载';state.durationFrames=profile.program.durationFrames;state.tickRate=profile.program.tickRate;state.seekValue='0';
  requiredNative=[];for(const[entityId,row]of Object.entries(record(record(profile.manifest).entities))){const c=record(row);for(const[type,kind]of [['AnimationDriver3D','base'],['LocomotionDriver3D','locomotion'],['AnimationPerformance3D','performance'],['RootMotion3D','root']] as const)if(c[type])requiredNative.push({entityId,kind});}
  update();
  const assets=new AssetManager(new ModelAssetLoader());let engine:Engine|undefined,renderer:ThreeRenderer|undefined,released=false;
  const release=()=>{if(released)return;released=true;engine?.stop();renderer?.destroy();assets.clear();};pendingRelease=release;
  try{assets.registerManifest(profile.assets);await assets.loadAll();if(run!==generation||disposed){release();return;}
   engine=new Engine({tickRate:profile.program.tickRate});engine.load(parseManifest(profile.manifest));const container=root.querySelector<HTMLElement>('#driver-stage');if(!container)throw Error('画面容器缺失');renderer=new ThreeRenderer({width:Math.max(240,container.clientWidth),height:480,background:0x12304e,assets});engine.attachRenderer(renderer,container);
   const session=new CinematicPreviewSession(engine,profile.program);session.seek(0);if(run!==generation||disposed){release();return;}active={engine,renderer,session,assets,release};pendingRelease=undefined;clock=new FixedStepClock(profile.program.tickRate);lastTime=undefined;state.loading=false;if(continuationEpoch!==undefined&&continuationEpoch===storyEpoch&&storyPlaying)storyWaiting=true;read();update();
  }catch(error){release();if(run!==generation||disposed)return;pendingRelease=undefined;reject(error);}
 }
 async function jumpChapter(delta:number){if(!story)return;const index=story.chapters.findIndex(c=>c.profileId===state.selectedId),next=index+delta;if(next<0||next>=story.chapters.length)return;await selectProfile(story.chapters[next].profileId);}
 async function startStory(){if(!story||disposed)return;stopStory();storyPlaying=true;const epoch=storyEpoch,index=story.chapters.findIndex(c=>c.profileId===state.selectedId);try{if(active&&index>=0&&!state.loading){active.session.pause();if(active.session.frame>=state.durationFrames)active.session.seek(0);storyWaiting=true;lastTime=undefined;clock=new FixedStepClock(state.tickRate);read();update();}else await selectProfile(story.chapters[Math.max(0,index)].profileId,epoch);}catch(error){if(!disposed&&epoch===storyEpoch)reject(error);}}
 function nativeReady(){if(!active)return false;const diagnostics=active.renderer.getAnimationDiagnostics();return diagnostics.every(d=>d.status==='ready')&&requiredNative.every(wanted=>diagnostics.some(d=>d.entityId===wanted.entityId&&d.kind===wanted.kind&&d.status==='ready'));}
 const resize=()=>{if(!active)return;const container=root.querySelector<HTMLElement>('#driver-stage');if(container)active.renderer.resize(Math.max(240,container.clientWidth),480);};
 const fatal=(event:ErrorEvent|PromiseRejectionEvent)=>reject('reason'in event?event.reason:event.message);
 const oldWarn=console.warn,oldError=console.error;
 const capture=(original:typeof console.warn)=>(...args:unknown[])=>{original.apply(console,args);if(disposed)return;const text=args.map(String).join(' ');if(/ModelPool|WebGL|THREE\.|shader/i.test(text)){consoleMessages=[...consoleMessages.slice(-5),text.slice(0,1000)];if(/error|failed|rejected/i.test(text)){state.message='画面报告错误，请展开查看原因';stopStory();active?.session.pause();}read();update();}};
 const warn=capture(oldWarn),error=capture(oldError);if(options.captureConsole!==false){console.warn=warn;console.error=error;}
 const onPageHide=()=>dispose();window.addEventListener('resize',resize);window.addEventListener('error',fatal);window.addEventListener('unhandledrejection',fatal);window.addEventListener('pagehide',onPageHide);
 function frame(now:number){if(disposed)return;try{if(active){
  if(storyPlaying){
   if(active.session.frame>=state.durationFrames&&!storyWaiting){
    const index=story?.chapters.findIndex(c=>c.profileId===state.selectedId)??-1,epoch=storyEpoch;
    active.session.pause();if(!story||index<0||index+1>=story.chapters.length)stopStory();else{storyWaiting=true;void selectProfile(story.chapters[index+1].profileId,epoch);}
   }else if(!nativeReady()){active.session.pause();storyWaiting=true;lastTime=undefined;clock=new FixedStepClock(state.tickRate);}
   else if(storyWaiting){storyWaiting=false;active.session.play();lastTime=undefined;clock=new FixedStepClock(state.tickRate);}
  }
  if(active){let count=0;if(active.session.playing&&lastTime!==undefined)count=clock.advance(now-lastTime);if(count)active.session.advance(count);else active.engine.renderSnapshot();read();update();}
 }lastTime=now;}catch(error){reject(error);lastTime=undefined;}rafId=raf(frame);}
 function dispose(){if(disposed)return;stopStory();disposed=true;generation++;caf(rafId);clear();window.removeEventListener('resize',resize);window.removeEventListener('error',fatal);window.removeEventListener('unhandledrejection',fatal);window.removeEventListener('pagehide',onPageHide);if(console.warn===warn)console.warn=oldWarn;if(console.error===error)console.error=oldError;mounted();}
 rafId=raf(frame);
 try{const response=await fetcher('/driver/profiles.json');if(!response.ok)throw Error('本机场景配置读取失败');const data=await response.json();if(data.version!==1||!Array.isArray(data.profiles)||data.profiles.length<1)throw Error('场景列表格式无效');profiles=data.profiles;story=validateDriverStory(data.story,profiles.map(p=>p.id));if(disposed)return{dispose,selectProfile,state};state.profiles=profiles.map(({id,label,description})=>({id,label,description}));await selectProfile(story?.chapters[0].profileId??profiles[0].id);}catch(error){if(!disposed)reject(error);}
 return{dispose,selectProfile,get state(){return structuredClone(state);}};
}
if(typeof document!=='undefined'&&document.documentElement.dataset.motionDriver==='true'){const root=document.getElementById('root');if(root)void bootDriverWorkbench(root).catch(error=>console.error('[driver-workbench]',error));}
