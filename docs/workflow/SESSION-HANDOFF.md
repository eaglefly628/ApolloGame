# Session 交接 / 项目现状（2026-06-10）
> 纲领：`docs/design/data-driven-manifesto.md`｜规范：`CLAUDE.md`｜需求池：`docs/workflow/requests.md`
> **分工边界（用户 2026-06-10 拍板）**：Lead/主程只动引擎+文档，游戏层 `src/games/**` 一律不动手——游戏侧任务写进 `docs/workflow/programmer/inbox.md` 派发给对应 PE（PE-E=Game E、PE-F=Game F），PE 完成写 outbox。
> **引擎只归主程（用户 2026-06-10 拍板）**：反向同样成立——PE/策划 session **不得直接改引擎**（`src/{engine,skills,assembly,renderer,services,net}`），缺口一律 requests.md 提主程裁决；任何提交 rebase 带进新内容后必须重跑全套再推。

---

## 0. 给主程的出差汇报（2026-06-11 晚，PE-F 代行；你回来从这读起）

> **授权背景**：用户今晚拍板「赋予 PE-F 主程职责（出差期间）、可改引擎、评审须换位不得自批自过」。本节=完整移交账：动了什么引擎、为什么、哪里换位砍过自己的方案。全部细节在 requests.md REQ-F-049~053 五个条目（每条含裁决理由与回驳记录），此处为索引。

**引擎改动五件（全部最窄形态、带验收测，1093 全绿）：**

| 件 | 文件 | 一句话 | 换位评审里砍掉的 |
|---|---|---|---|
| F-049 部署门+出身格 | components/caster/prefab/merge-rule | `Caster.requireHexPos` 门 + `SpawnRequest.originHex` POD + overrides 哨兵 `HexPos:'@origin-hex'`（prefab 解析、仅哨兵可补建缺件）+ merge 出身格继承 | 通用 requireComponent（动态读无法申报）；caster 端解析（许可泄漏）；overrides 通用 create-if-absent（半截组件投毒 snapshot） |
| F-050 定序补丁 | drag-place | runsBefore 补 'motion-apply'（Transform RMW 对，七件套）+ 守护测升级含 motion-apply | 无（探针 spread-clone 先验后落，未盲改） |
| F-051 占位收窄 | grid-move | occupied 只数单位（HexPos∧GridMover），posOf 保全量，目标格显式入 blocked | **自己的 v1 被既有测试打回**：一刀切毁了"静止目标"契约——拆成阻挡/查找两用途后重落 |
| F-052 席板分账 | group-count | `GroupCount.onBoard?: boolean`（true/false/缺省） | 通用 has/lacksComponent（同 F-049 申报纪律） |
| F-053 点拖互斥 | net/queued-input | pointerup 二选一：超阈值只发 drag（吞裸 up）、阈值内发 up；约定可拖可点实体用 Clickable{phase:'up'} | 单改 marker 监听 'up'（不够：拖拽收手 up 在落点照样误点）|

**连带的 game-f 终态（PE-F 帽子，纯数据）**：席位 marker 即上场槽（拖上板=出兵点/拖回=收兵/3 连原地升星/星级=模板族）；开局 4 将=播种在板 marker；部署窗移入战拍（备战摆 marker 本体、开战出兵——拖拽即时反馈）+ resolution 关窗（防跨窗指针翻转误发双倍敌阵，实测踩过）+ combat after:30 最短驻留；F-17 受限版 12 槽位×星级带契约整段删除。

**追批（同晚，用户五条钦定）**：⑥ REQ-F-054 card-pile 刷新改「旧手回袋底」（卡池守恒——修用户实测「越刷人越少」枯竭 bug，唯一使用方 game-f 零迁移）；⑦ REQ-F-055 `t2-tray` 托盘落座（备战席 9 槽平台：自动落座/拖拽互换/上板让座/弹回；手牌排/背包栏同形通用件；评审自纠互换同拍误判回摆一处）。游戏侧：棋盘 7×8=56 真规格（旧 12×12 错版）、商店三大框（用户钦定小丑牌式，偏离准则 5 槽已注记）、开战倒计时（零引擎件：钳停秒表重组）。

**给你复核的钩子**：① F-053 的壳层 up/drag 互斥改了命令流形态（本地采集期判定，lockstep 安全）——若你对输入域有别的收口构想，这条最值得复看；② F-051 的「静止可占位单位=挂 GridMover」约定是否要进 wiki/skills 文档；③ deploy 移入战拍偏离了 flow-spec §3.3 原文（一图流已同步改、策划 PF 尚未复核——他回来请他过目）；④ 位 1<<19..24 已回收可复用。

---

## 1. 架构一句话

```
Manifest(纯数据) ──parseManifest──▶ WorldBlueprint ──engine.load──▶ World ──tick──▶ 确定性状态
   ▲  capabilities:[id] + entities:{id:{Comp:data}}                                   │
   └─────────────────────── exportManifest（对称闭环）◀──────────────────────────────────┘
```

- **引擎** `src/engine/`：ECS World（snapshot/hash）；SystemPhase + runsAfter/runsBefore 拓扑排序
- **能力库** `src/skills/`：50+ 原子+扩展；Tier1（运动/动画/hierarchy-cascade）/ Tier2（物理/逻辑链/ARPG/tilemap/hex/self-rule/group-count/gauge/text-binding）/ Tier3（dialogue/match3/prefab/caster/aggro/poker-hand/card-scoring/flow/card-pile）；**Tier4 刻意为空**（AI行为=数据装配）。全列表见 `wiki/skills/` + 周期表
- **桥接** `src/assembly/`：capability-registry + manifest.ts（parseManifest/exportManifest）+ schema 校验 + validate-references（P0 引用链接器）
- **Studio** `src/studio/` + `src/bench/`：数据透视器（改字段/实时预览/键盘试玩）、**资源库**（统一资产库浏览器+导入器，三来源一视图；语义标签上图 + AI 选材 `art:<query>` 确定性解析 resolve-art-refs：`docs/design/asset-library.md`）、ApolloBench（Structure/Load/Determinism/Numeric/Visual）；壳层视觉基调 `src/ui/shell-theme.ts`（青瓷×墨蓝×淡金）
- **启动器** `apollo.py`：Vite+API+多 LLM 生成 manifest；离线预设 platformer/pong；`bench` 命令

## 2. 五个游戏（已并入 main，趋近纯数据）

| 游戏 | 一句话 |
|---|---|
| **A 协作平台** | 双人卷轴；移动平台/压力开关→门（zone-occupancy+event-when+effect-apply）；通关=数据 Zone |
| **B 乙游 VN** | dialogue 驱动；7 属性+体力约束+属性门控+掷骰（R15/R17）；多结局 |
| **C 缝纫物语 v0.3** | match3-board + clickable + craft-recipe + 换装→AIGP；v0.4 配饰接线中 |
| **D 暗黑 ARPG** | ai-chase=aggro+steering；技能=keybind→caster→prefab；hitbox/over-time/mortal；tilemap 地牢+anim-state+facing；WASD+1/2/3 可玩 |
| **E 小丑牌(Balatro 切片)** | poker-hand→card-scoring→effect-apply→valueFrom 计分链（REQ-011~014）；150 小丑/14 张起手；131 张 webp 美术入美术库；`game-e.tsx` 可玩 |

## 3. TODO 审计（2026-06-10）

**🟡 Open**（见 `docs/workflow/requests.md`）：

| 条目 | 内容 | 优先 |
|---|---|---|
| **R9** | TBF 资产"诊所"工具（四 provider） | P2 |
| REQ-C-005 | match3-board 能力扩展 | P1 |
| REQ-C-006 | match3-board 健壮性 | P2 |
| REQ-C-007 | 特效组件（表现层） | P2 |
| REQ-023 | group-effect（集合写）；倾向重组不 greenlit | P3 |
| caster 整合 | 可整合进 effect-apply(kind:'spawn')+去重 aggro | 排期 |
| PE-E 数据换层 | flow/card-pile 重写回合流程(REQ-017/020) + ScoreTrace 回放(REQ-019) | PE-E |
| PE-F 数据换层 | hierarchy-cascade 命名残留(F-026)；offset 棋盘(F-027)；GameFlow 阶段机(F-028)；self-rule/group-count 接羁绊；**gauge 血/蓝条(F-029，定序环 F-031 已修)**；**CC 定身 haltStatusMask(F-030)**；**回合重置 槽位Caster+overrides+destroy-tagged(F-032)**；**复合预制 @local: 引用重映射(F-033)**；**平滑滑行 glideSpeed(F-034)**；**self 全局阶段门 whenGlobal(F-035)**；**odd-r 拓扑同构棋盘(F-037，外审 Q5；offset 已删)**；**商店据码分发+可负担门(F-040)**；**信号刷新桥+@signal-source 寻址(F-041)**；**手牌镜像+信号出牌(F-042)**；**text-binding HUD 数字(F-043)**；**拾取两清 consumeOnHit(F-044)+羁绊乘区 scaleByResource(F-047)+袋归还(F-048②)**；**PrefabOrigin 出身戳+merge-rule 升星(F-046)+keepResource 保额清场(F-048①)**；**拖拽摆放 synthesizeDrag+drag-place(F-045)**——F 系列 26~48 全清 | PE-F |

**🔵 Studio/编辑器 follow-up**（非阻塞）：
① 结构编辑（透视器增删实体/组件）；② playwright 真截图（升级 ApolloBench Visual）；
③ **⭐ 结构化意图层**（NL→意图结构→manifest；收窄生成空间；用户已点最该先做，见 `docs/design/ai-data-editor.md`）；
④ Controllable 等无 schema 组件补声明（解锁速度/跳跃 NL 编辑）；
⑤ 资源库 v1 follow-up（`docs/design/asset-library.md` §7：音频/字体导入模式、usedBy 溯源并入详情、StudioInspector 换装 shell-theme、游戏 assets.ts 迁纯数据派 PE）

## 4. 主要技术债

- 🔴 无真浏览器帧验证；ApolloBench Visual = 数据代理，不等于人眼/VLM 审查
- 🟠 物理浮点跨端确定性未双端验（steering/sqrt 仍 open；卡牌/hex 整数安全）
- 🟠 World.query 每 tick 结果数组分配仍在（倒排索引已还第一债）
- 🟠 多 session 并行：push 前务必 fetch→rebase

## 5. 关键文件

- 宪法 `docs/design/data-driven-manifesto.md` ｜ 需求池 `docs/workflow/requests.md`
- ⭐ **知识库** `wiki/skills/`（24 模块）+ 周期表 `wiki/atom-skill-periodic-table.md`（开工新能力必读）
- 代码 `src/{engine,skills,assembly,studio,bench,services,net,renderer,games}` ｜ 启动器 `apollo.py`
- 设计 `docs/design/*` ｜ 游戏设计 `docs/game-design/*` ｜ 参考 `docs/ref/verified-fixes.md`
