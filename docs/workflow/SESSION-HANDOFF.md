# Session 交接 · 2026-06-04 —— 给下一任主程（Lead），读这一份即可无缝接手

> ⛔ **最高原则（先读，不可偏离）：`docs/design/data-driven-manifesto.md`**
> —— 整个游戏是**数据**，不是代码；代码只属于引擎这台固定的确定性解释器。所有"该数据还是代码"的争议，
> 用纲领里那把尺子裁决：**"最弱的 LLM 能不能也产出一模一样的？" 能→数据接口；不能(要写自由代码)→ 拒绝，做成 DSL 或下沉成 capability。**
>
> **工作目录 = `MemBrain`**(本地 clone 名)；远端 = `eaglefly628/ApolloGame`。两者不一致正常。
> **分支 = `claude/mainbranch`(默认/主分支)。直接推，不开 PR。** 每次提交前 `fetch → rebase → push`(多 session 并行)。全绿(tsc + vitest + build)才推。

---

## 0. 一分钟接手

引擎广度已经很大(374 passed, tsc 干净, build 通过)，但**战略上刚做了一次重大纠偏**：用户立了"数据驱动第一性原则"，并指出我们**漂离了差异化命题**（见 §3、§4）。
**下一个最高优先动作 = 接 R15：把 PB 写的"对话运行器"下沉成通用 `dialogue`(叙事解释器) capability** —— 这是数据驱动原则的**第一块试金石**(game 代码 → 通用 capability → 游戏变纯数据)，PB 已附实现+8 测试。详见 §5。

---

## 1. 第一性原则（宪法，§0 已指）
游戏=数据 / 代码=解释器。四层：组合・导演/流程・自定义规则(DSL) 都是**数据**(AI/用户碰)；capability=引擎代码(只有引擎团队加)。缺表达力 → **下沉成通用 capability**，不在游戏写代码。唯一逃生舱=沙箱"自定义能力"(工程师写、非 AI、记债)。硬指标=游戏里"数据 vs 代码占比 → 100% 数据"。

---

## 2. 技术现状（已建）

**引擎核心**：`World`(ECS, snapshot/restore/确定性 `hashSnapshot`，**Camera 已排除出 hash**=纯表现浮点)；`SystemPhase`(Update/Rotate/Resolve/PostResolve/Commit)+ **显式 `runsAfter/runsBefore`**(R10，破 RMW 伪环)；topological-sort。

**Skill 库**(`src/skills/{atoms,tier1,tier2,tier3,tier4}`，见 `src/skills/README.md`)：
- **atoms**：26 核心原子 + 扩展 `string-variable`(R4)。
- **Tier1**：accel/motion/rotation/animation/hierarchy/lifetime + **tween**(连续插值，只驱动 Transform/Color，逻辑值不走 tween)。
- **Tier2 物理(A 轴)**：collision-resolve(冲量求解器)/ground-sense/jump/bounds-clamp/trigger-zone/friction。
- **Tier2 逻辑(B 轴) ⭐主链合龙**：**`condition`**(布尔树，叶子 resource/flag/state/timer/string，按 id 全局查 + `buildConditionLookup` O(1) 索引) → **`event-when`**(条件→Signal，edge/level) → **`effect-apply`**(信号→置 Flag/改 Resource/设 State，Commit 相位，一拍反馈) → 已建 **camera-follow**(涌现系统，写 Camera 纯数据)。
- **resource 全局按 id 路由**(R11，`scope:'local'|'global'` 防遮蔽)。
- **Tier3/Tier4**：占位空。

**基础设施(Phase 1，命令式服务/端口，sim 之外)** —— 全清单/状态见 `docs/design/phase1-game-infrastructure.md`：
- **Batch I ✅**：camera-follow + 渲染器世界→屏幕投影(卷轴) ｜ `src/services/storage/`(StoragePort + Memory/LocalStorage + SaveSystem)。
- **Batch II ✅**：`src/services/audio/`(AudioPort + Null/Web + AudioSync，按 EntityId+引用计数) ｜ 指针输入(`net/queued-input.ts` QueuedInputSource/PointerInputSource → 单例 `InputQueue`) ｜ 多行文本(`renderer/text-layout.ts` wrapLines + 渲染器缓存)。
- **Batch III/IV 未做**：句柄管理/消息总线 ｜ scene-transition/主循环暂停单步。**(注意 §4：先别急着加宽。)**
- 运行时：`runtime/engine.ts`(固定步长 + 输入按 tick 注入接缝 + hash)；`net/`(lockstep)；`debug/`(record/replay/snapshot/tracer = Studio 倒带地基)。

**两轮外部 review(Gemini)已收敛**：架构级 6 问 + 代码级 5 修，全部落地，归档 `docs/review/2026-06-04-*.md`。导出惯例：每批新代码拼成 `review-for-gemini-*.txt` 发用户喂 Gemini，结论回灌。

---

## 3. 战略处境（诚实）

- **差异化命题**：不是"我们有引擎"(市面一句话生成工具底下也有引擎)。是引擎的**结构**让 AI 生成不一样：**确定性+快照/回放**(产出可验证/可调试/可回滚/可迭代) + **原子→涌现+Condition→Event→Effect 是受约束可校验的组合靶子**(AI 拼合法积木，不裸写代码→杜绝 gameslop) + **TBF 策展资产**(防资产 slop)。
- **Studio 愿景(真护城河，见 §6 待写文档)**：围绕一个**持久结构化"游戏制品"**的工具——实时预览 + **时间倒带/回放检视** + **外科手术式微调(AI/人，可 diff)** + **回放回归测试** + **TBF 填充到商用**。把市面"看一眼就没了"变成"看得懂/改得动/测得住/填得满/回不退"的闭环。**地基已有一半**(snapshot/replay、debug、TBF 资产、defineCapability describe 元数据、dev-tools 面板雏形)。
- **垂直切片进行中**：用户已让 PA/PB 做"端到端能跑的真实游戏"。**真验收 = 多少能纯数据表达；必须写代码的地方 = 该下沉哪个 capability 的信号清单。**

---

## 4. 最高强度自审（接手前必读的风险，别被"374 passed"麻痹）

- 🔴 **零集成**：camera-follow / AssetManager / AudioSync / SaveSystem / QueuedInputSource / tween / event-when / effect-apply —— **被真实游戏引用数=0**(已 grep 验证)。所有测试都是**单元级隔离**。集成层一行没写，而集成层是 bug 藏身处。
- 🔴 **从没在浏览器里真正跑过、看过一帧**。"能 build"≠"能跑能玩画面对"。我们对"它真работает"的信心**全来自类型+单测，没有一次来自眼睛**。
- 🟠 **曾违背自己的纪律**：从某点起切到"自主把所有基础设施做完"=当初警告的 YAGNI/过度设计。**已用第一性原则纠偏**(别再无脑加宽 Batch III/IV)。
- 🟠 **性能债**：`World.query` 每次**全表扫描所有实体 + 分配新数组/元组**，每 system 每 tick 多次，无 archetype/索引；`collectRenderables` 每帧分配 N 对象(Gemini #4 已记延后)。N 小没事，上规模会卡。
- 🟠 **物理浮点跨端确定性从未验证**：真正的 lockstep desync 雷是 collision-resolve(迭代+浮点)进 hash，**跨浏览器一致性一直 hand-wave，没测过**。
- 🟠 **多 session 架构熵**：launcher/Python API/dev-tools/game-a-b 在不同 session 累积，曾有**冲突标记被提交进 main**。无单一 owner 守全局一致性。
- **代码债清单**(manifesto §8)：`game-a/coop-goal.ts`、`game-b/dialogue-runner.ts`、`game-b/ui/VNStage.tsx`、`*.ts` 蓝图 —— 都是对第一性原则的负债，偿还=下沉成 capability / 蓝图变纯数据 / UI 变数据描述。

---

## 5. 待处理需求 + 优先级 + 强烈建议（`docs/workflow/requests.md` 全文）

PA、PB **都没 hack，都按规矩提需求等 Lead**(协作模型在生效)。

| 需求 | 提出 | 内容 | 性质 | 权重 |
|---|---|---|---|---|
| **R15** | PB | **对话运行器下沉成通用 `dialogue`(叙事解释器) capability** | **数据驱动第一块试金石** + 揭示缺失的"解释器 capability"大类(走声明式数据图：对话/任务/行为树)；PB 附实现+8测试 | 🥇 **最高** |
| **R12** | PB | 蓝图组件数据**按 schema 静态校验** | AI 生成数据的"**静态校验器**"护城河，数据驱动刚需 | 🥈 高 |
| REQ-002 | PA | **sensor/非实心触发体**(collision 跳过 trigger zone 接触对) | Game A 物理；**堵死全部第一批合作机制**(踩开关/限时门/重量台) | 🥉 高 |
| REQ-003 | PA | ground-sense 认**动态支撑**(踩搭档/箱子能跳) | Game A 物理；堵死能力差异批 | 🥉 高 |
| R14 | PB | 批量改资源 + `world.findByComponentId(type,idField,id)` 助手 | 创作面 DX，两游戏共写"按 id 找实体" | 中 |
| R5/R7 | PB | condition(已基本被 event-when 覆盖)/resource-threshold(已被 Condition+edge 覆盖) | 多半可标 done/wontfix，复核 | 低 |
| R9/R13 | PB | 资产 manifest review / 单例查询助手(部分=R3 已done) | — | 低 |

**R15 的深层洞察**：`Condition→Event→Effect` 是**反应式**逻辑(当 X→做 Y)；但 VN/RPG 叙事是**走一张声明式图**，需要**解释器 capability**(读数据图、推进游标、驱动 state/text/effect)。`effect-apply` 只能 set 固定值，跳不到"当前节点的 next"(数据依赖转移)，也做不到"按 state 查脚本表→写 Text"。**对话运行器是这类"图遍历解释器"的第一个**，做它=证明数据驱动原则能落地 + 让 Game B 变纯数据 + 喂饱垂直切片。**Lead 接手该做的事**：review PB 的实现 → 泛化 → 定**声明式对话脚本 schema(契约)** → 落 `src/skills/`(或叙事模块) → game-b 删自己的代码变数据。

---

## 6. 关键文件
- **宪法**：`docs/design/data-driven-manifesto.md`
- **基础设施清单**：`docs/design/phase1-game-infrastructure.md`
- **需求池**：`docs/workflow/requests.md`(R5–R15 + REQ-001~003)
- **角色**：`docs/workflow/game-creator-role.md`(PA/PB 读，已对齐原则)
- **review 归档**：`docs/review/2026-06-04-*.md` ｜ **Gemini 导出**：`review-for-gemini-*.txt`
- **资产设计(PB)**：`docs/design/asset-manifest-and-manager.md`
- **代码**：`src/skills/`、`src/assets/`、`src/services/{storage,audio}/`、`src/net/`、`src/renderer/`、`src/engine/core/`、`src/debug/`、`src/games/{game-a,game-b}/`
- **待写(下一任可起)**：`docs/design/studio-vision.md`(§3 的 Studio 闭环) ｜ canonical `Game Manifest` 纯数据 schema(把 .ts 蓝图变数据制品)

---

## 7. 工作规范
- 推 `claude/mainbranch`，**不开 PR**；每提交 `fetch → rebase → push`；**tsc + vitest + build 全绿才推**。
- 每完成一批/一轮 review，把新代码拼成 `review-for-gemini-*.txt` 发用户喂 Gemini，结论回灌 requests/docs。
- 提交署名 `noreply@anthropic.com` / `Claude`(避免 unverified)。
- 任何"该数据还是代码"用 §0 那把尺子裁决。**别再无脑加宽引擎**——优先：还数据驱动的债(R15) + 证一个真实游戏端到端跑起来。

---

## 8. 本程最后增量 + 第三个游戏（接手前必看，比上文更新）

**测试 385 passed / tsc 干净 / build 通过。** 本程末尾又落地（main `1db5151`）：
- **REQ-002 sensor**（PA）：新增 `Sensor` 标记；`collision-resolve` 跳过含 Sensor 的接触对 → **Game A 全部第一批合作机制(踩开关/限时门/重量台)解锁**。开关=加 `Sensor` 数据即可站进。
- **REQ-003 动态支撑**（PA）：`ground-sense` 改不动点传播，踩搭档/踩箱(已 Grounded 的动态支撑)也能起跳；链式确定性。
- **R14 助手（部分）**：`src/engine/core/query.ts` `findByComponentId/getComponentById` —— 游戏层不再手写"按 id 扫实体"(同解 R13 + PC REQ-C-002)。

**⚠️ 第三个游戏 Game C 存在，且在另一条分支！**
- **PC（Programmer C）做《缝纫物语》换装三消，在分支 `claude/jolly-allen-ifK1B`（commit `fce4715`），未并进 main。** 代码 `src/games/game-c/`(纯数据装配 blueprint/theme) + 设计文档 + 4 条需求 **REQ-C-001~004（在那条分支的 requests.md，main 上没有）**：
  - **REQ-C-001 (P0)**：三消棋盘机制下沉为通用 `match3-board` capability。**重要诊断**：`Condition→Event→Effect` 表达不了"带网格扫描/循环的算法"——印证引擎缺一个**"算法/解释器型机制 capability"大类**。
  - REQ-C-002：点击命中→发 Signal（**和 PB R13/R3 同源**，三家共需）。
  - REQ-C-003：经济/缝制"可负担才成交+原子扣多料"（**和 PB R14 批量改资源同源**）。
  - REQ-C-004：视频/AIGP 后端（Game C 的"输出点"，表现层旁路，类比 R1 之前无贴图）。

**三游戏三角验证 → 真实共需高度收敛（下一任据此排程）**：
1. **"下沉成机制 capability"是共同模式**：`dialogue`(PB R15)、`match3-board`(PC REQ-C-001)、`coop-goal`(PA REQ-006) —— 都是"游戏核心玩法其实是个通用 config 驱动机制"。**这就是数据驱动下复杂玩法的归宿。dialogue/match3 揭示了缺失的"解释器型 capability"大类。**
2. **点击命中→Signal**：三家共需(REQ-C-002 + R13 + R3 命中侧)。
3. **批量/原子/可负担改资源**：两家共需(PB R14 + PC REQ-C-003)→ 一个"经济/批量改值"capability。

**下一任建议动作（按性价比）**：
- (a) **R5 condition 多目标/计数版 → 解锁 REQ-006**（REQ-002 已铺好，短链，让 Game A coop-goal 变纯数据）；顺手复核 R5/R7 标 done/wontfix。
- (b) **R15 对话运行器下沉成通用 `dialogue` capability**（数据驱动旗舰，让 Game B 变纯数据；工作量最大）。
- (c) **把 PC 的 REQ-C-001~004 合进 main 的 requests.md**（否则只读 main 会漏掉第三个游戏）；并决定 game-c 分支何时并 main。
- (d) 共需三件(命中→Signal / 经济批量改值 / match3-board)按三角收敛做，一次复利三家。
- 始终守 §0 第一性原则 + 先"证一个真实游戏端到端在浏览器跑起来"。
