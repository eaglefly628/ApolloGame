import {describe,it,expect,afterEach} from 'vitest';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha256} from './lib/motion-catalog.mjs';
import {appendSemanticDraft,readSemanticDrafts} from './lib/motion-semantic-drafts.mjs';
import {querySemanticDraftBatch,querySemanticDrafts} from './lib/motion-semantic-query.mjs';
import {matchSemanticStory,semanticStoryBinding,semanticLabelAudit,main} from './motion-story-match.mjs';
const roots=[];afterEach(()=>roots.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));
const row=(id,description,extra={})=>({id,file:`clips/${id}.glb`,sha256:sha256(Buffer.from(id)),source:{kind:'fixture',license:'synthetic',fbxSha256:'b'.repeat(64),searchTerm:'Synthetic',mixamoName:'Same title',description},fps:30,frames:61,durationS:2,loop:false,inPlace:true,rootMotion:'none',category:'pose',emotion:['neutral'],contacts:[],intensity:1,descZh:'合成',descEn:'Synthetic fixture',tags:[],derivedFrom:null,status:'confirmed',...extra});
function fixture(...clips){const lib=mkdtempSync(join(realpathSync(tmpdir()),'story-match-'));roots.push(lib);mkdirSync(join(lib,'clips'));for(const c of clips)writeFileSync(join(lib,c.file),c.id);writeFileSync(join(lib,'catalog.json'),JSON.stringify({version:1,clips,skins:[]}));writeFileSync(join(lib,'source.fbx'),'synthetic unchanged original');return lib;}
const beat=(constraints,extra={})=>({id:'beat-1',text:'剧情文字不参与偷偷分类',kind:'motion',constraints,...extra});
const action=(value,mode)=>({facet:'action',value,...(mode?{mode}:{})});
const story=(lib,beats)=>({schemaVersion:1,storyId:'synthetic-story',title:'合成故事',binding:semanticStoryBinding({lib}),beats});
function flag(lib,clipId='walk'){
 const s=readSemanticDrafts({lib}),c=s.clips.find(c=>c.clipId===clipId);
 return appendSemanticDraft({lib,request:{eventId:'flag-walk',expectedRevision:s.head.revision,catalogSha256:s.catalogSha256,dictionaryVersion:s.dictionaryVersion,clipId,clipSha256:c.clipSha256,sourceFbxSha256:c.sourceFbxSha256,baseSnapshotSha256:c.baseSnapshotSha256,reason:'Synthetic needs review',actor:{kind:'human',id:'fixture'},operation:'flag',targetTagId:c.tags.find(t=>t.value==='walk').tagId}});
}
const io=()=>({outputs:[],logs:[],out(text){this.outputs.push(text);},log(text){this.logs.push(text);}});

describe('M4 offline evidence-based story matching',()=>{
 it('uses Description evidence and leaves originals and old defaults untouched',async()=>{
  const lib=fixture(row('walk','Walking forward'),row('run','Running'));
  const files=['catalog.json','source.fbx','clips/walk.glb','clips/run.glb'],before=files.map(p=>readFileSync(join(lib,p)));
  const result=await matchSemanticStory({lib,story:story(lib,[beat([action('walk'),action('run','forbidden')])])});
  expect(result.beats[0]).toMatchObject({status:'source-candidates-only',totalMatches:1});
  expect(result.beats[0].candidates[0]).toMatchObject({clipId:'walk',labelStatus:'draft',requiresHumanConfirmation:true});
  expect(result.beats[0].candidates[0].constraints[0].evidence[0].evidence.quote).toBe('Walking');
  expect(result.beats[0].uncertainConstraints[0]).toMatchObject({value:'run',state:'unknown'});
  expect(result.counts.verifiedStoryBeats).toBe(0);expect(result.writes).toBe(false);
  files.forEach((p,i)=>expect(readFileSync(join(lib,p))).toEqual(before[i]));expect(readdirSync(lib).sort()).toEqual(['catalog.json','clips','source.fbx']);
 });
 it('separates unknown neutral/contact and partial references from whole-beat candidates',async()=>{
  const lib=fixture(row('walk','Walking forward'));
  const result=await matchSemanticStory({lib,story:story(lib,[beat([action('walk'),{facet:'emotion',value:'neutral'},{facet:'contact',value:'hands'}])])});
  const b=result.beats[0];expect(b.candidates).toEqual([]);expect(b.partialReferences.map(r=>r.clipId)).toEqual(['walk']);
  expect(b.evidenceGaps.map(c=>c.value)).toEqual(['neutral','hands']);expect(b.authoring.automaticGeneration).toBe(false);
 });
 it('returns no partial references when a complete candidate and a partial candidate coexist',async()=>{
  const lib=fixture(row('complete','Walking then running'),row('partial','Walking'));
  const s=story(lib,[beat([action('walk'),action('run')])]);
  const partial=await querySemanticDrafts({lib,request:{expectedCatalogSha256:s.binding.catalogSha256,expectedDictionaryVersion:s.binding.dictionaryVersion,expectedRevision:s.binding.head.revision,expectedHeadSha256:s.binding.head.eventSha256,constraints:s.beats[0].constraints,strict:false}});
  expect(partial.candidates.map(c=>c.clipId)).toEqual(['complete','partial']);
  expect(partial.candidates[1].constraints.map(c=>c.state)).toEqual(['supported','unknown']);
  const result=await matchSemanticStory({lib,story:s});
  expect(result.beats[0].candidates.map(c=>c.clipId)).toEqual(['complete']);
  expect(result.beats[0].partialReferences).toEqual([]);
 });
 it('reports a joint-combination gap even though individual requirements exist',async()=>{
  const lib=fixture(row('walk','Walking'),row('run','Running'));
  const result=await matchSemanticStory({lib,story:story(lib,[beat([action('walk'),action('run')])])});
  const b=result.beats[0];expect(b.candidates).toEqual([]);expect(b.evidenceGaps).toEqual([]);expect(b.gaps.map(g=>g.kind)).toEqual(['combination-unproven']);expect(b.partialReferences).toHaveLength(2);
 });
 it('separates explicit conflicts and pending vocabulary from invented library motions',async()=>{
  const lib=fixture(row('both','Walking then running'));
  const result=await matchSemanticStory({lib,story:story(lib,[beat([action('walk'),action('run','forbidden')]),beat([action('synthetic-strike-match')],{id:'missing'})])});
  expect(result.beats[0].candidates).toEqual([]);expect(result.beats[0].excludedByReason['explicit-conflict']).toBe(1);
  expect(result.beats[0].gaps[0].kind).toBe('constraints-not-jointly-satisfied');
  expect(result.beats[1].gaps[0].kind).toBe('pending-vocabulary');expect(result.beats[1].candidates).toEqual([]);
 });
 it('keeps flagged evidence visibly pending tag review without turning flags into approval',async()=>{
  const lib=fixture(row('walk','Walking'));flag(lib);
  const result=await matchSemanticStory({lib,story:story(lib,[beat([action('walk')])])});
  expect(result.beats[0].status).toBe('needs-tag-review');expect(result.beats[0].candidates[0].constraints[0].evidence[0].flagEventIds).toEqual(['flag-walk']);expect(result.counts.verifiedStoryBeats).toBe(0);
 });
 it('uses shared negation, pose and derived-source restrictions',async()=>{
  const lib=fixture(row('negated','Not walking forward.'),row('pose','Walking forward',{frames:2,durationS:1/30,source:{...row('x','').source,mixamoName:'Walking Pose',description:'Walking forward'}}),row('derived','Walking forward',{derivedFrom:'synthetic-base'}));
  const result=await matchSemanticStory({lib,story:story(lib,[beat([action('walk')])])});expect(result.beats[0].candidates).toEqual([]);expect(result.beats[0].partialReferences).toEqual([]);
 });
 it('keeps scene and multi-character work outside humanoid retrieval',async()=>{
  const lib=fixture(row('walk','Walking'));
  const result=await matchSemanticStory({lib,story:story(lib,[{id:'goose',text:'烤鹅走来',kind:'scene'},{id:'lift',text:'奶奶抱起女孩',kind:'multi-character'}])});
  expect(result.counts).toMatchObject({withCandidates:0,separateAuthoring:2});expect(result.beats.every(b=>b.status==='separate-authoring'&&b.candidates.length===0)).toBe(true);
 });
 it('rejects stale catalog/dictionary/head receipts instead of falling back to old labels',async()=>{
  const lib=fixture(row('walk','Walking')),s=story(lib,[beat([action('walk')])]);
  for(const binding of [{...s.binding,catalogSha256:'a'.repeat(64)},{...s.binding,dictionaryVersion:'stale'},{...s.binding,head:{revision:3,eventSha256:'c'.repeat(64)}}])await expect(matchSemanticStory({lib,story:{...s,binding}})).rejects.toThrow(/stale/);
 });
 it('refuses a changed revision while a batched match is in progress',async()=>{
  const lib=fixture(row('walk','Walking')),s=story(lib,[beat([action('walk')])]);
  const pending=matchSemanticStory({lib,story:s});flag(lib);await expect(pending).rejects.toThrow(/snapshot changed/);
 });
 it('detaches story constraints before asynchronous checks',async()=>{
  const lib=fixture(row('walk','Walking')),s=story(lib,[beat([action('walk')])]);const pending=matchSemanticStory({lib,story:s});s.beats[0].constraints[0].value='run';s.title='Changed';
  const result=await pending;expect(result.title).toBe('合成故事');expect(result.beats[0].candidates[0].clipId).toBe('walk');
 });
 it('verifies real candidate bytes even for partial references',async()=>{
  const lib=fixture(row('walk','Walking'));writeFileSync(join(lib,'clips/walk.glb'),'wrong bytes');
  await expect(matchSemanticStory({lib,story:story(lib,[beat([action('walk'),action('jump')])])})).rejects.toThrow(/SHA/);
 });
 it('rejects unknown fields, forbidden-only beats, invalid budgets and non-data arrays',async()=>{
  const lib=fixture(row('walk','Walking')),s=story(lib,[beat([action('walk')])]);
  for(const invalid of [{...s,approved:true},{...s,beats:[beat([action('run','forbidden')])]},{...s,beats:[beat([action('walk')],{top:21})]},{...s,beats:[{id:'scene',text:'场景',kind:'scene',constraints:[action('walk')]}]},{...s,beats:[beat([action('walk'),action('walk')])]}, {...s,beats:Array(1)}])await expect(matchSemanticStory({lib,story:invalid})).rejects.toThrow();
  let calls=0;const hidden=[...s.beats];Object.defineProperty(hidden,'toJSON',{value(){calls++;return [beat([action('run')])];}});
  await expect(matchSemanticStory({lib,story:{...s,beats:hidden}})).rejects.toThrow(/non-data/);expect(calls).toBe(0);
  const beats=[...s.beats];Object.defineProperty(beats,0,{get(){throw new Error('must not execute getter');},enumerable:true});await expect(matchSemanticStory({lib,story:{...s,beats}})).rejects.toThrow(/non-data/);
 });
 it('exports source labels and review reasons without upgrading flags, proposals or neutral defaults',()=>{
  const lib=fixture(row('walk','Walking'),row('negation','Nobody walks here'));flag(lib);
  const audit=semanticLabelAudit({lib});
  expect(audit.summary).toMatchObject({clips:2,descriptions:2,actionRows:1,approvedLabels:0});
  expect(audit.summary.facetCoverage.emotion).toBeUndefined();
  expect(audit.clips.find(c=>c.clipId==='walk')).toMatchObject({labelStatus:'draft',requiresHumanConfirmation:true,reviewReasons:['flagged-source-claim']});
  expect(audit.clips.find(c=>c.clipId==='negation').reviewReasons).toContain('source-extraction-warning');
  expect(audit.assetVerification).toBe('none-metadata-only');expect(audit.writes).toBe(false);
 });
 it('provides explicit CLI binding/dictionary/match commands and no legacy default root',async()=>{
  const lib=fixture(row('walk','Walking')),channel=io();
  expect(await main(['dictionary'],channel)).toBe(0);expect(JSON.parse(channel.outputs[0]).dictionaryVersion).toBeTruthy();
  expect(await main(['snapshot','--lib',lib],channel)).toBe(0);
  expect(await main(['labels','--lib',lib],channel)).toBe(0);expect(JSON.parse(channel.outputs.at(-1)).summary.approvedLabels).toBe(0);
  const input=join(lib,'request.json');writeFileSync(input,JSON.stringify(story(lib,[beat([action('walk')])])));
  expect(await main(['match','--lib',lib,'--input',input],channel)).toBe(0);expect(JSON.parse(channel.outputs.at(-1)).beats[0].candidates[0].clipId).toBe('walk');
  for(const args of [['match','--input',input],['snapshot'],['match','--lib',lib],['dictionary','--lib',lib],['match','--lib',lib,'--lib',lib,'--input',input]])expect(await main(args,io())).toBe(1);
  const link=join(lib,'linked.json');symlinkSync(input,link);expect(await main(['match','--lib',lib,'--input',link],io())).toBe(1);
 });
 it('batch results equal singleton semantics and reject mixed stale receipts',async()=>{
  const lib=fixture(row('walk','Walking')),b=semanticStoryBinding({lib});const request={expectedCatalogSha256:b.catalogSha256,expectedDictionaryVersion:b.dictionaryVersion,expectedRevision:b.head.revision,expectedHeadSha256:b.head.eventSha256,constraints:[action('walk')],top:1};
  const results=await querySemanticDraftBatch({lib,requests:[request,{...request,constraints:[action('jump')]}]});expect(results[0]).toEqual(await querySemanticDrafts({lib,request}));expect(results[1].candidates).toEqual([]);
  await expect(querySemanticDraftBatch({lib,requests:[request,{...request,expectedRevision:1}]})).rejects.toThrow(/stale/);
  let hooks=0;const malicious=[{}];Object.defineProperty(malicious,'map',{value(){hooks++;return [{...request,constraints:[{facet:'unregistered-facet',value:'walk'}]}];}});
  await expect(querySemanticDraftBatch({lib,requests:malicious})).rejects.toThrow(/non-data/);expect(hooks).toBe(0);
  const constraints=[action('walk')];Object.defineProperty(constraints,'map',{value(){hooks++;return [];}});
  await expect(querySemanticDrafts({lib,request:{...request,constraints}})).rejects.toThrow(/non-data/);expect(hooks).toBe(0);
  await expect(querySemanticDraftBatch({lib,requests:[]})).rejects.toThrow(/batch/);
 });
});
