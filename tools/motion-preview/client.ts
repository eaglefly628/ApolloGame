import { motionPreviewTheme } from './theme.js';
import { mountUI, validateLayoutNode, type MountHandle } from '../../src/ui/components/index.js';
import { Engine } from '../../src/runtime/engine.js';
import { ThreeRenderer } from '../../src/renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '../../src/assets/index.js';
import { frameSkin } from './framing.js';
import { buildPreview, previewClips, previewSkins, selectedPreviewClip, type PreviewState, type PreviewRow } from './layout.js';
interface Row extends PreviewRow { file: string; hipHeight?: number; sha256?: string; fps: number; frames: number; loop: boolean; }
const API_BASE=location.pathname?.startsWith('/library/')?'/library':'';
const requestedClip=new URLSearchParams(location.search).get('clip');
const catalog = await fetch(API_BASE+'/catalog.json').then(r=>{if(!r.ok)throw new Error('目录读取失败');return r.json();});
const root = document.getElementById('root')!;
const defaultSkin = (name:string,fallback:number):string => catalog.skins.find((skin:Row)=>skin.source?.mixamoName===name)?.id || catalog.skins[fallback]?.id || '';
const state: PreviewState = {...catalog,query:'',category:'',emotion:'',page:0,paused:false,message:'',viewportWidth:root.clientWidth || 1280,skinIds:[defaultSkin('Y Bot',0),defaultSkin('X Bot',1)]};
const boundsCache=new Map<string,Promise<unknown>>();
function skinBounds(skin:Row):Promise<unknown> {
  const key=skin.id+':'+skin.sha256;
  let pending=boundsCache.get(key);
  if(!pending){pending=fetch(API_BASE+'/skin-bounds/'+skin.id).then(async response=>{
    if(!response.ok)throw new Error('角色边界读取失败');
    const data=await response.json();if(data.id!==skin.id||data.sha256!==skin.sha256)throw new Error('角色边界与素材不一致');return data.bounds;
  }).catch(error=>{boundsCache.delete(key);throw error;});boundsCache.set(key,pending);}
  return pending;
}
let cleanup: (()=>void)[] = [], generation = 0, playbackKey = '', mounted: MountHandle;
const activeEngines = new Set<Engine>();
function drain(): void {
  for(const release of cleanup.splice(0).reverse()) {
    try { release(); } catch(error) { console.error('[motion-preview] reject cleanup',error); }
  }
}
function tree() {
  const data = buildPreview(state);if(API_BASE)data.children?.unshift({id:'workbench-home',type:'Button',props:{label:'返回动画工作台',action:'workbench-home'}});const issues=validateLayoutNode(data);
  if(issues.length)throw new Error(JSON.stringify(issues));
  return data;
}
async function syncPlayback(force=false): Promise<void> {
  const clip=selectedPreviewClip(state) as Row | undefined, skins=previewSkins(state) as Row[];
  const key=JSON.stringify([clip?.id,clip?.sha256,skins.map(skin=>[skin.id,skin.sha256]),(state.viewportWidth || 1280)>=1100]);
  if(!force&&key===playbackKey)return;
  playbackKey=key;const current=++generation;drain();
  if(!clip)return;
  let failed=false;
  for(const [s,skin] of skins.entries()) {
    const container=root.querySelector<HTMLElement>(`#stage-${s}-0`)!;
    const assets=new AssetManager(new ModelAssetLoader());
    let engine:Engine|undefined,renderer:ThreeRenderer|undefined,released=false;
    const release=()=>{if(released)return;released=true;try{if(engine){activeEngines.delete(engine);engine.stop();}}finally{try{renderer?.destroy();}finally{assets.clear();}}};
    cleanup.push(release);
    try {
      assets.registerManifest([{kind:'model',key:'skin',src:`${API_BASE}/assets/${skin.file}`},{kind:'skeletal-animation',key:'motion',src:`${API_BASE}/assets/${clip.file}`,skeleton:'apollo-humanoid-v1',fps:clip.fps,frames:clip.frames,loop:clip.loop}]);
      const [,bounds]=await Promise.all([assets.loadAll(),skinBounds(skin)]);if(current!==generation){release();return;}
      engine=new Engine({tickRate:60});const scale=1/(skin.hipHeight || 1),width=Math.max(200,container.clientWidth);
      engine.load({capabilities:[],entities:{
        camera:{Camera3D:frameSkin(bounds,scale,width/300)},
        sun:{Light3D:{kind:'directional',color:0xfff1d6,intensity:2}},fill:{Light3D:{kind:'ambient',color:0xffffff,intensity:1}},
        actor:{Transform3D:{x:0,y:0,z:0},Model3D:{modelKey:'skin',scale},AnimGraph3D:{clips:{motion:{asset:'motion',clip:clip.id,retarget:'humanoid',loop:true,speed:1}},states:{play:{clip:'motion'}},transitions:[],params:{speed:'speed'}}},
      }});
      renderer=new ThreeRenderer({width,height:300,background:0x111923,assets});engine.attachRenderer(renderer,container);activeEngines.add(engine);if(!state.paused)engine.start();
    }catch(error){release();if(current!==generation)return;failed=true;console.error('[motion-preview] reject',skin.id,clip.id,error);state.message=String(error);mounted.update(tree());}
  }
  if(current!==generation)return;
  if(failed)playbackKey='';
  else if(skins.length&&state.message){state.message='';mounted.update(tree());}
}
function refresh():void {
  state.selectedId=selectedPreviewClip(state)?.id || '';mounted.update(tree());void syncPlayback();
}
const change=(key:'query'|'category')=>(value?:string)=>{state[key]=value || '';refresh();};
const selectSkin=(index:0|1)=>(value?:string)=>{
  if(value&&!state.skins.some(skin=>skin.id===value))return;
  const ids:[string,string]=state.skinIds?[...state.skinIds]:[defaultSkin('Y Bot',0),defaultSkin('X Bot',1)];ids[index]=value || '';state.skinIds=ids;refresh();
};
const adjacent=(delta:number)=>{const matching=previewClips(state),at=matching.findIndex(row=>row.id===selectedPreviewClip(state)?.id),next=matching[at+delta];if(next){state.selectedId=next.id;refresh();}};
const handlers={
  'workbench-home':()=>location.assign('/'),
  'skin-first':selectSkin(0),'skin-second':selectSkin(1),query:change('query'),category:change('category'),
  'select-clip':(id?:string)=>{if(id&&previewClips(state).some(clip=>clip.id===id)){state.selectedId=id;refresh();}},
  previous:()=>adjacent(-1),next:()=>adjacent(1),pause:()=>{state.paused=!state.paused;for(const engine of activeEngines){if(state.paused)engine.stop();else engine.start();}mounted.update(tree());},
};
state.selectedId=catalog.clips.some((clip:Row)=>clip.id===requestedClip)?requestedClip!:selectedPreviewClip(state)?.id || '';mounted=mountUI(root,tree(),handlers,motionPreviewTheme(new URLSearchParams(location.search).has('daylight')));
const onResize=()=>{const before=(state.viewportWidth || 1280)>=1100;state.viewportWidth=root.clientWidth || 1280;const after=state.viewportWidth>=1100;if(before!==after){mounted.update(tree());void syncPlayback(true);}};
window.addEventListener('resize',onResize);
window.addEventListener('pagehide',()=>{generation++;drain();mounted();},{once:true});
await syncPlayback();
