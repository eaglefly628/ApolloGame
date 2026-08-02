# 地煞数据包 3 · 名册 #27-39（每英雄 3 张招牌地煞）

> game design G ｜ 2026-06-21 全面重写（新名册）｜ 每英雄 3 张 = 真实招牌战术 → 确定性 op。不自创新 op。

---

### 8♦ #27 艾森豪威尔 · 诺曼底登陆（D-Day）
- 地煞①「霸王行动」`{kind:lane, op:reinforce, value:2}` —— D-Day 横渡海峡、强增登陆滩头之兵：单路一次性投入大批增援。
- 地煞②「桑橙人工港」`{kind:siege, op:nearBase, value:+3, slots:2}` —— 拖来人工港稳固登陆场，于敌岸前开出两个攻坚位、近敌方城堡加成。
- 地煞③「最高统帅部」`{kind:morale, op:leaderBuff, value:1}` —— 总揽英美法盟军、合众心为一，统帅光环全军受益。

### 8♣ #28 霍去病 · 漠北之战（封狼居胥）
- 地煞①「长途奔袭」`{kind:tempo, op:advance, value:1, scope:all}` —— 轻骑长驱二千里、疾进如风，全线推进提速。
- 地煞②「封狼居胥」`{kind:winStreak, per:1, cap:3}` —— 连战连捷、势如破竹，每胜一阵叠加增益，封顶 3 层。
- 地煞③「因粮于敌」`{kind:stamina, op:drain, value:2, enemy:true}` —— 就食敌境、断其辎重，每回合削敌耐力 2。

### 7♠ #29 查理曼 · 萨克森战争 / 统一西欧
- 地煞①「四十年征伐」`{kind:winStreak, per:1, cap:4}` —— 戎马四十年、东征西讨不息，连胜叠益，封顶 4 层。
- 地煞②「巡按使制」`{kind:lane, op:reinforce, value:1}` —— 立巡按以察郡县、调度有方，单路稳增援军。
- 地煞③「加冕称帝」`{kind:morale, op:leaderBuff, value:1}` —— 受冕为罗马人的皇帝，帝威加于全军。

### 7♥ #30 关羽 · 襄樊之战（水淹七军·威震华夏）
- 地煞①「水淹七军」`{kind:power, op:deepDecay, perStep:2}` —— 汉水暴溢、平地数丈，敌阵越深越没于洪流，逐层削力。
- 地煞②「舟师围攻」`{kind:siege, op:nearBase, value:+3, slots:1}` —— 乘大水以舟师围樊城，近敌城堡开一攻坚位、加成攻坚。
- 地煞③「威震华夏」`{kind:morale, op:noRout}` —— 声威震动中原、曹操几欲迁都；我军气势压顶，永不溃散。

### 7♦ #31 古德里安 · 色当突破（1940 法国战役）
- 地煞①「闪电突破」`{kind:tempo, op:advance, value:1, scope:lane}` —— 装甲集群强渡马斯河、凿穿防线，本路推进提速。
- 地煞②「装甲洪流」`{kind:phalanx, perAdj:2, cap:6, adj8:false}` —— 坦克集中成楔、相邻互援，每邻一兵加力，封顶 6。
- 地煞③「不停顿追击」`{kind:stamina, op:drain, value:2, enemy:true}` —— 长驱抵海、不予敌喘息，每回合榨干敌耐力 2。

### 7♣ #32 曹操 · 官渡之战
- 地煞①「大军压境」`{kind:bonusMana, value:1}` —— 挟天下之资、兵威浩荡，每回合多得 1 源泉。（关3 boss 既定·沿用）
- 地煞②「连环船」`{kind:phalanx, perAdj:3, cap:9, adj8:false}` —— 舳舻相接、连营成阵，每邻一兵加力，封顶 9。（关3 boss 既定·沿用）
- 地煞③「挟天子」`{kind:odds, op:winPct, value:+5, scope:all}` —— 奉天子以令诸侯、名正言顺，全军胜率 +5%。（关3 boss 既定·沿用）

### 6♠ #33 罗伯特·李 · 钱斯勒斯维尔战役
- 地煞①「分兵奇袭」`{kind:firstStrike, value:+3}` —— 以寡再分军、令杰克逊迂回敌右翼，出其不意、首击 +3。
- 地煞②「以寡敌众」`{kind:odds, op:fewerStronger, perMissing:2}` —— 兵恒少于敌而能制胜，缺额越多、每缺一员愈强。
- 地煞③「儒将之度」`{kind:morale, op:noRout}` —— 临阵从容、镇定如山，全军不溃。

### 6♥ #34 麦克阿瑟 · 仁川登陆
- 地煞①「仁川登陆」`{kind:lane, op:reinforce, value:2}` —— 险滩两栖奇袭、断敌后路，单路骤增登陆之兵。
- 地煞②「蛙跳战术」`{kind:tempo, op:advance, value:1, scope:lane}` —— 越岛进击、避坚击虚，本路跳跃推进。
- 地煞③「我必归来」`{kind:morale, op:revenge, value:2}` —— 败而誓返、卷土重来，我方折损后反增战力 +2。

### 6♦ #35 丰臣秀吉 · 山崎之战 / 一统日本
- 地煞①「中国大返还」`{kind:tempo, op:advance, value:1, scope:all}` —— 闻变旬日驰返畿内，全线急行推进。
- 地煞②「抢占天王山」`{kind:siege, op:nearBase, value:+2, slots:1}` —— 先据天王山高地、俯制战场，近敌城堡开一攻坚位。
- 地煞③「小田原围城」`{kind:stamina, op:drain, value:2, enemy:true}` —— 长围小田原、困而降之，每回合耗敌耐力 2。

### 6♣ #36 戚继光 · 台州大捷（鸳鸯阵·戚家军）
- 地煞①「鸳鸯阵」`{kind:phalanx, perAdj:2, cap:6, adj8:true}` —— 十二人成伍、长短互卫八方，八向相邻皆加力，封顶 6。
- 地煞②「戚家军纪」`{kind:morale, op:noRout}` —— 纪律严明、令行禁止，全军临倭不溃。
- 地煞③「九战九捷」`{kind:winStreak, per:1, cap:3}` —— 台州九战九捷、势不可当，连胜叠益，封顶 3。

### 5♠ #37 圣女贞德 · 奥尔良解围
- 地煞①「圣旗激励」`{kind:morale, op:leaderBuff, value:2}` —— 执白旗身先士卒、激励士气，统帅光环全军受益 +2。
- 地煞②「奉天命之战」`{kind:odds, op:winFloor, value:+10}` —— 天命所归、信念如铁，全军胜率设下限 +10%。
- 地煞③「七日解围」`{kind:tempo, op:advance, value:1, scope:all}` —— 七日连破英军营垒、转败为胜，全线推进提速。

### 5♥ #38 红胡子腓特烈 · 莱尼亚诺战役 / 第三次十字军
- 地煞①「皇帝铁骑」`{kind:firstStrike, value:+3}` —— 帝亲率重装骑士冲阵，首击 +3。
- 地煞②「六入意大利」`{kind:winStreak, per:1, cap:3}` —— 六次南征、反复角力，连胜叠益，封顶 3。
- 地煞③「十字军远征」`{kind:tempo, op:advance, value:1, scope:all}` —— 率大军跨巴尔干、越安纳托利亚长征，全线推进。

### 5♦ #39 大流士一世 · 征服与行省改革 / 贝希斯敦
- 地煞①「平十九叛」`{kind:winStreak, per:1, cap:4}` —— 一岁连平十九役、擒九叛王，连胜叠益，封顶 4。
- 地煞②「行省贡赋」`{kind:bonusMana, value:1}` —— 划行省、收常贡，国库充盈，每回合多得 1 源泉。
- 地煞③「王中之王」`{kind:morale, op:leaderBuff, value:1}` —— 王中之王、号令诸邦，帝王光环加于全军。
