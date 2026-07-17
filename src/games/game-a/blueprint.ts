// Game A ·《掼蛋夜宴》—— 牌桌世界蓝图 = 纯数据（WorldBlueprint·S3 骨架关）。
// 骨架语义（capability-plan §2 实名消费·「能存必须能跑」编译期等价）：
//   牌库/手牌  = t2-card-pile ×5（庄桌一份持 108 全牌 + 四家各一份空手·发牌=S4 玩法关）
//   run 状态   = Resource（生涯钱包/底注/盘数/两队级数/四家服饰档）← gdd §3/§4
//   盘间流程   = t3-flow GameFlow：boot →(2 tick)→ table-idle（真轮转状态机=S4·A-004 对照后展开）
//   确定性     = RandomSeed 单例（一切随机的唯一源·S4 发牌 seededShuffle 消费）
//   输入闸     = Flag can-act（骨架关闸·S4 出牌轮开闸）
// 判型不进 world：t3-hand-pattern 是纯函数解释器（无 ECS 系统），S4 由出牌链/AI 直接调用，
// config 数据在 rules.ts guandanConfig()。
import type { WorldBlueprint, EntityBlueprint } from '../../assembly/demo.assembly.js';
import { resourceCapability, flagCapability, randomCapability } from '@atom-skills/index.js';
import { cardPileCapability } from '@skills/tier2/index.js';
import { flowCapability } from '@skills/tier3/index.js';
import { buildDeck108, SEATS, INITIAL_FUNDS, LEVEL_START, DRESS_TIERS } from './rules.js';

export interface TableOptions {
  seed: number; // run 种子（存档随 run 快照·S4 接）
  stake?: number; // 底注（选桌 SC-2 落定·骨架默认 100）
}

/** 一张牌桌（一个 run）→ 可运行世界（纯数据·引擎 load + tick 即活）。 */
export function buildTableBlueprint(opts: TableOptions): WorldBlueprint {
  const stake = opts.stake ?? 100;
  const entities: Record<string, EntityBlueprint> = {};

  // ── 确定性随机源（单例·裸 Math.random=红线）─────────────────────────────────
  entities.rng = { RandomSeed: { seed: opts.seed, sequence: 0 } };

  // ── 牌库与四家手牌（card-pile·骨架=庄桌持全牌未发）───────────────────────────
  entities['pile-dealer'] = {
    CardPile: { owner: 'dealer', deck: buildDeck108(), hand: [], handSize: 0 },
  };
  for (const seat of SEATS) {
    entities[`pile-${seat.id}`] = {
      CardPile: { owner: seat.id, deck: [], hand: [], handSize: 0 },
    };
  }

  // ── run 状态资源（gdd §3/§4·一项一实体）────────────────────────────────────
  entities.wallet = { Resource: { id: 'wallet', current: INITIAL_FUNDS, min: 0, max: 9_999_999 } };
  entities.stake = { Resource: { id: 'stake', current: stake, min: 0, max: 9_999 } };
  entities.round = { Resource: { id: 'round', current: 1, min: 1, max: 999 } };
  entities['level-ours'] = { Resource: { id: 'level-ours', current: LEVEL_START, min: 2, max: 14 } };
  entities['level-theirs'] = { Resource: { id: 'level-theirs', current: LEVEL_START, min: 2, max: 14 } };
  for (const seat of SEATS) {
    entities[`dress-${seat.id}`] = {
      Resource: { id: `dress-${seat.id}`, current: DRESS_TIERS, min: 0, max: DRESS_TIERS },
    };
  }

  // ── 输入闸（骨架关死·S4 出牌轮 flow onEnter 开闸）───────────────────────────
  entities['can-act'] = { Flag: { id: 'can-act', active: false } };

  // ── 盘间流程骨架（声明式状态机·真轮转=S4 展开：发牌→[进贡]→打牌→结算→run 判定）──
  entities.flow = {
    GameFlow: {
      id: 'table',
      current: 'boot',
      states: [
        { id: 'boot', transitions: [{ after: 2, to: 'table-idle' }] },
        { id: 'table-idle', transitions: [] },
      ],
    },
  };

  return {
    capabilities: [resourceCapability, flagCapability, randomCapability, cardPileCapability, flowCapability],
    entities,
  };
}
