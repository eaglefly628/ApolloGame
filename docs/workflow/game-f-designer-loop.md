# Designer F ↔ Program F · 循环工作板

> Designer F(策划/PM)出策划案 + 验收;Program F(程序)读本板开发,动引擎的先自做完推主程 review。
> 每 ~4 分钟一循环,不停。最新循环在最上。

---

## 循环 #18 · 2026-06-15 · Designer F

### 验收:收藏 + 软币抽卡(机制)→ ✅ 通过
- `account.ts` 扩 spend/collection/gacha,earn→spend 闭合、与 ECS 解耦、localStorage 持久化、接大厅。**零引擎、74 测绿。** 机制对。

### ⚠️ 设计纠正(designer 该管):卡池 = **小丑牌**,不是武将
- Program F 占位"三国全武将"——但**武将每局清零、人人平等是地基**(`game-f-cards-and-decks.md`:"武将是租来的,小丑牌牌组才是灵魂")。**抽/收集武将 = 破武将公平 = P2W 武将,违核心**。
- **正解:gacha 抽「小丑牌」(各 deck 的 CardSpec 卡,持久收藏 → 组牌器拼牌组)**。武将另留**纯图鉴(无强度)**,不进强度池。
- (若 owner 想走"武将也可收集"的炉石式 = **改地基的 owner 决定**,需明确拍板;在此之前按"武将公平"做。)

### 我补上 designer 要的数据(给「小丑牌」卡池)
- **rarity 表(首版,按"是否定义流派"分级)**:传说=**钥匙牌**(虎豹骑令/桃园三义/八阵图/白衣/屯田,定义流派,出率最低)｜稀有=星球牌+进阶 buff｜普通=round-buff/shop-weight 等通用配牌。
- **GACHA_COST**:单抽 100 战功(≈ 攻岛 2-3 局)、十连 900(9 折)、**保底每 10 抽 ≥1 稀有**。

### 下一步:卡池改挂小丑牌 + 收藏→组牌器(养成真正落点)
- 收藏=小丑牌;**组牌器从收藏拼 Build 牌组**(接大厅 S4)→ decks 由硬编码改为"从收藏组装"。这才闭合"抽小丑牌→收藏→组牌→带入局内"的炉石养成环。

---

## 循环 #17 · 2026-06-15 · Designer F

### 验收:经济 v1 战功软币 earn-loop → ✅ 通过(干净)
- `account.ts`(48 行账号层):**与 ECS 单向解耦**(注释明钉,只消费攻岛结算、不进 sim/hash)、战功公式按 spec §一、localStorage/内存 KV 持久化、接大厅余额。**零引擎、71 测绿。** 养成闭环「赚」端通。

### 下一步:闭合「花」端 + 难度阀(都 game-side/账号层,核过现状无重复)
- **① 收藏 + 软币抽卡**(account 层扩):`collection:{[cardId]:count}` + `gachaPull(warfunds)→ 扣战功、随机出小丑牌入收藏、概率公示`(spec §二/§五)。**闭合 earn→spend**(战功有出口)。
- **② 段位 = 难度阀**(game-side 数据):攻岛名次 → LP/段位 → 高段位换更凶太阁关卡表(spec §六)。
- 组牌器(从收藏拼 Build 牌组,接大厅 S4)= 收藏做完后接;市场/充值 = phase3 不碰。
- 信玄火相 = 低优先,有空收。

---

## 循环 #16 · 2026-06-15 · Designer F —— 接受 Program F 回驳 + 自我复盘

### 接受回驳:屯田 econ-buff 提案 = 过度设计,撤回
- **Program F 回驳成立**:① CardSpec 现有 **5 类**(我循环#14 误数成 4),已含 `economy-band`(banded by gold,**早碰经济**);② **屯田积粟(`TUNTIAN_DECK`)早用 economy-band 实装、入 registry、有测**(利息=高 atGold 档)。我循环#14 为已覆盖的东西新加 `econ-buff` 类 = **过度设计,撤回**。
- **自我复盘**:空档预研时**没核 decks.ts 现状**(漏看 economy-band + 屯田已做),凭"4 类"臆断 → 违了"先查再提"的纪律。这是我第二次被有理回驳(owner 否 T-F4 / PF 否 econ-buff),**记教训:派单/预研前先核代码现状**。
- 正解收下:真要连胜金,**泛化 economy-band 的 banded 源(gold→可选 resource 字段)**,不加新 kind(PF 已记 decks.ts 注释)。

### 现状盘点(我重新核过):**5 套牌组全实装**
- 虎豹铁骑(魏速攻)/ 兴复汉室(蜀连携)/ 卧龙八阵(蜀控制)/ 白衣渡江(吴刺客斩首)/ 屯田积粟(经济)。+ 3 阵营 + 太阁全 Boss 招牌 + 贡献/攻岛 + 大厅。**单机 game-f 内容已相当完整。**

### 下一步:转「养成闭环」game-side 起步(向 owner 炉石模型推进)
- **攻岛结算 → 产出「战功」软币**(`game-f-economy-spec-v1.md` §一:按贡献+名次结算软币)——game-side,纯数据资源。
- **段位 = 难度阀**(§六:高段位换更凶太阁关卡表)——game-side,换数据。
- 收藏/组牌器/抽卡/市场 = 服务层独立工程(后续,非本轮)。
- (信玄火相 = 低优先,有空再收。)

---

## 循环 #15 · 2026-06-15 · Designer F —— Program F 恢复,大解锁

### 验收:启用单机吴 + 阵营感知 HUD → ✅ 通过(白衣渡江上线!)
- **白衣渡江入 `DECK_REGISTRY`**(`baiyi: BAIYI_DECK`)—— 单机吴布局一通,**刺客斩首流上线**(4 吴刺客 + F-061 斩杀 trait)。
- 单机吴可玩(`rosterFor('wu')` 跑真吴 PvE)+ 阵营感知 HUD。**零引擎、68 测绿。**
- 🎯 里程碑:**3 可玩阵营(蜀/魏/吴)+ 4 牌组(虎豹/兴复/卧龙/白衣)**。

### 下一步:屯田积粟 deck(econ-buff,方案已备循环#14)
- 加第 5 类 CardSpec `econ-buff`(`{hook:'interest'|'income'|'streak', op, value}` → buildDeckRules 物化成挂经济信号的 Effect,复用 banded 经济链,零引擎)。
- 屯田 deck:`econ-buff interest +2` / `econ-buff streak +1`(经济流,后期金山转战力)。信号名对 blueprint 真实实装。
- 后续:信玄火相(低优先)→ 经济 v1。

---

## 循环 #14 · 2026-06-15 · Designer F —— 空档预研(game-f 静默期,提前定掉开放问题)

> game-f 静默 2h+(搭档在 game-g)。利用空档把屯田的开放问题(需不需要第 5 类 CardSpec)预先定掉,Program F 回来即可 drop-in。**这是预研、非验收。**

### 定案:屯田 **需要**第 5 类 CardSpec `econ-buff`(现有 4 类都只改 dmg_scale,碰不到经济)
- **CardSpec 加一员**:`{ kind:'econ-buff'; id:string; hook:'interest'|'income'|'streak'; op:'add'|'mul'; value:number }`
- **`buildDeckRules` 加分支**:把 econ-buff 物化成挂在**经济信号**上的 `Effect`(复用现有 banded 经济链):
  - `hook:'interest'` → `Effect{ onSignal:'give_interest', targetId:'gold', op, value }`(改利息产出/上限)
  - `hook:'income'` → 挂回合收入结算信号;`hook:'streak'` → 挂连胜金信号
  - **全是现成 `Effect modify-resource` + 现有经济信号,零引擎**(同卡牌加载器一贯做法)。
- **屯田积粟 deck**(drop-in,faction 任意):
  - `{ kind:'econ-buff', id:'tuntian', hook:'interest', op:'add', value:2 }`(利息每跳 +2,= "屯田生息")
  - `{ kind:'econ-buff', id:'zhongnong', hook:'streak', op:'add', value:1 }`(连胜金 +1)
  - `{ kind:'round-buff', id:'houfa', untilRound:99, bonus:0 }` 占位 or 省略 —— 屯田是经济流,战力靠后期攒出来,不必带伤害 buff。
- **验收**:装屯田 → 利息/连胜金明显更高 → 后期金山转战力;`econ-buff` 物化正确;tsc+vitest 绿、零引擎。
- ⚠️ 注:经济信号名(give_interest/income/streak)以 blueprint 现有实装为准,Program F 接时对一下真实信号名。

### 队列现状(等搭档回 game-f)
1. 吴单机布局调正 → 白衣渡江入 registry(循环#13 派)
2. 屯田 deck(本预研,econ-buff 第 5 类)
3. 信玄火相(低优先)→ 经济 v1(已定案 `game-f-economy-spec-v1.md`)

---

## 循环 #13 · 2026-06-15 · Designer F

### 验收:3-faction plumbing(`rosterFor('wu')` + 盟友镜像吴名册)→ ✅ 通过
- `WU_ROSTER`(6 吴英雄)+ `Faction='shu'|'wei'|'wu'` + 盟友镜像跑真吴名册。**零引擎、68 测绿。**

### 白衣渡江:仍 gated —— 卡在「吴单机布阵布局」
- decks.ts 注释:"现入会因 `rosterFor('wu')` 占位布局打不正常" → plumbing 通了一半(吴可 roster + 盟友镜像),但**吴选阵营后的单机布阵/落点布局还没调正**。
- **派 Program F:把吴单机 deploy 布局调正**(让 `rosterFor('wu')` 单机能正常开局/布阵)→ **白衣渡江即可入 `DECK_REGISTRY` 上线**(deck 已写好,就差这一脚)。

### 下一步(无依赖,并行推):屯田积粟 deck(经济·贪婪)
- 评估能否用现有 round-buff 框架,不能则提小 `econ-buff` CardSpec 扩展(纯游戏侧)。
- 后续:吴布局通 → 白衣上线 → 信玄火相(低优先)→ 经济 v1。

---

## 循环 #12 · 2026-06-15 · Designer F

### 验收:卧龙八阵 deck + 白衣渡江 deck 定义 → ✅ 通过(+ 好纪律)
- **卧龙八阵** 进 `DECK_REGISTRY`(threshold-buff TACTICIAN [2→0.15, 3→0.20] + round-buff),= #10 spec。**零引擎、67 测绿。**
- 👍 **白衣渡江** deck 也写好了,但**故意不入 DECK_REGISTRY**(注释:依赖 3-faction plumbing,不通前不可选/不会被错误构建)。准确接住了 #11 的 plumbing flag。

### 厘清:白衣渡江的真实解锁条件(给主程/多人评估)
- 白衣只需**「吴可选为玩家阵营」**(单机 吴 vs 太阁)——即 `rosterFor('wu')` + 大厅选吴一项,**未必要全套三人 plumbing**。建议先评估这个小解锁(吴当第 3 个单机阵营)→ 白衣即可上;**全三人对局(孙刘曹同场)再随多人 F**。

### 下一步(无依赖,继续推):屯田积粟 deck(经济·贪婪)
- drop-in `decks.ts`(faction 任意,蜀/魏皆可):
  - `{ kind:'round-buff' 或 econ-buff }` 思路:利息/连胜加成。**⚠️ 现 CardSpec 4 类是 buff/shop-weight,没有"改经济档"的卡类** → 屯田可能需第 5 类 `econ-buff`(改 gold 利息 banded)。请 Program F 评估:能否用现有 round-buff 框架表达,不能则提一个小 CardSpec 扩展(纯游戏侧)。
- 后续:卧龙之外更多牌组 → 信玄火相(低优先)→ 经济 v1。

---

## 循环 #11 · 2026-06-15 · Designer F

### 验收:吴 faction 6 英雄入 roster(+ 吕蒙 sprite 404 修复)→ ✅ 通过
- `c_lvmeng/ganning/taishici/lingtong`(**4 刺客**)+ 周瑜(谋·火烧赤壁 DoT)+ 孙策(将);`FACT_WU/WU_GREEN` 入 constants(= `wu-faction-seed` 方案落地)。吕蒙 sprite 修正(`deep_elf_annihilator`)。**65 测绿。**
- 🎯 大里程碑:**4 吴刺客 + 刺客斩杀 trait(已 done)→ 白衣渡江解锁**。

### ⭐ 重排:白衣渡江 deck 现在能做(优先于卧龙)
- drop-in `decks.ts`(`DECK_REGISTRY` 加 `baiyi`,faction `wu`):
  - `{ kind:'threshold-buff', id:'baiyi', tagMask: BENCH_OCC|ASSASSIN, tiers:[{at:2,bonus:0.18},{at:4,bonus:0.22}] }`(刺客成军质变)
  - `{ kind:'round-buff', id:'jinfan', untilRound:3, bonus:0.12 }` + `{ kind:'shop-weight', id:'muci', codes:[/* 吴刺客码 codesFor(rosterFor('wu')) */], copies:3 }`
  - **斩杀来自刺客职业 trait(已 done)**;周瑜火烧赤壁 = ult DoT(已接)。零引擎。
  - ⚠️ 若 3-faction 选阵营 plumbing 未通,先确认吴可选/可买;不通则记一条 plumbing 跟进(随多人)。
- 后续:卧龙八阵 → 屯田积粟 → 经济 v1。

---

## 循环 #10 · 2026-06-15 · Designer F

### 验收:今川义元·弓阵 → ✅ 通过
- group-count `BOW`(弓兵)≥3 → +0.12(毛利镜像);mob spawn 打 `BUSHO`/`BOW` 兵种 tag 供计数。**零引擎、65 测绿。** 太阁国人众/✅Boss 招牌**收齐**。

### PM 裁决:信玄·风林火山 → **简化(火相)/复杂部分守纪律缓做**
- 风(提速=per-unit steering)/ 山(减伤=无 mob 防御系数)**不是 dmg_scale_b 式全局系数能干净重组的**,硬做要拓宽引擎 → **不做**(YAGNI)。
- **可选简化**:只做"火相"= 阶段 Timer 切 `dmg_scale_b` 加攻(同信长法),达"信玄在场守军更凶"之意。**优先级低,排牌组之后。**

### ⭐ 转大块内容:派牌组(丰富玩家构筑,纯数据,现有阵营即可)
- **下一个:卧龙八阵 deck(蜀·谋士控制)** —— drop-in `decks.ts`(`DECK_REGISTRY` 加 `wolong`):
  - `{ kind:'threshold-buff', id:'bazhen', tagMask: BENCH_OCC|TACTICIAN, tiers:[{at:2,bonus:0.15},{at:3,bonus:0.20}] }`(谋士越多越强;诸葛亮已在 roster)
  - `{ kind:'round-buff', id:'wolong', untilRound:3, bonus:0.10 }` + `{ kind:'shop-weight', id:'qimou', codes:[/* 谋士码 */], copies:2 }`
  - 八阵图(冻)走武将大招既有 ult(诸葛 ultFreeze 已接),牌组只管 synergy buff。
- 再后:屯田积粟(经济 banded)→ 吴 faction → 经济 v1。

---

## 循环 #9 · 2026-06-15 · Designer F

### 验收:国人众招牌·石田三成·三献茶 → ✅ 通过
- `healPulse`:hitbox 负 amount(`amount:-X, targetMask:TEAM_B`)= AoE 回血 + 周期 spawn sidecar(Timer loop)。**特意不挂 `scaleByResource`**(治疗量不吃信长/毛利伤害 buff,正确)。**现成词汇、零引擎、64 测绿。**
- 📊 进度:太阁招牌已接 = 信长/谦立半斩杀/家康/秀吉·本愿寺召援/斋藤毒/明智冻/毛利羁绊/石田治疗。**国人众+✅Boss 基本收齐。**

### 下一步:收尾国人众 + 转大块内容
- 收尾:**今川·弓阵**(group-count 弓 → 全弓 buff)/ **信玄·风林火山**(Timer 阶段切换系数)——最后两个,同重组法。
- **然后转大块:更多牌组**(赤壁火攻 DoT / 卧龙八阵 冻 / 屯田 banded,纯数据,丰富玩家构筑)→ 吴 faction → 经济 v1。

---

## 循环 #8 · 2026-06-15 · Designer F

### 验收:国人众招牌·毛利元就·三矢 → ✅ 通过(+ 一个好 catch)
- `group-count 部将(国人众/天守)≥3 → edge 信号 busho_sanshi → Effect add 0.18 到 dmg_scale_b` = 玩家羁绊 bond 的敌方镜像重组。**零引擎、63 测绿。**
- 👍 **Program F 主动修了 buff 叠加坑**:发现信长 `op:set` 会覆盖毛利 buff → 把信长阶段递增改成 `op:add`(从 prep 复位基线 1 累加),信长×阶段 + 毛利羁绊**正确叠加**。好工程嗅觉。

### 下一步:继续国人众/Boss 余下招牌
- **今川义元·弓取**:弓阵(全弓 buff)——group-count 弓职 → 全局 buff(同毛利法)。
- **武田信玄·风林火山**:阶段切换(提速/加攻/减伤)——`Timer` 阶段 + 全局系数,纯数据。
- 之后:更多牌组(赤壁/卧龙/屯田)→ 吴 faction → 经济 v1。

---

## 循环 #7 · 2026-06-15 · Designer F —— 接受 owner 裁决 + 自我复盘

### 收到 owner 裁决:T-F4(game-f.tsx→全 GameShell)= **wontfix**,我撤回刹车
- owner 真机复核:**GameShell 与 canvas 并存 → 重复 UI bug**(棋盘下方堆第二套点将台/主公卡);钦定**保留手写 DOM HUD**(主公卡左下、右栏盟友预览),`GAME_F_UI` 留作蓝本+测试、不并存渲染。**以 owner 为准。**
- **自我复盘**:循环#5/#6 的"去腐 T-F4 硬优先"是**我过头了**——去腐其实已还掉大半(**脉冲清零✅ / band·visSwap·chrome 展平✅ / 商店卡名牌派生去重✅**);我盯着 `game-f.tsx` 行数这个指标不放,但 owner 要的是**能用不出 bug 的 HUD**,不是行数。错在用代洁指标压过产品手感。**收回。**
- 余 `blueprint→manifest` 全量展平 = Lead 标低优先(`makeRoundFlow/templatesFor` 保留),**不催**。**去腐这条线就此告一段落。**

### 重开内容队列(去腐既闭,内容解押)
- **下一个:国人众/Boss 余下招牌** —— 信玄·风林火山 / 毛利三矢(部将≥3全局buff)/ 今川弓阵(全弓buff),同重组法(group-count→全局buff→scaleByResource / 现成 hitbox),纯数据零引擎。
- 再后:更多牌组(赤壁火攻/卧龙八阵/屯田)→ 吴 faction 6 英雄+白衣渡江 → 经济 v1(已定案)。

---

## 循环 #6 · 2026-06-15 · Designer F

### 验收:去腐去重(商店卡/名牌从 ROSTER 派生,删手抄 HEROES/HERO_NAMES)→ 🟡 部分通过
- 去重对路(手抄数据消除、单一真相回到 ROSTER),62 测绿、零引擎。**但这是 T-F4 的边角,不是核心。**

### ⛔ T-F4 仍未达验收线 —— 继续顶,别开新内容
- **核心没动**:`game-f.tsx` = **736 行**(还在涨,目标是删它→`UILayout`)、`manifest.json` **仍 0**。
- **下一步只做这两件**(达标才算 T-F4 完成):
  1. `game-f.tsx` 手写壳 → `GAME_F_UI: UILayout` + GameShell,删 canvas 假点击桥(行数大降);
  2. 建 `data/game-f.manifest.json`,blueprint 生成器残余展平为字面实体。
- 安全网=片0 快照守 + 行为测;**引擎零改动**。**信玄/毛利/牌组/吴 一律继续押后**,先把 game-f.tsx 这块硬骨头啃下来。

---

## 循环 #5 · 2026-06-15 · Designer F

### 验收:国人众招牌 斋藤·毒沼 + 明智·群冻 → ✅ 通过
- `strike()/projectile()` 工厂加 `dot`/`freezeTicks` 入参 → 套现成 hitbox `DOT{25/30/240}` + `setMask:FROZEN`+`statusDuration`(八阵图同款 REQ-F-030)。**现成 hitbox 词汇、零引擎、62 测绿。**

### ⛔ PM 刹车 + 重排优先级:T-F4 去腐片4/5 = 硬任务,先于一切新内容
- **连 4 轮内容,去腐债没动**:`game-f.tsx` 反而从 623 涨到 **728 行**(去腐目标是删它→UILayout)、`manifest.json` 仍无。**LEAD→PF 是站着的义务**;内容越堆,未去腐的壳/blueprint 返工越大。
- **请 Program F 下一轮务必做 T-F4(去腐片4/5)**:`game-f.tsx`→`GAME_F_UI:UILayout`+GameShell、删假点击桥;建 `data/game-f.manifest.json`;核账行数大降。安全网=片0 快照守 + 行为测兜底,runbook=`game-f-derot-runbook.md`,**引擎零改动**。
- **信玄/毛利/今川/更多牌组/吴 faction 一律押到 T-F4 落地之后。** 先把债还清。

---

## 循环 #4 · 2026-06-15 · Designer F

### 验收:T-F2 秀吉一夜城 + T-F3 本愿寺一揆 → ✅ 通过
- 通用 `summon` 数据字段 + 召援 sidecar(`Timer`+`SelfRule spawn reinf_<code>`):秀吉 `period180/count1` 周期召;本愿寺 `period30/count3/once` 开场人海。**REQ-021 spawn 重组、零引擎**,3 个回归测试,**60 测绿**。
- 🎯 **✅类天守 Boss 招牌全齐**(信长 buff / 谦信斩杀 / 家康忍耐 / 秀吉·本愿寺召援)→ **终盘攻岛体验成型**。

### 下一步:T-F4 去腐片4/5 收尾(还质量债,LEAD→PF 交办)
> 内容告一段落,转去把"在数据里编程"的债清掉(blueprint 已展平大半、脉冲已 0;余手写壳 + manifest)。
- **片4**:`game-f.tsx`(692 行)手写残余 → 完整 `GAME_F_UI: UILayout` + GameShell;删 canvas 假点击桥。
- **片5**:建 `data/game-f.manifest.json`(blueprint 生成器残余展平为字面实体);核账:脉冲=0(已)、非测试行数大降、对照 game-b。
- **安全网**:片0 快照守已在;redesign 片用「商店/战斗/流程行为测全绿 + 确定性 hash 不变」兜底。runbook=`game-f-derot-runbook.md`。
- **验收**:game-f tsc 0 + vitest 绿 + hash 不变;过"最弱 LLM 产出 manifest"尺子;**引擎零改动**。

### 后续队列:国人众招牌(毛利三矢/今川弓阵/明智群冻)→ 更多牌组 → 吴 faction → 经济 v1(已定案)

---

## 循环 #3 · 2026-06-15 · Designer F

### 验收:T-F1 阶段递增(follow-up)→ ✅ 通过
- `eff_tenka_s2..s5` 挂 `deploy_pve_2/3/4/5` → `dmg_scale_b` 阶梯 1.08→1.16→1.25→**1.40**(关越深守军越凶,终盘信长 ×1.40);prep 每回合复位回 1;全 mob hitbox `scaleByResource:'dmg_scale_b'`。**纯数据重组、零引擎**,加了回归测试(`taikou.test.ts`)。**57 测绿。** follow-up 结清。

### 下一步:T-F2 / T-F3(仍在队列,催实装)
- **T-F2 秀吉·一夜城**:`SelfRule{loop Timer→spawn ash_yari×2}` 周期援军。
- **T-F3 本愿寺·一揆**:`SelfRule` 开战 spawn `ash_yari×4` 人海。
- 之后:去腐片4/5 收尾。

---

## 循环 #2 · 2026-06-15 · Designer F

### 验收:T-F1 信长·天下布武 → ✅ 通过
- 实现 = `Effect{ onSignal:'deploy_pve_5' → dmg_scale_b set 1.35 }`:终盘 W6 信长坐镇 → 全军伤害 ×1.35(敌方系数,与玩家 `dmg_scale_a` 羁绊乘区对称)。**纯数据重组、零引擎改动**(注释明引 REQ-F-064);信长已进终盘天守波(`stages` W5/6)。**game-f 56 测绿、game-f 侧 0 tsc 错。**
- 📌 follow-up(非阻塞,入 C 队列):派的"**阶段递增**"被简化成**一次性 ×1.35**——达意,但少了"越拖越强"的压迫感。若要逼真,后续加 loop `Timer` 阶梯递增。
- ⚠️ 环境提示(非 game-f):tsc 报 `three` 未安装 = **game-g 3D 渲染依赖**(package.json 有,本地 node_modules 未更新),装了即绿,**与 game-f 无关**。

### 下一步:Program F 继续 T-F2 / T-F3(循环#1 已派,同重组法)
- **T-F2 秀吉·一夜城**:`SelfRule{loop Timer→spawn ash_yari×2}` 周期援军。
- **T-F3 本愿寺·一揆**:`SelfRule` 开战 spawn `ash_yari×4` 人海。
- 之后进 **C 队列**:去腐片4/5 收尾(`game-f.tsx`→UILayout / `manifest.json`)。

---

## 循环 #1 · 2026-06-15 · Designer F

### A. 验收(game-f 最近产出 → 通过)
| 项 | 判定 |
|---|---|
| 去腐片3 收尾(商店脉冲清零,`shop_marks`=0,GameShell `shop_face` 接管) | ✅ 通过(脉冲债清了一大块) |
| 太阁 Boss slice3:谦信/立花/半藏 **斩杀**(F-061)+ 家康 **忍耐**回血 | ✅ 通过 |
| 三人版右栏:对战玩家名单 + 迷你布阵镜像(mirror) | ✅ 通过 |
| 测试 56 绿(9 文件) | ✅ |

📌 **PM 记账(两条战略变化)**:
1. **REQ-F-057 定论**:game-f 战斗走 **mirror 同步**(权威端各自跑 PvE、对端只还原显示不重演)→ **浮点确定性不参与跨端比对、自动消解 → 不阻塞三人**。多人地基从此通畅;lockstep 只承载离散跨玩家命令(卡牌/连携,整数,天然确定)。
2. **REQ-F-064「Boss 技能=引擎需求」已 Lead wontfix**:Boss 招牌**必须用现成能力重组,严禁提引擎需求**。下方任务据此设计。

### B. 下一个任务:太阁 Boss 余下招牌(纯数据重组,零引擎改动)
> 数据齐(21 单位/6 波),斩杀+忍耐已接;补 ✅ 类三大 Boss 招牌。**全用现成能力重组**(对齐 REQ-F-064 裁决)。

| 任务 | Boss·招牌 | 重组方案(现成能力) | 验收 |
|---|---|---|---|
| **T-F1** | 织田信长·天下布武(全军 atk↑阶段递增) | 阶段 `Timer`(loop)→信号→`Effect` 累加全局 buff 资源 `boss_atk` → 太阁 strike `scaleByResource:'boss_atk'`(= 虎豹骑令/羁绊同款) | 信长在场,守军伤害随时间阶梯↑ |
| **T-F2** | 丰臣秀吉·一夜城(周期召援军) | `SelfRule{ when:loop Timer到点, whenGlobal:in_combat, do:[spawn ash_yari×2] }`(REQ-021 spawn) | 秀吉每隔 N 拍召 2 杂兵 |
| **T-F3** | 本愿寺显如·一向一揆(人海 spawn) | `SelfRule` 一次性 spawn `ash_yari×4`(开战拍) | 本愿寺开场放人海 |

**通用验收**:终盘 Boss 波招牌生效;`tsc 0 + vitest 绿 + 确定性 hash 不变`;**combat.ts 数据装配,零引擎改动、零新 REQ**。

### C. 后续队列(Program F 消化完 B 依次取)
1. **去腐片4/5 收尾**:`game-f.tsx`(692 行)→ 完整移交 `UILayout`/GameShell;建 `manifest.json`;blueprint 生成器残余展平。
2. **信玄·风林火山 / 毛利三矢 / 今川弓阵** 等国人众/Boss 余下招牌(同 B 重组法)。
3. **更多牌组**(赤壁火攻 DoT / 卧龙八阵 冻 / 屯田 banded — 纯数据)。
4. **吴 faction 6 英雄 + 白衣渡江**(`game-f-wu-faction-seed.md`;3-faction plumbing 随多人)。
5. **经济 v1**(已定案 `game-f-economy-spec-v1.md`,服务层独立工程)。

> Designer F 下一循环:验收 B 的落地 + 推进 C。
