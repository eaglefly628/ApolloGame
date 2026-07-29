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

  it('跳过无扩展名的二进制文件（D5 起 pybundle/bin/python3 这类真解释器可执行文件）', () => {
    // 头部塞 NUL 字节模拟真实二进制（ELF/Mach-O 头都含 NUL），紧跟着放一段「看起来像 key」的
    // 噪声——如果嗅探没生效，旧的纯 utf8+regex 路径会把这当文本命中，验证嗅探确实拦住了它。
    const noise = Buffer.concat([
      Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x00, 0x00, 0x00]), // 类 ELF 魔数 + NUL
      Buffer.from(`sk-${'x'.repeat(40)}`),
    ]);
    writeFileSync(join(dir, 'python3'), noise); // 无扩展名，故意不落在 SKIP_EXT 里
    const { hits, scanned } = scanDir(dir);
    expect(hits).toEqual([]);
    expect(scanned).toBe(0);
  });

  it('跳过新增原生库/wheel 扩展名（.so/.dylib/.a/.whl）', () => {
    writeFileSync(join(dir, 'libfoo.so'), Buffer.from([0, 1, 2]));
    writeFileSync(join(dir, 'libfoo.dylib'), Buffer.from([0, 1, 2]));
    writeFileSync(join(dir, 'libfoo.a'), Buffer.from([0, 1, 2]));
    writeFileSync(join(dir, 'pip-1.0-py3-none-any.whl'), Buffer.from([0, 1, 2]));
    const { hits, scanned } = scanDir(dir);
    expect(hits).toEqual([]);
    expect(scanned).toBe(0);
  });

  it('二进制嗅探不误伤合法纯文本（含真 key 的 .py 文件头部无 NUL）仍照常命中', () => {
    writeFileSync(join(dir, 'leak.py'), `TOKEN = "sk-${'q'.repeat(30)}"`);
    const { hits, scanned } = scanDir(dir);
    expect(scanned).toBe(1);
    expect(hits.length).toBe(1);
  });

  it('递归扫子目录', () => {
    mkdirSync(join(dir, 'a', 'b'), { recursive: true });
    writeFileSync(join(dir, 'a', 'b', 'deep.py'), `x = "ark-${'z'.repeat(25)}"`);
    const { hits } = scanDir(dir);
    expect(hits.length).toBe(1);
    expect(hits[0]).toContain(join(dir, 'a', 'b', 'deep.py'));
  });
});
