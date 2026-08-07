import { type Archetype } from './tiangang-data.js'; // 流派 id 类型（6 流派·design/12 §四）

// ── T-G6 · 流派 + 克制网（design/12 §四 · 身份 + 石头剪刀布）──
// 流派 = 由已融天罡浮现的身份；克制网 = **双 3-环** rock-paper-scissors（无唯一最优 → 看对手临场调布阵/干预）。
// 纯数据：每流派 {keyJokers, counters} 最弱 LLM 能填；detectArchetype 数已融天罡归属、archetypeMatchup 查克制——零新能力。
export interface ArchetypeSpec { id: Archetype; name: string; desc: string; keyTiangangs: string[]; counters: Archetype }
export const ARCHETYPES: ArchetypeSpec[] = [
  // 核心 3-环（`12` §四明示）：斩首 克 将领 克 铺场 克 斩首。
  { id: 'decap', name: '斩首流', desc: '擒贼擒王引溃散', keyTiangangs: ['capturektg', 'markdecap'], counters: 'general' },
  { id: 'general', name: '将领流', desc: '主将光环碾压一路', keyTiangangs: ['bannerman', 'markmorale'], counters: 'wide' },
  { id: 'wide', name: '铺场流', desc: 'go-wide 铺满三路', keyTiangangs: ['rush', 'markswarm'], counters: 'decap' },
  // 次 3-环（doc20 §二尾 印记定稿）：同 rank 克 概率·确定 克 弃一保二 克 同 rank。
  { id: 'cardtype', name: '同rank流', desc: '堆同点数凑对子/三条', keyTiangangs: ['twinblade', 'tripod', 'marksamerank'], counters: 'probability' },
  { id: 'probability', name: '概率·确定流', desc: '抬下限收方差·占优稳拿', keyTiangangs: ['ghosthand', 'bedrock', 'markodds'], counters: 'tianji' },
  { id: 'tianji', name: '弃一保二流', desc: '弃一路、集中滚两路', keyTiangangs: ['discard2', 'marktianji'], counters: 'cardtype' },
];
const ARCH_BY_ID: ReadonlyMap<Archetype, ArchetypeSpec> = new Map(ARCHETYPES.map((a) => [a.id, a]));
/** 由已融天罡浮现的主流派：数每流派 keyTiangangs 命中数，取最高（平局取 ARCHETYPES 靠前）；无命中 → null。 */
export function detectArchetype(tiangangIds: readonly string[]): ArchetypeSpec | null {
  let best: ArchetypeSpec | null = null;
  let bestN = 0;
  for (const a of ARCHETYPES) {
    const n = a.keyTiangangs.filter((k) => tiangangIds.includes(k)).length;
    if (n > bestN) { bestN = n; best = a; }
  }
  return best;
}
/** 流派克制：a 对 b = 克制 / 被克 / 中立（双 3-环，无自克）。 */
export function archetypeMatchup(a: Archetype, b: Archetype): 'counter' | 'countered' | 'neutral' {
  if (ARCH_BY_ID.get(a)?.counters === b) return 'counter';
  if (ARCH_BY_ID.get(b)?.counters === a) return 'countered';
  return 'neutral';
}

// ── T-G6 · 流派激活检测（design/12 §四.5 · "钥匙解锁招牌强度" → 闭合"选择即流派"）──
// activeArchetype = 你的**主流派**(detectArchetype 多数决)且**集齐其 keyJokers**(全融承诺) 才返回该流派 id（否则 null）。
// 游戏层(game211.tsx)用它作"招牌激活"开关：committed 玩家 → AI 反制布阵 / 流派激活提示。
// （旧 build-时招牌增益施加器 applyArchetypeActivation 随旧 effect-apply 路退役·见 git 史。）
export function activeArchetype(tiangangIds: readonly string[]): Archetype | null {
  const main = detectArchetype(tiangangIds); // 多数决主流派
  if (!main || main.keyTiangangs.length === 0) return null;
  return main.keyTiangangs.every((k) => tiangangIds.includes(k)) ? main.id : null; // 集齐主流派 keyJokers 才质变
}
