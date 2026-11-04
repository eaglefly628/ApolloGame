// @vitest-environment happy-dom
import {it,expect,vi,beforeEach,afterEach} from 'vitest';
const h=vi.hoisted(()=>({engines:[] as any[],assets:[] as any[],renderers:[] as any[],sessions:[] as any[],handlers:{} as any,mounts:[] as any[],pending:false}));
vi.mock('../../src/ui/components/index.js',()=>({mountUI:(_root:any,tree:any,handlers:any,theme:any)=>{h.handlers=handlers;const dispose=vi.fn() as any;dispose.update=vi.fn();h.mounts.push({tree,handlers,theme,dispose});return dispose;}}));
vi.mock('../../src/assets/index.js',()=>({ModelAssetLoader:class{},AssetManager:class{clear=vi.fn();registerManifest=vi.fn();resolve!:()=>void;constructor(){h.assets.push(this);}loadAll(){return h.pending?new Promise<void>(r=>{this.resolve=r;}):Promise.resolve();}}}));
vi.mock('../../src/assembly/manifest.js',()=>({parseManifest:(v:unknown)=>v}));
vi.mock('../../src/runtime/engine.js',()=>({Engine:class{world={snapshot:()=>({actor:{AnimationDriverPlayback3D:{state:'idle',weights:{idle:1},events:[]}}})};stop=vi.fn();start=vi.fn();load=vi.fn();renderSnapshot=vi.fn();attachRenderer=vi.fn();constructor(){h.engines.push(this);}}}));
vi.mock('../../src/renderer/three-renderer.js',()=>({ThreeRenderer:class{destroy=vi.fn();resize=vi.fn();readStats=()=>({models:1});getAnimationDiagnostics=vi.fn(()=>[{entityId:'actor',kind:'base',status:'ready'}]);constructor(){h.renderers.push(this);}}}));
vi.mock('../../src/runtime/cinematic-preview.js',()=>({CinematicPreviewSession:class{frame=-1;playing=false;step=vi.fn(()=>this.frame++);seek=vi.fn((f:number)=>{this.frame=f;});advance=vi.fn((n:number)=>{this.frame+=n;});play=vi.fn(()=>{this.playing=true;});pause=vi.fn(()=>{this.playing=false;});constructor(){h.sessions.push(this);}}}));
import {bootDriverWorkbench} from './driver-client.js';
let root:HTMLElement,callbacks:FrameRequestCallback[],disposers:(()=>void)[]=[];
const profiles=[{id:'a',label:'A',description:'数值候选A',status:'numeric-candidate',manifest:{entities:{}},program:{tickRate:30,durationFrames:180},assets:[]},{id:'b',label:'B',description:'数值候选B',status:'numeric-candidate',manifest:{entities:{}},program:{tickRate:30,durationFrames:180},assets:[]}];
const options=(story?:unknown)=>({captureConsole:false,fetcher:vi.fn(async()=>({ok:true,json:async()=>({version:1,profiles,...(story?{story}:{})})})) as any,requestFrame:((f:FrameRequestCallback)=>{callbacks.push(f);return callbacks.length;}) as typeof requestAnimationFrame,cancelFrame:vi.fn()});
beforeEach(()=>{h.engines.length=h.assets.length=h.renderers.length=h.sessions.length=h.mounts.length=0;h.pending=false;callbacks=[];root=document.createElement('div');root.innerHTML='<div id="driver-stage"></div>';document.body.appendChild(root);});
afterEach(()=>{for(const d of disposers.splice(0))d();root.remove();});
it('waits for asset ready before loading, routes buttons through one session and never starts Engine RAF',async()=>{const client=await bootDriverWorkbench(root,options());disposers.push(client.dispose);expect(h.engines[0].load).toHaveBeenCalledOnce();expect(h.sessions[0].seek).toHaveBeenCalledWith(0);expect(h.renderers[0].getAnimationDiagnostics).toHaveBeenCalled();expect(client.state.nativeSummary).toContain('基础就绪');h.handlers.play();callbacks.shift()!(0);callbacks.shift()!(110);expect(h.sessions[0].advance).toHaveBeenCalledWith(3);expect(h.engines[0].start).not.toHaveBeenCalled();h.handlers.pause();h.handlers.step();expect(h.sessions[0].step).toHaveBeenCalledOnce();h.handlers['frame-input']('42');h.handlers.seek();expect(h.sessions[0].seek).toHaveBeenLastCalledWith(42);});
it('profile switch creates a fresh Engine and cleanup is idempotent',async()=>{const client=await bootDriverWorkbench(root,options());disposers.push(client.dispose);await client.selectProfile('b');expect(h.engines).toHaveLength(2);expect(h.renderers[0].destroy).toHaveBeenCalledOnce();expect(h.assets[0].clear).toHaveBeenCalledOnce();client.dispose();client.dispose();expect(h.renderers[1].destroy).toHaveBeenCalledOnce();expect(h.assets[1].clear).toHaveBeenCalledOnce();});
it('superseded and unloaded pending loads never create or commit a late Engine',async()=>{h.pending=true;const pending=bootDriverWorkbench(root,options());await vi.waitFor(()=>expect(h.assets).toHaveLength(1));h.handlers.profile('b');await vi.waitFor(()=>expect(h.assets).toHaveLength(2));h.assets[1].resolve();await vi.waitFor(()=>expect(h.engines).toHaveLength(1));h.assets[0].resolve();const client=await pending;disposers.push(client.dispose);expect(h.engines).toHaveLength(1);expect(client.state.selectedId).toBe('b');await client.selectProfile('missing');const late=client.selectProfile('a');await vi.waitFor(()=>expect(h.assets).toHaveLength(3));client.dispose();h.assets[2].resolve();await late;expect(h.engines).toHaveLength(1);});
it('surfaces invalid seek/frame errors and pauses instead of silently continuing',async()=>{const client=await bootDriverWorkbench(root,options());disposers.push(client.dispose);h.handlers['frame-input']('999');h.handlers.seek();expect(client.state.message).toContain('帧位置');expect(h.sessions[0].pause).toHaveBeenCalled();});

it('cached native loading keeps snapshot rendering alive; rejection is visible despite model and sim PB',async()=>{const client=await bootDriverWorkbench(root,options());disposers.push(client.dispose);h.renderers[0].getAnimationDiagnostics.mockReturnValue([{entityId:'actor',kind:'root',status:'loading',reason:'awaiting paired SHA'}]);callbacks.shift()!(0);expect(client.state.nativeSummary).toContain('根运动装载中');expect(h.engines[0].renderSnapshot).toHaveBeenCalled();expect(client.state.actors[0].native).not.toContain('就绪');h.renderers[0].getAnimationDiagnostics.mockReturnValue([{entityId:'actor',kind:'root',status:'rejected',reason:'source SHA mismatch'}]);callbacks.shift()!(16);expect(client.state.message).toContain('动作不兼容');expect(client.state.actors[0].rejections).toContain('根运动动作不兼容');expect(client.state.diagnostics.join()).toContain('source SHA mismatch');expect(h.sessions[0].pause).toHaveBeenCalled();});

const story=()=>({title:'童话',chapters:[{profileId:'a',title:'雪夜',narration:'她走近街角。',delivery:'animation'},{profileId:'b',title:'幻象',narration:'炉火亮起。',delivery:'video-planned'}]});
const flush=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};
it('story advances only after native readiness, moves exactly once to the next chapter and stops at the last',async()=>{
 const client=await bootDriverWorkbench(root,options(story()));disposers.push(client.dispose);
 h.renderers[0].getAnimationDiagnostics.mockReturnValue([{entityId:'actor',kind:'base',status:'loading'}]);
 h.handlers['story-play']();callbacks.shift()!(0);callbacks.shift()!(1000);
 expect(h.sessions[0].advance).not.toHaveBeenCalled();expect(h.engines[0].renderSnapshot).toHaveBeenCalled();expect(client.state.storyWaiting).toBe(true);
 h.renderers[0].getAnimationDiagnostics.mockReturnValue([{entityId:'actor',kind:'base',status:'ready'}]);callbacks.shift()!(2000);callbacks.shift()!(2110);
 expect(h.sessions[0].play).toHaveBeenCalledOnce();expect(h.sessions[0].advance).toHaveBeenCalledWith(3);
 h.sessions[0].frame=180;callbacks.shift()!(2200);await flush();
 expect(h.engines).toHaveLength(2);expect(client.state.selectedId).toBe('b');expect(client.state.storyPlaying).toBe(true);expect(client.state.storyWaiting).toBe(true);
 callbacks.shift()!(2300);expect(h.sessions[1].play).toHaveBeenCalledOnce();h.sessions[1].frame=180;callbacks.shift()!(2400);callbacks.shift()!(2500);await flush();
 expect(h.engines).toHaveLength(2);expect(client.state.storyPlaying).toBe(false);expect(h.sessions[1].pause).toHaveBeenCalled();
});
it('pause cancels queued chapter auto-play while a new profile is loading',async()=>{
 const client=await bootDriverWorkbench(root,options(story()));disposers.push(client.dispose);h.handlers['story-play']();callbacks.shift()!(0);
 h.pending=true;h.sessions[0].frame=180;callbacks.shift()!(100);expect(h.assets).toHaveLength(2);h.handlers.pause();h.assets[1].resolve();await flush();callbacks.shift()!(200);
 expect(client.state.storyPlaying).toBe(false);expect(h.sessions[1].play).not.toHaveBeenCalled();
});
it('manual profile selection, seek and rejection cancel story continuation',async()=>{
 const client=await bootDriverWorkbench(root,options(story()));disposers.push(client.dispose);h.handlers['story-play']();callbacks.shift()!(0);await client.selectProfile('b');expect(client.state.storyPlaying).toBe(false);
 h.handlers['story-play']();callbacks.shift()!(100);h.handlers['frame-input']('10');h.handlers.seek();expect(client.state.storyPlaying).toBe(false);
 h.handlers['story-play']();h.renderers[1].getAnimationDiagnostics.mockReturnValue([{entityId:'actor',kind:'base',status:'rejected',reason:'bad asset'}]);callbacks.shift()!(200);
 expect(client.state.storyPlaying).toBe(false);expect(client.state.message).toContain('不兼容');const playCalls=h.sessions[1].play.mock.calls.length;h.renderers[1].getAnimationDiagnostics.mockReturnValue([{entityId:'actor',kind:'base',status:'ready'}]);callbacks.shift()!(300);expect(h.sessions[1].play).toHaveBeenCalledTimes(playCalls);
});
it('requires every declared native channel rather than accepting model count or a partial ready list',async()=>{
 const original=profiles[0].manifest;profiles[0].manifest={entities:{actor:{AnimationDriver3D:{},RootMotion3D:{},AnimationPerformance3D:{}}}} as any;
 try{const client=await bootDriverWorkbench(root,options(story()));disposers.push(client.dispose);h.handlers['story-play']();callbacks.shift()!(0);expect(h.sessions[0].play).not.toHaveBeenCalled();
 h.renderers[0].getAnimationDiagnostics.mockReturnValue(['base','root','performance'].map(kind=>({entityId:'actor',kind,status:'ready'})));callbacks.shift()!(100);expect(h.sessions[0].play).toHaveBeenCalledOnce();}finally{profiles[0].manifest=original;}
});
it('story navigation stays inside chapter bounds and disposal cancels a pending automatic load',async()=>{
 const client=await bootDriverWorkbench(root,options(story()));disposers.push(client.dispose);h.handlers['story-previous']();expect(h.engines).toHaveLength(1);h.handlers['story-next']();await flush();expect(client.state.selectedId).toBe('b');h.handlers['story-next']();expect(h.engines).toHaveLength(2);
 h.handlers['story-play']();callbacks.shift()!(0);h.pending=true;h.handlers['story-previous']();expect(h.assets).toHaveLength(3);client.dispose();h.assets[2].resolve();await flush();expect(h.engines).toHaveLength(2);expect(client.state.storyPlaying).toBe(false);
});
