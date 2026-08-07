# 能力总览 Capability Plan — game-G 战斗重做《实时物理自动战斗》（送审稿）

> 2026-08-07 · owner 拍板：**回合制战斗整块删除 → 实时 · 物理驱动 · 自动战斗 · RTS 观感**，要求「充分利用物理能力 + 批次渲染能力」。
> **plan 未过审不写游戏层 system 代码**（CLAUDE.md 能力总览铁律）。能力名已对照 `src/assembly/capability-registry.ts` 实名核准。
> 模板 `docs/design/capability-plan-template.md`；先例 = `docs/design/game-103/capability-plan.md`（实时·百敌·零游戏层 system）。

---

## §0 ⚖ 待 owner 判：物理线 A / B（**唯一阻塞项**）

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
