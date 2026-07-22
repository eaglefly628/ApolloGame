import { describe, it, expect } from 'vitest';
import { build3DTableBlueprint, FELT_RX, FELT_RZ } from './build3d.js';

// owner 2026-07-22「牌桌用 3D + 高质量材质 + 高光 + 打几盏灯」：render-only 3D 呢面桌蓝图（ThreeRenderer 消费·不进 sim/hash）。
describe('game-a build3d — 3D 呢面牌桌（owner 2026-07-22）', () => {
  const bp = build3DTableBlueprint();

  it('纯 render-only：无 capabilities（静态场景·不进 sim/hash·回放零影响）', () => {
    expect(bp.capabilities).toEqual([]);
  });

  it('陡俯视相机（近平面观感·非 45° 斜视）', () => {
    const cam = bp.entities['cam']!.Camera3D as { pitch: number; projection: string } | undefined;
    expect(cam).toBeTruthy();
    expect(cam!.pitch).toBeGreaterThan(1.1); // 陡俯视
    expect(cam!.projection).toBe('perspective');
  });

  it('打几盏灯：≥4 盏（暖主光投影=高光/立体 + 暖光池 point + 环境/补光）', () => {
    const lights = Object.values(bp.entities).filter((e) => e.Light3D).map((e) => e.Light3D as { kind: string; castShadow?: boolean });
    expect(lights.length).toBeGreaterThanOrEqual(4);
    expect(lights.some((l) => l.kind === 'directional' && l.castShadow === true)).toBe(true); // 主光投影=立体+高光
    expect(lights.some((l) => l.kind === 'point')).toBe(true); // 桌心暖光池（高光）
    expect(lights.some((l) => l.kind === 'ambient')).toBe(true);
  });

  it('椭圆酒红呢面带材质贴图槽 skinKey（工坊换高清呢面即热替换·A-023·俟 gen 填）', () => {
    const felt = bp.entities['felt']!;
    expect((felt.Mesh3D as { shape: string } | undefined)?.shape).toBe('cylinder');
    const mat = felt.Material3D as { preset: string; map?: string; normalMap?: string } | undefined;
    expect(mat?.preset).toBe('matte'); // 无真图=回退酒红 preset matte（兜底永不丢）
    expect(mat?.map).toBe('game-a/table/felt-albedo');
    expect(mat?.normalMap).toBe('game-a/table/felt-normal');
    expect(FELT_RX).toBeGreaterThan(FELT_RZ); // 椭圆（长轴 x > 短轴 z）
  });

  it('金边环(gold 高光) + 深胡桃桌基(wood)（夜宴金饰 + 桌身）', () => {
    expect((bp.entities['rim']!.Material3D as { preset: string } | undefined)?.preset).toBe('gold');
    expect((bp.entities['base']!.Material3D as { preset: string } | undefined)?.preset).toBe('wood');
  });

  it('无物理筹码/围栏（掼蛋纯观感·区别德州）', () => {
    expect(Object.keys(bp.entities).filter((k) => k.startsWith('rail-') || k.startsWith('chip'))).toHaveLength(0);
    expect(Object.values(bp.entities).some((e) => e.RigidBody3D)).toBe(false);
  });
});
