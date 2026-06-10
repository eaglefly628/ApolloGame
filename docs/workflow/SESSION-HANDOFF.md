# Session 交接 / 项目现状（2026-06-10）
> 纲领：`docs/design/data-driven-manifesto.md`｜规范：`CLAUDE.md`｜需求池：`docs/workflow/requests.md`
> **分工边界（用户 2026-06-10 拍板）**：Lead/主程只动引擎+文档，游戏层 `src/games/**` 一律不动手——游戏侧任务写进 `docs/workflow/programmer/inbox.md` 派发给对应 PE（PE-E=Game E、PE-F=Game F），PE 完成写 outbox。
> **引擎只归主程（用户 2026-06-10 拍板）**：反向同样成立——PE/策划 session **不得直接改引擎**（`src/{engine,skills,assembly,renderer,services,net}`），缺口一律 requests.md 提主程裁决；任何提交 rebase 带进新内容后必须重跑全套再推。

---

## 1. 架构一句话

```
Manifest(纯数据) ──parseManifest──▶ WorldBlueprint ──engine.load──▶ World ──tick──▶ 确定性状态
   ▲  capabilities:[id] + entities:{id:{Comp:data}}                                   │
   └─────────────────────── exportManifest（对称闭环）◀──────────────────────────────────┘
```

- **引擎** `src/engine/`：ECS World（snapshot/hash）；SystemPhase + runsAfter/runsBefore 拓扑排序
- **能力库** `src/skills/`：50+ 原子+扩展；Tier1（运动/动画/hierarchy-cascade）/ Tier2（物理/逻辑链/ARPG/tilemap/hex/self-rule/group-count/gauge）/ Tier3（dialogue/match3/prefab/caster/aggro/poker-hand/card-scoring/flow/card-pile）；**Tier4 刻意为空**（AI行为=数据装配）。全列表见 `wiki/skills/` + 周期表
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
| PE-F 数据换层 | hierarchy-cascade 命名残留(F-026)；offset 棋盘(F-027)；GameFlow 阶段机(F-028)；self-rule/group-count 接羁绊；**gauge 血/蓝条(F-029，定序环 F-031 已修)**；**CC 定身 haltStatusMask(F-030)**；**回合重置 槽位Caster+overrides+destroy-tagged(F-032)**；**复合预制 @local: 引用重映射(F-033)**；**平滑滑行 glideSpeed(F-034)**；**self 全局阶段门 whenGlobal(F-035)**；**odd-r 拓扑同构棋盘(F-036，外审 Q5)+迁移 F-10** | PE-F |

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
