// Game I · 组合 · 超休闲对局屏（buildCasualHud）—— MMO HUD 的超休闲对位：一屏密排、精致，纯 LayoutNode 数据
//   复现 Candy/Gardenscapes 风消除对局（顶栏 + 目标 + 糖果棋盘 + 道具 + 星条 + juice）。展示「华丽起手」全家桶：
//   糖果厚唇钮 + 星级 Rating + 庆祝/环境粒子 + 悬停流光 + 数字格式化 + 异形/发光 fx + 图标 pill + 进度条。
//   零手写 React/CSS·写世界=action 信号。起手皮=apollo-toon（糖果观感天配超休闲·展台换皮下拉可切）。
import type { LayoutNode } from '@zerocraft/engine/ui/components/index.js';

const STAGE_W = 456, STAGE_H = 788;

// 糖果块配色（装饰性游戏件·custom 色·闭集外的"棋子本色"允许显式指定）。
const CANDY: Record<string, string> = {
  R: '#ff5d6c', Y: '#ffcf3f', B: '#4f9dff', P: '#a06cff', O: '#ff9d4d', G: '#5ee08a', K: '#ff6fae',
};
const GLYPH: Record<string, string> = { R: '🍓', Y: '🍋', B: '🫐', P: '🍇', O: '🍊', G: '🥝', K: '🍬' };
// 7×7 棋盘（确定式摆盘·无随机）：'*'=选中糖·'#'=条纹特殊糖·大写=普通色。
const BOARD: readonly string[] = [
  'RYBPOGK',
  'YB*ROKP',   // (row1,col2) 选中
  'GORYP#B',   // (row2,col5) 条纹特殊
  'PKGBYRO',
  'OYRKGBP',
  'BGPOYKR',
  'RKOBPGY',
];

// 一个糖果格（圆角厚块 + 果字·选中=金边发光·特殊=条纹 + 星光）。
function candyCell(r: number, c: number, ch: string): LayoutNode {
  const sel = ch === '*', spc = ch === '#';
  const kind = sel ? 'B' : spc ? 'K' : ch; // 选中格底色借蓝莓·特殊借糖果粉
  const col = CANDY[kind] ?? '#cccccc';
  return {
    type: 'Panel', id: `cc-${r}-${c}`,
    props: {
      bg: { custom: `linear-gradient(155deg, ${col}, ${shade(col)})` },
      ...(sel ? { edge: 'gold' } : {}),
      ...(spc ? { pattern: 'stripe' as const } : {}),
      action: 'casualTap', actionArg: `${r},${c}`,
    },
    layout: {
      width: 48, height: 48, align: 'center', justify: 'center', padding: 0, radius: 12,
      ...(sel ? { fx: [{ kind: 'glow' as const, color: 'gold' as const }], scale: 1.08 } : {}),
      ...(spc ? { fx: [{ kind: 'sheen' as const }] } : {}),
    },
    children: [{ type: 'Label', id: `cg-${r}-${c}`, props: { text: GLYPH[kind] ?? '', size: 'xl' } }],
  };
}
// 稍压暗做渐变底色（确定式·十六进制各通道 ×0.72）。
function shade(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.72), g = Math.round(((n >> 8) & 255) * 0.72), b = Math.round((n & 255) * 0.72);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// 道具键（糖果厚唇钮 + 数量角标·主道具悬停流光）。
function booster(id: string, glyph: string, label: string, count: number, kind: 'hero' | 'primary' | 'ghost', hover = false): LayoutNode {
  return {
    type: 'Panel', id, props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 2 },
    children: [
      { type: 'Button', id: `${id}-b`, props: { label: glyph, kind, action: 'casualBoost', actionArg: id, disabled: count === 0 },
        layout: { width: 60, height: 56, ...(hover ? { fx: [{ kind: 'sheen-hover' as const }] } : {}) } },
      { type: 'Panel', id: `${id}-r`, props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 3 },
        children: [
          { type: 'Label', id: `${id}-l`, props: { text: label, size: 'xs', color: 'sub' } },
          { type: 'Badge', id: `${id}-c`, props: { text: `×${count}`, tone: count === 0 ? 'dim' : 'ok' } },
        ] },
    ],
  };
}

/** 超休闲消除对局屏（纯 LayoutNode·糖果皮起手·MMO HUD 的休闲对位）。 */
export function buildCasualHud(): LayoutNode {
  return {
    type: 'Panel', id: 'casual-hud',
    // 实底暖糖色（非 gradient·ui-audit 能读实底 → 亮皮深字对比可量·避免"渐变底跳到深页面"假阳）。
    props: { bg: { custom: '#ffe8c8' }, vignette: true },
    layout: { width: STAGE_W, height: STAGE_H, direction: 'column', gap: 10, padding: 14 },
    children: [
      // 环境微光（铺满·不挡点击·「活」的底噪）。
      { type: 'Particles', id: 'ch-amb', props: { kind: 'sparkle', count: 16, loop: true } },

      // ① 顶栏：关号 + 资源 pill 一排（亮皮实底面·深字可读·非 glass 免暗译层压深字）。
      { type: 'Panel', id: 'ch-top', props: {}, layout: { direction: 'row', align: 'center', gap: 8, padding: 10 },
        children: [
          { type: 'Panel', id: 'ch-lv', props: { edge: 'gold', bg: 'gold' }, layout: { direction: 'row', align: 'center', gap: 4, padding: 8, radius: 12 },
            children: [
              { type: 'Label', id: 'ch-lv-c', props: { text: '关', size: 'xs', color: 'ink' } },
              { type: 'Label', id: 'ch-lv-n', props: { text: '42', size: 'lg', bold: true, color: 'ink' } },
            ] },
          { type: 'Panel', id: 'ch-score', props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 4 },
            children: [
              { type: 'Label', id: 'ch-score-i', props: { text: '◆', size: 'md', color: 'jade' } },
              { type: 'Label', id: 'ch-score-n', props: { text: '128420', format: 'compact', size: 'lg', bold: true, color: 'gold' } },
            ] },
          { type: 'Panel', id: 'ch-sp', props: { bare: true }, layout: { flex: 1 } },
          { type: 'Panel', id: 'ch-coin', props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 4 },
            children: [
              { type: 'Label', id: 'ch-coin-i', props: { text: '🪙', size: 'md' } },
              { type: 'Label', id: 'ch-coin-n', props: { text: '2,180', size: 'md', bold: true, color: 'text' } },
            ] },
          { type: 'Button', id: 'ch-gear', props: { label: '⚙', kind: 'quiet', action: 'casualMenu' }, layout: { width: 44, height: 44 } },
        ] },

      // ② 目标横幅：收集目标 + 进度条 + 桃心命。
      { type: 'Panel', id: 'ch-obj', props: { accent: true }, layout: { direction: 'row', align: 'center', gap: 10, padding: 10 },
        children: [
          { type: 'Label', id: 'ch-obj-g', props: { text: '🍬', size: 'xl' } },
          { type: 'Panel', id: 'ch-obj-col', props: { bare: true }, layout: { direction: 'column', gap: 3, flex: 1 },
            children: [
              { type: 'Label', id: 'ch-obj-t', props: { text: '目标 · 收集 12 颗糖果', size: 'sm', bold: true, color: 'text' } },
              { type: 'ProgressBar', id: 'ch-obj-bar', props: { value: 8, max: 12, tone: 'gold', showValue: true } },
            ] },
          { type: 'Tag', id: 'ch-event', props: { label: '限时', icon: '🔥', tone: 'accent', size: 'lg' } },
          { type: 'Label', id: 'ch-lives', props: { text: '❤❤❤❤❤', size: 'md' } },
        ] },

      // ③ 步数 + 连击飘字。
      { type: 'Panel', id: 'ch-mid', props: { bare: true }, layout: { direction: 'row', align: 'center', justify: 'between', padding: 2 },
        children: [
          { type: 'Panel', id: 'ch-moves', props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 6 },
            children: [
              { type: 'Label', id: 'ch-moves-c', props: { text: '步数', size: 'sm', color: 'text' } },
              { type: 'Label', id: 'ch-moves-n', props: { text: '18', size: 'xxl', bold: true, color: 'gold', font: 'display' } },
            ] },
          { type: 'Label', id: 'ch-combo', props: { text: 'COMBO ×4!', size: 'xl', bold: true, color: 'danger', font: 'heavy', glow: true }, layout: { fx: [{ kind: 'pulse' as const }] } },
        ] },

      // ④ 糖果棋盘（7×7·选中金边发光·条纹特殊糖·星光叠层）。
      { type: 'Panel', id: 'ch-board', props: { bg: { custom: 'linear-gradient(160deg,#6d4b8f,#4a3168)' }, vignette: true },
        layout: { direction: 'column', align: 'center', gap: 6, padding: 12, radius: 18 },
        children: [
          ...BOARD.map((row, r): LayoutNode => ({
            type: 'Panel', id: `ch-row-${r}`, props: { bare: true }, layout: { direction: 'row', gap: 6 },
            children: [...row].map((ch, c) => candyCell(r, c, ch)),
          })),
          { type: 'Particles', id: 'ch-board-fx', props: { kind: 'stars', count: 14, loop: false } },
        ] },

      // ⑤ 道具条（四糖果厚唇钮 + 数量角标·主道具悬停流光）。
      { type: 'Panel', id: 'ch-boost', props: {}, layout: { direction: 'row', align: 'center', justify: 'around', gap: 8, padding: 10 },
        children: [
          booster('bo-hammer', '🔨', '锤子', 3, 'hero', true),
          booster('bo-swap', '🔀', '交换', 1, 'primary'),
          booster('bo-bomb', '💣', '炸弹', 2, 'primary'),
          booster('bo-rainbow', '🌈', '彩虹', 0, 'ghost'),
        ] },

      // ⑥ 底：星级进度 + 距下一星。
      { type: 'Panel', id: 'ch-star', props: { bare: true }, layout: { direction: 'row', align: 'center', justify: 'center', gap: 10 },
        children: [
          { type: 'Rating', id: 'ch-rating', props: { value: 2, max: 3 } },
          { type: 'Label', id: 'ch-star-t', props: { text: '距下一星 320 分', size: 'xs', color: 'text' } },
        ] },
    ],
  };
}
