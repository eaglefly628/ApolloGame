import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld } from '@engine/core/types.js';
import type { Launch, Transform, Velocity } from '@engine/protocol/components.js';
import { nearestByTag } from '@skills/atoms/spatial-query/index.js';

// ═══════════════════════════════════════════════════════════════
//  launch —— 直线弹/抛射（②，ARPG 能力簇）。发射瞬间定一次方向 → 写一次 Velocity → 自删 Launch，
//  之后交 motion-apply 直飞（fire-and-forget）。暗黑火球/冰矛/弹幕多是这种。
//
//  评审回驳的一半：**追踪弹（homing，咬着目标飞）= steering(mode:seek) + Perception 已覆盖**（持续重定向），
//  不需要新能力。本能力只补**直线弹**——steering 是每帧重定向（会一直拐向目标），表达不了"朝发射时刻方向直飞"。
//
//  每个挂 Launch+Transform 的实体（通常是 prefab 刚展开的飞弹）：
//    ① 解方向：toward:'target' → 朝最近 targetMask 阵营（复用 spatial-query.nearestByTag）；
//             toward:'dir'   → 固定 (dirX,dirY)。
//    ② 写一次 Velocity = 单位方向 × speed（无 Velocity 则创建）。
//    ③ removeComponent('Launch')（一次性，之后 motion-apply 直飞；无目标 → fizzle：清 Launch+零速度，靠 lifetime 回收）。
//  定序：runsBefore motion-apply（先定速再积分）。确定性：sqrt/÷ 归一（IEEE 安全，同 steering）；nearestByTag id tie-break。
// ═══════════════════════════════════════════════════════════════

export const launchCapability = defineCapability({
  id: 't2-launch',
  version: '1.0.0',

  describe: {
    name: 'launch',
    summary: '直线弹：发射瞬间定方向(朝最近 targetMask 阵营 或 固定 dir)→ 写一次 Velocity → 自删 Launch → motion-apply 直飞。追踪弹用 steering。',
    semantic: ['tier2', 'projectile', 'combat', 'movement'],
    whenToUse:
      '火球/冰矛/弹幕等"发射即定向、之后直飞"的抛射。飞弹 prefab 挂 Launch{speed,toward,targetMask?/dir} + Velocity + Hitbox + Timer(life)，caster 生成即自发射。追踪弹改挂 Steering+Perception。',
    examples: [
      '朝最近敌人射火球：Launch{ speed:6, toward:"target", targetMask:ENEMY }',
      '固定方向弹幕：Launch{ speed:8, toward:"dir", dirX:1, dirY:0 }',
      '无目标 → fizzle（清 Launch + 零速度，靠 lifetime 回收）',
    ],
  },

  components: {
    provides: {
      Launch: {
        category: 'config',
        describe: '直线弹初速：发射瞬间定向→写一次 Velocity→自删。toward:target(朝最近 targetMask)/dir(固定 dirX,dirY)。',
        fields: {
          speed: { type: 'number', describe: '初速模长（单位/tick）' },
          toward: { type: 'string', describe: "'target'(朝最近 targetMask 阵营) | 'dir'(固定方向)" },
          targetMask: { type: 'number', describe: "toward:'target' 时索敌阵营（Tag.flags & targetMask）" },
          dirX: { type: 'number', describe: "toward:'dir' 时方向 X（会归一化）" },
          dirY: { type: 'number', describe: "toward:'dir' 时方向 Y（会归一化）" },
        },
      },
    },
    reads: ['Launch', 'Transform', 'Tag'],
    writes: ['Velocity', 'Launch'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'launch',
      runsBefore: ['motion-apply'],
      reads: ['Launch', 'Transform', 'Tag'],
      writes: ['Velocity', 'Launch'],
      consumes: [],
      execute(world: IWorld) {
        const ids = world.query('Launch', 'Transform').map(([id]) => id).sort();
        for (const id of ids) {
          const l = world.getComponent<Launch>(id, 'Launch')!;
          const t = world.getComponent<Transform>(id, 'Transform')!;

          let dx = 0;
          let dy = 0;
          if (l.toward === 'target') {
            const tid = nearestByTag(world, t.x, t.y, l.targetMask ?? 0, { excludeId: id });
            const tt = tid ? world.getComponent<Transform>(tid, 'Transform') : undefined;
            if (tt) {
              dx = tt.x - t.x;
              dy = tt.y - t.y;
            }
          } else {
            dx = l.dirX ?? 0;
            dy = l.dirY ?? 0;
          }

          let v = world.getComponent<Velocity>(id, 'Velocity');
          if (!v) {
            world.addComponent(id, { type: 'Velocity', vx: 0, vy: 0, angular: 0 } as Velocity);
            v = world.getComponent<Velocity>(id, 'Velocity')!;
          }
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            v.vx = (dx / dist) * l.speed;
            v.vy = (dy / dist) * l.speed;
          } else {
            v.vx = 0; // 无方向/无目标 → fizzle（零速度，靠 lifetime 回收）
            v.vy = 0;
          }
          world.removeComponent(id, 'Launch'); // 一次性：之后 motion-apply 直飞
        }
      },
    },
  ],
});
