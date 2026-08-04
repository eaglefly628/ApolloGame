# 能力总览 Capability Plan — game-105《心跳叠叠乐》（S2 送审稿）

> GD-105 · 2026-08-04 · slot=`game-105` · 形态=编译期 TS 游戏（待 Lead 裁·理由见 `brief.md §5`）
> **plan 未过审不写游戏层系统代码**（CLAUDE.md 能力总览铁律）。规则语义随后进 `gdd.md`。
> 能力名已对照真实 registry 逐条核准（`src/skills/{atoms,tier1,tier2,tier3}`）；3D 组件名对照
> `src/engine/protocol/components/render.ts`。

## 1. 游戏一句话

两人轮流从**真物理 54 块积木塔**抽一根，按颜色得亲密度并触发心动任务卡；**塔塌在谁手里谁输**，
输家按「抽过的颜色分值 + 撑到第几轮」结算惩罚（参照：实体叠叠乐 × Truth-or-Dare 约会桌游）。

## 2. 消费的引擎能力（对照 registry 实名）

### 2.1 sim 侧（确定性·进 hash）

| capability（注册名） | 用来做什么 | 状态 |
|---|---|---|
| `w1-random`（`RandomSeed`+`nextRandom`） | 积木颜色布局、任务卡抽取的**唯一随机源**（游戏层禁裸 `Math.random`） | ✅ 现有 |
| `k1-spawn` | 54 块积木实体按塔布局表实例化 | ✅ 现有 |
| `t3-prefab`（`PrefabTemplate`） | 「一块积木」= 预制体模板（4 色 4 个变体），塔布局表只填坐标+色 | ✅ 现有 |
| `f1-resource` | 双方亲密度、共同亲密度、剩余积木数 | ✅ 现有 |
| `f2-flag` | 当前执手方、本局已结束、任务卡待确认 | ✅ 现有 |
| `t3-flow`（`State`+transitions） | 回合状态机：选积木→拖拽→等落定→判定→任务卡→交手 | ✅ 现有 |
| `t2-event-when`（`EventWhen`+`Signal`） | 条件门发信号：塌了→判负、轮次推进、亲密度阈值解锁 | ✅ 现有 |
| `t2-keybind`（`Signal`） | 输入胶水入队的信号落进 sim（`Pickable3D` 命中走此路） | ✅ 现有 |
| `t2-modifier-stack`（`ModifierSource`+`ModifierTotals`） | **轮次加成**（每撑过 N 轮，颜色分值档位×1）聚合 | ✅ 现有 |
| `t2-dice-roll`（`DicePool`） | 任务卡按颜色频道**种子化抽取**（不重复直到抽空） | ✅ 现有 |
| `t3-dialogue`（`DialogueScript`） | **心动任务卡 = 对话树数据**（说话人+卡面文案+「完成了/换一张」选项） | ✅ 现有 |
| `t2-stat-bind` / `t2-text-binding` | HUD 数值绑定（亲密度/轮次/剩余块数） | ✅ 现有 |
| `t2-gauge`（`Gauge`） | 共同亲密度条 | ✅ 现有 |
| `g1-tag` | 积木按颜色频道打标，供计分与卡组路由 | ✅ 现有 |

### 2.2 render-only 侧（3D 表现物理·不进 sim/hash）

| 组件 | 用来做什么 | 状态 |
|---|---|---|
| `Transform3D` + `Mesh3D`（box） | 54 块积木 + 桌面的位姿与外形 | ✅ 现有 |
| `Material3D` | 四色积木 PBR 材质（木质 + 色调），桌面材质 | ✅ 现有 |
| `RigidBody3D{shape:'box',mass}` | **整座塔的真刚体堆叠**（cannon-es 驱动·手册「物理玩具」首行明写用例=堆叠） | ✅ 现有 |
| `Pickable3D{signal,hover}` | 指针拾取积木 → 输入胶水 `enqueueAction` → Signal → sim（**手册明载不碰 sim 确定性**） | ✅ 现有 |
| `Joint3D{kind:'point',pivotA,anchor,maxForce}` | **抽积木的「手」**——球铰约束连到世界锚点，拖拽即改 `anchor`；`maxForce` 决定拉不拉得动被压紧的积木 | ✅ 现有 |
| `Impulse3D{trigger,...}` | 可选：抽出瞬间给积木一点脱手冲量 | ✅ 现有 |
| `WorldUI3D{node:LayoutNode}` | 悬停积木头顶浮出颜色/分值（同 game-d 骰子点数先例） | ✅ 现有 |
| `Camera3D`（`shake`/`tween`） | 绕塔运镜；**塌塔瞬间 `shake` 打击反馈** | ✅ 现有 |
| `Light3D` / `Post3D` / `Decal3D` | 双色打光、辉光、桌面软阴影 | ✅ 现有 |

> **诚实校正（⚖ Lead 校注 2026-08-04 修正口径）**：**render-only 物理线**无独立 `Collider3D`——体形由 `RigidBody3D{shape}` 自带
> （`playbooks/3d.md` 物理行口径正确）；`casual-toolkit.md` §五该行回填已随 `56b229824` 同批落地，本段「建议回填」为陈旧文案。
> ⚠ 但「闭集里没有 `Collider3D`」的说法**不准确勿再扩散**：sim 侧确有同名组件 `Collider3D`
> （`protocol/components/spatial.ts:92`·REQ-3D-Collision·**确定性逻辑碰撞体·进 hash**·由 `overlap-detect-3d` 消费）——那是逻辑碰撞线，与本节表现物理是两条线。

> **先例台**：`games/game-d/throw3d.ts`（3D 物理掷骰=物理定结果的既有范式）、`games/game-c/chip3d.ts`（筹码刚体·⚖ Lead 校注：`angularFactor` 在该文件仅为待填注释尚未在用·引擎侧已支持）、
> `src/renderer/three/physics.ts`（物理子系统）。（⚖ Lead 校注：原列 `voxel-proto.ts`「体素刚体碎片」剔除——该文件零 `RigidBody3D`·手写弹道积分非刚体先例。）

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它（禁游戏层自写解释器） |
|---|---|---|
| `TOWER_LAYOUT` | 18 层 × 3 块的坐标/朝向/尺寸公差 | `k1-spawn` + `t3-prefab`（纯坐标表，无逻辑） |
| `BLOCK_CHANNELS` | 四色频道：分值 / 色值 / 标签（樱粉1·星紫2·夜蓝3·流金5） | `g1-tag` + `f1-resource`（加分）+ `t2-modifier-stack`（轮次档） |
| `COLOR_MIX` | 54 块的颜色配额（20/16/12/6） | `w1-random` 种子洗牌 |
| `TASK_DECKS` | 四频道任务卡文案树 | `t3-dialogue`（`DialogueScript`）+ `t2-dice-roll`（抽取） |
| `ROUND_BONUS` | 轮次→分值档位曲线 | `t2-modifier-stack`（op=mul 聚合） |
| `PENALTY_TIERS` | 惩罚分→惩罚等级与文案 | `t2-event-when`（阈值条件）+ `t3-dialogue`（结算文案） |
| `PULL_FEEL` | 抽拉手感：`maxForce` / 拖拽灵敏度 / 失稳阈值 | `Joint3D.maxForce` + 物理参数直接消费（**见 §4 E1**） |

> **红线自检**：以上每张表都指向现成能力做解释器，无「表 + 待写游戏层 for 循环」。
> 唯一需要裁的解释器归属是 `PULL_FEEL` 的失稳阈值——见 §4。

## 4. 申请的游戏层代码例外 / 能力缺口（逐条过审）

| 编号 | 例外 | 为什么现有能力表达不了 | 预计行数 | 请裁 |
|---|---|---|---|---|
| **E1** | **「刚体落定/失稳 → 信号」回读** | 物理结果只写回 `Transform3D`，而 `Transform3D` 在 `src/net/determinism.ts` 的 `NON_DETERMINISTIC` 集里 → **`Condition` 读不到、不进 hash**。本作的核心判负条件（塔塌了没有）因此**无法用现有能力表达** | 见下 | **下沉（首选）** |
| **E2** | 指针拖拽 → 移动 `Joint3D.anchor` 的输入胶水 | 与 `Pickable3D` 文档明载的「渲染器 pick → 游戏输入胶水 `enqueueAction`」同类；`throw3d.ts` 已确立同形态先例 | ~50 | ✅ 准（照先例） |
| **E3** | **物理世界参数按游戏可配** | `three/physics.ts:148` 全局硬编码 `gravity -42`（为掷骰调）/`restitution 0.4`/未设 `solver.iterations`（默认 10）。**实测该配置下 54 块塔 0.1s 崩塌**；游戏层摆任何数据都改不动引擎侧的 World | 0（纯引擎侧） | **下沉·P1 硬阻塞** |

### E3 详述 —— S3 的硬前置（**无绕行路**）

**实证（cannon-es 0.20.0 = 引擎 pin 版本·54 块塔·判塌=塔顶下沉 > 2 倍积木高）**：

| 配置 | 结果 |
|---|---|
| ① 引擎现状原样（g=-42·it=默认10·rest=0.4） | **0.1s 崩塌** ❌ |
| ② 仅把 `solver.iterations` 提到 40 | **0.1s 崩塌** ❌ |
| ③ ② + `restitution=0` | **0.1s 崩塌** ❌ |
| ④ ③ + `gravity=-9.82` | **站住**（20s 塔顶仅下沉 0.085） ✅ |

**主因是重力而非迭代次数**（与直觉相反，故存证）。另测：即便 `g=-9.82`，`iterations=20` 时塔仍会在 20s 内因求解器蠕变自行塌陷，**40 才稳**。堆叠需 `gravity≈-10` + `restitution≈0` + `iterations≥40` 三者同时成立。

**已提单**：`docs/workflow/requests-3d.md` → `REQ-3D-TOWER-STACK`（建议 opt-in 场景级 `PhysicsWorld3D` 配置组件·**缺省行为零变**，因为 `-42` 是 game-d 掷骰刻意调的，全局改必伤它）。

**与 E1 的区别**：E1 可用薄胶水绕行出可玩版；**E3 无绕行路**——物理世界在引擎侧，游戏层再怎么摆数据也够不着。
**故 E3 未落地前，game-105 的 S3 骨架关无法开工**（塔立不住 → 全部规则无从谈起）。

### E1 详述 —— 请 Lead 裁「下沉 vs 游戏层胶水」

**实证（不是推测）**：

- 引擎 `src/renderer/three/physics.ts:188` **已经在配 cannon 的 `allowSleep` / `sleepSpeedLimit` / `sleepTimeLimit`**
  ——「落定」这个状态 **cannon 本来就算出来了**，只是没有任何出口通向 sim。
- 游戏层已在手搓同一件事：`games/game-d/throw3d.ts`（`lastMoveMs`/`prevQuat` 落定轮询·`throw3d.ts:26-27,75-90`）。
  **⚖ Lead 校注（2026-08-04）**：原稿另列 `voxel-proto.ts`「12 处 sleep 判定」**不实**——该文件零 `RigidBody3D`，movers 是手写弹道积分 + life 计时回收，与刚体落定无关，剔除。
- `REQ-3D-G102-DEBRIS` 的性能预算里也写着「落定/超时 despawn（sleep 后 1.5-2.5s 回收）」——规划面同需求。
  **校正后的重复面 = throw3d（在用）+ G102-DEBRIS（规划）+ 本作 = 3 处**（另 `chip3d.ts` 筹码落定为潜在消费方），下沉论证仍成立。

**建议下沉的薄片**：给 `RigidBody3D` 加一个 opt-in 的事件出口（如 `settleSignal?` / `topplePolicy?`），
落定或越过位移/倾角阈值时经与 `Pickable3D` **完全相同的既有通路**（渲染器 → `enqueueAction` → `Signal` → sim）发信号。
一片能力消掉 game-d 掷骰读数（在用）、G102-DEBRIS 碎片回收（规划）、game-c 筹码落定（潜在）与本作判负的重复。

**已提单**：`docs/workflow/requests-3d.md` → `REQ-3D-SETTLE-SIGNAL`（P3D 域·Lead 评审）。

**不阻塞路径**：按代码准入阶梯 L2「可先用 L0/L1 绕行出可玩版」——裁决未下之前，
本作照 `throw3d.ts` 先例用一层**薄轮询胶水**（~60 行·记债）出 S3/S4 可玩版；
能力下沉后**删胶水改填数据**。此降级已在 §4.7 逐条留痕。

> 未列进本表的游戏层自由代码 = 违规。审计红旗（裸 `Math.random` / `innerHTML` / `createElement` / 零能力接入 / 零测试）不接受申请为例外。

## 4.5 美术接入

- **皮肤槽清单**：主体视觉实体 = 积木（四色）、桌面、背景幕。四色积木走 `Material3D`（PBR 木纹 + 色调槽），
  桌面走 `Material3D.map` + `Decal3D`（软阴影）。**主体视觉实体全部带槽**（art-pipeline 红线）。
- **台账产出**：形态=编译期 TS 游戏 → 照 `scripts/game-g-art-requirements.mjs` 样板写推导脚本
  `game-105-art-derive.mjs`（待建·PE 骨架落地时同提交）。
- 原型阶段用程序化色块占位，**皮肤就绪即盖过**；「全程序化」不作为终态美德。

## 4.6 UI 呈现 · 华丽起手

- **house 主题**：`apolloBrocade`「锦霞」（`@ui/components/apollo-kit`）——暖白锦缎 + 金/胭脂波点 + 玫瑰点睛，
  手册标注适配「宫廷/**女性向**/卡牌」，与约会向定位一致。**非自写皮、非缺省 SHELL**。
- **起手包**：主菜单 = `buildStarterHome`（双人名字输入 + 主 CTA）；结算 = `buildStarterResult`
  （星级 Rating + 撒纸屑 + `Label.format` 大分）。均 import `@ui/starters`。
- **成熟件清单**（对照 `playbooks/ui.md` 华丽起手货架）：
  - 心动任务卡 → **VN 三件** `dialog`（`typewriter` 逐字 + `skin` 画框皮）+ `choiceList`（糖果厚唇选项钮）+ `portrait`（男女主立绘槽）
  - 抽拉阻力表 → `ProgressBar.shape:'ring'`（环形仪表·非朴素条）
  - 得分反馈 → `Particles` / `Float`（分数飘字）
  - 主 CTA → `sheen-hover` + `Panel.skin`
  - 数值 → `Label.format`
  - 世界内 → `WorldUI3D`（积木头顶分值牌）
- 零成熟件 = 朴素缺陷；本作已逐项落位，**无手写 React 屏 / 无自由 DOM**。

## 4.7 代码准入阶梯申报

| 规则 | 落级 | 说明 |
|---|---|---|
| 塔布局（18×3 坐标/朝向/公差） | **L0** 纯数据 | `TOWER_LAYOUT` 表 |
| 四色频道分值 / 颜色配额 | **L0** 纯数据 | `BLOCK_CHANNELS` + `COLOR_MIX` |
| 任务卡文案与分支 | **L0** 纯数据 | `TASK_DECKS`（`DialogueScript`） |
| 惩罚分级与文案 | **L0** 纯数据 | `PENALTY_TIERS` |
| 积木实例化 | **L1** 数据 + 现有能力 | `k1-spawn` + `t3-prefab` |
| 回合流转 / 交手 | **L1** | `t3-flow` 状态机 |
| 计分与轮次加成 | **L1** | `f1-resource` + `t2-modifier-stack` |
| 任务卡抽取（种子化不重复） | **L1** | `t2-dice-roll` + `w1-random` |
| 判负条件（塔塌） | **L1** 条件门 | `t2-event-when` 消费 E1 下沉后的信号 |
| 抽积木的「手」 | **L1** | `Joint3D{kind:'point',maxForce}` 纯数据 |
| 指针拖拽 → 移动 `Joint3D.anchor` | **L1** 输入胶水 | 照 `Pickable3D` 文档与 `throw3d.ts` 先例（E2） |
| **物理落定/失稳 → 信号** | **L2 capgap 待裁** | 已提 `requests-3d.md` → `REQ-3D-SETTLE-SIGNAL`（E1） |
| **抽拉手感调校**（`maxForce`/阈值数值） | **L0 纯数据**（降级路径） | 摆成 `PULL_FEEL` 表由 `Joint3D.maxForce` + 物理参数直接消费；**不写游戏层解释器** |
| （过渡期）落定轮询薄胶水 | **L3 受控·记债** | 仅在 E1 裁决落地前存在，照 `throw3d.ts` 先例；**能力下沉后即删** |

> L4（自由代码 / 手写 UI / 自建解释器）未申报，也不会用。

## 5. 确定性声明

**如实分层，不粉饰**：

- **sim 侧全确定性**：颜色布局、任务卡抽取、计分、轮次、判负全部走 `w1-random` 种子 PRNG + 现有能力，进 hash，可回放。
- **物理侧非确定性**：`RigidBody3D` 等全部 3D 组件在 `src/net/determinism.ts` 的 `NON_DETERMINISTIC` 集内，
  按引擎既定口径「为表现非同步」。塔的姿态**不进 hash**。
- **因此本作不承诺逐位回放 / lockstep**——与 game-d 同一处境（`throw3d.ts` 已记同款债：
  「结果由物理定 = 非确定性 → 暂放弃 seed/lockstep 可回放」）。
- **为什么可接受**：本作是**本地 hot-seat 双人**（情侣同屏轮流），无联机同步需求；
  且输入本身是连续指针拖拽，本就不可逐位复现。**不为不需要的确定性付架构成本**。
- 若 Lead 要求本作纳入 `ZeroCraftBench` 双跑同 hash 验收，则需先裁 E1 时一并裁「物理结果是否需可复现」——
  这会把范围从「暴露落定信号」扩到「确定性物理」，量级完全不同。**GD 建议不做**，理由同上。

## 6. 评审记录

- 提交人 / 日期：GD-105 / 2026-08-04
- 待裁焦点：① 形态（编译期 TS vs 卡带）② **E3 物理世界可配（P1 硬阻塞·无绕行路·请优先裁）** ③ E1 下沉 vs 游戏层胶水 ④ §5 不承诺回放是否可接受
- **前置依赖**：`REQ-3D-TOWER-STACK` 落地前 S3 无法开工——这不是排期问题，是「塔立不住」的物理事实
- **⚖ Lead 裁决（2026-08-04）：☑ 有条件通过（S2 过审）**。四裁：
  - **① 形态 = 编译期 TS 游戏·准**——输入胶水（拖拽→`Joint3D.anchor`）+ 物理回读是 `throw3d.ts` 既立的「薄胶水编排引擎能力」形态，卡带 manifest 接不住；同 game-103 先例。
  - **② E3 = 准·下沉·维持 P1 硬前置**——独立核实：`physics.ts:148-150` 硬编码 g=-42/rest=0.4/friction=0.35、全文件零 `solver.iterations`、`src/` 全域零 `PhysicsWorld` 配置入口——「游戏层无绕行路」**成立**。`REQ-3D-TOWER-STACK` spec 照案通过（opt-in 场景级配置·**缺省行为零变**·game-d 掷骰回归目击 + 缺省值测试钉死进验收）。E3 落地前 S3 不开工。
  - **③ E1 = 准·下沉为 `REQ-3D-SETTLE-SIGNAL`**——「引擎已配 per-body sleep（`physics.ts:188`）却无出口」属实；走 `Pickable3D` 同通路（渲染器→`enqueueAction`→`Signal`→sim·不进 hash）口径正确；「不要确定性物理」**同判**（要可复现另立项）。重复面经核实**校正为 3 处非 4 处**（voxel-proto 剔除·见 §4 校注）——论证仍足。过渡期 L3 轮询胶水照 `throw3d` 先例**记债准**，下沉后即删（§4.7 已申报）。
  - **④ 确定性豁免 = 准**——本地 hot-seat 双人无联机同步需求；`NON_DETERMINISTIC` 集含全部 3D 组件已亲核（`determinism.ts:18`）；game-d 同款债先例在档（`throw3d.ts:8` 头注）。**条件**：本作不纳入 lockstep/Bench 双跑 hash 验收面；sim 侧（计分/抽卡/流程/判负信号消费）仍须全确定性进 hash（§5 承诺·S8 验收核）。「不扩确定性物理」同判——不为不需要的确定性付架构成本。E2 照先例准。
  - **事实校正三条（Lead 已代改正文·见 §2.2/§4 校注）**：Collider3D「闭集里没有」措辞（sim 侧确有同名确定性组件）；voxel-proto「12 处 sleep 判定」不实；chip3d `angularFactor` 为注释未在用。其余核查（组件闭集逐项/sim 能力 15/15 实名/UI 面四项/两单在档/throw3d 记债）**全部属实**——GD-105 的「实证不是推测」纪律值得表扬，`throw3d.ts:37` 与 `:8` 头注语义互斥属旧文件内债，另记 game-d 工单不阻本案。
  - **过审条件汇总**：E3 落地前 S3 不开工（P3D 施工·`requests-3d.md` 两单已批注）；手感超支风险（brief §6）S3 期重点盯 `PULL_FEEL` 是否守住 L0；owner 侧 S1 签字待补。
