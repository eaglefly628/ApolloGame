/**
 * 赛事名次与价格分别建档：不同组别、不同赛事和不同年份不可合成一张总榜。
 * 官网/酒藏公开价格是当日可核对的参考价，不是成交价、转售价或升值预测。
 */
export const SAKE_COMPETITION_2026 = {
  label: 'SAKE COMPETITION 2026 · 官方 GOLD 结果',
  url: 'https://www.sakecompetition.com/award.html',
  rulesUrl: 'https://sakecompetition.com/sake_competition.html',
  checkedAt: '2026-10-06',
  entries: 1139,
  groups: [
    { id: 'premium', name: 'Super Premium', entries: 83, lead: '这是真正设有价格门槛的参赛组：720ml 税前零售价格至少 10,000 日元，或 1800ml 至少 15,000 日元。以下是该组 2026 年金奖名次。', top: [
      { rank: 1, name: '而今 特等雄町', maker: '木屋正酒造', prefecture: '三重' },
      { rank: 2, name: '东洋美人 志荘', maker: '澄川酒造场', prefecture: '山口' },
      { rank: 3, name: 'くどき上手 命 斗瓶囲大吟醸', maker: '龟之井酒造', prefecture: '山形' },
    ] },
    { id: 'junmai-daiginjo', name: '纯米大吟酿', entries: 339, lead: '精米与酿造工艺的表达；这里的第一只属于本组、这一届。', top: [
      { rank: 1, name: '雨后之月 纯米大吟酿', maker: '相原酒造', prefecture: '广岛' },
      { rank: 2, name: '山和 纯米大吟酿', maker: '山和酒造店', prefecture: '宫城' },
      { rank: 3, name: '太平山 纯米大吟酿 天巧', maker: '小玉酿造', prefecture: '秋田' },
    ] },
    { id: 'junmai-ginjo', name: '纯米吟酿', entries: 328, lead: '看酒米与香味的平衡，不与纯米大吟酿跨组比较。', top: [
      { rank: 1, name: 'みむろ杉 罗曼系列 纯米吟酿 山田锦', maker: '今西酒造', prefecture: '奈良' },
      { rank: 2, name: '胜山 KIRAKIRA', maker: '仙台伊泽家胜山酒造', prefecture: '宫城' },
      { rank: 3, name: '三诸杉 纯米吟酿', maker: '今西酒造', prefecture: '奈良' },
    ] },
    { id: 'junmai', name: '纯米酒', entries: 294, lead: '没有高价门槛；出色作品不只在昂贵组别。', top: [
      { rank: 1, name: 'みむろ杉 罗曼系列 Dio Abita', maker: '今西酒造', prefecture: '奈良' },
      { rank: 2, name: 'ささまさむね 特别纯米', maker: '笹正宗酒造', prefecture: '福岛' },
      { rank: 3, name: 'あさまやま 夏纯', maker: '浅间酒造', prefecture: '群马' },
    ] },
    { id: 'modern', name: '现代自然', entries: 95, lead: '传统酛法的新表达，审查逻辑与其他四组不同。', top: [
      { rank: 1, name: 'たちばなや 纯米吟酿', maker: '川敬商店', prefecture: '宫城' },
      { rank: 2, name: '萩原 山废纯米', maker: '萩原酒造', prefecture: '茨城' },
      { rank: 3, name: '试验酿造 2025 Type-Kimoto', maker: '城阳酒造', prefecture: '京都' },
    ] },
  ],
  premiumOther: [
    { name: '田酒 纯米大吟酿 PREMIUM', maker: '西田酒造店', award: 'Super Premium · SILVER' },
    { name: '十四代 龍泉', maker: '高木酒造', award: 'Super Premium · BRONZE' },
  ],
} as const;

export const SAKE_PRICE_REFERENCES = [
  { name: '獺祭 挑む', maker: '獺祭', yen: 363000, volumeMl: 720, detail: '限定钛瓶版本；酒藏称使用其山田锦项目入赏米。高价来自具体作品与包装，绝不是獺祭在赛事里排第一。', source: '獺祭官方产品页 / 2026 价格表', url: 'https://dassai.com/product/New/dassai-ambition.html' },
  { name: 'MIYASHITA ESTATE Kaori', maker: '宫下酒造', yen: 110000, volumeMl: 720, detail: '雄町米精米步合 7%；酒藏官方产品页公开标价。', source: '宫下酒造官方产品页', url: 'https://www.msb.co.jp/product/5543/' },
  { name: '継 · TSUGU', maker: '朝日酒造', yen: 44000, volumeMl: 720, detail: '酒藏官方介绍为其最高峰作品；此处只记录标价，不比较酒质。', source: '朝日酒造官方产品页', url: 'https://www.asahi-shuzo.co.jp/tsugu/' },
  { name: '楯野川 纯米大吟酿 极限', maker: '楯野川酒造', yen: 38500, volumeMl: 720, detail: '精米步合 8% 的官方商店公开标价。', source: '楯野川酒造官方商店', url: 'https://shop.tatenokawa.com/shop/product_categories/category-high-clas' },
] as const;

export const SAKE_OTHER_2026_HONORS = [
  { event: 'IWC 2026', award: 'Champion Sake', name: '天美 纯米吟酿 蛍天', maker: '长州酒造', source: 'International Wine Challenge 官方结果', url: 'https://www.internationalwinechallenge.com/trophy-results-2026.html' },
  { event: 'Kura Master 2026', award: 'President’s Prize', name: '七贤 Sparkling 星ノ輝', maker: '山梨铭酿', source: 'Kura Master 官方 2026-09-30 公告', url: 'https://kuramaster.com/ja/award-ceremony-ja/2026/kura-master-2026-presidents-award-announced/' },
] as const;

/** Retail observations must never be mixed into the brewery-official reference-price ranking. */
export const JUYONDAI_RETAIL_OBSERVATIONS = [
  { name: '十四代 龍泉', edition: '页面未注明酿造年份；不能对应 2026 参赛批次', yen: 269500, volumeMl: 720, observedAt: '2026-01-10', seller: 'LIFE VACATION 银座店', url: 'https://www.osake-kakaku.com/Juyondai.html' },
  { name: '十四代 龍泉 白雲去来', edition: '页面未注明酿造年份；与「龍泉」分开建档', yen: 132000, volumeMl: 720, observedAt: '2026-01-10', seller: 'LIFE VACATION 银座店', url: 'https://www.osake-kakaku.com/Juyondai.html' },
  { name: '十四代 龍泉 白雲去来', edition: '商家标注 2026 年制造；含箱、不含另计运费', yen: 116800, volumeMl: 720, observedAt: '2026-10-06', seller: '酒の本丸屋 Yahoo 店', url: 'https://store.shopping.yahoo.co.jp/honmaruya/000813.html' },
  { name: '十四代 龍月', edition: '页面未注明酿造年份；720ml，与 1800ml 版本不可直接比较', yen: 88000, volumeMl: 720, observedAt: '2026-01-10', seller: 'LIFE VACATION 银座店', url: 'https://www.osake-kakaku.com/Juyondai.html' },
  { name: '十四代 七垂二十貫', edition: '页面未注明酿造年份；不是「龍泉」', yen: 77000, volumeMl: 720, observedAt: '2026-01-10', seller: 'LIFE VACATION 银座店', url: 'https://www.osake-kakaku.com/Juyondai.html' },
  { name: '十四代 双虹', edition: '页面未注明酿造年份；单列为不同酒款', yen: 70400, volumeMl: 720, observedAt: '2026-01-10', seller: 'LIFE VACATION 银座店', url: 'https://www.osake-kakaku.com/Juyondai.html' },
] as const;

export const SAKE_HERITAGE_NOTE = {
  name: '十四代 七垂二十貫',
  note: '你提到的「十万贯」可能是这款名称的记忆线索，但尚未确认。官方记录它在 SAKE COMPETITION 2015 纯米大吟酿组列第 3；“二十貫”是酒名的一部分，不是十万日元标价，也不能拿旧奖当作 2026 名次。',
  source: 'SAKE COMPETITION 2015 · 官方历届结果',
  url: 'https://www.sakecompetition.com/award/history2015.html',
} as const;
