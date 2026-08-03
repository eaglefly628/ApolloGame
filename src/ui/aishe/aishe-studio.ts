// 爱诗工作室 · AiShe Studio Kit（owner 2026-07「爱诗实时生成 UI 往深做 + 可随时插进别的游戏」）。
//
// 目的：任何游戏想加「AI 生视频输出点」（分享/开场/转场…），**import 这套 drop-in kit** 即得一整块工作室 UI——
//   ① 外观数据→提示词 live 组装器（坐实数据驱动：游戏传 look 数据·kit 拼提示词）；
//   ② 8 种输出模式（开场/分享/转场/角色动图/关卡预告/邀请卡/直播封面/成就炫耀·各带画幅/时长/词模板预设）；
//   ③ 生成 + pending/ready/error 状态流 + 竖/横屏 Video 预览。
// 消费引擎既有 `services/aigp` AishePort（旁路·不碰 sim/hash）。视图=纯 LayoutNode 数据（写世界=action 信号）。
//
// 游戏侧接线（三个 action·同声音台局部更新·端口在 sim 外）：
//   `aisheMode`(arg=模式 id)=切模式 · `aisheGen`=宿主调 `port.generate(composeAishePrompt(look,mode), aisheOptsForMode(mode,seed))`
//   → 写 state.handle · `aisheEdit`(arg=`subject:xxx`/`style:xxx`)=改外观（可选）。活范例=game-i `mod-video`。
import type { LayoutNode } from '@ui/components/index.js';
import type { AisheVideoHandle, AisheGenerateOptions } from '@services/aigp/index.js';

// ── 8 种输出模式（游戏的「输出点」用途·各一套预设：画幅/时长/提示词后缀/主色）───────────────
export interface AisheMode {
  id: string; glyph: string; label: string;
  aspect: string; seconds: number; suffix: string; tone: 'jade' | 'gold' | 'ok' | 'warn';
}
export const AISHE_MODES: readonly AisheMode[] = [
  { id: 'opening',  glyph: '🎬', label: '开场片',   aspect: '9:16', seconds: 6, suffix: '开场·电影感运镜·渐入', tone: 'jade' },
  { id: 'share',    glyph: '📤', label: '分享片',   aspect: '9:16', seconds: 8, suffix: '高光集锦·适合社媒分享·节奏明快', tone: 'gold' },
  { id: 'transition', glyph: '⚡', label: '转场',    aspect: '16:9', seconds: 2, suffix: '无缝转场·快切·冲击', tone: 'jade' },
  { id: 'avatar',   glyph: '🧍', label: '角色动图', aspect: '1:1',  seconds: 4, suffix: '角色立绘·微动·可循环', tone: 'jade' },
  { id: 'preview',  glyph: '🔮', label: '关卡预告', aspect: '9:16', seconds: 5, suffix: '关卡预告·悬念·预热', tone: 'warn' },
  { id: 'invite',   glyph: '💌', label: '邀请卡',   aspect: '9:16', seconds: 4, suffix: '邀请卡·温暖·召唤好友同玩', tone: 'ok' },
  { id: 'cover',    glyph: '📺', label: '直播封面', aspect: '16:9', seconds: 3, suffix: '直播封面·吸睛·醒目标题留白', tone: 'gold' },
  { id: 'trophy',   glyph: '🏆', label: '成就炫耀', aspect: '9:16', seconds: 5, suffix: '成就炫耀·金光·庆祝高光', tone: 'gold' },
];
export const modeById = (id: string): AisheMode => AISHE_MODES.find((m) => m.id === id) ?? AISHE_MODES[0];

// ── 外观 look 数据（游戏侧纯数据·「外观→提示词」的输入）──────────────────────────────
export interface AisheLook { subject: string; style: string; motion?: string }

export interface AisheStudioState {
  look: AisheLook;      // 游戏外观数据
  mode: string;         // 选中输出模式 id
  handle: AisheVideoHandle | null;
  generating: boolean;
  seed?: number;
}
export const INITIAL_AISHE_STUDIO: AisheStudioState = {
  look: { subject: '青瓷将领·赵子龙·长枪挑灯', style: '墨蓝铠甲·国风·电影感' },
  mode: 'opening', handle: null, generating: false,
};

// ── 可复用「方法」：外观 look + 模式 → 提示词 / 生成选项（游戏宿主生成时调·纯函数确定式）──────────
/** 外观 look 数据 + 选中模式 → 组装完整提示词（数据驱动·最弱 LLM 也能填 look 数据）。 */
export function composeAishePrompt(look: AisheLook, modeId: string): string {
  const m = modeById(modeId);
  return [look.subject, look.style, look.motion, m.suffix, `竖屏短视频 ${m.aspect}`].filter(Boolean).join('·');
}
/** 选中模式（+可选种子）→ AishePort.generate 的选项（画幅/时长/种子）。 */
export function aisheOptsForMode(modeId: string, seed?: number): AisheGenerateOptions {
  const m = modeById(modeId);
  return { aspect: m.aspect, seconds: m.seconds, ...(seed !== undefined ? { seed } : {}) };
}

// 竖/横/方屏预览尺寸（按画幅·填满右栏）。
function previewSize(aspect: string): { width: number; height: number } {
  if (aspect === '16:9') return { width: 300, height: 169 };
  if (aspect === '1:1') return { width: 240, height: 240 };
  return { width: 240, height: 426 }; // 9:16 竖屏
}
// 占位海报（内联 SVG·自包含·按模式主色·真片就绪时 Video.src=句柄 url 盖过）。
function posterUri(m: AisheMode): string {
  const c = m.tone === 'gold' ? '#e7c96a' : m.tone === 'ok' ? '#7cd9a8' : m.tone === 'warn' ? '#e0a24a' : '#9cd2c5';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="270" height="480" viewBox="0 0 270 480">`
    + `<rect width="270" height="480" fill="#0a0f1e"/>`
    + `<circle cx="135" cy="210" r="46" fill="rgba(156,210,197,0.14)" stroke="${c}" stroke-width="2"/>`
    + `<path d="M123 188 L123 232 L160 210 Z" fill="${c}"/>`
    + `<text x="135" y="300" fill="#e3e8f0" font-family="sans-serif" font-size="22" font-weight="700" text-anchor="middle">${m.glyph} ${m.label}</text>`
    + `<text x="135" y="330" fill="#7f8aa0" font-family="sans-serif" font-size="13" text-anchor="middle">爱诗 AIGP · ${m.aspect} · ${m.seconds}s</text>`
    + `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg).replace(/[()']/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

/** 爱诗工作室：外观→提示词组装器 + 8 模式选择器 + 生成/状态 + Video 预览。任何游戏 import 即用。 */
export function buildAisheStudio(s: AisheStudioState): LayoutNode {
  const m = modeById(s.mode);
  const prompt = composeAishePrompt(s.look, s.mode);
  const h = s.handle;
  const status = s.generating ? { text: '⏳ 生成中…', tone: 'warn' as const }
    : h?.status === 'ready' ? { text: `✅ 就绪 · ${h.id}`, tone: 'ok' as const }
    : h?.status === 'error' ? { text: `⚠ 失败 · ${h.error ?? ''}`, tone: 'danger' as const }
    : h?.status === 'pending' ? { text: '⏳ 排队中…（真后端异步）', tone: 'warn' as const }
    : { text: '— 未生成（选模式 → 点生成）', tone: 'dim' as const };
  const sz = previewSize(m.aspect);

  // 8 模式选择器（4×2 grid·可点 Panel 卡·选中=金边高亮）。
  const modeCard = (mm: AisheMode): LayoutNode => ({
    type: 'Panel', id: `aishe-mode-${mm.id}`,
    props: { action: 'aisheMode', actionArg: mm.id, ...(mm.id === s.mode ? { edge: 'gold', accent: true } : {}) },
    layout: { direction: 'column', align: 'center', gap: 2, padding: 8 },
    children: [
      { type: 'Label', id: `aishe-mode-g-${mm.id}`, props: { text: mm.glyph, size: 'lg' } },
      { type: 'Label', id: `aishe-mode-l-${mm.id}`, props: { text: mm.label, size: 'xs', bold: mm.id === s.mode, color: mm.id === s.mode ? 'gold' : 'sub' } },
    ],
  });

  return {
    type: 'Panel', id: 'aishe-studio', props: {},
    layout: { direction: 'column', gap: 12, padding: 18 },
    children: [
      // 标题
      { type: 'Panel', id: 'aishe-hd', props: {}, layout: { direction: 'row', align: 'center', gap: 10, padding: 12 },
        children: [
          { type: 'Label', id: 'aishe-ttl', props: { text: '🎬  爱诗工作室 · AIGP 生成端口', size: 'lg', bold: true }, layout: { flex: 1 } },
          { type: 'Badge', id: 'aishe-backend', props: { text: 'AishePort · 旁路（sim 外）', tone: 'dim' } },
        ] },
      { type: 'Label', id: 'aishe-desc', props: { text: '游戏「输出点」：外观 look 数据 → 组装提示词 → 选输出模式 → AishePort.generate → 竖/横屏短视频句柄（异步）。任何游戏 import @zerocraft/engine/ui/aishe 即可 drop-in。', color: 'sub', size: 'sm' } },

      // ① 8 模式选择器
      { type: 'Panel', id: 'aishe-modes', props: { title: '① 输出模式（8 种用途 · 各带画幅/时长/词预设）' }, layout: { direction: 'grid', cols: 4, gap: 8, padding: 12 },
        children: AISHE_MODES.map(modeCard) },

      // ② 组装器 + 生成 | ③ 预览
      { type: 'Panel', id: 'aishe-body', props: { bare: true }, layout: { direction: 'row', gap: 16, align: 'start' },
        children: [
          { type: 'Panel', id: 'aishe-left', props: { title: '② 外观→提示词（数据驱动 · live 组装）' }, layout: { direction: 'column', gap: 8, padding: 14, flex: 1 },
            children: [
              { type: 'Label', id: 'aishe-look', props: { text: `外观 look：${s.look.subject} / ${s.look.style}`, color: 'sub', size: 'xs' } },
              { type: 'Panel', id: 'aishe-opts', props: { bare: true }, layout: { direction: 'row', gap: 6 },
                children: [
                  { type: 'Badge', id: 'aishe-b-mode', props: { text: `${m.glyph} ${m.label}`, tone: 'ok' } },
                  { type: 'Badge', id: 'aishe-b-aspect', props: { text: m.aspect, tone: 'dim' } },
                  { type: 'Badge', id: 'aishe-b-sec', props: { text: `${m.seconds}s`, tone: 'dim' } },
                ] },
              { type: 'Label', id: 'aishe-prompt', props: { text: prompt, color: 'text', size: 'sm', mono: true } },
              { type: 'Button', id: 'aishe-gen', props: { label: s.generating ? '⏳ 生成中…' : `🎬 生成 · ${m.label}`, kind: 'hero', action: 'aisheGen', disabled: s.generating } },
              { type: 'Divider', id: 'aishe-d1', props: {} },
              { type: 'Label', id: 'aishe-status', props: { text: `句柄：${status.text}`, color: status.tone === 'dim' ? 'sub' : status.tone === 'ok' ? 'jade' : status.tone, bold: true, size: 'sm' } },
              { type: 'Label', id: 'aishe-url', props: { text: h?.url ? `url：${h.url}` : 'url：—（就绪后 Video 播真片）', color: 'sub', size: 'xs', mono: true } },
            ] },
          { type: 'Panel', id: 'aishe-right', props: { title: '③ 预览' }, layout: { direction: 'column', align: 'center', gap: 6, padding: 12 },
            children: [
              { type: 'Video', id: 'aishe-video', props: { src: h?.status === 'ready' ? h.url : undefined, poster: posterUri(m), controls: true }, layout: sz },
            ] },
        ] },

      // 组合能力
      { type: 'Panel', id: 'aishe-caps', props: {}, layout: { direction: 'row', align: 'center', gap: 6, padding: 10 },
        children: [
          { type: 'Label', id: 'aishe-capl', props: { text: '组合能力', color: 'dim', size: 'xs', bold: true } },
          { type: 'Tag', id: 'aishe-cap-0', props: { label: 'services/aigp · AishePort', tone: 'accent' } },
          { type: 'Tag', id: 'aishe-cap-1', props: { label: '8 输出模式预设', tone: 'accent' } },
          { type: 'Tag', id: 'aishe-cap-2', props: { label: 'Video 控件', tone: 'accent' } },
        ] },
    ],
  };
}
