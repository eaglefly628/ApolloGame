// game108《拳律 / Rule of Three》—— 对局世界 = **纯数据**（WorldBlueprint）。本目录零专属系统代码。
//
//   三时区四拍 = t3-flow（`FlowTransition.after` 的 tick 门）【R-108-01】
//   蓄力 +1    = UI/AI 信号 → t2-effect-apply{modify-resource} 打各侧唯一槽 id【R-108-10】
//   出招       = t2-matrix-duel 的 intentSignals 接缝（两侧共用信号名·靠 Signal.source 认侧）【R-108-11/70】
//   判定与伤害 = t2-matrix-duel 查表 + payoff.perSide 缩放（10 + 出手方该手蓄力 × 10）【R-108-12/13】
//   出过即清零 = t2-matrix-duel 的 clearOnSettle 结算副作用（只清各自出过的那只手）【R-108-14】
//   记本回合的手 = lastThrowVar → StringVar，供超时顺延与 AI 抄上一手取用【R-108-02/30】
//   胜负       = t3-flow 读 hp【R-108-15】
// 能力总览：docs/design/game108/capability-plan.md；规则语义：gdd.md（条款 R-108-NN）。
import type { WorldBlueprint, EntityBlueprint } from '@zerocraft/engine/assembly/demo.assembly.js';
import { resourceCapability, flagCapability, stringVariableCapability, randomCapability } from '@zerocraft/engine/atom-skills/index.js';
import { eventWhenCapability, effectApplyCapability, matrixDuelCapability, selfRuleCapability, keybindCapability, craftRecipeCapability } from '@zerocraft/engine/skills/tier2/index.js';
import { flowCapability } from '@zerocraft/engine/skills/tier3/index.js';
import {
  HANDS, SIDES, HP_MAX, CHARGE_CAP, DMG_BASE, DMG_STEP, TIE_SELF_DAMAGE,
  PHASE_TICKS, PENALTY_PERIOD, PENALTY_HP, CHARGE_PER_ROUND,
  ACT, HP_RES, chargeRes, chargeRelName, chargeEntity, chargeBudgetRes, penaltyDebtRes, penaltyTickFlag, lastThrowVar,
  histRes, STYLE_RES, STYLE_MAX, STYLE_MID, STYLE_GAMBLER, chargedFlag, threwHandFlag, playerThrewHand, playerCounted,
  SMOKE_RES, SMOKE_TURNS, SMOKE_FLAG, SMOKE_USES, SMOKE_DURATION,
  type Hand, type Side, type OpponentId,
} from './theme.js';

/** 「该侧已倒下」的 Flag id（**各侧唯一**——全局条件路由靠它认侧）。 */
export const deadFlag = (side: Side): string => `${side}.dead`;

/** 结算门 Flag id【R-108-01】：T3 对决时区开、T4 结算时区关（REQ-108-ENG-06）。 */
export const SETTLE_GATE = 'duel.settle';

/** T1/T2 相位门 Flag（AI 的规则据此只在该时区动手·flow 的 onEnter 开关）。 */
export const CHARGING_GATE = 'duel.charging';
export const THROWING_GATE = 'duel.throwing';
/**
 * 【R-108-33】**AI 定手窗**——只亮**一拍**（`lockIn` 态进态点亮 → 下一拍进 `throw` 熄灭）。
 *
 * 为什么不能让 AI 的出招规则挂在 `THROWING_GATE` 上（那是 2026-08-08 逮到的**真赖皮事故**）：
 * `THROWING_GATE` 整个 T2 都开着，而 AI 的 `EventWhen` 是**边沿**触发——只要它的**输入**在 T2 中途变了，
 * 「规则 A 落、规则 B 起」就是一次新的上升沿，AI 会**在玩家出手之后改手**。实测链路：
 * 玩家出布 → `p1.hist.paper` +1 → `top('paper')` 成立 → `master:throw:scissors` 抬沿 → 接缝覆盖 intent
 * ⇒ 大师从石头改成剪刀，玩家永远输，**且不报任何错**。
 *
 * 定手窗把「读公开信息 + 决定」压进一拍：这一拍**只有一次** EventWhen 评估，边沿只能抬一次。
 * 一拍的窗口靠 flow 两态相接实现（`{when:'always'}` 的转移要下一拍才判，见 `throwPenaltyHit` 同款），
 * 故旗从进态那一拍（flow 之后）一直亮到下一拍（flow 之前）——**无论 EventWhen 与 flow 谁先跑都够一次评估**。
 */
export const DECIDE_GATE = 'duel.decide';

/** 【R-108-04】v3 罚血读秒门：T2 免费段走完仍没出手 → 开；玩家出手/进 T3 → 关。屏上据它换倒计时形态。 */
export const PENALTY_GATE = 'duel.penalty';
/** 【R-108-05】v3 玩家闸门：`duel.next` 按下即置位，T4 据它推进；T1 开场复位。 */
export const NEXT_GATE = 'duel.next.armed';
/**
 * 【R-108-04】「这一侧本回合已提交出招」——罚血的停止条件。
 * **不能靠 `throw.<手>` 信号置**：那个名字玩家与 AI 共用（接缝靠 `Signal.source` 认侧），
 * 而 `effect-apply` 的 `set-flag` 不认 source ⇒ AI 一出手就会把玩家那面旗也点亮、罚血当场失效。
 * 故另拉一条**只有玩家键盘/点击才会走**的信号（见 `playerKeys` 的 `kb:threw:*`）。
 */
export const threwFlag = (side: Side): string => `${side}.threw`;
/** 上面那条玩家专属信号名（`ui.` 那类是表现层本地动作，这条是**世界信号**，只是不进动作词表）。 */
export const PLAYER_THREW = 'p1.threw';

/**
 * 蓄力两条 Effect 的**显式结算序**（【R-108-10】v3）。
 * `effect-apply` 同 tick 命中多条时按 `order` 升序、并列才按实体 id 兜底——
 * 「先按额度加层，再把额度清零」这个先后是**规则的一部分**，靠实体名的字典序兜底太脆
 * （改个实体名就静默反转，蓄力当场恒为 0，且不报错）。故写死成数据。
 */
const ORDER_CHARGE = 10;
const ORDER_SPEND = 20;

/**
 * 罚血读秒那两个状态的等待 tick 数。**不等于 `PENALTY_PERIOD`**：一个周期实际耗
 * `after + 2` 拍 —— 进 `throwPenalty` 那一拍 `elapsed` 从 0 起算（`after` 要等到 `elapsed>=after`
 * 才成立，故比 after 多一拍），`throwPenaltyHit` 自己再占一拍（onEnter 记账后当拍就跳回）。
 * 不减这 2 拍，「1 秒 1 点」实际是 1.033 秒 1 点——单看没感觉，犹豫 30 秒就少罚 1 点，
 * 而验收剧本正是按「秒数 = 点数」写的。已用 flow 时间线实测核过（见测试「罚血周期」）。
 */
const PENALTY_WAIT = PENALTY_PERIOD - 2;

/** AI 侧的内部信号名——**不进动作词表**（【R-108-70】只管玩家动作），故与玩家的 `charge.<手>` 分开。 */
export const aiChargeSignal = (h: Hand): string => `ai.charge.${h}`;
/** 出招信号玩家与 AI **共用一个名**：接缝靠 `Signal.source` 认侧（见 capability-plan §4）。 */
export const throwSignal = (h: Hand): string => ACT.throw(h);

/** 判定表【R-108-12/13】：石 > 剪 > 布 > 石；伤害按**出手方**该手蓄力线性缩放。 */
function duelMatrix(opponent: OpponentId = 'parrot'): Record<string, unknown> {
  return {
    // 【R-108-32】大师自带改写过的判定表（静态补丁·其余对手无补丁）。
    ...(opponent === 'master' ? { patches: MASTER_PATCHES } : {}),
    hpResource: HP_RES,
    throws: [...HANDS],
    beats: { rock: ['scissors'], paper: ['rock'], scissors: ['paper'] },
    payoff: Object.fromEntries(HANDS.map((h) => [h, {
      // perSide 相对名 → 运行期拼 `<出手方>.charge.<手>`，与 theme.chargeRes 严丝合缝（有点名测试钉死）。
      damage: { base: DMG_BASE, scaleByResource: chargeRelName(h), perSide: true, step: DMG_STEP },
    }])),
    tie: { selfDamage: TIE_SELF_DAMAGE },
    intentSignals: Object.fromEntries(HANDS.map((h) => [h, throwSignal(h)])),
    // 【R-108-01】结算门：只有进了 T3 对决时区才结算（REQ-108-ENG-06）。
    // 不设门的话双方一提交就立刻扣血 ⇒ 你出招那一刻血条就掉、槽就清，
    // **「亮拳」那 2 秒变成播放已经发生过的事**——而亮拳是本作的情绪核（§13 演出）。
    settleWhenFlag: SETTLE_GATE,
    clearOnSettle: 'charge',      // 【R-108-14】只清各自出过的那只手
    lastThrowVar: 'lastThrow',    // 【R-108-02/30】记本回合的手
    resolvedSignal: 'duel.resolved',
  };
}

/**
 * 三时区四拍【R-108-01】**v3**：T1 硬倒计时 / T2 免费段 + 罚血读秒 / T3 演出 / T4 玩家闸门。
 *
 * v3 比 v2 多两个状态，它们**不是第五拍**，是 T2 的读秒尾巴（屏上仍写「出招」）：
 *   `throwPenalty`    罚血读秒中（等 1 秒）
 *   `throwPenaltyHit` 罚这 1 点（onEnter 记一笔）→ 立刻回 `throwPenalty`
 * 两态互跳 = **flow 自己就是那口周期时钟**（`flow.elapsed` 每次进状态归零，见 tier3/flow.ts:104-110）。
 * 为什么不用 `Timer`+`EventWhen`：Timer 全程自走、进罚血那一刻对不上相位，
 * 头一次罚血会随机延迟 0–1 秒；而 flow 的 `after` 从进状态那一拍起算，天然对齐。
 */
function duelFlow(): Record<string, unknown> {
  // ⚠ 不能写 `{kind:'resource', id:'hp', …}`——`ConditionExpr` 的 resource 是**全局 id 路由、无 entity 字段**，
  // 而两侧 hp 必须同 id（matrix-duel 的 hpResource 按侧 local 寻址）⇒ 全局条件分不清哪一侧。
  // 解法（**重组·非新缺口**）：各侧挂 `t2-self-rule` 读**自身** hp → 置自身那面**各侧唯一 id** 的 Flag，
  // flow 再按该唯一 flag id 读。见 capability-plan §7 同类根因。
  const hpDown = (side: Side): Record<string, unknown> => ({ kind: 'flag', id: deadFlag(side) });
  /** 玩家已提交出招 —— T2 的收尾条件（罚血读秒也据它停）。 */
  const playerThrew = { kind: 'flag', id: threwFlag('p1') };
  /**
   * 回合复位（T1 开场一次做完）。**必须在这里做，不能在 T4 收尾做**：
   * T4 是玩家闸门，玩家可能盯着结算屏看半分钟——复位放那儿会让「上一回合的欠债/已出手」
   * 提前消失，结算屏就读不出这一波到底发生了什么了。
   */
  const roundReset: Array<Record<string, unknown>> = [
    { kind: 'set-flag', targetId: CHARGING_GATE, value: true },
    { kind: 'set-flag', targetId: THROWING_GATE, value: false },
    { kind: 'set-flag', targetId: DECIDE_GATE, value: false },
    { kind: 'set-flag', targetId: PENALTY_GATE, value: false },
    { kind: 'set-flag', targetId: NEXT_GATE, value: false },
    { kind: 'set-flag', targetId: threwFlag('p1'), value: false },
    { kind: 'set-flag', targetId: penaltyTickFlag('p1'), value: false },
    // 【R-108-30】v4：本回合「蓄了哪只 / 出了哪只」两组旗每回合清——它们是大师二次思考的输入。
    ...HANDS.map((h) => ({ kind: 'set-flag', targetId: chargedFlag(h), value: false })),
    ...HANDS.map((h) => ({ kind: 'set-flag', targetId: threwHandFlag(h), value: false })),
    // 【R-108-10】v3：每回合发一份蓄力额度（双方同规则——AI 也只加一层）。
    ...SIDES.map((s) => ({ kind: 'modify-resource', targetId: chargeBudgetRes(s), op: 'set', value: CHARGE_PER_ROUND })),
    { kind: 'modify-resource', targetId: penaltyDebtRes('p1'), op: 'set', value: 0 },
  ];
  return {
    id: 'duel',
    current: 'charge',
    states: [
      {
        id: 'charge',
        onEnter: roundReset,
        transitions: [{ after: PHASE_TICKS.charge, to: 'lockIn' }],
      },
      // ── T1 与 T2 之间的**一拍**：AI 定手窗（【R-108-33】见 DECIDE_GATE 注释）──────────
      // 屏上不是一拍，投影时并进「出招」（game108.ts readView）。放在这里而不是 T2 里，
      // 是因为它必须**早于玩家能出手的那一刻**：蓄力门已关、出招门还没开。
      {
        id: 'lockIn',
        onEnter: [
          { kind: 'set-flag', targetId: CHARGING_GATE, value: false },
          // 额度当场作废：T1 结束就不能再蓄了（【R-108-01】蓄力只在 T1）。
          // 靠"按钮禁用"是治不了的——那只是表现层，键位/脚本照样能发信号。
          ...SIDES.map((s) => ({ kind: 'modify-resource', targetId: chargeBudgetRes(s), op: 'set', value: 0 })),
          { kind: 'set-flag', targetId: DECIDE_GATE, value: true },
        ],
        transitions: [{ when: { kind: 'always' }, to: 'throw' }],
      },
      {
        id: 'throw',
        onEnter: [
          { kind: 'set-flag', targetId: DECIDE_GATE, value: false },
          { kind: 'set-flag', targetId: THROWING_GATE, value: true },
        ],
        // 【R-108-01】v3：免费段到点**不推进到对决**，转入罚血读秒（【R-108-04】）。
        // 玩家在免费段内出手的，读秒态第一条转移当场成立 ⇒ 一拍就过，罚不到。
        transitions: [{ after: PHASE_TICKS.throw, to: 'throwPenalty' }],
      },
      // ── T2 尾巴：罚血读秒（屏上仍是「出招」这一拍）────────────────────────
      {
        id: 'throwPenalty',
        onEnter: [
          { kind: 'set-flag', targetId: PENALTY_GATE, value: true },
          { kind: 'set-flag', targetId: penaltyTickFlag('p1'), value: false },
          // ⚠ 这里**绝不能**顺手清 `chargedFlag`/`threwHandFlag`：本态每秒重进一次，
          // 清了就等于「玩家在读秒里蓄的那一手」每秒被抹掉一次 —— 玩家蓄石又出石，
          // 到结算时 chargedFlag 已空 ⇒ 被记成「诈」、赌性指针反向走。两组旗是**每回合**清（T1 开场）。
        ],
        transitions: [
          // 罚死了也要收局：不加这条，玩家血罚到 0 却还卡在读秒里等他出手（clamp 在 0，永远出不去）。
          { when: hpDown('p1'), to: 'p2win' },
          { when: playerThrew, to: 'clash' },
          { after: PENALTY_WAIT, to: 'throwPenaltyHit' },
        ],
      },
      {
        id: 'throwPenaltyHit',
        onEnter: [
          // 记一笔欠债（**全局唯一 id**，故 flow 的 modify-resource 打得中）——屏上「已欠 -N」读它。
          { kind: 'modify-resource', targetId: penaltyDebtRes('p1'), op: 'add', value: PENALTY_HP },
          // **真扣血的节拍**：点亮全局节拍旗，p1 自己那条 SelfRule 用 whenGlobal 读它、扣自身 hp。
          // 旗只亮这一拍（下一拍回 throwPenalty 就熄），故 level 模式也恰好一秒一点。
          { kind: 'set-flag', targetId: penaltyTickFlag('p1'), value: true },
        ],
        transitions: [
          { when: playerThrew, to: 'clash' },
          { when: { kind: 'always' }, to: 'throwPenalty' },
        ],
      },
      // clash → settle 至少隔 1 tick：接缝在 Commit 产 intent、下一拍 Update 才结算
      // （capability-plan §5 实现约定 2），同拍收口会漏结算。
      // T3 对决：进来就开结算门（【R-108-01】T3 = 亮拳 → 克制判定 → 伤害演出——
      // 判定与伤害在引擎里是同一次操作，故「揭晓」这一拍就是它落地的那一拍）。
      {
        id: 'clash',
        onEnter: [
          { kind: 'set-flag', targetId: SETTLE_GATE, value: true },
          // 罚血读秒到此为止（进了对决还亮着，结算屏会一直显示「你在被罚」）。
          { kind: 'set-flag', targetId: PENALTY_GATE, value: false },
          // **必须在这里关出招门**：不关的话，结算写完 lastThrow 会让「按 lastThrow 出招」那批
          // edge 规则再次抬升边沿 → 同一回合结算第二次（实测：伤害从 30 变 40 = 30 + 清零后的 10）。
          { kind: 'set-flag', targetId: THROWING_GATE, value: false },
        ],
        transitions: [{ after: PHASE_TICKS.clash, to: 'settle' }],
      },
      // T4 结算：门随即关上——下一回合的提交不该被上一回合开着的门直接结算掉。
      {
        id: 'settle',
        onEnter: [{ kind: 'set-flag', targetId: SETTLE_GATE, value: false }],
        transitions: [
          { when: hpDown('p2'), to: 'p1win' },
          { when: hpDown('p1'), to: 'p2win' },
          // 【R-108-05】v3：**玩家闸门**——点了「下一轮」才进下一回合，**无自动兜底**
          // （owner 2026-08-07：「我们是个单人游戏，没必要去 push 玩家」）。
          // 胜负两条排在前面：血已归零时点不点都该收局，不该卡在结算屏等一次点击。
          { when: { kind: 'flag', id: NEXT_GATE }, to: 'charge' },
        ],
      },
      { id: 'p1win' },
      { id: 'p2win' },
    ],
  };
}

/**
 * 蓄力效果实体【R-108-10】**v3**：一手一侧**两条**——加层 + 花额度。
 *
 * v2 是「每点一次 +1」（`value:1`），owner 2026-08-07 判「那是个 bug」：条款原文一直写着
 * 「T1 往一手存 **+1**」，一回合一层。v3 用**每回合一份额度**表达：
 *   ① `fx:charge:*`  槽 += 额度当前值（`valueFrom`·额度 1 就加 1、额度 0 就加 0）
 *   ② `fx:spend:*`   额度 = 0
 * 于是"同回合第二次点"自然加 0，**不靠禁用按钮**（按钮是表现，键位与脚本绕得过去）。
 * 上限仍由 `Resource.max = CHARGE_CAP` 钳位——满了再点也不会超。
 *
 * ⚠ 两条的先后是**规则**，写成显式 `order`（见 ORDER_CHARGE/ORDER_SPEND 的注释）。
 */
function chargeEffects(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const side of SIDES) {
    for (const h of HANDS) {
      const signal = side === 'p1' ? ACT.charge(h) : aiChargeSignal(h);
      out[`fx:charge:${side}:${h}`] = {
        Effect: {
          onSignal: signal,
          kind: 'modify-resource',
          targetId: chargeRes(side, h),
          op: 'add',
          value: 0,                                              // valueFrom 在场时不读它（留 0 = 不误导）
          valueFrom: { resourceId: chargeBudgetRes(side) },       // 加多少 = 本回合还剩多少额度
          order: ORDER_CHARGE,
        },
      } as EntityBlueprint;
      out[`fx:spend:${side}:${h}`] = {
        Effect: {
          onSignal: signal,
          kind: 'modify-resource',
          targetId: chargeBudgetRes(side),
          op: 'set',
          value: 0,
          order: ORDER_SPEND,
        },
      } as EntityBlueprint;
    }
  }
  return out;
}

/**
 * 玩家动作接线【R-108-70】：UI 的 `action` → InputQueue → t2-keybind → Signal。
 * 一动作一个专属 `kb:*` 实体（房屋范式·game-f/game101/game-103 同款·一实体一组件挤不下多份）。
 *
 * **出招三键必须填 `source: 'p1'`**（REQ-108-ENG-04·owner 2026-08-07 判 A）：
 * matrix-duel 的出招接缝**按 `Signal.source` 认侧**（`matrix-duel.ts:848`），而 kb 实体不是对局侧
 * ⇒ 不代发就永远认不到人，玩家点了没反应还不报错。
 * 蓄力三键**不填**：它们走 `t2-effect-apply` 的全局 `targetId` 路由（按信号名分侧），与 source 无关。
 */
function playerKeys(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const h of HANDS) {
    out[`kb:charge:${h}`] = { KeyBinding: { key: ACT.charge(h), signal: ACT.charge(h) } } as EntityBlueprint;
    out[`kb:throw:${h}`] = { KeyBinding: { key: throwSignal(h), signal: throwSignal(h), source: 'p1' } } as EntityBlueprint;
    // 同一个键**再绑一条**玩家专属信号（keybind 逐 KeyBinding 实体匹配，同 key 多绑各发各的，
    // `keybind.ts:84-101`）——罚血的停止条件只能听玩家这一路，听不得 AI 那一路（见 threwFlag 注释）。
    out[`kb:threw:${h}`] = { KeyBinding: { key: throwSignal(h), signal: PLAYER_THREW } } as EntityBlueprint;
    // 【R-108-30】v4 维度一：**逐手**的玩家专属信号——大师的习惯统计与赌性指针都从这一路记。
    // 同样绝不能听 `throw.<手>`（那条玩家与 AI 共用），不然 AI 自己出手也会被算进"玩家习惯"。
    out[`kb:hist:${h}`] = { KeyBinding: { key: throwSignal(h), signal: playerThrewHand(h) } } as EntityBlueprint;
  }
  // 【R-108-05】T4 玩家闸门键。**世界动作**（进 InputQueue → Signal → 置闸门旗），
  // 与终局屏那枚「再来一局」同名同键但落点不同：终局由宿主换一个世界（见 game108.ts restart）。
  out['kb:next'] = { KeyBinding: { key: ACT.next, signal: ACT.next } } as EntityBlueprint;
  return out;
}

/**
 * 五名对手【R-108-30/32】—— **纯数据的条件规则表**（本目录零 AI 代码）。
 *
 * 【R-108-32】五名对手是**一条教学曲线**，不是五个数值不同的怪：
 *  ① 复读机 parrot  —— 复用上一回合自己出的手。破绽明显·必现。教「对手是有规律的」。
 *  ② 莽夫   brute   —— 偏爱石头（永远蓄石出石，除非上一手是石则继续石）。教「读表演」。
 *  ③ 戏子   actor   —— **蓄一手、出另一手**（蓄上一手的克制手、出上一手）。教「蓄力会说谎」。
 *  ④ 赌徒   gambler —— 血少（≤50）时必满蓄押上一手；血厚时同复读机。教「逆转与孤注」。
 *  ⑤ 大师   master  —— 自带**改写过的判定表**（静态 patches）+ 行为同戏子。总检。
 *
 * 【R-108-30】原文要求「条件加权表·权重经种子 PRNG 抽取」。**本轮五档全部落在"条件"这一半**：
 * 每档的行为都是**确定性规则**，没有用到权重抽取——这不是偷懒，是【R-108-32】的硬要求：
 * 前四档都写明了「破绽」（明显·必现 / 攥拳高频 / 假动作 / 血低时破绽变多），
 * **破绽要可读，行为就不能随机**。设计红线也写死了「AI 必须 3-4 回合内可读，读不出来的 AI =
 * 随机数发生器 = 违反支柱一」。加权抽取留给后续「同权重档位间的平局打散」，届时另查通路。
 *
 * 表达手段（全部现成能力）：读上一手 = `ConditionExpr{kind:'string'}` 读 `lastThrowVar`；
 * 只在对应时区动手 = 与相位门 Flag 取 `and`；代表 p2 发信号 = `EventWhen.source`（ENG-05）。
 */
const BEATEN_BY: Record<Hand, Hand> = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

/**
 * 【R-108-30】v4 · **大师的记忆**（owner 2026-08-08 判 A：只有第五档用；前四档一格不碰）。
 *
 * 维度一 = 两样纯数据台账，全部由**玩家专属的逐手信号** `p1.threw.<手>` 驱动：
 *   · `p1.hist.<手>` —— 跨局累计出手次数（初值由宿主从 localStorage 灌进来）
 *   · `p1.style`     —— 赌性指针：出了刚蓄的那只 +1、出了别的 −1，钳在 0..20，起手 10
 *
 * 「出了刚蓄的那只」怎么判：本回合蓄了什么记在 `p1.charged.<手>` 旗上、出了什么记在
 * `p1.threwHand.<手>` 旗上，两旗同手 = 赌，异手 = 诈。两组旗都在 T1 开场清。
 * （`Effect` 没有 `when`，所以「有条件地 +1」只能走 `EventWhen{when}` → 信号 → `Effect` 这条。）
 */
function habitTracking(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  for (const h of HANDS) {
    out[`hist:${h}`] = { Resource: { id: histRes(h), current: 0, min: 0, max: 99999 } } as EntityBlueprint;
    // 【R-108-33】入账**推迟到结算那一拍**（`SETTLE_GATE` 开 = T3 揭晓，那时定手窗早关了）。
    // 出手当拍入账 = 大师在同一个 T2 里读到玩家刚出的手 ⇒ 赖皮（2026-08-08 实测事故）。
    out[`ai:count:${h}`] = {
      EventWhen: {
        signal: playerCounted(h), mode: 'edge', armed: false,
        when: { kind: 'and', of: [{ kind: 'flag', id: SETTLE_GATE }, { kind: 'flag', id: threwHandFlag(h) }] },
      },
    } as EntityBlueprint;
    out[`fx:hist:${h}`] = {
      Effect: { onSignal: playerCounted(h), kind: 'modify-resource', targetId: histRes(h), value: 1, op: 'add' },
    } as EntityBlueprint;
    out[`flag:charged:${h}`] = { Flag: { id: chargedFlag(h), active: false } } as EntityBlueprint;
    out[`fx:chargedflag:${h}`] = {
      Effect: { onSignal: ACT.charge(h), kind: 'set-flag', targetId: chargedFlag(h), value: true },
    } as EntityBlueprint;
    out[`flag:threwhand:${h}`] = { Flag: { id: threwHandFlag(h), active: false } } as EntityBlueprint;
    out[`fx:threwhand:${h}`] = {
      Effect: { onSignal: playerThrewHand(h), kind: 'set-flag', targetId: threwHandFlag(h), value: true },
    } as EntityBlueprint;
  }
  out['style:p1'] = { Resource: { id: STYLE_RES, current: STYLE_MID, min: 0, max: STYLE_MAX } } as EntityBlueprint;
  // 赌 / 诈 两条判定：两旗同手 = 赌（+1），出了没蓄的那只 = 诈（−1）。
  // 用 `mode:'edge'` 免得一个回合里连记好几次（旗立起来后会一直为真到 T1 复位）。
  // 同样**与 `SETTLE_GATE` 取 and**：赌性指针也是大师的输入，T2 里不许动（【R-108-33】）。
  const settled = { kind: 'flag', id: SETTLE_GATE };
  out['ai:gambled'] = {
    EventWhen: {
      signal: 'p1.gambled', mode: 'edge', armed: false,
      when: { kind: 'and', of: [settled, { kind: 'or', of: HANDS.map((h) => ({ kind: 'and', of: [{ kind: 'flag', id: chargedFlag(h) }, { kind: 'flag', id: threwHandFlag(h) }] })) }] },
    },
  } as EntityBlueprint;
  out['ai:bluffed'] = {
    EventWhen: {
      signal: 'p1.bluffed', mode: 'edge', armed: false,
      when: { kind: 'and', of: [settled, { kind: 'or', of: HANDS.map((h) => ({ kind: 'and', of: [{ kind: 'flag', id: chargedFlag(h), equals: false }, { kind: 'flag', id: threwHandFlag(h) }] })) }] },
    },
  } as EntityBlueprint;
  out['fx:gambled'] = { Effect: { onSignal: 'p1.gambled', kind: 'modify-resource', targetId: STYLE_RES, value: 1, op: 'add' } } as EntityBlueprint;
  out['fx:bluffed'] = { Effect: { onSignal: 'p1.bluffed', kind: 'modify-resource', targetId: STYLE_RES, value: -1, op: 'add' } } as EntityBlueprint;
  return out;
}

/**
 * 【R-108-30】v4 · **大师的决策链**（owner 2026-08-08 判 A）。自上而下，**互斥构造**：
 *   ① 玩家某手满 3 且**不在烟雾里** → 出它的克制手（满蓄是最响的宣告）
 *   ② 上面没命中 + 玩家是**赌徒型** + **不在烟雾里** → 吃他**刚蓄的那只**（二次思考 A）
 *   ③ 上面没命中 + （均匀型 **或 在烟雾里**）→ 吃他的**统计冠军**（二次思考 B·长期习惯，烟雾遮不住）
 *   ④ 都没命中（头一局：没习惯也没满蓄）→ **复用自己上一手**（同复读机）
 *
 * **为什么用互斥条件而不是"优先级字段"**：`EventWhen` 没有优先级，多条同拍命中会各发一个出招信号，
 * 接缝「已有 intent 则覆盖」⇒ 谁最后写谁赢 = 靠实体 id 字典序决定规则优先级。那是静默地雷。
 * 互斥虽然罗嗦，但每一条的成立条件都写在自己身上，改一条不会悄悄改掉另一条。
 *
 * **【R-108-33】不许赖皮**：这些 `EventWhen` 全部在**进 T2 那一拍**按边沿触发（`THROWING_GATE` 刚开），
 * 那时玩家的 `DuelIntent` 还不存在——大师读不到、也没机会改。有点名测试钉死。
 * 读的全是公开信息：六条槽 / 跨局统计 / 自己的上一手。
 */
function masterRules(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const hidden = { kind: 'flag', id: SMOKE_FLAG('p1') };
  const notHidden = { kind: 'flag', id: SMOKE_FLAG('p1'), equals: false };
  const gate = { kind: 'flag', id: DECIDE_GATE };   // 【R-108-33】只在定手窗那一拍
  const full = (x: Hand): Record<string, unknown> => ({ kind: 'resource', id: chargeRes('p1', x), cmp: 'gte', value: CHARGE_CAP });
  /** 「x 是统计冠军」= 它的次数**严格大于**另外两只（并列时不算冠军，落到 ④ 兜底）。 */
  const top = (x: Hand): Record<string, unknown> => ({
    kind: 'and',
    of: HANDS.filter((y) => y !== x).map((y) => ({ kind: 'resource', id: histRes(x), cmp: 'gt', value: 0, vsResource: histRes(y) })),
  });
  const gambler = { kind: 'resource', id: STYLE_RES, cmp: 'gte', value: STYLE_GAMBLER };
  const notGambler = { kind: 'resource', id: STYLE_RES, cmp: 'lt', value: STYLE_GAMBLER };

  const r1 = (x: Hand): Record<string, unknown> => ({ kind: 'and', of: [notHidden, full(x)] });
  const anyR1 = { kind: 'or', of: HANDS.map(r1) };
  const noR1 = { kind: 'not', of: anyR1 };
  const r2 = (x: Hand): Record<string, unknown> => ({ kind: 'and', of: [noR1, notHidden, gambler, { kind: 'flag', id: chargedFlag(x) }] });
  const anyR2 = { kind: 'or', of: HANDS.map(r2) };
  const r3 = (x: Hand): Record<string, unknown> => ({
    kind: 'and',
    of: [noR1, { kind: 'not', of: anyR2 }, { kind: 'or', of: [notGambler, hidden] }, top(x)],
  });
  const anyR3 = { kind: 'or', of: HANDS.map(r3) };
  const nothing = { kind: 'and', of: [noR1, { kind: 'not', of: anyR2 }, { kind: 'not', of: anyR3 }] };

  for (const t of HANDS) {
    // 出 t 是为了吃掉 BEATS[t] 那只手。
    const prey = BEATS[t];
    out[`master:throw:${t}`] = {
      EventWhen: {
        signal: throwSignal(t), mode: 'edge', armed: false, source: 'p2',
        when: { kind: 'and', of: [gate, { kind: 'or', of: [r1(prey), r2(prey), r3(prey)] }] },
      },
    } as EntityBlueprint;
    // ④ 兜底：三条都没命中 → 复用自己上一手（**不是随机**——随机就读不出来了，见 gdd §9.1 兜底注）。
    out[`master:fallback:${t}`] = {
      EventWhen: {
        signal: throwSignal(t), mode: 'edge', armed: false, source: 'p2',
        // **开局那一手必须有兜底**：`p2.lastThrow` 起手是空串，只写「复用上一手」的话
        // 大师**第一回合根本不出手** ⇒ 双方凑不齐 intent、永远结算不了（实测这条测试当场逮住）。
        // 起手固定出石：确定性、可读，且第二回合起就被上面的记忆链接管了。
        when: {
          kind: 'and',
          of: [gate, nothing, {
            kind: 'or',
            of: [
              { kind: 'string', id: lastThrowVar('p2'), equals: t },
              ...(t === 'rock' ? [{ kind: 'string', id: lastThrowVar('p2'), equals: '' }] : []),
            ],
          }],
        },
      },
    } as EntityBlueprint;
    // 蓄力：大师照旧蓄自己上一手（蓄力不是它的智能面·【R-108-32】它的强在读牌与记忆）。
    // 同样要给开局兜底，否则第一回合它一格都不蓄。
    out[`master:charge:${t}`] = {
      EventWhen: {
        signal: aiChargeSignal(t), mode: 'edge', armed: false,
        when: {
          kind: 'and',
          of: [{ kind: 'flag', id: CHARGING_GATE }, {
            kind: 'or',
            of: [
              { kind: 'string', id: lastThrowVar('p2'), equals: t },
              ...(t === 'rock' ? [{ kind: 'string', id: lastThrowVar('p2'), equals: '' }] : []),
            ],
          }],
        },
      },
    } as EntityBlueprint;
  }
  return out;
}

/** `t` 这只手吃掉谁（`BEATEN_BY` 的逆表）。 */
const BEATS: Record<Hand, Hand> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };


function opponentRules(who: OpponentId): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  const lastIs = (h: Hand | ''): Record<string, unknown> => ({ kind: 'string', id: lastThrowVar('p2'), equals: h });
  const openingIsRock = (h: Hand): Record<string, unknown> =>
    h === 'rock' ? { kind: 'or', of: [lastIs('rock'), lastIs('')] } : lastIs(h);

  /** 该档在「上一手 = prev」时，蓄哪只手 / 出哪只手。 */
  const plan = (prev: Hand): { charge: Hand; throw: Hand } => {
    switch (who) {
      case 'brute':   return { charge: 'rock', throw: 'rock' };                       // 偏爱石头·永远石
      case 'actor':                                                                    // 蓄一手、出另一手
      case 'master':  return { charge: BEATEN_BY[prev], throw: prev };                // 蓄"克制上一手的手"当假动作，实际出上一手
      case 'gambler': return { charge: prev, throw: prev };                            // 押上一手（血低时靠满蓄放大·见 §赌徒）
      default:        return { charge: prev, throw: prev };                            // 复读机
    }
  };

  for (const h of HANDS) {
    const when = openingIsRock(h);
    const p = plan(h);
    out[`ai:charge:${h}`] = {
      EventWhen: {
        signal: aiChargeSignal(p.charge), mode: 'edge', armed: false,
        when: { kind: 'and', of: [{ kind: 'flag', id: CHARGING_GATE }, when] },
      },
    } as EntityBlueprint;
    out[`ai:throw:${h}`] = {
      EventWhen: {
        signal: throwSignal(p.throw), mode: 'edge', armed: false,
        source: 'p2',                                       // ← REQ-108-ENG-05：接缝据此认侧
        // 【R-108-33】前四档读的只有 `p2.lastThrow`（T2 里不会变），本来不会赖皮；
        // 但把五档统一挂在定手窗上，日后谁给某一档加一条读玩家的条件也不会静默破线。
        when: { kind: 'and', of: [{ kind: 'flag', id: DECIDE_GATE }, when] },
      },
    } as EntityBlueprint;
  }
  return out;
}

/**
 * 【R-108-02】**v3 作废了 v2 的「超时顺延」**（owner 2026-08-07）。
 *
 * v2：T2 不点 → 自动替玩家沿用上一回合的手（「不罚玩家、不卡节奏」）。
 * v3：T2 不点 → 走【R-108-04】罚血读秒，**卡到玩家出手为止**；T1 不点 = 这回合就是没蓄力。
 * 理由（owner 原话口径）：玩家有时需要思考，**给思考时间但要付代价**，比「到点替你决定」诚实。
 *
 * 所以这里原本那六条 `carry:*` 规则整组删掉了——留着会与罚血打架：
 * 免费段一到点它就替玩家提交，罚血条件 `threwFlag` 当场成立，**这一条永远罚不到人**。
 * v2 原文查 git 历史（本函数 2026-08-08 前的版本）。
 */

/**
 * 【R-108-20/21/22】烟雾——花一次次数，把自方三条槽对对手遮 2 回合；蓄力照常累积。
 * `t2-craft-recipe`：`smoke.use` 信号 + 扣 1 次次数 → 置隐藏旗；回合数由 `smokeTurns` 资源计，
 * 每次结算（`duel.resolved`）−1，归零时 self-rule 落旗。**全是数据，零游戏层 system。**
 */
function smokeWiring(): Record<string, EntityBlueprint> {
  const out: Record<string, EntityBlueprint> = {};
  out['smoke:p1'] = {
    CraftRecipe: {
      onSignal: ACT.smoke,
      costs: [{ id: SMOKE_RES('p1'), amount: 1 }],
      gains: [{ id: SMOKE_TURNS('p1'), amount: SMOKE_DURATION }],
      grantsFlag: SMOKE_FLAG('p1'),
    },
  } as EntityBlueprint;
  // 每次结算 −1 回合（duel.resolved 是判定表的 resolvedSignal）。
  out['smoke:tick'] = {
    Effect: { onSignal: 'duel.resolved', kind: 'modify-resource', targetId: SMOKE_TURNS('p1'), value: -1, op: 'add' },
  } as EntityBlueprint;
  // 回合数归零 → 落旗（读自身 → 施自身，按侧不串台）。
  out['smoke:res:p1'] = {
    Resource: { id: SMOKE_TURNS('p1'), current: 0, min: 0, max: SMOKE_DURATION },
    Flag: { id: SMOKE_FLAG('p1'), active: false },
    SelfRule: {
      when: { kind: 'resource', id: SMOKE_TURNS('p1'), cmp: 'lte', value: 0 },
      do: [{ kind: 'set-flag', targetId: SMOKE_FLAG('p1'), value: false }],
    },
  } as EntityBlueprint;
  out['smoke:uses:p1'] = { Resource: { id: SMOKE_RES('p1'), current: SMOKE_USES, min: 0, max: SMOKE_USES } } as EntityBlueprint;
  out['kb:smoke'] = { KeyBinding: { key: ACT.smoke, signal: ACT.smoke } } as EntityBlueprint;
  return out;
}

/** 【R-108-32】大师自带改写过的判定表（**静态 patches**·对局开始即生效·每拍重 fold）。 */
const MASTER_PATCHES = [
  // **整环反转**（石←→剪←→布 全反），而不是只让石多克一手——后者会让「石克布」与「布克石」
  // 同时成立，落盘门当场硬抛「同一格定不出胜负」（实测踩过，判词还直接给了修法）。
  { kind: 'beats', throw: 'rock', beats: ['paper'] },
  { kind: 'beats', throw: 'paper', beats: ['scissors'] },
  { kind: 'beats', throw: 'scissors', beats: ['rock'] },
];

export function buildBlueprint(opponent: OpponentId = 'parrot'): WorldBlueprint {
  const entities: Record<string, EntityBlueprint> = {
    duel: { DuelMatrix: duelMatrix(opponent) } as EntityBlueprint,
    flow: { GameFlow: duelFlow() } as EntityBlueprint,
    // 种子 PRNG：AI 抽招 / 破绽概率门一律走它——游戏层禁裸 Math.random（红线）。
    seed: { RandomSeed: { seed: 108 } } as EntityBlueprint,
    // 结算门旗（flow 的 onEnter 开关它·matrix-duel 的 Commit 接缝读它）。
    gate: { Flag: { id: SETTLE_GATE, active: false } } as EntityBlueprint,
    'gate:decide': { Flag: { id: DECIDE_GATE, active: false } } as EntityBlueprint,
    // 回合数（玩家视角复核第 5 问：得知道自己打到第几回合了）——每次结算 +1，纯数据。
    round: { Resource: { id: 'round', current: 1, min: 1, max: 99 } } as EntityBlueprint,
    'fx:round': { Effect: { onSignal: 'duel.resolved', kind: 'modify-resource', targetId: 'round', value: 1, op: 'add' } } as EntityBlueprint,
    'gate:charging': { Flag: { id: CHARGING_GATE, active: true } } as EntityBlueprint,
    'gate:throwing': { Flag: { id: THROWING_GATE, active: false } } as EntityBlueprint,
    // ── v3 新增的四面旗 + 两笔账 ─────────────────────────────────────────
    'gate:penalty': { Flag: { id: PENALTY_GATE, active: false } } as EntityBlueprint,
    'gate:next': { Flag: { id: NEXT_GATE, active: false } } as EntityBlueprint,
    // 玩家「本回合已出手」：一实体一组件，故旗与置旗的 Effect 分居两个实体。
    'flag:threw:p1': { Flag: { id: threwFlag('p1'), active: false } } as EntityBlueprint,
    'fx:threw:p1': { Effect: { onSignal: PLAYER_THREW, kind: 'set-flag', targetId: threwFlag('p1'), value: true } } as EntityBlueprint,
    'fx:next': { Effect: { onSignal: ACT.next, kind: 'set-flag', targetId: NEXT_GATE, value: true } } as EntityBlueprint,
    'debt:p1': { Resource: { id: penaltyDebtRes('p1'), current: 0, min: 0, max: 999 } } as EntityBlueprint,
    // 【R-108-04】罚血节拍旗（**必须真有这个实体**）：flow 的 `set-flag` 是「按 id 找到已有的 Flag 再改」，
    // 世界里没有同 id 的 Flag 就**静默什么都不做**——旗永不亮 ⇒ 屏上欠债一路涨、血条纹丝不动。
    // 接线第一版正是漏了它，验收剧本的 `p1.hp eq 96` 当场逮住（这就是那条断言存在的理由）。
    'flag:penaltyTick:p1': { Flag: { id: penaltyTickFlag('p1'), active: false } } as EntityBlueprint,
    // 【R-108-30】v4：**只有第五档大师**换成读牌 + 记忆的决策链（owner 2026-08-08 判 A）；
    // ①–④ 一格不动，保留可读破绽（前四档的教学曲线是支柱一的落点）。
    ...(opponent === 'master' ? masterRules() : opponentRules(opponent)),
    // 台账**所有档都记**——不然打了半天前四档，换到大师那一关它对你一无所知，
    // 「记忆更长所以更强」就成了空话。只是前四档**不读**它。
    ...habitTracking(),
    ...smokeWiring(),
    ...chargeEffects(),
    ...playerKeys(),
  };

  // 双方：血量各挂一份**同 id**（matrix-duel 的 hpResource 按侧 local 寻址）【R-108-15】。
  //
  // ⚠ **一实体一组件，`SelfRule` 只有一格**（实测：同 type 二次 addComponent 是覆盖不是并存）。
  // v3 要在**同一个 p1 身上**做两件都得碰自身的事：
  //   ① 【R-108-15】血归零 → 置本侧 dead 旗（**只读判断** + 写自身 Flag）
  //   ② 【R-108-04】罚血节拍 → 扣本侧 hp（**写自身 Resource**）
  // 那一格给 ②：**扣血只有自治规则做得到**——全局 Effect / CraftRecipe / flow 的 modify-resource
  // 一律是全局 id 路由，两侧同 id 分不清哪一侧（主程 2026-08-07 回驳单的等价写法即此）。
  // ① 则挪到 `watch:p1`，靠 `whenGlobal` 读全局条件（见该实体注释）。
  // p2 不需要罚血（AI 从不犹豫），它那一格照旧留给死亡判定，读的是**自身** hp，无歧义。
  for (const side of SIDES) {
    const isPlayer = side === 'p1';
    entities[side] = {
      Resource: { id: HP_RES, current: HP_MAX, min: 0, max: HP_MAX },
      ...(isPlayer
        ? {
          // 【R-108-04】罚血落到实处：`whenGlobal` 读**全局**节拍旗 → `do` 施于**自身** = 本侧那份 hp。
          // `when` 读自身 hp「还活着才罚」——血归零后不再往下扣（钳位之外的第二道）。
          // **不带 `once`**：once 的 armed 复位只看 `when` 不看 `whenGlobal`（后者为假是整条 continue，
          // armed 不动），节拍放 whenGlobal 会「罚第一次就再也不复位」——主程实测撞过，写进了回驳单。
          // 改用 level 模式 + 节拍旗只亮一拍，「一秒一点」由 flow 的两态互跳保证。
          SelfRule: {
            whenGlobal: { kind: 'flag', id: penaltyTickFlag(side) },
            when: { kind: 'resource', id: HP_RES, cmp: 'gt', value: 0 },
            do: [{ kind: 'modify-resource', value: -PENALTY_HP }],
          },
        }
        : {
          Flag: { id: deadFlag(side), active: false },
          // 读自身 hp（不是全局 id）→ 置自身那面唯一 flag：按侧判定在现有能力里的正解。
          SelfRule: {
            when: { kind: 'resource', id: HP_RES, cmp: 'lte', value: 0 },
            do: [{ kind: 'set-flag', targetId: deadFlag(side), value: true }],
            once: true,
          },
        }),
    } as EntityBlueprint;
  }
  /**
   * 【R-108-15】玩家侧的死亡看守（**另居一实体**·因为 p1 那格 SelfRule 让给了罚血）。
   *
   * `whenGlobal` 走**全局 id 路由**——两侧 hp 同 id，取的是「世界里第一个 id='hp' 的 Resource」。
   * 装配序 `SIDES = ['p1','p2']` ⇒ 那一个恒是 **p1**，正好是本看守要盯的那侧。
   * **这条依赖是显式的、且有点名测试钉着**（`game108.test.ts`「看守只盯 p1」：把 p2 打到 0
   * 断言 `p1.dead` 不动、把 p1 打到 0 断言它置位）——不是「碰巧能跑」的静默依赖。
   * 同样的写法对 p2 **不成立**（它也只会读到 p1），所以 p2 走自身那条路，见上。
   */
  entities['watch:p1'] = {
    Flag: { id: deadFlag('p1'), active: false },
    SelfRule: {
      whenGlobal: { kind: 'resource', id: HP_RES, cmp: 'lte', value: 0 },
      when: { kind: 'always' },
      do: [{ kind: 'set-flag', targetId: deadFlag('p1'), value: true }],
      once: true,
    },
  } as EntityBlueprint;

  for (const side of SIDES) {
    entities[`var:${side}`] = { StringVar: { id: lastThrowVar(side), value: '' } } as EntityBlueprint;
    // 【R-108-10】v3 蓄力额度：起手就发一份，**不等 T1 的 onEnter**——
    // flow 首帧才跑 `charge` 的 onEnter，起手值留 0 会让第一回合的第一次点击加 0（首局哑一拍）。
    entities[`budget:${side}`] = {
      Resource: { id: chargeBudgetRes(side), current: CHARGE_PER_ROUND, min: 0, max: CHARGE_PER_ROUND },
    } as EntityBlueprint;
    // 六条蓄力槽【R-108-03】：一实体一组件 → 槽必须另居实体（侧实体那份已被 hp 占）。
    for (const h of HANDS) {
      entities[chargeEntity(side, h)] = {
        Resource: { id: chargeRes(side, h), current: 0, min: 0, max: CHARGE_CAP },
      } as EntityBlueprint;
    }
  }

  return {
    capabilities: [
      resourceCapability, flagCapability, stringVariableCapability, randomCapability,
      eventWhenCapability, effectApplyCapability, keybindCapability, craftRecipeCapability,
      matrixDuelCapability, selfRuleCapability,
      flowCapability,
    ],
    entities,
  };
}
