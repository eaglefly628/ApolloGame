# disha-pack 4 · 关 39-52 地煞数据形（终章区 · ★★★★★）

> game design G ｜ 2026-06-20 ｜ 把 §九 纯文字地煞升级成**可确定性实装的数据形**（{kind, op, value?, scope?, lane?}）。
> 上游：`23-hero-codex-52.md` §七（52 战役全表）/ §八（关 1-5 数据形模板）/ §九（141 地煞源·纯文字+kind）；`20-joker-catalog-150.md` §二（天罡 op 词汇）。
> 复用天罡 op 为主，Boss 侧数值更猛。**花哨文字 → 最接近的确定性 op**；保留 §九 原名 + 简述。
> 难度脊（贡献度反序）：关 39≈45% → 关 52 孙武≈40%（终章·全局最强 Boss·数值取上限·体现"兵圣"）。
> 数值档：winPct +18~28 · power add +6~10 · homeHp 4 或 5（终章孙武=5）· 全 ★★★★★·鼓励 2-3 张满值联动。
> aiTier：★★★★★=5；关 50-52=6。aiProfile 0-10·与英雄战术自洽。

## 本批新增 Boss 专属 op（尽量少）
- `{kind:fog, turns:N}` —— 暗兵迷雾，前 N 回合玩家看不清 Boss 真实战力（李靖雪夜衔枚 / 孙武奇正相生）。
- `{kind:odds, op:fewerStronger, perMissing:N}` —— 以寡敌众，Boss 每少一张兵全军 +N% 胜率（白起置死后生·西庇阿无对位时）。
- `{kind:power, op:deepDecay, perStep:N}` —— 诱敌焦土，玩家兵每深入一格 −N 战力（凯撒围点打援 / 居鲁士引诱）。
- `{kind:lane, op:forceMigrate}`、`{kind:fog,...}` 等已在 §八/模板词汇内复用；其余全部复用天罡 op（power/odds/combo/morale/tempo/stamina/lane/siege）。
> 已存在于 disha.ts 的 phalanx/flank/firstStrike/nearBase 等沿用 §八 既有结构，本批未新增。

---

### 关 39 · 李靖 · 阴山之战（★★★★★ · 目标WR ~45%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:5, targetWR:0.45}`
- aiProfile：`{aggression:7, lanePref:6, spellEager:6, targetPref:'weak', risk:6, economy:6}`（大唐军神·雪夜奇袭·快打闪击）
- 地煞①「雪夜衔枚」`{kind:fog, turns:2}` —— 开战三路皆迷雾·前 2 回合你看不清他方真实兵力。
- 地煞②「阴山奇袭」`{kind:lane, op:freeDeploy, value:1}` —— 部署的兵直接现身你方区贴脸突袭（简化为每回合 Boss 多 1 次免费铺兵·抢线压境）。
- 地煞③「一战灭国」`{kind:siege, op:chipMore, value:1}` —— 任一路兵抵你大本营·直接多扣 1 血（破家代价翻倍）。

### 关 40 · 苏沃洛夫 · 雷姆尼克之战（★★★★★ · 目标WR ~45%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:5, targetWR:0.45}`
- aiProfile：`{aggression:9, lanePref:5, spellEager:5, targetPref:'strong', risk:7, economy:5}`（不败统帅·急行奔袭·锐不可当）
- 地煞①「急行奔袭」`{kind:tempo, op:advance, value:1, scope:all}` —— 开局全军额外预推一格·抢先接敌。
- 地煞②「白刃突贯」`{kind:odds, op:firstStrike, value:20}` —— 接敌即冲·首击先手·该次掷命 +20% 胜率（跳过对峙）。
- 地煞③「不败之威」`{kind:morale, op:noRout}` —— 主将在场·全军濒死不溃·续航不减。

### 关 41 · 西庇阿 · 扎马会战（★★★★★ · 目标WR ~45%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:5, targetWR:0.45}`
- aiProfile：`{aggression:6, lanePref:7, spellEager:6, targetPref:'general', risk:5, economy:7}`（征非者·让阵纳象·后发反制）
- 地煞①「让阵纳象」`{kind:tempo, op:slow, scope:lane, enemy:true}` —— 你冲来的兵不被阻挡直穿，但穿过后该路本回合不推进（化为你方该路减速）。
- 地煞②「回身夹歼」`{kind:odds, op:winPct, value:-22, scope:lane}` —— 穿过他阵的你兵下回合遭两侧合击·该路你 −22% 胜率。
- 地煞③「罗马轮替」`{kind:stamina, op:relay}` —— 前锋续航打光即后排顶上·不留空格（接棒续战）。

### 关 42 · 腓特烈大帝 · 洛伊滕会战（★★★★★ · 目标WR ~45%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:5, targetWR:0.44}`
- aiProfile：`{aggression:7, lanePref:9, spellEager:5, targetPref:'weak', risk:7, economy:6}`（军事天才·斜击战术·集中一翼）
- 地煞①「斜击列阵」`{kind:power, op:add, value:9, scope:lane}` —— 选一路全员战力翻倍（化为该路 +9 战力·集中一翼·赌侧翼）。
- 地煞②「卷击侧翼」`{kind:tempo, op:advance, value:1, scope:lane}` —— 最强一路斜插你侧翼·命中 +1 推进格。
- 地煞③「普鲁士操典」`{kind:lane, op:freeDeploy, value:1}` —— 每回合首张部署免召唤源泉（兵海摊薄优势）。

### 关 43 · 速不台 · 赛约河之战（★★★★★ · 目标WR ~44%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:5, targetWR:0.44}`
- aiProfile：`{aggression:8, lanePref:7, spellEager:6, targetPref:'weak', risk:7, economy:6}`（常胜先锋·一夜架桥·奇袭抄后）
- 地煞①「一夜架桥」`{kind:tempo, op:jumpToMid, lane:true}` —— 偷架浮桥·一路兵开局直杀到中线。
- 地煞②「砲清滩头」`{kind:power, op:add, value:8, scope:front}` —— 巨砲先轰你前排·他每路最前一张 +8（开打即占先·体现先制削你前排相对劣势）。
- 地煞③「合围歼灭」`{kind:morale, op:killGeneralRout}` —— 正面佯攻 + 奇兵抄后·一路前后夹死即令该路溃散。

### 关 44 · 帖木儿 · 安卡拉之战（★★★★★ · 目标WR ~44%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:5, targetWR:0.44}`
- aiProfile：`{aggression:8, lanePref:6, spellEager:7, targetPref:'general', risk:6, economy:7}`（跛足征服者·断水策反·生擒苏丹）
- 地煞①「断其水源」`{kind:stamina, op:drain, value:1, enemy:true}` —— 截水源·你全军续航 −1·士气下滑。
- 地煞②「阵前倒戈」`{kind:lane, op:forceMigrate}` —— 策反你一路最前的兵·当场迁去他处（化为强制迁你一兵·阵型大乱）。
- 地煞③「生擒苏丹」`{kind:morale, op:killGeneralRout}` —— 锁定直取你主将·擒下后该路全崩。

### 关 45 · 居鲁士 · 巴比伦之战（★★★★★ · 目标WR ~43%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:5, targetWR:0.43}`
- aiProfile：`{aggression:6, lanePref:8, spellEager:6, targetPref:'weak', risk:5, economy:8}`（万王之王·涸河潜行·不战入城）
- 地煞①「涸河潜行」`{kind:lane, op:freeDeploy, value:1}` —— 兵从干涸河道绕过前排·直现你后排（化为绕前排免费铺兵）。
- 地煞②「引水改道」`{kind:lane, op:forceMigrate}` —— 改一路河道·把你那路兵冲去隔壁·阵型大乱。
- 地煞③「不战入城」`{kind:siege, op:chipMore, value:1}` —— 趁你一路空虚·长驱直入大本营·破家多扣 1 血。

### 关 46 · 哈立德 · 雅穆克之战（★★★★★ · 目标WR ~43%）
- 难度：`{homeHp:4, loadoutCap:5, aiTier:5, targetWR:0.43}`
- aiProfile：`{aggression:9, lanePref:7, spellEager:6, targetPref:'strong', risk:8, economy:6}`（真主之剑·机动预备队·六日鏖战）
- 地煞①「机动近卫」`{kind:lane, op:reinforce, value:2}` —— 留精骑预备队·每回合补到你打最凶的一路（化为指定一路免费增援 2 兵）。
- 地煞②「六日鏖战」`{kind:morale, op:leaderBuff, value:5}` —— 每多打一回合·全军战力再涨一截（化为持久战光环 +5·拖越久越强）。
- 地煞③「侧翼决荡」`{kind:flank, value:-20}` —— 预备骑兵一记重击·撕开你一路侧翼·被夹你 −20% 胜率。

### 关 47 · 白起 · 长平之战（★★★★★ · 目标WR ~42%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:5, targetWR:0.42}`
- aiProfile：`{aggression:7, lanePref:7, spellEager:6, targetPref:'weak', risk:6, economy:7}`（杀神·佯北诱敌·一生未尝败）
- 地煞①「佯北诱敌」`{kind:odds, op:noUpset}` —— 前排假败引你出·追进他阵就被反包（化为他占优时绝不被爆冷·见败别追）。
- 地煞②「置死后生」`{kind:odds, op:fewerStronger, perMissing:5}` —— 他兵越濒死战力越高·每损一张全军 +5% 胜率。
- 地煞③「长平坑杀」`{kind:siege, op:chipMore, value:2}` —— 被围你兵不死也残不能续战·破家时多扣 2 血（坑杀四十万·势不可挡）。

### 关 48 · 韩信 · 井陉之战（★★★★★ · 目标WR ~42%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:5, targetWR:0.42}`
- aiProfile：`{aggression:6, lanePref:8, spellEager:7, targetPref:'weak', risk:4, economy:8}`（兵仙·背水死战·拔旗易帜·算计）
- 地煞①「背水列阵」`{kind:morale, op:noRout}` —— 他全军绝不溃散·死战到底（背水一战·置之死地而后生）。
- 地煞②「置死后生」`{kind:odds, op:fewerStronger, perMissing:6}` —— 他兵越濒死战力越高·每损一张全军 +6% 胜率（速杀别留活口）。
- 地煞③「拔旗易帜」`{kind:siege, op:chipMore, value:1}` —— 奇兵偷袭你大本营·拔旗换帜·破家多扣 1 血。

### 关 49 · 汉尼拔 · 坎尼会战（★★★★★ · 目标WR ~41%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:5, targetWR:0.41}`
- aiProfile：`{aggression:7, lanePref:9, spellEager:6, targetPref:'weak', risk:6, economy:7}`（战略之父·新月薄阵·两翼合围）
- 地煞①「两翼包抄」`{kind:flank, value:-22}` —— 上下两路向中路夹击·被夹你兵 −22% 胜率。
- 地煞②「新月薄阵」`{kind:odds, op:fewerStronger, perMissing:5}` —— 中路示弱诱你深入·越推两翼夹得越狠（化为他越少越强·诱你冒进）。
- 地煞③「一日聚歼」`{kind:siege, op:chipMore, value:2}` —— 被两翼合围的你兵当回合直接出局·破家多扣 2 血（坎尼一日歼七万）。

### 关 50 · 凯撒 · 阿莱西亚之围（★★★★★ · 目标WR ~41%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:6, targetWR:0.41}`
- aiProfile：`{aggression:7, lanePref:8, spellEager:7, targetPref:'general', risk:6, economy:8}`（高卢征服者·内外双壕·围点打援）
- 地煞①「内外双壕」`{kind:siege, op:nearBase, value:18, slots:2}` —— 你大本营前两格变天堑·他兵在隘口内 +18% 胜率（你推进减半·双壕死守）。
- 地煞②「围点打援」`{kind:power, op:deepDecay, perStep:3}` —— 你新部署的援兵入场即减战力·每深入一格 −3（半道截杀）。
- 地煞③「降维钦托利」`{kind:morale, op:killGeneralRout}` —— 打掉你某路主将·该路全体溃散。

### 关 51 · 成吉思汗 · 野狐岭之战（★★★★★ · 目标WR ~40%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:6, targetWR:0.40}`
- aiProfile：`{aggression:9, lanePref:8, spellEager:6, targetPref:'weak', risk:7, economy:8}`（一代天骄·骑射机动·诈败诱杀）
- 地煞①「骑射」`{kind:power, op:add, value:8, scope:front}` —— 遭遇前先放箭·他每路最前一张 +8（你兵未接战先掉一截·高续航人头牌顶前排）。
- 地煞②「怯薛铁骑」`{kind:tempo, op:advance, value:1, scope:all}` —— 全军行军提速·比你早一步抢线压境。
- 地煞③「诈败诱杀」`{kind:odds, op:noUpset}` —— 一路假溃·你追上反咬·那场胜率倒给他（别贪追残兵·他占优绝不翻盘）。

### 关 52 · 孙武 · 柏举之战（终章 ★★★★★ · 目标WR ~40%）
- 难度：`{homeHp:5, loadoutCap:5, aiTier:6, targetWR:0.40}`
- aiProfile：`{aggression:6, lanePref:9, spellEager:8, targetPref:'weak', risk:5, economy:9}`（兵圣·避实击虚·算无遗策·全局最高智能·全面均衡偏算计）
- 地煞①「兵形如水」`{kind:lane, op:forceMigrate}` —— 每回合开始把兵悄悄换到你防守最空的一路（避实击虚·让他无虚可击则破）。
- 地煞②「奇正相生」`{kind:fog, turns:3}` —— 每路藏暗兵·前 3 回合你看不清他真实战力（用稳胜率招少赌·摊牌才现）。
- 地煞③「长驱入郢」`{kind:siege, op:chipMore, value:2}` —— 五战入郢·势不可挡·攻破你大本营时多扣 2 血（守前排别让他贴脸·破家代价翻倍）。
> 终章联动：①避实击虚每回合调你阵 + ②前 3 回合迷雾遮真相 + ③破家双倍代价 = 全局最难的"算计型"Boss。homeHp:5 上限 + aiTier:6 最高智能·体现兵圣。
