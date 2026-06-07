import { describe, it, expect } from 'vitest';
import { applyEditOps, type Entities } from './edit-ops.js';
import { resolveEdits, parseCommand, type LooseEdit } from './edit-resolve.js';
import { parseManifest } from '../assembly/manifest.js';
import { benchBlueprint } from '../bench/apollo-bench.js';

// 模型无关地基的回归：弱模型只需产「松散编辑」，下面证明 解析+应用 在确定性代码里把它做对。
const CAPS = ['a1-transform', 'b1-velocity', 'b2-acceleration', 'c1-shape', 'l2-color',
  'd1-overlap-detect', 't1-accel-apply', 't1-motion-apply', 't2-collision-resolve', 't2-bounds-clamp'];

function manifest() {
  return {
    name: 'edit-test',
    capabilities: CAPS,
    entities: {
      camera: { Camera: { zoom: 1, offsetX: 320, offsetY: 200, rotation: 0, viewportW: 640, viewportH: 400 } },
      player: {
        Transform: { x: 120, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
        Velocity: { vx: 0, vy: 0, angular: 0 }, Acceleration: { ax: 0, ay: 0.5 },
        Shape: { kind: 'box', width: 20, height: 20 }, Mass: { value: 1 },
        Color: { tint: 0x38bdf8, alpha: 1 }, Controllable: { playerId: 'p1', speed: 3 },
        Bounds: { minX: 0, minY: 0, maxX: 640, maxY: 400 },
      },
      ground: { Transform: { x: 320, y: 385, rotation: 0, scaleX: 1, scaleY: 1 }, Shape: { kind: 'box', width: 640, height: 30 }, Mass: { value: 0 }, Color: { tint: 0x334155, alpha: 1 } },
      platform1: { Transform: { x: 200, y: 300, rotation: 0, scaleX: 1, scaleY: 1 }, Shape: { kind: 'box', width: 100, height: 12 }, Mass: { value: 0 }, Color: { tint: 0x475569, alpha: 1 } },
    },
  };
}
const ents = () => manifest().entities as unknown as Entities;
const field = (e: Entities, ent: string, comp: string, f: string) => (e[ent][comp] as Record<string, unknown>)[f];
function run(e: Entities, edits: LooseEdit[]) {
  const { ops, errors } = resolveEdits(e, edits);
  return { ...applyEditOps(e, ops), errors };
}

describe('edit-eval · 模型无关编辑地基', () => {
  it('别名 set：「重力 0.9」→ Acceleration.ay', () => {
    const r = run(ents(), [{ entity: 'player', target: '重力', value: '0.9' }]);
    expect(field(r.entities, 'player', 'Acceleration', 'ay')).toBe(0.9);
  });

  it('别名 nudge：「重力 ×1.5」→ Acceleration.ay 0.5→0.75（相对乘，schema-backed 字段）', () => {
    const r = run(ents(), [{ entity: 'player', target: '重力', factor: 1.5 }]);
    expect(field(r.entities, 'player', 'Acceleration', 'ay')).toBe(0.75);
  });

  it('颜色：「platform1 变蓝」→ Color.tint=蓝', () => {
    const r = run(ents(), [{ entity: 'platform1', target: '变蓝' }]);
    expect(field(r.entities, 'platform1', 'Color', 'tint')).toBe(0x3b82f6);
  });

  it('显式 Component.field：「Acceleration.ay = 1.2」', () => {
    const r = run(ents(), [{ entity: 'player', target: 'Acceleration.ay', value: 1.2 }]);
    expect(field(r.entities, 'player', 'Acceleration', 'ay')).toBe(1.2);
  });

  it('强校验拦截：非数字值被拒，原数据不变', () => {
    const before = ents();
    const r = run(before, [{ entity: 'player', target: '重力', value: 'abc' }]);
    expect(r.results.some((x) => !x.ok)).toBe(true); // 被拒
    expect(field(r.entities, 'player', 'Acceleration', 'ay')).toBe(0.5); // 未改
  });

  it('认不出的目标 → 解析报错（带候选），不产 op', () => {
    const { ops, errors } = resolveEdits(ents(), [{ entity: 'player', target: '会飞吗', value: 1 }]);
    expect(ops).toHaveLength(0);
    expect(errors[0]).toMatch(/认不出|可改/);
  });

  it('实体不存在 → 拒', () => {
    const { ops, errors } = resolveEdits(ents(), [{ entity: 'nope', target: '重力', value: 1 }]);
    expect(ops).toHaveLength(0);
    expect(errors[0]).toMatch(/不存在/);
  });

  it('确定性：同输入两次 → 完全一致', () => {
    const edits: LooseEdit[] = [{ entity: 'player', target: '重力', value: '0.7' }, { entity: 'platform1', target: '变红' }];
    expect(JSON.stringify(run(ents(), edits).entities)).toBe(JSON.stringify(run(ents(), edits).entities));
  });

  it('安全网：批量编辑后仍能 parseManifest + 过 ApolloBench（仍是合法可玩游戏）', () => {
    const r = run(ents(), [
      { entity: 'player', target: '重力', value: '0.8' },
      { entity: 'player', target: 'speed', factor: 1.3 },
      { entity: 'platform1', target: '变绿' },
    ]);
    const edited = { name: 'edited', capabilities: CAPS, entities: r.entities };
    const report = benchBlueprint('edited', () => parseManifest(edited));
    expect(report.passed, JSON.stringify(report.axes)).toBe(true);
  });

  it('命令行解析（零模型对照实现）：三种模式', () => {
    expect(parseCommand('player 重力 0.9')).toEqual({ entity: 'player', target: '重力', value: '0.9' });
    expect(parseCommand('player speed x1.5')).toEqual({ entity: 'player', target: 'speed', factor: 1.5 });
    expect(parseCommand('platform1 变蓝')).toEqual({ entity: 'platform1', target: '颜色', value: '变蓝' });
    // 命令行 → 解析 → 应用 全链
    const cmd = parseCommand('player 重力 0.9') as LooseEdit;
    const r = run(ents(), [cmd]);
    expect(field(r.entities, 'player', 'Acceleration', 'ay')).toBe(0.9);
  });
});
