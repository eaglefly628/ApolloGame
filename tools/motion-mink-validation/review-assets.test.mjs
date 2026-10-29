import {tmpdir} from 'node:os';
import {describe,it,expect,afterEach} from 'vitest';
import {realpathSync,mkdtempSync,writeFileSync,readFileSync,lstatSync,rmSync,symlinkSync,linkSync} from 'node:fs';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {copyReviewAsset} from './review-assets.mjs';
const dirs=[];afterEach(()=>dirs.splice(0).forEach(d=>rmSync(d,{recursive:true,force:true})));
const fixture=()=>{const dir=mkdtempSync(join(realpathSync(tmpdir()),'review-copy-'));dirs.push(dir);const source=join(dir,'source'),target=join(dir,'target');writeFileSync(source,'original');return {source,target,sha:createHash('sha256').update('original').digest('hex')};};
describe('review copies preserve immutable source bytes',()=>{
 it('editing the review cannot alter source inode or bytes',()=>{const {source,target,sha}=fixture();copyReviewAsset(source,target,sha);expect(lstatSync(source).ino).not.toBe(lstatSync(target).ino);writeFileSync(target,'edited');expect(readFileSync(source,'utf8')).toBe('original');expect(()=>copyReviewAsset(source,target,sha)).toThrow(/SHA/);});
 it.each(['symlink','hardlink'])('rejects a %s review alias',type=>{const {source,target,sha}=fixture();if(type==='symlink')symlinkSync(source,target);else linkSync(source,target);expect(()=>copyReviewAsset(source,target,sha)).toThrow(/independent/);expect(readFileSync(source,'utf8')).toBe('original');});
 it('refuses bad source identities before publication',()=>{const {source,target}=fixture();expect(()=>copyReviewAsset(source,target,'0'.repeat(64))).toThrow(/source asset SHA/);});
});
