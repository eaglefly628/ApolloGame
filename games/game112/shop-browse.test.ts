import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHOP_ITEMS } from './world-data.js';
import { EMPTY_SHOP_BROWSE, SHOP_CATEGORIES, shopPage } from './shop-browse.js';

describe('星砂铺精选货架', () => {
  it('只上架有真实摆放与互动的四件物品，候选美术不成为空玩法商品', () => {
    expect(SHOP_ITEMS.map((it) => it.id)).toEqual(['feather', 'paperbag', 'cushion', 'cardback-moon']);
    expect(SHOP_ITEMS.every((it) => it.placement === 'scene')).toBe(true);
    expect(SHOP_ITEMS.every((it) => SHOP_CATEGORIES.some((c) => c.id === it.category))).toBe(true);
    const art = JSON.parse(readFileSync('public/games/game112/art/index.json', 'utf8')) as { assets: { id: string }[] };
    expect(art.assets.some((it) => /^game112\/prop\/T\d{3}$/.test(it.id))).toBe(false);
  });

  it('分类、价位、搜索和排序仍可选中现有物件', () => {
    const all = shopPage(EMPTY_SHOP_BROWSE);
    expect(all.total).toBe(4);
    expect(all.entries).toHaveLength(4);
    expect(all.pages).toBe(1);
    const wand = shopPage({ ...EMPTY_SHOP_BROWSE, category: 'wand' });
    expect(wand.entries.map((it) => it.id)).toEqual(['feather']);
    const search = shopPage({ ...EMPTY_SHOP_BROWSE, query: 'paperbag' });
    expect(search.entries.map((it) => it.id)).toEqual(['paperbag']);
    const high = shopPage({ ...EMPTY_SHOP_BROWSE, value: '50plus' });
    expect(high.entries.map((it) => it.id)).toEqual(['cardback-moon']);
    const sorted = shopPage({ ...EMPTY_SHOP_BROWSE, sort: 'priceDesc', page: 999 });
    expect(sorted.page).toBe(0);
    expect(sorted.entries.map((it) => it.price)).toEqual([50, 40, 30, 20]);
  });
});
