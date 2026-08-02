# 想象力地煞 · 批A · 关11-24（design G 2026-06-21·先想象后落地）
> 每关一个招牌机制·让玩家像面对新游戏。每条地煞给①想象版②sim可跑映射③需要的新op。
---

> 史料锚定：每位英雄的招牌战均经 web 核证（来源见文末）。机制母题取自其**真实签名战术**，不是 stat bump。
> 命名约定：负数 winPct/power 落在玩家侧（削我方）；🆕新op 写清语义供甲收集实装。

---

### 关11 · #47 蒙哥马利 · 第二次阿拉曼（目标WR 58%）
**主题机制**：这关是「弹幕 + 雷区」。玩家不能像往常一样随便往前怼——前场被火炮覆盖、推进路上有雷。要先「轻足排雷」开一条窄走廊（集中一路慢慢凿），不能三路平摊。
- 地煞①「Lightfoot 弹幕」（千炮齐鸣·史上最大炮击）
  - 💭想象：每回合开局，整条战线被 20 分钟炮火覆盖；玩家**当回合所有在「前 3 格」的兵全体 −战力**，越靠前掉得越多（弹幕梯度）。
  - 🎲可跑映射：`{kind:battery, op:batteryWinPct, everyTurns:1, value:-12, scope:lane}`（每回合压玩家集火的那一路 −12% 掷命·近似全线炮幕）
  - 🆕新op：`{kind:barrage, op:frontDecay, perSlot:-2, fromFront:3}` —— 玩家所有处于敌方前 3 格的兵，每靠前 1 格 −2 战力（弹幕梯度·非单路）。
- 地煞②「雷区走廊」（Devil's Garden·须轻足排雷开窄道）
  - 💭想象：除了**一条**玩家自选的「走廊路」，其余两路推进各踩雷 −战力；走廊一旦选定不可换，逼玩家窄正面突破。
  - 🎲可跑映射：`{kind:flank, op:flankYouWinPct, value:-10}`（非主攻的侧路玩家 −10%·近似两翼有雷·主路安全）
  - 🆕新op：`{kind:terrain, op:minefield, safeLanes:1, penalty:-10}` —— 玩家须指定 1 条无雷走廊；其余路推进每步 −10% 胜率（排雷=慢凿窄正面）。
- 地煞③「钢铁洪流·Supercharge」（炮火掩护下的装甲集中突破）
  - 💭想象：蒙哥马利攒满火力后，一个回合从走廊推出装甲拳，集中一路爆发。
  - 🎲可跑映射：`{kind:battery, op:batteryWinPct, everyTurns:3, value:+14, scope:lane}`（每 3 回合 Boss 集火一路 +14%·攒势后的装甲拳）
- **aiProfile**：`{aggression:5,lanePref:8,spellEager:6,targetPref:'weak',risk:3,economy:7}`（极度有耗·先炮后甲·窄正面·谨慎不浪）
- **难度**：homeHp 3 / aiTier 3 / loadoutCap 4

---

### 关12 · #46 尤利西斯·格兰特 · 维克斯堡/总攻（目标WR 57%）
**主题机制**：这关是「不松手的消耗战」。Boss 永不溃、永不撤、补兵不断——你赢一格它马上又顶上来（Continuous Contact）。玩家若想靠一两次好运 coin flip 翻盘很难，要稳稳积累兵力优势耗死它。
- 地煞①「不间断接触」（Continuous Contact·咬死正面不给你脱离）
  - 💭想象：玩家每清掉 Boss 一格，Boss **立即**在该格后补一张（贴脸顶住），战线永远脱不开。
  - 🎲可跑映射：`{kind:lane, op:reinforce, value:1}`（每路常补 1 兵·咬住正面）
- 地煞②「绝不后撤」（Grant：I propose to fight it out on this line）
  - 💭想象：Boss 掷命输了也不回库——它的兵 tails 不退场，原地再战（钉死战线）。
  - 🎲可跑映射：`{kind:morale, op:noRout}`（Boss 全军不溃·近似不撤）
- 地煞③「围城炮轰」（维克斯堡 47 天围困·雨炮压城）
  - 💭想象：围久了 Boss 大本营变成炮台，玩家越接近它的家越被压制。
  - 🎲可跑映射：`{kind:siege, op:nearBase, slots:2, winPct:+12}`（Boss 本营前 2 格 +12%·围城反压）
- **aiProfile**：`{aggression:6,lanePref:4,spellEager:3,targetPref:'general',risk:7,economy:8}`（蛮力消耗·不退不让·直取大本营·续航见长）
- **难度**：homeHp 4 / aiTier 3 / loadoutCap 4

---

### 关13 · #44 吕布 · 虎牢关/辕门射戟（目标WR 56%）
**主题机制**：这关是「一夫当关的单挑」。Boss 没有体系，靠一张超强主将（赤兔 + 方天画戟）横扫——它的主将几乎必胜且能连推。玩家不能跟它正面对刚主将，要绕开主将那一路、从另两路爆破家门。
- 地煞①「人中吕布·赤兔方天」（万人敌主将·一骑当千）
  - 💭想象：Boss 主将掷命近乎必胜、且 coin flip 永远 heads（赤兔不停蹄·连推不返库）。
  - 🎲可跑映射：`{kind:generalWinPct, value:+20}` + `{kind:morale, op:noRout, scope:general}`（主将 +20% 且不返库·一骑当千连推）
  - 🆕新op：`{kind:duel, op:unstoppableGeneral}` —— Boss 主将 coin flip 恒为 heads（赢了必留场继续推·赤兔不歇）。
- 地煞②「辕门射戟」（150 步神射·隔空点杀）
  - 💭想象：吕布开战前一箭射落你阵中最强一张（隔空缴械·示威退兵）。
  - 🎲可跑映射：`{kind:control, op:intimidate, everyTurns:3}`（每 3 回合吓退玩家一路前锋·近似射戟缴械）
  - 🆕新op：`{kind:snipe, op:disarmStrongest, everyTurns:4}` —— 每 4 回合，移除玩家场上当前战力最高的 1 张（回库·辕门射戟点杀）。
- 地煞③「三英难敌」（虎牢关三英战吕布仍不落下风）
  - 💭想象：围攻吕布那一路的玩家兵越多，吕布反而越凶（以一敌三的反包围加成）。
  - 🎲可跑映射：`{kind:odds, op:fewerStronger, perMissing:5}`（Boss 越被以多打少·全军越强·近似三英难敌）
- **aiProfile**：`{aggression:10,lanePref:3,spellEager:4,targetPref:'strong',risk:9,economy:3}`（莽·靠主将单核·爱挑你最强的打·无脑突进）
- **难度**：homeHp 3 / aiTier 3 / loadoutCap 3（单核体系·cap 低）

---

### 关14 · #43 德川家康 · 关原合战（目标WR 55%）
**主题机制**：这关是「内应与背叛」。Boss 表面只摆少量兵，真正的杀招是「策反」——玩家自己的兵会临阵倒戈、变成 Boss 的兵（小早川秀秋阵前倒戈）。玩家要算好哪些牌可能被策反，别把鸡蛋放一处。
- 地煞①「关原内应」（小早川秀秋阵前倒戈·决定胜负）
  - 💭想象：每隔几回合，玩家场上某一张兵突然倒戈，**调转阵营**为 Boss 所用（不是退场，是变敌兵）。
  - 🎲可跑映射：`{kind:control, op:intimidate, everyTurns:4}`（每 4 回合吓退玩家一张前锋·近似倒戈离场——sim 退而求其次只让其消失）
  - 🆕新op：`{kind:treachery, op:defect, everyTurns:4}` —— 每 4 回合，玩家场上 1 张兵转为 Boss 控制的同战力兵（倒戈·非退场）。
- 地煞②「忍耐与谍网」（数月密谋·细作遍布·尽知敌情）
  - 💭想象：Boss 全程知道玩家手牌/部署意图，AI 永远先你一步落子（先知调度）。
  - 🎲可跑映射：`{kind:bonusMana, value:1}`（多 1 源泉换更优先手调度·近似情报优势的节奏领先）
  - 🆕新op：`{kind:intel, op:foreknowledge}` —— AI 决策可见玩家下一动作意图（谍网·提高 aiTier 行为质量·非数值）。
- 地煞③「待到天下」（隐忍守成·拖到对手自乱·厚血固守）
  - 💭想象：家康不急于求胜，城高血厚，拖得越久越稳，逼玩家在倒戈压力下速攻反而失误。
  - 🎲可跑映射：`{kind:siege, op:homeHp, value:5}`（本营 5 血·能忍·拖到对手出错）
- **aiProfile**：`{aggression:3,lanePref:6,spellEager:7,targetPref:'general',risk:2,economy:9}`（极忍·谋定后动·控场策反·守家反击）
- **难度**：homeHp 5 / aiTier 4 / loadoutCap 4（厚血 + 高 tier 表现「先知」）

---

### 关15 · #42 威廉·华莱士 · 斯特灵桥（目标WR 54%）
**主题机制**：这关是「瓶颈与长矛阵」。地图被「桥」掐成窄口——玩家一次只能从一路推过去，挤过桥的兵立刻撞上刺猬般的 schiltron 长矛圈，骑兵冲不动。要放弃三路平推，集中且耐心。
- 地煞①「斯特灵桥瓶颈」（窄桥一次只过几人·诱敌半渡而击）
  - 💭想象：玩家每回合只有**一路**能向前推进（过桥）；另两路被河水卡住原地不动。华莱士专打半渡之兵。
  - 🎲可跑映射：`{kind:flank, op:flankYouWinPct, value:-12}`（非过桥的两侧路玩家 −12%·近似被河水卡住）
  - 🆕新op：`{kind:terrain, op:chokepoint, openLanes:1}` —— 玩家每回合仅 1 条路可推进，其余路冻结推进（窄桥半渡）。
- 地煞②「schiltron 长矛圈」（12 尺长矛结环·克骑兵·像刺猬）
  - 💭想象：Boss 兵相邻结环，每多一名相邻友军全体大幅加成，且先手刺击（长矛够得着）。
  - 🎲可跑映射：`{kind:phalanx, perAdj:5, cap:20, adj8:true}` + `{kind:firstStrike, value:+6}`（结环 8 邻互保 + 长矛先手）
- 地煞③「半渡而击」（待敌渡过一半·封住退路全歼）
  - 💭想象：玩家过桥的兵打输了**回不去**（退路被封），原地溃灭——失败惩罚加重，逼你别轻率送。
  - 🎲可跑映射：`{kind:battery, op:batteryWinPct, everyTurns:1, value:-8, scope:lane}`（过桥那一路每回合 −8%·近似半渡受击的额外风险）
  - 🆕新op：`{kind:terrain, op:noRetreatForPlayer, lane:'open'}` —— 玩家在「开放路」掷命输了不返库直接退场（退路被封·提高试错代价）。
- **aiProfile**：`{aggression:4,lanePref:9,spellEager:3,targetPref:'weak',risk:3,economy:6}`（守桥诱敌·阵法流·耐心待半渡·专吃弱兵）
- **难度**：homeHp 4 / aiTier 3 / loadoutCap 4

---

### 关16 · #41 斯巴达克斯 · 维苏威火山奇袭（目标WR 53%）
**主题机制**：这关是「背刺奇袭」。Boss 一开始示弱（假装被困山上），中途突然用藤梯从悬崖摸到你**后方**——奇兵直接出现在你阵后偷家。玩家要留预备队防后路，不能全军压上。
- 地煞①「藤梯夜袭」（编藤为梯·悬崖夜降·袭营后背）
  - 💭想象：每隔几回合，Boss 凭空在玩家**最后一格（你家门口）**生成一支奇兵，绕过整条战线直接威胁本营。
  - 🎲可跑映射：`{kind:siege, op:nearBase, slots:2, winPct:+15}`（折算成 Boss 破家段加压·近似奇兵突至家门）
  - 🆕新op：`{kind:ambush, op:rearDeploy, everyTurns:3, lane:'random'}` —— 每 3 回合，Boss 在玩家某路最后排凭空铺 1 张兵（悬崖奇袭后背）。
- 地煞②「角斗士狂怒」（亡命徒·破釜沉舟·人人敢战）
  - 💭想象：Boss 兵越被压到绝境（己方越少）打得越疯，且绝不投降溃逃。
  - 🎲可跑映射：`{kind:odds, op:fewerStronger, perMissing:5}` + `{kind:morale, op:noRout}`（以寡愈强 + 死战不退·亡命徒）
- 地煞③「奴隶洪流」（队伍滚雪球·一呼百应·人数暴涨）
  - 💭想象：斯巴达克斯每打一场胜仗，逃奴来投，队伍越打越大。
  - 🎲可跑映射：`{kind:winStreak, per:4, cap:16}`（连胜叠加·近似越战越众·封顶 +16%）
- **aiProfile**：`{aggression:8,lanePref:5,spellEager:4,targetPref:'weak',risk:9,economy:5}`（游击 + 偷家 + 滚雪球·亡命搏杀·爱抄后路）
- **难度**：homeHp 3 / aiTier 3 / loadoutCap 4

---

### 关17 · #40 诸葛亮 · 北伐·八阵图（目标WR 52%）
**主题机制**：这关是「迷宫阵法」。开场迷雾遮场（空城疑兵），八阵连环让你攻任一路都被相邻路夹击，木牛流马让 Boss 补给永不断。玩家面对的是一台不会犯错、自我修复的体系机器，要找连环的薄弱接缝。
- 地煞①「八阵图连环」（车阵抗骑·九宫相生·攻一路受三面夹）
  - 💭想象：三路结成连环阵——玩家攻任一路，相邻两路同时向其施压（被夹），且阵眼自动补位。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:-15, scope:lane}` + `{kind:lane, op:reinforce, value:1}`（攻任一路玩家 −15% + Boss 每路常补 1·连环不空）
- 地煞②「空城疑兵」（空城计·虚实难辨·疑而不进）
  - 💭想象：开局数回合 Boss 牌面全部盖暗（迷雾），玩家看不清虚实，不敢压上。
  - 🎲可跑映射：`{kind:fog, turns:3}`（开局 3 回合全场迷雾·虚实难辨）
- 地煞③「木牛流马」（运粮不绝·续航不衰·补兵不耗回合）
  - 💭想象：Boss 全军续航不衰减，且补兵不占用「四选一」动作。
  - 🎲可跑映射：`{kind:stamina, op:relay, value:2}` + `{kind:lane, op:freeDeploy, value:1}`（接棒续航 + 每回合免费铺 1·不衰不耗）
- **aiProfile**：`{aggression:4,lanePref:9,spellEager:7,targetPref:'weak',risk:2,economy:9}`（智圣·极致体系·谨慎不浪·稳扎稳打）
- **难度**：homeHp 4 / aiTier 4 / loadoutCap 5

---

### 关18 · #39 大流士一世 · 斯基泰远征/帝国常备军（目标WR 51%）
**主题机制**：这关是「打不光的帝国」。Boss 是横跨万邦的庞然体系——不死队（Immortals）死一个立刻补一个、御道（Royal Road）让援军从天而降、战车弓骑放风筝。玩家像当年的波斯一样面对永远填不完的兵海，但要抓它「斯基泰焦土」露出的破绽：体系庞大却怕被拖、被分割。
- 地煞①「万人不死队」（Immortals·永远满编一万·倒下即补）
  - 💭想象：Boss 有一条「不死队」路，该路任何兵阵亡**立即由库中同战力兵无缝替换**，编制永远满。
  - 🎲可跑映射：`{kind:lane, op:reinforce, value:2}` + `{kind:morale, op:noRout, scope:lane}`（指定一路常补 2 且不溃·近似永远满编）
  - 🆕新op：`{kind:immortals, op:instantReplace, lane:1, slots:'full'}` —— 指定一路任何空格在 Boss 回合立即补满（不死队·编制恒满）。
- 地煞②「御道驰援」（Royal Road·一周横贯帝国·援军速至）
  - 💭想象：Boss 可把后排兵瞬间「驿传」到任意一路前线（横向 + 纵向跳格调度）。
  - 🎲可跑映射：`{kind:lane, op:forceMigrate}` + `{kind:tempo, op:advance, value:1, scope:all}`（强制迁路 + 全军提速·近似御道速援）
  - 🆕新op：`{kind:logistics, op:teleportReinforce, everyTurns:2}` —— 每 2 回合，Boss 把后排 1 张兵直接移到任意路最前线（御道驿传）。
- 地煞③「战车弓骑」（chariot archers·放风筝·未接触先削你）
  - 💭想象：战车弓骑在接触前就远程点射，玩家前锋未战先掉战力。
  - 🎲可跑映射：`{kind:battery, op:batteryWinPct, everyTurns:2, value:-10, scope:lane}`（每 2 回合远程压玩家一路 −10%·风筝点射）
- **aiProfile**：`{aggression:6,lanePref:7,spellEager:6,targetPref:'weak',risk:5,economy:9}`（帝国体系·兵海续航·御道调度·稳压不浪）
- **难度**：homeHp 4 / aiTier 4 / loadoutCap 5

---

### 关19 · #38 红胡子腓特烈 · 莱尼亚诺/第三次十字军（目标WR 50%）
**主题机制**：这关是「不死皇帝」。腓特烈的德意志重骑横冲直撞，更诡异的是「以为他死了→其实没死」的传说气场——他短时间内「无敌」，玩家这几回合怎么打都伤不到他，要忍过无敌窗口再反击。半数关卡·难度爬升的标志关。
- 地煞①「德意志重骑凿穿」（全欧最精锐重骑·中央突破）
  - 💭想象：Boss 选一路重骑，推进翻倍且撞谁碾谁，凿穿你的中军。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:2, scope:lane}` + `{kind:power, op:add, value:5, scope:lane}`（该路推进 +2 且 +5 战力·重骑凿穿）
- 地煞②「皇帝无敌窗」（传他战死却复现·短时刀枪不入的气场）
  - 💭想象：每隔若干回合，Boss 进入数回合「无敌」——这期间玩家对它的掷命**全部失败**（伤不到皇帝），须熬过窗口。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:-20, scope:all}` 周期化近似（无敌窗内玩家全军 −20%）
  - 🆕新op：`{kind:aura, op:invulnerable, everyTurns:5, duration:1}` —— 每 5 回合，Boss 获得 1 回合无敌：该回合玩家对 Boss 掷命一律判负（皇帝不死）。
- 地煞③「卡罗乔战旗」（carroccio·圣战旌旗·全军大义加成）
  - 💭想象：皇帝立起战旗，全军掷命胜率大涨，旗在则士气在。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:+15, scope:all}`（全军 +15%·大义旌旗）
- **aiProfile**：`{aggression:8,lanePref:6,spellEager:6,targetPref:'general',risk:7,economy:6}`（虔信高压·重骑强攻·旌旗鼓舞·正面碾压）
- **难度**：homeHp 4 / aiTier 4 / loadoutCap 5

---

### 关20 · #37 圣女贞德 · 奥尔良之围（目标WR 49%）
**主题机制**：这关是「永不言退的圣战」。贞德的兵被旗帜和信仰加持——绝不溃逃、退而复进、主将（贞德本人）站在最前线哪里最险去哪里。玩家把它打退了它又冲回来，士气是这关的核心，要持续压制别给它「翻盘旗」立起来的机会。
- 地煞①「圣女战旗」（白旗一立·溃兵重整为冲锋）
  - 💭想象：Boss 兵被打到溃逃边缘时，旗帜一挥**全体重整复活**回到场上，退潮变涨潮。
  - 🎲可跑映射：`{kind:morale, op:noRout}` + `{kind:lane, op:reinforce, value:1}`（不溃 + 常补·退而复进的近似）
  - 🆕新op：`{kind:rally, op:bannerRevive, everyTurns:4, count:1}` —— 每 4 回合，Boss 把最近 1 张被打退/退场的兵召回前线（战旗复生）。
- 地煞②「always attack」（从不防守·永远进攻·把撤退变冲锋）
  - 💭想象：Boss 全军强制进攻节奏，推进不停、绝不据守，逼玩家挨不完的冲锋。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:1, scope:all}`（全军每回合推进 +1·永远进攻）
- 地煞③「冲锋在前的圣女」（主将身先士卒·哪险去哪·激励全军）
  - 💭想象：贞德主将本身极强且站最前，主将在场全军 +士气；主将不退场。
  - 🎲可跑映射：`{kind:generalWinPct, value:+12}` + `{kind:morale, op:leaderBuff, value:4}` + `{kind:lastStandGeneral}`（主将 +12% + 光环 +4 + 主将死战不退）
- **aiProfile**：`{aggression:9,lanePref:5,spellEager:5,targetPref:'general',risk:8,economy:5}`（圣战狂热·永远进攻·身先士卒·宁死不退）
- **难度**：homeHp 4 / aiTier 4 / loadoutCap 5

---

### 关21 · #36 戚继光 · 台州九战九捷（目标WR 48%）
**主题机制**：这关是「纪律阵法机器」。鸳鸯阵讲究长短兵**成对**协同——Boss 的兵必须相邻成对才发挥，落单就弱；但成阵后极难拔、不溃、还能九战连捷滚雪球。玩家要想办法切散它的「对」，别让它结成完整鸳鸯阵。
- 地煞①「鸳鸯阵」（12 人一队·长短相济·成对互保·克倭刀）
  - 💭想象：Boss 同路相邻成对的兵互相加成、且不溃；落单的兵则正常。逼玩家做「拆对」博弈。
  - 🎲可跑映射：`{kind:phalanx, perAdj:5, cap:20, adj8:false}` + `{kind:morale, op:noRout}`（同路相邻每邻 +5%·封顶 +20·成对不溃）
- 地煞②「狼筅藤牌」（长短联防·相邻共享最高战力·短兵护长兵）
  - 💭想象：相邻格共享队中最强一张的战力（藤牌挡刀、狼筅压制、长枪借力）。
  - 🎲可跑映射：`{kind:combo, op:adjShare}`（同路相邻共享最高战力·长短相济）
- 地煞③「九战九捷」（连捷滚雪球·越打越士气越足）
  - 💭想象：戚家军每清你一格全军续航 + 胜率小涨，连胜如虎。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:+5, scope:all}` + `{kind:stamina, op:relay, value:2}`（全军 +5% + 阵亡接棒 +2 续航·连捷不竭）
- **aiProfile**：`{aggression:6,lanePref:8,spellEager:5,targetPref:'strong',risk:4,economy:7}`（纪律严整·结阵推进·稳中带凶·专破你的硬点）
- **难度**：homeHp 4 / aiTier 4 / loadoutCap 5

---

### 关22 · #35 丰臣秀吉 · 备中高松城水攻（目标WR 47%）
**主题机制**：这关是「水淹战场」。秀吉筑堤引水，把战场变成泽国——玩家的兵在水里**寸步难行**（推进被冻结/减速），只有筑高的「堤上路」能动，且 Boss 从船楼上居高射你。这是全 14 关里最「地形改写」的一关。
- 地煞①「备中水攻」（12 日筑 4 公里堤·引足守川灌城）
  - 💭想象：开局后战场逐渐被淹，玩家所有兵推进速度**减半甚至冻结**（陷在水里），Boss 兵（船 + 堤上）不受影响。
  - 🎲可跑映射：`{kind:control, op:freeze, everyTurns:2}`（每 2 回合冻玩家 1 个动作·近似水中迟滞）
  - 🆕新op：`{kind:flood, op:slowPlayerAdvance, value:1}` —— 玩家全军每回合推进 −1 格速（被水困·堤上不淹的 Boss 不受影响）。
- 地煞②「船楼铳击」（barge towers·居高临下·铳手隔水压制）
  - 💭想象：Boss 在水面船楼上架铳，玩家无法还手地被持续点射掉血。
  - 🎲可跑映射：`{kind:battery, op:batteryWinPct, everyTurns:1, value:-8, scope:lane}`（每回合压玩家一路 −8%·船楼铳击）
- 地煞③「断粮困城」（水围断补给·守军坐困·援军不至）
  - 💭想象：被水围住的玩家兵补给被切，续航持续流失（饿、困、动弹不得）。
  - 🎲可跑映射：`{kind:stamina, op:drain, value:1}`（玩家全军续航每回合 −1·断粮困城）
  - 🆕新op：`{kind:flood, op:staminaDrain, value:1}` —— 玩家被淹区域的兵每回合续航 −1（坐困泽国）。
- **aiProfile**：`{aggression:4,lanePref:7,spellEager:8,targetPref:'weak',risk:3,economy:9}`（工程奇谋·水攻控场·不战屈人·极擅经营）
- **难度**：homeHp 4 / aiTier 5 / loadoutCap 5

---

### 关23 · #34 麦克阿瑟 · 仁川登陆/跳岛（目标WR 46%）
**主题机制**：这关是「跳岛登陆」。麦克阿瑟「打它没设防的地方」（hit 'em where they ain't）——Boss 跳过你的前线防御，直接登陆你**后方空虚处**，还切断你的补给线（仁川切断 KPA 后勤）。玩家精心布置的正面防线形同虚设，要被迫处处设防。
- 地煞①「仁川登陆」（避实击虚·两栖直插你后方空门）
  - 💭想象：每隔几回合，Boss 挑你**当前最空虚的一路最后排**直接登陆出兵（无视你前线，专打没设防处）。
  - 🎲可跑映射：`{kind:tempo, op:jumpToMid, scope:lane}` + `{kind:siege, op:chipMore, value:1}`（一路越中线直插 + 破家多扣 1·近似两栖突入后方）
  - 🆕新op：`{kind:amphib, op:landWeakest, everyTurns:3}` —— 每 3 回合，Boss 在玩家「兵力最少的那一路」最后排登陆 1 张（避实击虚·打空门）。
- 地煞②「切断补给」（仁川断 KPA 后勤·前线自溃）
  - 💭想象：登陆成功后切断玩家补给线，玩家全军续航/源泉骤降（后方丢了前线就崩）。
  - 🎲可跑映射：`{kind:stamina, op:drain, value:1}`（玩家全军续航 −1·补给被断）
  - 🆕新op：`{kind:logistics, op:cutSupply, manaPenalty:1}` —— 当 Boss 登陆你后方时，玩家下回合源泉 −1（补给线被切）。
- 地煞③「蛙跳越过」（island hopping·跳过硬据点·只取要害）
  - 💭想象：Boss 跳过你重兵把守的路，全军提速直扑薄弱目标。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:1, scope:all}`（全军提速·蛙跳越过硬点）
- **aiProfile**：`{aggression:8,lanePref:4,spellEager:7,targetPref:'weak',risk:9,economy:6}`（豪赌·避实击虚·两栖奇袭·专打你最弱处）
- **难度**：homeHp 4 / aiTier 5 / loadoutCap 5

---

### 关24 · #33 罗伯特·李 · 钱瑟勒斯维尔（目标WR 45·本批最难）
**主题机制**：这关是「分兵奇袭的豪赌大师」。李兵力看似不足却敢分兵——主力佯动正面、奇兵（杰克逊）绕大圈猛击你**侧翼后方**，且 Boss 靠内线机动来回补防，永远先你一步到威胁点。这是批 A 收尾的「最高难度·综合考」，把奇袭 + 内线 + 侧击叠满。
- 地煞①「杰克逊侧击」（32000 人绕行 12 英里·猛击你侧翼后方）
  - 💭想象：Boss 把主力分一半绕到玩家**侧翼**，从意想不到的角度发起毁灭性打击；被侧击的路全线动摇。
  - 🎲可跑映射：`{kind:flank, op:flankYouWinPct, value:-15}` + `{kind:tempo, op:jumpToMid, scope:lane}`（侧路玩家 −15% + Boss 一路插入·近似侧翼包抄）
  - 🆕新op：`{kind:flank, op:envelop, everyTurns:4, value:-15}` —— 每 4 回合，Boss 选玩家一路从侧后突入，该路玩家本回合 −15% 且 Boss 在该路后排加铺 1（钳形侧击）。
- 地煞②「内线机动」（分兵后沿内线来回调度·处处先你一步）
  - 💭想象：Boss 用内线优势在三路间快速调兵，玩家攻哪它补哪，永远填上缺口。
  - 🎲可跑映射：`{kind:lane, op:forceMigrate}` + `{kind:lane, op:reinforce, value:1}`（强制迁路调度 + 常补·内线先手补防）
- 地煞③「以寡敌众的胆识」（兵力劣势仍敢分兵·险中求胜·全军气盛）
  - 💭想象：李越是兵力少越敢打，全军掷命胜率上扬（audacity 加成），且首胜后士气暴涨。
  - 🎲可跑映射：`{kind:odds, op:fewerStronger, perMissing:5}` + `{kind:morale, op:leaderBuff, value:4}`（以寡愈强 + 主将光环 +4·胆识加成）
- **aiProfile**：`{aggression:9,lanePref:7,spellEager:6,targetPref:'weak',risk:10,economy:7}`（敢分兵·豪赌侧击·内线调度·险中取胜的大师）
- **难度**：homeHp 5 / aiTier 5 / loadoutCap 5（满档收尾·综合考）

---

## 🆕 本批新发明 op 汇总（供甲收集 · 含语义）

> 凡 disha-op-vocab-v2 已提的（freeze / intimidate / fog / 现有词汇）直接复用，下表只列**本批新增**。

| # | op | 语义 | 母题来源 |
|---|---|---|---|
| 1 | `{kind:barrage, op:frontDecay, perSlot:-N, fromFront:K}` | 玩家处于敌前 K 格的兵每靠前 1 格 −N 战力（弹幕梯度·非单路） | 蒙哥马利·阿拉曼弹幕 |
| 2 | `{kind:terrain, op:minefield, safeLanes:N, penalty:-N}` | 玩家须指定 N 条无雷走廊；其余路推进每步 −N% | 蒙哥马利·Devil's Garden 雷区 |
| 3 | `{kind:duel, op:unstoppableGeneral}` | Boss 主将 coin flip 恒 heads（赢则必留场连推） | 吕布·赤兔不歇 |
| 4 | `{kind:snipe, op:disarmStrongest, everyTurns:N}` | 每 N 回合移除玩家场上战力最高 1 张（回库） | 吕布·辕门射戟点杀 |
| 5 | `{kind:treachery, op:defect, everyTurns:N}` | 每 N 回合玩家 1 张兵倒戈为 Boss 同战力兵（非退场） | 德川·关原内应倒戈 |
| 6 | `{kind:intel, op:foreknowledge}` | AI 可见玩家下一动作意图（提升决策质量·非数值） | 德川·谍网先知 |
| 7 | `{kind:terrain, op:chokepoint, openLanes:N}` | 玩家每回合仅 N 条路可推进，其余冻结推进 | 华莱士·斯特灵桥瓶颈 |
| 8 | `{kind:terrain, op:noRetreatForPlayer, lane:'open'}` | 玩家在开放路掷命输了不返库直接退场（退路被封） | 华莱士·半渡而击 |
| 9 | `{kind:ambush, op:rearDeploy, everyTurns:N, lane:'random'}` | 每 N 回合 Boss 在玩家某路最后排凭空铺 1 张（偷家） | 斯巴达克斯·悬崖夜袭 |
| 10 | `{kind:immortals, op:instantReplace, lane:1, slots:'full'}` | 指定一路任何空格 Boss 回合立即补满（编制恒满） | 大流士·万人不死队 |
| 11 | `{kind:logistics, op:teleportReinforce, everyTurns:N}` | 每 N 回合 Boss 把后排 1 张兵移到任意路最前线 | 大流士·御道驿传 |
| 12 | `{kind:aura, op:invulnerable, everyTurns:N, duration:M}` | 每 N 回合 Boss 获 M 回合无敌：玩家对 Boss 掷命一律判负 | 巴巴罗萨·皇帝不死 |
| 13 | `{kind:rally, op:bannerRevive, everyTurns:N, count:K}` | 每 N 回合 Boss 召回最近 K 张被退场的兵回前线 | 贞德·圣女战旗复生 |
| 14 | `{kind:flood, op:slowPlayerAdvance, value:N}` | 玩家全军每回合推进 −N 格速（被水困·Boss 不受影响） | 秀吉·备中水攻 |
| 15 | `{kind:flood, op:staminaDrain, value:N}` | 玩家被淹区兵每回合续航 −N（坐困泽国） | 秀吉·断粮困城 |
| 16 | `{kind:amphib, op:landWeakest, everyTurns:N}` | 每 N 回合 Boss 在玩家最弱一路最后排登陆 1 张（打空门） | 麦克阿瑟·仁川登陆 |
| 17 | `{kind:logistics, op:cutSupply, manaPenalty:N}` | Boss 登陆你后方时，玩家下回合源泉 −N（补给被切） | 麦克阿瑟·切断后勤 |
| 18 | `{kind:flank, op:envelop, everyTurns:N, value:-M}` | 每 N 回合 Boss 选玩家一路侧后突入·该路 −M% 且加铺 1 | 罗伯特·李·杰克逊侧击 |

> 注：每条新 op 都给了 🎲可跑映射用现有词汇近似，**sim 可立即跑标定胜率**；新 op 仅在「玩家体验/招牌感」上更贴史实，待甲择优实装。重复母题（reinforce/noRout/fewerStronger/freeze/intimidate/fog/jumpToMid）一律复用，不重复造轮子。

## 史料来源（web 核证）
- 蒙哥马利·阿拉曼（Operation Lightfoot·百万发炮弹·Devil's Garden 雷区·轻足排雷·中央装甲拳）：en.wikipedia.org/wiki/Second_Battle_of_El_Alamein；ww2db.com/battle_spec.php?battle_id=51
- 格兰特（Continuous Contact 不间断接触·fight it out on this line 不撤·维克斯堡 47 日围城炮轰）：emergingcivilwar.com Grant's Tactical Doctrine；nps.gov grant-at-vicksburg
- 吕布（人中吕布马中赤兔·虎牢关三英战吕布·辕门射戟 150 步）：三国演义第五回；zhuanlan.zhihu.com/p/445996210
- 德川家康（关原·小早川秀秋阵前倒戈·数月密谋谍网·隐忍守成）：en.wikipedia.org/wiki/Battle_of_Sekigahara；nippon.com/en/japan-topics/b06916
- 威廉·华莱士（斯特灵桥窄口半渡·schiltron 12 尺长矛环克骑兵·封退路）：en.wikipedia.org/wiki/Battle_of_Stirling_Bridge；nationalwallacemonument.com
- 斯巴达克斯（维苏威·编藤为梯夜降悬崖袭后背·亡命搏杀·队伍滚雪球）：en.wikipedia.org/wiki/Battle_of_Mount_Vesuvius；history.com spartacus-slave-revolt
- 诸葛亮（八阵图车阵抗骑九宫连环·空城计疑兵·木牛流马运粮不绝）：baike.baidu.com 八阵图；guancha.cn 木牛八阵诸葛连弩
- 大流士一世（万人不死队倒下即补·御道一周横贯帝国·战车弓骑·斯基泰焦土）：persianempire.org Royal Road；sevenswords.uk Persian Immortals；en.wikipedia.org/wiki/Scythian_campaign_of_Darius_I
- 红胡子腓特烈（莱尼亚诺德意志重骑·误传战死致军溃·carroccio 战旗·十字军）：en.wikipedia.org/wiki/Battle_of_Legnano；grokipedia.com Battle_of_Legnano
- 圣女贞德（奥尔良·永远进攻不防守·白旗将溃兵转为冲锋·身先士卒中箭不退）：warfarehistorynetwork.com joan-of-arc-siege-of-orleans；en.wikipedia.org/wiki/Joan_of_Arc
- 戚继光（鸳鸯阵 12 人成对长短相济·台州九战九捷·戚老虎）：dpm.org.cn 戚继光；zh.wikipedia.org 戚继光
- 丰臣秀吉（备中高松水攻·12 日筑 4km 堤引水灌城·船楼铳手·断粮困城）：en.wikipedia.org/wiki/Siege_of_Takamatsu
- 麦克阿瑟（仁川登陆 Operation Chromite·hit 'em where they ain't·切断 KPA 补给·跳岛 island hopping）：britannica.com/event/Inchon-landing；en.wikipedia.org/wiki/Battle_of_Inchon
- 罗伯特·李（钱瑟勒斯维尔·劣势分兵·杰克逊绕行 12 英里侧击·内线机动·audacity）：battlefields.org Audacious and Dangerous；en.wikipedia.org/wiki/Battle_of_Chancellorsville
