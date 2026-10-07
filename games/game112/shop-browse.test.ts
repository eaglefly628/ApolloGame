import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parseAssetIndex } from '@zerocraft/engine/assets/index.js';
import { pickArtOverrides } from '@zerocraft/engine/assets/game-art-load.js';
import { SHOP_ITEMS } from './world-data.js';
import { EMPTY_SHOP_BROWSE, SHOP_CATEGORIES, SHOP_PAGE_SIZE, shopPage } from './shop-browse.js';

describe('星砂铺百件货单', () => {
  it('旧四件保持原 ID，T001–T100 各有价格、分类和可加载的本地图', () => {
    expect(SHOP_ITEMS).toHaveLength(104);
    const ids = SHOP_ITEMS.map((it) => it.id);
    expect(new Set(ids).size).toBe(104);
    const raw = JSON.parse(readFileSync('public/games/game112/art/index.json', 'utf8'));
    const index = parseAssetIndex(raw);
    const overrides = pickArtOverrides(raw, 'game112');
    for (let n = 1; n <= 100; n++) {
      const id = `T${String(n).padStart(3, '0')}`;
      const item = SHOP_ITEMS.find((it) => it.id === id);
      expect(item, id).toBeDefined();
      expect(item!.price, id).toBeGreaterThan(0);
      expect(item!.placement, id).toBe('collection');
      expect(SHOP_CATEGORIES.some((c) => c.id === item!.category), id).toBe(true);
      const art = index.assets.find((a) => a.id === `game112/prop/${id}`);
      expect(art?.spec?.usage, id).toBe('sprite');
      expect(art?.spec?.colorSpace, id).toBe('srgb');
      expect(existsSync(`public${art!.path}`), id).toBe(true);
      expect(overrides[`game112/prop/${id}`], id).toBe(art!.path);
    }
  });

  it('分类、价位、搜索和价格排序组合后分页稳定且不丢物件', () => {
    const all = shopPage(EMPTY_SHOP_BROWSE);
    expect(all.total).toBe(104);
    expect(all.entries).toHaveLength(SHOP_PAGE_SIZE);
    const wand = shopPage({ ...EMPTY_SHOP_BROWSE, category: 'wand', value: 'under25', sort: 'priceAsc' });
    expect(wand.entries.every((it) => it.category === 'wand' && it.price < 25)).toBe(true);
    expect(wand.entries.map((it) => it.price)).toEqual([...wand.entries.map((it) => it.price)].sort((a, b) => a - b));
    const search = shopPage({ ...EMPTY_SHOP_BROWSE, query: 'T100' });
    expect(search.total).toBe(1);
    expect(search.entries[0]?.id).toBe('T100');
    const high = shopPage({ ...EMPTY_SHOP_BROWSE, value: '50plus', sort: 'priceDesc' });
    expect(high.entries.every((it) => it.price >= 50)).toBe(true);
    expect(high.entries.map((it) => it.price)).toEqual([...high.entries.map((it) => it.price)].sort((a, b) => b - a));
    const last = shopPage({ ...EMPTY_SHOP_BROWSE, page: 999 });
    expect(last.page).toBe(last.pages - 1);
    expect(last.entries.length).toBeGreaterThan(0);
  });
});
