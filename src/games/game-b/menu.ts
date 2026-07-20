// Game B ·《雀宴》—— 主菜单屏（LayoutNode 结构照稿·两层 1:1 律「S4 结构」）。
// 结构 1:1 = docs/design/game-b/mockups/main-menu.dc.html（渲染目击在案）：标题/副标/按钮竖排/
// 主角立绘框/头像点数 badge/版本号——布局与信息层级照稿。皮=NIGHT 夜宴主题（凤翎/粉金/明朝·S5 精修）。
// 文案换 gdd 拍板口径（mockups/README 警示）：半庄→东风战一圈；点数=金钱示意；人名=角色卡候选。
import type { LayoutNode } from '@ui/components/index.js';
import { MENU_W, MENU_H } from './theme.js';

export const MENU_START = 'menu-start';
export const MENU_CONTINUE = 'menu-continue';
export const MENU_SETTINGS = 'menu-settings';

export interface MenuState {
  heroName: string; // 主角名（角色卡传入·S3 用候选名）
  money: number; // 局外带入金钱（gdd §十一 moneyIn·点数=金钱 1:1）
  hasSave: boolean; // 有存档 → 「继续上局」可用
}

export function initialMenu(): MenuState {
  // hasSave 展示态=true（对齐稿·三钮皆亮）；S4 接真存档判断后按实际置灰。
  return { heroName: '夜華', money: 50000, hasSave: true };
}

const fmt = (n: number): string => n.toLocaleString('en-US');

export function buildMenu(st: MenuState): LayoutNode {
  return {
    type: 'Panel', id: 'menu-root', props: { bare: true },
    layout: { width: MENU_W, height: MENU_H },
    children: [
      // ── 标题区（右上·明朝体大字「雀宴」宴字绯红 + 副标）───────────────────────────
      {
        type: 'Panel', id: 'menu-title-wrap', props: { bare: true },
        layout: { x: MENU_W - 464, y: 60, width: 388, gap: 14, align: 'end' },
        children: [
          {
            type: 'Label', id: 'menu-title',
            props: {
              size: 98, font: 'serif', bold: true, glow: true,
              spans: [{ text: '雀' }, { text: '宴', color: 'danger' }],
            },
          },
          {
            type: 'Label', id: 'menu-sub',
            props: { text: '四人东风战 · 立直麻将 · 暖夜和室雀庄', size: 15, color: 'sub' },
          },
        ],
      },
      // ── 按钮竖排（右侧·提示 + 外框内三钮）──────────────────────────────────────────────
      // owner 2026-07-20：菜单钮**统一等宽**（不随文字长短变）+ **外框**成一块。做法=框 Panel 固定
      // 宽 + `align:'stretch'` 让三钮满框等宽（钮无固有宽·flex 拉伸）；`edge:'gold'` 描金框。约定入 ui.md。
      {
        type: 'Panel', id: 'menu-btns', props: { bare: true },
        layout: { x: MENU_W - 336, y: 300, width: 260, gap: 13, align: 'center' },
        children: [
          { type: 'Label', id: 'menu-tip', props: { text: '荷官已就位，请上桌 ▾', size: 12, color: 'sub' } },
          {
            type: 'Panel', id: 'menu-btn-frame',
            props: { bg: { custom: 'linear-gradient(162deg,rgba(48,29,54,0.62),rgba(28,17,34,0.72))' }, edge: 'gold' },
            layout: { width: 260, direction: 'column', gap: 12, padding: 18, radius: 14, align: 'stretch' },
            children: [
              { type: 'Button', id: 'menu-start-btn', props: { label: '开始上桌', kind: 'hero', action: MENU_START } },
              { type: 'Button', id: 'menu-continue-btn', props: { label: '继续上局', kind: 'ghost', action: MENU_CONTINUE, disabled: !st.hasSave } },
              { type: 'Button', id: 'menu-settings-btn', props: { label: '设置', kind: 'ghost', action: MENU_SETTINGS } },
            ],
          },
        ],
      },
      // ── 主角立绘占位框（左·虚线框 + 台账签·真立绘=S6 台账 A-CHAR-HERO/角色卡）────────
      {
        type: 'Panel', id: 'menu-hero-box',
        props: { bg: { custom: 'linear-gradient(160deg,#2a1a30,#1a1020)' }, dashed: true, edge: 'jade' },
        layout: { x: 84, y: 150, width: 300, height: 440, direction: 'column', align: 'center', justify: 'center', gap: 15, padding: 26 },
        children: [
          { type: 'Label', id: 'menu-hero-icon', props: { text: '▤', size: 40, color: 'jade' } },
          { type: 'Label', id: 'menu-hero-label', props: { text: '主角立绘', size: 20, font: 'serif', bold: true, color: 'jade' } },
          { type: 'Tag', id: 'menu-hero-dim', props: { label: '300 × 440', tone: 'accent', size: 'sm' } },
          { type: 'Label', id: 'menu-hero-prompt', props: { text: '女性向二次元 · 和风夜宴 · 暖夜和室 · 真 alpha 立绘', size: 12, color: 'sub' } },
          { type: 'Tag', id: 'menu-hero-anchor', props: { label: '风格锚：sakura-nijigen', tone: 'normal', size: 'sm' } },
        ],
      },
      // ── 头像 + 名字 + 点数 badge（左下）────────────────────────────────────────────
      {
        type: 'Panel', id: 'menu-profile', props: { bare: true },
        layout: { x: 84, y: MENU_H - 100, direction: 'row', gap: 14, align: 'center' },
        children: [
          { type: 'Avatar', id: 'menu-avatar', props: { name: st.heroName.slice(-1), size: 62, shape: 'circle' } },
          {
            type: 'Panel', id: 'menu-profile-txt', props: { bare: true },
            layout: { direction: 'column', gap: 7 },
            children: [
              { type: 'Label', id: 'menu-hero-name', props: { text: st.heroName, size: 18, font: 'serif', bold: true } },
              { type: 'Tag', id: 'menu-money', props: { label: `◉ ${fmt(st.money)}`, tone: 'accent', size: 'lg' } },
            ],
          },
        ],
      },
      // ── 版本号（右下）──────────────────────────────────────────────────────────────
      {
        type: 'Label', id: 'menu-ver',
        props: { text: 'v0.3.1 · 内部测试', size: 12, color: 'dim' },
        layout: { x: MENU_W - 220, y: MENU_H - 40, width: 200, align: 'end' },
      },
    ],
  };
}
