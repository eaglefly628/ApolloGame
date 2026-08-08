# 能力总览 Capability Plan — game-G 战斗重做《实时物理自动战斗》（送审稿）

> 2026-08-07 · owner 拍板：**回合制战斗整块删除 → 实时 · 物理驱动 · 自动战斗 · RTS 观感**，要求「充分利用物理能力 + 批次渲染能力」。
> **plan 未过审不写游戏层 system 代码**（CLAUDE.md 能力总览铁律）。能力名已对照 `src/assembly/capability-registry.ts` 实名核准。
> 模板 `docs/design/capability-plan-template.md`；先例 = `docs/design/game-103/capability-plan.md`（实时·百敌·零游戏层 system）。

---

## §0 ✅ 已裁：**B 线 · 真实物理**（owner 2026-08-07 判）

> owner 原话：「我需要做的是真实的物理，就是 B。」→ 走 **cannon-es 刚体（render-only）**，接受「不进 hash · 不可回放 · 平衡手调」的代价。下方 A/B 对照表保留作决策留痕。

### §0.1 裁决后实查（三条硬事实 · 均有实证，非推断）

**① v1 零新引擎能力就能做**——原判「B 需要先下沉接触事件」是**错的**，`RigidBody3D.toppleSignal` 已经给出了死亡判据：
- 兵倒下（倾角超阈值）→ 发一次信号 → `ThreeRenderer.drainPhysicsSignals()`（`three-renderer.ts:506`）→ `enqueueAction` → Signal → sim。
- 实证：`src/renderer/three/physics.test.ts:352`「toppleSignal：倾角超阈值发信号·平落不误发」+ `:367`「红线：不进 hash」。
- 即 **「被撞倒 = 阵亡」**（正是 TABS 的死亡模型）。**不需要接触伤害就能跑通一局。**
- ⚠ 但 game211 会是**全仓第一个消费者**（`grep settleSignal games/` = 零命中）→ 集成风险自担，先做最小竖切验证信号真能到 sim。

**② 物理承载量 ≈ 100 兵，不是 1000**（`node scripts/cannon-army-bench.mjs` 实测·两军 capsule 对冲·量 `world.step` 本身）：

| 同场兵数 | 均值 | p95 | 接触峰 | 判词 |
|---|---|---|---|---|
| 50 | 1.6–2.5ms | 1.9–4.5ms | ~260 | ✅ 安全 |
| 100 | 3.5–3.8ms | 4.7–5.1ms | ~570 | ✅ 安全 |
| 200 | 8–10ms | 9.8–13.8ms | ~1200 | 🟡 吃满帧 |
| 400 | 22ms | 27–30ms | ~2500 | ❌ 掉帧 |

→ **设计上限：每方 ~50 兵、同场 ~100。** 中队规模的物理战场，不是千人军团。

**③ 由 ② 推出的前提修正**：纯刚体路线下「充分利用批次渲染」是吃不到的——批渲的价值在上千实体，而物理在 ~100 就先撞墙，**瓶颈是 CPU 物理不是 draw call**。
→ **owner 2026-08-07 用混合 LOD 解掉了这个矛盾**（见 §0.1b）：真刚体只留接触带 ~100，后排 ~200 假兵走 sim 位移 + InstancedMesh 合批。**两个能力这才同时吃满**：物理吃在刀刃上，批渲吃在后排。

### §0.1b ⭐ 混合 LOD 方案（owner 2026-08-07 定：「战斗那部分是真刚体，后排是批量的假的」）

**棋盘 = 12 × 24 = 288 格**（owner 定·⚠ 仓库里原本**没有**这个棋盘，旧的是 3 路 × 9 格 = 27 格，新规格从这里起算）。总兵力目标 ~300（≈ 一格一兵）。

**两类实体，两条线，各走各的：**

| | 🔴 真刚体（接触带） | ⚪ 假兵（后排） |
|---|---|---|
| 组件 | `RigidBody3D{capsule}` + `Mesh3D` + `Transform3D` | `Mesh3D` + **2D `Transform`** + `Velocity` |
| 谁驱动 | cannon-es 物理（render-only·不进 hash） | `t1-motion-apply`（sim·**确定性·进 hash**） |
| 渲染 | three 逐 mesh | **InstancedMesh 同材质自动合批**（3d.md·零数据改动） |
| 数量 | ~100（预算见下） | ~200 |
| 依据 | `Mesh3D` 可挂 `Transform3D` **或 2D `Transform`**（3d.md 首行）→ 同一套渲染吃两种位姿源 | |

**稳态肉搏预算**（`node scripts/cannon-army-bench.mjs`·真刚体的定额依据·比行军更贴近真实负载）：

| 真刚体数 | p95/步 | 接触峰 | 判词 |
|---|---|---|---|
| 48 | 1.3–2.1ms | ~850 | ✅ |
| 72 | 2.4–2.9ms | ~1320 | ✅ |
| **100** | **3.3–3.7ms** | ~1870 | ✅ 安全 |
| 150 | 5.6–6.2ms | ~2860 | 🟡 |

> 反直觉但实测如此：**密集肉搏比行军对冲更便宜**（同 100 人：肉搏 3.7ms vs 对冲 5.1ms）——挤成一团时 SAP 宽相位扫得更省。对混合方案是好消息：最贵的那一撮正好是我们要留成真刚体的那一撮。
> ⚠ 诚实边界：基准在开发机 CPU 上跑、且肉搏体很快收敛成稳定堆叠；真局里不断有兵倒地(唤醒)会更贵。**按 100 定额、留 150 的头**，真机再校。

**升格 / 降格（假兵 ⇄ 真刚体）—— 零新能力，验过：**
- **升格**：接触带做成一个静态「伤害区」实体（`Shape`+`Sensor`+`Tag(ZONE)`+`Hitbox{onHit:{spawnTemplate:'soldier_rb'}}`）。假兵（2D `Transform`）走进去 → `d1-overlap-detect` 出 `Overlap` → `t2-hitbox` 命中 → **在目标位置发 `SpawnRequest`** 生成真刚体（`t3-prefab` 展开）+ 同拍伤害致死移除假兵（`t2-mortal`）。**= 一步换人，纯数据。**
  - 依据：combat.md「`Hitbox.onHit` → 命中即在**目标位置**发 SpawnRequest，与伤害同拍」。
  - ⚠ 语义上是借「伤害区」做升格闸——是数据级重组、走现成解释器，不是新机制（缺口协议第①步即解决 → 不上报）。
- **降格**：真刚体倒地（`toppleSignal`）= 阵亡，直接移除，不回落成假兵（死了就是死了·无需反向通道）。
- **为什么不用 `t3-merge-rule{need:1}` 换模板**：它对**全部**同模板实例无差别触发，给不出「只换走进接触带的那些」的位置门 → 不适配。

### §0.2 v1 接线（全数据·零新能力）

| 要素 | 怎么做 | 依据 |
|---|---|---|
| 兵 | `RigidBody3D{shape:'capsule',mass,friction}` + `Mesh3D` + `Transform3D` | 3d.md「capsule=角色」 |
| 冲锋 | `RigidBody3D.vx/vz` 初速；中途加速用 `Impulse3D{trigger}` bump | 组件字段现成 |
| 阵亡 | `RigidBody3D.toppleSignal` → 倒下即出局 | physics.test.ts:352 |
| 胜负 | sim 侧数存活：`group-count` + `t2-event-when` → `GameFlow` | game-103 先例 |
| 技能 | spawn 带 `RigidBody3D` 的物理落体（巨石/滚木/爆桶）砸进敌阵 | 纯数据 prefab |
| 战场 | `RigidBody3D{shape:'heightfield'}` 地形 + mass0 静态围栏 | 3d.md |
| 物理档 | `PhysicsWorld3D{gravity:-9.82,restitution:0,solverIterations:40}` | 3d.md「密集接触必配」 |
| 观感 | `Camera3D{mode:'orbit',shake}` · `Material3D{shading:'toon',outline}` · `Trail3D` · `Post3D` | 3d.md 华丽起手 |

### §0.3 留给 v2 的真缺口（**不阻塞 v1**·届时走 `docs/workflow/requests-3d.md` 由 P3D 裁）

| # | 缺口 | 实证 | v1 怎么绕 |
|---|---|---|---|
| P1 | **接触伤害**（撞击冲量 → 扣血）。`RigidBody3D` 只有 `settleSignal`/`toppleSignal` 两个出口，**无接触事件**（`grep beginContact src/renderer/three/physics.ts` = 零命中） | components/render.ts:227-229 | 用「倒下=死」替代 |
| P2 | **物理侧索敌/转向**。`t2-steering` 写 2D `Velocity`，驱动不了刚体；`Impulse3D` 要显式世界向量，无 seek 力 | components/render.ts:253-257 | 直线冲锋（两军对冲） |
| P3 | **范围技能选中**（按位置圈实体）。位置在 render-only `Transform3D`，sim 读它即破红线 | 3d.md 铁律 | 物理落体自然波及 |

> 复诵：**v1 = 两军直线冲锋 · cannon 真物理推挤撞飞 · 倒下即阵亡 · 站着的人多者胜 · 技能=从天而降的物理落体。零新能力、~100 兵、先跑通一局再谈精细化。**

---

## §0 附 · 决策留痕：物理线 A / B 对照（owner 已判 B）

仓库有**两条互不相通**的物理线，都带批次渲染。选哪条决定整个战斗层的写法、可测性与域归属。

| | **A · 2D 确定性物理（sim 线）** | **B · 3D 表现物理（render-only 线）** |
|---|---|---|
| 物理核 | `d1-overlap-detect`（动态 AABB 树宽相位 + 精确窄相位 + category/mask 分层）→ `t2-collision-resolve`（顺序冲量求解器·逆质量·8 遍速度迭代 + 3 遍 NGS 位置迭代·Box2D 同构） | `RigidBody3D`（cannon-es·box/sphere/capsule/convex/heightfield）+ `Impulse3D`（运行时冲量）+ `Joint3D`（绳/铰链/布娃娃）+ `PhysicsWorld3D`（重力/弹性/迭代数） |
| 手感上限 | **推挤 / 拥堵 / 质量分摊 / 站定不穿**。`restitution` 硬编码 0（`collision-resolve.ts:22,96`）→ **不弹、不翻滚、不飞** | **真物理**：撞飞、翻滚、堆叠、破碎、布娃娃 |
| 批次渲染 | `src/renderer/webgl/`（WebGL2 `drawArraysInstanced`·**实测 1000 精灵→1 draw**·`webgl-batch-bench.mjs`）；**原型边界**：只批精灵 + 实心方/圆，文本/多边形/瓦片走 canvas | three `InstancedMesh` 合批（`three-renderer.ts` W1-A·同材质签名一批·game102 实证 ~5 draw） |
| 确定性 | ✅ 进 sim / 进 hash / 可回放 / lockstep 安全 → **能喂仿真台自动调平衡** | ❌ render-only·不进 hash·不为联机·**无法回放、无法 sim 标数值** |
| 域归属 | game-g 自己（不碰 P3D） | `src/renderer/three-*` + 3D render-only 组件 = **P3D 独占域**，需跨域协调 |
| 代价 | 物理观感克制（像《铁锈战争》《They Are Billions》的群体推挤，不像 TABS 的乱飞） | 平衡只能靠手调·战斗结果不可复现·跨域协作成本 |

**Lead 推荐 = A**，三条理由：① owner 反复吃过「战斗不可复现 → 数值标不了」的亏（旧战斗核有整台 `simulate-balance.ts` 蒙卡仿真台，B 线一上就报废）；② 「上千单位」的批渲实测数据只有 2D 线有（1000→1 draw），3D 合批是按材质签名、单位数一大靠 LOD 而非纯批数；③ 不跨 P3D 域，game-g 自己就能推。
**若 owner 要的就是 TABS 那种「兵被锤子砸飞、堆成一坨」的物理喜剧感 → 只能选 B**，A 线给不出（restitution=0 + 无 2D 关节 + 无角动力学）。**请判 A / B。**

> 次要待确认（不阻塞，可先按推荐做）：**玩家在战中做什么？** 推荐 = 战前布阵/编队（田忌赛马真正落地：你亲手摆位置，不再是队列自动撞）+ 战中投天罡技能干预 + 零单位微操。这样 52 英雄 / 天罡 / 地支 / 战役 / 经济**整个元层零改动**继续消费。

---

## §1 一句话

两军在一张连续战场上**实时自动交战**：单位按数据自行索敌、推进、拥挤、开打；玩家的操作全在**战前布阵**与**战中投技能**，胜负由物理与数值涌现，而非回合结算。

## §2 消费的引擎能力（registry 实名 · A 线）

| capability | 用来做什么 | 状态 |
|---|---|---|
| `d1-overlap-detect`（`Shape.category/mask`） | 单位互相碰撞检测 + 阵营分层（友军不互撞可用 mask 关） | ✅ 现有 |
| `t2-collision-resolve`（`Mass`） | **单位拥挤推挤**：重甲推开轻兵、阵型被挤散、不穿模 | ✅ 现有 |
| `t1-motion-apply` / `t1-accel-apply` | 速度积分 / 冲锋加速 | ✅ 现有 |
| `t2-friction` / `t2-bounds-clamp` | 减速 / 战场边界 | ✅ 现有 |
| `t3-aggro`（`Perception{targetTag,sightRadius,lureTag}`） | **自动索敌**（含嘲讽/诱饵） | ✅ 现有 |
| `t2-steering`（`Steering{mode,speed,stopRange}`） | 朝目标推进 / 保持攻击距离 | ✅ 现有 |
| `t2-pathfind`（`NavGraph`+`NavAgent`）/ `d2-navmesh-bake` | 绕障行军（若战场有地形） | ✅ 现有 |
| `t2-hitbox`（`Hitbox`+`Sensor`+`Tag`+`onHit.spawnTemplate`） | 近战/AOE 伤害结算 + 命中特效 | ✅ 现有 |
| `t2-launch`（`Launch{speed,toward,bounce}`）+ `t2-bounce-relay` | 远程飞弹 / 跳弹 | ✅ 现有 |
| `t2-mortal`（`Mortal{resource:hp}`）+ `destroy` 原子 | 阵亡移除 | ✅ 现有 |
| `t3-caster`（`Caster`）+ `t3-prefab`（`PrefabTemplate`） | 技能释放 / 单位与飞弹按模板实例化 | ✅ 现有 |
| `t2-spawn-director` | 分批投放援兵（限速 + 同屏上限） | ✅ 现有 |
| `t2-stats`（`Stats`）+ `t2-modifier-stack`（`ModifierSource`/`ModifierTotals`） | 单位属性 + **天罡/地支/养成加成聚合**（禁游戏层自写聚合器） | ✅ 现有 |
| `t2-over-time`（`OverTime`） | 灼烧 / 回血 / 定时状态 | ✅ 现有 |
| `t2-event-when`（`EventWhen`+`Signal`）+ `group-count` | **胜负判定**（一方单位清零 / 大本营血归零）+ 阶段门 | ✅ 现有 |
| `t2-drag-place` / `t2-zone-occupancy` / `t2-tray` | **战前布阵**（拖单位进阵地格 · 占位约束） | ✅ 现有（形状待核，见 §4） |
| `t2-trigger-zone` | 大本营/据点占领区 | ✅ 现有 |
| `t2-anim-state` / `t2-facing` / `t2-face-rotate` / `l1-sprite` / `l2-color` | 走/打/死动画 · 朝向 | ✅ 现有 |
| `t2-gauge` / `t2-text-binding` | 血条 / 世界数字 | ✅ 现有 |
| `t2-camera-follow`（`Camera`） | 战场取景 / 缩放 | ✅ 现有 |
| `random`（`RandomSeed`+`nextRandom`/`seededShuffle`） | 一切随机（**裸 `Math.random` = 红线**） | ✅ 现有 |
| UI：`LayoutNode`（`ui/components`） | HUD / 布阵屏 / 结算（action 信号入队·**禁手写 DOM**） | ✅ 现有 |
| 渲染后端：`src/renderer/webgl/`（`?renderer=webgl2`） | **上千单位批渲**（零数据改动·只换后端） | ✅ 现有（原型） |

## §3 摆成数据的规则面

| 数据表 | 内容 | 谁解释它（禁游戏层自写解释器） |
|---|---|---|
| `UNITS`（52 英雄 + 兵种） | hp/攻/速/射程/质量/体型/攻击型态 | `t3-prefab`+`t2-stats`+`t3-aggro`+`t2-steering`+`t2-hitbox`+`t2-mortal` |
| `TIANGANG`（天罡·沿用） | 战中技能：范围/持续/效果 | `t3-caster`+`t3-prefab`+`t2-over-time`+`t2-modifier-stack` |
| `DIZHI` / 养成（沿用） | 单位属性修正 | `t2-modifier-stack`（局外 source） |
| `FORMATIONS` | 战前阵位/编队槽 | `t2-drag-place`+`t2-zone-occupancy` |
| `LEVELS`（52 关·沿用 `level.ts`） | Boss 军阵 + 地煞 + 难度 | 同上，重接新战斗的 init |
| `BATTLEFIELD` | 地形/障碍/据点/出生区 | `t2-tilemap` / `NavGraph` / `t2-trigger-zone` |

## §4 真缺口候选（**须 Lead/owner 裁 A 补引擎 / B 游戏层例外**，动手前不自裁）

| # | 缺口 | 现有件核查结论 | 判断 |
|---|---|---|---|
| G1 | **击退 / 冲量**（命中把目标推开·RTS 打击感核心） | `t2-hitbox` 只扣血 + 可 spawn 特效，**不写目标 Velocity**；`t2-launch` 写的是飞弹自己；`t2-pull-anchor` 只拉不推 | **疑似真缺口**（薄）：`Hitbox.onHit.knockback{force}` 或下沉 `impulse-apply`。**A 线唯一硬缺口** |
| G2 | **战前布阵**（拖单位进阵地 → 开战即实例化） | `t2-drag-place`+`t2-zone-occupancy`+`t2-tray` 各有一半；是否能拼出「槽位阵型 + 开战批量实例化」待实测 | **多半可重组**，先试再说 |
| G3 | **阵型/编队行军**（一队保持队形推进） | `t2-steering` 是逐单位 seek，无编队约束；`t2-path-follow{queueId}` 是单列队列不是方阵 | 可先不做（单位各自 seek + 碰撞挤成团 = 天然群感），**YAGNI 缓议** |
| G4 | **性能**：`overlap-detect` 每帧重建 AABB 树 + **每对接触 `createEntity`/`destroyEntity`** | 混战成团时接触对数 ~O(n·k)，每 tick 建毁上百实体 | **不是缺口是风险**：开工第一件事跑基准，不达标再提缺口 |

> 未列进本表的游戏层自由代码 = 违规。审计红旗（裸 `Math.random` / `innerHTML` / `createElement` / 零能力接入 / 零测试）不接受申请为例外。

## §5 删除清单（"战斗部分全部删除"的精确边界 · 共 ~4400 行）

**整文件删**（战斗专属）：
`turn-combat.ts`(929) · `clash-resolve.ts`(105) · `combat-types.ts`(25) · `turn-battle-screen.ts`(1121) · `game-g-clash-view.ts` · `clash-dice-3d.ts`(115) · `battle-timeline.ts`(97) · `battle-coach.ts` · `coin-flip.ts`(已是死代码) · `player-ai.ts`(266) · `simulate-balance.ts`(327) · `disha.ts`(138)

**同批删测试**（12 个）：`turn-combat.test` · `clash-resolve.test` · `tengang-turn.test` · `turn-speed.test` · `ai.test` · `player-ai.test` · `disha.test` · `coin-flip.test` · `battle-coach.test` · `battle-timeline.test` · `turn-battle-screen.click.test` · `turn-battle-screen.frame.test` · `game-g.battle.test` · `game-g.turnmatch.test`

**改不删**（元层保留，只重接战斗入口）：`level.ts`（`LevelDef` 的 `boss.startFormation/garrisonMana/stayP` 等回合制字段作废、换新战斗参数）· `game-g.tsx`（摘掉 8 处战斗 import + 战斗屏挂载）· `game-g-build.ts` · `game-g-save.ts` · `lobby-types.ts` · `home-screen.ts` · `collection-screen.ts` · `campaign-screen.ts`

**完全不动**（元层资产全部继续有效）：`blueprint.ts` · `hero-codex.ts`(52 英雄) · `tiangang-data.ts` · `dizhi-data.ts` · `formation-data.ts` · `boss-roster-data.ts` · `campaign-data.ts` · `economy-data.ts` · `archetype-data.ts` · `deck-data.ts` · 大厅六屏 · 美术/音频/存档

## §6 红线自检

- 单位移动/碰撞/伤害/死亡**全走能力 + 组件数据**，游戏层零 system（`capability-plan` 过审前一行不写）。
- 随机全部种子化；表现字段（`Color.alpha`/`Tween`）不进 hash。
- HUD/布阵屏走 `LayoutNode` 闭集，play-field 走 render 组件 + 渲染器；**禁手写 DOM/CSS 逃生**（旧战斗屏 1121 行手写 HTML 串正是要被这次重做清掉的债）。
- 交付前：`node scripts/game-skill-audit.mjs game-g` + `/check-ui` + `node scripts/scoped-gate.mjs --run` 全绿。
