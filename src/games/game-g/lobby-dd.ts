// lobby-dd.ts —— Game G 大厅「全数据驱动」集成（Step A·owner 2026-06-25 拍板：UI 方案全部改数据驱动·上线）。
//
// 取代手写 DOM 的 lobby-screen.mountLobby：用纯数据 LayoutNode + 引擎 mountUI + GG_LOBBY_THEME 渲染整座大厅。
// 复用已打样自验的六个 builder（home/campaign/collection/deck/craft 屏 + overlays 浮层）·零手写 DOM（红线）。
// 信号 → 真存档：所有 action 路由到既有 LobbyHandlers（h.onPlay/onBuyTiangang/onTogglePick/...），持久态读 getView()。
// 主树（顶栏 + 导航 + 当前页）挂 mainHost；浮层单独挂 overlayHost（开关不碰主树·套路同 game-i）。
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@ui/components/index.js';
import { GG_LOBBY_THEME } from './ui-theme.js';
import { LOBBY_CSS } from './lobby-styles.js';
import { isSfxMuted, setSfxMuted } from './sfx.js';
import { toggleBgm } from './bgm.js';
import { buildHomeScreen } from './home-screen.js';
import { buildCampaignScreen } from './campaign-screen.js';
import { buildCollectionScreen, ladderPage, INITIAL_COLLECTION, type CollectionState } from './collection-screen.js';
import { buildDeckScreen } from './deck-screen.js';
import { buildCraftScreen } from './craft-screen.js';
import { buildOverlay, INITIAL_OVERLAY, type OverlayState } from './overlays.js';
import { luckyFromVal, type LobbyView, type LobbyHandlers, type GachaResult } from './lobby-screen.js';
import { World } from '@engine/core/world.js';
import type { Coachmark, Flag } from '@engine/protocol/components.js';
import { mountOnboardingOverlay } from '@ui/onboarding-overlay.js';
import { GUIDE_COACH } from './lobby-overlays.js';

const TABS: { id: string; label: string; anchor?: string }[] = [
  { id: 'home', label: '大厅', anchor: 'home' }, { id: 'campaign', label: '战役' }, { id: 'decks', label: '我的牌组', anchor: 'decks' },
  { id: 'coll', label: '收藏' }, { id: 'craft', label: '改造坊' }, { id: 'ladder', label: '天梯' },
];

export interface LobbyDDState { tab: string; coll: CollectionState; craftSel: string; ov: OverlayState; gachaReveal: GachaResult[] | null }
export const INITIAL_LOBBY_DD: LobbyDDState = { tab: 'home', coll: { ...INITIAL_COLLECTION }, craftSel: '', ov: { ...INITIAL_OVERLAY }, gachaReveal: null };

// ── 顶栏（玩家 + 货币 + 商城/手册/设置）·纯数据 ─────────────────
// owner 2026-06-26「证明 UI 控件能力 = 原版」：原版顶栏的 ♠ 章/等级 pill/货币 pill 早被引擎控件覆盖——
// 章=Avatar(shape:rounded)、货币/手册/设置/战役=Tag(圆角药丸·可点)；不再用 Button 凑数。三区 justify 居中战役 pill。
// archLine 数据带 HTML 标签（game-g.tsx 为原版 innerHTML 写的 <b>/<span>）→ Label 会 esc 成字面字符。显示前剥标签。
const stripTags = (s?: string): string => (s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
function pill(id: string, label: string, action: string, tone: 'normal' | 'accent' = 'normal', arg?: string, anchor?: string): LayoutNode {
  // size:'lg'=大气药丸（主程下沉 Tag.size·owner「货币 pill 太小·要≈2x」）。
  return { type: 'Tag', id, props: { label, tone, action, size: 'lg', ...(arg ? { actionArg: arg } : {}) }, ...(anchor ? { layout: { anchor } } : {}) };
}
function topbar(view: LobbyView): LayoutNode {
  const who: LayoutNode = {
    type: 'Panel', id: 'tb-who', props: { bare: true }, layout: { direction: 'column', gap: 1 },
    children: [
      { type: 'Label', id: 'tb-name', props: { text: view.name, size: 'lg', color: 'gold', bold: true } },
      // 副文本(Label.spans·主程已下沉)：主牌牌名金色高亮，对齐原版「主牌 · 黑桃A · 段位」内联着色。
      { type: 'Label', id: 'tb-sub', props: { size: 'sm', color: 'sub', spans: [{ text: '主牌 ' }, { text: view.mainCard, color: 'gold', bold: true }, { text: ` · ${view.rankText}` }] } },
      { type: 'Label', id: 'tb-arch', props: { text: stripTags(view.archLine) || '流派 未成型', size: 'sm', color: 'dim' } },
    ],
  };
  const left: LayoutNode = {
    type: 'Panel', id: 'tb-left', props: { bare: true }, layout: { direction: 'row', gap: 10, align: 'center', flex: 1 },
    children: [{ type: 'Avatar', id: 'tb-seal', props: { name: '♠', shape: 'rounded', size: 42 } }, who],
  };
  const stage: LayoutNode = pill('tb-stage', `⚔ ${view.stageLabel}`, 'tab', 'normal', 'campaign');
  const right: LayoutNode = {
    type: 'Panel', id: 'tb-right', props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'center', justify: 'end', flex: 1 },
    children: [
      pill('tb-shop', '🛒 商城', 'openShop', 'accent'),
      pill('tb-coin', `🪙 ${view.coin}`, 'recharge'),
      pill('tb-dia', `💎 ${view.diamond ?? 0}`, 'recharge'),
      pill('tb-shard', `🧩 ${view.dizhiShards ?? 0}`, 'recharge'),
      pill('tb-foil', `✨ ${view.foilCount}`, 'shopFoil'),
      pill('tb-man', '📚 手册', 'man', 'accent', undefined, 'help'),
      pill('tb-settings', '⚙', 'settings'),
    ],
  };
  return {
    type: 'Panel', id: 'lobby-topbar', props: { bare: true }, layout: { direction: 'row', gap: 8, padding: 10, align: 'center' },
    children: [left, stage, right],
  };
}

// 各页内容：复用 build*Screen，剥掉其 Screen 外壳（取 .children）嵌进大厅内容区。
function tabContent(view: LobbyView, st: LobbyDDState): LayoutNode {
  switch (st.tab) {
    case 'campaign': return buildCampaignScreen(view).children?.[0] ?? emptyTab('campaign');
    case 'decks': return { type: 'Panel', id: 'lc-decks', props: { bare: true }, layout: { direction: 'column', gap: 10, flex: 1 }, children: buildDeckScreen(view, new Set(view.pokerPicks ?? [])).children ?? [] };
    case 'coll': return buildCollectionScreen(view, st.coll).children?.[0] ?? emptyTab('coll');
    case 'ladder': return ladderPage(view);
    case 'craft': return { type: 'Panel', id: 'lc-craft', props: { bare: true }, layout: { direction: 'column', gap: 12, flex: 1 }, children: buildCraftScreen(view, st.craftSel).children ?? [] };
    default: return { type: 'Panel', id: 'lc-home', props: { bare: true }, layout: { direction: 'row', gap: 16, flex: 1 }, children: buildHomeScreen(view).children ?? [] };
  }
}
const emptyTab = (id: string): LayoutNode => ({ type: 'Panel', id: `lc-empty-${id}`, props: {}, layout: { padding: 16 }, children: [] });

export function buildLobby(view: LobbyView, st: LobbyDDState): LayoutNode {
  // 导航用引擎 Tabs 控件（renderTabs 自带金色下划线 active + 切页 toggle 不重建·对齐原版 .nav）——
  // 不再手搓 Button 列。Tabs children 按序对应 TABS；仅当前页建内容、余页占位（渲只渲 active·省构建）。
  // 导航只用 Tabs 做「金色下划线条」（空页·不托管内容）；内容单独放 flex:1 Panel——
  // 否则 Tabs 页容器 div 是 display:block 自然高度、不撑满 → 里面 felt(flex:1) 铺不满 → 底部留空（owner 2026-06-26 点名）。
  const nav: LayoutNode = {
    type: 'Tabs', id: 'lobby-nav', props: { tabs: TABS, active: st.tab, action: 'tab' }, children: [],
  };
  const content: LayoutNode = {
    type: 'Panel', id: 'lobby-content', props: { bare: true }, layout: { direction: 'column', flex: 1 },
    children: [tabContent(view, st)],
  };
  // 整厅外框（对齐原版 .frame）：maxWidth 1340 + 块居中——窄屏铺满、宽屏封顶居中。
  const frame: LayoutNode = {
    type: 'Panel', id: 'lobby-frame', props: {}, layout: { direction: 'column', gap: 10, padding: 14, maxWidth: 1340, flex: 1 },
    children: [topbar(view), { type: 'Divider', id: 'lobby-hdr-div', props: {} }, nav, content],
  };
  return {
    type: 'Screen', id: 'lobby-screen-dd', props: { bg: GG_LOBBY_THEME.pageBg },
    layout: { direction: 'column', padding: 0 },
    children: [frame],
  };
}

// 开包演出浮层（抽卡结果）·数据驱动 Modal。
function gachaRevealModal(results: GachaResult[]): LayoutNode {
  return {
    type: 'Modal', id: 'gacha-reveal', props: { title: '🎴 开 包', size: 'md', closeAction: 'reveal-close' },
    children: [{
      type: 'Panel', id: 'reveal-grid', props: {}, layout: { direction: 'grid', minCol: 150, gap: 8, padding: 4 },
      children: results.map((r, i) => ({ type: 'Card', id: `reveal-${i}`,
        props: { title: `${r.kind === 'tiangang' ? '🎴' : '🀄'} ${r.name}`, sub: r.detail,
          tone: (r.outcome === 'new' || r.outcome === 'dizhi-up' ? 'accent' : 'normal') as 'accent' | 'normal' } })),
    }],
  };
}

/** 挂载全数据驱动大厅。签名同旧 mountLobby（host, LobbyHandlers）→ game-g.tsx 零改接入。 */
export function mountLobby(host: HTMLElement, h: LobbyHandlers): { update: () => void; destroy: () => void } {
  const doc = host.ownerDocument;
  if (!doc.getElementById('ggl-css')) { const s = doc.createElement('style'); s.id = 'ggl-css'; s.textContent = LOBBY_CSS; doc.head.appendChild(s); }
  const getView = h.getView;

  const root = doc.createElement('div');
  root.className = 'ggl-root';
  root.dataset['skin'] = getView().skin;
  // 借 .ggl-root 的设计令牌（--paper/--ink/--gold…），但覆盖其整框结构（100vh/flex/overflow），让数据屏自然铺开可滚。
  root.style.cssText = 'position:absolute;inset:0;height:auto;display:block;overflow:auto;justify-content:initial;background:#0c0a08';
  const mainHost = doc.createElement('div');
  const overlayHost = doc.createElement('div');
  root.append(mainHost, overlayHost);
  host.appendChild(root);

  // 新手引导 coachmark（数据驱动·复用引擎 OnboardingOverlay·套路同战斗 battle-coach）：小 world 承载 Coachmark + 驱动 Flag。
  // 锚点用 layout.anchor 渲成 data-anchor（引擎新能力）；OnboardingOverlay 在 root 内 querySelector 锚点 → spotlight + 气泡。
  const coachWorld = new World();
  coachWorld.createEntity('coach-flag'); coachWorld.addComponent<Flag>('coach-flag', { type: 'Flag', id: 'lobby_coach', active: false });
  coachWorld.createEntity('coach-mark'); coachWorld.addComponent<Coachmark>('coach-mark', { type: 'Coachmark', anchor: 'help', text: '', visibleWhen: 'lobby_coach', pad: 7, placement: 'bottom' });
  const coach = mountOnboardingOverlay(root, coachWorld, root);

  const st: LobbyDDState = { tab: 'home', coll: { ...INITIAL_COLLECTION }, craftSel: '', ov: { ...INITIAL_OVERLAY }, gachaReveal: null };
  if (getView().firstLaunch) st.ov.open = 'story';

  // 引导可见：非首启故事、引导开、进度在范围、无浮层 → 显当前步（写锚点/文案到 mark）；否则灭。同原版 lobby-screen updateCoach。
  const anyOverlayOpen = (): boolean => st.ov.open !== 'none' || !!st.gachaReveal;
  const updateCoach = (): void => {
    const v = getView(); const gs = v.guideStep ?? -1;
    const flag = coachWorld.getComponent<Flag>('coach-flag', 'Flag'); const mark = coachWorld.getComponent<Coachmark>('coach-mark', 'Coachmark');
    if (flag && mark) {
      const show = !v.firstLaunch && v.guideOn !== false && gs >= 0 && gs < GUIDE_COACH.length && !anyOverlayOpen();
      if (show) { const spec = GUIDE_COACH[gs]!; mark.anchor = spec.anchor; mark.text = spec.text; mark.placement = spec.placement; }
      flag.active = show;
    }
    coach.update();
  };
  // 点对推进（同原版 lobby-screen L317）：玩家动作 == 当前步 advanceAct(+可选 advanceK) → 进下一步 / 完成。
  const advanceGuide = (act: string, k?: string): void => {
    const gs = getView().guideStep ?? -1;
    if (gs < 0 || gs >= GUIDE_COACH.length) return;
    const s = GUIDE_COACH[gs]!;
    if (act === s.advanceAct && (!s.advanceK || k === s.advanceK)) {
      if (gs < GUIDE_COACH.length - 1) h.onGuideStep?.(gs + 1); else h.onGuideDone?.();
    }
  };

  let overlayTeardown: (() => void) | null = null;
  const showOverlay = (): void => {
    if (overlayTeardown) { overlayTeardown(); overlayTeardown = null; }
    const node = st.gachaReveal ? gachaRevealModal(st.gachaReveal) : buildOverlay(getView(), st.ov);
    if (node) overlayTeardown = mountUI(overlayHost, node, handlers, GG_LOBBY_THEME);
    updateCoach();
  };
  const rerenderMain = (): void => { root.dataset['skin'] = getView().skin; ui.update(buildLobby(getView(), st)); updateCoach(); };
  const refresh = (): void => { rerenderMain(); showOverlay(); };
  const openOv = (patch: Partial<OverlayState>): void => { st.ov = { ...st.ov, ...patch }; showOverlay(); };
  const rollLucky = (): void => { const v = h.onRollFortune?.(); const val = typeof v === 'number' ? v : (getView().fortune?.keptVal ?? 50); st.ov = { ...st.ov, lucky: luckyFromVal(val) }; };

  const handlers: HandlerMap = {
    // ── 导航 / 顶栏 ──
    tab: (k) => { advanceGuide('tab', k); st.tab = k ?? 'home'; rerenderMain(); },
    openShop: () => openOv({ open: 'shop', shopTab: 'gacha' }),
    recharge: () => openOv({ open: 'shop', shopTab: 'wallet' }),
    shopFoil: () => openOv({ open: 'shop', shopTab: 'foil' }),
    man: () => { advanceGuide('man'); openOv({ open: 'help', helpTab: 'manual' }); },
    settings: () => openOv({ open: 'settings' }),
    // ── 主页 / 战役 ──
    play: () => { advanceGuide('play'); h.onPlay(); },
    lucky: () => { rollLucky(); st.ov = { ...st.ov, open: 'lucky' }; showOverlay(); },
    // ── 收藏（瞬时 UI 态）──
    filterSuit: (k) => { st.coll = { ...st.coll, suit: k ?? 'all', heroId: '' }; rerenderMain(); },
    filterRar: (k) => { st.coll = { ...st.coll, rar: k ?? 'all', heroId: '' }; rerenderMain(); },
    ownedToggle: (v) => { st.coll = { ...st.coll, ownedOnly: v === 'true', heroId: '' }; rerenderMain(); },
    heroPick: (k) => { st.coll = { ...st.coll, heroId: k ?? '' }; rerenderMain(); },
    // ── 牌组（持久态走 h.*）──
    pickCard: (k) => { if (k) h.onTogglePick?.(k); rerenderMain(); },
    clearPicks: () => { h.onClearPicks?.(); rerenderMain(); },
    autoBuildDeck: () => { advanceGuide('autoBuildDeck'); h.onAutoBuildDeck?.(); rerenderMain(); },
    autoBuildTiangang: () => { advanceGuide('autoBuildTiangang'); h.onAutoBuildTiangang?.(); rerenderMain(); },
    deckTab: (k) => { advanceGuide('deckTab', k === 'tiangang' ? 'gang' : k); updateCoach(); }, // 牌组子页签切换（引擎 Tabs 内建切页）+ 引导步④推进

    selectDeck: (k) => { if (k) h.onSelectDeck?.(k); rerenderMain(); },
    newDeck: () => { h.onNewDeck?.(); rerenderMain(); },
    toggleTiangang: (k) => { if (k) h.onToggleTiangang?.(k); rerenderMain(); },
    deckAdd: () => { /* 空槽添加：天罡选卡弹窗待接（持久走 onToggleTiangang）·暂不弹·bug-review */ },
    // ── 改造坊 ──
    craftSel: (k) => { st.craftSel = st.craftSel === k ? '' : (k ?? ''); rerenderMain(); },
    inlay: (k) => { if (k) { const [idx, b, t] = k.split(':'); h.onInlay?.(idx, b, parseInt(t, 10) || 1); } rerenderMain(); },
    removeInlay: (k) => { if (k) { const [idx, slot] = k.split(':'); h.onRemoveInlay?.(idx, parseInt(slot, 10) || 0); } rerenderMain(); },
    buyTiangang: (k) => { if (k) h.onBuyTiangang?.(k); refresh(); },
    diamondUnlock: (k) => { if (k) h.onDiamondUnlock?.(k); refresh(); },
    // ── 商城浮层 ──
    shopTab: (k) => { st.ov = { ...st.ov, shopTab: (k as OverlayState['shopTab']) ?? 'gacha' }; showOverlay(); },
    gacha: (k) => { if (!k) return; const [pool, cnt, pay] = k.split(':'); const r = h.onGacha?.(pool as 'tiangang' | 'dizhi', cnt === '10' ? 10 : 1, pay as 'gold' | 'diamond'); if (r && r.length) { st.gachaReveal = r; } refresh(); },
    buyFoil: (k) => { if (k) h.onBuyFoil?.(k); refresh(); },
    rechargeBuy: (k) => { if (k) h.onRecharge?.(k, ''); refresh(); },
    exchangeBuy: (k) => { if (k) h.onExchange?.(k); refresh(); },
    shardBuy: (k) => { if (k) h.onBuyShards?.(k); refresh(); },
    craftTiangang: (k) => { if (k) h.onCraftTiangang?.(k); refresh(); },
    craftDizhi: (k) => { if (k) h.onCraftDizhi?.(k); refresh(); },
    // ── 设置浮层 ──
    setSkin: (k) => { if (k) { h.onSkin?.(k as 'onyx' | 'rosy'); root.dataset['skin'] = k; } showOverlay(); },
    sfxToggle: () => { setSfxMuted(!isSfxMuted()); showOverlay(); },
    bgmToggle: () => { toggleBgm(); showOverlay(); },
    toggleGuide: () => { h.onToggleGuide?.(); showOverlay(); },
    replayIntro: () => { h.onReplayIntro?.(); st.ov = { ...st.ov, open: 'story', storyIdx: 0 }; refresh(); },
    exitGame: () => { h.onExitGame?.(); },
    reset: () => { h.onReset?.(); st.ov = { ...st.ov, open: 'none' }; refresh(); },
    // ── 帮助浮层 ──
    helpTab: (k) => { st.ov = { ...st.ov, helpTab: (k as OverlayState['helpTab']) ?? 'intro' }; showOverlay(); },
    manTier: (k) => { st.ov = { ...st.ov, manTier: (k as OverlayState['manTier']) ?? 'easy' }; showOverlay(); },
    // ── 卦象浮层 ──
    reroll: () => { rollLucky(); showOverlay(); },
    // ── 故事浮层 ──
    storyNext: () => { st.ov = { ...st.ov, storyIdx: st.ov.storyIdx + 1 }; showOverlay(); },
    // ── 开包 / 通用关闭 ──
    'reveal-close': () => { st.gachaReveal = null; refresh(); },
    closeOverlay: () => {
      if (st.ov.open === 'lucky') h.onKeepFortune?.(st.ov.lucky.val);
      if (st.ov.open === 'story') h.onIntroSeen?.();
      st.ov = { ...st.ov, open: 'none' }; st.gachaReveal = null; refresh();
    },
  };

  const ui = mountUI(mainHost, buildLobby(getView(), st), handlers, GG_LOBBY_THEME);
  showOverlay();
  return { update: refresh, destroy: () => { if (overlayTeardown) overlayTeardown(); coach.destroy(); ui(); root.remove(); } };
}
