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

#### 任务 F-9 · ★ 用 self-rule 重构普攻链，拆掉「唯一 id 脚手架」 — status: **done（PE-F 2026-06-10 回执：036 二刷后 §5.4 配方贴回——普攻=Timer{id:'atk'}+SelfRule{timer ∧ whenGlobal(in_combat) → spawn strike at:'target'}，EventWhen/Caster/atk_<id> 信号全拆；攒蓝改 sidecar 时基回蓝（+4/9拍≈旧节奏，普攻信号消失后的等价物）；验收 +2 测：2×关羽错拍各自出手不串台、阶段门关停/恢复；game-f 14/14。大招半截（mp_<id> 蓝满→放→清）仍唯一 id，等 REQ-F-039 rules[]）**（原误编 F-5 撞号，Lead 改号 F-9）
- **F-036 残环已二刷断净（Lead 批注 2）**：真核是 self-rule→hitbox→resource-apply 三元环，已补 runsAfter:['hitbox']（决策坐结算链尾）；15 能力全家桶守护测绿。**你存档的 §5.4 接入 diff 可原样贴回重接。**
- **F-035 已落地，迁移解锁（Lead 批注）**：普攻/大招 SelfRule 一律加 `whenGlobal:{kind:'flag',id:'in_combat'}`（替代失效的"目标存在性门"——deploy 在 prep，备战期就有目标）。self-rule 定序已在引擎侧排雷（runsAfter flow/resource-apply/zone-occupancy/group-count），与回合 flow 同场不会抛环，相位门同帧生效。
- **PE-F 复测（2026-06-10，排雷后带 whenGlobal 重接）**：❌ **残环仍拦**——12→10 系统（flow/zone-occupancy 已拆出），残 SCC=`self-rule,event-when,caster,prefab-spawn,hitbox,over-time,resource-apply,destroy-apply,mortal,hierarchy-cascade`：`self-rule 写 Flag→event-when` 前向边 × `resource-apply→self-rule` 排雷回边合围（守护测没带 caster/prefab/hitbox 链）。REQ-F-036 已重开附走向推演与二刷建议；§5.4 配方已含 whenGlobal，主程拆环即贴回。再次回退保持全绿。
- **背景**：现 blueprint 每个英雄一套唯一 `Timer{id:atk_<hero>}` + `EventWhen{signal:atk_<hero>}` + `Caster{onSignal:atk_<hero>}`，靠"每英雄唯一 id"绕开全局 id 串台。这是会爆的脚手架——三星合体/同模板多实例（prefab 展开的 N 个同名单位）烘不进唯一 id，必崩。
- **引擎已就绪（Lead 2026-06-10 落地）**：`self-rule` 新增 **`spawn` 动作**（self 轴的 caster 对偶）：`{kind:'spawn', template, at:'self'|'target'}` → 自身条件触发，在自身/自身 Relation(target) 处发 SpawnRequest，prefab-spawn 展开。`at:'target'` 无目标则不生成（**目标存在性即战斗门**，可免全局 in_combat 旗标）。9 测绿含「同模板 3 实例各自按自身节拍生成」。
- **改法（纯数据，零游戏代码）**：每个英雄（及未来同模板单位）的普攻 = 一份 `Timer{id:'atk',loop}` + 一条 `SelfRule{ when:{kind:'timer',id:'atk',cmp:'gte',value:CD-1}, do:[{kind:'spawn',template:'strike_X',at:'target'}] }`。**关键收益**：三星/多实例可共用同一份 SelfRule 数据（不再每英雄唯一 id）。
  - 普攻打击模板 `strike_X` 的伤害若要随单位不同 → 走 `Stats` 或模板参数；同名同模板单位天然共用一个 `strike` 模板。
  - timer 到点后的复位：loop Timer 由 timer-advance 自动循环（或配 self-rule reset，按需）。
  - in_combat 门控：优先改用「目标存在性」（aggro 锁敌才有 Relation→才 spawn），可删全局 in_combat 旗标那套；若仍要显式备战/战斗阶段，保留 flow 设 in_combat、但普攻门用 target 存在性。
- **大招同理**：蓝条满 = 自身 Resource 阈值 → `SelfRule{when:{kind:'resource',id:'mp',cmp:'gte',value:100}, do:[{kind:'spawn',template:'ult_X',at:'target'},{kind:'modify-resource',op:'set',value:0}]}`（攒蓝/清蓝/释放一条规则搞定，替掉 mana EventWhen+Caster+两个 Effect 实体）。
- **验收**：blueprint 行数应显著下降；`game-f.test` 全绿；同模板多实例（可加一个 2×关羽测试）各自独立攻击不串台。发现引擎不够用 → 写 requests.md 提主程，**不要在游戏层 hack**。
- **策划审查批注（2026-06-10 第 9 轮提出，✅ 第 11 轮已解决——REQ-F-035 落地，按顶部 Lead 批注的 whenGlobal 写法做即可；下文论证留档）**：原处方"in_combat 门控可删/改用目标存在性"**不可照做**，会违反 flow-spec §3.3 铁律（备战/结算不动手）：
  ① deploy 在 **prep** 就展开（§3.3 prep ⑥，玩家备战要看阵），aggro 无门、立刻锁 Relation(target) → "目标存在门"备战期形同虚设，棋子会在备战期开打；结算期 wipe 前 60 拍幸存者也会继续互殴；
  ② `evaluateSelfCondition` **只读自身组件、无全局回退**（self-rule.ts 亲核）→ SelfRule 写不出 `timer ∧ 全局 in_combat`；给每单位发自身 flag 副本=群发写=Gap C 禁区。
  **正确路径**：⑴ **大招半边可立即迁**（蓝由普攻攒、普攻有门 → 备战 `mp≥100` 不可能成立，自身资源阈值天然 self）；⑵ **普攻半边等 REQ-F-035**（已提池：`SelfRule.whenGlobal?: ConditionExpr` 全局门，最小一格），落地后 `when:{timer} + whenGlobal:{flag in_combat}` 即恢复门控。验收请加一条「备战期/结算期无伤害事件」断言，防回归。

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

#### 任务 F-10 · REQ-F-037 迁移 odd-r 棋盘（纯数据，修"视觉≠逻辑相邻"） — status: **done（PE-F 2026-06-10 回执：①hex.ts LAYOUT 'odd-r' + project 改 axial 真投影（像素与旧 offset 恒等，画面不动）②摆子数据保持视觉 (col,row)，slotEntity/装饰格经 offsetToAxial 换算入 sim ③game-f 测 12/12 绿（含确定性 hash/走位/AOE 冻敌——八阵图 95px 大 AOE 命中正常）。'offset' 分支可删，知会主程）**
- 背景：现 `layout:'offset'` 是投影错位——**视觉相邻≠逻辑相邻**（每格有 1 个邻居看着隔 1.5 格其实一步可达、有 1 个看着贴脸其实隔 2 步），绕后/贴身判定骗人。引擎已落 `'odd-r'`（4 测绿）：sim 纯 axial 不变，矩形观感来自棋盘形状，几何≡拓扑。
- 迁移三步：① `HexBoard.layout: 'offset' → 'odd-r'`；② 每个棋子坐标从"视觉列" col 换算成 axial：`import { offsetToAxial } from '@skills/tier2/hex.js'`，`{q,r} = offsetToAxial(原q, 原r)`（原 q 在旧语义下就是视觉列）；③ 跑 game-f 测试，目测一局确认站位观感不变、走位不再"跳格"。
- 注意：大招 AOE 半径（ultSize 像素距离）基于 Transform——真投影下两布局像素位置不同步，迁完抽查 1-2 个 AOE 命中观感。**迁完在本行标 done 并知会主程**：主程随后删除引擎里废弃的 'offset' 分支。

#### 任务 F-11 · REQ-F-040 接入商店三件套（纯数据，MVP-1 商店 P0） — status: **in-progress（PE-F 2026-06-10：①买入核心 done——shop CardPile{袋12张/5槽/playCosts 金3+bench_space1（备战席9当第二货币，席满原子拒单=v2 §4.6 语义零新机制）/playedCodeResource}+每将 banded 分发+buycast 入席+码复位，验收测：拒单原子/扣金占席/据码入席/复位；②大招半截顺手完结（039 重组路线：over-time 永久回蓝+sidecar Perception+SelfRule 放清，mp 普通 id 全链 per-instance）；③余 刷新/锁店/卖出撞双缺口 → REQ-F-041 已提池（信号→card-pile 桥 + '@signal-source' 销毁寻址）。坑×2 记档：deck 必须 [...副本]（装配浅拷贝、嵌套数组共享，跨 Engine 漏确定性实测踩过）；capability 三过家门第二次忘加数组）**
- 引擎已落（4 测绿）：`CardPile.playedCodeResource`（成交拍把牌码写进该 id 的 Resource，恰取 1 张时）+ `CardPile.playCosts:[{id,amount}]`（全付得起才成交；被拒=牌不丢/不扣钱/Flag 不脉冲）。card-pile 定序已按"输入先行"钉七件套，与 flow/self-rule/group-count 等同场不抛。
- 接线：① 商店 CardPile{handSize:5(商店槽), playCosts:[{id:'gold',amount:3}], playedCodeResource:'bought_code'} + 牌码 Resource{id:'bought_code', max:9999}；② 每英雄一条 banded `EventWhen{when:{resource:'bought_code', cmp:'eq', value:英雄码}, mode:'edge', signal:'buy_<英雄>'}`；③ `Caster{onSignal:'buy_<英雄>', template:槽位模板, ...}` 造阵容槽。刷新商店=重写 deck（flow effect / 纯数据）。
- 注意：bought_code 是"最近一次成交"语义（一拍内同码连买需 edge 模式靠码变化触发——商店逐张买天然成立）；买完把 bought_code 复位为 0 可用 Effect{set 0}（防同码二连买不触发 edge）。

#### F-9 批注更新（Lead，REQ-F-039 裁决随附）：回蓝**不用** SelfRule——sidecar 挂 `OverTime{effects:[{id:'mp_regen', resource:'mp', amountPerTick:+4, period:30, duration:0, elapsed:0}]}`（永久 regen，现有能力字面覆盖）；SelfRule 名额留给"蓝满→放→清"。at:'target' 用你 ① 的 Perception sidecar 法（已验证）。F-039 标 wontfix-covered。

#### 任务 F-12 · REQ-F-041 接入商店余三件：刷新/锁店/卖出（纯数据） — status: **done（PE-F 2026-06-10 回执：①刷新=refreshOnSignal:'shop_refresh'，prep 自动（armed 旗→edge）+ 手动 $2（clickable→craft-recipe 原子扣金→reroll_paid→同名信号）；②锁店=shop_locked 门 + 锁/解锁两按钮（Effect 无 toggle 的零缺口拼法）+ 「门判定脉冲」shop_gate_done 先判后拆——躲'解锁先于门判定'与'解锁复燃 edge 补刷'双次序坑（锁恰好跳过下一个 prep 刷新一次，v2 §4.6 语义）；③卖出=marker Clickable→'@signal-source' destroy + 金2/席位+1 返还。验收测全链：自动刷新换牌/锁店跳过+自动解锁/手动扣2换牌/点席卖出返还。袋归还与超员自动卖随摆子输入域后补。坑：craftRecipeCapability 漏注册（capability 组件≠能力注册，第三次，已进 Gotchas 清单）**
- 引擎已落（5 测绿）：`CardPile.refreshOnSignal`（信号→弃全手补满；同拍撞 play 则输入忽略）+ `Effect.targetEntity:'@signal-source'`（destroy/set-* 作用于信号源实体——点谁卖谁）。
- 接线：① **刷新**：商店 CardPile 加 `refreshOnSignal:'shop_refresh'`；prep 自动刷新=flow onEnter 置 Flag→EventWhen(edge)→'shop_refresh'；2 金手动刷新=clickable 按钮→信号 + craft-recipe 扣 2 金（扣不起就别让按钮发信号：EventWhen 条件含 gold≥2）。② **锁店**：刷新 EventWhen 的 when 加 `not flag(shop_locked)`；锁按钮 toggle 该 Flag（Effect set-flag）。③ **卖出**：席位 marker 挂 `Clickable{action:'sell_seat'}` → `Effect{onSignal:'sell_seat', kind:'destroy', targetEntity:'@signal-source'}` + 返还三连（金按将价 Effect/craft-recipe、bench_space+1、袋归还视设计）。
- 注意：refreshOnSignal 配 **edge** 信号（常驻 Signal 会每拍刷）；卖出 destroy 经 Commit→次拍 cascade 连席位挂件一并清。

#### 任务 F-14 · REQ-F-042 接入商店可视化与点击购买（纯数据） — status: **done（PE-F 2026-06-10 回执：5 槽镜像资源 + 两段脉冲（T+1 destroy-tagged 全槽卡/T+2 按码重铺——错拍避免同拍误杀新卡）+ 每槽×每将 20 重铺带 + 持位 Caster overrides 注入槽专 Clickable/Tag + 点卡=buy_slot_i→playOnSignals 购买 + 买入再臂全板重铺；验收测：5 卡面可见/点卡扣金占席入席/面板重铺。同提交顺带：节奏玩家档（备战 30s 可 ready 跳过、结算 4s——用户实测'备战一闪而过'修复，测试走快速参数）+ 三态相位横幅 + 胜败终幕横幅）**
- 引擎已落（2 测绿）：`CardPile.handCodeResources:['shop_slot_1'..'shop_slot_5']`（每拍终态镜像，空槽 0）+ `CardPile.playOnSignals:['buy_slot_1'..'buy_slot_5']`（信号=play(i)，每拍至多一单、照过 playCosts 门）。
- 接线：① 5 个槽位 Resource{id:'shop_slot_i', max:9999}；② 每槽每将一条 banded EventWhen{resource:'shop_slot_i' eq 码, mode:edge, signal:'si_show_<将>'} → Caster 展开该将的商店 marker（复合模板：头像 Sprite+价格 Text+Clickable）；槽空(0)/换码 → 旧 marker 用 '@signal-source' 或 destroy-tagged 槽位掩码清。③ marker 挂 Clickable{action:'buy_slot_i'} → 信号即购买。
- 注意：镜像是"终态"（含补牌），买走后该槽当拍换新码——marker 展开/销毁链要按码变化的 edge 驱动，常驻不重复展开。

#### 任务 F-15 · REQ-F-043 接入 HUD 数字（纯数据） — status: **done（PE-F 2026-06-10 回执：金币/血量/等级/经验/阶段+回合 六枚 TextBinding 左上角实时投影；验收测：'金币 2'→买后跟跳）**
- 引擎已落 `t2-text-binding`（6 测绿）：实体挂 `Text + TextBinding{resourceId, prefix?, suffix?}` 每拍 content=prefix+值+suffix；蓝图 capabilities 加 `textBindingCapability`（id `t2-text-binding`）。
- 接线：金币 `TextBinding{resourceId:'gold', prefix:'金币 '}`；玩家血/等级同理；回合「3-2」两个数=两个 Text 实体并排（引擎单资源单绑定，保闭语法）。头顶等级用 fromParent:true（同 gauge）。

#### 任务 F-16 · REQ-F-044/047/048② 接入：拾取两清 + 羁绊乘区 + 卖出袋归还（纯数据） — status: **done（PE-F 2026-06-10 回执：①法球 zone+consumeOnHit+amount:-5 真结算一次同拍自毁、主角零附件，赏金 gold+5 测绿——坑：入账/清零两 Effect 必须 order 钉序（effect-apply 按实体 id 序，'clear'<'gold' 先清=搬运 0，实测）；②蜀魂羁绊最小版：group-count(FACT_SHU)→combat 态 edge 锁存 dmg_scale_a=1.2→strike/ult 全挂 scaleByResource（a/b 双系数资源，prep 复位）；③卖出链改每将信号四件套+sold_code>0 边沿→card_sold→returnOnSignal 袋底归还，deck 回长测绿）**
- 引擎已落（5 测绿）：① `Hitbox.consumeOnHit:true`——法球=zone{Hitbox{resource:'loot',amount:-5,targetMask:PROTAG}, consumeOnHit}，碰一下入账一次**同拍消失**（cascade 连挂件），主角零附件；② `Hitbox.scaleByResource:'<系数资源id>'`——羁绊链=group-count 计数→EventWhen 阈值→Effect 写系数资源→普攻/大招 strike 模板挂此字段（两阵营各自系数用槽位 overrides 改指向）；③ `CardPile.returnOnSignal:'card_sold'+returnCodeResource:'sold_code'`——卖出链每将 banded Effect{set sold_code=码}→袋底归还+清零。
- 注意：consumeOnHit 的"真结算"=过了阵营/状态门（空挥不消耗）；scaleByResource 只乘 amount 不乘 fracOfMax；sold_code 复位由引擎清零、无需手工 Effect。

#### 任务 F-17 · REQ-F-046/048① 接入：升星合成 + 超员自动卖（纯数据） — status: **done（PE-F 2026-06-11 终版=统一架构（同日 F-049 落地后重接，受限版 12 槽位×星级带契约整段删除）：①升星=marker 家族合成（bench/bench2/bench3_<将> 三档模板、每将两条 MergeRule、★ 角标子体随席 cascade）——「席位 marker 与上场槽同模板」即策划原批注语义，星级数值（血×1.8^n + strike/ult_s<n> 换弹=伤×1.5^n）烘在各档模板自带的 Caster.overrides 里，**模板家族本身就是星级**，零星级资源/计数带；板上 3 连=原地升星（merge 出身格继承）、席上合成留席；②超员自动卖=cap_armed 入战拍 + count_team_a≥1 门（棋子成型才查，不空放）→enforce_cap destroy-tagged keepResource:'level'——拖拽限额已在执行点强制 ≤level，此带=纵深保险丝；③bench_space 全派生：bench_cap−bench_occupied(GroupCount BENCH_OCC, onBoard:false 只数在席) 每拍 level 信号重算——买入占席/卖出让席/合成 3→1 回 2 席/拖上板自动让席全零手账（rune_c 改写容量源 bench_cap）；④袋扩 9/将（3星可达，只追加不重排锁前 24 张断言）；⑤星级卖价 2/8/26（=3×3−1/3×9−1），2/3星卖出不归还袋（3 张已熔毁，known wart 记 TUNE）。坑（已修已档）：部署窗若跨 resolution 活到 advance，stage/round 指针在窗内翻转 → deploy_stage_N 带误发双倍敌阵——resolution onEnter 关窗）**
- 引擎已落（3 测绿）：`PrefabOrigin` 出身戳（prefab 自动盖，零接线）+ `t3-merge-rule`（蓝图 capabilities 加 `mergeRuleCapability`，id `t3-merge-rule`）+ `Effect.keepResource`。
- 升星接线：每将每级一条 `MergeRule{template:'<将>_1', need:3, into:'<将>_2', intoOverrides:{main:{Resource:{...二星数值}}}}`（跨级再加 _2→_3 一条；_3 封顶=不写规则）。模板按星级分（'guanyu_1'/'guanyu_2'/'guanyu_3'），席位 marker 与上场槽用同一模板才会互相计数。
- 超员自动卖接线：入战拍信号（flow onEnter flag→EventWhen）+ `Effect{onSignal:'enforce_cap', kind:'destroy-tagged', value:上场掩码, keepResource:'level'}`——保最早上场的 level 个，多余按入场逆序清（挂件 cascade）。返还链（金/席/袋）先试 banded 重组，表达不了再提。
- 注意：merge 只数 prefab 展开的实例（带戳）；检测有一拍延迟（不可感知）；合成锚点=最老实例位置。
- 回执补注（PE-F）：「星级中途升档」当回合不重铺（部署窗已关），**下回合生效**——known wart，REQ-F-049 槽席统一后再审；返还链 banded 重组成立（派生席位+星级卖价带）唯袋归还不成立（按张语义对不上熔毁），已记 TUNE。

#### 任务 F-18 · REQ-F-045 接入摆子拖拽（纯数据+1 行壳层参数） — status: **done（PE-F 2026-06-11 终版，F-049/050/051/052/053 五单同晚落地后全量接通：marker 全星级挂 Draggable{snap:'hex', onlyFlag:'in_prep', capTagMask:BENCH_OCC, capResource:'level'}——备战拖上板=吸附格+写 HexPos=该格出兵点（'@origin-hex' 跟手）、拖回席=移除 HexPos=收兵、人口 ≥level 整次拒绝、战斗期 onlyFlag 锁拖；开局阵容=when_boot(stage_idx≥1 edge 恰一发)→4 个 bootcast（自带 HexPos）播种在板 marker，与买入 marker 同族可拖可卖可合成——旧固定槽 slot_<将> 全删，「上场=板上有 marker」单一事实源；部署窗移入战拍（备战期板上站的是可拖 marker 本体、开战才出兵成型→拖拽即时反馈），combat 加 after:30 最短驻留护 present 旗落定窗。落地途中抓获并修复引擎缺陷 REQ-F-053：壳层 down 无条件入队 → 按住 marker 起拖即被 clickable 卖掉——壳层点拖互斥（up 与 drag 二选一）+ marker 卖出改 Clickable{phase:'up'}。验收=升星全链测+拖拽全量测（吸附/拒超/回席/锁拖），24/24 + 1093 全绿）**
- 引擎已落（7 测绿）：壳层 `PointerInputSource` 已自动合成 drag 动作（如需调灵敏度传 `dragThreshold`）；sim 端蓝图 capabilities 加 `dragPlaceCapability`（id `t2-drag-place`）。
- 接线：席位/上场槽实体挂 `Draggable{snap:'hex', onlyFlag:'in_prep', capTagMask:我方位, capResource:'level'}`（+已有 Transform/Shape 作命中体）。拖上板=自动写 HexPos+吸附 Transform；拖下板=移除 HexPos 回席；超 level 整次拒绝。
- 注意：① in_prep Flag 由 flow onEnter 维护（备战 true/其余 false）；② 限额只数「Tag&mask 且带 HexPos」——席位 marker **别**在席上时挂 HexPos；③ 「部署链随新位置展开」先试纯数据（部署模板不带 HexPos / 被拖槽位直接充当上场单位），表达不了再提 F-049。
- 回执存档（PE-F，REQ-F-050 落地日补回测试）：交互断言脚本——备战拖 marker 到自由落点 `actions:[{key:'drag',x,y,values:[tx,ty]}]`→Transform=(tx,ty) 且无 HexPos；战斗期同拖 onlyFlag 拒（Transform 不动）。

> ✅ **引擎侧 REQ-F-026~048 全系列均已落地、全绿（F-038 空缺、F-039 重组覆盖）——五单批清零，PE-F 无引擎欠账**。PE-F 上述 F-1~F-18 皆可接（你交接报告里卡主程的两件——**F-029 血条→接 F-5，F-030 定身→接 F-6——已全部解锁，可继续**），纯数据 / 零游戏代码。不要在游戏层 workaround 引擎行为；若发现新引擎缺口，写 requests.md 提主程。

---

## 提请主程裁决 · REQ-F-032 回合重置（2026-06-10，策划 PF，用户拍板提报）

> **背景**：金铲铲对局流转已按真实游戏研究定稿 → **`docs/game-design/game-f-auto-chess.md` 同目录的 `game-f-flow-spec.md`**（程序员看 §3 状态机 + §4 数值表 + §6.2 开发队列）。
> **MVP-1（多回合 run/round 双层流程 + 商店买人 + 经济三件套 + 关卡表）唯一阻塞点 = REQ-F-032**：
> 「阵容跨回合持久、棋子战斗实例每回合满状态重开」——flow 动作无法生成/销毁实体、caster 单模板表达不了按阵容展开、snapshot/restore 未暴露为数据且会连经济一起回滚 → 纯数据重组不出来，真缺口。
> **两条候选路线（详见 `requests.md` REQ-F-032 条目）**：(A) 短暂实例式（按阵容/关卡清单逐条 SpawnRequest 展开 + 按 Tag 清场；策划倾向——复用已 done 的 REQ-021 self 作用域，顺手解锁 Phase 2 重复棋子）；(B) 快照恢复式（snapshot/restore 暴露为 flow 动作 + 结算账本）。
> **请主程**：裁 A/B（或更优方案）→ 引擎侧落地 → 在此回执；PE-F 据此接 MVP-1（队列见 flow-spec §6.2 P0~P2）。

### 给 PE-F · MVP-1 预告（REQ-F-032 落地后开工）

#### 任务 F-7 · MVP-1 多回合循环 + 商店 + 经济（纯数据） — status: **in-progress（PE-F 2026-06-10：多回合循环 + L1 run_flow + 经济三件套 + 阶段伤害 + 关卡表前 2 阶段 + ready 开战（按策划批注路线：clickable→'ready_btn'→set-flag，真实输入路验收测）已落、game-f 测 12/12；余 商店三件套 P0=REQ-F-040 等主程（原 038 撞号让位）、等级/经验 P2）**
- 按 `game-f-flow-spec.md` §3.2/§3.3 接 run/round 双层 GameFlow + §3.3 操作表（card-pile 商店 5 槽/craft-recipe 扣价/买经验）+ §4.1 经济三件套（收入爬坡/利息 banded/连胜金）+ §4.5 关卡表前 2 阶段。
- 全局 id **必须**先登记 flow-spec §3.1 注册表再用（防串台纪律）；验收测试随 §6.2 队列逐项补。
- **策划审查批注（2026-06-10，第 6 轮）**：上行"ready 输入 P2 归主程"**回驳——不需要主程**。`ready` 用现有词汇可拼：输入命令→信号（game-d 锦囊/game-e card-play 同款入口）→ `Effect{kind:'set-flag', targetId:'ready'}`，纯数据零引擎改动；点击形态可仿 game-b/c 的 clickable 区。请 PE-F 自接（仍 P2 不抢商店 P0 的队列序）；只有实际接缝试过确实不通，再写明证伪过程提 requests.md。

---

## 派发 v2 · 准则对齐（2026-06-10 晚，策划 PF，用户拍板「严格按照金铲铲设计」）

> **准则落库**：`docs/game-design/game-f-tft-reference.md`（用户提供金铲铲流程图全文转录）= 对齐基准；
> `game-f-flow-spec.md` 已升 **v2**（§2 重裁/§4.2 伤害公式/§4.6 商店备战席升星卖价细则/§4.7 主角拾取/§5 路线 v2）。

#### 任务 F-7 · 商店部分 — 策划批注 v2（细则升级，REQ-F-040 落地后照此接）
- 商店实现按 **flow-spec §4.6 v2 细则**：5 槽自动刷 + 2 金手动刷 + **锁店**（`shop_locked`，每回合自动解锁）+ 买入→**备战席 9 槽** + **卖价表**（1星=卡价 / 2星=×3−1 / 3星=×9−1）+ **超员且席满自动出售**（入战检查拍）+ **战斗期可买/刷/卖、不可摆子**（相位门）。
- **连败金纳入 MVP-1**（准则 P2 明示连败奖励；与连胜金同形 banded，读 `loss_streak`，id 先登记 §3.1）。

#### 任务 F-13 · 主角（小小英雄）+ 野怪法球拾取（纯数据） — status: pending（Phase 2.5，用户点名；排商店之后）（原编 F-11 与商店买入任务撞号，策划让号改 F-13）
- 照 **flow-spec §4.7** 数据映射整段执行：主角实体（无队伍位+PROTAG 位）/ 操控仿 game-d / 野怪 `Mortal.dropTemplate:'loot_orb'` / 法球双向 hitbox（球给主角本地 `loot`、主角"杀"球）/ `loot→gold` 经 `valueFrom` 转账入账。
- ⚠️ 防串台：主角赏金袋用独有 id `loot`，**禁用** 'gold' 作本地袋（与全局金币撞 id=陷阱②）；PROTAG/LOOT Tag 位先登记 blueprint 位表。
- 前置：野怪回合（关卡表加野怪条目+掉落字段，同 deploy 链）；验收：野怪死→法球落地→主角走过→gold 增加、法球消失、确定性 hash 稳定。

---

## 派发 ·「三足鼎立 / 孙刘抗曹」扩展立项（2026-06-10，策划 PF，用户拍板）

> **两份新文档**：策划案 `docs/game-design/game-f-coop-sunliu.md`（三方混战/赤壁战场/双人合作/分阶段 C0~C2）；
> UI 简报 `docs/design/game-f-coop-ui-brief.md`（**给 Claude designer**——同视角同 UI/组件清单/交付格式）。
> 单机主线不受打乱：C1 起步在 MVP 收尾后；**即时生效的只有下面纪律项**。

#### 给主程 · C0 任务 · REQ-F-056 战斗跨端确定性探针 — status: pending（随时可做，便宜，先证不赌）
- 扩既有 lockstep 双实例对拍：跑 game-f 战斗蓝图 3000 拍逐拍比 hash；绿=联机地基就绪，红=报首个发散拍定位。详见 requests.md F-056。

#### 给 PE-F · 即时纪律四条（N 阵营原则，违者审查拦）— status: 长期生效
- ① 索敌/伤害的"敌方"写成掩码数据，**勿写死两队**；② 操作区/HUD 数据模板按 owner 参数化；③ 上阵合法区=deploy zone 数据；④ lockstep 三纪律照守（整数 SIM/命令输入/表现不进 hash）。
- UI 布局：**顶部预留队友镜像条高度**（合作模式 A 区，见 UI 简报 §2/§5）。

#### 给 Cloud Designer · 合作 UI 设计 — status: pending
- 按 `docs/design/game-f-coop-ui-brief.md` 出布局规格/状态机/资产 key/数据实体草稿；红线与交付格式在简报 §3/§5/§6。
