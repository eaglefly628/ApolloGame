# Game F《像素三分天下》对局流转规范（Flow Spec）—— 程序员开发的单一真相

> 作者：策划（PF，本 session）｜ 2026-06-10 ｜ 基于真实金铲铲/TFT 对局研究 + 引擎现有词汇
> **这份文档回答一个问题：一局游戏从头到尾怎么流转。** 所有 game-f 的流程/数值开发以本文为准；
> 能力映射与缺口评审见 `game-f-auto-chess.md`（§3/§6 仍有效）；本文 §6 是对当前实现（mainbranch@706758e）的符合性审查。
> 宪法：`docs/design/data-driven-manifesto.md` —— 下面每一张表、每一台状态机都是**数据**，不是代码。

---

## 〇、怎么读（按角色）

- **程序员**：直接看 §3（三层流转状态机）+ §4（数值表）+ §6（差距与开发队列）。§3 的每台机就是一份 `GameFlow` 数据 + 一张全局 id 注册表。
- **Lead/主程**：§5 阶段路线（哪个阶段还哪笔债）+ `requests.md` REQ-F-032（本文唯一新增的引擎需求，候选两路待裁）。
- **策划同侪**：§1 研究结论（真金铲铲长什么样）+ §2 改编裁决（我们砍/留/押后了什么，全部带理由）。

---

## 一、研究结论：真·金铲铲（TFT）的对局骨架

> 来源：League wiki / lolchess / op.gg / metatft / TFT Ninja 等（链接见本节末）。已交叉核对；具体数值随赛季微调，**结构稳定**。

### 1.1 三层结构：局（Run）→ 阶段（Stage）→ 回合（Round）

- 一局 8 人，互相淘汰，活到最后。一局 ≈ 30–40 分钟，跨 5–7 个阶段。
- **阶段 1 特殊（教学/起步）**：`1-1` 选秀（所有人从转盘选免费英雄）；`1-2`～`1-4` 打野怪（PvE 小兵，掉金币/装备散件）。
- **阶段 2 起每阶段 7 个回合，模式固定**：
  `X-1 X-2 X-3` PvP → `X-4` **选秀**（血量低的先选）→ `X-5 X-6` PvP → `X-7` **野怪**（克格/狼/雷恐鸟/龙等，掉装备）。
- 回合种类只有三种：**PvP 对战 / 选秀（Carousel）/ 野怪（PvE）**。

### 1.2 单个回合内：备战 → 战斗 → 结算

- **备战（Planning）约 30 秒**：自动发钱（基础收入+利息+连胜金）→ 商店自动刷新 5 张 → 玩家买人/卖人/刷商店（2金）/买经验（4金）/拖子摆阵。
- **战斗（Combat）上限约 40 秒**：双方棋子**全自动**索敌、走位、普攻攒蓝、蓝满放大招；一方团灭即止；超时进入加速/按存活判定。
- **结算（Resolution）**：败方玩家扣血 = **阶段基础伤害 + 存活敌方单位数×1**（星级无关）；更新连胜/连败；血≤0 当场淘汰。

### 1.3 核心子系统（与流转强耦合的五件）

| 子系统 | 规则（结构稳定，数值随赛季） |
|---|---|
| **经济** | 基础收入逐回合爬坡到 5 金封顶（约 2/2/3/4/5…）；**利息** = ⌊存款/10⌋，上限 +5；**连胜金** 2–3连+1 / 4连+2 / 5+连+3（连败同形）。 |
| **商店** | 5 个槽；刷新 2 金；**买经验 4 金 = 4 XP**；每回合自动 +2 XP；**等级 = 上场人数上限**；各费用卡出现概率按等级查表；全场共享**有限卡池**（按费用每种 N 张）。 |
| **升星** | 3 张同名 1 星 → 自动合成 2 星；3 个 2 星 → 3 星。属性倍率约 HP×1.8、伤害×1.5 每星。 |
| **羁绊** | 按**场上**单位的势力/职业计数，达阈值激活层级效果；**开战那一拍锁定**，战斗中死人不掉羁绊。 |
| **装备** | 野怪掉散件、选秀携带；散件+散件=成装；装备给单位静态/触发属性。 |

> 来源：
> [League wiki · TFT](https://leagueoflegends.fandom.com/wiki/Teamfight_Tactics_(game)) ·
> [lolchess · Rounds](https://lolchess.gg/guide/rounds?hl=en-US) ·
> [op.gg · Round Guides](https://op.gg/tft/game-guide/rounds) ·
> [TFT Ninja · Stages](https://tft.ninja/guides/game-mechanics/stages) ·
> [metatft · Economy](https://www.metatft.com/guides/tft-economy-guide) ·
> [metatft · Shop Odds](https://www.metatft.com/tables/shop-odds) ·
> [op.gg · Damage Formula](https://op.gg/tft/game-guide/damage-formula) ·
> [Esports Tales · PvE drops](https://www.esportstales.com/teamfight-tactics/item-and-gold-drop-rate-by-pve-round)

---

## 二、PvE 改编裁决（单人复刻，砍什么留什么，全部带理由）

立项已定**单人 PvE 优先**（绕开跨端浮点确定性，见设计稿 §〇）。对真金铲铲逐项裁决：

| 真金铲铲要素 | 裁决 | 理由 |
|---|---|---|
| 8 人对战/匹配 | **改**：对手 = **剧本敌阵**（每回合从关卡表读敌方阵容，强度爬坡） | 单人 PvE 的定义。敌阵=纯数据（和我方棋子同构）。 |
| PvP 回合 | **留**（vs 剧本敌阵） | 核心循环。 |
| 野怪回合 | **留，Phase 4 接**（野怪=另一种敌阵数据 + 掉落表） | 结构同 PvP，只差掉落；不阻塞主循环。 |
| 选秀（Carousel） | **押后 Phase 4**（单人版 = 九选一 draft） | 无争抢后价值降为"免费卡+装备来源"；需独立 UI 交互，不值得在主循环前做。 |
| 备战倒计时 30s | **改**：玩家点「开战」（ready 信号）；倒计时留作可选数据参数 | 单人无真人等待，强制倒计时只剩压迫感、没有公平性意义。 |
| 战斗 40s 上限/加时 | **简化**：MVP 团灭即止；时限止损（超时按存活判玩家败）作为防呆参数后补 | 我们棋子少、必收敛；时限是防极端配置的保险丝。 |
| 经济三件套（收入/利息/连胜） | **留**（连败金押后 Phase 4 再评） | 自走棋的脑子一半在经济。连败金在单人下价值存疑（橡皮筋另有关卡曲线可调）。 |
| 商店/等级/卡池/升星 | **留**（动态等级加权概率按设计稿 §7 用"按等级预洗牌袋"先行） | 构筑的另一半。卡池=预洗牌库，天然有限、天然确定性。 |
| 羁绊（开战锁存） | **留，Phase 3 接**（REQ-022 引擎侧已 done） | 设计稿 Gap B 既定路线。 |
| 装备散件合成 | **押后 Phase 4**；当前先用**静态预配装备**（已实现） | 掉落+合成依赖野怪回合；静态装备已验证数据形态。 |
| 海克斯强化（augments） | **砍**（远期作"遗物"回归，见设计稿 §7） | 不属于核心循环。 |
| 玩家血量/伤害公式 | **留**：HP=100；扣血 = 阶段基础伤 + 存活敌数×1 | 现代 TFT 公式，星级无关，最简数据形。 |
| 淘汰/胜利 | **改**：血≤0 = 败局 gameover；**打满关卡表最后一关 = 通关** | 单人要有终点。 |

> **改编后的一局**：跨 5 个阶段 × 每阶段 5 回合（数值见 §4.5），每回合 备战(玩家操作+点开战)→战斗(全自动)→结算(扣血/给钱)，打穿关卡表赢、血量归零输。

---

## 三、权威流转（给程序员）：三层状态机，全部是 `GameFlow` 数据

> 引擎词汇：`flow`（REQ-020，states/onEnter/transitions{when,after,to,do}）+ `EventWhen/Effect/Zone/card-pile/craft-recipe`。
> 流程读写的一切都是**全局单例** id（flow 链对单例完美，见设计稿 §2 注）；棋子内部链用**每实例作用域**（REQ-021 已 done）或 MVP 唯一 id。

### 3.1 全局 id 注册表（防串台的宪法级纪律：新增 id 必须先登记在这）

| id | 类型 | 含义 | 写者 → 读者 |
|---|---|---|---|
| `gold` | Resource 0..999 | 玩家金币 | flow/利息/连胜 → 商店/买经验 |
| `player_hp` | Resource 0..100 | 玩家血量 | 结算 → run 终止判定 |
| `xp` / `level` | Resource | 经验 / 等级（=上场人数上限） | 买经验/回合+2 → 商店概率/摆子约束 |
| `win_streak` | Resource | 当前连胜数 | 结算 → 连胜金 banded |
| `stage_idx` / `round_idx` | Resource | 当前阶段 / 回合序号（关卡表指针） | run 流程 → 敌阵装载/伤害公式 |
| `in_combat` | Flag | 战斗进行中（门控普攻/攒蓝） | round 流程 → 棋子 EventWhen |
| `ready` | Flag | 玩家点了「开战」 | 输入 → round 流程 prep 转移 |
| `team_a_present` / `team_b_present` | Flag | 两队还有人（Zone 写） | zone-occupancy → combat 转移 |
| `won` | Flag | 本回合胜负 | round 流程 → 结算分支 |
| `round_done` / `run_over` / `run_won` | Flag | 回合完 / 败局 / 通关 | round ↔ run 两台机的握手 |
| `mp_<棋子实例>` / `atk_<实例>` / `ult_<实例>` | Resource/信号 | 棋子蓝条/普攻/大招（**每实例唯一**或 self 作用域） | 棋子内部闭环 |
| `deploy_armed` / `wipe_armed` | Flag | 展开/清场触发臂（flow onEnter 置位，edge 纪律：下一相位复位） | round 流程 → EventWhen(edge) |
| `deploy` / `deploy_stage_<N>` | 信号 | 我方/第 N 阶段敌方阵容展开（单拍） | EventWhen → 槽位 Caster |
| `wipe` | 信号 | 清场（单拍） | EventWhen → destroy-tagged Effect×2 |

### 3.2 L1 · Run 流程（局）：`run_flow` 实体一台机

```jsonc
"GameFlow": { "id": "run", "current": "boot", "states": [
  { "id": "boot",        // 开局：初始化资源（gold=0,hp=100,level=1,关卡指针=1-1），发首回合
    "onEnter": [ /* set 初值… */ ],
    "transitions": [ { "when": { "kind": "always" }, "to": "round" } ] },
  { "id": "round",       // 把控制权交给 L2 round_flow（其打完写 round_done）
    "onEnter": [ { "kind": "set-flag", "targetId": "round_done", "value": false } ],
    "transitions": [
      { "when": { "kind": "flag", "id": "run_over", "equals": true },  "to": "defeat"  },   // 血≤0（L2 写）
      { "when": { "kind": "and", "of": [ { "kind": "flag", "id": "round_done", "equals": true },
                                          { "kind": "resource", "id": "stage_idx", "cmp": "gt", "value": 5 } ] },
        "to": "victory" },                                                                   // 打穿关卡表
      { "when": { "kind": "flag", "id": "round_done", "equals": true }, "to": "advance" } ] },
  { "id": "advance",     // 推进关卡指针（round_idx+1；满 5 则 stage_idx+1、round_idx=1），回到 round
    "onEnter": [ { "kind": "modify-resource", "targetId": "round_idx", "op": "add", "value": 1 } /* 进位由 banded EventWhen 处理 */ ],
    "transitions": [ { "when": { "kind": "always" }, "to": "round" } ] },
  { "id": "victory", "onEnter": [ { "kind": "set-flag", "targetId": "run_won", "value": true } ] },
  { "id": "defeat" } ] }
```

### 3.3 L2 · Round 流程（回合）：`round_flow` 实体一台机 —— **开发主战场**

```jsonc
"GameFlow": { "id": "round", "current": "prep", "states": [
  { "id": "prep",        // 备战：① 发基础收入(查表 stage/round) ② 触发利息 banded ③ 触发连胜金 banded
                          //      ④ 商店刷新(发 shop_refresh 信号→card-pile 补满 5 槽) ⑤ 重置 ready
                          //      ⑥ 【REQ-F-032】按阵容/关卡表展开 我方+敌方 棋子实例（满血满蓝，站到各自 HexPos）
    "onEnter": [ /* …上述全是 set-flag/modify-resource/发信号的数据动作… */ ],
    "transitions": [ { "when": { "kind": "flag", "id": "ready", "equals": true }, "to": "combat",
                      "do": [ { "kind": "set-flag", "targetId": "in_combat", "value": true }
                              /* + 羁绊锁存信号（Phase 3：group-count 在此拍算一次） */ ] } ] },
  { "id": "combat",      // 战斗：全自动（涌现链见 §3.4）。终止 = 任一队 present flag 落 false。
    "transitions": [
      { "when": { "kind": "flag", "id": "team_b_present", "equals": false }, "to": "resolution",
        "do": [ { "kind": "set-flag", "targetId": "won", "value": true } ] },
      { "when": { "kind": "flag", "id": "team_a_present", "equals": false }, "to": "resolution",
        "do": [ { "kind": "set-flag", "targetId": "won", "value": false } ] } ] },
  { "id": "resolution",  // 结算：胜→连胜+1；败→连胜清零 + 扣血（阶段基础伤+存活敌数；存活数=Phase 内用
                          //      REQ-022 group-count 读，MVP-1 先用固定伤害表近似）。清场（销毁本回合战斗实例）。
    "onEnter": [ { "kind": "set-flag", "targetId": "in_combat", "value": false } /* + 结算账本动作 */ ],
    "transitions": [
      { "when": { "kind": "resource", "id": "player_hp", "cmp": "lte", "value": 0 }, "to": "gameover" },
      { "when": { "kind": "always" }, "after": 60, "to": "done" } ] },
  { "id": "done",        // 通知 L1（round_done），自身回 prep 等下一回合
    "onEnter": [ { "kind": "set-flag", "targetId": "round_done", "value": true } ],
    "transitions": [ { "when": { "kind": "flag", "id": "round_done", "equals": false }, "to": "prep" } ] }, // L1 重臂后回跳
  { "id": "gameover", "onEnter": [ { "kind": "set-flag", "targetId": "run_over", "value": true } ] } ] }
```

**prep 期玩家可用操作（输入域，全部=信号/命令，不是 UI 代码）**：

| 操作 | 数据通路（现有词汇） |
|---|---|
| 买人（点商店槽 i） | `buy_slot` 信号 + 下标 → `card-pile` play(i) 同拍 `craft-recipe` 扣卡价（设计稿 §4.5 原样） |
| 刷商店 | `reroll` 信号 → `craft-recipe` 扣 2 金 + `card-pile` 弃手补 5 |
| 买经验 | `buy_xp` 信号 → `craft-recipe` 扣 4 金 + `Effect` xp+4（升级=banded EventWhen 读 xp 阈值表写 level） |
| 卖人 | `sell_<实例>` → 返金 + 销毁实例、归还卡池（Phase 2 与升星一起做） |
| 摆子 | 拖拽写棋子 `HexPos`（约束：场上数 ≤ `level`，约束执行点交主程） |
| 开战 | `ready` Flag 置 true |

### 3.4 L3 · Combat 内（已实现 ✅，参考实现 = `src/games/game-f/blueprint.ts`）

战斗内**没有状态机**，是涌现链（一拍不差地已在跑，5 个 vitest 盖住）：

```
aggro(锁最近敌) → grid-move(六角 A* 逐格走) → loop Timer(攻速) → EventWhen(timer∧in_combat, edge)
→ 唯一信号 → Caster(at:'target') → 打击区 prefab → overlap→trigger-zone→hitbox(扣血/DoT)
→ Effect 攒蓝 → 蓝满 EventWhen → 大招 Caster → mortal(hp≤0 销毁) → hierarchy-cascade(名牌随死)
→ Zone 数存活 → present flag → (回到 L2 combat 转移)
```

**纪律**：战斗实例的 mana/timer/信号 id 必须每实例唯一（MVP 法）或挂 self 作用域（REQ-021 已 done，Phase 2 起用）；
`in_combat` 门控普攻/攒蓝（备战/结算期不动手）—— 已实现。

---

## 四、数值表（初版基线，全部可调 TUNE；改数值=改这几张表，不碰任何逻辑）

### 4.1 经济

| 项 | 值 |
|---|---|
| 基础收入（按回合全局序 1,2,3,4,≥5） | 2, 2, 3, 4, 5 金 |
| 利息 | ⌊gold/10⌋，上限 +5（= 5 条 banded EventWhen，设计稿 §4.4 原样） |
| 连胜金 | 2–3 连 +1；4 连 +2；5+ 连 +3（banded 读 `win_streak`） |
| 刷商店 / 买经验 | 2 金 / 4 金（=4 XP） |

### 4.2 玩家伤害（结算，败方）

| 阶段 | 基础伤害 |（+ 存活敌方单位 ×1） |
|---|---|---|
| 1 / 2 / 3 / 4 / 5 | 0 / 2 / 5 / 8 / 10 | 例：阶段 3 输了剩 4 敌 → 扣 5+4=9 |

### 4.3 等级与经验（等级 = 上场人数上限；每回合自动 +2 XP）

| 升到 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| 需 XP | 2 | 6 | 10 | 20 | 36 | 56 | 80 |

### 4.4 商店概率（按等级，行和=100%；卡池：1费×12 / 2费×8 / 3费×6 张每种）

| 等级 | 1费 | 2费 | 3费 |
|---|---|---|---|
| 1–2 | 100 | 0 | 0 |
| 3 | 75 | 25 | 0 |
| 4 | 55 | 35 | 10 |
| 5 | 40 | 40 | 20 |
| 6+ | 25 | 45 | 30 |

> MVP 实现形态（设计稿 §7 既定）：**按等级预洗权重牌袋**（升级=切换 card-pile 的 deck 数据），不做运行时加权抽样。

### 4.5 关卡表（Run 的脊柱：5 阶段 × 5 回合 = 25 回合，敌阵=数据）

| 阶段 | 敌阵规模与强度 | 主题（剧本敌阵，三国感） |
|---|---|---|
| 1 | 2–3 子，弱（教学） | 黄巾散兵 |
| 2 | 3–4 子 + 1 件装 | 董卓先锋 |
| 3 | 4–5 子 + 2 星点缀 | 吕布陷阵 |
| 4 | 5–6 子 + 羁绊成型 | 官渡精锐 |
| 5 | 7–8 子 + Boss 单位 | 赤壁决战（终关） |

> 敌阵条目 = `{ heroes: [{ 模板, 星级, HexPos, items }], 掉落? }` —— 与我方棋子**同构**，最弱 LLM 能填。

### 4.6 升星（Phase 2，REQ-021 已 done 解锁）

3 张同名 1 星 → 2 星；3 个 2 星 → 3 星。倍率：HP ×1.8 / 攻 ×1.5 / 大招伤 ×1.5 每星。合成自动（含备战席+场上）。卖出返还购入总价。

---

## 五、阶段路线（修订版，对齐设计稿 §8；每阶段=本规范的一个流转切片）

| 阶段 | 流转切片（本文坐标） | 新 capability |
|---|---|---|
| **MVP-0 ✅ 已达成** | §3.4 战斗涌现链 + 单回合 prep→combat→resolution 单局版 | 0（实际还顺手还了 REQ-F-024~028） |
| **MVP-1 ⬅ 进行中** | §3.2 run_flow + §3.3 round_flow 完整多回合循环 + §4.1 经济三件套 + §4.5 关卡表前 2 阶段 + 商店买人（§3.3 操作表前三行） | **0 新增**——REQ-F-032/033 已 done 且回合重置底座已接入（2026-06-10，多回合循环跑通）；余项全纯数据 |
| **Phase 2** | §4.6 升星合体 + §4.3 等级/人口 + 卖人/归还卡池 | 0（REQ-021 已 done，接入即可） |
| **Phase 3** | 羁绊：prep→combat 转移拍锁存（§3.3 注） | 0–1（REQ-022 已 done；Gap C 届时再裁） |
| **Phase 4** | 野怪回合+掉落、选秀(九选一)、装备合成、锦囊、连败金、时限止损 | 按届时评审 |

---

## 六、符合性审查（2026-06-10，对照 mainbranch@`706758e`）

### 6.1 已达成 ✓（全部有测试背书，`src/games/game-f/game-f.test.ts` 9/9 绿）

| 本规范条目 | 实现/测试证据 |
|---|---|
| §3.4 战斗涌现链全套 | blueprint.ts 纯数据装配；测试「两队自动对冲互砍」「蓝条→大招」 |
| §3.3 combat→resolution 转移（团灭→present flag→结算） | 测试「战斗收敛到团灭」+ GAME_FLOW combat 转移 |
| §3.3 prep ⑥ 回合重置 + resolution 清场 + prep⟲resolution 多回合循环（REQ-F-032/033） | 棋子=复合模板实例（'@local:main' 整族生灭）+ 8 持久槽位 + deploy/wipe 信号 + destroy-tagged；测试「备战拍展开」「回合重置：清场无孤儿/槽位库持久/新实例满状态 id 全新」 |
| 确定性 | 测试「同初值重跑 hash 一致」（注：当前无 RandomSeed，商店接入后升级为真 seed 检验） |
| `in_combat` 门控、名牌级联死、六角棋盘+A*、独立血攻、大招/DoT、静态装备、势力/职业 Tag 位 | b14d109/674728e/706758e 等提交 + 对应测试 |
| 工程纪律：唯一 id 防串台、零游戏 system | blueprint 全文 grep 无 system；id 形如 `mp_a_guanyu` |

### 6.2 与本规范的差距（= MVP-1 开发队列，按优先级）

| # | 差距 | 对应规范 | 备注 |
|---|---|---|---|
| P0 | ~~单局版 flow → 多回合~~ **round 循环+回合重置已落（2026-06-10）**；余 **L1 run_flow**（§3.2 关卡推进/胜负/round_done 握手） | §3.2 | REQ-F-032/033 已 done；run_flow=纯数据，接上后 resolution 出口由「直回 prep」改为「done 握手」 |
| P0 | **商店买人三件套**（card-pile 5 槽 + craft-recipe 扣价 + 买入→阵容） | §3.3 操作表 | 纯数据，零新 capability；「买入→上场」与 030 共用展开语义 |
| P1 | 经济三件套（收入爬坡表 + 利息 banded + 连胜金） | §4.1 | 纯数据（Game E 已证形态） |
| P1 | 玩家伤害公式（阶段基础伤 + 存活敌数） | §4.2 | 存活数读取依赖 REQ-022（已 done）或先用固定表近似 |
| P1 | 关卡表与敌阵装载（前 2 阶段） | §4.5 | 与 030 的展开语义共用 |
| P2 | ready 开战按钮 + 备战期输入域 | §3.3 | 输入路由交主程 |
| P2 | 等级/经验/商店概率牌袋 | §4.3/§4.4 | 纯数据 banded |
| — | 当前 `player_hp` 20/-5 与 prep 发钱 +5 固定值 | §4.1/§4.2 | MVP-0 占位数值，MVP-1 换表 |

### 6.3 守住的纪律（审查通过项）

- **游戏=数据**：game-f 目录无任何游戏 system/手写战斗 UI；blueprint=装配数据。`hex.ts` 的投影辅助与 `.ts` 蓝图形态 = 全仓库既有债（manifesto §8），game-f 未新增债种。
- **回驳纪律**：REQ-023 维持不 greenlit（YAGNI，先重组）；本文未捡回任何已回驳项（草船借箭/调虎离山/每帧羁绊等仍按设计稿 §7 押后）。
- **确定性**：流转全部走 flow/EventWhen/Resource（进 hash）；表现（特效/名牌/相机）不进 hash。

---

> 复诵：**一局自走棋 = 两台 GameFlow 数据机（run/round）× 几张数值表 × 一条已验证的战斗涌现链。**
> 程序员加的每一行代码都应该在引擎里、且对着 `requests.md` 的一条已 greenlit 需求；游戏目录里只多数据。
