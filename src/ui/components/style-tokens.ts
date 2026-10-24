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

const PROMPT_KEYS: readonly string[] = ['zh', 'en', 'negativeZh', 'negativeEn'];
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const isPlainObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** 完整闭集校验：与 scripts/lib/style-tokens.mjs `validateStyleTokens` 逐条同口径（两侧由同一组完整有效/无效对象钉住）。任何一处不合法整份拒收。 */
export function validateStyleTokens(raw: unknown): { ok: boolean; errors: string[] } {
  if (!isPlainObject(raw)) return { ok: false, errors: ['必须是对象'] };
  const errors: string[] = [];
  for (const k of Object.keys(raw)) if (!TOP_KEYS.includes(k)) errors.push(`未知字段 ${k}`);
  if (raw.version !== 1) errors.push('version 必须为 1');
  if (!text(raw.name, 60)) errors.push('name 必须为 1–60 字');
  if (!['draft', 'final'].includes(raw.status as string)) errors.push('status 必须为 draft | final');
  if (!(STYLE_TOKEN_BASES as readonly unknown[]).includes(raw.base)) errors.push(`base 必须为 ${STYLE_TOKEN_BASES.join(' | ')}`);
  const colors = raw.colors;
  if (!isPlainObject(colors)) errors.push('colors 必须是对象');
  else {
    for (const [k, v] of Object.entries(colors)) {
      if (!(STYLE_TOKEN_COLOR_KEYS as readonly string[]).includes(k)) errors.push(`colors.${k} 不在闭集`);
      else if (typeof v !== 'string' || !HEX.test(v)) errors.push(`colors.${k} 必须是 #RRGGBB`);
    }
    for (const k of ['background', 'text', 'accent']) if (!(k in colors)) errors.push(`colors.${k} 必填`);
  }
  if (raw.fonts !== undefined) {
    if (!isPlainObject(raw.fonts)) errors.push('fonts 必须是对象');
    else for (const [k, v] of Object.entries(raw.fonts)) {
      if (!(STYLE_TOKEN_FONT_KEYS as readonly string[]).includes(k)) errors.push(`fonts.${k} 不在闭集`);
      else if (!text(v, 200) || /[;{}<>]/.test(v)) errors.push(`fonts.${k} 必须是字体栈字符串（不含 ; { } < >）`);
    }
  }
  const prompt = raw.prompt;
  if (!isPlainObject(prompt)) errors.push('prompt 必须是对象');
  else {
    for (const k of Object.keys(prompt)) if (!PROMPT_KEYS.includes(k)) errors.push(`prompt.${k} 不在闭集`);
    for (const k of ['zh', 'en']) if (!text(prompt[k], 400)) errors.push(`prompt.${k} 必须为 1–400 字`);
    for (const k of ['negativeZh', 'negativeEn']) if (prompt[k] !== undefined && !text(prompt[k], 300)) errors.push(`prompt.${k} 必须为 1–300 字`);
  }
  return { ok: errors.length === 0, errors };
}

export function parseStyleTokens(raw: unknown): { ok: true; tokens: StyleTokens } | { ok: false; error: string } {
  const v = validateStyleTokens(raw);
  return v.ok ? { ok: true, tokens: raw as StyleTokens } : { ok: false, error: v.errors.join('；') };
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
