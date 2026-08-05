import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase, type Component, type EntityId, type IWorld } from '@engine/core/types.js';
import type { ResourceModify, Signal } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  matrix-duel —— 「同时决策 × 收益矩阵」结算解释器（REQ-MATRIXDUEL·Lead 裁决 2026-08-04）。
//
//  一句话：两边同时暗出一手 → 齐了就查一张**纯数据判定表**定胜负 → 发具名 Signal + 写 ResourceModify
//  → 清双方 intent。猜拳全变体（含蜥蜴斯波克）、田忌赛马、押注对决、兵种相克战棋同吃一份表。
//
//  为什么不能用现有件重组（Lead 已按核心规则走过「能否现有能力表达」）：
//    `ConditionExpr` 的 id 是**静态**的，表达不了「按本回合两侧出招动态查表」。三手可以硬写 9 条
//    t2-event-when 规则，但 ①遗物**运行时改写**判定表、②遗物**增设第四手**（3×3→4×4）静态规则集
//    表达不了——放弃它等于放弃这类作品的签名机制。故下沉为解释器型 capability（同 t3-dialogue 范式）。
//
//  边界（防加宽·Lead 钉死）：**不含** AI 策略选招（t2-event-when + t2-weighted-spawn 重组）、
//    **不含**手牌（t2-card-pile）、**不含**押注（t2-craft-recipe + t2-modifier-stack）。本件只做
//    「查表定胜负 + 按表结算 + 清 intent」这一格。
//
//  ── 数据 ────────────────────────────────────────────────────────
//    DuelMatrix{ throws[], beats{}, payoff{}, tie{}, patches[] }  挂在「对局」实体上（一场一份）
//    DuelIntent{ throw }                                          挂在**双方实体**上（本回合出哪一手）
//    DuelOutcome{ … }                                             本件内部结算记录（Update 产·Commit 播报后消费）
//  血量按 **local** 寻址（两侧各挂一份同 id 的 Resource，各扣各的）；附带效果按 **global** id 路由，
//  一效果一个瞬时载体实体（Update 建 → 当拍 resource-apply 消费 → Commit 播报后销毁，零跨拍状态）。
//  补丁三闭集（对局开始按**书写序**确定性套用·纯函数 fold·无隐藏缓存态）：
//    { kind:'beats' }      改克制关系（反律石板：石↔布 反转）
//    { kind:'payoff' }     改收益（剪伤害翻倍 / 平局改为双方回血 = tie.selfDamage 取负）
//    { kind:'add-throw' }  增设一手（第四指·空手：对任何手皆平 = beats:[] + beatenBy:[]）
//
//  ── 落盘门（Lead 附加②）─────────────────────────────────────────
//  未知补丁类型 / 补丁引用不存在的手 / beats·payoff 表残缺 / 互克矛盾 / effects 越权改 hpResource
//  → **装载期报错拒收**（`validateDuelMatrix` 说人话点名），运行期解析同一把尺子硬抛，**绝不静默跳过**。
//  静默跳过一条坏补丁 = 对局规则与作者意图不符却照跑，是这类查表机制最难查的一类 bug。
//
//  ── 定序（Lead 附加①·R10 范式·已实测）───────────────────────────
//  拆成两个系统，因为两条约束**在同一相位里可证成环**：
//    (a) 产 ResourceModify 必须排在 `resource-apply` **之前**（当拍扣血生效）；
//    (b) 发 Signal 必须排在 `event-when` **之后**（它每拍开头 query('Signal') 全局清扫，排它前面
//        自己发的信号当拍就被抹掉·同 keybind/clickable/timeline 纪律）。
//  而组件拓扑里已有 `resource-apply →(Resource) event-when` 一条边，于是
//  resource-apply → event-when →(a 的 runsAfter) 本系统 →(ResourceModify) resource-apply = 真环
//  （实测：topologicalSort 抛 Circular dependency）。解法 = 把「播报」拆到 Commit 相位：
//    · `matrix-duel`（Update·runsBefore resource-apply）：查表结算 → 写 ResourceModify + DuelOutcome + 清 intent
//    · `matrix-duel-announce`（Commit·runsBefore effect-apply）：读 DuelOutcome → 发具名 Signal
//  实测落序：`matrix-duel → resource-apply → event-when → matrix-duel-announce → effect-apply`
//  ——扣血当拍生效、event-when 当拍就能读到新血量判死亡、信号当拍被 effect-apply 消费，三者零延迟。
//  信号的清理白吃 event-when 下一拍的全局清扫（Update 早于 Commit），本件不留任何跨拍状态。
//
//  确定性：纯整数查表 + 补丁按书写序 fold；实体按 id 升序遍历；无 Math.random / 无浮点分支 / 无墙钟。
// ═══════════════════════════════════════════════════════════════

/** 一「手」的 id（rock/paper/scissors/void…，纯数据字符串，闭集由 DuelMatrix.throws 定义）。 */
export type DuelThrowId = string;

/** 附带效果：按 Resource id **全局路由**加减一个资源（洞察点 / 拳票 / 计数器…）。 */
export interface DuelEffect {
  resource: string; // 目标 Resource 的 id（全局唯一；**不得**是 hpResource，见落盘门）
  amount: number; // 增减量（负 = 扣）
}

/** 某一手的收益（胜负两侧各一项，闭集两个数 + 一个具名信号 + 附带效果）。 */
export interface DuelPayoff {
  damage: number; // 出此手**取胜**时对败方造成的伤害（扣败方的 hpResource）
  selfDamageOnLose?: number; // 出此手**判负**时出手方额外自伤（剪刀祭式高风险手；缺省 0）
  signal?: string; // 出此手取胜时在**胜方实体**上发的具名 Signal（缺省回落 DuelMatrix.winSignal）
  effects?: DuelEffect[]; // 取胜时的附带资源效果（+1 洞察 / +1 拳票…）
}

/** 平局收益。selfDamage 取负 = 双方各回血（同调式遗物用 payoff 补丁改这里）。 */
export interface DuelTie {
  selfDamage: number; // 双方各受的僵持伤（负数 = 各回血）
  signal?: string; // 平局时在**双方实体各发一份**的具名 Signal
  effects?: DuelEffect[]; // 平局的附带资源效果（全局路由，只发一次）
}

/** 判定表（基表 + 补丁 fold 后的成品，纯数据）。 */
export interface DuelTable {
  throws: DuelThrowId[];
  beats: Record<DuelThrowId, DuelThrowId[]>; // 手 → 它克制的手（每一手都要有条目，不克任何手也要显式写 []）
  payoff: Record<DuelThrowId, DuelPayoff>; // 手 → 收益（每一手都要有条目）
  tie: DuelTie;
}

/** 对局开始按序套用的数据补丁（三闭集：改克制 / 改收益 / 增维）。 */
export type DuelPatch =
  | { kind: 'beats'; throw: DuelThrowId; beats: DuelThrowId[] }
  | { kind: 'payoff'; throw?: DuelThrowId; payoff?: Partial<DuelPayoff>; tie?: Partial<DuelTie> }
  | { kind: 'add-throw'; throw: DuelThrowId; beats?: DuelThrowId[]; beatenBy?: DuelThrowId[]; payoff: DuelPayoff };

/** 补丁类型闭集（落盘门点名用）。 */
export const DUEL_PATCH_KINDS = ['beats', 'payoff', 'add-throw'] as const;

/** 一场对局的判定表（挂「对局」实体）。base 表 + patches；解析是纯函数，组件本身只读。 */
export interface DuelMatrix extends Component, DuelTable {
  readonly type: 'DuelMatrix';
  duelId?: string; // 多场对局并存时的配对键（与 DuelIntent.duelId 对齐；缺省 '' = 单场）
  hpResource: string; // 伤害扣哪个 Resource 的 id（**按侧 local 寻址**：双方各挂一份同 id 的 Resource）
  winSignal?: string; // 胜方实体上的通用信号（被 payoff[手].signal 覆盖）
  loseSignal?: string; // 败方实体上的通用信号
  resolvedSignal?: string; // 对局实体上的「本回合已结算」信号（演出 cue 用）
  patches?: DuelPatch[];
}

/** 某一侧本回合出的手（read-then-settle：结算后由本能力清除，同回合绝不二次结算）。 */
export interface DuelIntent extends Component {
  readonly type: 'DuelIntent';
  throw: DuelThrowId;
  duelId?: string; // 属于哪场对局（缺省 ''）
}

/** 本回合的结算记录（Update 产 → Commit 播报后 consume；跨相位传结果用，不留过拍）。 */
export interface DuelOutcome extends Component {
  readonly type: 'DuelOutcome';
  duelId: string;
  tie: boolean;
  sides: EntityId[]; // 两侧实体（按 id 升序）
  throws: DuelThrowId[]; // 对应两侧所出的手
  winner?: EntityId;
  loser?: EntityId;
  winThrow?: DuelThrowId;
  loseThrow?: DuelThrowId;
  /** 待播报的具名信号（每实体至多一条 —— 引擎「一实体一组件」硬约束）。 */
  emit: Array<{ entity: EntityId; signal: string; arg?: string }>;
  /** 本次结算为附带效果开的瞬时载体实体（Update 建 → resource-apply 当拍消费 → Commit 播报后销毁，不留过拍）。 */
  carriers: EntityId[];
}

// ── 落盘门：校验 + 按序 fold ─────────────────────────────────────────────────

const isFiniteNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 只覆盖「补丁里真给了值」的字段（避免 spread 把 undefined 也盖上去，抹掉基表配置）。 */
function mergeDefined<T extends object>(base: T, patch: Partial<T> | undefined): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch ?? {})) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function checkEffects(effects: DuelEffect[] | undefined, hpResource: string, at: string, issues: string[]): void {
  if (effects === undefined) return;
  if (!Array.isArray(effects)) {
    issues.push(`${at}.effects 不是数组`);
    return;
  }
  effects.forEach((e, i) => {
    if (!e || typeof e.resource !== 'string' || e.resource.length === 0) {
      issues.push(`${at}.effects[${i}] 缺 resource（要写目标 Resource 的 id）`);
      return;
    }
    if (!isFiniteNum(e.amount)) issues.push(`${at}.effects[${i}].amount 不是有限数字`);
    // effects 走**全局** id 路由，而两侧血量是同 id 的两份 Resource（靠 local 寻址区分）——
    // 让 effects 去改 hpResource 只会打中「第一个同 id 的资源」，是必错的写法，装载期直接拒收。
    if (e.resource === hpResource) {
      issues.push(
        `${at}.effects[${i}] 不能直接改血量资源 "${hpResource}"（两侧同 id 无法全局寻址）——` +
          `改伤害请用 payoff.damage / payoff.selfDamageOnLose / tie.selfDamage（tie.selfDamage 取负 = 双方回血）`,
      );
    }
  });
}

function checkPayoffShape(p: DuelPayoff | undefined, hpResource: string, at: string, issues: string[]): void {
  if (!p || typeof p !== 'object') {
    issues.push(`${at} 缺收益条目（要写 {damage:数字}）`);
    return;
  }
  if (!isFiniteNum(p.damage)) issues.push(`${at}.damage 不是有限数字`);
  if (p.selfDamageOnLose !== undefined && !isFiniteNum(p.selfDamageOnLose)) {
    issues.push(`${at}.selfDamageOnLose 不是有限数字`);
  }
  checkEffects(p.effects, hpResource, at, issues);
}

/**
 * 基表 + 补丁 → 成品表（按书写序 fold），同时收齐全部问题。
 * 补丁**逐条**在「套到此刻为止的表」上校验引用（增维补丁加进来的手，后续补丁即可引用），
 * 最后再对成品表做一次残缺 / 越界 / 互克体检。
 */
function foldDuelMatrix(m: DuelMatrix): { table: DuelTable; issues: string[] } {
  const issues: string[] = [];
  const hpResource = typeof m.hpResource === 'string' ? m.hpResource : '';
  if (hpResource.length === 0) issues.push('hpResource 未填（伤害要扣哪个 Resource 的 id）');

  // ① 拷一份基表（绝不改组件本身：解析是纯函数，每拍重算即得同一结果）
  const throws: DuelThrowId[] = Array.isArray(m.throws) ? [...m.throws] : [];
  if (throws.length === 0) issues.push('throws 为空：判定表至少要有一手');
  const seen = new Set<string>();
  for (const t of throws) {
    if (typeof t !== 'string' || t.length === 0) issues.push(`throws 里有空/非字符串的手`);
    else if (seen.has(t)) issues.push(`throws 有重复的手 "${t}"`);
    else seen.add(t);
  }
  const beats: Record<DuelThrowId, DuelThrowId[]> = {};
  for (const [k, v] of Object.entries(m.beats ?? {})) beats[k] = Array.isArray(v) ? [...v] : [];
  const payoff: Record<DuelThrowId, DuelPayoff> = {};
  for (const [k, v] of Object.entries(m.payoff ?? {})) payoff[k] = { ...v };
  let tie: DuelTie = mergeDefined({ selfDamage: 0 } as DuelTie, m.tie);

  // ② 补丁按书写序套用（每条先校引用再落表；坏补丁记问题、不落表——最终由调用方硬抛拒收）
  const patches = Array.isArray(m.patches) ? m.patches : [];
  patches.forEach((raw, i) => {
    const at = `patches[${i}]`;
    if (!raw || typeof raw !== 'object') {
      issues.push(`${at} 是空/非对象补丁`);
      return;
    }
    const p = raw as DuelPatch;
    switch (p.kind) {
      case 'beats': {
        if (!throws.includes(p.throw)) {
          issues.push(`${at}(改克制) 的手 "${p.throw}" 不在判定表里（现有：${throws.join('/') || '空'}）`);
          return;
        }
        if (!Array.isArray(p.beats)) {
          issues.push(`${at}(改克制) 的 beats 不是数组（不克任何手要显式写 []）`);
          return;
        }
        for (const b of p.beats) {
          if (!throws.includes(b)) issues.push(`${at}(改克制) 引用了不存在的手 "${b}"（现有：${throws.join('/')}）`);
          else if (b === p.throw) issues.push(`${at}(改克制) 让手 "${b}" 克制自己`);
        }
        beats[p.throw] = [...p.beats];
        return;
      }
      case 'payoff': {
        if (p.payoff === undefined && p.tie === undefined) {
          issues.push(`${at}(改收益) 既没给 payoff 也没给 tie（这条补丁什么都没改）`);
          return;
        }
        if (p.payoff !== undefined) {
          if (p.throw === undefined) {
            issues.push(`${at}(改收益) 给了 payoff 却没说改哪一手（缺 throw）`);
          } else if (!throws.includes(p.throw)) {
            issues.push(`${at}(改收益) 的手 "${p.throw}" 不在判定表里（现有：${throws.join('/') || '空'}）`);
          } else {
            payoff[p.throw] = mergeDefined(payoff[p.throw] ?? ({ damage: 0 } as DuelPayoff), p.payoff);
          }
        }
        if (p.tie !== undefined) tie = mergeDefined(tie, p.tie);
        return;
      }
      case 'add-throw': {
        if (typeof p.throw !== 'string' || p.throw.length === 0) {
          issues.push(`${at}(增维) 没给新手的 id`);
          return;
        }
        if (throws.includes(p.throw)) {
          issues.push(`${at}(增维) 的手 "${p.throw}" 已经在判定表里了（增维补丁只能加新手）`);
          return;
        }
        let ok = true;
        for (const b of p.beats ?? []) {
          if (!throws.includes(b)) {
            issues.push(`${at}(增维) 的 beats 引用了不存在的手 "${b}"（现有：${throws.join('/')}）`);
            ok = false;
          }
        }
        for (const b of p.beatenBy ?? []) {
          if (!throws.includes(b)) {
            issues.push(`${at}(增维) 的 beatenBy 引用了不存在的手 "${b}"（现有：${throws.join('/')}）`);
            ok = false;
          }
        }
        checkPayoffShape(p.payoff, hpResource, `${at}(增维).payoff`, issues);
        if (!ok) return;
        throws.push(p.throw);
        beats[p.throw] = [...(p.beats ?? [])];
        for (const b of p.beatenBy ?? []) (beats[b] ??= []).push(p.throw);
        payoff[p.throw] = { ...p.payoff };
        return;
      }
      default: {
        const kind = (raw as { kind?: unknown }).kind;
        issues.push(`${at} 是未知补丁类型 "${String(kind)}"（闭集只有：${DUEL_PATCH_KINDS.join(' / ')}）`);
        return;
      }
    }
  });

  // ③ 成品表体检：残缺 / 越界 / 自克 / 互克 / 平局收益
  const known = new Set(throws);
  for (const t of throws) {
    const row = beats[t];
    if (!Array.isArray(row)) {
      issues.push(`beats 表残缺：手 "${t}" 没有 beats 条目（不克任何手也要显式写 []）`);
    } else {
      const dup = new Set<string>();
      for (const b of row) {
        if (!known.has(b)) issues.push(`beats["${t}"] 引用了不存在的手 "${b}"（现有：${throws.join('/')}）`);
        else if (b === t) issues.push(`beats["${t}"] 让手 "${t}" 克制自己`);
        else if (dup.has(b)) issues.push(`beats["${t}"] 重复列了 "${b}"`);
        dup.add(b);
      }
    }
    checkPayoffShape(payoff[t], hpResource, `payoff["${t}"]`, issues);
  }
  for (const k of Object.keys(beats)) if (!known.has(k)) issues.push(`beats 有多余条目 "${k}"（不在 throws 里）`);
  for (const k of Object.keys(payoff)) if (!known.has(k)) issues.push(`payoff 有多余条目 "${k}"（不在 throws 里）`);
  // 互克 = 同一格既判 A 胜又判 B 胜，查表无法定胜负（反律石板只反一半时的典型漏配）。
  for (const a of throws) {
    for (const b of beats[a] ?? []) {
      if (a < b && (beats[b] ?? []).includes(a)) {
        issues.push(`判定表矛盾：手 "${a}" 与 "${b}" 互克（同一格定不出胜负）——改克制补丁记得把反向那条也去掉`);
      }
    }
  }
  if (!tie || !isFiniteNum(tie.selfDamage)) issues.push('tie.selfDamage 不是有限数字（平局僵持伤；取负 = 双方回血）');
  checkEffects(tie?.effects, hpResource, 'tie', issues);

  return { table: { throws, beats, payoff, tie }, issues };
}

/** 体检（不抛）：返回全部问题（人话）。空数组 = 这张表可以落盘。 */
export function checkDuelMatrix(m: DuelMatrix): string[] {
  return foldDuelMatrix(m).issues;
}

/** 落盘门（抛出版）：有任一问题即拒收，错误文本逐条点名（Lead 附加②口径）。 */
export function validateDuelMatrix(m: DuelMatrix): void {
  const issues = checkDuelMatrix(m);
  if (issues.length) throw new Error(`matrix-duel 装载校验失败:\n  - ${issues.join('\n  - ')}`);
}

/** 基表 + 补丁 → 成品判定表（纯函数·按书写序·先过落盘门，坏数据硬抛，绝不静默跳过）。 */
export function resolveDuelMatrix(m: DuelMatrix): DuelTable {
  const { table, issues } = foldDuelMatrix(m);
  if (issues.length) throw new Error(`matrix-duel 装载校验失败:\n  - ${issues.join('\n  - ')}`);
  return table;
}

/** 查表定胜负（纯整数集合查表）：'a' = 前者胜，'b' = 后者胜，'tie' = 平（含同手 / 互不克制）。 */
export function duelVerdict(table: DuelTable, a: DuelThrowId, b: DuelThrowId): 'a' | 'b' | 'tie' {
  const aWins = (table.beats[a] ?? []).includes(b);
  const bWins = (table.beats[b] ?? []).includes(a);
  if (aWins === bWins) return 'tie'; // 都不克（含同手） / 互克（互克已被落盘门拒收，此处兜底判平）
  return aWins ? 'a' : 'b';
}

// ── 系统 ─────────────────────────────────────────────────────────────────────

/** 附带效果的瞬时载体实体 id（一效果一实体 —— 引擎「一实体一 ResourceModify 槽」）。 */
const carrierId = (matrixEid: EntityId, i: number): EntityId => `duel:${matrixEid}#${i}`;

export const matrixDuelCapability = defineCapability({
  id: 't2-matrix-duel',
  version: '1.0.0',

  describe: {
    name: 'matrix-duel',
    summary:
      '同时决策 × 收益矩阵结算解释器：双方各挂 DuelIntent{throw}，两侧齐备即查 DuelMatrix 定胜负 → 按 payoff/tie 写 ResourceModify（伤害/附带效果）+ 发具名 Signal → 清双方 intent（同回合绝不二次结算）。patches 三闭集（改克制 / 改收益 / 增设新手）在对局开始按书写序确定性套用；坏补丁装载期拒收。',
    semantic: ['tier2', 'logic', 'duel', 'matrix', 'determinism'],
    whenToUse:
      '任何「两边同时暗出一手、查一张固定表定胜负与收益」的对抗：猜拳全变体（含蜥蜴斯波克）、田忌赛马、押注对决、兵种相克战棋。给对局实体挂 DuelMatrix，双方实体各挂 Resource{id:hpResource} + 本回合的 DuelIntent。AI 怎么选招（t2-event-when + t2-weighted-spawn）、手牌（t2-card-pile）、押注（t2-craft-recipe + t2-modifier-stack）都不归本件。',
    examples: [
      "三手基表：DuelMatrix{ hpResource:'hp', throws:['rock','paper','scissors'], beats:{rock:['scissors'],paper:['rock'],scissors:['paper']}, payoff:{rock:{damage:6},scissors:{damage:5,effects:[{resource:'insight',amount:1}]},paper:{damage:4,signal:'duel_paper_win'}}, tie:{selfDamage:1} }",
      "出招：给双方实体各挂 DuelIntent{throw:'rock'} / DuelIntent{throw:'scissors'} → 当拍结算：石胜、剪方 -6 hp、双方 intent 清空",
      "遗物·反律石板（改克制）：patches:[{kind:'beats',throw:'rock',beats:['scissors','paper']},{kind:'beats',throw:'paper',beats:[]}]（两条一起写，只反一半会被落盘门判互克拒收）",
      "遗物·同调（改收益）：patches:[{kind:'payoff',tie:{selfDamage:-3}}] → 平局改为双方各回 3 血",
      "遗物·第四指空手（增维 3×3→4×4）：patches:[{kind:'add-throw',throw:'void',beats:[],beatenBy:[],payoff:{damage:0}}] → 对任何手皆平",
    ],
  },

  components: {
    provides: {
      DuelMatrix: {
        category: 'config',
        describe:
          '一场对局的判定表（纯数据）+ 补丁列表。挂在「对局」实体上；双方实体各挂一份 Resource{id:hpResource} 供 local 寻址扣血。',
        fields: {
          duelId: { type: 'string', describe: '多场对局并存时的配对键（与 DuelIntent.duelId 对齐；缺省 "" = 单场）' },
          hpResource: { type: 'string', describe: '伤害扣哪个 Resource 的 id（双方各挂一份同 id 的 Resource，按 local 寻址各扣各的）' },
          throws: { type: 'string[]', describe: '本表全部「手」的 id 闭集，如 ["rock","paper","scissors"]' },
          beats: { type: 'string', describe: 'Record<手, 它克制的手[]>：每一手都要有条目，不克任何手也要显式写 []（残缺=装载期拒收）；不得自克，不得互克' },
          payoff: { type: 'string', describe: 'Record<手, {damage, selfDamageOnLose?, signal?, effects?}>：每一手都要有条目。damage=出此手取胜时对败方的伤害；selfDamageOnLose=出此手判负时额外自伤；effects 按 Resource id 全局路由（不得改 hpResource）' },
          tie: { type: 'string', describe: '平局收益 {selfDamage, signal?, effects?}：selfDamage=双方各受的僵持伤，取负 = 双方各回血' },
          patches: { type: 'string', describe: '对局开始按书写序套用的数据补丁，三闭集：{kind:"beats",throw,beats[]} 改克制 / {kind:"payoff",throw?,payoff?,tie?} 改收益 / {kind:"add-throw",throw,beats?,beatenBy?,payoff} 增设一手。未知类型 / 引用不存在的手 / 表残缺 → 装载期报错拒收' },
          winSignal: { type: 'string', describe: '胜方实体上发的通用信号（被 payoff[取胜那手].signal 覆盖）' },
          loseSignal: { type: 'string', describe: '败方实体上发的通用信号' },
          resolvedSignal: { type: 'string', describe: '对局实体上发的「本回合已结算」信号（演出 cue 用）' },
        },
      },
      DuelIntent: {
        category: 'intent',
        describe: '某一侧本回合出的手。两侧齐备即结算，结算后由本能力清除（同一回合绝不二次结算）。',
        fields: {
          throw: { type: 'string', describe: '出哪一手（必须是 DuelMatrix.throws 里的 id）' },
          duelId: { type: 'string', describe: '属于哪场对局（与 DuelMatrix.duelId 对齐；缺省 ""）' },
        },
      },
      DuelOutcome: {
        category: 'event',
        describe: '本回合的结算记录（Update 相位产出 → Commit 相位播报具名信号后即被消费，不留过拍）。',
        fields: {
          duelId: { type: 'string', describe: '哪场对局' },
          tie: { type: 'boolean', describe: '是否平局' },
          sides: { type: 'string[]', describe: '两侧实体 id（升序）' },
          throws: { type: 'string[]', describe: '两侧对应所出的手' },
          winner: { type: 'EntityId', describe: '胜方实体（平局缺省）' },
          loser: { type: 'EntityId', describe: '败方实体（平局缺省）' },
          winThrow: { type: 'string', describe: '取胜的那一手' },
          loseThrow: { type: 'string', describe: '落败的那一手' },
          emit: { type: 'string', describe: '待播报的具名信号 [{entity,signal,arg?}]（每实体至多一条）' },
          carriers: { type: 'string[]', describe: '附带效果的瞬时载体实体 id（本拍 resource-apply 消费其 ResourceModify 后，播报系统销毁）' },
        },
      },
    },
    reads: ['DuelMatrix', 'DuelIntent', 'DuelOutcome'],
    writes: ['ResourceModify', 'DuelIntent', 'DuelOutcome', 'Signal'],
    consumes: ['DuelOutcome'],
  },

  config: {},

  systems: [
    {
      // ① 结算（Update）：查表 → 写 ResourceModify → 记 DuelOutcome → 清双方 intent。
      // runsBefore resource-apply（Lead 附加①·R10 范式）：本系统产 ResourceModify，必须排它前面，
      // 扣血当拍生效。**刻意不读 Resource**：读它会让全部 Resource 写者（resource-apply/self-rule/
      // modifier-stack…）都成为本系统前驱，与「本系统排 resource-apply 之前」合围成环（实测已验证）。
      // 附带效果因此不自己找目标实体，而是发 scope:'global' 的 ResourceModify 交 resource-apply 按 id 路由。
      id: 'matrix-duel',
      reads: ['DuelMatrix', 'DuelIntent'],
      writes: ['ResourceModify', 'DuelIntent', 'DuelOutcome'],
      consumes: [],
      runsBefore: ['resource-apply'],
      execute(world: IWorld) {
        const matrixIds = world.query('DuelMatrix').map(([id]) => id).sort();
        if (matrixIds.length === 0) return;
        const intentIds = world.query('DuelIntent').map(([id]) => id).sort();

        for (const mid of matrixIds) {
          const md = world.getComponent<DuelMatrix>(mid, 'DuelMatrix');
          if (!md) continue;
          // 落盘门（Lead 附加②）：每拍按同一把尺子校验 + 按书写序套补丁。纯函数、零缓存态，
          // 故「对局开始把 patches 摆好」= 本拍起全部结算都用套好的表。坏数据在此硬抛，绝不静默跳过。
          const table = resolveDuelMatrix(md);

          const key = md.duelId ?? '';
          const sides: Array<{ eid: EntityId; intent: DuelIntent }> = [];
          for (const iid of intentIds) {
            const it = world.getComponent<DuelIntent>(iid, 'DuelIntent');
            if (it && (it.duelId ?? '') === key) sides.push({ eid: iid, intent: it });
          }
          // < 2：一侧还没提交 → 本拍不结算、等齐（**瞬时**态，下一拍可能就齐了，合理跳过）。
          // > 2：同一 duelId 挂了三份及以上 DuelIntent = 数据错，**永远不会自己变回 2** →
          //      旧实现一并 continue 就成了静默永久死锁（对局静止、零报错、最难查）。
          //      本文件对「表外的手」已立同一规矩：这类永不自愈的数据错必须点名硬抛，
          //      故此处补齐同口径（engine-review-2026-08-04 §3.3 · P2）。
          if (sides.length > 2) {
            throw new Error(
              `matrix-duel: duelId "${key}" 挂了 ${sides.length} 份 DuelIntent（判定表是两方对决，只能有 2 份）——`
              + `涉事实体：${sides.map((s) => `"${s.eid}"`).join(' / ')}`,
            );
          }
          if (sides.length < 2) continue;

          const [sa, sb] = sides;
          const ta = sa.intent.throw;
          const tb = sb.intent.throw;
          for (const s of sides) {
            if (!table.throws.includes(s.intent.throw)) {
              // 表外的手 = 数据错。此处若 fail-closed 静默跳过，两侧 intent 会永远齐着却什么都不发生
              // ——对局静止死锁是最难查的失败态，故与落盘门同口径点名硬抛。
              throw new Error(
                `matrix-duel: 实体 "${s.eid}" 的 DuelIntent 出了判定表外的手 "${s.intent.throw}"（本表只有：${table.throws.join('/')}）`,
              );
            }
          }

          // 血量：两侧各自那份同 id 的 Resource 靠 **local** 寻址区分，故 ResourceModify 必须挂在该侧实体上
          // （每实体一个槽 → 同侧的多笔血量增减先累加成一笔）。
          const hpDelta = new Map<EntityId, number>();
          const addHp = (eid: EntityId, amount: number): void => {
            hpDelta.set(eid, (hpDelta.get(eid) ?? 0) + amount);
          };
          // 附带效果：全局 id 路由，一效果一条 ResourceModify → 各自开一个瞬时载体实体（Commit 播报后销毁）。
          const pending: DuelEffect[] = [];
          const addEffects = (effects: DuelEffect[] | undefined): void => {
            for (const e of effects ?? []) if (e.amount !== 0) pending.push(e);
          };

          const verdict = duelVerdict(table, ta, tb);
          const emit: DuelOutcome['emit'] = [];
          let outcome: DuelOutcome;

          if (verdict === 'tie') {
            if (table.tie.selfDamage !== 0) {
              addHp(sa.eid, -table.tie.selfDamage);
              addHp(sb.eid, -table.tie.selfDamage);
            }
            addEffects(table.tie.effects);
            if (table.tie.signal) {
              emit.push({ entity: sa.eid, signal: table.tie.signal, arg: ta });
              emit.push({ entity: sb.eid, signal: table.tie.signal, arg: tb });
            }
            outcome = {
              type: 'DuelOutcome',
              duelId: key,
              tie: true,
              sides: [sa.eid, sb.eid],
              throws: [ta, tb],
              emit,
              carriers: [],
            };
          } else {
            const win = verdict === 'a' ? sa : sb;
            const lose = verdict === 'a' ? sb : sa;
            const winThrow = verdict === 'a' ? ta : tb;
            const loseThrow = verdict === 'a' ? tb : ta;
            const wp = table.payoff[winThrow];
            const lp = table.payoff[loseThrow];
            // 败方挨两笔：胜方那手的 damage + 自己那手的 selfDamageOnLose（同一 hp 槽，合并成一条）。
            const loserDelta = -wp.damage - (lp.selfDamageOnLose ?? 0);
            if (loserDelta !== 0) addHp(lose.eid, loserDelta);
            addEffects(wp.effects);
            const winSignal = wp.signal ?? md.winSignal;
            if (winSignal) emit.push({ entity: win.eid, signal: winSignal, arg: winThrow });
            if (md.loseSignal) emit.push({ entity: lose.eid, signal: md.loseSignal, arg: loseThrow });
            outcome = {
              type: 'DuelOutcome',
              duelId: key,
              tie: false,
              sides: [sa.eid, sb.eid],
              throws: [ta, tb],
              winner: win.eid,
              loser: lose.eid,
              winThrow,
              loseThrow,
              emit,
              carriers: [],
            };
          }
          if (md.resolvedSignal) {
            emit.push({ entity: mid, signal: md.resolvedSignal, arg: verdict === 'tie' ? '' : outcome.winThrow });
          }

          for (const [eid, amount] of hpDelta) {
            if (amount === 0) continue;
            world.addComponent(eid, {
              type: 'ResourceModify',
              resourceId: md.hpResource,
              amount,
              scope: 'local',
            } as ResourceModify);
          }
          pending.forEach((e, i) => {
            const cid = carrierId(mid, i);
            world.destroyEntity(cid); // 防御：上一拍若异常中断没销毁，createEntity 会因重名抛错
            world.createEntity(cid);
            world.addComponent(cid, {
              type: 'ResourceModify',
              resourceId: e.resource,
              amount: e.amount,
              scope: 'global',
            } as ResourceModify);
            outcome.carriers.push(cid);
          });
          world.addComponent(mid, outcome);
          // 清双方 intent —— 同一回合绝不二次结算（下一回合由出招侧重新挂 DuelIntent）。
          world.removeComponent(sa.eid, 'DuelIntent');
          world.removeComponent(sb.eid, 'DuelIntent');
        }
      },
    },
    {
      // ② 播报（Commit）：读结算记录 → 在对应实体上发具名 Signal（source = 该实体，供 effect-apply
      // 的 '@signal-source' 寻址「谁赢谁抽牌」）。放 Commit 是为了排在 event-when（Update）的全局
      // Signal 清扫**之后**、effect-apply（Commit）之前——见文件头「定序」的成环证明。
      // 信号无需自清：下一拍 event-when 的全局清扫会带走（Update 早于 Commit），本件不留跨拍状态。
      id: 'matrix-duel-announce',
      phase: SystemPhase.Commit,
      reads: ['DuelOutcome'],
      writes: ['Signal'],
      consumes: ['DuelOutcome'],
      runsBefore: ['effect-apply'], // 组件拓扑（写 Signal → effect-apply 读）本已排前，显式加固
      execute(world: IWorld) {
        const ids = world.query('DuelOutcome').map(([id]) => id).sort();
        if (ids.length === 0) return;
        // 结算与播报之间隔着整个 Update 尾段（mortal/destroy 可能已收走某一侧实体）→ 先取存活集合。
        const alive = new Set(world.getAllEntities());
        for (const oid of ids) {
          const o = world.getComponent<DuelOutcome>(oid, 'DuelOutcome');
          if (!o) continue;
          for (const s of o.emit) {
            if (!alive.has(s.entity) || world.hasComponent(s.entity, 'Signal')) continue; // 一实体一 Signal 槽，先到先得
            world.addComponent(s.entity, {
              type: 'Signal',
              name: s.signal,
              source: s.entity,
              ...(s.arg !== undefined && s.arg !== '' ? { arg: s.arg } : {}),
            } as Signal);
          }
          // 附带效果的瞬时载体：ResourceModify 已由本拍 resource-apply 消费，此处收走空壳（不留过拍垃圾）。
          for (const cid of o.carriers) world.destroyEntity(cid);
        }
      },
    },
  ],
});
