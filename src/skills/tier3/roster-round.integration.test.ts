import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Signal, PrefabLibrary, HexPos, Tag, Resource, Hierarchy, SpawnRequest, Effect } from '@engine/protocol/components.js';
import { prefabCapability } from './prefab.js';
import { casterCapability } from './caster.js';
import { effectApplyCapability } from '../tier2/effect-apply.js';
import { destroyCapability } from '@atom-skills/destroy/index.js';
import { hierarchyCascadeCapability } from '../tier1/hierarchy-cascade.js';

// ═══════════════════════════════════════════════════════════════
//  REQ-F-032 验收：回合重置 = 纯重组 + 三处收窄扩展（零新系统）。
//  阵容槽位实体 = Caster{onSignal:'deploy', template:英雄, at:'self', overrides:{棋子的 HexPos/Tag}}（持久数据）
//  备战展开    = 发 'deploy' 信号 → N 槽各自产 SpawnRequest(带 overrides) → prefab 合并展开异构实例
//  结算清场    = Effect{onSignal:'wipe', kind:'destroy-tagged', value:阵营掩码} → 批量自销毁请求 → cascade 连挂件
//  跨回合      = 槽位无 Tag 不被清场；PrefabLibrary.seq 单调 → 每回合实例 id 唯一确定。
// ═══════════════════════════════════════════════════════════════

const ALLY = 1 << 1;
const ENEMY = 1 << 2;

type Cap = { systems: ReadonlyArray<Parameters<World['addSystem']>[0]> };
function mk(): World {
  const w = new World();
  for (const cap of [casterCapability, prefabCapability, effectApplyCapability, destroyCapability, hierarchyCascadeCapability] as unknown as Cap[]) {
    for (const s of cap.systems) w.addSystem(s);
  }
  // 模板库：单英雄模板（hp 资源 + 占位 HexPos/Tag，全部可被 overrides 改写）
  w.createEntity('lib');
  w.addComponent('lib', {
    type: 'PrefabLibrary',
    seq: 0,
    templates: {
      hero: {
        entities: {
          main: {
            Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
            HexPos: { q: 0, r: 0 },
            Tag: { flags: 0 },
            Resource: { id: 'hp', current: 100, min: 0, max: 100 },
          },
        },
      },
    },
  } as PrefabLibrary);
  return w;
}
// 阵容槽位：持久实体，自带 Caster（onSignal 释放自己的棋子）。无 Tag → 清场不波及。
function slot(w: World, id: string, q: number, r: number, side: number): void {
  w.createEntity(id);
  w.addComponent(id, { type: 'Transform', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 } as never);
  w.addComponent(id, {
    type: 'Caster', onSignal: 'deploy', template: 'hero', at: 'self',
    overrides: { main: { HexPos: { q, r }, Tag: { flags: side } } },
  } as never);
}
function signal(w: World, name: string): void {
  w.createEntity(`sig:${name}`);
  w.addComponent(`sig:${name}`, { type: 'Signal', name, source: `sig:${name}` } as Signal);
}
const unsignal = (w: World, name: string) => w.destroyEntity(`sig:${name}`);
const alive = (w: World, id: string) => w.getAllEntities().includes(id);
const tagged = (w: World, mask: number) =>
  w.getAllEntities().filter((e) => ((w.getComponent<Tag>(e, 'Tag')?.flags ?? 0) & mask) !== 0);

describe('REQ-F-032 · overrides：同模板展开异构实例', () => {
  it('SpawnRequest.overrides 由 prefab 逐字段合并；未覆盖字段保模板值；模板本体不被污染', () => {
    const w = mk();
    w.createEntity('req');
    w.addComponent('req', {
      type: 'SpawnRequest', templateId: 'hero', x: 10, y: 20,
      overrides: { main: { HexPos: { q: 5, r: 2 }, Resource: { current: 30 } } },
    } as SpawnRequest);
    w.tick();
    const id = 'hero#0:main';
    expect(alive(w, id)).toBe(true);
    expect(w.getComponent<HexPos>(id, 'HexPos')).toMatchObject({ q: 5, r: 2 }); // 覆盖生效
    const res = w.getComponent<Resource>(id, 'Resource')!;
    expect(res.current).toBe(30); // 覆盖字段
    expect(res.max).toBe(100); // 未覆盖字段保模板值
    // 模板隔离：库里的模板数据未被改写
    const lib = w.getComponent<PrefabLibrary>('lib', 'PrefabLibrary')!;
    expect((lib.templates.hero.entities.main.HexPos as { q: number }).q).toBe(0);
  });

  it('Caster.overrides 原样透传：槽位实体展开自己的棋子到指定格/阵营', () => {
    const w = mk();
    slot(w, 'slot1', 3, 4, ALLY);
    signal(w, 'deploy');
    w.tick();
    unsignal(w, 'deploy');
    const id = 'hero#0:main';
    expect(alive(w, id)).toBe(true);
    expect(w.getComponent<HexPos>(id, 'HexPos')).toMatchObject({ q: 3, r: 4 });
    expect(w.getComponent<Tag>(id, 'Tag')!.flags).toBe(ALLY);
  });
});

describe('REQ-F-032 · 回合循环：展开 → 清场 → 再展开', () => {
  it('N 槽同信号各自展开；destroy-tagged 按阵营清场（连挂件）；槽位幸存；次回合 id 全新', () => {
    const w = mk();
    slot(w, 'slotA', 1, 1, ALLY);
    slot(w, 'slotB', 2, 1, ALLY);
    slot(w, 'slotE', 5, 5, ENEMY);
    // 清场效果（常驻数据，等 wipe 信号）：两条 Effect 分别清两个阵营
    w.createEntity('fxA');
    w.addComponent('fxA', { type: 'Effect', onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: ALLY } as Effect);
    w.createEntity('fxE');
    w.addComponent('fxE', { type: 'Effect', onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: ENEMY } as Effect);

    // —— 回合 1：备战展开 ——
    signal(w, 'deploy');
    w.tick();
    unsignal(w, 'deploy');
    const r1 = [...tagged(w, ALLY | ENEMY)].sort();
    expect(r1).toHaveLength(3); // 三槽三棋
    expect(new Set(r1).size).toBe(3); // id 唯一
    // 给一个实例挂"名牌"子实体（模拟 PE 的挂件）——清场应被 cascade 连带
    w.createEntity('nameplate');
    w.addComponent('nameplate', { type: 'Hierarchy', parentId: r1[0], localX: 0, localY: -20, localRotation: 0, localScaleX: 1, localScaleY: 1 } as Hierarchy);

    // —— 结算：清场 ——
    signal(w, 'wipe');
    w.tick(); // Commit 写下全部 DestroyRequest
    unsignal(w, 'wipe');
    w.tick(); // 次拍 cascade 传播 + destroy-apply 移除
    for (const id of r1) expect(alive(w, id)).toBe(false); // 双方棋子全清
    expect(alive(w, 'nameplate')).toBe(false); // 挂件级联
    expect(alive(w, 'slotA')).toBe(true); // 阵容（槽位）持久
    expect(alive(w, 'slotE')).toBe(true);
    expect(alive(w, 'lib')).toBe(true);

    // —— 回合 2：重新展开 ——
    signal(w, 'deploy');
    w.tick();
    unsignal(w, 'deploy');
    const r2 = [...tagged(w, ALLY | ENEMY)].sort();
    expect(r2).toHaveLength(3);
    for (const id of r2) expect(r1).not.toContain(id); // seq 单调 → 新实例 id 全新（确定性可重放）
    expect(w.getComponent<HexPos>(r2.find((i) => w.getComponent<Tag>(i, 'Tag')!.flags === ENEMY)!, 'HexPos')).toMatchObject({ q: 5, r: 5 });
  });

  it('destroy-tagged 不误伤：掩码不命中者与无 Tag 实体幸存', () => {
    const w = mk();
    w.createEntity('bystander'); // 无 Tag
    w.createEntity('other');
    w.addComponent('other', { type: 'Tag', flags: 1 << 6 } as Tag); // 别的阵营
    w.createEntity('victim');
    w.addComponent('victim', { type: 'Tag', flags: ALLY } as Tag);
    w.createEntity('fx');
    w.addComponent('fx', { type: 'Effect', onSignal: 'wipe', kind: 'destroy-tagged', targetId: '', value: ALLY } as Effect);
    signal(w, 'wipe');
    w.tick();
    unsignal(w, 'wipe');
    w.tick();
    expect(alive(w, 'victim')).toBe(false);
    expect(alive(w, 'other')).toBe(true);
    expect(alive(w, 'bystander')).toBe(true);
  });
});
