import { defineCapability } from '@engine/core/define-capability.js';
import type { Frame } from '@engine/protocol/components.js';

// Tier 1（直接结算）：计时到点推进精灵帧。
// timer-advance 在实体上发 TimerDone（不自清，留给消费者）→ animation 消费它并推进 Frame.index。
// 读 Frame → 自动排在 timer-advance 之后；consume TimerDone：一次 fire 推进一帧。
export const animationCapability = defineCapability({
  id: 't1-animation',
  version: '1.0.0',
  describe: {
    name: 'animation',
    summary: '实体的计时器到点时推进 Frame.index（loop 环绕 total）。',
    semantic: ['tier1', 'animation'],
    whenToUse: '逐帧精灵动画。读 Frame+TimerDone，consume TimerDone，写 Frame，Update 阶段。',
    examples: ['行走循环帧', '爆炸序列帧'],
  },
  components: { provides: {}, reads: ['Frame', 'TimerDone'], writes: ['Frame'], consumes: ['TimerDone'] },
  config: {},
  systems: [
    {
      id: 'animation',
      reads: ['Frame', 'TimerDone'],
      writes: ['Frame'],
      consumes: ['TimerDone'],
      execute(world) {
        for (const [id] of world.query('Frame', 'TimerDone')) {
          const f = world.getComponent<Frame>(id, 'Frame')!;
          if (f.total > 0) f.index = (f.index + 1) % f.total;
        }
      },
    },
  ],
});
