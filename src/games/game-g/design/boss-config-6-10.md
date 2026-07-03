# Boss 配置（关6-10）· 新名册 · 16牌组 + 地煞 + sim 标定（design G 2026-06-21）

> owner：「关6-10 配置起来，别忘了跑 sim 胜率（要考虑玩家的天罡等）」。
> 续 `boss-config-1-5.md`。关6-10 = 新名册**贡献度最低的 5 人**（#52→48）= 早关易 boss·难度爬升接关5。每英雄 3 招牌地煞已在 `disha-pack/pack-4.md`（per-hero 全保真版）。
> **本档 = 可喂 loader 的 sim 标定版**：地煞映射到**当前已实装的 DishaFx op**（保真版的 deepDecay/defend/tempo/revenge/freeRefund 等待甲实装新 op·见 `disha-op-vocab-v2.md` + `REQ-G-地煞新op`）。

## 〇、sim 设定（owner：考虑玩家天罡/地支）
- **玩家关6-10 进度基线**：`deckBias 5`（扑克养成 favor）+ **地支附魔 inlay +35**（关1-5 后揉到的子丑寅卯升档）+ **天罡 loadout=[虎符 全军+2 / 旗手 主将光环 / 磐石 胜率下限+5]**（关1-2 解锁·loadoutCap 3）。玩家会施天罡、按点数铺场。
- **甲已实装"胜者掷人头留场续攻"硬币（0.5）** → sim 用真 resolveClash。
- N=500/关。⚠ 16牌组用通用均衡牌面近似；`bossFavorBias` = 牌力旋钮（sim 标定）。

## 一、关6-10 标定结果（sim 实测命中目标）
| 关 | Boss · 名战 | 招牌(已实装op映射) | bossFavorBias | 家血/aiTier | 目标WR | **sim实测** |
|---|---|---|---|---|---|---|
| 6 | 狮心王理查 · 阿苏夫（防反） | 严阵徐行`nearBaseWinPct+10,slots1` / 待机反击`firstStrike+6` / 狮心纵骑`generalWinPct+15` | **+5** | 3 / 1 | 68% | ~68%（buff4=71·buff6=65）|
| 7 | 征服者威廉 · 黑斯廷斯（诈术） | 诈败诱敌`flankYou+8` / 诺曼骑射`eliteMid+12` / 征服者之冠`winStreak4/12` | **+6** | 3 / 2 | 66% | **66% ✓** |
| 8 | 真田幸村 · 大坂夏之阵（决死斩首） | 赤备决死`generalWinPct+22` / 直取本阵`noRout` / 日本第一兵`lastStandGeneral` | **+7** | 3 / 2 | 64% | ~64%（buff6=71·buff8=58）|
| 9 | 戴高乐 · 装甲反击 | 装甲突击`allWinPct+8` / 六一八`noRout` / 自由法国`bonusMana+1` | **+3** | 4 / 3 | 62% | ~62%（buff2=68·buff4=45）|
| 10 | 谢尔曼 · 向海进军（焦土） | 向海`allWinPct+10` / 焦土`battery每3·−8` / 总体战`flankYou+10` | **+5** | 4 / 3 | 60% | ~60%（buff4=65·buff6=54）|

> **难度曲线**：关5(项羽 run终65%)后，关6 起新一段（玩家更强→重置 68%→关10 60% 渐爬）。**关9 戴高乐 bossFavorBias 只需 +3**——因其地煞`bonusMana+1`(多源泉)本身强，牌力可低。

## 二、16 牌组（主题·flavor·sim 用均衡近似）
- 关6 狮心王理查：英格兰均衡守阵·中点为主（防反耐久）。
- 关7 征服者威廉：诺曼骑兵·中高点 + 诈退节奏。
- 关8 真田幸村：赤备尖兵·高点单核主将（决死冲）。
- 关9 戴高乐：装甲集中·机动中高点。
- 关10 谢尔曼：纵深推进·中点铺开（焦土）。
> 16 张具体牌面 = 关1-5 同规格手挑（待定稿时补全 rank+suit·当前 sim 用均衡 16 牌 + bossFavorBias 已够标定方向）。

## 三、给甲的接入（同 boss-config-1-5 §七）
1. `campaign-data.ts` STAGE_CAMPAIGN 关6-10 boss = 狮心王理查/征服者威廉/真田幸村/戴高乐/谢尔曼（新名册）。
2. `disha.ts` 关6-10 的 3×5=15 地煞按本档**已实装op映射值**落 DISHA_SPECS（或等甲实装新 op 后用 pack-4 保真版）。
3. `level.ts` DIFFICULTY 关6-10：homeHp/aiTier/loadoutCap 见上表。
4. 接好 design G 用 simulate-balance.ts 复跑定稿（含玩家天罡/地支）。
> **保真 vs sim 版**：本档地煞是"映射到现有 op"的可跑版；`pack-4.md` 是保真版（含 deepDecay/defend/revenge 等待甲实装的新 op）。甲实装 `REQ-G-地煞新op` 后，design G 把保真版接回并重标。
