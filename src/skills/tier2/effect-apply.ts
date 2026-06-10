import { defineCapability } from '@engine/core/define-capability.js';
import { SystemPhase } from '@engine/core/types.js';
import type { Effect, Signal, Sensor, Visibility, DestroyRequest, Timer, Tag } from '@engine/protocol/components.js';
import { buildConditionLookup } from './condition.js';
import { findScoreTrace, appendScoreEvent } from '../score-trace.js';

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
      'Balatro 小丑 ×Mult(REQ-012)：Effect{ onSignal:"score", kind:"modify-resource", targetId:"mult", op:"mul", value:1.5, order:3 }（order 保证先加后乘）',
      'Balatro 最终计分 score += chips×mult(REQ-013)：Effect{ onSignal:"commit", kind:"modify-resource", targetId:"score", op:"add", valueFrom:{ resourceId:"chips", timesResourceId:"mult" } }',
      'Bull「每 $1 +2 筹码」(REQ-013)：Effect{ onSignal:"score", kind:"modify-resource", targetId:"chips", op:"add", valueFrom:{ resourceId:"money", coeff:2 } }',
      '限时门(REQ-009)：踩开关 → 重置/启动计时器：Effect{ onSignal:"plate_on", kind:"reset-timer", targetEntity:"door_timer", value:120 }（elapsed=0、duration=120）→ 配 condition(timer gte 120)→关门',
    ],
  },

  components: {
    provides: {
      Effect: {
        category: 'config',
        describe: '声明「当 onSignal 在场时施加的效果」。kind 决定改 Flag/Resource/State，targetId 按 id 全局定位。',
        fields: {
          onSignal: { type: 'string', describe: '触发该效果的信号名（event-when 产出的 Signal.name）' },
          kind: { type: 'string', describe: "逻辑:'set-flag'|'modify-resource'|'set-state'；物理(REQ-008):'set-sensor'|'set-visible'|'destroy'；批量(REQ-F-032):'destroy-tagged'(value=Tag掩码,清场)；时序(REQ-009):'reset-timer'" },
          targetId: { type: 'string', describe: '逻辑 kind：Flag.id / Resource.id / State.fsmId（按 id 全局定位）' },
          targetEntity: { type: 'EntityId', describe: '物理/时序 kind：set-sensor/set-visible/destroy/reset-timer 的目标实体 id' },
          value: { type: 'string', describe: 'modify-resource=数值；set-flag/set-sensor/set-visible=布尔；set-state=目标状态名；destroy 忽略' },
          op: { type: 'string', describe: "modify-resource 运算(REQ-012)：'add'(默认,current+value)|'mul'(current*value,×倍率)|'set'(=value)" },
          order: { type: 'number', describe: '结算顺序(REQ-012)：同信号命中的 Effect 按 order 升序依次结算（缺省 0）。乘法依赖顺序时必填。' },
          valueFrom: { type: 'string', describe: "动态值(REQ-013)：{resourceId,coeff?,timesResourceId?}，v=资源×(另一资源|系数)。解 score+=chips×mult、每$1+2c；缺省用静态 value" },
        },
      },
    },
    reads: ['Effect', 'Signal', 'Timer', 'Tag'],
    writes: ['Flag', 'Resource', 'State', 'Sensor', 'Visibility', 'DestroyRequest', 'Timer'],
    consumes: [],
  },

  config: {},

  systems: [
    {
      id: 'effect-apply',
      phase: SystemPhase.Commit,
      reads: ['Effect', 'Signal', 'Timer', 'Tag'],
      writes: ['Flag', 'Resource', 'State', 'Sensor', 'Visibility', 'DestroyRequest', 'Timer'],
      consumes: [],
      execute(world) {
        // 收集本 tick 在场的信号名 + 各名的 source 实体列表（REQ-F-041：'@signal-source' 寻址用；query 序确定）。
        const signals = new Set<string>();
        const sources = new Map<string, string[]>();
        for (const [sid] of world.query('Signal')) {
          const s = world.getComponent<Signal>(sid, 'Signal');
          if (s) {
            signals.add(s.name);
            const list = sources.get(s.name);
            if (list) list.push(s.source); else sources.set(s.name, [s.source]);
          }
        }
        if (signals.size === 0) return;
        // 目标解析（REQ-F-041）：targetEntity='@signal-source' → 触发信号的 source 实体（可多个，如同拍点两个席位）。
        // 「点谁卖谁/点谁选谁」的指针标配寻址——运行时实例 id 装配期不可知，信号源是唯一的数据可达句柄。
        const targetsOf = (ef: Effect): string[] =>
          ef.targetEntity === '@signal-source' ? (sources.get(ef.onSignal) ?? []) : ef.targetEntity ? [ef.targetEntity] : [];

        const lookup = buildConditionLookup(world);

        // REQ-012：收集本 tick 命中的 Effect，按 order **升序**（并列按 eid tie-break）依次结算。
        // 乘法（×mult）引入顺序依赖 → 结算顺序须是显式数据；modify-resource 就地连写 r.current，按此序天然有序确定。
        const hits: Array<{ eid: string; ef: Effect }> = [];
        for (const [eid] of world.query('Effect')) {
          const ef = world.getComponent<Effect>(eid, 'Effect');
          if (ef && signals.has(ef.onSignal)) hits.push({ eid, ef });
        }
        hits.sort((a, b) => (a.ef.order ?? 0) - (b.ef.order ?? 0) || (a.eid < b.eid ? -1 : a.eid > b.eid ? 1 : 0));

        // REQ-019：opt-in 计分 trace（仅当世界有 ScoreTrace 单例；限 modify-resource 数值步，redline）。
        const trace = findScoreTrace(world);

        for (const { eid, ef } of hits) {
          switch (ef.kind) {
            case 'set-flag': {
              const f = lookup.flag(ef.targetId);
              // 显式布尔/字符串判定，避免 Boolean("false")===true 的 JS 陷阱（Reviewer Bug1）。
              if (f) f.active = ef.value === true || ef.value === 'true';
              break;
            }
            case 'modify-resource': {
              // REQ-012：op 决定运算 —— add(默认 current+value) / mul(current*value，×倍率) / set(value)；钳进 [min,max]。
              const r = lookup.resource(ef.targetId);
              if (r) {
                // REQ-013：valueFrom 在场 → v 取自资源（量纲动态值 / 两资源相乘），否则用静态 value。
                //   v = resource[resourceId].current × (timesResourceId ? resource[timesResourceId].current : coeff ?? 1)
                // 解最终计分 score += chips×mult、Bull 每$1+2c、星球升级 chips += level×增量。缺资源按 0 处理（无效=不动）。
                let v: number;
                if (ef.valueFrom) {
                  const base = lookup.resource(ef.valueFrom.resourceId)?.current ?? 0;
                  const factor = ef.valueFrom.timesResourceId
                    ? (lookup.resource(ef.valueFrom.timesResourceId)?.current ?? 0)
                    : (ef.valueFrom.coeff ?? 1);
                  v = base * factor;
                } else {
                  v = Number(ef.value);
                }
                const next = ef.op === 'mul' ? r.current * v : ef.op === 'set' ? v : r.current + v;
                r.current = next < r.min ? r.min : next > r.max ? r.max : next;
                // REQ-019：记一步（target/op/本步量 v/本步后值/来源=Effect 实体 id）。UI 据 target/source 演出小丑抖动。
                appendScoreEvent(trace, 'effect', ef.targetId, (ef.op ?? 'add') as 'set' | 'add' | 'mul', v, r.current, eid);
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
              const on = ef.value === true || ef.value === 'true';
              for (const te of targetsOf(ef)) {
                if (on) {
                  if (!world.hasComponent(te, 'Sensor')) world.addComponent(te, { type: 'Sensor' } as Sensor);
                } else {
                  world.removeComponent(te, 'Sensor');
                }
              }
              break;
            }
            case 'set-visible': {
              // 切目标实体可见性（门消失/出现）。无 Visibility 则补一个。
              const visible = ef.value === true || ef.value === 'true';
              for (const te of targetsOf(ef)) {
                const vis = world.getComponent<Visibility>(te, 'Visibility');
                if (vis) vis.visible = visible;
                else world.addComponent(te, { type: 'Visibility', visible, active: true } as Visibility);
              }
              break;
            }
            case 'destroy': {
              // 发 DestroyRequest，destroy-apply 消费后移除目标实体（清障碍/点谁卖谁）。
              for (const te of targetsOf(ef)) {
                if (!world.hasComponent(te, 'DestroyRequest')) {
                  world.addComponent(te, { type: 'DestroyRequest', entityId: te } as DestroyRequest);
                }
              }
              break;
            }
            // ── destroy-tagged（REQ-F-032 清场）：value=Tag 掩码，命中者全部发自销毁请求。运行时展开
            // 的实例 id 装配期不可知 → 单 targetEntity 寻址不可用，按 Tag 批量是唯一数据寻址。集合语义
            // 与遍历序无关；挂件由 hierarchy-cascade 级联；Commit 写请求 → 次拍 destroy-apply 统一移除。──
            case 'destroy-tagged': {
              const mask = Number(ef.value);
              if (Number.isFinite(mask) && mask !== 0) {
                for (const [tid] of world.query('Tag')) {
                  const tg = world.getComponent<Tag>(tid, 'Tag');
                  if (tg && (tg.flags & mask) !== 0 && !world.hasComponent(tid, 'DestroyRequest')) {
                    world.addComponent(tid, { type: 'DestroyRequest', entityId: tid } as DestroyRequest);
                  }
                }
              }
              break;
            }
            // ── reset-timer（REQ-009）：事件→重置/启动计时器。按 targetEntity 定位 Timer，elapsed=0
            // （从此刻重新计时）；value 给了数值则一并设 duration。配 condition(timer gte N)→event-when→effect
            // 即"踩下那刻起 N 拍自动关门/塌陷"等限时机制纯数据涌现。──
            case 'reset-timer': {
              for (const te of targetsOf(ef)) {
                const t = world.getComponent<Timer>(te, 'Timer');
                if (t) {
                  t.elapsed = 0;
                  const d = Number(ef.value);
                  if (Number.isFinite(d) && d > 0) t.duration = d;
                }
              }
              break;
            }
          }
        }
      },
    },
  ],
});
