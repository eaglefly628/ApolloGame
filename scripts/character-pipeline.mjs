// T5 offline orchestration. No paid API, plugin download, human signing, or automatic approval.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Console } from 'node:console';
import { PerspectiveCamera, Vector3 } from 'three';
import { parseGlb, bakeSceneImport } from './lib/scene-geometry.mjs';
import { inside } from './lib/aiflow-paths.mjs';
import { runBlenderJob } from './blender-job.mjs';
import { inspectCharacterGlb } from './lib/character-glb.mjs';
import { decodePng, encodePngRGBA } from './asset-matte.mjs';
import { CHARACTER_PROFILE, VIEW_ROLES, MARKER_IDS, characterSha, markerDigest, validateMarkerSheet, validateMotionSource } from './lib/character-inputs.mjs';

const diagnostic = new Console({stdout:process.stderr,stderr:process.stderr});
function reject(message) { diagnostic.error(`[character-pipeline] reject: ${message}`); throw new Error(`character-pipeline: ${message}`); }
function object(v,keys,label) { if(!v||typeof v!=='object'||Array.isArray(v))reject(`${label} 必须为对象`);for(const k of Object.keys(v))if(!keys.includes(k))reject(`${label} 未知字段 ${k}`); }
const json = p=>JSON.parse(readFileSync(p,'utf8'));
const writeJson = (p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
function glbBytes(json,binary) {
  let data=Buffer.from(JSON.stringify(json));data=Buffer.concat([data,Buffer.alloc((4-data.length%4)%4,32)]);
  const bin=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]),out=Buffer.alloc(28+data.length+bin.length);
  out.write('glTF');out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(data.length,12);out.writeUInt32LE(0x4e4f534a,16);data.copy(out,20);
  out.writeUInt32LE(bin.length,20+data.length);out.writeUInt32LE(0x004e4942,24+data.length);bin.copy(out,28+data.length);return out;
}
/** Reuse the existing local Draco/meshopt geometry reader, measuring actual final bytes. */
export async function characterSourceBounds(input) {
  const {json:doc,binary}=parseGlb(input);
  if(doc.skins?.length||doc.animations?.length||doc.nodes?.some(n=>n.skin!==undefined||n.weights!==undefined)||doc.meshes?.some(m=>m.weights!==undefined||m.primitives?.some(p=>p.targets?.length)))reject('prepare只收T4静态人物模型；骨架/动画/形态键不得在提案中静默丢弃');
  const selected=doc.scene??(doc.scenes?.length===1?0:undefined),scene=doc.scenes?.[selected];
  if(!scene||!Array.isArray(scene.nodes))reject('人物模型缺唯一默认scene');
  // A temporary semantic wrapper asks the E5 CPU reader for the complete model bounds.
  // No source node or original GLB is changed on disk.
  const nodes=(doc.nodes??[]).map((n,i)=>({...n,name:`character-part-${i}`}));
  const wrapper=nodes.length;nodes.push({name:'pick_character_bounds',children:scene.nodes});
  const wrapped={...doc,nodes,scene:0,scenes:[{nodes:[wrapper]}]};
  const result=await bakeSceneImport(glbBytes(wrapped,binary));
  const bounds=result.nodes.find(n=>n.index===wrapper)?.bounds;
  if(!bounds)reject('人物没有可测三角几何');
  const lo=bounds.min,hi=bounds.max,eps=Math.max(1e-5,(hi[1]-lo[1])*0.001);
  if(lo.some((v,i)=>v>=hi[i])||hi[1]>100||hi[1]<0.1||Math.abs(lo[1])>eps||Math.abs(lo[0]+hi[0])>eps||Math.abs(lo[2]+hi[2])>eps)reject('人物须先T4规范化：Y-up、米制高度0.1..100、脚底中心原点');
  return [lo,hi];
}
export function proposeMarkers(bounds) {
  const [lo,hi]=bounds,h=hi[1]-lo[1],w=hi[0]-lo[0];
  const at=(x,y,z=0)=>[x*w,lo[1]+h*y,Math.max(lo[2],Math.min(hi[2],z))];
  const points=[at(0,.9),at(0,.8),at(0,.52),at(-.22,.76),at(.22,.76),at(-.36,.69),at(.36,.69),at(-.47,.63),at(.47,.63),at(-.1,.28),at(.1,.28),at(-.1,.04),at(.1,.04)];
  return MARKER_IDS.map((id,i)=>({id,position:points[i]}));
}
const DIGITS=['111101101101111','010110010010111','111001111100111','111001111001111','101101111001001','111100111001111','111100111101111','111001001001001','111101111101111','111101111001111'];
export function annotateMarkers(png,sheet,view) {
  const {w,h,rgba}=decodePng(Buffer.from(png)),camera=new PerspectiveCamera(view.camera.fov,w/h,.001,100000);
  camera.position.fromArray(view.camera.position);camera.lookAt(new Vector3(...view.camera.target));camera.updateMatrixWorld(true);
  const pixel=(x,y)=>{if(x<0||y<0||x>=w||y>=h)return;const n=(y*w+x)*4;rgba[n]=255;rgba[n+1]=65;rgba[n+2]=24;rgba[n+3]=255;};
  let skipped=0;
  for(let i=0;i<sheet.markers.length;i++) {
    const p=new Vector3(...sheet.markers[i].position).project(camera);
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.z< -1||p.z>1){skipped++;continue;}
    const x=Math.round((p.x+1)*w/2),y=Math.round((1-p.y)*h/2);
    for(let k=-5;k<=5;k++){pixel(x+k,y);pixel(x,y+k);}
    [...String(i+1)].forEach((d,col)=>{const glyph=DIGITS[Number(d)];for(let row=0;row<5;row++)for(let dx=0;dx<3;dx++)if(glyph[row*3+dx]==='1')pixel(x+7+col*4+dx,y-2+row);});
  }
  if(skipped)diagnostic.warn(`[character-pipeline] skip: ${view.role} 有${skipped}个点在相机裁剪范围外，标注未画出，须调整机位`);
  return encodePngRGBA(w,h,rgba);
}
export async function prepareCharacter(modelFile,workspace,{characterId,mock=false,blender,timeoutMs}={}) {
  if(typeof characterId!=='string'||!/^[a-z][a-z0-9-]*$/.test(characterId))reject('请用--character提供稳定slug');
  const model=readFileSync(resolve(modelFile)),bounds=await characterSourceBounds(model);
  workspace=resolve(workspace);
  mkdirSync(workspace); // exclusive: never overwrite an earlier proposal or anybody's files.
  const modelPath=inside(workspace,'source.glb');writeFileSync(modelPath,model,{flag:'wx'});
  const [lo,hi]=bounds,h=hi[1]-lo[1],target=[0,h/2,0],radius=Math.hypot(hi[0]-lo[0],h,hi[2]-lo[2])*1.8;
  const axes=[[0,0,1],[0,0,-1],[-1,0,0],[1,0,0]];
  const views=VIEW_ROLES.map((role,i)=>({id:role,position:[axes[i][0]*radius,h/2,axes[i][2]*radius],target,fov:45,width:320,height:480}));
  const renderJob={op:'render-views',inputs:['source.glb'],params:{views},outputs:VIEW_ROLES.map(r=>`views/${r}.png`)};
  const renderJobPath=inside(workspace,'render-views.json');writeJson(renderJobPath,renderJob);
  const render=runBlenderJob(renderJobPath,{mock,blender,timeoutMs});
  mkdirSync(inside(workspace,'refs'));mkdirSync(inside(workspace,'annotated'));
  const refs=render.outputs.map((o,i)=>{
    const bytes=readFileSync(o.snapshotPath),path=`refs/${VIEW_ROLES[i]}.png`;writeFileSync(inside(workspace,path),bytes,{flag:'wx'});
    const v=views[i];return {role:VIEW_ROLES[i],path,sha256:characterSha(bytes),width:v.width,height:v.height,camera:{position:v.position,target:v.target,fov:v.fov}};
  });
  const sheet={version:1,characterId,profile:CHARACTER_PROFILE,modelSha256:characterSha(model),bounds,state:'proposed',method:'bbox-proposal',views:refs,markers:proposeMarkers(bounds)};
  validateMarkerSheet(sheet,{model,views:refs.map(v=>readFileSync(inside(workspace,v.path))),mock:true});
  const markersPath=inside(workspace,'markers.json');writeJson(markersPath,sheet);
  for(const view of refs)writeFileSync(inside(workspace,`annotated/${view.role}-markers.png`),annotateMarkers(readFileSync(inside(workspace,view.path)),sheet,view),{flag:'wx'});
  const rigJob={op:'rig-arp',inputs:['source.glb','markers.json',...refs.map(v=>v.path)],params:{profile:CHARACTER_PROFILE,markersInput:1},outputs:['out/rig.glb']};
  const rigJobPath=inside(workspace,'rig-job.json');writeJson(rigJobPath,rigJob);
  const report={ok:true,mock:!!mock,sourceSha256:sheet.modelSha256,bounds,workspace,markersPath,markersSha256:markerDigest(sheet),rigJobPath,render,annotations:refs.map(v=>inside(workspace,`annotated/${v.role}-markers.png`)),humanConfirmation:false,realArpValidated:false};
  writeJson(inside(workspace,'proposal-report.json'),report);
  diagnostic.warn('[character-pipeline] downgrade: 包围盒启发式提案不识别解剖；四视图标注须真人微调确认，未执行ARP');
  return report;
}

/** Accept a user-exported ARP artifact into a fresh, auditable candidate directory. */
export async function acceptCharacterReturn(manifestFile,workspace,{mock=false,root}={}) {
  manifestFile=resolve(manifestFile);const base=dirname(manifestFile),m=json(manifestFile);
  object(m,['version','kind','id','servedPath','sourceModel','result','markers','motion','provenance'],'return manifest');
  if(m.version!==1||!['rig','animation'].includes(m.kind))reject('return version/kind无效');
  if(typeof m.id!=='string'||!m.id.trim()||/[\x00-\x1f]/u.test(m.id)||typeof m.servedPath!=='string'||!m.servedPath.endsWith('.glb')||m.servedPath.split(/[\\/]/u).includes('..')||/[\x00-\x1f?:#]/u.test(m.servedPath))reject('return需要资产id和明确本地GLB服务路径');
  if(typeof m.sourceModel!=='string'||typeof m.result!=='string'||typeof m.provenance!=='string')reject('return缺sourceModel/result/provenance路径');
  const snapshots=[],read=(path,label)=>{if(typeof path!=='string'||!path)reject(`缺${label}`);const bytes=readFileSync(resolve(base,path));snapshots.push({label,path,sha256:characterSha(bytes),bytes});return bytes;};
  const source=read(m.sourceModel,'source-model'),output=read(m.result,'returned-glb'),record=JSON.parse(read(m.provenance,'provenance').toString('utf8'));
  if(!mock&&parseGlb(source).json.extras?.mock===true)reject('Mock源模型不能生成真实ARP候选');
  object(record,['version','source','sourceSha256','targetSha256','outputSha256','markersSha256','blenderVersion','arpVersion'],'return provenance');
  if(record.version!==1||!['arp-manual','mock-fixture'].includes(record.source)||(!mock&&record.source!=='arp-manual'))reject('真实回灌只收arp-manual来源；Mock不能生成正式候选');
  if(record.outputSha256!==characterSha(output))reject('回灌GLB与provenance输出SHA不符');
  if(!mock&&(!/^4\.5\.\d+/.test(record.blenderVersion??'')||typeof record.arpVersion!=='string'||!record.arpVersion.trim()))reject('请记录真实Blender LTS与授权ARP插件版本');
  let info,marksSha,motionData;
  if(m.kind==='rig') {
    if(m.motion!==undefined)reject('rig回灌不收motion');
    const marksPath=resolve(base,m.markers??''),sheet=JSON.parse(read(m.markers,'markers').toString('utf8'));
    if(!Array.isArray(sheet.views))reject('回灌markers缺views');
    const views=sheet.views.map(v=>read(relative(base,resolve(dirname(marksPath),v.path)),'reference-view'));
    validateMarkerSheet(sheet,{model:source,views,mock,root});marksSha=markerDigest(sheet);
    const actualBounds=await characterSourceBounds(source);
    if(sheet.bounds.some((v,i)=>v.some((x,j)=>Math.abs(x-actualBounds[i][j])>1e-5)))reject('标记点bounds与输入模型实际几何不符');
    if(record.sourceSha256!==characterSha(source)||record.markersSha256!==marksSha)reject('回灌模型/标记点SHA已变，须重新确认和导出');
    info=inspectCharacterGlb(output);
    if(info.animations.length)reject('rig回灌应为静态bind pose，动作请逐条回灌');
    const [lo,hi]=info.bounds,height=actualBounds[1][1]-actualBounds[0][1],eps=Math.max(1e-4,height*0.005);
    if(Math.abs(lo[1])>eps||Math.abs(lo[0]+hi[0])>eps||Math.abs(lo[2]+hi[2])>eps||Math.abs((hi[1]-lo[1])-height)>eps)reject('绑骨结果改变了T4米制高度/脚底中心，需DCC修正后重导');
  } else {
    if(m.markers!==undefined)reject('animation回灌不收markers');
    const motionPath=resolve(base,m.motion??''),bundle=JSON.parse(read(m.motion,'motion').toString('utf8'));
    object(bundle,['provenance','fbx'],'motion bundle');
    motionData=bundle.provenance;
    const fbx=read(relative(base,resolve(dirname(motionPath),bundle.fbx)),'source-fbx');
    const p={profile:CHARACTER_PROFILE,clipId:motionData?.clipId,fps:motionData?.fps,frames:motionData?.frames,loop:motionData?.loop,inPlace:motionData?.inPlace};
    validateMotionSource(motionData,{params:p},[source,fbx],{mock});
    if(record.targetSha256!==characterSha(source)||record.sourceSha256!==characterSha(fbx))reject('回灌target/FBX与provenance SHA不符');
    info=inspectCharacterGlb(output,{clipName:p.clipId,fps:p.fps,frames:p.frames});
    if(info.animations.length!==1)reject('每个动作GLB必须恰好一个clip，不能把其它动作藏入候选');
    const target=inspectCharacterGlb(source);
    if(info.skeletonHash!==target.skeletonHash)reject('重定向结果与目标bind骨架不一致（不只比较同名）');
  }
  if(!mock&&info.mock)reject('Mock GLB不能作为真实ARP回灌候选');
  workspace=resolve(workspace);mkdirSync(workspace);
  const domain=mock?'mock':'candidate',dir=inside(workspace,domain);mkdirSync(dir);
  const resultPath=inside(dir,`${m.kind}.glb`);writeFileSync(resultPath,output,{flag:'wx'});
  mkdirSync(inside(dir,'inputs'));
  const inputs=snapshots.map((s,i)=>{const snapshotPath=inside(dir,`inputs/${i}.bin`);writeFileSync(snapshotPath,s.bytes,{flag:'wx'});const {bytes:_bytes,...data}=s;return {...data,snapshotPath};});
  const spec=m.kind==='animation'?{skeleton:CHARACTER_PROFILE,fps:motionData.fps,frames:motionData.frames,loop:motionData.loop}:{scale:1,up:'Y',pivot:'bottom-center'};
  const candidate=mock?null:{id:m.id,type:m.kind==='animation'?'animation':'mesh',description:`人工ARP回灌 ${m.id}`,status:'filled',path:m.servedPath,spec,source:'arp-manual',provenance:{rigging:{...record,sourceEvidence:'user-supplied',skeletonHash:info.skeletonHash,...(marksSha?{markersSha256:marksSha}:{}),...(motionData?{motion:motionData}:{})}}};
  const report={ok:true,mock:!!mock,sourceEvidence:mock?'mock-fixture':'user-supplied-arp-export',resultPath,sha256:characterSha(output),inputs,inspection:info,candidate,realArpValidated:false,realMixamoValidated:false};
  writeJson(inside(dir,'report.json'),report);
  if(candidate)writeJson(inside(dir,'asset-index-candidate.json'),{version:1,assets:[candidate]});
  diagnostic.warn(`[character-pipeline] ${mock?'downgrade: Mock不生成正式候选':'decision: 人工回灌仅验证格式/SHA/骨架；来源自述未等同自动ARP/许可验收'}；不写assets/index.json，不自动批准`);
  return report;
}
export function writeMotionList(path) {
  const body='# 动作清单\n\n人工从Mixamo下载FBX Without Skin；每项完成后填写来源、下载参数、文件SHA和目标骨架SHA。\n\n| id | 动作名 | Mixamo搜索词 | loop | inPlace | 需IK修正 |\n|---|---|---|---|---|---|\n| idle | 待机 | Idle | true | true | 否 |\n| walk | 行走 | Walking | true | true | 否 |\n| lift-kettle | 提水壶候选 | Picking Up | false | true | 是：E4手掌对壶把，近似动作不等于已对齐 |\n';
  writeFileSync(resolve(path),body,{flag:'wx'});diagnostic.info('[character-pipeline] commit: 动作清单已创建，下载/许可/姿态仍待人工');return {ok:true,path:resolve(path)};
}
export async function main(argv=process.argv.slice(2)) {
  try {
    const [command,...args]=argv,opts={},pos=[];
    for(let i=0;i<args.length;i++) {
      if(args[i]==='--mock'){opts.mock=true;continue;}
      if(['--character','--blender','--timeout-ms'].includes(args[i])) {const k=args[i++],v=args[i];if(v===undefined||v.startsWith('--'))reject(`缺参数 ${k}`);if(k==='--character')opts.characterId=v;else if(k==='--blender')opts.blender=v;else opts.timeoutMs=Number(v);continue;}
      if(args[i].startsWith('--'))reject(`未知参数 ${args[i]}`);pos.push(args[i]);
    }
    if((command==='motion-list'&&Object.keys(opts).length)||(['run','return'].includes(command)&&opts.characterId!==undefined)||(['return','motion-list'].includes(command)&&(opts.blender!==undefined||opts.timeoutMs!==undefined)))reject('该命令不接受所给选项，未执行任何操作');
    let result;
    if(command==='prepare'&&pos.length===2)result=await prepareCharacter(pos[0],pos[1],opts);
    else if(command==='run'&&pos.length===1)result=runBlenderJob(pos[0],opts);
    else if(command==='return'&&pos.length===2)result=await acceptCharacterReturn(pos[0],pos[1],opts);
    else if(command==='motion-list'&&pos.length===1)result=writeMotionList(pos[0]);
    else reject('用法: character-pipeline.mjs prepare <T4.glb> <新目录> --character <slug> [--mock] | run <job.json> [--mock] | return <manifest.json> <新目录> [--mock] | motion-list <新文件.md>');
    console.log(JSON.stringify(result));return 0;
  } catch(e) {diagnostic.error(`[character-pipeline] reject: ${e.message}`);return 1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await main();
