// game211 · 现代战争 RTS 数值核心（owner 2026-08-10：「推到现代战争，**没有近兵器全是远程**，
// 步兵/坦克/直升机/火箭炮……**8 个基本兵种**，**其实也不用去相克**，就是它有基础的这种对坦克对装甲的，
// 以现代战争的真实设定去搞，二战或中东战争那个技术规模」）。
//
// **纯函数**：不碰世界/物理/渲染/壁钟/裸随机 → 可无头跑几千场做平衡标定。伤害本身**无随机**。
//
// ══ 为什么不用环形相克 ══
// 上一版是 ♠→♥→♦→♣→♠ 的四循环。owner 判「不用相克」是对的——真实军事**不是环，是二维表**：
//   **武器类型 × 目标类型**。机枪打步兵无敌、打坦克挠痒；穿甲弹反过来；防空炮只对空。
// 二维表比一维环强在：每个兵种有**明确职能**（谁负责反装甲、谁负责防空、谁负责压制），
// 而不是「我克你你克他」的人造关系。玩家读一次表就懂，而且和现实直觉一致，不用背。
//
// ══ 三个目标类 × 四个弹种 ══
//   目标类 soft(步兵/无装甲) · armor(坦克/装甲车) · air(旋翼机)
//   弹种   HE(高爆/机枪/机炮) · AP(穿甲) · ATGM(反坦克导弹) · AA(防空)
//
// 由此涌现的关系全部来自真实条令，没有一条是硬编的「克制」：
//   · 步枪兵打坦克 = 8×0.20 = 1.6/发 → 200 发才打穿 ⇒ 步兵对坦克**基本无效**（真实）
//   · 机枪组打步兵 = 14×1.0，5 发解决 ⇒ 反步兵之王
//   · 反坦克组打坦克 = ATGM ×1.30，但自身 55 血、被机枪 4 发带走 ⇒ **必须有步兵掩护**（真实）
//   · 坦克打不到直升机（AP ×0）⇒ **不带防空就等着被武直点名**（真实）
//   · 火箭炮射程 42 无人能及，但装填 150 tick 且带**溅射** ⇒ 对扎堆毁灭、对散兵浪费
//     ⇒ 「别扎堆」本身成了一条战场规则，而不是 UI 提示。
/** 目标类（决定吃哪一列伤害倍率）。 */
export type TargetClass = 'soft' | 'armor' | 'air';
/** 弹种（决定吃哪一行）。 */
export type DamageType = 'he' | 'ap' | 'atgm' | 'aa';

/** 八个基本兵种（owner 点名的 步兵/坦克/直升机/火箭炮 全在内）。 */
export const UNITS = ['rifle', 'mg', 'at', 'ifv', 'mbt', 'aa', 'heli', 'mlrs'] as const;
export type UnitId = (typeof UNITS)[number];

/** 弹种 × 目标类 伤害倍率表（**平衡就是改这张表**·不改代码）。
 *  0 = 打不到（不是"伤害很低"，是根本没有交战关系——如坦克主炮无法对空）。 */
export const DMG_TABLE: Record<DamageType, Record<TargetClass, number>> = {
  //          软目标  装甲   空中
  he:   { soft: 1.00, armor: 0.20, air: 0.15 },  // 高爆/机枪/机炮：反步兵主力，对装甲挠痒，勉强能防空
  ap:   { soft: 0.40, armor: 1.00, air: 0.00 },  // 穿甲：坦克主炮，对软目标浪费，**完全无法对空**
  atgm: { soft: 0.15, armor: 1.30, air: 0.00 },  // 反坦克导弹：破甲之王，**打散兵极度浪费**（一发导弹打一个人），无法对空
  aa:   { soft: 0.25, armor: 0.15, air: 1.50 },  // 防空：只对空有意义，对地几乎无用 ⇒ 纯功能兵种
};

export interface UnitStat {
  readonly label: string;
  readonly short: string;
  readonly tint: number;
  readonly cls: TargetClass;      // 自己属于哪一类（被打时吃哪一列）
  readonly weapon: DamageType;    // 自己用什么弹（打人时吃哪一行）
  readonly hp: number;
  readonly dmg: number;
  readonly cooldown: number;      // 攻击间隔（tick）
  readonly range: number;         // 射程（世界单位）——**全部 ≥9，没有近战**
  readonly speed: number;         // 移动速度（世界单位/tick·与 Steering.speed 同口径）
  readonly cost: number;
  /** 溅射半径（>0 = 面杀伤·范围内敌人同吃伤害）。目前只有火箭炮有。 */
  readonly splash?: number;
}

/** 兵种表。**所有数值的唯一真相**——平衡只改这里，`rts-combat.test.ts` 会把矩阵打出来。 */
export const UNIT: Record<UnitId, UnitStat> = {
  // ── 步兵（soft·没装甲·便宜量大） ──
  rifle: { label: '步枪兵', short: '步', tint: 0x9fb4c8, cls: 'soft', weapon: 'he', hp: 70, dmg: 8, cooldown: 24, range: 9, speed: 0.13, cost: 8 },
  mg: { label: '机枪组', short: '机', tint: 0xd8b45a, cls: 'soft', weapon: 'he', hp: 60, dmg: 14, cooldown: 12, range: 11, speed: 0.09, cost: 14 },
  // 反坦克组：破甲极强但**极脆**（被机枪 4 发带走）→ 必须有步兵掩护，这是真实条令
  at: { label: '反坦克组', short: '反', tint: 0xc4622f, cls: 'soft', weapon: 'atgm', hp: 55, dmg: 100, cooldown: 50, range: 15, speed: 0.10, cost: 20 },
  // ── 装甲（armor·吃 AP/ATGM，抗 HE） ──
  ifv: { label: '步兵战车', short: '战', tint: 0x6f9e5c, cls: 'armor', weapon: 'he', hp: 180, dmg: 18, cooldown: 18, range: 13, speed: 0.16, cost: 30 },
  mbt: { label: '主战坦克', short: '坦', tint: 0x4e6b3c, cls: 'armor', weapon: 'ap', hp: 320, dmg: 45, cooldown: 45, range: 16, speed: 0.12, cost: 46 },
  // 防空车：对地几乎无用，但没它就被武直点名 → 纯功能位，逼出配比决策
  aa: { label: '防空车', short: '防', tint: 0x5a86c4, cls: 'armor', weapon: 'aa', hp: 140, dmg: 30, cooldown: 20, range: 20, speed: 0.14, cost: 32 },
  // ── 空中（air·只有 HE 勉强够得着 / AA 专治） ──
  heli: { label: '武装直升机', short: '直', tint: 0x8f6fd8, cls: 'air', weapon: 'atgm', hp: 120, dmg: 38, cooldown: 40, range: 18, speed: 0.28, cost: 44 },
  // ── 炮兵（射程碾压 + 溅射，但装填极慢、**卡车底盘无装甲**） ──
  // ⚠ cls 必须是 soft：自行火箭炮是卡车底盘，步兵冲上去就能端掉炮兵阵地——
  //   这条给了最便宜的步枪兵一个**真实职能**（否则它一场 1v1 都赢不了，成了纯填线料）。
  mlrs: { label: '火箭炮', short: '炮', tint: 0xb4494f, cls: 'soft', weapon: 'he', hp: 90, dmg: 60, cooldown: 150, range: 42, speed: 0.06, cost: 50, splash: 6 },
};

/** 伤害倍率（纯函数）：攻方弹种 vs 守方目标类。 */
export function damageMul(attacker: UnitId, defender: UnitId): number {
  return DMG_TABLE[UNIT[attacker].weapon][UNIT[defender].cls];
}

/** 一次攻击的最终伤害（纯函数·确定性·无随机）。0 = 打不到。 */
export function damageOf(attacker: UnitId, defender: UnitId): number {
  return UNIT[attacker].dmg * damageMul(attacker, defender);
}

/** 能否交战（纯函数）：倍率为 0 = 根本打不到（坦克对空/穿甲对空）。
 *  **索敌必须用它过滤**，否则坦克会锁住头顶的直升机站着不动挨打。 */
export function canEngage(attacker: UnitId, defender: UnitId): boolean {
  return damageMul(attacker, defender) > 0;
}

/** 打死一个目标要几发（纯函数）。打不到 → Infinity。 */
export function hitsToKill(attacker: UnitId, defender: UnitId): number {
  const d = damageOf(attacker, defender);
  return d > 0 ? Math.ceil(UNIT[defender].hp / d) : Infinity;
}

/** 击杀耗时（tick）。跨兵种比「谁先打死谁」用这个，比看单发伤害准。 */
export function ticksToKill(attacker: UnitId, defender: UnitId): number {
  return hitsToKill(attacker, defender) * UNIT[attacker].cooldown;
}

/** 一对一谁赢（纯函数·同时开火·忽略走位与射程差）。
 *  ⚠ **这个口径故意忽略射程**——射程优势要靠 `outranges` 单独看。
 *  火箭炮/防空车这种「射程碾压但对刀打不过」的兵种，只看这张表会误判。 */
export function duelWinner(a: UnitId, b: UnitId): UnitId | 'draw' {
  const ta = ticksToKill(a, b), tb = ticksToKill(b, a);
  if (ta === Infinity && tb === Infinity) return 'draw';
  if (ta < tb) return a;
  if (tb < ta) return b;
  return 'draw';
}

/** a 是否射程压制 b（纯函数）：现代战争的核心优势之一。 */
export function outranges(a: UnitId, b: UnitId): boolean {
  return UNIT[a].range > UNIT[b].range;
}

/** 某兵种打不到的目标类（纯函数·供 UI 直接标「无法交战」）。 */
export function blindTo(u: UnitId): TargetClass[] {
  const row = DMG_TABLE[UNIT[u].weapon];
  return (['soft', 'armor', 'air'] as const).filter((c) => row[c] <= 0);
}

// ══════════════════════════════════════════════════════════════
//  战场规则
// ══════════════════════════════════════════════════════════════

/** 投放配比（玩家操作之一）。 */
export type Composition = Readonly<Record<UnitId, number>>;
export const EMPTY_COMP: Composition = { rifle: 0, mg: 0, at: 0, ifv: 0, mbt: 0, aa: 0, heli: 0, mlrs: 0 };

export function compTotal(c: Composition): number {
  return UNITS.reduce((s, k) => s + (c[k] ?? 0), 0);
}

/** 按配比挑下一个投放的兵种（纯函数·**确定性轮转**·最大欠账法）。
 *  同配比每次投出的序列完全一致 → 可回放；比例收敛比随机快（不会连出五个同兵种）。 */
export function nextSpawnUnit(comp: Composition, sent: Composition): UnitId | null {
  const total = compTotal(comp);
  if (total <= 0) return null;
  const done = compTotal(sent);
  let best: UnitId | null = null;
  let bestDebt = -Infinity;
  for (const u of UNITS) {
    const want = comp[u] ?? 0;
    if (want <= 0) continue;
    const debt = ((done + 1) * want) / total - (sent[u] ?? 0);
    if (debt > bestDebt + 1e-9) { bestDebt = debt; best = u; }
  }
  return best;
}

/** 兵力资源（战场规则·投放节奏 = 玩家的第二个决策维度）。 */
export interface Supply { readonly current: number; readonly max: number; readonly regen: number }
export function regenSupply(s: Supply): Supply {
  return s.current >= s.max ? s : { ...s, current: Math.min(s.max, s.current + s.regen) };
}
export function canAfford(s: Supply, u: UnitId): boolean { return s.current >= UNIT[u].cost; }
export function paySupply(s: Supply, u: UnitId): Supply {
  const c = UNIT[u].cost;
  return s.current >= c ? { ...s, current: s.current - c } : s;
}

/** 战线（纯函数）：红方最前沿与蓝方最前沿的中点。>0 = 红方占优。 */
export function frontLine(redMaxX: number | null, blueMinX: number | null, halfX: number): number {
  return ((redMaxX ?? -halfX) + (blueMinX ?? halfX)) / 2;
}
/** 推过对方基地线即胜。 */
export function frontWinner(front: number, halfX: number, winMargin = 0.9): 'red' | 'blue' | null {
  if (front >= halfX * winMargin) return 'red';
  if (front <= -halfX * winMargin) return 'blue';
  return null;
}
