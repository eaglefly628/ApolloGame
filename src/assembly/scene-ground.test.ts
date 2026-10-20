import { describe, expect, it, vi } from 'vitest';
import type { SceneImportData, SceneImportNode } from '@assets/scene-import-data.js';
import type { GroundSurface3D, NavGraph, NavigationGrid } from '@engine/protocol/components.js';
import type { EntityBlueprint } from './demo.assembly.js';
import { sampleGroundSurface, walkGroundSurface } from '@engine/spatial/ground-surface.js';
import { bakeNavigationProfile } from '@skills/tier2/navigation-grid.js';
import { expandSceneImports } from './scene-import.js';

const matrix = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const cube = [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7];
function geom(index: number, kind: SceneImportNode['kind'], ps: number[], indices: number[], name = 'same-name'): SceneImportNode {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  ps.forEach((v, i) => { min[i % 3] = Math.min(min[i % 3], v); max[i % 3] = Math.max(max[i % 3], v); });
  return { index, path: [index], kind, name: `${kind === 'navigation' ? 'nav_' : 'col_'}${name}`, worldMatrix: matrix, positions: ps, indices, bounds: { min, max } };
}
function rect(index: number, x0: number, z0: number, x1: number, z1: number, slope = 0, base = 0): SceneImportNode {
  return geom(index, 'navigation', [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].flatMap(([x, z]) => [x, Math.round((x * slope + base) * 10000) / 10000, z]), [0, 1, 2, 0, 2, 3]);
}
function box(index: number, min: number[], max: number[], slope = 0): SceneImportNode {
  const [x0, y0, z0] = min, [x1, y1, z1] = max;
  return geom(index, 'collision', [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]].flatMap(([x, y, z]) => [x, Math.round((y + slope * x) * 10000) / 10000, z]), cube);
}
function scene(...nodes: SceneImportNode[]): SceneImportData { return { version: 1, sourceSha256: 'a'.repeat(64), nodes }; }
function expand(data: SceneImportData, ground: unknown = { source: 'navigation' }): Record<string, EntityBlueprint> {
  return expandSceneImports({ level: { SceneImport3D: { modelKey: 'scene', rules: 'default', ...(ground === undefined ? {} : { ground }) } } }, { scene: data }) as Record<string, EntityBlueprint>;
}
function surface(out: Record<string, EntityBlueprint>): GroundSurface3D { return { type: 'GroundSurface3D', ...out.level.GroundSurface3D } as unknown as GroundSurface3D; }
function blocked(out: Record<string, EntityBlueprint>, x: number, z: number): number {
  const g = out.level.NavigationGrid! as unknown as NavigationGrid;
  return g.blocked![Math.floor((z - g.originY) / g.cellSize) * g.cols + Math.floor((x - g.originX) / g.cellSize)];
}
function reject(run: () => unknown): void {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try { run(); expect(warn).toHaveBeenCalled(); } finally { warn.mockRestore(); }
}

describe('SceneImport3D opt-in ground baking', () => {
  it('bakes integer sloped triangles, stable geometric support ids, preserves inputs and does not project the support ramp into an obstacle', () => {
    const data = scene(rect(0, -2, -2, 2, 2, .25), box(7, [-2, -.4, -2], [2, 0, 2], .25));
    const before = JSON.stringify(data), out = expand(data), s = surface(out);
    expect(s.triangles).toHaveLength(18);
    expect(s.triangles.every(Number.isSafeInteger)).toBe(true);
    expect(s.supportIds).toEqual([['level/node-7'], ['level/node-7']]);
    expect(sampleGroundSurface(s, -12500, 2500)?.heightQ).toBe(-3125);
    expect(sampleGroundSurface(s, 17500, -2500)?.heightQ).toBe(4375);
    expect(blocked(out, -.25, .25)).toBe(0);
    expect(out.level.NavGraph!.nodes).toHaveLength(64);
    expect(out['level/node-7'].Collider3D!.kind).toBe('hull');
    expect(JSON.stringify(data)).toBe(before);
    expect(expandSceneImports(out)).toBe(out);
    expect(expand(data)).toEqual(out);
  });
  it('retains the old horizontal E5 path when ground is absent and still rejects old-path slopes explicitly', () => {
    const data = scene(rect(0, 0, 0, 4, 4));
    const old = expandSceneImports({ level: { SceneImport3D: { modelKey: 'scene', rules: 'default' } } }, { scene: data }) as Record<string, EntityBlueprint>;
    expect(old.level.GroundSurface3D).toBeUndefined();
    expect(old.level.NavGraph!.nodes).toHaveLength(64);
    reject(() => expect(() => expandSceneImports({ level: { SceneImport3D: { modelKey: 'scene', rules: 'default' } } }, { scene: scene(rect(0, 0, 0, 4, 4, .25)) })).toThrow(/R2/));
  });
  it('matches support only through coplanar upper-face area, never duplicate names or shared height alone', () => {
    const out = expand(scene(rect(0, 0, 0, 4, 4), box(1, [0, -.2, 0], [4, 0, 4]), box(2, [6, -.2, 0], [8, 0, 4]), box(3, [2, 0, 1], [2.02, 2, 3])));
    expect(surface(out).supportIds).toEqual([['level/node-1'], ['level/node-1']]);
    expect(blocked(out, 2.25, 1.25)).toBe(1);
    expect(blocked(out, 1.25, 1.25)).toBe(0);
  });
  it('does not bless a narrow tilted crossing face as support merely because its vertices lie within the T7 height tolerance', () => {
    const out = expand(scene(rect(0, 0, 0, 4, 4), box(1, [1, -1.1, 1], [1.001, -1.0005, 2], 1)));
    expect(surface(out).supportIds).toEqual([[], []]);
    expect(blocked(out, 1.25, 1.25)).toBe(1);
  });
  it('preserves walls and a low ceiling over a supported slope while ignoring geometry above the occupied slab', () => {
    const out = expand(scene(rect(0, 0, 0, 6, 4, .25), box(1, [0, -.3, 0], [6, 0, 4], .25),
      box(2, [1.1, -.2, 1], [1.11, 3, 3]), box(3, [2, 1.2, 1], [3, 1.3, 3]), box(4, [4, 4, 1], [5, 4.1, 3])));
    expect(blocked(out, 1.25, 1.25)).toBe(1);
    expect(blocked(out, 2.25, 1.25)).toBe(1);
    expect(blocked(out, 4.25, 1.25)).toBe(0);
    expect(surface(out).supportIds.every(ids => ids.length === 1 && ids[0] === 'level/node-1')).toBe(true);
  });
  it('clips a crossing wall per actual sloped surface instead of sampling one global floor elevation', () => {
    const out = expand(scene(rect(0, 0, 0, 6, 4, .5), box(1, [0, -.3, 0], [6, 0, 4], .5), box(2, [0, .4, 1], [6, .6, 2])));
    expect(blocked(out, .25, 1.25)).toBe(1);
    expect(blocked(out, 2.25, 1.25)).toBe(0);
    expect(blocked(out, 5.25, 1.25)).toBe(0);
  });
  it('collision is an explicit alternate source, uses only upward <=45 degree faces, and reports filtering', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      const out = expand(scene(box(4, [-2, -.4, -2], [2, 0, 2], .5)), { source: 'collision' });
      expect(sampleGroundSurface(surface(out), 10000, 10000)?.heightQ).toBe(5000);
      expect(surface(out).triangles).toHaveLength(18);
      expect(surface(out).supportIds).toEqual([['level/node-4'], ['level/node-4']]);
      expect(out.level.NavGraph!.nodes).toHaveLength(64);
      expect(info).toHaveBeenCalledWith(expect.stringContaining('walls and downward faces are not ground'));
    } finally { info.mockRestore(); }
    reject(() => expect(() => expand(scene(box(0, [0, -.3, 0], [4, 0, 4])))).toThrow(/no walkable triangles/));
  });
  it('rejects steep authoritative navigation, overlapping different heights, missing sources and unknown ground fields atomically', () => reject(() => {
    const cases: Array<[SceneImportData, unknown, RegExp]> = [
      [scene(rect(0, 0, 0, 2, 2, 1.1)), { source: 'navigation' }, /45|slope|steep/],
      [scene(rect(0, 0, 0, 2, 2), rect(1, 0, 0, 2, 2, 0, .2)), { source: 'navigation' }, /overlap|height/],
      [scene(box(0, [0, -.2, 0], [2, 0, 2])), { source: 'navigation' }, /no walkable triangles/],
      [scene(rect(0, 0, 0, 2, 2)), { source: 'guess' }, /expected ground/],
      [scene(rect(0, 0, 0, 2, 2)), { source: 'navigation', tolerance: 10 }, /expected ground/],
    ];
    for (const [data, config, error] of cases) { const before = JSON.stringify(data); expect(() => expand(data, config)).toThrow(error); expect(JSON.stringify(data)).toBe(before); }
    expect(() => expandSceneImports({ level: { SceneImport3D: { modelKey: 'scene', rules: 'default', ground: { source: 'navigation' } }, GroundSurface3D: {} } }, { scene: scene(rect(0, 0, 0, 2, 2)) })).toThrow(/override conflicts/);
  }));
  it('does not relax E5 closed convex collision validation when enabling ground', () => reject(() => {
    const original = box(1, [0, -.2, 0], [4, 0, 4]);
    const open = { ...original, indices: original.indices!.slice(3) };
    expect(() => expand(scene(rect(0, 0, 0, 4, 4), open))).toThrow(/closed convex volume/);
  }));
});

describe('ground navigation shares deterministic terrain coverage', () => {
  it('keeps legal steps connected without inventing intermediate ramp heights', () => {
    const out = expand(scene(rect(0, 0, 0, 2, 4), rect(1, 2, 0, 4, 4, 0, .2))), s = surface(out);
    expect(sampleGroundSurface(s, 19999, 10000)?.heightQ).toBe(0);
    expect(sampleGroundSurface(s, 20001, 10000)?.heightQ).toBe(2000);
    expect(walkGroundSurface(s, 10000, 10000, 30000, 10000, 0, 2500, 5000)?.heightQ).toBe(2000);
    expect(out.level.NavGraph!.nodes).toHaveLength(64);
    expect(blocked(out, 1.75, 1.25)).toBe(0); expect(blocked(out, 2.25, 1.25)).toBe(0);
  });
  it('isolates excessive step boundaries, including exactly grid-aligned edges, through NavigationProfile rebakes', () => {
    const out = expand(scene(rect(0, 0, 0, 2, 4), rect(1, 2, 0, 4, 4, 0, 1)));
    expect(blocked(out, 1.75, 1.25)).toBe(1); expect(blocked(out, 2.25, 1.25)).toBe(1);
    expect(blocked(out, .75, 1.25)).toBe(0); expect(blocked(out, 3.25, 1.25)).toBe(0);
    const grid = { type: 'NavigationGrid', ...out.level.NavigationGrid } as NavigationGrid;
    const rebaked = bakeNavigationProfile(grid, 0)!;
    expect(rebaked.grid!.blocked).toEqual(grid.blocked);
    for (const graph of [out.level.NavGraph as unknown as NavGraph, rebaked]) {
      expect(graph.edges.every(e => (graph.nodes[e.a].x < 2) === (graph.nodes[e.b].x < 2))).toBe(true);
    }
  });
  it('isolates a non-grid-aligned high step and a T-junction partial high step', () => {
    const out = expand(scene(rect(0, 0, 0, 2.1, 4), rect(1, 2.1, 0, 4, 2, 0, 1), rect(2, 2.1, 2, 4, 4)));
    expect(blocked(out, 2.25, 1.25)).toBe(1);
    expect(blocked(out, 2.25, 3.25)).toBe(0);
    expect(blocked(out, 3.25, 1.75)).toBe(1); expect(blocked(out, 3.25, 2.25)).toBe(1);
  });
  it('retains an arbitrarily small hole and a slanted exterior even when the centre is on ground', () => {
    const out = expand(scene(rect(0, 0, 0, 2, .1, .25), rect(1, 0, .2, 2, 2, .25), rect(2, 0, .1, .1, .2, .25), rect(3, .2, .1, 2, .2, .25)));
    expect(blocked(out, .25, .25)).toBe(1); expect(blocked(out, 1.25, 1.25)).toBe(0);
    expect(walkGroundSurface(surface(out), 1000, 1500, 3000, 1500, 250, 2500, 5000)).toBeUndefined();
    const diagonal = expand(scene(geom(0, 'navigation', [0, 0, 0, 3, .75, 0, 0, 0, 3], [0, 1, 2])));
    expect(blocked(diagonal, 1.25, 1.75)).toBe(1);
  });
  it('does not erase a one-Q square hole or one-Q gap at negative world coordinates', () => {
    const x = -3, z = -2;
    const out = expand(scene(rect(0, x, z, x + 2, z + .1), rect(1, x, z + .1001, x + 2, z + 2), rect(2, x, z + .1, x + .1, z + .1001), rect(3, x + .1001, z + .1, x + 2, z + .1001)));
    expect(blocked(out, x + .25, z + .25)).toBe(1);
    expect(blocked(out, x + 1.25, z + 1.25)).toBe(0);
    const gap = expand(scene(rect(0, x, z, x + 1.1, z + 2), rect(1, x + 1.1001, z, x + 2, z + 2)));
    expect(blocked(gap, x + 1.25, z + .25)).toBe(1);
  });
  it('removes projected overlap/internal T junction boundaries on one continuous slope', () => {
    const out = expand(scene(rect(0, 0, 0, 2.1, 4, .25), rect(1, 2.1, 0, 4, 2, .25), rect(2, 2.1, 2, 4, 4, .25), rect(3, .1, .1, 1.1, 1.1, .25)));
    expect(out.level.NavGraph!.nodes).toHaveLength(64);
    expect(blocked(out, 2.25, 1.25)).toBe(0);
  });
  it('rejects geometry/grid/edge partition budgets with diagnostics instead of silently dropping triangles', () => reject(() => {
    const tooMany = Array.from({ length: 2049 }, (_, i) => rect(i, 0, 0, 1, 1));
    expect(() => expand(scene(...tooMany))).toThrow(/4096 triangles/);
    expect(() => expand(scene(rect(0, 0, 0, 300, 300)))).toThrow(/65536|cells|budget/);
  }));
});
