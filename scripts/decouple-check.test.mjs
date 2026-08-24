// decouple-check 自检——用临时假仓库根，避免依赖真仓库当前违规状态漂移。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
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

  it('CLI 红腿：种违例树 → exit 1 + 逐条违规打印（测试加固批 2026-08-24·此前只测纯函数·退出码映射零覆盖）', () => {
    // main() 的 ROOT 由脚本自身位置推导 → hermetic 姿势 = 把守卫复制进临时根（它只 import
    // node 内建·零仓内依赖），种一条 (a) 逃逸违例后 spawn 真跑。绝不写真仓。
    const root = mkdtempSync(join(tmpdir(), 'decouple-cli-'));
    try {
      mkdirSync(join(root, 'scripts'), { recursive: true });
      copyFileSync(join(dirname(fileURLToPath(import.meta.url)), 'decouple-check.mjs'), join(root, 'scripts', 'decouple-check.mjs'));
      put(root, 'games/game-a/index.ts', `import { x } from '../game-b/x.js';\n`);
      put(root, 'games/game-b/x.ts', `export const x = 1;\n`);
      const r = spawnSync(process.execPath, [join(root, 'scripts', 'decouple-check.mjs')], { encoding: 'utf8', timeout: 30000 });
      expect(r.status, r.stdout + r.stderr).toBe(1); // 撤修验红本体：守卫失能则等不到 1
      expect(r.stderr).toContain('decouple-check');
      expect(r.stderr).toContain('[a]'); // 锚点命中：报的确是种下的 (a) 逃逸违例
      expect(r.stderr).toContain('games/game-a/index.ts');
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
