# 想象力地煞 · 批B · 关25-38（design G 2026-06-21·先想象后落地）
> 每关一个招牌机制·让玩家像面对新游戏。每条地煞给①想象版②sim可跑映射③需要的新op。
---

> 设计原则：**整关有一个"主题机制"**——这一关的世界规则被某位名将的招牌战术改写了。三张地煞中至少一张是该关的「灵魂」（决定打法），另两张围着它配。
> 🎲映射尽量用现有/已派甲词汇（`extraAction/freeze/intimidate/fog/withdrawRefundMul` 已规划，见 disha-op-vocab-v2）；真表达不了才发明新 op，已用 🆕 标注并写语义。

---

### 关25 · #31 古德里安 · 色当突破 / 闪电战（目标WR 44%）
**主题机制**：**节奏战争**——这关时间是敌人的盟友。古德里安的兵不"一步一步走"，他们成"楔子"般凿穿，越打越快；你必须在他提速失控前合龙，否则三日内被推到大西洋。
- 地煞①「闪电突破 Sichelschnitt」
  - 💭想象：每当古德里安在任一路赢下一次掷命对决，那一路本回合该兵**连续再推进一格**（"装甲不停顿"），并对下一格触发二次掷命——一次胜利可能凿穿两层防线。势头一旦起来，玩家一回合内可能被连破两道。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:1, scope:lane}` + `{kind:winStreak, per:2, cap:8}`（每胜叠 +2%、封顶 8，模拟"越凿越快"的势头）
  - 🆕新op（若需）：`{kind:tempo, op:breakthrough, onWin:true, value:1}` —— Boss 单兵在某路赢对决后，**同回合立即额外推进 value 格**（不消耗动作），最多连推到下一次对决。语义=「胜则不停顿」。
- 地煞②「装甲洪流 Panzerkeil」
  - 💭想象：坦克集结成楔形，相邻战车互为掩护装甲——队形越密，每一辆都更难被击穿。
  - 🎲可跑映射：`{kind:phalanx, perAdj:2, cap:6, adj8:false}`
- 地煞③「Achtung Panzer 急行军」
  - 💭想象：开局即倾泻——古德里安第一回合就把装甲群压上，不给你布防时间。
  - 🎲可跑映射：`{kind:bonusMana, value:1}`（前期源泉碾压、提前展开）
- **aiProfile**：`{aggression:9,lanePref:0,spellEager:4,targetPref:'weak',risk:7,economy:5}`（专挑薄弱路凿穿、单点突破）
- **难度**：homeHp 3 / aiTier 3 / loadoutCap 4

---

### 关26 · #30 关羽 · 襄樊之战（水淹七军·威震华夏）（目标WR 43%）
**主题机制**：**洪水地形**——整张棋盘被汉水淹没。越往敌方城堡推进，水越深，你的兵越往里走越被洪流没顶、战力衰减；而关羽的水军在水里如鱼得水。这关是"逆水行舟"的攻坚关。
- 地煞①「水淹七军」
  - 💭想象：敌阵后半段成为深水区。玩家每往前推进一格，该兵战力逐层下降（被水没膝→没腰→没顶）；推到最深处的兵几乎成废牌。逼玩家"速攻浅水带、不敢深入"。
  - 🎲可跑映射：`{kind:power, op:deepDecay, perStep:2}`（敌推进每格 −2 战力）
- 地煞②「舟师围樊」
  - 💭想象：关羽乘大水以艨艟围城，城堡前两格是"水寨"，谁攻城都要先过水军这关——守家加成奇高。
  - 🎲可跑映射：`{kind:siege, op:nearBase, value:+3, slots:2}`
- 地煞③「威震华夏」
  - 💭想象：声威震动中原、曹操几欲迁都；关羽军气势压顶，濒死不溃、血战到底。
  - 🎲可跑映射：`{kind:morale, op:noRout}`
- **aiProfile**：`{aggression:5,lanePref:0,spellEager:5,targetPref:'general',risk:4,economy:5}`（守反一体、诱你深入水区）
- **难度**：homeHp 4 / aiTier 3 / loadoutCap 4

---

### 关27 · #29 查理曼 · 萨克森战争 / 冬季远征（目标WR 42%）
**主题机制**：**冬季消耗战**——查理曼"震慑式"长征三十年，靠的不是单战巧胜而是绝对体量与不知疲倦。这关比的是"谁先扛不住"：寒冬榨干你的续航，他的重骑兵却越冬不停。
- 地煞①「萨克森三十年征伐」
  - 💭想象：连胜叠益、戎马不息——每攻克一阵，全军愈强，封顶高，体现"持久压倒"。
  - 🎲可跑映射：`{kind:winStreak, per:1, cap:4}`
- 地煞②「严冬围困」
  - 💭想象：冬季与洪水困住玩家的补给。每回合榨干玩家一点"续航/耐力"，玩家若不速决便被慢慢耗死——逼玩家在体力归零前打出爆发。
  - 🎲可跑映射：`{kind:stamina, op:drain, value:2, enemy:true}`（每回合削玩家耐力 2）
- 地煞③「卡洛林重骑兵」
  - 💭想象：以重装骑兵为战略机动核心，铁蹄触敌即先手凿阵。
  - 🎲可跑映射：`{kind:firstStrike, value:+3}`
- **aiProfile**：`{aggression:6,lanePref:0,spellEager:4,targetPref:'general',risk:4,economy:6}`（稳扎稳打、拖死你）
- **难度**：homeHp 4 / aiTier 3 / loadoutCap 4

---

### 关28 · #28 霍去病 · 漠北之战（封狼居胥·长途奔袭）（目标WR 41%）
**主题机制**：**闪袭速度战**——霍去病轻骑长驱二千里，不与你拼阵地，比的是"谁先冲到家门口"。整关节奏被压到极快：全线提速 + 连胜滚雪球，慢一拍就被封狼居胥。
- 地煞①「长途奔袭」
  - 💭想象：全线骑兵疾进如风，所有兵每回合多走一格——战线压缩、对决提前爆发，玩家几乎没有布防回合。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:1, scope:all}`
- 地煞②「封狼居胥」
  - 💭想象：连战连捷势如破竹，每胜一阵叠加增益、封顶 3，体现"一鼓作气直捣王庭"。
  - 🎲可跑映射：`{kind:winStreak, per:1, cap:3}`
- 地煞③「因粮于敌」
  - 💭想象：就食敌境、断敌辎重——每回合削玩家耐力，逼玩家在续航见底前速战。
  - 🎲可跑映射：`{kind:stamina, op:drain, value:2, enemy:true}`
- **aiProfile**：`{aggression:9,lanePref:1,spellEager:3,targetPref:'weak',risk:8,economy:4}`（极致进攻、奔袭薄弱路）
- **难度**：homeHp 3 / aiTier 4 / loadoutCap 4

---

### 关29 · #27 艾森豪威尔 · 诺曼底登陆（D-Day）（目标WR 40%）
**主题机制**：**大兵团登陆**——这关你面对的不是巧战而是"压倒性投送"。盟军一次性把整路滩头堆满兵，人工港在你岸前开出攻坚跳板。这是"挡海啸"关：单点扛不住，得提前分散布防。
- 地煞①「霸王行动·诺曼底浪潮」
  - 💭想象：每隔几回合，艾森豪威尔向一路一次性投送一大批增援（登陆波次），那一路瞬间被填满、压垮。玩家要预判下一波登陆在哪路。
  - 🎲可跑映射：`{kind:lane, op:reinforce, value:2}`（单路免费补 2 兵）
  - 🆕新op（若需）：`{kind:lane, op:waveReinforce, value:2, everyTurns:3}` —— 每 everyTurns 回合，向**当前最薄弱的一路**免费补 value 兵（周期化登陆波次，仿 battery 节律）。语义=「持续登陆潮」。
- 地煞②「桑橙人工港」
  - 💭想象：拖来人工港稳固登陆场，在玩家岸前开出两个攻坚位、近城堡加成——把"攻城跳板"前移到你家门口。
  - 🎲可跑映射：`{kind:siege, op:nearBase, value:+3, slots:2}`
- 地煞③「最高统帅部」
  - 💭想象：总揽英美法盟军、合众心为一，统帅光环全军受益。
  - 🎲可跑映射：`{kind:morale, op:leaderBuff, value:1}`
- **aiProfile**：`{aggression:7,lanePref:0,spellEager:5,targetPref:'weak',risk:5,economy:7}`（堆量、找你最空的路砸）
- **难度**：homeHp 4 / aiTier 3 / loadoutCap 5

---

### 关30 · #26 武田信玄 · 川中岛之战（风林火山·啄木鸟）（目标WR 40%）
**主题机制**：**风林火山·分兵合击**——这关是"四态切换"关：武田军按回合在「疾如风/徐如林/侵掠如火/不动如山」之间轮转，每态改写战场规则，玩家永远在猜"这回合他是哪一态"。
- 地煞①「风林火山·四态轮转」
  - 💭想象：每回合 Boss 进入一态——**风**(全线提速)→**林**(隐形·你看不清布署)→**火**(近战暴击 +战力)→**山**(濒死不溃·守如磐石)，循环往复。一关之内你像在打四个不同对手。
  - 🎲可跑映射：拆成可跑的相位三件套即可（无需真做相位机）：`{kind:tempo, op:advance, value:1, scope:near}`(火/风) + `{kind:morale, op:noRout}`(山)。林相用地煞②的 fog 表达。
  - 🆕新op（若需）：`{kind:phase, op:cycle, list:['advance','fog','nearBuff','noRout'], period:1}` —— 每 period 回合切换到 list 下一相，仅激活该相对应的一个子效果（确定性轮转）。语义=「招牌相位机·让一关有四副面孔」。
- 地煞②「林·啄木鸟夜袭」
  - 💭想象：啄木鸟战术分兵迂回、夜色掩护——前几回合玩家看不清武田的部署（牌面盖暗），合击突然降临。
  - 🎲可跑映射：`{kind:fog, turns:3}`
- 地煞③「火·侵掠如火」
  - 💭想象：甲斐铁骑近身猛攻，近战段胜率陡增。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:+10, scope:near}`
- **aiProfile**：`{aggression:7,lanePref:0,spellEager:6,targetPref:'general',risk:6,economy:5}`（多变·相位驱动）
- **难度**：homeHp 4 / aiTier 4 / loadoutCap 4

---

### 关31 · #25 巴顿 · 突出部战役 / 西西里（目标WR 39%）
**主题机制**：**九十度急转·永远进攻**——巴顿的招牌是"在不可能的时间把整个集团军掉头扑向新方向"。这关 Boss 能**临时改变主攻路**：你刚在右路堆好墙，他三日急转全压左路。玩家无法靠固定布防，必须能机动应变。
- 地煞①「装甲急转 90°」
  - 💭想象：每隔几回合，巴顿把主攻方向整体平移一路——上回合压你 A 路的兵威，这回合突然平移到 B 路（"急行军换轴"）。配合全线提速，玩家防线总慢半拍。
  - 🎲可跑映射：`{kind:tempo, op:advance, value:1, scope:all}` + `{kind:odds, op:winPct, value:+8, scope:all}`（永远进攻·全军压制）
  - 🆕新op（若需）：`{kind:lane, op:pivotFocus, everyTurns:3}` —— 每 everyTurns 回合，把 Boss 的"主攻路"标记轮转到下一路；主攻路上的兵获 +winPct（集中），其余路减半投入。语义=「招牌换轴·破固定布防」。
- 地煞②「永远进攻」
  - 💭想象：嗜攻好战、势如破竹不予敌喘息，全军持续压制 +8%。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:+8, scope:all}`（与①共享，可二选一落地以免过强）
- 地煞③「铁胆解围」
  - 💭想象：冒严寒疾驰解巴斯托涅之困、亲临鼓士，主将带阵 +6。
  - 🎲可跑映射：`{kind:morale, op:leaderBuff, value:6}`
- **aiProfile**：`{aggression:9,lanePref:2,spellEager:4,targetPref:'weak',risk:7,economy:5}`（换轴打弱·机动猛攻）
- **难度**：homeHp 3 / aiTier 4 / loadoutCap 4

---

### 关32 · #24 纳尔逊 · 特拉法加海战（穿插T字·凿阵）（目标WR 38%）
**主题机制**：**穿插切割·分段围歼**——纳尔逊不沿战线平推，而是用两路纵队**垂直凿入你的阵列**，把你的兵切成孤段逐一吃掉。这关惩罚"排成一条直线"的布防——你越像传统阵列，越被拦腰切断。
- 地煞①「两路凿阵 / 穿插T字」
  - 💭想象：Boss 的前锋"垂直插入"——赢下前锋对决时，不仅推进，还**让你该路被插开的后续两兵之间断链**（脱离相邻增益），制造孤立段落便于逐个围歼。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:+12, scope:front}`（前锋凿阵 +12%）
  - 🆕新op（若需）：`{kind:control, op:sever, onFrontWin:true}` —— Boss 赢下前锋对决时，**取消玩家该路相邻兵的 phalanx/邻接增益本回合**（"切断你的阵列连结"）。语义=「凿穿即断链·惩罚直线阵」。
- 地煞②「连环歼敌」
  - 💭想象：切割后逐舰围歼、越打越占上风，每胜叠益、封顶高。
  - 🎲可跑映射：`{kind:winStreak, per:4, cap:20}`
- 地煞③「人人尽责」
  - 💭想象：「英格兰期望人人恪尽其责」旗语激励全军，主将带阵 +6。
  - 🎲可跑映射：`{kind:morale, op:leaderBuff, value:6}`
- **aiProfile**：`{aggression:8,lanePref:0,spellEager:5,targetPref:'strong',risk:6,economy:5}`（专凿你最厚的阵列）
- **难度**：homeHp 4 / aiTier 4 / loadoutCap 4

---

### 关33 · #23 白起 · 长平之战（断粮坑杀·合围）（目标WR 38%）
**主题机制**：**口袋合围·诱敌深入**——白起的招牌是"佯败让你冲进来，奇兵断你后路，四十六日围成死袋"。这关**鼓励你进攻，然后惩罚你进攻**：你推得越深、越被夹绝、越回不了头。是一关"陷阱地形"。
- 地煞①「诱敌断粮」
  - 💭想象：白起佯败诱你深入，随即断你粮道——玩家的兵推进后**隔回合才能再动一次**（补给被切、行动迟滞），仿佛陷入泥潭。
  - 🎲可跑映射：`{kind:tempo, op:slow, enemy:true}`（敌隔回合才推进）
- 地煞②「合围尽歼」
  - 💭想象：围而愈紧——白起军相邻越密、每兵愈强，把你的突入兵团包成铁桶。
  - 🎲可跑映射：`{kind:phalanx, perAdj:6, cap:24, adj8:true}`
- 地煞③「深入愈死（坑杀）」
  - 💭想象：纵你深入合围之地，越深越被夹绝——推进越远战力衰减越狠，深处的兵成"坑中之卒"。
  - 🎲可跑映射：`{kind:power, op:deepDecay, perStep:2}`
- **aiProfile**：`{aggression:4,lanePref:0,spellEager:6,targetPref:'general',risk:3,economy:6}`（诱敌·后发制人·围歼）
- **难度**：homeHp 5 / aiTier 4 / loadoutCap 4

---

### 关34 · #22 华盛顿 · 特伦顿奇袭 / 约克镇（目标WR 37%）
**主题机制**：**风雪夜渡·屡败屡战**——华盛顿的招牌是"在最不可能的夜里渡河突袭斩首"，以及"屡北而军不散、以拖待变"。这关是"斩首突袭 + 韧性消耗"双面：他偶尔一击致命（直取你主将），但更靠拖到你崩。
- 地煞①「渡河奇袭（斩首）」
  - 💭想象：每隔几回合，华盛顿趁夜发动一次奇袭——**直接吓退/打回玩家某路前锋一张**（特伦顿晨袭、毙敌主将），制造一个缺口让他长驱。
  - 🎲可跑映射：`{kind:control, op:intimidate, everyTurns:4}`（每 4 回合吓退玩家某路前锋 1 张·已派甲规划）+ `{kind:odds, op:winPct, value:+12, scope:general}`（主将出手 +12%）
- 地煞②「约克镇合围」
  - 💭想象：美法海陆并进围困康沃利斯——守家前两格加成奇高，玩家强攻城堡先撞这堵墙。
  - 🎲可跑映射：`{kind:siege, op:nearBase, value:+15, slots:2}`
- 地煞③「持久不溃」
  - 💭想象：屡北而军不散、以拖待变终成大局，濒死不溃。
  - 🎲可跑映射：`{kind:morale, op:noRout}`
- **aiProfile**：`{aggression:6,lanePref:0,spellEager:6,targetPref:'general',risk:5,economy:5}`（偷家斩首 + 拖耗）
- **难度**：homeHp 4 / aiTier 4 / loadoutCap 4

---

### 关35 · #21 曼施坦因 · 镰刀闪击 / 哈尔科夫反手（目标WR 37%）
**主题机制**：**迷雾奇袭·后发反手**——曼施坦因双绝：阿登迷雾里藏装甲主力（你看不见他从哪打来），以及哈尔科夫"等你深入师老兵疲再骤然侧击"。这关惩罚"看不清就乱压"和"压过头"——你越激进，他反手越狠。
- 地煞①「阿登迷雾」
  - 💭想象：装甲主力穿越世人视为天险的阿登迷雾峡径——前几回合玩家完全看不清 Boss 部署（牌面盖暗·镰刀从你想不到的路凿出）。
  - 🎲可跑映射：`{kind:fog, turns:3}`
- 地煞②「反手一击（哈尔科夫）」
  - 💭想象：待你深入师老兵疲，骤以装甲侧击——玩家越是压制 Boss，Boss 被压后反扑越猛（revenge 高值）。是"诱你过度进攻"的陷阱。
  - 🎲可跑映射：`{kind:morale, op:revenge, value:8}`
- 地煞③「镰刀凿穿」
  - 💭想象：集中装甲于一点凿穿、直插海峡断敌后路，前锋胜率陡增 +12%。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:+12, scope:front}`
- **aiProfile**：`{aggression:5,lanePref:1,spellEager:6,targetPref:'strong',risk:7,economy:5}`（藏锋·诱你过线·反手）
- **难度**：homeHp 4 / aiTier 5 / loadoutCap 4

---

### 关36 · #20 阿提拉 · 沙隆战役（上帝之鞭·佯退劫掠）（目标WR 36%）
**主题机制**：**佯退反咬·恐怖劫掠**——阿提拉的招牌是"假装溃逃诱你追击，待你脱阵疲惫再回身屠戮"，以及"上帝之鞭"的恐怖压迫和劫掠经济。这关是"陷阱 + 心理战"：你看到他撤退别贪追，否则被反咬。
- 地煞①「佯退反咬」
  - 💭想象：阿提拉的兵在前锋对决落败时**不溃散而是诈退回库**，但若玩家本回合贪进追击，下回合他骤然回身、对追击的兵反扑暴击。引诱玩家过度展开。
  - 🎲可跑映射：`{kind:morale, op:revenge, value:6}` + `{kind:odds, op:winPct, value:+10, scope:near}`（回身近战暴击）
  - 🆕新op（若需）：`{kind:control, op:feignRetreat, value:1}` —— Boss 前锋落败时**有控制地退回库**（不计入溃败），下回合重新部署到同路并对该格玩家兵 +winPct（"回马枪"）。语义=「招牌佯退·把战败变陷阱」。
- 地煞②「上帝之鞭」
  - 💭想象：大单于亲冲、所过残破——主将出手所在路胜率 +10%，且令玩家该路前锋"恐惧吓退"。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:+10, scope:general}` + `{kind:control, op:intimidate, everyTurns:5}`（恐怖吓退·已派甲规划）
- 地煞③「劫掠回血」
  - 💭想象：匈人劫掠为生——每次破坏/胜阵 Boss 反哺源泉（以战养战），经济滚雪球。
  - 🎲可跑映射：`{kind:economy, op:withdrawRefundMul, value:2}`（胜者回库返还 ×2·已派甲规划，模拟"劫掠返泉"）
- **aiProfile**：`{aggression:8,lanePref:1,spellEager:5,targetPref:'weak',risk:8,economy:6}`（诱敌·恐吓·掠夺经济）
- **难度**：homeHp 4 / aiTier 5 / loadoutCap 5

---

### 关37 · #19 李舜臣 · 鸣梁海战（龟船·鹤翼·窄海峡急流）（目标WR 36%）
**主题机制**：**窄海峡急流地形**——这关最特殊：战场被压成一条**窄峡**，急流每隔几回合改向。李舜臣以十二船破三百三十——他靠地形把你的数量优势变成劣势。是一关"地形即对手"的关。
- 地煞①「鸣梁急流·窄峡」
  - 💭想象：鸣梁海峡仅 294 米宽、潮流每三时辰改向一次。**只有中路可用**（两翼被礁石/急流封死），玩家所有兵被挤进一条线鱼贯而入，正撞李舜臣横锁峡口的龟船；且每隔几回合"急流改向"——把玩家某路最前一兵冲回后方一格（涨落潮）。
  - 🎲可跑映射：`{kind:siege, op:nearBase, value:+15, slots:2}`（龟船横锁守家前两格）+ `{kind:control, op:intimidate, everyTurns:3}`（急流改向·把前锋冲退·借 intimidate 表达"被流推回"）
  - 🆕新op（若需）：`{kind:terrain, op:laneLock, lanes:['top','bottom']}` —— 封锁指定路：被锁路双方都**无法部署/推进**，强制全部走中路（地形改写整关棋盘形状）。语义=「窄峡·把 3 路战场压成 1 路」。
- 地煞②「鹤翼合围」
  - 💭想象：半月鹤翼阵将敌诱入开阔处合拢围歼——己舰相邻越密、每舰加成极高（窄峡里龟船首尾相援）。
  - 🎲可跑映射：`{kind:phalanx, perAdj:6, cap:24, adj8:true}`
- 地煞③「十三舟死战」
  - 💭想象：「尚有十二艘战船」，舟越少越死战——缺额越多全军愈强（以寡敌众的信念）。
  - 🎲可跑映射：`{kind:odds, op:fewerStronger, perMissing:3}`
- **aiProfile**：`{aggression:4,lanePref:0,spellEager:6,targetPref:'general',risk:3,economy:5}`（守峡·诱合围·死战）
- **难度**：homeHp 5 / aiTier 5 / loadoutCap 4

---

### 关38 · #18 奥古斯都 · 亚克兴海战（轻舰凿阵·封锁）（目标WR 35·章节压轴）
**主题机制**：**封锁困死·元首之治**——阿格里帕封锁亚克兴海口把安东尼困死湾内。这关 Boss **冻结你的节奏**：海上封锁让你隔回合才能动，他却调度从容、源泉滚滚。是"被锁喉慢慢闷死"的压轴关。
- 地煞①「海上封锁」
  - 💭想象：封锁亚克兴海口、困敌于湾——玩家**每隔几回合被冻掉一个动作**（四选一变三选一甚至跳过），如同被堵在港内动弹不得，而 Boss 趁势凿阵。
  - 🎲可跑映射：`{kind:tempo, op:slow, enemy:true}`（敌隔回合才推进）+ `{kind:control, op:freeze, everyTurns:3}`（每 3 回合冻玩家 1 类动作·已派甲规划）
- 地煞②「轻舰凿阵」
  - 💭想象：阿格里帕以轻捷之舰垂直切割安东尼巨舰阵——前锋胜率 +10%，机动凿穿你的重阵。
  - 🎲可跑映射：`{kind:odds, op:winPct, value:+10, scope:front}`
- 地煞③「元首之治」
  - 💭想象：独揽全权、海内承平调度从容——Boss 每回合多 1 源泉，且可"一回合做两件事"（封锁你的同时自己加倍展开），元首的从容碾压。
  - 🎲可跑映射：`{kind:bonusMana, value:1}` + `{kind:action, op:extraAction, value:1}`（Boss 每回合多 1 类动作·已派甲规划——把"封锁你/解放己"对照拉满，章节压轴的标志性碾压）
- **aiProfile**：`{aggression:6,lanePref:0,spellEager:7,targetPref:'strong',risk:5,economy:8}`（封锁 + 经济碾压·从容凿阵）
- **难度**：homeHp 5 / aiTier 5 / loadoutCap 5

---

## 📋 本批新发明 op 汇总（🆕·供 Lead 评审 / 派甲）
> 评审尺子（CORE RULE）：能用现有词汇重组表达的，优先回驳用🎲映射；下列是"真表达不了招牌感"才发明的。每条都附了可跑的🎲降级方案，**不阻塞 sim**。

| 新op | 语义 | 是否真缺口 / 可否降级 |
|---|---|---|
| `tempo.breakthrough` (关25古德里安) | 胜则同回合额外推进、不停顿凿穿 | 半缺口·可降级为 advance+winStreak；真做才有"连破两道"招牌感 |
| `lane.waveReinforce` (关29艾森) | 周期向最弱路投送增援波次 | 可降级为静态 reinforce；周期化=登陆潮的灵魂 |
| `phase.cycle` (关30武田) | 招牌相位机·一关四副面孔轮转 | **重点候选**·最能实现"每关像新游戏"·建议优先评估（可复用到其他多面 Boss） |
| `lane.pivotFocus` (关31巴顿) | 周期轮换主攻路、破固定布防 | 半缺口·可降级为 advance+winPct(all)；真做才有"九十度急转"招牌感 |
| `control.sever` (关32纳尔逊) | 凿穿即切断玩家阵列邻接增益 | 缺口·惩罚直线阵；可降级为纯 front winPct（丢失"切割"感） |
| `control.feignRetreat` (关36阿提拉) | 佯退诱追、回马枪反扑 | 缺口·把"战败"变陷阱；可降级为 revenge+near winPct |
| `terrain.laneLock` (关37李舜臣) | 封锁路·把 3 路战场压成 1 路 | **重点候选**·最强地形改写·"窄海峡"灵魂·可复用为通用地形 op |

**已规划/派甲 op（本批直接当现有用）**：`freeze` `intimidate` `fog` `withdrawRefundMul` `extraAction`（见 disha-op-vocab-v2）。
**最值得 Lead 先评估的两个通用新 op**：`phase.cycle`（多面 Boss）与 `terrain.laneLock`（地形改写）——它俩复用面最广、最直接服务于"每关像新游戏"的纲领。
