import {it,expect,afterEach} from 'vitest';
import {mkdtempSync,mkdirSync,realpathSync,writeFileSync,readFileSync,readdirSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {main} from './motion-semantic-migrate.mjs';
const roots=[];afterEach(()=>roots.splice(0).forEach(root=>rmSync(root,{recursive:true,force:true})));
function fixture(){const root=mkdtempSync(join(realpathSync(tmpdir()),'migration-cli-'));roots.push(root);const old=join(root,'old'),next=join(root,'new');for(const p of [old,next]){mkdirSync(p);writeFileSync(join(p,'catalog.json'),JSON.stringify({version:1,clips:[],skins:[]}));}return {root,old,next};}
const channel=()=>({outputs:[],logs:[],out(s){this.outputs.push(s);},log(s){this.logs.push(s);}});
it('plans without writes and requires an explicit matching plan for publishing a fresh sidecar',()=>{
 const {root,old,next}=fixture(),io=channel(),oldBytes=readFileSync(join(old,'catalog.json'));
 expect(main(['plan','--source',old,'--target',next],io)).toBe(0);expect(readdirSync(next)).toEqual(['catalog.json']);
 const plan=JSON.parse(io.outputs[0]);expect(plan.mode).toBe('dry-run');expect(plan.approval).toBe('not-supported');
 const path=join(root,'plan.json');writeFileSync(path,io.outputs[0]);expect(main(['apply','--source',old,'--target',next,'--plan',path],io)).toBe(0);
 expect(JSON.parse(io.outputs.at(-1)).mode).toBe('applied');expect(readdirSync(join(next,'semantic-review')).sort()).toEqual(['migration-archive','migration-receipt.json']);
 expect(readFileSync(join(old,'catalog.json'))).toEqual(oldBytes);
 expect(main(['apply','--source',old,'--target',next,'--plan',path],channel())).toBe(1);
});
it('refuses stale, symbolic, malformed and implicit plans without writes',()=>{
 const {root,old,next}=fixture(),io=channel();expect(main(['plan','--source',old,'--target',next],io)).toBe(0);
 const path=join(root,'plan.json'),link=join(root,'link.json'),plan=JSON.parse(io.outputs[0]);
 writeFileSync(path,JSON.stringify({...plan,binding:{...plan.binding,targetCatalogSha256:'b'.repeat(64)}}));
 expect(main(['apply','--source',old,'--target',next,'--plan',path],channel())).toBe(1);
 symlinkSync(path,link);expect(main(['apply','--source',old,'--target',next,'--plan',link],channel())).toBe(1);
 writeFileSync(path,JSON.stringify({...plan,mode:'applied'}));expect(main(['apply','--source',old,'--target',next,'--plan',path],channel())).toBe(1);
 for(const args of [[],['apply','--source',old,'--target',next],['plan','--source',old],['plan','--source',old,'--target',next,'--plan',path],['plan','--source',old,'--target',next,'--target',next]])expect(main(args,channel())).toBe(1);
 expect(readdirSync(next)).toEqual(['catalog.json']);expect(readdirSync(old)).toEqual(['catalog.json']);
});
