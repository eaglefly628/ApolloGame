import { lstatSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
export function slugName(value) {
  if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(value)) throw new Error(`非法 slug/scene: ${value}`);
  return value;
}
// Check both lexical traversal and existing symlink ancestors before reading/writing.
export function inside(base, rel) {
  if (typeof rel !== 'string' || !rel || isAbsolute(rel)) throw new Error(`需要相对路径: ${rel}`);
  const dest = resolve(base, rel), escaped = p => { const r = relative(resolve(base), p); return r === '..' || r.startsWith('../') || isAbsolute(r); };
  if (escaped(dest)) throw new Error(`路径越界: ${rel}`);
  const canonical = path => {
    let ancestor = resolve(path);
    while (true) {
      let st;
      try { st = lstatSync(ancestor); }
      catch (e) {
        if (e.code === 'ELOOP') throw new Error(`不可解析的符号链接循环: ${rel}`);
        if (e.code !== 'ENOENT' && e.code !== 'ENOTDIR') throw e;
        if (dirname(ancestor) === ancestor) throw e;
        ancestor = dirname(ancestor); continue;
      }
      let real;
      try { real = realpathSync(ancestor); }
      catch (e) { throw new Error(`${st.isSymbolicLink() ? '悬空' : '不可解析的'}符号链接: ${rel} (${e.code})`); }
      return resolve(real, relative(ancestor, resolve(path)));
    }
  };
  const realBase = canonical(base), realDest = canonical(dest);
  const r = relative(realBase, realDest);
  if (r === '..' || r.startsWith('../') || isAbsolute(r)) throw new Error(`符号链接越界: ${rel}`);
  return dest;
}
