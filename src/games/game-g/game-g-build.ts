// Game G · 出战编排纯函数（favor→战力桥 + 牌库构筑 + 天罡聚合 + 洗牌/阵型/三选一）。
// 全是确定性纯函数，不依赖 mount() 运行态；game-g.tsx 装配牌库时调用，部分(buildPickDeck/bossHeroCard/
// aggregateTengang/tengangFxOf)还经 game-g.tsx 再导出供 deck-wiring/live-combat 测试用。
import { FORMATION_PRESETS, PRESET_NAMES, TIANGANG_BY_ID, cardFavorIndex, rankOfCardId, deployCost, heroCardByName, type ArmyCard } from './index.js';
import { cardPoints, P_MAX } from './clash-resolve.js';
import { NO_TENGANG, type TengangFx } from './live-combat.js';
import { type PokerCard } from './turn-combat.js';

export const clampFavor = (f: number): number => Math.max(5, Math.min(95, Math.round(f)));
export const avg = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
// 牌组均 favor → 全军 favor 偏置（改造越多越强）。
export const myBias = (deck: number[]): number => avg(deck) - 50;
// 布阵 → 名称（命中预设则用预设名，否则"自定义 x/y/z"），用于战后揭晓敌阵。
export function describeFormation(off: number[]): string {
  for (const n of PRESET_NAMES) {
    const p = FORMATION_PRESETS[n].officers;
    if (p[0] === off[0] && p[1] === off[1] && p[2] === off[2]) return n;
  }
  return `自定义 ${off[0]}/${off[1]}/${off[2]}`;
}
// 场间三选一：从增益池随机取 3 张（Fisher–Yates；元层奖励，非确定性 gameplay，用 Math.random 即可）。
export function pick3<T>(xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 3);
}

// favor → 战力（公平骨架 doc19）：rank→points(fair) 走 cardPoints；该牌全部强度经 favor 折算进 buff，使 P_eff=clamp(favorToP(favor))
//   单调随 favor（军衔已在 favor 里）——buff 抵消 cardPoints 噪声，让既有 favor 经济无缝驱动 pairwise 对决核。
export const FAVOR_LO = 5, FAVOR_HI = 95; // favor 钳域（blueprint clampFavor）
export const favorToP = (favor: number): number => ((Math.max(FAVOR_LO, Math.min(FAVOR_HI, favor)) - FAVOR_LO) / (FAVOR_HI - FAVOR_LO)) * P_MAX; // favor → P_eff 空间 [0,30]
export const cardRank = (c: ArmyCard): string => (c.rank === 'JOKER' ? '★' : c.rank); // 显示 + cardPoints/cardStamina 同口径（★≡JOKER：点数15/续航3）
// 契约A·甲读（owner 2026-06-21 #15/#16）：把你配的 pokerPicks(卡 id) 折成回合制战斗牌库——每张挂自己的
// effectiveDeckFavors(base favor + 逐张地支附魔)→战力 buff，suit/rank 取自卡 id，主将=favor 最高那张(留士气)。
// 纯函数·确定性（同 picks+effFav → 同牌库），让大厅配的牌(含附魔)真正按 ID 进场，不再被揉成平均 bias。
export function buildPickDeck(picks: readonly string[], effFav: readonly number[]): PokerCard[] {
  const favOf = (id: string): number => { const fi = cardFavorIndex(id); return fi >= 0 ? (effFav[fi] ?? 50) : 50; };
  const genId = picks.length ? picks.reduce((best, id) => (favOf(id) > favOf(best) ? id : best), picks[0]) : '';
  return picks.map((id) => { const rk = rankOfCardId(id); return { kind: 'poker', id, rank: rk, suit: id.slice(-1), general: id === genId, buff: Math.round(favorToP(favOf(id)) - cardPoints(rk)), cost: deployCost(rk) }; });
}
// Boss 主将牌 = 本关英雄那张牌（owner 2026-06-21·传奇主将·强化）：用英雄谱 rank/suit + 强 favor(随关卡 bias 略升)
// → 一张强力主将 PokerCard(general:true·点数虽弱但战力高)。heroName=关卡 heroId(Boss 名)；查无 → null。纯函数·可测。
export const SUIT_SYM2LET: Record<string, string> = { '♠': 'S', '♥': 'H', '♦': 'D', '♣': 'C' };
export function bossHeroCard(heroName: string, enemyBias: number): PokerCard | null {
  const heroDef = heroCardByName(heroName);
  if (!heroDef) return null;
  const hr = heroDef.rank === 'JOKER' ? '★' : heroDef.rank;
  const hFav = Math.min(FAVOR_HI, 65 + enemyBias); // 强 favor·随 bias 略升（细调留给重跑仿真）
  return { kind: 'poker', id: `boss-hero-${heroDef.id}`, rank: hr, suit: SUIT_SYM2LET[heroDef.suit] ?? 'S', general: true, buff: Math.round(favorToP(hFav) - cardPoints(hr)), cost: deployCost(hr) };
}
// A-JOKER：已施天罡(契约②·玩家施法集) → 聚合扁平战斗修正（live-combat 钩子读·只己方）。读 GAME_G_TIANGANGS 的 {kind,params}（契约③）。
// 一种牌算一次（不叠）。v1 实装 6 kind；v2 待接（背水 reroll / 顺子阵 straight / 擒王 decapCost·依干预 / tempo / lane 一次性 / siege / arcane 印记 / 战潮 pulse·CR 已取代被动涌牌）—— 未实装 kind 返回零修正、不崩。
export function aggregateTengang(castIds: readonly string[]): TengangFx {
  const cards: { kind: string; params?: Record<string, unknown> }[] = [];
  for (const id of castIds) { const j = TIANGANG_BY_ID.get(id); if (j) cards.push({ kind: j.kind, params: j.params as Record<string, unknown> | undefined }); }
  return tengangFxOf(cards);
}
// 纯映射（注入卡集·不依赖 blueprint 数据 → 可用合成卡单测新 op，先于乙上架数据）。op→效果 = 甲侧契约（乙照此编码 doc20 §二）：
//   odds: add→pEffAdd · winFloor→% · kHard(灌铅骰)→logistic 变硬 · noUpset(铁骰)→占优免爆冷 ｜ power: add(+filter countLE3|sameSuit|无=全军)
//   combo: pair(对子诀·≥2同点) / trips(鼎立·≥3同点) ｜ morale: leaderBuff ｜ stamina: stamPlus(全军) · +filter:faces(老兵)→人头牌 ｜ draw: handMax
export function tengangFxOf(cards: Iterable<{ kind: string; params?: Record<string, unknown> }>): TengangFx {
  const fx: TengangFx = { ...NO_TENGANG };
  for (const j of cards) {
    const p = j.params; if (!p) continue;
    const v = typeof p.value === 'number' ? p.value : 0; const bonus = typeof p.bonus === 'number' ? p.bonus : 0;
    if (j.kind === 'odds') { if (p.op === 'add') fx.pEffAdd += v; else if (p.op === 'winFloor') fx.winFloor += v / 100; else if (p.op === 'kHard') fx.kHard += v; else if (p.op === 'noUpset') fx.noUpset += 1; }
    else if (j.kind === 'power') {
      if (p.op === 'mul' && p.scope === 'highestRank') fx.powerMulHighest = Math.max(fx.powerMulHighest, v); // 擎天：全军最强单张 ×mul（一种算一次·取最大·非叠加）
      else if (p.op === 'add') { if (p.filter === 'countLE3') fx.powerLE3 += v; else if (p.filter === 'sameSuit') fx.powerSameSuit += v; else if (p.scope === 'front') fx.powerFront += v; else fx.powerAll += v; } // 寡兵 / 同花魁 / 锋矢(front) / 虎符(全军·scope:all 或无)
    }
    else if (j.kind === 'combo') { if (p.op === 'pair') fx.comboPair += bonus; else if (p.op === 'trips') fx.comboTrips += bonus; }
    else if (j.kind === 'morale') { if (p.op === 'leaderBuff') fx.moraleLeader += v; else if (p.op === 'revenge') fx.revenge += v; else if (p.op === 'noRout') fx.noRout = 1; } // 旗手/哀兵/督战
    else if (j.kind === 'stamina') { if (p.op === 'stamPlus') { if (p.filter === 'faces') fx.stamFaces += v; else fx.stamPlus += v; } else if (p.op === 'relay') fx.relay += v; } // 老兵/不屈/薪火
    else if (j.kind === 'draw') { if (p.op === 'handMax') fx.handMaxAdd += v; else if (p.op === 'onPlay') fx.onPlay += v; else if (p.op === 'clashElixir') fx.clashElixir += v; } // 广纳/川流/战潮
    else if (j.kind === 'siege') { if (p.op === 'defend') fx.siegeDefend += v; else if (p.op === 'chipMore') fx.siegeChip += v; } // 死守/攻城锤
  }
  return fx;
}

// 确定性洗牌（mulberry32·抽序可回放·不破 outcome-first）—— 回合制牌库铺牌用。
export function seededShuffleArr<T>(xs: T[], seed: number): T[] {
  const arr = [...xs]; let t = seed >>> 0;
  const rnd = (): number => { t += 0x6d2b79f5; let x = t; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61); return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}
