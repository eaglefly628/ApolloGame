// emoji-vendor 自检：扫游戏 emoji → 去重解析 → copy 进本地 + 登记本地 index（apply 到临时根）。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { planEmojiVendor, vendorEmoji } from './emoji-vendor.mjs';

let root;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'emojivendor-'));
  // 假共享库：两张 emoji 图 + index（🎲=1f3b2·⭐=2b50）
  const A = join(root, 'assets', 'emoji');
  mkdirSync(A, { recursive: true });
  writeFileSync(join(A, '1f3b2.png'), Buffer.from([0x89, 0x50]));
  writeFileSync(join(A, '2b50.png'), Buffer.from([0x89, 0x50]));
  writeFileSync(join(root, 'assets', 'index.json'), JSON.stringify({
    version: 1, assets: [
      { id: 'emoji/game_die', category: 'emoji', type: 'texture', status: 'filled', path: 'emoji/1f3b2.png' },
      { id: 'emoji/star', category: 'emoji', type: 'texture', status: 'filled', path: 'emoji/2b50.png' },
    ],
  }));
  // 游戏 UI 源：🎲（exact）+ ★（alias→2b50）+ ☆（alias→2b50·与 ★ 去重）
  const g = join(root, 'games', 'game-t');
  mkdirSync(g, { recursive: true });
  writeFileSync(join(g, 'screen.ts'), [`const a = { text: '🎲 掷骰' };`, `const b = '★ 满星 ☆ 空星';`].join('\n'));
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('emoji-vendor · 扫→去重→vendor 进本地', () => {
  it('plan：★☆ 都解析到 ⭐(2b50)·与 🎲 共 2 张唯一美术图', () => {
    const p = planEmojiVendor('game-t', { root });
    expect(p.uniqueArt).toBe(2); // 🎲 + ⭐（★☆ 去重）
    expect(p.assets.map((a) => a.id).sort()).toEqual(['emoji/1f3b2', 'emoji/2b50']);
    expect(p.missing).toEqual([]);
  });

  it('apply：copy 文件 + 登记本地 index（码点键·servedPath·vendoredFrom）', () => {
    const res = vendorEmoji('game-t', { root });
    expect(res.copied).toBe(2);
    expect(existsSync(join(root, 'public', 'games', 'game-t', 'art', 'emoji', '1f3b2.png'))).toBe(true);
    expect(existsSync(join(root, 'public', 'games', 'game-t', 'art', 'emoji', '2b50.png'))).toBe(true);
    const idx = JSON.parse(readFileSync(join(root, 'public', 'games', 'game-t', 'art', 'index.json'), 'utf8'));
    const die = idx.assets.find((a) => a.id === 'emoji/1f3b2');
    expect(die).toMatchObject({ type: 'texture', category: 'emoji', path: '/games/game-t/art/emoji/1f3b2.png' });
    expect(die.provenance.vendoredFrom).toBe('emoji/game_die');
  });
});
