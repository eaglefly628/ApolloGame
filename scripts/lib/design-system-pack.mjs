// REQ-AIFLOW-DSYNC（U1）：把 UI 控件闭集 + house 主题 + 各游戏风格令牌导出成 Claude Design 设计系统包。
// 目的：Claude Design 出稿只用我们的控件 → 收稿后复刻是对号入座，不再「自由 HTML 再翻译」。
// 产物是可重复生成的目录（缺省 dist/design-system/·已 gitignore）；owner 在会话里启动 /design-sync 推到设计系统项目。
// CLI：npx vite-node scripts/design-system-export.mjs [--out <dir>]（本文件是库，CLI 见该脚本）
// 预览全部走引擎自己的 renderNode（与游戏内同一渲染器），不另写第二套样式。
import { mkdirSync, writeFileSync, rmSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderNode } from '../../src/ui/components/render.ts';
import { UI_CATALOG } from '../../src/ui/components/catalog.ts';
import { APOLLO_KEYFRAMES } from '../../src/ui/components/server.ts';
import { apolloOnyx, apolloBrocade } from '../../src/ui/components/apollo-kit.ts';
import { apolloToon } from '../../src/ui/apollo-toon-theme.ts';
import { parseStyleTokens, themeFromStyleTokens } from '../../src/ui/components/style-tokens.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const HOUSE_THEMES = [['apolloOnyx', '玄曜（深色）', apolloOnyx], ['apolloBrocade', '锦霞（亮色）', apolloBrocade], ['starter', 'Apollo Toon（起手包）', apolloToon]];
const COLOR_SLOTS = ['pageBg', 'bg0', 'bg1', 'bg2', 'bg3', 'line', 'text', 'sub', 'dim', 'gold', 'jade', 'ok', 'warn', 'danger', 'ink'];
// 预览用：站内路径在导出包里不可达 → 图片换内联占位图并去掉帧动画、音视频清空，避免 Claude Design 里出现坏图。
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120"><rect width="160" height="120" fill="#c9ced8"/><path d="M20 100 60 55l25 28 20-18 35 35z" fill="#8a93a6"/><circle cx="118" cy="34" r="12" fill="#8a93a6"/></svg>');
const SITE_IMAGE = /^\/(?!\/).*\.(png|jpe?g|webp|gif|svg)$/i;
const SITE_MEDIA = /^\/(?!\/).*\.(mp4|webm|ogg|mp3|wav|m4a)$/i; // 音视频：导出包里不可达，直接清空（预览只看控件外框）
function swapImages(value) {
  if (typeof value === 'string') return SITE_IMAGE.test(value) ? PLACEHOLDER : SITE_MEDIA.test(value) ? '' : value;
  if (Array.isArray(value)) return value.map(swapImages);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, swapImages(v)]));
  return value;
}
export function previewSample(node) {
  let props = node.props;
  if (props) {
    const swapped = swapImages(props);
    if (JSON.stringify(swapped) !== JSON.stringify(props)) {
      props = { ...swapped }; delete props.sprite; // 帧动画依赖真实精灵表，占位图上无意义
      console.info(`[design-system] decision: ${node.id} 站内图片换为占位图（导出包不可达）`);
    }
  }
  const children = Array.isArray(node.children) ? node.children.map((c) => previewSample(c)) : node.children;
  return { ...node, ...(props ? { props } : {}), ...(children ? { children } : {}) };
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const page = (group, title, body) => `<!-- @dsCard group="${group}" -->
<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<style>${APOLLO_KEYFRAMES}
body{margin:0;padding:16px;font:14px/1.5 -apple-system,'Segoe UI','Noto Sans SC',sans-serif;background:#f4f4f6;color:#1d1d22}
.ds-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
.ds-cell{border-radius:8px;overflow:hidden;border:1px solid #d8d8de}
.ds-cell h4{margin:0;padding:6px 10px;font-size:12px;background:#fff;border-bottom:1px solid #e4e4ea}
.ds-stage{padding:16px;min-height:120px;position:relative}
table{border-collapse:collapse;width:100%;margin-top:12px;font-size:12px}td,th{border:1px solid #e0e0e6;padding:4px 6px;text-align:left;vertical-align:top}
code{font:12px ui-monospace,Menlo,monospace}
</style></head><body>
${body}
</body></html>
`;

function propRows(props) {
  return props.map((p) => `<tr><td><code>${esc(p.name)}</code>${p.required ? ' *' : ''}</td><td><code>${esc(p.type)}</code>${p.values ? `<br>${p.values.map((v) => `<code>${esc(v)}</code>`).join(' ')}` : ''}</td><td>${esc(p.describe)}</td></tr>`).join('\n');
}

function componentCard(spec) {
  const stages = HOUSE_THEMES.map(([, label, theme]) => `<div class="ds-cell"><h4>${esc(label)}</h4><div class="ds-stage" style="background:${theme.pageBg}">${renderNode(previewSample(spec.sample), theme)}</div></div>`).join('\n');
  return page('Components', spec.type, `<h2 style="margin:0 0 4px"><code>${esc(spec.type)}</code> · ${esc(spec.summary)}</h2>
<p style="margin:0 0 12px">${esc(spec.whenToUse)}</p>
<p>出稿时：该元素加 <code>data-ui="${esc(spec.type)}"</code>；可点的再加 <code>data-action="动作名"</code>。子节点：<code>${esc(spec.children)}</code>。</p>
<div class="ds-grid">${stages}</div>
<table><tr><th>字段</th><th>类型 / 闭集</th><th>说明</th></tr>
${propRows(spec.props)}
</table>`);
}

function swatches(theme) {
  return COLOR_SLOTS.filter((k) => typeof theme[k] === 'string').map((k) => `<div style="display:flex;align-items:center;gap:8px;margin:2px 0"><span style="display:inline-block;width:40px;height:20px;border-radius:4px;border:1px solid #0002;background:${theme[k]}"></span><code>${k}</code> <code>${esc(theme[k])}</code></div>`).join('');
}

function themesCard(themes) {
  return page('Colors', 'House themes', `<h2>House 主题色板</h2><p>出稿只用这些令牌色；游戏有风格令牌时见 Brand 组。</p><div class="ds-grid">${themes.map(([id, label, t]) => `<div class="ds-cell"><h4>${esc(label)} · <code>${id}</code></h4><div class="ds-stage" style="background:#fff">${swatches(t)}</div></div>`).join('')}</div>`);
}

function typeCard(themes) {
  const fonts = ['fontUi', 'fontSerif', 'fontMono', 'fontDisplay', 'fontPixel'];
  return page('Type', 'Typography', `<h2>字体槽</h2><table><tr><th>主题</th>${fonts.map((f) => `<th><code>${f}</code></th>`).join('')}</tr>${themes.map(([id, , t]) => `<tr><td><code>${id}</code></td>${fonts.map((f) => `<td>${t[f] ? `<span style="font-family:${esc(t[f])}">永夜的火光 Aa 123</span><br><code>${esc(t[f])}</code>` : '—'}</td>`).join('')}</tr>`).join('')}</table>`);
}

/** 各游戏风格令牌（美术根 style-tokens.json）→ Brand 卡。非法令牌跳过并告警。 */
export function gameTokenThemes(root = ROOT) {
  const out = [];
  for (const base of [join(root, 'public', 'games'), join(root, 'library')]) {
    if (!existsSync(base)) continue;
    for (const slug of readdirSync(base).sort()) {
      const file = join(base, slug, 'art', 'style-tokens.json');
      if (!existsSync(file)) continue;
      const parsed = parseStyleTokens(JSON.parse(readFileSync(file, 'utf8')));
      if (!parsed.ok) { console.warn(`[design-system] reject: ${slug} style-tokens 非法（${parsed.error}），不导出`); continue; }
      out.push([slug, `${slug} · ${parsed.tokens.name}（${parsed.tokens.status}）`, themeFromStyleTokens(parsed.tokens)]);
    }
  }
  return out;
}

export function rulesMarkdown() {
  return `# ZeroCraft 设计系统（自动导出·勿手改）

出稿规则（Claude Design 必须遵守）：

1. **只用本包里的控件**（共 ${UI_CATALOG.length} 个，见 \`catalog.json\` 与 Components 组）。表达不了的界面先停下来提需求，不要自由画新控件。
2. 每个元素标 \`data-ui="<控件名>"\`；可点击的再标 \`data-action="<动作名>"\`。动作名以该游戏 UI 需求单（\`scripts/ui-brief.mjs\` 产出）里的动作清单为准，收稿时会逐项对账。
3. 颜色与字体只用 Colors / Type 组里的令牌；游戏有自己的风格令牌时以 Brand 组为准。
4. 复刻规则：骨架阶段（S4）按稿做结构 1:1，UI 阶段（S5）做视觉 1:1；稿与实现的差异用同一把尺子量（\`scripts/design-measure.mjs\`）。

控件清单：${UI_CATALOG.map((s) => `\`${s.type}\``).join('、')}
`;
}

/** 纯函数：返回 { 相对路径: 内容 }（确定性·同输入同字节）。 */
export function buildDesignSystemPack(root = ROOT) {
  const files = {};
  const games = gameTokenThemes(root);
  files['README.md'] = rulesMarkdown();
  files['catalog.json'] = JSON.stringify(UI_CATALOG.map(({ type, summary, whenToUse, children, props }) => ({ type, summary, whenToUse, children, props })), null, 2) + '\n';
  files['foundations/colors.html'] = themesCard(HOUSE_THEMES);
  files['foundations/type.html'] = typeCard(HOUSE_THEMES);
  for (const spec of UI_CATALOG) files[`components/${spec.type}.html`] = componentCard(spec);
  for (const [slug, label, theme] of games) files[`brand/${slug}.html`] = page('Brand', label, `<h2>${esc(label)}</h2><p>由 <code>/games/${esc(slug)}/art/style-tokens.json</code> 生成（house 主题 + 令牌覆盖）。</p><div class="ds-cell"><div class="ds-stage" style="background:#fff">${swatches(theme)}</div></div><div class="ds-grid" style="margin-top:12px">${['Button', 'Panel', 'Label'].map((type) => { const s = UI_CATALOG.find((c) => c.type === type); return s ? `<div class="ds-cell"><h4><code>${type}</code></h4><div class="ds-stage" style="background:${theme.pageBg}">${renderNode(previewSample(s.sample), theme)}</div></div>` : ''; }).join('')}</div>`);
  return files;
}

export function writeDesignSystemPack(outDir, root = ROOT) {
  const files = buildDesignSystemPack(root);
  rmSync(outDir, { recursive: true, force: true });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(outDir, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content);
  }
  console.info(`[design-system] commit: ${Object.keys(files).length} 个文件 → ${outDir}（控件 ${UI_CATALOG.length}·主题 ${HOUSE_THEMES.length}·游戏令牌 ${Object.keys(files).filter((k) => k.startsWith('brand/')).length}）`);
  return files;
}

