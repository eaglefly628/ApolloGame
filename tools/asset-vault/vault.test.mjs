import {it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
it('exercises the portable vault against synthetic temporary files only',()=>{
 const folder=fileURLToPath(new URL('.',import.meta.url));
 const result=spawnSync('python3',['-B','-m','unittest','discover','-s',folder,'-p','test_vault.py','-v'],{encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 expect(result.error?.message,result.stderr).toBeUndefined();expect(result.status,result.stderr).toBe(0);expect(Number(result.stderr.match(/Ran (\d+) tests/)?.[1]||0)).toBeGreaterThan(0);expect(result.stderr).toContain('OK');
},25000);
