import { describe, it, expect } from 'vitest';
import { build3DTableBlueprint, seatWorldPos, SEAT_COUNT } from './build3d.js';

describe('game-c build3d — 长方 3D 牌桌（owner 2026-07-22：椭圆→长方·呢面 flat plane 易换材质·桌边 glossy 木纹）', () => {
  it('顶视稍斜相机 + 光 + 长方呢面 plane + 木桌体碰撞体', () => {
    const bp = build3DTableBlueprint();
    expect(bp.capabilities).toEqual([]); // 静态场景无 tick system
    const cam = bp.entities['cam']!.Camera3D as { pitch: number } | undefined;
    expect(cam).toBeTruthy();
    expect(cam!.pitch).toBeGreaterThan(1.0); // 顶视稍斜（近 2D 平面观感）
    // 呢面 = flat plane（clean UV·易换材质·map=felt-albedo）
    const felt = bp.entities['table-felt']!;
    expect((felt.Mesh3D as { shape: string } | undefined)?.shape).toBe('plane');
    expect((felt.Material3D as { map: string } | undefined)?.map).toBe('game-c/table/felt-albedo');
    // 碰撞体 = 木桌体 box（mass0·筹码落呢面）
    const body = bp.entities['table-body']!;
    expect((body.RigidBody3D as { shape: string; mass: number } | undefined)?.shape).toBe('box');
    expect((body.RigidBody3D as { mass: number } | undefined)?.mass).toBe(0);
  });

  it('四面**隐形**物理矮墙（静态 box·mass0·挡筹码不滑出长方呢面·不渲染）', () => {
    const bp = build3DTableBlueprint();
    const rails = Object.keys(bp.entities).filter((k) => k.startsWith('rail-'));
    expect(rails.length).toBe(4); // 长方四边各一堵
    for (const k of rails) {
      const rb = bp.entities[k]!.RigidBody3D as { shape: string; mass: number } | undefined;
      expect(rb?.shape).toBe('box');
      expect(rb?.mass).toBe(0); // 静态围栏（physics.ts 明许「围栏/地台」不重落）
      expect((bp.entities[k]!.Visibility as { visible: boolean } | undefined)?.visible).toBe(false); // 不渲染·只碰撞
    }
  });

  it('无椅子（owner「椅子就不用了」）', () => {
    const bp = build3DTableBlueprint();
    expect(Object.keys(bp.entities).filter((k) => k.startsWith('stool'))).toHaveLength(0);
  });

  it('seatWorldPos：主角(座0)正南 +z·六席环桌·确定', () => {
    expect(SEAT_COUNT).toBe(6);
    expect(seatWorldPos(0).z).toBeGreaterThan(0); // 座0 南(+z·朝镜头)
    expect(Math.abs(seatWorldPos(0).x)).toBeLessThan(0.01); // 座0 居中
    expect(seatWorldPos(0)).toEqual(seatWorldPos(0)); // 纯函数确定
  });
});
