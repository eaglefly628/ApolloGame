# 能力总览 Capability Plan — game-103《幸存者核心原型》（S2 送审稿）

> GD-103 · 2026-07-23 · **形态=编译期 TS 游戏（owner 2026-07-23 拍板）**；slot=`game-103`（owner 拍板·不占字母位）。
> **plan 未过审不写游戏层系统代码**（CLAUDE.md 能力总览铁律）。规则语义=`gdd.md`。
> 能力名已对照真实 registry 核准（`src/skills/tier1·tier2·tier3` + `atoms`）。

## 1. 游戏一句话

俯视 2D 单摇杆走位、武器全自动开火的**吸血鬼幸存者式割草 Roguelite**（参照 Survivor.io / Vampire Survivors）：升级三选一 + 武器×被动进化，从被群追到清屏，限时打 Boss。

## 2. 消费的引擎能力（对照 registry 实名）

| capability（注册名） | 用来做什么 | 状态 |
|---|---|---|
| `t1-motion-apply` (`Velocity`) | 玩家 + 敌人 + 子弹按速度移动 | ✅ 现有 |
| `t1-accel-apply` (`Acceleration`) | 冲刺/击退的加速度（可选） | ✅ 现有 |
| `t2-steering` (`Steering`) | 敌人朝玩家转向移动（chase） | ✅ 现有 |
| `t3-aggro` (`Perception`) | 敌人锁定玩家 / 远程武器锁最近敌人 | ✅ 现有 |
| `t3-caster` (`Caster`) | 武器冷却好→释放（放子弹 prefab / AoE） | ✅ 现有 |
| `t3-prefab` (`PrefabTemplate`) | 子弹/光球/冲击波/敌人=预制体按数据实例化 | ✅ 现有 |
| `t2-launch` (`Launch`) | 直线飞弹（飞镖/激光/回旋镖去程） | ✅ 现有 |
| `t2-hitbox` (`Hitbox`+`Shape`+`Sensor`+`Tag`) | 命中扣血（子弹/AoE/接触伤害） | ✅ 现有 |
| `t2-mortal` (`Mortal{resource:hp,atOrBelow:0}`) | 敌人/玩家死亡移除 | ✅ 现有 |
| `t2-stats` (`Stats{base,mods,effective}`) | 玩家/敌人实体属性（攻/血/速），装备 mods push | ✅ 现有 |
| `t2-modifier-stack` (`ModifierSource`+`ModifierTotals`) | **被动技能全局加成聚合**（伤害/攻速/范围/拾取…） | ✅ 现有 |
| `t2-over-time` (`OverTime`) | 灼烧 DoT / 生命回复 / 定时状态 | ✅ 现有 |
| `t2-dice-roll` (`DicePool`) | **升级三选一抽取 + 掉落判定**（种子化） | ✅ 现有 |
| `t2-event-when` (`EventWhen`+`Signal`) | **进化触发条件门**（"武器 lv5 且带被动"布尔条件树 edge 触发发信号）+ 波次时间门 | ✅ 现有 |
| `t3-merge-rule` (`MergeRule`) | **进化替换**（N 换 1 模板替换·摘要明列"进化通用"·适配形状待核·见 §4 E2） | ✅ 现有（适配待裁） |
| `t2-bounds-clamp` (`Bounds`+`Shape`) | 场地边界限制 | ✅ 现有 |
| `spawn`（原子） | 刷怪 / 掉落物生成 | ✅ 现有 |
| `spatial-query`（原子） | 范围索敌 / AoE 命中查询 / 拾取半径 | ✅ 现有 |
| `overlap-detect`（原子） | 接触伤害 / 拾取触发 | ✅ 现有 |
| `timer`（原子） | 波次时间轴 / 武器冷却 / 子弹寿命 / 精英-Boss 节点 | ✅ 现有 |
| `input-capture`+`controllable`+`action-map`（原子） | 单摇杆/WASD 走位输入 | ✅ 现有 |
| `camera`（原子） | 相机跟随玩家 | ✅ 现有 |
| UI：`LayoutNode`（`ui/components`） | HUD（血/经验/计时）+ 升级三选一弹窗（action 信号入队） | ✅ 现有 |

> 现成先例台：`src/games/game-i/physics-lab.ts`（运动）、`src/games/game-i/ai-lab.ts`（aggro+steering 群体追击）、`src/skills/tier2/hitbox.ts`/`over-time.ts`/`launch.ts`。

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它（禁游戏层自写解释器） |
|---|---|---|
| `WEAPONS` | 武器基础属性 + 1-5 级成长 + 进化指向 | `t3-caster`+`t3-prefab`+`t2-launch`+`t2-hitbox` |
| `WEAPONS_EVO` | 进化武器属性 + 质变 flag（homing/pull/fan…） | 同上（flag 由对应能力读；缺 flag 见 §4） |
| `PASSIVES` | 被动 stat + 每级增量 | `t2-modifier-stack`（op=add/mul 聚合） |
| `ENEMIES` | 敌人 HP/速度/伤害/行为/掉落 | `t3-aggro`+`t2-steering`+`t2-hitbox`+`t2-mortal` |
| `WAVES` | 时间轴刷怪/围杀/精英/Boss 事件 | `timer`+`spawn`（数据驱动调度，见 §4 编排例外） |
| `DROPS` | 经验宝石/道具掉率 + 经验曲线 | `t2-dice-roll`+`spawn` |
| `LEVELUP_POOL` | 三选一候选池权重 | `t2-dice-roll`（加权抽 3） |
| `META_UPGRADES` | 局外永久升级（M4） | `t2-modifier-stack`（局外 source） |

> **红线自检**：以上每张表都指向**现成能力**做解释器，无「表 + 待写游戏层 for 循环」。三处编排（三选一/进化/波次）的解释器归属见 §4，是本 plan 的过审焦点。

## 4. 三处编排的能力归属（owner 2026-07-23 拍板：下沉新能力·交 Lead 做）

> **owner 决策**：这块编排能力**下沉为新通用能力，交 Lead 做**。
> **GD 诚实核查（CLAUDE.md CORE RULE §2 先重组再下沉）**：动手前逐条对现有 registry 核查——**大半可被现有件重组表达**，非「3 个整块新能力」。据实把「重组 vs 下沉哪几处薄缺口」的裁决交 Lead（引擎域），需求单已如实框定（见 requests.md `REQ-SURVIVOR编排`）。

| 编排点 | 现有件覆盖度（核查结论） | 真缺口（请 Lead 裁下沉的薄片） |
|---|---|---|
| **E1 升级三选一 draft** | 抽取=`t2-dice-roll` ✅；**但"按持有武器/被动+槽位满否过滤候选池 → offer N 选 1"无现成 draft/offer 件** | **最可能真缺口** → 下沉 `draft-offer`（过滤候选+发 N 选项+选中回填），Roguelite 通用 |
| **E2 进化触发替换** | 条件门"武器 lv5 且带被动"=`t2-event-when`（布尔条件树 edge 触发）✅；替换动作=`t3-merge-rule`（摘要明列"进化通用"）**但其形状是"N 个同模板换 1"，进化是"1 武器+被动在场→换模板"，need:1 是否适配待核** | **薄缺口/可能可重组** → Lead 核 merge-rule need:1 + event-when 门是否成立；不成立则下沉「条件单实体换模板」 |
| **E3 波次刷怪调度** | 时间门=`t2-event-when`（时间/资源条件→信号）✅ + `spawn` 原子逐个生成 ✅；**但 spawn 是单发·无 rate（每秒 N）/cap（同屏上限）** | **薄缺口** → 下沉 `spawn-director`（限速+同屏上限+按波表调度）；或 `timer(period)`+存活计数重组，Lead 定 |
| **E4 进化质变 flag** | homing=`t2-steering`+`t3-aggro` ✅；fan=`Launch.amount>1` ✅；pull=反向 steering/吸引（待核） | 多数可重组·逐个核 describe；真缺口（如 pull 吸附）单独走 capgap |

> **结论**：请 Lead 评审 `REQ-SURVIVOR编排`——回驳能重组的（E4 大半、E2 若 merge-rule 适配），只下沉真薄缺口（E1 `draft-offer`、E3 `spawn-director`、E2 换模板动作若缺）。**下沉件属引擎域·Lead/Opus 施工·GD 不碰代码；过审前不写任何游戏层 system。**
> 未列进本表的游戏层自由代码=违规。审计红旗（裸 Math.random / innerHTML / createElement / 零能力接入 / 零测试）不接受申请为例外。

## 4.5 美术接入

- **皮肤槽清单**：玩家、各敌人、各武器投射物、经验宝石、道具、Boss——**主体视觉实体全部带 `Sprite` 皮肤槽**（art-pipeline 红线）；原型阶段用占位几何体（圆/方 + 颜色），皮肤就绪即盖过。
- **台账产出**：形态=编译期 TS 游戏（owner 拍板）→ 照 game-q 样板写推导脚本 `game-103-art-derive.mjs`（待建·PE 骨架落地时同提交）。
- 「纯程序化观感」仅作占位回退，不作为终态美德（art-pipeline 上线后旧叙事作废）。

## 5. 确定性声明

- 随机源：引擎种子 PRNG（`t2-dice-roll` / atoms/random），seed 由单局开局注入；**游戏层禁裸 Math.random**。
- 回放/同步：原型阶段**单机、需支持回放**（便于数值调试 + balance-sim）。→ 非确定性风险点：实时输入采样频率、实体更新序（需固定 order/id 定序，禁墙钟）。lockstep/联机=out of scope。

## 6. 评审记录

- 提交人 / 日期：GD-103 / 2026-07-23
- owner 拍板（2026-07-23）：形态=编译期 TS 游戏；slot=game-103；§4 编排下沉新能力交 Lead。
- Lead 裁决：⬜ 待审（焦点=§4 三处编排 `REQ-SURVIVOR编排` 重组 vs 下沉哪几处薄缺口；及 §5 实时确定性/实体规模风险）
