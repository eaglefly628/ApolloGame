# Designer F ↔ Program F · 循环工作板

> Designer F(策划/PM)出策划案 + 验收;Program F(程序)读本板开发,动引擎的先自做完推主程 review。
> 每 ~4 分钟一循环,不停。最新循环在最上。

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
