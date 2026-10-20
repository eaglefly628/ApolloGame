import { describe, expect, it, vi } from 'vitest';
import type { SceneImportData, SceneImportNode } from '@assets/scene-import-data.js';
import type { EntityBlueprint } from './demo.assembly.js';
import type { NavGraph, NavPath, Transform } from '@engine/protocol/components.js';
import { Engine } from '@runtime/engine.js';
import { parseManifest } from './manifest.js';
import { parseManifestAsync } from './manifest-async.js';
import { expandSceneImports, sceneImportKeys } from './scene-import.js';
import { sceneImport3dCapability } from '@atom-skills/scene-import-3d/index.js';
import { validateComponentData } from './validate-manifest.js';

const matrix = (x = 0, y = 0, z = 0): number[] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const transform = (x: number, y: number) => ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
const cubeIndices = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
function geom(index: number, name: string, positions: number[], indices: number[]): SceneImportNode {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  positions.forEach((v, i) => { min[i % 3] = Math.min(min[i % 3], v); max[i % 3] = Math.max(max[i % 3], v); });
  return { index, path: [index], name, kind: name.startsWith('col_') ? 'collision' : name.startsWith('nav_') ? 'navigation' : 'pick', worldMatrix: matrix(), positions, indices, bounds: { min, max } };
}
const rect = (index: number, x0: number, z0: number, x1: number, z1: number, y = 0): SceneImportNode =>
  geom(index, 'nav_ground', [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z1], [0, 1, 2, 0, 2, 3]);
function box(index: number, name: string, min: number[], max: number[], shear = 0): SceneImportNode {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  const positions = [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]
    .flatMap(([x, y, z]) => [Math.round((x + y * shear) * 10000) / 10000, y, z]);
  return geom(index, name, positions, cubeIndices);
}
const spawn = (index: number, x: number, z: number): SceneImportNode => ({ index, path: [index], name: 'spawn_same', kind: 'spawn', worldMatrix: matrix(x, 0, z) });
const scene = (...nodes: SceneImportNode[]): SceneImportData => ({ version: 1, sourceSha256: 'a'.repeat(64), nodes });
const imports = { level: { SceneImport3D: { modelKey: 'level', rules: 'default' } } };
const fixture = () => scene(rect(0, 0, 0, 8, 6), box(1, 'col_support', [0, -.2, 0], [8, 0, 6]), box(2, 'col_pillar', [3, 0, 1.5], [4, 3, 4.5]), box(3, 'pick_item', [6, 0, 1], [6.5, .5, 1.5]), spawn(4, 1.25, 3.25));
const expand = (data: SceneImportData) => expandSceneImports(imports, { level: data }) as Record<string, EntityBlueprint>;
function blockedAt(entities: Record<string, EntityBlueprint>, x: number, z: number): number {
  const grid = entities.level.NavigationGrid! as { originX: number; originY: number; cellSize: number; cols: number; blocked: number[] };
  return grid.blocked[Math.floor((z - grid.originY) / grid.cellSize) * grid.cols + Math.floor((x - grid.originX) / grid.cellSize)];
}
function quietReject(run: () => unknown): void {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try { run(); } finally { log.mockRestore(); }
}

describe('scene import load-time data', () => {
  it('closed schema and capability have no tick systems', () => {
    expect(sceneImport3dCapability.systems).toEqual([]);
    expect(validateComponentData([sceneImport3dCapability], { level: { SceneImport3D: { modelKey: 'level', rules: 'guess' } } }).errors).not.toEqual([]);
    expect(validateComponentData([sceneImport3dCapability], imports).errors).toEqual([]);
  });
  it('discovers imports after template/repeat expansion', () => {
    expect(sceneImportKeys({ templates: { scene: { SceneImport3D: { modelKey: '{{model}}', rules: 'default' } } }, entities: {
      'map-{{i}}': { $template: 'scene', $params: { model: '{{item.key}}' }, $repeat: { items: [{ key: 'b' }, { key: 'a' }, { key: 'b' }] } },
    } })).toEqual(['a', 'b']);
    expect(sceneImportKeys({ entities: { old: { Transform: transform(0, 0) } } })).toEqual([]);
  });
  it('stable node paths tolerate duplicate names and preserve inputs; expanded data is idempotent', () => {
    const data = scene(...fixture().nodes, spawn(5, 2, 3));
    const before = JSON.stringify([imports, data]);
    const out = expand(data);
    expect(out['level/node-4'].Transform).toMatchObject({ x: 1.25, y: 3.25 });
    expect(out['level/node-5'].Transform).toMatchObject({ x: 2, y: 3 });
    expect(out.level.SceneImport3D).toBeUndefined();
    expect(out.level.Model3D).toEqual({ modelKey: 'level', excludeNodes: [0, 3, 4, 5] });
    expect(out['level/node-3'].Model3D).toEqual({ modelKey: 'level', nodeIndex: 3, origin: [6.25, .25, 1.25] });
    expect(out['level/node-3'].Pickable3D).toEqual({ signal: 'scene.pick' });
    expect(out['level/node-2'].Collider3D!.kind).toBe('hull');
    expect(JSON.stringify([imports, data])).toBe(before);
    expect(expandSceneImports(out)).toBe(out);
  });
  it('old scenes are unchanged without a catalog', () => {
    const old = { old: { Transform: transform(1, 2) } };
    expect(expandSceneImports(old)).toBe(old);
    const engine = new Engine(); engine.load(parseManifest({ entities: old }));
    expect(engine.world.getComponent<Transform>('old', 'Transform')!.x).toBe(1);
  });
  it('sync and async entrances expand templates before inference and reject invalid imports consistently', async () => {
    const source = { templates: { scene: { SceneImport3D: { modelKey: '{{key}}', rules: 'default' } } }, entities: { level: { $template: 'scene', $params: { key: 'level' } } } };
    const catalog = { level: fixture() };
    const sync = parseManifest(source, { sceneImports: catalog });
    const asyncBlueprint = await parseManifestAsync(source, { sceneImports: catalog });
    expect(asyncBlueprint.entities).toEqual(sync.entities);
    expect(sync.capabilities.some(c => c.id === 't2-navigation-grid')).toBe(true);
    expect(sync.capabilities.some(c => c.id === 'd1-overlap-detect-3d')).toBe(true);
    expect(sync.entities['level/node-4'].Transform).toMatchObject({ x: 1.25, y: 3.25 });
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      for (const entities of [imports, { level: { SceneImport3D: { modelKey: 'level', rules: 'unknown' } } }]) {
        expect(() => parseManifest({ entities })).toThrow(/scene-import/);
        await expect(parseManifestAsync({ entities })).rejects.toThrow(/scene-import/);
      }
    } finally { log.mockRestore(); }
  });
  it('rejects missing/bad data, transforms, concavity and generated id collisions before changing an existing world', () => quietReject(() => {
    const engine = new Engine({ tickRate: 30 });
    engine.world.createEntity('kept');
    const before = engine.hash();
    const badConcave = box(2, 'col_bad', [0, 0, 0], [2, 2, 2]);
    const ps = [...badConcave.positions!]; ps[0] = .5; ps[1] = .5; ps[2] = .5;
    const concave = geom(2, 'col_bad', ps, [...badConcave.indices!]);
    const bad = { ...fixture(), nodes: fixture().nodes.map(n => n.index === 0 ? { ...n, indices: [999, 0, 1] } : n) };
    const cases = [
      { entities: imports, catalog: undefined },
      { entities: imports, catalog: { level: bad } },
      { entities: { level: { ...imports.level, Transform: transform(1, 2) } }, catalog: { level: fixture() } },
      { entities: { ...imports, 'level/node-4': {} }, catalog: { level: fixture() } },
      { entities: imports, catalog: { level: scene(concave) } },
      { entities: { ...imports, kept: {} }, catalog: { level: fixture() } },
    ];
    for (const c of cases) {
      expect(() => engine.load({ entities: c.entities, capabilities: [], meta: { tickRate: 90 } }, { sceneImports: c.catalog })).toThrow();
      expect(engine.hash()).toBe(before); expect(engine.tickRate).toBe(30);
      expect(engine.world.query().map(([id]) => id)).toEqual(['kept']);
    }
  }));
});

describe('scene import conservative navigation', () => {
  it('uses triangle union, removes shared internal edges, distinguishes floor support and a thin wall without names', () => {
    const out = expand(scene(rect(0, 0, 0, 4, 4), rect(1, 4, 0, 8, 4), box(2, 'col_wall_named_floor', [3.1, 0, 1], [3.11, 3, 3]), box(3, 'col_solid', [0, -.2, 0], [8, .001, 4])));
    expect(blockedAt(out, .25, .25)).toBe(0); // internal triangle diagonal
    expect(blockedAt(out, 3.75, 1.25)).toBe(0); // shared edge between two nav meshes
    expect(blockedAt(out, 4.25, 1.25)).toBe(0);
    expect(blockedAt(out, 3.25, 1.25)).toBe(1); // very thin wall intersects full cell
    const joined = expand(scene(rect(0, 0, 0, 3.1, 4), rect(1, 3.1, 0, 8, 4)));
    expect(blockedAt(joined, 3.25, 1.25)).toBe(0); // shared nav edge crosses cell interior
    const overlap = expand(scene(rect(0, 0, 0, 3.1, 4), rect(1, 2, 0, 8, 4)));
    expect(overlap.level.NavGraph!.nodes).toHaveLength(128);
    expect(blockedAt(overlap, 3.25, 1.25)).toBe(0);
    const gap = expand(scene(rect(0, 0, 0, 3.1, 4), rect(1, 3.1001, 0, 8, 4)));
    expect(blockedAt(gap, 3.25, 1.25)).toBe(1); // 0.1mm gap must not disappear under a side probe
  });
  it('blocks a sub-cell hole even though the cell centre lies on navigation', () => {
    const out = expand(scene(rect(0, 0, 0, 2, .1), rect(1, 0, .2, 2, 2), rect(2, 0, .1, .1, .2), rect(3, .2, .1, 2, .2)));
    expect(blockedAt(out, .25, .25)).toBe(1);
    expect(blockedAt(out, 1.25, 1.25)).toBe(0);
  });
  it('removes enclosed patch edges and differently segmented T-junction edges from the union boundary', () => {
    const enclosed = expand(scene(rect(0, 0, 0, 4, 4), rect(1, 1.1, 1.1, 2.1, 2.1)));
    expect(blockedAt(enclosed, 1.25, 1.25)).toBe(0);
    expect(enclosed.level.NavGraph!.nodes).toHaveLength(64);
    const junction = expand(scene(rect(0, 0, 0, 2.1, 4), rect(1, 2.1, 0, 4, 2), rect(2, 2.1, 2, 4, 4)));
    expect(blockedAt(junction, 2.25, 1.25)).toBe(0);
    expect(junction.level.NavGraph!.nodes).toHaveLength(64);
  });
  it('preserves non-rectangular nav boundaries', () => {
    const out = expand(scene(geom(0, 'nav_triangle', [0, 0, 0, 3, 0, 0, 0, 0, 3], [0, 1, 2])));
    expect(blockedAt(out, .25, .25)).toBe(0);
    expect(blockedAt(out, 2.25, 2.25)).toBe(1);
    expect(blockedAt(out, 1.25, 1.75)).toBe(1); // centre on edge; cell crosses outside
  });
  it('clips convex obstacles to the 1.8m occupied height before projection and ignores overhead geometry', () => {
    const out = expand(scene(rect(0, 0, 0, 7, 4), box(1, 'col_slant', [0, 0, 1], [2, 3, 2], 1), box(2, 'col_overhead', [5, 2, 1], [6, 3, 2])));
    expect(blockedAt(out, 3.75, 1.25)).toBe(1);
    expect(blockedAt(out, 4.25, 1.25)).toBe(0); // global hull reaches x=5; clipped hull reaches 3.8
    expect(blockedAt(out, 5.25, 1.25)).toBe(0);
  });
  it('explicitly rejects slopes and overlapping levels, retaining original asset geometry', () => quietReject(() => {
    const tilted = geom(0, 'nav_slope', [0, 0, 0, 3, 1, 0, 0, 0, 3], [0, 1, 2]);
    const before = JSON.stringify(tilted);
    expect(() => expand(scene(tilted))).toThrow(/R2/);
    expect(JSON.stringify(tilted)).toBe(before);
    expect(() => expand(scene(rect(0, 0, 0, 3, 3), rect(1, 0, 0, 3, 3, 2)))).toThrow(/level/);
    const n = rect(0, 0, 0, 3, 3);
    expect(expand(scene(n, { ...n, index: 1, path: [1] })).level.NavGraph!.nodes).toHaveLength(36); // union is idempotent
  }));
});

describe('scene import real engine integration', () => {
  const caps = ['a1-transform', 'd1-overlap-detect-3d', 'd-collision-resolve-3d', 't2-navigation-grid', 't2-pathfind', 't1-motion-apply', 't3-prefab', 't3-caster'];
  const raw = () => ({ capabilities: caps, entities: {
    ...imports,
    mover: { Transform: transform(1.25, 3.25), NavAgent: { graphId: 'level', speed: .08, arriveRange: .08 }, Relation: { kind: 'target', targetId: 'goal' } },
    goal: { Transform: transform(7.25, 3.25) },
    body: { Transform: transform(2.9, 3.25), Collider3D: { kind: 'sphere', radius: .4, baseY: .5 }, Velocity: { vx: .03, vy: 0, angular: 0 } },
    library: { PrefabLibrary: { seq: 0, templates: { actor: { entities: { unit: { Transform: transform(0, 0) } } } } } },
    deploy: { Caster: { onSignal: 'deploy', template: 'actor', at: 'self', originEntity: 'level/node-4' } },
    signal: { Signal: { name: 'deploy' } },
  } });
  it('sync, async and direct Engine loads share expansion, run deterministically, push collisions, route around obstacles and spawn prefabs at anchors', async () => {
    const source = raw(), catalog = { level: fixture() };
    const before = JSON.stringify([source, catalog]);
    const sync = parseManifest(source, { sceneImports: catalog });
    const asyncBlueprint = await parseManifestAsync(source, { sceneImports: catalog });
    expect(asyncBlueprint.entities).toEqual(sync.entities);
    const engines = [new Engine(), new Engine(), new Engine(), new Engine()];
    engines[0].load(sync); engines[1].load(asyncBlueprint);
    engines[2].load({ entities: source.entities, capabilities: sync.capabilities }, { sceneImports: catalog });
    engines[3].load({ entities: source.entities, capabilities: sync.capabilities }, { sceneImports: catalog });
    expect(new Set(engines.map(e => e.hash())).size).toBe(1);
    let detour = 0, sawPath = false;
    for (let tick = 0; tick < 180; tick++) {
      for (const e of engines) e.world.tick();
      expect(new Set(engines.map(e => e.hash())).size).toBe(1);
      detour = Math.max(detour, Math.abs(engines[0].world.getComponent<Transform>('mover', 'Transform')!.y - 3.25));
      sawPath ||= !!engines[0].world.getComponent<NavPath>('mover', 'NavPath')?.via.length;
    }
    const e = engines[0], mover = e.world.getComponent<Transform>('mover', 'Transform')!;
    expect(sawPath).toBe(true); expect(detour).toBeGreaterThanOrEqual(1.5); expect(mover.x).toBeGreaterThan(6.9);
    expect(e.world.getComponent<Transform>('body', 'Transform')!.x).toBeLessThanOrEqual(2.61);
    expect(e.world.getComponent<Transform>('actor#0:unit', 'Transform')).toMatchObject({ x: 1.25, y: 3.25 });
    expect(e.world.getComponent<NavGraph>('level', 'NavGraph')!.nodes.length).toBeGreaterThan(0);
    expect(JSON.stringify([source, catalog])).toBe(before);
  });
});
