#!/usr/bin/env node
/** Thin CLI over the single locked migration implementation; never edits catalogs or assets. */
import {openSync,closeSync,fstatSync,readFileSync,constants} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {migrateSemanticDrafts} from './lib/motion-semantic-migrate.mjs';
const check=(ok,message)=>{if(!ok)throw new Error('semantic migration CLI: '+message);};
function planBinding(path){
 const fd=openSync(resolve(path),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try {
  const before=fstatSync(fd);check(before.isFile()&&before.size<=32*1024*1024,'plan must be a bounded regular JSON file');
  const bytes=readFileSync(fd),after=fstatSync(fd);check(bytes.length===before.size&&after.size===before.size&&after.mtimeMs===before.mtimeMs&&after.ctimeMs===before.ctimeMs,'plan file changed');
  const plan=JSON.parse(bytes.toString('utf8'));check(plan.schemaVersion===1&&plan.kind==='semantic-draft-migration'&&plan.mode==='dry-run','use an explicit dry-run migration plan');return plan.binding;
 }finally{closeSync(fd);}
}
export function main(args=process.argv.slice(2),io={out:console.log,log:console.error}){
 try{
  const command=args[0];check(['plan','apply'].includes(command),'use plan | apply --source OLD --target NEW [--plan PLAN.json]');
  const options={};for(let i=1;i<args.length;i++){
   const key=args[i];check(['--source','--target','--plan'].includes(key)&&!Object.hasOwn(options,key),'unknown/duplicate option');
   const value=args[++i];check(typeof value==='string'&&value.trim().length&&!value.startsWith('--'),'missing option value');options[key]=value;
  }
  check(options['--source']&&options['--target'],'explicit --source and --target required');
  check(command==='apply'?!!options['--plan']:!options['--plan'],'--plan required only for apply');
  const result=migrateSemanticDrafts({sourceLib:options['--source'],targetLib:options['--target'],apply:command==='apply',...(command==='apply'?{expected:planBinding(options['--plan'])}:{})});
  io.log('[motion-semantic-migrate] '+(command==='apply'?'commit':'decision')+' '+JSON.stringify({mode:result.mode,...result.counts,approval:result.approval}));
  io.out(JSON.stringify(result,null,2));return 0;
 }catch(error){io.log('[motion-semantic-migrate] reject '+JSON.stringify({message:error.message}));return 1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)process.exitCode=main();
