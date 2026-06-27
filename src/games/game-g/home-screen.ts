// home-screen.ts —— Game G 大厅「主页」屏·数据驱动 pilot（owner 2026-06-23）。
//
// 用引擎 Apollo UI 层（`LayoutNode` 纯数据 + `mountUI` 解释器 + `GG_LOBBY_THEME` 换皮令牌）重写主页。
// 红线（同 game-i）：本文件**只产数据 + 接信号**，不写一行 HTML/DOM 模板。证明 game-g UI 可落「纯数据 + 引擎固定解释器」。
//
// 诚实边界：原主页的「绿呢牌桌 / 旋转对决卡 / vignette」是 bespoke 视觉，数据驱动控件集只能近似——
// 本 pilot 把主页的**内容 / 交互 / 换皮**全部数据化（标题/Boss 情报/今日卦象/出征 CTA/地煞），
// 那层 flourish 视觉留作后续 bespoke 渲染层（关注点分离·见 docs apollo-ui 移植契约）。
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@ui/components/index.js';
import { GG_LOBBY_THEME } from './ui-theme.js';
import type { LobbyView } from './lobby-screen.js';

/** 主页内容 → LayoutNode（纯数据·保真原版绿呢牌桌·owner 2026-06-25「和原版一样」）。
 *  用补齐后的控件：Panel(bg=felt+vignette) 绿呢牌桌 · PlayingCard(face:light·rotate) 漂浮对决卡 · Button(kind:hero) sheen 出征 CTA。
 *  交互全走 action 信号：play(出征) / man(手册) / lucky(掷卦)。 */
export function buildHomeScreen(view: LobbyView): LayoutNode {
  const c = view.campaign;
  const keptFortune = view.fortune?.keptVal;
  const stars = c ? '★'.repeat(c.stars) + '☆'.repeat(Math.max(0, 3 - c.stars)) : '';

  // 花色标条（♠♥♦♣）：贴近原版 stags。
  const stags: LayoutNode = {
    type: 'Panel', id: 'home-stags', props: { bare: true }, layout: { direction: 'row', gap: 18, padding: 0, align: 'center' },
    children: [
      { type: 'Label', id: 'st-s', props: { text: '♠ 黑桃', size: 'xs', color: 'sub' } },
      { type: 'Label', id: 'st-h', props: { text: '♥ 红桃', size: 'xs', color: 'danger' } },
      { type: 'Label', id: 'st-d', props: { text: '♦ 方块', size: 'xs', color: 'warn' } },
      { type: 'Label', id: 'st-c', props: { text: '♣ 梅花', size: 'xs', color: 'ok' } },
    ],
  };

  // 照原版确切像素（非 scale·scale 会破坏比例）：.dcard 116×160 → fluid 卡填进 116 宽容器（5:7→~162 高）；
  // .duel gap 34；外层 float 垂直浮动、内层 rotate 倾斜（嵌套规避 apollo-float 盖 rotate）。
  const tiltFloat = (id: string, cardProps: Record<string, unknown>, rot: number): LayoutNode => ({
    type: 'Panel', id: `${id}-fl`, props: { bare: true }, layout: { anim: 'float', padding: 0, width: 116 },
    children: [{ type: 'PlayingCard', id, props: { ...cardProps, fluid: true } as never, layout: { rotate: rot } }],
  });
  const duel: LayoutNode = {
    type: 'Panel', id: 'home-duel', props: { bare: true }, layout: { direction: 'row', gap: 34, align: 'center', padding: 0 },
    children: [
      tiltFloat('duel-a', { rank: 'A', suit: '♠', face: 'light' }, -9),
      // 中间圆「掷」徽章：照原版 .vs 64px 金色圆币——用 CoinFlip(圆形金币·headsLabel 掷·可点掷卦)，非矩形按钮 + 流光。
      { type: 'CoinFlip', id: 'duel-roll', props: { outcome: 'heads', headsLabel: '掷', size: 64, action: 'lucky' }, layout: { anim: 'glow', sheen: true } },
      // 红牌背 backPattern:'checker'（原版 .dback i 棋盘格条纹质感）。
      tiltFloat('duel-back', { rank: 'A', suit: '♠', face: 'light', faceUp: false, back: '❖', backPattern: 'checker' }, 9),
    ],
  };

  // 绿呢牌桌（felt·对齐 Designer comp 命运牌桌）：标题左上 + 花色标右上 / 中部今日卦象+漂浮对决牌 / 底部出征 CTA+手册。
  // justify:between 三段分布（头顶/中央/底），消除原先全居中导致的标题居中偏差。
  const felt: LayoutNode = {
    type: 'Panel', id: 'home-felt', props: { bg: 'var(--felt)', vignette: true, pattern: 'stripe' },
    layout: { direction: 'column', align: 'stretch', justify: 'between', gap: 12, padding: 28, flex: 1 },
    children: [
      { type: 'Panel', id: 'home-header', props: { bare: true }, layout: { direction: 'row', align: 'start', gap: 10, padding: 0 },
        children: [
          { type: 'Panel', id: 'home-titlecol', props: { bare: true }, layout: { direction: 'column', gap: 2, flex: 1 },
            children: [
              { type: 'Label', id: 'home-title', props: { text: c ? `第 ${c.stage} 关 · ${c.battle}` : '戏牌师', size: 'xxxl', color: 'gold', bold: true, font: 'display' }, layout: { sheen: true } },
              { type: 'Label', id: 'home-sub', props: { text: c ? `执掌命运之人 · 挑战被诅咒的 ${c.boss}` : view.stageLabel, size: 'sm', color: 'sub' } },
            ] },
          stags,
        ] },
      { type: 'Panel', id: 'home-center', props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 20, padding: 0 },
        children: [
          { type: 'Button', id: 'home-fortune', props: { label: keptFortune != null ? `🎴 今日卦象 · ${keptFortune}` : '🎴 掷今日卦象', kind: 'ghost', action: 'lucky' } },
          duel,
          { type: 'Label', id: 'home-duelline', props: { text: c ? `⚔ 对决 ${c.boss} · ${c.oneLiner}` : '掷命之牌', size: 'xs', color: 'dim' } },
        ] },
      { type: 'Panel', id: 'home-bottom', props: { bare: true }, layout: { direction: 'column', align: 'center', gap: 8, padding: 0 },
        children: [
          { type: 'Button', id: 'home-play', props: { label: c ? `⚔ 出征 · 第 ${c.stage} 关` : `⚔ 出征 · ${view.rankText}`, kind: 'hero',
            sub: c ? `挑战 ${c.boss} · ${c.battle} · 难度 ${stars}` : 'DEPLOY · 单人战役 vs AI 庄家', action: 'play' }, layout: { anchor: 'play' } },
          { type: 'Button', id: 'home-man', props: { label: '📖 玩法手册', kind: 'ghost', action: 'man' } },
        ] },
    ],
  };

  // 右栏·Boss 情报 + 地煞（明牌可破）。地煞 = 满宽 Card（去掉先前的 Tooltip inline-flex 包裹·那会让卡收缩成内容宽→有长有短）。
  const fiendNodes: LayoutNode[] = (c?.fiends ?? []).map((fd, i) => ({
    type: 'Card', id: `home-fiend-${i}`, props: { title: `🎴 ${fd.name}`, sub: fd.desc, tone: 'normal' },
  }));
  const rail: LayoutNode = {
    type: 'Panel', id: 'home-rail', props: { title: `⚔ 本关 Boss · ${c?.boss ?? '—'}` },
    layout: { direction: 'column', gap: 6, padding: 16, width: 256 },
    children: [
      { type: 'Label', id: 'home-boss-diff',
        props: c ? { size: 'sm', color: 'sub', spans: [{ text: '难度 ' }, { text: '★'.repeat(c.stars), color: 'gold', bold: true }, { text: ` · ${c.oneLiner}`, color: 'sub' }] } : { text: '', size: 'sm', color: 'gold' } },
      { type: 'Label', id: 'home-fiend-h',
        props: { text: '🎴 地煞（明牌 · 公平可破）— Boss 招牌历史战术：', size: 'xs', color: 'sub' } },
      ...fiendNodes,
      { type: 'Label', id: 'home-unlock',
        props: { text: c ? `🏆 打赢 = 破其诅咒 · 通关解锁天罡 ${c.unlock}` : '', size: 'xs', color: 'gold' } },
      { type: 'Label', id: 'home-ghost',
        props: { text: '好友切磋 / 天梯 1v1 待接网络。当前 = 单人 52 战役 vs AI 庄家。', size: 'xs', color: 'dim' } },
    ],
  };

  // 天罡牌组预览条（原版 felt 下方 deckPreviewPanel）：已入组天罡 chips（名 + 牌力 + P̂）+ 编辑入口。
  const inDeck = view.tiangangs.filter((j) => j.inDeck);
  const totalPhat = inDeck.reduce((s, j) => s + (j.phat ?? 0), 0);
  const deckChips: LayoutNode[] = inDeck.length
    ? inDeck.map((j) => ({ type: 'Tag', id: `home-tg-${j.id}`,
        props: { label: `${j.icon ?? '⚡'} ${j.name}${j.power ? ' ' + '⭐'.repeat(Math.min(j.power, 5)) : ''}${j.phat != null ? ' P̂' + j.phat : ''}`, tone: 'accent' } }))
    : [{ type: 'Label', id: 'home-tg-empty', props: { text: '战库空 · 去「改造坊/牌组」选入天罡牌（≤5）', size: 'xs', color: 'dim' } }];
  // 底部天罡牌组条（对齐原版 deckPreviewPanel）：标题左 + 数量右（justify between）/ 内容(chips 或空提示) / 编辑键靠右。
  const deckCount = `${inDeck.length}/${view.deckSize ?? 12} · 出战带 ${view.deckSize ?? 12} 张${inDeck.length ? ' · 整库 P̂ ' + totalPhat : ''}`;
  const deckPreview: LayoutNode = {
    type: 'Panel', id: 'home-deckprev', props: {}, layout: { direction: 'column', gap: 8, padding: 14 },
    children: [
      { type: 'Panel', id: 'home-dp-head', props: { bare: true }, layout: { direction: 'row', align: 'center', justify: 'between' }, children: [
        { type: 'Label', id: 'home-dp-title', props: { text: `🦄 天罡牌组 · ${view.activeDeckName ?? ''}`, size: 'md', color: 'gold', bold: true } },
        { type: 'Label', id: 'home-dp-count', props: { text: deckCount, size: 'xs', color: 'sub' } },
      ] },
      { type: 'Panel', id: 'home-dp-body', props: { bare: true }, layout: { direction: 'row', gap: 6, align: 'center' }, children: deckChips },
      { type: 'Panel', id: 'home-dp-foot', props: { bare: true }, layout: { direction: 'row', justify: 'end' }, children: [
        { type: 'Button', id: 'home-editdeck', props: { label: '✏ 编辑牌组', kind: 'ghost', action: 'tab', actionArg: 'decks' } },
      ] },
    ],
  };
  const herocol: LayoutNode = {
    type: 'Panel', id: 'home-herocol', props: { bare: true }, layout: { direction: 'column', gap: 14, flex: 1 },
    children: [felt, deckPreview],
  };

  return {
    type: 'Screen', id: 'home-screen', props: { bg: GG_LOBBY_THEME.pageBg },
    layout: { direction: 'row', gap: 16, padding: 16 },
    children: [herocol, rail],
  };
}

/** 挂载主页（MVU：mountUI 一次 → 改状态走 update(buildHomeScreen(getView()))·局部 diff·不整树重挂）。返回 update/destroy。 */
export function mountHome(host: HTMLElement, getView: () => LobbyView, handlers: HandlerMap): { update: () => void; destroy: () => void } {
  const ui = mountUI(host, buildHomeScreen(getView()), handlers, GG_LOBBY_THEME);
  return { update: () => ui.update(buildHomeScreen(getView())), destroy: () => ui() };
}
