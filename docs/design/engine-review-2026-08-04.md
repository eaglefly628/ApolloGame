# ZeroCraft 引擎全量专家评审报告 · 2026-08-04

> 评审员：Lead session（Fable 5·最高档）· owner 令「全量 review 引擎源码 + 能修直接修 + 回答两问」。
> 范围 = **引擎面**（`src/{engine,skills,assembly,renderer,services,net,ui,runtime,bench,debug}` + `scripts/` 守卫），**不含** `games/` 游戏层。
> 方法 = 15 个子系统评审员并行逐文件真读 + 2 个流程审计员（S1-S8 卡点红队 / 新游戏消费路径），发现「修即验证」——动手修时逐个读代码确认 + 门禁测试通过为最强验证。
> 覆盖 = engine 核/协议闭集/atoms+tier1/tier2(上下)/tier3/装配线/2D 渲染/3D 渲染/services/net 确定性核/UI 核/UI 周边/守卫脚本/runtime·bench·debug。
> 排除的已在案项（不重复上报）：REQ-CYCLEHAZ（RMW 成环 65 对）、REQ-3D-TOWER-STACK（物理硬编码）、REQ-3D-SETTLE-SIGNAL、ui-audit border-image 盲区、bounds-clamp 仅矩形、game-d 物理非确定性记债。

---

## 0. 一句话结论

引擎**整体健康、架构清醒**（数据驱动/确定性/闭集三条主纪律在代码里是真的被执行的），但评审逐文件挖出 **110+ 条发现**，其中 **1 条 P0、约 30 条 P1**。头号系统性风险不是单点 bug，而是**四条贯穿性根因**（见 §4）——它们都指向同一件事：**一批「靠自觉/靠巧合/靠手维护」的纪律没有机器兜底**。这与 owner 关心的两问同源：新游戏「能不能绕过」和 S1-S8「有没有漏洞」，答案都是「能绕/有漏，且根因是缺受信执行与机器对账」。

本轮已**直接修复并推送 13 处**（3 个提交·每批门禁全绿），全部集中在「证据铁实 × 修复安全 × 高价值」的交集；**其余刻意不盲修**——多数需 owner 裁决、依赖 CYCLEHAZ 前置、或盲修风险大于收益（理由逐条见 §3）。

---

## 1. 已修复并推送（13 处 · 3 提交）

### 批次 1 · 确定性护栏（commit `0031b950d`）
| # | 文件 | 修复 | 严重度 |
|---|---|---|---|
| 1 | `engine/core/world.ts` | `restore()` 补 `version++`——换掉整个世界内容却不推进 version，派生缓存（spatial-query 等以 version 为键）读档/回滚后命中陈旧索引 → 返回已销毁实体/旧位置 → lockstep 分叉。**engine-core 与 atoms 两路评审独立命中同一根因**，一行根治 | P1 |
| 2 | `net/determinism.ts` | `NON_DETERMINISTIC` 补 `Mesh3D`/`Coachmark`——组件契约明写「绝不进 hash」却漏登记，潜伏雷：按契约在渲染侧改它们 lockstep 立刻误报 desync | P1 |
| 3 | `net/determinism.ts` | `canonical()` 跳过 undefined 字段——`{f:undefined}` 与缺席 hash 不同 → 写 `field=undefined` 即跨端分裂 | P2 |
| 4 | `net/determinism.ts` | `stableValue` 字符串 `JSON.stringify` 转义——值内分隔符 `, = | ; {}` 可伪造结构 → 两个不同状态 hash 碰撞（desync 假绿·`Signal.arg` 直通用户输入可构造） | P1 |
| 5 | `bench/zerocraft-bench.ts` | ZeroCraftBench **一票否决**——Determinism/Numeric 任一挂 0 时 total 仍可 ≥70 过关 → 裸 `Math.random`（引擎最硬红线）的游戏照样「体检通过」。改为硬红线一票否决 | P1 |
| 6 | `skills/atoms/state/index.ts` | `StateChanged` 生产者自清（照 timer 先例）——事件永不清除，下游每 tick 重复触发 | P1 |

> 回归测试 +7：`net.test`（表现组件排除/防碰撞/undefined≡缺席）、`state.test`（自清）、`zerocraft-bench.test`（一票否决隔离：total≥阈值但 Numeric=0 仍不通过）。

### 批次 2 · 注入面加固（commit `3b8e2757c`）
| # | 文件 | 修复 | 严重度 |
|---|---|---|---|
| 7 | `cartridge-entry.ts` | `log()` `innerHTML`→`textContent`——引导壳把卡带 meta.title 经 innerHTML 内插，`<img onerror=...>` 即在壳内执行，**击穿「纯数据卡带不可执行」宪法边界** | P1 |
| 8 | `scripts/art-replace.mjs` | slug 硬校验——slug（源自 zerocraft 胶水/API）直拼读写路径零校验 → `../../x` **路径穿越**读任意 manifest、写任意 `.json`。补 `/^[a-z0-9][a-z0-9-]*$/`（与 cart-logic-check 同口径） | P1 |
| 9 | `ui/components/render.ts` | 六处 number props 消毒——Slider/Stepper/Avatar/Screen/Label/typewriter 多处标 number 却用 `??` 或裸插，`??` 只挡 null/undefined，恶意字符串照样内插（Stepper `${v}` 是裸 HTML 注入）。统一过 `num()`/`esc()` | P1 |

### 批次 3 · 崩溃（commit `29cf511ba`）
| # | 文件 | 修复 | 严重度 |
|---|---|---|---|
| 10 | `renderer/three/batches.ts` | voxel 批移除路径对六面材质数组误用单材质 `.dispose()` → TypeError，异常在 delete 前抛出、批永远残留 → 每脏帧连环崩。改用同文件已有的 `disposeMat`（回归 +1） | P1 |

---

## 2. owner 两问的答复

### Q1 ·「新游戏如何快速利用积木拼接、而不要自己发明绕过？」

**现状**：文档导航层已经很强（`llm-onboarding.md §0` 机读真相表、角色卡、playbooks 索引质量高、tier2/3 `index.ts` 注释=事实上的能力导读、UI catalog 自描述三合一）。**卡脖子在最后一公里**——两个断链：

1. **能力清单拿不到手**：`dump-capability-catalog.mjs` 只有一档「全量 86KB（约 3-4 万 token）」，弱 session 要么烧掉半个上下文、要么被迫翻源码。且裸 `node` 跑报错（须 `vite-node`）、未入 npm script。→ **改造**：加 `--names`（一行一能力·~2k token）/`--tier`/`--cap <name>`（单能力全文）分档，入 `npm run catalog`；capability-plan §2 改为「先 `--names` 圈选、再 `--cap` 细读」。UI 域 catalog 已是此形态，照抄。
2. **capgap 轻通道是断的**：CLAUDE.md 写 `.apollo/cap-gaps.jsonl`，实现在 `.zerocraft/cap-gaps.jsonl`（gitignored·仅创作台 agent 触发），**编译期游戏 session 无 CLI 入口可用**——「查不到→提缺口」的最短逃生门实际不通，只剩 requests.md 重通道（10 硬槽·心理成本高）→ **变相鼓励静默自造**。→ 统一路径 + 加 `scripts/capgap.mjs add`。

**「自己发明」的抓漏率（`game-skill-audit.mjs`）**：只 regex 三红旗（Math.random/innerHTML/createElement）+ 两黄旗（零能力/零测试）。**两大逃逸口全盲**：
- **E1 手写 React 屏**：抓不住（JSX 编译期才变 createElement）——game-e.tsx 1163 行反面教材靠零 DOM 关键字过关。
- **E3 非 Math.random 的非确定性**：`Date.now`/`performance.now`/`crypto` 全不抓（实测 12 个游戏文件命中）。
- **E6 且 audit 不在推送门**：只挂 S5 门——**今天仓库里 game102 的 audit 实况 FAIL（innerHTML×2/createElement×4）却能照常推**。

→ **改造**（详见消费路径审计）：audit 进推送门（scoped-gate 碰 `games/**` 时跑）+ 补 `.tsx`/`from 'react'`（React 屏）、`Date.now|performance.now`（非确定性·先建议档）、`insertAdjacentHTML|document.write`（DOM 逃生）三条便宜 regex；顺手清 game102 实况红旗。另出一页 `playbooks/pick-list.md`「按玩法选件决策树」（卡牌→card-pile/card-play、三消→match3-board、波次→spawn-director、剧情→dialogue 三件套……素材已在 tier2/3 index 注释里）。

### Q2 ·「S1-S8 八个卡点卡新游戏生产，真的可以做吗？有没有漏洞？怎么实现？」

**能做，且骨架已对**——「工件推导状态 + 证据指纹过期 + 三门制（机器/复查/人）+ 顺序闸」是同类 LLM 生产线里罕见清醒的设计，S3/S4/S5/S8 四个机器门是真牙齿。**但有 14 个漏洞**，最重的三个共同根因是**「所有门都在施工 session 自己的进程里跑、写自己可改的明文台账」——缺受信执行环境这最后一块**。推送面现状**零机器拦截**（`.git/hooks` 空、`.github/workflows` 仅 mac build）。

| # | 漏洞 | 严重度 | 一句话利用 | 是否已有在案项 |
|---|---|---|---|---|
| 1 | 不跑门禁直接 push | 严重 | mainbranch 直推无 hook/CI 拦截 | PIPESOFT P2（仅本地 hook·`--no-verify` 可绕） |
| 2 | **门证/评分/签核全可手工伪造** | 严重 | `pipeline.json` 是明文 JSON、`gameHash()` 是导出纯函数——手写一个文件即「全绿板」 | **无**（最大缺口） |
| 3 | 代签人门零成本 | 严重 | `--by` 默认 owner，任何 session 敲一行完成 S7/S8 人门 | P1b 壳有真人按钮·CLI 通道未封 |
| 8 | **改裁判脚本** | 严重 | 游戏 session 技术上可改 `scripts/*.mjs` 阈值/让 scoped-gate 漏掉自己 | 无（缺 CODEOWNERS） |
| 4 | 复查自查自签 | 高 | 施工 session 换名给自己 PASS | SPECTRACE V2 部分 |
| 9 | 测试造假 | 高 | S4 walkthrough 写恒真断言 | SPECTRACE 部分 |
| 10 | 冒烟/守卫不在门禁静默腐化 | 高 | **已真实发生一次**（冒烟⑥段红了半月） | SPECTRACE V2 + 每日巡检 |
| 5-7,11-14 | out-of-order 滥用 / exit3 豁免 / 5 张任意图 / human 型无阈值 / waiver 自授 / env 注入 flag / gameHash 排除面藏改动 | 中 | 见流程审计全文 | 部分（RENDERCHECK R2/R3 覆盖画面真相面） |

**怎么实现（推荐架构）**：闭环 = **编排器**（独立重跑门·以自己量的退出码落证据·堵「会话自称不算数」）+ **spec-trace**（每条细则必有验收物·文档一改旧绿自动作废）+ **渲染探针 R1→R2→R3**（画面真相逐步取代人肉截图）+ **守卫链**（scoped-gate/audit/manifest-check）。**缺的最后一块 = 受信执行环境**：今天每道门都在潜在攻击者自己进程里跑、写自己可改的台账，体系下限 = session 自觉；伪造门证/代签/改裁判三件事成本都是一行命令。**终局** = 服务端 CI 用**目标分支的**守卫独立复跑 scoped-gate + 关键门、产出带签名证据（或至少标本机证据 unverified）+ `scripts/`+`src/engine` 路径保护（CODEOWNERS）。**在此之前的低成本止血** = 把编排器的「独立重验」扩为每日巡检的「全板复验」（对所有游戏重跑门、比对台账 evidence 与实测退出码、不符即开单），用现有零件即可补。

---

## 3. 未修的重大发现 + 处置理由（刻意不盲修）

这些**都是真发现**，但本轮**不动手**——理由分三类：①依赖 CYCLEHAZ 前置（补 reads/writes 会新增定序边，在成环止血落地前可能把「相位巧合兜底的静默问题」变成「装载硬抛环错」，反而更糟）；②盲修风险 > 收益（改动会引入可见回归，而当前 bug 只是浪费/边角）；③需 owner 裁决行为变更。

### 3.1 reads/writes 申报补齐组（**CYCLEHAZ B 止血已 done·本组现已解锁**）

> 更新（评审后核对）：REQ-CYCLEHAZ **B 止血已落地并 Lead 终审 PASS**（`topologicalSort` 纯推断 2-环降级为确定性顺序+留痕·仅显式边自成环才抛）。故补 reads/writes（新增的是**推断边**非显式边）现在安全——新推断环会优雅降级不抛。本组**可安排施工**，仍建议逐处补齐后各跑门禁确认不引入显式边自环。
| 位置 | 漏报 | 后果 |
|---|---|---|
| `tier3/caster.ts:86` | 系统 reads 漏 `Relation` | aggro→caster 无定序边·读到上拍锁定目标 |
| `tier3/flow.ts:95` · `dialogue.ts:206` | reads 漏 `Timer`/`StringVar` | timer 门控条件读到拍内任意位置的值 |
| `tier2/collision-resolve.ts:54` | 系统 reads 漏 `Sensor` | 与 set-sensor 写者靠相位巧合 |
| `tier2/anim-state.ts:67` | reads 漏 `Relation` · `clickable` 漏 `Flag` | 同类 |
| `atoms/resource/index.ts` | reads 漏 `PrefabOrigin` | spawner 侧写者与 resource-apply 无边 |
| `atoms/tier1/tween.ts` | **writes 漏 `Tween`**（RMW 改写+删除自身）+ schema 漏 `keep` | 读 Tween 者与 tween 零边·且加 writes 是自环需 runsBefore/After 破 |
| `atoms/navmesh-bake` | reads 漏 `NavAgent`·capability/system 两级脱节 | 同 |
| `tier2/stat-bind.ts:149` | **`binding.component` 自由字符串无白名单** | 数据里写 `Transform`/`Flag` 即成「未申报写」→ **游戏数据从游戏层击穿引擎定序契约**（这条最值得警惕，是「能绕过」的活样本·建议加运行期闭集校验，可独立于 CYCLEHAZ 先做） |

### 3.2 盲修风险 > 收益（附精确修法·待专项）
| 位置 | 发现 | 为何不盲修 |
|---|---|---|
| `renderer/three/geometry.ts:298` `disposeMeshMat` | 只释放 normalMap/roughnessMap，漏 map/emissiveMap → 骰子面/体素贴图泄漏 | map/emissiveMap 可能来自**共享缓存**（pbrMapTexture/texCache），盲加 `.dispose()` 会释放其他活网格在用的贴图→画面损坏（比泄漏更糟）。需引用计数区分 per-mesh vs 共享 |
| `renderer/three/models.ts:87` | 带 clip 的静态模型令 `animLive>0` → 脏标跳渲永久失效+每帧刷阴影 | 改 `update()` 返回「有 action 在播的数」需 `isRunning()` 语义精确，判断错则动画冻结（可见回归）·models.test 无覆盖。当前 bug 只是浪费 GPU |
| `renderer/three/physics.ts:69` | `sync` 返回含 SLEEPING 刚体数 → 骰子入睡后脏标仍每帧成立 | 同上·可与 SETTLE-SIGNAL 合并做（返回 `sleepState !== SLEEPING` 的数） |
| `renderer/three/post.ts:178` | `PostPipeline.dispose` 漏逐 pass dispose（GTAO/Bloom/SMAA 各自 RT 滞留） | render-only 泄漏·非阻塞·随渲染专项批量做 |

### 3.3 需 owner/角色裁决行为变更（正确性向·建议尽快做）
| 位置 | 发现 | 严重度 |
|---|---|---|
| `net/lockstep-tab.ts:188` | **P0**：新对端加入 epoch 收敛竞态·输入只发一次无重发 → 双方永久卡死（**评审已实测复现**）。修法=入 epoch 前缓存未知 epoch 的 input，或 resetEpoch 后请求重发 | **P0** |
| `engine/core/world.ts:195` | `restore()` 依赖对象键序=创建序，但 JS 对**数字样 id** 强制数值升序枚举 → 数字型实体 id 存档读档后 query 序变，恢复瞬间 hash 校验通过、之后逐步 desync（极难定位）。修法=快照显式带序或 createEntity 拒纯数字 id | P1 |
| `services/storage/save-system.ts:25` | 存档 `hash` 算了从不校验 → 篡改/损坏快照静默灌进 world（fail-open，与端口自述「防篡改」矛盾） | P1 |
| `services/save/envelope.ts:19` | checksum 在 JSON 序列化**前**算 → `undefined`/`NaN` 字段经端口往返后重算不符 → **合法存档误判损坏丢档**（官方测试自己就示范触发姿势） | P1 |
| `assembly/capability-registry.ts` | **`BoardCell` 双 provider 真冲突已实测**（match3-board / block-grid），两处仲裁规则相反（先登记胜 vs 后登记胜）→ block-grid 游戏被静默推成 match3-board 解释器 | P1 |
| `assembly/manifest.ts:59` | 实体 id/组件名为 `__proto__` → 改写原型而非登记，条目**静默蒸发**（非 fail-closed） | P2 |
| `studio/DataCartridgeRunner.tsx:458` | TS 卡带装载门 `allowTs` 旗在装载点不查·`features.tsCarts` 全库零命中（CLAUDE.md 所述双闸不存在于代码）·先执行模块顶层再查契约 | P2 |
| `skills/tier2/friction.ts` · `ground-sense.ts` | 都不过滤 Sensor → 贴伤害区被削速·跳过金币判着地可二段跳（有 collision-resolve 正确口径作对照） | P1 |
| `skills/tier2/card-pile.ts:142` | 空出牌（`[]`/全越界）当成交：扣费+触发计分链却一张未出 | P1 |
| `skills/tier2/effect-apply.ts:161` | valueFrom「缺资源按 0」契约只对 `add` 成立·`mul` 清零/`set` 设 0·`value` 缺失 NaN 污染 hash | P1 |
| `skills/tier2/merge-on-place.ts:89` | 事件实体用每 tick 归零的计数器命名 → 无消费者时次 tick 二次合并 `createEntity` 重名硬崩 | P1 |
| `skills/tier2/matrix-duel.ts:448` | ≥3 DuelIntent 静默永久死锁（自己给表外手硬抛、漏了这条同类） | P2 |
| `debug/replayer.ts:32` | 按引用注入输入 → 系统原位改写**污染 recording 本体**，二次 replay 起点已变、报虚假 divergence | P1 |
| `ui/components/server.ts:503` | modalClose/comboClick 缺 ActionSink 回退 → 纯信号游戏点遮罩关不掉 Modal | P1 |
| `ui/components/server.ts:124` | 键控补丁锚点取 firstElementChild，把子节点搬到 Panel chrome（vignette/title）之前 → 结构变更后标题/暗角错位 | P1 |
| `ui/components/server.ts:293` | update() 打补丁引入的 tween/typewriter/flyto/bgscroll 永不初始化（扫描只在 mount 时一次） | P1 |
| `renderer/renderable.ts:64` | `Sprite.anchorX/anchorY` 能力卡承诺渲染层消费，投影链根本不投 → 非 0.5 锚点静默失效 | P1 |
| `renderer/canvas-renderer.ts:166` | drawTilemap 丢弃 `assets.resolve` 的 sx/sy/sw/sh → atlas 类图集层永远静默不画 | P2 |
| `renderer/frame-svg.ts:40` | golden 后端忽略 rotation/scale/alpha/换行 → golden 回归对整类视觉 bug 全盲（假安全感） | P2 |

---

## 4. 四条贯穿性根因（比单点 bug 更重要）

评审最有价值的产出不是 110 条散点，而是**四条被多个子系统独立点到的系统性根因**——修根因比逐点补更省：

1. **reads/writes 申报与实际访问漂移**（5 个子系统命中：atoms/tier2/tier3/net/protocol）。声明式定序契约被实现悄悄破坏，靠相位巧合兜底；`stat-bind` 更让**游戏数据**就能击穿它。**根治** = 加一个「系统实际 `getComponent`/`setComponent` 的组件 vs 申报 reads/writes」的静态或运行期对账守卫（本身是引擎基建）。**注意**：补申报要等 CYCLEHAZ B 止血，否则触发环抛错。

2. **`NON_DETERMINISTIC` 名单靠手维护、无机器对账**（protocol/net/atoms 三票）。拼错一个名字即静默失效（多算→误报 desync，少算→假绿）。本轮已修漏登记的 Mesh3D/Coachmark 并加行为回归，但**系统性「名单 ⊆ 组件全集」对账测试写不了**——因为**运行时没有组件全集基准**（只有编译期 `ComponentDataMap` 接口·`COMPONENT_PROVIDERS` 只含 capability 提供的、缺全部核心/渲染组件）。**根治** = 生成一份运行时组件全集清单（`scripts/build-component-map.mjs` 已生成编译期版·扩成运行时可枚举），供本对账 + 装配校验 + catalog 共用。这正是流程审计说的「守卫缺可信来源」同类缺口。

3. **`restore()`/version 与快照键序**（engine-core/atoms/net 交叉）。存档·回滚·回放三条路径共用的 `restore()`，既漏 `version++`（已修）、又依赖对象键序=创建序（数字 id 会破）。**根治** = 快照显式带实体顺序数组 + createEntity 拒纯数字 id。

4. **守卫/门禁「在被审者自己进程里跑、写自己可改的台账」**（守卫脚本审计 + S1-S8 审计交叉）。伪造门证/代签/改裁判成本都是一行命令；推送面零机器拦截。**根治** = 受信执行环境（服务端 CI 独立复跑 + 签名证据 + CODEOWNERS 路径保护）；低成本止血 = 编排器「独立重验」扩为每日「全板复验」。

---

## 5. 全量发现索引（按子系统 · 详情见各评审原文）

> 严重度：P0 崩溃/数据损坏/安全击穿 > P1 功能错/确定性破坏 > P2 边界/契约漂移 > P3 轻微。已修见 §1，未修重大见 §3。此处为完整计数与未列入 §1/§3 的其余项速查。

- **engine-core**（5）：restore 键序 P1 / sat3d 楔体幻影碰撞 P2 / restore 不回灌 version 契约 P2 / 盒内点最近点退化 +Y P3 / aabb-tree 重复 id 违反 pair 唯一 P3。
- **protocol 闭集**（6）：Mesh3D·Coachmark 漏登记 P1×2（**已修**）/ Camera.rotation 死字段 P2 / 名单无对账测试 P2 / canonical undefined P3（**已修**）/ components.ts barrel 过期 P3。
- **atoms+tier1**（8）：StateChanged 永不清 P1（**已修**）/ hierarchy-cascade 异向 DR 孤儿 P2 / destroy 同拍链式丢请求 P2 / animation 不过滤 timerId P2 / resource·tween·navmesh reads/writes 漏报 P2×3（→§3.1）/ spatial-query 缓存 version P2（**已修根因**）。
- **tier2 上半**（8）：friction·ground-sense 不过滤 Sensor P1×2 / card-pile 空出牌 P1 / effect-apply valueFrom P1 / 三处 reads 漂移 P2 / card-pile 弃牌不守恒 P2 / playedCodeResource 不复位 P2 / craft 重复 id 破原子性 P3。
- **tier2 下半**（8）：stat-bind 可写任意组件 P1 / merge-on-place 命名撞车崩 P1 / matrix-duel ≥3 intent 死锁 P2 / pathfind 启发式不可采纳 P2 / over-time 提前解 CC P2 / weighted-pick 负权 P2 / spawn-director 信用跨界 P3 / path-follow 环缝 P3。
- **tier3**（7）：caster reads 漏 Relation P1 / prefab 嵌套 SpawnRequest 静默吞 P2 / timeline 链式信号失效 P2 / merge-rule 死棋可合成 P2 / caster 悬挂目标哑火 P2 / flow·dialogue reads 漏 Timer P2 / slot-payout·merge-rule 零测试 P2。
- **assembly**（8）：cartridge innerHTML 注入 P1（**已修**）/ BoardCell 双 provider P2（实测）/ TS 卡带 allowTs 门虚设 P2 / __proto__ 实体蒸发 P2 / 跨 phase 显式边静默失效 P2 / R12 缺字段零告警 P2 / mount 失败白屏 P2 / assetKey 双重漏气 P3。
- **2D 渲染**（8）：Sprite.anchor 不投影 P1 / Text.anchor 状态渗漏 P2 / frame-svg golden 盲 P2 / renderable 每帧 GC P2 / tilemap 丢源矩形 P2 / zOrder 单源 P2 / coachmark 镂空 P3 / dpr 一次性 P3。
- **3D 渲染**（8）：voxel dispose 崩 P1（**已修**）/ 静态 clip 脏标失效 P1 / map·emissiveMap 泄漏 P1 / renderSig 漏 ao·grade·quat P2 / HDRI 坏图每帧重 parse P2 / num-guard 漏 tiltShift·bloom P2 / PostPipeline 漏逐 pass dispose P2 / physics 含睡眠体脏标 P2。
- **services**（8）：save 不验 hash P1 / envelope 误判丢档 P1 / steam-cloud 非数组索引崩 P2 / manifest 静默白屏 P2 / web-audio 不钳幅崩 P2 / 坏档折 null fail-open P2 / steammock query 持久开关 P3 / voice-chain 断降级链 P3。
- **net 确定性核**（7）：**lockstep-tab 加入死锁 P0（实测）** / canonical 分隔符碰撞 P1（**已修**）/ 两份表现名单不一致 P2 / desync 诊断无 peer 维度 P2 / 输入历史引用别名 P2 / inputs·peerHashAt 无界增长 P3 / view() 每帧全量 hash P3。
- **UI 核**（8）：modalClose·comboClick 缺 sink P1 / 键控锚点错位 P1 / number props 未消毒 P1（**已修**）/ tween update 不启动 P1 / bindings 不递归 node 型 props P2 / layout-solver 忽略 cols P2 / 未知 type 注释逃逸 P2 / Versus 渲 undefined P3。
- **UI 周边**（7）：typewriter+emoji 掉字 P2 / apollo-kit 像素字体静默退化 P2 / onboarding 缩放宿主错位 P2 / GameShell 双 tabs 联动 P3 / layout cols 漂移 P3 / catalog 漏在售字段 P3 / aishe 横竖屏提示词矛盾 P3。
- **守卫脚本**（7）：art-replace slug 穿越 P1（**已修**）/ board 全可伪造 P2 / decouple-check `@games/*` 别名绕过 P2 / docs-ref glob 兜底放水 P3 / context-budget 槽计数可绕 P3 / spec-trace 正则刮取脆 P3 / S3-S5 证据不绑引擎 HEAD P3。
- **runtime·bench·debug**（8）：bench 一票否决 P1（**已修**）/ replayer 引用污染录像 P1 / rAF 异常无声冻死 P2 / bench 蓝图单例别名 P2 / Determinism 轴三重盲区 P2 / probe catch 吞异常误报 P3 / recorder tick 编号错位 P3 / Tracer 单槽观测者 P3。

---

## 6. 建议后续工单（不占本报告·供 owner 分诊）

按「修根因 > 修点」排序，建议开：

1. **P0 · lockstep-tab 加入死锁** —— 立即修（已实测复现·有明确修法）。net 域·Lead 或 P-net。
2. **P1 组 · 存档/装配正确性**（save hash 校验 + envelope round-trip + BoardCell 双 provider 仲裁 + __proto__ fail-closed）—— 一批·services/assembly 域。
3. **根因① · reads/writes 申报对账守卫** + **§3.1 申报补齐组** —— CYCLEHAZ B 止血已 done·**本组已解锁**，两者同批做（补齐后各跑门禁确认不引入显式边自环）。
4. **根因② · 运行时组件全集基准** —— 扩 `build-component-map.mjs` 出运行时可枚举清单，解锁 NON_DETERMINISTIC 对账测试 + 装配校验 + catalog 共用。
5. **根因④ · 受信执行环境**（回应 Q2）—— 服务端 CI 独立复跑 + 签名证据 + CODEOWNERS；低成本止血=编排器「全板复验」每日巡检。已部分被 PIPESOFT P2 / RENDERCHECK R2·R3 / SPECTRACE V2 覆盖，缺的是「受信执行」这一块。
6. **Q1 消费路径 · dump-catalog 分档 + capgap 断链修复 + audit 进推送门补逃逸抓捕 + pick-list 决策树** —— PST/Lead 域·多为低成本小活·顺手清 game102 audit 实况红旗。
7. **sim 逻辑正确性批**（friction/ground-sense Sensor 过滤 + card-pile 空出牌 + effect-apply NaN + merge-on-place 命名 + matrix-duel 死锁）—— 各配测试·可独立于 CYCLEHAZ。
8. **渲染专项**（geometry 贴图泄漏引用计数 + models/physics 脏标 + PostPipeline dispose + renderSig 漏项）—— render-only·P3D 域。
9. **UI 契约批**（modalClose/comboClick sink + 键控锚点 + tween update 初始化 + Sprite.anchor）—— PUI 域。

> 每条修复务必配回归测试（本轮已示范：net +5 / state +1 / bench +1 / batches +1）。sim 侧改动跑全量门禁；render-only 可缩范围。
