// Internal pure semantic validator; only bounded stdin/stdout IPC, no library path access.
import {createHash} from 'node:crypto';
import {readSync,writeSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {validateCatalog} from './motion-catalog.mjs';
import {DICTIONARY_VERSION,sourceSemantics,getSourceDictionary,getSourceTagDefinition,validateSourceEvidence} from './motion-semantics.mjs';
export const SEMANTIC_DRAFT_LIMITS=Object.freeze({catalogBytes:32*1024*1024,clips:10000,logBytes:8*1024*1024,events:20000,eventBytes:16384,requestBytes:8192});
const check=(ok,message)=>{if(!ok)throw new Error(`semantic drafts: ${message}`);};
const hash=value=>createHash('sha256').update(value).digest('hex');
function canonical(value,seen=new Set(),depth=0){
  check(depth<=12,'JSON nesting budget');
  if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
  if(typeof value==='number'){check(Number.isFinite(value),'nonfinite JSON');return JSON.stringify(value);}
  check(value&&typeof value==='object'&&!seen.has(value),'invalid JSON value/cycle');seen.add(value);
  let text;if(Array.isArray(value))text='['+Array.from(value,child=>canonical(child,seen,depth+1)).join(',')+']';
  else{check([Object.prototype,null].includes(Object.getPrototypeOf(value)),'nonplain JSON');check(!Object.getOwnPropertySymbols(value).length,'symbol JSON keys');text='{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key],seen,depth+1)).join(',')+'}';}seen.delete(value);return text;
}
const digest=value=>hash(canonical(value));
function knownVersion(version){check(typeof version==='string'&&version.length>0&&version.length<=128,'invalid dictionary version');return getSourceDictionary(version).dictionaryVersion;}
function snapshotVersion(snapshot,catalogSha256,requested){
 if(requested!==undefined)knownVersion(requested);
 if(snapshot.dictionaryPinText!==undefined&&snapshot.dictionaryPinText!==null)check(typeof snapshot.dictionaryPinText==='string'&&Buffer.byteLength(snapshot.dictionaryPinText)<=SEMANTIC_DRAFT_LIMITS.catalogBytes&&snapshot.headText===null,'invalid dictionary pin snapshot');
 let stored;
 if(snapshot.headText!==null)stored=knownVersion(JSON.parse(snapshot.headText).dictionaryVersion);
 else if(snapshot.dictionaryPinText!==undefined&&snapshot.dictionaryPinText!==null){
  const receipt=JSON.parse(snapshot.dictionaryPinText);
  check(receipt&&receipt.schemaVersion===1&&receipt.lineageVersion===1&&receipt.kind==='semantic-draft-migration'&&receipt.status==='draft'&&receipt.approval==='not-supported','invalid dictionary pin receipt');
  check(receipt.binding&&receipt.binding.targetCatalogSha256===catalogSha256,'dictionary pin catalog changed');
  record(receipt.target,['head','logSha256','headSha256'],'dictionary pin target');record(receipt.target.head,['revision','eventSha256'],'dictionary pin head');
  check(snapshot.logText===null&&receipt.target.head.revision===0&&receipt.target.head.eventSha256===null&&receipt.target.logSha256===null&&receipt.target.headSha256===null,'dictionary pin requires an archive-only zero-event receipt');
  stored=knownVersion(receipt.binding.dictionaryVersion);
 }
 check(requested===undefined||stored===undefined||stored===requested,'dictionary version conflict with existing history');
 return stored??requested??DICTIONARY_VERSION;
}
function record(value,keys,name){check(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value)),`invalid ${name}`);check(!Object.getOwnPropertySymbols(value).length&&Object.keys(value).every(key=>keys.includes(key))&&keys.every(key=>Object.hasOwn(value,key)),`invalid ${name} fields`);}
function text(value,max,name){check(typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value),`invalid ${name}`);}
function sha(value,name){check(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),`invalid ${name}`);}
function identity(row,catalogSha256,dictionaryVersion){const source=sourceSemantics(row,{dictionaryVersion}),base={schemaVersion:1,catalogSha256,dictionaryVersion,clipId:row.id,clipSha256:row.sha256,sourceFbxSha256:row.source.fbxSha256,source};const baseSnapshotSha256=digest(base),scope=row.derivedFrom?'base-reference':'clip-source';return {clipId:row.id,clipSha256:row.sha256,sourceFbxSha256:row.source.fbxSha256,assetStatus:row.status,baseSnapshotSha256,sourceScope:scope,source,tags:source.claims.map(claim=>({tagId:'source-'+digest({baseSnapshotSha256,claim}),facet:claim.facet,value:claim.value,label:claim.label,evidence:{source:claim.source,quote:claim.quote,start:claim.start,end:claim.end},basis:scope==='base-reference'?'base-source-reference':'source-text',vocabularyStatus:'known',status:'draft',flagEventIds:[],...(claim.intentOnly?{intentOnly:true}:{})})),pendingProposals:[]};}
function requestShape(request){const common=['eventId','expectedRevision','catalogSha256','dictionaryVersion','clipId','clipSha256','sourceFbxSha256','baseSnapshotSha256','reason','actor','operation'];check(request&&typeof request==='object','invalid request');check(['propose','flag'].includes(request.operation),'operation not implemented (only propose/flag)');record(request,[...common,request.operation==='propose'?'tag':'targetTagId'],'request');
  check(Buffer.byteLength(canonical(request))<=SEMANTIC_DRAFT_LIMITS.requestBytes,'request byte budget');text(request.eventId,120,'eventId');check(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(request.eventId),'invalid eventId');check(Number.isSafeInteger(request.expectedRevision)&&request.expectedRevision>=0&&request.expectedRevision<SEMANTIC_DRAFT_LIMITS.events,'invalid expectedRevision');
  for(const key of ['catalogSha256','clipSha256','sourceFbxSha256','baseSnapshotSha256'])sha(request[key],key);knownVersion(request.dictionaryVersion);text(request.clipId,120,'clipId');text(request.reason,2000,'reason');record(request.actor,['kind','id'],'actor');check(['ai','human','tool'].includes(request.actor.kind),'invalid actor kind');text(request.actor.id,120,'actor id');
  if(request.operation==='propose'){record(request.tag,['facet','value','evidence'],'tag');text(request.tag.facet,64,'facet');text(request.tag.value,128,'value');check(getSourceDictionary(request.dictionaryVersion).facets.some(facet=>facet.id===request.tag.facet),'unknown facet');record(request.tag.evidence,['source','quote','start','end'],'evidence');}
  else check(typeof request.targetTagId==='string'&&/^(source|proposal)-[a-f0-9]{64}$/.test(request.targetTagId),'invalid targetTagId');return request;
}
function bindRequest(request,context){requestShape(request);check(request.catalogSha256===context.catalogSha256,'catalog changed');check(request.dictionaryVersion===context.dictionaryVersion,'dictionary version mismatch');const clip=context.clips.find(row=>row.clipId===request.clipId);check(clip,'unknown clip ID');check(clip.clipSha256===request.clipSha256&&clip.sourceFbxSha256===request.sourceFbxSha256,'asset SHA mismatch');check(clip.baseSnapshotSha256===request.baseSnapshotSha256,'base snapshot mismatch');if(request.operation==='propose')validateSourceEvidence(context.rows.get(clip.clipId),request.tag.evidence);return clip;}
function projectEvent(context,event){const request=event.request,clip=bindRequest(request,context);if(request.operation==='propose'){const definition=getSourceTagDefinition(request.tag.facet,request.tag.value,context.dictionaryVersion);clip.pendingProposals.push({tagId:'proposal-'+digest({clipId:clip.clipId,eventId:request.eventId,tag:request.tag}),eventId:request.eventId,...request.tag,label:definition?.defaultLabel??null,basis:'proposal',vocabularyStatus:definition?'known':'pending-vocabulary',status:'draft',flagEventIds:[]});}
  else{const tag=[...clip.tags,...clip.pendingProposals].find(tag=>tag.tagId===request.targetTagId);check(tag,'flag target absent or cross-clip');tag.flagEventIds.push(request.eventId);}}
function load(snapshot,{dictionaryVersion}={}){record(snapshot,['catalogText','logText','headText','nextPresent',...(Object.hasOwn(snapshot??{},'dictionaryPinText')?['dictionaryPinText']:[])],'snapshot');check(typeof snapshot.catalogText==='string'&&Buffer.byteLength(snapshot.catalogText)<=SEMANTIC_DRAFT_LIMITS.catalogBytes,'catalog byte budget');check(snapshot.logText===null||typeof snapshot.logText==='string'&&Buffer.byteLength(snapshot.logText)<=SEMANTIC_DRAFT_LIMITS.logBytes,'log byte budget');check(snapshot.headText===null||typeof snapshot.headText==='string'&&Buffer.byteLength(snapshot.headText)<=4096,'head byte budget');check(typeof snapshot.nextPresent==='boolean','invalid head.next state');const bytes=Buffer.from(snapshot.catalogText,'utf8'),raw=JSON.parse(snapshot.catalogText);check(Array.isArray(raw.clips)&&raw.clips.length<=SEMANTIC_DRAFT_LIMITS.clips,'catalog clip budget');const catalog=validateCatalog(raw);for(const row of catalog.clips)check(row.derivedFrom===null||typeof row.derivedFrom==='string'&&/^[a-z0-9][a-z0-9-]{0,119}$/.test(row.derivedFrom),'invalid derivedFrom stable ID');const catalogSha256=hash(bytes),selectedVersion=snapshotVersion(snapshot,catalogSha256,dictionaryVersion),context={schemaVersion:1,status:'draft',catalogSha256,dictionaryVersion:selectedVersion,head:{revision:0,eventSha256:null},clips:catalog.clips.map(row=>identity(row,catalogSha256,selectedVersion)),events:[],rows:new Map(catalog.clips.map(row=>[row.id,row]))};
  check(!snapshot.nextPresent,'interrupted head publication');if(snapshot.logText===null){check(snapshot.headText===null,'head exists but log missing');return context;}
  const log=Buffer.from(snapshot.logText,'utf8');check(!log.length||log.at(-1)===10,'partial log record');const lines=log.length?log.toString('utf8').slice(0,-1).split('\n'):[];check(lines.length<=SEMANTIC_DRAFT_LIMITS.events,'event count budget');check(snapshot.headText!==null,'existing log missing published head');const anchor=JSON.parse(snapshot.headText);record(anchor,['schemaVersion','catalogSha256','dictionaryVersion','revision','eventSha256'],'head');check(anchor.schemaVersion===1,'unknown head version');check(anchor.catalogSha256===catalogSha256,'head catalog changed');check(anchor.dictionaryVersion===context.dictionaryVersion,'head dictionary version mismatch');check(Number.isSafeInteger(anchor.revision)&&anchor.revision>=1,'invalid head revision');sha(anchor.eventSha256,'head eventSha256');const ids=new Set();
  for(const line of lines){check(Buffer.byteLength(line)<=SEMANTIC_DRAFT_LIMITS.eventBytes,'event byte budget');const event=JSON.parse(line);record(event,['schemaVersion','revision','prevEventSha256','requestSha256','request','eventSha256'],'event');check(event.schemaVersion===1,'unknown event version');check(event.revision===context.head.revision+1&&event.prevEventSha256===context.head.eventSha256,'event chain mismatch');sha(event.eventSha256,'eventSha256');const {eventSha256,...body}=event;check(digest(body)===eventSha256&&digest(event.request)===event.requestSha256,'event hash mismatch');check(!ids.has(event.request.eventId),'duplicate event ID');check(event.request.expectedRevision===context.head.revision,'recorded revision conflict');projectEvent(context,event);ids.add(event.request.eventId);context.events.push(event);context.head={revision:event.revision,eventSha256};}
  check(anchor.revision===context.head.revision&&anchor.eventSha256===context.head.eventSha256,'published head does not match log tail');
  return context;
}

export function validateDraftSnapshot(input){
 const context=load(input.snapshot,{dictionaryVersion:input.action==='append'?input.request?.dictionaryVersion:input.dictionaryVersion});if(input.action==='read'){const {rows,...snapshot}=context;return {result:snapshot,commit:null};}
 check(input.action==='append','invalid internal action');requestShape(input.request);const request=JSON.parse(canonical(input.request)),requestSha256=digest(request),previous=context.events.find(event=>event.request.eventId===request.eventId);
 if(previous){check(previous.requestSha256===requestSha256,'event ID reused with different content');return {result:{status:'draft',idempotent:true,event:previous,head:context.head},commit:null};}
 check(request.expectedRevision===context.head.revision,'revision conflict');check(context.events.length<SEMANTIC_DRAFT_LIMITS.events,'event count budget');const body={schemaVersion:1,revision:context.head.revision+1,prevEventSha256:context.head.eventSha256,requestSha256,request},event={...body,eventSha256:digest(body)};projectEvent(context,event);const line=canonical(event)+'\n';check(Buffer.byteLength(line)<=SEMANTIC_DRAFT_LIMITS.eventBytes,'event byte budget');check(Buffer.byteLength(input.snapshot.logText??'')+Buffer.byteLength(line)<=SEMANTIC_DRAFT_LIMITS.logBytes,'log byte budget');
 const anchor={schemaVersion:1,catalogSha256:context.catalogSha256,dictionaryVersion:context.dictionaryVersion,revision:event.revision,eventSha256:event.eventSha256};return {result:{status:'draft',idempotent:false,event,head:{revision:event.revision,eventSha256:event.eventSha256}},commit:{eventLine:line,headText:canonical(anchor)+'\n'}};
}

// Bound inherited evidence independently of the current catalog/log budgets.
const migrationLimits=JSON.parse(readFileSync(new URL('./motion-semantic-migrate-limits.json',import.meta.url),'utf8'));
check(Object.keys(migrationLimits).sort().join(',')==='bytes,files,generations'&&Object.values(migrationLimits).every(value=>Number.isSafeInteger(value)&&value>0),'invalid migration history limits');
export const SEMANTIC_MIGRATION_HISTORY_LIMITS=Object.freeze(migrationLimits);
function migrationHistoryFiles(history){
 const files=new Map(),seen=new Set();let prefix='',total=0,generations=0;
 const add=(path,value,limit)=>{check(typeof value==='string'&&Buffer.byteLength(value)<=limit,'migration history file byte budget');total+=Buffer.byteLength(value);check(total<=SEMANTIC_MIGRATION_HISTORY_LIMITS.bytes,'migration history total byte budget');files.set(path,value);check(files.size<=SEMANTIC_MIGRATION_HISTORY_LIMITS.files,'migration history file count budget');};
 for(let node=history;node!==null;node=node.parent){
  // Inherited receipts plus this pending migration may contain at most eight generations.
  check(!seen.has(node),'migration history cycle');seen.add(node);check(++generations+1<=SEMANTIC_MIGRATION_HISTORY_LIMITS.generations,'migration history generation budget');
  record(node,['receiptText','snapshot','parent'],'migration history');record(node.snapshot,['catalogText','logText','headText','nextPresent',...(Object.hasOwn(node.snapshot??{},'dictionaryPinText')?['dictionaryPinText']:[])],'migration historical snapshot');
  add(prefix+'migration-receipt.json',node.receiptText,32*1024*1024);
  for(const [key,name,limit] of [['catalogText','catalog.json',SEMANTIC_DRAFT_LIMITS.catalogBytes],['logText','drafts.jsonl',SEMANTIC_DRAFT_LIMITS.logBytes],['headText','head.json',4096]])if(node.snapshot[key]!==null)add(prefix+'migration-archive/'+name,node.snapshot[key],limit);
  prefix+='migration-archive/parent-migration/';
 }
 return files;
}
function validateMigrationHistory(history,currentSnapshot,currentContext){
 if(history===null)return;
 const receipt=JSON.parse(history.receiptText);
 check(receipt?.lineageVersion===1,'unsupported migration lineage version; preserve historical artifacts for operator review');
 check(knownVersion(receipt.binding?.dictionaryVersion)===currentContext.dictionaryVersion,'migration history dictionary version mismatch');
 // Reconstruct each historical decision from its exact archive, through this same planner.
 const prior=planSemanticDraftMigration({sourceSnapshot:history.snapshot,targetSnapshot:{catalogText:currentSnapshot.catalogText,logText:null,headText:null,nextPresent:false},sourceHistory:history.parent,sourceDictionaryVersion:currentContext.dictionaryVersion,expected:receipt.binding});
 check(prior.commit.receiptText===history.receiptText,'migration history receipt mismatch');
 const count=prior.result.target.head.revision;
 check(count<=currentContext.events.length,'migration history target head exceeds current history');
 const prefix=count===0?null:currentSnapshot.logText.split('\n').slice(0,count).join('\n')+'\n';
 check(prefix===prior.commit.logText,'migration history target log prefix mismatch');
}
/** Pure, draft-only migration. Both catalogs/chains use the exact same validator as read/append. */
export function planSemanticDraftMigration({sourceSnapshot,targetSnapshot,sourceHistory=null,sourceDictionaryVersion,expected=null}){
 const inherited=migrationHistoryFiles(sourceHistory),source=load(sourceSnapshot,{dictionaryVersion:sourceDictionaryVersion}),target=load(targetSnapshot,{dictionaryVersion:source.dictionaryVersion});
 validateMigrationHistory(sourceHistory,sourceSnapshot,source);
 check(targetSnapshot.logText===null&&targetSnapshot.headText===null&&!targetSnapshot.nextPresent,'migration target must have no draft history');
 const binding={sourceCatalogSha256:source.catalogSha256,sourceHead:source.head,targetCatalogSha256:target.catalogSha256,dictionaryVersion:source.dictionaryVersion};
 if(inherited.size)binding.sourceHistorySha256=digest([...inherited].map(([path,text])=>({path,sha256:hash(Buffer.from(text)),bytes:Buffer.byteLength(text)})));
 if(expected!==null){
  record(expected,Object.keys(binding),'migration binding');
  record(expected.sourceHead,['revision','eventSha256'],'migration source head');
  check(canonical(expected)===canonical(binding),'stale migration binding');
 }
 check(source.dictionaryVersion===target.dictionaryVersion,'migration dictionary mismatch');
 const classification={unchanged:[],changed:[],deleted:[],added:[]};
 for(const [id,row] of source.rows){const next=target.rows.get(id);classification[next===undefined?'deleted':canonical(row)===canonical(next)?'unchanged':'changed'].push(id);}
 for(const id of target.rows.keys())if(!source.rows.has(id))classification.added.push(id);
 for(const ids of Object.values(classification))ids.sort();
 const unchanged=new Set(classification.unchanged),deleted=new Set(classification.deleted),tagIds=new Map(),targetClips=new Map(target.clips.map(clip=>[clip.clipId,clip]));
 for(const old of source.clips){if(!unchanged.has(old.clipId))continue;const next=targetClips.get(old.clipId);check(old.tags.length===next.tags.length,'migration source tag coverage');for(let i=0;i<old.tags.length;i++)tagIds.set(old.tags[i].tagId,next.tags[i].tagId);}
 const eventMap=[],needsReview=[],lines=[];
 for(const old of source.events){
  if(!unchanged.has(old.request.clipId)){needsReview.push({eventId:old.request.eventId,eventSha256:old.eventSha256,clipId:old.request.clipId,operation:old.request.operation,reason:deleted.has(old.request.clipId)?'clip-deleted':'clip-changed'});continue;}
  const clip=targetClips.get(old.request.clipId),request={...JSON.parse(canonical(old.request)),eventId:'migrated-'+old.eventSha256,expectedRevision:target.head.revision,catalogSha256:target.catalogSha256,dictionaryVersion:target.dictionaryVersion,clipSha256:clip.clipSha256,sourceFbxSha256:clip.sourceFbxSha256,baseSnapshotSha256:clip.baseSnapshotSha256};
  if(request.operation==='flag'){check(tagIds.has(request.targetTagId),'migration flag target mapping missing');request.targetTagId=tagIds.get(request.targetTagId);}
  requestShape(request);const requestSha256=digest(request),body={schemaVersion:1,revision:target.head.revision+1,prevEventSha256:target.head.eventSha256,requestSha256,request},event={...body,eventSha256:digest(body)};
  projectEvent(target,event);target.head={revision:event.revision,eventSha256:event.eventSha256};target.events.push(event);
  const mapping={clipId:clip.clipId,operation:request.operation,sourceEventId:old.request.eventId,sourceEventSha256:old.eventSha256,targetEventId:request.eventId,targetEventSha256:event.eventSha256};
  if(request.operation==='propose'){
   const oldTagId='proposal-'+digest({clipId:clip.clipId,eventId:old.request.eventId,tag:old.request.tag}),newTagId=clip.pendingProposals.at(-1).tagId;
   tagIds.set(oldTagId,newTagId);mapping.sourceTagId=oldTagId;mapping.targetTagId=newTagId;
  }else{mapping.sourceTagId=old.request.targetTagId;mapping.targetTagId=request.targetTagId;}
  eventMap.push(mapping);const line=canonical(event)+'\n';check(Buffer.byteLength(line)<=SEMANTIC_DRAFT_LIMITS.eventBytes,'migration event byte budget');lines.push(line);
 }
 const logText=lines.length?lines.join(''):null;
 check(logText===null||Buffer.byteLength(logText)<=SEMANTIC_DRAFT_LIMITS.logBytes,'migration log byte budget');
 const headText=lines.length?canonical({schemaVersion:1,catalogSha256:target.catalogSha256,dictionaryVersion:target.dictionaryVersion,...target.head})+'\n':null;
 // Re-read the whole new chain using the production validator, without fabricating revision-zero files.
 load({catalogText:targetSnapshot.catalogText,logText,headText,nextPresent:false},{dictionaryVersion:target.dictionaryVersion});
 const archiveFiles={};for(const [name,text] of [['catalog.json',sourceSnapshot.catalogText],['drafts.jsonl',sourceSnapshot.logText],['head.json',sourceSnapshot.headText]])if(text!==null)archiveFiles[name]={sha256:hash(Buffer.from(text)),bytes:Buffer.byteLength(text)};
 for(const [path,text] of inherited)archiveFiles['parent-migration/'+path]={sha256:hash(Buffer.from(text)),bytes:Buffer.byteLength(text)};
 const counts={sourceEvents:source.events.length,migratedEvents:eventMap.length,needsReviewEvents:needsReview.length};
 const receipt={schemaVersion:1,lineageVersion:1,status:'draft',kind:'semantic-draft-migration',binding,classification,counts,eventMap,needsReview,archive:{directory:'migration-archive',files:archiveFiles},target:{head:target.head,logSha256:logText===null?null:hash(logText),headSha256:headText===null?null:hash(headText)},approval:'not-supported'};
 const receiptText=canonical(receipt)+'\n';
 return {result:{...receipt,receiptSha256:hash(receiptText)},commit:{logText,headText,receiptText}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const chunks=[];let size=0,count;const buffer=Buffer.alloc(65536);while((count=readSync(0,buffer,0,buffer.length,null))>0){size+=count;check(size<=128*1024*1024,'internal IPC byte budget');chunks.push(Buffer.from(buffer.subarray(0,count)));}const input=JSON.parse(Buffer.concat(chunks).toString('utf8')),result=input.action==='migrate'?planSemanticDraftMigration(input):validateDraftSnapshot(input),output=Buffer.from(JSON.stringify(result));check(output.length<=96*1024*1024,'internal output budget');let offset=0;while(offset<output.length)offset+=writeSync(1,output,offset,output.length-offset);}
 catch(error){process.stderr.write(String(error));process.exitCode=2;}
}
