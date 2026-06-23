import { describe, it, expect } from 'vitest';
import { parseManifest, parseManifestDetailed } from './manifest.js';
import { exportManifest } from '../studio/inspect.js';
import { Engine } from '../runtime/engine.js';
import { benchBlueprint } from '../bench/apollo-bench.js';
import type { WorldBlueprint } from './demo.assembly.js';
import { buildGameABlueprint, LEVEL_SCROLL } from '../games/game-a/index.js';

const games: Array<[string, () => WorldBlueprint]> = [
  ['game-a', () => buildGameABlueprint(LEVEL_SCROLL)],
];

function hashAfter(bp: WorldBlueprint, n = 60): string {
  const e = new Engine({ tickRate: 60 });
  e.load(bp);
  for (let i = 0; i < n; i++) e.world.tick();
  return e.hash();
}

describe('manifest 桥接：导出↔导入对称、可加载、可玩', () => {
  for (const [name, build] of games) {
    it(`${name}: export → parseManifest 重建后 hash 与原始一致（忠实可加载）`, () => {
      const orig = build();
      const rebuilt = parseManifest(JSON.parse(exportManifest(orig)));
      expect(hashAfter(rebuilt)).toBe(hashAfter(orig));
    });

    it(`${name}: 重建蓝图能过 ApolloBench`, () => {
      const rebuilt = () => parseManifest(JSON.parse(exportManifest(build())));
      expect(benchBlueprint(name, rebuilt).passed).toBe(true);
    });
  }

  it('未知 capability id → 明确报错', () => {
    expect(() => parseManifest({ capabilities: ['nope.nope'], entities: {} })).toThrow(/未知 capability/);
  });

  it('数组 entities（旧生成格式）→ 报错并指引', () => {
    expect(() => parseManifest({ capabilities: [], entities: [] })).toThrow(/旧生成格式|entities/);
  });

  it('组件数据里多带的 type 字段会被剥掉（键才是权威）', () => {
    const bp = parseManifest({
      capabilities: ['a1-transform'],
      entities: { e: { Transform: { type: 'Transform', x: 1, y: 2, rotation: 0, scaleX: 1, scaleY: 1 } } },
    });
    expect((bp.entities.e.Transform as Record<string, unknown>).type).toBeUndefined();
    expect((bp.entities.e.Transform as Record<string, unknown>).x).toBe(1);
  });

  it('canonical 预设形态(平台跳跃, 相机居中)→ parseManifest→load→过 ApolloBench', () => {
    // 镜像 apollo.py 的 platformer 预设结构：证明「在透视器里打开」的预设路径可加载可玩。
    const manifest = {
      name: 'preset-platformer',
      capabilities: ['a1-transform', 'b1-velocity', 'b2-acceleration', 'c1-shape', 'l2-color',
        'd1-overlap-detect', 't1-accel-apply', 't1-motion-apply', 't2-collision-resolve', 't2-bounds-clamp'],
      entities: {
        camera: { Camera: { zoom: 1, offsetX: 320, offsetY: 200, rotation: 0, viewportW: 640, viewportH: 400 } },
        player: {
          Transform: { x: 120, y: 100, rotation: 0, scaleX: 1, scaleY: 1 },
          Velocity: { vx: 0, vy: 0, angular: 0 }, Acceleration: { ax: 0, ay: 0.5 },
          Shape: { kind: 'box', width: 20, height: 20 }, Mass: { value: 1 },
          Color: { tint: 0x38bdf8, alpha: 1 }, Bounds: { minX: 0, minY: 0, maxX: 640, maxY: 400 },
        },
        ground: {
          Transform: { x: 320, y: 385, rotation: 0, scaleX: 1, scaleY: 1 },
          Shape: { kind: 'box', width: 640, height: 30 }, Mass: { value: 0 }, Color: { tint: 0x334155, alpha: 1 },
        },
      },
    };
    const r = benchBlueprint('preset', () => parseManifest(manifest));
    expect(r.spatial).toBe(true);
    expect(r.passed, JSON.stringify(r.axes)).toBe(true);
  });

  it('entities-only（无 capabilities）→ 据组件推断，可加载运行', () => {
    const entitiesOnly = { entities: JSON.parse(exportManifest(buildGameABlueprint(LEVEL_SCROLL))).entities };
    const r = parseManifestDetailed(entitiesOnly);
    expect(r.inferredCapabilities).toBe(true);
    expect(r.blueprint.capabilities.length).toBeGreaterThan(0);
    const e = new Engine({ tickRate: 60 });
    e.load(r.blueprint);
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(e.world.getAllEntities().length).toBeGreaterThan(0);
  });
});
