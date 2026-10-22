// REQ-AIFLOW-STYLETOKENS（U3）：每游戏一份风格令牌，生图提示词与 UI 主题同源。
// 文件位置 = 美术根下 `style-tokens.json`（内置游戏 public/games/<slug>/art/·卡带 library/<slug>/art/）：
//   与美术索引同一 URL 契约 /games/<slug>/art/**，运行时可直接 fetch；游戏代码不 import docs（depcruise 边界）。
// 字段闭集；UI 侧映射在 src/ui/components/style-tokens.ts，两边键表由 style-tokens.test.mjs 钉成一致。
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { artRoot } from '../art-paths.mjs';

export const STYLE_TOKEN_COLOR_KEYS = ['background', 'surface', 'surfaceRaised', 'line', 'text', 'textSub', 'textDim', 'accent', 'accentAlt', 'ok', 'warn', 'danger', 'ink'];
export const STYLE_TOKEN_FONT_KEYS = ['ui', 'serif', 'mono'];
export const STYLE_TOKEN_BASES = ['apolloOnyx', 'apolloBrocade', 'starter'];
export const STYLE_TOKEN_TOP_KEYS = ['version', 'name', 'status', 'base', 'colors', 'fonts', 'prompt'];
const TOP_KEYS = STYLE_TOKEN_TOP_KEYS;
const PROMPT_KEYS = ['zh', 'en', 'negativeZh', 'negativeEn'];
const HEX = /^#[0-9a-fA-F]{6}$/;
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/** 校验令牌对象：返回 { ok, errors[] }。任何一处不合法整份拒收（不做部分采用）。 */
export function validateStyleTokens(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, errors: ['必须是对象'] };
  for (const k of Object.keys(raw)) if (!TOP_KEYS.includes(k)) errors.push(`未知字段 ${k}`);
  if (raw.version !== 1) errors.push('version 必须为 1');
  if (!text(raw.name, 60)) errors.push('name 必须为 1–60 字');
  if (!['draft', 'final'].includes(raw.status)) errors.push('status 必须为 draft | final');
  if (!STYLE_TOKEN_BASES.includes(raw.base)) errors.push(`base 必须为 ${STYLE_TOKEN_BASES.join(' | ')}`);
  const colors = raw.colors;
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) errors.push('colors 必须是对象');
  else {
    for (const [k, v] of Object.entries(colors)) {
      if (!STYLE_TOKEN_COLOR_KEYS.includes(k)) errors.push(`colors.${k} 不在闭集`);
      else if (typeof v !== 'string' || !HEX.test(v)) errors.push(`colors.${k} 必须是 #RRGGBB`);
    }
    for (const k of ['background', 'text', 'accent']) if (!(k in colors)) errors.push(`colors.${k} 必填`);
  }
  if (raw.fonts !== undefined) {
    if (!raw.fonts || typeof raw.fonts !== 'object' || Array.isArray(raw.fonts)) errors.push('fonts 必须是对象');
    else for (const [k, v] of Object.entries(raw.fonts)) {
      if (!STYLE_TOKEN_FONT_KEYS.includes(k)) errors.push(`fonts.${k} 不在闭集`);
      else if (!text(v, 200) || /[;{}<>]/.test(v)) errors.push(`fonts.${k} 必须是字体栈字符串（不含 ; { } < >）`);
    }
  }
  const prompt = raw.prompt;
  if (!prompt || typeof prompt !== 'object' || Array.isArray(prompt)) errors.push('prompt 必须是对象');
  else {
    for (const k of Object.keys(prompt)) if (!PROMPT_KEYS.includes(k)) errors.push(`prompt.${k} 不在闭集`);
    for (const k of ['zh', 'en']) if (!text(prompt[k], 400)) errors.push(`prompt.${k} 必须为 1–400 字`);
    for (const k of ['negativeZh', 'negativeEn']) if (prompt[k] !== undefined && !text(prompt[k], 300)) errors.push(`prompt.${k} 必须为 1–300 字`);
  }
  return { ok: errors.length === 0, errors };
}

export const styleTokensFile = (root, slug) => join(artRoot(root, slug), 'style-tokens.json');

/** 读该游戏令牌：没有文件 → null（不是错误）；有文件但非法 → 抛错（不静默回落）。 */
export function loadStyleTokens(root, slug) {
  const file = styleTokensFile(root, slug);
  if (!existsSync(file)) return null;
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const { ok, errors } = validateStyleTokens(raw);
  if (!ok) {
    console.error(`[style-tokens] reject: ${file}：${errors.join('；')}`);
    throw new Error(`style-tokens.json 非法：${errors[0]}`);
  }
  const sha256 = createHash('sha256').update(readFileSync(file)).digest('hex');
  return { tokens: raw, sha256 };
}

/** 生图风格段：风格描述 + 主色板（固定顺序 → 同令牌同提示词，缓存键稳定）。 */
export function stylePromptSegment(tokens, lang = 'en') {
  const order = ['background', 'surface', 'accent', 'accentAlt', 'text'];
  const palette = order.filter(k => tokens.colors[k]).map(k => tokens.colors[k].toUpperCase());
  const style = lang === 'zh' ? tokens.prompt.zh : tokens.prompt.en;
  return lang === 'zh' ? `${style}；主色板 ${palette.join(' ')}` : `${style}; palette ${palette.join(' ')}`;
}
