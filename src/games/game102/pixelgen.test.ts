// Game 102 · pixelgen —— 关卡像素画生成器（本地算法·authoring-time·确定性）单测。
import { describe, it, expect } from 'vitest';
import { nearestPaletteIndex, quantizeToBitmap, genGarden, paletteList, GARDEN_PALETTE } from './pixelgen.js';
import { LEVEL_1 } from './levels.js';

describe('pixelgen · Path A 量化器（图→最近 power 色）', () => {
  const pal = paletteList(['green', 'black', 'red', 'orange', 'yellow', 'white']);
  it('纯色映射到对应 power 色 index', () => {
    expect(nearestPaletteIndex([92, 181, 68], pal)).toBe(0);   // green
    expect(nearestPaletteIndex([47, 49, 64], pal)).toBe(1);    // black
    expect(nearestPaletteIndex([224, 67, 63], pal)).toBe(2);   // red
    expect(nearestPaletteIndex([239, 138, 43], pal)).toBe(3);  // orange
    expect(nearestPaletteIndex([234, 242, 255], pal)).toBe(5); // white
  });
  it('透明格(null)→ "." ；RGB 网格 → bitmap 行串', () => {
    const bm = quantizeToBitmap([[[224, 67, 63], null, [92, 181, 68]]], ['green', 'black', 'red', 'orange', 'yellow', 'white']);
    expect(bm).toEqual(['2.0']);
  });
});

describe('pixelgen · Path B 程序化满格生成', () => {
  it('满格 cols×rows·每格皆 palette index·含南瓜/钥匙/门', () => {
    const g = genGarden(22, 22, 20001);
    expect(g.bitmap.length).toBe(22);
    expect(g.bitmap.every((r) => r.length === 22)).toBe(true);
    const inRange = g.bitmap.every((r) => [...r].every((ch) => { const n = Number(ch); return n >= 0 && n < GARDEN_PALETTE.length; }));
    expect(inRange).toBe(true);
    expect(g.specials.pumpkins.length).toBe(3);
    expect(g.specials.keys.length).toBe(3);
    expect(g.specials.door).toMatchObject({ w: 2, h: 2 });
  });
  it('确定性：同 seed 同产物（可复现·可 check-in 为数据）', () => {
    expect(genGarden(22, 22, 20001).bitmap).toEqual(genGarden(22, 22, 20001).bitmap);
  });
  it('LEVEL_1 = genGarden(22,22,20001) 的 check-in 产物（数据与生成器一致）', () => {
    expect(LEVEL_1.bitmap).toEqual(genGarden(22, 22, 20001).bitmap);
    expect(LEVEL_1.keys).toEqual(genGarden(22, 22, 20001).specials.keys);
  });
});
