// Game G · 掷命特写视图构建（战力明细/额外效果）—— turn-combat ClashEvent → turn-battle-screen TurnClashView。
// 纯函数·只读 ev + 注入的 tgName/inlays，把点数/经营/天罡/士气逐行明细 + 平局裁定/战胜硬币预告如实透出。不依赖 mount() 运行态。
import { cardFavorIndex, DIZHI_TIER_NM, DIZHI_INLAY_FAVOR, type InlayEntry } from './index.js';
import { P_MAX } from './clash-resolve.js';
import { type ClashEvent, type ClashCard } from './combat-types.js';
import { type TurnClashView, type TurnClashCardView } from './turn-battle-screen.js';

const SUITNAME: Record<string, string> = { s: '黑桃', h: '红桃', d: '方块', c: '梅花' };

// 战力逐行明细（单一真相·owner 2026-06-21 ④ + 2026-06-29 ⑥）：掷命特写 与 场上兵 hover 共用此格式器。
// owner 2026-06-29「按基础牌·加成都要清晰·别复杂」：基线 favor 改成牌点等价(freshSave)→ 不养成的牌 buff≈0、战斗就只显「点数」。
//   故 buff 只在玩家**真养成/附魔/卦象**或 Boss**关卡难度偏置**时才出现，按来源明标（不再有凭空「养成牌力 favor」黑盒）。
// 天罡总计 + 逐张溯源；士气标主将坐镇/溃散；地煞隘口固守。末行对齐 pEff（封顶 P_MAX 截断 / 擎天倍率差额）→ 明细恰好加到＝战力。
export function powerRows(c: ClashCard, isMine: boolean, tgName: (id: string) => string = (id) => id, inlays?: Record<string, InlayEntry[]>): [string, number][] {
  const r: [string, number][] = [['点数 · 牌面基础（军衔=点数）', c.points]];
  if (c.buff !== 0) {
    const inl = isMine && inlays ? (inlays[String(cardFavorIndex(c.rank + c.suit))] ?? []) : []; // 这张牌真镶过的地支（没镶=空）
    const label = isMine
      ? (inl.length ? `地支附魔（你镶的：${inl.map((e) => `${e.b}${DIZHI_TIER_NM[e.t]}+${DIZHI_INLAY_FAVOR[e.t]}`).join('·')}）` : '今日卦象 / 养成加成')
      : 'Boss 牌力偏置（关卡难度 · 明牌）'; // 敌方非养成黑盒·标成关卡难度偏置（清晰）
    r.push([label, c.buff]);
  }
  if (c.tengang !== 0 || (c.tgBreak?.length ?? 0) > 0) {
    r.push(['天罡 · 法术合计', c.tengang]);
    for (const [id, amt] of c.tgBreak ?? []) r.push(['　└ ' + tgName(id), amt]);
  }
  if (c.morale !== 0) r.push([c.morale > 0 ? '士气 · 主将坐镇' : '士气 · 主将亡·溃散', c.morale]);
  if (c.nearDef) r.push(['地煞 · 隘口固守', c.nearDef]); // 温泉关守军贴家 +战力（owner 2026-06-21）
  if (c.phalanx) r.push(['地煞 · 斯巴达方阵（结阵）', c.phalanx]); // 每兵按自身相邻友兵数 +战力（owner 2026-07-03·改逻辑为真·每兵加战力·点谁都看得到）
  if (c.dishaEdge) r.push(['地煞 · 招牌气势', c.dishaEdge]); // owner 2026-07-01 确定制：Boss 招牌战术折成确定战力（明牌·进拆解·不暗改）
  if (c.wins) { // 连胜对折（owner 2026-07-01）：每胜战力 ×0.5 → 把削减的战力值写清楚（幸存者头顶同款）
    const preHalve = r.reduce((s, [label, n]) => s + (label.startsWith('　') ? 0 : n), 0);
    const after = Math.floor(preHalve * Math.pow(0.5, c.wins));
    r.push([`战损 · 疲劳（连胜 ${c.wins} 场 · 战力对折 −50%）`, after - preHalve]);
  }
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
  if (ev.tie) extras.push(ev.tie === 'power' ? '⚖ 掷平 → 战力高者胜' : ev.tie === 'points' ? '⚖ 掷平·战力相等 → 点数大者胜' : ev.tie === 'stamina' ? '⚖ 掷平·战力点数皆同 → 续航高者胜' : '⚖ 掷平·三者全同 → 先手判 Boss');
  // v2（owner 2026-06-29）：胜者留场续战 + 每胜疲劳战损（累减战力·弱兵车轮能磨强兵）；连胜满则光荣回库 + 全额返还泉水。
  const w = ev.aWins ? ev.a : ev.b; const wn = SUITNAME[lc2(w.suit)] + w.rank;
  if (ev.warLoss != null && ev.warLoss > 0) {
    const cut = w.pEff - Math.floor(w.pEff * (1 - ev.warLoss)); // 本场对折削减的战力（写清「扣了多少」·owner 2026-07-01）
    if (ev.winStays === false) extras.push(`⚔ ${wn} 达成 ${ev.winStreak ?? ''} 连胜 → 光荣回库 + 全额返还泉水（重抽出场满血）`);
    else extras.push(`⚔ ${wn} 战胜（第 ${ev.winStreak ?? 1} 连胜）→ 疲劳战损：战力对折 −${cut}（−${Math.round(ev.warLoss * 100)}%）· 留场续战·越打越弱`);
  }
  return {
    laneName: ['上路', '中路', '下路'][ev.lane] ?? '路',
    mine: cardv(ev.a, ev.aWins), foe: cardv(ev.b, !ev.aWins, ev.lastStand), // foe(=敌主将)死战不退 → 特写改显"死战不退"而非误导的"阵亡"
    oddsMine: Math.round(ev.winrate * 100), rollPct: Math.round(ev.roll * 100),
    rollMine: ev.rollA, rollFoe: ev.rollB, // 各自掷战力骰的掷值（owner 2026-07-01·特写两骰同屏揭晓）
    bonusMine: rows(ev.a, true), bonusFoe: rows(ev.b, false),
    pEffMine: ev.a.pEff, pEffFoe: ev.b.pEff, extras,
  };
}
