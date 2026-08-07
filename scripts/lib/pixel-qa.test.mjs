// 像素级机器断言（REQ-3D-像素断言）：纯函数·喂合成像素·验三断言判定（黑屏/糊团/冻结 各造红）。
import { describe, it, expect } from 'vitest';
import { luma, lumaField, analyzeFrame, frameActivity, assertPixelQA } from './pixel-qa.mjs';

// 合成一帧：channels 通道·用 fill(i)=[r,g,b(,a)] 生成像素。
function frame(width, height, channels, fill) {
  const pixels = Buffer.alloc(width * height * channels);
  for (let i = 0; i < width * height; i++) {
    const c = fill(i);
    for (let k = 0; k < channels; k++) pixels[i * channels + k] = c[k] ?? 255;
  }
  return { width, height, channels, pixels };
}
const solid = (w, h, ch, rgb) => frame(w, h, ch, () => rgb);

describe('luma / lumaField：Rec.709 亮度·按通道兼容', () => {
  it('纯白=255·纯黑=0·绿权重最高', () => {
    expect(luma(255, 255, 255)).toBeCloseTo(255);
    expect(luma(0, 0, 0)).toBe(0);
    expect(luma(0, 255, 0)).toBeGreaterThan(luma(255, 0, 0)); // 绿 0.7152 > 红 0.2126
  });
  it('灰度单通道 → 通道值即亮度', () => {
    const f = lumaField({ width: 2, height: 1, channels: 1, pixels: Buffer.from([40, 200]) });
    expect(Array.from(f)).toEqual([40, 200]);
  });
  it('RGBA 忽略 α', () => {
    const f = lumaField({ width: 1, height: 1, channels: 4, pixels: Buffer.from([255, 255, 255, 0]) });
    expect(f[0]).toBeCloseTo(255); // α=0 不影响亮度计算
  });
});

describe('analyzeFrame：非黑占比 + 动态范围', () => {
  it('全黑 → 非黑占比 0·动态范围 0', () => {
    const a = analyzeFrame(solid(8, 8, 3, [0, 0, 0]));
    expect(a.nonBlackRatio).toBe(0);
    expect(a.dynamicRange).toBe(0);
  });
  it('半黑半白 → 非黑占比 ~0.5·动态范围大', () => {
    const a = analyzeFrame(frame(10, 10, 3, (i) => (i % 2 === 0 ? [255, 255, 255] : [0, 0, 0])));
    expect(a.nonBlackRatio).toBeCloseTo(0.5, 1);
    expect(a.dynamicRange).toBeGreaterThan(200);
  });
  it('纯色板（非黑但无层次）→ 非黑占比 1·动态范围 0', () => {
    const a = analyzeFrame(solid(8, 8, 3, [120, 120, 120]));
    expect(a.nonBlackRatio).toBe(1);
    expect(a.dynamicRange).toBe(0); // 糊成一团
  });
});

describe('frameActivity：两帧亮度差均值', () => {
  it('同帧 → 活动 0（冻结）', () => {
    const f = solid(8, 8, 4, [100, 100, 100, 255]);
    expect(frameActivity(f, f)).toBe(0);
  });
  it('黑→白 → 活动 ~255', () => {
    expect(frameActivity(solid(8, 8, 3, [0, 0, 0]), solid(8, 8, 3, [255, 255, 255]))).toBeCloseTo(255, 0);
  });
  it('尺寸不符 → 抛', () => {
    expect(() => frameActivity(solid(8, 8, 3, [0, 0, 0]), solid(4, 4, 3, [0, 0, 0]))).toThrow();
  });
});

describe('assertPixelQA：三断言各自造红', () => {
  const good = frame(16, 16, 4, (i) => (i % 3 === 0 ? [200, 40, 30, 255] : i % 3 === 1 ? [30, 180, 220, 255] : [10, 10, 10, 255]));
  const goodB = frame(16, 16, 4, (i) => (i % 3 === 0 ? [40, 200, 30, 255] : i % 3 === 1 ? [220, 30, 180, 255] : [12, 12, 12, 255]));
  it('健康帧（有色有层次 + 帧间动）→ 全过', () => {
    const r = assertPixelQA({ frameA: good, frameB: goodB });
    expect(r.pass).toBe(true);
    expect(r.assertions.activity.pass).toBe(true);
  });
  it('黑屏 → nonBlack 判红', () => {
    const r = assertPixelQA({ frameA: solid(16, 16, 3, [2, 2, 2]) });
    expect(r.assertions.nonBlack.pass).toBe(false);
    expect(r.pass).toBe(false);
  });
  it('纯色板 → contrast 判红', () => {
    const r = assertPixelQA({ frameA: solid(16, 16, 3, [130, 130, 130]) });
    expect(r.assertions.nonBlack.pass).toBe(true);
    expect(r.assertions.contrast.pass).toBe(false);
  });
  it('冻结（两帧全等）→ activity 判红', () => {
    const r = assertPixelQA({ frameA: good, frameB: good });
    expect(r.assertions.activity.pass).toBe(false);
    expect(r.pass).toBe(false);
  });
  it('无 frameB → 跳过 activity 断言（单帧静态截图）', () => {
    const r = assertPixelQA({ frameA: good });
    expect(r.assertions.activity).toBeUndefined();
    expect(r.pass).toBe(true);
  });
});
