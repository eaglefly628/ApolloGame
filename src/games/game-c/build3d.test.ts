import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { build3DTableBlueprint, seatWorldPos, SEAT_COUNT } from './build3d.js';

describe('game-c build3d — 3D 牌房场景蓝图', () => {
  it('capabilities 空（静态 render-only·无 tick system）+ 关键实体齐', () => {
    const bp = build3DTableBlueprint();
    expect(bp.capabilities).toEqual([]);
    const e = bp.entities;
    expect(e['cam'].Camera3D).toBeTruthy(); // 斜俯视相机
    expect(e['sun'].Light3D).toBeTruthy(); // 主光
    expect(e['table-felt'].Mesh3D).toBeTruthy(); // 呢面
    expect(e['floor'].Mesh3D).toBeTruthy(); // 地板
    for (let i = 0; i < SEAT_COUNT; i++) expect(e[`stool-${i}`].Mesh3D).toBeTruthy(); // 六凳
    for (let i = 0; i < 5; i++) expect(e[`board3d-${i}`].Mesh3D).toBeTruthy(); // 公共牌位
  });

  it('相机=斜俯视透视（art-data §5.1 pitch≈46°）', () => {
    const cam = build3DTableBlueprint().entities['cam'].Camera3D as Record<string, unknown>;
    expect(cam['projection']).toBe('perspective');
    expect(cam['pitch']).toBeGreaterThan(0.6);
    expect(cam['pitch']).toBeLessThan(0.9);
  });

  it('六席环坐：主角 i=0 正南(+z)·六席互不重叠', () => {
    const p0 = seatWorldPos(0);
    expect(Math.abs(p0.x)).toBeLessThan(1e-9); // 主角 x=0
    expect(p0.z).toBeGreaterThan(2); // +z 朝镜头（南）
    const seen = new Set<string>();
    for (let i = 0; i < SEAT_COUNT; i++) {
      const p = seatWorldPos(i);
      const key = `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
      expect(seen.has(key)).toBe(false); // 无重叠
      seen.add(key);
    }
  });

  it('「能存必须能跑」：引擎 load + 空跑 2 tick 不崩（S3 骨架门语义）', () => {
    const engine = new Engine();
    expect(() => {
      engine.load(build3DTableBlueprint());
      engine.world.tick();
      engine.world.tick();
    }).not.toThrow();
  });
});
