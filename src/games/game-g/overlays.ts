// overlays.ts —— Game G 大厅「浮层」数据驱动 pilot（Step C·接力 home/campaign/collection/deck/craft 范式）。
//
// 纯数据 `LayoutNode` + 引擎 `mountUI` + `GG_LOBBY_THEME`·零手写 DOM（红线·同 home-screen）。
// 浮层走引擎 `Modal`/`Drawer`：单独挂一个 overlayHost（开关不碰主树·不跳不黑·套路抄 game-i showOverlay）。
//   覆盖：帮助中心（Tabs 介绍/指导/手册）· 设置（皮肤 Segmented + 音效/音乐/引导 Toggle）·
//        商城 Drawer（Tabs 抽卡/皮肤/钱包）· 今日卦象 Modal · 开场故事 Modal（typewriter 旁白）。
// 关闭：Modal/Drawer closeAction='closeOverlay'（× 或点遮罩·引擎内建）。诚实边界：长文案/数值排版用 Label 近似。
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@ui/components/index.js';
import { GG_LOBBY_THEME } from './ui-theme.js';
import { GACHA, RECHARGE_PACKS, rechargeTotal, DIAMOND_EXCHANGES, DIZHI_SHARD_PACKS, DIZHI_ZODIACS, STORY_OPENING, type StoryBeat } from './blueprint.js';
import { luckyFromVal } from './lobby-overlays.js'; // 纯函数复用（卦值→吉凶档）
import type { LuckyRoll } from './lobby-util.js';
import type { LobbyView } from './lobby-screen.js';

export type OverlayKind = 'none' | 'help' | 'settings' | 'shop' | 'lucky' | 'story';
export interface OverlayState {
  open: OverlayKind;
  helpTab: 'intro' | 'tut' | 'manual'; manTier: 'easy' | 'mid' | 'hard';
  shopTab: 'gacha' | 'foil' | 'wallet';
  lucky: LuckyRoll; storyIdx: number;
}
export const INITIAL_OVERLAY: OverlayState = {
  open: 'none', helpTab: 'intro', manTier: 'easy', shopTab: 'gacha', lucky: luckyFromVal(66), storyIdx: 0,
};

// ── 帮助中心 Modal（Tabs 介绍/指导/手册）─────────────────────────
const HELP_INTRO = '翻命扑克 · Fateflip —— 你，执掌命运之人。历史上最伟大的 52 位名将，魂被诅咒封进一副扑克，每位困在他一生最关键的那场战役里。掷命，即翻命：抛下手中的牌，正面则生、反面则亡。三牌组三层天命：扑克 52 名将 · 天罡 36 兵法 · 地支 12 天命。配一副好牌，去翻天下英雄的命。';
const HELP_TUT = '一局怎么打：赛前在「牌组/改造坊」构筑库（公平扑克 52 + 天罡 ≤12 + 地支镶嵌）。开局三路 9 格、两端大本营各 3 血，每回合 +1 召唤源泉四选一。对决核：两军碰头 → 比战力 → 胜率 → 抛牌定生死（胜率可见·永远有 3% 爆冷缝）。把对面 3 血打光，先破者胜。';
const HELP_MANUAL: Record<'easy' | 'mid' | 'hard', string> = {
  easy: '🟢 初级：三条横路各 9 格、大本营各 3 血。每回合 +1 源泉，选一个动作（抽/放/打天罡·三选一互斥；弃牌不互斥）。做完棋盘走一格，两军碰头掷命对决。先把对面 3 血打光 = 赢。',
  mid: '🟡 中级：三套牌（扑克=兵·天罡=法术·地支=养成）。落子前棋盘会浮出「档位词 + 胜率%」掷命预报（含全部加成）。经营要点：源泉紧、机关门换路、田忌赛马避开大弱路、强牌送大优路集中突破。',
  hard: '🔴 高级：胜率 = clamp(logistic(Δ/k), 3%, 97%)，Δ = 我有效战力 − 敌有效战力（点数 + 天罡 + 地支附魔 + 士气 + 干预）。种子骰可复现。地支二合/六合/三合连携质变。赛前按 Boss 明牌 3 地煞 counter-pick。',
};
function helpModal(st: OverlayState): LayoutNode {
  const tab = (id: string, label: string): { id: string; label: string } => ({ id, label });
  // 固定高度滚动页（对齐原版 help body `height:46vh;min-height:340px;overflow-y:auto`）：各子页统一尺寸·内部滚动·
  // 框不随内容缩放（owner「舒适的统一大小的框·复刻」）。文字 md 对齐原版可读字号。
  const page = (id: string, body: LayoutNode): LayoutNode => ({ type: 'Panel', id, props: { bare: true, scroll: true }, layout: { height: 360, padding: 2 }, children: [body] });
  const manualPage: LayoutNode = {
    type: 'Panel', id: 'help-manual', props: { bare: true }, layout: { direction: 'column', gap: 8, padding: 0 },
    children: [
      { type: 'Segmented', id: 'help-mantier', props: { options: [{ value: 'easy', label: '🟢 初级' }, { value: 'mid', label: '🟡 中级' }, { value: 'hard', label: '🔴 高级' }], value: st.manTier, action: 'manTier' } },
      { type: 'Label', id: 'help-manbody', props: { text: HELP_MANUAL[st.manTier], size: 'md', color: 'text' } },
    ],
  };
  return {
    type: 'Modal', id: 'help-modal', props: { title: '📖 帮助中心', size: 'lg', closeAction: 'closeOverlay' },
    children: [{
      type: 'Panel', id: 'help-body', props: { bare: true }, layout: { direction: 'column', gap: 8, padding: 0 },
      children: [
        { type: 'Tabs', id: 'help-tabs', props: { tabs: [tab('intro', '📜 游戏介绍'), tab('tut', '📖 新手指导'), tab('manual', '📚 玩法手册')], active: st.helpTab, action: 'helpTab' },
          children: [
            page('help-intro-p', { type: 'Label', id: 'help-intro', props: { text: HELP_INTRO, size: 'md', color: 'text' } }),
            page('help-tut-p', { type: 'Label', id: 'help-tut', props: { text: HELP_TUT, size: 'md', color: 'text' } }),
            page('help-manual-p', manualPage),
          ] },
        { type: 'Button', id: 'help-done', props: { label: '明白了 →', kind: 'primary', action: 'closeOverlay' } },
      ],
    }],
  };
}

// ── 设置 Modal ─────────────────────────────────────────────────
function settingsModal(view: LobbyView): LayoutNode {
  return {
    type: 'Modal', id: 'settings-modal', props: { title: '⚙ 设置', size: 'lg', closeAction: 'closeOverlay' },
    children: [{
      type: 'Panel', id: 'settings-body', props: {}, layout: { direction: 'column', gap: 12, padding: 4 },
      children: [
        { type: 'Label', id: 'set-skin-h', props: { text: '大厅皮肤', size: 'md', color: 'sub' } },
        { type: 'Segmented', id: 'set-skin', props: { options: [{ value: 'onyx', label: '玄铁（默认）' }, { value: 'rosy', label: '锦霞' }], value: view.skin, action: 'setSkin' } },
        { type: 'Toggle', id: 'set-sfx', props: { label: '🔊 音效', checked: true, action: 'sfxToggle' } },
        { type: 'Toggle', id: 'set-bgm', props: { label: '🎵 背景音乐', checked: false, action: 'bgmToggle' } },
        { type: 'Toggle', id: 'set-guide', props: { label: '🎓 新手引导', checked: view.guideOn !== false, action: 'toggleGuide' } },
        { type: 'Button', id: 'set-replay', props: { label: '↻ 重看开场故事与引导', kind: 'ghost', action: 'replayIntro' } },
        { type: 'Button', id: 'set-exit', props: { label: '⏏ 退出到游戏库', kind: 'ghost', action: 'exitGame' } },
        { type: 'Divider', id: 'set-div', props: {} },
        { type: 'Button', id: 'set-reset', props: { label: '⚠ 重置所有数据（调试用）', kind: 'ghost', action: 'reset' } },
        { type: 'Button', id: 'set-done', props: { label: '完成 →', kind: 'primary', action: 'closeOverlay' } },
      ],
    }],
  };
}

// ── 商城 Modal（照抄原版居中弹窗·Tabs 抽卡/皮肤/钱包）─────────────
function shopModal(view: LobbyView, st: OverlayState): LayoutNode {
  const dia = view.diamond ?? 0;
  const tShards = view.tiangangShards ?? 0;
  const shards = view.dizhiShards ?? 0;
  const drawBtn = (pool: 'tiangang' | 'dizhi', count: 1 | 10, pay: 'gold' | 'diamond'): LayoutNode => {
    const g = GACHA[pool];
    const cost = pay === 'gold' ? (count === 10 ? g.tenGold : g.singleGold) : (count === 10 ? g.tenDiamond : g.singleDiamond);
    return { type: 'Button', id: `gacha-${pool}-${count}-${pay}`, props: { label: `${count === 10 ? '十连' : '单抽'} ${pay === 'gold' ? '🪙' : '💎'}${cost}`, kind: 'ghost', action: 'gacha', actionArg: `${pool}:${count}:${pay}` } };
  };
  const poolPanel = (pool: 'tiangang' | 'dizhi', title: string, sub: string): LayoutNode => ({
    type: 'Panel', id: `pool-${pool}`, props: { title }, layout: { direction: 'column', gap: 6, padding: 10 },
    children: [
      { type: 'Label', id: `pool-${pool}-sub`, props: { text: sub, size: 'md', color: 'sub' } },
      { type: 'Panel', id: `pool-${pool}-btns`, props: {}, layout: { direction: 'row', gap: 6 }, children: [drawBtn(pool, 1, 'gold'), drawBtn(pool, 1, 'diamond'), drawBtn(pool, 10, 'gold'), drawBtn(pool, 10, 'diamond')] },
    ],
  });
  // 碎片定向兑换（对齐原版 抽卡 tab 4 段：2 卡池 + 天罡碎片兑换 + 地支碎片兑换·chips 走 grid 自动换行）。
  const tgCraftable = view.tiangangs.filter((j) => !j.locked && !j.owned);
  const tgCraftChips: LayoutNode[] = tgCraftable.length
    ? tgCraftable.map((j) => ({ type: 'Tag', id: `shop-craft-tg-${j.id}`, props: { label: `${j.name} 🔶${GACHA.tiangang.craftShards}`, tone: 'normal', action: 'craftTiangang', actionArg: j.id } }))
    : [{ type: 'Label', id: 'shop-craft-tg-none', props: { text: '已解锁天罡均已拥有 🎉', size: 'sm', color: 'dim' } }];
  const dzCraftChips: LayoutNode[] = DIZHI_ZODIACS.map((z) => ({ type: 'Tag', id: `shop-craft-dz-${z.branch}`, props: { label: `${z.animal} 🧩${GACHA.dizhi.craftShards}`, tone: 'normal', action: 'craftDizhi', actionArg: z.branch } }));
  const craftPanel = (id: string, title: string, sub: string, chips: LayoutNode[]): LayoutNode => ({
    type: 'Panel', id, props: { title }, layout: { direction: 'column', gap: 6, padding: 10 },
    children: [
      { type: 'Label', id: `${id}-s`, props: { text: sub, size: 'md', color: 'sub' } },
      { type: 'Panel', id: `${id}-c`, props: { bare: true }, layout: { direction: 'grid', minCol: 88, gap: 6 }, children: chips },
    ],
  });
  const gachaPage: LayoutNode = { type: 'Panel', id: 'shop-gacha', props: {}, layout: { direction: 'column', gap: 8 },
    children: [
      poolPanel('tiangang', '🎴 天罡卡池', `抽到重复 → +${GACHA.tiangang.dupShards} 天罡碎片`),
      poolPanel('dizhi', '🀄 地支卡池', '12 生肖·重复自动升档 铜→银→金·满金转碎片'),
      craftPanel('shop-craft-tg', '🔶 天罡碎片 · 定向兑换（保底）', `攒够碎片直接换想要的天罡·每张 ${GACHA.tiangang.craftShards} 碎片`, tgCraftChips),
      craftPanel('shop-craft-dz', '🧩 地支碎片 · 定向兑换（升档）', `攒够地支碎片直接换/升生肖（铜→银→金）·每次 ${GACHA.dizhi.craftShards} 碎片`, dzCraftChips),
    ] };
  const foilCards: LayoutNode[] = view.foils.map((f) => ({ type: 'Card', id: `shop-foil-${f.id}`,
    props: { title: `✨ ${f.name}`, sub: f.owned ? '✓ 已拥有' : `🪙 ${f.cost}`, tone: (f.owned ? 'accent' : 'normal') as 'accent' | 'normal', action: f.owned ? undefined : 'buyFoil', actionArg: f.id } }));
  const foilPage: LayoutNode = { type: 'Panel', id: 'shop-foil', props: {}, layout: { direction: 'grid', minCol: 150, gap: 8 }, children: foilCards };
  // 充值/兑换包卡片化（对齐原版 .rc-pack 卡：媒体字形 + 数量 + 价格 + 角标·4 列 grid·非单行按钮）。
  const packCards: LayoutNode[] = RECHARGE_PACKS.map((p) => ({ type: 'Card', id: `shop-pack-${p.id}`,
    props: { media: '💎', title: String(rechargeTotal(p)), sub: `${p.bonus > 0 ? `含赠+${p.bonus} · ` : ''}¥${p.price}`, corner: p.tag, action: 'rechargeBuy', actionArg: p.id } }));
  const exCards: LayoutNode[] = DIAMOND_EXCHANGES.map((x) => ({ type: 'Card', id: `shop-ex-${x.id}`,
    props: { media: '🪙', title: String(x.gold), sub: `💎 ${x.diamond}`, corner: x.tag, action: 'exchangeBuy', actionArg: x.id } }));
  const shardCards: LayoutNode[] = DIZHI_SHARD_PACKS.map((x) => ({ type: 'Card', id: `shop-shard-${x.id}`,
    props: { media: '🧩', title: String(x.shards), sub: `💎 ${x.diamond}`, corner: x.tag, action: 'shardBuy', actionArg: x.id } }));
  const walletPage: LayoutNode = { type: 'Panel', id: 'shop-wallet', props: {}, layout: { direction: 'column', gap: 8 },
    children: [
      { type: 'Label', id: 'wallet-rc-h', props: { text: '充值 · 越充越送（Demo·点即到账）', size: 'md', color: 'gold', bold: true } },
      { type: 'Panel', id: 'wallet-rc', props: {}, layout: { direction: 'grid', cols: 4, gap: 8 }, children: packCards },
      { type: 'Label', id: 'wallet-ex-h', props: { text: '兑换金币 · 💎 → 🪙（改造坊通用材料）', size: 'md', color: 'gold', bold: true } },
      { type: 'Panel', id: 'wallet-ex', props: {}, layout: { direction: 'grid', cols: 4, gap: 8 }, children: exCards },
      { type: 'Label', id: 'wallet-shard-h', props: { text: '兑换地支碎片 · 💎 → 🧩（养地支专属材料）', size: 'md', color: 'gold', bold: true } },
      { type: 'Panel', id: 'wallet-shard', props: {}, layout: { direction: 'grid', cols: 4, gap: 8 }, children: shardCards },
    ] };
  return {
    type: 'Modal', id: 'shop-modal', props: { title: '🛒 商城', size: 'lg', closeAction: 'closeOverlay' },
    children: [{
      type: 'Panel', id: 'shop-body', props: { bare: true }, layout: { direction: 'column', gap: 8, padding: 0 },
      children: [
        { type: 'Panel', id: 'shop-bal', props: { bare: true }, layout: { direction: 'row', gap: 14, align: 'center', padding: 0 }, children: [
          { type: 'Label', id: 'shop-bal-coin', props: { text: `🪙 ${view.coin}`, size: 'md', color: 'text' } },
          { type: 'Label', id: 'shop-bal-dia', props: { text: `💎 ${dia}`, size: 'md', color: 'sub' } },
          { type: 'Label', id: 'shop-bal-tsh', props: { text: `🔶 ${tShards} 天罡碎片`, size: 'md', color: 'warn' } },
          { type: 'Label', id: 'shop-bal-dsh', props: { text: `🧩 ${shards} 地支碎片`, size: 'md', color: 'warn' } },
        ] },
        { type: 'Tabs', id: 'shop-tabs', props: { tabs: [{ id: 'gacha', label: '🎴 抽卡' }, { id: 'foil', label: '✨ 皮肤' }, { id: 'wallet', label: '💎 钱包' }], active: st.shopTab, action: 'shopTab' },
          children: [gachaPage, foilPage, walletPage] },
        { type: 'Button', id: 'shop-done', props: { label: '完成 →', kind: 'primary', action: 'closeOverlay' } },
      ],
    }],
  };
}

// ── 今日卦象 Modal ─────────────────────────────────────────────
function luckyModal(r: LuckyRoll): LayoutNode {
  return {
    type: 'Modal', id: 'lucky-modal', props: { title: '🎴 掷命 · 今日卦象', size: 'sm', closeAction: 'closeOverlay' },
    children: [{
      type: 'Panel', id: 'lucky-body', props: {}, layout: { direction: 'column', gap: 8, padding: 6, align: 'center' },
      children: [
        { type: 'Label', id: 'lucky-val', props: { text: String(r.val), size: 'xl', color: 'gold', bold: true } },
        { type: 'Label', id: 'lucky-label', props: { text: r.label, size: 'lg', color: 'gold' } },
        { type: 'Label', id: 'lucky-line', props: { text: r.line, size: 'md', color: 'sub' } },
        { type: 'Panel', id: 'lucky-btns', props: {}, layout: { direction: 'row', gap: 10 }, children: [
          { type: 'Button', id: 'lucky-reroll', props: { label: '再掷一卦', kind: 'ghost', action: 'reroll' } },
          { type: 'Button', id: 'lucky-keep', props: { label: '收下此卦', kind: 'primary', action: 'closeOverlay' } },
        ] },
      ],
    }],
  };
}

// ── 开场故事 Modal（typewriter 逐字旁白）────────────────────────
function storyModal(beats: StoryBeat[], idx: number): LayoutNode {
  const i = Math.max(0, Math.min(beats.length - 1, idx));
  const b = beats[i];
  const last = i >= beats.length - 1;
  return {
    type: 'Modal', id: 'story-modal', props: { title: '翻命扑克 · 序章', size: 'md', closeAction: 'closeOverlay' },
    children: [{
      type: 'Panel', id: 'story-body', props: {}, layout: { direction: 'column', gap: 10, padding: 6 },
      children: [
        { type: 'Label', id: 'story-scene', props: { text: `〔 ${b.scene} 〕`, size: 'lg', color: 'gold', bold: true } },
        { type: 'Label', id: 'story-text', props: { text: b.text, size: 'md', color: 'text', typewriter: 24 } },
        { type: 'Label', id: 'story-dots', props: { text: `${i + 1} / ${beats.length}`, size: 'sm', color: 'dim' } },
        { type: 'Panel', id: 'story-btns', props: {}, layout: { direction: 'row', gap: 10 }, children: [
          { type: 'Button', id: 'story-skip', props: { label: '跳过', kind: 'ghost', action: 'closeOverlay' } },
          { type: 'Button', id: 'story-next', props: { label: last ? '执掌命运 →' : '下一幕 →', kind: 'primary', action: last ? 'closeOverlay' : 'storyNext' } },
        ] },
      ],
    }],
  };
}

/** 浮层启动器屏（主树·常驻）：一排按钮开各浮层（帮助/设置/商城/卦象/故事）。 */
export function buildOverlayLauncher(): LayoutNode {
  return {
    type: 'Screen', id: 'overlays-launcher', props: { bg: GG_LOBBY_THEME.pageBg },
    layout: { direction: 'column', padding: 16, gap: 12 },
    children: [{
      type: 'Panel', id: 'launch-panel', props: { title: '🪟 大厅浮层 · Modal/Drawer（点开各浮层）' },
      layout: { direction: 'row', gap: 10, padding: 14 },
      children: [
        { type: 'Button', id: 'open-help', props: { label: '📖 帮助中心', kind: 'ghost', action: 'openHelp' } },
        { type: 'Button', id: 'open-settings', props: { label: '⚙ 设置', kind: 'ghost', action: 'openSettings' } },
        { type: 'Button', id: 'open-shop', props: { label: '🛒 商城', kind: 'ghost', action: 'openShop' } },
        { type: 'Button', id: 'open-lucky', props: { label: '🎴 今日卦象', kind: 'ghost', action: 'openLucky' } },
        { type: 'Button', id: 'open-story', props: { label: '📜 开场故事', kind: 'ghost', action: 'openStory' } },
      ],
    }],
  };
}

/** 当前浮层 → LayoutNode（无浮层时返回 null）。供宿主挂到独立 overlayHost。 */
export function buildOverlay(view: LobbyView, st: OverlayState): LayoutNode | null {
  switch (st.open) {
    case 'help': return helpModal(st);
    case 'settings': return settingsModal(view);
    case 'shop': return shopModal(view, st);
    case 'lucky': return luckyModal(st.lucky);
    case 'story': return storyModal(STORY_OPENING, st.storyIdx);
    default: return null;
  }
}

/** 挂载浮层 pilot（双宿主·MVU：启动器常驻 launcherHost·浮层单独 overlayHost·开关不碰主树·套路同 game-i）。 */
export function mountOverlays(container: HTMLElement, getView: () => LobbyView, extra: HandlerMap = {}): { update: () => void; destroy: () => void } {
  const root = container.ownerDocument.createElement('div');
  root.style.cssText = 'position:relative;min-height:100%';
  const launcherHost = container.ownerDocument.createElement('div');
  const overlayHost = container.ownerDocument.createElement('div');
  root.append(launcherHost, overlayHost);
  container.appendChild(root);

  let st: OverlayState = { ...INITIAL_OVERLAY };
  let overlayTeardown: (() => void) | null = null;
  const showOverlay = (): void => {
    if (overlayTeardown) { overlayTeardown(); overlayTeardown = null; }
    const node = buildOverlay(getView(), st);
    if (node) overlayTeardown = mountUI(overlayHost, node, handlers, GG_LOBBY_THEME);
  };
  const open = (k: OverlayKind): void => { st = { ...st, open: k }; showOverlay(); };
  const handlers: HandlerMap = {
    openHelp: () => open('help'), openSettings: () => open('settings'), openShop: () => open('shop'),
    openLucky: () => { st = { ...st, open: 'lucky', lucky: luckyFromVal(1 + ((st.lucky.val * 7 + 13) % 100)) }; showOverlay(); },
    openStory: () => { st = { ...st, open: 'story', storyIdx: 0 }; showOverlay(); },
    closeOverlay: () => { st = { ...st, open: 'none' }; showOverlay(); },
    helpTab: (k) => { st = { ...st, helpTab: (k as OverlayState['helpTab']) ?? 'intro' }; showOverlay(); },
    manTier: (k) => { st = { ...st, manTier: (k as OverlayState['manTier']) ?? 'easy' }; showOverlay(); },
    shopTab: (k) => { st = { ...st, shopTab: (k as OverlayState['shopTab']) ?? 'gacha' }; showOverlay(); },
    reroll: () => { st = { ...st, lucky: luckyFromVal(1 + ((st.lucky.val * 7 + 13) % 100)) }; showOverlay(); },
    storyNext: () => { st = { ...st, storyIdx: Math.min(STORY_OPENING.length - 1, st.storyIdx + 1) }; showOverlay(); },
    ...extra,
  };
  const ui = mountUI(launcherHost, buildOverlayLauncher(), handlers, GG_LOBBY_THEME);
  return { update: () => { ui.update(buildOverlayLauncher()); showOverlay(); }, destroy: () => { if (overlayTeardown) overlayTeardown(); ui(); root.remove(); } };
}
