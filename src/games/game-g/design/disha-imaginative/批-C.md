# 想象力地煞 · 批C · 关39-52（终章·design G 2026-06-21·先想象后落地）
> 每关一个招牌机制·让玩家像面对新游戏。终章五雄要史诗级。每条地煞给①想象版②sim可跑映射③需要的新op。
---

> **史实核校**（web-verified 2026-06-22）：每位英雄招牌战术取自真实名战，下方各关注明。
> **难度脊**：关39≈35% → 关52≈30%（终章五雄关48-52 = 五大传奇·最硬·~30%）。
> **新op总览**（本批发明，语义见各关🆕）：
> `mirage(假兵)` `slope(反斜面隐蔽+逆冲)` `searchlight(探照灯致盲)` `volleyRelay(三段轮射)` `siegeRamp(攻城渐增)` `routeDivert(改道冲兵)` `panicBeast(异兽惊马)` `mineCollapse(坑道塌城)` `obliqueFocus(斜击聚火)` `feignFlee(诈退反咬·强化版)` `perfectInfo(全知调度)` `bloodlessWin(不战屈兵·经济压制)` `nightCharge(夜袭跳推)`。
> 复用现有 op 优先；仅在现有词汇真表达不出"招牌feel"时下沉新 op（按 manifesto §4）。

---

### 关39 · #17 隆美尔 · 加扎拉会战 / 沙漠之狐（目标WR 35%）
**主题机制**：沙之假象——你永远不确定他兵有多强、在哪。这关是"信息战开幕关"，迷雾+假坦克让玩家第一次体验"看不清的对手"。
- 地煞①「沙漠诡道（假坦克）」
  - 💭想象：隆美尔在卡车上架木板伪装成坦克纵队。你看到他三路都"满编重甲"，掷命前一刻才知道哪些是空壳——但已经下注了。每回合他随机把 1 张真·1 张假交换显示，你读不清真实战力分布。
  - 🎲可跑映射：`{kind:fog, turns:3}` —— 前 3 回合三路皆迷雾，看不清真实战力（用 sim 已有 fog 近似）。
  - 🆕新op：`{kind:fog, op:mirage, count:1, everyTurns:1}` —— 每回合 Boss 在某路插入 1 张"假兵"显示（战力虚标 +N），与之掷命才揭穿（揭穿即消失、不参与结算）。语义：诱导玩家把强牌浪费在空壳上。
- 地煞②「迂回包抄（长臂奇兵）」
  - 💭想象：趁你正面顶牛，他一支装甲绕大后方，绕过你前排直接现身你纵深。机动者制定战场规则。
  - 🎲可跑映射：`{kind:lane, op:freeDeploy, value:1}` —— 每回合 Boss 多 1 次免费铺兵，且铺在绕过前排的纵深格（抢线压境）。
- 地煞③「速度第一（闪击）」
  - 💭想象：whoever has greater mobility forces the enemy to act according to his will——他永远比你早半步接敌。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:1, scope:all}` —— 全军开局额外预推一格。
- **aiProfile**：`{aggression:8,lanePref:7,spellEager:5,targetPref:'weak',risk:8,economy:6}`
- **难度**：homeHp 4 / aiTier 5 / loadoutCap 5

---

### 关40 · #16 韩信 · 井陉之战 / 背水一战（目标WR 34%）
**主题机制**：死地翻盘——他越濒死越凶，且不会溃散，还会"拔旗易帜"偷你大本营。这关教玩家"别贪追残兵、速杀别留口"。
- 地煞①「背水列阵（置之死地）」
  - 💭想象：韩信背靠绵蔓水列阵，前无退路。他全军绝不溃散、死战到底；你以为打崩了，他原地满血再战。
  - 🎲可跑映射：`{kind:morale, op:noRout}` —— Boss 全军濒死不溃。
- 地煞②「置死后生（残兵更猛）」
  - 💭想象：每损一兵，余者怒气倍增，战力反升。半渡而击你的人越往里压，他越强。
  - 🎲可跑映射：`{kind:odds, op:fewerStronger, perMissing:6}` —— Boss 每少 1 张兵全军 +6% 胜率。
- 地煞③「拔旗易帜（奇兵偷营）」
  - 💭想象：两千轻骑趁交战夺你营寨、拔你军旗换上汉旗——你回头一看大本营已插满敌旗，军心先崩。表现为偷家代价翻倍 + 一次性吓退你某路前锋（误以为后方失守）。
  - 🎲可跑映射：`{kind:siege, op:chipMore, value:1}` —— 破你大本营时多扣 1 血。
  - 🆕新op：`{kind:control, op:intimidate, everyTurns:4}` —— 每 4 回合吓退你某路前锋 1 张（回库），模拟"拔旗"动摇军心。
- **aiProfile**：`{aggression:6,lanePref:8,spellEager:7,targetPref:'weak',risk:4,economy:8}`
- **难度**：homeHp 5 / aiTier 5 / loadoutCap 5

---

### 关41 · #15 织田信长 · 桶狭间 / 长篠（目标WR 34%）
**主题机制**：铁炮三段击——这关是"节奏关"。一路化为火枪线，每隔几回合一轮齐射重创你前排；同时桶狭间奇袭可斩首你主将。
- 地煞①「铁炮三段击（轮射）」
  - 💭想象：三千铁炮分三列，一列射、一列装、一列待，火力不断。你一路推上来，迎面就是周期性的弹幕墙，前锋一波波倒下。
  - 🎲可跑映射：`{kind:battery, everyTurns:2, winPct:18, scope:lane}` —— 指定一路每 2 回合一次齐射，该路你掷命 −18%（用现有 battery 近似）。
  - 🆕新op：`{kind:power, op:volleyRelay, everyTurns:2, value:2, scope:lane}` —— 每 2 回合该路对你最前 1 张兵直接"齐射"使其残血/退场（确定性轮射），轮射列循环。语义：把"持续火力压前排"做成可见的节拍。
- 地煞②「桶狭间奇袭（斩首）」
  - 💭想象：暴雨掩护下信长亲率精锐直扑今川本阵，一击斩首。锁你某路主将，斩下即该路全崩。
  - 🎲可跑映射：`{kind:morale, op:killGeneralRout}` —— 打掉你某路主将该路全溃散。
- 地煞③「天下布武（兵海摊薄）」
  - 💭想象：钱粮充足、火枪量产，他铺兵不要本。
  - 🎲可跑映射：`{kind:lane, op:freeDeploy, value:1}` —— 每回合首张部署免源泉。
- **aiProfile**：`{aggression:8,lanePref:7,spellEager:6,targetPref:'general',risk:7,economy:7}`
- **难度**：homeHp 4 / aiTier 5 / loadoutCap 5

---

### 关42 · #14 苏莱曼大帝 · 摩哈赤 / 围维也纳（目标WR 33%）
**主题机制**：奥斯曼围城——这关把"攻城"反过来：他用坑道把你的大本营前格挖塌，城墙变天堑；耶尼切里火枪 + 车阵让正面极难突破。
- 地煞①「坑道塌城（地雷）」
  - 💭想象：奥斯曼工兵在你城墙下挖坑道埋火药，定时引爆，你大本营前的防御格直接坍塌成缺口——但缺口对双方都开，他先一步涌入。表现为定期削你某路 nearBase 防御。
  - 🎲可跑映射：`{kind:siege, op:chipMore, value:1}` + `{kind:power, op:deepDecay, perStep:2}`（近似：你后撤防守的兵贴墙变弱）。
  - 🆕新op：`{kind:siege, op:mineCollapse, everyTurns:3, lane:'rng'}` —— 每 3 回合塌一路你大本营前 1 格防御（该格本回合你 nearBase 加成清零、且 Boss 该路 siege +1）。语义：周期性"拆你最后防线"。
- 地煞②「车阵火枪（tabur cengi）」
  - 💭想象：耶尼切里立于环形车阵后排齐射，长枪手堵口。正面强攻就是送死，逼你绕。
  - 🎲可跑映射：`{kind:siege, op:nearBase, value:16, slots:2}` —— 你大本营前两格他兵 +16% 胜率（车阵死守）。
- 地煞③「苏丹亲征（孤注一掷）」
  - 💭想象：all-or-nothing 总攻——某回合他倾巢压上，全军暴走一波。
  - 🎲可跑映射：`{kind:morale, op:leaderBuff, value:5}` —— 主将在场全军 +5（拖久亦强，体现帝国持久压制）。
- **aiProfile**：`{aggression:7,lanePref:6,spellEager:6,targetPref:'general',risk:6,economy:8}`
- **难度**：homeHp 4 / aiTier 5 / loadoutCap 5

---

### 关43 · #13 忽必烈 · 襄阳之战（回回炮）（目标WR 33%）
**主题机制**：回回炮攻城——这关是"超远程攻城关"。配重投石机射程 500m、弹重 300kg，开局就能隔空砸你前排，且攻城威力随回合渐增（六年围城越打越狠）。
- 地煞①「回回炮（隔空巨砲）」
  - 💭想象：两位西域工匠造的配重砲，未接战就把你前排砸成齑粉。砲弹越来越大、砸得越来越远——攻城威力每回合递增。
  - 🎲可跑映射：`{kind:power, op:add, value:8, scope:front}` —— 他每路最前一张 +8（先制削你前排相对劣势）。
  - 🆕新op：`{kind:siege, op:siegeRamp, base:0, perTurn:1, cap:4}` —— 每过一回合 Boss 全军攻城 chip +1（封顶 +4）。语义：六年围城的"越拖越破城"，惩罚玩家拖延。
- 地煞②「围而后取（断援）」
  - 💭想象：先围死襄阳断其外援，再以砲破城。你想增援前线？援兵半道就被截杀。
  - 🎲可跑映射：`{kind:power, op:deepDecay, perStep:3}` —— 你新部署的援兵每深入一格 −3。
- 地煞③「水陆并进」
  - 💭想象：蒙古水师 + 陆军夹击汉水，多路同时压。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:1, scope:all}` —— 全军提速抢线。
- **aiProfile**：`{aggression:7,lanePref:6,spellEager:7,targetPref:'weak',risk:6,economy:7}`
- **难度**：homeHp 5 / aiTier 5 / loadoutCap 5

---

### 关44 · #11 萨拉丁 · 哈丁之战（断水火围）（目标WR 32%）
**主题机制**：断水焦渴——这关是"消耗续航关"。十字军被引诱进无水沙漠、点火放烟，全军脱水。你的兵会持续掉续航，拖得越久越虚，逼你速战。
- 地煞①「断其水源（焦渴）」
  - 💭想象：萨拉丁填埋水井、放火生烟扇向你营。你全军口渴难耐，续航逐回合下滑、越来越弱。
  - 🎲可跑映射：`{kind:stamina, op:drain, value:1, enemy:true}` —— 你全军续航 −1。
  - 🆕新op：`{kind:stamina, op:drain, mode:'ramp', perTurn:1, cap:3, enemy:true}` —— 你全军续航每回合再 −1（封顶 −3），模拟焦渴累积。语义：把"越拖越渴"做成 ramp，与忽必烈 siegeRamp 同族反向（惩罚拖延）。
- 地煞②「哈丁双角（新月合围）」
  - 💭想象：轻骑绕到你两翼骚扰、新月阵收口，把你挤在两山之间动弹不得。
  - 🎲可跑映射：`{kind:flank, value:-22}` —— 被两翼夹击你 −22% 胜率。
- 地煞③「真十字架（夺旗摄魂）」
  - 💭想象：缴获真十字架圣物，敌军军心尽丧。一次性吓退你前锋、动摇士气。
  - 🎲可跑映射：`{kind:control, op:intimidate, everyTurns:5}` —— 每 5 回合吓退你某路前锋 1 张（复用关40新op）。
- **aiProfile**：`{aggression:7,lanePref:7,spellEager:6,targetPref:'weak',risk:6,economy:7}`
- **难度**：homeHp 4 / aiTier 5 / loadoutCap 5

---

### 关45 · #10 朱可夫 · 斯大林格勒 / 柏林（目标WR 32%）
**主题机制**：探照灯致盲 + 钳形——这关招牌是"探照灯"：柏林战役朱可夫用 134 盏探照灯在夜里照向德军致盲。这里反向用：他周期性"致盲"你，让你某回合看不清/少一个动作；天王星钳形两翼合围。
- 地煞①「探照灯致盲（夜袭）」
  - 💭想象：134 盏防空探照灯骤然亮起，强光直射你阵——你的兵被照得睁不开眼，那一回合你像被冻住，少一个动作、还看不清他动向。
  - 🎲可跑映射：`{kind:fog, turns:2}`（致盲近似为迷雾）。
  - 🆕新op：`{kind:control, op:searchlight, everyTurns:3}` —— 每 3 回合"致盲"你一回合：该回合你四选一锁掉 1 类动作（= freeze 周期版）+ 该回合三路迷雾。语义：把 freeze + fog 打包成"探照灯一闪"的招牌时刻。
- 地煞②「天王星钳形（合围）」
  - 💭想象：南北两翼装甲钳形深远突击，掐断你侧翼，把你主力围在中间。
  - 🎲可跑映射：`{kind:flank, value:-20}` —— 被夹你 −20% 胜率。
- 地煞③「大纵深防御（梯次）」
  - 💭想象：纵深梯次防御，前锋打光后排即补，永远不留空格。
  - 🎲可跑映射：`{kind:stamina, op:relay}` —— 前锋续航打光后排顶上、不留空格。
- **aiProfile**：`{aggression:8,lanePref:7,spellEager:6,targetPref:'strong',risk:6,economy:7}`
- **难度**：homeHp 5 / aiTier 5 / loadoutCap 5

---

### 关46 · #9 威灵顿 · 滑铁卢（反斜面方阵）（目标WR 31%）
**主题机制**：反斜面伏击——这关招牌防守反击：他把兵藏在山脊反斜面，你看不见、炮也打不到；你冲到山顶那一刻，他全军骤然起身齐射 + 方阵抗骑，给你一记反冲。"以静制动"的关。
- 地煞①「反斜面隐蔽（伏起齐射）」
  - 💭想象：威灵顿让步兵卧倒在山脊背面，你的侦察和远程全失效；你兵翻过脊线的瞬间，他们骤然起立、近距齐射，你那一击反被压制。
  - 🎲可跑映射：`{kind:fog, turns:3}` + `{kind:siege, op:nearBase, value:16, slots:2}`（藏兵迷雾 + 隘口反扑近似）。
  - 🆕新op：`{kind:defense, op:slope, slots:2, ambush:18}` —— Boss 大本营前 2 格内的兵默认隐形（迷雾），你兵推进至该格时该格 Boss 兵 +18% 且你本次掷命被"反冲"再 −10%。语义：把"反斜面藏兵 + 翻脊被打"做成贴脸触发的伏击格。
- 地煞②「步兵方阵（抗骑不溃）」
  - 💭想象：法骑反复冲击，英军结成空心方阵巍然不动。他防守阵型濒死不溃。
  - 🎲可跑映射：`{kind:morale, op:noRout}` —— Boss 全军濒死不溃。
- 地煞③「铁公爵之耐（不浪战）」
  - 💭想象：Wellington never wasted troops on heroic moves，稳守到决胜时刻才出手。体现为越拖他主将光环越强、绝不爆冷送兵。
  - 🎲可跑映射：`{kind:odds, op:noUpset}` —— 他占优时绝不被爆冷（稳守反击）。
- **aiProfile**：`{aggression:4,lanePref:6,spellEager:6,targetPref:'strong',risk:3,economy:8}`（守反·低 aggression 高经济是这关独特的"龟缩反打"手感）
- **难度**：homeHp 5 / aiTier 5 / loadoutCap 5

---

### 关47 · #8 居鲁士大帝 · 巴比伦 / 萨迪斯（引水·骆驼）（目标WR 31%）
**主题机制**：引水改道 + 异兽惊马——这关有两个全游戏独一份招牌：①骆驼破骑（你的"马类强牌"遇骆驼直接惊溃）；②引幼发拉底河改道，把你一路兵冲去隔壁、自己从干涸河床潜入你后排。
- 地煞①「骆驼破骑（异兽惊马）」
  - 💭想象：吕底亚铁骑天下无敌，居鲁士把辎重骆驼列于阵前——马惧骆驼气味，你最强的骑兵牌一照面就掉头溃逃。专克你的高战力主战牌。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:-22, scope:strongest}` —— 你最强一路那张兵 −22% 胜率（近似"克你王牌"）。
  - 🆕新op：`{kind:control, op:panicBeast, target:'strongest', everyTurns:3}` —— 每 3 回合，你当前战力最高的前锋 1 张"惊溃"（回库或退场），且其同路下一张 −15%。语义：周期性专杀玩家王牌，逼玩家不敢堆单强牌。
- 地煞②「引水改道（冲散阵型）」
  - 💭想象：居鲁士掘渠改幼发拉底河道，水位骤降——他兵从干涸河床绕过前排直入你后排，同时洪流把你一路兵冲去隔壁，阵型大乱。
  - 🎲可跑映射：`{kind:lane, op:forceMigrate}` + `{kind:lane, op:freeDeploy, value:1}` —— 强制迁你一路兵去隔壁 + 他绕前排免费铺纵深。
  - 🆕新op：`{kind:lane, op:routeDivert, everyTurns:2}` —— 每 2 回合把你某路最前 1 张兵"冲"去相邻路（连位移、可能撞乱该路阵型）。语义：比 forceMigrate 更"动态"的周期改道。
- 地煞③「不战入城」
  - 💭想象：趁你一路空虚长驱直入大本营。
  - 🎲可跑映射：`{kind:siege, op:chipMore, value:1}` —— 破家多扣 1 血。
- **aiProfile**：`{aggression:6,lanePref:8,spellEager:6,targetPref:'strong',risk:5,economy:8}`（targetPref:'strong' 自洽"专打你王牌"）
- **难度**：homeHp 5 / aiTier 5 / loadoutCap 5

---
---
## ★ 终章五雄 · 关48-52（五大传奇 · 最硬 · ~30%）★
> 这五关每关都要"史诗级"：招牌机制更狠更怪，地煞鼓励 2-3 张满值联动，aiTier 6 最高智能，homeHp 5 上限。
---

### 关48 · #7 腓特烈大帝 · 洛伊滕会战（斜击战术）（目标WR 30%）
**主题机制**：斜击聚火——36000 破 90000 的教科书。这关把"斜线集中"做成招牌：他每回合把全部强化"斜插"到你最薄弱的一路，集火碾过去；你补哪、他斜哪，逼你被动救火。
- 地煞①「斜击列阵（动态聚火）」
  - 💭想象：腓特烈拒敌一翼、以全军斜线猛攻另一翼。每回合他自动选你"最弱一路"集中全部兵力 + 战力暴涨，斜线碾压；你刚补强这路，他下回合改斜另一路。
  - 🎲可跑映射：`{kind:power, op:add, value:9, scope:lane}` + `{kind:tempo, op:advance, value:1, scope:lane}`（最强一路 +9 战力 + 推进）。
  - 🆕新op：`{kind:power, op:obliqueFocus, value:10, retarget:'weakestEnemyLane', everyTurns:1}` —— 每回合自动把 +10 战力 + 提速集中到你当前最弱一路（动态重选目标）。语义：斜击的精髓 = "永远砸你最软处"，把静态 scope:lane 升级成追踪式聚火。
- 地煞②「普鲁士操典（铁律推进）」
  - 💭想象：严整队列冒火不乱、齐射溶解防线。聚火那一路推进更快、续航不减。
  - 🎲可跑映射：`{kind:morale, op:noRout}` —— 斜击主力濒死不溃。
- 地煞③「集中即兵海」
  - 💭想象：兵力虽少，集于一点即成局部兵海。
  - 🎲可跑映射：`{kind:lane, op:freeDeploy, value:1}` —— 每回合首张部署免源泉（喂养斜击之锋）。
- **aiProfile**：`{aggression:8,lanePref:9,spellEager:6,targetPref:'weak',risk:7,economy:7}`（lanePref:9 体现极端"集中一翼"）
- **难度**：homeHp 5 / aiTier 6 / loadoutCap 5

---

### 关49 · #6 孙武 · 柏举之战（兵圣·准终章）（目标WR 30%）
**主题机制**：兵形如水·全知算计——这关是"准终章·智力天花板"。兵圣全知你的部署、每回合避实击虚把兵调到你最空的一路；奇正相生用迷雾藏真力；不战而屈人之兵则在经济上压制你。一个"你做什么他都早算到"的对手。
- 地煞①「兵形如水（全知调度）」
  - 💭想象：水无常形、兵无常势。孙武每回合洞悉你全盘部署，把他的兵悄然移到你防守最空虚的一路——你哪里弱，他下一秒就在哪里。让他无虚可击，才可破。
  - 🎲可跑映射：`{kind:lane, op:forceMigrate}` —— 每回合把 Boss 兵换到你最空一路（避实击虚）。
  - 🆕新op：`{kind:ai, op:perfectInfo, react:'shiftToWeakest'}` —— Boss 享"全知"：无视己方迷雾、每回合读你三路防守值并把己方机动兵力重分配到你最弱路（带 1 张免费铺兵）。语义：把"算无遗策"做成 AI 级被动——确定性的最优调度而非随机。
- 地煞②「奇正相生（藏锋迷雾）」
  - 💭想象：以正合、以奇胜。每路都藏暗兵，前 3 回合你看不清他真实战力，摊牌才现奇兵。
  - 🎲可跑映射：`{kind:fog, turns:3}` —— 前 3 回合三路迷雾。
- 地煞③「不战而屈人之兵（经济压制）」
  - 💭想象：上兵伐谋——他不急着打，而是用全胜之略在源泉/节奏上碾压你：他泉水更多、撤退返还更高，靠经济碾死你，逼你"主动送上门"才有打的机会。
  - 🎲可跑映射：`{kind:bonusMana, value:1}` + `{kind:economy, op:withdrawRefundMul, value:1.5}`（泉水 +1 + 撤退返还 1.5×）。
  - 🆕新op：`{kind:economy, op:bloodlessWin, manaBonus:1, refundMul:1.5, deployDiscount:1}` —— "全胜"经济三件套打包：每回合 +1 泉、胜者回库返 1.5×、首张部署 −1 费。语义：兵圣不靠数值靠"赢在算盘"，给玩家"被运营压死"的独特挫败。
- **aiProfile**：`{aggression:5,lanePref:9,spellEager:8,targetPref:'weak',risk:4,economy:10}`（economy:10 全游戏最高·体现"伐谋"）
- **难度**：homeHp 5 / aiTier 6 / loadoutCap 5

---

### 关50 · #5 汉尼拔 · 坎尼会战（新月薄阵·两翼合围）（目标WR 30%）
**主题机制**：坎尼合围——一日歼七万的史上最完美包围。这关招牌"新月薄阵诱敌"：中路故意示弱诱你深入，你越往中间推，上下两翼夹得越狠，被围当回合直接全歼。专治玩家"中路猛攻"的本能。
- 地煞①「新月薄阵（诱你冒进）」
  - 💭想象：汉尼拔把弱兵摆成凸向你的新月中路、精锐藏两翼。中路一触即"后退"诱你猛追——你推得越深，新月凹陷成口袋，两翼骤然收口。他中路越"空"越是陷阱。
  - 🎲可跑映射：`{kind:odds, op:fewerStronger, perMissing:5}` —— 他越少越强（中路示弱诱深入）。
  - 🆕新op：`{kind:trap, op:feignFlee, lane:'mid', lureSteps:2}` —— 中路 Boss 兵主动后退 lureSteps 格诱你深入；你中路兵越过原线即标记"入袋"，下方地煞②③对入袋兵生效。语义：把"诈退诱敌"做成可见的口袋陷阱，惩罚无脑推中。
- 地煞②「两翼包抄（收口夹歼）」
  - 💭想象：上下两路精锐向中路合拢，把你"入袋"的兵两侧夹死。
  - 🎲可跑映射：`{kind:flank, value:-25}` —— 被两翼夹击你 −25% 胜率（终章加重）。
- 地煞③「一日聚歼（即刻出局）」
  - 💭想象：坎尼一日歼七万——被完成合围的你兵当回合直接出局，破家多扣 2 血。
  - 🎲可跑映射：`{kind:siege, op:chipMore, value:2}` —— 破家多扣 2 血。
- **aiProfile**：`{aggression:7,lanePref:9,spellEager:6,targetPref:'weak',risk:6,economy:8}`
- **难度**：homeHp 5 / aiTier 6 / loadoutCap 5

---

### 关51 · #4 凯撒 · 阿莱西亚之围（内外双壕）（目标WR 30%）
**主题机制**：内外双壕·围点打援——凯撒同时筑内壕困城、外壕拒援，史上最强工事。这关招牌"双层壕沟"：你大本营前是双层天堑（推进减半 + 守军暴涨），且你任何援兵半道就被外壕截杀。一场"攻不进也救不了"的绞杀。
- 地煞①「内外双壕（双层天堑）」
  - 💭想象：凯撒围维钦托利时筑两圈壕沟——内圈困你、外圈拒你援。你大本营前两格变深壕，他守军在壕内 +18%；你推进每格被减半，像踩进泥沼。
  - 🎲可跑映射：`{kind:siege, op:nearBase, value:18, slots:2}` —— 你大本营前两格他兵 +18% 胜率。
  - 🆕新op：`{kind:defense, op:slope, slots:2, ambush:0, advanceHalve:true}`（复用关46 slope，加 advanceHalve）—— 大本营前 2 格内你兵推进减半（每 2 回合才进 1 格）。语义：双壕 = 反斜面的"减速"变体，把"攻不进"做成结构性迟滞。
- 地煞②「围点打援（半道截杀）」
  - 💭想象：外壕专拒援军——你新部署的援兵刚入场就被截，每深入一格掉一截战力。
  - 🎲可跑映射：`{kind:power, op:deepDecay, perStep:3}` —— 你新部署援兵每深入一格 −3。
- 地煞③「降维钦托利（斩首）」
  - 💭想象：高卢联军主将一降，全线崩溃。打掉你某路主将该路全溃。
  - 🎲可跑映射：`{kind:morale, op:killGeneralRout}` —— 斩你主将该路溃散。
- **aiProfile**：`{aggression:6,lanePref:8,spellEager:7,targetPref:'general',risk:5,economy:9}`（围困型·高经济低 aggression·稳扎稳打）
- **难度**：homeHp 5 / aiTier 6 / loadoutCap 5

---

### 关52 · #3 成吉思汗 · 终章·一代天骄（草原机动·曼古歹）（目标WR 30%）
**主题机制**：终极机动·曼古歹诈退——全游戏最终 Boss。集大成：骑射先手削你、怯薛铁骑全程比你快、曼古歹诈退专杀贪追之敌，并叠加"夜不收"夜袭跳推。一个"快到你永远慢半拍、追也不是守也不是"的天骄。三煞满值联动 = 全局最难。
- 地煞①「曼古歹诈退（草原诱杀·强化）」
  - 💭想象：蒙古轻骑边退边射，假装溃败诱你追击；你一追,他回马合围,那场胜率倒灌给他。专治"见残兵就追"。终章版还会把追进来的你兵直接卷走。
  - 🎲可跑映射：`{kind:odds, op:noUpset}` —— 他占优绝不被爆冷（诈败反咬别贪追）。
  - 🆕新op：`{kind:trap, op:feignFlee, lane:'rng', lureSteps:2, snare:true}`（复用关50 feignFlee，加 snare）—— 某路诈退诱你深入，追过原线的你兵被"回马"卷回库（snare）+ 该次掷命胜率倒给 Boss。语义：终章把诈退升级成"贪追即损兵"的硬惩罚。
- 地煞②「怯薛铁骑（全程提速）」
  - 💭想象：草原机动甲天下，怯薛军永远比你早一步抢线压境。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:1, scope:all}` —— 全军提速。
  - 🆕新op：`{kind:tempo, op:nightCharge, everyTurns:3, value:2, scope:'rng'}` —— 每 3 回合某路夜袭"跳推"2 格（夜不收衔枚突进），且该路你该回合迷雾。语义：把"速度=机动碾压"做成周期性的突然跳脸，制造节奏压迫。
- 地煞③「骑射先手（未战先削）」
  - 💭想象：遭遇前先放箭，你兵未接战已掉一截；高续航人头牌顶在最前。
  - 🎲可跑映射：`{kind:power, op:add, value:9, scope:front}` —— 他每路最前一张 +9（先制削你前排相对劣势·终章加重）。
- **aiProfile**：`{aggression:10,lanePref:8,spellEager:6,targetPref:'weak',risk:8,economy:9}`（aggression:10 全游戏唯一满值·体现"天骄"压迫；economy:9 + aiTier:6 = 全局最强）
- **难度**：homeHp 5 / aiTier 6 / loadoutCap 5
> **终章联动**：①曼古歹诈退让你不敢追 + ②怯薛提速 + 夜袭跳推让你永远慢半拍 + ③骑射先手未战先输 = 进退两难、节奏全失的全局最难 Boss。三煞皆满值，aiTier:6 + aggression:10 收束整个战役。
