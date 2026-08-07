// WebGL2 实例化批渲规划器（REQ-3D-RENDER-EFFICIENCY 增量②）：纯函数·验并批/游程 z 序/烤仿射/跳过记数。
import { describe, it, expect } from 'vitest';
import {
  buildSpriteBatches, bakeQuadAffine, STRIDE, WHITE_TEXID, MODE_TEXTURED, MODE_BOX, MODE_CIRCLE,
  type TexResolver,
} from './sprite-batch.js';
import { entityMatrix, type DeviceBase } from '../canvas-transform.js';
import type { Renderable } from '../renderable.js';

const base: DeviceBase = { s: 1, e: 0, f: 0 }; // 无相机·dpr=1（设备=世界·便于对拍）

function rend(p: Partial<Renderable>): Renderable {
  return { entityId: 'e', x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, zOrder: 0, ...p };
}
// texKey 'A'→texId 0·'B'→texId 1（各 32×32 整图·UV 全幅）；未知→null（未就绪）。
const resolve: TexResolver = (key) =>
  key === 'A' ? { texId: 0, u0: 0, v0: 0, uw: 1, vh: 1, sw: 32, sh: 32 }
    : key === 'B' ? { texId: 1, u0: 0, v0: 0, uw: 1, vh: 1, sw: 16, sh: 16 } : null;

describe('bakeQuadAffine：单位四边形→设备 = 实体矩阵 ∘ 模型矩形（与 entityMatrix 对拍）', () => {
  it('烤进后四个角 = entityMatrix 下画 fillRect(dx,dy,sw,sh) 的四角', () => {
    const m = entityMatrix(base, 10, 20, 0, 1, 1); // 平移 (10,20)
    const A = bakeQuadAffine(m, -4, -4, 8, 8);      // 8×8 方·中心锚
    // 单位四边形角 (u,v) → device：A·(u,v)。左上 (0,0)、右下 (1,1)。
    const at = (u: number, v: number) => [A[0] * u + A[2] * v + A[4], A[1] * u + A[3] * v + A[5]];
    expect(at(0, 0)).toEqual([6, 16]);   // (10-4, 20-4)
    expect(at(1, 1)).toEqual([14, 24]);  // (10+4, 20+4)
    expect(at(1, 0)).toEqual([14, 16]);
  });
  it('带缩放：sw/sh 折进列向量', () => {
    const m = entityMatrix(base, 0, 0, 0, 2, 3);   // scaleX2 scaleY3
    const A = bakeQuadAffine(m, 0, 0, 10, 10);
    expect(A[0]).toBe(20); // a·sw = (1·2)·10
    expect(A[3]).toBe(30); // d·sh = (1·3)·10
  });
});

describe('buildSpriteBatches：并批与游程 z 序', () => {
  it('500 个同纹理精灵 → 1 批（1 draw call）', () => {
    const rs = Array.from({ length: 500 }, (_, i) => rend({ x: i, sprite: { textureKey: 'A' } as Renderable['sprite'] }));
    const plan = buildSpriteBatches(rs, base, resolve);
    expect(plan.drawCalls).toBe(1);
    expect(plan.batches[0].count).toBe(500);
    expect(plan.batches[0].data.length).toBe(500 * STRIDE);
    expect(plan.instanceCount).toBe(500);
  });
  it('交错 A,B,A,B → 4 批（游程不跨纹理并·保画家序）', () => {
    const rs = ['A', 'B', 'A', 'B'].map((k) => rend({ sprite: { textureKey: k } as Renderable['sprite'] }));
    const plan = buildSpriteBatches(rs, base, resolve);
    expect(plan.drawCalls).toBe(4);
    expect(plan.batches.map((b) => b.texId)).toEqual([0, 1, 0, 1]);
  });
  it('连片 A,A,A,B,B → 2 批（[3×A][2×B]）', () => {
    const rs = ['A', 'A', 'A', 'B', 'B'].map((k) => rend({ sprite: { textureKey: k } as Renderable['sprite'] }));
    const plan = buildSpriteBatches(rs, base, resolve);
    expect(plan.drawCalls).toBe(2);
    expect(plan.batches[0].count).toBe(3);
    expect(plan.batches[1].count).toBe(2);
  });
  it('实心方/圆走白像素批（与真纹理分开）·mode 写进实例', () => {
    const rs = [
      rend({ shape: { kind: 'box', width: 8, height: 8 } as Renderable['shape'] }),
      rend({ shape: { kind: 'circle', radius: 5 } as Renderable['shape'] }),
    ];
    const plan = buildSpriteBatches(rs, base, resolve);
    expect(plan.drawCalls).toBe(1);              // 两个都是 WHITE_TEXID → 并成一批
    expect(plan.batches[0].texId).toBe(WHITE_TEXID);
    expect(plan.batches[0].data[14]).toBe(MODE_BOX);           // 第 1 实例 mode
    expect(plan.batches[0].data[STRIDE + 14]).toBe(MODE_CIRCLE); // 第 2 实例 mode
  });
  it('精灵盖形状：有就绪精灵 → 走纹理 mode（非形状）', () => {
    const plan = buildSpriteBatches(
      [rend({ sprite: { textureKey: 'A' } as Renderable['sprite'], shape: { kind: 'box', width: 8, height: 8 } as Renderable['shape'] })],
      base, resolve);
    expect(plan.batches[0].texId).toBe(0);
    expect(plan.batches[0].data[14]).toBe(MODE_TEXTURED);
  });
});

describe('buildSpriteBatches：跳过记数（绝不静默吞）', () => {
  it('文本/多边形/未就绪精灵 → skipped 计数·不进批', () => {
    const rs = [
      rend({ text: { content: 'hi', fontSize: 12, fontFamily: 'sans' } as Renderable['text'] }),
      rend({ shape: { kind: 'polygon', vertices: [0, 0, 1, 0, 1, 1] } as Renderable['shape'] }),
      rend({ sprite: { textureKey: 'MISSING' } as Renderable['sprite'] }), // resolve→null
      rend({}), // 无形状无精灵
    ];
    const plan = buildSpriteBatches(rs, base, resolve);
    expect(plan.instanceCount).toBe(0);
    expect(plan.drawCalls).toBe(0);
    expect(plan.skipped).toBe(4);
  });
  it('混合：2 可批 + 1 跳过 → instanceCount 2·skipped 1', () => {
    const rs = [
      rend({ sprite: { textureKey: 'A' } as Renderable['sprite'] }),
      rend({ text: { content: 'x', fontSize: 12, fontFamily: 'sans' } as Renderable['text'] }),
      rend({ shape: { kind: 'box', width: 4, height: 4 } as Renderable['shape'] }),
    ];
    const plan = buildSpriteBatches(rs, base, resolve);
    expect(plan.instanceCount).toBe(2);
    expect(plan.skipped).toBe(1);
    expect(plan.drawCalls).toBe(2); // A(texId0) 然后 box(WHITE) → 2 批
  });
});

describe('buildSpriteBatches：颜色/tint 解包到 0..1', () => {
  it('tint 0xff8040 + alpha 0.5 → rgba 归一化写进实例', () => {
    const plan = buildSpriteBatches(
      [rend({ shape: { kind: 'box', width: 2, height: 2 } as Renderable['shape'], color: { tint: 0xff8040, alpha: 0.5 } as Renderable['color'] })],
      base, resolve);
    const d = plan.batches[0].data;
    expect(d[10]).toBeCloseTo(1);        // r=0xff/255
    expect(d[11]).toBeCloseTo(0x80 / 255);
    expect(d[12]).toBeCloseTo(0x40 / 255);
    expect(d[13]).toBe(0.5);             // alpha
  });
});
