import {describe,it,expect,afterEach} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,readdirSync,rmSync,symlinkSync} from 'node:fs';
import {join} from 'node:path';
import {sha256} from './lib/motion-catalog.mjs';
import {readSemanticDrafts,appendSemanticDraft} from './lib/motion-semantic-drafts.mjs';
import {querySemanticDrafts} from './lib/motion-semantic-query.mjs';
const roots=[];afterEach(()=>roots.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));
const clip=(id,description,extra={})=>({id,file:`clips/${id}.glb`,sha256:sha256(Buffer.from(id)),source:{kind:'mixamo',fbxSha256:'b'.repeat(64),searchTerm:'Synthetic',mixamoName:'Synthetic shared title',description},fps:30,frames:61,durationS:2,loop:false,inPlace:true,rootMotion:'none',category:'pose',emotion:['neutral'],contacts:[],intensity:1,descZh:'合成测试占位',descEn:'Synthetic source fixture',tags:[],derivedFrom:null,status:'confirmed',...extra});
function fixture(...clips){const lib=mkdtempSync('/private/tmp/semantic-query-');roots.push(lib);mkdirSync(join(lib,'clips'));for(const row of clips)writeFileSync(join(lib,row.file),Buffer.from(row.id));writeFileSync(join(lib,'catalog.json'),JSON.stringify({version:1,clips,skins:[]}));writeFileSync(join(lib,'original.fbx'),'synthetic untouched source');return lib;}
async function query(lib,constraints,extra={}){const s=await readSemanticDrafts({lib});return querySemanticDrafts({lib,request:{expectedCatalogSha256:s.catalogSha256,expectedDictionaryVersion:s.dictionaryVersion,expectedRevision:s.head.revision,expectedHeadSha256:s.head.eventSha256,constraints,...extra}});}
describe('unwired M4 shadow query over shared draft evidence',()=>{
 it('keeps source drafts separate from asset confirmation and old neutral/pose defaults',async()=>{
  const lib=fixture(clip('walking','Walking forward'));const before=readFileSync(join(lib,'catalog.json'));
  const result=await query(lib,[{facet:'action',value:'walk'}]);expect(result.candidates.map(c=>c.clipId)).toEqual(['walking']);expect(result.candidates[0]).toMatchObject({assetStatus:'confirmed',labelStatus:'draft',requiresHumanConfirmation:true});expect(result.candidates[0].constraints[0].evidence[0].evidence.quote).toBe('Walking');
  expect((await query(lib,[{facet:'emotion',value:'neutral'}])).candidates).toEqual([]);expect(readFileSync(join(lib,'catalog.json'))).toEqual(before);expect(readFileSync(join(lib,'original.fbx'),'utf8')).toBe('synthetic untouched source');expect(readdirSync(lib).sort()).toEqual(['catalog.json','clips','original.fbx']);
 });
 it('does not make walk and run mutually exclusive, and sorts exact identities deterministically',async()=>{
  const lib=fixture(clip('z','Walking then running'),clip('a','Walking then running'));const result=await query(lib,[{facet:'action',value:'walk'},{facet:'action',value:'run'}]);expect(result.candidates.map(c=>c.clipId)).toEqual(['a','z']);expect(result.candidates[0].constraints.map(c=>c.state)).toEqual(['supported','supported']);
 });
 it('distinguishes an explicit forbidden action from an omitted fact',async()=>{
  const lib=fixture(clip('walk','Walking'),clip('run','Running'));const result=await query(lib,[{facet:'action',value:'walk'},{facet:'action',value:'run',mode:'forbidden'}],{strict:false});expect(result.candidates.map(c=>c.clipId)).toEqual(['walk']);expect(result.candidates[0].constraints[1].state).toBe('unknown');expect(result.missingRequirements).toEqual([]);expect(result.excluded.find(c=>c.clipId==='run').constraints[1].state).toBe('conflict');expect((await query(lib,[{facet:'action',value:'walk'},{facet:'action',value:'run',mode:'forbidden'}])).candidates).toEqual([]);
 });
 it('returns missing requirements without inventing an unbaked motion ID or treating base references as evidence',async()=>{
  const lib=fixture(clip('derived','Walking',{derivedFrom:'synthetic-parent'}));const result=await query(lib,[{facet:'action',value:'walk'}]);expect(result.candidates).toEqual([]);expect(result.excluded[0].constraints[0]).toMatchObject({state:'unknown',reason:'base-reference-not-current-evidence'});
  const missing=await query(lib,[{facet:'action',value:'synthetic-strike-match'}]);expect(missing.candidates).toEqual([]);expect(missing.missingRequirements[0]).toMatchObject({value:'synthetic-strike-match',reason:'pending-vocabulary'});
 });
 it('rejects stale version/head/catalog snapshots instead of using legacy fallback',async()=>{
  const lib=fixture(clip('walk','Walking'));const s=await readSemanticDrafts({lib});const request={expectedCatalogSha256:s.catalogSha256,expectedDictionaryVersion:s.dictionaryVersion,expectedRevision:0,expectedHeadSha256:null,constraints:[{facet:'action',value:'walk'}]};
  for(const fields of [{expectedCatalogSha256:'c'.repeat(64)},{expectedDictionaryVersion:'obsolete'},{expectedRevision:1},{expectedHeadSha256:'a'.repeat(64)}])await expect(querySemanticDrafts({lib,request:{...request,...fields}})).rejects.toThrow(/stale/);
 });
 it('verifies selected actual asset bytes and rejects symbolic links',async()=>{
  const lib=fixture(clip('walk','Walking'));writeFileSync(join(lib,'clips/walk.glb'),'changed bytes');await expect(query(lib,[{facet:'action',value:'walk'}])).rejects.toThrow(/SHA/);rmSync(join(lib,'clips/walk.glb'));symlinkSync(join(lib,'original.fbx'),join(lib,'clips/walk.glb'));await expect(query(lib,[{facet:'action',value:'walk'}])).rejects.toThrow(/symlink/);
 });
 it('does not let an AI proposal silently become current evidence',async()=>{
  const lib=fixture(clip('walk','Walking'));const s=await readSemanticDrafts({lib});await appendSemanticDraft({lib,request:{eventId:'synthetic-proposal',expectedRevision:0,catalogSha256:s.catalogSha256,dictionaryVersion:s.dictionaryVersion,clipId:'walk',clipSha256:s.clips[0].clipSha256,sourceFbxSha256:s.clips[0].sourceFbxSha256,baseSnapshotSha256:s.clips[0].baseSnapshotSha256,operation:'propose',reason:'Synthetic doubtful classification',actor:{kind:'ai',id:'synthetic-ai'},tag:{facet:'action',value:'run',evidence:{source:'description',quote:'Walking',start:0,end:7}}}});
  const result=await query(lib,[{facet:'action',value:'run'}]);expect(result.candidates).toEqual([]);expect(result.pendingProposalCount).toBe(1);expect((await query(lib,[{facet:'action',value:'walk'}])).candidates[0].requiresHumanConfirmation).toBe(true);
 });
 it('rejects malformed closed input rather than parsing a second natural-language classifier',async()=>{
  const lib=fixture(clip('walk','Walking'));
  for(const constraints of [[],[{facet:'new-facet',value:'walk'}],[{facet:'action',value:'walk',approved:true}],[{facet:'action',value:'walk',mode:'invented'}],[{facet:'action',value:'walk'},{facet:'action',value:'walk'}]])await expect(query(lib,constraints)).rejects.toThrow();
 });
});


it('never sends forbidden-only constraints to motion completion',async()=>{
 const lib=fixture(clip('walk','Walking'));const result=await query(lib,[{facet:'action',value:'run',mode:'forbidden'}]);expect(result.candidates).toEqual([]);expect(result.missingRequirements).toEqual([]);expect(result.excluded[0].constraints[0].state).toBe('unknown');
});


it('uses one detached request snapshot across asynchronous checks',async()=>{
 const lib=fixture(clip('a','Walking'),clip('b','Walking'));const s=await readSemanticDrafts({lib});const request={expectedCatalogSha256:s.catalogSha256,expectedDictionaryVersion:s.dictionaryVersion,expectedRevision:0,expectedHeadSha256:null,constraints:[{facet:'action',value:'walk'}],top:1};
 const pending=querySemanticDrafts({lib,request});request.top=0;request.expectedRevision=99;request.expectedCatalogSha256='changed';request.constraints[0].value='run';const result=await pending;expect(result.totalMatches).toBe(2);expect(result.candidates.map(c=>c.clipId)).toEqual(['a']);expect(result.candidates[0].constraints[0].value).toBe('walk');
 const strictRequest={expectedCatalogSha256:s.catalogSha256,expectedDictionaryVersion:s.dictionaryVersion,expectedRevision:0,expectedHeadSha256:null,constraints:[{facet:'action',value:'walk'},{facet:'emotion',value:'neutral'}]};const strictPending=querySemanticDrafts({lib,request:strictRequest});strictRequest.strict=false;expect((await strictPending).candidates).toEqual([]);
});
