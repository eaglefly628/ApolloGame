/**
 * 2026 IWC 官方 Trophy 结果中的十个清酒组别样本。
 * 这不是全球第 1—10 名：组别之间没有可直接比较的总名次。
 * 奖项事实已核对；风味、批次和收藏档案尚需逐款酒藏原始资料。
 */
export const SAKE_AWARD_SOURCE = {
  label: 'International Wine Challenge · Sake Trophy Results 2026',
  url: 'https://www.internationalwinechallenge.com/trophy-results-2026.html',
  checkedAt: '2026-10-03',
} as const;

export const SAKE_AWARD_RESEARCH = [
  { code: '41', name: 'Daisekkei Josen', producer: 'Daisekkei Sake Brewing Co., Ltd.', award: 'Futsu-shu Trophy', lens: '普通酒也可能有出色的工艺表达；先查原料、酿造与酒藏定位，不按分类词轻视。' },
  { code: '109', name: 'Kisoji Honjozo Kinmonnishiki', producer: 'Yukawa Sake Brewery Co., Ltd.', award: 'Honjozo Trophy', lens: '核对“本酿造”和酒米名称各自说明什么，不把添加酿造酒精等同低品质。' },
  { code: '362', name: 'Chiebijin Junmaishu', producer: 'Nakano Shuzo Sake Breweries Ltd.', award: 'Junmai Trophy', lens: '从纯米酒组别出发，再查具体酒米、麹与发酵资料，避免用组别猜风味。' },
  { code: '445', name: 'Keiryu Ginjo', producer: 'Endo Brewery Inc.', award: 'Ginjo Trophy', lens: '追问吟酿工艺、版本和酒藏的产品线，而不是先写一段未经证实的“果香”。' },
  { code: '548', name: 'Miyanoyuki Daiginjo Yamadanishiki', producer: 'Miyazaki Honten Co Ltd', award: 'Daiginjo Trophy', lens: '酒米名与大吟酿分类是两条信息；需要具体批次的精米、容量和原瓶证据。' },
  {
    code: '1486', name: 'Tenbi Junmai Ginjo Hotaten', producer: 'CHOSHU SAKE BREWERY CORP.', award: 'Junmai Ginjo Trophy',
    lens: '把系列名、特定名称和当年参赛版本拆开记录，避免用获奖信息代替产品档案。',
    profile: {
      distinction: 'IWC Champion Sake 2026',
      productSource: '长州酒造 · 蛍天 2026 发布资料',
      productSourceUrl: 'https://choshusake.com/item/1902',
      evidence: '酒藏在 2026 年版本说明使用下关丰田町的西都之雫与山口县产山田锦，定位为数量限定的初夏纯米吟酿原酒，标示酒精度 13%。',
      declaredStyle: '酒藏描述青苹果般的香气、柔和甘味、轻微气泡感与淡淡酸味；这是品牌对其产品的文字，不是本馆实际品饮评分。',
      collectorQuestion: 'IWC 参赛瓶与官网 2026 发布瓶是否同一批次、同一容量？目前缺原瓶或参赛批次对应证据，不能自动合并。',
    },
  },
  { code: '787', name: 'Raifuku Junmai Daiginjo Aiyama', producer: 'Raifuku Sake Brewing Co., Ltd.', award: 'Junmai Daiginjo Trophy', lens: '从“爱山”米种追问原料表达，并核对酒藏对这一款的实际工艺描述。' },
  { code: '1653', name: 'Keiryu Daikoshu', producer: 'Endo Brewery Inc.', award: 'Aged Sake Trophy', lens: '“熟成”需核对起始年份、容器、温度和装瓶版本，不能自动推断升值。' },
  { code: '1605', name: 'Born: Awakening of The Angel', producer: 'Katoukichebee Shouten', award: 'Koshu Trophy', lens: '古酒组别给出研究方向；颜色、香气和熟成曲线仍需该款原始资料。' },
  { code: '1529', name: 'Born: Premium Sparkling', producer: 'Katoukichebee Shouten', award: 'Sparkling Trophy', lens: '发泡清酒另有气泡形成与保存问题，不能与非发泡酒共享同一套风味模板。' },
] as const;

export const SAKE_HUNDRED_METHOD = {
  title: '百酒深读，不制造一张假总榜',
  note: '“世界酒藏排名”排的是酒藏；IWC、Kura Master、SAKE COMPETITION 分属不同赛制与组别。我们以可核对的获奖酒款建立百款策展队列，按风格与研究主题导览，不给跨赛事酒款强行编造 1—100 名。',
  requiredFields: ['官方获奖依据与年份', '酒藏原始酒款资料', '具体版本与容量', '原料与工艺', '可归属的风味描述', '保存与收藏证据', '授权实拍与图片来源'],
  progress: '首批 10 款已核 IWC 2026 组别奖项；其中“蛍天”补入酒藏 2026 产品资料，参赛批次仍待匹配。其余逐款深析未完成。',
} as const;
