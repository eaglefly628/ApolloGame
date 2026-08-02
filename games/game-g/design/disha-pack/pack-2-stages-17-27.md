# 地煞数据包 · 批次 2 · 关 17–27（贡献度反序·★★★ → ★★★★）

> game design G ｜ 2026-06-20 ｜ 把 §九 这 11 位英雄的 33 张地煞从纯文字升级成**可确定性实装的数据形**。
> 上游模板：`23-hero-codex-52.md` §八（关 1-5 落数值格式）、§九（141 地煞源·kind+破法）；op 词汇：`20-joker-catalog-150.md` §二；字段：`disha.ts` DishaFx。
> 规则：每张 = `{kind, op, value?, scope?, lane?}`；花哨文字**简化成最接近的确定性 op**（同关 1-5）。保留 §九 原名 + 简述，新增数据形 + 简化注记。
> 数值档：winPct +12~18（★★★★ 可 +20）；power add +4~7；homeHp 关17-23=3或4、关24-27=4；★★★/★★★★ 允许 2 张地煞联动。
> 目标玩家胜率：关17 ≈57% → 关27 ≈52%。

## 本批用到的新 op（§八/disha.ts 既有词汇之外）

- `{kind:fog, turns:N}` —— 开局 N 回合迷雾（李靖·李密类·雾散再算）。本批：织田信长「暴雨奇袭」。
- `{kind:odds, op:fewerStronger, perMissing:N}` —— 我方（Boss）兵越少每缺 1 名全军 +N%（以寡击众）。本批：织田信长「以寡击众」。
- `{kind:firstStrike, value:+N}` —— 前锋先手 + 先手胜率（§八 sarissa 同构，本批显式列名）。本批：纳尔逊「抢占上风」。

> 其余全部复用 §八 既有：power add/mul · odds winPct/winFloor/noUpset/kHard · combo adjShare/pair/trips · morale leaderBuff/killGeneralRout/revenge/noRout · tempo advance/slow/jumpToMid · stamina stamPlus/relay/drain · lane reinforce/forceMigrate/freeDeploy · siege homeHp/chipMore/nearBase · phalanx · flank。
> 约定：**负数 winPct/power 落在玩家侧**（远程削/炮压制 = 锁玩家一路减战力，与 §八 battery 同向）。

---

### 关17 · 苏莱曼大帝 · 摩哈赤之战（★★★ · 目标WR ~57%）
- 难度：`{homeHp:3, loadoutCap:4, aiTier:3, targetWR:0.57}`
- aiProfile：`{aggression:7, lanePref:5, spellEager:8, targetPref:'strong', risk:6, economy:7}`（炮兵 + 耶尼切里近卫·火力压制·两小时破阵的暴烈节奏）
- 地煞①「两时破阵」`{kind:odds, op:winPct, value:+15, scope:lane}` —— 本回合连掷三次命·敌前排三格各 judge。简化：集火一路·该路 Boss 掷命压制 +15%。
- 地煞②「耶尼切里」`{kind:power, op:add, value:6, scope:highest}` + `{kind:morale, op:noRout}` —— 召精锐近卫·战力极高·不受士气波动。简化：最强一张 +6 且不溃。
- 地煞③「火炮齐鸣」`{kind:power, op:add, value:-5, scope:lane}` —— 锁我方一整路·远程削全路战力·未战先掉。简化：锁玩家一路·全路 −5 战力（negative=落玩家侧）。

### 关18 · 图拉真 · 达契亚战争（★★★ · 目标WR ~57%）
- 难度：`{homeHp:3, loadoutCap:4, aiTier:3, targetWR:0.57}`
- aiProfile：`{aggression:6, lanePref:7, spellEager:5, targetPref:'weak', risk:5, economy:8}`（工程军团·浮桥调度·稳健续航推进·罗马极盛的体系化压迫）
- 地煞①「多瑙浮桥」`{kind:lane, op:forceMigrate}` —— 两路间架桥·我方兵横向迁路一次绕开正面。简化：每回合强制把 Boss 一路一张迁往相邻路（调度·绕正面）。
- 地煞②「龟甲攻城」`{kind:siege, op:chipMore, value:1}` —— 一路抱团免疫一次拦截·直推大本营再扣 1 血。简化：破玩家大本营时多 chip 1 血（免疫拦截下沉为 chip+1）。
- 地煞③「工程军团」`{kind:stamina, op:stamPlus, value:1}` —— 我方已出的兵各 +1 续航。简化：Boss 全军续航 +1。

### 关19 · 查理曼 · 帕维亚之围（★★★ · 目标WR ~57%）
- 难度：`{homeHp:3, loadoutCap:4, aiTier:3, targetWR:0.57}`
- aiProfile：`{aggression:8, lanePref:6, spellEager:6, targetPref:'general', risk:7, economy:6}`（重骑灭国·圣战旌旗·边屯占位·虔信高压强攻）
- 地煞①「铁骑灭国」`{kind:tempo, op:advance, value:2, scope:lane}` + `{kind:power, op:add, value:4, scope:lane}` —— 选一路重骑推进翻倍·撞敌连撞两格。简化：该路 Boss 推进 +2 且 +4 战力（重骑凿穿）。
- 地煞②「圣战旌旗」`{kind:odds, op:winPct, value:+15, scope:all}` —— 全军本回合掷命胜率 +15%。简化：Boss 全军 +15%（大义旌旗·morale+odds 取 odds 落地）。
- 地煞③「马尔克边屯」`{kind:lane, op:freeDeploy, value:1}` —— 三路最前格各凭空铺 1 守兵·永久占位。简化：Boss 每回合免费多铺 1 兵（占位·draw+lane 下沉为 freeDeploy）。

### 关20 · 卫青 · 龙城之战（★★★ · 目标WR ~57%）
- 难度：`{homeHp:3, loadoutCap:4, aiTier:3, targetWR:0.57}`
- aiProfile：`{aggression:9, lanePref:6, spellEager:4, targetPref:'weak', risk:8, economy:5}`（奇袭斩首·长驱直入·跳过遭遇·首胜破匈奴神话的锐进）
- 地煞①「奇袭龙城」`{kind:siege, op:chipMore, value:1}` + `{kind:tempo, op:jumpToMid, scope:lane}` —— 绕正面·直掷命突袭你大本营格·无视前排。简化：Boss 一路起步即过中线·破家多扣 1 血（无视前排=越中线 + chip）。
- 地煞②「长驱直入」`{kind:tempo, op:advance, value:1, scope:all}` —— 起手主力直铺你半场·跳过沿路遭遇。简化：Boss 全军推进 +1（长驱·跳遭遇下沉为提速）。
- 地煞③「首胜破神」`{kind:odds, op:winFloor, value:60}` + `{kind:morale, op:leaderBuff, value:4}` —— 本场第一次掷命必胜·首胜后全军士气战力升。简化：Boss 掷命下限抬到 60%（首胜≈保底）+ 主将光环 +4（必胜下沉为 winFloor 避免确定性破游戏）。

### 关21 · 织田信长 · 桶狭间之战（★★★ · 目标WR ~57%）
- 难度：`{homeHp:3, loadoutCap:4, aiTier:3, targetWR:0.57}`
- aiProfile：`{aggression:9, lanePref:4, spellEager:7, targetPref:'general', risk:9, economy:4}`（暴雨奇袭·三千破两万·直取本阵的搏命斩首·第六天魔王）
- 地煞①「暴雨奇袭」`{kind:fog, turns:2}` —— 召迷雾遮场·借雾突袭你看不见的一路。简化：开局 2 回合全场迷雾（玩家两回合算不清虚实·新 op fog）。
- 地煞②「直取本阵」`{kind:siege, op:chipMore, value:1}` + `{kind:tempo, op:jumpToMid, scope:lane}` —— 不理两翼·全军越路直插大本营斩首。简化：一路起步过中线·破家多扣 1 血（斩首向）。
- 地煞③「以寡击众」`{kind:odds, op:fewerStronger, perMissing:5}` —— 兵越少战力越凶·被以多打少反而胜率暴涨。简化：Boss 每比满编少 1 名·全军 +5%（新 op fewerStronger·封顶建议 +20%）。

### 关22 · 马尔伯勒 · 布伦海姆会战（★★★ · 目标WR ~57%）
- 难度：`{homeHp:3, loadoutCap:4, aiTier:3, targetWR:0.57}`
- aiProfile：`{aggression:7, lanePref:8, spellEager:6, targetPref:'weak', risk:6, economy:7}`（佯攻两翼·中央破阵·步骑协同·常胜公爵的精密调度）
- 地煞①「中央破阵」`{kind:power, op:add, value:6, scope:lane}` + `{kind:tempo, op:advance, value:1, scope:lane}` —— 佯攻两翼诱你分兵·再集主力凿穿中路。简化：中路集结·该路 Boss +6 战力 + 推进 +1（凿穿）。
- 地煞②「步骑协同」`{kind:odds, op:winPct, value:+15, scope:lane}` —— 步兵咬正面·骑兵同回合突侧后同格夹击叠胜率。简化：该路步骑同格·Boss 掷命 +15%（combo+odds 下沉为 lane winPct）。
- 地煞③「千里奔袭」`{kind:tempo, op:advance, value:1, scope:all}` —— 开局抢先·全军起手推进速大增。简化：Boss 全军推进 +1（奔袭抢路口）。

### 关23 · 扬·杰士卡 · 库特纳霍拉（★★★ · 目标WR ~57%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:3, targetWR:0.57}`
- aiProfile：`{aggression:4, lanePref:5, spellEager:5, targetPref:'strong', risk:3, economy:8}`（战车环堡·火铳据守·独眼不败·龟缩反伤的死守流·配 homeHp 4）
- 地煞①「战车环堡」`{kind:siege, op:nearBase, value:+15, slots:2}` + `{kind:phalanx, perAdj:5, cap:20, adj8:true}` —— 一路围成环堡·圈内防御极高·骑兵冲反受损。简化：自家本营前 2 格 +15% + 方阵 8 邻每邻 +5%（封顶 +20·结环互保）。
- 地煞②「车阵火铳」`{kind:odds, op:winPct, value:+12, scope:near}` —— 环堡内隔车墙向外掷命·自己几乎不挨打。简化：Boss 近本营兵掷命 +12%（隔墙输出）。
- 地煞③「独眼不败」`{kind:morale, op:noRout}` —— 缺兵少粮·大本营每回合自回士气·久攻不溃。简化：Boss 全军不溃（自回士气下沉为 noRout）。

### 关24 · 诸葛亮 · 北伐·出祁山（★★★★ · 目标WR ~54%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:4, targetWR:0.54}`
- aiProfile：`{aggression:4, lanePref:9, spellEager:7, targetPref:'weak', risk:2, economy:9}`（八阵连环·木牛续航·稳扎稳打·智圣的极致体系·谨慎不浪）
- 地煞①「八阵图」`{kind:odds, op:winPct, value:-15, scope:lane}` + `{kind:lane, op:reinforce, value:1}` —— 三路连环·攻任一路被相邻两路夹击减胜率。简化：玩家攻 Boss 任一路 −15%（被相邻夹·落玩家侧）+ 每路常补 1 兵（连环不空）。
- 地煞②「木牛流马」`{kind:stamina, op:stamPlus, value:2}` + `{kind:lane, op:freeDeploy, value:1}` —— 全军续航不衰·补兵不要额外回合。简化：Boss 全军续航 +2 + 每回合免费铺 1（不衰 + 不耗回合）。
- 地煞③「稳扎稳打」`{kind:siege, op:homeHp, value:4}` —— 每回合只推一格·所推之格转难破营垒。简化：本营 4 血（推进慢但所到之处转堡垒·下沉为厚血死守）。

### 关25 · 戚继光 · 台州之战（★★★★ · 目标WR ~54%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:4, targetWR:0.54}`
- aiProfile：`{aggression:6, lanePref:7, spellEager:5, targetPref:'strong', risk:4, economy:7}`（鸳鸯阵相邻成对·长短相济·荡寇连捷·纪律严整的阵法流·九战九捷）
- 地煞①「鸳鸯阵」`{kind:phalanx, perAdj:5, cap:20, adj8:false}` + `{kind:morale, op:noRout}` —— 长短兵相邻成对·短兵扛长兵反刺·极难拔。简化：同路相邻每邻 +5%（封顶 +20）且成阵不溃（成对互保）。
- 地煞②「长短相济」`{kind:combo, op:adjShare}` —— 对相邻格和隔一格同时掷命施压。简化：Boss 同路相邻兵共享最高战力（长短联防·adjShare）。
- 地煞③「荡寇连捷」`{kind:odds, op:winPct, value:+5, scope:all}` + `{kind:stamina, op:relay, value:2}` —— 每清你一格·全军士气续航各涨·越打越猛。简化：Boss 全军 +5% + 阵亡接棒 +2 续航（连捷滚雪球·配九战九捷母题；relay 替代不可上限的连胜叠加）。

### 关26 · 纳尔逊 · 特拉法加海战（★★★★ · 目标WR ~53%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:4, targetWR:0.53}`
- aiProfile：`{aggression:8, lanePref:6, spellEager:6, targetPref:'weak', risk:8, economy:5}`（纵队穿插切线·抢占上风先手·各个击破·海上之王的果决突破）
- 地煞①「破阵纵贯」`{kind:tempo, op:jumpToMid, scope:lane}` + `{kind:power, op:add, value:5, scope:lane}` —— 纵队插进战线中段·把一路从中切两段。简化：Boss 一路越中线插入 + 该路 +5 战力（切割战线）。
- 地煞②「抢占上风」`{kind:firstStrike, value:+18}` —— 开战先手·本回合掷命多一次重掷取优。简化：Boss 前锋先手 + 先手胜率 +18%（重掷取优下沉为先手 winPct·新 op firstStrike 显式）。
- 地煞③「各个击破」`{kind:odds, op:winPct, value:+15, scope:lane}` —— 被切断的孤兵失相邻加成·逐格碾过叠连胜。简化：Boss 集火一路掷命 +15%（孤兵碾压·combo 下沉为 lane winPct）。

### 关27 · 威灵顿 · 滑铁卢（★★★★ · 目标WR ~52%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:4, targetWR:0.52}`
- aiProfile：`{aggression:3, lanePref:6, spellEager:5, targetPref:'strong', risk:2, economy:9}`（反斜固守·步兵方阵反弹·坚守待援·铁公爵的死守反击·终结拿破仑）
- 地煞①「反斜固守」`{kind:siege, op:nearBase, value:+15, slots:2}` —— 后排兵藏坡背迷雾·你看不见算不准虚实。简化：本营前 2 格 +15%（反斜坡死守·迷雾下沉为本营加成）。
- 地煞②「步兵方阵」`{kind:phalanx, perAdj:5, cap:20, adj8:true}` + `{kind:morale, op:noRout}` —— 结阵兵被骑兵冲不溃反弹·越冲越稳。简化：8 邻每邻 +5%（封顶 +20）且结阵不溃（冲不散）。
- 地煞③「坚守待援」`{kind:odds, op:winPct, value:+18, scope:all}` + `{kind:lane, op:reinforce, value:2}` —— 撑过若干回合援军至·全军续航回满战力翻新。简化：Boss 全军 +18% + 援军补 2 兵（待援翻新·★★★★ 满档·两张联动收尾）。
