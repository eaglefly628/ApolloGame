// REQ-AIFLOW-STYLETOKENS（U3）：令牌闭集校验 · 两侧键表一致 · 生图段确定性 · UI 主题映射 · 两条生图入口真拼风格段。
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as mjs from './style-tokens.mjs';
import * as ts from '../../src/ui/components/style-tokens.ts';
import { apolloOnyx } from '../../src/ui/components/apollo-kit.ts';
import { deriveLedger, batchGenerate } from '../art-replace.mjs';

const GAME628 = JSON.parse(readFileSync(join(process.cwd(), 'public/games/game628/art/style-tokens.json'), 'utf8'));
const tokens = (patch = {}) => ({ ...structuredClone(GAME628), ...patch });
const withRoot = async (fn) => { const r = mkdtempSync(join(tmpdir(), 'styletok-')); try { return await fn(r); } finally { rmSync(r, { recursive: true, force: true }); } };
const putTokens = (root, slug, t) => { mkdirSync(join(root, 'public/games', slug, 'art'), { recursive: true }); writeFileSync(join(root, 'public/games', slug, 'art/style-tokens.json'), JSON.stringify(t)); };

describe('U3 令牌闭集', () => {
  it('game628 草案合法；两侧（mjs / TS）校验同时通过', () => {
    expect(mjs.validateStyleTokens(GAME628)).toEqual({ ok: true, errors: [] });
    expect(ts.parseStyleTokens(GAME628).ok).toBe(true);
  });
  it.each([
    ['未知顶层字段', { extra: 1 }],
    ['未知颜色键', { colors: { ...GAME628.colors, glow: '#FFFFFF' } }],
    ['非 #RRGGBB', { colors: { ...GAME628.colors, accent: 'orange' } }],
    ['缺必填颜色', { colors: { background: '#000000', text: '#FFFFFF' } }],
    ['字体注入', { fonts: { ui: 'serif; color:red' } }],
    ['base 非闭集', { base: 'shell' }],
    ['version 错', { version: 2 }],
  ])('%s → 两侧都拒收', (_name, patch) => {
    expect(mjs.validateStyleTokens(tokens(patch)).ok).toBe(false);
    expect(ts.parseStyleTokens(tokens(patch)).ok).toBe(false);
  });
  it('两侧键表逐项一致（防漂移）', () => {
    expect([...ts.STYLE_TOKEN_COLOR_KEYS]).toEqual(mjs.STYLE_TOKEN_COLOR_KEYS);
    expect([...ts.STYLE_TOKEN_FONT_KEYS]).toEqual(mjs.STYLE_TOKEN_FONT_KEYS);
    expect([...ts.STYLE_TOKEN_BASES]).toEqual(mjs.STYLE_TOKEN_BASES);
    expect([...ts.STYLE_TOKEN_TOP_KEYS]).toEqual(mjs.STYLE_TOKEN_TOP_KEYS);
    expect(Object.keys(ts.STYLE_TOKEN_THEME_MAP)).toEqual(mjs.STYLE_TOKEN_COLOR_KEYS);
  });
});

describe('U3 同源输出', () => {
  it('生图风格段确定性：同令牌同字符串，主色板按固定顺序', () => {
    const a = mjs.stylePromptSegment(GAME628, 'en');
    expect(a).toBe(mjs.stylePromptSegment(structuredClone(GAME628), 'en'));
    expect(a).toContain('palette #1E2A44 #26344F #FFB25A #E9C46A #E8EEF5');
    expect(mjs.stylePromptSegment(GAME628, 'zh')).toContain('主色板 #1E2A44');
  });
  it('UI 主题：起手主题 + 令牌覆盖映射槽位；未出现的令牌保留起手值', () => {
    const theme = ts.themeFromStyleTokens(GAME628);
    expect(theme.pageBg).toBe('#1E2A44'); expect(theme.bg0).toBe('#1E2A44');
    expect(theme.gold).toBe('#FFB25A'); expect(theme.jade).toBe('#E9C46A'); expect(theme.jadeLine).toBe('#E9C46A');
    expect(theme.fontSerif).toBe("'Noto Serif SC', 'Songti SC', serif");
    expect(theme.ok).toBe(apolloOnyx.ok); // 令牌未给 ok → 保留 apolloOnyx
    expect(theme.fontUi).toBe(apolloOnyx.fontUi);
  });
  it('运行时读取：非法令牌告警并返回 null（调用方沿用起手主题）', async () => {
    const warn = console.warn; const calls = []; console.warn = (...a) => calls.push(a.join(' '));
    try {
      const bad = await ts.loadStyleTokensTheme('game628', async () => ({ ok: true, json: async () => tokens({ base: 'shell' }) }));
      expect(bad).toBeNull();
      const good = await ts.loadStyleTokensTheme('game628', async (url) => { expect(url).toBe('/games/game628/art/style-tokens.json'); return { ok: true, json: async () => GAME628 }; });
      expect(good.gold).toBe('#FFB25A');
      expect(calls.some(c => c.includes('[style-tokens] reject'))).toBe(true);
    } finally { console.warn = warn; }
  });
});

describe('U3 两条生图入口真拼风格段', () => {
  it('art-replace batchGenerate：有令牌时 prompt 带风格段且令牌优先于台账 stylePrompt', () => withRoot(async (root) => {
    putTokens(root, 'g', GAME628);
    const MANIFEST = { capabilities: ['l2-color'], entities: { hero: { Sprite: { type: 'Sprite', textureKey: 'art:brave knight' }, Shape: { type: 'Shape', width: 48, height: 64 } } } };
    const l = { ...deriveLedger(MANIFEST, { game: 'g' }), artStyle: { stylePrompt: 'LEDGER-STYLE-SHOULD-LOSE' } };
    const r = await batchGenerate(l, 'pixel-retro', { root, game: 'g', mock: true, provider: 'seedream' });
    const sp = r.summary.debug.find((d) => d.kind === 'sprite');
    expect(sp.prompt).toContain('#FFB25A');
    expect(sp.prompt).not.toContain('LEDGER-STYLE-SHOULD-LOSE');
  }));
  it('ai-gen CLI：--game 有令牌 → 发出的提示词带风格段，pending 记令牌 sha256；无令牌 → 原提示词', () => withRoot(async (root) => {
    mkdirSync(join(root, 'scripts', 'lib'), { recursive: true });
    for (const f of ['ai-gen.mjs', 'ai-gen-inputs.mjs', 'tripo-generation.mjs', 'tripo-inputs.mjs', 'art-paths.mjs', 'lib/style-tokens.mjs']) copyFileSync(join(process.cwd(), 'scripts', f), join(root, 'scripts', f));
    putTokens(root, 'g', GAME628);
    const run = (game) => spawnSync(process.execPath, [join(root, 'scripts/ai-gen.mjs'), 'gpt-image-2.5', 'a brass stove', '--game', game, '--mock', '--json'], { cwd: root, encoding: 'utf8', env: { ...process.env, OPENAI_API_KEY: '' } });
    const withTokens = run('g');
    expect(withTokens.status).toBe(0);
    const pendingFile = (slug) => JSON.parse(readFileSync(join(root, 'public/games', slug, 'art/ai/pending.json'), 'utf8'));
    const entry = JSON.stringify(pendingFile('g'));
    expect(entry).toContain('"sha256"');
    expect(entry).toContain('palette #1E2A44');
    expect(withTokens.stderr + withTokens.stdout).toContain('[ai-gen] decision: 拼入 g 风格令牌');
    const without = run('h');
    expect(without.status).toBe(0);
    expect(without.stderr + without.stdout).toContain('[ai-gen] skip: h 无 style-tokens.json');
  }));
});
