// Game K · Zombie Slots —— 世界 = 纯数据（WorldBlueprint）。零老虎机专属系统代码。
//
//   转轴   = 15 颗骰（5×3 网格·列优先）DicePool + 世界 RandomSeed → dice-roll 掷出 RolledDice（确定性）
//   判线赔付 = SlotMachine（赔付线/表/百搭/分散/经济/免费旋转数据）→ t3-slot-payout 解算（扣注·记赢·写 LineWins）
//   触发   = SPIN/BET 按钮 action → KeyBinding → Signal（spin/betup/betdown）→ dice-roll & slot-payout 消费
//   经济   = f1-resource（balance/bet/win/freespins）
// 能力总览：docs/design/game-k/capability-plan.md。
import type { WorldBlueprint } from '../../assembly/demo.assembly.js';
import { resourceCapability, randomCapability } from '@atom-skills/index.js';
import { keybindCapability, diceRollCapability } from '@skills/tier2/index.js';
import { slotPayoutCapability } from '@skills/tier3/index.js';
import type { DieSpec } from '@engine/protocol/components.js';
import {
  SYM, PAYTABLE, SCATTER_PAY, PAYLINES, REELS, ROWS, REEL_WEIGHTS,
  START_BALANCE, BET_MIN, BET_MAX, BET_STEP, DEFAULT_BET,
  SCATTER_MIN, FREE_AWARD, FREE_MULTIPLIER, SEED,
} from './theme.js';

// 15 颗骰：cell(reel r, row y) 下标 = r*ROWS+y（列优先）。每列三格共用该列权重（独立轮模型）。
function buildDice(): DieSpec[] {
  const dice: DieSpec[] = [];
  for (let r = 0; r < REELS; r++) {
    const faces = REEL_WEIGHTS[r].map((value) => ({ value }));
    for (let y = 0; y < ROWS; y++) dice.push({ faces });
  }
  return dice;
}

export function buildBlueprint(): WorldBlueprint {
  const entities: Record<string, Record<string, unknown>> = {
    // ── 世界单例 PRNG（固定种子·确定性；序列逐旋进位 → 局内各旋不同结果）──
    rng: { RandomSeed: { seed: SEED, sequence: 0 } },

    // ── 转轴（骰池）──
    reels: { DicePool: { dice: buildDice(), rollOnSignal: 'spin' } },

    // ── 经济资源 ──
    balance: { Resource: { id: 'balance', current: START_BALANCE, min: 0, max: 99999999 } },
    bet: { Resource: { id: 'bet', current: DEFAULT_BET, min: BET_MIN, max: BET_MAX } },
    win: { Resource: { id: 'win', current: 0, min: 0, max: 99999999 } },
    freespins: { Resource: { id: 'freespins', current: 0, min: 0, max: 999 } },

    // ── 机器（判线赔付 + 老虎机经济）──
    machine: {
      SlotMachine: {
        source: 'reels',
        reels: REELS,
        rows: ROWS,
        lines: PAYLINES,
        pay: PAYTABLE as unknown as Record<string, Record<string, number>>,
        wild: SYM.WILD,
        scatter: SYM.SCAT,
        scatterMin: SCATTER_MIN,
        scatterPay: SCATTER_PAY as unknown as Record<string, number>,
        spinSignal: 'spin',
        betResource: 'bet',
        balanceResource: 'balance',
        winResource: 'win',
        freeResource: 'freespins',
        freeAward: FREE_AWARD,
        freeMultiplier: FREE_MULTIPLIER,
        betUpSignal: 'betup',
        betDownSignal: 'betdown',
        betStep: BET_STEP,
        betMin: BET_MIN,
        betMax: BET_MAX,
      },
    },

    // ── 按键映射（action → Signal）──
    'kb-spin': { KeyBinding: { key: 'spin', signal: 'spin' } },
    'kb-betup': { KeyBinding: { key: 'betup', signal: 'betup' } },
    'kb-betdown': { KeyBinding: { key: 'betdown', signal: 'betdown' } },
  };

  return {
    capabilities: [
      resourceCapability,
      randomCapability,
      keybindCapability,
      diceRollCapability,
      slotPayoutCapability,
    ],
    entities,
  };
}
