# game-103《幸存者核心原型》· PE 开工交接（GD→PE handoff v1）

> 2026-07-23 · GD-103 出（设计侧施工序建议·非 code）。**PE 施工权威=各线手册 + 流程板**；本文只把设计映射到「哪步做什么·用哪本手册·哪个能力·门怎么过」。
> 开工第一命令：`node scripts/game-pipeline.mjs board game-103`（看板→只做第一个非绿阶段·做完过三门再往前）。

## 0. ⚠ 门禁前提（开工前必看）

1. **✅ S2 已清（Lead 2026-07-23·`REQ-SURVIVOR编排` done）**：E1 `draft-offer` + E3 `spawn-director` **已下沉建好**（引擎侧·直接消费）；E2 进化替换 + E4 质变 flag **走现有能力重组**。**game-103 全量 M1–M3 可开工·无编排阻塞**。（旧 §6 阻塞项作废。）
2. **形态=编译期 TS 游戏**（owner 拍板）→ 走「编译期游戏线」（art-pipeline.md·game-q 样板）；slot=`game-103` → `games/game-103/`、`public/games/game-103/art/`。
3. **内容已按 Solo Survivor IO 照单全收扩展**（owner 2026-07-23）：8 武器（含宠物/弹射/诱饵）+ 远程敌 E7 + 地形/交互物 + 击杀数通关双轨 + Boss charge/basic + 装备 meta——见 `gdd.md` + `reference-solo-survivor-io.md`。**M1–M2 仍先做核心 5 武器 + 近战群 + 空场**（保雪球验证）；融合扩展排 M3–M4（能力薄缺口走 capgap）。

## 1. 开工必读（按序·每本 ≤80 行）

`playbooks/index.md`（总纲）→ 本任务涉及线：`randomness.md`（**最先·裸 Math.random=红线**）→ `movement-pathfinding.md` → `combat.md` → `rendering-fx.md` → `ui.md`（+ `docs/design/ui-playbook.md` 四准则）→ `art-pipeline.md` → `testing.md` → `review-gates.md`。设计真相=本目录 `gdd.md`/`balance-design.md`/`ui-scene-design.md`/`capability-plan.md`。

## 2. 数据表（纯数据·JSON·落 `games/game-103/data/`）

结构与默认值=`gdd.md` + `balance-design.md`（数字为 sim 初始输入）。清单：
`weapons.json`·`weapons_evo.json`·`passives.json`·`enemies.json`·`waves.json`·`drops.json`·`levelup_pool.json`·`meta_upgrades.json`。
> 弱模型也能产的纯数据（宪法尺子过）。**禁「数据表+游戏层自写解释器」**——解释器一律用现有能力（§4）或等 §6 下沉件。

## 3. 实体蓝图 → 能力接线（现有能力·可现在做）

对照 `capability-registry` 的 describe/examples 实名接（手册不抄字段）：

| 实体 | 组件/能力（实名） | 手册 |
|---|---|---|
| 玩家 | `Velocity`(`t1-motion-apply`) + `input-capture`/`controllable`/`action-map` + `Resource(hp)` + `Mortal` + `Stats` + `Sprite`(皮肤槽·与 Shape 并存) + `camera` 跟随 + `Bounds`(`t2-bounds-clamp`) | movement / combat / rendering-fx |
| 敌人 E1–E6 | `Perception`(`t3-aggro`)→`Steering`(`t2-steering`)→`Velocity` + `Tag(阵营)` + `Resource(hp)` + `Mortal` + `Hitbox`(接触伤害·`overlap-detect`) + `Sprite` | movement / combat |
| 武器投射物 | `Caster`(`t3-caster`)按 cd 释放 → `PrefabTemplate`(`t3-prefab`) → `Launch`(`t2-launch`)+`Velocity`+`Hitbox`+`Timer`(寿命) + `Sprite` | combat / movement |
| 护盾环/AoE | `t3-prefab` 环绕/自身 `Hitbox` + `Sprite` | combat |
| 被动加成 | `ModifierSource`→`ModifierTotals`(`t2-modifier-stack`)·消费方读 totals | combat |
| 灼烧/回血 | `OverTime`(`t2-over-time`) | combat |
| 刷怪/掉落 | `spawn` 原子 + `spatial-query`(索敌/拾取半径) | movement/combat |
| 随机(抽取/散射/掉率) | `RandomSeed`+`nextRandom`/`t2-dice-roll`(**种子化·禁裸 Math.random**) | randomness |
| HUD/菜单/三选一/结算 | `LayoutNode` 闭集控件 + mountUI 信号(`action`) | ui（+ui-playbook）·设计稿 `.dc.html` 1:1 |

## 4. 分阶段开工顺序（流程板 S3–S8 · 对齐里程碑 M1–M5）

> 每阶段：任务 → 手册 → 机器门 → 人门。**只做第一个非绿阶段·三门过再走。**

### S3 骨架关（= M1 灰盒地基）· ✅ 现在可做
- manifest/蓝图立起来（玩家+1 敌型+1 武器）、视觉实体挂 `Sprite` 槽（回退 Shape）、写推导脚本 `scripts/game-103-art-derive.mjs`（台账·零孤儿）、mount 注册 AssetManager（game-q 样板）。
- **机器门**：`gate game-103 S3` = parseManifest 零 error + 真引擎 load + 空跑 2 tick。**人门**：挂载目击签。

### S4 玩法关（= M1→M3 核心循环）· 部分可做·部分等 §6
- **现在可做**：走位 + 武器自动索敌开火 + 敌群 spawn + 接触伤害/死亡 + 经验拾取 + 等级计数 + 边界 + 相机跟随 + 胜负判定（HP=0 败 / 15:00 Boss 死胜）。
- **等 Lead 签 S2**：三选一 draft（E1）、进化替换（E2）、波次 rate/cap 调度（E3）——见 §6。M1 临时可用「升级=自动 +固定强化」占位跑通闭环，draft UI 待 E1。
- **机器门**：walkthrough vitest 绿 **+ GD 验收剧本 ≥3 场景 conformance 绿**（§7·剧本作者=GD）。**人门**：真浏览器试玩截图序列签。
- **两层 1:1 律**：有 `.dc.html` 稿的屏（HUD/三选一/主菜单/结算）S4 即须**结构 1:1**（布局/信息层级/状态可见性照稿·素皮）；视觉 1:1 留 S5。

### S5 UI 关
- HUD/菜单/三选一/结算严守 `LayoutNode` 纪律（照 4 张设计稿）；play-field 走 render 组件。
- **机器门**：`game-skill-audit game-103` 红旗零。**人门**：`/check-ui`（防重叠/对比/透明/布局卫生 + validateLayoutNode 零 issue + ui-audit 归零·深/亮主题各一遍）结论签。

### S6 美术关
- 照 `art-plan.md` 三段：占位几何 → FreeArtLib CC0 选配（PA·asset-manager agent）→ 风格包 AI 生成（需真 key）。台账推导·MOCK 不算完成·逐行人审 ☑。

### S7 品质关
- 视觉八维评分卡（`visual-scorecard.md`）：任一维 0=红·全维≥2=premium。受击/命中反馈+屏震+特效在此打磨。

### S8 终检关
- **编译期游戏**=tsc+vitest+build 三绿（gate·证据绑 git HEAD+净树）。手册缺口回填。

## 5. 目录约定（PE 建）
```
games/game-103/         骨架 + 蓝图 + data/*.json + *.test.ts
public/games/game-103/art/  index.json（skinKey 别名·资产就绪自动换装）
scripts/game-103-art-derive.mjs   台账推导（game-q 样板）
scripts/game-103-balance-sim.mjs  数值 sim（GD 分析工具·balance-design §9）
```

## 6. ✅ 编排能力（已解除·Lead 2026-07-23 裁决）
- E1 三选一 draft → **消费引擎 `draft-offer`**（已下沉·别在游戏层自写过滤/抽取循环）。
- E3 波次 rate/cap 动态调度 → **消费引擎 `spawn-director`**（已下沉·击杀数模式的动态调频也用它）。
- E2 进化替换 / E4 质变 flag（homing/fan/pull）→ **走现有能力重组**（event-when 条件门 + merge-rule/prefab 替换；steering/aggro/launch）。
- 融合 M3–M4 薄缺口（弹射 bounce·诱饵 aggro 重定向·boss telegraph）→ 届时走 capgap 快速通道，别自造。

## 7. GD 待办（不阻塞 PE 起步·并行补）
- **S4 验收剧本 ≥3 场景**（`docs/design/game-103/acceptance/`·纯数据 seed+操作+逐步期望·剧本作者=GD·PE 修码不改剧本）——GD 下一交付。
- 美术**风格锚提案**（喂 art-pipeline 生成·供 owner 定调）。
- balance-sim 跑首轮 → 回填 `balance-design §10` 平衡快照。

## 8. 红线速查（交付前自检）
种子 PRNG（禁裸 Math.random）· UI 走 LayoutNode（禁手写 React/innerHTML/createElement）· 主体实体带 Sprite 槽 · 数据表必有现有能力消费（禁虚胖）· `game-skill-audit game-103` 红旗零 · **宣布「完成」必附 `board game-103` 全绿**（不全绿只许说「做到 SN」）。

---

*配套：`gdd.md`·`balance-design.md`·`ui-scene-design.md`+4 张 `.dc.html`·`capability-plan.md`·`art-plan.md`。*
