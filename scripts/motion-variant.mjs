// M5 local-only derived motion publication; all output passes the existing engine gates.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, statSync, renameSync, rmSync, linkSync } from 'node:fs';
import { join, dirname, resolve, relative, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runBlenderJob } from './blender-job.mjs';
import { libraryPath } from './motion-library.mjs';
import { check, motionId, sha256, validateCatalog, measureMotion } from './lib/motion-catalog.mjs';

import { VARIANT_KINDS, validateVariantJob } from './lib/motion-variant-job.mjs';
export { VARIANT_KINDS, validateVariantJob } from './lib/motion-variant-job.mjs';
const log = (kind, message) => console.error(`[motion-variant] ${kind}: ${message}`);
const nested = (base, path) => { const rel=relative(base,path); return rel==='' || (!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../')); };
function physical(path) { path=resolve(path); let parent=path; while(!existsSync(parent))parent=dirname(parent); return resolve(realpathSync(parent),relative(parent,path)); }
function guard(lib,path) { check(physical(lib)===lib,'library root changed'); const target=physical(path);check(nested(lib,target),'variant path escapes library');return target; }
function sourceFile(lib,row) { const file=guard(lib,join(lib,row.file));check(statSync(file).isFile(),'source must be a regular file');return file; }
const readCatalog = lib => validateCatalog(JSON.parse(readFileSync(guard(lib,join(lib,'catalog.json')),'utf8')));
function assertPreservedSource(source, output) {
  const unpack=bytes=>{const n=bytes.readUInt32LE(12);return {doc:JSON.parse(bytes.toString('utf8',20,20+n)),bin:bytes.subarray(28+n)};};
  const a=unpack(source),b=unpack(output);
  for(const field of ['nodes','skins','meshes'])check(JSON.stringify(a.doc[field])===JSON.stringify(b.doc[field]),'variant changed source rest, hierarchy, inverse bind or carrier');
  for(const field of ['accessors','bufferViews'])check(JSON.stringify(a.doc[field])===JSON.stringify(b.doc[field].slice(0,a.doc[field].length)),'variant changed original accessor layout');
  check(b.bin.subarray(0,a.doc.buffers[0].byteLength).equals(a.bin.subarray(0,a.doc.buffers[0].byteLength)),'variant changed original bind/carrier/source data');
}


export async function variantMotion({ id, lib=join(homedir(),'ApolloAssets/motion-lib'), kind, trim, blender, newId }={}) {
  motionId(id);lib=libraryPath(lib);check(VARIANT_KINDS.includes(kind),'unknown variant kind');
  const lock=guard(lib,join(lib,'.ingest.lock'));writeFileSync(lock,JSON.stringify({pid:process.pid,op:'variant'})+'\n',{flag:'wx'});
  try {
    const catalog=readCatalog(lib),source=catalog.clips.find(row=>row.id===id);check(source,'source clip id missing');
    const path=sourceFile(lib,source),bytes=readFileSync(path);check(sha256(bytes)===source.sha256,'source SHA mismatch');
    const measuredSource=await measureMotion(bytes,id,source.fps);check(Math.abs(measuredSource.durationS-source.durationS)<1e-5,'source duration mismatch');
    const recipe={kind,...(trim!==undefined?{trim}:{}),sourceSha256:source.sha256,fps:source.fps};
    const requestSha256=sha256(JSON.stringify(recipe));const targetId=newId||`${id.slice(0,90)}-${kind}-${requestSha256.slice(0,12)}`;motionId(targetId);
    const job=validateVariantJob({op:'motion-variant',inputs:[path],params:{profile:'apollo-humanoid-v1',clipId:targetId,fps:source.fps,kind,...(trim!==undefined?{trim}:{})},outputs:['output.glb']});
    if(kind==='trim')check(trim[1]<=source.durationS+1e-7,'trim exceeds source duration');
    check(!catalog.clips.some(row=>row.id===targetId),'variant id already exists');
    const destination=guard(lib,join(lib,'clips',targetId+'.glb'));check(!existsSync(destination),'variant output already exists');
    const workRoot=guard(lib,join(lib,'.variant-jobs',targetId,requestSha256));mkdirSync(workRoot,{recursive:true});
    let work;
    for(let attempt=1;attempt<=1000000;attempt++) {
      const candidate=guard(lib,join(workRoot,`run-${String(attempt).padStart(6,'0')}`));
      try{mkdirSync(candidate);work=candidate;break;}catch(error){if(error.code!=='EEXIST')throw error;}
    }
    check(work,'variant evidence attempt budget exceeded');
    const jobPath=guard(lib,join(work,'job.json'));writeFileSync(jobPath,JSON.stringify(job,null,2)+'\n',{flag:'wx'});
    log('decision',`${kind} ${id} -> ${targetId}`);
    const report=runBlenderJob(jobPath,{...(blender?{blender}:{})});
    const output=readFileSync(report.outputs[0].path),measured=await measureMotion(output,targetId,source.fps);
    assertPreservedSource(bytes,output);
    const expectedFrames=kind==='trim'?Math.round((trim[1]-trim[0])*source.fps)+1:source.frames;
    check(measured.frames===expectedFrames,'variant frame count mismatch');
    if(kind==='loop-fix')check(measured.loop,'loop-fix failed endpoint validation');
    check(sha256(readFileSync(sourceFile(lib,source)))===source.sha256,'source changed during variant job');
    const contacts=kind==='mirror'?source.contacts.map(c=>c==='left-hand'?'right-hand':c==='right-hand'?'left-hand':c):source.contacts;
    const entry={...source,id:targetId,file:`clips/${targetId}.glb`,sha256:sha256(output),...measured,contacts,derivedFrom:id,status:'draft',
      provenance:{...source.provenance,requestSha256,variant:recipe,jobHash:report.jobHash,evidenceDir:report.evidenceDir,semanticOrigin:'copied-source-requires-review',annotationReviewRequired:true,limitations:kind==='loop-fix'?['endpoint seam correction only; no foot/contact solver']:kind==='mirror'?['metadata descriptions/tags require side review']:[]}};
    // Re-read before publication; the common ingestion lock excludes normal writers.
    const fresh=readCatalog(lib);check(JSON.stringify(fresh)===JSON.stringify(catalog),'catalog changed during variant job');
    const next={...catalog,clips:[...catalog.clips,entry].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};validateCatalog(next);
    mkdirSync(dirname(destination),{recursive:true});check(guard(lib,destination)===destination,'output destination changed');
    const temp=guard(lib,join(lib,`.catalog-${targetId}.tmp`));
    writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});
    let published=false;
    try {
      check(guard(lib,destination)===destination,'output destination changed');linkSync(report.outputs[0].path,destination);published=true;
      check(guard(lib,destination)===destination&&guard(lib,join(lib,'catalog.json'))===join(lib,'catalog.json'),'publication path changed');
      renameSync(temp,join(lib,'catalog.json'));
    }catch(error){if(published)rmSync(destination,{force:true});throw error;}finally{rmSync(temp,{force:true});}
    log('commit',`${targetId} derivedFrom=${id} status=draft`);return {ok:true,id:targetId,derivedFrom:id,entry};
  }catch(error){log('reject',error.message);throw error;}finally{rmSync(lock,{force:true});}
}

export function parseVariantArgs(argv) {
  const [id,...args]=argv;motionId(id);const options={id};let selected=0;const seen=new Set();
  for(let i=0;i<args.length;i++) {
    const key=args[i];check(!seen.has(key),'duplicate variant option');seen.add(key);
    check(['--trim','--mirror','--loop-fix','--lib','--blender','--id'].includes(key),`unknown variant argument ${key}`);
    if(key==='--mirror'||key==='--loop-fix'){options.kind=key.slice(2);selected++;continue;}
    const value=args[++i];check(typeof value==='string'&&value.trim()&&!value.startsWith('--'),`missing value ${key}`);
    if(key==='--trim'){check(/^\d+(?:\.\d+)?,\d+(?:\.\d+)?$/.test(value),'trim requires start,end seconds');options.kind='trim';options.trim=value.split(',').map(Number);selected++;}
    else options[{'--lib':'lib','--blender':'blender','--id':'newId'}[key]]=value;
  }
  check(selected===1,'select exactly one --trim, --mirror or --loop-fix');return options;
}
export async function variantMain(argv=process.argv.slice(2)) {
  try {const result=await variantMotion(parseVariantArgs(argv));console.log(JSON.stringify(result));return 0;}catch(error){log('reject',error.message);return 1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.exitCode=await variantMain();
