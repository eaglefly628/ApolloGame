import {describe,it,expect,afterEach} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseMotionRunArgs,validateCandidateOutput} from './run.mjs';
const dirs=[];afterEach(()=>dirs.splice(0).forEach(p=>rmSync(p,{recursive:true,force:true})));
describe('candidate output confinement and resume boundaries',()=>{
 it('refuses existing outputs without erasing diagnostic data',()=>{const root=mkdtempSync('/private/tmp/motion-run-');dirs.push(root);writeFileSync(join(root,'diagnostic'),'keep');expect(()=>validateCandidateOutput(root)).toThrow(/new isolated/);expect(readFileSync(join(root,'diagnostic'),'utf8')).toBe('keep');});
 it('refuses any repository and symlink alias, allows a fresh external candidate',()=>{const root=mkdtempSync('/private/tmp/motion-run-');dirs.push(root);const repo=join(root,'repo');mkdirSync(repo);writeFileSync(join(repo,'.git'),'worktree marker');expect(()=>validateCandidateOutput(join(repo,'data'))).toThrow(/Git/);symlinkSync(root,join(root,'alias'));expect(()=>validateCandidateOutput(join(root,'alias','new'))).toThrow(/aliases/);expect(validateCandidateOutput(join(root,'new'))).toBe(join(root,'new'));});
 it('accepts only named executable options, without shell fragments or hidden flags',()=>{expect(parseMotionRunArgs(['--recipe','r.json','--out','new'])).toEqual({'--recipe':'r.json','--out':'new'});for(const args of [[],['--recipe'],['--recipe','r','--recipe','other','--out','x'],['--recipe','r','--out','x','--approve','true']])expect(()=>parseMotionRunArgs(args)).toThrow();});
});
