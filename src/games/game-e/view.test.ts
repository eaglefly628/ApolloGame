import { describe, it, expect } from 'vitest';
import { Engine } from '../../runtime/engine.js';
import { collectRenderables } from '../../renderer/renderable.js';
import { buildGameEView, VIEW_JOKERS, VIEW_HAND } from './view.js';
import { jokerArtKey } from './assets.js';
import { CARDS_SHEET_KEY, cardIndexOf } from './cards-atlas.js';

// 证明「视图=数据」：Sprite/Text 实体经 collectRenderables 进渲染管线（headless，不画真像素）。
// 这是无浏览器环境下"图被用上"的硬证据——textureKey/帧索引/文案都正确进入渲染列表。

function renders() {
  const e = new Engine({ tickRate: 60 });
  e.load(buildGameEView());
  e.world.tick();
  return collectRenderables(e.world);
}

describe('game-e · 视图渲染数据', () => {
  it('小丑排：5 张都带正确 jokerArtKey 的 Sprite', () => {
    const rs = renders();
    const keys = new Set(rs.filter((r) => r.sprite).map((r) => r.sprite!.textureKey));
    for (const id of VIEW_JOKERS) {
      expect(keys.has(jokerArtKey(id))).toBe(true);
    }
  });

  it('出牌区：5 张牌用 cards sprite-sheet，帧索引 = cardIndexOf', () => {
    const rs = renders();
    const cardSprites = rs.filter((r) => r.sprite?.textureKey === CARDS_SHEET_KEY);
    expect(cardSprites.length).toBe(5);
    const frameIdx = new Set(cardSprites.map((r) => r.frame?.index));
    for (const c of VIEW_HAND) {
      expect(frameIdx.has(cardIndexOf(c))).toBe(true);
    }
  });

  it('计分 HUD：文案实体进入渲染列表', () => {
    const rs = renders();
    const texts = rs.filter((r) => r.text).map((r) => r.text!.content);
    expect(texts.some((t) => t.includes('CHIPS') && t.includes('MULT') && t.includes('SCORE'))).toBe(true);
    expect(texts.some((t) => t.includes('JOKERS'))).toBe(true);
    expect(texts.some((t) => t.includes('PLAYED HAND'))).toBe(true);
  });

  it('皇家同花顺 5 张帧索引各异（UV 切片正确、无重叠）', () => {
    const idx = VIEW_HAND.map(cardIndexOf);
    expect(new Set(idx).size).toBe(5);
    for (const i of idx) expect(i).toBeGreaterThanOrEqual(0);
  });
});
