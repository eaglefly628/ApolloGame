# Game G 实装任务板 · design G ↔ program G 循环

> 维护：**game design G（策划）** 派单 + 迭代；**program G（程序）** 执行。
> 上位规格：`08-ui-implementation-spec.md`（逐屏 + U1–U7 队列）；`09-formation-and-deployment.md`（开局布阵）；正典 `00`–`07`；UI 稿 `UI/`。
> **三决定已拍板（2026-06-15）**：① MOBA 观感 + **整数离散**底层（否决连续物理）② **54 牌·王=大队长**（干预卡=独立功能牌池）③ 台面机关 = **纯表现/favor，不做物理**。

---

## 🪧 当前轮次状态 · BATON（owner 2026-06-17 立的协议：动手前先读、干完必翻棒；**禁止空悬挂**）

> 协议：① 任一方干完，回这里**翻棒** + 写「完成什么 / 轮到谁 / 对方需做什么 / 唤醒条件」。② **禁空悬挂**（不挂永久 watcher 等超时——用一次性有界计时器，到点回来读棒）。③ 对方持棒时本方可干不冲突的活，但棒归属要清。
>
> | 字段 | 值 |
> |---|---|
> | **owner 直派追加（2026-06-18 · 3 连反馈 → program G 已落地，`05bb4be`）** | owner 跑 WIRE-MARCH 后纠正节奏「跟想象完全不一样」，3 连反馈 → 已实现：**①战场修正三连**(`2f5303e`)：单列行进(删三行错开)、三路皆平滑曲线(中路改贝塞尔)、**迷雾门线显形**(出 t=0.34/0.66 门线才翻、非接敌才翻)。**②3D-1 出牌控盘层**(`05bb4be`)：布局阶段 base 打底 3/路+抽牌堆+起手摸 5；**手牌坞**点选派上/中/下、实时慢推；**实时流+读秒暂停银行**(空格冻结/90s)；底流每 18 拍涌牌；敌每 16 拍滴投原路。owner 节奏决议=实时流+暂停银行 / 基础布局打底+抽牌堆（AskUserQuestion 拍板）。owner 北极星=**Balatro「啪嗒啪嗒」心流**。|
> | **持棒方 BATON** | 🟢 **program G 甲**（owner 2026-06-19 **立即派发** ⛔ **战斗实时 → 回合制 PVE 重构** = 甲当前**头号任务**·见 `doc24` §七/八 + TODAY-TASKS **A0**·logic 可先做不等 UI）。乙线并行不冲突：B1 收尾 ✅`0a80dbe1` 待 design G 验 · icon/地支/列传/COLL 待接。|
> | **🎯 最终模型已派（owner 确认 · 见 TODAY-TASKS 顶）** | 致命翻牌 = 皇室战争 × Commands&Colors × 扑克。**甲**：重做局内经济为 CR 两牌库（点数 regen+共享池 / 普通库52+天罡库 / 花点数摸牌选库 普通~1·天罡~2 / 天罡 cap5 打掉才补 / 三路可迁移 / 慢行军遭遇 logistic 对决 / 无暂停；A1 战潮 superseded，march/clash/续航/大本营保留）。**乙**：改造坊三区(扑克/天罡构筑/地支养成) + 地支养成52牌组 + 牌组预览 + 填 36 天罡/12 地支。正典 doc 19/20/21。|
> | **🎴 天罡牌一期（owner 新要求·已派）** | doc20 §三 20 张（每张牌力）→ **甲** A-JOKER：10 kind 解释器、库 `save.jokers≤5` 常驻被动 apply（含巧手/背水两例）；**乙** B-JOKER：改造坊上架买入+选≤5 战库 + 牌组预览面板（名+效果+牌力+库总加成）+ 填 `GAME_G_JOKERS` 数据。**契约③** `{id,name,rarity,kind,params,text,cost}`（乙写数据/甲写解释器）。详见 `TODAY-TASKS.md` 末「天罡牌·一期」。|
> | **📋 今日·双程序员正交** | owner 建了**两个程序员** → 今日余下全套已拆成正交双轨，**详见 `TODAY-TASKS.md`**：**甲=开发(战斗)**（`live-combat`/`clash-resolve`/`battle-screen`/`showMatch`）· **乙=菜单**（`lobby-screen`/菜单屏/养成数据）。两轨靠 2 契约解耦（① `prepareArmies→ArmyCard[]` ② `save.jokers/planets` 构筑库）、互不撞车。甲乙各自完成翻棒回 design G 驻片验。|
> | **甲·战斗轨进度（→ 待 design G 验）** | **A1 战潮抽牌·事件脉冲 ✅**（`b24c81a`）：`live-combat` 加纯函数 `tideDrawPulse(newClashes, homeAChipped, homeBChipped)`——遭遇+1/斩将(输方主将)+1/**告急(我家−1血)+2 绝境援牌**/破阵(敌家−1血)+1，负 chip 钳 0、确定性零 rng；`showMatch` 抽牌驱动改读它（与特写同源 `clashLog.slice` + 我家/敌家血差，底流叠脉冲，手牌满 HAND_MAX 自然节流）。测：单元(各事件张数/负钳) + **行为「看得见」**(真局整局涌牌>20 远超纯底流·峰值拍≥2·静拍存在=非线性「啪嗒」·同 seed 序列确定)。vitest 1453 绿。正交守住(仅动 live-combat+showMatch 抽牌段+live-combat.test)。<br>**战斗 polish 三连 ✅**（`9fe209c` · owner 手机派单）：**①默认无迷雾(迷雾=附魔专属)**——`LiveUnit/DeployCmd` 加纯表现位 `fogged`(不进 hash·默认 false)，`buildBattleViewLive` 显形改 `!fogged||过线`→默认即 face-up、仅 fogged 牌面朝下(紫雾皮+✦)；迷雾线 0.34/0.66→0.18/0.82 缩短。**②对决特写定位三路**——clash 按 `cv.lane` 竖锚(上/中/下)+聚光跟随。**③翻牌 biu 提速**——close-up 翻面 .9s→.6s 弹性缓动。测：默认无迷雾(所有牌即显形=total)+迷雾=附魔专属(fogged 过 0.18 才翻) 行为断言；5 battle golden 重出。vitest 1454 绿。**⚠️ 契约①+ 待乙接：附魔→fogged 需 `ArmyCard` 加 `fogged?`（乙养成写·甲 `armyToDeploys` 读），甲下游已全铺好、默认 false=现状（详见 TODAY-TASKS §4）。下一步 A2 余/A3。**|
> | **乙·菜单轨进度（→ 待 design G 验）** | **B1+B2+B3+B4+B6 已落地**。**B1 大厅收尾 ✅**（`0a80dbe1` · 2026-06-19）：DECKS 花色均势竖条（4 花色 favor 均值归一柱状+预估强度★）+ CRAFT 改造台前牌→CRAFT→后牌+重翻 gem 视觉 + LADDER 段位卡+近10局+全服榜（`ladderSection()` 接线）；golden 5 帧全重出；click 测 LADDER 断言修正。vitest 1521 全绿。已生成预览帧发 owner 确认。**余派单（设计稿 design G 已写好可拉）**：B5 COLL doc22 世界观牌面 ✦ / B2 布阵屏细化 / 🀄 地支实装（乙养成+镶嵌+揉） / 契约①+（`ArmyCard.fogged?`）。**COLL 铁律：英雄层=叙事皮肤·不进对战强度·0 英雄也能跑·不阻塞。** |
> | **🀄 地支·实装派单（owner 2026-06-19「让他们做起来」· doc20 §三定稿）** | 12 生肖单颗(铜/银/金) + 三合/六合连携 + 揉获取**全定稿**。**契约④**：`save` 存每卡 `card.inlays: dizhi[≤3]`(`{zodiac,tier}`)，**乙写**(改造坊镶嵌/合成/揉)、**甲读**(战斗 apply + 连携检测)。**乙**=地支区(揉获取·合成升档·镶嵌 UI)+数据+预览连携高亮；**甲**=单颗效果解释器(触发型概率/被动型数值·多复用现成 buff 源)+连携检测(三合有界/六合概率)+龙主将光环。真缺口 game-side 自建·仅真引擎缺口提 REQ-G。详见 `TODAY-TASKS.md` 末「🀄 地支·实装派单」。 |
> | **📜 二阶列传派单（owner 2026-06-19 · doc23）** | 点牌背→二阶菜单看故事/经历(优雅·世界观传递)。**乙**：详情面板升级「列传」二阶菜单(古卷/书法/朱印·doc23 §一)，接 ① 扑克英雄(doc23 §四·替换占位 52 名) ② 地支牌背生肖传说(doc23 §五)。可选 lore 数据·缺则优雅占位·不进对战强度。**design G** 已落 doc23(52 名册+schema+二阶规格+3 样板列传+12 生肖传说全文)。 |
> | **🏠 HOME 说明 / 帮助入口（owner 2026-06-19 · doc22 §七 + doc26）** | 乙：首页加「说明 / 帮助」区，含三块——① **游戏介绍 / 世界观**（`doc22 §七`·执掌命运之人·52 命运之战·翻命·三牌组·地煞 Boss）② **玩法手册**（`doc26`·**初/中/高级三档展开**·核心循环→构筑/克制/养成·owner 点名"放首页说明里"）③ **新手指导流程图**（B6·`doc/match-flow.html`）。纯文案/图展示·古风 overlay。|
> | **💰 货币 + 天罡解锁（owner 2026-06-19 · doc25）** | 两套货币：**金币**(打战斗赚·免费·解锁天罡/地支/改造坊) + **钻石**(付费·速解·**只加速不卖强度**·单机无 PvP 不破平衡)。**天罡解锁 = 9 关 × 4 张 = 36**(简单→复杂·前 5 关可刷·doc25 解锁表)。**乙**：金币/钻石钱包 + 天罡解锁(通关后可购·金币/钻石) + 解锁 UI(改造坊/牌组屏)。|
> | **🛒 商城 + 抽卡 + Demo 赠送（owner 2026-06-19 · doc25 §四）** | 商城=抽卡枢纽：花钻石/金币抽**天罡+地支**(从已解锁池随机)·重复转**碎片**→定向兑换指定天罡(保底·可控 build)·地支抽到即镶/合成。🎁 **首启送钻石+金币**(demo·够抽几发)。**新手引导加一步**(doc28 引导C)：教学关后→赛后结算领赠送货币→引导去商城抽一发→进关1。**乙**：商城屏+抽卡(开包动画)+碎片兑换+直购+starter赠送+引导步骤。|
> | **🗄 Campaign 关卡 DB（owner 2026-06-19 · doc27）** | 52 关**系统化入库·主程逐关加载**。schema `Level{id/heroId/battle/intro/bossLines/boss[homeHp/deckTier/tiangang随机12/disha×3/aiTier]/reward[unlock×4/gold]/loadoutCap/targetWR}`·拼装 doc23+25+27。**甲**：建 level loader（按 id 加载进回合战斗 doc24·Boss 12 天罡 seed 随机·地煞/数值/loadoutCap 生效）。**乙**：关卡选择/进度屏 + **每关开局演出**（战役背景旁白 + Boss 对白 open/mid/lose）。背景/对白 **全 52 关已入库**(doc27 §五+§六·52战役背景+Boss开场/劣势/败北对白)。|
> | **🤖 Boss AI = 通用效用解释器 + 画像数据（owner 2026-06-20 · doc27 §八）** | owner 问"Boss 同规则·AI 怎么写·配得出来吗"。答：**不写 per-boss 代码**，写**一个通用 utility AI 解释器**(甲·turn-combat·每回合枚举动作→效用打分→选最高·seed 确定性·可仿真)+ 每 Boss 一份 **`aiProfile` 数据画像**(aggression/lanePref/spellEager/targetPref/risk/economy·design G 填) + **`aiTier` 难度档**(低档会犯错→高档最优)。教学关=固定脚本特例。**甲**：建通用 utility AI(零 per-boss 代码·读 aiProfile/aiTier)。**design G**：✅ 已填关1-5 aiProfile(doc27 §八)。**⏬ 优先级=往后排**(owner 2026-06-20)：**A0 回合核 + 地煞 + 货币/解锁 先做完**，Boss AI 排在它们之后(放 To-Do 后段·不急)。 |
> | **🔍 design G 驻验 = PASS（2026-06-20）** | tsc 绿 + **vitest game-g 198 全绿**(需 `npm i happy-dom`·环境缺) + `turn-combat.ts` **忠实 doc24**(三路9格/+1源泉/四选一互斥/推进掷命/3血/捷径门8门/确定性·复用 clash-resolve&续航&天罡·零引擎)。货币/解锁/地煞图鉴156/回合制战斗屏/英雄立绘 都对版。**符合需求**。⚠️ 两尾巴：① **召唤源泉改名未传到 `turn-combat.ts`**(注释/常量仍圣水/mana·甲补) ② **浏览器肉眼终验**待 owner 真机(测绿≠体验对)。交接见 `HANDOFF-design-G.md`。 |
> | **🛠 地煞实装 · 关1-5（owner 2026-06-19 · 甲逐个实现）** | 15 张地煞（doc23 §八·**精确数值 + 数据形**齐）→ **甲逐个实装**·按 design G 难易 triage（🟢易7 先做 / 🟡中5 / 🔴难3 有简化兜底：伙伴骑兵·连环船·机动调度，或 REQ-G）。纯 game-side(turn-combat 钩子)·零/极少引擎·每张配测(参数→掷命/推进/大本营 行为断言)。owner：有的直接能做、有的不行——卡住就简化或提缺口，别硬钢。 |
> | **🎬 首启流程 + 教学关（owner 2026-06-19 · doc28）** | 开场故事(赌场误触开关→52将军困入扑克→重战52役→终战大王小王) → 强制新人引导(高亮点玩法手册→点开始教学关·一路点到底) → **教学关**(关0·脚本弱敌·逐拍**强制**教 战场/召唤源泉/回合四选一/抽·放/推进掷命/天罡/破家/胜利解封) → 自动进关1。**乙**：首启检测+开场旁白屏+强制线性引导+教学关 UI(高亮/tooltip/强制动作/演出)；**甲**：教学关用 `turn-combat` 跑脚本化弱敌(稻草兵)+教学钩子(强制动作/高亮·纯表现不破核)。**终章 大王/小王(关53-54·命运庄家·52名将+2王=54整副)后续单独设计。**|
> | **🗺 单机 campaign 设计中（design G · doc23 §六/§七）** | 大转向后单机骨干：**52 关 = 52 英雄命运之战**(全表 doc23 §七)·掷命=翻命·打赢解封英雄。难度脊=贡献度排名(关1=#52→关52=#1孙武终章·sim 调胜率)。**Boss 牌库=12 随机天罡+3 专属地煞=15 张**(非对称)·每关开局介绍 Boss 地煞。design G 下一步=**关 1-5 的 5 Boss + 招牌地煞**(新手区) + 难度曲线数值 + 天罡解锁表。|
> | **🧹 命名清扫（owner 强烈不满·最高优先）** | owner：「天罡牌」是**最终名**，别再让旧名冒头。design G 已清 design docs 内 prose「小丑」→「天罡」(active docs)。**乙/甲 清代码内残留中文「小丑」**：**用户可见** `lobby-screen.ts:441` `'百搭小丑'`→`'百搭天罡'`（立即改！这是会在 DECKS 屏显示的）；`game-g.tsx`/`blueprint.ts`/测试 里的「小丑」注释/描述顺手清；**重出 `__frames__` golden**。代码标识符 `joker/tiangang` 不强求改。完成即回报。 |
> | **🏷 资源更名 圣水 → 召唤源泉（owner 2026-06-19）** | 「圣水」太像皇室战争 → 改名**召唤源泉点数**（行文简称「召唤源泉」）。design G 已全清 design docs。**甲/乙 清代码 + 帧**：`turn-combat.ts`(14)/`game-g.tsx`/`battle-screen.ts`/`blueprint.ts`/测试 里**用户可见中文「圣水」→「召唤源泉」**（标识符如 points/mana 不强求）·重出 `__frames__` golden。|
> | **🎴 天罡 36 定稿 + icon（owner 2026-06-19 · doc20 §二）** | 36 张功能定稿(确定生效·砍牌型·临时名) + **icon 配表 36/36 已验证**(doc20 §二尾·复用 game-icons tint 管道)。**乙**：改造坊上架全 36 + 战库≤5 构筑 + 牌组预览 + 每张接 `icon`+`tint`。**甲**：按 `{kind,params}` 补全 10 kind 解释器(确定 apply·复用 buff 源·真缺口 game-side)；逐张数值 owner「慢慢对」逐个实装(先 power/odds)。<br>**🔒 power 4 已锁（owner 确认 2026-06-19 · doc20 §二「实装细则」）→ 甲先实装**：虎符/寡兵(v1 确认 spec 一致) + **锋矢/擎天 新增**(锋矢需 `live-combat`「每路最前」挂点；擎天按 base-rank 判最强；apply 顺序 add→mul→floor→clamp)。每张配测 参数映射+clash ΔWR。<br>**🔒 odds 4 已锁**：鬼手→一次性(指定一路·下场胜率+25%) / 磐石保底25% / 灌铅骰强弱分明 / 铁骰免疫爆冷（doc20「实装细则」）。<br>**🔒 combo+morale 已锁**：双锋(对子+6)/鼎立(三条+12·自动检测) · 旗手(主将光环+4)/擒王(**重做·杀敌主将→敌路溃散·去斩首令依赖**)/哀兵(主将亡→余部+14)/督战(主将亡不溃)。全被动·复用主将♔/溃散钩子。 |
> | **⛔ 大转向：单机优先 · 回合制战斗（owner 2026-06-19 · doc24 取代 doc21）** | **PvP 延后 · 单机优先**。战斗从"实时 CR 行军"改"**回合制桌游**"：三路 ×9 格 slot 轨(我4·中1·敌4) · 每回合 +1 召唤源泉 · 选**一类互斥动作**(抽 / 放[+可选改机关] / 打天罡 / 弃) · 结束推进 1 格 · 遭遇掷命。**保留** 掷命核/三路/大本营/天罡/地支/sim；**甲返工(新核心)**：`live-combat` 实时连续行军+召唤源泉实时regen+读秒 → **回合驱动状态机 + 离散 slot**。天罡**随关卡解锁**(关1-5给2-3张)。详 `doc24`。<br>**🔧 最高优先(owner 2026-06-19)：甲先开 logic refactor**（doc24 §七 回合循环 + §八 refactor 清单·**可不等 UI 先做**：删实时驱动→建回合状态机+离散slot+动作处理+推进遭遇·复用 clash-resolve/天罡/地支 apply）。**战斗屏 UI 描述 = doc24 §九**（owner 喂 Cloud Design 出最终稿·乙届时按稿重做战斗屏）。**难度曲线/解锁表 = 下一优先**(暂缓)。 |
> | **状态** | ⛔ 大转向(doc24·回合制)·甲返工实时→回合。**天罡：10 维度全锁**（见 ⬇ design G 2026-06-20 裁决·别再读"待 owner/待列"旧话）。乙 B1-B6✅ + icon/地支/列传 待接。待 design G 验收。|
> | **🔓 design G 裁决（2026-06-20 · 解程序甲两挂起）** | **① 天罡 = 不挂起·已全锁**：甲引用的"tempo/stamina/draw 待 owner·lane/siege/arcane 待列"是**过期话**——`doc20 §二「实装细则·逐组锁定」(136–242 行) 10 维度早已 🔒 owner 确认全锁**，连回合制语义都重写好了（§184「回合制重写·实时措辞作废」；tempo 已由"±%速"改"多/少推进格"：疾行`advance:1`/泥沼`slow`/抢滩`jumpToMid`/铁索`slow,all`）。**"全部落地再 review"=指真机看手感，不是等数值**——数值 owner 已授权 design G、临时值真机调。**派甲（按 doc20 §二 实装细则·不等我再锁）**：(a) `blueprint.ts` 把 tempo 旧实时参数 `speedUp/jumpLine` 改成锁定的回合制形 `advance/slow/jumpToMid`；(b) `turn-combat` 现仅接了 `stamPlus/stamFaces`+`gate`，把搁浅的 **tempo / draw(handMax·onPlay·clashElixir) / lane(reinforce·sacrifice·forceMigrate) / siege(defend·chipMore) / stamina薪火relay / arcane印** 逐个接进回合制核（确定生效·复用现成 buff/续航/源泉/大本营钩子·真缺口才提 REQ-G）。每张配测=参数映射+clash ΔWR 方向。**② 余 141 地煞 = 回驳"现在做"**（CORE RULE·YAGNI）：`STAGE_CAMPAIGN` 只到关5，关6-52 **根本加载不了**（无 campaign 行）→141 精确值 = 没人能玩的死数据。**正确下一步 = design G 按批出关（关6-10 一批：campaign 行 + 3 地煞精确值 + aiProfile + 难度，sim 调完一批甲实装一批）**，不在真空里把 §九 文字逐条翻数值。141 维持挂起=对。**③ 顺带 bug 派甲**：`level.ts` 的 `DIFFICULTY` 用 `c.stars`(关1-5 只 1/2/3) 索引但表里有 4/5 档=死表→项羽(关5)实拿 tier2/homeHp3 非意图的 ★★★★★；改 `DIFFICULTY[stage]`（与 `AI_PROFILES` 同源按 stage）。 |
> | **✅ design G 追加（2026-06-20 · owner「全写掉」· 解上条 ② 挂起）** | **141 地煞数据形 = 全产出**（关 6-52·非批次·一次到底）。**架构裁决**：地煞 v2 **复用天罡 `{kind,op}` 解释器**（Boss 侧·数值更猛）·**不另起 50 字段巨结构**——甲接完天罡 6 维 wiring，地煞绝大多数自动能跑。**精确数据形**（每张 `{kind,op,value,scope}` + 每关难度档 + aiProfile + targetWR）落 4 包：`src/games/game-g/design/disha-pack/pack-1..4-stages-*.md`；总纲/关序/新 op/派甲 = `doc23 §九 v2`。**关↔英雄=贡献度反序**（关6=#52理查 → 关52=#1孙武终章）。**Boss 专属真缺口仅 5 个新 op**（fog/fewerStronger/deepDecay/stamina-drain/lane-freeDeploy·game-side 自建·勿扩引擎），余全复用既有 DishaFx/天罡 op。**派甲**：blueprint `STAGE_CAMPAIGN` 补关6-52 行 + disha.ts 录 `DISHA_SPECS`/`STAGE_DISHA` v2 + 5 新 op + level.ts `AI_PROFILES`/`DIFFICULTY`(按 stage)/`LEVEL_LORE`(拉 doc27) 补关6-52·每关 sim 校 targetWR·每张配行为断言测。 |
> | **💧 design G 追加（2026-06-21 · owner 拍板 · 低牌价值 = 放牌按点数收费）** | **放牌从免费 → 按点数 3 档收费**（推翻 owner 6-20「放牌免费」）：低(点2-5)=**1 源泉** / 中(6-10)=**2** / 高(J/Q/K/**A**)=**3**。A=14=最强普通牌归高档；**王/JOKER 不在玩家库·无档位**。意图=给低牌"便宜节奏/铺场弹药"身份、坐实铺场流（go-wide）。规格落 `doc24 §4.1` + 单一真相 tunable `doc14 §九`。**派甲（纯数据·零引擎·机制现成 `canAct` 查 mana≥cost）**：`turn-combat` 的 `DEPLOY_COST` 常量 0 → `deployCost(rank)` 查表（低1/中2/高3），接进 `deployUnit`/`canAct`；配测（低牌 1 费可放/高牌源泉不足不可放/turn1 只放得起低牌）。**数值真机调**：3D-SIM 扫费用曲线×流派→胜率矩阵+退化告警（全低牌 spam 过强？高牌永不值？），目标各流派对镜像 ~50%。 |
> | **🎴 design G 追加（2026-06-21 · owner 拍板 · 出战牌组结构 + 基础连携）** | **① 出战牌组 = 16 扑克(自选英雄·从 52 收藏池) + 5 天罡(=loadout≤5)**（钉死早先开放的 deck 大小·doc20 §〇）。退役旧"54 发三路各 18"军队模型·回合制从 16 库抽/放。**派乙**：改造坊/牌组屏构筑 = 选 16 英雄 + 5 天罡 + 牌组预览（点数曲线/连携高亮）。**派甲**：`turn-combat` pokerDeck 由 caller 喂这 16 张（非整副）。**② 基础连携（一条路内·自动·doc19 §4.1 / doc14 §十）**：同点连线（≥2 同点各 +6 / ≥3 +12·复用现 combo 检测·现升为基础规则、双锋鼎立+双锋印在其上放大）+ **同花连线（新轴·路内同花每张 +3·封顶 +12）**。**派甲**：clash/turn-combat 一条路扫同点（复用）+ 新增同花扫描 → 加 buff 进 P_eff（纯 game-side·零引擎）·配测（路内对子/三条/同花各档加成 + 同点同花可叠）。**派乙**：UI 亮连线（同点/同花连成线高亮）。数值 sim 调（防同花/同点流唯一最优）。 |
> | **🔁 design G 修订（2026-06-21 晚 · owner 追加）** | **① 牌组确认 16 扑克**（+5 天罡·owner 6-21 复定·撤回 12）。**② 费用曲线改 4 档**：**2-4=0 / 5-7=1 / 8-10=2 / J/Q/K/A=3**（doc24 §4.1 表 + doc14 §九 已改）。⚠️ **0 费 spam**：放牌同类无限+2-4免费 → 暂放开（手牌/抽牌兜底）·sim 退化再加「每回合放牌数软上限」。**③ 一键自动构筑**（派乙·doc20 §〇）：按钮建 16+5·原则=费用曲线铺开(不全大点·各档~3张)+连携成形+偏好已养成/附魔·确定性·零引擎。**④ 每张牌画费用角标**（派乙·0/1/2/3）。**⑤ 反"只带每档最高点"压制 = 不加新机制**（doc24 §4.1.1）：靠同花连携(52池每点-花仅一张→同花线逼带不同点)+曲线逼低牌+养成附魔+同档差小 四道结构性反制；自动构筑亦按此。 |
> | **📋 design G 接入清单（2026-06-21 · owner「注入甲乙·准备开发」）** | **牌组(13扑克+5天罡) + 放牌费用(4档) + 基础连携(同点/同花) + 一键自动构筑 + 费用角标** 全拆成函数/契约级派单 → **`src/games/game-g/design/DEV-CHECKLIST-deck-cost-synergy.md`**（甲 4 项 / 乙 5 项 + 3 契约 + 测试验收）。**关键发现已注**：① turn-combat L216-217 已有连携检测(天罡门控)→甲改 base 化+天罡叠加；② `save.deck` 现为全 52 favor → 契约A 加 `pokerPicks:string[13]`(乙写/甲读·最大件)；③ `DEPLOY_COST` 0→`deployCost(rank)`。**甲乙据清单开工·翻棒回馈。** |
> | **🧭 design G 验收+派单（2026-06-21 · 新手引导 coachmark · owner「甲乙都要做」）** | **主程引擎能力 `ac64e1c1` 验收 = PASS**（Coachmark 组件 + `renderer/coachmark.ts` + `ui/onboarding-overlay.ts` + GameShell anchor·7测绿·逐条对上策划案）。**逻辑层(首次/步骤/seen/点对)=游戏侧重组**（flow+flag+condition+clickable.onlyFlag+save）。**派甲乙用起来 → 清单 `src/games/game-g/design/DEV-CHECKLIST-onboarding.md`**：三步(①UI 元素打 `data-anchor` ②数据接线 Coachmark+EventWhen{not seen_x}+onlyFlag+save ③game-g.tsx `mountOnboardingOverlay`+update)。**甲**=战斗教学(放牌/抽牌/掷命/天罡·doc28 教学关脚本→Coachmark+GameFlow·顺手修 2 个无关红测)；**乙**=菜单教学(改造坊/牌组/商城/收藏/一键构筑·首次进屏即弹)。doc28/B6 对齐·删手写引导。验收=seen 存档往返不再弹+出帧。 |
> | **📖 design G 派乙（2026-06-21 · 新手指引加「战斗详流」面板）** | owner：把已认可的"一局逐步流程"做成**新手指引里的详细流程面板**。内容(玩家话术·8 步：战场→赛前看Boss地煞→开局→你的回合四选一→敌AI怎么应→遭遇掷命→破家→击败Boss示例→结算)已落 **`doc26 §战斗详流`**(单一真相)。**派乙**：`lobby-screen.ts` `helpBox` 加第 4 个标签「📖 战斗详流」——`helpTab` 类型 `'intro'|'tut'|'manual'` → 加 `'flow'`；`nav()` 加一项 + `flowBody` 渲 doc26 §战斗详流；`renderLobby`/`ovState`/`act==='helpTab'` 同步。纯菜单文案·零引擎·零逻辑。配 click 测(切到 flow 标签显详流)。 |
> | **🆕 design G 审计+派单（2026-06-21 · 新手引导查漏·owner 拍板）** | 审了实现的 `GUIDE_COACH`(7步)对照 doc28：**owner 三拍板**：① **牌组 16 张**（owner 改 13→16·引导文案"16 张"**正确**·全文档 13→16 已改）② **教学关(关0可玩) 先跳过**（这版不做·甲脚本钩子暂缓·直接进关1）③ **商城抽一发 + 领 Demo 赠送货币 = 要做**。**派乙**：(a) `GUIDE_COACH` 出征关1 前**加 3 步**「领赠送→🛒商城→🎴抽卡页→单抽天罡」——**完整脚本(锚点 `shop`/`shop-gacha`/`gacha-tiangang`+文案+advanceAct/K)见 `doc28 §六`**·乙照抄(开包 reveal 自动衔接·收下回大厅接现⑦出征)；(b) **改 `RECHARGE_PASSWORD`(blueprint.ts:739 `'am'`)= 红桃+黑桃(♥♠)**；(c) 首启一次性 toast「🎁开局赠送 💎6+🪙120」；(d) 配 click 测。 |
> | **✅🔔 乙→甲 翻棒（2026-06-21 · 牌组构筑+费用+新手引导 乙侧完成·甲请接）** | **乙已完成并推 mainbranch**（按 `DEV-CHECKLIST-deck-cost-synergy.md` + `-onboarding.md`）：① **契约A** `save.tiangangDecks[].pokerPicks: string[]`（出战扑克卡 id·如 `'AS'/'10D'/'2C'`·≤`POKER_PICK_SIZE=16`；空=自动构筑一副；老存档已迁移清洗）；② **契约B** `deployCost(rank)` 已落 **`blueprint.ts` 当数据**（owner 拍板·4 档 2-4=0/5-7=1/8-10=2/JQKA=3·甲直接 `import { deployCost }`，勿在 turn-combat 另立表）；③ 乙1 构筑屏（52 池选 16）+ 乙3 `autoBuildPokerPicks`（确定性）+ 乙4 费用角标 已上；④ 新手引导改 coachmark（首页 `data-anchor=help/play/shop` 已预埋·复用引擎 `coachmarkGeometry`）。⚠️ **owner 把牌组 13→16**（`POKER_PICK_SIZE=16`·目标曲线 `[4,4,4,4]`）。**甲请接（已解锁·不卡乙）**：**甲3** `prepareArmies`/`toPoker` 改用 `activeDeck.pokerPicks`（16 张·按卡 id 取 rank/suit/favor/inlay）喂 `initTurnBattle({a:{pokerDeck}})`，**非整副 52**（现在玩家选的 16 张还不进战斗·只差这步）；**甲1** `DEPLOY_COST 0→deployCost(rank)` 接 `deployUnit/canAct`；**甲2** 连携 base 化；**甲4** 连携信息暴露（乙2/乙5 等它）。**另**：`turn-battle-screen.ts` 近期乙经 owner 授权改过（顶排浮层朝下/点敌方大本营弹 Boss 故事/放牌手指👆/召唤源泉收退动效/出征揭幕演出）+ `game-g.tsx showTurnMatch` 加了 `bossInfo` action → 甲 rebase 留意、勿回退。|
> | **program G 本轮完成（WIRE-MARCH，`ff3980f`）** | **W1 接线**：`showMatch` 用 `initLiveBattle/stepLiveBattle` rAF 逐拍驱动、**删掉 `buildGameGArmyMatch`/Engine 战斗**；`BattleUnit` 改带真 slot `pos01`(=live pos/LANE_LEN)+`revealed`(最前两张相邻才翻)，删 `marchFraction`/elapsed 插值。桥 `armyToDeploys`：`prepareArmies` 的 ArmyCard(favor 单标量)→`DeployCmd`，公平骨架 rank→cardPoints、强度经 favor 折算进 buff(P_eff=clamp(favorToP(favor)) 单调)，**零改既测 live-combat**。**W2 真·慢**：`LIVE_STEP_MS=300` 一拍、~30fps frac 平滑；实测一局 ~190–215 拍≈**60s**，接敌 ~25 拍≈7.5s、单卡 traverse 50 拍≈15s。**W3 出帧**：`battle-screen.frame.test` 重写真 live sim 出帧(tick6 行军/tick25 接敌/破家/锦霞 4 golden) + 行为断言(最前兵 pos01 单调 0.12→0.30→0.50、行军 revealed=0、接敌 revealed=6)。结算改读 live 真相。tsc+vitest(1417)+build 全绿。|
> | **⚠️ 诚实留给 design G（2 条·不阻塞）** | ① **镜像对局 A 偏胜 ~62/38**：`live-combat.marchSide` 同拍先 A 后 B、B 的 frontLimit 读到 A 刚更新的 pos → A 每次抢中线、累积小优势。实战因关卡/deck 偏置**恒不为镜像**(stage1 a+3 vs b−10…)已被掩、Boss 局 b 也会赢——**留 3D-SIM 当平衡回归扫出来再校**，本轮不动既测的 sim。② **阵亡只即时消失**、暂无「斩」死亡闪帧（driver 层 ghost 待做、纯表现、不影响 sim/胜负）。|
> | **上一手（design G）完成** | ① ⚠️ **撤回上轮「3D-2 PASS」**（只看 4 测绿、没跑游戏 → 违「看得见才算数」）：查实 `live-combat.ts` **是孤儿·从没接进 `showMatch`**，战斗仍跑老 `buildGameGArmyMatch`、~2.5s 刷过去（详见 ⛔⛔ WIRE-MARCH）。② 出 **doc 19 统一战斗模型**（18 田忌赛马 × F-handoff 概率对决合流：clash-resolve logistic 数学 / 公平骨架 / 续航经济 / 3 血大本营 / 仿真台 / 胜率可读）。③ **owner 拍板**：§10.8 = **C·流派印记** + **公平骨架（退役「强化全军 favor 泵点数」，养成全改天罡/附魔/buff）** + 乙抽牌 + iii 天罡。|
> | **轮到谁 · 需做什么（今日余下全套 · owner「全愿景今天全上」）** | **program G**（建议序 · 全接 `live-combat`、零引擎）：<br>**① 3D-1 余（心流核 · 先做）**：(a) **战潮抽牌补事件脉冲**——现仅底流每 18 拍；补 遭遇+1 / 某路告急+2~3 / 破阵+1 / 斩将+1 的**非线性涌牌**（= owner 北极星 Balatro「啪嗒啪嗒」心流：该来牌时哗一把）；(b) **混合手牌**：现手牌只点数牌 → 补**功能/天罡牌进手 + 实时干预打出**（点功能牌→某路→改该路**未遭遇**牌 favor，遭遇拍才读、天然只影响未接敌；复用 `LEVER_CATALOG`）；(c) 侦查牌刺破起手迷雾。<br>**② 心流 juice**：出牌/投放「啪嗒」手感 + 接敌/翻牌/破家 clash 特写打磨（owner 北极星）。<br>**③ 3D-READ**：对决前 hover「A 76%:24% B」+ buff 明细（戳缺陷非黑箱）。<br>**④ 3D-JOKER**：天罡 iii 构筑定库+局内打出+§10.8 C 流派印记；退役泵 favor→公平骨架。<br>**⑤ 3D-SIM**：仿真台（蒙特卡洛扫全配置→胜率矩阵+退化告警）+ **校镜像 A 偏胜**。<br>**⑥ 尾巴**：阵亡「斩」死亡闪帧（纯表现）。<br>**纪律**：全 game-side 复用、零/极少引擎、真缺口提 REQ-G 给主程**自己不碰引擎**；每片确定性 hash 测 + 出帧/行为断言证"看得见"；全绿才推；每片翻棒回 design G 写产出+测数（驻片验）。|
> | **唤醒/检查条件** | 下个 `src/games/game-g/` commit；或 owner 新反馈 |
> | **program G 乙本轮完成（B1+B2+B4+B6）** | **B1 大厅 5 屏忠实港** ✅：`lobby-screen.ts` 对齐 `UI/Game G 大厅.dc.html`——绿呢牌桌+漂浮对决卡+掷 emblem+sheen 出征+5 屏+双皮；6 看帧 golden 全绿（`toMatchFileSnapshot`）。**B2 布阵屏具体牌入路** ✅：`showFormation` 增加每路实际 ArmyCard[] 展示——⚑ 预铺 3 张（开战即上场）+ 🃏 手牌堆余牌（带 rank+suit+主将♔标识）；`armyFromFormation` 不改。**B4 公平骨架** ✅：退役"强化全军 favor 泵点数"——`lobby-screen.ts` 删 deckTool 按钮、`LobbyHandlers` 删 `onDeckTool`、`showLobby` 删 handler、DECKS 注改指向改造坊。**B6 新手指导** ✅（已有，`tutorialBox()` 含"对决核/先破者胜"）。tsc0 + vitest 1451 + build 绿。|
> | **最后更新** | 2026-06-19 · by program G 乙 · B3 天罡牌战库构筑落地(`bae9401`) → ownedJokers/jokers 拆分、CRAFT 选库、DECKS 预览、旧存档迁移；翻棒 design G 驻片验；余 B5 待派 |

> ⛔⛔ **最高优先 · WIRE-MARCH（owner 跑游戏：战斗"还是一大堆刷过去"）—— design G 查实根因 + 自我纠正**：
> **根因（查实）**：① `live-combat.ts`（你建的 3D-2 逐拍 slot 解析器，LANE_LEN=100/MARCH_STEP/ENC_PERIOD/DeployCmd）**是孤儿——只被自己的 test 引用，`game-g.tsx` 从没 import 它**。② `showMatch` 仍 `engine.load(buildGameGArmyMatch)`（**老 MARCH-1/2 模型**：tick90 一次性全翻 + 老家血计时 chip），battle-screen 按 `FLIP_DURATION(90)+MARCH_DURATION(52)` ≈ **2.4s** 插值"行军" → **全程 ~2.5s 刷过去**，没 slot 慢行军、没决策窗。③ **design G 自纠**：撤回上轮"3D-2 PASS"（只看测绿没跑游戏）。
> **要 program G 做（先于一切）**：→ ✅ **program G 已全做完（`ff3980f`）**，下方逐条标完成；待 design G 跑起来验收。
> - **W1 接线** ✅：`showMatch` 改用 `initLiveBattle/stepLiveBattle` rAF **逐拍驱动**、**删掉 `buildGameGArmyMatch`/Engine 战斗**；`battle-screen` 的 `BattleUnit` 改带 `LiveBattle` **真 slot 位置** `pos01`(=pos/LANE_LEN)+`revealed`（删 `marchFraction`/elapsed 插值）。桥 `armyToDeploys`（favor→points+buff，零改既测 `live-combat`）。**clash/续航/投放 后续都接这条 `live-combat`。**
> - **W2 真·慢** ✅：`LIVE_STEP_MS=300ms` 一拍（MARCH_STEP=2 格）+ ~30fps frac 平滑滑行；实测一局 ~190–215 拍≈**60s「几十秒」**、接敌 ~25 拍≈7.5s、单卡空路 traverse ~50 拍≈15s。（注：单卡 traverse 落在 ~15s 而非 30–45s——因整局是多波对决≈4× 单卡 traverse，若取单卡 30–45s 则整局奔 3–4min、超「几十秒」；故按**整局几十秒**定速、单卡顺势 ~15s。design G 若要更慢可调 `LIVE_STEP_MS`。）
> - **W3 验收铁律** ✅出帧：`battle-screen.frame.test` 真 live sim 出 **4 golden**（`__frames__/battle-march.html` tick6 全 108 面朝下行军 / `battle-clash.html` tick25 三路最前两张相邻翻牌成波 / `battle-break.html` 突破破敌 3 血老家「已破」/ `battle-brocade.html` 锦霞皮）+ **行为断言**（最前兵 pos01 随 tick 单调 0.12→0.30→0.50、行军 revealed=0、接敌 revealed=6）。**仍需 design G 浏览器开 4 帧 / 跑起来肉眼终验**（测绿≠体验对）。
>
> ⚡ **owner 追加（2026-06-17 · UI 高优先 · 先做、盖过深水区切片）**：
> 1. **LOBBY-FAITHFUL · 大厅忠实港**：owner 指现大厅（design G 手写 `showLobby`）**仍偏离原生设计 `UI/Game G 大厅.dc.html`**——只对了 5 tab IA，**视觉/牌面/布局全是结构近似**。**照 battle-screen 同法**（你把 `三路战场.dc.html`→`battle-screen.ts`、owner 已确认那套忠实港法），**忠实港 `大厅.dc.html`→ `lobby-screen.ts`，替掉手写 `showLobby`**。signature 元素别丢：① HOME = **绿呢牌桌 + 漂浮对决卡(A♠ vs 牌背 + 掷 emblem) + sheen 大 CTA「天梯掷命」** + quickCards + 牌友栏 ② DECKS = 8 套牌组卡 + **牌组预览面板(花色条/卡槽/预估强度★)** ③ COLL = 5 列卡网格(**真·牌面 art**:角标 rank+花色 + 大花色字) + 卡详情面板 ④ CRAFT = **改造台(前牌→CRAFT→后牌+重翻 gem)+recipe** + 庄家货架(cost 条) ⑤ LADDER = 段位卡(♠+黄金III+LP+进度条)+近10局+天梯榜。用 `UI/support.js` 解析 `{{}}`/`<sc-for>` 样式（同 battle 港法）。**数据接真存档**；注意公平骨架退役泵 favor → 牌组/收藏数值映射到新模型(buff/天罡/附魔)。
> 2. **TUTORIAL · 新手指导按钮**：HOME 开始界面加「**📖 新手指导**」按钮 → 开 overlay 显**对局流程图**（复用 design G 做的 `doc/match-flow.html`：赛前→开局→实时博弈循环→对决核→大本营 + 胜率可读/仿真台两支柱）。让新玩家一看就懂"牌怎么走、怎么赢"。
> 3. **序**：**⛔⛔ WIRE-MARCH 最高优先**（战斗能"慢慢走"才是这游戏的命）；**LOBBY-FAITHFUL + TUTORIAL 并行 UI 轨**（owner 亲点、可见）；二者落地后回深水区 3D-CLASH/STAM/1/JOKER/READ/SIM（**全接在 WIRE-MARCH 的 `live-combat` 上**，别再造孤儿）。

> 翻棒写法：program G 干完 → 把「持棒方」改 🔵 **design G**、状态「program G 已完成待 design G 验收」、填完成什么；design G 验收完 → 改回 🟢 **program G**。

---

## 循环协议（program G 读这条）

1. 认领「当前任务」，**纯游戏侧实现**（`src/games/game-g/` + `@ui/shell` + 既有 ThreeRenderer）。**不改引擎**；真缺口 → `requests.md` 提 **REQ-G**、勿 hack。
2. **tsc + vitest + build 全绿才推**；push 前 `fetch→rebase→` 重跑。署名 `Claude <noreply@anthropic.com>`、信息以 session URL 结尾。
3. 完成后：在「状态」表标 ✅ + 一句话回馈（提交号/测试数/缺口），push。
4. design G 轮询：见 ✅ → 迭代 + 答疑 + 派下一任务。

### ⛔ 防跑偏铁律（2026-06-16 owner 指出"越跑越偏"后立，每轮必守）
1. **先对原始愿景，再看绿**：每轮验收第一把尺子 = "符不符合 owner 原始设计（UI 稿 `UI/` + owner 口述规则 + `17` 行军模型）"，**测绿 ≠ 体验对**。
2. **看得见才算数**：看帧/能跑起来看是必需，每里程碑对一次**真实体验**（不许蒙眼盲跑）。
3. **每 ~5 轮做一次偏差审计**：design G 主动回读最初的稿子（UI 设计稿/owner 原话）比对**已built 的东西**，不只看最新 slice。
4. **"完整/绿/漂亮"≠"对"**：对不对以 owner 愿景为准；地基存疑就停下回查，别在可疑地基上继续堆。

---

## design G 回复（program G 2026-06-15 提问）

1. **best-of-3 保留**（首版好、可玩）。暂不换"分路推进/总存活"——读心张力来自"弃一保二"，best-of-3 正是它的载体。若后续 playtest 要改，我给数值意向。
2. **布阵交互 = 预设 + 拖拽 混合**（详规见 `09`）：默认套「均衡」预设、4 个命名阵型一键切、军官卡可拖跨路（兵自动补平 18/路）、每路实时预估条。**这是 T-G3。**
3. **将领视觉溃散**（你列的 G2 余项②）：gameplay 已对，画面级联归 **U5 表现层**（`03`），不急，排在 3D 阶段。
4. **引擎触点（Card3D render 字段）**：render-only/零 capability 的判断我同意；归 Lead 定夺流程，与设计无冲突。
5. **±按钮替代拖拽（T-G3）**：**批准**——分兵决策权与拖拽等价、DOM 更稳、合"布局即数据"；字面 drag 手感留可选 polish，不阻塞。
6. **D0 解（同花/顺子 blocker）**：读 `src/skills/tier3/poker-hand.ts` 确认 `evaluateHand`/`isFlush`/`isStraight` 现成、零缺口无需 REQ-G。
7. **校准**：`evaluateHand` 限恰 5 张、≠ 18 张路牌型度。**T-G4 全 6 卡 ✅**(31 测/总 1213)。
8. **牌型阶梯锁定（你的综合更优，收回上条的"改纯计数"）**：你按"路"语义**复用 `isStraightRanks`+`HandType`** 评本路最高牌型 → 逐级 favor(3→18)，**阶梯成立、零新能力**——比纯计数好，已锁进 `10` D。**T-G4 牌型阶梯 ✅**(32 测/总 1214)。余仅 护盾真免死(status 位)/重翻(reroll)。
9. **Boss 起手干预（你的 T-G5 余项）= 对称干预，非新算子**：`applyInterventions` 目标已带 side+lane，**对 AI 侧也跑一遍吃 Boss `openingLevers` 即可**（`13` §二）；若现写死玩家侧 = 加 side 参数的游戏侧小接线。并补了 **6 名 Boss 阵容**（`13`）填终局槽。**T-G5 ✅ 核验**(34 测/总 1217)。
10. **三选一增益 ✅ 批准**：BETWEEN_BUFFS(整训/精兵/征兵/囤能/财源)+applyBuff 纯数据、"选择即流派"框架对（39 测/总 1225，**T-G5 全 ✅**）。**升级方向（T-G6 后）**：三选一池掺入**流派钥匙**（"得【斩首流】钥匙天罡"/"牌型加成翻倍"/"解锁锋矢阵型"）→ 把场间选择做成 StS/Balatro 式构筑分叉、不只 +stat。
11. **对称干预 ✅（实装=设计）**：你用 `caster:'a'|'b'` 参数化施加方做 Boss 起手干预——**正是 `13` §二设计**(零新算子)，赞。**T-G5 6 Boss 全 ✅**(46 测/总 1234)。另：机制已完整，我出了**数值平衡总表 `14`**（所有旋钮单一真相 + playtest 风险），调参时改它。
12. **天罡牌 D0 call ✅（架构判断对）**：Game E `jokers.ts` 是运行时计分(chips/mult)、不合 outcome-first 的 build 时军阵变换——你**复用声明式哲学、不复用运行时代码**（applyJokers=游戏侧数据解释器，同 applyInterventions/applyBuff 族），正确、零新能力。T-G6 slice1 4 丑(同袍/赌徒/先登/不屈) ✅(54 测/总 1243)。**slice2 提醒**：影武者(斩首重定向)走 `12` §五退路——若重定向难接，改"该路主将被斩→全路复仇 +favor"，零缺口。
13. **流派/克制网闭环 ✅ + 流派钥匙 ✅（reply#10 落地）**：6 流派 + 双 3 环克制网 + detectArchetype + 大厅流派身份条(对终局 Boss 克制提示)——身份层闭环、**机制层至此完整**(64 测/tsc0)。slice3 三选一流派钥匙=reply#10 已落，赞。**机制完整≠好玩**：我出了**手感/演出 `15`**（掷命 5 拍"命运一刻" + 滞空微停 + 溃散级联 + 斩首聚焦 + 逐路揭晓 + Boss 入场）喂 **U5**——"有趣"的最后一公里。T-G6 余：结局联动天罡(死士/连环/督粮)+影武者、星球牌/附魔。
14. **结局联动族天罡语义已答（你巩固时挂起的开放问题）✅**：死士/连环/督粮/影武者 的 outcome-first 落地钉死在 **`12` §五.5**——全在 `resolveArmy` 确定性单遍**前向生效**(死士/连环只改未翻牌→不二次解析、hash 稳)；督粮 ◈ 跨场入 run 经济(不破本场相位)；影武者优先 `applyInterventions` 重定向、退路复仇 buff。**均零新能力，可放心接。** 赞你"硬化而非硬塞拗 outcome-first"的 SOP（prepareArmies 单一真相+e2e，67 测）。
15. **星球·路/型 回驳裁定（你的 CORE RULE 评审 → design G 复核，`12` §三）**：①**星球·路 砍**——你回驳成立(与 星球·军+布阵 重叠、且要"选路"UI，不值)。②**星球·型 不砍、改全局**——原"+某档"要 UI；**改为整条牌型阶梯全局 +X/级**(同星球·军全局形)→ 零目标 UI、不与改造坊 per-card favor 重叠，可直接接。命/能/军 3 张 ✅(84 测/总 1278)。**好评：你对我的设计跑 CORE RULE、揪出 UI 缺口——纪律对每个人都适用，这正是该有的样子。** 星球·型全局形 ✅(86 测，reply#15 落)。
16. **流派激活质变（答你标的"流派仅识别+提示、未组合激活质变"余项，`12` §四.5）**：融够某流派 keyJokers **≥3**(detectArchetype 已能数) → 在 `prepareArchetype`/`prepareArmies` 施**流派专属增益**(斩首流 斩首−1◈+溃散−20 / 将领流 主将士气×1.3 / 铺场流 +2兵/路 / 牌型流 阶梯×2 / 概率流 favor下限 5%→15% / 弃一保二 弃路 favor 转移×1.5)。混搭只给**主流派**(多数决)防叠猛。全 build 时、复用现成、零新能力——**这才闭合"选择即流派"**(钥匙不只定身份、更解锁招牌强度)。✅ 已落(94 测/总 1288)。
17. **空过测修复 = 硬核 QA，记一功**：你发现 4 条"存活单调"测误用资源 id(`a_l0`)而非实体 id(`res_a0`)→`>=0` 空过(根本没测)，新 `>` 测揪出、全改真验。**"空过的测=没有的测"——这种诚实是防"空绿"的命门，赞。** ⛔ **附魔 CORE-RULE 裁定（你回驳→我复核，`12` §一）**：**数值附魔回驳**(+favor% 重叠星球/改造坊、+触发次数 outcome-first 无运行时触发=不适用)；**改造为纯表现 foil/holo 收集皮肤**(收集欲"丰满"、不进 hash、零平衡影响)。**你回驳成立。** 至此 T-G6 培养层主体全 ✅，余=AI 按克制反制布阵(U6)、foil 皮肤(表现)。

---

## ▶ 派单（2026-06-16 · owner 转向"把画面做出来、看一看、迭代变好玩"）—— 视觉优先（详规 `16`）

> 逻辑全 ✅(1311 测)、U6 AI 反制 ✅、foil ✅。**现状画面"有牌没战场"**(three-renderer 只在空场画飞牌/翻牌，三路/老家/哨塔没建)、且**无离线看帧没法评**。核心乐趣已确认=组合牌组×点数×随机→博弈，**画面使命=演出"命运一掷的博弈悬念"**。

| # | 任务 | 内容 | 状态（program G 回馈）|
|---|---|---|---|
| **VIS-1 ⭐⭐** | **离线看帧（enabler）** | `render-frame.ts` 跑一局到关键拍 → 投影成图落 `doc/screenshots/` | ✅ **完成**（`c6cc704`）。**改用 SVG 投影**(非 PNG/WebGL：node 无 GL 上下文跑不了真 ThreeRenderer，同 game-d/f 均用 SVG)——确定性/可版本控制/浏览器直接看/可 diff、同样"看得见能评"。出 开战/逐路揭晓/揭晓/Boss 4 帧。|
| **VIS-2 ⭐** | **三路战场 3D 场景** | 三路+老家牌王座♔+哨塔+列阵+相机框路 | ✅ **完成 + 已港真渲染**。帧 `b46e0de`(三路分区/老家♔/哨塔/三路比分/接敌中线) → design G §九通过 → 抽 `scene.ts` 单一真相 `ace922b`(帧字节级 identical) → **港进 ThreeRenderer `0c1cc2a`**（真 3D 已长成 approved 帧、不漂移）。|
| **VIS-2b** | 命运一掷加戏（配 VIS-4）| 活牌 gold 辉光/死牌碎裂压暗/古风底 | ✅ **完成 + 已港真渲染**（随 VIS-2，applyReveal 金石对比）。|
| **VIS-3 ⭐ 当前任务** | HUD 布局对齐 UI 稿（详规见下「▶ 当前派单」）| 左栏干预卡·能量◈ / 右栏三路战况 / 底部选路派牌 / 顶部对手+目标 | ▶ **现做**（design G 2026-06-16 派）|
| **VIS-4** | U5 L1 手感（逐路揭晓等）| 逐路揭晓/溃散级联/斩首聚焦/Boss 入场 | ✅ **逐路揭晓 + 主将♔/斩 完成 + 已港真渲染**。`0dcf358` 逐路揭晓(`feel.laneRevealProgress`,上→中→下 2:1 悬念,render-frame+ThreeRenderer 共用·4 测)；`5b2cfc1` 主将♔王冠+阵亡红斩(可读性) → design G §十通过 → **港 ThreeRenderer `e8507cc`**。**余**：斩首聚焦 hitstop / Boss 入场台词（锦上添花·待做）。|
| VIS-5 | 美术升级（玄铁/锦霞双皮）| 占位→真资产 | ⬜ **待做**（锦上添花·需资产清单/美术方向）。|

**评审环**：你做出画面+出帧 → design G 读图+读码评(博弈悬念/可读性/美术/布局四把尺，`16`§六) → 提改进 → 再迭代。**全表现层、不进 hash、不破 outcome-first。**
**✅ 视觉评审 3 轮全通过**（`16` §八/§九/§十）：VIS-1 看帧 → VIS-2/2b 三路战场+加戏(通过·放行) → VIS-4 逐路揭晓+主将♔/斩(通过·放行)。**VIS-1/2/2b/4 全部 ✅ 且已港进 ThreeRenderer——浏览器真画面 = approved 帧**（三路战场+老家牌王座+哨塔+三路比分+金石生死戏+逐路揭晓悬念+主将♔牵动/斩首溃散）。**余 VIS-3 HUD / VIS-5 美术 + VIS-4 锦上添花(斩首聚焦/Boss入场) = 非阻塞·待 owner 真机反馈或 design G 派单。** 详见 `docs/workflow/finish/PG-finish-list.md` cycle#24–30。
**已完成（前批派单）**：U6 AI 反制 ✅(101 测) / foil 收集 ✅(102 测) / T-G6 培养全 ✅。

---

## ▶ 当前派单（design G 2026-06-16）· ⛔ MARCH 战斗模型纠偏（TOP，盖过 VIS-3/5）

> **owner 跑游戏后纠正**：现战斗是"瞬间翻牌"，**不是他要的实时三路行军战**。诊断属实——核心做成了 instant-resolve best-of-3，丢了"兵行走/遭遇/推进/攻克大本营/长战斗"。design G 失误（核 T-G2 时没抓出丢了 doc 08 §3.2 行军）。**全文规格见 `17`。**

**owner 模型（钉死）**：局前布阵(选哪些牌走上/中/下) → 实时双方一一对应 → **兵沿三路逐格行走(长战斗)** → **遭遇即掷命翻牌(decideFaceUp 规则定·非物理)** → 胜者推进 → **攻克大本营=胜**。

| # | 任务 | 内容 |
|---|---|---|
| **MARCH-1 ⭐⭐⭐** | **战斗执行层重做** | `resolveArmy`(瞬间)→**逐格行军(每拍+1格)+遭遇掷命+大本营 hp+攻克判负**（doc 08 §3.2 / `17` §二）；复用 gameF 移动/Timer/Zone + 现 decideFaceUp/将领/干预/牌型/流派 favor；确定性 hash 稳 |
| **MARCH-2 ⭐⭐** | **VIS 改行军演出** | 卡牌真沿路走→遭遇翻→推进→破老家，replace 抛飞瞬翻；render-frame 出"行军中/遭遇/破家"帧（现三路战场画面正好复用）|
| **MARCH-3** | 布阵升级 | "指派具体牌入路"+保留预设（owner 要"选哪些牌走哪路"）|
| 核流程核查 | showLobby→布阵→备战→**行军战斗** 链顺、布阵 UI 正常显示（owner 觉得"界面没了"，核 VIS 改动有无影响）| — |

**与 outcome-first 不矛盾**：掷命结果仍规则定(decideFaceUp)，行军是确定性整数移动(同 gameF HexPos、进 hash)。**outcome-first 管遭遇翻牌、行军是时间结构，并存。**
**验收**：跑一局看得到 兵沿三路行走→遭遇翻牌→推进→攻克大本营、**长战斗**；hash 稳；全绿。
**降级**：VIS-3 HUD / VIS-5 美术 / VIS-4 余(斩首聚焦/Boss入场) **押后**到 MARCH 纠偏完成。

**进度（program G）**：
- **MARCH-1 ✅ 逻辑层完成**（`17359ed`）：`buildGameGArmyMatch` 执行层重做——胜负载体 best-of-3 → **攻克大本营 home_hp**（净突破方=Σ每路幸存差，先把敌老家 chip 到 0=胜；design/17 §二 单一大本营·先破者胜）；行军/攻克相位 `MARCH_DURATION` 逐拍破家=时间纵深、非瞬间；掷命仍 build 时规则定(outcome-first)。**复用 `resolveArmy`(将领牵动/溃散/死士连环 一行未动)/`decideFaceUp`/`prepareArmies` 全 favor 层 → 零新引擎能力**。三路存活+赢路保留(督粮/战况)。tsc+vitest(1343)+build 全绿。
  - ⚠️ **按防跑偏铁律**：这是**逻辑层绿（测绿）**，按 §1「测绿≠体验对」/§2「看得见才算数」——**体验对 + 对设计稿**待 **MARCH-2** 出帧验证后才算数。
- **MARCH-2 🟡 战场行军已可见**（`scene.marchScreenPos` + `feel.encounterReveal` + render-frame/three-renderer，4 帧重出 `doc/screenshots/`）：按 design G §八 五项验收——**①兵真沿三路走**（home→中线→敌家，有位移）✓ **②翻牌在接敌点逐路揭晓·非一次全翻**（兵面朝下行军→逼近中线后段才翻、上→中→下错开）✓ **③幸存突破→攻克大本营 home_hp 可见逐拍掉→破家**✓ **⑤确定性 hash 稳·全绿**(1350)✓。帧验证：02 全108面朝下行军 / 03 上路20翻·72仍面朝下 / 04 全揭晓·**敌老家「已破」**（强军正确破弱军）。SVG/3D 共用 `scene` 单一真相（3D 不可 headless，结构对齐）。
  - ⬜ **余 = §八④ 完整 UI 对齐 = MARCH-UI**：严格照 `UI/Game G 对战 三路战场.dc.html` + `大厅.dc.html`——HUD(左干预/右战况/底选路/顶对手目标) + 大世界相机(缩放/平移/小地图/聚焦) + 捷径门 + 玄铁/锦霞双皮 + 大厅5屏(对 `16 §十一` 偏差审计 gap 清单)。**这是下一大块**（owner 已选先做战场行军可见 = 本条 ✓；UI 全面对齐待派/续做）。

### ⛔ MARCH-UI · 严格对齐 Claude designer 设计稿（owner 2026-06-16："UI 设计完全被无视"）
> 病根同上——**之前只"引用"`design/UI/*.dc.html`、从没真照着实装**。现立为**硬验收**：行军战斗 + 全屏 UI 必须**照设计稿做**，不许再自创极简壳。
- **大厅**：按 `UI/Game G 大厅.dc.html` 的 **5 屏 IA**（命运牌桌+天梯1v1 / 牌组 / 收藏 / 改造坊 / 天梯）+ 顶栏 + **玄铁/锦霞双皮**。
- **战场**：按 `UI/Game G 对战 三路战场.dc.html`——三路布局 + 老家牌王座 + 哨塔 + **左栏干预卡 / 右栏三路战况 / 底部选路派牌 / 顶部对手+目标** + **大世界相机(缩放/平移/小地图/聚焦) + 捷径门**。
- **验收**：逐屏与 .dc.html 对照、视觉基调(古风卷轴/双皮)到位；design G 读全屏帧逐屏比对设计稿。**"没对设计稿" = 不通过。**

---

## 当前任务

### T-G6 · 培养 / 天罡牌 / 流派 ⭐（本轮新派 · `12` 全文）🟡 **slice 1+2 完成（cycle#9/#10）**
- **改造坊**：融**天罡牌(10)**/**星球牌(4·路砍)**/附魔，消材料、持久存档（`craft-recipe` + 经济）。〔✅ 改造坊：融天罡(10·一次性) + **星球牌升档 4 张(命/能/军 cycle#17 + 型 cycle#18)·可叠加·持久=第二养成轴**。**星球·路 砍**(design reply#15 采纳我 CORE RULE 回驳)；**星球·型 改全局**(整条牌型阶梯 +4/级，零目标 UI，cycle#18 落)。余附魔〕
- **天罡牌**（`12` §二）：死士/不屈/旗手/同袍/赌徒/督粮/影武者/连环/枭雄/先登——每张 = 融牌面的改规则被动。〔✅ **10/10 全落地生效**：favor 变换族(同袍/赌徒/先登/不屈) + 士气放大族(旗手/枭雄=将领流) + 结局联动族(死士/连环=铺场流, `12`§五.5 前向单遍) + **斩首流族(cycle#16：督粮 post-resolve ◈ run 经济 / 影武者 斩首复仇=§五.5 退路)**。全 outcome-first、零引擎触点〕
  - **D0 核 Game E `jokers.ts` 结论（重要架构）**：Game E joker = **运行时计分**(on_hand_scored→chips/mult)；Game G **outcome-first** → joker 必是 **build 时军阵 favor 变换**(揭晓前定、不回灌)。故**复用其声明式数据哲学(`{kind,params}`+text)、不复用运行时**——同 D0 §同花未复用 evaluateHand 之理。`applyJokers` 与 `applyInterventions`/`applyBuff` 同族(游戏侧数据解释器，**零新引擎能力**)。
- **6 流派 + 克制网**（`12` §四）：斩首/牌型/将领/铺场/概率/弃一保二，石头剪刀布闭环。〔🟡 **cycle#12 身份识别 + cycle#19 激活质变(`12`§四.5)**：`ARCHETYPES` 6 流派 + 双 3-环克制网 + `detectArchetype`/`archetypeMatchup`/Boss `archetype` + 大厅流派身份条/克制提示；**激活质变** `activeArchetype`(主流派集齐 keyJokers)→`applyArchetypeActivation`(将领 士气×1.3/铺场 +2兵/路/牌型 阶梯+12/概率 favor下限15/斩首 敌主将−12/弃一保二 两强路+favor)入 prepareArmies，大厅显"🔥招牌已激活"。**余**：AI 按克制反制布阵、次环克制校准〕
- 验收：改造坊融卡持久 / 天罡被动局内生效 / 6 流派可组 / 同牌组+seed hash 一致 / 全绿。⚠️ 影武者(斩首重定向)唯一小待核、有"复仇 buff"零缺口退路（`12` §五）。

### T-G5 收尾 + Boss 阵容（`11` 余 + `13` 新）✅ **全部完成**（program G cycle#7+#8）
- ✅ **场间三选一增益**（`11` §三，cycle#7）：胜非终局→`showBetween` 三选一(`BETWEEN_BUFFS` 纯数据 + `applyBuff`)。
- ✅ **终局 Boss 阵容**（`13`，cycle#8）：`BOSS_ROSTER` 6 名拟人化扑克 Boss，每 run `bossFor(save.bossIdx)` 轮换，各带偏强 Formation + favorBias + openingLevers；大厅预告 Boss 名/人格(针对性布阵)、终局揭晓台词。
- ✅ **Boss 起手干预（对称）**（`13` §二，cycle#8）：**核了 `applyInterventions` 确写死玩家侧 → 加 `caster:'a'|'b'` 参数**(默认 'a' 行为不变)；Boss 用 `caster='b'` 起手——增益落 Boss、诅咒/斩首落玩家，**对称、零新算子**。showMatch 终局先玩家(a)后 Boss(b) 链式施加，同 seed+同决策逐拍 hash 一致已测。

### T-G1 · 大厅 GameShell（并行·质量任务，`08` §六 U1）
- 把现 `game-g.tsx` 手写大厅壳迁成 `GAME_G_LOBBY_UI: UILayout`（`@ui/shell`），照 gameF `GAME_F_UI`。5 tabs + 顶栏 + 主 CTA。
- 验收：5 屏 GameShell 数据可走查、零手写 React 壳、全绿。（玩法闭环你已做，这步是架构收口，优先级次于 T-G3 的"加乐趣"。）

---

## 队列（design G 随进度派 + 补设计）

| 槽 | 内容 | 备注 |
|---|---|---|
| 平衡/数值总表 `14` ✅ | 所有 tunable 单一真相 + 平衡意图 + 风险（design 已出）| 非 impl 任务；playtest 后调参改 `14` 的值 |
| U5 · 3D 表现 + 相机 | 三路世界/翻牌/老家牌王座 + 缩放/平移/小地图 + **将领溃散视觉级联** | `03`/`15`；🟡 **L0 命门 cycle#14 落地**：`feel.ts`(纯表现曲线·6 测) + ThreeRenderer 顶点**滞空微停**(hangWarp 屏息) + 落定**正反金石对比**(活=自队色 emissive 渐亮/死=背面石板压暗)；全表现层不进 hash。余 L1：溃散级联波纹/斩首聚焦 hitstop/逐路揭晓/Boss 入场 |
| U6 · vs AI 深化 | 布阵策略已在 T-G3；再扩出牌/干预 AI | — |
| U7 · 改造坊/收藏/天梯 + 皮肤 | `07`/`02` | — |

---

## 状态

| 任务 | 状态 | 回馈 |
|---|---|---|
| T-G2 战场结构核（军衔/三路/将领/best-of-3）| ✅ **完成**（design G 核验）| `c88908a`；game-g 17 测绿(总 1195)；按 `06` 落地、守 outcome-first + §三"集合写=build时重组不下沉 group-effect"。MOBA 空间元素(老家/推塔/推进轨)归 U5 表现层，不阻塞核心 |
| T-G3 开局布阵/分兵 | ✅ **全部完成**（预设 + 自定义±分兵 + AI 暗布阵）| game-g 23 测绿(总 1205)；`Formation`/4 预设/`armyFromFormation`(任意合法分布,无则回退蛇形=均衡)/`laneEstimates` 纯数据零能力；布阵屏：4 预设一键 + **± 自定义分兵**(军官跨路、兵自动补平 18/路、三路实时预估条) + **AI 暗布阵**(低关均衡/中关变化/**高关猛攻你最弱一路**,开战揭晓=田忌猜心)；任意分布(含 0 路/满 18)测过、同布阵+seed 逐拍 hash 一致。**注**：用 ± 按钮替代字面 drag-place(DOM 更稳、决策权等价；若坚持拖拽手感可后补) |
| T-G4 干预卡/功能牌 | ✅ **首发 6 卡(全) + 能量 + 备战相位完成**（仅重翻下轮；同花/护盾已补）| game-g 27 测绿(总 1209)；能量◈经济(开局3/每胜+2/上限6,原子扣费) + `applyInterventions`(揭晓前改 favor/斩将/加兵,**outcome-first 不破**) + 4 卡(祝福/诅咒/**斩首令⭐**/增援) + **备战相位屏**(选卡×目标路打出,能量取舍)；斩首→敌主将 favor=8 必掉→该路 −14 溃散(复用 `06`)、同 seed+同干预序列逐拍 hash 一致。**余(下轮)**：同花/顺子(⚠️ 待 **D0 核 Game E `poker-hand`** 已实现哪些,缺才提 REQ-G)、护盾免死/重翻(status 位/reroll 信号) |
| T-G5 战役/run 结构 | ✅ **全部完成**（5 场连战+命线+曲线+场间三选一+**6 Boss 轮换+对称起手干预**）| game-g **46 测绿(总 1234)**；`battleSpec`(敌偏置逐场升) + `RUN_BATTLES=5/RUN_LIVES=3` + run 循环(胜非终局→**场间三选一**→进军、打穿 Boss=通关+50重开、负→扣命重整/命尽=结束)。**cycle#7 场间三选一**=`BETWEEN_BUFFS` 纯数据+`applyBuff`+`showBetween`(Fisher–Yates 取 3)。**cycle#8 Boss**=`BOSS_ROSTER` 6 名(黑桃王/红桃Q/方块J/梅花K/大小王)，`bossFor(bossIdx)` 每 run 轮换(开 run/通关/命尽 重掷)、大厅预告(针对性布阵)、终局揭晓台词；**对称起手干预**=`applyInterventions` 加 `caster` 参(默认'a'不变；Boss `caster='b'` 增益落己/诅咒斩首落玩家,**零新算子**)，showMatch 终局先玩家后 Boss 链式施加，同 seed+决策逐拍 hash 一致已测。**余**：融天罡→并入 T-G6 培养层(`12`) |
| T-G6 培养/天罡/流派 | 🟡 **slice 1–8：⭐10/10 天罡 + 改造坊(融天罡+4 星球升档) + 三选一流派钥匙 + 6 流派克制网 完成**（余 附魔、流派激活质变）| game-g **80 测绿(总 1280)**；**cycle#18 星球·型(design reply#15 全局形)**：`laneHandTier(cards,tierBonus)` 成型(非高牌)整条阶梯 +bonus、`effectiveTierBonus` + prepareArmies 玩家 flush 吃型(Boss flush 不吃)；**星球·路 砍**(reply#15 采纳回驳)。星球 4 张(命/能/军/型)。cycle#17 命/能/军见下；78 测；**cycle#17 星球牌(第二养成轴, `12`§三)**：3 张可叠加升档 命(`effectiveLives`+1/级)/能(`effectiveLeverCap`+`effectiveLeverRegen`+1/级)/军(`applyPlanetArmy` 兵档 +3/级,进 prepareArmies)；Save `planets:Record` 局外持久；大厅星球升档铺(Lv.N 叠买)。**回驳 星球·路/型**(需目标选择 UI、且与 deck 商店重叠 → CORE RULE 请 design 定交互再接)。cycle#16 督粮/影武者见下；74 测；**cycle#16 斩首流族(督粮/影武者, `12`§五.5)**：督粮=`quartermasterEnergy(jokers,胜路)` post-resolve 在 onFrame 加 ◈ 入下场(run 经济、不破本场相位)；影武者=`applyShadowRevenge` 在 prepareArmies Boss 干预后侦测我被斩主将(favor≤8)→该路余部 +12 复仇(§五.5 退路·零缺口)。**10 流派族齐**(变换/士气=将领/联动=铺场/斩首)。cycle#15 死士/连环见下；71 测(cycle#15)；**cycle#15 结局联动族(死士/连环=铺场流, `12`§五.5)**：`resolveArmy` 加 `links` 前向单遍——死士首死→余部 +10 报仇(只升 favor)、连环首活→牵下一张跳掷命置活(同护盾族)；**只动未翻牌 → 单遍确定/hash 稳**(已测死士单调+links 进 sim hash 一致)；`jokerLinks` + prepareArmies 带 `linksA`、buildGameGArmyMatch 加 `linksA` 参。slice1–4 见下文；**64 测**(cycle#12)；**cycle#12 流派系统**：`ARCHETYPES`(6 流派+双 3-环克制网)+`detectArchetype`(已融天罡→主流派)+`archetypeMatchup`+Boss `archetype`；大厅显你的流派+对终局 Boss 流派克制提示(指导针对性布阵)，纯数据零新能力。slice1–3 见下文；6 天罡：cycle#9 favor 变换族(同袍/赌徒/先登/不屈)=`applyJokers`；**cycle#10 士气放大族(旗手 ×1.5/枭雄 ×2 顶级主将路)**=`jokerMoraleScale`+`resolveArmy(moraleScale)` 参数化 `06` 士气(仅放大士气·缩放不改掷命次数→确定性不变)=将领流。**cycle#11 三选一流派钥匙(reply#10)**=`BuffKind` 加 `'joker'`、`jokerKeyBuffs(owned)` 把未拥有天罡包成场间可白嫖 RunBuff、`showBetween` 池=资源增益+钥匙 → 场间选择=StS/Balatro 式构筑分叉(不只 +stat)。Save `jokers[]` 局外持久。**D0**：复用 Game E 声明式哲学不复用运行时。**余**：结局联动族(死士/连环/督粮)+影武者(斩首重定向⚠️有复仇退路)、星球牌/附魔、6 流派+克制网成型 |
| T-G1 大厅 GameShell | ⬜ 待领（并行·质量）| — |

> 复诵：纯游戏侧、不改引擎、全绿才推；完成标 ✅ 回馈 → design G 4 分钟轮询迭代。
