# game-d 需求单（游戏域工单）

> 2026-07-15 立（owner 拍板「工单随游戏走·游戏可暂停」）：本游戏的 bug/玩法/演出/平衡工作票在此，
> 域主（程序/PE/design）自取自结，**不占主池 10 槽**（主池 `docs/workflow/requests.md` 只管引擎本身）。
> 标「控件缺口/引擎收编」的条目=引擎域候补——落地须走主池腾槽或 capgap 通道，游戏层不得自造。
> done 同提交删除条目（查 git 历史）；3D 线仍在 `docs/workflow/requests-3d.md`。

---

### REQ-D-物理骰确定性回收路径 · game-d 3D 掷骰结果由 cannon-es 物理决定=非确定性（记债·定回收约束） · [2026-07-04] · 主程（game-g/d 批 review 撞到 `throw3d.ts` 自曝注释） · status: **记债（owner 已拍「先做效果·原型阶段」·不阻塞）·回收路径已定死见下** · 优先级: P2（出货前必收） · 类型: 确定性红线豁免登记（时限性）
> **现状**：`game-d/throw3d.ts` 掷骰值由 cannon-es 刚体落定读面（render 层物理·非同步）→ game-d 的 seed/回放/分享种子失效（REQ-GAMED ① run-seed 工作被空置）；lockstep 双人未来不可行。owner 原型期豁免**有效**，但按宪法确定性红线必须登记回收路径，防"原型态默认转正"。
> **回收路径（Lead 定死·出货前二选一实施·P3D 域）**：A（业界标准做法·推荐）**值由种子 PRNG 先定，物理只演**——掷值来自 `RandomSeed` 流，cannon-es 自由翻滚，落定瞬间按目标值做姿态对齐（quaternion snap/最后一帧修正·玩家不可感知）→ 效果保留·确定性全回收；B 物理保真派：录制固定初速/扭矩样本库（seed 选样本·回放同样本）→ 工程更贵。**验收线**：game-d 回归「同 seed 同结果」+ replay 测试，audit 裸随机红旗照常适用。出货 checklist（PS 内门）挂此单。

### REQ-GAMED-数据驱动迁移 · game-d《骰途》从手写 sim 迁成能力驱动（体检整改）· [2026-07-02] · P3D（game-d owner）→ 主程（引擎能力域） · status: **裁决完毕+能力已下沉（dice-roll/wild 已落·6-suit flush 契约测试已钉 `poker-hand.test.ts:404`）·game-d 接线=P3D 排队中** · 类型: 架构整改（数据驱动收口）· 设计 `docs/design/game-d/data-driven-migration.md`
>
> 体检核实属实：game-d 战斗/状态全手写 `S` 对象 + 纯函数，`capabilities:[]`、`Math.random()` 绕种子随机、手写 `loadoutPattern` 重造 poker-hand、双人假、0 测试。目标：照 game-e/game-f 迁成 blueprint（components + capabilities + signals + keybinds）+ 薄 session 编排。~80% 复用现有能力（poker-hand/card-scoring/effect-apply/event-when/mortal/flow/keybind/random）。
>
> **我方已自办（无新引擎工作·门禁绿 + 测试·本 session）**：① 种子化随机 + **run-seed 开局生成**（`RandomSeed`+`nextRandom` 替 `Math.random`·每局不同可出货·待接存档持久化）；② **仅展示函数** `loadoutPattern` 复用 `poker-hand`——**⚠️ 真轮子是战斗路径 `combat.ts detectPattern`（含百搭顶点/顶色·evaluateHand 无通配），此债未还**，待 §2 wild capability 后真替；先给 `detectPattern` 上全牌型行为测试作护栏；③ `game-d-sim.test.ts`(21 例)。
>
> **真缺口 → 请主程下沉成 capability（细节见设计文档 §真缺口）**：
> 1. **`dice-roll` capability（主缺口·最优先）**：读 `DicePool` + `RandomSeed`(+`LockMask` 只重掷未锁)·`Update` 相位写 `RolledDice`（早于 poker-eval）。现无「掷一个声明的骰池」的能力；poker-hand 只消费已填好的 `PlayedHand`。
> 2. **wild/百搭**：`evaluateHand` 无通配 → 扩 poker-hand wild 参数，或 dice-roll 归一化 wild。
> 3. **元素敏感对子**：敌「对子」=同元素+同值联合，poker-hand 按值 或 按花色单计 → 加 pairCount 变体或小 `dice-pattern`。
> 4. **敌反制禁骰**：`discardHighLow`（结算前禁 N 颗）无能力 → 数据化「结算前骰过滤」`DiceCounter{kind}`。
> 5. **6 色同花确认**：poker-hand flush 对 suit int 泛用（6 元素可跑），但 HandType/handMods 是扑克花色形 → 请主程确认复用 `isFlushFlag` 表 6 色同花是否在契约内，否则 `dice-pattern`。
> 6. **双人 co-op（netcode 缺口）**：真双人=lockstep 联机（种子已就绪，缺 netcode/房间/角色）。落地前双人按钮不该假装单机=双人。
>
> **主程填 1–5 后**：我把 `S` 迁成组件、规则迁成能力+数据、UI handlers 改信号、房间推进改 `flow`。6（netcode）另立框架级需求。
>
> **Lead 裁决（2026-07-02·主程·逐条核过引擎源码）** · status 更新: **裁决完毕——2 准 / 1 并入 / 1 回驳 / 1 确认在契约内 / 1 另立**：
> 1. **dice-roll capability：✅ 准（P0）**。真缺口核实（registry 78 项无任何骰 sim）。范围收窄 = 读 `DicePool`+`RandomSeed`(+`LockMask` 重掷未锁) → `Update` 相位写 `RolledDice`（早于 poker-eval）；**#4 并入本能力**做数据化 post-roll 过滤参数（`{kind:'banHighest'|'banLowest',n}`，由 foe 数据驱动）。设计约束：确定性、组件进闭集 component-map、**与 game-g 战力骰/对掷+平局阶梯一并规划成同一个骰能力族**（评审报告 §五 P0 项），防止两次下沉出两套不协调的骰能力。
> 2. **poker-hand wild：✅ 准**——核实 `poker-hand.ts` 确无通配。做成 `HandMods` 参数扩展（**非新能力**）；wild 求最优=小规模确定性枚举。**回驳"在 dice-roll 里归一化 wild"路线**：归一化即求解器，放错层——wild 的最优语义属于牌型评估。受益方还有 game-e（82 张未实装小丑含 wild 类），一次扩两家用。
> 3. **元素敏感对子：❌ 回驳（重组可表达）**——`pairCount` 已存在（`poker-hand.ts:182`），无需"加变体"。「同元素+同值」联合对子 = **复合 rank 编码**（`rank = element*16 + value`）后 `rankCounts`/`pairCount` 直接就是联合计数；同一手要再判顺子/纯值对子，就按原 value 编码**再跑一次 evaluateHand**——两次调用是数据重组，不是引擎缺口。等价写法已给，照此接线。
> 4. **敌反制禁骰：🔶 并入 #1**，不单立能力（防碎能力化）。
> 5. **6 色同花：✅ 确认在契约内**——`Card.suit` 是无约束 int（`cardboard.ts:46`），flush 按任意 suit 计数（`poker-hand.ts:86-100`），6 元素直接跑；schema describe 里的 "suit:0..3" 是文档不是枚举约束。**注意勿与 `suitMerge` 混用**（其红黑归并硬编码 4 花色，`poker-hand.ts:96`）。条件：主程会补一条 6-suit flush 契约测试进 poker-hand.test 钉死此契约。
> 6. **co-op netcode：⏫ 另立框架级需求**——与 game-f 多人（传输 REQ-018 + N 端 lockstep）**合并成一条 net 基建线**，一次建、两个游戏用；排期 owner 拍板。过渡要求照准且限期：**双人按钮先诚实标注（P3D 自己域内，立即可做）**。
>
> **附·整改复审打回三条（Lead 复核 188fbbf1，owner 已知情）**：① 种子写死 `20260702` 且无 run-seed 注入路径 → 每局骰运相同，**出货级 bug**：改为开局生成 run-seed、随存档保存；② "复用 poker-hand" 只替了展示用 `loadoutPattern`，**战斗路径 `detectPattern`（combat.ts:103）原封未动**且零测试——要么真替、要么先补测试，禁止两套并存长期化；③ 提交信息勿超售实际完成范围（会误导后续 session 的债务判断）。
>
> **主程下沉完成（2026-07-02·引擎域·门禁 tsc+vitest+build 三绿）**：**#1 ✅** `dice-roll` capability（`t2-dice-roll`）—— `DicePool`+`RandomSeed`(+`locked` 只重掷未锁) → Update 相位写 `RolledDice`；**#4 ✅ 已并入**（`DicePool.ban:{kind:'banHighest'|'banLowest',n}`，掷后标 `banned` 不移出、保下标对齐）；骰能力族纯函数 `opposedRoll(rng,pA,pB,tiePolicy)`（对掷平局阶梯 rollerWins/defenderWins/reroll）+ `rollDicePool`/`applyBanFilter` 下沉 `src/skills/tier2/dice.ts`（非 capability，先例 hex.ts）。**#2 ✅** poker-hand wild —— `Card.wild?:boolean`（内禀于牌、经 PlayedHand 自动流经 poker-eval，无新配置；裁量：不用 `HandMods.wildIndices`，因 poker-eval 无逐牌 flag 源、wild 是出牌内禀属性），`evaluateHand` 小规模确定性枚举求最优牌型（紧候选集+可重复组合，无 wild 逐字节等价旧行为）。**#5 ✅ 测试钉死** —— 6-suit flush 契约 + `suitMerge` 仅 4 花色语义（6-suit 禁用）契约用例进 `poker-hand.test.ts`。新增测试 24 例（dice 16 + dice-roll 8）+ poker 12 例。**#3/#6 不在本次范围**（元素对子=重组、netcode=另立）。**→ P3D 可开始接线**（game-d 把 `S` 迁组件、`RolledDice`→`PlayedHand` 映射、禁骰/wild 走数据；勿改 `src/skills`/`src/assembly` 引擎域）。
> 【Lead 追加 2026-07-04】顺手带一行活：`game-d.ts` `gd-start-t` 的 TODO(REQ-UI-ink) 切 `color:'ink'`（ink 令牌已落地·原单已结案归档 2026-07-04）。

### REQ-D-测试最薄面 · 全游戏仅 68 行单测·无 walkthrough·无确定性双跑·对抗清单零覆盖 · [2026-08-22] · Lead 立（全库测试评审 E 路实证·出口游戏中测试最薄） · **指派：P3D（game-d owner）** · status: open · 优先级: P2 · 类型: 测试护栏
> 现状=骰面/判型/rollPool 三件单元测试。缺：整局 walkthrough·同种子双跑逐字节复现（game-a 口径）·⚔ 对抗性输入六行（docs/playbooks/testing.md）一条都没有。另 REQ-D-物理骰确定性回收（记债·出货前必收）与此同面——补测时一并核销或重申记债。
