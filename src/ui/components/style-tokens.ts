// REQ-AIFLOW-STYLETOKENS（U3）：每游戏风格令牌 → UITheme 覆盖（生图侧见 scripts/lib/style-tokens.mjs）。
// 令牌是设计定稿包的一件，放在美术根 `/games/<slug>/art/style-tokens.json`。这里只做闭集映射：
// 起手 house 主题（华丽起手铁律）+ 令牌覆盖对应槽位；未出现的令牌一律保留起手主题原值。
import type { UITheme } from './types.js';
import { apolloOnyx, apolloBrocade } from './apollo-kit.js';
import { apolloToon } from '../apollo-toon-theme.js';

export const STYLE_TOKEN_COLOR_KEYS = ['background', 'surface', 'surfaceRaised', 'line', 'text', 'textSub', 'textDim', 'accent', 'accentAlt', 'ok', 'warn', 'danger', 'ink'] as const;
export const STYLE_TOKEN_FONT_KEYS = ['ui', 'serif', 'mono'] as const;
export const STYLE_TOKEN_BASES = ['apolloOnyx', 'apolloBrocade', 'starter'] as const;

export type StyleTokenColor = typeof STYLE_TOKEN_COLOR_KEYS[number];
export interface StyleTokens {
  version: 1;
  name: string;
  status: 'draft' | 'final';
  base: typeof STYLE_TOKEN_BASES[number];
  colors: Partial<Record<StyleTokenColor, string>> & { background: string; text: string; accent: string };
  fonts?: Partial<Record<typeof STYLE_TOKEN_FONT_KEYS[number], string>>;
  prompt: { zh: string; en: string; negativeZh?: string; negativeEn?: string };
}

/** 令牌 → UITheme 槽位（唯一映射表）。一个令牌可写多个槽位。 */
export const STYLE_TOKEN_THEME_MAP: Readonly<Record<StyleTokenColor, readonly (keyof UITheme)[]>> = {
  background: ['pageBg', 'bg0'],
  surface: ['bg1'],
  surfaceRaised: ['bg2', 'bg3'],
  line: ['line'],
  text: ['text'],
  textSub: ['sub'],
  textDim: ['dim'],
  accent: ['gold'],
  accentAlt: ['jade', 'jadeLine'],
  ok: ['ok'],
  warn: ['warn'],
  danger: ['danger'],
  ink: ['ink'],
};
const FONT_MAP = { ui: 'fontUi', serif: 'fontSerif', mono: 'fontMono' } as const;
const BASES: Record<StyleTokens['base'], UITheme> = { apolloOnyx, apolloBrocade, starter: apolloToon };
const HEX = /^#[0-9a-fA-F]{6}$/;
export const STYLE_TOKEN_TOP_KEYS = ['version', 'name', 'status', 'base', 'colors', 'fonts', 'prompt'] as const;
const TOP_KEYS: readonly string[] = STYLE_TOKEN_TOP_KEYS;

/** 闭集校验（与 scripts/lib/style-tokens.mjs 同口径的 UI 侧子集：只管 UI 消费的字段）。 */
export function parseStyleTokens(raw: unknown): { ok: true; tokens: StyleTokens } | { ok: false; error: string } {
  const r = raw as Partial<StyleTokens> | null;
  if (!r || typeof r !== 'object' || Array.isArray(r) || r.version !== 1) return { ok: false, error: 'version 必须为 1' };
  for (const k of Object.keys(r)) if (!TOP_KEYS.includes(k)) return { ok: false, error: `未知字段 ${k}` };
  if (!STYLE_TOKEN_BASES.includes(r.base as StyleTokens['base'])) return { ok: false, error: `base 非法: ${String(r.base)}` };
  if (!r.colors || typeof r.colors !== 'object') return { ok: false, error: 'colors 缺失' };
  for (const [k, v] of Object.entries(r.colors)) {
    if (!(STYLE_TOKEN_COLOR_KEYS as readonly string[]).includes(k)) return { ok: false, error: `colors.${k} 不在闭集` };
    if (typeof v !== 'string' || !HEX.test(v)) return { ok: false, error: `colors.${k} 必须是 #RRGGBB` };
  }
  for (const k of ['background', 'text', 'accent'] as const) if (!r.colors[k]) return { ok: false, error: `colors.${k} 必填` };
  for (const [k, v] of Object.entries(r.fonts ?? {})) {
    if (!(STYLE_TOKEN_FONT_KEYS as readonly string[]).includes(k)) return { ok: false, error: `fonts.${k} 不在闭集` };
    if (typeof v !== 'string' || !v.trim() || /[;{}<>]/.test(v)) return { ok: false, error: `fonts.${k} 非法` };
  }
  return { ok: true, tokens: r as StyleTokens };
}

/** 起手 house 主题 + 令牌覆盖。未出现的令牌保留起手主题原值。 */
export function themeFromStyleTokens(tokens: StyleTokens): UITheme {
  const theme: UITheme = { ...BASES[tokens.base] };
  const out = theme as unknown as Record<string, unknown>;
  for (const key of STYLE_TOKEN_COLOR_KEYS) {
    const value = tokens.colors[key];
    if (value) for (const slot of STYLE_TOKEN_THEME_MAP[key]) out[slot] = value;
  }
  for (const [k, v] of Object.entries(tokens.fonts ?? {})) out[FONT_MAP[k as keyof typeof FONT_MAP]] = v;
  return theme;
}

/** 运行时读取：`/games/<slug>/art/style-tokens.json`。缺文件或非法 → 告警并返回 null，调用方用自己的起手主题。 */
export async function loadStyleTokensTheme(slug: string, fetchImpl: typeof fetch = fetch): Promise<UITheme | null> {
  const url = `/games/${encodeURIComponent(slug)}/art/style-tokens.json`;
  let raw: unknown;
  try {
    const res = await fetchImpl(url);
    if (!res.ok) { console.warn(`[style-tokens] skip: ${url} HTTP ${res.status}，沿用起手主题`); return null; }
    raw = await res.json();
  } catch (e) { console.warn(`[style-tokens] skip: ${url} 读取失败（${(e as Error).message}），沿用起手主题`); return null; }
  const parsed = parseStyleTokens(raw);
  if (!parsed.ok) { console.warn(`[style-tokens] reject: ${url} ${parsed.error}，沿用起手主题`); return null; }
  return themeFromStyleTokens(parsed.tokens);
}
