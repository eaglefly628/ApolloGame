import { describe, it, expect } from 'vitest';
import { validateReferences } from './validate-references.js';
import { parseManifestDetailed } from './manifest.js';
import { exportManifest } from '../studio/inspect.js';
import { buildGameABlueprint } from '../games/game-a/blueprint.js';
import { LEVEL_SWITCH } from '../games/game-a/level.js';
import { buildGameBBlueprint } from '../games/game-b/blueprint.js';
import { buildGameCBlueprint } from '../games/game-c/blueprint.js';
import { buildGameDBlueprint } from '../games/game-d/blueprint.js';
import { buildGameEBlueprint } from '../games/game-e/blueprint.js';
import type { WorldBlueprint } from './demo.assembly.js';

// 引用链接器（P0）：id 交叉引用体检。两条军规：
//  ① 真断链必须点名（信号无生产者/条件缺叶/effect 缺目标/模板缺失/图内跳空）；
//  ② 五个真实游戏蓝图必须零误报（self 寻址不查、prefab 模板实体进"存在宇宙"）。

type Entities = Record<string, Record<string, unknown>>;
const lint = (entities: Entities) => validateReferences(entities as never);

describe('validate-references —— 零误报军规（真实蓝图回归）', () => {
  const games: Array<[string, () => WorldBlueprint]> = [
    ['A', () => buildGameABlueprint(LEVEL_SWITCH)],
    ['B', buildGameBBlueprint],
    ['C', buildGameCBlueprint],
    ['D', buildGameDBlueprint],
    ['E', () => buildGameEBlueprint()],
  ];
  for (const [name, build] of games) {
    it(`Game ${name} 真实蓝图 → 0 引用告警`, () => {
      const m = JSON.parse(exportManifest(build()));
      expect(lint(m.entities).map((i) => JSON.stringify(i))).toEqual([]);
    });
  }
});

describe('validate-references —— 信号链', () => {
  it('Effect.onSignal 无任何生产者 → 点名告警；补 EventWhen 生产者后消失', () => {
    const broken: Entities = {
      door: { Effect: { onSignal: 'plate_on', kind: 'set-flag', targetId: 'opened', value: true }, Flag: { id: 'opened', active: false } },
    };
    const issues = lint(broken);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('plate_on');
    expect(issues[0].message).toContain('无任何声明的生产者');

    broken.plate = { EventWhen: { signal: 'plate_on', when: { kind: 'flag', id: 'opened' }, mode: 'edge', armed: false } };
    expect(lint(broken)).toHaveLength(0);
  });

  it('KeyBinding/Clickable 也算生产者；CraftRecipe/Caster/MatchBoard 也算消费者', () => {
    const e: Entities = {
      a: { KeyBinding: { key: '1', signal: 'cast' }, Clickable: { action: 'pick' } },
      b: {
        CraftRecipe: { onSignal: 'pick', costs: [] },
        Caster: { onSignal: 'cast', template: 'bolt', at: 'self' },
        PrefabLibrary: { templates: { bolt: { entities: {} } }, seq: 0 },
      },
      c: { MatchBoard: { selectAction: 'nope_signal', cols: 1, rows: 1, kindCount: 1, cells: [0], kindResource: [], matAmount: 0, coinResource: '', coinPerTile: 0, kindTint: [], kindLabel: [], phase: 'idle', selIndex: -1, swapA: -1, swapB: -1, stepTimer: 0, stepDelay: 0 } },
    };
    const issues = lint(e);
    expect(issues).toHaveLength(1); // 只有 nope_signal 断链
    expect(issues[0].component).toBe('MatchBoard');
  });
});

describe('validate-references —— 全局 id 与条件树', () => {
  it('EventWhen.when 条件叶子引用缺失的 resource/flag/state/timer/string → 各自点名', () => {
    const e: Entities = {
      logic: {
        EventWhen: {
          signal: 's',
          mode: 'edge',
          armed: false,
          when: {
            kind: 'and',
            of: [
              { kind: 'resource', id: 'no_res', cmp: 'gte', value: 1, vsResource: 'no_vs' },
              { kind: 'or', of: [{ kind: 'flag', id: 'no_flag' }, { kind: 'not', of: { kind: 'state', fsmId: 'no_fsm', equals: 'x' } }] },
              { kind: 'timer', id: 'no_timer', cmp: 'gte', value: 1 },
              { kind: 'string', id: 'no_str', equals: 'y' },
            ],
          },
        },
      },
    };
    const msgs = lint(e).map((i) => i.message).join('|');
    for (const miss of ['no_res', 'no_vs', 'no_flag', 'no_fsm', 'no_timer', 'no_str']) expect(msgs).toContain(miss);
  });

  it('Effect 按 kind 寻址：set-flag/modify-resource/set-state 查对应宇宙；物理 kind 查实体；valueFrom 查资源', () => {
    const e: Entities = {
      sig: { EventWhen: { signal: 's', when: { kind: 'always' }, mode: 'level', armed: false } },
      e1: { Effect: { onSignal: 's', kind: 'set-flag', targetId: 'no_flag', value: true } },
      e2: { Effect: { onSignal: 's', kind: 'modify-resource', targetId: 'no_res', value: 1, valueFrom: { resourceId: 'no_vf', timesResourceId: 'no_vf2' } } },
      e3: { Effect: { onSignal: 's', kind: 'set-state', targetId: 'no_fsm', value: 'x' } },
      e4: { Effect: { onSignal: 's', kind: 'set-sensor', targetEntity: 'ghost', value: true } },
    };
    const msgs = lint(e).map((i) => i.message).join('|');
    for (const miss of ['no_flag', 'no_res', 'no_vf', 'no_vf2', 'no_fsm', 'ghost']) expect(msgs).toContain(miss);
  });

  it('CraftRecipe costs/gains/grantsFlag/grantsState + Zone.outFlag + GroupCount.countResource', () => {
    const e: Entities = {
      sig: { Clickable: { action: 'buy' } },
      shop: { CraftRecipe: { onSignal: 'buy', costs: [{ id: 'no_gold', amount: 3 }], gains: [{ id: 'no_item', amount: 1 }], grantsFlag: 'no_flag', grantsState: { fsmId: 'no_fsm', value: 'x' } } },
      zone: { Zone: { outFlag: 'no_zone_flag', minX: 0, minY: 0, maxX: 1, maxY: 1 } },
      gc: { GroupCount: { countResource: 'no_count' } },
    };
    const msgs = lint(e).map((i) => i.message).join('|');
    for (const miss of ['no_gold', 'no_item', 'no_flag', 'no_fsm', 'no_zone_flag', 'no_count']) expect(msgs).toContain(miss);
  });

  it('SelfRule.when 是 self 寻址 → 刻意不查（全局无此 id 也零告警，防误报）', () => {
    const e: Entities = {
      unit: { SelfRule: { when: { kind: 'resource', id: 'hp_only_on_self', cmp: 'lte', value: 0 }, do: [{ kind: 'destroy' }] }, Resource: { id: 'hp', current: 10, min: 0, max: 10 } },
    };
    expect(lint(e)).toHaveLength(0);
  });
});

describe('validate-references —— prefab 感知', () => {
  it('模板内实体进"存在宇宙"：顶层条件引用模板内 Resource → 不告警', () => {
    const e: Entities = {
      lib: { PrefabLibrary: { templates: { mob: { entities: { body: { Resource: { id: 'mob_hp', current: 5, min: 0, max: 5 } } } } }, seq: 0 } },
      logic: { EventWhen: { signal: 's', when: { kind: 'resource', id: 'mob_hp', cmp: 'lte', value: 0 }, mode: 'edge', armed: false } },
    };
    expect(lint(e)).toHaveLength(0);
  });

  it('模板内实体自身也被体检：模板内 Effect.onSignal 断链 → 告警且实体名带模板路径', () => {
    const e: Entities = {
      lib: { PrefabLibrary: { templates: { trap: { entities: { fuse: { Effect: { onSignal: 'never_fired', kind: 'destroy', targetEntity: 'fuse' } } } } }, seq: 0 } },
    };
    const issues = lint(e);
    expect(issues).toHaveLength(1);
    expect(issues[0].entity).toBe('模板"trap"/fuse');
    expect(issues[0].message).toContain('never_fired');
  });

  it('模板引用：Caster.template / SpawnRequest.templateId / Mortal.dropTemplate 缺失模板 → 告警', () => {
    const e: Entities = {
      lib: { PrefabLibrary: { templates: { real: { entities: {} } }, seq: 0 } },
      sig: { KeyBinding: { key: '1', signal: 'cast' } },
      hero: { Caster: { onSignal: 'cast', template: 'no_tpl', at: 'self' } },
      spawner: { SpawnRequest: { templateId: 'no_tpl2', x: 0, y: 0 } },
      mob: { Mortal: { resource: 'hp', atOrBelow: 0, dropTemplate: 'no_tpl3' } },
    };
    const msgs = lint(e).map((i) => i.message).join('|');
    for (const miss of ['no_tpl', 'no_tpl2', 'no_tpl3']) expect(msgs).toContain(miss);
    expect(msgs).not.toContain('real');
  });
});

describe('validate-references —— 图内引用（flow / dialogue）', () => {
  it('GameFlow：current 与 transitions[].to 必须是 states[].id；动作 targetId 查全局宇宙', () => {
    const e: Entities = {
      flow: {
        GameFlow: {
          id: 'round',
          current: 'no_state',
          states: [
            { id: 'a', onEnter: [{ kind: 'modify-resource', targetId: 'no_res', op: 'set', value: 1 }], transitions: [{ when: { kind: 'flag', id: 'no_flag' }, to: 'ghost_state', do: [{ kind: 'set-state', targetId: 'no_fsm', value: 'x' }] }] },
          ],
        },
      },
    };
    const msgs = lint(e).map((i) => i.message).join('|');
    for (const miss of ['no_state', 'ghost_state', 'no_res', 'no_flag', 'no_fsm']) expect(msgs).toContain(miss);
  });

  it('DialogueScript：next/successNext/failNext/options[].next 跳空节点 + requires/effects/setFlag/attribute', () => {
    const e: Entities = {
      vn: {
        DialogueScript: {
          nodes: {
            start: { kind: 'line', speaker: 'S', text: 'hi', next: 'ghost_node' },
            pick: {
              kind: 'choice',
              options: [{ text: 'go', next: 'ghost_opt', requires: { kind: 'resource', id: 'no_charm', cmp: 'gte', value: 1 }, effects: [{ resource: 'no_aff', amount: 5 }], setFlag: 'no_flag' }],
            },
            roll: { kind: 'check', attribute: 'no_attr', difficulty: 10, bonusFrom: 'no_bonus', successNext: 'ghost_s', failNext: 'ghost_f' },
          },
        },
      },
    };
    const msgs = lint(e).map((i) => i.message).join('|');
    for (const miss of ['ghost_node', 'ghost_opt', 'no_charm', 'no_aff', 'no_flag', 'no_attr', 'no_bonus', 'ghost_s', 'ghost_f']) expect(msgs).toContain(miss);
  });

  it('next: null 是合法终点；空串字段一律跳过', () => {
    const e: Entities = {
      vn: { DialogueScript: { nodes: { end: { kind: 'line', speaker: 'S', text: 'bye', next: null } } } },
      m: { MatchBoard: { selectAction: '', cols: 1, rows: 1, kindCount: 1, cells: [0], kindResource: [], matAmount: 0, coinResource: '', coinPerTile: 0, kindTint: [], kindLabel: [], phase: 'idle', selIndex: -1, swapA: -1, swapB: -1, stepTimer: 0, stepDelay: 0 } },
    };
    expect(lint(e)).toHaveLength(0);
  });
});

describe('validate-references —— parseManifest 集成', () => {
  it('链接器告警进 parseManifestDetailed.warnings（warning 级，不阻断加载）', () => {
    const manifest = {
      capabilities: ['t2-effect-apply', 't2-event-when', 'f2-flag'],
      entities: {
        logic: { Effect: { onSignal: 'orphan_signal', kind: 'set-flag', targetId: 'opened', value: true }, Flag: { id: 'opened', active: false } },
      },
    };
    const r = parseManifestDetailed(manifest);
    expect(r.blueprint.entities.logic).toBeDefined(); // 加载成功
    expect(r.warnings.some((w) => w.includes('orphan_signal'))).toBe(true);
  });
});
