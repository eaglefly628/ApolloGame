// package-web.mjs 纯函数单测（REQ-PKG）：内联注入 / 自包含体检 / 卡带读取。
// 不跑真 vite 构建（重·见 scripts/package-web-smoke.mjs 端到端）；只钉纯变换正确性。
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { injectInline, scanSelfContainment, readCartManifest, readCartMeta } from './package-web.mjs';

const SHELL = '<!doctype html><html><head><title>Apollo OS</title></head><body><script type="module">/*bundle*/console.log("run")</script></body></html>';

describe('injectInline · 注入内联卡带 globals', () => {
  it('把 __APOLLO_INLINE_CART__ 注进 <head>，且在 module bundle 之前执行', () => {
    const out = injectInline(SHELL, { cart: { capabilities: [], entities: {} }, meta: { title: 'X', subtitle: 'y' }, title: 'X' });
    expect(out).toContain('window.__APOLLO_INLINE_CART__=');
    expect(out).toContain('window.__APOLLO_INLINE_META__=');
    // 注入脚本必须在 </head> 之前（=在 body 里的 module bundle 之前执行·经典脚本先于 deferred module）。
    expect(out.indexOf('__APOLLO_INLINE_CART__')).toBeLessThan(out.indexOf('</head>'));
    expect(out.indexOf('__APOLLO_INLINE_CART__')).toBeLessThan(out.indexOf('type="module"'));
  });

  it('覆盖 <title> 为游戏名', () => {
    const out = injectInline(SHELL, { cart: {}, title: '翻命扑克' });
    expect(out).toContain('<title>翻命扑克</title>');
    expect(out).not.toContain('<title>Apollo OS</title>');
  });

  it('manifest 里的 "</script>" 被转义（不提前闭合内联 script）', () => {
    const out = injectInline(SHELL, { cart: { note: 'evil</script><script>alert(1)</script>' } });
    expect(out).toContain('\\u003c/script\\u003e');
    // 全文 </script> 仅剩 2 个真实闭合：注入的内联 script + 外壳原有的 module script。
    expect((out.match(/<\/script>/g) || []).length).toBe(2);
  });

  it('可选注入 __APOLLO_INLINE_ASSETS__（有资产才注）', () => {
    const withAssets = injectInline(SHELL, { cart: {}, assets: { 'assets/FreeArtLib/a.png': 'data:image/png;base64,AAAA' } });
    expect(withAssets).toContain('__APOLLO_INLINE_ASSETS__');
    const noAssets = injectInline(SHELL, { cart: {}, assets: {} });
    expect(noAssets).not.toContain('__APOLLO_INLINE_ASSETS__');
  });

  it('外壳缺 </head> → 明确抛错', () => {
    expect(() => injectInline('<html><body>x</body></html>', { cart: {} })).toThrow(/head/i);
  });
});

describe('scanSelfContainment · 自包含体检', () => {
  it('内联 data: 与相对路径 → 零问题（自包含）', () => {
    const clean = injectInline(SHELL, { cart: { capabilities: [], entities: {} }, title: 'X' });
    expect(scanSelfContainment(clean)).toEqual([]);
  });

  it('外部 script/link/img/css url/@import → 逐类点名（有外链就非空）', () => {
    expect(scanSelfContainment('<script src="https://cdn.example.com/x.js"></script>')).toHaveLength(1);
    expect(scanSelfContainment('<link href="http://fonts.example.com/f.css" rel="stylesheet">')).toHaveLength(1);
    expect(scanSelfContainment('<img src="https://img.example.com/a.png">')).toHaveLength(1);
    expect(scanSelfContainment('<style>body{background:url(https://x/y.png)}</style>')).toHaveLength(1);
    // @import url("http…") 同时命中 @import 与 url() 两条规则（重复标记无害·仍判非自包含）。
    expect(scanSelfContainment('<style>@import url("https://x/z.css");</style>').length).toBeGreaterThanOrEqual(1);
  });

  it('xmlns 命名空间 URL 不误报（不发网络请求）', () => {
    expect(scanSelfContainment('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toEqual([]);
  });
});

describe('readCartManifest / readCartMeta · 卡带读取（临时 fixture）', () => {
  let root;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), 'pkgweb-'));
    const dir = join(root, 'library', 'demo-cart');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ capabilities: ['a1-transform'], entities: {} }));
    writeFileSync(join(dir, 'meta.json'), JSON.stringify({ name: '演示卡带', tagline: '一句话简介' }));
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('读 library/<slug>/manifest.json', () => {
    expect(readCartManifest(root, 'demo-cart').capabilities).toEqual(['a1-transform']);
  });

  it('缺失 slug → 抛（点名路径）', () => {
    expect(() => readCartManifest(root, 'nope')).toThrow(/manifest\.json/);
  });

  it('读 meta.name/tagline 作 title/subtitle', () => {
    expect(readCartMeta(root, 'demo-cart')).toEqual({ title: '演示卡带', subtitle: '一句话简介' });
  });

  it('无 meta.json → 回退 slug', () => {
    expect(readCartMeta(root, 'unknown-slug').title).toBe('unknown-slug');
  });
});
