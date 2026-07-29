// assert-no-baked-key.mjs 纯函数单测（platform-packaging-spec.md 决策②·零 key 红线）。
// 只钉 scanDir 的判定逻辑（危险文件名 / key 字面量特征 / 不误伤合法数据）；
// 端到端在真产物上跑见 scripts/build-platform.mjs 的 verify() 与本文件同一 scanDir。
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDir } from './assert-no-baked-key.mjs';

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'apollo-keyscan-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe('scanDir · 零 key 断言', () => {
  it('干净目录 → 零命中', () => {
    writeFileSync(join(dir, 'app.js'), 'console.log("hello world");');
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>ok</title>');
    const { hits, fileCount } = scanDir(dir);
    expect(hits).toEqual([]);
    expect(fileCount).toBe(2);
  });

  it('命中 ark- 前缀长 key 字面量', () => {
    writeFileSync(join(dir, 'leak.py'), `ARK_API_KEY = "ark-${'a'.repeat(30)}"`);
    const { hits } = scanDir(dir);
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain('ark- 前缀');
  });

  it('命中 sk- 前缀长 key 字面量', () => {
    writeFileSync(join(dir, 'leak.env'), `OPENAI_API_KEY=sk-${'B'.repeat(40)}`);
    const { hits } = scanDir(dir);
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain('sk- 前缀');
  });

  it('危险文件名（.env / .apollo-config.json）无视内容直接命中', () => {
    writeFileSync(join(dir, '.env'), 'FOO=bar');
    mkdirSync(join(dir, 'sub'));
    writeFileSync(join(dir, 'sub', '.apollo-config.json'), '{}');
    const { hits } = scanDir(dir);
    expect(hits.length).toBe(2);
    expect(hits.some((h) => h.includes('.env'))).toBe(true);
    expect(hits.some((h) => h.includes('.apollo-config.json'))).toBe(true);
  });

  it('不误伤短的合法 "sk-" 前缀数据 id（game-i 皮肤画廊命名习惯）', () => {
    // 真实场景：src/games/game-i/gallery.ts 里的 'sk-wood-rib' / 'sk-scroll-pill' 等控件 id——
    // 短（个位数~十来个字符），必须放过；只有 20+ 字符的长串才该被当成疑似 key。
    writeFileSync(join(dir, 'gallery.js'), `const ids = ['sk-metal', 'sk-wood-rib', 'sk-scroll-pill', 'sk-9-slice'];`);
    const { hits } = scanDir(dir);
    expect(hits).toEqual([]);
  });

  it('跳过二进制/字体等扩展名（不读取内容也不误报）', () => {
    writeFileSync(join(dir, 'font.woff2'), Buffer.from([0, 1, 2, 3]));
    writeFileSync(join(dir, 'pic.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const { hits, scanned } = scanDir(dir);
    expect(hits).toEqual([]);
    expect(scanned).toBe(0);
  });

  it('递归扫子目录', () => {
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'b', 'deep.py'), `x = "ark-${'z'.repeat(25)}"`);
    const { hits } = scanDir(dir);
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain(join(dir, 'a', 'b', 'deep.py'));
  });
});
