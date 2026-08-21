import { describe, it, expect, vi } from 'vitest';
import { World } from '@engine/core/world.js';
import type { CapabilityDefinition } from '@engine/core/define-capability.js';
import type { Transform, Tag, Velocity, Launch, Timer, SelfRule, PrefabLibrary, PrefabTemplate } from '@engine/protocol/components.js';
import { launchCapability } from './launch.js';
import { steeringCapability } from './steering.js';
import { selfRuleCapability } from './self-rule.js';
import { motionApplyCapability } from '../tier1/motion-apply.js';
import { lifetimeCapability } from '../tier1/lifetime.js';
import { prefabCapability } from '../tier3/prefab.js';
import { aggroCapability } from '../tier3/aggro.js';
import { timerCapability } from '@atom-skills/timer/index.js';
import { destroyCapability } from '@atom-skills/destroy/index.js';

// ═══════════════════════════════════════════════════════════════
//  game-103 BUG-03 尾巴「干净往返段」——重组证明（Lead 实查回驳·2026-08-21·
//  同 conveyor-queue-compose.test.ts / self-rule.test.ts「罚血形态·回驳证明」先例）。
//
//  举证（docs/design/game-103/requests.md BUG-03）：「若现有能力表达不了干净往返，
//  走 capgap（弹道 out-return 段）」。**实查证伪，wontfix·不开引擎单**：
//
//  ① 举证的根因口径已过期：Launch 是一次性的（launch.ts ①~③：发射拍写一次 Velocity
//     即 removeComponent 自删），「Launch 与 Steering 每 tick 都写 Velocity 相互抵消」
//     不成立——打架来自把 Steering(seek 玩家) 从第 0 拍就挂上，出程被逐拍覆写。
//  ② 相位切换的全部词表已在架：ConditionExpr 有 timer 叶（self-rule.ts case 'timer'：
//     cmp(Timer.elapsed)）；SelfAction 有 spawn（SpawnRequest at self）；TimerDone 由
//     生产者自清、多消费者共读（timer BUG-003 修）。
//  ③ 等价数据写法 = **两段接力**（本文件即可执行证明）：
//     出程弹 = Launch{toward:'dir'} + Timer{id:'life'} + SelfRule{when: timer≥N →
//              spawn 返程模板@self, once} + lifetime（同一只 Timer 两用：elapsed≥N 触发
//              接力、duration 到点 TimerDone 自毁——接力先于自毁，无同拍 spawn/destroy 竞态）
//     返程弹 = prefab 模板：Perception+Steering{seek}（aggro 锁玩家 Tag）→ 追**移动中的**
//              玩家。固定 waypoint 的 PathFollow 表达不了这半段（玩家在走），故选接力而非轨道。
//  game-103 接线参照：返程模板补 Hitbox/贴身 lifetime 即成品；数值全是数据。
// ═══════════════════════════════════════════════════════════════

const PLAYER = 1 << 1;
const BOOMER = 1 << 2;

const OUT_SPEED = 8;
const RELAY_AT = 10; // 出程拍数：elapsed ≥ 10 接力
const DIE_AT = 12; //   出程弹自毁：duration 12（接力之后·留一拍余量）

const xf = (x: number, y: number): Record<string, unknown> => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });

const RETURN_TMPL: Record<string, PrefabTemplate> = {
  boomerang_return: {
    entities: {
      blade: {
        Transform: xf(0, 0),
        Velocity: { vx: 0, vy: 0, angular: 0 },
        Tag: { flags: BOOMER },
        Perception: { targetTag: PLAYER, sightRadius: 10000 },
        Steering: { mode: 'seek', speed: OUT_SPEED, stopRange: 0 },
      },
    },
  },
};

function addSystems(w: World, ...caps: CapabilityDefinition[]): void {
  for (const cap of caps) for (const s of cap.systems) w.addSystem(s);
}

/** 玩家原点静立（或由用例驱动移动）；出程弹从玩家位置向 +x 掷出。 */
function scene(): World {
  const w = new World();
  addSystems(
    w,
    timerCapability,
    launchCapability,
    aggroCapability,
    steeringCapability,
    selfRuleCapability,
    motionApplyCapability,
    lifetimeCapability,
    prefabCapability,
    destroyCapability,
  );
  w.createEntity('lib');
  w.addComponent('lib', { type: 'PrefabLibrary', templates: RETURN_TMPL, seq: 0 } as PrefabLibrary);
  w.createEntity('hero');
  w.addComponent('hero', { type: 'Transform', ...xf(0, 0) } as Transform);
  w.addComponent('hero', { type: 'Tag', flags: PLAYER } as Tag);
  w.createEntity('out');
  w.addComponent('out', { type: 'Transform', ...xf(0, 0) } as Transform);
  w.addComponent('out', { type: 'Tag', flags: BOOMER } as Tag);
  w.addComponent('out', { type: 'Launch', speed: OUT_SPEED, toward: 'dir', dirX: 1, dirY: 0 } as Launch);
  w.addComponent('out', { type: 'Timer', id: 'life', elapsed: 0, duration: DIE_AT, loop: false } as Timer);
  w.addComponent('out', {
    type: 'SelfRule',
    when: { kind: 'timer', id: 'life', cmp: 'gte', value: RELAY_AT },
    do: [{ kind: 'spawn', template: 'boomerang_return' }],
    once: true,
  } as unknown as SelfRule);
  return w;
}

/** 返程弹实例 id（prefab 确定性命名 templateId#seq:localId）。 */
const bladeId = (w: World): string | undefined =>
  w.getComponent<Transform>('boomerang_return#0:blade', 'Transform') ? 'boomerang_return#0:blade' : undefined;

describe('boomerang-compose · 往返弹二段接力（BUG-03 干净往返段·回驳证明）', () => {
  it('出程：Launch 一次定向直飞·自删·无 BUG-03 式拉扯（逐拍单调远离玩家）', () => {
    const w = scene();
    let prev = 0;
    for (let i = 0; i < 8; i++) {
      w.tick();
      const x = w.getComponent<Transform>('out', 'Transform')!.x;
      expect(x).toBeGreaterThan(prev); // 每拍都在远离，从未被拉回
      prev = x;
    }
    expect(w.getComponent<Launch>('out', 'Launch')).toBeFalsy(); // 一次性自删（举证口径的反证）
    const v = w.getComponent<Velocity>('out', 'Velocity')!;
    expect(v.vx).toBe(OUT_SPEED);
    expect(v.vy).toBe(0);
  });

  it('接力点：同一只 Timer 两用——elapsed≥10 于当拍位置生返程弹·duration 到点出程弹自毁', () => {
    const w = scene();
    let ticks = 0;
    while (ticks < DIE_AT + 3 && !bladeId(w)) {
      w.tick();
      ticks += 1;
    }
    const blade = bladeId(w);
    expect(blade).toBeTruthy(); // 返程弹已展开
    expect(ticks).toBeGreaterThanOrEqual(RELAY_AT); // 接力不早于相位线
    expect(ticks).toBeLessThanOrEqual(RELAY_AT + 2);
    // 出现当拍即接力位置（prefab 殿后展开·steering 下一拍才动）= 出程弹此刻的位置
    const bx = w.getComponent<Transform>(blade!, 'Transform')!.x;
    expect(bx).toBeGreaterThanOrEqual(OUT_SPEED * (RELAY_AT - 1));
    expect(bx).toBeLessThanOrEqual(OUT_SPEED * (RELAY_AT + 2));
    while (ticks < DIE_AT + 3) {
      w.tick();
      ticks += 1;
    }
    expect(w.getComponent<Transform>('out', 'Transform')).toBeFalsy(); // 出程弹已由 lifetime 回收
  });

  it('返程：aggro+steering 追移动中的玩家——距离收敛到贴身（固定 waypoint 表达不了的半段）', () => {
    const w = scene();
    for (let i = 0; i < DIE_AT + 2; i++) w.tick();
    const blade = bladeId(w)!;
    const hero = w.getComponent<Transform>('hero', 'Transform')!;
    const dist = (): number => {
      const b = w.getComponent<Transform>(blade, 'Transform')!;
      return Math.hypot(b.x - hero.x, b.y - hero.y);
    };
    const d0 = dist();
    for (let i = 0; i < 60; i++) {
      hero.x += 2; // 玩家边走边接（速度低于弹速·可被追上）
      hero.y += 1;
      w.tick();
    }
    expect(dist()).toBeLessThan(d0); // 真在收敛
    expect(dist()).toBeLessThanOrEqual(OUT_SPEED + 1e-9); // 已贴身（一拍步长内）
  });

  it('定序面：九件同装零成环告警（读告警纪律·绿灯不等于没话说）', () => {
    const warns: string[] = [];
    const spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warns.push(args.map(String).join(' '));
    });
    try {
      const w = scene();
      w.tick(); // 首拍触发 topologicalSort
      const bad = warns.filter((m) => m.includes('[topological-sort]') || m.includes('Circular'));
      expect(bad).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
});
