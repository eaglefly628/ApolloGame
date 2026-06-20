# 地煞数据形 · Pack 3 · 关 28-38（贡献度反序·中后期·★★★★~★★★★★）

> game design G ｜ 2026-06-20 ｜ owner：把 11 位英雄（关 28-38）的「地煞」从 §九 纯文字升级成**可确定性实装的数据形**。
> 源：`23-hero-codex-52.md` §九（141 地煞源·纯文字+kind）+ §八（关 1-5 数据形模板）；op 词汇借 `20-joker-catalog-150.md` §二天罡。
> 每张地煞 = `{kind, op, value?, scope?, lane?…}`。**花哨文字简化成最接近的确定性 op**（弱版固定值·sim 真机调）。保留 §九 原名 + 简述。
> 难度档：目标玩家胜率 关28≈51% → 关38≈46%（★★★★/★★★★★ 鼓励 2-3 张地煞联动满值——真威力区）。

## 新 op（本 Pack 引入·尽量少）

- `{kind:fog, turns:N}` —— 开战 N 回合迷雾·玩家看不清 Boss 虚实（曼施坦因·阿登奇径 / 古斯塔夫无关·见李靖原型）。
- `{kind:odds, op:fewerStronger, perMissing:N}` —— Boss 兵越少胜率越高（贝利撒留·以寡制众）。
- `{kind:power, op:deepDecay, perStep:N}` —— 玩家推进越深·自己兵战力越低（萨拉丁·诱敌焦土）。
- `{kind:phalanx, perAdj:N, cap:M, adj8:true}` —— 8 邻方阵加成（复用 §八 phalanxAdj8·此处显式记 op 形）。
- `{kind:flank, value:-N}` —— 两翼包抄·玩家每路被夹 −N%（岳飞·拐子马 / 朱可夫·钳形）。
- `{kind:firstStrike, value:+N}` —— 前锋先手 + N% 胜率（复用 §八 sarissa·古斯塔夫·团属轻炮先制）。

> 其余全部复用天罡 op：power add/mul·odds winPct/winFloor/noUpset·morale leaderBuff/killGeneralRout/revenge/noRout·tempo advance/slow/jumpToMid·stamina stamPlus/relay/drain·lane reinforce/forceMigrate/freeDeploy·siege homeHp/chipMore/nearBase·combo adjShare/pair/trips。

---

### 关28 · 岳飞 · 郾城之战（★★★★ · 目标WR ~51%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:4, targetWR:0.51}`
- aiProfile：`{aggression:6, lanePref:6, spellEager:5, targetPref:'strong', risk:4, economy:6}`（铁浮屠连环冲阵·稳中带刚·专吃你最强路）
- 地煞①「砍马腿」`{kind:odds, op:winPct, value:+18, scope:highest}` —— 你战力越高的兵被砍翻胜率反而越大→Boss 对你最强一张 +18%（"越强越被砍"弱版固定值）。
- 地煞②「铁浮屠」`{kind:combo, op:adjShare}` + `{kind:morale, op:noRout}` —— 三骑相连共享最高 P 且濒死不溃（连环·破法=断中间一骑）。
- 地煞③「拐子马」`{kind:flank, value:-12}` —— 两翼轻骑包抄·你每路两侧开战即 −12%（破法=兵靠边贴墙缩受袭面）。
> 联动：①+② 让铁浮屠核心兵叠满（共享 P 后再吃你高战力的 +18% 反制），③ 摊薄你三路—— ★★★★ 三张满值即真威力。

### 关29 · 曼施坦因 · 色当突破（★★★★ · 目标WR ~50.5%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:4, targetWR:0.505}`
- aiProfile：`{aggression:7, lanePref:8, spellEager:6, targetPref:'weak', risk:6, economy:5}`（镰刀收割·集中突破单路再卷两翼·赌侧翼空虚）
- 地煞①「阿登奇径」`{kind:fog, turns:2}` + `{kind:siege, op:nearBase, value:+15, slots:2}` —— 中路两回合迷雾·主力装甲从你判"天险无人"处杀出（雾+贴近本营压制·破法=别空隘口留侦察）。
- 地煞②「镰刀合围」`{kind:flank, value:-15}` —— 突破某路后反包抄·相邻两路 −15%（破法=突破口立刻弃守收线）。
- 地煞③「闪击不停」`{kind:tempo, op:advance, value:+1, scope:onWin}` —— 每打赢一格立即免费再推一格·连锁前冲（简化：胜后该路 +1 推进格·破法=一次硬胜打断连锁）。
> 联动：① 迷雾+② 合围=玩家看不清又被夹·③ 让突破后滚起来——三张是"突破→合围→连锁"一条龙。

### 关30 · 穆罕默德二世 · 君士坦丁堡之围（★★★★ · 目标WR ~50%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:4, targetWR:0.50}`
- aiProfile：`{aggression:8, lanePref:5, spellEager:7, targetPref:'general', risk:5, economy:7}`（巨炮破城+三路车轮·火力消耗流·盯你本营/主将）
- 地煞①「乌尔班巨炮」`{kind:siege, op:chipMore, value:2}` —— 蓄力两回合一击轰本营 −2 血·无视前排（简化为破家多 chip 2 血·破法=两回合内打掉炮位兵）。
- 地煞②「陆上行舟」`{kind:lane, op:freeDeploy, value:1}` —— 凭空在你后方空格生一队兵·绕过防线（简化：Boss 每回合免费多铺 1·破法=后排留预备队堵）。
- 地煞③「车轮围攻」`{kind:stamina, op:drain, value:1, enemy:true}` + `{kind:odds, op:winPct, value:+15, scope:all}` —— 三路同时压·你挡一波他补一波耗你续航（你全军每回合续航 −1 + Boss 全军 +15%·破法=集中守一路弃次路保体力）。
> 联动：①破家威胁逼你回防 → ②③ 趁你回防铺兵+耗续航。homeHp 仍 4 但 chipMore 2 → 实质攻坚更狠。

### 关31 · 阿提拉 · 沙隆之战（★★★★ · 目标WR ~49.5%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:4, targetWR:0.495}`
- aiProfile：`{aggression:9, lanePref:7, spellEager:5, targetPref:'weak', risk:8, economy:5}`（上帝之鞭·全军高机动·环射放风筝·猛冲薄弱路）
- 地煞①「上帝之鞭」`{kind:tempo, op:advance, value:+1, scope:all}` + `{kind:lane, op:forceMigrate}` —— 全军推进翻倍·踏过格留劫掠（简化：全军 +1 推进 + 每回合强制迁你一路一兵打乱阵型·破法=守路口不让骑兵入纵深）。
- 地煞②「万骑环射」`{kind:odds, op:winPct, value:+16, scope:front}` —— 不接阵直接对你一路最前三格各掷命（简化：对你前锋 +16%·破法=别收成密集前排团块）。
- 地煞③「来去如风」`{kind:tempo, op:slow, value:-30, scope:all, enemy:true}` —— 兵后撤再扑·永远在你够不到处掷命（简化：你全军 −30% 速·够不到他·破法=用骑兵/远程拉平射程）。
> 联动：①推进+③拖你速=巨大节奏差·②收割前锋。三张全冲机动——这关考验玩家"压制速度"而非硬战力。

### 关32 · 贝利撒留 · 达拉之战（★★★★ · 目标WR ~49%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:4, targetWR:0.49}`
- aiProfile：`{aggression:4, lanePref:6, spellEager:6, targetPref:'strong', risk:3, economy:8}`（掘壕设伏·以寡胜众·防守反击·少兵高质）
- 地煞①「掘壕拒马」`{kind:tempo, op:slow, value:-40, scope:lane, enemy:true}` —— 你推进入他方区即减速·寸步难行（你入侵一路 −40% 速·破法=高推进精兵硬趟）。
- 地煞②「两翼伏骑」`{kind:power, op:add, value:-7, scope:front, enemy:true}` —— 你前锋一接战即遭侧击战力骤降（你接战前锋 −7 战力·破法=集中一路压制侧翼）。
- 地煞③「以寡制众」`{kind:odds, op:fewerStronger, perMissing:4}` —— Boss 兵越少全军胜率越高（每比满编少 1 兵→Boss +4%·破法=别铺太多兵·以势压·围而不歼）。
> 联动：①拖速+②削前锋让你打不进·③把贝利撒留少兵劣势反转成优势——反击型 ★★★★·targetWR 压到 0.49。

### 关33 · 隆美尔 · 加查拉之战（★★★★ · 目标WR ~48.5%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:4, targetWR:0.485}`
- aiProfile：`{aggression:8, lanePref:9, spellEager:6, targetPref:'weak', risk:8, economy:6}`（大胆迂回·装甲横移·诈败诱杀·推进越深越快）
- 地煞①「装甲迂回」`{kind:lane, op:forceMigrate}` —— 主力一路本回合横移到另一路·出其不意（每回合迁己方主力一兵换路·破法=处处留防别赌主攻路）。
- 地煞②「反斜诱杀」`{kind:odds, op:winPct, value:+20, scope:near}` —— 诈败后撤·你追兵入他区遭伏战力大减（简化：你贴近他后撤格那路·Boss +20%·破法=他后撤别追稳守）。
- 地煞③「长驱补给」`{kind:tempo, op:advance, value:+1, scope:deep}` —— 推进越深全军推进速越快（简化：已过中线的兵再 +1 推进·破法=首回合便顶死不让立足）。
> 联动：①横移制造错位 → 你被迫追 → ②伏击 → ③滚雪球深推。隆美尔是"机动迂回满配"——三张全 tempo/lane/odds。

### 关34 · 朱可夫 · 斯大林格勒（★★★★ · 目标WR ~48%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:4, targetWR:0.48}`
- aiProfile：`{aggression:7, lanePref:8, spellEager:6, targetPref:'weak', risk:5, economy:8}`（天王星反包围·钳形合围·专打薄弱路·瓮中聚歼·稳厚经济）
- 地煞①「钳形合围」`{kind:flank, value:-16}` —— 左右两路绕中线向你后包抄夹击（你被夹路 −16%·破法=厚守两翼逼其正面）。
- 地煞②「攻其薄弱」`{kind:tempo, op:advance, value:+1, scope:lane}` + `{kind:odds, op:winPct, value:+15, scope:weakLane}` —— 专挑你最弱一路猛攻·推进翻倍（你最弱路 Boss +15% 且 +1 推进·破法=三路均摊无明显弱路）。
- 地煞③「瓮中聚歼」`{kind:stamina, op:drain, value:1, scope:flanked, enemy:true}` —— 被两路夹住的你兵无法推进·续航急耗（被夹兵每回合 −1 续航·破法=别让兵被夹·留退路）。
> 联动：①钳形造夹 → ③对被夹兵抽续航·②同时碾你最弱路。三张围绕"夹击 + 弱路打击"——合围流满配。

### 关35 · 李世民 · 虎牢关之战（★★★★ · 目标WR ~47.5%）
- 难度：`{homeHp:4, loadoutCap:4, aiTier:4, targetWR:0.475}`
- aiProfile：`{aggression:6, lanePref:7, spellEager:7, targetPref:'general', risk:6, economy:7}`（以逸待劳·蓄力翻倍·玄甲突阵直取后排·一举双擒压两路）
- 地煞①「以逸待劳」`{kind:power, op:mul, value:1.5, scope:all, after:chargeTurn}` —— 敌先动回合按兵蓄力·之后全军战力翻倍（简化：第 2 回合起 Boss 全军 ×1.5 战力·破法=速攻别陪他耗满）。
- 地煞②「玄甲突阵」`{kind:lane, op:freeDeploy, value:1, scope:rear}` + `{kind:siege, op:nearBase, value:+15, slots:1}` —— 主将率精骑无视前排径取后排/本营（简化：Boss 主将可现身你后排格 + 贴本营 +15%·破法=后排与本营间布重兵）。
- 地煞③「一举双擒」`{kind:morale, op:killGeneralRout}` —— 一回合击溃你两路前锋·你弃一张手牌（简化为擒主将即该路全溃·破法=别让两路同时陷劣势）。
> 联动：①给全军 ×1.5 是核心爆发·②③ 斩首向。蓄力是明牌教学点（速攻打断）——但满值 ×1.5 极猛·targetWR 0.475。

### 关36 · 霍去病 · 漠北之战（★★★★★ · 目标WR ~47%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:5, targetWR:0.47}`
- aiProfile：`{aggression:10, lanePref:8, spellEager:6, targetPref:'weak', risk:9, economy:6}`（封狼居胥·长途奔袭连推·因粮于敌越战越强·极限突击）
- 地煞①「长途奔袭」`{kind:tempo, op:advance, value:+2, scope:gap}` —— 骑兵越空格连推两格·长驱直入（简化：遇空格的兵 +2 推进·破法=层层设兵不给连推空当）。
- 地煞②「因粮于敌」`{kind:stamina, op:relay}` + `{kind:power, op:add, value:+6, scope:onKill}` —— 每击溃一敌即回满续航·越战越强（简化：Boss 击溃你一兵→该路接棒满续航 + 全军 +6 战力·破法=避免送兵·坚壁清野）。
- 地煞③「封狼居胥」`{kind:siege, op:homeHp, value:5}` + `{kind:power, op:add, value:+5, scope:all, after:breach}` —— 一路推穿到底·永久 +全军战力且挫你士气（简化：Boss 本营 5 血 + 一旦破你本营则全军永久 +5·破法=必须守住不让其建功）。
> ★★★★★ 联动：①奔袭推进 → ②滚雪球战力/续航 → ③破家后永久 +5 终结。三张满值=真威力区·homeHp 5·targetWR 0.47。

### 关37 · 古斯塔夫二世 · 布莱滕费尔德（★★★★★ · 目标WR ~46.5%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:5, targetWR:0.465}`
- aiProfile：`{aggression:7, lanePref:6, spellEager:8, targetPref:'strong', risk:5, economy:8}`（诸兵种协同·团属轻炮先制·线列轮射火力不停·近代战法满配）
- 地煞①「团属轻炮」`{kind:firstStrike, value:+12}` + `{kind:power, op:add, value:-6, scope:front, enemy:true}` —— 每路开火先制·接敌前先削你前锋（先手 +12% + 你前锋 −6 战力·破法=高续航厚兵扛过头轮炮）。
- 地煞②「诸兵协同」`{kind:combo, op:adjShare}` + `{kind:odds, op:winPct, value:+16, scope:lane}` —— 同路兵将法皆备则该路胜率大涨（同路相邻共享 P + 该路 +16%·破法=点杀其将/兵破搭配）。
- 地煞③「线列轮射」`{kind:stamina, op:relay}` —— 前锋掷命后退队尾·后排即补射火力不停（阵亡接棒不留空格·破法=抢轮射换位的空隙）。
> ★★★★★ 联动：①先制削你 → ②协同路堆 P → ③轮射续航无尽。古斯塔夫="诸兵种协同"满配·三张全火力/续航·targetWR 0.465。

### 关38 · 萨拉丁 · 哈丁之战（★★★★★ · 目标WR ~46%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:5, targetWR:0.46}`
- aiProfile：`{aggression:6, lanePref:7, spellEager:7, targetPref:'strong', risk:4, economy:9}`（断水围歼·焦土诱敌·哈丁两翼合围·耐心消耗·顶级经济）
- 地煞①「断敌水源」`{kind:stamina, op:drain, value:1, scope:all, enemy:true}` —— 你全军续航每回合多耗 1·渴战速衰（破法=低续航杂兵换血·速战）。
- 地煞②「诱敌焦土」`{kind:power, op:deepDecay, perStep:3}` —— 你推进越深你兵战力越低（每深推 1 格 −3 战力·破法=别贪进·中线决战）。
- 地煞③「哈丁合围」`{kind:combo, op:adjShare}` + `{kind:power, op:mul, value:1.5, scope:lane}` —— 两翼之兵向中路合拢夹击战力大增（中路相邻共享 P + ×1.5·破法=别挤中路·分散三路）。
> ★★★★★ 终关联动：①抽你续航逼你速决 → 但②深推就掉战力（两难）→ ③中路合围 ×1.5 收割。萨拉丁=消耗+合围双绞索·全 Pack 最难·targetWR 0.46。
