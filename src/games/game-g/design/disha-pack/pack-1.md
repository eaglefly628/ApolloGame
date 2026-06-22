# 地煞数据包 1 · 名册 #1-13（每英雄 3 张招牌地煞）

> game design G ｜ 2026-06-21 全面重写（新名册）｜ owner：换人就重写地煞。每英雄 3 张 = 其真实招牌战术 → 简化成一个确定性 op。
> op 词汇复用关1-5 DishaFx + 已授权 Boss op；不自创新 op。难度/关号分配 + 数值标定后续 sim 校。

---

### A♠ #1 亚历山大大帝 · 高加米拉之战
- 地煞①「伙伴骑兵」`{kind:odds, op:winPct, value:+10, scope:general}` —— 亲率 Companion Cavalry 楔形突击直取王旗，主将出手胜率+10%。
- 地煞②「锤砧」`{kind:odds, op:winPct, value:+6, scope:all}` —— 步兵方阵为砧、骑兵为锤，前后夹击；史实你被两面夹，故全军胜率压制+6%。
- 地煞③「长枪方阵」`{kind:firstStrike, value:+4}` —— 马其顿萨里沙长枪一丈余，触敌即先杀，前锋先手+4%。

### A♥ #2 拿破仑 · 奥斯特里茨（三皇会战）
- 地煞①「大炮兵」`{kind:battery, everyTurns:4, winPct:-8}` —— 集中炮群预先轰击集火，每4回合压你一路−8%。
- 地煞②「近卫军」`{kind:odds, op:winPct, value:+12, scope:front}` —— 帝国近卫军压阵中路一锤定音，中路前锋胜率+12%。
- 地煞③「机动调度」`{kind:bonusMana, value:1}` —— 内线快速调兵、随时补强，Boss每回合多1源泉。

### A♦ #3 成吉思汗 · 野狐岭之战
- 地煞①「集中凿穿」`{kind:odds, op:winPct, value:+10, scope:front}` —— 不与全线相持，十万骑专攻一点凿穿，前锋胜率+10%。
- 地煞②「曼古歹回马」`{kind:tempo, op:advance, value:1, scope:lane}` —— 佯退诱敌、回身骑射再扑，一路推进+1。
- 地煞③「草原续航」`{kind:stamina, op:drain, value:1, enemy:true}` —— 一人数马、就地补给，长途奔袭拖垮敌军续航，敌每回合−1。

### A♣ #4 凯撒 · 阿莱西亚之战
- 地煞①「内外双壁」`{kind:siege, op:nearBase, value:+15, slots:2}` —— 内圈围城、外圈拒援的双重壁垒，隘口守家前2格+15%。
- 地煞②「围点打援」`{kind:odds, op:winPct, value:+8, scope:near}` —— 援军一到即近战合击，近战胜率+8%。
- 地煞③「军团工事」`{kind:power, op:deepDecay, perStep:2}` —— 壕沟陷坑层层设防，敌推进越深每格−2战力。

### K♠ #5 汉尼拔 · 坎尼会战
- 地煞①「新月合围」`{kind:phalanx, perAdj:6, cap:24, adj8:true}` —— 中央示弱后撤、两翼合拢成袋，越是聚拢围得越死，每相邻己兵+6%·封顶24。
- 地煞②「骑兵抄后」`{kind:odds, op:winPct, value:+10, scope:near}` —— 努米底亚骑兵绕后包抄断退路，近战胜率+10%。
- 地煞③「诱敌深入」`{kind:power, op:deepDecay, perStep:2}` —— 故纵敌深入袋形阵，越深越被夹，敌推进每格−2战力。

### K♥ #6 孙武 · 柏举之战
- 地煞①「未战先算」`{kind:odds, op:winFloor, value:+8}` —— 知己知彼、庙算先定，抬全军胜率下限+8%。
- 地煞②「兵者诡道」`{kind:fog, turns:3}` —— 能而示之不能、远交近攻迂回，前3回合你看不清其部署。
- 地煞③「以治待乱」`{kind:morale, op:noRout}` —— 三万破二十万而阵不乱，治军严整濒死不溃。

### K♦ #7 腓特烈大帝 · 洛伊滕会战（斜击战术）
- 地煞①「斜击战术」`{kind:odds, op:winPct, value:+12, scope:front}` —— 隐蔽机动、以全军压敌一翼，集中之处前锋胜率+12%。
- 地煞②「梯次推进」`{kind:tempo, op:advance, value:1, scope:lane}` —— 斜行阵逐营梯次咬上，一路推进+1。
- 地煞③「普鲁士操典」`{kind:stamina, op:stamPlus, value:2}` —— 操练至精、射速冠绝，己方续航+2。

### K♣ #8 居鲁士大帝 · 征服巴比伦 / 灭吕底亚
- 地煞①「改道夺城」`{kind:siege, op:chipMore, value:2}` —— 引幼发拉底河改道、潜兵入城，破家多扣2。
- 地煞②「骆驼破骑」`{kind:odds, op:winPct, value:+8, scope:front}` —— 萨第斯阵前列骆驼惊吕底亚战马，前锋胜率+8%。
- 地煞③「宽仁纳众」`{kind:lane, op:reinforce, value:2}` —— 释俘归乡、各族归附，一路免费补2兵。

### Q♠ #9 威灵顿公爵 · 滑铁卢
- 地煞①「反斜面坚守」`{kind:siege, op:nearBase, value:+15, slots:2}` —— 列军于山棱反斜面避炮、待敌登坡近身才迎击，守家前2格+15%。
- 地煞②「红衫军方阵」`{kind:morale, op:noRout}` —— 步兵空心方阵硬扛骑兵冲击竟日不溃，濒死不溃。
- 地煞③「待援夹击」`{kind:winStreak, per:5, cap:20}` —— 死撑到普军会师，越拖越占上风，每胜+5%封顶20。

### Q♥ #10 朱可夫 · 斯大林格勒/莫斯科/柏林
- 地煞①「钳形反击」`{kind:odds, op:winPct, value:+10, scope:near}` —— 城内死守耗敌、两翼装甲合围德第六集团军，近战胜率+10%。
- 地煞②「纵深防御」`{kind:power, op:deepDecay, perStep:2}` —— 库尔斯克层层雷区炮位放敌深入再断之，敌推进越深每格−2战力。
- 地煞③「大本营预备队」`{kind:lane, op:reinforce, value:2}` —— 不断投入战略预备队填线反推，一路免费补2兵。

### Q♦ #11 萨拉丁 · 哈丁会战
- 地煞①「断其水源」`{kind:stamina, op:drain, value:2, enemy:true}` —— 诱十字军离水苦行、断其汲道，敌焦渴乏力，续航−2。
- 地煞②「焦土火围」`{kind:power, op:deepDecay, perStep:2}` —— 纵火烧旱草围困疲师，敌阵越推进越被火烟困死，每格−2战力。
- 地煞③「轻骑游射」`{kind:odds, op:winPct, value:+8, scope:near}` —— 马穆鲁克轻骑环射不与硬拼、伺机近战，近战胜率+8%。

### Q♣ #12 项羽 · 巨鹿之战（破釜沉舟）
- 地煞①「破釜沉舟」`{kind:odds, op:winPct, value:+20, scope:all}` + `{kind:morale, op:noRout}` —— 砸釜沉舟、绝己退路置之死地，全军胜率+20%且濒死不溃。
- 地煞②「霸王之勇」`{kind:odds, op:winPct, value:+40, scope:general}` —— 力能扛鼎、所当者破，主将出手胜率+40%。
- 地煞③「九战九捷」`{kind:winStreak, per:4, cap:20}` —— 巨鹿连破秦军九阵，越战越勇，每胜+4%封顶20。

### J♠ #13 忽必烈 · 灭南宋（崖山/襄阳）
- 地煞①「回回巨炮」`{kind:siege, op:chipMore, value:3}` —— 配重投石机轰塌襄阳城墙，破家多扣3。
- 地煞②「长围久困」`{kind:tempo, op:slow, enemy:true}` —— 掘壕筑垒断襄阳援道、围而不打六年，敌隔回合才推进。
- 地煞③「水陆并进」`{kind:lane, op:reinforce, value:2}` —— 练水军、崖山合舟封海陆夹击，一路免费补2兵。
