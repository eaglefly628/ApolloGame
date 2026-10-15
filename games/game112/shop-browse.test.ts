import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { SHOP_ITEMS } from './world-data.js';
import catalog from './shop-catalog.v1.json';
import { EMPTY_SHOP_BROWSE, SHOP_CATEGORIES, shopPage } from './shop-browse.js';

describe('星砂铺百件货架', () => {
  it('四件可互动物件与百件可收藏物件都有稳定货号和分类，私有图不写进公开索引', () => {
    expect(SHOP_ITEMS).toHaveLength(108);
    expect(SHOP_ITEMS.slice(0, 4).map((it) => it.id)).toEqual(['feather', 'paperbag', 'cushion', 'cardback-moon']);
    expect(SHOP_ITEMS.slice(0, 4).every((it) => it.placement === 'scene')).toBe(true);
    expect(SHOP_ITEMS.slice(4).map((it) => it.id)).toEqual(Array.from({ length: 104 }, (_, i) => `T${String(i + 1).padStart(3, '0')}`));
    expect(SHOP_ITEMS.slice(4).every((it) => it.placement === 'collection')).toBe(true);
    expect(catalog.items.slice(-4).map((it) => it.season)).toEqual(['spring', 'summer', 'autumn', 'winter']);
    expect(catalog.items.slice(-4).every((it) => Array.isArray(it.materials) && it.materials.length >= 3)).toBe(true);
    expect(SHOP_ITEMS.every((it) => SHOP_CATEGORIES.some((c) => c.id === it.category))).toBe(true);
    const art = JSON.parse(readFileSync('public/games/game112/art/index.json', 'utf8')) as { assets: { id: string }[] };
    expect(art.assets.some((it) => /^game112\/prop\/T\d{3}$/.test(it.id))).toBe(false);
  });

  it('分类、价位、搜索、排序和翻页覆盖全部货物', () => {
    const all = shopPage(EMPTY_SHOP_BROWSE);
    expect(all.total).toBe(108);
    expect(all.entries).toHaveLength(6);
    expect(all.pages).toBe(18);
    const wand = shopPage({ ...EMPTY_SHOP_BROWSE, category: 'wand' });
    expect(wand.total).toBeGreaterThan(1);
    expect(wand.entries.map((it) => it.id)).toContain('feather');
    expect(wand.entries.map((it) => it.id)).toContain('T001');
    const search = shopPage({ ...EMPTY_SHOP_BROWSE, query: 'paperbag' });
    expect(search.entries.map((it) => it.id)).toEqual(['paperbag']);
    const high = shopPage({ ...EMPTY_SHOP_BROWSE, value: '50plus' });
    expect(high.entries.map((it) => it.id)).toContain('cardback-moon');
    expect(high.entries.every((it) => it.price >= 50)).toBe(true);
    const sorted = shopPage({ ...EMPTY_SHOP_BROWSE, sort: 'priceDesc', page: 999 });
    expect(sorted.page).toBe(sorted.pages - 1);
    expect(sorted.entries.every((it, i, entries) => i === 0 || entries[i - 1]!.price >= it.price)).toBe(true);
    expect(shopPage({ ...EMPTY_SHOP_BROWSE, query: 'T100' }).entries.map((it) => it.id)).toEqual(['T100']);
  });
});
