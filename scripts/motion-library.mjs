// Offline ingestion only. Semantic descriptions arrive as reviewed external data.
import { readFileSync, writeFileSync, mkdirSync, existsSync, realpathSync, statSync, renameSync, rmSync, linkSync } from 'node:fs';
import { resolve, dirname, join, relative, isAbsolute, extname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runBlenderJob } from './blender-job.mjs';
import { validateMotionFbx } from './lib/character-fbx.mjs';
import { check, motionId, sha256, validateAnnotations, validateCatalog, measureMotion, measureSkin } from './lib/motion-catalog.mjs';
export { CATEGORIES, EMOTIONS, CONTACTS, ROOT_MOTIONS, standardBoneName, validateAnnotations, validateCatalog } from './lib/motion-catalog.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const log=(kind,message)=>console.error(`[motion-library] ${kind}: ${message}`);
const readJson=p=>JSON.parse(readFileSync(p,'utf8'));
const nested=(base,path)=>{const rel=relative(base,path);return rel===''||(!isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../'));};
function physical(path) {path=resolve(path);let parent=path;while(!existsSync(parent))parent=dirname(parent);return resolve(realpathSync(parent),relative(parent,path));}
export function libraryPath(path) {const real=physical(path);check(!nested(realpathSync(ROOT),real),'library output inside repository is forbidden');for(let parent=real;;parent=dirname(parent)){check(!existsSync(join(parent,'.git')),'library output inside repository is forbidden');if(dirname(parent)===parent)break;}return real;}
function safeFile(base,path) {check(typeof path==='string'&&!isAbsolute(path),'relative file path required');const target=physical(resolve(base,path));check(nested(realpathSync(base),target),'file escapes root');check(statSync(target).isFile(),'input must be a regular file');return target;}
function guardOutput(lib,path) {const target=physical(path);check(nested(lib,target),'output escapes library through a symlink');return target;}
function saveCatalog(lib,catalog) {check(physical(lib)===lib,'library root changed before catalog publication');validateCatalog(catalog);const temp=join(lib,'.catalog.tmp');writeFileSync(temp,JSON.stringify(catalog,null,2)+'\n',{flag:'wx'});try{renameSync(temp,join(lib,'catalog.json'));}finally{rmSync(temp,{force:true});}}
function openCatalog(lib) {return existsSync(join(lib,'catalog.json'))?validateCatalog(readJson(join(lib,'catalog.json'))):{version:1,clips:[],skins:[]};}
export async function validateLibrary(lib) {
  lib=libraryPath(lib);const catalog=openCatalog(lib);check(existsSync(join(lib,'catalog.json')),'catalog.json missing');check(catalog.clips.length+catalog.skins.length>0,'empty catalog');let count=0;
  for(const [kind,rows] of [['clips',catalog.clips],['skins',catalog.skins]]) for(const row of rows) {
    const bytes=readFileSync(safeFile(lib,row.file));check(sha256(bytes)===row.sha256,`SHA mismatch ${row.id}`);
    const measured=kind==='clips'?await measureMotion(bytes,row.id,row.fps):await measureSkin(bytes);
    for(const field of kind==='clips'?['fps','frames','durationS','loop','rootMotion','inPlace']:['hipHeight','pose'])check(typeof measured[field]==='number'?Math.abs(measured[field]-row[field])<1e-5:measured[field]===row[field],`measurement mismatch ${row.id}.${field}`);
    count++;
  }
  log('commit',`validated ${catalog.clips.length} clips and ${catalog.skins.length} skins`);return {ok:true,count};
}
export async function ingestLibrary({from,lib=join(homedir(),'ApolloAssets/motion-lib'),annotations,sourceKind='mixamo',license,blender,skin=false,ids}={}) {
  check(from,'--from is required');from=realpathSync(resolve(from));lib=libraryPath(lib);
  check(!nested(from,lib)&&!nested(lib,from),'source and library roots must not overlap');
  check(sourceKind==='mixamo'||typeof license==='string'&&license.trim(),'non-Mixamo source requires --license');
  const inputFile=join(from,skin?'characters_manifest.json':'manifest.json');const manifest=readJson(inputFile);
  const sourceRows=skin?(manifest.characters||manifest.skins):manifest.clips;check(sourceRows&&typeof sourceRows==='object'&&!Array.isArray(sourceRows),'manifest dictionary missing');
  const notes=skin?null:readJson(annotations||'');
  const selected=Object.entries(sourceRows).filter(([id])=>!ids||ids.includes(id)).sort(([a],[b])=>a.localeCompare(b));
  check(selected.length>0,'no selected source entries');if(ids)check(selected.length===new Set(ids).size,'unknown requested id');
  mkdirSync(lib,{recursive:true});const lock=join(lib,'.ingest.lock');writeFileSync(lock,JSON.stringify({pid:process.pid})+'\n',{flag:'wx'});
  const rejected=[],ingested=[],skipped=[];
  try {
    const catalog=openCatalog(lib),kind=skin?'skins':'clips';
    for(const [rawId,source] of selected) {
      let id=rawId;
      try {
        motionId(id);check(!skin||source.status==='success','skin source status must be success');check(source.mock!==true,'mock source manifest is forbidden');const annotation=skin?null:validateAnnotations(notes[id]);
        const sourceFile=safeFile(from,source.file||source.relativePath);const sourceBytes=readFileSync(sourceFile);const hash=sha256(sourceBytes);
        check(hash===source.sha256,`source SHA mismatch ${id}`);check(source.bytes===undefined||source.bytes===sourceBytes.length,'source bytes mismatch');
        if(!skin&&extname(sourceFile).toLowerCase()==='.fbx'){const structure=validateMotionFbx(sourceBytes);if(structure.unboundCurves)log('decision',`${id}: validated ${structure.curves} FBX curves; ${structure.unboundCurves} unbound exporter curves excluded from active motion`);if(structure.constantDefaultConnections||structure.constantKeyCurves)log('decision',`${id}: ${structure.constantKeyCurves||0} one-key constants; ${structure.constantDefaultConnections||0} missing curve links resolved only by declared finite axis defaults`);}
        const requestSha256=sha256(JSON.stringify({sourceHash:hash,sourceKind,license:license||null,annotation,fps:skin?null:source.download?.fps||30}));
        const old=catalog[kind].find(r=>r.id===id);
        if(old) {check(old.provenance?.requestSha256===requestSha256,'existing id has changed annotations/import settings; use a new id');check(old.source.fbxSha256===hash,'id already belongs to different source bytes');check(sha256(readFileSync(safeFile(lib,old.file)))===old.sha256,'existing output SHA mismatch');log('reject',`skip unchanged ${kind}/${id}`);skipped.push(id);continue;}
        const destination=guardOutput(lib,join(lib,kind,id+'.glb'));check(!existsSync(destination),'unindexed output already exists');
        const work=guardOutput(lib,join(lib,'.ingest-jobs',kind,id,hash));mkdirSync(work,{recursive:true});
        const job={op:skin?'skin-import':'motion-import',inputs:[sourceFile],params:{profile:'apollo-humanoid-v1',...(!skin?{clipId:id,fps:source.download?.fps||30}:{})},outputs:['output.glb']};
        const jobPath=guardOutput(lib,join(work,'job.json'));writeFileSync(jobPath,JSON.stringify(job,null,2)+'\n');
        log('decision',`${job.op} ${id}`);const report=runBlenderJob(jobPath,{...(blender?{blender}:{})});
        const bytes=readFileSync(report.outputs[0].path);const measured=skin?await measureSkin(bytes):await measureMotion(bytes,id,job.params.fps);
        const entry={id,file:`${kind}/${id}.glb`,sha256:sha256(bytes),source:{kind:sourceKind,mixamoName:source.mixamoName||source.name||id,searchTerm:source.searchTerm||source.mixamoName||source.name||id,fbxSha256:hash,manifestSha256:sha256(readFileSync(inputFile)),sourceFile:source.file||source.relativePath,...(license?{license}:{})},...measured,...annotation,derivedFrom:null,status:'draft',provenance:{requestSha256,jobHash:report.jobHash,evidenceDir:report.evidenceDir,validationCarrier:!skin,semanticOrigin:skin?null:sha256(readFileSync(annotations))}};
        mkdirSync(dirname(destination),{recursive:true});
        // Child execution may have changed a path ancestor since preflight.
        check(guardOutput(lib,destination)===destination,'publication destination changed');
        // Hard-link publish is atomic and refuses any existing destination.
        linkSync(report.outputs[0].path,destination);catalog[kind].push(entry);catalog[kind].sort((a,b)=>a.id.localeCompare(b.id));
        try{check(guardOutput(lib,destination)===destination,'publication destination changed');saveCatalog(lib,catalog);}catch(error){catalog[kind]=catalog[kind].filter(r=>r!==entry);rmSync(destination);throw error;}
        ingested.push(id);log('commit',`${kind}/${id} SHA=${entry.sha256} status=draft`);
      }catch(error){rejected.push({id,message:error.message});log('reject',`${id}: ${error.message}`);}
    }
    const result={ok:rejected.length===0,ingested,skipped,rejected};const reportTemp=join(lib,'.last-ingest-report.tmp');writeFileSync(reportTemp,JSON.stringify(result,null,2)+'\n',{flag:'wx'});try{renameSync(reportTemp,join(lib,'last-ingest-report.json'));}finally{rmSync(reportTemp,{force:true});}return result;
  }finally{rmSync(lock,{force:true});}
}
export async function main(argv=process.argv.slice(2)) {
  try {
    const command=argv.shift();
    if(command==='compose')return (await import('./motion-compose.mjs')).main(argv);
    if(command==='variant')return (await import('./motion-variant.mjs')).variantMain(argv);
    const opts={};for(let i=0;i<argv.length;i++){const key=argv[i];check(['--from','--lib','--annotations','--source-kind','--license','--blender','--ids'].includes(key)&&i+1<argv.length,`unknown or missing argument ${key}`);opts[{'--from':'from','--lib':'lib','--annotations':'annotations','--source-kind':'sourceKind','--license':'license','--blender':'blender','--ids':'ids'}[key]]=argv[++i];}
    if(opts.ids)opts.ids=opts.ids.split(',');
    check(['ingest','skin-ingest','validate'].includes(command),'usage: motion-library.mjs ingest|skin-ingest|validate --lib <external library> [--from <source> --annotations <json> --blender <executable>]');
    const result=command==='validate'?await validateLibrary(opts.lib||join(homedir(),'ApolloAssets/motion-lib')):await ingestLibrary({...opts,skin:command==='skin-ingest'});console.log(JSON.stringify(result));return result.ok?0:1;
  }catch(error){log('reject',error.message);return 1;}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))void main().then(code=>{process.exitCode=code;});
