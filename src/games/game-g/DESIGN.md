# Game G《翻命扑克 · Fateflip》设计案 v2

> 作者：策划兼程序（本 session）｜ 2026-06-14
> 宪法：`docs/design/data-driven-manifesto.md`｜规范：`CLAUDE.md`｜参考：gameF（run/round flow + 经济 + 商店）、gameE（52 牌组）
> **v2 取代初版"物理决定胜负"模型**（settle-read/impulse 已回退，见 §11 演进史）。本文为当前真相。

---

## 〇、一句话 + 统一原则

**拟人化扑克的"掷命对决"**：每张牌掷一次"命"——**正面活、反面死**。但**不是物理掷出胜负**，而是

> **胜负先由规则定（确定性数据），3D 翻牌是反推的表现（单向被驱动、永不回灌 gameplay）。**

局内：一队牌按规则各自掷命 → 3D 翻牌演出 → 数存活定胜负。局外：集材 → 改造牌组（升 favor/换皮）→ 商城 → 再战（≈ gameF + gameE）。

### 这条原则为什么是地基（同时解三个难题）

| 难题 | outcome-first 怎么解 |
|---|---|
| **确定性/多人** | 权威状态 = 整数胜负（规则+种子，lockstep 安全）；3D 翻牌纯表现、各端各演不影响结果 → **跨端浮点债不再卡 gameplay → 实时多人 + 多人干预可行** |
| **数据驱动** | 胜负 = 一条可填规则（favor + seed，最弱 LLM 能填）；翻牌 = `tween`（现成）；3D = 渲染后端解释 render 数据 → **零新 capability** |
| **3D 工程量** | 物理不决定 gameplay → **不必自研确定性 3D 物理引擎**（那才是"工程量很大"）；3D 只在表现层、可分档（§5.3） |

---

## 一、数据驱动自检（那把尺子：最弱 LLM 能否产出一模一样的东西？）

| 维度 | 结论 |
|---|---|
| 整局是数据吗？ | ✅ 胜负规则(favor/seed)、牌、对阵、经济表、改造配方、干预目录 = 填空式数据 |
| 解释器固定确定性吗？ | ✅ 胜负=整数规则 + 种子 PRNG（mulberry32）；3D 表现可非确定性（不进 hash、不回灌） |
| 需要新代码吗？ | ⚠️ **零新 capability**；仅 **render 层**：Three.js 渲染后端（=解释器，manifesto §2 允许）+ 少量 render-only 3D 组件（数据） |
| 游戏目录有 system 吗？ | ✅ 零。只有 `blueprint.ts`(数据装配) + `game-g.tsx`(挂载) + 测试（均既有债种） |

---

## 二、架构师评审（CORE RULE：先判该不该做）

| # | 子系统 | 裁决 | 依据 |
|---|---|---|---|
| 1 | 胜负（正/反面） | ♻️ **数据规则** | `decideFaceUp(favor, seed)`：属性加权确定性种子硬币（§4）。整数/PRNG，lockstep 安全 |
| 2 | 翻牌动画 | ♻️ **重组** | `tween` 把 `Transform.rotation` 缓动到既定面（0=正/π=反）。现成 Tier1 |
| 3 | 52 牌组 / 集材 / 改造 / 商城 | ♻️ **重组** | `card-pile`+`craft-recipe`+经济 banded `event-when`/`effect`（gameF/gameE 已证） |
| 4 | 数存活 / 判胜负 | ♻️ **重组** | `group-count` 数存活 → `flow` 终止判定（gameF 原样） |
| 5 | 干预（玩家改命） | ♻️ **数据** | 干预 = 改上游决策输入（favor 偏置/重翻/护盾），`clickable`/signal→`effect`。无新能力 |
| 6 | **3D 渲染** | 🔧 **render 层（解释器，合宪）** | Three.js 渲染后端 = 固定解释器（§2 神圣线允许的引擎码）；3D 物体 = render-only 数据组件。**非 capability、非 sim** |

### 回驳 / 不做（防过度设计）

| 编号 | 项 | 理由 | 替代 |
|---|---|---|---|
| **R-1** | ~~实时跨端**物理** lockstep~~ | 初版的"物理决定胜负"才需要它 → 已被 outcome-first 化解 | 多人 = **服务器权威**（server 跑确定性规则→广播整数胜负→client 演 3D）。§6 |
| **R-2** | 玩家间 **P2P 交易** | 后端市场服务（撮合/账本/反作弊），非游戏数据/capability | MVP NPC 庄家店；真 P2P = 未来 `services/net` |
| **R-3** | 自研**确定性 3D 物理引擎**（sim 内 3D 化） | 巨大 + 跨端浮点噩梦 + 与"胜负由规则定"矛盾（物理又变决定者） | 表现层 3D：L0 tween（已落）/ L1 现成物理库只跑表现（§5.3） |

---

## 三、核心循环

```
        ┌────────────────── 局外 META（≈ gameF 大厅）──────────────────┐
        │ 集材 → 改造牌组(craft：升 favor/换皮) → 商城(NPC) → 选阵出征   │
        └───────────────▲──────────────────────────────┬───────────────┘
                        │ 结算掉材                       │ 进入一局
        ┌───────────────┴──────────────────────────────▼───────────────┐
        │  局内 MATCH：一队牌各自掷命                                     │
        │  对每张牌 decideFaceUp(favor,seed)（规则先定胜负，确定性）        │
        │   → 3D 翻牌表现(tween 翻到既定面) → 数存活(group-count) → 胜负   │
        │  （穿插：玩家干预 = 改 favor/重翻，上游数据决策）                 │
        └────────────────────────────────────────────────────────────────┘
```

- **局内**：胜负是**先定的整数事实**；翻牌只是把它演出来。一局 = 一组牌掷命 + 存活/胜负统计（`flow`）。
- **局外**：gameF 大厅同款——改造（消素材升 favor/换皮）、商城（NPC 买卖）、出征（选阵/关卡表）。

---

## 四、胜负规则（v2 核心，已实现）

**`decideFaceUp(favor, rng) → boolean`**（`src/games/game-g/blueprint.ts`）：

- `P(正面=活) = clamp(favor / 100, 0.05, 0.95)`；用引擎 PRNG `nextRandom(RandomSeed)`（mulberry32，确定性）。
- **favor** = 牌的属性/局外升级偏置（数据，0..100）；越高越易活，但保留 5% 翻盘（赌感）。
- **确定性/可重放/多人一致**：同 `seed` + 同牌 → 同结果。`buildGameGDuel3D(cards, seed)` 按牌序逐张掷。
- **干预** = 改这条规则的**输入**：临时 +favor（祝福）/ −favor（诅咒）/ 重翻（再 roll 一次）/ 护盾（反面免死一次）——全是上游数据决策，不碰表现。
- **多人** = 服务器权威跑同一个 `decideFaceUp`（§6）。

> 这是"先定胜负"的决策函数。它是 v2 唯一的"规则代码"，小、纯、确定、可测；如需彻底零游戏码，未来可下沉成通用"加权种子掷"capability（YAGNI，暂不做）。

---

## 五、3D 表现层协议（**非常严谨的拓展** —— 用户点名）

> 红线：**3D 只活在表现层**。确定性 sim 不 3D 化、不做 3D 物理（R-3）。3D 物体 = render-only 数据（不进 hash、不被 Condition 读），由渲染后端（解释器）画。

### 5.1 渲染后端 = 解释器（引擎码，合宪）

`ThreeRenderer implements RendererBackend{init/sync/destroy}`（**`src/games/game-g/three-renderer.ts`**，gameG 自包含，已落地）。画 3D（与 `CanvasRenderer` 等价地位的后端，但属 gameG 专属表现层）。WebGL 仅 `init()` 创建（浏览器）；**刻意不进 renderer barrel** → 只 `game-g.tsx` 引用 → `three` 隔离在 game-g 懒加载 chunk（其它游戏 chunk 不变大、node 测试不加载）。**若将来多款 3D 游戏复用，再升回 `src/renderer/` 作通用引擎后端。**

### 5.2 "第一层对 3D 物体的表达" = render-only 组件（数据）

**最小落地（已实现）**：`Card3D{ frontTint, backTint, width, height }`（render 类）。牌的 3D 位姿**复用现有 `Transform`**：`x,y`→3D 位置、`rotation`→绕 X 轴翻面角（0=正面朝镜头/π=反面）。→ **翻牌 = 现成 `tween` 写 `Transform.rotation`，零新 capability、零改 tween/sim。**

**通用化提案（待真需要再加，YAGNI 守门）**：当出现多种 3D 物体（非卡牌）时，再加最小通用 render 词汇——按严谨原则：

| 提案组件 | 用途 | 严谨注记（加之前必满足） |
|---|---|---|
| `Transform3D{ x,y,z, rx,ry,rz }`（欧拉）或复用 Transform+z | 3D 位姿 | 与 2D `Transform` 关系要定清：建议 render-only、不与 sim Transform 混；或 sim 仍 2D、渲染器投影。**避免双份位姿真相** |
| `Mesh3D{ geometryKey, materialKey }`（assetKey） | 任意网格 | 走 R9 资产清单硬校验（防 AI 编造 key）；几何/材质=资产 |
| `Light{ kind, color, intensity }` / `Camera3D{ fov, ... }` | 光照/相机 | 单例/少量；缺省由渲染后端兜底，数据可覆盖 |

> **本阶段结论**：翻牌玩法用 `Card3D` 足矣，**不预先加** Transform3D/Mesh（过度设计风险）。等"局外展示 3D 牌组/场景"等真需求出现，再按上表最小加、审计、进 component-map 闭集。

### 5.3 物理观感分档（都在表现层、不碰 sim/多人；可分阶段升级）

| 档 | 做法 | 观感 | 工程量 |
|---|---|---|---|
| **L0（已落地）** | tween 把 `Transform.rotation` 翻到既定面（+空翻圈数、easeOut） | 动画感翻牌 | 小 |
| **L1（可选未来）** | 接现成 3D 物理库（cannon-es/rapier）**只跑表现**：真翻滚/碰撞，末端 nudge 到既定面 | 真物理感 | 中（集成现成库，**非自研**；非确定性、客户端、可换） |
| ~~L2~~ | 自研确定性 3D 物理进 sim | — | 巨大，**不做**（R-3） |

---

## 六、多人（outcome-first 让它重新可行）

- **服务器权威**：server 跑确定性 `decideFaceUp`（+ 种子）→ 广播**整数胜负**（每牌正/反）→ 各 client 用 3D 翻牌**演出**同一结果。
- **多人干预**：很多玩家提交干预命令（改 favor/重翻/护盾）→ server 按拍合入、重算确定性胜负 → 广播。命令总线 = `net/services` 基建（infra，非新游戏能力）。
- **关键**：物理翻牌是 client 表现，各端略不同也不影响胜负（如粒子特效）→ **跨端浮点债不卡 gameplay**。这正是初版回驳的实时多人（R-1）在 v2 下变可行的原因。

---

## 七、阶段路线

| 阶段 | 切片 | 新引擎面 |
|---|---|---|
| **MVP-0 ✅** | 3D 翻牌骨架（`ThreeRenderer`+`Card3D`+`buildGameG3DFlip`）+ 胜负规则 `decideFaceUp` + `buildGameGDuel3D`；headless 测（翻到既定面/规则确定性） | ThreeRenderer（render 后端）+ Card3D（render 组件）；**0 capability** |
| **MVP-1 ✅** | 一局收口（`buildGameGMatch`）：两队牌掷命 + `group-count` 数存活 + `Timer` 门(翻牌演完) + `event-when`(vsResource 比存活,edge) 判胜负 → `set-state` winner + 结算掉材 `mats`；`game-g.test.ts` +5 测全绿 | 0（gameF 重组；用 Timer-gated banded 代替 flow 机，单局更轻；多回合 run/round flow 留 Phase） |
| **Phase-2** | 局外：集材 / 改造(craft：升 favor/换皮) / NPC 商城 / 经济 | 0 |
| **Phase-3** | 干预系统（祝福/诅咒/重翻/护盾 = 改 favor 输入的数据目录）+ 牌组构建/羁绊 | 0 |
| **Phase-4** | 多人（服务器权威，§6）——**outcome-first 已扫清浮点障碍** | net/services 基建（非数据能力） |
| 表现升级 | L0 tween ✅ → L1 现成 3D 物理库（可选，看 playtest） | 0（集成现成库） |

---

## 八、数据 vs 代码占比（硬指标，manifesto §7）

| 产物 | 性质 |
|---|---|
| `blueprint.ts`（数据装配 + 胜负规则 helper）、牌表/经济/改造/干预目录 | **数据 + 一条小规则**（`.ts` 装配=既有债种） |
| `game-g.tsx`（挂载）、`three-renderer.ts`（渲染后端=解释器） | 表现/解释器层（既有债种 / 合宪引擎码） |
| 游戏专属 system | **零** |
| 新增 capability | **零**（3D = render 后端 + render 组件，非 capability） |

---

## 九、表现细节（不进 hash）

- 拟人牌：`Card3D` 正反两面（正面金 = 活、反面石板 = 死）；3D 薄盒，`Transform.rotation` 绕 X 轴翻。
- 翻牌 = `tween`（空翻 2 圈 + easeOut 落定）。落定特效/碰撞火花 = 未来粒子（表现层）。
- 2D HUD/商城可作 2D overlay 与 3D 场景共存（render 层分工）。

---

## 十、当前实现状态（headless 绿，3D 画面仅浏览器）

**目录（全部自包含于 `src/games/game-g/`，仿 gameF）**：
```
src/games/game-g/
├─ DESIGN.md          ← 本设计案（给策划/程序的单一真相）
├─ blueprint.ts       ← 数据装配 + 胜负规则(decideFaceUp/buildGameGMatch/Duel3D/3DFlip)
├─ three-renderer.ts  ← 3D 渲染后端(Three.js，gameG 专属表现层；浏览器入口引用)
├─ game-g.tsx         ← 挂载(launcher 卡带槽 mount→cleanup)：跑一局 + 3D 演出 + 胜负显示
├─ game-g.test.ts     ← headless 测(11)：3D 翻牌 / 胜负规则 / 一局收口
└─ index.ts           ← 对外导出
```
主页启动：`src/launcher.tsx` 已登记 Game G 条目（🎴 图标）→ 懒加载 `./games/game-g/game-g.js`。

- ✅ `decideFaceUp` / `buildGameGDuel3D` / `buildGameG3DFlip` / **`buildGameGMatch`（一局收口）**（blueprint）；`ThreeRenderer` / `Card3D`；`game-g.tsx`(挂载，跑一局) + launcher 图标接入。
- ✅ `game-g.test.ts`（11 测）：3D 翻牌（既定→翻到对的面/过程/确定性）+ 胜负规则（确定性/属性加权/按规则翻到既定面/复现）+ **一局（数存活=各队正面数 / 判胜负与规则回放一致 / 我胜掉材 / 演完才定 / 同 seed 逐拍 hash 一致）**。
- ✅ 全套 tsc + vitest(1170) + build 绿。**3D 画面需浏览器跑**（`npm run dev` → Game G）；本仓库既有"无真浏览器帧验证"债。

---

## 十一、演进史（教训留痕）

- **v0.1（物理决定胜负）**：曾下沉 `settle-read`（物理落定→离散结果）、`impulse`（接触→速度），做了 1v1 决斗 + RTS 接触掷命。
- **反转**：用户指出"不是物理决定胜负，是先定胜负、反推物理表现" + "3D 表现（不是 3A）"。
- **v2**：outcome-first + 3D 表现层。`settle-read`/`impulse`/旧 builder **已回退**（保引擎瘦；二者通用=掷币/骰子/击退，留 git 史，未来"物理真决定离散结果"的玩法可再起）。
- **教训**：下沉"物理↔逻辑的桥"前，先与用户确认**物理是否决定 gameplay**。outcome-first 往往更可控、更可多人。

> 复诵：**gameplay 是确定性数据，表现是 3D 演出，单向不回灌。** 代码只属于引擎那台固定的解释器（含渲染后端）；游戏只多数据。
