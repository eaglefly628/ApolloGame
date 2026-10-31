import {it,expect} from 'vitest';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readSemanticDrafts,appendSemanticDraft} from './lib/motion-semantic-drafts.mjs';
import {querySemanticDrafts} from './lib/motion-semantic-query.mjs';
import {getSourceTagDefinition} from './lib/motion-semantics.mjs';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/motion-semantics/v2-fixed-bytes.json',import.meta.url),'utf8'));

it('keeps a v2 proposal pending even when its value is now registered in v3',async()=>{
 const lib=mkdtempSync(join(realpathSync(tmpdir()),'legacy-proposal-version-'));
 try{
  writeFileSync(join(lib,'catalog.json'),fixture.catalogText);mkdirSync(join(lib,'semantic-review'));
  writeFileSync(join(lib,'semantic-review/drafts.jsonl'),fixture.logText);writeFileSync(join(lib,'semantic-review/head.json'),fixture.headText);
  expect(getSourceTagDefinition('action','gather','source-description-v2')).toBeNull();
  expect(getSourceTagDefinition('action','gather','source-description-v3')).not.toBeNull();
  const before=readSemanticDrafts({lib}),c=before.clips[0];
  // Deliberately questionable AI attribution: an exact quote is not semantic approval.
  appendSemanticDraft({lib,request:{eventId:'compat-pending-gather',expectedRevision:before.head.revision,catalogSha256:before.catalogSha256,dictionaryVersion:before.dictionaryVersion,clipId:c.clipId,clipSha256:c.clipSha256,sourceFbxSha256:c.sourceFbxSha256,baseSnapshotSha256:c.baseSnapshotSha256,reason:'Synthetic vocabulary-only proposal, not an executed-action claim',actor:{kind:'ai',id:'compat-fixture'},operation:'propose',tag:{facet:'action',value:'gather',evidence:{source:'description',quote:'Walking',start:0,end:7}}}});
  const after=readSemanticDrafts({lib}),proposal=after.clips[0].pendingProposals.find(p=>p.eventId==='compat-pending-gather');
  expect(proposal).toMatchObject({label:null,vocabularyStatus:'pending-vocabulary',status:'draft'});
  expect(after.dictionaryVersion).toBe('source-description-v2');expect(after.clips[0].tags).toEqual(before.clips[0].tags);
  const result=await querySemanticDrafts({lib,request:{expectedCatalogSha256:after.catalogSha256,expectedDictionaryVersion:after.dictionaryVersion,expectedRevision:after.head.revision,expectedHeadSha256:after.head.eventSha256,constraints:[{facet:'action',value:'gather'}]}});
  expect(result.candidates).toEqual([]);expect(result.missingRequirements[0].reason).toBe('pending-vocabulary');
  expect(readFileSync(join(lib,'semantic-review/drafts.jsonl'),'utf8').startsWith(fixture.logText)).toBe(true);
 }finally{rmSync(lib,{recursive:true,force:true});}
});
