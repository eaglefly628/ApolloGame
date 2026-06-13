import { describe, it, expect } from 'vitest';
import type { WorldSnapshot } from '@engine/core/types.js';
import { hashSnapshot } from './determinism.js';
import { packKeyframe, diffState, applyPacket, PRESENTATION_COMPONENTS } from './state-sync.js';

// 小工具：构造快照（plain，含 type 字段，与 World.snapshot 同形）。
const snap = (...ents: [string, Record<string, Record<string, unknown>>][]): WorldSnapshot => {
  const out: WorldSnapshot = {};
  for (const [id, comps] of ents) {
    const m: Record<string, { type: string }> = {};
    for (const t of Object.keys(comps)) m[t] = { type: t, ...comps[t] } as { type: string };
    out[id] = m;
  }
  return out;
};

describe('state-sync · keyframe 打包/还原', () => {
  it('keyframe 往返：applyPacket(null, packKeyframe(s)) 与源逻辑等价', () => {
    const s = snap(['u1', { Transform: { x: 1, y: 2 }, HexPos: { q: 3, r: 4 } }], ['u2', { Resource: { id: 'hp', current: 80 } }]);
    const back = applyPacket(null, packKeyframe(s, 7));
    expect(hashSnapshot(back)).toBe(hashSnapshot(s));
  });

  it('表现层组件不入包（Camera/ScoreTrace 默认排除）', () => {
    expect(PRESENTATION_COMPONENTS.has('Camera')).toBe(true);
    const s = snap(['cam', { Camera: { zoom: 1.8 } }], ['u', { HexPos: { q: 1, r: 1 } }]);
    const pk = packKeyframe(s, 0);
    const state = pk.kind === 'keyframe' ? pk.state : {};
    expect(state.cam).toBeUndefined(); // 纯相机实体整体被滤掉
    expect(state.u?.HexPos).toBeDefined();
  });

  it('深拷贝隔离：包发出后源世界继续改不污染包', () => {
    const s = snap(['u', { Resource: { id: 'hp', current: 100 } }]);
    const pk = packKeyframe(s, 0);
    (s.u.Resource as unknown as { current: number }).current = 1; // 源被后续 tick 改写
    const back = applyPacket(null, pk) as WorldSnapshot;
    expect((back.u.Resource as unknown as { current: number }).current).toBe(100);
  });

  it('include 白名单（兴趣管理）：只打包指定组件', () => {
    const s = snap(['u', { Transform: { x: 9 }, HexPos: { q: 2, r: 2 }, Resource: { current: 5 } }]);
    const pk = packKeyframe(s, 0, { include: new Set(['HexPos', 'Resource']) });
    const state = pk.kind === 'keyframe' ? pk.state : {};
    expect(state.u.Transform).toBeUndefined();
    expect(state.u.HexPos).toBeDefined();
    expect(state.u.Resource).toBeDefined();
  });
});

describe('state-sync · delta 差分/施加', () => {
  it('diff→apply 往返 == next（变更/新增/删组件/删实体 全覆盖）', () => {
    const prev = snap(
      ['a', { Transform: { x: 1 }, Resource: { current: 10 } }],
      ['b', { HexPos: { q: 0, r: 0 } }],
      ['c', { Tag: { flags: 2 } }], // 将被删除
    );
    const next = snap(
      ['a', { Transform: { x: 5 } }],            // Transform 变 + Resource 被删
      ['b', { HexPos: { q: 0, r: 0 }, Tag: { flags: 4 } }], // 不变 + 新增 Tag
      ['d', { Resource: { current: 7 } }],       // 新实体
    );
    const delta = diffState(prev, next, 11, 10);
    const rebuilt = applyPacket(prev, delta) as WorldSnapshot;
    expect(hashSnapshot(rebuilt)).toBe(hashSnapshot(next));
  });

  it('无变化 → 空 delta（upsert/remove 全空）', () => {
    const s = snap(['u', { HexPos: { q: 1, r: 1 } }]);
    const d = diffState(s, structuredClone(s), 1, 0);
    if (d.kind !== 'delta') throw new Error('expect delta');
    expect(Object.keys(d.upsert)).toHaveLength(0);
    expect(d.removeEntities).toHaveLength(0);
    expect(Object.keys(d.removeComponents)).toHaveLength(0);
  });

  it('delta 仅含真正变化的实体（静止单位不进包 → 省带宽）', () => {
    const prev = snap(['still', { HexPos: { q: 1, r: 1 } }], ['mover', { Transform: { x: 0 } }]);
    const next = snap(['still', { HexPos: { q: 1, r: 1 } }], ['mover', { Transform: { x: 3 } }]);
    const d = diffState(prev, next, 2, 1);
    if (d.kind !== 'delta') throw new Error('expect delta');
    expect(Object.keys(d.upsert)).toEqual(['mover']);
  });

  it('delta 无基线 → 抛错（会话层据此请求重发 keyframe）', () => {
    const d = diffState(snap(['u', { Tag: { flags: 1 } }]), snap(['u', { Tag: { flags: 2 } }]), 1, 0);
    expect(() => applyPacket(null, d)).toThrow(/keyframe/);
  });

  it('链式增量：keyframe → 多个 delta 依次施加，末态与逐帧真相一致', () => {
    const f0 = snap(['u', { Resource: { current: 100 } }]);
    const f1 = snap(['u', { Resource: { current: 90 } }]);
    const f2 = snap(['u', { Resource: { current: 75 } }], ['orb', { Tag: { flags: 8 } }]);
    let view = applyPacket(null, packKeyframe(f0, 0));
    view = applyPacket(view, diffState(f0, f1, 1, 0));
    view = applyPacket(view, diffState(f1, f2, 2, 1));
    expect(hashSnapshot(view)).toBe(hashSnapshot(f2));
  });
});
