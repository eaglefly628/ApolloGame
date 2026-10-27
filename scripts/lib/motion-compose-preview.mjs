// Read-only review of an unpublished M6 candidate through the existing M3 player.
import {readFileSync,writeFileSync,mkdirSync,existsSync,realpathSync,statSync,linkSync} from 'node:fs';
import {resolve,dirname,join,relative,isAbsolute} from 'node:path';
import {libraryPath} from '../motion-library.mjs';
import {check,sha256,validateCatalog,measureMotion,measureSkin} from './motion-catalog.mjs';
import {canonical,validateRecipe} from './motion-compose-recipe.mjs';
import {composeEngine} from './motion-compose-engine.mjs';
function physical(path){path=resolve(path);let p=path;while(!existsSync(p))p=dirname(p);return resolve(realpathSync(p),relative(p,path));}
function confined(root,path){check(realpathSync(root)===root,'review root changed');const p=physical(path),r=relative(root,p);check(!isAbsolute(r)&&r!=='..'&&!r.startsWith('../'),'review path escapes library');return p;}
function read(root,path,expected){path=confined(root,path);check(statSync(path).isFile(),'review input is not a regular file');const bytes=readFileSync(path);if(expected)check(sha256(bytes)===expected,'review source SHA mismatch');return {path,bytes};}
function publishLink(root,source,target,hash){target=confined(root,target);if(existsSync(target)){read(root,target,hash);return;}linkSync(source,target);read(root,target,hash);}
/** Writes an isolated review catalog only; never touches the main catalog, ingest lock or publication receipt. */
export async function prepareComposePreview({lib,evidenceFile}){
 lib=libraryPath(lib);const evidencePath=confined(lib,resolve(evidenceFile));
 const raw=read(lib,evidencePath).bytes;check(raw.length<=1024*1024,'review evidence byte budget');
 const evidence=JSON.parse(raw.toString('utf8'));check(evidence.version===1,'unknown compose evidence version');
 await validateRecipe(evidence.recipe,await composeEngine());
 const recipe=evidence.recipe,recipeSha=sha256(canonical(recipe));check(evidence.recipeSha===recipeSha,'review recipe SHA mismatch');
 check(evidencePath===join(lib,'.compose',recipe.id,recipeSha,'evidence.json'),'noncanonical compose evidence path');
 check(recipe.id!==recipe.base,'candidate id must differ from base');
 check(Number.isFinite(evidence.verification?.maxPositionError)&&Number.isFinite(evidence.verification?.maxRotationError)&&evidence.verification?.maxPositionError>=0&&evidence.verification.maxPositionError<1e-5&&evidence.verification?.maxRotationError>=0&&evidence.verification.maxRotationError<1e-5,'candidate has no passing bake verification');
 const catalog=validateCatalog(JSON.parse(read(lib,join(lib,'catalog.json')).bytes.toString('utf8')));
 const base=catalog.clips.find(r=>r.id===recipe.base),skin=catalog.skins.find(r=>r.id===recipe.skin);check(base&&skin,'review base or skin missing');
 check(base.sha256===evidence.baseSha256&&skin.sha256===evidence.skinSha256,'review source entries changed');
 const baseFile=read(lib,join(lib,base.file),base.sha256),skinFile=read(lib,join(lib,skin.file),skin.sha256);
 const candidate=read(lib,join(dirname(evidencePath),'candidate.glb'),evidence.candidateSha256);
 check(/^[a-f0-9]{64}$/.test(evidence.candidateSha256||''),'missing candidate SHA');
 const measured=await measureMotion(candidate.bytes,recipe.id,recipe.fps);await measureSkin(skinFile.bytes);await measureMotion(baseFile.bytes,base.id,base.fps);
 check(measured.frames===evidence.verification.frames&&measured.frames===Math.round(recipe.fps*recipe.durationS)+1,'candidate verification frame mismatch');
 const entry={...base,id:recipe.id,file:`clips/${recipe.id}.glb`,sha256:sha256(candidate.bytes),...measured,...recipe.annotations,derivedFrom:base.id,status:'draft',provenance:{operation:'compose-preview',reviewOnly:true,recipeSha256:recipeSha,evidenceFile:relative(lib,evidencePath)}};
 const reviewCatalog=validateCatalog({version:1,skins:[skin],clips:[base,entry]});
 const previewLib=confined(lib,join(dirname(evidencePath),'preview'));mkdirSync(previewLib,{recursive:true});check(realpathSync(previewLib)===previewLib,'review directory alias forbidden');
 for(const folder of ['skins','clips'])mkdirSync(confined(previewLib,join(previewLib,folder)),{recursive:true});
 publishLink(previewLib,skinFile.path,join(previewLib,skin.file),skin.sha256);publishLink(previewLib,baseFile.path,join(previewLib,base.file),base.sha256);publishLink(previewLib,candidate.path,join(previewLib,entry.file),entry.sha256);
 const text=JSON.stringify(reviewCatalog,null,2)+'\n',file=confined(previewLib,join(previewLib,'catalog.json'));
 if(existsSync(file))check(read(previewLib,file).bytes.toString('utf8')===text,'existing review catalog differs');else writeFileSync(file,text,{flag:'wx'});
 console.error(`[motion-preview] decision: unpublished candidate ${recipe.id}; review only, no receipt or main catalog publication`);
 return {previewLib,recipeSha,entry,reviewOnly:true};
}
