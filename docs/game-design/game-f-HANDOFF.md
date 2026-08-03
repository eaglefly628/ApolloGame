# Game F 自走棋《像素三分天下》—— Session 交接（读这一份即可接手）

> 初版：主设计师助理（设计 session，2026-06-09）｜ **本版：策划 PF 刷新至 mainbranch 实态（2026-06-10）**
> 本文件 = 自走棋这条线的**单一真相**。读完本文 + §1 的必读文件，即可无缝继续，**不必重新探索引擎**（关键事实已在 §3 钉死）。
>
> ⭐ **方向升级（2026-06-13,用户拍板）**:Game F 最终形态 =「**三人合作攻岛(三国征日)+ 持久小丑牌牌组**」。
> 现行设计正典 = **`game-f-cards-and-decks.md`**(小丑牌×自走棋×炉石收藏 + 10 套牌组 + 元循环 + D0–D4 路线)。
> 下方 MVP/数值仍是有效的**战斗经营地基**;`game-f-coop-sunliu.md` 已重构为纯机制文档(N阵营/三方/降将/战场/F-057)。

---

## 0. 一句话 + 当前状态（2026-06-10 实态;方向升级见文首）

- **目标**：在 ZeroCraft Preview（数据驱动 ECS、确定性解释器）上做一款**自走棋**，代号 **Game F**。地基复刻金铲铲（TFT）；**最终形态 = 三人合作攻岛 + 小丑牌牌组(见 `game-f-cards-and-decks.md`)**。最高纲领：**游戏=数据，代码只属引擎**。
- **分支**：开发全部在 **`claude/mainbranch`**（多 session 并行直推；旧设计分支 sharp-curie 已并轨、勿再用）。
- **进度阶段**：**MVP-0 已完成并超出**（自 `1330299` 起 ~10 个提交，至 `706758e`）：
  战斗涌现链全套（索敌/六角 A* 走位/普攻/攒蓝/大招/DoT/死亡级联）+ 单回合 flow + 六角棋盘 + 8 将（独立血攻/职业/势力位/静态装备）+ DCSS 美术 + **5 个 vitest 全绿**（含确定性 hash）。
- **角色分工**：**策划/文档/符合性审查 = 策划 PF（本文档维护者）；编程 = 程序员 sessions（mainbranch）**。
- **缺口需求现状**：**REQ-021 done**（self 寻址，引擎侧）· **REQ-022 done**（group-count，裁剪后落地）· **REQ-023 不 greenlit**（YAGNI，先重组）· REQ-F-024~028 done（六角寻路/级联/正交投影/定序）· REQ-F-029/030/031 done（实时血条 t2-gauge / 受控停步 / gauge 定序环已修——**三者已接入 game-f**，inbox F-5/F-6 done 2026-06-10）· REQ-F-032/033 done **且已接入 game-f**（2026-06-10：复合棋子模板（'@local:' 内部引用）+ 8 持久槽位 + deploy/wipe + round_flow 多回合循环，测 9/9；MVP-1 引擎阻塞清零）。
- **下一步 = MVP-1**：多回合 run/round 双层流程 + 商店买人 + 经济三件套 + 关卡表。**全部以《`game-f-flow-spec.md`》为准**（§5 路线 + §6.2 开发队列）。

---

## 1. 必读文件（按序，省时间）

| 顺序 | 文件 | 为什么读 |
|---|---|---|
| 1 | `docs/design/data-driven-manifesto.md` | 宪法。一切裁决的尺子：「最弱 LLM 能否产出同样数据？」 |
| 2 | `CLAUDE.md` | 工作规范 + **核心规则**（对每条需求先评判该不该做、带理由回驳，不盲从） |
| 3a | ⭐ **`game-f-cards-and-decks.md`** | **现行方向正典**：三人攻岛 + 小丑牌牌组、五借鉴五层、贡献度元循环、10 套牌组、D0–D4 路线、服务层边界 |
| 3b | 🔨 **`game-f-core-combat-dev.md`**(给主程的 v1 开发单)+ **`game-f-v1-data-pack.md`**(虎豹铁骑/魏武将实装数据)+ **`game-f-taikou-roster.md`**(太阁 Prefab + 九州关卡表)+ **`game-f-contribution-system.md`**(贡献/攻岛/排名 = T3/T4) | **接 v1 核心战斗直接读这组**:范围/复用清单/5 任务/三流程图 + 照填的逐字段数据。零缺口依赖,首发「虎豹铁骑」 |
| 3c | `game-f-deck-spec.md`(10 套牌组详规 + D0 核对结论)· `game-f-economy-market.md`(经济/天梯/市场,后置)· `docs/design/game-f-lobby-brief.md`(局外大厅 UI,派 Cloud Design) | 卡牌细节 / 商业层 / 大厅原型 |
| 3 | **`game-f-tft-reference.md` + `game-f-flow-spec.md`(v2)** | ⭐ **战斗经营地基准则**（金铲铲流程图全转录）+ **流转单一真相**（三层状态机 + 数值表 + 审查 + 队列） |
| 4 | `docs/game-design/game-f-auto-chess.md` | 设计基线：能力映射（§3）、三缺口评审（§6）、回驳清单（§7）、数据模板（§4） |
| 5 | `docs/workflow/requests.md` 的 REQ-021/022/023 + REQ-F-024~032 | 缺口需求与裁决现状（021/022 已 done；**032 是 MVP-1 阻塞点**） |
| 6 | **`games/game-f/blueprint.ts` + `game-f.test.ts`** | **当前实现**（纯数据装配 + 5 测试）——改流程前先看它已经怎么跑 |
| 7 | `docs/workflow/SESSION-HANDOFF.md` | 引擎全局现状（能力库清单、已知债：性能 N²、跨端浮点未验证🟠） |

---

## 2. 核心结论（已定，"别推翻"清单）

这些是上一 session 经**读真实源码**得出的判断，已写进设计稿。新 session 可挑战，但要先理解理由：

1. **立项接受 + 单人优先**。自走棋 = 经济/抽卡（离散）+ 封闭竞技场自动战斗（连续）。战斗半边已被 Game D 验证。**单人 PvE 优先**：没有对手客户端 → 不需跨端 lockstep → 顺手绕开引擎最吓人的未验证风险（跨端浮点确定性🟠），只需同机确定性（已扎实）。PvP/联机押后。

2. **MVP-0 零新增 capability、纯数据可落地**。复用映射（全部已核对真实代码）：
   - 战斗簇 = `aggro+steering+hitbox+caster+over-time+mortal`（Game D 验证）
   - 阶段机 备战→战斗→结算 = `flow`（REQ-020，声明式状态机，读如瀑布脚本）
   - 商店 发牌/选购/补牌 = `card-pile`（REQ-017）
   - 经济 发钱/利息/连胜 = banded `EventWhen→Effect`（Game E 已证"每\$5生\$1上限\$5"，**不是数学缺口**）
   - 胜负判定（一方存活=0）= `Zone{requiredTag,count:1}` + `flow` 转移读 flag==false（**不需要计数能力**）

3. **三个真缺口 = 一条「实体寻址轴」**（这是本立项给引擎的真正增量，也是对 Gemini 提案的核心修正）：
   - **REQ-021 / Gap A「self 寻址」**（高优先，Phase 2 阻塞）：逻辑链只能寻址**全局单例**，无法寻址"**本实体自己的** mana/信号"。重复棋子（三星合体）会**串台**。**Gemini 漏判了这条**（它以为 per-unit mana→ult 直接能用）。
   - **REQ-022 / Gap B「set 读」**（中优先，Phase 3）：`group-count`——按 Tag/归属计数→越阈值发信号。羁绊用。Gemini 正确点名（它叫 trait-counter），但**它的"每帧执行"是错的**，应**开战那一拍锁存**。
   - **REQ-023 / Gap C「set 写」**（低/评估中，**Lead 不 greenlit**）：`group-effect`——把光环 fan-out 到一群单位。**Gemini 完全没提**。倾向先用"group-count + 全局 stat"重组绕过（YAGNI）。

4. **回驳/暂缓（带理由，别捡回来做）**：草船借箭/调虎离山（长尾单卡，不为一卡拓宽引擎）、单人 DAG 地图 & Boss Intent 预告（可纯数据重组，押后 Phase 4）、PvP（跨端确定性未验证）。详见设计稿 §7。

---

## 3. ⚠️ 两个关键陷阱（= REQ-021 的根，**新 session 务必理解**）

1. **`caster` 按全局信号名触发**（`src/skills/tier3/caster.ts:89-94`）：收集**全场** Signal 名进一个 Set，任一 Caster 的 `onSignal` 在集合里就触发。→ N 个棋子共享 `cast_attack` 信号会**一齐触发**（串台）。`effect-apply`/`craft-recipe` 同理按全局名。
2. **`condition` 按全局 id 索引**（`src/skills/tier2/condition.ts:23-44` `buildConditionLookup`，同 id 取第一份）：N 个棋子各有 `Resource{id:'mana'}`，每个 EventWhen 的 `when:mana≥100` 都解析到**世界第一份 mana**，不是自己的。
3. **MVP-0 规避法**：用**互不相同的英雄 + 每英雄唯一 id**（`mana_zhaoyun`/`ult_zhaoyun`…），把"很多相同"退化成"几个不同单例"，现有链就够 → **零新代码**。**唯一 id 烘不进共享 Prefab 模板** → 重复棋子（合体）必须等 REQ-021。

---

## 4. 路线 + 下一步（2026-06-10 修订：以 `game-f-flow-spec.md` §5/§6 为准）

- **MVP-0 ✅ 已达成**（战斗涌现链 + 单回合 flow 单局版；唯一 id 规避串台；5 测试绿）。
  设计期"MVP-0 含商店/经济"的口径**已收窄**：商店/经济划入 MVP-1（见 flow-spec §5 修订理由——它们依赖多回合循环才有意义）。
- **MVP-1 ⬅ 当前**：run/round 双层流程机 + 商店买人三件套 + 经济三件套 + 关卡表前 2 阶段。
  **引擎阻塞清零、对齐过半**——回合重置 + L1 run_flow + 经济三件套 + 阶段伤害 + 关卡表前 2 阶段已落（2026-06-10，测 10/10）；余 商店三件套（P0）/ ready 输入（P2 归主程）/ 等级经验（P2）。另 REQ-F-034（平滑移动）已提主程待落。
- **Phase 2**：升星合体 + 等级/人口（REQ-021 引擎侧已 done，接入即可）。
- **Phase 3**：羁绊（REQ-022 已 done；施加侧 Gap C 届时再裁，YAGNI 纪律不变）。
- **Phase 4**：野怪回合+掉落、选秀(九选一)、装备合成、锦囊、连败金、时限止损。

> 开发队列（P0/P1/P2 逐项 + 测试要求）见 **flow-spec §6.2**。每完成一项，更新 flow-spec §6.1 的符合性表。

---

## 5. 给更强模型的提示：哪些可挑战

- **REQ-021 的实现机制**（scope 开关？Signal.source 匹配？ConditionExpr 加 self 叶子？）—— 上一 session 只给了方向，**最终设计交你/主程**。
- **REQ-023 该不该做** —— 上一 session 判"先重组、暂不下沉"。若你有更强论证支持/反对逐单位 fan-out，可重裁（但请守 YAGNI + 先重组纪律）。
- **group-count vs Zone 是否合并** —— 留了 rule-of-three 去重问题给主程（见 REQ-022 + `tier3-skill-governance.md`）。
- **不可挑战的硬约束**：游戏=数据（manifesto）；游戏层不写 system/手写战斗 UI；新能力只加在引擎、确定性、审计过；tsc+vitest+build 全绿才推；开发分支 `claude/mainbranch`。

---

## 6. Git 现状（2026-06-10）

- 开发线：`claude/mainbranch`（game-f 实现 `1330299`→`706758e`，程序员 sessions 持续直推）。
- 设计三文档（本文件 / `game-f-auto-chess.md` / `game-f-flow-spec.md`）已落库随代码同行；
  旧设计分支 `claude/sharp-curie-hr606s` 的内容已全部并轨于此，**勿再在那条分支上开发**。
- 文档由策划 PF 维护；实现每过一个 flow-spec §6.2 队列项，应同步刷新 flow-spec §6.1 符合性表与本文件 §0。
