import { defineCapability } from '@engine/core/define-capability.js';
import type { RandomSeed } from '@engine/protocol/components.js';

export type { RandomSeed };

// 确定性 PRNG (mulberry32)。推进 state.seed/sequence，返回 [0, 1)。
// 同一初始 seed 必产生同一序列 —— 确定性重放的基石。
export function nextRandom(state: RandomSeed): number {
  state.seed = (state.seed + 0x6d2b79f5) | 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  state.sequence += 1;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randomInt(state: RandomSeed, minInclusive: number, maxExclusive: number): number {
  return minInclusive + Math.floor(nextRandom(state) * (maxExclusive - minInclusive));
}

export const randomCapability = defineCapability({
  id: 'w1-random',
  version: '1.0.0',

  describe: {
    name: 'random',
    summary: '可控随机数。确定性重放的基石。',
    semantic: ['world-service', 'determinism'],
    whenToUse:
      '需要可复现随机时：掉落、散射、AI 抖动、过程生成。RandomSeed 挂在 world 实体，系统通过 nextRandom(seed) 取值并推进序列。相同 seed → 相同序列。',
    examples: ['掉落判定：nextRandom(seed) < dropRate', '弹幕散射：randomInt 选角度', '重放：存初始 seed 即可复现整局'],
  },

  components: {
    provides: {
      RandomSeed: {
        category: 'config',
        describe: '确定性随机数发生器状态。seed 为当前内部状态，sequence 记录取数次数。',
        fields: {
          seed: { type: 'number', describe: 'PRNG 内部状态（取数后推进）' },
          sequence: { type: 'number', describe: '已取数次数（调试/重放校验）' },
        },
      },
    },
    reads: [],
    writes: [],
    consumes: [],
  },

  config: {
    seed: { type: 'number', default: 1, describe: '初始种子', question: '随机种子？（相同种子复现同一局）', ui: { control: 'input' } },
  },

  systems: [],
});
