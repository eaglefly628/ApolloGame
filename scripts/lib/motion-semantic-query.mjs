// Read-only source draft queries. No label, visual or asset approval.
import { readFileSync, lstatSync, realpathSync, openSync, closeSync, fstatSync, constants } from 'node:fs';
import { resolve, join } from 'node:path';
import { readSemanticDrafts } from './motion-semantic-drafts.mjs';
import { getSourceDictionary, getSourceTagDefinition } from './motion-semantics.mjs';
import { sha256, validateCatalog, check } from './motion-catalog.mjs';
const compare=(a,b)=>a<b?-1:a>b?1:0;
const exact=(value,keys)=>check(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&!Object.getOwnPropertySymbols(value).length&&Object.entries(Object.getOwnPropertyDescriptors(value)).every(([key,descriptor])=>keys.includes(key)&&Object.hasOwn(descriptor,'value')),'unknown semantic query field');
function dataArray(value,max){
 check(Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length<=max&&!Object.getOwnPropertySymbols(value).length,'invalid query data array/budget');
 const keys=Object.getOwnPropertyNames(value);
 check(keys.length===value.length+1&&keys.every(key=>key==='length'||/^(?:0|[1-9][0-9]*)$/.test(key)&&Number(key)<value.length)&&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>Object.hasOwn(d,'value')),'non-data/sparse query array');
}
function validateRequest(request){
 exact(request,['expectedCatalogSha256','expectedDictionaryVersion','expectedRevision','expectedHeadSha256','constraints','strict','top']);
 check(typeof request.expectedCatalogSha256==='string'&&/^[a-f0-9]{64}$/.test(request.expectedCatalogSha256),'expected catalog SHA required');
 check(typeof request.expectedDictionaryVersion==='string'&&request.expectedDictionaryVersion.length<=128,'expected dictionary version required');
 check(Number.isSafeInteger(request.expectedRevision)&&request.expectedRevision>=0,'expected revision required');
 check(request.expectedHeadSha256===null||typeof request.expectedHeadSha256==='string'&&/^[a-f0-9]{64}$/.test(request.expectedHeadSha256),'expected head SHA required');
 dataArray(request.constraints,32);check(request.constraints.length>0,'query requires 1..32 constraints');
 check(request.strict===undefined||typeof request.strict==='boolean','invalid strict mode');
 check(request.top===undefined||Number.isSafeInteger(request.top)&&request.top>=1&&request.top<=1000,'invalid query top');
 const seen=new Set(),facets=new Set(getSourceDictionary().facets.map(f=>f.id));
 const constraints=Array.prototype.map.call(request.constraints,constraint=>{
  exact(constraint,['facet','value','mode']);const {facet,value,mode='required'}=constraint;
  check(typeof facet==='string'&&facets.has(facet),'unknown constraint facet');
  check(typeof value==='string'&&/^[a-z0-9][a-z0-9-]{0,127}$/.test(value),'invalid constraint value');
  check(['required','forbidden'].includes(mode),'invalid constraint mode');
  const key=JSON.stringify([facet,value,mode]);check(!seen.has(key),'duplicate constraint');seen.add(key);
  return Object.freeze({facet,value,mode,vocabularyStatus:getSourceTagDefinition(facet,value)?'known':'pending-vocabulary'});
 });
 return Object.freeze({expectedCatalogSha256:request.expectedCatalogSha256,expectedDictionaryVersion:request.expectedDictionaryVersion,expectedRevision:request.expectedRevision,expectedHeadSha256:request.expectedHeadSha256,strict:request.strict??true,top:request.top??20,constraints:Object.freeze(constraints)});
}
function verifyCandidate(lib,row){
 const path=join(lib,row.file);check(realpathSync(path)===path,'symlink candidate path rejected');
 const info=lstatSync(path);check(info.isFile()&&info.size>0&&info.size<=64*1024*1024,'invalid candidate asset size');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try {const actual=fstatSync(fd);check(actual.isFile()&&actual.size===info.size,'candidate changed while opening');check(sha256(readFileSync(fd))===row.sha256,'candidate asset SHA mismatch');}finally{closeSync(fd);}
}
function evaluate(snapshot,byId,request){
 const {constraints}=request;
 const evaluated=snapshot.clips.map(clip=>{
  const row=byId.get(clip.clipId);check(row&&row.sha256===clip.clipSha256&&row.source.fbxSha256===clip.sourceFbxSha256,'snapshot asset identity mismatch');
  const states=constraints.map(constraint=>{
   // Base-reference descriptions describe the old clip, not the generated result.
   const usable=clip.sourceScope==='clip-source';
   const tags=usable?clip.tags.filter(tag=>tag.facet===constraint.facet&&tag.value===constraint.value&&tag.vocabularyStatus==='known'&&tag.status==='draft'):[];
   const evidence=tags.map(tag=>({tagId:tag.tagId,basis:tag.basis,evidence:tag.evidence,status:tag.status,flagEventIds:tag.flagEventIds}));
   const state=tags.length?(constraint.mode==='required'?'supported':'conflict'):'unknown';
   const reason=state!=='unknown'?'explicit-source-claim':constraint.vocabularyStatus!=='known'?'pending-vocabulary':!usable?'base-reference-not-current-evidence':'absence-is-not-counterevidence';
   return {...constraint,state,reason,evidence};
  });
  // Strict mode requires positive evidence for required facts. An unknown prohibition
  // remains unknown (and requires confirmation); only an explicit conflict excludes it.
  const score=states.filter(state=>state.state==='supported').length;
  const conflict=states.some(state=>state.state==='conflict'),unknownRequired=states.some(state=>state.mode==='required'&&state.state==='unknown');
  return {clipId:row.id,file:row.file,clipSha256:row.sha256,assetStatus:row.status,labelStatus:'draft',requiresHumanConfirmation:true,score,constraints:states,
   eligible:!conflict&&score>0&&(!(request.strict??true)||!unknownRequired),exclusionReason:conflict?'explicit-conflict':score===0?'no-supported-requirement':unknownRequired&&(request.strict??true)?'strict-unknown':null};
 });
 const matching=evaluated.filter(row=>row.eligible).sort((a,b)=>b.score-a.score||compare(a.clipId,b.clipId)),selected=matching.slice(0,request.top??20);
 return {schemaVersion:1,status:'draft',catalogSha256:snapshot.catalogSha256,dictionaryVersion:snapshot.dictionaryVersion,head:snapshot.head,
  totalMatches:matching.length,candidates:selected,excluded:evaluated.filter(row=>!row.eligible).sort((a,b)=>compare(a.clipId,b.clipId)),
  missingRequirements:constraints.filter((constraint,i)=>constraint.mode==='required'&&!evaluated.some(row=>row.constraints[i].state==='supported')).map(constraint=>({...constraint,reason:constraint.vocabularyStatus==='known'?'no-supported-source-candidate':'pending-vocabulary'})),
  pendingProposalCount:snapshot.clips.reduce((count,clip)=>count+clip.pendingProposals.length,0),assetVerification:'selected-candidate-SHA-only',integration:'offline-draft-query'};
}

/** All beats use one internally verified snapshot; callers cannot inject an annotation index. */
export async function querySemanticDraftBatch({lib,requests}){
 dataArray(requests,64);check(requests.length>=1,'batch requires 1..64 queries');
 requests=Array.prototype.map.call(requests,validateRequest);
 check(requests.reduce((n,r)=>n+r.constraints.length,0)<=128,'batch constraint budget');
 const snapshot=await readSemanticDrafts({lib});
 for(const request of requests){
  check(snapshot.catalogSha256===request.expectedCatalogSha256,'stale query catalog');
  check(snapshot.dictionaryVersion===request.expectedDictionaryVersion,'stale query dictionary');
  check(snapshot.head.revision===request.expectedRevision&&snapshot.head.eventSha256===request.expectedHeadSha256,'stale query revision');
 }
 const root=resolve(lib),catalogBytes=readFileSync(join(root,'catalog.json'));
 check(sha256(catalogBytes)===snapshot.catalogSha256,'catalog changed during query');
 const catalog=validateCatalog(JSON.parse(catalogBytes)),byId=new Map(catalog.clips.map(row=>[row.id,row]));
 check(snapshot.clips.length===catalog.clips.length&&new Set(snapshot.clips.map(row=>row.clipId)).size===catalog.clips.length,'snapshot coverage mismatch');
 const results=requests.map(request=>evaluate(snapshot,byId,request));
 const verified=new Set();
 for(const result of results)for(const candidate of result.candidates)if(!verified.has(candidate.clipId)){
  verifyCandidate(root,byId.get(candidate.clipId));verified.add(candidate.clipId);
 }
 // The catalog and revision must still match after all selected asset reads.
 const latest=await readSemanticDrafts({lib});
 check(latest.catalogSha256===snapshot.catalogSha256&&latest.dictionaryVersion===snapshot.dictionaryVersion&&latest.head.revision===snapshot.head.revision&&latest.head.eventSha256===snapshot.head.eventSha256,'semantic snapshot changed during query');
 return results;
}
export async function querySemanticDrafts({lib,request}){
 return (await querySemanticDraftBatch({lib,requests:[request]}))[0];
}
