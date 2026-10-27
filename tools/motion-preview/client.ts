import { mountUI, apolloOnyx, validateLayoutNode } from '../../src/ui/components/index.js';
import { Engine } from '../../src/runtime/engine.js';
import { ThreeRenderer } from '../../src/renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '../../src/assets/index.js';
import { frameSkin } from './framing.js';
import { buildPreview, previewClips, previewSkins, type PreviewState, type PreviewRow } from './layout.js';
interface Row extends PreviewRow { id: string; file: string; hipHeight?: number; sha256?: string; fps: number; frames: number; loop: boolean; }
const catalog = await fetch('/catalog.json').then(r=>{if(!r.ok)throw new Error('目录读取失败');return r.json();});
const state: PreviewState = {...catalog,query:'',category:'',emotion:'',page:0,paused:false,message:'',skinIds:[catalog.skins[0]?.id || '',catalog.skins[1]?.id || '']};
const boundsCache=new Map<string,Promise<unknown>>();
function skinBounds(skin:Row):Promise<unknown> {
  const key=skin.id+':'+skin.sha256;
  let pending=boundsCache.get(key);
  if(!pending){pending=fetch('/skin-bounds/'+skin.id).then(async response=>{
    if(!response.ok)throw new Error('角色边界读取失败');
    const data=await response.json();if(data.id!==skin.id||data.sha256!==skin.sha256)throw new Error('角色边界与素材不一致');return data.bounds;
  }).catch(error=>{boundsCache.delete(key);throw error;});boundsCache.set(key,pending);}
  return pending;
}
const root = document.getElementById('root')!;
let cleanup: (()=>void)[] = [], generation = 0;
function drain(): void {
  for(const release of cleanup.splice(0).reverse()) {
    try { release(); } catch(error) { console.error('[motion-preview] reject cleanup',error); }
  }
}
async function render(): Promise<void> {
  const current = ++generation;
  drain();
  const tree = buildPreview(state), issues=validateLayoutNode(tree);
  if(issues.length)throw new Error(JSON.stringify(issues));
  const change=(key:'query'|'category'|'emotion')=>(value?:string)=>{state[key]=value || '';state.page=0;void render();};
  const selectSkin=(index:0|1)=>(value?:string)=>{
    if(value&&!state.skins.some(skin=>skin.id===value))return;
    const ids:[string,string]=state.skinIds?[...state.skinIds]:[state.skins[0]?.id || '',state.skins[1]?.id || ''];
    ids[index]=value || '';state.skinIds=ids;void render();
  };
  const mounted=mountUI(root,tree,{'skin-first':selectSkin(0),'skin-second':selectSkin(1),query:change('query'),category:change('category'),emotion:change('emotion'),previous:()=>{state.page--;void render();},next:()=>{state.page++;void render();},pause:()=>{state.paused=!state.paused;void render();}},apolloOnyx);
  cleanup.push(mounted);
  for(const [s,skin] of (previewSkins(state) as Row[]).entries())for(const [c,clip] of previewClips(state).slice(state.page*3,state.page*3+3).entries()) {
    const container=root.querySelector<HTMLElement>(`#stage-${s}-${c}`)!;
    const assets=new AssetManager(new ModelAssetLoader());
    let engine: Engine | undefined, renderer: ThreeRenderer | undefined, released=false;
    const release=()=>{
      if(released)return; released=true;
      try { engine?.stop(); } finally { try { renderer?.destroy(); } finally { assets.clear(); } }
    };
    cleanup.push(release);
    try {
    assets.registerManifest([{kind:'model',key:'skin',src:`/assets/${skin.file}`},{kind:'skeletal-animation',key:'motion',src:`/assets/${(clip as Row).file}`,skeleton:'apollo-humanoid-v1',fps:(clip as Row).fps,frames:(clip as Row).frames,loop:(clip as Row).loop}]);
      const [,bounds]=await Promise.all([assets.loadAll(),skinBounds(skin)]); if(current!==generation){release();return;}
      engine=new Engine({tickRate:60});
      const scale=1/(skin.hipHeight || 1);
      const camera=frameSkin(bounds,scale,Math.max(240,container.clientWidth)/260);
      engine.load({capabilities:[],entities:{
        camera:{Camera3D:camera},
        sun:{Light3D:{kind:'directional',color:0xfff1d6,intensity:2}},fill:{Light3D:{kind:'ambient',color:0xffffff,intensity:1}},
        actor:{Transform3D:{x:0,y:0,z:0},Model3D:{modelKey:'skin',scale},AnimGraph3D:{clips:{motion:{asset:'motion',clip:clip.id,retarget:'humanoid',loop:true,speed:state.paused?0:1}},states:{play:{clip:'motion'}},transitions:[],params:{speed:'speed'}}},
      }});
      renderer=new ThreeRenderer({width:Math.max(240,container.clientWidth),height:260,background:0x111923,assets});
      engine.attachRenderer(renderer,container);engine.start();
    } catch(error) {release();if(current!==generation)return;console.error('[motion-preview] reject',skin.id,clip.id,error);state.message=String(error);mounted.update(buildPreview(state));}
  }
}
window.addEventListener('pagehide',()=>{generation++;drain();},{once:true});
await render();
