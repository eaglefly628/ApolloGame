// 星砂铺货单的纯数据筛选：不写世界，也不改变成交规则。
import { SHOP_ITEMS, type ShopItem } from './world-data.js';

export const SHOP_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'wand', name: '逗猫杆' },
  { id: 'hide', name: '藏身钻行' },
  { id: 'rest', name: '休憩空间' },
  { id: 'cardskin', name: '星牌外观' },
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number]['id'];
export type ShopValue = 'all' | 'under25' | '25to49' | '50plus';
export type ShopSort = 'featured' | 'priceAsc' | 'priceDesc';
export interface ShopBrowse {
  readonly category: ShopCategory;
  readonly value: ShopValue;
  readonly sort: ShopSort;
  readonly query: string;
  readonly page: number;
}
export const EMPTY_SHOP_BROWSE: ShopBrowse = { category: 'all', value: 'all', sort: 'featured', query: '', page: 0 };
export const SHOP_PAGE_SIZE = 6;
export const SHOP_VALUES: readonly { id: ShopValue; name: string }[] = [
  { id: 'all', name: '所有价位' }, { id: 'under25', name: '25 以下' },
  { id: '25to49', name: '25–49' }, { id: '50plus', name: '50 以上' },
];
export const SHOP_SORTS: readonly { id: ShopSort; name: string }[] = [
  { id: 'featured', name: '推荐' }, { id: 'priceAsc', name: '价格 ↑' }, { id: 'priceDesc', name: '价格 ↓' },
];
export const shopCategoryOf = (id: string | undefined): ShopCategory | undefined => SHOP_CATEGORIES.find((it) => it.id === id)?.id;
export const shopValueOf = (id: string | undefined): ShopValue | undefined => SHOP_VALUES.find((it) => it.id === id)?.id;
export const shopSortOf = (id: string | undefined): ShopSort | undefined => SHOP_SORTS.find((it) => it.id === id)?.id;

export function shopPage(browse: ShopBrowse): { entries: readonly ShopItem[]; total: number; pages: number; page: number } {
  const q = browse.query.trim().toLocaleLowerCase();
  const matched = SHOP_ITEMS.filter((it) =>
    (browse.category === 'all' || it.category === browse.category) &&
    (browse.value === 'all' ||
      (browse.value === 'under25' && it.price < 25) ||
      (browse.value === '25to49' && it.price >= 25 && it.price < 50) ||
      (browse.value === '50plus' && it.price >= 50)) &&
    (q === '' || `${it.id} ${it.name} ${it.blurb}`.toLocaleLowerCase().includes(q)));
  if (browse.sort !== 'featured') matched.sort((a, b) =>
    browse.sort === 'priceAsc' ? a.price - b.price || a.id.localeCompare(b.id) : b.price - a.price || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(matched.length / SHOP_PAGE_SIZE));
  const page = Math.min(Math.max(0, browse.page), pages - 1);
  return { entries: matched.slice(page * SHOP_PAGE_SIZE, (page + 1) * SHOP_PAGE_SIZE), total: matched.length, pages, page };
}
