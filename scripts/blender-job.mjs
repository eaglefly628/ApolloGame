// T7 offline Blender bridge. Job data never contains Python, shell, or an executor path.
import { readFileSync, writeFileSync, mkdirSync, statSync, existsSync, rmSync, renameSync, realpathSync, lstatSync, copyFileSync, constants } from 'node:fs';
import { resolve, dirname, join, extname, relative, basename, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { Console } from 'node:console';
import { inside, slugName } from './lib/aiflow-paths.mjs';
import { validateSplit } from './asset-split.mjs';
import { encodePng } from './ai-gen.mjs';
import { decodePng } from './asset-matte.mjs';
import { validateNormalizationResult } from './lib/model-normalization.mjs';

export const BLENDER_OPS = Object.freeze(['normalize', 'rig-arp', 'retarget-arp', 'build-scene', 'render-views']);
const HERE = dirname(fileURLToPath(import.meta.url));
const diagnostics = new Console({stdout:process.stderr,stderr:process.stderr});
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const own = (o,k) => Object.hasOwn(o,k);
function reject(message) { diagnostics.error(`[blender-job] reject: ${message}`); throw new Error(`blender-job: ${message}`); }
function object(o, keys, label) {
  if (!o || typeof o !== 'object' || Array.isArray(o) || Object.getPrototypeOf(o) !== Object.prototype) reject(`${label} 必须是纯对象`);
  for (const k of Object.keys(o)) if (!keys.includes(k)) reject(`${label} 未知字段 ${k}`);
}
function text(s,label) { if(typeof s !== 'string' || !s.trim() || s.includes('\0')) reject(`${label} 必须是非空字符串`); }
function number(n,label,min=-Infinity,max=Infinity) { if(typeof n!=='number' || !Number.isFinite(n) || n<min || n>max) reject(`${label} 必须是有限数字，范围 ${min}..${max}`); }
function vec(v,n,label,min=-Infinity,max=Infinity) { if(!Array.isArray(v)||v.length!==n) reject(`${label} 需要 ${n} 维数组`);v.forEach((x,i)=>number(x,`${label}[${i}]`,min,max)); }
function identifier(s,label) { if(typeof s!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(s)) reject(`${label} 需要稳定的字母数字标识`); }
function paths(list,label,nonempty=true) { if(!Array.isArray(list)||(nonempty&&!list.length)||list.length>256) reject(`${label} 需要非空路径数组（最多256项）`);list.forEach((s,i)=>text(s,`${label}[${i}]`));if(new Set(list).size!==list.length)reject(`${label} 路径重复`); }
export function validateJob(job) {
  object(job,['op','inputs','params','outputs'],'job');
  if (!BLENDER_OPS.includes(job.op)) reject(`未知 op ${job.op}；只接受 ${BLENDER_OPS.join(', ')}`);
  paths(job.inputs,'inputs'); paths(job.outputs,'outputs');
  if(job.op==='build-scene') {
    object(job.params,['scene','objects'],'params');slugName(job.params.scene);
    if(!Array.isArray(job.params.objects)||!job.params.objects.length||job.params.objects.length>2048)reject('objects 需要1..2048项显式三维数据');
    if(job.outputs.length!==1||extname(job.outputs[0]).toLowerCase()!=='.glb')reject('build-scene 需要一个 GLB 输出');
    if(extname(job.inputs[0]).toLowerCase()!=='.json'||job.inputs.slice(1).some(p=>extname(p).toLowerCase()!=='.glb'))reject('build-scene inputs[0] 必须是拆层JSON，其余为GLB');
    const names=new Set();
    for(const o of job.params.objects) {
      object(o,['splitId','name','source','position','rotation','scale','color'],'object');identifier(o.name,'object.name');
      if(names.has(o.name))reject(`节点名称重复 ${o.name}`);names.add(o.name);
      if(own(o,'splitId'))text(o.splitId,'splitId');
      object(o.source,['primitive','size','input'],'source');
      if(own(o.source,'input')===own(o.source,'primitive'))reject('source 必须且只能指定 primitive 或 input');
      if(own(o.source,'input')) {
        if(!Number.isInteger(o.source.input)||o.source.input<1||o.source.input>=job.inputs.length||own(o.source,'size'))reject('source.input 必须引用 inputs 中的GLB，不能带size');
      } else {
        if(!['box','plane','empty'].includes(o.source.primitive))reject(`未知 primitive ${o.source.primitive}`);
        if(o.source.primitive==='empty') { if(own(o.source,'size'))reject('empty 不接受size'); }
        else if(o.source.primitive==='plane') {vec(o.source.size,3,'size',0,100000);if(o.source.size[0]<=0||o.source.size[1]!==0||o.source.size[2]<=0)reject('plane size 必须是[正width,0,正depth]');}
        else {vec(o.source.size,3,'size',0.000001,100000);}
      }
      if(!own(o,'splitId') && !(o.name.startsWith('spawn_')&&o.source.primitive==='empty'))reject('除spawn_* empty外，每个对象都需要splitId');
      if(o.name.startsWith('spawn_')&&o.source.primitive!=='empty')reject('spawn_* 必须是empty');
      if((o.name.startsWith('col_')||o.name.startsWith('nav_'))&&o.source.primitive==='empty')reject('col_/nav_ 必须有几何');
      vec(o.position,3,'position',-100000,100000);vec(o.rotation,3,'rotation');number(o.scale,'scale',0.000001,100000);
      if(own(o,'color')) {vec(o.color,4,'color',0,1);if(own(o.source,'input')||o.source.primitive==='empty')reject('模型材质来自输入且empty无材质，不接受color覆盖');}
    }
  } else if(job.op==='render-views') {
    object(job.params,['views'],'params');
    if(job.inputs.length!==1||extname(job.inputs[0]).toLowerCase()!=='.glb')reject('render-views 需要一个GLB输入');
    if(!Array.isArray(job.params.views)||!job.params.views.length||job.params.views.length>32||job.outputs.length!==job.params.views.length||job.outputs.some(p=>extname(p).toLowerCase()!=='.png'))reject('views 需要1..32项，每个视图对应一个PNG输出');
    const names=new Set();
    for(const v of job.params.views) {
      object(v,['id','position','target','fov','width','height'],'view');identifier(v.id,'view.id');
      if(names.has(v.id))reject(`视图id重复 ${v.id}`);names.add(v.id);
      vec(v.position,3,'position',-100000,100000);vec(v.target,3,'target',-100000,100000);
      if(v.position.every((x,i)=>x===v.target[i]))reject('相机position不能等于target');
      number(v.fov,'fov',0.001,179.999);
      for(const k of ['width','height'])if(!Number.isInteger(v[k])||v[k]<16||v[k]>4096)reject(`${k} 必须是16..4096整数`);
    }
  } else if(job.op==='normalize') {
    object(job.params,['sourceUp','targetHeightMeters','maxTris','maxTextureSize'],'normalize params');
    if(!['Y','Z'].includes(job.params.sourceUp))reject('sourceUp 必须显式声明Y或Z，不能猜源轴向');
    number(job.params.targetHeightMeters,'targetHeightMeters',0.000001,100000);
    if(!Number.isSafeInteger(job.params.maxTris)||job.params.maxTris<1)reject('maxTris 必须是正整数面数预算');
    if(!Number.isSafeInteger(job.params.maxTextureSize)||job.params.maxTextureSize<1||job.params.maxTextureSize>2048)reject('maxTextureSize 必须是1..2048整数');
    if(job.inputs.length!==1||extname(job.inputs[0]).toLowerCase()!=='.glb'||job.outputs.length!==2||extname(job.outputs[0]).toLowerCase()!=='.glb'||extname(job.outputs[1]).toLowerCase()!=='.json')reject('normalize 需要一个GLB输入和GLB、JSON两个有序输出');
  } else {
    // T5 owns rig/retarget parameter contracts. Recognized is not executable yet.
    object(job.params,[],`${job.op} params（下游T5尚未交付）`);
    if(job.inputs.length<(job.op==='retarget-arp'?2:1)||job.outputs.length!==1||extname(job.outputs[0]).toLowerCase()!=='.glb')reject(`${job.op} 桥入口需要${job.op==='retarget-arp'?2:1}个以上输入和一个GLB输出`);
  }
  return job;
}
function canonical(value) { return JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v); }
function validArtifact(file,kind) {
  if(!lstatSync(file).isFile())reject(`工件不是普通文件 ${file}`);
  const b=readFileSync(file);if(!b.length)reject(`输出为空 ${file}`);
  if(kind==='.glb') {
    if(b.length<20||b.toString('ascii',0,4)!=='glTF'||b.readUInt32LE(4)!==2||b.readUInt32LE(8)!==b.length)reject(`输出不是有效GLB ${file}`);
    const n=b.readUInt32LE(12);if(b.readUInt32LE(16)!==0x4e4f534a||20+n>b.length)reject(`GLB缺JSON chunk ${file}`);
    try{const j=JSON.parse(b.toString('utf8',20,20+n));if(j.asset?.version!=='2.0')reject('GLB asset.version无效');
      if([...(j.buffers||[]),...(j.images||[])].some(r=>r.uri&&!r.uri.startsWith('data:')))reject('GLB必须自包含，外部资源请先嵌入（不能遗漏哈希或暗中联网）');}catch(e){reject(`GLB JSON损坏: ${e.message}`);}
  } else if(kind==='.png'){try{decodePng(b);}catch(e){reject(`输出不是有效PNG ${file}: ${e.message}`);}}
  else if(kind==='.json'){try{JSON.parse(b.toString('utf8'));}catch(e){reject(`输出不是有效JSON ${file}: ${e.message}`);}}
  return b;
}
function mockGlb(hash) {
  const j={asset:{version:'2.0',generator:'Apollo Blender bridge MOCK'},scene:0,scenes:[{nodes:[0]}],nodes:[{name:`MOCK_${hash.slice(0,16)}`} ]};
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
  const b=Buffer.alloc(20+json.length);b.write('glTF');b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(json.length,12);b.writeUInt32LE(0x4e4f534a,16);json.copy(b,20);return b;
}
function mockPng(hash,width,height) {
  const rgb=Buffer.alloc(width*height*3);
  for(let i=0;i<rgb.length;i++)rgb[i]=(parseInt(hash.slice((i%16)*2,(i%16)*2+2),16)+(Math.floor(i/3)%width)%32)%256;
  return encodePng(width,height,rgb);
}
function checkSplit(job,buffers) {
  if(job.op!=='build-scene')return;
  let rows;try{rows=validateSplit(JSON.parse(buffers[0].toString('utf8')));}catch(e){reject(`D1拆层单无效: ${e.message}`);}
  const sceneRows=rows.filter(r=>r.scene===job.params.scene),byId=new Map(sceneRows.map(r=>[r.id,r]));
  if(!sceneRows.length)reject(`D1没有场景 ${job.params.scene}`);
  const used=new Set();
  for(const o of job.params.objects) {
    if(!o.splitId)continue;
    const r=byId.get(o.splitId);if(!r)reject(`D1不存在splitId ${o.splitId}`);
    if(r.state!=='approved')reject(`D1 ${r.id} 尚未approved`);
    if(r.route==='build' ? !own(o.source,'primitive')||o.source.primitive==='empty' : !own(o.source,'input'))reject(`D1 ${r.id} route=${r.route} 与source不符`);
    used.add(r.id);
  }
  for(const r of sceneRows)if(r.state==='approved'&&!used.has(r.id))reject(`D1 approved行未消费 ${r.id}`);
  for(const r of sceneRows)if(r.state!=='approved')diagnostics.warn(`[blender-job] skip: ${r.id} 未批准，不参与场景`);
}
// Resolve existing aliases as well as not-yet-created descendants before comparing destinations.
function destination(path) {
  let ancestor=path;
  while(!existsSync(ancestor)) {const parent=dirname(ancestor);if(parent===ancestor)reject(`无法解析输出路径 ${path}`);ancestor=parent;}
  if(ancestor!==path&&!statSync(ancestor).isDirectory())reject(`输出路径的祖先不是目录 ${ancestor}`);
  return resolve(realpathSync(ancestor),relative(ancestor,path));
}
function pathKey(path) {const s=path.normalize('NFC');return ['darwin','win32'].includes(process.platform)?s.toLowerCase():s;}
function nested(parent,child) {const r=relative(parent,child);return r===''||(!r.startsWith('../')&&r!=='..'&&!isAbsolute(r));}
function validateDestinations(base,job,jobFile,inputs) {
  const targets=job.outputs.map(p=>inside(base,p));
  const physical=targets.map(t=>pathKey(destination(t)));
  const reserved=pathKey(destination(join(base,'.blender-jobs')));
  const forbidden=new Set([jobFile,...inputs].map(p=>pathKey(realpathSync(p))));
  for(let i=0;i<targets.length;i++) {
    if(forbidden.has(physical[i]))reject(`输出覆盖输入或job ${targets[i]}`);
    if(nested(reserved,physical[i]))reject('输出不能覆盖.blender-jobs证据目录（包括符号链接别名）');
    if(existsSync(targets[i])&&!statSync(targets[i]).isFile())reject(`输出目标不是文件 ${targets[i]}`);
    for(let j=0;j<i;j++)if(nested(physical[i],physical[j])||nested(physical[j],physical[i]))reject('输出路径重叠（物理路径重复或祖先/后代冲突）');
  }
  return targets;
}
export function runBlenderJob(jobFile,{mock=false,blender=process.env.BLENDER_BIN||'blender',timeoutMs=120000}={}) {
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3600000)reject('timeoutMs 必须是1..3600000整数');
  text(blender,'Blender executable');jobFile=resolve(jobFile);const base=dirname(jobFile);
  const job=validateJob(JSON.parse(readFileSync(jobFile,'utf8')));
  const inputs=job.inputs.map(p=>realpathSync(resolve(base,p)));
  const buffers=inputs.map((p,i)=>{if(!statSync(p).isFile())reject(`输入不是文件 ${job.inputs[i]}`);return readFileSync(p);});
  for(let i=0;i<inputs.length;i++)if(extname(job.inputs[i]).toLowerCase()==='.glb')validArtifact(inputs[i],'.glb');
  const targets=validateDestinations(base,job,jobFile,inputs);
  checkSplit(job,buffers);
  const worker=readFileSync(join(HERE,'blender','worker.py'));
  const refs=inputs.map((path,i)=>({path:job.inputs[i],sha256:sha(buffers[i])}));
  const jobHash=sha(canonical({job,inputs:refs,worker:sha(worker)}));
  const evidenceRoot=inside(base,`.blender-jobs/${mock?'mock':'real'}/${jobHash}`);
  mkdirSync(evidenceRoot,{recursive:true});
  // Each invocation has its own evidence, even when rerunning the identical job.
  let evidenceDir;
  for(let n=1;n<=1000000;n++) {
    const candidate=inside(evidenceRoot,`run-${String(n).padStart(6,'0')}`);
    try{mkdirSync(candidate);evidenceDir=candidate;break;}catch(e){if(e.code!=='EEXIST')throw e;}
  }
  if(!evidenceDir)reject('作业运行记录超过上限');
  const scriptPath=join(evidenceDir,'job.py'),logPath=join(evidenceDir,'job.log'),resultPath=join(evidenceDir,'result.json'),stage=join(evidenceDir,'stage');
  // A rerun starts with no success record or stale stage outputs to borrow.
  rmSync(resultPath,{force:true});rmSync(stage,{recursive:true,force:true});mkdirSync(stage,{recursive:true});
  writeFileSync(scriptPath,worker);
  const stageOutputs=targets.map((t,i)=>join(stage,`${i}${extname(t).toLowerCase()}`));
  // Consume the exact bytes that were hashed, not mutable originals read later by Blender.
  const snapshotDir=join(evidenceDir,'inputs');mkdirSync(snapshotDir,{recursive:true});
  const snapshotInputs=inputs.map((p,i)=>{const dest=join(snapshotDir,`${i}${extname(job.inputs[i]).toLowerCase()}`);writeFileSync(dest,buffers[i]);return dest;});
  const payload={...job,inputs:snapshotInputs,outputs:stageOutputs};
  const payloadPath=join(evidenceDir,'payload.json');writeFileSync(payloadPath,canonical(payload)+'\n');
  let log=`decision op=${job.op} mock=${!!mock} jobHash=${jobHash}\n`;
  writeFileSync(logPath,log);
  const finishLog=s=>{log+=s+'\n';writeFileSync(logPath,log);};
  try {
    diagnostics.info(`[blender-job] decision: ${job.op} ${mock?'mock':'Blender'} job=${jobHash}`);
    if(mock) {
      diagnostics.warn('[blender-job] downgrade: --mock，仅隔离产物，不代表Blender/T4/T5真实成功');
      for(let i=0;i<stageOutputs.length;i++) {
        const v=job.params.views?.[i];
        const kind=extname(stageOutputs[i]);
        writeFileSync(stageOutputs[i],kind==='.png'?mockPng(jobHash,v.width,v.height):kind==='.json'?JSON.stringify({mock:true,spec:null,normalization:null})+'\n':mockGlb(jobHash));
      }
      finishLog('downgrade explicit mock; no Blender execution');
    } else {
      const args=['--background','--factory-startup','--disable-autoexec','--python-exit-code','1','--python',scriptPath,'--',payloadPath];
      const r=spawnSync(blender,args,{encoding:'utf8',timeout:timeoutMs,maxBuffer:16*1024*1024,windowsHide:true});
      finishLog(`Blender stdout:\n${r.stdout||''}\nBlender stderr:\n${r.stderr||''}`);
      if(r.error)reject(r.error.code==='ENOENT'?`找不到Blender，请安装固定LTS版本或设置BLENDER_BIN；仅显式--mock可模拟`:`Blender执行失败 ${r.error.code}: ${r.error.message}`);
      if(r.status!==0)reject(`Blender退出码 ${r.status}（signal=${r.signal||'-'}），见 ${logPath}`);
    }
    const outputs=stageOutputs.map((file,i)=>{
      const b=validArtifact(file,extname(targets[i]).toLowerCase());
      if(job.op==='render-views') {const v=job.params.views[i];if(b.readUInt32BE(16)!==v.width||b.readUInt32BE(20)!==v.height)reject(`输出PNG尺寸与view ${v.id}不符`);}
      return {path:mock?inside(evidenceDir,`out/${relative(base,targets[i])}`):targets[i],snapshotPath:file,sha256:sha(b),bytes:b.length};
    });
    if(job.op==='normalize')validateNormalizationResult(JSON.parse(readFileSync(stageOutputs[1],'utf8')),readFileSync(stageOutputs[0]),job.params,{mock});
    // Revalidate the complete physical destination set before publishing any output.
    if(!mock)validateDestinations(base,job,jobFile,inputs);
    for(let i=0;i<outputs.length;i++) {
      const p=outputs[i].path;
      // Recheck symlink ancestry after child execution before publishing.
      if(mock)inside(evidenceDir,relative(evidenceDir,p));else inside(base,job.outputs[i]);
      mkdirSync(dirname(p),{recursive:true});
      const temporary=join(dirname(p),`.${basename(p)}.${jobHash}.${basename(evidenceDir)}.tmp`);
      copyFileSync(stageOutputs[i],temporary,constants.COPYFILE_EXCL);
      try{renameSync(temporary,p);}finally{rmSync(temporary,{force:true});}
    }
    const report={ok:true,op:job.op,mock:!!mock,jobHash,inputs:refs,outputs,evidenceDir,logPath,scriptPath};
    finishLog(`commit ${outputs.map(o=>`${o.sha256} ${o.path}`).join('\n')}`);
    writeFileSync(resultPath,JSON.stringify(report,null,2)+'\n');
    diagnostics.info(`[blender-job] commit: ${outputs.length} 产物与hash已落档 ${resultPath}`);
    return report;
  } catch(e) {
    finishLog(`reject ${e.message}`);rmSync(stage,{recursive:true,force:true});e.logPath=logPath;throw e;
  }
}
export function main(argv=process.argv.slice(2)) {
  try {
    if(!argv.length)reject('用法: node scripts/blender-job.mjs <job.json> [--mock] [--blender <path>] [--timeout-ms <n>]');
    const file=argv[0],opts={};
    for(let i=1;i<argv.length;i++) {
      if(argv[i]==='--mock'){opts.mock=true;continue;}
      if(['--blender','--timeout-ms'].includes(argv[i])&&i+1<argv.length){const k=argv[i++];if(k==='--blender')opts.blender=argv[i];else opts.timeoutMs=Number(argv[i]);continue;}
      reject(`未知或缺值参数 ${argv[i]}`);
    }
    console.log(JSON.stringify(runBlenderJob(file,opts)));return 0;
  } catch(e) {diagnostics.error(`[blender-job] reject: ${e.message}`);return 1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main();
