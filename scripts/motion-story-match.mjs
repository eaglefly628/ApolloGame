#!/usr/bin/env node
/** Offline M4: AI supplies explicit constraints; shared source drafts supply evidence. */
import {openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {readSemanticDrafts} from './lib/motion-semantic-drafts.mjs';
import {querySemanticDraftBatch} from './lib/motion-semantic-query.mjs';
import {getSourceDictionary} from './lib/motion-semantics.mjs';

const check=(ok,message)=>{if(!ok)throw new Error('motion story: '+message);};
const exact=(value,keys)=>check(value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&!Object.getOwnPropertySymbols(value).length&&Object.entries(Object.getOwnPropertyDescriptors(value)).every(([key,d])=>keys.includes(key)&&Object.hasOwn(d,'value')),'unknown/non-data field');
const text=(value,max)=>check(typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f]/.test(value),'invalid text');
const sha=value=>check(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),'invalid SHA');
const array=(value,max)=>{
 check(Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype&&value.length<=max&&!Object.getOwnPropertySymbols(value).length,'invalid array/budget');
 const keys=Object.getOwnPropertyNames(value);check(keys.length===value.length+1&&keys.every(key=>key==='length'||/^(?:0|[1-9][0-9]*)$/.test(key)&&Number(key)<value.length)&&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>Object.hasOwn(d,'value')),'non-data/sparse array');
};
const kinds=['motion','interaction','scene','multi-character'];
const needs=['contact','collision','fingers','balance','visual-expression','retargeting','timing'];
function detachStory(story){
 exact(story,['schemaVersion','storyId','title','binding','beats']);
 check(story.schemaVersion===1,'unsupported schema');text(story.storyId,120);text(story.title,240);
 exact(story.binding,['catalogSha256','dictionaryVersion','head']);sha(story.binding.catalogSha256);text(story.binding.dictionaryVersion,128);
 exact(story.binding.head,['revision','eventSha256']);check(Number.isSafeInteger(story.binding.head.revision)&&story.binding.head.revision>=0,'invalid revision');
 if(story.binding.head.eventSha256!==null)sha(story.binding.head.eventSha256);
 array(story.beats,32);check(story.beats.length>=1,'requires 1..32 beats');
 const ids=new Set();let constraints=0;
 for(const beat of story.beats){
  exact(beat,['id','text','kind','constraints','strict','top','verificationNeeds']);text(beat.id,120);text(beat.text,2000);
  check(!ids.has(beat.id),'duplicate beat ID');ids.add(beat.id);check(kinds.includes(beat.kind),'invalid beat kind');
  if(['motion','interaction'].includes(beat.kind)){
   array(beat.constraints,32);check(beat.constraints.length>=1,'motion beat requires constraints');
   for(const constraint of beat.constraints){exact(constraint,['facet','value','mode']);text(constraint.facet,64);text(constraint.value,128);}
   check(beat.constraints.some(c=>c.mode===undefined||c.mode==='required'),'motion beat needs a positive requirement');constraints+=beat.constraints.length;
  }else check(beat.constraints===undefined&&beat.strict===undefined&&beat.top===undefined,'scene/multi-character beats are separate authoring work');
  if(beat.strict!==undefined)check(typeof beat.strict==='boolean','invalid strict');
  if(beat.top!==undefined)check(Number.isSafeInteger(beat.top)&&beat.top>=1&&beat.top<=20,'top requires 1..20');
  if(beat.verificationNeeds!==undefined){array(beat.verificationNeeds,needs.length);check(Array.isArray(beat.verificationNeeds)&&beat.verificationNeeds.length<=needs.length&&new Set(beat.verificationNeeds).size===beat.verificationNeeds.length&&beat.verificationNeeds.every(n=>needs.includes(n)),'invalid verification needs');}
 }
 check(constraints<=64,'story constraint budget');
 const json=JSON.stringify(story);check(Buffer.byteLength(json)<=128*1024,'story byte budget');return JSON.parse(json);
}

/** Read-only binding receipt to pin an AI-authored story request to this catalog/revision. */
export function semanticStoryBinding({lib}){
 const s=readSemanticDrafts({lib});return {catalogSha256:s.catalogSha256,dictionaryVersion:s.dictionaryVersion,head:s.head};
}
/** Metadata audit for AI label review, using the same draft projection as retrieval. */
export function semanticLabelAudit({lib}){
 const s=readSemanticDrafts({lib}),facetCoverage={},reviewReasonCounts={};
 let descriptions=0,multipleActions=0;
 const clips=s.clips.map(c=>{
  if(c.source.description!==null)descriptions++;
  const actions=c.tags.filter(t=>t.facet==='action');if(actions.length>1)multipleActions++;
  for(const facet of new Set(c.tags.map(t=>t.facet)))facetCoverage[facet]=(facetCoverage[facet]??0)+1;
  const reviewReasons=[],informationalWarnings=c.source.warnings.filter(w=>['negated-mention-skipped','opponent-action-not-performed','posture-only-no-behavior-described','passive-action-not-performed','other-performer-mention-skipped'].includes(w));
  const contextOnly=c.source.groups.includes('pose')||c.source.warnings.includes('posture-only-no-behavior-described');
  if(!actions.length&&!contextOnly)reviewReasons.push('no-action-claim-not-proof-of-missing-motion');
  if(c.source.warnings.some(w=>!informationalWarnings.includes(w)))reviewReasons.push('source-extraction-warning');
  if(c.sourceScope==='base-reference')reviewReasons.push('base-reference-not-current-motion-evidence');
  if(c.tags.some(t=>t.flagEventIds.length))reviewReasons.push('flagged-source-claim');
  if(c.pendingProposals.length)reviewReasons.push('pending-tag-proposal');
  for(const reason of reviewReasons)reviewReasonCounts[reason]=(reviewReasonCounts[reason]??0)+1;
  return {...c,reviewReasons,informationalWarnings,contextOnly,labelStatus:'draft',requiresHumanConfirmation:true};
 });
 return {schemaVersion:1,status:'source-label-audit-not-approval',binding:{catalogSha256:s.catalogSha256,dictionaryVersion:s.dictionaryVersion,head:s.head},
  summary:{clips:clips.length,descriptions,titleFallback:clips.length-descriptions,actionRows:facetCoverage.action??0,multipleActions,intentOnlyRows:clips.filter(c=>c.tags.some(t=>t.intentOnly)).length,executionClaimRows:clips.filter(c=>c.tags.some(t=>t.facet==='action'&&!t.intentOnly)).length,contextOnlyRows:clips.filter(c=>c.contextOnly).length,facetCoverage,reviewReasonCounts,attentionRows:clips.filter(c=>c.reviewReasons.length).length,approvedLabels:0},
  clips,assetVerification:'none-metadata-only',writes:false};
}
const sameBinding=(a,b)=>a.catalogSha256===b.catalogSha256&&a.dictionaryVersion===b.dictionaryVersion&&a.head.revision===b.head.revision&&a.head.eventSha256===b.head.eventSha256;
const flagged=row=>row.constraints.some(c=>c.evidence.some(e=>e.flagEventIds.length>0));
function summarizeBeat(beat,result,partial){
 if(!result)return {...beat,status:'separate-authoring',candidates:[],partialReferences:[],gaps:[{kind:'outside-humanoid-query',reason:beat.kind}],authoring:{status:'separate-scope-review',automaticGeneration:false}};
 const excludedByReason={};for(const row of result.excluded)excludedByReason[row.exclusionReason]=(excludedByReason[row.exclusionReason]??0)+1;
 const gaps=result.missingRequirements.map(c=>({kind:c.reason==='source-intent-not-execution'?'intent-not-execution':c.vocabularyStatus==='pending-vocabulary'?'pending-vocabulary':'no-source-evidence',constraint:c}));
 if(result.totalMatches===0&&!gaps.length)gaps.push({kind:result.excluded.some(r=>r.exclusionReason==='explicit-conflict')?'constraints-not-jointly-satisfied':'combination-unproven',reason:'Individual claims do not prove that one clip meets this beat.'});
 const uncertain=result.candidates.flatMap(row=>row.constraints.filter(c=>c.state==='unknown').map(c=>({clipId:row.clipId,...c})));
 const hasFlags=result.candidates.some(flagged);
 const needsSourceReview=result.candidates.some(r=>(r.sourceWarnings??[]).some(w=>['intended-action-phase-unverified','interaction-role-unresolved','ambiguous-posture-sequence'].includes(w)));
 return {id:beat.id,text:beat.text,kind:beat.kind,status:result.totalMatches?(hasFlags?'needs-tag-review':needsSourceReview?'needs-source-review':'source-candidates-only'):'needs-requirement-review',
  strict:beat.strict??true,totalMatches:result.totalMatches,candidates:result.candidates,
  partialReferences:result.totalMatches===0?(partial?.candidates??[]):[],
  evidenceGaps:result.missingRequirements,gaps,uncertainConstraints:uncertain,excludedByReason,
  verificationNeeds:beat.verificationNeeds??[],
  authoring:{status:gaps.length?'review-gap-before-authoring':'review-candidates-before-use',automaticGeneration:false},
  limitations:['Source evidence is a draft; no verified absence, contact, visual or retargeting claim.','No source match is not proof that the motion library lacks this animation.']};
}

/** Never classifies natural-language beat text or returns invented/generated clip identities. */
export async function matchSemanticStory({lib,story}){
 story=detachStory(story);
 const actual=semanticStoryBinding({lib});check(sameBinding(actual,story.binding),'stale story binding');
 const requestBase={expectedCatalogSha256:actual.catalogSha256,expectedDictionaryVersion:actual.dictionaryVersion,expectedRevision:actual.head.revision,expectedHeadSha256:actual.head.eventSha256};
 const requests=[],slots=new Map();
 for(const beat of story.beats)if(['motion','interaction'].includes(beat.kind)){
  const main=requests.length;requests.push({...requestBase,constraints:beat.constraints,strict:beat.strict??true,top:beat.top??5});
  let partial=null;
  if(beat.strict!==false){partial=requests.length;requests.push({...requestBase,constraints:beat.constraints,strict:false,top:beat.top??5});}
  slots.set(beat.id,{main,partial});
 }
 const results=requests.length?await querySemanticDraftBatch({lib,requests}):[];
 // Scene-only stories also reject a catalog/revision that changed during the operation.
 check(sameBinding(actual,semanticStoryBinding({lib})),'story snapshot changed');
 const beats=story.beats.map(beat=>{const slot=slots.get(beat.id);return summarizeBeat(beat,slot?results[slot.main]:null,slot?.partial===null?null:results[slot?.partial]);});
 return {schemaVersion:1,storyId:story.storyId,title:story.title,status:'draft-retrieval-not-story-approval',binding:actual,beats,
  counts:{beats:beats.length,withCandidates:beats.filter(b=>b.candidates.length).length,withoutCandidates:beats.filter(b=>!b.candidates.length).length,withUncertainConstraints:beats.filter(b=>b.uncertainConstraints?.length).length,needingTagReview:beats.filter(b=>b.status==='needs-tag-review').length,needingSourceReview:beats.filter(b=>b.status==='needs-source-review').length,separateAuthoring:beats.filter(b=>b.status==='separate-authoring').length,verifiedStoryBeats:0},
  assetVerification:'returned-full-and-partial-candidate-SHA-only',integration:'offline-story-draft-matcher',writes:false};
}

function readInput(file){
 const fd=openSync(resolve(file),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try {const info=fstatSync(fd);check(info.isFile()&&info.size<=128*1024,'input must be a bounded regular JSON file');const bytes=readFileSync(fd);const after=fstatSync(fd);check(bytes.length===info.size&&after.size===info.size&&after.mtimeMs===info.mtimeMs&&after.ctimeMs===info.ctimeMs,'input changed');return JSON.parse(bytes.toString('utf8'));}finally{closeSync(fd);}
}
export async function main(args=process.argv.slice(2),io={out:console.log,log:console.error}){
 try{
  const command=args[0];check(['dictionary','snapshot','labels','match'].includes(command),'use dictionary | snapshot/labels --lib ROOT | match --lib ROOT --input STORY.json');
  const options={};for(let i=1;i<args.length;i++){const key=args[i];check(['--lib','--input','--version'].includes(key)&&!Object.hasOwn(options,key),'unknown/duplicate option');const value=args[++i];check(typeof value==='string'&&value.trim().length&&!value.startsWith('--'),'missing option value');options[key]=value;}
  if(command==='dictionary')check(Object.keys(options).every(k=>k==='--version'),'dictionary accepts only --version');
  else {check(!options['--version'],'--version is only for dictionary discovery');check(options['--lib'],'explicit --lib required');check(command==='match'?!!options['--input']:!options['--input'],'input required only for match');}
  const result=command==='dictionary'?getSourceDictionary(options['--version']):command==='snapshot'?semanticStoryBinding({lib:options['--lib']}):command==='labels'?semanticLabelAudit({lib:options['--lib']}):await matchSemanticStory({lib:options['--lib'],story:readInput(options['--input'])});
  io.log('[motion-story-match] decision '+JSON.stringify({command,...(result.counts??{}),writes:false}));io.out(JSON.stringify(result,null,2));return 0;
 }catch(error){io.log('[motion-story-match] reject '+JSON.stringify({message:error.message}));return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=await main();
