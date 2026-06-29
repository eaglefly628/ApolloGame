// Game G · 掷命特写视图构建（战力明细/额外效果）—— turn-combat ClashEvent → turn-battle-screen TurnClashView。
// 纯函数·只读 ev + 注入的 tgName/inlays，把点数/经营/天罡/士气逐行明细 + 平局裁定/战胜硬币预告如实透出。不依赖 mount() 运行态。
import { cardFavorIndex, DIZHI_TIER_NM, DIZHI_INLAY_FAVOR, type InlayEntry } from './index.js';
import { P_MAX } from './clash-resolve.js';
import { type ClashEvent, type ClashCard } from './combat-types.js';
import { type TurnClashView, type TurnClashCardView } from './turn-battle-screen.js';

const SUITNAME: Record<string, string> = { s: '黑桃', h: '红桃', d: '方块', c: '梅花' };

// 战力逐行明细（单一真相·owner 2026-06-21 ④ + 2026-06-29 ⑥）：掷命特写 与 场上兵 hover 共用此格式器。
// owner 2026-06-29 修「精英改造数值来源不明」：buff = favorToP(favor)−点数 = 这张牌**军衔品阶自带**的高于牌点的战力
//   （强牌天生战力＞牌点·非玩家改造！），故标「品阶底力（军衔卡面自带）」消歧；若玩家**真镶过地支**才追标「+ 地支附魔(逐源)」。
// 天罡总计 + 逐张溯源；士气标主将坐镇/溃散；地煞隘口固守。末行对齐 pEff（封顶 P_MAX 截断 / 擎天倍率差额）→ 明细恰好加到＝战力。
export function powerRows(c: ClashCard, isMine: boolean, tgName: (id: string) => string = (id) => id, inlays?: Record<string, InlayEntry[]>): [string, number][] {
  const r: [string, number][] = [['点数 · 牌面基础', c.points]];
  if (c.buff !== 0) {
    const inl = isMine && inlays ? (inlays[String(cardFavorIndex(c.rank + c.suit))] ?? []) : []; // 这张牌真镶过的地支（没镶=空）
    const label = inl.length
      ? `品阶底力（军衔自带）+ 地支附魔：${inl.map((e) => `${e.b}${DIZHI_TIER_NM[e.t]}+${DIZHI_INLAY_FAVOR[e.t]}`).join('·')}` // 镶过 → 标明哪几张地支
      : '品阶底力（军衔卡面自带·非改造）'; // 没镶 → 明示是牌本身品阶·不是你改造的
    r.push([label, c.buff]);
  }
  if (c.tengang !== 0 || (c.tgBreak?.length ?? 0) > 0) {
    r.push(['天罡 · 法术合计', c.tengang]);
    for (const [id, amt] of c.tgBreak ?? []) r.push(['　└ ' + tgName(id), amt]);
  }
  if (c.morale !== 0) r.push([c.morale > 0 ? '士气 · 主将坐镇' : '士气 · 主将亡·溃散', c.morale]);
  if (c.nearDef) r.push(['地煞 · 隘口固守', c.nearDef]); // 温泉关守军贴家 +战力（owner 2026-06-21）
  const sum = r.reduce((s, [label, n]) => s + (label.startsWith('　') ? 0 : n), 0);
  if (c.pEff !== sum) r.push(c.pEff < sum ? [`　战力上限 · 封顶 ${P_MAX}（超出截断）`, c.pEff - sum] : ['　擎天 · 主将战力倍率', c.pEff - sum]);
  return r;
}
// turn-combat 掷命事件 → 回合制特写视图（doc24 战斗屏·点数/经营/天罡/士气 明细如实透出）。
export function clashToTurnView(ev: ClashEvent, tgName: (id: string) => string = (id) => id, inlays?: Record<string, InlayEntry[]>): TurnClashView {
  const lc2 = (s: string): 's' | 'h' | 'd' | 'c' => s.toLowerCase() as 's' | 'h' | 'd' | 'c';
  const cardv = (c: ClashEvent['a'], won: boolean, lastStand = false): TurnClashCardView => ({ rank: c.rank, suit: lc2(c.suit), name: SUITNAME[lc2(c.suit)] + c.rank, won, lastStand });
  // 明细逐行 + 原因（owner 2026-06-21）：抽出至 powerRows（与场上兵 hover 共用·单一真相 ④/⑥）。
  const rows = (c: ClashEvent['a'], isMine: boolean): [string, number][] => powerRows(c, isMine, tgName, inlays);
  // 额外效果（owner 2026-06-21「还有额外的效果」）：非数值、却左右这场胜负的特殊裁定——平局如何裁定 + 战胜硬币（只预告·不剧透）。
  const extras: string[] = [];
  if (ev.tie) extras.push(ev.tie === 'points' ? '⚖ 战力相等 → 点数大者胜' : ev.tie === 'stamina' ? '⚖ 战力·点数皆同 → 续航高者胜' : '⚖ 三者全同 → 重掷定生死');
  // 战胜硬币只**预告**「待掷」·绝不预先公布结果（owner 2026-06-21：要仪式感·投掷后才显示去留）；人面=留场/字面=回库由 coin-flip 浮层亲掷揭晓。
  const w = ev.aWins ? ev.a : ev.b; const wn = SUITNAME[lc2(w.suit)] + w.rank;
  extras.push(`🪙 ${wn} 战胜 → 待亲掷硬币定去留（人面 = 留场续战 / 字面 = 回牌库 + 全额返还源泉）`);
  return {
    laneName: ['上路', '中路', '下路'][ev.lane] ?? '路',
    mine: cardv(ev.a, ev.aWins), foe: cardv(ev.b, !ev.aWins, ev.lastStand), // foe(=敌主将)死战不退 → 特写改显"死战不退"而非误导的"阵亡"
    oddsMine: Math.round(ev.winrate * 100), rollPct: Math.round(ev.roll * 100),
    bonusMine: rows(ev.a, true), bonusFoe: rows(ev.b, false),
    pEffMine: ev.a.pEff, pEffFoe: ev.b.pEff, extras,
  };
}
