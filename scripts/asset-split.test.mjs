import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateSplit, annotateSplit, deriveSplitLedger, splitWorkspace } from './asset-split.mjs';
import { mockImage } from './ai-gen.mjs';
import { decodePng } from './asset-matte.mjs';
const row=(patch={})=>({id:'lamp',scene:'hall',bbox:[2,3,12,15],route:'generate',skinKey:'example/lamp',prompt:'warm brass lamp',refs:['keyart/hall.png'],state:'approved',...patch});
function fixture(fn){const root=mkdtempSync(join(tmpdir(),'aiflow-split-'));try{const dir=join(root,'docs/design/example');mkdirSync(join(dir,'keyart'),{recursive:true});writeFileSync(join(dir,'keyart/hall.png'),mockImage('hall',32).buffer);writeFileSync(join(dir,'asset-split.json'),JSON.stringify([row(),row({id:'wall',skinKey:'example/wall',route:'build',state:'proposed'})]));return fn(root,dir);}finally{rmSync(root,{recursive:true,force:true});}}
describe('T2 split contract',()=>{
 it.each([undefined,null,'', '  '])('无 skinKey 行拒收，包括 proposed (%s)',skinKey=>{expect(()=>validateSplit([row({skinKey,state:'proposed'})])).toThrow('skinKey');});
 it.each([{bbox:[-1,0,2,2]},{bbox:[0,0,0,2]},{bbox:[0.5,0,2,2]},{route:'tripo'},{state:'done'},{scene:'../escape'},{refs:'x'},{prompt:''},{extra:true}])('无效字段拒收 %j',patch=>expect(()=>validateSplit([row(patch)])).toThrow());
 it('空表和重复id拒收',()=>{expect(()=>validateSplit([])).toThrow('非空');expect(()=>validateSplit([row(),row()])).toThrow('重复');});
 it('仅 approved 导入；拆层批准不等于美术批准',()=>{const ledger=deriveSplitLedger([row(),row({id:'wall',skinKey:'example/wall',state:'proposed'})],'example');expect(ledger.rows.map(r=>r.skinKey)).toEqual(['example/lamp']);expect(ledger.rows[0]).toMatchObject({status:'needs-art',gen:null,provenance:null});});
 it('合并既有拆层台账保号、历史、生成资产；相同skinKey合并来源；撤回批准的行不再活跃',()=>{
  const prev={mode:'requirements',rows:[{no:'art-19',skinKey:'example/lamp',splitIds:['lamp'],status:'filled',gen:{servedPath:'real.png'},history:[{action:'upload'}]}]};
  const l=deriveSplitLedger([row(),row({id:'lamp2'}),row({id:'new',skinKey:'example/new'})],'example',prev);
  expect(l.rows[0]).toMatchObject({no:'art-19',status:'filled',gen:{servedPath:'real.png'},history:[{action:'upload'}],splitIds:['lamp','lamp2']});expect(l.rows[1].no).toBe('art-20');
  const withdrawn=deriveSplitLedger([row({state:'proposed'})],'example',l);expect(withdrawn.rows.filter(r=>r.status!=='retired')).toEqual([]);
 });
 it('C1 forward: splitWorkspace preserves manifest-owned needs-art rows byte-for-byte',()=>fixture((root)=>{
  const old={no:'art-07',skinKey:'example/stove',kind:'sprite',slot:{entity:'stove',component:'Sprite',field:'textureKey'},status:'needs-art',gen:null,provenance:null,query:'stove',history:[{action:'edit',note:'keep me'}],custom:{owner:'manifest'}};
  const file=join(root,'public/games/example/art/art-ledger.json');mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,JSON.stringify({version:1,game:'example',mode:'compiled',artStyle:{packId:'pixel-retro'},rows:[old]}));
  const out=splitWorkspace(root,'example');
  expect(out.ledger.rows.find(r=>r.no==='art-07')).toEqual(old);
  expect(out.ledger.rows.find(r=>r.splitIds)).toMatchObject({no:'art-08',skinKey:'example/lamp',splitIds:['lamp'],status:'needs-art'});
  const saved=JSON.parse(readFileSync(file,'utf8'));expect(saved.rows.find(r=>r.no==='art-07')).toEqual(old);
  expect(saved.mode).toBe('compiled');expect(saved.artStyle).toEqual({packId:'pixel-retro'});
 }));
 it('C8 same skinKey merges into one existing game row while preserving its asset and numbering',()=>{
  const foreign={no:'art-19',skinKey:'example/lamp',status:'generated',gen:{servedPath:'foreign.png',mock:false},history:[{action:'upload'}],custom:'foreign',refs:['manual.png','keyart/hall.png'],prompt:'owner prompt'};
  const previous={version:1,mode:'compiled',rows:[foreign]};const snapshot=JSON.stringify(previous);
  const imported=deriveSplitLedger([row(),row({id:'lamp2',refs:['keyart/other.png']})],'example',previous);
  expect(imported.rows).toHaveLength(1);
  expect(imported.rows[0]).toMatchObject({no:'art-19',skinKey:'example/lamp',status:'generated',gen:foreign.gen,history:foreign.history,custom:'foreign',splitIds:['lamp','lamp2'],refs:['manual.png','keyart/hall.png','keyart/other.png'],prompt:'warm brass lamp',splitBase:{refs:['manual.png','keyart/hall.png'],prompt:'owner prompt'}});
  expect(deriveSplitLedger([row(),row({id:'lamp2',refs:['keyart/other.png']})],'example',imported)).toEqual(imported);
  expect(JSON.stringify(previous)).toBe(snapshot);
 });
 it('C8 withdrawal only removes attachment fields and restores original refs and prompt without retiring the game row',()=>{
  const original={no:'art-19',skinKey:'example/lamp',status:'generated',gen:{servedPath:'foreign.png',mock:false},history:[{action:'upload'}],refs:['manual.png'],prompt:'owner prompt',custom:'preserve'};
  const imported=deriveSplitLedger([row()],'example',{rows:[original]});
  const snapshot=JSON.stringify(imported);
  const withdrawn=deriveSplitLedger([row({state:'proposed'})],'example',imported);
  expect(withdrawn.rows).toEqual([original]);
  expect(Object.hasOwn(withdrawn.rows[0],'splitIds')).toBe(false);
  expect(Object.hasOwn(withdrawn.rows[0],'splitBase')).toBe(false);
  expect(deriveSplitLedger([row({state:'proposed'})],'example',withdrawn)).toEqual(withdrawn);
  expect(JSON.stringify(imported)).toBe(snapshot);
 });
 it('C8 withdrawal deletes refs and prompt when the underlying game row originally had neither field',()=>{
  const original={no:'art-03',skinKey:'example/lamp',status:'needs-art',gen:null,history:[{action:'game-derive'}]};
  const previous={rows:[original]};const snapshot=JSON.stringify(previous);
  const imported=deriveSplitLedger([row()],'example',previous);
  expect(imported.rows).toHaveLength(1);
  expect(imported.rows[0].splitBase).toEqual({});
  const withdrawn=deriveSplitLedger([row({state:'proposed'})],'example',imported);
  expect(withdrawn.rows).toEqual([original]);
  for(const field of ['splitIds','splitBase','refs','prompt'])expect(Object.hasOwn(withdrawn.rows[0],field)).toBe(false);
  expect(JSON.stringify(previous)).toBe(snapshot);
 });
 it('C8 splitWorkspace persists one shared slot and repeated derivation does not recapture the original fields',()=>fixture((root,dir)=>{
  const original={no:'art-11',skinKey:'example/lamp',status:'filled',gen:{servedPath:'lamp.png'},history:[{action:'upload'}],refs:['manual.png'],prompt:'original prompt'};
  const file=join(root,'public/games/example/art/art-ledger.json');mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,JSON.stringify({version:1,mode:'compiled',rows:[original]}));
  const imported=splitWorkspace(root,'example');
  expect(imported.ledger.rows).toHaveLength(1);expect(imported.ledger.rows[0].no).toBe('art-11');
  expect(imported.ledger.rows[0].splitBase).toEqual({refs:['manual.png'],prompt:'original prompt'});
  const saved=readFileSync(file);splitWorkspace(root,'example');expect(readFileSync(file)).toEqual(saved);
  writeFileSync(join(dir,'asset-split.json'),JSON.stringify([row({state:'proposed'})]));splitWorkspace(root,'example');
  expect(JSON.parse(readFileSync(file,'utf8')).rows).toEqual([original]);
 }));
 it('C8 prior duplicate skinKey rows coalesce into the game row and preserve a reversible split overlay',()=>{
  const original={no:'art-06',skinKey:'example/lamp',status:'generated',gen:{servedPath:'original.png'},history:[{action:'upload'}],prompt:'game prompt',refs:['game-ref.png']};
  const duplicate={no:'art-20',skinKey:'example/lamp',status:'needs-art',splitIds:['lamp'],refs:['keyart/hall.png'],prompt:'warm brass lamp',gen:null};
  const previous={rows:[original,duplicate]},snapshot=JSON.stringify(previous);
  const imported=deriveSplitLedger([row()],'example',previous);
  expect(imported.rows).toHaveLength(1);expect(imported.rows[0]).toMatchObject({no:'art-06',status:'generated',gen:original.gen,history:original.history,splitIds:['lamp'],splitBase:{refs:['game-ref.png'],prompt:'game prompt'}});
  expect(deriveSplitLedger([row({state:'proposed'})],'example',imported).rows).toEqual([original]);
  const appended=deriveSplitLedger([row(),row({id:'new',skinKey:'example/new'})],'example',previous);
  expect(appended.rows.find(r=>r.skinKey==='example/new').no).toBe('art-21'); // 已被合并的 art-20 仍不得复用
  expect(JSON.stringify(previous)).toBe(snapshot);
 });
 it('C8 migration persists the highest used number across splitWorkspace disk reload before allocating a new slot',()=>fixture((root,dir)=>{
  const original={no:'art-06',skinKey:'example/lamp',status:'generated',gen:{servedPath:'original.png'},history:[{action:'upload'}]};
  const duplicate={no:'art-20',skinKey:'example/lamp',status:'needs-art',splitIds:['lamp'],refs:['keyart/hall.png'],prompt:'warm brass lamp'};
  const file=join(root,'public/games/example/art/art-ledger.json');mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,JSON.stringify({version:1,rows:[original,duplicate]}));
  splitWorkspace(root,'example');
  const migrated=JSON.parse(readFileSync(file,'utf8'));
  expect(migrated.rows).toHaveLength(1);expect(migrated.rows[0].no).toBe('art-06');
  expect(migrated.maxNo).toBe(20); // art-20 已并入另一行，但该编号永远被占用
  writeFileSync(join(dir,'asset-split.json'),JSON.stringify([row(),row({id:'wall',skinKey:'example/wall'})]));
  splitWorkspace(root,'example');
  const added=JSON.parse(readFileSync(file,'utf8'));
  expect(added.rows.find(r=>r.skinKey==='example/wall').no).toBe('art-21');expect(added.maxNo).toBe(21);
  const before=readFileSync(file);splitWorkspace(root,'example');expect(readFileSync(file)).toEqual(before);
 }));
 it('C1 forward: every non-split status and unknown field survives while own metadata refreshes',()=>{
  const foreign=['needs-art','placeholder','generated','approved','filled','retired'].map((status,i)=>({no:`art-${String(i+1).padStart(2,'0')}`,skinKey:`example/foreign-${i}`,status,gen:{marker:i},history:[{action:'custom'}],custom:{unchanged:true}}));
  const owned={no:'art-25',skinKey:'example/lamp',splitIds:['previous-id'],status:'generated',gen:{servedPath:'own.png'},provenance:{provider:'fixture'},prompt:'hand edited',history:[{action:'fill'}],custom:{keep:true}};
  const previous={rows:[...foreign,owned]};const snapshot=JSON.stringify(previous);
  const result=deriveSplitLedger([row({prompt:'new derived prompt'}),row({id:'lamp2',refs:['keyart/other.png']})],'example',previous);
  expect(result.rows.slice(0,foreign.length)).toEqual(foreign);
  expect(result.rows.at(-1)).toMatchObject({...owned,splitIds:['lamp','lamp2'],refs:['keyart/hall.png','keyart/other.png']});
  expect(JSON.stringify(previous)).toBe(snapshot);
  const retired=deriveSplitLedger([row({id:'other',skinKey:'example/other'})],'example',result);
  expect(retired.rows.find(r=>r.no==='art-25').status).toBe('retired');
  const restored=deriveSplitLedger([row()],'example',retired);
  expect(restored.rows.find(r=>r.no==='art-25')).toMatchObject({status:'needs-art',gen:owned.gen,history:owned.history,prompt:owned.prompt});
 });
 it('标注图相同输入字节相同，并且标线确实在bbox坐标处',()=>{const image=decodePng(mockImage('hall',32).buffer);const a=annotateSplit(image,[row()]);const b=annotateSplit(image,[row()]);expect(createHash('sha256').update(a).digest('hex')).toBe(createHash('sha256').update(b).digest('hex'));const dec=decodePng(a);expect([...dec.rgba.subarray(((3+14)*32+2)*4,((3+14)*32+2)*4+4)]).toEqual([255,187,40,255]);expect(a.equals(mockImage('hall',32).buffer)).toBe(false);expect(()=>annotateSplit(image,[row({bbox:[31,0,2,2]})])).toThrow('超出');});
 it('工作区完整落地且重跑幂等',()=>fixture((root,dir)=>{const a=splitWorkspace(root,'example');const png=readFileSync(a.outputs[0]);const ledger=readFileSync(join(root,'public/games/example/art/art-ledger.json'));splitWorkspace(root,'example');expect(readFileSync(a.outputs[0])).toEqual(png);expect(readFileSync(join(root,'public/games/example/art/art-ledger.json'))).toEqual(ledger);expect(readFileSync(join(dir,'asset-split.md'),'utf8')).toContain('| 2 | wall');}));
 it('卡带台账落 artRoot，不落内置游戏目录',()=>fixture((root)=>{mkdirSync(join(root,'library/example'),{recursive:true});splitWorkspace(root,'example');expect(existsSync(join(root,'library/example/art/art-ledger.json'))).toBe(true);expect(existsSync(join(root,'public/games/example/art/art-ledger.json'))).toBe(false);}));
 it('无槽、缺参考图或越界bbox时零输出',()=>fixture((root,dir)=>{for(const patch of [{skinKey:''},{refs:['gone.png']},{bbox:[31,0,2,2]},{refs:['../secret.png']}]){writeFileSync(join(dir,'asset-split.json'),JSON.stringify([row(patch)]));expect(()=>splitWorkspace(root,'example')).toThrow();expect(existsSync(join(dir,'keyart/hall-split.png'))).toBe(false);expect(existsSync(join(root,'public/games/example/art/art-ledger.json'))).toBe(false);}}));
 it('符号链接逃逸拒收',()=>fixture((root,dir)=>{symlinkSync(tmpdir(),join(dir,'escape'));writeFileSync(join(dir,'asset-split.json'),JSON.stringify([row({refs:['escape/anything.png']})]));expect(()=>splitWorkspace(root,'example')).toThrow('符号链接');}));
 it('mock 只写隔离预览，不写台账、不改state',()=>fixture((root,dir)=>{const src=readFileSync(join(dir,'asset-split.json'));const out=splitWorkspace(root,'example',{mock:true});expect(out.outputs[0]).toContain('/keyart/mock/');expect(existsSync(join(root,'public/games/example/art/art-ledger.json'))).toBe(false);expect(readFileSync(join(dir,'asset-split.json'))).toEqual(src);}));
});
