import { mountUI, validateLayoutNode, type LayoutNode } from '../../src/ui/components/index.js';
import { motionPreviewTheme } from '../motion-preview/theme.js';
import { frameSkin, type SkinBounds } from '../motion-preview/framing.js';
import { Engine } from '../../src/runtime/engine.js';
import { ThreeRenderer } from '../../src/renderer/three-renderer.js';
import { AssetManager, ModelAssetLoader } from '../../src/assets/index.js';
interface Skin {id:string;file:string;sha256:string;hipHeight:number;source?:{mixamoName?:string}}
interface Clip {id:string;file:string;fps:number;frames:number;loop:boolean;descZh?:string}
interface Catalog {skins:Skin[];clips:Clip[]}
interface ReviewProp {id:string;bone:'LeftHand'|'RightHand';offset:[number,number,number];rot:[number,number,number];size:[number,number,number];color?:number}
const root=document.getElementById('root');if(!root)throw new Error('Missing preview root');
const viewColumns=(root.clientWidth || window.innerWidth)<800?1:2;
let benchmarkSkinName='Y Bot',selectedSkinId='',skinOptions:{value:string;label:string}[]=[],loadGeneration=0;
let paused=false,message='正在加载本机验证候选…',summary:string[]=[],candidate='',disposed=false;
const engines:Engine[]=[],release:(()=>void)[]=[];
const label=(id:string,text:string):LayoutNode=>({id,type:'Label',props:{text,color:'text'}});
function layout():LayoutNode {
  const tree:LayoutNode={id:'mink-preview',type:'Screen',props:{bg:'panel'},layout:{direction:'column',gap:14,padding:16,maxWidth:1600},children:[
    {id:'title',type:'Label',props:{text:'Mink 离线候选验证',font:'epic',size:28,color:'text'}},
    label('review-warning','本地候选；几何、表意与换Skin检查分别记录。'),
    {id:'select-skin',type:'Dropdown',props:{value:selectedSkinId,options:skinOptions,action:'select-skin'}},
    label('skin-scope',`切换Skin只重定向同一段动画；离线指标属于${benchmarkSkinName}基准，其它角色仍需单独核对，手指未独立校准。`),
    label('candidate',candidate?`候选 ID：${candidate}`:'只读取指定的本机 review library'),
    {id:'pause',type:'Button',props:{label:paused?'继续播放':'暂停播放',action:'pause',kind:'primary'}},
    label('loading-message',message),
    {id:'views',type:'Panel',props:{bare:true},layout:{direction:'grid',cols:viewColumns,gap:16},children:[
      {id:'front',type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:10,padding:12},children:[label('front-label','前方 · 上半身（观察双肘朝向与握持）'),{id:'stage-front',type:'Panel',props:{bare:true},layout:{height:520}}]},
      {id:'side',type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:10,padding:12},children:[label('side-label','侧斜方 · 上半身（观察双手与胸腹、骨盆穿插）'),{id:'stage-side',type:'Panel',props:{bare:true},layout:{height:520}}]},
    ]},
    {id:'checks',type:'Panel',props:{bg:'panel',edge:'gold'},layout:{direction:'column',gap:8,padding:12},children:[label('checks-title','离线基础检查摘要（报告记录，待视觉核对）'),...summary.map((text,index)=>label(`check-${index}`,text)),label('props-scope','道具是尺寸/接触参考；手指握持和物体接触仍待视觉验收，尚未生成火焰。')]},
  ]};
  const issues=validateLayoutNode(tree);if(issues.length)throw new Error(JSON.stringify(issues));return tree;
}
const mounted=mountUI(root,layout(),{'select-skin':(id?:string)=>{if(!id||id===selectedSkinId||!skinOptions.some(option=>option.value===id))return;selectedSkinId=id;for(const dispose of release.splice(0).reverse())dispose();engines.length=0;message='正在重定向到所选角色…';mounted.update(layout());void load().catch(error=>rejectLoad(error,id));},pause:()=>{paused=!paused;for(const engine of engines){if(paused)engine.stop();else engine.start();}mounted.update(layout());}},motionPreviewTheme(new URLSearchParams(location.search).has('daylight')));
const close=()=>{disposed=true;for(const dispose of release.splice(0).reverse())dispose();mounted();};
window.addEventListener('pagehide',close,{once:true});
// A breakpoint changes native stage elements; reload only on that transition. Pause never rebuilds scenes.
window.addEventListener('resize',()=>{if(((root.clientWidth || window.innerWidth)<800?1:2)!==viewColumns)location.reload();});
async function json(path:string):Promise<unknown>{const response=await fetch(path);if(!response.ok)throw new Error(`${path} 读取失败`);return response.json();}
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
    if(!['LeftHand','RightHand'].includes(String(prop.bone)))throw new Error('道具只允许挂在 LeftHand/RightHand');
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
  if(!catalog.skins.length||catalog.clips.length!==1)throw new Error('Mink 验证预览要求至少 1 个角色、1 个候选动作');
  skinOptions=catalog.skins.map(row=>({value:row.id,label:row.source?.mixamoName||row.id}));
  if(!selectedSkinId)selectedSkinId=catalog.skins.find(row=>row.source?.mixamoName==='Michelle')?.id||catalog.skins[0].id;
  if(report&&typeof report==='object'&&'sourceSkinName' in report&&typeof report.sourceSkinName==='string')benchmarkSkinName=report.sourceSkinName.slice(0,80);
  const skin=catalog.skins.find(row=>row.id===selectedSkinId)!;const clip=catalog.clips[0];candidate=clip.id+(report&&typeof report==='object'&&'experimentId' in report&&typeof report.experimentId==='string'?' · '+report.experimentId.slice(0,80):'');summary=summarizeReport(report);const props=reviewProps(report);summary.push(`尺寸/接触参考道具：${props.length} 件（已换算的骨局部单位）`);mounted.update(layout());
  if(!Number.isFinite(skin.hipHeight)||skin.hipHeight<=0)throw new Error('角色 hipHeight 非法');
  const boundsData=await json('/skin-bounds/'+skin.id) as {id:string;sha256:string;bounds:SkinBounds};
  if(disposed||generation!==loadGeneration)return;
  if(boundsData.id!==skin.id||boundsData.sha256!==skin.sha256)throw new Error('角色边界与素材 SHA 不一致');
  const scale=1/skin.hipHeight;
  // Normalization is a Model3D render scale only. The source model/clip is never rebaked here.
  for(const view of ['front','side']){
    const assets=new AssetManager(new ModelAssetLoader());let engine:Engine|undefined,renderer:ThreeRenderer|undefined,released=false;
    const dispose=()=>{if(released)return;released=true;try{engine?.stop();}finally{try{renderer?.destroy();}finally{assets.clear();}}};release.push(dispose);
    assets.registerManifest([{kind:'model',key:'skin',src:'/assets/'+skin.file},{kind:'skeletal-animation',key:'motion',src:'/assets/'+clip.file,skeleton:'apollo-humanoid-v1',fps:clip.fps,frames:clip.frames,loop:clip.loop}]);
    await assets.loadAll();if(disposed||generation!==loadGeneration){dispose();return;}
    const container=root!.querySelector<HTMLElement>('#stage-'+view)!;const width=Math.max(200,container.clientWidth);
    const full=frameSkin(boundsData.bounds,scale,width/520),height=(boundsData.bounds[1][1]-boundsData.bounds[0][1])*scale;
    if(!Number.isFinite(height)||height<.1||height>10||!Number.isFinite(.15*scale)||Math.abs(.15*scale)>10)throw new Error('角色归一化高度或近景偏移超出人体预览范围');
    const distance=height*(view==='front'?1.05:.9);
    const clipping={near:Math.max(.001,height*.005),far:distance+height*4+1};
    const camera=view==='front'?{...full,...clipping,yaw:0,pitch:.02,fov:38,distance,pivotY:boundsData.bounds[0][1]*scale+height*.7,pivotZ:.15*scale}:{...full,...clipping,yaw:1.12,pitch:.02,fov:38,distance,pivotY:boundsData.bounds[0][1]*scale+height*.7,pivotZ:.15*scale};
    // Attach3D already applies the hand's world transform. Do not multiply local offsets/sizes again.
    const propEntities=Object.fromEntries(props.map(prop=>{const color=prop.color??(prop.bone==='LeftHand'?0xd9c6a3:0xa57443);return [`prop-${prop.id}`,{Transform3D:{x:0,y:0,z:0},Mesh3D:{shape:'box',width:prop.size[0],height:prop.size[1],depth:prop.size[2],frontTint:color,backTint:color,edgeTint:color},Attach3D:{parentId:'actor',bone:prop.bone,offset:prop.offset,rot:prop.rot}}];}));
    engine=new Engine({tickRate:60});engine.load({capabilities:[],entities:{
      ...propEntities,camera:{Camera3D:camera},sun:{Light3D:{kind:'directional',color:0xfff1d6,intensity:2}},fill:{Light3D:{kind:'ambient',color:0xffffff,intensity:1.4}},
      actor:{Transform3D:{x:0,y:0,z:0},Model3D:{modelKey:'skin',scale},AnimGraph3D:{clips:{motion:{asset:'motion',clip:clip.id,retarget:'humanoid',loop:true,speed:1}},states:{play:{clip:'motion'}},transitions:[],params:{speed:'speed'}}},
    }});
    renderer=new ThreeRenderer({width,height:520,background:0x111923,assets});engine.attachRenderer(renderer,container);engines.push(engine);
  }
  if(disposed||generation!==loadGeneration)return;message=`${skin.source?.mixamoName||skin.id} · 循环播放候选；可切换${catalog.skins.length}个角色，暂停核对姿态。`;mounted.update(layout());if(!paused)for(const engine of engines)engine.start();
}
function rejectLoad(error:unknown,id=selectedSkinId):void{if(disposed||id!==selectedSkinId)return;for(const dispose of release.splice(0).reverse())dispose();engines.length=0;console.error('[motion-mink-validation] reject',error);message=String(error);mounted.update(layout());}
try{await load();}catch(error){rejectLoad(error);}
