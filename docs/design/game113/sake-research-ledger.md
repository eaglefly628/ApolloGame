# 《雅趣：第二人生》清酒资料馆 · 第一批本地研究档案

核对日期：2026-10-02。仓库中的 `games/game113/sake-cellar.ts` 是供应用直接读取的离线中文策展摘要；`sake-brands.ts` 是八座日本酒藏的入门索引；`sake-depth.ts` 存放历史、工艺、鉴赏与注明口径的价格样本。清酒馆前台不请求酒藏网页、不跳外站，资料索引可将本地研究包导出为 JSON。

## 策展范围

- 日本深读：獺祭、新政、醸し人九平次、风之森，16 条具体作品档案。
- 全球酿造：纽约獺祭 BLUE、Brooklyn Kura，伦敦 KANPAI，英国 Dojima，11 条作品档案。
- 基础酒藏索引：八座日本酒藏。全球部分是经过一手资料核验的首批样本，**不是全球清酒产业的穷尽名录**。

## 资料来源与审校原则

| 主题 | 一手资料 | 本地化边界 |
|---|---|---|
| 獺祭产品体系 | [官方目录](https://dassai.com/us/product/)、[磨之先](https://dassai.com/product/main/beyond.html) | 数字、系列和品牌自述转为简短中文解说；不复制官网图文全文。 |
| 新政 No.6 / Colors | [No.6 档案](https://www.aramasa.jp/collection/no.6.html)、[Colors 档案](https://www.aramasa.jp/collection/colors.html) | 官网页主要是 **2021 年度资料**，仅作为当年的作品档案，不冒充现行配方、标价或库存。 |
| 九平次系列 | [Collection](https://kuheiji.co.jp/kamoshibito/collection/)、[Désir et Sauvage](https://kuheiji.co.jp/kamoshibito/desir-et-sauvage/)、[彼の岸 2024](https://shop.kuheiji.co.jp/pages/hinokishi) | 将酒米、田块、年份写成对照，不跨年份外推产量。 |
| 风之森 | [油长酒造产品档案](https://yucho-sake.jp/product/kazenomori/) | 657、507、807 与 ALPHA 分开标注，精米高低不是价值等级。 |
| 美国当地酿造 | [DASSAI BLUE 官方](https://dassai-blue.com/pages/products)、[Brooklyn Kura 官方](https://www.brooklynkura.com/collections/our-sake) | 保留“品牌来自哪里”与“酒实际在哪里酿造”的区别。 |
| 英国当地酿造 | [KANPAI 官方](https://kanpai.london/shop/sake)、[Dojima 官方](https://www.dojimabrewery.co.uk/) | 不把 375ml、720ml、750ml 或不同币种标价直接横比。 |
| 行业知识 | [日本酒造组合中央会](https://japansake.or.jp/sake/en/)、[日本酒类综合研究所](https://www.nrib.go.jp/English/sake_info/) | 将史实、神话、酒藏自述、技术说明分别标注。 |

每条作品的准确来源 URL 保存在 `sake-cellar.ts` 的 `sourceUrl` 字段并导出于本地研究包。界面只显示来源题名。来源页可能变化，今后若加入奖项、销量、搜索热度或用户关注人数，必须单独记录**指标定义、地域、时间范围、数据提供者和更新日期**；目前不造“人气排行榜”。

## 2026 赛事名次与高价珍酿（2026-10-06 核对）

- [SAKE COMPETITION 2026 官方 GOLD 结果](https://www.sakecompetition.com/award.html)：总计 1,139 件参赛；清酒馆按 Super Premium、纯米大吟酿、纯米吟酿、纯米酒、现代自然五个组别各摘录前三。Super Premium 的前三依次为「而今 特等雄町」「东洋美人 志荘」「くどき上手 命 斗瓶囲大吟醸」。[官方参赛规则](https://sakecompetition.com/sake_competition.html)规定 Super Premium 组需达到 720ml 税前 10,000 日元或 1800ml 税前 15,000 日元的零售价格门槛；这是入组条件，不是本馆对任何单瓶的实时定价。
- 同一赛事的 [官方银铜奖结果](https://www.sakecompetition.com/award_silver.html)列有「田酒 纯米大吟酿 PREMIUM」银奖与「十四代 龍泉」铜奖；银铜奖不续排金奖的第 4、5 名。[2015 年官方历届结果](https://www.sakecompetition.com/award/history2015.html)记载「十四代 七垂二十貫」在当年纯米大吟酿组第 3；用户提到的“十万贯”**可能**指此酒名，尚未确认，不作为 2026 年名次或价格。
- 720ml 日本含税公开价样本：[獺祭「挑む」363,000 日元](https://dassai.com/product/New/dassai-ambition.html)、[宫下酒造 MIYASHITA ESTATE Kaori 110,000 日元](https://www.msb.co.jp/product/5543/)、[朝日酒造「継」44,000 日元](https://www.asahi-shuzo.co.jp/tsugu/)、[楯野川「极限」38,500 日元](https://shop.tatenokawa.com/shop/product_categories/category-high-clas)。界面按酒藏名称而非价格高低排列；这些是截至核对日可见的酒藏/酒藏官方商店标价，不是全日本最贵榜，也不是二手成交价。官方价格可能变动。
- [World Sakagura Ranking 2025 官方结果](https://www.sakaguraranking.jp/2025/index_e.html)排的是酒藏，第一为新泽酿造店；其“2026”主页目前只有方法说明，未见 2026 酒藏名次，因此本馆不把 2025 名次冒充 2026。[IWC 2026 官方结果](https://www.internationalwinechallenge.com/trophy-results-2026.html)的 Champion Sake 是长州酒造「天美 纯米吟酿 蛍天」；[Kura Master 2026 官方 9 月 30 日公告](https://kuramaster.com/ja/award-ceremony-ja/2026/kura-master-2026-presidents-award-announced/)的日本酒 President's Prize 是山梨铭酿「七贤 Sparkling 星ノ輝」。各赛事赛制不同，不合并成一张「全日本清酒总榜」。
- [官方 GOLD](https://www.sakecompetition.com/award.html)、[官方 SILVER / BRONZE](https://www.sakecompetition.com/award_silver.html)及[纯米酒](https://www.sakecompetition.com/result/final_junmai2026.html)、[纯米吟酿](https://www.sakecompetition.com/result/final_junmaiginjo2026.html)、[纯米大吟酿](https://www.sakecompetition.com/result/final_junmaidaiginjo2026.html)三组官方决审入围页，经 `scripts/import-sake-competition-2026.mjs` 固化为 `games/game113/sake-competition-2026.json`。共 528 条可辨认公开记录：38 金、74 银、116 铜，余 300 条仅保留决审名单状态。三组的金银铜名单与决审名单有 13 条名称/生产者写法无法精确同名匹配，保留原行而不擅自认作同瓶，所以 528 是记录条数，不声称为 528 瓶独立酒款。赛事共 1,139 件参赛，但并未公开所有参赛酒名或逐瓶评委意见；本馆不得以名单空白推断作品未入围或未获奖。
- 十四代零售观察与酒藏官价分库：[LIFE VACATION 银座店 2026-01-10 公开列表](https://www.osake-kakaku.com/Juyondai.html)显示 720ml「龍泉」269,500 日元、「龍泉 白雲去来」132,000 日元、「龍月」88,000 日元、「七垂二十貫」77,000 日元、「双虹」70,400 日元（均为该店含税展示价，页面未写各瓶酿造年份）；[酒の本丸屋 2026 年制造「龍泉 白雲去来」720ml 商品页](https://store.shopping.yahoo.co.jp/honmaruya/000813.html)于 2026-10-06 观察到 116,800 日元，运费另计。这些并非高木酒造统一定价，且不能对应 SAKE COMPETITION 2026 的参赛批次。网店价可变；2026-10-06 快照并不保证后续仍一致。
- 逐瓶深读首批五件：依据[木屋正酒造作品目录](https://kiyashow.com/sake/)为「而今 特等雄町」核对产品线，同时明确不借用同页「特上雄町」的参数；依据[长州酒造 2026 年「蛍天」发布](https://choshusake.com/item/1902/)记录酒米、13% 酒精度和**酒藏自述**的风味；依据上述零售页记录「十四代 龍泉」具体报价。另有 IWC 公开的真正逐瓶品饮笔记：[作 ZAKU Kaizan Ittekisui 2025/2026](https://www.internationalwinechallenge.com/canopy/beverage_details?sid=21998)、[梵 Born: Premium Sparkling 2024/2025](https://www.internationalwinechallenge.com/canopy/beverage_details?sid=23029)。后两者只在 IWC 组别内叙述，不移植到 SAKE COMPETITION 名次。五件是有较深一手材料的示范，不暗示 528 条记录都有评委评语。

## 师傅带路的入门考据（2026-10-07）

新版五章将知识拆成「实物观察 → 师傅拆解 → 出门小考」。杉翁是虚构角色；其对白为原创叙事，不是史料引文或真实杜氏的言论。小考检验的是可核对的基础概念，不考品牌价格，也不要求品饮。

- 门前杉玉又称酒林：酒藏悬挂新制杉枝球，初绿渐褐，传统上用来传递新酒到来的时节信号。不能据此判断某瓶酒的确切年份、批次或品质。依据：[日本酒造组合中央会术语表](https://japansake.or.jp/sake/en/basic/glossary/)、[日本酒类综合研究所《清酒的故事》](https://www.nrib.go.jp/English/sake/pdf/SakeNo01_en.pdf)。
- 米、麹与酵母：制麹时麹菌在蒸米上生长，所产酶将淀粉转成糖；酵母再把糖转为酒精。两者在主醪中并行，不能把麹与酵母混为一谈。依据：[日本酒造组合中央会酿造说明](https://japansake.or.jp/sake/en/professional/sake-brewing-processes-flavor/)。
- 酒标与精米：精米步合 45% 指精米后留下约 45% 的白米重量，不是磨去 45%，也不是品质评分；特定名称表示原料和工艺条件。依据：[日本酒造组合中央会酒标说明](https://japansake.or.jp/sake/en/basic/how-to-read-sake-bottle-labels/)。
- 生酒保存：未火入的生酒对温度更敏感，行业资料建议低于 5℃ 保存；具体瓶子仍以酒藏标示和可核实的保存记录为准。依据：[日本酒造组合中央会保存说明](https://japansake.or.jp/sake/en/basic/how-to-store-preserve-sake/)。

五章资料与两问脚本写在 `games/game113/sake-mentor.ts`，前台只显示本地中文摘要和资料名称，不强迫玩家跳外站。真实杉玉资料照片有单独来源及许可记录，不能用它证明任何具体酒款。

## 图片与版权

正式构建中，没有取得授权的具体瓶身／酒标照片一律显示 Placeholder。馆内三张实拍来自有 CC0 标记的档案，逐张对应真实酒藏建筑或馆藏器物，见 [`public/games/game113/real/README.md`](../../../public/games/game113/real/README.md)。不把通用器物图当作某一在售酒款，不用 AI 生成图冒充实物。本地化的是**事实摘录与原创中文摘要**，不是未经授权的官网页面镜像。

2026-10-02 补充：按 owner 的本机预审需求，从酒藏官网暂存八张具体产品候选图到 `games/game113/preview-art-local/`。该目录被 `.gitignore` 排除；图片只在 Vite 开发态显示，正式构建回退 Placeholder，既不进 Git 也不进发行包。每张图的官网页面、原图 URL、所示酒款／年份、待授权状态和闭集用途元数据见 `games/game113/sake-preview-images.ts`。这不是商用授权声明，合作或书面许可落实前不得迁入正式资产目录。特意核对出九平次某文件名虽然含 `betsuatsurae`，图片实际是 2021 年 EAU DU DÉSIR，故只配后者；Dojima 的说明卡与单独酒标图未作瓶身照使用。新政官网 TLS 证书验证失败，未绕过验证下载。Brooklyn Kura 图片路径未能从官网稳定获取，保持 Placeholder。

## 下一批采集队列

1. 产区：灘、伏见、新潟、山形、秋田、奈良之外，按县及酒造组合逐批建档。
2. 专题：酒米谱系、六号酵母、菩提酛／生酛、贵酿酒、古酒、生酒冷链、木桶与瓶型。
3. 国际：按国家核验当地真正酿造的酒藏，不把进口商或酒吧误列为酿造者。
4. 收藏：建立原瓶照片、年份、批次、保存条件和权利证明字段后再接入真实实物。
