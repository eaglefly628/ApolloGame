/**
 * 官网产品图的本机候选清单。版权/商标再利用许可尚未取得：仅 DEV 预览，
 * 原图放在 gitignored games/game113/preview-art-local，不入仓或发行包。
 * 使用条件变化后须经品牌授权、产品身份与批次复核，再迁入正式资产索引。
 */
export type SakePreviewImage = {
  dossierId: string;
  productName: string;
  file: string;
  pageUrl: string;
  imageUrl: string;
  depicted: string;
  rights: 'permission-pending';
  usage: 'editorial-product-photo';
  colorSpace: 'srgb';
  wrap: 'clamp';
};

export const SAKE_PREVIEW_IMAGES: readonly SakePreviewImage[] = [
  {
    dossierId: 'dassai-deep', productName: '獺祭 45', file: 'dassai-45.jpg',
    pageUrl: 'https://dassai.com/cn/product/main/45.html', imageUrl: 'https://dassai.com/cn/files/dassai45.jpg',
    depicted: '獺祭 45 官网产品瓶身；页面版本，非具体交易实物', rights: 'permission-pending', usage: 'editorial-product-photo', colorSpace: 'srgb', wrap: 'clamp',
  },
  {
    dossierId: 'dassai-deep', productName: '獺祭 39', file: 'dassai-39.jpg',
    pageUrl: 'https://dassai.com/cn/product/main/39.html', imageUrl: 'https://dassai.com/cn/files/dassai-3wari9bu.jpg',
    depicted: '獺祭 39 官网产品瓶身；页面版本，非具体交易实物', rights: 'permission-pending', usage: 'editorial-product-photo', colorSpace: 'srgb', wrap: 'clamp',
  },
  {
    dossierId: 'kuheiji', productName: '山田锦 EAU DU DÉSIR', file: 'kuheiji-eau-du-desir-2021.jpg',
    pageUrl: 'https://kuheiji.co.jp/kamoshibito/collection/', imageUrl: 'https://kuheiji.co.jp/wp-content/themes/ftpa_theme_202310/assets/images/kamoshibito/collection/item_img_betsuatsurae.jpg',
    depicted: '官网页面图片实际呈现 EAU DU DÉSIR 2021 瓶身；文件名虽含 betsuatsurae，不得错配给别誂', rights: 'permission-pending', usage: 'editorial-product-photo', colorSpace: 'srgb', wrap: 'clamp',
  },
  {
    dossierId: 'kazenomori', productName: '秋津穂 657', file: 'kazenomori-akitsuho-657.png',
    pageUrl: 'https://yucho-sake.jp/product/kazenomori/', imageUrl: 'https://yucho-sake.jp/assets/img/product/kazenomori/Kaze_no_Mori_Akitsuho_657.png',
    depicted: '风之森 秋津穂 657 官网产品瓶身示意；非具体批次交易实物', rights: 'permission-pending', usage: 'editorial-product-photo', colorSpace: 'srgb', wrap: 'clamp',
  },
  {
    dossierId: 'kazenomori', productName: '露叶风 507', file: 'kazenomori-tsuyuhakaze-507.png',
    pageUrl: 'https://yucho-sake.jp/product/kazenomori/', imageUrl: 'https://yucho-sake.jp/assets/img/product/kazenomori/Kaze_no_Mori_Tsuyuhakaze_507.png',
    depicted: '风之森 露叶风 507 官网产品瓶身示意；非具体批次交易实物', rights: 'permission-pending', usage: 'editorial-product-photo', colorSpace: 'srgb', wrap: 'clamp',
  },
  {
    dossierId: 'kanpai', productName: 'KUMO · CLOUDY', file: 'kanpai-kumo.webp',
    pageUrl: 'https://kanpai.london/shop/p/kumo', imageUrl: 'https://images.squarespace-cdn.com/content/v1/5696457840667a7eb9fb6066/19d8e41e-aae8-4a9c-8fc8-adf6bc409f81/Kanpai_Kumo-Nigori+100+red.jpg?format=1000w',
    depicted: 'KANPAI KUMO 官方产品页瓶身；本地文件实际为 WebP 格式', rights: 'permission-pending', usage: 'editorial-product-photo', colorSpace: 'srgb', wrap: 'clamp',
  },
  {
    dossierId: 'kanpai', productName: 'TORI · BIRD 2026', file: 'kanpai-tori-2026.webp',
    pageUrl: 'https://kanpai.london/shop/p/tori-junmai-daiginjo-limited-edition-750ml', imageUrl: 'https://images.squarespace-cdn.com/content/v1/5696457840667a7eb9fb6066/021b26bc-fd83-499d-a647-4328ca3e4063/Kanpai_Tori-Junmai+Daiginjo+100.jpg?format=1000w',
    depicted: 'KANPAI TORI 官网 2026 产品页瓶身；不得沿用给其他年份', rights: 'permission-pending', usage: 'editorial-product-photo', colorSpace: 'srgb', wrap: 'clamp',
  },
  {
    dossierId: 'dojima', productName: 'Cambridge Vintage', file: 'dojima-cambridge-hero.jpg',
    pageUrl: 'https://www.dojimabrewery.co.uk/product/cambridge/', imageUrl: 'https://www.dojimabrewery.co.uk/wp-content/uploads/2022/01/cambridge_hero_pc_lg-scaled.jpg',
    depicted: 'Dojima Cambridge 官网主视觉瓶身，标签可见 2018 醸造年份；非现行全部年份的通用实物', rights: 'permission-pending', usage: 'editorial-product-photo', colorSpace: 'srgb', wrap: 'clamp',
  },
];

export const sakePreviewImageFor = (dossierId: string, productName: string) =>
  SAKE_PREVIEW_IMAGES.find((image) => image.dossierId === dossierId && image.productName === productName);
