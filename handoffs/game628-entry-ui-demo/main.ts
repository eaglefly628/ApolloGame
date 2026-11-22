import './style.css';
import {mountUI} from '../../src/ui/components/server.js';
import {validateLayoutNode} from '../../src/ui/components/validate.js';
import {apolloBrocade} from '../../src/ui/components/apollo-kit.js';
import type {LayoutNode} from '../../src/ui/components/types.js';

type Screen = 'home'|'login'|'face'|'street';
type Overlay = 'menu'|'settings'|null;
type Prototype = {snapshot():Record<string,{Visibility?:{visible:boolean}}>; stats():{models:number}};
const entry = document.querySelector<HTMLElement>('#entry')!;
const chrome = document.querySelector<HTMLElement>('#chrome')!;
const scene = document.querySelector<HTMLElement>('#scene')!;
const preview = document.querySelector<HTMLIFrameElement>('#preview')!;
const theme = {...apolloBrocade, bg0:'#f8eee0', bg1:'#fbf1e1', bg2:'#f1dfc6', text:'#38281c', sub:'#654a36', dim:'#73533a', line:'#b7906d', jade:'#8b361f', jadeLine:'#a7462d', gold:'#803621', texture:undefined, panelTexture:undefined};
let screen:Screen='home', overlay:Overlay=null, returnTo:Screen='home';
let volume=65, hints=true, chosen='', ready=false, status='', loadId=0;
let sound:AudioContext|undefined;
let lastScene:Screen|undefined;
const label=(id:string,text:string,size=14):LayoutNode=>({type:'Label',id,props:{text,size,font:size>24?'serif':'ui',bold:size>20,color:'text'}});
const button=(id:string,text:string,kind:'primary'|'quiet'='quiet',disabled=false):LayoutNode=>({type:'Button',id,props:{label:text,kind,action:id,disabled},layout:{flex:1,minHeight:42}});
const row=(id:string,children:LayoutNode[]):LayoutNode=>({type:'Panel',id,props:{bare:true},layout:{direction:'row',gap:8},children});
const card=(id:string,children:LayoutNode[]):LayoutNode=>({type:'Panel',id,props:{edge:'gold'},layout:{direction:'column',padding:16,gap:10},children});
function tree():LayoutNode {
  if(overlay==='settings') return card('settings-card',[
    label('settings-title','设置',26),
    {type:'Slider',id:'gain',props:{label:'界面音量',min:0,max:100,step:5,value:volume,action:'gain'}},
    button('sound','试听提示音'),button('hints',`操作提示 · ${hints?'开启':'关闭'}`),
    button('return-settings','返回','primary'),
  ]);
  if(overlay==='menu') return card('menu-card',[
    label('menu-title','街坊菜单',26),button('continue','继续游戏','primary'),button('settings','设置'),button('title','返回标题'),
  ]);
  if(screen==='home')return card('home-card',[
    label('place','梧 桐 街'),label('title-text','小生活',49),label('tagline','今天，去街上走走。',16),
    button('start','开始游戏','primary'),button('guest','游客进入'),
  ]);
  if(screen==='login')return card('login-card',[
    label('login-title','模拟登录',27),label('simulation','本次试玩无需账号。',15),
    button('login-confirm','模拟登录并继续','primary'),button('guest','游客进入'),button('back','返回'),
  ]);
  if(screen==='face')return card('face-card',[
    label('face-note',status||'选一张喜欢的脸，再去梧桐街。'),
    row('face-actions',[button('back','返回'),button('confirm','确认角色','primary',!ready)]),
  ]);
  return card('street-card',[
    ...(status ? [label('scene-status',status)] : []),
    ...(hints&&ready ? [label('instructions','WASD / 方向键行走 · Esc 打开菜单')] : []),
    row('street-actions',[button('menu','菜单'),button('settings','设置')]),
  ]);
}
function runtime():Prototype|undefined {
  return (preview.contentWindow as (Window & {apolloPrototype?:Prototype})|null)?.apolloPrototype;
}
function faceId(){
  const entities=runtime()?.snapshot();
  if(!entities)return '';
  const visible=Object.entries(entities).filter(([,e])=>e.Visibility?.visible).map(([id])=>id);
  return visible.find(id=>/^face-[0-2]{4}$/.test(id))?.slice(5)??'';
}
function redraw(focus?:string){
  entry.dataset.screen=screen;
  entry.dataset.overlay=String(overlay!==null);
  scene.hidden=screen!=='face'&&screen!=='street';
  scene.inert=overlay!==null;
  const content=tree();
  const issues=validateLayoutNode(content);
  if(issues.length)throw new Error(JSON.stringify(issues));
  ui.update(content);
  if(overlay){
    chrome.setAttribute('role','dialog');
    chrome.setAttribute('aria-modal','true');
    chrome.setAttribute('aria-labelledby',overlay==='menu'?'menu-title':'settings-title');
  }else{
    for(const name of ['role','aria-modal','aria-labelledby'])chrome.removeAttribute(name);
  }
  chrome.querySelector('#gain input')?.setAttribute('aria-label','界面音量');
  if(focus)chrome.querySelector<HTMLElement>('#'+focus+(focus==='gain'?' input':'') )?.focus();
}
function loadScreen(next:Screen){
  screen=next;overlay=null;ready=false;status='';
  const token=++loadId;
  lastScene=next;
  if(next==='home'||next==='login'){
    preview.removeAttribute('src');
    redraw(next==='home'?'start':'login-confirm');
    return;
  }
  status=next==='face'?'正在准备捏脸…':'正在进入梧桐街…';
  preview.src='/prototype?scene='+(next==='face'?'face-studio':'reference-walk');
  redraw(next==='face'?'back':'menu');
  const start=performance.now();
  const check=()=>{
    if(token!==loadId)return;
    if(preview.contentWindow?.location.search===new URL(preview.src).search&&runtime()){
      ready=true;status='';redraw();
    }else if(performance.now()-start>18000){
      status='场景加载失败。请返回标题重试。';redraw();
    }else window.setTimeout(check,100);
  };
  check();
}
function key(event:KeyboardEvent){
  if(event.key==='Tab'&&overlay){
    const stops=Array.from(chrome.querySelectorAll<HTMLElement>('button:not(:disabled),input'));
    const first=stops[0],last=stops.at(-1);
    const active=document.activeElement;
    if(first&&last&&(!chrome.contains(active)||active===(event.shiftKey?first:last))){
      event.preventDefault();
      (event.shiftKey?last:first).focus();
    }
  }
  if(event.key!=='Escape')return;
  if(screen==='street'||screen==='face'||screen==='login'){
    event.preventDefault();
    if(overlay==='settings')actions['return-settings']!();
    else if(overlay==='menu')actions.continue!();
    else if(screen==='street')actions.menu!();
    else actions.back!();
  }
}
preview.addEventListener('load',()=>{
  if(!preview.hasAttribute('src'))return;
  const inside=preview.contentDocument;
  inside?.addEventListener('keydown',key,true);
  if((lastScene==='street'||lastScene==='face')&&inside){
    // Embedded street uses parent chrome for hints and navigation. The source preview is unchanged.
    const style=inside.createElement('style');
    style.textContent=lastScene==='street'
      ? '#header,#footer,#weather-controls,#performance-controls{display:none!important}'
      : '#header button{display:none!important} #header,#footer{background:#fbf1e1!important;border-color:#b7906d!important} #header span,#footer span,#footer button{color:#38281c!important} #footer button:focus-visible{outline:2px solid #a14123}';
    inside.head.append(style);
  }
});
async function chime(){
  try{
    sound??=new AudioContext();await sound.resume();
    const tone=sound.createOscillator(), gain=sound.createGain(), now=sound.currentTime;
    tone.type='sine';tone.frequency.setValueAtTime(523,now);
    gain.gain.setValueAtTime(volume/100*.13,now);gain.gain.linearRampToValueAtTime(0,now+.28);
    tone.connect(gain);gain.connect(sound.destination);tone.start(now);tone.stop(now+.3);
  }catch(error){console.warn('[628-ui] audio unavailable',error);}
}
function toFace(){returnTo=screen;loadScreen('face');}
let settingsFrom:Overlay=null;
const actions:Record<string,(arg?:string)=>void>={
  start:()=>loadScreen('login'),guest:toFace,'login-confirm':toFace,
  back:()=>loadScreen(screen==='face'?returnTo:'home'),
  confirm:()=>{
    if(!ready)return;
    chosen=faceId();
    if(!chosen){status='五官预览尚未就绪，请稍后再试。';redraw();return;}
    entry.dataset.confirmedFace=chosen;
    loadScreen('street');
  },
  menu:()=>{overlay='menu';redraw('continue');},
  continue:()=>{overlay=null;redraw();preview.focus();},
  title:()=>{chosen='';delete entry.dataset.confirmedFace;loadScreen('home');},
  settings:()=>{settingsFrom=overlay;overlay='settings';redraw('gain');},
  'return-settings':()=>{overlay=settingsFrom;redraw(overlay==='menu'?'settings':'menu');},
  gain:arg=>{const next=Number(arg);if(Number.isFinite(next)&&next>=0&&next<=100){volume=next;redraw('gain');}},
  hints:()=>{hints=!hints;redraw('hints');},
  sound:()=>void chime(),
};
const ui=mountUI(chrome,tree(),actions,theme);
redraw();
document.addEventListener('keydown',key,true);
