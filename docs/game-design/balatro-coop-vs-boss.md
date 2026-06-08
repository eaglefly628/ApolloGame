# 小丑牌·合作 vs Boss —— MVP 规格 + 能力评审（Lead 决议）

> 📊 **流程图（玩法 / 开发 / 系统架构，给 PE，GitHub 直接渲染）**：[`balatro-coop-flow.md`](./balatro-coop-flow.md)

> 在写任何游戏数据前先过纲领尺子：**每块机制 → 现有能力可组合就回驳、真表达不了才下沉新 capability。** 结论先行：**这游戏 ~90% 是现有能力重组，真缺口只有 1 个核心能力 `pattern-score`**（+1 个候选小助手）。这正是"游戏=数据"该有的样子。

## 0. MVP 范围（去风险的构建顺序）
- **MVP-0：单人 vs Boss 核心闭环**（先不联机）——打牌→认牌型出分→分数砸 Boss 血→Boss 每回合诅咒你→商店买小丑→Ante 升级。把"卡牌引擎 + Boss 循环"跑通。
- **MVP-1：加合作**——同一个确定性 World 里塞第二个玩家的实体 + lockstep 输入；两人同砸一个 Boss、Boss 同时诅咒两人。**因为是同一个 World，联机基本是"加一组实体 + 接现成输入层"，不是重写。**
- 刻意不做：1v1 PvP 平衡（那是后续）、顺序敏感小丑、长期 meta。

## 1. 能力评审（核心：接受 or 回驳，带理由）
| 需求 | 现有能力能否组合 | 裁决 |
|---|---|---|
| 认牌型→基础分（同花/葫芦/顺子…→ chips×mult） | 无能力能对"一组牌的花色/点数"求值 | 🔴 **真缺口 → 新能力 `pattern-score`**（见 §2） |
| 牌库/手牌/抽弃（确定性洗牌） | RandomSeed(确定RNG)+Tag/Relation(分区)+小系统 | 🟡 **候选小能力 `card-pile`**（广复用:任何摸牌/抽袋）；也可勉强重组，先评估 |
| 小丑修正（当X→+Y/×Y，**扁平**） | **Condition→Event→Effect**：event-when 读"本手牌型/flag"→ effect 改 mult/chips 资源 | 🟢 **回驳**：现成重组，小丑=纯数据 |
| 顺序敏感小丑（×2 再转乘、流经站数…） | 需"有序累加器折叠" | 🔵 新能力 `reduce-chain`，**MVP 缓做**（扁平小丑先顶；这是队列小丑方向） |
| 分数 → 砸 Boss 血 | effect-apply `modify-resource`（全局按 id） | 🟢 回驳：Boss 血 = 一个 Resource |
| Boss 诅咒（本回合同花不算/冻结小丑/塞废牌） | condition + Flag + effect-apply + Timer/State 排程 | 🟢 回驳：Boss = 数据（一张诅咒排程表） |
| 商店 / 经济 / 买小丑 | **craft-recipe**（够钱才成交、原子扣款 + 给小丑）+ Resource(钱) | 🟢 回驳：商店 = craft-recipe（game-c 缝制同款） |
| 回合 / 轮次 / Ante 升级 | State 机 + Timer + Condition | 🟢 回驳 |
| **合作联机（两人同打 Boss）** | **lockstep + queued-input + 确定性 World/hash**（引擎本就为此造） | 🟢 回驳：现成，加一组实体即可 |
| 跨玩家 / 定向效果（Boss 诅咒落到某玩家） | effect-apply 全局按 id 路由 | 🟢 回驳 |
| 卡牌 UI（手牌/拖拽出牌/小丑排/Boss 条） | Sprite/Text + clickable→Signal + 薄布局 | 🟠 **债提醒**：别写成巨型手写组件，尽量消解为"实体+clickable"数据，布局只做薄层 |

**裁决汇总**：真要新下沉的核心只有 **`pattern-score`**；`card-pile` 是候选小助手（评估后定）；`reduce-chain` MVP 缓做。**其余全部现有能力重组。**

## 2. 唯一核心新能力：`pattern-score`（契约草案）
**为什么非新不可**：现有 `ConditionExpr` 只能"按 id 读 resource/flag/state"，**无法对"一组牌的花色/点数多重集"求值**（"5 张同花""3+2 葫芦"）。认牌型是确定性算法 → 该进引擎；牌型表是数据 → 弱 LLM 也能填。过纲领尺子。
```jsonc
// 挂在"出牌区"实体上：
Component PatternScore {
  reads: "已打出的牌实体集（各带 Card{suit,rank}）",
  patterns: [                               // ← 数据：牌型表（可被任意弱 LLM 照填）
    { name:"flush",      when:"5 same suit",      chips:35, mult:4 },
    { name:"full_house", when:"3 of a kind + pair", chips:40, mult:4 },
    { name:"pair",       when:"2 same rank",      chips:10, mult:2 }
    // …命中最高优先级者 → 产出 ScorePacket{chips,mult}（写 Resource 或发 Signal 带 payload）
  ]
}
```
**唯一真正的引擎活** = 实现"牌多重集谓词"求值器（same-suit/n-of-a-kind/straight）。⚠️ 开工前必读 `wiki/skills/index.md` 对应分类（CLAUDE.md 规定），决定原子分解/命名，别另起炉灶。

## 3. 数据草图（其余皆数据）
```jsonc
card  = { Card:{ suit:"spade", rank:11 }, Sprite:{textureKey:"item/..."}, Clickable:{action:"play"} }
joker = { EventWhen:{ when:{handType:"flush"}, signal:"j_flush" },        // 扁平小丑=condition+effect
          Effect:{ onSignal:"j_flush", kind:"modify-resource", targetId:"mult", value:4 } }
boss  = { Resource:{id:"boss_hp", current:300}, Curse:{ schedule:[             // Boss=排程数据
            {turn:1, kind:"disable_handtype", value:"flush"},
            {turn:2, kind:"freeze_joker", value:"random"} ] } }
shop  = { CraftRecipe:{ onSignal:"buy_x", costs:[{id:"money",amount:6}], grantsFlag:"own_x" } }
信誉/血 = Resource；回合 = State+Timer；玩家2 = 同样一组实体 + 第二路 lockstep 输入。
```

## 4. 验收（合作=确定性，必须守）
- **MVP-0**：单人能打穿一个 Boss；ApolloBench 跑分（Structure/Load/Determinism/Numeric）过阈值。
- **MVP-1**：两玩家不同输入跑同一局 → **双端逐 tick 同 hash**（lockstep 不分叉）= 合作可联机的硬证据。
- 牌型求值器单测：各牌型识别正确、优先级对、确定。

## 4.5 ★ 核心乐趣支柱：有限协调（全公开 + 同时秘密承诺）
> 讨论定调，**全局最高乐趣纲领，取代前文任何"藏牌"措辞**。

**两条定调**
- **信息全公开（不藏牌）**：手牌/小丑/钱/Boss 意图全摆台面。理由：藏牌制造的是"互相通报手牌"的乏味流程、也正是**语音一开就破**的东西；全公开去掉乏味信息交换、聚焦"该怎么联手"的有趣决策，且可读/可观战/易上手。
- **唯一保密的不是信息，是"这拍的承诺"**：每拍双方在短倒计时内**各自秘密锁牌、同时翻开**。

**核心机制：分工型共鸣**
- 合击要求**互补**：这拍需"1 同花 + 1 顺子"；**两人都打同花 → 哑火**。
- 于是每拍是个**反协调难题**：盘面全公开，但"谁当同花、谁当顺子"得**各自盲选**——能否想到一块去。（《The Mind》之魂：信息公开，难在"不靠确认的默契"。）

**让语音难破（靠承诺+节奏，不靠藏信息）**：全公开 + 同时盲 commit + 短时 → 语音能"约定分工"，但 ① 盘面够复杂时最优分工**有歧义**；② 时间短来不及每拍谈拢；③ 抽牌/Boss 改目标 → **交付不确定**。

**诚实定性**：全公开 + 语音 + 长倒计时 = 可解 → **"voice-proof"是旋钮、不是一招毙命**（`倒计时长度 / 分工歧义度 / RNG 强度`）。先按"全公开 + 分工共鸣 + 短倒计时"做出来试玩，再调钮逼出 voice-proof。**判成败 = 语音"非必需、无优势"**（陌生人匹配玩满、有语音也破不了核心张力），不是"语音物理无效"。


## 4.6 ★ 随机性 + 双人共鸣牌种
**铁律**：**输入随机（决策前·共享·看着再决定）多放；输出随机（决策后·骰子定结果）只放"上行惊喜"，绝不惩罚打得好的人**（否则 feel-bad）。随机还**直接喂 voice-proof**：每拍共享一个随机目标 → 最优分工每拍在变 → 口头计划当场过期。

**三层随机**
| 层 | 类型 | 作用 |
|---|---|---|
| 共享骰/随机目标（每拍翻） | 输入·共享 | 「本拍共振型=顺子」「双方各得万能牌」→ 移动焦点 + 变量 |
| 野牌/塔罗（抽到/打出） | 输入·玩家驱动 | 转机 + 主动操纵的时机博弈 |
| 共鸣暴击骰（合击触发时） | **输出·只上行** | 协调成功→掷骰 ×2/3/5 jackpot = "出其不意的牛逼" |

**专为双人共鸣的新牌种（数据模板，非新代码）**
| 牌种 | 干什么 | 例子 |
|---|---|---|
| 回声 Echo | 触发看队友这拍 | 队友打同花→我小丑全再触发一次 |
| 赌约 Pact | 拍前下注协调 | 双方都赌顺子；都成→暴伤，任一失→反伤（承诺+不确定机制化） |
| 传递 Relay | 跨玩家资源流 | 我的 chips 灌成队友 mult（分工） |
| 连锁 Chain | 跨玩家触发链 | 队友小丑触发→我这张也触发（级联涌现） |
| 双生 Twin | 看两人异同 | 同型→共鸣翻倍 / 异型→各 +X |
| 随机共振 Wild | 每拍随机指定共振型 | 任一人命中→双方暴击 |
| 双人塔罗（消耗） | 跨玩家操纵 | 把队友最差牌变万能 / 重洗双方手牌 / 复制队友整排小丑 |
| 骰子 Dice | 上行赌 | 掷骰；6→本拍共鸣 ×5 |

**涌现样例**：A 持 Echo（队友顺子→我小丑全重触发）+ B 持 Relay（chips 灌 A 的 mult）；共享骰翻出"双方各得万能牌"→ B 临时拼出顺子 → 触发 A 的 Echo → A 小丑雪崩 + 暴击骰掷 6 → ×5。**俩人都没完整计划，随机野牌 + 跨玩家链自己滚出来的。**

**⚠️ 工程铁律（标给程序）**：所有随机走**种子化 RNG（`RandomSeed`）**，两端掷同一个数 → lockstep 不分叉。引擎原生确定性 RNG，这点白送，但每个骰子都得引同一种子源。
**唯一要给引擎加的小契约**：把"本拍上下文（双方已打出的牌型 + 当前共振目标）"暴露成可被 `condition` 读的组件（`Beat{resonantType}` / `Resonance{p1Type,p2Type}`）。**是数据契约扩展，不是新能力。**

## 5. 出牌顺序（回合循环）—— 同时备牌 → 锁定 → 同步结算
**设计取向**：合作、**零停顿**、贴 lockstep。各自牌库/小丑（各建引擎），**共享 Boss HP + 团队"共鸣"条**。

```
1 个 Ante = 3 个 Boss 阶段（渐强）
1 个 Boss 阶段：
  开局：Boss 满血 + 亮「意图」(本阶段它会施什么诅咒)；双方各发 出牌额度(如 4 手)+弃牌额度(如 3)
  循环若干「节拍 beat」：
    ① 备牌相（同时·秘密）：盘面全公开，但各自**秘密**选本拍要打的牌（互补分工→共鸣）；对方锁定前看不到你的承诺
    ② 锁定相：两人各按「确认锁定」；都锁 → 收齐两路输入(lockstep)
    ③ 结算相（确定性同步）：各自 pokerHand 认牌型 → chips×mult → 伤害
                            → 跨玩家「共鸣/接力」触发 → 合并伤害砸 Boss → 补牌
    ④ Boss HP≤0 → 阶段清；否则下一拍。一方额度先用尽则歇（可用剩余弃牌「协助」队友）
  额度耗尽 Boss 未死 → Boss 发难(团队受创)；团队血空 = 失败
  阶段间：Boss 行动(下一诅咒) + 商店(各自买小丑/道具，可赠予队友) → 进更硬的下一阶段
```

**合作互动（让它是"合作"不是"两个并排单机"）**
- **共享 Boss HP**（基线）。
- **共鸣**：同一拍两人打**同牌型** → 额外合击伤害（显式「共鸣条」）。
- **接力小丑**：「若队友这拍打了同花 → 我 mult×2」（看对方这一拍）。
- **赠予**：花一个动作给队友一张牌/一笔钱（救急/喂 combo）。
- **Boss 诅咒可点名**一人或全队；有些需配合解（「本拍需有人弃红桃，否则全队受创」）。

**为什么是这个顺序**：① 同时备牌 = 零停顿（不看队友慢慢 build）；② 锁定→同步结算 = 天然贴 lockstep（收齐输入再 tick，双端同 hash）；③ 共享 Boss + 意图预告 = 真合作感 + 让配合有的放矢（杀戮尖塔式 telegraph）。

## 6. UI 布局
**联机合作（各自设备，"以我为主"）—— 主推**
```
┌───────────────────────────────────────────────┐
│ Ante2·阶段2/3        👹 Boss   HP ▓▓▓▓▓▓░░░░    │  顶：进度 + 共享 Boss(HP)
│                      意图▶ 本阶段「同花 -50%」   │       + Boss 意图预告(telegraph)
├───────────────────────────────────────────────┤
│ 队友🌸 手×5  小丑▪▪▪  这拍▶已锁定✓  共鸣 ▓▓▓░░ │  队友面板(全公开可查;本拍承诺锁定前保密)
├───────────────────────────────────────────────┤       + 共鸣条(合作 meter)
│ 我的小丑▶ [J1][J2][J3][J4][ + ]                 │  我的引擎(左→右结算)
│                                                 │
│   Chips 120  ×  Mult 8  =  960       💰$24      │  计分读出(chips×mult)
│                                                 │
│ 我的手牌▶ [🂡][🂮][🂭][🂫][🃞][🃊][🂨]           │  手牌(点选高亮)
│                                                 │
│ [出牌]  [弃牌·剩2]             [确认锁定 ✓]      │  操作 + 锁定(显示"等队友…")
└───────────────────────────────────────────────┘
```
**布局原则**
- **Boss 共享置顶 + 意图预告**：双方同一目标，提前知道 Boss 要干啥 → 能配合应对。
- **以我为主、队友为辅**：自己面板大可操作；队友面板小、只读、可 glance(手数/小丑数/这拍牌型/共鸣) —— 够配合、不抢焦点。
- **共鸣条显式可见**：把"打同牌型/接力"做成看得见的奖励。
- **「确认锁定」= lockstep ready**：双方都锁才结算；UI 明示"等待队友…"。
- **同屏本地变体（可选）**：左右分屏 P1/P2、Boss 顶部共享；但卡牌同屏偏小，联机更自然。

> Manifesto 提醒：UI = **薄层读世界**。卡牌/小丑/Boss 都是**实体**(Sprite/Text/Clickable→Signal)；布局只做排布与高亮，别写成巨型手写组件（否则就是要消解的"手写 UI"债）。

## 7. 最小试玩切片（数据清单 · 推给实践）
**目标**：先不联机 / 不完整 Boss / 不商店 / 不 Ante —— **单屏两个玩家区**，一拍循环，只验一件事：**"全公开 + 盲选分工 + 随机 + 上行惊喜" 好不好玩、紧不紧张**。

**一拍循环（State 机 + Timer，全现成能力）**
```
翻共振目标(种子RNG) →[select 相·Timer 倒计时] 双方秘密选牌 →
两人都锁/超时 →[resolve 相] pokerHand 认型→chips×mult → 分工共鸣判定 →
命中?掷暴击骰(上行) → 合并伤害砸 boss_hp → 补牌 → 下一拍
```

**实体/数据草图（规范 manifest 形态，可直接照搭）**
```jsonc
// —— 共享 ——
"boss":  { "Resource":{ "id":"boss_hp", "current":300, "min":0, "max":300 } }
"beat":  { "Beat":{ "index":0, "resonantType":"flush", "phase":"select", "timer":20 },
           "RandomSeed":{ "seed":20260608, "sequence":0 } }              // 掷共振型 / 暴击骰
"reson": { "Resonance":{ "rule":"complement", "needTypes":["flush","straight"],
             "critDie":{ "faces":6, "jackpotFace":6, "jackpotMult":5, "baseMult":2 } } }

// —— 玩家区(P1/P2 各一份；committed 前 cards 对对方隐藏 = 秘密承诺) ——
"p1_play": { "PlayZone":{ "owner":"p1", "committed":false, "cards":[], "handType":null } }
"p1_h0":   { "Card":{ "suit":"spade", "rank":11 }, "Sprite":{}, "Clickable":{ "action":"select_p1" } }
//   …手牌若干；pokerHand 对 PlayZone.cards 求 handType → chips×mult

// —— 起步 5 张牌(数据模板) ——
"pact":  { "Pact":{ "both":true, "betType":"straight",
             "onBothDeliver":{ "bossDamage":200 }, "onAnyFail":{ "teamDamage":30 } } }
"echo":  { "Echo":{ "owner":"p1", "when":{ "partnerHandType":"flush" }, "do":"retrigger_my_jokers" } }
"relay": { "Relay":{ "owner":"p2", "from":"p2.chips", "to":"p1.mult", "ratio":0.1 } }
//   随机共振 = beat.resonantType(每拍种子RNG 翻)；暴击骰 = reson.critDie(命中即掷)
```

**起步内容量**：牌型表（pokerHand 现成 9 型）· 共振规则 1 条（互补：同花+顺子）· 起步牌 5 张（Pact/Echo/Relay/随机共振/暴击骰）· 一个 300 血简化 Boss · 倒计时 20s。

**验收**
1. **主观**（唯一要回答的）：盲选分工 + 随机暴击，**紧不紧张 / 爽不爽**？
2. **单测**：pokerHand 牌型识别 + 共鸣判定（互补命中 / 都同花哑火）确定。
3. **determinism**：种子 RNG 两次同输入同结果（为后续联机铺路）。

**给实践的边界提醒**
- UI = **薄层读世界**：卡/区/Boss = 实体 + Clickable，别写巨型手写组件。
- **随机必种子化**（同一 `RandomSeed` 源）。
- 新牌种是**数据**；引擎只需加一个小契约：**"本拍上下文（双方牌型 + 共振目标）暴露给 `condition` 读"**（`Beat`/`Resonance` 组件），不是新能力。
- 已落地依赖：`pokerHandCapability`（认牌型）。待定：`card-pile`（牌库/手牌/抽弃）—— 评估是新能力还是 RandomSeed+Tag 重组。
