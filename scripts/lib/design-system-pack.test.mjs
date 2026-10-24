// REQ-AIFLOW-DSYNC（U1）：设计系统包 = 控件闭集逐个成卡 + 主题 / 字体 + 游戏风格令牌；确定性、自包含、规则齐全。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildDesignSystemPack, writeDesignSystemPack, previewSample, gameTokenThemes } from './design-system-pack.mjs';
import { UI_CATALOG } from '../../src/ui/components/catalog.ts';

const pack = buildDesignSystemPack();
const withRoot = (fn) => { const r = mkdtempSync(join(tmpdir(), 'dsync-')); try { return fn(r); } finally { rmSync(r, { recursive: true, force: true }); } };

describe('U1 设计系统包', () => {
  it('控件闭集逐个成卡，首行是 @dsCard 标记（Components 组）', () => {
    for (const spec of UI_CATALOG) {
      const html = pack[`components/${spec.type}.html`];
      expect(html, spec.type).toBeTruthy();
      expect(html.split('\n')[0]).toBe('<!-- @dsCard group="Components" -->');
      expect(html).toContain(`data-ui="${spec.type}"`);
    }
    expect(Object.keys(pack).filter((k) => k.startsWith('components/')).length).toBe(UI_CATALOG.length);
  });
  it('catalog.json 与 README 覆盖全部控件；README 写明 data-ui / data-action 出稿规则', () => {
    expect(JSON.parse(pack['catalog.json']).map((c) => c.type)).toEqual(UI_CATALOG.map((c) => c.type));
    for (const spec of UI_CATALOG) expect(pack['README.md']).toContain(`\`${spec.type}\``);
    expect(pack['README.md']).toMatch(/data-ui=.*data-action=/s);
  });
  it('基础卡分组正确；game628 风格令牌生成 Brand 卡', () => {
    expect(pack['foundations/colors.html'].split('\n')[0]).toBe('<!-- @dsCard group="Colors" -->');
    expect(pack['foundations/type.html'].split('\n')[0]).toBe('<!-- @dsCard group="Type" -->');
    expect(pack['brand/game628.html'].split('\n')[0]).toBe('<!-- @dsCard group="Brand" -->');
    expect(pack['brand/game628.html']).toContain('#FFB25A');
  });
  it('确定性：两次构建逐字节相同', () => {
    expect(buildDesignSystemPack()).toEqual(pack);
  });
  it('自包含：不引用外链脚本、不引用站内 / 路径图片', () => {
    for (const [file, content] of Object.entries(pack)) {
      expect(content, file).not.toMatch(/<script\b[^>]*\bsrc=/i);
      expect(content, file).not.toMatch(/src="\/(?!\/)/);
    }
  });
  it('站内图片换占位图并去帧动画；其它节点不动', () => {
    const out = previewSample({ type: 'Panel', id: 'p', props: { title: 't' }, children: [{ type: 'Image', id: 'i', props: { src: '/a.png', sprite: { frames: 4 }, fit: 'contain' } }, { type: 'Image', id: 'j', props: { src: 'data:image/png;base64,AA' } }] });
    expect(out.props).toEqual({ title: 't' });
    expect(out.children[0].props.src.startsWith('data:image/svg+xml,')).toBe(true);
    expect(out.children[0].props.sprite).toBeUndefined();
    expect(out.children[0].props.fit).toBe('contain');
    expect(out.children[1].props.src).toBe('data:image/png;base64,AA');
    // DS1 返工：NativeCharacter 静态兜底拒收 data: poster（生产安全边界）→ 预览换为同尺寸占位 Image。
    const nc = previewSample({ type: 'NativeCharacter', id: 'n', props: { assetKey: 'k', poster: '/ui/p.png', clip: 'idle', alt: '角色' }, layout: { width: 200, height: 200 } });
    expect(nc).toMatchObject({ type: 'Image', id: 'n', layout: { width: 200, height: 200 }, props: { alt: '角色', fit: 'contain' } });
    expect(nc.props.src.startsWith('data:image/svg+xml,')).toBe(true);
  });
  it('最终 HTML：所有 <img> 都有可显示的内联 src（无空 src·无站内路径），NativeCharacter 卡也不例外', () => {
    for (const [file, content] of Object.entries(pack)) {
      for (const m of content.matchAll(/<img\b[^>]*>/gi)) {
        const src = /\bsrc="([^"]*)"/.exec(m[0])?.[1];
        expect(src, `${file}: ${m[0].slice(0, 80)}`).toMatch(/^data:image\//);
      }
    }
    expect(pack['components/NativeCharacter.html']).toMatch(/<img\b[^>]*src="data:image\/svg\+xml,/);
  });
  it('风格令牌 JSON 语法错只跳过该游戏并告警，其余游戏照常导出', () => withRoot((root) => {
    mkdirSync(join(root, 'public/games/broken/art'), { recursive: true });
    writeFileSync(join(root, 'public/games/broken/art/style-tokens.json'), '{ "version": 1, ');
    mkdirSync(join(root, 'public/games/good/art'), { recursive: true });
    writeFileSync(join(root, 'public/games/good/art/style-tokens.json'), readFileSync(join(process.cwd(), 'public/games/game628/art/style-tokens.json')));
    const warn = console.warn; const calls = []; console.warn = (...a) => calls.push(a.join(' '));
    let themes;
    try { themes = gameTokenThemes(root); } finally { console.warn = warn; }
    expect(themes.map(([slug]) => slug)).toEqual(['good']);
    expect(calls.some((c) => c.includes('[design-system] reject: broken') && c.includes('JSON'))).toBe(true);
    expect(Object.keys(buildDesignSystemPack(root))).toContain('brand/good.html');
  }));
  it('非法风格令牌不导出 Brand 卡并告警；写盘与构建结果一致', () => withRoot((root) => {
    mkdirSync(join(root, 'public/games/bad/art'), { recursive: true });
    writeFileSync(join(root, 'public/games/bad/art/style-tokens.json'), JSON.stringify({ version: 1, base: 'shell' }));
    const warn = console.warn; const calls = []; console.warn = (...a) => calls.push(a.join(' '));
    try { expect(gameTokenThemes(root)).toEqual([]); } finally { console.warn = warn; }
    expect(calls.some((c) => c.includes('[design-system] reject: bad'))).toBe(true);
    const out = join(root, 'out'); const files = writeDesignSystemPack(out, root);
    expect(existsSync(join(out, 'brand'))).toBe(false);
    expect(readFileSync(join(out, 'components/Button.html'), 'utf8')).toBe(files['components/Button.html']);
  }));
});
