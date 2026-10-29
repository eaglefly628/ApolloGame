import {runtimeSocketProfile,socketControlData,socketAnimationGraph,type RuntimeSocketProfile} from './runtime-controls.js';
import type {AnimGraph3D} from '../../src/engine/protocol/components.js';
import {primeEmbeddedPreview} from './paused-frame.js';
import { mountUI, validateLayoutNode, type LayoutNode } from '../../src/ui/components/index.js';
import { motionPreviewTheme } from '../motion-preview/theme.js';
import { frameSkin, type SkinBounds } from '../motion-preview/framing.js';
import { Engine } from '../../src/runtime/engine.js';
import { ThreeRenderer } from '../../src/renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '../../src/assets/index.js';
interface Skin {id:string;file:string;sha256:string;hipHeight:number;source?:{mixamoName?:string}}
interface Clip {id:string;file:string;fps:number;frames:number;loop:boolean;descZh?:string}
interface Catalog {skins:Skin[];clips:Clip[]}
interface ReviewProp {id:string;bone:'LeftHand'|'RightHand'|'LeftGripSocket'|'RightGripSocket'|'LeftHandContactSocket'|'RightHandMatchHeadSocket';offset:[number,number,number];rot:[number,number,number];size:[number,number,number];color?:number}
const root=document.getElementById('root');if(!root)throw new Error('Missing preview root');
const API_BASE=location.pathname.startsWith('/interaction/')?'/interaction':'';
const viewColumns=(root.clientWidth || window.innerWidth)<800?1:2;
let benchmarkSkinName='Y Bot',selectedSkinId='',skinOptions:{value:string;label:string}[]=[],loadGeneration=0;
let paused=false,message='正在加载本机验证候选…',summary:string[]=[],candidate='',disposed=false;
const engines:Engine[]=[],release:(()=>void)[]=[];
const newPausedGraphs=new Set<Engine>();
let selectedRuntime:RuntimeSocketProfile|undefined,runtimeEnabled=true,interactionActive=true,boxShift:[number,number,number]=[0,0,0];
const runtimeViews=new Map<Engine,{profile:RuntimeSocketProfile;scale:number;headWeight:number}>();
function moveBox(dx:number,dy:number):void{if(paused||!interactionActive||!selectedRuntime)return;boxShift=[Math.max(-.075,Math.min(.075,boxShift[0]+dx)),Math.max(-.075,Math.min(.075,boxShift[1]+dy)),0];applySocketControls();}
function applySocketControls():void{for(const [engine,state] of runtimeViews){const data=socketControlData(state.profile,state.scale,boxShift,runtimeEnabled,state.headWeight,interactionActive);engine.world.addComponent('SocketLeftHandMover',data.target);engine.world.addComponent('actor',data.ik);engine.world.addComponent('SocketInteractionMode',{type:'Flag',id:'socket-interacting',active:interactionActive});}console.debug('[socket-preview] control',runtimeEnabled,boxShift);mounted.update(layout());}
function resume(engine:Engine):void{if(newPausedGraphs.delete(engine)){const graph=engine.world.getComponent<AnimGraph3D>('actor','AnimGraph3D');if(!graph?.clips.motion)throw new Error('预览动作图缺失');engine.world.addComponent('actor',{...graph,clips:{...graph.clips,motion:{...graph.clips.motion,speed:1}}});}engine.start();}
const label=(id:string,text:string):LayoutNode=>({id,type:'Label',props:{text,color:'text'}});
function layout():LayoutNode {
  const tree:LayoutNode={id:'mink-preview',type:'Screen',props:{bg:'panel'},layout:{direction:'column',gap:14,padding:16,maxWidth:1600},children:[
    ...(API_BASE?[{id:'workbench-home',type:'Button' as const,props:{label:'返回动画工作台',action:'workbench-home'}}]:[]),
    {id:'title',type:'Label',props:{text:selectedRuntime?'手持道具 · 实时 Socket IK':'Mink 离线候选验证',font:'epic',size:28,color:'text'}},
    label('review-warning','本地候选；几何、表意与换Skin检查分别记录。'),
    {id:'select-skin',type:'Dropdown',props:{value:selectedSkinId,options:skinOptions,action:'select-skin'}},
    label('skin-scope',selectedRuntime?'当前角色使用独立握持 Socket；接触由运行时 IK 求解，手型与穿插仍需单独验收。':`切换Skin只重定向同一段动画；离线指标属于${benchmarkSkinName}基准，其它角色仍需单独核对，手指未独立校准。`),
    label('candidate',candidate?`候选 ID：${candidate}`:'只读取指定的本机 review library'),
    {id:'pause',type:'Button',props:{label:paused?'继续播放':'暂停播放',action:'pause',kind:'primary'}},
    label('loading-message',message),
    ...(selectedRuntime?[label('socket-experiment',`实时 Socket 交互：盒子左右 ${Math.round(boxShift[0]*100)} cm / 上下 ${Math.round(boxShift[1]*100)} cm；播放时可移动，右手实时追随。`),{id:'socket-controls',type:'Panel' as const,props:{bare:true},layout:{direction:'grid' as const,cols:viewColumns===1?3:6,gap:6},children:[{id:'socket-interact',type:'Button' as const,props:{label:interactionActive?'退出交互':'进入交互',action:'socket-interact',disabled:paused}},{id:'socket-left',type:'Button' as const,props:{label:'盒子 ←',action:'box-left',disabled:paused}},{id:'socket-right',type:'Button' as const,props:{label:'盒子 →',action:'box-right',disabled:paused}},{id:'socket-up',type:'Button' as const,props:{label:'盒子 ↑',action:'box-up',disabled:paused}},{id:'socket-down',type:'Button' as const,props:{label:'盒子 ↓',action:'box-down',disabled:paused}},{id:'socket-reset',type:'Button' as const,props:{label:'复位',action:'box-reset',disabled:paused}},{id:'socket-toggle',type:'Button' as const,props:{label:runtimeEnabled?'实时 IK：开':'实时 IK：关',action:'socket-toggle',disabled:paused}}]}]:[]),
    {id:'views',type:'Panel',props:{bare:true},layout:{direction:'grid',cols:viewColumns,gap:16},children:[
      {id:'front',type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:10,padding:12},children:[label('front-label','前方 · 上半身（观察双肘朝向与握持）'),{id:'stage-front',type:'Panel',props:{bare:true},layout:{height:520}}]},
      {id:'side',type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:10,padding:12},children:[label('side-label','侧斜方 · 上半身（观察双手与胸腹、骨盆穿插）'),{id:'stage-side',type:'Panel',props:{bare:true},layout:{height:520}}]},
    ]},
    {id:'checks',type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:8,padding:12},children:[label('checks-title',selectedRuntime?'基础动画原报告（不包含本轮实时 IK；手型与穿插未重新验收）':'离线基础检查摘要（报告记录，待视觉核对）'),...summary.map((text,index)=>label(`check-${index}`,text)),label('props-scope','道具是尺寸/接触参考；手指握持和物体接触仍待视觉验收，尚未生成火焰。')]},
  ]};
  const issues=validateLayoutNode(tree);if(issues.length)throw new Error(JSON.stringify(issues));return tree;
}
const mounted=mountUI(root,layout(),{'workbench-home':()=>location.assign('/'),'socket-interact':()=>{if(paused)return;interactionActive=!interactionActive;applySocketControls();},'box-left':()=>moveBox(-.025,0),'box-right':()=>moveBox(.025,0),'box-up':()=>moveBox(0,.025),'box-down':()=>moveBox(0,-.025),'box-reset':()=>{if(paused)return;boxShift=[0,0,0];applySocketControls();},'socket-toggle':()=>{if(paused)return;runtimeEnabled=!runtimeEnabled;applySocketControls();},'select-skin':(id?:string)=>{if(!id||id===selectedSkinId||!skinOptions.some(option=>option.value===id))return;selectedSkinId=id;boxShift=[0,0,0];for(const dispose of release.splice(0).reverse())dispose();engines.length=0;message='正在重定向到所选角色…';mounted.update(layout());const requestedGeneration=loadGeneration+1;void load().catch(error=>rejectLoad(error,id,requestedGeneration));},pause:()=>{paused=!paused;for(const engine of engines){if(paused)engine.stop();else resume(engine);}mounted.update(layout());}},motionPreviewTheme(new URLSearchParams(location.search).has('daylight')));
const close=()=>{disposed=true;for(const dispose of release.splice(0).reverse())dispose();mounted();};
window.addEventListener('pagehide',close,{once:true});
// A breakpoint changes native stage elements; reload only on that transition. Pause never rebuilds scenes.
window.addEventListener('resize',()=>{if(((root.clientWidth || window.innerWidth)<800?1:2)!==viewColumns)location.reload();});
async function json(path:string):Promise<unknown>{const response=await fetch(API_BASE+path);if(!response.ok)throw new Error(`${path} 读取失败`);return response.json();}
function summarizeReport(value:unknown):string[]{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('验证报告不是对象');
  const object=(entry:unknown):Record<string,unknown>=>entry&&typeof entry==='object'&&!Array.isArray(entry)?entry as Record<string,unknown>:{};
  const report=object(value),summary=object(report.summary),calibration=object(summary.calibration);
  const collision=object(report.collision),surface=object(collision.originalSkinSurface);
  const number=(entry:unknown,digits=3,multiplier=1):string=>typeof entry==='number'&&Number.isFinite(entry)?(entry*multiplier).toFixed(digits):'未记录';
  const status=String(collision.status??object(report.meshCheck).status??report.meshCheck??'pending').toLowerCase();
  const failed=['fail','failed','failure','rejected'].includes(status)||(typeof surface.insideSamples==='number'&&surface.insideSamples>0);
  const passed=['pass','passed','ok'].includes(status)&&!failed;
  const skinStatus=failed?'未通过，需要检查采样结果':passed?'限定采样检查通过；仍需目视核对，不能代表所有帧、所有网格均无穿插':'尚未完成，等待原始蒙皮表面检查';
  const lines=[
    `验证批次：${typeof report.experimentId==='string'?report.experimentId.slice(0,80):'未记录'}`,
    `离线求解器：${typeof summary.backend==='string'?summary.backend:'未记录'}`,
    `10 厘米校准探针：${number(calibration.world10cmProbeM,3,100)} 厘米`,
    `骨架零姿态重建误差：${number(calibration.zeroPositionErrorM,6,1000)} 毫米`,
    `代理最小有符号间隔：${number(summary.proxyMinDistanceM,3,1000)} 毫米（负值表示代理重叠）`,
    `目标最大位置误差：${number(summary.maxTargetErrorM,3,1000)} 毫米`,
    `候选动画：${number(summary.frames,0)} 帧 · 原始蒙皮已检查：${number(collision.playbackFrames,0)} 帧`,
    `独立综合检查（含姿态与播放桥接）：${skinStatus}`,
  ];
  if(report.headFollow){const follow=object(report.headFollow);lines.push(`头部跟随：运行时 Head look-at · 权重 ${number(follow.weight,2)}；未烘焙进动画，未单独控制眼球`);}
  if(collision.sampleRateHz!==undefined)lines.push(`皮肤检查采样率：${number(collision.sampleRateHz,0)} Hz（仅代表所报采样范围）`);
  if(surface.insideSamples!==undefined)lines.push(`检测到的内部采样点：${number(surface.insideSamples,0)} 个`);
  if(surface.minimumCertifiedSeparationM!==undefined)lines.push(`本次表面检查的间隔下界：${number(surface.minimumCertifiedSeparationM,3,1000)} 毫米（限本次检查定义）`);
  const elbow=object(collision.elbowPosture);
  if(elbow.minimumBelowShoulderM!==undefined)lines.push(`肘部低于肩部的最小高度差：${number(elbow.minimumBelowShoulderM,1,100)} 厘米`);
  if(elbow.maximumAboveWristM!==undefined)lines.push(`肘部相对手腕的最大高度差：${number(elbow.maximumAboveWristM,1,100)} 厘米（负值为低于手腕）`);
  return lines;
}
function reviewProps(value:unknown):ReviewProp[]{
  const raw=(value as Record<string,unknown>).props;if(raw===undefined)return [];
  if(!Array.isArray(raw)||raw.length>4)throw new Error('道具必须为最多 4 项的数组');
  const ids=new Set<string>();
  return raw.map(entry=>{
    if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new Error('道具条目必须为对象');
    const prop=entry as Record<string,unknown>;
    if(Object.keys(prop).some(key=>!['id','bone','offset','rot','size','color'].includes(key)))throw new Error('道具包含未支持字段');
    if(typeof prop.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(prop.id)||ids.has(prop.id))throw new Error('道具 ID 非法或重复');ids.add(prop.id);
    if(!['LeftHand','RightHand','LeftGripSocket','RightGripSocket','LeftHandContactSocket','RightHandMatchHeadSocket'].includes(String(prop.bone)))throw new Error('道具只允许挂在 LeftHand/RightHand');
    for(const field of ['offset','rot','size']){
      const tuple=prop[field];if(!Array.isArray(tuple)||tuple.length!==3||!tuple.every(n=>typeof n==='number'&&Number.isFinite(n)))throw new Error(`道具 ${field} 必须为三个有限数值`);
      if(field==='size'&&tuple.some(n=>n<=0))throw new Error('道具尺寸必须大于零');
    }
    if(prop.color!==undefined&&(!Number.isInteger(prop.color)||Number(prop.color)<0||Number(prop.color)>0xffffff))throw new Error('道具颜色必须为 24 位颜色整数');
    return prop as unknown as ReviewProp;
  });
}
async function load():Promise<void>{
  const generation=++loadGeneration;
  const [catalog,report]=await Promise.all([json('/catalog.json') as Promise<Catalog>,json('/validation.json')]);
  if(disposed||generation!==loadGeneration)return;
  if(!catalog.skins.length||!catalog.clips.length)throw new Error('Mink 验证预览要求至少 1 个角色、1 个候选动作');
  const socketReport=report as {runtimeSockets?:{bySkin?:Record<string,{validationStatus?:string}>,unsupportedBySkin?:Record<string,{clipId:string;reason:string;statusLabel?:string;skinBounds:SkinBounds}>}};
  skinOptions=catalog.skins.map(row=>({value:row.id,label:(row.source?.mixamoName||row.id)+(socketReport.runtimeSockets?.unsupportedBySkin?.[row.id]?' · 仅基础播放':socketReport.runtimeSockets?.bySkin?.[row.id]?.validationStatus==='fail'?' · 交互未通过':'')}));
  const requestedSkin=new URLSearchParams(location.search).get('skin');
  if(!selectedSkinId)selectedSkinId=catalog.skins.some(row=>row.id===requestedSkin)?requestedSkin!:catalog.skins.find(row=>row.source?.mixamoName==='Claire')?.id||catalog.skins[0].id;
  if(report&&typeof report==='object'&&'sourceSkinName' in report&&typeof report.sourceSkinName==='string')benchmarkSkinName=report.sourceSkinName.slice(0,80);
  const skin=catalog.skins.find(row=>row.id===selectedSkinId)!;selectedRuntime=runtimeSocketProfile(report,skin);const unsupported=socketReport.runtimeSockets?.unsupportedBySkin?.[skin.id];const clip=selectedRuntime?catalog.clips.find(row=>row.id===selectedRuntime!.clipId):unsupported?catalog.clips.find(row=>row.id===unsupported.clipId):catalog.clips[0];if(!clip)throw new Error('Socket 角色动作缺失');candidate=clip.id+(report&&typeof report==='object'&&'experimentId' in report&&typeof report.experimentId==='string'?' · '+report.experimentId.slice(0,80):'');summary=summarizeReport(report);if(selectedRuntime?.statusLabel)summary.unshift(selectedRuntime.statusLabel);if(unsupported)summary.unshift('此角色仅基础播放：'+unsupported.reason);const props=reviewProps(selectedRuntime?{props:selectedRuntime.props}:unsupported?{props:[]}:report);const follow=unsupported?undefined:(report as {headFollow?:{bone:string;targetProp:string;weight:number}}).headFollow;if(follow&&!(follow.bone==='Head'&&follow.targetProp==='match-head'&&typeof follow.weight==='number'&&Number.isFinite(follow.weight)&&follow.weight>=0&&follow.weight<=.25&&props.some(p=>p.id==='match-head')))throw new Error('头部跟随配置非法');summary.push(`尺寸/接触参考道具：${props.length} 件（已换算的骨局部单位）`);mounted.update(layout());
  if(!Number.isFinite(skin.hipHeight)||skin.hipHeight<=0)throw new Error('角色 hipHeight 非法');
  const boundsData=selectedRuntime?{id:skin.id,sha256:skin.sha256,bounds:selectedRuntime.skinBounds}:unsupported?{id:skin.id,sha256:skin.sha256,bounds:unsupported.skinBounds}:await json('/skin-bounds/'+skin.id) as {id:string;sha256:string;bounds:SkinBounds};
  if(disposed||generation!==loadGeneration)return;
  if(boundsData.id!==skin.id||boundsData.sha256!==skin.sha256)throw new Error('角色边界与素材 SHA 不一致');
  const scale=1/skin.hipHeight;
  // Normalization is a Model3D render scale only. The source model/clip is never rebaked here.
  for(const view of ['front','side']){
    const assets=new AssetManager(new ModelAssetLoader());let engine:Engine|undefined,renderer:ThreeRenderer|undefined,released=false;
    const dispose=()=>{if(released)return;released=true;try{if(engine){newPausedGraphs.delete(engine);runtimeViews.delete(engine);}engine?.stop();}finally{try{renderer?.destroy();}finally{assets.clear();}}};release.push(dispose);
    assets.registerManifest([{kind:'model',key:'skin',src:API_BASE+'/embedded-skin/'+skin.id}]);
    await assets.loadAll();if(disposed||generation!==loadGeneration){dispose();return;}
    const container=root!.querySelector<HTMLElement>('#stage-'+view)!;const width=Math.max(200,container.clientWidth);
    const full=frameSkin(boundsData.bounds,scale,width/520),height=(boundsData.bounds[1][1]-boundsData.bounds[0][1])*scale;
    if(!Number.isFinite(height)||height<.1||height>10||!Number.isFinite(.15*scale)||Math.abs(.15*scale)>10)throw new Error('角色归一化高度或近景偏移超出人体预览范围');
    const distance=height*(view==='front'?1.05:.9);
    const clipping={near:Math.max(.001,height*.005),far:distance+height*4+1};
    const camera=view==='front'?{...full,...clipping,yaw:0,pitch:.02,fov:38,distance,pivotY:boundsData.bounds[0][1]*scale+height*.7,pivotZ:.15*scale}:{...full,...clipping,yaw:1.12,pitch:.02,fov:38,distance,pivotY:boundsData.bounds[0][1]*scale+height*.7,pivotZ:.15*scale};
    // Attach3D already applies the hand's world transform. Do not multiply local offsets/sizes again.
    const propEntities=Object.fromEntries(props.map(prop=>{const color=prop.color??(prop.bone==='LeftHand'?0xd9c6a3:0xa57443);return [`prop-${prop.id}`,{Transform3D:{x:0,y:0,z:0},Mesh3D:{shape:'box',width:prop.size[0],height:prop.size[1],depth:prop.size[2],frontTint:color,backTint:color,edgeTint:color},Attach3D:{parentId:'actor',bone:prop.bone,offset:prop.offset,rot:prop.rot}}];}));
    const socketData=selectedRuntime?socketControlData(selectedRuntime,scale,boxShift,runtimeEnabled,follow?.weight??.22,interactionActive):undefined;
    engine=new Engine({tickRate:60});engine.load({capabilities:[],entities:{
      ...propEntities,...(socketData?{SocketLeftHandMover:{Transform3D:socketData.target},SocketInteractionMode:{Flag:{id:'socket-interacting',active:interactionActive}}}:{}),camera:{Camera3D:camera},sun:{Light3D:{kind:'directional',color:0xfff1d6,intensity:2}},fill:{Light3D:{kind:'ambient',color:0xffffff,intensity:1.4}},
      actor:{Transform3D:{x:0,y:0,z:0},Model3D:{modelKey:'skin',scale},AnimGraph3D:selectedRuntime?{...socketAnimationGraph(clip.id)}:{clips:{motion:{clip:clip.id,loop:true,speed:0}},states:{play:{clip:'motion'}},transitions:[],params:{speed:'speed'}},...(socketData?{IK3D:{...socketData.ik}}:follow?{IK3D:{chains:[],lookAt:{bone:'Head',target:{entity:'prop-match-head',offset:[0,0,0]},weight:follow.weight}}}:{})},
    }});
    renderer=new ThreeRenderer({width,height:520,background:0x111923,assets});engine.attachRenderer(renderer,container);if(selectedRuntime)runtimeViews.set(engine,{profile:selectedRuntime,scale,headWeight:follow?.weight??.22});
    const paint=renderer,viewSnapshot=engine.world.readView();await primeEmbeddedPreview({render:()=>paint.sync(viewSnapshot),modelCount:()=>paint.readStats().models,nextFrame:()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())),cancelled:()=>disposed||released||generation!==loadGeneration});if(disposed||released||generation!==loadGeneration){dispose();return;}newPausedGraphs.add(engine);engines.push(engine);
  }
  if(disposed||generation!==loadGeneration)return;message=`${skin.source?.mixamoName||skin.id} · ${paused?'暂停预览，等待角色与动作显示':'循环播放候选'}；可切换${catalog.skins.length}个角色，暂停核对姿态。`;mounted.update(layout());if(!paused)for(const engine of engines)resume(engine);
}
function rejectLoad(error:unknown,id=selectedSkinId,generation=loadGeneration):void{if(disposed||id!==selectedSkinId||generation!==loadGeneration)return;loadGeneration++;for(const dispose of release.splice(0).reverse())dispose();engines.length=0;console.error('[motion-mink-validation] reject',error);message=String(error);mounted.update(layout());}
const initialGeneration=loadGeneration+1;try{await load();}catch(error){rejectLoad(error,selectedSkinId,initialGeneration);}
