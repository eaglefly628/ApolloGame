# 地煞数据包 4 · 名册 #40-52（每英雄 3 张招牌地煞）

> game design G ｜ 2026-06-21 全面重写（新名册）｜ 每英雄 3 张 = 真实招牌战术 → 确定性 op。不自创新 op。

---

### 5♣ #40 诸葛亮 · 赤壁之战（联吴破曹）/ 北伐
- 地煞①「八阵图」`{kind:phalanx, perAdj:3, cap:9, adj8:true}` —— 推演兵法布石为阵，八门相生、八方互援；相邻友军越多阵越固。
- 地煞②「东风火攻」`{kind:fog, turns:3}` —— 赤壁夜借东风纵火，敌不辨虚实；开局三回合迷雾遮真相。
- 地煞③「空城退敌」`{kind:morale, op:noRout}` —— 焚香抚琴、城门洞开，临危而军不乱；本方部队不溃退。

### 4♠ #41 斯巴达克斯 · 角斗士起义
- 地煞①「维苏威突围」`{kind:tempo, op:advance, value:1, scope:lane}` —— 厨刀铁叉破训练所、夺路而出，先发制人；本路推进 +1。
- 地煞②「奴隶云集」`{kind:lane, op:reinforce, value:2}` —— 旬月聚众十二万，四方奴隶望风来归；本路增援 +2。
- 地煞③「角斗士血勇」`{kind:morale, op:revenge, value:2}` —— 宁为自由而死、有死无降，越战越烈；受创后反扑 +2。

### 4♥ #42 威廉·华莱士 · 斯特灵桥之战
- 地煞①「长矛圆阵」`{kind:phalanx, perAdj:4, cap:12, adj8:false}` —— schiltron 长矛丛林立如刺猬，专破骑兵冲锋；横向相邻越密阵越强。
- 地煞②「窄桥半渡击」`{kind:firstStrike, value:+3}` —— 待英军半渡斯特灵窄桥而击之，先手即重创；先制 +3。
- 地煞③「自由之志」`{kind:morale, op:leaderBuff, value:2}` —— 「夺不走我们的自由」，主将在则民军用命；将领增益 +2。

### 4♦ #43 德川家康 · 关原之战
- 地煞①「关原待变」`{kind:siege, op:defend}` —— 隐忍布阵、以静制动，先稳守东军不乱；进入防御态势。
- 地煞②「内应倒戈」`{kind:stamina, op:drain, value:2, enemy:true}` —— 策反小早川秀秋阵前倒戈，西军自溃；削敌耐力 2。
- 地煞③「天下人之势」`{kind:winStreak, per:1, cap:3}` —— 一日定关原、终成天下人，胜势滚雪球；每连胜叠加、上限 3。

### 4♣ #44 吕布 · 下邳 / 辕门射戟（三国第一猛将）
- 地煞①「辕门射戟」`{kind:firstStrike, value:+4}` —— 立戟营门、一箭穿小枝，神射定先手；先制 +4。
- 地煞②「飞将冲阵」`{kind:odds, op:winPct, value:+20, scope:general}` —— 赤兔画戟、骁勇无双，主将单挑无敌；主将胜率 +20。
- 地煞③「赤兔逐风」`{kind:tempo, op:advance, value:1, scope:all}` —— 马中赤兔、日行千里，全线疾进；所有路推进 +1。

### 3♠ #45 列奥尼达 · 温泉关之战（三百勇士）｜ 关1 BOSS
> 沿用既有 BOSS 地煞，原样复用，不另设。
- 地煞①「温泉关死守」`{kind:homeHp, value:2}` + `{kind:siege, op:nearBase, value:+0, slots:2}`（隘口守军 `{kind:power, op:add, value:1, scope:front}`）—— 扼两山一径之天险，三百勇士据隘死守，家底更厚、近基设守军、前排守卒强化。
- 地煞②「斯巴达方阵」`{kind:phalanx, perAdj:4, cap:12, adj8:true}` —— 重盾长矛结密阵，八方互掩、人海难破。
- 地煞③「死战不退」`{kind:lastStandGeneral}` —— 「来取吧」，与城共亡、虽死不退，主将死战到底。

### 3♥ #46 尤利西斯·格兰特 · 维克斯堡战役
- 地煞①「合围困城」`{kind:battery, everyTurns:1, winPct:-3}` —— 围城四十七日昼夜炮击，守军食蛇鼠以充饥，逐回合磨蚀；每回合敌胜率 -3。
- 地煞②「无条件投降」`{kind:stamina, op:drain, value:3, enemy:true}` —— 「除无条件投降，别无可议」，断敌后路、逼其耗竭；削敌耐力 3。
- 地煞③「钳形重压」`{kind:odds, op:winPct, value:+18, scope:all}` —— 不胜不休、全线施压拖住敌主力；全军胜率 +18。

### 3♦ #47 蒙哥马利 · 第二次阿拉曼战役
- 地煞①「阿拉曼死守」`{kind:siege, op:defend}` —— 先固守阿拉姆哈勒法挫隆美尔攻势，稳如磐石；进入防御态势。
- 地煞②「稳操胜券」`{kind:odds, op:winFloor, value:+25}` —— 兵火绝对优势、好谋而后动，胜率有底；胜率下限 +25。
- 地煞③「火炮弹幕」`{kind:battery, everyTurns:1, winPct:-4}` —— 千炮昼夜不息、破雷区辟通道，持续削敌；每回合敌胜率 -4。

### 3♣ #48 谢尔曼 · 向海洲进军 / 亚特兰大战役
- 地煞①「向海洲进军」`{kind:power, op:deepDecay, perStep:3}` —— 六万孤军纵深直插、所过狼藉三百里，越深入对手越溃；纵深每步 -3。
- 地煞②「焦土补给」`{kind:siege, op:chipMore, value:3}` —— 弃城焚途、就地取粮，毁敌仓廪而自肥；攻坚削血 +3。
- 地煞③「总体战」`{kind:stamina, op:drain, value:2, enemy:true}` —— 「战争即地狱」，碎敌经济与民心，断其战争根本；削敌耐力 2。

### 2♠ #49 戴高乐 · 二战自由法国 / 装甲战理论
- 地煞①「装甲突击」`{kind:tempo, op:advance, value:1, scope:all}` —— 倡坦克飞机协同集中突击，蒙科尔内逆击德军，全线疾进；所有路推进 +1。
- 地煞②「六一八呼吁」`{kind:morale, op:noRout}` —— 「法国没有输掉这场战争」，国亡而志不亡，本方不溃退。
- 地煞③「自由法国」`{kind:lane, op:freeDeploy, value:1}` —— 凝聚海外法军与抵抗力量，源源驰援；免费部署 +1。

### 2♥ #50 真田幸村 · 大坂夏之阵（逼近家康本阵）
- 地煞①「赤备决死冲」`{kind:odds, op:winPct, value:+22, scope:general}` —— 红甲赤备、决死突阵，直捣家康本阵；主将胜率 +22。
- 地煞②「直取本阵」`{kind:morale, op:revenge, value:3}` —— 数破家康本阵、逼其退避几欲切腹，斩首式反扑；受创后反扑 +3。
- 地煞③「日本第一兵」`{kind:lastStandGeneral}` —— 力战至筋疲而殁、勇绝当世，主将死战到底。

### 2♦ #51 征服者威廉 · 黑斯廷斯战役
- 地煞①「诈败诱敌」`{kind:tempo, op:slow, enemy:true}` —— 佯退诱英军离阵追击、回马围歼，乱其节奏；迟滞敌军。
- 地煞②「诺曼骑射」`{kind:odds, op:winPct, value:+18, scope:front}` —— 骑射屡攻盾墙、最后一冲破阵，前排压制；前排胜率 +18。
- 地煞③「征服者之冠」`{kind:winStreak, per:1, cap:3}` —— 一战夺英格兰王冠、加冕称王，胜势累积；每连胜叠加、上限 3。

### 2♣ #52 狮心王理查 · 阿苏夫之战（第三次十字军）
- 地煞①「严阵徐行」`{kind:siege, op:defend}` —— 全军密阵徐行、忍敌骑骚扰不擅动，稳守待机；进入防御态势。
- 地煞②「待机反击」`{kind:firstStrike, value:+4}` —— 静候战机、医院骑士团率先冲出而全军顺势反击，一击致命；先制 +4。
- 地煞③「狮心纵骑」`{kind:odds, op:winPct, value:+18, scope:general}` —— 临阵如狮、亲冒矢石率骑大破萨拉丁；主将胜率 +18。
