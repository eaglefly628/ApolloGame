// campaign-screen.ts —— Game G 大厅「战役进度」屏·数据驱动 pilot（Step B·接力 home-screen 范式）。
//
// 用引擎 Apollo UI 层（`LayoutNode` 纯数据 + `mountUI` 解释器 + `GG_LOBBY_THEME` 换皮令牌）重写战役进度屏。
// 红线（同 home-screen / game-i）：本文件**只产数据 + 接信号**，不写一行 HTML/DOM 模板。
//
// 忠实对标 live 大厅 `lobby-screen.ts` 的 `campaignSection`：逐关卡片（锁/当前/已通关/可重打）+ 难度星 +
// 通关解锁天罡 + Boss 开场/劣势/败北对白 + 地煞（明牌·含数值行）+ 当前关「出征」CTA（action: 'play'）。
// 诚实边界：原稿卡片的描边/渐变 flourish 由 GG_LOBBY_THEME 令牌近似；内容/交互/换皮全部数据化。
import { mountUI } from '@ui/components/index.js';
import type { LayoutNode, HandlerMap } from '@ui/components/index.js';
import { GG_LOBBY_THEME } from './ui-theme.js';
import { textureOverrideUri } from './art-textures.js'; // 背景板槽（07-14 全面台账化·真图=cover·无=主题色）
import { STAGE_CAMPAIGN, type StageCampaign } from './campaign-data.js';
import { stageDisha } from './disha.js';
import { dishaNumberLine } from './lobby-types.js';
import type { LobbyView } from './lobby-types.js';

const stars = (n: number): string => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));

/** 单关卡片 → LayoutNode（纯数据）。locked 只露解锁提示；否则露战役背景 / Boss 对白 / 地煞 / 当前关出征 CTA。 */
function buildStageCard(c: StageCampaign, cur: number, maxReached: number): LayoutNode {
  const locked = c.stage > maxReached;
  const isCur = c.stage === cur;
  const cleared = c.stage < cur;
  const badge = locked ? '🔒 未解锁' : isCur ? '▶ 当前' : cleared ? '✓ 已通关' : '可重打';
  const badgeTone = isCur ? 'warn' : cleared ? 'ok' : 'dim';

  const children: LayoutNode[] = [
    { type: 'Label', id: `camp-${c.stage}-h`,
      props: { text: `第 ${c.stage} 关 · ${c.battle}　vs ${c.boss}`, size: 'lg', color: locked ? 'dim' : 'gold', bold: true } },
    { type: 'Badge', id: `camp-${c.stage}-badge`, props: { text: badge, tone: badgeTone } },
    { type: 'Label', id: `camp-${c.stage}-diff`,
      props: { text: `难度 ${stars(c.stars)}　·　通关解锁天罡 ${c.unlock}`, size: 'md', color: 'gold' } },
  ];

  if (locked) {
    children.push({ type: 'Label', id: `camp-${c.stage}-lock`,
      props: { text: `通关第 ${c.stage - 1} 关后解封这一缕英雄之魂。`, size: 'sm', color: 'dim' } });
    return { type: 'Card', id: `camp-${c.stage}`, props: { tone: 'locked' },
      layout: { direction: 'column', gap: 6, padding: 14 }, children };
  }

  children.push({ type: 'Label', id: `camp-${c.stage}-intro`,
    props: { text: c.intro ?? c.oneLiner, size: 'md', color: 'text' } });
  if (c.bossLines) {
    children.push(
      { type: 'Label', id: `camp-${c.stage}-bl-open`, props: { text: `🗣️ 开场「${c.bossLines.open}」`, size: 'md', color: 'sub' } },
      { type: 'Label', id: `camp-${c.stage}-bl-mid`, props: { text: `⚔️ 劣势「${c.bossLines.mid}」`, size: 'md', color: 'sub' } },
      { type: 'Label', id: `camp-${c.stage}-bl-lose`, props: { text: `💀 败北「${c.bossLines.lose}」`, size: 'md', color: 'sub' } },
    );
  }
  children.push({ type: 'Label', id: `camp-${c.stage}-fh`,
    props: { text: '🎴 地煞（明牌 · 公平可破）', size: 'md', color: 'sub' } });
  const cDisha = stageDisha(c.stage);
  // 3 地煞 = Boss 3 技能：3 竖列 grid（owner「不要 3 横排·竖三列·细节写全」），非逐行堆叠。
  const fiendCards: LayoutNode[] = c.fiends.map((f, i) => {
    const nums = dishaNumberLine(cDisha[i] ?? '');
    return { type: 'Card', id: `camp-${c.stage}-fiend-${i}`,
      props: { title: `🎴 ${f.name}`, sub: nums ? `${f.desc} · 📊 ${nums}` : f.desc, tone: 'normal' } };
  });
  children.push({ type: 'Panel', id: `camp-${c.stage}-fiends`, props: { bare: true }, layout: { direction: 'grid', cols: 3, gap: 8 }, children: fiendCards });
  // 明牌 counter-pick 情报（boss-config「核心乐趣」）：牌组主题 + ≤5 明牌天罡 + 克制提示。
  if (c.deckTheme) children.push({ type: 'Label', id: `camp-${c.stage}-theme`,
    props: { size: 13, color: 'sub', spans: [{ text: '🃏 Boss 牌组：' }, { text: c.deckTheme, color: 'text' }] } });
  if (c.bossTiangang?.length) children.push({ type: 'Label', id: `camp-${c.stage}-tg`,
    props: { size: 13, color: 'sub', spans: [{ text: '⚡ 明牌天罡（counter-pick 靶）：' }, { text: c.bossTiangang.join(' · '), color: 'gold', bold: true }] } });
  if (c.counterTip) children.push({ type: 'Label', id: `camp-${c.stage}-counter`,
    props: { size: 13, color: 'ok', spans: [{ text: '🎯 克制：', bold: true }, { text: c.counterTip }] } });
  if (isCur) {
    children.push({ type: 'Button', id: `camp-${c.stage}-play`,
      props: { label: `⚔ 出征 · 第 ${c.stage} 关`, kind: 'primary', action: 'play' } });
  }

  return { type: 'Card', id: `camp-${c.stage}`, props: { tone: isCur ? 'accent' : 'normal' },
    layout: { direction: 'column', gap: 6, padding: 14 }, children };
}

/** 战役进度屏内容 → LayoutNode（纯数据）。view 给当前关(campaign.stage)与已抵达最高关(campaignMax) → 锁/通关判定。 */
export function buildCampaignScreen(view: LobbyView): LayoutNode {
  const cur = view.campaign?.stage ?? 1;
  const maxReached = view.campaignMax ?? cur;
  const cards = STAGE_CAMPAIGN.map((c) => buildStageCard(c, cur, maxReached));

  const list: LayoutNode = {
    type: 'Panel', id: 'camp-list',
    props: { title: `⚔️ 命运之战 · 战役进度 · 第 ${cur} / ${STAGE_CAMPAIGN.length} 关`, scroll: true },
    layout: { direction: 'column', gap: 12, padding: 16 },
    children: [
      { type: 'Label', id: 'camp-blurb',
        props: { text: '五十二位被诅咒的名将，每一关是一位英雄的成名之战。打赢 = 破其诅咒、收魂入麾。', size: 'md', color: 'sub' } },
      ...cards,
      { type: 'Label', id: 'camp-foot',
        props: { text: '🔮 关 6–52（孙武 · 成吉思汗 · 汉尼拔……）战役背景与 Boss 对白已入库，随章节逐步开放。', size: 'sm', color: 'dim' } },
    ],
  };

  return {
    type: 'Screen', id: 'campaign-screen',
    props: {
      bg: GG_LOBBY_THEME.pageBg,
      ...(textureOverrideUri('game-g/tex/campaign-backdrop') ? { image: textureOverrideUri('game-g/tex/campaign-backdrop')! } : {}),
    },
    layout: { direction: 'column', padding: 16 },
    children: [list],
  };
}

/** 挂载战役进度屏（MVU：mountUI 一次 → 改状态走 update(buildCampaignScreen(getView()))·局部 diff·不整树重挂）。 */
export function mountCampaign(host: HTMLElement, getView: () => LobbyView, handlers: HandlerMap): { update: () => void; destroy: () => void } {
  const ui = mountUI(host, buildCampaignScreen(getView()), handlers, GG_LOBBY_THEME);
  return { update: () => ui.update(buildCampaignScreen(getView())), destroy: () => ui() };
}
