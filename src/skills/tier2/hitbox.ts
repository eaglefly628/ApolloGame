import { defineCapability } from '@engine/core/define-capability.js';
import type { IWorld } from '@engine/core/types.js';
import type { Trigger, Hitbox, Tag, Status, Resource, ResourceModify, OverTime } from '@engine/protocol/components.js';

// ═══════════════════════════════════════════════════════════════
//  hitbox —— 关系型战斗核心（ARPG 能力簇）。把"攻击判定命中 → 对命中目标结算"变成纯数据。
//
//  复用 trigger-zone（不重走 Overlap）：伤害区实体标 ZONE_FLAG → trigger-zone 产
//  Trigger{zone:hitbox, other:目标}。本能力读 Trigger，对每个 other（目标）：
//    ① 阵营过滤：hb.targetMask 非 0 时要求 target.Tag.flags & targetMask（friend/foe）。
//    ② 状态门　：hb.requireMask 非 0 时要求 target.Status.flags 含齐这些位（如碎冰要求 frozen）。
//    ③ 伤害　　：dmg = hb.amount + floor(target.maxOf(resource) * fracOfMax)；以**局部**
//        ResourceModify(scope:'local') 挂到 target → resource-apply 改 target 自己的 Resource（逐目标）。
//    ④ 状态　　：setMask 置位、clearMask 清位 target.Status（set frozen / clear frozen）。
//
//  一口气覆盖 ARPG 五缺口：接触→伤害(1) / 逐目标(2) / 计算数值(3) / 阵营过滤(4) /
//  AOE fan-out(5：一个伤害区重叠 N 目标 → N 个 Trigger → 各自结算)。
//  确定性：只读 Trigger/Tag/Status/Resource + 位运算/整数算术，无浮点超越函数 → 单端录放一致。
//  定序：runsAfter trigger-zone（要 Trigger 已就绪）、runsBefore resource-apply（产 ResourceModify）。
//  burst vs 持续：瞬时 nova 用短 Timer（命中一拍即销毁）；持续火环靠长寿命每拍结算（生命周期控制）。
//
//  已知约束（R14 同源）：一实体一组件 → 同一目标同一 tick 被多个 hitbox 命中时，后写的 ResourceModify
//  覆盖前者（少数同帧多 AOE 叠加场景）。瞬时技能逐拍单发不触发；批量叠加待 R14 的"批改资源"演进。
// ═══════════════════════════════════════════════════════════════

function maxOf(world: IWorld, entity: string, resourceId: string): number {
  const r = world.getComponent<Resource>(entity, 'Resource');
  return r && r.id === resourceId ? r.max : 0;
}

export const hitboxCapability = defineCapability({
  id: 't2-hitbox',
  version: '1.0.0',

  describe: {
    name: 'hitbox',
    summary: '攻击判定命中结算：读 Trigger（伤害区→目标），按 Tag 阵营 + Status 门过滤，对命中目标施局部伤害（含 % max 计算伤害）+ 置/清 Status 位。',
    semantic: ['tier2', 'combat', 'damage'],
    whenToUse:
      'ARPG/动作/塔防/弹幕的伤害结算。伤害区挂 Hitbox + Shape + Sensor + Tag(含 ZONE_FLAG)；目标挂 Tag(阵营) + Resource(hp) + 可选 Status。整套战斗 = 数据，无游戏代码。',
    examples: [
      '冰霜新星：Hitbox{ resource:"hp", amount:5, targetMask:ENEMY, setMask:FROZEN } → 命中所有敌人，扣血 + 冻结',
      '碎冰重锤：Hitbox{ resource:"hp", fracOfMax:0.2, targetMask:ENEMY, requireMask:FROZEN, clearMask:FROZEN } → 只对冰冻敌人结算 20% maxHP 真伤并解冻',
      'AOE：一个伤害区与 N 个敌人重叠 → N 个 Trigger → 各自结算（fan-out）',
    ],
  },

  components: {
    provides: {
      Hitbox: {
        category: 'config',
        describe: '攻击判定：对进入的目标按阵营/状态过滤后施伤害（固定 amount 或 fracOfMax 计算）+ 置/清 Status。',
        fields: {
          resource: { type: 'string', describe: '目标身上要改的 Resource id（如 hp）' },
          amount: { type: 'number', describe: '固定伤害（正数 = 伤害，内部按负向施加）' },
          fracOfMax: { type: 'number', describe: '计算伤害 = 目标该资源 max 的此分数（0.2 = 20%）' },
          targetMask: { type: 'number', describe: '仅作用于 Tag.flags 含此位的目标（阵营过滤；0 = 不限）' },
          requireMask: { type: 'number', describe: '仅作用于 Status.flags 含齐此位的目标（如 frozen）' },
          setMask: { type: 'number', describe: '命中后给目标 Status 置这些位' },
          clearMask: { type: 'number', describe: '命中后清目标 Status 这些位' },
          statusDuration: { type: 'number', describe: '>0：命中置 setMask 后过 N tick 自动清除（挂 OverTime，定时冻结/眩晕）' },
          dotPerTick: { type: 'number', describe: '>0：每 dotPeriod tick 对目标 resource 造成此真伤（中毒/燃烧 DoT，挂 OverTime）' },
          dotPeriod: { type: 'number', describe: 'DoT 结算周期 tick（缺省 1）' },
          dotDuration: { type: 'number', describe: 'DoT 总时长 tick' },
        },
      },
    },
    reads: ['Trigger', 'Hitbox', 'Tag', 'Status', 'Resource'],
    writes: ['ResourceModify', 'Status', 'OverTime'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'hitbox',
      reads: ['Trigger', 'Hitbox', 'Tag', 'Status', 'Resource'],
      writes: ['ResourceModify', 'Status', 'OverTime'],
      consumes: [],
      runsAfter: ['trigger-zone'],
      // 先施加伤害/状态/挂 OverTime，再让 over-time tick 既有状态效果，最后 resource-apply 结算。
      // hitbox 与 over-time 都 read-modify-write Status → 组件拓扑互为前驱=环，显式定序打破（R10 同法）。
      runsBefore: ['resource-apply', 'over-time'],
      execute(world: IWorld) {
        for (const [tid] of world.query('Trigger')) {
          const trig = world.getComponent<Trigger>(tid, 'Trigger')!;
          const hb = world.getComponent<Hitbox>(trig.zone, 'Hitbox');
          if (!hb) continue;
          const target = trig.other;

          // ① 阵营过滤
          if (hb.targetMask) {
            const tag = world.getComponent<Tag>(target, 'Tag');
            if (!tag || (tag.flags & hb.targetMask) === 0) continue;
          }
          // ② 状态门
          if (hb.requireMask) {
            const st = world.getComponent<Status>(target, 'Status');
            if (!st || (st.flags & hb.requireMask) !== hb.requireMask) continue;
          }
          // ③ 伤害（固定 + 计算），局部寻址到目标自身
          let dmg = hb.amount ?? 0;
          if (hb.fracOfMax) dmg += Math.floor(maxOf(world, target, hb.resource) * hb.fracOfMax);
          if (dmg !== 0) {
            world.addComponent(target, { type: 'ResourceModify', resourceId: hb.resource, amount: -dmg, scope: 'local' } as ResourceModify);
          }
          // ④ Status 置/清位
          if (hb.setMask || hb.clearMask) {
            let st = world.getComponent<Status>(target, 'Status');
            if (!st) {
              world.addComponent(target, { type: 'Status', flags: 0 } as Status);
              st = world.getComponent<Status>(target, 'Status')!;
            }
            if (hb.setMask) st.flags |= hb.setMask;
            if (hb.clearMask) st.flags &= ~hb.clearMask;
          }
          // ⑤ 时间维度（D-003 集成）：命中时挂 OverTime，把瞬时命中延展成持续效果。
          //    一实体一 OverTime（R14 同源），故 DoT 与"定时状态清除"二选一：有 DoT 配置则挂 DoT，
          //    否则挂"setMask 定时自动清除"（如定时冻结 → N tick 后自动解冻，免手动清场）。
          if (hb.dotPerTick && hb.dotDuration) {
            world.addComponent(target, {
              type: 'OverTime',
              resource: hb.resource,
              amountPerTick: -hb.dotPerTick,
              period: hb.dotPeriod ?? 1,
              duration: hb.dotDuration,
              elapsed: 0,
            } as OverTime);
          } else if (hb.statusDuration && hb.setMask) {
            world.addComponent(target, {
              type: 'OverTime',
              period: 1,
              duration: hb.statusDuration,
              elapsed: 0,
              clearStatusOnEnd: hb.setMask,
            } as OverTime);
          }
        }
      },
    },
  ],
});
