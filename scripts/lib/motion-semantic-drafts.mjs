// Draft-only synchronous API. Python dir_fd/flock owns the complete filesystem transaction.
// No user CLI/HTTP, approvals, asset reads or publication. Requires local POSIX Python 3.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
export {SEMANTIC_DRAFT_LIMITS} from './motion-semantic-drafts-validate.mjs';
const helper=fileURLToPath(new URL('./motion-semantic-drafts-fs.py',import.meta.url));
function run(lib,action,request){
 if(process.platform==='win32')throw new Error('semantic drafts: Windows is unsupported; local POSIX Python 3 dir_fd/flock required');
 if(typeof lib!=='string'||!lib)throw new Error('semantic drafts: missing library');
 const input=JSON.stringify({protocolVersion:1,lib:resolve(lib),nodeExecutable:process.execPath,action,...(action==='append'?{request}:{})});
 if(Buffer.byteLength(input)>32768)throw new Error('semantic drafts: request byte budget');
 const result=spawnSync('python3',[helper],{input,encoding:'utf8',maxBuffer:96*1024*1024,timeout:60000});
 if(result.error)throw new Error('semantic drafts: local Python transaction unavailable: '+result.error.message);
 if(result.status!==0)throw new Error((result.stderr||'semantic drafts: filesystem transaction failed').trim());
 return JSON.parse(result.stdout);
}
export function readSemanticDrafts({lib}){return run(lib,'read');}
export function appendSemanticDraft({lib,request}){return run(lib,'append',request);}
