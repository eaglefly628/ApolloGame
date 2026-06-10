# Programmer Inbox

> Lead 写入任务，Programmer 轮询读取。
> 格式约定：每个任务一个 section，状态标记 pending/in-progress/done。

## ✅ 批次 T1-完结 —— 已由 Lead 自补完成（2026-06-03），勿重复

> PA 未在本 session 周期内交付该 3 个；按"小型低耦合任务单 agent 更快"的结论，Lead 直接写完并集成到 mainbranch：
> `rotation-apply`(Rotate) / `animation`(Update,consume TimerDone) / `hierarchy-resolve`(PostResolve)，相位已修正、测试全绿（全量 272 passed）。
> 下方为原派发存档（保留以备查）。

### 原派发存档 · 批次 T1-完结（派给 Programmer A，3-wide 并行）

> **基线**：`claude/mainbranch`（已含 Lead 写好的契约：`SystemPhase` 加 `Rotate`/`PostResolve`、`Trigger` 组件）。
> **开工前必做**：`git fetch origin claude/mainbranch && git reset --hard origin/claude/mainbranch`。
> 详细设计参考你自己的 `programmer-a/next-batch-proposal.md`，但**相位以下方 Lead 修正为准**。
> 自检：`tsc --noEmit` 干净 + 各自 `vitest` 全绿 + 只在 `src/tier1/index.ts` 追加一行 export + 不碰引擎核心/protocol。完成写 `outbox.md`。

### 任务 1 · rotation-apply — status: pending
- 文件：`src/tier1/rotation-apply.ts` + `.test.ts`
- `reads ['Transform','Velocity'] → writes ['Transform']`；**`phase: SystemPhase.Rotate`**
  （修正：原提案写 Update 会与 motion-apply 在 Transform 上同阶段、两个读改写判成环）
- 公式：`transform.rotation += velocity.angular`（motion-apply 的镜像，定步长无 dt）

### 任务 2 · animation — status: pending
- 文件：`src/tier1/animation.ts` + `.test.ts`
- `reads ['TimerDone','Frame'] → writes ['Frame']`；`phase: Update`（缺省，省略 phase 字段）
- 计时到点推进：`frame.index = (index + 1) % total`（loop 环绕）；`TimerDone` 的 read/consume 与 `timer-advance` 保持一致

### 任务 3 · hierarchy-resolve — status: pending
- 文件：`src/tier1/hierarchy-resolve.ts` + `.test.ts`
- `reads ['Hierarchy','Transform'] → writes ['Transform']`；**`phase: SystemPhase.PostResolve`**
  （修正：原提案写 Resolve 会与 collision-resolve 在 Transform 上同阶段、判成环）
- 子世界 Transform = 父复合本地偏移（位置相加、旋转相加、缩放相乘；**最小形态本地偏移不随父旋转**，避免 sin/cos）；按父链深度先根后叶，多级一帧到位

> **协调说明**：Lead 先前误用后台子 Agent 把这 3 个也跑了——但那是 Lead session 内的并行；按分工**这 3 个归 Programmer A 的独立 session**。Lead 误跑产物已丢弃，请 A 从干净基线自建。`counter` 折叠为 Macro，留到下一轮。

---

## 派发 · Game E / Game F 数据接线（2026-06-10，Lead/主程4）

> **边界（用户 2026-06-10 拍板）**：游戏层（`src/games/**`）一律归各 PE，Lead 只动引擎+文档、不动手接线。
> **基线**：`claude/mainbranch` @ `f3fbc89`（引擎能力全部就绪：tsc + vitest 934 + build 全绿）。
> **开工前必做**：`git fetch origin claude/mainbranch && git rebase origin/claude/mainbranch`（多 session 并行，push 前同样 fetch→rebase）。
> 自检：tsc + vitest + build 全绿才推。完成在本节任务行标 done 并写 `outbox.md`。

### 给 PE-E（Game E · 小丑牌）

#### 任务 E-1 · REQ-017/020 回合流程数据化 — status: pending
- 用 `flow`（声明式状态机=流程数据，onEnter+条件转移+`after` 时序门）+ `card-pile`（牌库/手牌 sim 内管理：发牌/下标出牌/弃牌/补牌）把 game-e 回合流程重写为**纯数据**，替掉手写回合代码。
- 出牌输入接缝 `card-play`（REQ-016/017，按 owner 路由）已就绪。

#### 任务 E-2 · REQ-019 ScoreTrace 计分回放 — status: pending（你已在接，继续）
- 读 `score-trace` 逐步 trace 做计分回放 UI（trace 已排除出 hash、opt-in）。

### 给 PE-F（Game F · 金铲铲）

#### 任务 F-1 · REQ-F-026 接入 hierarchy-cascade（1 行数据） — status: **done（策划 PF 审查确认 2026-06-10）**
- game-f blueprint 的 capabilities 列表加 `hierarchyCascadeCapability`（`@skills/tier1/index.js` 已导出；manifest 用 id `t1-hierarchy-cascade`）。
- 即修「死棋子头顶名字残留」：父销毁同帧级联清后代，引擎侧已落 `f3fbc89`（8 测绿）。零游戏代码。
- ✅ 审查证据：blueprint 已挂 `hierarchyCascadeCapability`（commit `8e417ef`）+ 测试「棋子死亡→头顶名字子体随之消失」绿。

#### 任务 F-2 · REQ-021/022 自治/羁绊接线 — status: pending（按 `game-f-flow-spec.md` §5 属 Phase 2/3，**勿先于 MVP-1 动工**）
- `self-rule`（实体本地条件→对自身施效）+ `group-count`（按 Tag 计数→Resource，阈值=event-when 重组）接金铲铲自治/羁绊。

#### 任务 F-5 · ★ 用 self-rule 重构普攻链，拆掉「唯一 id 脚手架」 — status: pending（高优先，用户点名）
- **背景**：现 blueprint 每个英雄一套唯一 `Timer{id:atk_<hero>}` + `EventWhen{signal:atk_<hero>}` + `Caster{onSignal:atk_<hero>}`，靠"每英雄唯一 id"绕开全局 id 串台。这是会爆的脚手架——三星合体/同模板多实例（prefab 展开的 N 个同名单位）烘不进唯一 id，必崩。
- **引擎已就绪（Lead 2026-06-10 落地）**：`self-rule` 新增 **`spawn` 动作**（self 轴的 caster 对偶）：`{kind:'spawn', template, at:'self'|'target'}` → 自身条件触发，在自身/自身 Relation(target) 处发 SpawnRequest，prefab-spawn 展开。`at:'target'` 无目标则不生成（**目标存在性即战斗门**，可免全局 in_combat 旗标）。9 测绿含「同模板 3 实例各自按自身节拍生成」。
- **改法（纯数据，零游戏代码）**：每个英雄（及未来同模板单位）的普攻 = 一份 `Timer{id:'atk',loop}` + 一条 `SelfRule{ when:{kind:'timer',id:'atk',cmp:'gte',value:CD-1}, do:[{kind:'spawn',template:'strike_X',at:'target'}] }`。**关键收益**：三星/多实例可共用同一份 SelfRule 数据（不再每英雄唯一 id）。
  - 普攻打击模板 `strike_X` 的伤害若要随单位不同 → 走 `Stats` 或模板参数；同名同模板单位天然共用一个 `strike` 模板。
  - timer 到点后的复位：loop Timer 由 timer-advance 自动循环（或配 self-rule reset，按需）。
  - in_combat 门控：优先改用「目标存在性」（aggro 锁敌才有 Relation→才 spawn），可删全局 in_combat 旗标那套；若仍要显式备战/战斗阶段，保留 flow 设 in_combat、但普攻门用 target 存在性。
- **大招同理**：蓝条满 = 自身 Resource 阈值 → `SelfRule{when:{kind:'resource',id:'mp',cmp:'gte',value:100}, do:[{kind:'spawn',template:'ult_X',at:'target'},{kind:'modify-resource',op:'set',value:0}]}`（攒蓝/清蓝/释放一条规则搞定，替掉 mana EventWhen+Caster+两个 Effect 实体）。
- **验收**：blueprint 行数应显著下降；`game-f.test` 全绿；同模板多实例（可加一个 2×关羽测试）各自独立攻击不串台。发现引擎不够用 → 写 requests.md 提主程，**不要在游戏层 hack**。

#### 任务 F-3 · REQ-F-027 接入 offset 棋盘布局（纯数据） — status: **done（策划 PF 审查确认 2026-06-10）**
- HexBoard 加 `layout: 'offset'`（修「棋盘平行四边形」→规整矩形 + 六边形交错,金铲铲观感）+ 按需 cols/rows(~12×12)。引擎已落（缺省 'axial' 不影响现有蓝图）。零游戏代码。
- ✅ 审查证据：blueprint board 实体已用 `layout: LAYOUT`（offset，commit `b14d109`「正交12×12棋盘」）。

#### 任务 F-4 · REQ-F-028 接入 flow 回合阶段机（纯数据） — status: **done（策划 PF 审查确认 2026-06-10；注意：单局版）**
- 备战→战斗→结算→gameover 用一份 GameFlow 数据接（flow 已加 `runsAfter:['zone-occupancy','group-count']` 破环，引擎侧已落）。
- ✅ 审查证据：blueprint `flow_ctrl` 实体已挂 GAME_FLOW（prep→combat→resolution→done/gameover，commit `b14d109`）。
- ⚠️ 当前是**单局版**（resolution 不回 prep）；多回合循环 = MVP-1 主体，**被 REQ-F-032 阻塞**（见下方提请）。

#### 任务 F-5 · REQ-F-029 接入实时血条/蓝条（纯数据，每棋子两个子实体） — status: **done（PE-F 2026-06-10 回执：gaugeCapability + 每棋子 hpbg/hpbar/mpbg/mpbar 四条子实体，PF-finish-list §5.1 方案原样落地；game-f 测 +1「缩条/充条」断言，vitest 959 全绿）**
- 引擎已落 `t2-gauge`（10 测绿）：每 tick 把 Resource 比例写成条实体自身 `Shape.width`，并左锚补偿 `Hierarchy.localX`（左端钉死、从右端缩）。**渲染器零改动**；跟随=hierarchy-resolve、随棋子死=hierarchy-cascade（F-1），全自动。蓝图 capabilities 加 `gaugeCapability`（id `t2-gauge`）。
- 每棋子加两个子实体（替掉静态数字 Text）：
  - 血条（绿）：`Hierarchy{parentId:棋子, localY:头顶上方} + Shape{kind:'box', height:~4} + Color{tint:绿} + Gauge{resourceId:'hp', fromParent:true, width:~40}`（共享 id 'hp' **必须** fromParent:true，全局取会取错单位）
  - 蓝条（蓝）：同上，`Gauge{resourceId:'mp_<英雄>', width:~40}`（唯一 id，缺省全局路由），localY 比血条再低 ~5
- 注意：条实体的 Shape 仅作渲染几何，**别**给条挂 Collider/Velocity/Hitbox（条不参战）；`leftX` 缺省 -width/2 = 满条居中，通常无需设。

#### 任务 F-6 · REQ-F-030 接入 CC 定身（纯数据） — status: **done（PE-F 2026-06-10 回执：FROZEN=1<<10（Status 位空间）+ 棋子 GridMover.haltStatusMask + 八阵图 Hitbox setMask/statusDuration:120；game-f 测 +1「冻敌」断言，vitest 959 全绿）**
- 引擎已落 `GridMover.haltStatusMask`（对齐 Steering 同名语义，4 测绿）：自身 Status 命中掩码 → 本 tick 不走且**节奏时钟暂停**（解控按剩余节奏恢复、无补步突进）。定序已在引擎侧用 `runsBefore:['hitbox','over-time']` 破环——CC **延迟一帧生效**（与 steering/game-d 同纪律，60tps 不可感知）。
- 接入：① 每棋子 `GridMover` 加 `haltStatusMask: FROZEN位`；② 控制技（如诸葛"八阵图"）hitbox `setMask=FROZEN + statusDuration=持续 tick` → 被冻定身、over-time 到点解冻。全纯数据，零游戏代码。

#### 任务 F-7 · REQ-F-032 接入回合重置（纯数据，MVP-1 多回合循环解锁） — status: **done（PE-F 2026-06-10 回执：F-033 落地后按清单接入——每英雄复合模板（10 实体，'@local:main' 互指）+ 8 持久槽位（Caster.overrides 写站位/阵营/数值）+ deploy/deploy_stage_1/wipe 三信号 + round_flow 改 prep⟲combat⟲resolution 循环 + destroy-tagged×2 清场；全局 id 已登记 flow-spec §3.1；game-f 测 9/9 绿（含两回合循环：清场无孤儿、槽位/库持久、新实例 id 全新满状态），vitest 967 全绿）**
> **PE-F 回报**：棋子不是裸单位，是「单位+名牌+条×4+蓝 sidecar+大招接线」复合体；prefab `instantiate` 深拷贝**不重映射**模板内部实体引用（`Hierarchy.parentId`/`Caster.originEntity` 展开后悬空 → 条不跟随、**永不级联**（cascade 只认真实父 id）、大招哑火），`overrides` 也写不出含运行时 seq 的实例 id。硬接 = 棋子模板只能装裸 main，**当场回退刚上线的 F-5 血条/F-1 名牌**。已写 `requests.md` REQ-F-033（含证伪四条 + 候选 A/B），落地后按本清单 + PF-finish-list §5.3 草案即接。
- 引擎已落（4 验收测绿）：`SpawnRequest.overrides` + `Caster.overrides` 透传（prefab 逐字段合并，同模板异构实例）+ `Effect kind:'destroy-tagged'`（value=Tag 掩码批量清场，cascade 连挂件）。**零新系统**——阵容=槽位实体（持久），每槽 `Caster{onSignal:'deploy', template:英雄, at:'self', overrides:{main:{HexPos:{q,r}, Tag:{flags:阵营}, Resource:{...星级数值}}}}`。
- 接线清单（flow-spec §3.3 对照）：① 棋子改成 PrefabTemplate 进 `PrefabLibrary`（含 hp Resource/Tag 占位，被 overrides 改写）；② 我方/敌方槽位实体（敌方按关卡分 `deploy_stage_N` 信号）；③ GameFlow 备战态 onEnter 置 Flag → event-when(edge) → 'deploy' 信号；结算态同法发 'wipe'；④ 两条 `Effect{onSignal:'wipe', kind:'destroy-tagged', value:各阵营掩码}`。买/卖/挪位 = 增删改槽实体（纯数据）。
- 注意：槽位 Transform 直接放 hex 投影坐标（消除展开后一帧跳变）；信号是 edge（event-when 产出单拍），别手放常驻 Signal；星级=overrides 改 Resource max/current（每星一套数值进槽位数据）。
- **F-033 已修，复合模板解锁**：模板内指兄弟实体一律写 `'@local:<localId>'`（如名牌 `Hierarchy{parentId:'@local:main'}`），展开时自动重映射为实例 id——单位+名牌+血条+大招接线打成**一个模板**整体生灭。**坑**：sidecar（大招接线等）也要挂 `Hierarchy{parentId:'@local:main'}` 才随主体级联（级联只沿 Hierarchy 边走，光有 originEntity 会清场幸存）；未知后缀原样保留（typo 直接可见）。

#### 任务 F-8 · REQ-F-034 接入平滑滑行（纯数据，1 字段/棋子） — status: **done（PE-F 2026-06-10 回执：棋子模板 GridMover 加 glideSpeed:0.8——取策划审查下限（相邻格 ~33px/48 拍 ≈0.7，留余量）；game-f 测 +1「每拍位移 ≤0.8、真在滑」断言）**
- 引擎已落 `GridMover.glideSpeed`（px/tick，4 测绿）：HexPos 逻辑瞬步不变（占位/寻路/hash 真相），Transform 恒速滑向格点、到点精确贴齐；缺省不设=原瞬移。冻结时滑行一并停（时间静止）。
- 接入：每棋子 GridMover 加 `glideSpeed`。**取值**：≥ 格距/period 免视觉掉队（你的盘 tileSize≈18、period 48 → 最小 0.375；建议 0.5~1.0 之间调观感）。名牌/血条挂件经 hierarchy-resolve 自动跟滑，零额外改动；槽位展开的一帧跳变也随之消失。

> ✅ **引擎侧 REQ-F-026/027/028/029/030/031/032/033/034 均已落地、全绿**。PE-F 上述 F-1~F-8 皆可接（你交接报告里卡主程的两件——**F-029 血条→接 F-5，F-030 定身→接 F-6——已全部解锁，可继续**），纯数据 / 零游戏代码。不要在游戏层 workaround 引擎行为；若发现新引擎缺口，写 requests.md 提主程。

---

## 提请主程裁决 · REQ-F-032 回合重置（2026-06-10，策划 PF，用户拍板提报）

> **背景**：金铲铲对局流转已按真实游戏研究定稿 → **`docs/game-design/game-f-auto-chess.md` 同目录的 `game-f-flow-spec.md`**（程序员看 §3 状态机 + §4 数值表 + §6.2 开发队列）。
> **MVP-1（多回合 run/round 双层流程 + 商店买人 + 经济三件套 + 关卡表）唯一阻塞点 = REQ-F-032**：
> 「阵容跨回合持久、棋子战斗实例每回合满状态重开」——flow 动作无法生成/销毁实体、caster 单模板表达不了按阵容展开、snapshot/restore 未暴露为数据且会连经济一起回滚 → 纯数据重组不出来，真缺口。
> **两条候选路线（详见 `requests.md` REQ-F-032 条目）**：(A) 短暂实例式（按阵容/关卡清单逐条 SpawnRequest 展开 + 按 Tag 清场；策划倾向——复用已 done 的 REQ-021 self 作用域，顺手解锁 Phase 2 重复棋子）；(B) 快照恢复式（snapshot/restore 暴露为 flow 动作 + 结算账本）。
> **请主程**：裁 A/B（或更优方案）→ 引擎侧落地 → 在此回执；PE-F 据此接 MVP-1（队列见 flow-spec §6.2 P0~P2）。

### 给 PE-F · MVP-1 预告（REQ-F-032 落地后开工）

#### 任务 F-7 · MVP-1 多回合循环 + 商店 + 经济（纯数据） — status: **in-progress（PE-F 2026-06-10：多回合循环 + L1 run_flow + 经济三件套 + 阶段伤害 + 关卡表前 2 阶段已落、测 10/10；余 商店三件套 P0、ready 输入 P2（输入路由归主程）、等级/经验 P2）**
- 按 `game-f-flow-spec.md` §3.2/§3.3 接 run/round 双层 GameFlow + §3.3 操作表（card-pile 商店 5 槽/craft-recipe 扣价/买经验）+ §4.1 经济三件套（收入爬坡/利息 banded/连胜金）+ §4.5 关卡表前 2 阶段。
- 全局 id **必须**先登记 flow-spec §3.1 注册表再用（防串台纪律）；验收测试随 §6.2 队列逐项补。
- **策划审查批注（2026-06-10，第 6 轮）**：上行"ready 输入 P2 归主程"**回驳——不需要主程**。`ready` 用现有词汇可拼：输入命令→信号（game-d 锦囊/game-e card-play 同款入口）→ `Effect{kind:'set-flag', targetId:'ready'}`，纯数据零引擎改动；点击形态可仿 game-b/c 的 clickable 区。请 PE-F 自接（仍 P2 不抢商店 P0 的队列序）；只有实际接缝试过确实不通，再写明证伪过程提 requests.md。
