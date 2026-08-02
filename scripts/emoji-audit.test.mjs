// emoji-audit 自检：UI 文本里的 emoji 计入、纯注释行里的排除、聚合正确。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { auditEmoji } from './emoji-audit.mjs';

let root;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'emoji-'));
  const dir = join(root, 'games', 'game-t');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'screen.ts'), [
    `// 花色记号 ♠♥ 只在注释里——不该计入`,
    `const label = { text: '🎲 掷骰' };`,       // UI 文本里的 🎲 计入
    `const title = '💎 镶嵌槽';`,               // 💎 计入
    `export const x = '🎲 再来一次';`,           // 第二个 🎲
  ].join('\n'));
  writeFileSync(join(dir, 'screen.test.ts'), `const t='🀄 测试文件不该扫';`); // .test.ts 排除
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('emoji-audit · 只扫玩家可见 UI 文本', () => {
  it('注释行 emoji 不计入·UI 文本 emoji 计入', () => {
    const r = auditEmoji('game-t', { root });
    const kinds = Object.fromEntries(r.emojis.map((e) => [e.emoji, e.count]));
    expect(kinds['🎲']).toBe(2);   // 两处 UI 文本
    expect(kinds['💎']).toBe(1);
    expect(kinds['♠']).toBeUndefined(); // 只在注释里 → 不计
    expect(kinds['🀄']).toBeUndefined(); // .test.ts → 不扫
  });

  it('聚合：total / distinct / 文件排名', () => {
    const r = auditEmoji('game-t', { root });
    expect(r.total).toBe(3); // 🎲×2 + 💎×1
    expect(r.distinct).toBe(2);
    expect(r.files[0].file).toBe('screen.ts');
  });
});
