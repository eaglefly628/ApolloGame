import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld } from '@engine/core/types.js';
import type { Tween, TweenEasing, Resource } from '@engine/protocol/components.js';

// tween —— B 轴"连续"柱：数值随时间朝目标缓动。
//
// 定步长：每帧 elapsed += 1，t = elapsed/duration ∈ [0,1]，value = from + (to-from)*ease(t)，
// 直接写到同实体上的目标字段。duration<=0 视为立即到 to。到点置 done=true 并锁定在 to。
// 缓动全用多项式（不碰 sin/cos）→ 确定性、存档重放一致。只驱动高价值字段（见 TweenTarget），
// 避开泛型字段寻址的复杂度；需要别的字段再按需扩 TweenTarget。
// 用途：立绘淡入(Color.alpha)、好感条平滑(Resource.current)、立绘滑入/镜头缓动(Transform.x/y)。

function ease(t: TweenEasing, x: number): number {
  switch (t) {
    case 'linear':
      return x;
    case 'easeIn':
      return x * x;
    case 'easeOut':
      return x * (2 - x);
    case 'easeInOut':
      return x < 0.5 ? 2 * x * x : 1 - ((-2 * x + 2) * (-2 * x + 2)) / 2;
  }
}

function writeField(world: IWorld, eid: string, target: Tween['target'], value: number): void {
  const dot = target.indexOf('.');
  const compType = target.slice(0, dot);
  const field = target.slice(dot + 1);
  const comp = world.getComponent(eid, compType) as Record<string, number> | undefined;
  if (!comp) return;
  if (compType === 'Resource') {
    // 尊重资源上下限，避免越界破坏 Resource 不变量。
    const r = comp as unknown as Resource;
    comp[field] = value < r.min ? r.min : value > r.max ? r.max : value;
  } else {
    comp[field] = value;
  }
}

export const tweenCapability = defineCapability({
  id: 't1-tween',
  version: '1.0.0',

  describe: {
    name: 'tween',
    summary: '数值随时间朝目标缓动：每帧推进 elapsed，按 easing 把同实体上的目标字段从 from 插到 to。',
    semantic: ['tier1', 'kinematic', 'interpolate', 'animation'],
    whenToUse:
      '需要某个数值平滑过渡时（淡入淡出 Color.alpha、好感条 Resource.current、滑入/镜头 Transform.x/y）。挂 Tween{target,from,to,duration,easing}；定步长、确定性。',
    examples: [
      '立绘淡入：Tween{ target:"Color.alpha", from:0, to:1, duration:30, easing:"easeOut" }',
      '好感条平滑到 45：Tween{ target:"Resource.current", from:30, to:45, duration:20, easing:"linear" }',
      '立绘滑入：Tween{ target:"Transform.x", from:-100, to:0, duration:24, easing:"easeInOut" }',
    ],
  },

  components: {
    provides: {
      Tween: {
        category: 'config',
        describe: '一段缓动：把同实体上的 target 字段在 duration 个 tick 内从 from 插值到 to。',
        fields: {
          target: { type: 'string', describe: '目标字段（Transform.x/y/rotation/scaleX/scaleY、Color.alpha、Resource.current）' },
          from: { type: 'number', describe: '起始值' },
          to: { type: 'number', describe: '目标值' },
          elapsed: { type: 'number', describe: '已过 tick 数（初始 0，每帧 +1）' },
          duration: { type: 'number', describe: '总 tick 数（<=0 立即到 to）' },
          easing: { type: 'string', describe: 'linear | easeIn | easeOut | easeInOut' },
          done: { type: 'boolean', describe: '是否已结束（初始 false）' },
        },
      },
    },
    reads: ['Tween'],
    writes: ['Transform', 'Color', 'Resource'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'tween',
      reads: ['Tween'],
      writes: ['Transform', 'Color', 'Resource'],
      consumes: [],
      execute(world) {
        for (const [eid] of world.query('Tween')) {
          const tw = world.getComponent<Tween>(eid, 'Tween')!;
          if (tw.done) {
            writeField(world, eid, tw.target, tw.to); // 锁定终值（幂等）
            continue;
          }
          tw.elapsed += 1;
          const raw = tw.duration <= 0 ? 1 : tw.elapsed / tw.duration;
          const t = raw < 0 ? 0 : raw > 1 ? 1 : raw;
          const value = tw.from + (tw.to - tw.from) * ease(tw.easing, t);
          writeField(world, eid, tw.target, value);
          if (tw.elapsed >= tw.duration) tw.done = true;
        }
      },
    },
  ],
});
