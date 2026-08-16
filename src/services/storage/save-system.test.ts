import { describe, it, expect } from 'vitest';
import { World } from '@engine/core/world.js';
import type { Resource } from '@engine/protocol/components.js';
import { hashSnapshot } from '@net/index.js';
import { MemoryStoragePort } from './memory-storage.js';
import { SaveSystem } from './save-system.js';
import { CorruptSaveError } from '../save/envelope.js';

function worldWith(hp: number): World {
  const w = new World();
  w.createEntity('player');
  w.addComponent('player', { type: 'Resource', id: 'hp', current: hp, min: 0, max: 100 } as Resource);
  return w;
}

describe('SaveSystem — 存/读/列/删（MemoryStoragePort）', () => {
  it('save 后 load 恢复世界状态', async () => {
    const port = new MemoryStoragePort();
    const sys = new SaveSystem(port);
    const w1 = worldWith(73);
    const meta = await sys.save('slot1', w1, '第一章');
    expect(meta.label).toBe('第一章');
    expect(meta.hash).toBeTypeOf('string');

    const w2 = worldWith(10); // 不同状态
    const loaded = await sys.load('slot1', w2);
    expect(loaded?.slot).toBe('slot1');
    expect(w2.getComponent<Resource>('player', 'Resource')!.current).toBe(73);
  });

  it('load 不存在的槽位 → null', async () => {
    const sys = new SaveSystem(new MemoryStoragePort());
    expect(await sys.load('nope', worldWith(1))).toBeNull();
  });

  it('list 返回所有槽位元数据；delete 移除', async () => {
    const sys = new SaveSystem(new MemoryStoragePort());
    await sys.save('a', worldWith(1));
    await sys.save('b', worldWith(2));
    expect((await sys.list()).map((m) => m.slot).sort()).toEqual(['a', 'b']);
    await sys.delete('a');
    expect((await sys.list()).map((m) => m.slot)).toEqual(['b']);
  });

  it('存档 hash 与世界确定性指纹一致（防篡改/校验）', async () => {
    const port = new MemoryStoragePort();
    const sys = new SaveSystem(port);
    const w = worldWith(50);
    const meta = await sys.save('s', w);
    const reloaded = await port.load('s');
    expect(reloaded?.meta.hash).toBe(meta.hash);
  });

  // ── 回归（engine-review-2026-08-04 §3.3 · P1）─────────────────────────────
  // 旧实现算了 hash 却从不校验 → 篡改/损坏的快照静默灌进 world（fail-open，
  // 与 storage-port 自述「防篡改」矛盾）。现在必须 fail-closed：校验在 restore 之前。
  it('快照被篡改 → 读档报错，且**不得**污染 world（校验须在 restore 之前）', async () => {
    const port = new MemoryStoragePort();
    const sys = new SaveSystem(port);
    await sys.save('s', worldWith(50));

    // 直接改端口里的快照（模拟 DevTools 篡改 / 落盘损坏），meta.hash 保持原值
    const stored = await port.load('s');
    (stored!.snapshot.player!.Resource as Resource).current = 9999; // WorldSnapshot = { 实体id: { 组件名: 数据 } }
    await port.save('s', stored!);

    const target = worldWith(1); // 读档目标世界：初始 hp=1
    await expect(sys.load('s', target)).rejects.toThrow(CorruptSaveError);
    // 关键：坏档没有被灌进去——目标世界仍是它自己的初始状态
    expect((target.getComponent('player', 'Resource') as Resource).current).toBe(1);
  });

  it('合法存档经 JSON 往返（真实端口落盘必经）后仍能读档——校验不得误杀', async () => {
    // 防「加了校验反而误判合法存档损坏」这类回归（envelope 曾栽在同一个坑：
    // 指纹算的是内存形态、校验的是 JSON 往返后的形态）。
    const port = new MemoryStoragePort();
    const sys = new SaveSystem(port);
    await sys.save('s', worldWith(50));
    const stored = await port.load('s');
    await port.save('s', JSON.parse(JSON.stringify(stored)) as typeof stored & object);

    const target = worldWith(1);
    await expect(sys.load('s', target)).resolves.toBeTruthy();
    expect((target.getComponent('player', 'Resource') as Resource).current).toBe(50);
  });

  // ── REQ-SAVEORDER（深审 A2 发现②）：order 段入指纹 fail-closed ────────────
  // 病（修前实证）：load 只验 hashSnapshot(snapshot)，order 整段反转 → 零报错直通
  // world.restore；order 决定 restore 后的 query 序——序敏感世界静默变行为，
  // 且组件内容全同 → canonical hash 抓不到（snapshotOrder 注释里那个最阴的坑）。

  // 数字样 id + 字符串 id 混排：创建序 10,2,hero ≠ 快照键序 2,10,hero → order 真有语义差。
  function worldMixedIds(): World {
    const w = new World();
    for (const id of ['10', '2', 'hero']) {
      w.createEntity(id);
      w.addComponent(id, { type: 'Resource', id: 'hp', current: 5, min: 0, max: 100 } as Resource);
    }
    return w;
  }

  it('order 被篡改（反转）→ 读档必拒，且不得污染 world', async () => {
    const port = new MemoryStoragePort();
    const sys = new SaveSystem(port);
    await sys.save('s', worldMixedIds());

    const stored = await port.load('s');
    stored!.order = [...stored!.order!].reverse(); // 组件内容一字不动，只动序
    await port.save('s', stored!);

    const target = worldWith(1);
    await expect(sys.load('s', target)).rejects.toThrow(CorruptSaveError);
    expect((target.getComponent('player', 'Resource') as Resource).current).toBe(1); // 未被灌
  });

  it('order 被整段剥除 → 读档必拒（剥除不得静默退回键序语义）', async () => {
    const port = new MemoryStoragePort();
    const sys = new SaveSystem(port);
    await sys.save('s', worldMixedIds());

    const stored = await port.load('s');
    delete stored!.order; // 「连 order 一起删」= 旁挂指纹方案挡不住的那条攻击路
    await port.save('s', stored!);

    await expect(sys.load('s', worldWith(1))).rejects.toThrow(CorruptSaveError);
  });

  it('旧档兼容：无 order 的旧格式（hash 只盖快照）仍正常读档', async () => {
    const port = new MemoryStoragePort();
    const sys = new SaveSystem(port);
    // 手工构造旧格式存档：无 order 字段，hash = 旧口径 hashSnapshot(snapshot)。
    const legacy = worldWith(42);
    const snapshot = legacy.snapshot();
    await port.save('old', {
      meta: { slot: 'old', tick: 0, hash: hashSnapshot(snapshot), timestamp: 0 },
      snapshot,
    });

    const target = worldWith(1);
    const meta = await sys.load('old', target);
    expect(meta?.slot).toBe('old');
    expect((target.getComponent('player', 'Resource') as Resource).current).toBe(42);
  });
});
