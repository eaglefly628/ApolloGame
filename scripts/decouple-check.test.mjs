// decouple-check 自检——用临时假仓库根，避免依赖真仓库当前违规状态漂移。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findViolations } from './decouple-check.mjs';

const put = (root, rel, content) => { const p = join(root, rel); mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, content); };

describe('decouple-check · findViolations', () => {
  it('games 内走别名/同游戏相对引用 = 零违规', () => {
    const root = mkdtempSync(join(tmpdir(), 'decouple-'));
    try {
      put(root, 'games/game-a/index.ts', `import { Engine } from '@runtime/engine.js';\nimport { helper } from './helper.js';\n`);
      put(root, 'games/game-a/helper.ts', `export const helper = 1;\n`);
      expect(findViolations(root)).toEqual([]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('games 内相对导入逃出自己目录（跨游戏/进 src）= (a) 违规', () => {
    const root = mkdtempSync(join(tmpdir(), 'decouple-'));
    try {
      put(root, 'games/game-a/index.ts', `import { x } from '../game-b/x.js';\n`);
      put(root, 'games/game-b/x.ts', `export const x = 1;\n`);
      const v = findViolations(root);
      expect(v.some((s) => s.startsWith('[a]'))).toBe(true);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('src/launcher 装游戏走白名单免罚·非白名单 src 文件 import 游戏 = (b) 违规', () => {
    const root = mkdtempSync(join(tmpdir(), 'decouple-'));
    try {
      put(root, 'games/game-a/game-a.ts', `export const mount = () => {};\n`);
      put(root, 'src/launcher/game-runner.tsx', `const load = () => import('@games/game-a/game-a.js');\n`);
      put(root, 'src/studio/Foo.tsx', `import { mount } from '@games/game-a/game-a.js';\n`);
      const v = findViolations(root);
      expect(v.some((s) => s.includes('src/studio/Foo.tsx'))).toBe(true);
      expect(v.some((s) => s.includes('src/launcher/game-runner.tsx'))).toBe(false);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
