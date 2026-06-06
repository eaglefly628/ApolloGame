import { describe, it, expect } from 'vitest';
import { parseManifest, parseManifestDetailed } from './manifest.js';
import { exportManifest } from '../studio/inspect.js';
import { Engine } from '../runtime/engine.js';
import { benchBlueprint } from '../bench/apollo-bench.js';
import type { WorldBlueprint } from './demo.assembly.js';
import { buildGameABlueprint, LEVEL_SCROLL } from '../games/game-a/index.js';
import { buildGameBBlueprint } from '../games/game-b/index.js';
import { buildGameCBlueprint } from '../games/game-c/index.js';

const games: Array<[string, () => WorldBlueprint]> = [
  ['game-a', () => buildGameABlueprint(LEVEL_SCROLL)],
  ['game-b', () => buildGameBBlueprint()],
  ['game-c', () => buildGameCBlueprint()],
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

  it('entities-only（无 capabilities）→ 据组件推断，game-c(sim) 可加载运行', () => {
    const entitiesOnly = { entities: JSON.parse(exportManifest(buildGameCBlueprint())).entities };
    const r = parseManifestDetailed(entitiesOnly);
    expect(r.inferredCapabilities).toBe(true);
    expect(r.blueprint.capabilities.length).toBeGreaterThan(0);
    const e = new Engine({ tickRate: 60 });
    e.load(r.blueprint);
    for (let i = 0; i < 10; i++) e.world.tick();
    expect(e.world.getAllEntities().length).toBeGreaterThan(0);
  });
});
