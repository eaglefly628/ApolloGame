import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBlenderJob, validateJob } from './blender-job.mjs';
import { validateNormalizationResult } from './lib/model-normalization.mjs';
function reject(message) { console.error(`[model-normalize] reject: ${message}`); throw new Error(`model-normalize: ${message}`); }
export function normalizeModel(jobFile,opts={}) {
  const job=validateJob(JSON.parse(readFileSync(jobFile,'utf8')));
  if(job.op!=='normalize')reject('本入口只接受normalize作业');
  const report=runBlenderJob(jobFile,opts);
  const data=JSON.parse(readFileSync(report.outputs[1].path,'utf8'));
  validateNormalizationResult(data,readFileSync(report.outputs[0].path),job.params,{mock:report.mock});
  if(report.mock)console.warn('[model-normalize] downgrade: mock无实测spec，不可生成正式资产候选');
  else console.info(`[model-normalize] commit: ${data.spec.tris} tris、${data.spec.bytes} bytes；仅候选字段，不自动登记`);
  return {...report,spec:data.spec,normalization:data.normalization};
}
/** Return candidate data only. The existing approval gate remains the sole index writer. */
export function normalizedEntry(sourceEntry,report,servedPath) {
  if(!report||report.mock||!report.spec||!report.normalization)reject('mock/未实测产物不能生成正式候选');
  if(!sourceEntry||sourceEntry.type!=='mesh'||typeof sourceEntry.id!=='string'||!sourceEntry.id.trim())reject('需要原始mesh条目，不能丢失来源自行建空条目');
  if(typeof servedPath!=='string'||!servedPath.trim()||servedPath.includes('\0')||!servedPath.toLowerCase().endsWith('.glb'))reject('需要显式的规范化GLB servedPath');
  const sourceSha256=report.inputs?.[0]?.sha256;
  if(!/^[a-f0-9]{64}$/.test(sourceSha256??'')||!/^[a-f0-9]{64}$/.test(report.jobHash??''))reject('缺规范化输入SHA/jobHash证据');
  const n=report.normalization;
  validateNormalizationResult({spec:report.spec,normalization:n},readFileSync(report.outputs[0].snapshotPath),{sourceUp:n.sourceUp,targetHeightMeters:n.targetHeightMeters,maxTextureSize:n.maxTextureSize,maxTris:report.spec.tris});
  console.info('[model-normalize] decision: 保留原许可与来源，输出待审候选，不写index');
  return {...sourceEntry,path:servedPath,spec:{...sourceEntry.spec,...report.spec},provenance:{...sourceEntry.provenance,normalization:{...n,sourceSha256,jobHash:report.jobHash}}};
}
export function main(argv=process.argv.slice(2)) {
  try {
    if(!argv.length)reject('用法: node scripts/model-normalize.mjs <normalize-job.json> [--mock] [--blender <path>] [--timeout-ms <n>]');
    const file=argv[0],opts={};
    for(let i=1;i<argv.length;i++) {
      if(argv[i]==='--mock'){opts.mock=true;continue;}
      if(['--blender','--timeout-ms'].includes(argv[i])&&i+1<argv.length){const key=argv[i++];if(key==='--blender')opts.blender=argv[i];else opts.timeoutMs=Number(argv[i]);continue;}
      reject(`未知或缺值参数 ${argv[i]}`);
    }
    // Libraries emit console diagnostics; keep CLI stdout as one machine-readable report.
    const info=console.info,warn=console.warn;
    console.info=(...args)=>console.error(...args);console.warn=(...args)=>console.error(...args);
    try {console.log(JSON.stringify(normalizeModel(file,opts)));}finally {console.info=info;console.warn=warn;}
    return 0;
  }catch(e){console.error(`[model-normalize] reject: ${e.message}`);return 1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=main();
