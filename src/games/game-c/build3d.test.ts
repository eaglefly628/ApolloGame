import { describe, it, expect } from 'vitest';
import { build3DTableBlueprint, seatWorldPos, SEAT_COUNT } from './build3d.js';

describe('game-c build3d — 2D 视角 3D 牌桌 + 物理围栏（owner 2026-07-18）', () => {
  it('蓝图有陡俯视相机 + 光 + 椭圆呢面（带碰撞体）', () => {
    const bp = build3DTableBlueprint();
    expect(bp.capabilities).toEqual([]); // 静态场景无 tick system
    const cam = bp.entities['cam']!.Camera3D as { pitch: number } | undefined;
    expect(cam).toBeTruthy();
    expect(cam!.pitch).toBeGreaterThan(1.0); // 陡俯视（近 2D 平面观感·非 45° 斜视）
    const felt = bp.entities['table-felt']!;
    expect(felt.Mesh3D).toBeTruthy();
    expect((felt.RigidBody3D as { mass: number } | undefined)?.mass).toBe(0); // 呢面静态碰撞体（筹码落此面）
  });

  it('一圈**隐形**物理围栏墙（静态 box·mass0·挡筹码不出台·owner：看不见只碰撞）', () => {
    const bp = build3DTableBlueprint();
    const rails = Object.keys(bp.entities).filter((k) => k.startsWith('rail-'));
    expect(rails.length).toBeGreaterThanOrEqual(24); // 足够多段贴椭圆·闭环
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
