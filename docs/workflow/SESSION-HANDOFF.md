# Session 交接 / 项目现状 —— 读这一份即可接手（2026-06-10 刷新，主程4）

> ⛔ **最高纲领：`docs/design/data-driven-manifesto.md`** —— 游戏=**数据**，代码只属引擎这台**确定性解释器**。
> 一切"该数据还是代码"的争议用那把尺子裁：**"最弱的 LLM 能不能也产出一模一样的数据？" 能→数据接口；不能→拒绝，做成 DSL 或下沉成 capability。**
> **工作规范见 `CLAUDE.md`**（分支 `claude/mainbranch` 直推不开 PR；`fetch→rebase→push`；tsc+vitest+build 全绿才推）。本文件只讲"现状/机制/待办"，不重复 CLAUDE.md。
> **分工边界（用户 2026-06-10 拍板）**：**Lead/主程只动引擎+文档，游戏层 `src/games/**` 一律不动手**——游戏侧任务写进 `docs/workflow/programmer/inbox.md` 派发给对应 PE（PE-E=Game E、PE-F=Game F），PE 完成写 outbox。

---

## ★ 主程4 本会话交接（2026-06-10；HEAD 492316c；vitest 925 绿 / tsc / build 全绿）

**本会话全是引擎能力下沉 + 评审 + bug 修复，不碰游戏层代码（game-*.tsx 归各 PE）。新增/扩展能力：**
- **卡牌簇（Game E 拉动）**：`tier3/card-scoring`(REQ-014 逐张计分+retrigger) · `tier3/poker-hand` 加 `scoringCardIndices`(BUG-001 只计「计分牌」) · `tier2/card-play`(REQ-016/017 出牌输入接缝,按 owner 路由) · `tier2/card-pile`(REQ-017 牌库/手牌 sim 内管理:发牌/下标出牌/弃牌/补牌) · `skills/score-trace`(REQ-019 计分链逐步 trace,排除出 hash,opt-in)。
- **流程/逻辑轴**：`tier3/flow`(REQ-020 声明式状态机解释器=游戏流程数据,onEnter+条件转移+`after` Matinee 时序门;ConditionExpr 加 `always` 叶子) · `tier2/self-rule`(REQ-021 **实体本地 self 作用域**,对每个实体读自身条件→施自身,通用化 mortal) · `tier2/group-count`(REQ-022 **集合读**,按 Tag 计数→count 资源;阈值用 event-when 重组)。
- **effect-apply 扩展**：REQ-012 `op/order` · REQ-013 `valueFrom`(资源×资源/系数) · REQ-009 `reset-timer`(事件→重置计时器,限时机制) · REQ-019 trace append。`condition` 加 `vsResource`(资源比资源,动态阈值)。
- **六边形寻路（Game F 拉动,REQ-024）**：`tier2/hex`(纯函数确定性 A* `hexNextStep`,绕障/到相邻停) · `tier2/grid-move`(逐格移动,读 Relation→A*→写 HexPos+投影 Transform) · 组件 HexBoard/HexPos/GridMover。
- **挂件生命周期（Game F 表现 bug 拉动,REQ-F-026）**：`tier1/hierarchy-cascade`(**子随父死**——父销毁时排在 destroy-apply 之前,沿 `Hierarchy.parentId` 把 DestroyRequest 传给后代传递闭包,destroy-apply 同帧一并移除,绝不残留一帧孤儿)。**定性=补全 hierarchy 生命周期**(此前只做「子跟父变换」hierarchy-resolve、漏了「子存活以父为界」)；默认级联(对齐 Unity/Godot/Unreal),空 parentId=根/「父死子留」逃生门；**零新增数据**(复用挂件本就有的 parentId)。
- **引擎 bug 修复**：BUG-003(TimerDone 双 consume 饿死 animation→生产者 timer-advance 自清+消费者改 reads) · BUG-004(mortal 掉落载体泄漏→prefab 回收 size==1 载体) · BUG-005(queryNearest tie-break + tween duration≤0 抖动)。顺手补 group-count 漏注册进 ALL_CAPABILITIES。
- **治理/设计文档**：`docs/design/tier3-skill-governance.md`（**新 skill 决策判据**+genre pack+「散件能重组但最弱 LLM 难产→建收敛解释器是正当理由」宪法澄清+genre skill 重组审计：caster 标可整合、card-play provisional）· `docs/design/query-perf-plan.md`（World.query 全扫优化方案,倒排索引——**并行 session 已实施**,见下）。

**未做/待接（按优先）**：
- 🔴 **REQ-023 group-effect（集合写）**：我**不 greenlit·倾向重组**（group-count+全局 buff 资源绕过）；真出现"非逐单位 fan-out 不可"再下沉。
- ✅ ~~World.query 性能~~：**并行 session 已实施**（方案 A+单调跳排序/稠密退化；稀有查询 36×，行为逐字节不变，8 条对拍守护；详见 `query-perf-plan.md` 头部实施记录与 §4 自审表）。
- ✅ ~~REQ-025 grid-move↔aggro 拓扑成环~~：**并行 session 已修**（`f59d0cd`，主程4 采 PE-F 1 行 `runsAfter:['aggro']` 破环——同 Update 相位 aggro(读 Transform→写 Relation)↔grid-move(读 Relation→写 Transform) 互为前驱抛环；语义：本拍 aggro 选目标→grid-move 据此走，写出的 Transform 下拍才读，确定性不变；+1 对拍守护测，现 vitest 926 绿）。**game-f 接 hex 寻路已解阻塞**（见下 🟡 Game F 项；更彻底可选：grid-move 只写 HexPos + 另设 PostResolve 投影系统，见 `requests.md` REQ-025）。
- 🟠 **caster 可整合进 effect-apply（kind:'spawn'）+ 与 aggro 索敌去重**（governance §4 审计发现），排期收敛。
- 🟡 各游戏 PE 侧"数据换层"——**已正式派发，见 `programmer/inbox.md` 2026-06-10 批次（Lead 不动手）**：**归 PE-E**：flow/card-pile 重写回合流程(REQ-017/020) + ScoreTrace 回放(REQ-019,已在接)；**归 PE-F**：blueprint 加 1 行 `hierarchyCascadeCapability` 修名字残留(REQ-F-026,引擎侧已落 `f3fbc89`) + self-rule/group-count 接自治/羁绊(REQ-021/022)。（hex/grid-move 接移动 PE-F 已自接完,`3b952fe`。）
- 🟠 沿用旧自审：**仍没真浏览器看过一帧**；浮点跨端确定性未双端验（卡牌/hex 是整数安全,steering/sqrt 仍 REQ-010 open）。

---


## 1. 开发机制（这套东西是怎么运转的）

**一句话**：整个游戏被表达成一份 **Manifest（纯数据）**；引擎是固定的确定性解释器；工具链让"数据→看/改/玩/体检"成闭环。

```
数据(Manifest) ──parseManifest──▶ WorldBlueprint ──engine.load──▶ World ──tick──▶ 确定性状态(可 hash/快照/回放)
   ▲  capabilities:[id] + entities:{id:{Comp:data}}                                   │
   └────────────── exportManifest（导出=导入的逆运算，对称闭环）◀───────────────────────┘
```

- **引擎核心** `src/engine/`：ECS `World`（snapshot/restore、确定性 `hashSnapshot`、Camera 排除出 hash）；`SystemPhase` + 显式 `runsAfter/runsBefore` 拓扑排序。
- **能力库** `src/skills/`：26 原子 + 扩展；Tier1（accel/motion/rotation/animation/hierarchy/**hierarchy-cascade**(子随父死,REQ-F-026)/lifetime/**tween**）；Tier2 物理（collision/ground/jump/bounds/trigger-zone/friction）+ 逻辑链 **Condition→Event→Effect**（event-when→effect-apply，一拍反馈）+ camera-follow/**clickable**/**craft-recipe**/zone-occupancy + **ARPG 战斗簇 hitbox/over-time(限时效果列表,燃烧+冰冻并存)/mortal/steering** + **keybind**(具名按键→Signal) + **tilemap**(瓦片地图:数据=二维数组,引擎=瓦片碰撞+渲染) + **anim-state**(动作动画:clip表→Frame,自动派生 走/站/攻击) + **facing**(按移动/目标方向翻转朝向)；Tier3 **dialogue**/**match3-board**/**prefab**(数据级模板展开)/**caster**(信号→生成)/**aggro**(索敌→Relation target)/**poker-hand**(REQ-011:判牌型给基础分)/**card-scoring**(REQ-014:逐张 baseChips 累加+逐张小丑+retrigger)。**Tier4 刻意为空**——AI 行为=数据装配（aggro+steering+state+condition 拼 ai-chase，对齐周期表）。resource 全局按 id 路由；spatial-query 新增 `nearestByTag` 自动索敌。**实体寻址轴（Game F 自走棋拉动）**：**self-rule**(REQ-021，每实体读自身条件→对自身施效) + **group-count**(REQ-022，按 Tag 掩码计数→写 Resource；阈值信号=event-when edge 重组，owner=加 Tag bit)。
- **Manifest 桥接** `src/assembly/`：`capability-registry`（id→能力对象 + 据组件反推）、`manifest.ts`（`parseManifest`/`exportManifest` 对称）、R12 组件数据 schema 校验器、**P0 引用链接器 `validate-references`**（id 交叉引用体检：信号链生产者↔消费者 / 条件叶子与 effect 目标的全局 id / 模板引用 / flow·dialogue 图内跳转；prefab 模板实体进"存在宇宙"、self 寻址刻意不查；全 warning 不阻断；五真实蓝图 0 误报回归钉死）。**这是"游戏=数据"的闭环地基**：AI/预设/手改产同一种数据，引擎直接跑。
- **Studio 工具链** `src/studio/` + `src/bench/`：数据透视器（透视/改字段/实时预览，Game A 可键盘试玩）、资产浏览器（按类型分组/搜索/双击定位）、**ApolloBench**（把蓝图喂进真引擎跑分：Structure/Load/Determinism/Numeric/Visual，借鉴 OpenGame-Bench）。主页「Create Game」生成的游戏可一键「在透视器里打开」。
- **表现/服务（sim 之外）** `src/services/`：storage / audio / **aigp(AishePort)**；输入 `net/`（lockstep + queued/pointer）；渲染 `src/renderer/`（Canvas，Sprite 穿皮）。
- **启动器** `apollo.py`：跨平台启 Vite+API；多 LLM（Claude/Qwen/OpenAI/DeepSeek/Ollama）生成**规范 manifest**；离线预设 platformer/pong；`bench` 命令 + Dev Tools 面板。

## 2. 五个游戏（都已并入 main，趋近纯数据）

- **Game A · 协作平台(卷轴)**：双人、相机跟随、移动平台(Tween)、压力开关→门(zone-occupancy + event-when + effect set-sensor, REQ-006/008)。通关条件=纯数据 Zone，已删手写胜负系统。
- **Game B · 乙游 VN**：dialogue capability 驱动（R15，已删 dialogue-runner）；7 属性 + 体力约束 + 属性门控选项 + 掷骰(R17) + 组合条件多结局。
- **Game C · 缝纫物语 v0.3+**：match3-board 棋盘 + clickable 选格 + craft-recipe 主动缝制（攒料→缝制升级店铺/解衣→换装→爱诗 AIGP 提示词）。配饰内容已定义、v0.4 接线。
- **Game D · 暗黑类 ARPG 切片(PoC)**：纯数据装配，零 ARPG 代码。ai-chase=aggro(感知→Relation target)+steering(追逐/CC)；技能=PrefabTemplate，释放=keybind(按键→Signal)→caster→prefab；hitbox 关系型结算+over-time(冰冻定时解冻/DoT)；mortal 逐实体死亡+掉落。6 测试证涌现。**已可玩**：launcher 卡带 + `game-d.tsx` 挂载（WASD 移动 + 1/2/3 释放冰/碎/烧）+ camera-follow + **R9 占位 sprite 穿皮** + **tilemap 地牢房间**（石地+四面墙,瓦片碰撞把英雄/怪框在房内；一份 Tilemap=一个 Hades 拼接积木）+ **anim-state 走/站/攻击动画 + facing 朝向**（英雄走路、怪追到你身边站定播攻击扑击、角色面朝移动/目标）。离线看帧：`vite-node src/games/game-d/render-frame.ts`。
- **Game E · 小丑牌 roguelike(Balatro 切片, 投资路演靶点)**：纯数据装配的卡牌计分链，零游戏 system。一手计分（同 tick）：**poker-hand**(REQ-011) 判牌型 set 基础 chips/mult → **card-scoring**(REQ-014) 逐张累加 baseChips + 逐张小丑(每♦+m/每人头+c/retrigger) → **effect-apply** op/order(REQ-012) 有序加乘 hand-level 小丑 → **valueFrom**(REQ-013) `hand_score=chips×mult`(资源×资源) + Bull 每$1+2c(量纲动态值)。每张小丑=一条声明式数据(Effect / PerCardRule / PerCardRetrigger)。150 张官方小丑元数据 + 起手 14 张铺满 7 型。`game-e.tsx` 挂载 + 透视器接入（stub blueprint）。**美术库**：131 张 Balatro .webp 卡面已入 `assets/FreeArtLib/index.json`（cardgame 分类，ArtLibBrowser 显示「小丑牌」filter chip）；`assets-model.ts` `gameEAssets()` 喂透视器 AssetBrowser（109 filled + 41 tbf + 14 额外素材，tag=['小丑牌',rarity]）。

## 3. TODO 审计（2026-06-08）

**✅ 已完成**（近期）：R1–R17（对话/资产/输入/物理接口摩擦全收敛）、REQ-001~008（PA 物理/相机/sensor/Tween loop/Sprite 穿皮/coop 下沉/set-sensor）、REQ-C-001~004（match3/clickable/craft/AIGP）、**R12 schema 校验器**、**Manifest 桥接 + 能力注册表**、**Studio 透视器/资产浏览器/ApolloBench/生成→透视器闭环**、**REQ-ARPG（Game D 暗黑切片）**、**Game E 卡牌计分簇 REQ-011/012/013/014**（poker-hand + effect-apply + card-scoring；772 绿）、**Game E 美术库接入**（131 张 Balatro webp → FreeArtLib/index.json + ArtLibBrowser「小丑牌」分类 + assets-model gameEAssets()）。

**🟡 仍 open**（见 `docs/workflow/requests.md`）：
| 条目 | 提出 | 内容 | 备注 |
|---|---|---|---|
| **R9** | PB | TBF 资产清单"诊所"工具（一步步填资产，四 provider） | 架构级 REVIEW 已由 Lead+Claude 完成；review 包已删清；follow-up 见 requests.md |
| REQ-C-005 | PC | match3-board 能力扩展 | P1 |
| REQ-C-006 | PC | match3-board 健壮性 | P2 |
| REQ-C-007 | PC | 特效组件（表现层） | P2 |

**🔵 Studio / 编辑器线未做的 follow-up**（本会话提出，非阻塞）：① 结构编辑（透视器里增删实体/组件，不只改字段值）；② headless 浏览器(playwright)真截图，补"真·视觉可用性"（升级 ApolloBench 的 Visual 轴）；③ **结构化意图层（含 GDD-first）**：NL/视频 → 一份小的"游戏意图(对象/规则/节奏)"结构化数据 → 再装配 manifest，**收窄生成空间、降发散**（Soon + OpenGame **双验证**的上下文工程招，见 `docs/ref/jiyi-soon.md`/`opengame.md`；编辑器设计见 `docs/design/ai-data-editor.md`）；④ 给 `Controllable` 等"引擎核心处理、无 provider schema"的组件补声明 schema → 解锁"速度/跳跃"等高频 NL 编辑（edit-eval 已记此缺口）。⭐ 用户已点：③ 结构化意图层最该先做。

## 4. 最高强度自审（别被"772 passed"麻痹）

- 🔴 **仍没在真浏览器里看过一帧**。"build 过 / 测试绿 / ApolloBench 过"都不等于"画面对"。ApolloBench 的 Visual 轴是**数据级代理**（渲染项有限且落在视口内），不是人眼/VLM 评审。→ follow-up ②。
- 🟠 **物理浮点跨端确定性**未在真双端验证（collision-resolve 进 hash）。
- ✅ ~~**性能债**：`World.query` 全表扫描~~ → **已还（2026-06-10）**：倒排组件索引 + creationSeq 保序（`query-perf-plan.md` 方案 A + 单调跳排序/稠密退化两增强）。稀有查询 36×（E=5000 实测 103→2.9µs），稠密持平，行为逐字节不变（880 绿 + 8 条对拍守护）。每 tick 结果数组分配仍在（queryEach 按需后置）。
- 🟠 **多 session 架构熵**：launcher/apollo.py/studio/三游戏在并行 session 累积，push 前务必 rebase。

## 5. 关键文件
- 宪法 `docs/design/data-driven-manifesto.md` ｜ 现状=本文件 ｜ 需求池 `docs/workflow/requests.md`
- ⭐ **游戏开发知识库 `wiki/skills/`（24 模块）+ 周期表 `wiki/atom-skill-periodic-table.md`** —— **开工任何新能力前先读对应模块**（角色文档点名必读，决定原子分解/命名，别另起炉灶）
- 外部参考/对比 `docs/ref/opengame.md` ｜ 经验证修复协议 `docs/ref/verified-fixes.md`
- 代码 `src/{engine,skills,assembly,studio,bench,services,net,renderer,games}` ｜ 启动器 `apollo.py`
- 设计 `docs/design/*` ｜ 游戏设计 `docs/game-design/*` ｜ 角色/协作 `docs/workflow/*`
