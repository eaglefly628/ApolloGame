import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase } from '@engine/core/types.js';
import type { Effect, Signal, Sensor, Visibility, DestroyRequest } from '@engine/protocol/components.js';
import { buildConditionLookup } from './condition.js';

// effect-apply —— Condition→Event→**Effect** 的 Effect 侧（链的合龙石）。
//
// 当本 tick 存在名为 Effect.onSignal 的 Signal 时，施加一个声明式效果（按 id 全局定位）：
//   - set-flag       ：把 Flag(id=targetId).active 设为 Boolean(value)
//   - modify-resource ：给 Resource(id=targetId).current 加 Number(value) 并钳进上下限
//   - set-state      ：把 State(fsmId=targetId).current 设为 String(value)
//
// 跑在 Commit 阶段（产信号的 event-when 在 Update）：这样 event-when→effect-apply 的先后由 phase
// 定序，且 effect 对 Flag/State/Resource 的写入由**下一 tick** 的条件读到（标准离散反馈，一拍延迟）。
// "信号 → 置 flag → 下帧条件读 flag → 再触发" 即让多步机制（连锁/开关→门）纯配置涌现。
// 确定性：只读/写确定状态、按 id 定位（与 Condition 读侧、resource 写侧对称），不碰浮点超越函数。
// 查找复用 buildConditionLookup 的按 id 索引（O(1)，Reviewer #3）。

export const effectApplyCapability = defineCapability({
  id: 't2-effect-apply',
  version: '1.0.0',

  describe: {
    name: 'effect-apply',
    summary: '信号在场时施加声明式效果（置 Flag / 改 Resource / 设 State，均按 id 全局定位）。Condition→Event→Effect 的 Effect 侧。',
    semantic: ['tier2', 'logic', 'effect'],
    whenToUse:
      '想让一个 Signal（由 event-when 产出）直接产生世界改动而不写游戏代码时。挂 Effect{onSignal,kind,targetId,value}。跑在 Commit，效果下一 tick 被条件读到（一拍反馈）。',
    examples: [
      '好感越 60 → 解锁告白：Effect{ onSignal:"S_love_60", kind:"set-flag", targetId:"S_confess_unlocked", value:true }',
      '踩到陷阱信号 → 扣血：Effect{ onSignal:"trap", kind:"modify-resource", targetId:"hp", value:-10 }',
      '两开关都开 → 推进剧情态：Effect{ onSignal:"both_switches", kind:"set-state", targetId:"story", value:"door_open" }',
      '踩开关 → 墙变可穿过（物理）：Effect{ onSignal:"plate_on", kind:"set-sensor", targetEntity:"wall_3", value:true }',
    ],
  },

  components: {
    provides: {
      Effect: {
        category: 'config',
        describe: '声明「当 onSignal 在场时施加的效果」。kind 决定改 Flag/Resource/State，targetId 按 id 全局定位。',
        fields: {
          onSignal: { type: 'string', describe: '触发该效果的信号名（event-when 产出的 Signal.name）' },
          kind: { type: 'string', describe: "逻辑:'set-flag'|'modify-resource'|'set-state'；物理(REQ-008):'set-sensor'|'set-visible'|'destroy'" },
          targetId: { type: 'string', describe: '逻辑 kind：Flag.id / Resource.id / State.fsmId（按 id 全局定位）' },
          targetEntity: { type: 'EntityId', describe: '物理 kind：set-sensor/set-visible/destroy 的目标实体 id' },
          value: { type: 'string', describe: 'modify-resource=数值增量；set-flag/set-sensor/set-visible=布尔；set-state=目标状态名；destroy 忽略' },
        },
      },
    },
    reads: ['Effect', 'Signal'],
    writes: ['Flag', 'Resource', 'State', 'Sensor', 'Visibility', 'DestroyRequest'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'effect-apply',
      phase: SystemPhase.Commit,
      reads: ['Effect', 'Signal'],
      writes: ['Flag', 'Resource', 'State', 'Sensor', 'Visibility', 'DestroyRequest'],
      consumes: [],
      execute(world) {
        // 收集本 tick 在场的信号名。
        const signals = new Set<string>();
        for (const [sid] of world.query('Signal')) {
          const s = world.getComponent<Signal>(sid, 'Signal');
          if (s) signals.add(s.name);
        }
        if (signals.size === 0) return;

        const lookup = buildConditionLookup(world);

        for (const [eid] of world.query('Effect')) {
          const ef = world.getComponent<Effect>(eid, 'Effect');
          if (!ef || !signals.has(ef.onSignal)) continue;

          switch (ef.kind) {
            case 'set-flag': {
              const f = lookup.flag(ef.targetId);
              // 显式布尔/字符串判定，避免 Boolean("false")===true 的 JS 陷阱（Reviewer Bug1）。
              if (f) f.active = ef.value === true || ef.value === 'true';
              break;
            }
            case 'modify-resource': {
              const r = lookup.resource(ef.targetId);
              if (r) {
                const next = r.current + Number(ef.value);
                r.current = next < r.min ? r.min : next > r.max ? r.max : next;
              }
              break;
            }
            case 'set-state': {
              const st = lookup.state(ef.targetId);
              if (st) st.current = String(ef.value);
              break;
            }
            // ── 物理 kind（REQ-008）：信号→物理改动，按 targetEntity 定位。补上"踩开关→门开"的最后一环。──
            case 'set-sensor': {
              // 给目标实体加/去 Sensor（非实心）→ collision-resolve 跳过它 = 可穿过（踩开关→墙变门）。
              if (ef.targetEntity) {
                const on = ef.value === true || ef.value === 'true';
                if (on) {
                  if (!world.hasComponent(ef.targetEntity, 'Sensor')) world.addComponent(ef.targetEntity, { type: 'Sensor' } as Sensor);
                } else {
                  world.removeComponent(ef.targetEntity, 'Sensor');
                }
              }
              break;
            }
            case 'set-visible': {
              // 切目标实体可见性（门消失/出现）。无 Visibility 则补一个。
              if (ef.targetEntity) {
                const visible = ef.value === true || ef.value === 'true';
                const vis = world.getComponent<Visibility>(ef.targetEntity, 'Visibility');
                if (vis) vis.visible = visible;
                else world.addComponent(ef.targetEntity, { type: 'Visibility', visible, active: true } as Visibility);
              }
              break;
            }
            case 'destroy': {
              // 发 DestroyRequest，destroy-apply 消费后移除目标实体（清障碍）。
              if (ef.targetEntity) world.addComponent(ef.targetEntity, { type: 'DestroyRequest', entityId: ef.targetEntity } as DestroyRequest);
              break;
            }
          }
        }
      },
    },
  ],
});
