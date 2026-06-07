import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase } from '@engine/core/types.js';
import type { IWorld } from '@engine/core/types.js';
import type { OverTime, Status, ResourceModify } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  over-time —— 限时/持续效果（D-003）。把"瞬时位掩码 Status / 一次性 ResourceModify"延展成
//  "随时间结算"的逐实体效果：DoT(中毒/燃烧)、regen(缓回血/蓝)、定时状态(冻结/眩晕到期自动解除)。
//
//  现有缺口（验证过）：`Status` 是无时长的瞬时位掩码（frost_nova 测试要手动 destroyEntity 才停冻）；
//  没有"非空间的、每 N tick 改资源"的通用机制（event-when 是全局-id、hitbox 要空间 Trigger）。
//  这条把那半补上——挂在受影响实体自身，逐实体、局部寻址，纯整数 tick 计数 → 确定性、录放一致。
//
//  每 tick（每个挂 OverTime 的实体）：
//    ① elapsed += 1。
//    ② 周期结算：resource 且 amountPerTick 且 elapsed 是 period 整数倍 → 发**局部** ResourceModify
//       (scope:'local') 到自身 → resource-apply 改自己的 Resource（逐目标，不串味）。
//    ③ 到期(duration>0 且 elapsed>=duration)：清 clearStatusOnEnd 位 + removeComponent('OverTime')
//       自销毁该组件（不毁实体——怪还活着，只是 buff/debuff 结束）。
//
//  定序：runsBefore resource-apply（与 hitbox 同纪律，本帧产的 ResourceModify 当帧结算）。
//  已知约束（R14 同源）：一实体一组件 → 同一 tick 同实体若同时被 hitbox 命中与 OverTime 结算，
//  后写的 ResourceModify 覆盖前者（少数同帧叠加场景）；周期错峰下罕见，记为债，待 R14"批改资源"演进。
// ═══════════════════════════════════════════════════════════════

export const overTimeCapability = defineCapability({
  id: 't2-over-time',
  version: '1.0.0',

  describe: {
    name: 'over-time',
    summary: '限时/持续效果：挂 OverTime 的实体每 period tick 对自身 resource 结算 amountPerTick（DoT/regen），到 duration 清 Status 位并自销毁组件。',
    semantic: ['tier2', 'combat', 'status', 'over-time'],
    whenToUse:
      'DoT(中毒/燃烧)、regen(缓回血)、定时状态(冻结/眩晕到期自动解除)。挂 OverTime{resource?,amountPerTick?,period,duration,elapsed:0,clearStatusOnEnd?}；常由 hitbox 命中时自动挂（statusDuration/dot* 字段）。',
    examples: [
      '燃烧 DoT：OverTime{ resource:"hp", amountPerTick:-5, period:30, duration:180 } → 每 0.5s 掉 5 血，持续 3s',
      '定时冻结：OverTime{ period:1, duration:120, clearStatusOnEnd:FROZEN } → 2s 后自动解冻（免手动清场）',
      '缓回蓝：OverTime{ resource:"mp", amountPerTick:1, period:10, duration:0(永久) }',
    ],
  },

  components: {
    provides: {
      OverTime: {
        category: 'effect',
        describe: '限时/持续效果：每 period tick 对自身 resource 改 amountPerTick；到 duration 清 clearStatusOnEnd 位并移除自身。',
        fields: {
          resource: { type: 'string', describe: '周期改的 Resource id（缺省=不改资源，纯定时状态）' },
          amountPerTick: { type: 'number', describe: '每 period 改的量（负=DoT，正=regen）' },
          period: { type: 'number', describe: '结算周期（每多少 tick 一次，>=1）' },
          duration: { type: 'number', describe: '总时长 tick（>0；<=0=永久）' },
          elapsed: { type: 'number', describe: '已过 tick（初始 0，每帧 +1）' },
          clearStatusOnEnd: { type: 'number', describe: '到期清自身 Status 的这些位（位掩码）' },
        },
      },
    },
    reads: ['OverTime', 'Status'],
    writes: ['ResourceModify', 'Status', 'OverTime'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'over-time',
      // Update 阶段产 ResourceModify；显式排在 resource-apply 之前（与 hitbox 同纪律），本帧产当帧结算。
      runsBefore: ['resource-apply'],
      reads: ['OverTime', 'Status'],
      writes: ['ResourceModify', 'Status', 'OverTime'],
      consumes: [],
      execute(world: IWorld) {
        // 按 id 升序（局部写本无顺序依赖，仍保持确定的遍历，便于录放比对）。
        const ids = world.query('OverTime').map(([id]) => id).sort();
        for (const id of ids) {
          const ot = world.getComponent<OverTime>(id, 'OverTime');
          if (!ot) continue;
          ot.elapsed += 1;

          // ② 周期结算（局部 ResourceModify 到自身）。
          if (ot.resource && ot.amountPerTick && ot.period >= 1 && ot.elapsed % ot.period === 0) {
            world.addComponent(id, {
              type: 'ResourceModify',
              resourceId: ot.resource,
              amount: ot.amountPerTick,
              scope: 'local',
            } as ResourceModify);
          }

          // ③ 到期：清 Status 位 + 自销毁组件（不毁实体）。
          if (ot.duration > 0 && ot.elapsed >= ot.duration) {
            if (ot.clearStatusOnEnd) {
              const st = world.getComponent<Status>(id, 'Status');
              if (st) st.flags &= ~ot.clearStatusOnEnd;
            }
            world.removeComponent(id, 'OverTime');
          }
        }
      },
    },
  ],
});
