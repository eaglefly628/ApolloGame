// T1: local PNG inputs are immutable snapshots; only hashes/paths enter provenance.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

export function loadImageInputs({ refs = [], edit = null, cwd = process.cwd() } = {}) {
  return [...(edit ? [{ path: edit, role: 'edit' }] : []), ...refs.map(path => ({ path, role: 'reference' }))].map(input => {
    const buffer = readFileSync(resolve(cwd, input.path));
    if (buffer.length < 33 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || buffer.toString('ascii', 12, 16) !== 'IHDR') {
      console.error(`[ai-gen] reject: ${input.path} is not PNG`);
      throw new Error(`参考图必须是 PNG: ${input.path}`);
    }
    if (buffer.length > 30 * 1024 * 1024) throw new Error(`参考图超过 30MB: ${input.path}`);
    return { ...input, sha256: createHash('sha256').update(buffer).digest('hex'), buffer };
  });
}
export const inputProvenance = inputs => inputs.map(({ path, role, sha256 }) => ({ path, role, sha256 }));
export const imageDataUrls = inputs => inputs.map(input => `data:image/png;base64,${input.buffer.toString('base64')}`);

export function parseGenerationArgs(argv) {
  const result = { refs: [], edit: null, game: null, forcedId: null, mock: false, asJson: false };
  const words = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mock') result.mock = true;
    else if (a === '--json') result.asJson = true;
    else if (a === '--ref') {
      const start = i;
      while (argv[i + 1] && !argv[i + 1].startsWith('--')) result.refs.push(argv[++i]);
      if (start === i) throw new Error('--ref 需要至少一个 PNG 路径');
    } else if (['--edit', '--game', '--id'].includes(a)) {
      const value = argv[++i];
      if (!value || value.startsWith('--')) throw new Error(`${a} 缺值`);
      const key = { '--edit': 'edit', '--game': 'game', '--id': 'forcedId' }[a];
      if (result[key]) throw new Error(`${a} 不能重复`);
      result[key] = value;
    } else if (a.startsWith('--')) throw new Error(`未知选项: ${a}`);
    else words.push(a);
  }
  result.prompt = words.join(' ').trim();
  if (!result.prompt) throw new Error('缺 prompt（提示词放在 --ref 前）');
  return result;
}
