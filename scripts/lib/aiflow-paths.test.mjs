import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { inside } from './aiflow-paths.mjs';
function fixture(fn) {
 const root = mkdtempSync(join(tmpdir(), 'aiflow-path-c2-'));
 const base = join(root, 'workspace'); mkdirSync(join(base, 'keyart'), {recursive:true});
 try { fn(root, base); } finally { rmSync(root, {recursive:true, force:true}); }
}
describe('C2 symlink containment', () => {
 it('C2 rejects dangling outward mock link before a write can escape', () => fixture((root, base) => {
  const target=join(root,'outside','missing');
  symlinkSync(target,join(base,'keyart/mock'));
  expect(existsSync(join(base,'keyart/mock'))).toBe(false);
  expect(()=>inside(base,'keyart/mock/x.png')).toThrow(/悬空.*符号链接/);
  expect(existsSync(target)).toBe(false);
 }));
 it('C2 rejects dangling inward links as well as live outward links', () => fixture((root,base) => {
  symlinkSync(join(base,'missing'),join(base,'dangling'));
  symlinkSync(root,join(base,'outward'));
  expect(()=>inside(base,'dangling/x.png')).toThrow(/符号链接/);
  expect(()=>inside(base,'outward/x.png')).toThrow(/符号链接越界/);
 }));
 it('C2 rejects symlink loops but allows resolved in-workspace links and new directories', () => fixture((root,base) => {
  symlinkSync('loop',join(base,'loop'));
  symlinkSync(join(base,'keyart'),join(base,'local'));
  expect(()=>inside(base,'loop/x.png')).toThrow(/符号链接/);
  expect(inside(base,'local/new/x.png')).toBe(join(base,'local/new/x.png'));
  expect(inside(join(base,'new-root'),'nested/x.png')).toBe(join(base,'new-root/nested/x.png'));
  expect(()=>inside(base,'../outside.png')).toThrow(/路径越界/);
 }));
});
