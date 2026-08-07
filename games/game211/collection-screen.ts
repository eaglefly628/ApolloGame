// collection-screen.ts —— Game G 大厅「收藏」屏·数据驱动 pilot（Step B·接力 home/campaign 范式）。
//
// 纯数据 `LayoutNode` + 引擎 `mountUI` 解释器 + `GG_LOBBY_THEME` 换皮·零手写 DOM（红线·同 home-screen）。
// 四子页用引擎 `Tabs` 控件托管（切页由引擎内建·抗闪屏）：
//   ① 牌谱（英雄列传·花色/稀有/仅已拥有 过滤 + 卡格 + 详情）—— MVU：过滤/选中走信号→reducer→ui.update。
//   ② 天梯·榜（沿用 live ladderSection 已数据驱动的 Table 范式·纯展示）。
//   ③ 地煞·战法（52 Boss 招牌战术·Accordion 折叠·campaignMax 控锁态）。
//   ④ 天罡&闪艺（view.tiangangs / view.foils 卡格·纯展示）。
// 诚实边界：英雄立绘 SVG（heroPortrait）是 bespoke 美术 flourish，pilot 用 Card 媒体字形近似；内容/过滤/换皮全数据化。
import { mountUI } from '@zerocraft/engine/ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@zerocraft/engine/ui/components/index.js';
import { GG_LOBBY_THEME } from './ui-theme.js';
import { textureOverrideUri, iconUri } from './art-textures.js'; // 背景板槽（批30）+ 套装图标（批32）
import { HERO_CARDS, type HeroCard, type HeroRar } from './hero-codex.js';
import { heroPortraitUri } from './portraits.js';
import { EARTH_FIENDS, STAGE_CAMPAIGN } from './campaign-data.js';
import { stageDisha } from './disha.js';
import { dishaNumberLine } from './lobby-types.js'; // 纯函数复用（数值人话行·与 campaign-screen 一致）
import type { LobbyView } from './lobby-types.js';

const RAR_NAME: Record<HeroRar, string> = { white: '普通', green: '精良', blue: '稀有', purple: '史诗', orange: '传说' };
const SUIT_NAME: Record<string, string> = { '♠': '黑桃', '♥': '红桃', '♦': '方块', '♣': '梅花' };
// 去掉描述里夹带的英文别名（owner 2026-06-27「只要中文·本地化时再加英文」）：剥连续 ASCII 字母词 + 清多余空格/空括号。
const stripEn = (s?: string): string => (s ?? '').replace(/[A-Za-z]+/g, '').replace(/（\s*）|\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();

export interface CollectionState { suit: string; rar: string; ownedOnly: boolean; heroId: string }
export const INITIAL_COLLECTION: CollectionState = { suit: 'all', rar: 'all', ownedOnly: false, heroId: '' };

// ── ① 牌谱（英雄列传）─────────────────────────────────────────────
function heroesPage(st: CollectionState): LayoutNode {
  const filtered = HERO_CARDS.filter((h) =>
    (st.suit === 'all' || h.suit === st.suit) &&
    (st.rar === 'all' || h.rar === st.rar) &&
    (!st.ownedOnly || h.own > 0));
  const sel = HERO_CARDS.find((h) => h.id === st.heroId) ?? filtered[0];

  const suitTags: LayoutNode[] = ([['all', '全部'], ['♠', '♠'], ['♥', '♥'], ['♦', '♦'], ['♣', '♣']] as [string, string][])
    .map(([k, l]) => ({ type: 'Tag', id: `coll-suit-${k}`, props: { label: l, active: st.suit === k, action: 'filterSuit', actionArg: k } }));
  const rarTags: LayoutNode[] = ([['all', '全部'], ['blue', '稀有'], ['purple', '史诗'], ['orange', '传说'], ['white', '普通']] as [string, string][])
    .map(([k, l]) => ({ type: 'Tag', id: `coll-rar-${k}`, props: { label: l, active: st.rar === k, action: 'filterRar', actionArg: k } }));
  const filterBar: LayoutNode = {
    type: 'Panel', id: 'coll-filter', props: { bare: true }, layout: { direction: 'row', gap: 8, padding: 8, align: 'center' },
    children: [
      { type: 'Label', id: 'coll-fl-suit', props: { text: '花色', size: 'sm', color: 'sub' } }, ...suitTags,
      { type: 'Label', id: 'coll-fl-rar', props: { text: '稀有度', size: 'sm', color: 'sub' } }, ...rarTags,
      { type: 'Toggle', id: 'coll-owned', props: { label: '仅已拥有', checked: st.ownedOnly, action: 'ownedToggle' } },
    ],
  };

  // 保真：牌谱用 PlayingCard 原语（真扑克牌面·名将名 + 拥有数/稀有 + 选中金边/未拥暗）。
  // 收藏卡墙（对齐原版 .hero-grid6{repeat(6,1fr)} + .pcard{width:100%;aspect-ratio:5/7;hover 翻面}）：
  // 用主程下沉(25c0a465)的 grid cols:6 + PlayingCard fluid（卡填满 1fr 格·零卡间空隙）
  // + flipOnHover+backFace（鼠标悬停 front→back 翻转·露英雄列传：名/稀有·朝代/称号）。
  const cards: LayoutNode[] = filtered.map((h) => ({
    type: 'PlayingCard', id: `coll-h-${h.id}`,
    props: { rank: h.rank, suit: h.suit, label: h.name, value: h.own > 0 ? `×${h.own}` : RAR_NAME[h.rar], fluid: true,
      art: heroPortraitUri(h.suit, h.era, h.rank, h.rar),
      selected: h.id === sel?.id && h.own > 0, dimmed: h.own === 0, action: 'heroPick', actionArg: h.id,
      flipOnHover: true,
      backFace: { type: 'Panel', id: `coll-bk-${h.id}`, props: { bare: true }, layout: { direction: 'column', align: 'center', justify: 'center', gap: 3, padding: 4 },
        children: [
          { type: 'Label', id: `coll-bk-n-${h.id}`, props: { text: `${h.rank}${h.suit} ${h.name}`, size: 'sm', color: 'gold', bold: true } },
          { type: 'Label', id: `coll-bk-t-${h.id}`, props: { text: `${h.title} · ${RAR_NAME[h.rar]}`, size: 'sm', color: 'sub' } },
          { type: 'Label', id: `coll-bk-c-${h.id}`, props: { text: stripEn(h.contrib), size: 'sm', color: 'dim' } },
        ] } },
  }));
  const grid: LayoutNode = {
    type: 'Panel', id: 'coll-grid', props: { title: `英雄列传 · ${filtered.length}/${HERO_CARDS.length}`, scroll: true },
    layout: { direction: 'grid', cols: 6, gap: 14, padding: 10, flex: 1 }, children: cards,
  };

  const detail: LayoutNode = sel ? buildHeroDetail(sel) : {
    type: 'Panel', id: 'coll-detail', props: { title: '详情' }, layout: { width: 320, padding: 14 },
    children: [{ type: 'Label', id: 'coll-detail-empty', props: { text: '← 选择英雄查看列传', size: 'sm', color: 'dim' } }],
  };

  return {
    type: 'Panel', id: 'coll-heroes', props: { bare: true }, layout: { direction: 'column', gap: 10 },
    children: [filterBar, { type: 'Panel', id: 'coll-heroes-row', props: { bare: true }, layout: { direction: 'row', gap: 14, flex: 1 }, children: [grid, detail] }],
  };
}

function buildHeroDetail(h: HeroCard): LayoutNode {
  // 对齐原版 hero-detail-pane 确切 px（lobby-collection.ts 内联样式）：名 30·衔 13·meta 12·正文 13·名战引语 20。
  const kids: LayoutNode[] = [
    { type: 'Label', id: 'cd-name', props: { text: `${h.rank}${h.suit} ${h.name}`, size: 30, color: 'gold', bold: true } },
    { type: 'Label', id: 'cd-title', props: { text: `${h.title} · ${h.era}`, size: 13, color: 'sub' } },
    { type: 'Label', id: 'cd-meta', props: { text: `${RAR_NAME[h.rar]} · ${h.suit}${SUIT_NAME[h.suit] ?? ''} · 贡献度 第 ${h.contribRank} 位`, size: 12, color: 'dim' } },
    { type: 'Divider', id: 'cd-div', props: {} },
    { type: 'Label', id: 'cd-curse', props: { text: h.curseIntro ?? '此魂之诅咒序待录 · 命运待解封', size: 13, color: 'gold' } },
    { type: 'Label', id: 'cd-bio', props: { text: h.bio ?? `${h.contrib}（全传逐期补录）`, size: 13, color: 'text' } },
  ];
  if (h.battleName) kids.push({ type: 'Label', id: 'cd-battle', props: { text: `名战：${h.battleName} —— ${h.battleResult ?? ''}`, size: 13, color: 'sub' } });
  if (h.quote) kids.push({ type: 'Label', id: 'cd-quote', props: { text: `「${h.quote}」`, size: 20, color: 'gold' } });
  if (h.gossip) kids.push({ type: 'Label', id: 'cd-gossip', props: { text: `野史 · 八卦：${h.gossip}`, size: 13, color: 'sub' } });
  if (h.legacy) kids.push({ type: 'Label', id: 'cd-legacy', props: { text: `流变 · 影响：${h.legacy}`, size: 13, color: 'sub' } });
  return { type: 'Panel', id: 'coll-detail', props: { title: '列传', scroll: true }, layout: { direction: 'column', gap: 6, padding: 14, width: 320 }, children: kids };
}

// ── ② 天梯·榜（沿用 live ladderSection 的 Table 数据范式）─────────────
export function ladderPage(view: LobbyView): LayoutNode {
  const RECENTS: [string, string, string, string][] = [
    ['胜', 'win', '黑桃急袭 · 翻正 4/5', '+22'], ['胜', 'win', '红桃火攻 · 斩首奏效', '+19'],
    ['负', 'lose', '田忌阵被识破', '−16'], ['胜', 'win', '锋矢破中路', '+21'],
    ['胜', 'win', '黑杰克级正面率', '+18'], ['负', 'lose', '能量误判', '−14'],
  ];
  const LADDER: [string, string, string, string, string, string][] = [
    ['1', '同花顺王', '♠ 黑桃A', '♠ 顺子', '78%', '2880'], ['2', '红桃皇后', '♥ 红桃K', '♥ 火攻', '74%', '2710'],
    ['3', '方块老千', '♦ 方块Q', '♦ 配重', '71%', '2640'], ['4', '梅花骑士', '♣ 梅花J', '♣ 连携', '69%', '2510'],
    ['5', '百搭天罡', '♠ 黑桃10', '混 · 干预', '67%', '2380'], ['6', '黑桃暗影', '♠ 黑桃A', '♠ 速攻', '65%', '2240'],
    ['7', view.name, '♠ 黑桃A', '♠ 急袭', '64%', '1240'], ['8', '掷地有声', '♦ 方块K', '♦ 稳翻', '61%', '1180'],
  ];
  const recentRows = RECENTS.map(([r, k, detail, lp], i) => ({ id: `rec-${i}`, cells: { r, mode: detail, lp }, tone: (k === 'win' ? 'accent' : 'dim') as 'accent' | 'dim' }));
  const boardRows = LADDER.map(([rank, lname, mainCard, deck, wr, lp]) => ({ id: `ldr-${rank}`, cells: { rank, name: `${lname} · ${mainCard}`, deck, wr, lp },
    tone: (lname === view.name ? 'accent' : (+rank <= 3 ? 'accent' : 'normal')) as 'accent' | 'normal' }));
  // 我的段位 3 个统计盒（对齐设计稿：胜率/连胜/翻正率·大数字+小标）。
  const statBox = (id: string, num: string, lbl: string): LayoutNode => ({
    type: 'Panel', id, props: {}, layout: { direction: 'column', align: 'center', gap: 2, padding: 10, flex: 1 },
    children: [
      { type: 'Label', id: `${id}-n`, props: { text: num, size: 'lg', color: 'gold', bold: true } },
      { type: 'Label', id: `${id}-l`, props: { text: lbl, size: 10, color: 'sub' } },
    ],
  });
  // 布局对齐设计稿 天梯·榜：左=我的段位(♠章+段位+LP+进度条+3统计盒)+近10局；右=全服榜(全服/好友/同段 段控 + 表)。
  return {
    type: 'Panel', id: 'ladder', props: { bare: true }, layout: { direction: 'row', gap: 16, flex: 1 },
    children: [
      { type: 'Panel', id: 'ldr-left', props: { bare: true }, layout: { direction: 'column', gap: 14, width: 320 },
        children: [
          { type: 'Panel', id: 'ldr-rank', props: { title: '我的段位', accent: true }, layout: { direction: 'column', gap: 10, padding: 16, align: 'center' },
            children: [
              { type: 'Avatar', id: 'ldr-seal', props: { name: '♠', shape: 'rounded', size: 72 } },
              { type: 'Label', id: 'ldr-rank-t', props: { text: view.rankText, size: 26, color: 'gold', bold: true } },
              { type: 'Label', id: 'ldr-rank-lp', props: { text: '1240 LP', size: 'sm', color: 'sub' } },
              { type: 'ProgressBar', id: 'ldr-rank-pb', props: { value: 1240, max: 1300, tone: 'gold', label: '距晋级 60 LP', showValue: false } },
              { type: 'Panel', id: 'ldr-stats', props: { bare: true }, layout: { direction: 'row', gap: 8 }, children: [statBox('ldr-s1', '64%', '胜率'), statBox('ldr-s2', '3', '连胜'), statBox('ldr-s3', '71%', '翻正率')] },
            ] },
          { type: 'Table', id: 'ldr-recents', props: { title: '近 10 局', columns: [{ key: 'r', label: '', width: 30, align: 'center' }, { key: 'mode', label: '对局' }, { key: 'lp', label: 'LP', width: 52, align: 'right' }], rows: recentRows } },
        ] },
      { type: 'Panel', id: 'ldr-right', props: {}, layout: { direction: 'column', gap: 10, flex: 1 },
        children: [
          { type: 'Panel', id: 'ldr-board-hd', props: { bare: true }, layout: { direction: 'row', align: 'center', gap: 10 },
            children: [
              { type: 'Label', id: 'ldr-board-t', props: { text: '全服榜', size: 'lg', color: 'gold', bold: true } },
              { type: 'Segmented', id: 'ldr-board-seg', props: { options: [{ value: 'all', label: '全服' }, { value: 'friend', label: '好友' }, { value: 'tier', label: '同段' }], value: 'all' } },
              { type: 'Panel', id: 'ldr-board-sp', props: { bare: true }, layout: { flex: 1 } },
              { type: 'Label', id: 'ldr-board-meta', props: { text: '每 5 分钟刷新 · 赛季 7', size: 'sm', color: 'dim' } },
            ] },
          { type: 'Table', id: 'ldr-board', props: { columns: [{ key: 'rank', label: '名次', width: 48, align: 'center' }, { key: 'name', label: '玩家 / 主牌' }, { key: 'deck', label: '主流派', width: 96, align: 'center' }, { key: 'wr', label: '胜率', width: 60, align: 'right' }, { key: 'lp', label: 'LP', width: 68, align: 'right' }], rows: boardRows }, layout: { flex: 1 } },
        ] },
    ],
  };
}

// ── ③ 地煞·战法（52 Boss 招牌战术·Accordion 折叠·campaignMax 锁态）────
function fiendsPage(view: LobbyView): LayoutNode {
  const campaignMax = view.campaignMax ?? view.campaign?.stage ?? 1;
  const stageOf = new Map(STAGE_CAMPAIGN.map((c) => [c.boss, c.stage]));
  const sorted = [...EARTH_FIENDS].sort((a, b) => (stageOf.get(a.boss) ?? 99) - (stageOf.get(b.boss) ?? 99));
  const blocks: LayoutNode[] = sorted.map((b, bi) => {
    const st = stageOf.get(b.boss);
    const locked = st === undefined || st > campaignMax;
    const bDisha = st !== undefined ? stageDisha(st) : [];
    const fiendCards: LayoutNode[] = b.fiends.map((f, i) => {
      const nums = dishaNumberLine(bDisha[i] ?? '');
      return { type: 'Card', id: `fiend-${bi}-${i}`,
        props: { title: `🎴 ${f.name} · ${f.kind}`, sub: `${f.effect}${nums ? ` · 📊 ${nums}` : ''} · 🛡 破：${f.counter}`, tone: 'normal' } };
    });
    const tag = st !== undefined ? `${locked ? '🔒 ' : ''}第 ${st} 关` : '🔒 后续关卡';
    return { type: 'Accordion', id: `boss-${bi}`, props: { title: `${tag} · ${b.boss}（招牌战术 ×${b.fiends.length}）`, open: !locked && bi === 0 },
      layout: { direction: 'column', gap: 6, padding: 8 },
      children: [{ type: 'Panel', id: `boss-${bi}-row`, props: { bare: true }, layout: { direction: 'grid', cols: 3, gap: 8 }, children: fiendCards }] };
  });
  // 外层 bare 去多余框（owner「地煞图鉴外框不需要」）。
  return {
    type: 'Panel', id: 'coll-fiends', props: { title: `地煞图鉴 · 共 ${EARTH_FIENDS.length} 位 Boss（明牌·公平可破）`, bare: true, scroll: true },
    layout: { direction: 'column', gap: 6, padding: 4 }, children: blocks,
  };
}

// ── ④ 天罡 & 闪艺（view 数据·纯展示卡格）─────────────────────────
function collectPage(view: LobbyView): LayoutNode {
  const ownedT = view.tiangangs.filter((j) => j.owned).length;
  const ownedF = view.foils.filter((f) => f.owned).length;
  const tCards: LayoutNode[] = view.tiangangs.map((j) => ({ type: 'Card', id: `col-t-${j.id}`,
    props: { ...(iconUri('tiangang') ? { media: iconUri('tiangang')! } : {}), title: iconUri('tiangang') ? j.name : `⚡ ${j.name}`, sub: stripEn(j.sub), tone: (j.owned ? 'normal' : 'locked') as 'normal' | 'locked' } }));
  const fCards: LayoutNode[] = view.foils.map((f) => ({ type: 'Card', id: `col-f-${f.id}`,
    props: { title: `✨ ${f.name}`, sub: stripEn(f.sub), tone: (f.owned ? 'accent' : 'locked') as 'accent' | 'locked' } }));
  // 外层 coll-collect + 内层 grid 都 bare（去掉多余框·owner「多了一个框」）；标题用 Label 不靠 Panel chrome。
  return {
    type: 'Panel', id: 'coll-collect', props: { bare: true, scroll: true }, layout: { direction: 'column', gap: 10, padding: 4 },
    children: [
      // 页头套装图标（批32）：icon 在场→span.img·无=原 emoji 文本（观感零变）。
      { type: 'Label', id: 'col-t-h', props: { size: 'md', color: 'gold', spans: [
        iconUri('collection') ? { text: `天罡牌 · 收藏 ${ownedT}/${view.tiangangs.length}（到「牌组」屏编入出战）`, img: iconUri('collection')! }
          : { text: `🗃 天罡牌 · 收藏 ${ownedT}/${view.tiangangs.length}（到「牌组」屏编入出战）` },
      ] } },
      { type: 'Panel', id: 'col-t-grid', props: { bare: true }, layout: { direction: 'grid', minCol: 180, gap: 8 }, children: tCards },
      { type: 'Label', id: 'col-f-h', props: { size: 'md', color: 'gold', spans: [
        iconUri('foil') ? { text: `闪艺 · ${ownedF}/${view.foils.length}（纯装饰收集）`, img: iconUri('foil')! }
          : { text: `✨ 闪艺 · ${ownedF}/${view.foils.length}（纯装饰收集）` },
      ] } },
      { type: 'Panel', id: 'col-f-grid', props: { bare: true }, layout: { direction: 'grid', minCol: 180, gap: 8 }, children: fCards },
    ],
  };
}

/** 收藏屏内容 → LayoutNode（纯数据）。Tabs 托管四子页；st 给牌谱过滤/选中态（缺省 INITIAL）。 */
export function buildCollectionScreen(view: LobbyView, st: CollectionState = INITIAL_COLLECTION): LayoutNode {
  const tabs: LayoutNode = {
    type: 'Tabs', id: 'coll-tabs',
    props: { tabs: [{ id: 'heroes', label: '收藏·牌谱' }, { id: 'fiends', label: '地煞·战法' }, { id: 'collect', label: '天罡&闪艺' }] },
    layout: { flex: 1 },
    children: [heroesPage(st), fiendsPage(view), collectPage(view)],
  };
  return {
    type: 'Screen', id: 'collection-screen', props: {
      bg: GG_LOBBY_THEME.pageBg,
      ...(textureOverrideUri('game211/tex/collection-backdrop') ? { image: textureOverrideUri('game211/tex/collection-backdrop')! } : {}),
    },
    layout: { direction: 'column', padding: 16 }, children: [tabs],
  };
}

/** 挂载收藏屏（MVU：过滤/选中信号 → 改 st → ui.update(buildCollectionScreen)·局部 diff·Tabs 切页态由引擎守）。 */
export function mountCollection(host: HTMLElement, getView: () => LobbyView, extra: HandlerMap = {}): { update: () => void; destroy: () => void } {
  let st: CollectionState = { ...INITIAL_COLLECTION };
  const rebuild = (): void => ui.update(buildCollectionScreen(getView(), st));
  const handlers: HandlerMap = {
    filterSuit: (k) => { st = { ...st, suit: k ?? 'all', heroId: '' }; rebuild(); },
    filterRar: (k) => { st = { ...st, rar: k ?? 'all', heroId: '' }; rebuild(); },
    ownedToggle: (v) => { st = { ...st, ownedOnly: v === 'true', heroId: '' }; rebuild(); },
    heroPick: (k) => { st = { ...st, heroId: k ?? '' }; rebuild(); },
    ...extra,
  };
  const ui = mountUI(host, buildCollectionScreen(getView(), st), handlers, GG_LOBBY_THEME);
  return { update: rebuild, destroy: () => ui() };
}
