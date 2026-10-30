import {describe,it,expect,afterEach} from 'vitest';
import {mkdtempSync,realpathSync,writeFileSync,readFileSync,mkdirSync,rmSync,existsSync,symlinkSync,linkSync,appendFileSync,readdirSync,truncateSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {readSemanticDrafts,appendSemanticDraft,SEMANTIC_DRAFT_LIMITS} from './lib/motion-semantic-drafts.mjs';
import {migrateSemanticDrafts,SEMANTIC_MIGRATION_STAGING} from './lib/motion-semantic-migrate.mjs';
import {SEMANTIC_MIGRATION_HISTORY_LIMITS} from './lib/motion-semantic-drafts-validate.mjs';
const dirs=[];
afterEach(()=>{for(const dir of dirs.splice(0))rmSync(dir,{recursive:true,force:true});});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const row=id=>({id,file:`clips/${id}.glb`,sha256:'a'.repeat(64),source:{kind:'fixture',license:'synthetic',fbxSha256:'b'.repeat(64),mixamoName:'Synthetic '+id,searchTerm:'fixture',description:'Walking forward'},fps:30,frames:31,durationS:1,loop:false,inPlace:true,rootMotion:'none',category:'pose',emotion:['neutral'],intensity:1,contacts:[],descZh:'合成',descEn:'Synthetic',tags:[],derivedFrom:null,status:'confirmed'});
function fixture({changes=true}={}){
 const root=mkdtempSync(join(realpathSync(tmpdir()),'semantic-migrate-'));dirs.push(root);
 const sourceLib=join(root,'source'),targetLib=join(root,'target');mkdirSync(sourceLib);mkdirSync(targetLib);
 const sourceCatalog={version:1,skins:[],clips:['one','two','three'].map(row)},targetCatalog=clone(sourceCatalog);
 if(changes){targetCatalog.clips[1].source.description='Walking backward';targetCatalog.clips.pop();targetCatalog.clips.push(row('four'));}
 writeFileSync(join(sourceLib,'catalog.json'),JSON.stringify(sourceCatalog,null,2)+'\n');
 writeFileSync(join(targetLib,'catalog.json'),JSON.stringify(targetCatalog)+'\n');
 return {root,sourceLib,targetLib,sourceCatalog,targetCatalog};
}
function propose(lib,id='one',eventId='event-one',actor={kind:'ai',id:'synthetic'}){
 const s=readSemanticDrafts({lib}),c=s.clips.find(c=>c.clipId===id);
 return appendSemanticDraft({lib,request:{eventId,expectedRevision:s.head.revision,catalogSha256:s.catalogSha256,dictionaryVersion:s.dictionaryVersion,clipId:c.clipId,clipSha256:c.clipSha256,sourceFbxSha256:c.sourceFbxSha256,baseSnapshotSha256:c.baseSnapshotSha256,reason:'Synthetic unapproved proposal',actor,operation:'propose',tag:{facet:'action',value:'walk',evidence:{source:'description',quote:'Walking',start:0,end:7}}}});
}
function flag(lib,id,targetTagId,eventId){
 const s=readSemanticDrafts({lib}),c=s.clips.find(c=>c.clipId===id);
 return appendSemanticDraft({lib,request:{eventId,expectedRevision:s.head.revision,catalogSha256:s.catalogSha256,dictionaryVersion:s.dictionaryVersion,clipId:c.clipId,clipSha256:c.clipSha256,sourceFbxSha256:c.sourceFbxSha256,baseSnapshotSha256:c.baseSnapshotSha256,reason:'Synthetic disputed tag',actor:{kind:'human',id:'fixture-reviewer'},operation:'flag',targetTagId}});
}
const side=lib=>join(lib,'semantic-review');
const bytes=lib=>['catalog.json','semantic-review/drafts.jsonl','semantic-review/head.json'].map(name=>existsSync(join(lib,name))?readFileSync(join(lib,name)):null);
const run=f=>migrateSemanticDrafts({sourceLib:f.sourceLib,targetLib:f.targetLib});
const apply=(f,plan=run(f))=>migrateSemanticDrafts({sourceLib:f.sourceLib,targetLib:f.targetLib,apply:true,expected:plan.binding});
function nextGeneration(f,sourceLib=f.targetLib,name='next'){
 const targetLib=join(f.root,name);mkdirSync(targetLib);writeFileSync(join(targetLib,'catalog.json'),JSON.stringify(JSON.parse(readFileSync(join(sourceLib,'catalog.json'))),null,2)+' \n');return {...f,sourceLib,targetLib};
}
// Faults run inside the actual Python transaction, preserving dirfd/flock semantics.
function fault(f,plan,kind){
 const helper=resolve('scripts/lib/motion-semantic-migrate-fs.py');
 const code=`import os,runpy,subprocess,ctypes\nhelper=${JSON.stringify(helper)}\nsource=${JSON.stringify(f.sourceLib)}\ntarget=${JSON.stringify(f.targetLib)}\nkind=${JSON.stringify(kind)}\noldrun,oldwrite,oldopen=subprocess.run,os.write,os.open\nopened={}\nfired=False\ndef run(*a,**kw):\n result=oldrun(*a,**kw)\n if kind in ('source-catalog','target-catalog','source-head','source-log'):\n  path={'source-catalog':source+'/catalog.json','target-catalog':target+'/catalog.json','source-head':source+'/semantic-review/head.json','source-log':source+'/semantic-review/drafts.jsonl'}[kind]\n  with open(path,'ab') as out:out.write(b' ')\n if kind=='history-after-validation':\n  with open(source+'/semantic-review/migration-archive/catalog.json','ab') as out:out.write(b' ')\n if kind=='history-directory-after-validation':\n  os.rename(source+'/semantic-review/migration-archive',source+'/semantic-review/retained-archive')\n  os.mkdir(source+'/semantic-review/migration-archive')\n if kind=='sidecar-appears':os.mkdir(target+'/semantic-review')\n if kind=='staging-appears':os.mkdir(target+'/${SEMANTIC_MIGRATION_STAGING}')\n if kind=='root-swap':\n  os.rename(target,target+'-original')\n  os.symlink(source,target)\n return result\ndef op(name,flags,*a,**kw):\n fd=oldopen(name,flags,*a,**kw)\n opened[fd]=name\n return fd\ndef write(fd,data):\n global fired\n if not fired and kind=='history-during-write' and opened.get(fd)=='migration-receipt.json':\n  fired=True\n  with open(source+'/semantic-review/migration-archive/catalog.json','ab') as out:out.write(b' ')\n if not fired and kind in ('partial-write','crash') and opened.get(fd)=='migration-receipt.json':\n  fired=True\n  oldwrite(fd,data[:7])\n  if kind=='crash':os._exit(23)\n  raise RuntimeError('synthetic migration write failure')\n if not fired and kind=='stage-swap' and opened.get(fd)=='migration-receipt.json':\n  fired=True\n  os.rename(target+'/${SEMANTIC_MIGRATION_STAGING}',target+'/retained-stage')\n  os.symlink(source,target+'/${SEMANTIC_MIGRATION_STAGING}')\n return oldwrite(fd,data)\nsubprocess.run,os.open,os.write=run,op,write\nmodule=runpy.run_path(helper)\ng=module['main'].__globals__\noriginal_init=g['MigrationTransaction'].__init__\ntransactions={}\ndef init(self,path,append):\n original_init(self,path,append)\n transactions[path]=self\n if len(transactions)==2 and kind.startswith('physical-ancestor-'):\n  a,b=transactions[source],transactions[target]\n  if kind=='physical-ancestor-forward':b.chain.append(a.chain[-1])\n  else:a.chain.append(b.chain[-1])\ng['MigrationTransaction'].__init__=init\noriginal=g['no_replace_renamer']\ndef renamer():\n native=original()\n def publish(*args):\n  if kind=='last-instant-target':os.mkdir(target+'/semantic-review')\n  if kind=='before-rename-crash':os._exit(24)\n  return native(*args)\n return publish\ng['no_replace_renamer']=renamer\ntry:module['main']()\nexcept Exception as error:\n import sys\n sys.stderr.write(str(error))\n sys.exit(2)\n`;
 return spawnSync('python3',['-c',code],{input:JSON.stringify({protocolVersion:1,sourceLib:f.sourceLib,targetLib:f.targetLib,nodeExecutable:process.execPath,apply:true,expected:plan.binding}),encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
}
describe('safe independent draft migration',()=>{
 it('inherits original ancestor bytes on a second migration',()=>{
  const f=fixture();propose(f.sourceLib);const original=bytes(f.sourceLib);apply(f);
  const second=join(f.root,'second');mkdirSync(second);writeFileSync(join(second,'catalog.json'),readFileSync(join(f.targetLib,'catalog.json')));
  apply({...f,sourceLib:f.targetLib,targetLib:second});
  expect(existsSync(join(side(second),'migration-archive/parent-migration/migration-receipt.json'))).toBe(true);
  expect(readFileSync(join(side(second),'migration-archive/parent-migration/migration-archive/drafts.jsonl'))).toEqual(original[1]);
 });
 it.each(['missing','unknown','nested-missing','nested-unknown'])('preserves and refuses a %s lineage version rather than guessing complete history',kind=>{
  const f=fixture();propose(f.sourceLib);apply(f);let next=nextGeneration(f,f.targetLib,'second');
  if(kind.startsWith('nested')){apply(next);next=nextGeneration(next,next.targetLib,'third');}
  const receiptPath=join(side(next.sourceLib),kind.startsWith('nested')?'migration-archive/parent-migration/migration-receipt.json':'migration-receipt.json'),receipt=JSON.parse(readFileSync(receiptPath));
  if(kind.endsWith('missing'))delete receipt.lineageVersion;else receipt.lineageVersion=2;
  writeFileSync(receiptPath,JSON.stringify(receipt)+'\n');const before=readFileSync(receiptPath);expect(()=>run(next)).toThrow(/lineage version/);expect(readFileSync(receiptPath)).toEqual(before);expect(readdirSync(next.targetLib)).toEqual(['catalog.json']);
 });
 it.each(['physical-ancestor-forward','physical-ancestor-reverse'])('refuses a physical ancestor FD despite disjoint path text (%s)',kind=>{
  const f=fixture();propose(f.sourceLib);const result=fault(f,run(f),kind);expect(result.status).not.toBe(0);expect(result.stderr).toContain('physically disjoint');expect(existsSync(side(f.targetLib))).toBe(false);
 });
 it('rejects an actual case alias of a physical ancestor on case-insensitive filesystems',context=>{
  const f=fixture(),alias=join(f.root,'SOURCE');if(!existsSync(alias)){context.skip();return;}
  const child=join(f.sourceLib,'new');mkdirSync(child);writeFileSync(join(child,'catalog.json'),readFileSync(join(f.targetLib,'catalog.json')));
  expect(()=>migrateSemanticDrafts({sourceLib:f.sourceLib,targetLib:join(alias,'new')})).toThrow(/physically disjoint/);expect(existsSync(join(child,'semantic-review'))).toBe(false);
 });
 it('preserves three generations, skipped ancestor events, both flag mappings, and post-migration appends',()=>{
  const f=fixture();propose(f.sourceLib,'two','ancestor-skipped');propose(f.sourceLib,'one','ancestor-proposal');
  let old=readSemanticDrafts({lib:f.sourceLib});flag(f.sourceLib,'one',old.clips[0].pendingProposals[0].tagId,'ancestor-proposal-flag');flag(f.sourceLib,'one',old.clips[0].tags[0].tagId,'ancestor-source-flag');
  const original=bytes(f.sourceLib),first=apply(f),firstReceipt=readFileSync(join(side(f.targetLib),'migration-receipt.json'));
  propose(f.targetLib,'one','appended-after-first');
  const second=nextGeneration(f,f.targetLib,'second');const plan=run(second);expect(plan.binding.sourceHistorySha256).toMatch(/^[a-f0-9]{64}$/);
  const stale={...plan.binding,sourceHistorySha256:'f'.repeat(64)},missing={...plan.binding};delete missing.sourceHistorySha256;
  for(const expected of [stale,missing])expect(()=>migrateSemanticDrafts({sourceLib:second.sourceLib,targetLib:second.targetLib,apply:true,expected})).toThrow(/stale|binding/);
  apply(second,plan);
  const secondReceipt=readFileSync(join(side(second.targetLib),'migration-receipt.json')),third=nextGeneration(second,second.targetLib,'third'),result=apply(third),archive=join(side(third.targetLib),'migration-archive');
  expect(readFileSync(join(archive,'parent-migration/migration-receipt.json'))).toEqual(secondReceipt);
  expect(readFileSync(join(archive,'parent-migration/migration-archive/parent-migration/migration-receipt.json'))).toEqual(firstReceipt);
  const deepest=join(archive,'parent-migration/migration-archive/parent-migration/migration-archive');
  for(const [i,name] of ['catalog.json','drafts.jsonl','head.json'].entries())expect(readFileSync(join(deepest,name))).toEqual(original[i]);
  expect(JSON.parse(readFileSync(join(archive,'parent-migration/migration-archive/parent-migration/migration-receipt.json'))).needsReview[0].eventId).toBe('ancestor-skipped');
  expect(JSON.parse(firstReceipt).eventMap).toEqual(first.eventMap);
  for(const [path,identity] of Object.entries(result.archive.files)){const data=readFileSync(join(archive,path));expect({sha256:hash(data),bytes:data.length}).toEqual(identity);}
  const snapshot=readSemanticDrafts({lib:third.targetLib});expect(snapshot.clips[0].pendingProposals).toHaveLength(2);expect(snapshot.clips[0].pendingProposals[0].flagEventIds).toHaveLength(1);expect(snapshot.clips[0].tags[0].flagEventIds).toHaveLength(1);expect(snapshot.events).toHaveLength(4);
 });
 it('allows append after an archive-only zero-event migration without inventing its old head',()=>{
  const f=fixture();apply(f);propose(f.targetLib);const second=nextGeneration(f);apply(second);expect(readSemanticDrafts({lib:second.targetLib}).head.revision).toBe(1);expect(existsSync(join(side(second.targetLib),'migration-archive/parent-migration/migration-archive/head.json'))).toBe(false);
 });
 it.each(['archive-catalog','archive-log','archive-head','receipt-map','receipt-sha','receipt-missing','archive-extra','nested-removed'])('refuses damaged ancestor %s before creating staging',kind=>{
  const f=fixture();propose(f.sourceLib);apply(f);const second=nextGeneration(f,f.targetLib,'second');apply(second);const third=nextGeneration(second,second.targetLib,'third'),prior=join(side(third.sourceLib),'migration-archive/parent-migration');
  if(kind.startsWith('archive-')&&kind!=='archive-extra'){const name={'archive-catalog':'catalog.json','archive-log':'drafts.jsonl','archive-head':'head.json'}[kind];appendFileSync(join(prior,'migration-archive',name),' ');}
  if(kind==='receipt-map'||kind==='receipt-sha'){const path=join(prior,'migration-receipt.json'),receipt=JSON.parse(readFileSync(path));if(kind==='receipt-map')receipt.eventMap[0].targetEventId='forged-map';else receipt.archive.files['catalog.json'].sha256='f'.repeat(64);writeFileSync(path,JSON.stringify(receipt)+'\n');}
  if(kind==='receipt-missing')rmSync(join(prior,'migration-receipt.json'));
  if(kind==='archive-extra')writeFileSync(join(prior,'migration-archive/foreign.json'),'DO NOT DROP');
  if(kind==='nested-removed')rmSync(prior,{recursive:true});
  const current=bytes(third.sourceLib);expect(()=>run(third)).toThrow();expect(bytes(third.sourceLib)).toEqual(current);expect(readdirSync(third.targetLib)).toEqual(['catalog.json']);
 });
 it.each(['receipt-symlink','archive-file-symlink','archive-directory-symlink','receipt-hardlink','archive-hardlink'])('refuses inherited %s without following or modifying it',kind=>{
  const f=fixture();propose(f.sourceLib);apply(f);const next=nextGeneration(f),path=kind.startsWith('receipt')?join(side(next.sourceLib),'migration-receipt.json'):kind==='archive-directory-symlink'?join(side(next.sourceLib),'migration-archive'):join(side(next.sourceLib),'migration-archive/catalog.json'),outside=join(f.root,'outside');
  if(kind.endsWith('hardlink'))linkSync(path,outside);else if(kind==='archive-directory-symlink'){mkdirSync(outside);writeFileSync(join(outside,'catalog.json'),'FOREIGN');rmSync(path,{recursive:true});symlinkSync(outside,path);}else{writeFileSync(outside,readFileSync(path));rmSync(path);symlinkSync(outside,path);}
  expect(()=>run(next)).toThrow(/unsafe|nonregular|linked/);expect(existsSync(side(next.targetLib))).toBe(false);expect(existsSync(outside)).toBe(true);
 });
 it.each(['history-after-validation','history-directory-after-validation','history-during-write'])('rechecks nested source evidence %s and never publishes stale lineage',kind=>{
  const f=fixture();propose(f.sourceLib);apply(f);const next=nextGeneration(f),result=fault(next,run(next),kind);expect(result.status).not.toBe(0);expect(result.stderr).toMatch(/changed/);expect(existsSync(side(next.targetLib))).toBe(false);expect(existsSync(join(next.targetLib,SEMANTIC_MIGRATION_STAGING))).toBe(kind==='history-during-write');
 });
 it('refuses history total-byte excess before trusting any receipt or publishing',()=>{
  const f=fixture();apply(f);const second=nextGeneration(f,f.targetLib,'second');apply(second);const third=nextGeneration(second,second.targetLib,'third'),archive=join(side(third.sourceLib),'migration-archive');
  truncateSync(join(archive,'catalog.json'),SEMANTIC_DRAFT_LIMITS.catalogBytes);truncateSync(join(archive,'parent-migration/migration-archive/catalog.json'),SEMANTIC_DRAFT_LIMITS.catalogBytes);
  expect(()=>run(third)).toThrow(/budget/);expect(existsSync(join(third.targetLib,SEMANTIC_MIGRATION_STAGING))).toBe(false);
 });
 it('enforces the generation budget and retains all prior receipts at the boundary',()=>{
  let current=fixture();apply(current);for(let i=1;i<SEMANTIC_MIGRATION_HISTORY_LIMITS.generations;i++){current=nextGeneration(current,current.targetLib,'generation-'+(i+1));apply(current);}
  const next=nextGeneration(current,current.targetLib,'over-generation-budget');expect(()=>run(next)).toThrow(/generation budget/);expect(existsSync(side(next.targetLib))).toBe(false);
 },15000);
 it('rejects non-JSON option descriptors, nested getters, symbols, and proxies without invoking hooks',()=>{
  const f=fixture();propose(f.sourceLib);const plan=run(f);let calls=0;
  const options=()=>({sourceLib:f.sourceLib,targetLib:f.targetLib,apply:true,expected:clone(plan.binding)});
  const bad=[];let value=options();Object.defineProperty(value,'toJSON',{value(){calls++;return options();},enumerable:false});bad.push(value);
  value=options();Object.defineProperty(value.expected,'toJSON',{value(){calls++;return plan.binding;},enumerable:false});bad.push(value);
  value=options();Object.defineProperty(value.expected.sourceHead,'revision',{get(){calls++;return 1;},enumerable:true});bad.push(value);
  value=options();Object.defineProperty(value,'sourceLib',{get(){calls++;return f.sourceLib;},enumerable:true});bad.push(value);
  value=options();value[Symbol('hidden')]=true;bad.push(value);
  value=options();value.expected=Object.assign(Object.create({toJSON(){calls++;return plan.binding;}}),plan.binding);bad.push(value);
  bad.push(new Proxy(options(),{ownKeys(){calls++;return [];},getPrototypeOf(){calls++;return Object.prototype;}}));
  for(const value of bad)expect(()=>migrateSemanticDrafts(value)).toThrow(/invalid/);
  expect(calls).toBe(0);expect(existsSync(side(f.targetLib))).toBe(false);
 });
 it('dry-runs full clip changes without touching either library; emits a compact bound manifest',()=>{
  const f=fixture();propose(f.sourceLib,'one');propose(f.sourceLib,'two','event-two');propose(f.sourceLib,'three','event-three');
  const before=bytes(f.sourceLib),target=readFileSync(join(f.targetLib,'catalog.json')),plan=run(f);
  expect(plan.mode).toBe('dry-run');expect(plan.classification).toEqual({unchanged:['one'],changed:['two'],deleted:['three'],added:['four']});
  expect(plan.counts).toEqual({sourceEvents:3,migratedEvents:1,needsReviewEvents:2});expect(plan.needsReview.map(e=>e.reason)).toEqual(['clip-changed','clip-deleted']);
  expect(plan.binding.sourceCatalogSha256).toBe(hash(before[0]));expect(plan.binding.targetCatalogSha256).toBe(hash(target));expect(plan.binding.sourceHead.revision).toBe(3);
  expect(JSON.stringify(plan)).not.toContain('catalogText');expect(JSON.stringify(plan)).not.toContain('logText');
  expect(bytes(f.sourceLib)).toEqual(before);expect(readFileSync(join(f.targetLib,'catalog.json'))).toEqual(target);expect(readdirSync(f.targetLib)).toEqual(['catalog.json']);
 });
 it('rebuilds only unchanged proposals and both flag kinds in original order; retains human attribution but no approval',()=>{
  const f=fixture();propose(f.sourceLib,'two','skip-changed');propose(f.sourceLib,'one','human-proposal',{kind:'human',id:'fixture-human'});
  let old=readSemanticDrafts({lib:f.sourceLib}),c=old.clips[0];
  flag(f.sourceLib,'one',c.tags[0].tagId,'source-flag');flag(f.sourceLib,'one',c.pendingProposals[0].tagId,'proposal-flag');
  const plan=run(f),result=apply(f,plan),s=readSemanticDrafts({lib:f.targetLib});
  expect(result).toEqual({...plan,mode:'applied'});expect(s.head.revision).toBe(3);expect(s.events.map(e=>e.request.operation)).toEqual(['propose','flag','flag']);
  expect(s.events.map(e=>e.request.expectedRevision)).toEqual([0,1,2]);expect(s.events.every(e=>e.request.catalogSha256===plan.binding.targetCatalogSha256)).toBe(true);
  expect(s.events[0].request.actor).toEqual({kind:'human',id:'fixture-human'});expect(s.clips[0].pendingProposals[0].status).toBe('draft');expect(s.clips[0].tags).toHaveLength(c.tags.length);
  expect(s.clips[0].pendingProposals).toHaveLength(1);expect(s.clips[0].pendingProposals[0].flagEventIds).toEqual([s.events[2].request.eventId]);expect(s.clips[0].tags[0].flagEventIds).toEqual([s.events[1].request.eventId]);
  expect(s.events[1].request.targetTagId).not.toBe(c.tags[0].tagId);expect(s.events[2].request.targetTagId).not.toBe(c.pendingProposals[0].tagId);
  expect(result.eventMap.map(e=>e.sourceEventId)).toEqual(['human-proposal','source-flag','proposal-flag']);expect(result.eventMap[0].targetEventId).toBe('migrated-'+old.events[1].eventSha256);
  expect(s.events.every(e=>e.request.baseSnapshotSha256===s.clips.find(c=>c.clipId===e.request.clipId).baseSnapshotSha256)).toBe(true);expect(result.approval).toBe('not-supported');expect(s.clips.find(c=>c.clipId==='two').pendingProposals).toEqual([]);
 });
 it('archives original byte formatting verbatim with exact receipt hashes; never reads missing assets',()=>{
  const f=fixture();propose(f.sourceLib);const before=bytes(f.sourceLib),result=apply(f),archive=join(side(f.targetLib),'migration-archive');
  for(const [i,name] of ['catalog.json','drafts.jsonl','head.json'].entries()){
   expect(readFileSync(join(archive,name))).toEqual(before[i]);expect(result.archive.files[name]).toEqual({sha256:hash(before[i]),bytes:before[i].length});
  }
  const receipt=readFileSync(join(side(f.targetLib),'migration-receipt.json'));expect(hash(receipt)).toBe(result.receiptSha256);expect(JSON.parse(receipt).eventMap).toEqual(result.eventMap);expect(bytes(f.sourceLib)).toEqual(before);
  expect(existsSync(join(f.sourceLib,'clips'))).toBe(false);expect(existsSync(join(f.targetLib,'clips'))).toBe(false);
 });
 it('allows canonical row key reordering but treats every full-row metadata change as changed',()=>{
  const f=fixture({changes:false});propose(f.sourceLib);
  f.targetCatalog.clips=f.targetCatalog.clips.map(r=>Object.fromEntries(Object.entries(r).reverse()));writeFileSync(join(f.targetLib,'catalog.json'),JSON.stringify(f.targetCatalog));expect(run(f).classification.unchanged).toEqual(['one','three','two']);
  for(const mutate of [r=>r.status='draft',r=>r.source.fbxSha256='c'.repeat(64),r=>r.source.description='Walking sideways',r=>r.fps=60,r=>r.tags.push('new-metadata'),r=>r.extra={new:true},r=>r.derivedFrom='two',r=>r.sha256='d'.repeat(64)]){
   const catalog=clone(f.sourceCatalog);mutate(catalog.clips[0]);if(catalog.clips[0].fps===60)catalog.clips[0].durationS=.5;writeFileSync(join(f.targetLib,'catalog.json'),JSON.stringify(catalog));const plan=run(f);expect(plan.classification.changed).toEqual(['one']);expect(plan.counts.migratedEvents).toBe(0);
  }
 });
 it.each(['no-source-events','only-skipped'])('publishes archive only, never a revision-zero log/head (%s)',kind=>{
  const f=fixture();if(kind==='only-skipped')propose(f.sourceLib,'two');const result=apply(f),s=readSemanticDrafts({lib:f.targetLib});expect(result.target.head).toEqual({revision:0,eventSha256:null});expect(s.events).toEqual([]);expect(readdirSync(side(f.targetLib)).sort()).toEqual(['migration-archive','migration-receipt.json']);
 });
 it('requires explicit apply plus complete fresh binding, and refuses dictionary guesses',()=>{
  const f=fixture();propose(f.sourceLib);const plan=run(f);
  expect(()=>migrateSemanticDrafts({...f})).toThrow(/invalid options/);expect(()=>migrateSemanticDrafts({sourceLib:f.sourceLib,targetLib:f.targetLib,apply:true})).toThrow(/expected/);
  for(const expected of [{}, {...plan.binding,dictionaryVersion:'other'}, {...plan.binding,sourceHead:{...plan.binding.sourceHead,revision:9}}, {...plan.binding,sourceCatalogSha256:'f'.repeat(64)}, {...plan.binding,targetCatalogSha256:'f'.repeat(64)}, {...plan.binding,unexpected:true}])expect(()=>migrateSemanticDrafts({sourceLib:f.sourceLib,targetLib:f.targetLib,apply:true,expected})).toThrow();
  expect(existsSync(side(f.targetLib))).toBe(false);
  appendFileSync(join(f.targetLib,'catalog.json'),' ');expect(()=>apply(f,plan)).toThrow(/stale/);
 });
 it('rejects a stale source head even when both catalog files remain identical',()=>{
  const f=fixture();propose(f.sourceLib);const plan=run(f);propose(f.sourceLib,'one','second');expect(()=>apply(f,plan)).toThrow(/stale/);expect(existsSync(side(f.targetLib))).toBe(false);
 });
 it.each(['partial','hash','head-missing','head-next','dictionary','catalog'])('refuses corrupt source %s without writes or archive repair',kind=>{
  const f=fixture();propose(f.sourceLib);const sourceSide=side(f.sourceLib);
  if(kind==='partial')appendFileSync(join(sourceSide,'drafts.jsonl'),'{');
  if(kind==='hash')writeFileSync(join(sourceSide,'drafts.jsonl'),readFileSync(join(sourceSide,'drafts.jsonl'),'utf8').replace('Synthetic unapproved','Tampered unapproved'));
  if(kind==='head-missing')rmSync(join(sourceSide,'head.json'));
  if(kind==='head-next')writeFileSync(join(sourceSide,'head.next.json'),'keep me');
  if(kind==='dictionary'){const head=JSON.parse(readFileSync(join(sourceSide,'head.json')));head.dictionaryVersion='other';writeFileSync(join(sourceSide,'head.json'),JSON.stringify(head));}
  if(kind==='catalog')appendFileSync(join(f.sourceLib,'catalog.json'),' ');
  const before=bytes(f.sourceLib);expect(()=>run(f)).toThrow();expect(bytes(f.sourceLib)).toEqual(before);expect(readdirSync(f.targetLib)).toEqual(['catalog.json']);
 });
 it.each(['source','target'])('rejects an invalid %s catalog rather than salvaging rows',which=>{
  const f=fixture();const path=join(which==='source'?f.sourceLib:f.targetLib,'catalog.json'),catalog=JSON.parse(readFileSync(path));catalog.clips.push(catalog.clips[0]);writeFileSync(path,JSON.stringify(catalog));expect(()=>run(f)).toThrow(/duplicate/);expect(existsSync(side(f.targetLib))).toBe(false);
 });
 it.each(['sidecar','empty-sidecar','staging','other-staging'])('preserves existing destination %s unchanged',kind=>{
  const f=fixture();propose(f.sourceLib);const name=kind.includes('staging')?(kind==='staging'?SEMANTIC_MIGRATION_STAGING:'.semantic-review.migration-old'):'semantic-review',dir=join(f.targetLib,name);mkdirSync(dir);if(kind!=='empty-sidecar')writeFileSync(join(dir,'evidence'),'KEEP');expect(()=>run(f)).toThrow(/exists/);expect(existsSync(dir)).toBe(true);if(kind!=='empty-sidecar')expect(readFileSync(join(dir,'evidence'),'utf8')).toBe('KEEP');
 });
 it('refuses same and ancestor libraries in either direction',()=>{
  const f=fixture();for(const [sourceLib,targetLib] of [[f.sourceLib,f.sourceLib],[f.root,f.targetLib],[f.targetLib,f.root]])expect(()=>migrateSemanticDrafts({sourceLib,targetLib})).toThrow(/disjoint/);expect(readdirSync(f.root).sort()).toEqual(['source','target']);
 });
 it.each(['source-root','target-root','source-catalog','target-catalog','source-log','source-head','source-side'])('rejects symlink %s without following it',kind=>{
  const f=fixture();propose(f.sourceLib);const before=bytes(f.sourceLib),outside=join(f.root,'outside');mkdirSync(outside);let sourceLib=f.sourceLib,targetLib=f.targetLib;
  if(kind.endsWith('root')){const path=join(f.root,'alias');symlinkSync(kind==='source-root'?sourceLib:targetLib,path);if(kind==='source-root')sourceLib=path;else targetLib=path;}
  else{const file=kind==='source-catalog'?join(sourceLib,'catalog.json'):kind==='target-catalog'?join(targetLib,'catalog.json'):kind==='source-side'?side(sourceLib):join(side(sourceLib),kind==='source-log'?'drafts.jsonl':'head.json');if(kind==='source-side'){rmSync(file,{recursive:true});symlinkSync(outside,file);}else{const copy=join(outside,'original');writeFileSync(copy,readFileSync(file));rmSync(file);symlinkSync(copy,file);}}
  expect(()=>migrateSemanticDrafts({sourceLib,targetLib})).toThrow(/unsafe|nonregular/);expect(existsSync(side(targetLib))).toBe(false);if(kind.endsWith('root'))expect(bytes(f.sourceLib)).toEqual(before);
 });
 it.each(['source-catalog','target-catalog','source-log','source-head'])('refuses linked %s inodes and leaves them untouched',kind=>{
  const f=fixture();propose(f.sourceLib);const file=kind==='source-catalog'?join(f.sourceLib,'catalog.json'):kind==='target-catalog'?join(f.targetLib,'catalog.json'):join(side(f.sourceLib),kind==='source-log'?'drafts.jsonl':'head.json');const before=readFileSync(file);linkSync(file,join(f.root,'linked-input'));expect(()=>run(f)).toThrow(/linked/);expect(readFileSync(file)).toEqual(before);expect(existsSync(side(f.targetLib))).toBe(false);
 });
 it.each(['source-catalog','target-catalog','source-head','source-log','sidecar-appears','staging-appears','root-swap'])('rechecks both snapshots after validation (%s)',kind=>{
  const f=fixture();propose(f.sourceLib);const plan=run(f),result=fault(f,plan,kind);expect(result.status).not.toBe(0);expect(result.stderr).toMatch(/changed|appeared|exists/);expect(existsSync(join(f.targetLib,SEMANTIC_MIGRATION_STAGING))).toBe(kind==='staging-appears');if(kind==='root-swap')expect(existsSync(join(f.targetLib+'-original','semantic-review'))).toBe(false);
 });
 it.each(['partial-write','crash','before-rename-crash'])('retains failed staging and refuses automatic retry after %s',kind=>{
  const f=fixture();propose(f.sourceLib);const before=bytes(f.sourceLib),plan=run(f),result=fault(f,plan,kind);expect(result.status).not.toBe(0);expect(existsSync(side(f.targetLib))).toBe(false);expect(existsSync(join(f.targetLib,SEMANTIC_MIGRATION_STAGING))).toBe(true);expect(()=>apply(f,plan)).toThrow(/staging exists/);expect(bytes(f.sourceLib)).toEqual(before);expect(readSemanticDrafts({lib:f.sourceLib}).head.revision).toBe(1);
 });
 it('never replaces an empty destination that appears at the final atomic rename',()=>{
  const f=fixture();propose(f.sourceLib);const result=fault(f,run(f),'last-instant-target');expect(result.status).not.toBe(0);expect(readdirSync(side(f.targetLib))).toEqual([]);expect(existsSync(join(f.targetLib,SEMANTIC_MIGRATION_STAGING))).toBe(true);
 });
 it('detects a replaced staging directory and cannot redirect writes into the source',()=>{
  const f=fixture();propose(f.sourceLib);const before=bytes(f.sourceLib),result=fault(f,run(f),'stage-swap');expect(result.status).not.toBe(0);expect(result.stderr).toMatch(/staging directory changed/);expect(bytes(f.sourceLib)).toEqual(before);expect(existsSync(join(f.sourceLib,'migration-receipt.json'))).toBe(false);expect(existsSync(side(f.targetLib))).toBe(false);
 });
 it.each(['catalog','clips','log','event-count','event-bytes','request','utf8'])('bounds migration %s before publication',kind=>{
  const f=fixture();propose(f.sourceLib);
  if(kind==='catalog')truncateSync(join(f.targetLib,'catalog.json'),SEMANTIC_DRAFT_LIMITS.catalogBytes+1);
  if(kind==='clips'){const catalog=clone(f.targetCatalog);catalog.clips=Array(SEMANTIC_DRAFT_LIMITS.clips+1).fill(catalog.clips[0]);writeFileSync(join(f.targetLib,'catalog.json'),JSON.stringify(catalog));}
  if(kind==='log')truncateSync(join(side(f.sourceLib),'drafts.jsonl'),SEMANTIC_DRAFT_LIMITS.logBytes+1);
  if(kind==='event-count')writeFileSync(join(side(f.sourceLib),'drafts.jsonl'),'{}\n'.repeat(SEMANTIC_DRAFT_LIMITS.events+1));
  if(kind==='event-bytes')writeFileSync(join(side(f.sourceLib),'drafts.jsonl'),' '.repeat(SEMANTIC_DRAFT_LIMITS.eventBytes+1)+'\n');
  if(kind==='utf8')writeFileSync(join(f.targetLib,'catalog.json'),Buffer.from([255]));
  if(kind==='request')expect(()=>migrateSemanticDrafts({sourceLib:f.sourceLib+'x'.repeat(32768),targetLib:f.targetLib})).toThrow(/budget/);
  else expect(()=>run(f)).toThrow(/budget|UTF-8/);
  expect(existsSync(side(f.targetLib))).toBe(false);expect(existsSync(join(f.targetLib,SEMANTIC_MIGRATION_STAGING))).toBe(false);
 });
 it('rejects a real external lock on either source or target without writing or unlinking locks',async()=>{
  for(const library of ['sourceLib','targetLib']){
   const f=fixture();propose(f.sourceLib);const locked=spawn('python3',['-u','-c','import os,fcntl,sys; fd=os.open(sys.argv[1],os.O_RDONLY|os.O_DIRECTORY); fcntl.flock(fd,fcntl.LOCK_EX); print("locked",flush=True); sys.stdin.read()',f[library]],{stdio:['pipe','pipe','pipe']});
   try{await new Promise((done,reject)=>{locked.stdout.once('data',done);locked.once('error',reject);});expect(()=>run(f)).toThrow(/lock busy/);expect(existsSync(side(f.targetLib))).toBe(false);}finally{locked.stdin.end();await new Promise(done=>locked.once('exit',done));}
   expect(run(f).mode).toBe('dry-run');
  }
 });
 it('serializes competing real migration processes: exactly one publishes, the loser preserves the result',async()=>{
  const f=fixture();propose(f.sourceLib);const plan=run(f),module=resolve('scripts/lib/motion-semantic-migrate.mjs');
  const worker=()=>new Promise((done,reject)=>{const child=spawn(process.execPath,['--input-type=module','-e',`import {migrateSemanticDrafts} from ${JSON.stringify(module)};try{migrateSemanticDrafts(${JSON.stringify({sourceLib:f.sourceLib,targetLib:f.targetLib,apply:true,expected:plan.binding})});}catch{process.exitCode=2;}`],{stdio:'ignore'});child.once('error',reject);child.once('exit',done);});
  expect((await Promise.all([worker(),worker()])).sort()).toEqual([0,2]);expect(readSemanticDrafts({lib:f.targetLib}).head.revision).toBe(1);expect(existsSync(join(f.targetLib,SEMANTIC_MIGRATION_STAGING))).toBe(false);
 });
});
