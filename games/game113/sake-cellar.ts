/**
 * 清酒馆本地策展档案。依据酒藏官网与行业原始资料写成中文摘要，
 * 不复制官网图片、长篇文案或实时商店状态。来源 URL 仅留作内部审校，前台不跳站。
 */
export type SakeDossier = {
  id: string;
  name: string;
  latin: string;
  place: string;
  country: string;
  lens: string;
  thesis: string;
  recognition: string;
  deepQuestion: string;
  deepAnswer: string;
  collectorNote: string;
  products: readonly {
    name: string;
    category: string;
    character: string;
    detail: string;
    sourceName: string;
    sourceUrl: string;
    sourceDate?: string;
  }[];
};

const JAPAN_DOSSIERS: readonly SakeDossier[] = [
  {
    id: 'dassai-deep', name: '獺祭', latin: 'DASSAI', place: '山口 · 岩国', country: '日本', lens: '同一酒藏，读懂数字之外',
    thesis: '45、39、23 是精米步合留下的百分比；到“磨之先”，酒藏反而不公开精米数字。高级感不该只剩一个更小的数字。',
    recognition: '官方产品目录把 45、39、23 与 Beyond 列为经典线；这是产品层级证据，不是市场人气排名。',
    deepQuestion: '为何“磨之先”不写一个更极端的数字？',
    deepAnswer: '酒藏将它解释为在“二割三分”之后探索另一种完成度，而不是靠数字证明更高级。收藏时应留意版本、容量、包装与官方命名，别把精米步合当估值公式。',
    collectorNote: '同名不同容量、带盒与不带盒、限定批次都须单独建档；酒液是会变化的物品，不默认越陈越贵。',
    products: [
      { name: '獺祭 45', category: '纯米大吟酿 · 精米步合 45%', character: '细腻米甜与华丽香气。', detail: '用它建立基线：标签数字表示米粒精米后留下的比例，不是分数。', sourceName: '獺祭官方 · 45', sourceUrl: 'https://dassai.com/cn/product/main/45.html' },
      { name: '獺祭 39', category: '纯米大吟酿 · 精米步合 39%', character: '华丽上立香、平衡的甜感与较长余韵。', detail: '与 45 比较时，先把容量、温度和版本固定，才谈差异。', sourceName: '獺祭官方 · 39', sourceUrl: 'https://dassai.com/product/main/39.html' },
      { name: '獺祭 23', category: '纯米大吟酿 · 精米步合 23%', character: '酒藏经典线中的高精米代表。', detail: '适合追问“精米带来什么”，而不是假设它必然更合个人口味。', sourceName: '獺祭官方产品目录', sourceUrl: 'https://dassai.com/us/product/' },
      { name: '獺祭 磨き その先へ', category: '高端系列 · 精米步合不公开', character: '酒藏定位为与 23 不同的表达。', detail: '“不公开数字”本身就是这条产品线值得记录的策展信息。', sourceName: '獺祭官方 · 磨之先', sourceUrl: 'https://dassai.com/product/main/beyond.html' },
    ],
  },
  {
    id: 'aramasa', name: '新政', latin: 'ARAMASA', place: '秋田 · 秋田市', country: '日本', lens: '生酒与年份，不是同一套收藏逻辑',
    thesis: 'No.6 与 Colors 同属新政，却不能按酒标颜色排成一条高低阶梯：前者是以六号酵母为核心的生酒线，后者借不同秋田酒米讨论风土。',
    recognition: '酒藏自己将 No.6 标为定番生酒、Colors 标为火入系列；“有名”与“适合久藏”不能画等号。官网公开的单款资料为 2021 年度档案。',
    deepQuestion: '为什么热议的 No.6 反而不宜被当作长期囤藏品？',
    deepAnswer: '新政官网说明它是未火入的生酒，要求持续冷藏，并提示尽早饮用。讨论度不改变物理保存条件；比较不同年份还须核对米种和标签版本。',
    collectorNote: '档案要记 BY 酿造年度、出荷月、是否火入与冷链记录；旧年度官方资料不能冒充当季酒款规格。',
    products: [
      { name: 'No.6 X-type', category: '生酒 · 六号酵母 · 档案例 2021', character: '酒藏称其为该系列的旗舰表达。', detail: '官网 2021 档案列出木桶、秋田米与当年精米信息；不同年份不可直接套用。', sourceName: '新政官方 · No.6 档案', sourceUrl: 'https://www.aramasa.jp/collection/no.6.html', sourceDate: '2021 年度页面' },
      { name: 'No.6 S-type / R-type', category: '生酒 · 系列分支 · 档案例 2021', character: '同一酵母主题下的不同作品。', detail: '先看当年官方批次资料，而不是凭字母猜等级。', sourceName: '新政官方 · No.6 档案', sourceUrl: 'https://www.aramasa.jp/collection/no.6.html', sourceDate: '2021 年度页面' },
      { name: 'Colors Ash · 水墨', category: '火入 · 亀の尾 · 档案例 2021', character: '以亀の尾酒米为观察重点。', detail: '与 No.6 的“酵母／生酒”视角不同，Colors 强调米种与年份。', sourceName: '新政官方 · Colors 档案', sourceUrl: 'https://www.aramasa.jp/collection/colors.html', sourceDate: '2021 年度页面' },
      { name: 'Colors Ecru · 生成', category: '火入 · 秋田酒こまち · 档案例 2021', character: '酒藏以清澈、轻盈的方向介绍。', detail: '同属 Colors，米种与精米设置和 Ash 均不同。', sourceName: '新政官方 · Colors 档案', sourceUrl: 'https://www.aramasa.jp/collection/colors.html', sourceDate: '2021 年度页面' },
    ],
  },
  {
    id: 'kuheiji', name: '醸し人九平次', latin: 'KUHEIJI', place: '爱知 · 名古屋', country: '日本', lens: '从稻田到作品的“产地感”',
    thesis: '九平次把酒米品种、田块与年份当成创作语言。只看“纯米大吟酿”五个字，会错过一座酒藏如何理解土地。',
    recognition: '官方以 Flagship、Collection、Désir et Sauvage 等分线呈现作品；这反映酒藏的策展层级，不等于外部销量榜。',
    deepQuestion: '如果只换米、不换工艺，能读出什么？',
    deepAnswer: '官方介绍 EAU DU DÉSIR 与 SAUVAGE 使用相同精米和酿造方式，主要变化是山田锦与雄町。这给收藏者一个更好的比较题：控制工艺变量，再观察原料差异。',
    collectorNote: '九平次常以年份标示作品；藏品档案要同时记录年份、酒米、田块、瓶型、包装和标签原貌。',
    products: [
      { name: '彼の岸', category: 'Flagship · 田块与年份', character: '以兵库黑田庄门柳地区的山田锦为叙事中心。', detail: '官网对 2024 年版本写明产地、醸造地及有限的田块收成；数量只属于该年份，不能外推。', sourceName: '九平次官方 · 彼の岸 2024', sourceUrl: 'https://shop.kuheiji.co.jp/pages/hinokishi', sourceDate: '2024 年版本' },
      { name: '别誂', category: 'Collection · 山田锦 · 精米 35%', character: '官方描述为熟果香、酸味、细微苦感交织。', detail: '“特別に誂えた”是作品命名与设计语言，并非行业法定分类。', sourceName: '九平次官方 · Collection', sourceUrl: 'https://kuheiji.co.jp/kamoshibito/collection/' },
      { name: '山田锦 EAU DU DÉSIR', category: 'Désir et Sauvage · 精米 50%', character: '用山田锦呈现米种个性。', detail: '与雄町 SAUVAGE 形成同工艺、不同米种的一组观察样本。', sourceName: '九平次官方 · Désir et Sauvage', sourceUrl: 'https://kuheiji.co.jp/kamoshibito/desir-et-sauvage/' },
      { name: '雄町 SAUVAGE', category: 'Désir et Sauvage · 精米 50%', character: '以雄町的品种个性作为主题。', detail: '比较时先记录同年份与同储藏条件，别把米种差异解释成品质高低。', sourceName: '九平次官方 · Désir et Sauvage', sourceUrl: 'https://kuheiji.co.jp/kamoshibito/desir-et-sauvage/' },
    ],
  },
  {
    id: 'kazenomori', name: '风之森', latin: 'KAZE NO MORI', place: '奈良 · 御所', country: '日本', lens: '米、磨法与古法的新实验',
    thesis: '风之森的有趣之处不是“越磨越高级”，而是让秋津穂、露叶风等米种在不同精米设置下各自说话，并把奈良的菩提酛技法带进现代酒款。',
    recognition: '官方称秋津穂 657 为长销代表；这是酒藏自述的持续产品线，不是跨品牌人气数值。',
    deepQuestion: '精米 80% 为什么仍值得细看？',
    deepAnswer: '官方将 807 线设计为少磨米、保留复杂滋味的方向。精米步合较高不自动意味着粗糙；评价要回到米种、发酵、酸苦平衡和具体批次。',
    collectorNote: '记录 657／507／807 的完整代码、米种和年度；ALPHA 是另一个实验系列，不能只按编号混排。',
    products: [
      { name: '秋津穂 657', category: '秋津穂 · 精米 65%', character: '官方描述瓜与洋梨的香气，甘味与复杂味共存。', detail: '1998 年开启的代表线；也是理解“同一酒藏的基线”很好的入口。', sourceName: '油长酒造官方 · 风之森产品', sourceUrl: 'https://yucho-sake.jp/product/kazenomori/' },
      { name: '露叶风 507', category: '露叶风 · 精米 50%', character: '官方以青草莓般的香气、鲜明酸感描述。', detail: '与秋津穂 657 比较，米种与精米都变了，不能只归因于一个变量。', sourceName: '油长酒造官方 · 风之森产品', sourceUrl: 'https://yucho-sake.jp/product/kazenomori/' },
      { name: '露叶风 807', category: '露叶风 · 精米 80%', character: '复杂的酸、涩、苦与温和甘味并存。', detail: '和露叶风 507 成对阅读，更能看见“磨法”如何进入风味设计。', sourceName: '油长酒造官方 · 风之森产品', sourceUrl: 'https://yucho-sake.jp/product/kazenomori/' },
      { name: 'ALPHA 4', category: '实验线 · 秋津穂 · 精米 40%', character: '以酒液分离技术为核心的实验作品。', detail: '酒藏称“冰结采”旨在减少分离环节与空气接触；工艺故事比编号更重要。', sourceName: '油长酒造官方 · 风之森产品', sourceUrl: 'https://yucho-sake.jp/product/kazenomori/' },
    ],
  },
];

const WORLD_DOSSIERS: readonly SakeDossier[] = [
  {
    id: 'dassai-blue', name: '獺祭 BLUE', latin: 'DASSAI BLUE', place: '纽约州 · Hyde Park', country: '美国', lens: '日本酒藏在海外落地',
    thesis: '这不是“日本酿好后出口到美国”，而是獺祭在纽约州设酒藏、当地醸造的另一条作品线。',
    recognition: '獺祭官方记录纽约酒藏于 2023 年开业，Blue Type 23／50 于 2024 年回到日本限量销售；不是全球销量证据。',
    deepQuestion: '同一品牌跨国酿造，收藏档案首先要拆开什么？',
    deepAnswer: '产地、酿造地、米的来源与酒标版本分别记录。Blue 的“23／35／50”不应自动与日本版同号产品混成一件。',
    collectorNote: '核对瓶身实际酿造地与批次；不要把日本版獺祭的资料直接复制给纽约版。',
    products: [
      { name: 'BLUE Type 23', category: '纽约醸造 · 纯米大吟酿', character: 'Blue 核心系列之一。', detail: '官方资料列明 Type 23 与 Type 50 为纽约酒藏的产品。', sourceName: '獺祭官方 · BLUE 纽约', sourceUrl: 'https://dassai.com/us/news/info/005668.html' },
      { name: 'BLUE Type 35', category: '纽约醸造 · 纯米大吟酿', character: '位于 Type 23 与 Type 50 之间的现有系列。', detail: '酒藏现行产品页将三款组成核心系列；不能沿用 2024 年只有两款时的旧目录。', sourceName: 'DASSAI BLUE 官方产品', sourceUrl: 'https://dassai-blue.com/pages/products' },
      { name: 'BLUE Type 50', category: '纽约醸造 · 纯米大吟酿', character: 'Blue 核心系列之一。', detail: '适合观察品牌跨产地时的标签语言，而非与日本 45 直接比高低。', sourceName: '獺祭官方 · BLUE 纽约', sourceUrl: 'https://dassai.com/us/news/info/005668.html' },
    ],
  },
  {
    id: 'brooklyn-kura', name: 'Brooklyn Kura', latin: 'BROOKLYN KURA', place: '纽约 · 布鲁克林', country: '美国', lens: '本地米与鲜度逻辑',
    thesis: '布鲁克林的酒藏把日本酿造知识与加州米、本地制作结合。它提醒我们：海外清酒不必只是日本品牌的翻版。',
    recognition: '官网有持续产品目录与线下学习中心，并公开与八海山于 2021 年建立合作；这些是可见度线索，不是实际用户人气统计。',
    deepQuestion: '为什么同一酒藏的两瓶纯米酒，保存线索会不同？',
    deepAnswer: 'Blue Door 是生酒，官网要求冷藏并尽早饮用；Tidal 则是两种纯米酒调和，官网写的是酒窖温度保存。分类只是一层，具体产品说明更重要。',
    collectorNote: '把生酒、调和酒和是否火入分开建档；保存指示应依原瓶和当季官方资料。',
    products: [
      { name: 'Blue Door', category: '纯米生酒', character: '官方描述较饱满、干爽，带米旨味与熟瓜线索。', detail: '使用 Calrose 与山田锦；冷藏要求是它的档案核心。', sourceName: 'Brooklyn Kura 官方 · Blue Door', sourceUrl: 'https://www.brooklynkura.com/products/blue-door-junmai' },
      { name: 'Number Fourteen', category: '纯米吟酿生酒', character: '清新、轻盈、收尾偏干。', detail: '名字来自酒藏第十四版配方；不能误认作日本“十四代”。', sourceName: 'Brooklyn Kura 官方 · Number Fourteen', sourceUrl: 'https://www.brooklynkura.com/products/number-fourteen-junmai-ginjo' },
      { name: 'Tidal', category: '纯米 · 调和酒', character: '加州 Calrose 米；米香与果味并存。', detail: '以两种纯米清酒调和，是理解“清酒也可以调和”的小入口。', sourceName: 'Brooklyn Kura 官方 · Tidal', sourceUrl: 'https://www.brooklynkura.com/products/tidal-junmai' },
    ],
  },
  {
    id: 'kanpai', name: 'KANPAI', latin: 'KANPAI LONDON', place: '伦敦', country: '英国', lens: '伦敦的风格试验室',
    thesis: '同一伦敦酒藏把清澈的纯米吟酿、留有米粒的浊酒与限量大吟酿并列，适合看“风格”如何比产地更快地打开眼界。',
    recognition: '官网列出 KUMO、KAZE 与 TORI 2026 等现售系列；个别奖项在酒藏页面自述，未作为本馆人气榜。',
    deepQuestion: '浊酒为什么不只是“不够过滤”？',
    deepAnswer: 'KANPAI 将 KUMO 的细米沉淀、果味和酸感作为有意保留的风格。浊度是一项工艺与口感线索，不是质量瑕疵的自动判据。',
    collectorNote: '英国酒款常见 375ml、750ml，不能把日本 720ml 的价格与它们直接横比。限量款还要记年份。',
    products: [
      { name: 'KUMO · CLOUDY', category: '特别纯米浊酒 · 375ml', character: '热带果香、较鲜明酸度与细腻米沉淀。', detail: '官方将它作为代表浊酒；是“浊”作为设计选择的例子。', sourceName: 'KANPAI 官方 · KUMO', sourceUrl: 'https://kanpai.london/shop/p/kumo' },
      { name: 'KAZE · WIND', category: '纯米吟酿 · 375ml', character: '荔枝、蜜瓜与谷物甜香线索。', detail: '官网写明使用兵库山田锦；产地、原料产地、酿造地不能混写。', sourceName: 'KANPAI 官方 · KAZE', sourceUrl: 'https://kanpai.london/shop/p/kaze-junmai-ginjo' },
      { name: 'TORI · BIRD 2026', category: '纯米大吟酿 · 750ml · 限量年份', character: '熟热带水果和青草本香气。', detail: '官网标注 2026 版为季节性单罐酿造；下个年份的规格须重新核对。', sourceName: 'KANPAI 官方 · TORI 2026', sourceUrl: 'https://kanpai.london/shop/p/tori-junmai-daiginjo-limited-edition-750ml', sourceDate: '2026 年版本' },
    ],
  },
  {
    id: 'dojima', name: 'Dojima', latin: 'DOJIMA SAKE BREWERY', place: '英国 · 剑桥附近', country: '英国', lens: '把熟成写进作品本身',
    thesis: '酒藏位于 Fordham Abbey，以日本酒米和当地水酿造；Cambridge 贵酿酒把“时间”当成作品的一部分，与多数应趁新鲜记录的生酒形成鲜明对照。',
    recognition: '官网介绍酒藏 2018 年在英国开始酿造，并为 Cambridge 设计熟成计划；这是酒藏经营资料，不是市场人气数据。',
    deepQuestion: '为什么不能把“清酒不适合陈年”当成普遍规则？',
    deepAnswer: '多数产品要按酒藏指引及时饮用，但 Dojima 的 Cambridge 是特意用贵酿工艺和窖藏设计的作品。收藏判断须回到具体酒款、容器和保存方案。',
    collectorNote: '区分“适合熟成的设计”与“已经存放多年”；记录灌装年、储藏环境、标签、开瓶状态，不承诺升值。',
    products: [
      { name: 'Dojima Junmai', category: '纯米 · 日本山田锦 / 英国水', character: '官方描述为柔和甜香、米旨味与果香。', detail: '精米步合 70%；产米地与醸造地跨越两个国家。', sourceName: 'Dojima 官方 · Junmai', sourceUrl: 'https://www.dojimabrewery.co.uk/product/dojima/' },
      { name: 'Cambridge Vintage', category: '贵酿酒 · 熟成设计', character: '酒藏以甜酸平衡与逐渐加深的琥珀色描述。', detail: '末段以已经酿好的清酒替代部分水，官网设计了 3—5 年酒窖熟成；具体年份另行记录。', sourceName: 'Dojima 官方 · Cambridge', sourceUrl: 'https://www.dojimabrewery.co.uk/product/cambridge/' },
    ],
  },
];

/** 两个酒藏馆统一按地域名称排列，不把档案录入顺序当成推荐顺序。 */
const byPlace = (a: SakeDossier, b: SakeDossier) => a.place.localeCompare(b.place, 'zh-CN') || a.name.localeCompare(b.name, 'zh-CN');
export const SAKE_JAPAN_CELLAR: readonly SakeDossier[] = [...JAPAN_DOSSIERS].sort(byPlace);
export const SAKE_WORLD_CELLAR: readonly SakeDossier[] = [...WORLD_DOSSIERS].sort(byPlace);
export const SAKE_ALL_DOSSIERS = [...SAKE_JAPAN_CELLAR, ...SAKE_WORLD_CELLAR] as const;
