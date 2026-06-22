# 地煞数据包 2 · 名册 #14-26（每英雄 3 张招牌地煞）

> game design G ｜ 2026-06-21 全面重写（新名册）｜ 每英雄 3 张 = 真实招牌战术 → 简化成确定性 op。不自创新 op。

---

### J♥ #14 苏莱曼大帝 · 摩哈赤战役 / 围攻维也纳
- 地煞①「耶尼切里火铳」`{kind:odds, op:winPct, value:+10, scope:front}` —— 摩哈赤新军火铳列阵齐射、两小时破匈牙利王军，前锋胜率+10%。
- 地煞②「环阵巨炮」`{kind:battery, everyTurns:4, winPct:-8}` —— 集中野战重炮预先轰击诸路，每4回合压你一路−8%。
- 地煞③「围城重锤」`{kind:siege, op:chipMore, value:2}` —— 维也纳城下重炮昼夜轰墙、坑道爆破，破家多扣2。

### J♦ #15 织田信长 · 桶狭间之战 / 长篠之战（铁炮三段击）
- 地煞①「铁炮三段击」`{kind:firstStrike, value:+4}` —— 长篠三千铁炮分三段轮替不停射，触敌即先杀，前锋先手+4%。
- 地煞②「据栅迎骑」`{kind:siege, op:nearBase, value:+15, slots:2}` —— 设马防栅诱骑兵硬撞、栅后迎击，守家前2格+15%。
- 地煞③「桶狭间奇袭」`{kind:odds, op:winPct, value:+12, scope:general}` —— 趁雷雨数千奇袭今川本阵、阵斩义元，主将出手胜率+12%。

### J♣ #16 韩信 · 井陉之战（背水一战）
- 地煞①「背水列阵」`{kind:odds, op:winPct, value:+20, scope:all}` + `{kind:morale, op:noRout}` —— 背绵蔓水绝己退路、人自为战，全军胜率+20%且濒死不溃。
- 地煞②「拔帜易帜」`{kind:morale, op:revenge, value:6}` —— 二千轻骑乘虚拔赵壁立汉赤帜、敌回顾大乱，被压制后反扑+6%。
- 地煞③「以寡制众」`{kind:odds, op:fewerStronger, perMissing:3}` —— 三万破二十万，兵越少越敢搏命，每缺一兵全军+3%。

### 10♠ #17 隆美尔 · 加查拉战役 / 北非装甲战
- 地煞①「大胆迂回」`{kind:tempo, op:advance, value:1, scope:lane}` —— 装甲军绕英军雷区侧后包抄，一路推进+1。
- 地煞②「奇袭出手」`{kind:odds, op:winPct, value:+10, scope:general}` —— 行踪诡谲、亲临锋线突击侧翼，主将出手胜率+10%。
- 地煞③「沙漠拖耗」`{kind:stamina, op:drain, value:1, enemy:true}` —— 机动奔袭拉扯战线、耗尽敌补给，敌每回合续航−1。

### 10♥ #18 奥古斯都 · 亚克兴海战（Actium）
- 地煞①「轻舰凿阵」`{kind:odds, op:winPct, value:+10, scope:front}` —— 阿格里帕以轻捷之舰垂直切割安东尼巨舰阵，前锋胜率+10%。
- 地煞②「海上封锁」`{kind:tempo, op:slow, enemy:true}` —— 封锁亚克兴海口、困敌于湾，敌隔回合才推进。
- 地煞③「元首之治」`{kind:bonusMana, value:1}` —— 独揽全权、海内承平调度从容，Boss每回合多1源泉。

### 10♦ #19 李舜臣 · 闲山岛海战 / 鸣梁海战（龟船）
- 地煞①「龟船守峡」`{kind:siege, op:nearBase, value:+15, slots:2}` —— 鸣梁借湍流之险、以龟船横锁窄海峡，守家前2格+15%。
- 地煞②「鹤翼合围」`{kind:phalanx, perAdj:6, cap:24, adj8:true}` —— 闲山岛半月鹤翼阵将敌诱入开阔海面合拢围歼，每相邻己舰+6%·封顶24。
- 地煞③「十三舟死战」`{kind:odds, op:fewerStronger, perMissing:3}` —— 「尚有十二艘战船」，舟越少越死战，每缺一兵全军+3%。

### 10♣ #20 阿提拉 · 沙隆战役（卡塔劳尼亚）
- 地煞①「匈骑奔突」`{kind:odds, op:winPct, value:+10, scope:near}` —— 匈人轻骑环射奔突、近身缠斗，近战胜率+10%。
- 地煞②「上帝之鞭」`{kind:odds, op:winPct, value:+10, scope:general}` —— 大单于亲冲、所过残破，主将出手胜率+10%。
- 地煞③「车营死守」`{kind:morale, op:noRout}` —— 沙隆受挫退守车营自固、血战竟日不溃，濒死不溃。

### 9♠ #21 曼施坦因 · 镰刀收割（法国战役）/ 哈尔科夫反击
- 地煞①「阿登奇袭」`{kind:fog, turns:3}` —— 装甲主力穿越世人视为天险的阿登迷雾峡径，前3回合你看不清其部署。
- 地煞②「镰刀凿穿」`{kind:odds, op:winPct, value:+12, scope:front}` —— 集中装甲于一点凿穿、直插海峡断敌后路，前锋胜率+12%。
- 地煞③「反手一击」`{kind:morale, op:revenge, value:8}` —— 哈尔科夫待苏军深入师老兵疲、骤以装甲侧击，被压制后反扑+8%。

### 9♥ #22 华盛顿 · 特伦顿奇袭 / 约克镇
- 地煞①「渡河奇袭」`{kind:odds, op:winPct, value:+12, scope:general}` —— 风雪夜渡特拉华、晨袭特伦顿黑森军毙其主将，主将出手胜率+12%。
- 地煞②「约克镇合围」`{kind:siege, op:nearBase, value:+15, slots:2}` —— 美法海陆并进围困康沃利斯于约克镇，守家前2格+15%。
- 地煞③「持久不溃」`{kind:morale, op:noRout}` —— 屡北而军不散、以拖待变终成大局，濒死不溃。

### 9♦ #23 白起 · 长平之战
- 地煞①「诱敌断粮」`{kind:tempo, op:slow, enemy:true}` —— 佯败诱赵括深入、奇兵断其粮道绝其后，敌隔回合才推进。
- 地煞②「合围尽歼」`{kind:phalanx, perAdj:6, cap:24, adj8:true}` —— 围赵军四十六日成袋、聚拢愈紧围得愈死，每相邻己兵+6%·封顶24。
- 地煞③「深入愈死」`{kind:power, op:deepDecay, perStep:2}` —— 纵敌深入合围之地、越深越被夹绝，敌推进每格−2战力。

### 9♣ #24 纳尔逊 · 特拉法加海战
- 地煞①「两路凿阵」`{kind:odds, op:winPct, value:+12, scope:front}` —— 两路纵队垂直凿入敌阵、拦腰切割逐段围歼，前锋胜率+12%。
- 地煞②「人人尽责」`{kind:morale, op:leaderBuff, value:6}` —— 「英格兰期望人人恪尽其责」旗语激励全军，主将带阵+6%。
- 地煞③「连环歼敌」`{kind:winStreak, per:4, cap:20}` —— 切割后逐舰围歼、越打越占上风，每胜+4%封顶20。

### 8♠ #25 巴顿 · 突出部战役 / 西西里
- 地煞①「装甲急转」`{kind:tempo, op:advance, value:1, scope:all}` —— 三日内九十度急转北上强行军，全线推进+1。
- 地煞②「永远进攻」`{kind:odds, op:winPct, value:+8, scope:all}` —— 嗜攻好战、势如破竹不予敌喘息，全军压制+8%。
- 地煞③「铁胆解围」`{kind:morale, op:leaderBuff, value:6}` —— 冒严寒疾驰解巴斯托涅之困、亲临鼓士，主将带阵+6%。

### 8♥ #26 武田信玄 · 川中岛之战（风林火山）
- 地煞①「不动如山」`{kind:morale, op:noRout}` —— 「不动如山」本阵血战上杉谦信而阵不乱，濒死不溃。
- 地煞②「侵掠如火」`{kind:odds, op:winPct, value:+10, scope:near}` —— 「侵掠如火」甲斐骑兵近身猛攻，近战胜率+10%。
- 地煞③「啄木鸟分兵」`{kind:lane, op:reinforce, value:2}` —— 「啄木鸟」分兵夜袭驱敌、本阵接应合击，一路免费补2兵。
