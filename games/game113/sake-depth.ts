/** 清酒深读内容。史实、神话与品牌自述分开标注；价格是定时点的官方参考样本。 */
export const SAKE_HISTORY = [
  { era: '古代', title: '米与麹的起点', text: '清酒的早期形态与稻作一同发展。古代记载提示麹参与酿造，但不能把今天的清酒直接等同于当时的酒。' },
  { era: '奈良—平安', title: '从宫廷到寺社', text: '宫廷曾设酿酒机构；随后寺社也参与酿造，酒从礼仪之物逐渐走向更广的社会生活。' },
  { era: '室町—江户', title: '技术与流通成形', text: '精米、压榨、火入与大木桶使酿造和保存更稳定，伊丹、滩等产地伴随江户市场兴起。' },
  { era: '近代', title: '瓶装与研究', text: '玻璃瓶逐步代替木桶运输。1904 年日本设立酿造研究机构，科学研究与传统技艺开始并行。' },
  { era: '当代', title: '技艺继续传承', text: '2024 年，使用麹菌的日本传统酒造知识与技艺列入联合国教科文组织非物质文化遗产名录。' },
] as const;

export const SAKE_STORIES = [
  { kind: '神话 · 非史证', title: '八岐大蛇与八盐折之酒', text: '须佐之男与八岐大蛇的故事里出现了酒，但传说中那种酒的原料与做法仍有不同解释。它是理解酒与神话关系的入口，不是现代清酒起源的证据。', source: { label: '日本酒造组合中央会 · 历史与传说', url: 'https://www.japansake.or.jp/sake/what/history/index.html' } },
  { kind: '酒藏象征', title: '门前一颗杉玉', text: '传统酒藏悬挂杉枝结成的杉玉，鲜绿的新杉玉曾向人们传递新酒酿成的消息。它既是街景，也是时间的记号。', source: { label: '日本酒类综合研究所 · 清酒故事', url: 'https://www.nrib.go.jp/English/sake/pdf/SakeNo01_en.pdf' } },
  { kind: '酒名与文学', title: '“雨后之月”从一本随笔走来', text: '相原酒造记载，第二代相原格从德富芦花《自然与人生》的一篇短文取名“雨后之月”。这是一段酒名的文化来源，不是酒质或名次证明。', source: { label: '相原酒造官方 · 雨后之月名称由来', url: 'https://www.ugonotsuki.com/' } },
] as const;

export const SAKE_CRAFT = [
  { no: '01', title: '精米与洗米', text: '精米去除米粒外层的一部分。精米步合说的是“留下多少”，不是越低就必然越好。' },
  { no: '02', title: '蒸米与制麹', text: '麹菌在蒸米上生长，产生把淀粉分解为糖的酶；麹的管理需要控制温度和湿度。' },
  { no: '03', title: '酒母与酵母', text: '酒母为酵母建立适合的环境。生酛、山废等词指向不同的酒母工艺，不等于品牌或等级。' },
  { no: '04', title: '醪与并行复发酵', text: '在发酵醪中，麹的糖化与酵母的酒精发酵同时发生，这是清酒酿造的重要特征。' },
  { no: '05', title: '压榨与火入', text: '压榨分离酒液与酒粕；是否火入、过滤及其顺序会形成不同的标签词和保存要求。' },
] as const;

export const SAKE_CLASSIFICATIONS = [
  { term: '纯米', key: '原料', explanation: '强调米与米麹，不以是否名贵判断；具体分类仍要核对标签。' },
  { term: '吟酿 / 大吟酿', key: '酿造方法', explanation: '与精米步合、低温酿造等要求有关；“大”不是个人口味的高分。' },
  { term: '本酿造', key: '原料与标示', explanation: '允许在规定范围内使用酿造酒精，和纯米系是不同路径，不是“真假清酒”之分。' },
  { term: '生酒 / 原酒 / 浊酒', key: '处理与状态', explanation: '分别指向火入、加水调整、压榨后的状态等；不能混成同一个等级表。' },
] as const;

export const SAKE_TASTING_LENSES = [
  { title: '观色', terms: '透明 · 微黄 · 琥珀 · 浊', text: '颜色和清澈度与过滤、压榨及熟成有关。单凭颜色不能判断真伪或好坏。' },
  { title: '闻香', terms: '果香 · 花香 · 米香 · 熟成香', text: '可用具体联想词记录香气；吟酿常见果香，熟成酒可能出现坚果、烘烤等线索。' },
  { title: '识味', terms: '甘味 · 酸度 · 旨味 · 余韵', text: '甜感不是一个数字决定的；糖、酸、旨味和温度共同塑造整体印象。' },
  { title: '读数', terms: '日本酒度 · 酸度 · 精米步合', text: '数字帮助建立比较问题，却不能单独预测个人喜好、价值或品质。' },
] as const;

export const SAKE_PRICE_SAMPLES = [
  { name: '久保田 千寿', style: '吟酿', volume: '720ml', priceJpy: 1430, source: '朝日酒造 2026 官方价格表', url: 'https://www.asahi-shuzo-online.jp/hpgen/HPB/categories/27260.html' },
  { name: '出羽樱 樱花吟酿', style: '吟酿', volume: '720ml', priceJpy: 1650, source: '出羽樱官方酒款资料', url: 'https://www.dewazakura.co.jp/item/cat03/oka.html' },
  { name: '継 · TSUGU', style: '纯米大吟酿', volume: '720ml', priceJpy: 44000, source: '朝日酒造官方产品页', url: 'https://www.asahi-shuzo.co.jp/tsugu/' },
  { name: 'MIYASHITA ESTATE Kaori', style: '纯米大吟酿', volume: '720ml', priceJpy: 110000, source: '宫下酒造官方产品页', url: 'https://www.msb.co.jp/product/5543/' },
] as const;

export const SAKE_COLLECTION_CHECKLIST = [
  { title: '记来源', text: '记录酒藏、系列、容量、版本、购买或获赠的来源，以及可核对的票据；不上传含个人信息的单据。' },
  { title: '留原貌', text: '若记录实物，拍正标、背标、瓶盖、底部和瑕疵；照片保留原文件，修复图另存并标注。' },
  { title: '记保存', text: '光、温度和氧气会影响酒质。按原标签和酒藏提示保存，记录状态变化；陈放不保证升值。' },
  { title: '分收藏对象', text: '一瓶酒、空瓶、酒标、酒器和纸本文献是不同藏品，分别有不同的保管与真实性证据。' },
] as const;

export const SAKE_DEPTH_SOURCES = [
  { label: '日本酒造组合中央会 · 清酒史', url: 'https://japansake.or.jp/sake/en/basic/japanese-sake-history/' },
  { label: '日本酒造组合中央会 · 酿造方法', url: 'https://japansake.or.jp/sake/en/basic/how-is-sake-made/' },
  { label: '日本酒造组合中央会 · 风味与鉴赏', url: 'https://japansake.or.jp/sake/en/basic/what-does-sake-taste-like/' },
  { label: '日本酒造组合中央会 · 酒标词汇', url: 'https://japansake.or.jp/sake/en/basic/how-to-read-sake-bottle-labels/' },
  { label: '联合国教科文组织 · 传统酒造技艺', url: 'https://ich.unesco.org/en/RL/traditional-knowledge-and-skills-of-making-sake-with-koji-mold-in-japan-01977' },
  { label: '日本酒类综合研究所 · 保存条件', url: 'https://www.nrib.go.jp/English/sake_info/sake-essentials/preservation/' },
] as const;
