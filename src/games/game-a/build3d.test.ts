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

  it('呢面挂程序化绒面 surface（owner 高质量材质/高光=真图未到也有立体绒纹 + 挑光·非纯平色）', () => {
    const mat = bp.entities['felt']!.Material3D as { surface?: { pattern: string; rough?: number; normal?: number }; roughness?: number } | undefined;
    expect(mat?.surface?.pattern).toBe('noise'); // 细绒纹（非蛋格/划痕）
    expect(mat?.surface?.rough).toBeGreaterThan(0); // rough 起伏=凸绒挑光/凹处哑 → 高光的机制根据
    expect(mat?.surface?.normal).toBeGreaterThan(0); // normal 起伏=绒毛立体
    expect(mat?.roughness).toBeLessThan(0.85); // 略降默认哑光 → 丝绒微泽吃光
  });

  it('古铜边环(copper 金属·拉丝 surface) + 深胡桃桌基(wood·木纹 surface)（owner 2026-07-22 边环改古铜金属+材质感·均非平色）', () => {
    const rim = bp.entities['rim']!.Material3D as { preset: string; surface?: { pattern: string } } | undefined;
    const base = bp.entities['base']!.Material3D as { preset: string; surface?: { pattern: string } } | undefined;
    expect(rim?.preset).toBe('copper'); // owner：从亮金改古铜金属（材质球选一个衬酒红的暖金属）
    expect(rim?.surface?.pattern).toBe('scratches'); // 金属拉丝/木纹感（"金属的木纹"）
    expect(base?.preset).toBe('wood');
    expect(base?.surface?.pattern).toBe('scratches'); // 木料年轮纹
  });

  it('无物理筹码/围栏（掼蛋纯观感·区别德州）', () => {
    expect(Object.keys(bp.entities).filter((k) => k.startsWith('rail-') || k.startsWith('chip'))).toHaveLength(0);
    expect(Object.values(bp.entities).some((e) => e.RigidBody3D)).toBe(false);
  });
});
