import { existsSync, realpathSync } from 'node:fs';
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
  let ancestor = dest;
  while (!existsSync(ancestor) && dirname(ancestor) !== ancestor) ancestor = dirname(ancestor);
  if (existsSync(base)) {
    const r = relative(realpathSync(base), realpathSync(ancestor));
    if (r === '..' || r.startsWith('../') || isAbsolute(r)) throw new Error(`符号链接越界: ${rel}`);
  }
  return dest;
}
