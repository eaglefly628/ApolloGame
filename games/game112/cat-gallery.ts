// Game112 Gallery：猫种、外观与性格维度的纯数据投影。布偶猫试作图片均未通过美术审核。
import catalog from './cat-gallery.v1.json';

export interface CatalogBreed {
  readonly id: string;
  readonly zh: string;
  readonly en: string;
  readonly source: 'TICA' | 'CFA' | 'FIFe';
  readonly variantOf?: string;
  readonly nonPedigree?: boolean;
}

export const CAT_GALLERY = catalog;
export const CAT_BREEDS: readonly CatalogBreed[] = catalog.breeds as readonly CatalogBreed[];
export const RAGDOLL_IMAGES = catalog.imageRecords.filter((image) => image.breedId === 'ragdoll');
export type CatalogSource = 'all' | CatalogBreed['source'];
export interface CatalogBrowse {
  readonly query: string;
  readonly source: CatalogSource;
  readonly page: number;
}
export const EMPTY_CATALOG_BROWSE: CatalogBrowse = { query: '', source: 'all', page: 0 };
export const CATALOG_PAGE_SIZE = 8;

export function catalogPage(browse: CatalogBrowse): { entries: readonly CatalogBreed[]; total: number; pages: number; page: number } {
  const q = browse.query.trim().toLocaleLowerCase();
  const matched = CAT_BREEDS.filter((b) =>
    (browse.source === 'all' || b.source === browse.source) &&
    (q === '' || [b.zh, b.en, b.id].some((s) => s.toLocaleLowerCase().includes(q))));
  const pages = Math.max(1, Math.ceil(matched.length / CATALOG_PAGE_SIZE));
  const page = Math.min(Math.max(0, browse.page), pages - 1);
  return { entries: matched.slice(page * CATALOG_PAGE_SIZE, (page + 1) * CATALOG_PAGE_SIZE), total: matched.length, pages, page };
}

export function sourceOf(value: string | undefined): CatalogSource | undefined {
  return value === 'all' || value === 'TICA' || value === 'CFA' || value === 'FIFe' ? value : undefined;
}
