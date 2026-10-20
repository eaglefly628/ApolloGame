// T5 immutable handoff data. These checks never confirm markers or sign a gate.
import { createHash } from 'node:crypto';
import { Console } from 'node:console';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from '../asset-matte.mjs';
import { validateHumanSigner } from './aiflow-gates.mjs';
import { validateMotionFbx } from './character-fbx.mjs';

export const CHARACTER_PROFILE = 'apollo-humanoid-v1';
export const VIEW_ROLES = Object.freeze(['front','back','left','right']);
export const MARKER_IDS = Object.freeze(['chin','neck','hips','left-shoulder','right-shoulder','left-elbow','right-elbow','left-wrist','right-wrist','left-knee','right-knee','left-ankle','right-ankle']);
const diagnostic = new Console({stdout:process.stderr,stderr:process.stderr});
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const characterSha = bytes => createHash('sha256').update(bytes).digest('hex');
export function canonicalCharacter(value) { return JSON.stringify(value, (_key,v) => v && typeof v==='object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])) : v); }
function reject(message) { console.error(`[character-inputs] reject: ${message}`); throw new Error(`character-inputs: ${message}`); }
const finite = x => typeof x==='number' && Number.isFinite(x);
function object(v,keys,label) { if(!v || typeof v!=='object' || Array.isArray(v) || Object.getPrototypeOf(v)!==Object.prototype) reject(`${label} 必须是纯对象`); for(const k of Object.keys(v)) if(!keys.includes(k)) reject(`${label} 未知字段 ${k}`); }
function vector(v,label) { if(!Array.isArray(v)||v.length!==3||!v.every(finite))reject(`${label} 必须是有限三维向量`); }
function text(v,label) { if(typeof v!=='string'||!v.trim()||/[\x00-\x1f]/u.test(v))reject(`${label} 必须是非空文本`); }
function digest(v,label) { if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))reject(`${label} 必须是SHA256`); }
export function markerDigest(sheet) { const {state:_state,confirmation:_confirmation,...data}=sheet; return characterSha(canonicalCharacter(data)); }
export function validateMarkerSheet(sheet,{model,views,mock=false,root=ROOT}={}) {
  object(sheet,['version','characterId','profile','modelSha256','bounds','state','method','views','markers','confirmation'],'markers');
  if(sheet.version!==1 || sheet.profile!==CHARACTER_PROFILE || sheet.method!=='bbox-proposal')reject('markers version/profile/method 不受支持');
  if(typeof sheet.characterId!=='string'||!/^[a-z][a-z0-9-]*$/.test(sheet.characterId))reject('characterId 需要稳定slug');
  digest(sheet.modelSha256,'modelSha256');
  if(!(model instanceof Uint8Array)||characterSha(model)!==sheet.modelSha256)reject('标记点 modelSha256 与本次模型字节不符，须重新提案/确认');
  if(!Array.isArray(sheet.bounds)||sheet.bounds.length!==2)reject('bounds需要[min,max]');
  const [lo,hi]=sheet.bounds;vector(lo,'bounds.min');vector(hi,'bounds.max');
  if(lo.some((v,i)=>v>=hi[i])||hi.some(v=>Math.abs(v)>10000)||lo.some(v=>Math.abs(v)>10000))reject('bounds 必须有正体积且在米制预算内');
  const eps=Math.max(1e-5,(hi[1]-lo[1])*0.001);
  if(Math.abs(lo[1])>eps||Math.abs(lo[0]+hi[0])>eps||Math.abs(lo[2]+hi[2])>eps)reject('模型必须先T4规范化为Y-up脚底中心');
  if(!Array.isArray(sheet.views)||sheet.views.length!==4||!Array.isArray(views)||views.length!==4)reject('需要front/back/left/right四张视图');
  for(let i=0;i<4;i++) {
    const v=sheet.views[i];object(v,['role','path','sha256','width','height','camera'],'view');
    if(v.role!==VIEW_ROLES[i])reject('四视图role顺序必须为front/back/left/right');
    text(v.path,'view.path');digest(v.sha256,'view.sha256');
    if(!(views[i] instanceof Uint8Array)||characterSha(views[i])!==v.sha256)reject(`四视图 ${v.role} SHA 与输入字节不符`);
    const png=decodePng(Buffer.from(views[i]));
    if(v.width!==png.w||v.height!==png.h)reject(`四视图 ${v.role} 尺寸与PNG不符`);
    object(v.camera,['position','target','fov'],'view.camera');vector(v.camera.position,'camera.position');vector(v.camera.target,'camera.target');
    if(v.camera.position.every((x,j)=>x===v.camera.target[j])||!finite(v.camera.fov)||v.camera.fov<1||v.camera.fov>=179)reject('view.camera 需要有效机位与1..179度视角');
  }
  if(!Array.isArray(sheet.markers)||sheet.markers.length!==MARKER_IDS.length)reject(`需要${MARKER_IDS.length}个闭集标记点`);
  for(let i=0;i<MARKER_IDS.length;i++) {
    const m=sheet.markers[i];object(m,['id','position'],'marker');
    if(m.id!==MARKER_IDS[i])reject('marker id/顺序不符合闭集');vector(m.position,'marker.position');
    if(m.position.some((x,j)=>x<lo[j]-eps||x>hi[j]+eps))reject(`marker ${m.id} 在模型包围盒外`);
  }
  if(!['proposed','confirmed'].includes(sheet.state))reject('markers.state 只接受proposed/confirmed');
  if(sheet.state==='proposed') {
    if(sheet.confirmation!==undefined)reject('proposed不能携带确认记录');
    if(!mock)reject('标记点尚待真人确认/微调，不能运行真实Smart');
    console.warn('[character-inputs] downgrade: Mock使用未确认提案，不生成或冒充真人确认');
  } else {
    object(sheet.confirmation,['by','markersSha256'],'confirmation');text(sheet.confirmation.by,'confirmation.by');
    if(sheet.confirmation.markersSha256!==markerDigest(sheet))reject('标记点/参考图已变更，旧确认SHA失效');
    const human=validateHumanSigner(root,sheet.confirmation.by);
    if(!human.ok)reject(human.error);
    diagnostic.info('[character-inputs] decision: 消费已有真人确认；不写入签字或人门');
  }
  return sheet;
}
export function validateMotionSource(sidecar,job,buffers,{mock=false}={}) {
  object(sidecar,['version','source','clipId','sourceSha256','targetSha256','skeleton','fps','frames','loop','inPlace','searchTerm','download','licenseUrl'],'motion provenance');
  if(sidecar.version!==1||sidecar.skeleton!==CHARACTER_PROFILE)reject('动作 provenance version/skeleton 不受支持');
  if(typeof sidecar.clipId!=='string'||!/^[a-z][a-z0-9-]*$/.test(sidecar.clipId)||!Number.isInteger(sidecar.fps)||sidecar.fps<1||sidecar.fps>120||!Number.isInteger(sidecar.frames)||sidecar.frames<2||sidecar.frames>36001||typeof sidecar.loop!=='boolean'||typeof sidecar.inPlace!=='boolean')reject('动作需稳定clipId、整数fps/frames和布尔loop/inPlace');
  if(sidecar.source!=='mixamo-manual' && !(mock&&sidecar.source==='mock-fixture'))reject('动作只收人工Mixamo来源；mock-fixture仅限显式Mock');
  if(sidecar.sourceSha256!==characterSha(buffers[1])||sidecar.targetSha256!==characterSha(buffers[0]))reject('动作FBX或目标骨架SHA已变，来源记录失效');
  for(const k of ['clipId','fps','frames','loop','inPlace'])if(sidecar[k]!==job.params[k])reject(`动作来源 ${k} 与本次作业不符`);
  text(sidecar.searchTerm,'Mixamo searchTerm');object(sidecar.download,['format','skin'],'download');
  if(sidecar.download.format!=='FBX'||sidecar.download.skin!==false)reject('Mixamo请下载FBX Without Skin');
  if(sidecar.licenseUrl!=='https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html')reject('缺Mixamo官方来源条款URL');
  if(!buffers[1].length)reject('动作FBX为空');
  if(mock)diagnostic.warn('[character-inputs] skip: 显式Mock未解析来源FBX结构，不代表Mixamo下载或Remap成功');
  else {
    const parsed=validateMotionFbx(buffers[1]);
    diagnostic.info(`[character-inputs] decision: binary FBX ${parsed.version} 结构/动画曲线已解析；不证明来源、映射或实际Remap`);
  }
  diagnostic.info('[character-inputs] decision: 来源记录由提供者填写；SHA绑定不等于许可或Remap已实测');
  return sidecar;
}
export function validateCharacterInputs(job,buffers,opts={}) {
  if(!job.params?.profile)return {};
  try {
    if(job.op==='rig-arp') {
      validateMarkerSheet(JSON.parse(buffers[1].toString('utf8')),{...opts,model:buffers[0],views:buffers.slice(2)});
      return {sourceEvidence:opts.mock?'mock-markers-unapproved':'human-confirmed-markers'};
    }
    if(job.op==='retarget-arp') {
      const source=validateMotionSource(JSON.parse(buffers[2].toString('utf8')),job,buffers,opts);
      return {sourceEvidence:source.source==='mock-fixture'?'mock-fixture':'user-supplied-mixamo-record'};
    }
    return {};
  } catch(e) { console.error(`[character-inputs] reject: 输入快照校验失败 ${e.message}`); throw e; }
}
