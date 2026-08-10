# game211 · 物理对决交接单（PE-211 → 新 session）

> 立于 2026-08-10 · 分支 `claude/mainbranch` · 交接人 PE-211
> **读这份之前先读**：`CLAUDE.md`（分支/缺口裁决/收工律）· `games/game211/design/capability-plan.md`（本游戏能力总览·§0 记着 owner 的 B 判词）
> **改代码之前必读**：`games/game211/duel-spike.ts` 的**文件头注**（6 条踩过的坑 + 每个魔数为什么是这个值）。头注是本项目最贵的一份文档，全部由实测事故换来。

---

## §0 一句话现状

**「两张刚体命牌对向抛出 → 半空对撞 → 翻滚落地 → 朝上的面定生死」这个表现已经做出来并调通了**（owner 已认可方向）。
下一步是把它放大成 **360 人的大地图小队遭遇原型**——调度器已经写好且测过，**剩下的是消费方（渲染 + 行军 + 接线）没写**。

---

## §1 怎么把它跑起来（照做即可·别自己猜）

```bash
git checkout claude/mainbranch     # ⚠ 只有这条分支上有 game211。master 落后 3000+ 提交、根本没有 games/game211
npm ci
npm run dev                        # 或 npm run build && npm run preview
```

浏览器打开启动器 → 选 **game211（翻命扑克）** → 大厅顶部页签条里的 **「🧪 原型开发」** → 试验台整屏加载。
深链旁路（省去点大厅）：`?game=game211&spike=duel`。

无头截图 / 回归目击：

```bash
npm run build && SHOOT_QUERY='&spike=duel' node scripts/shoot-game.mjs game211 /tmp/dsp.png
```

试验台面板里有：组数切换 `1 / 3 / 5 / 10 / 20 / 40 / 60`、「再抛一次」、以及四个验收读数（见 §4）。
每次抛完 console 还会打四行 `[dsp/fair] [dsp/cost] [dsp/hit] [game211/duel-spike]` —— **调参时看 console，比看画面准**。

---

## §2 已经做完的（含实测数据·可直接引用）

| 项 | 状态 | 实测口径 |
|---|---|---|
| 物理线选型 | ✅ owner 判 **B = 真 cannon-es 3D 物理**（接受非确定性） | 见 capability-plan §0 |
| 牌的形状（矩形扑克牌 + 永不立起） | ✅ 靠 P3D 交付的 `Mesh3D.faceAxis` 解锁 | 未躺平 **0/2**，连测三轮全 0；20 组 0/40 |
| 一对一空中对撞 | ✅ `throwPlan` 单一真相 + 8 条不变量测试 | 相遇 **20/20 组** |
| 落面公平性 | ✅ | **正面朝上 ~55%**（目标 50%±15） |
| 并发压测 | ✅ 1→60 组可切 + 帧耗时读数 | 60 组=120 刚体·未躺平 1~2 |
| cannon 承载力基准 | ✅ `scripts/cannon-army-bench.mjs`（纯 `world.step`·node 侧） | 72 体 **2.9~3.3ms** · 100 体 **4.8ms**（p95 6.3~7.3）· 150 体 **7.7~8.1ms** |
| 小队遭遇调度器 | ✅ 纯函数 + 17 例测试 | `duel-scheduler.ts` |
| 引擎缺口 | ✅ `REQ-3D-CARD-FACE-AXIS` 已提→P3D 已交付→我已消费验收（回执在 `docs/workflow/requests-3d.md`） | |

---

## §3 代码地图

| 文件 | 是什么 | 能不能单测 |
|---|---|---|
| `games/game211/duel-spike.ts` | **主交付**。试验台：建场、抛牌、读朝向、判生死、HUD、压测档、耗时采样 | 纯函数部分导出了：`judgeDuel` `upYOf` `tallyOf` `layoutFor` `throwPlan` `isHit` `metCounts` `frontRate` `flightTime` `flipPhaseSpanHalfTurns` |
| `games/game211/duel-spike.test.ts` | 28 例。钉死上面所有纯函数 + **回归护栏**（每条护栏都对应一次真事故） | ✅ |
| `games/game211/duel-scheduler.ts` | **小队遭遇调度**：错峰闸 + 并发闸 + 一队一战 + 互免。纯函数·不碰世界 | ✅ |
| `games/game211/duel-scheduler.test.ts` | 17 例。含刚体预算护栏（216 体正是要拦的） | ✅ |
| `scripts/cannon-army-bench.mjs` | node 侧纯 `world.step` 基准（冲锋 / 稳态肉搏两模式） | 跑一下就有数 |
| `games/game211/design/capability-plan.md` | **门禁产物**。§0 owner 的 B 判词 · §0.1b 混合 LOD 设计 · §0.2 v1 接线表 · §0.3 三个 v2 缺口 | — |
| `games/game211/game211.tsx` | 大厅/流程宿主。`showDuelSpike()` 挂试验台；`?spike=duel` 深链 | — |
| `games/game211/lobby-dd.ts` / `lobby-types.ts` | 「🧪 原型开发」页签 + `onSpike` 回调 | — |

**注意分工边界**：`src/renderer/three-*`、`src/renderer/three/**`、`games/game-z/**` 是 **P3D 专属域**，本 session 不改，缺件走 `docs/workflow/requests-3d.md` 报单（`REQ-3D-CARD-FACE-AXIS` 就是这么走通的）。

---

## §4 验收口径（改任何参数都要重量这四个）

试验台面板上就是这四行，console 也打：

1. **空中相遇 N / M 组** —— 必须 = 组数。判据帧率无关：`Δx` 变号（必然经过 Δx=0）或 `|Δx|min ≤ 2R`。
2. **未躺平 N / M 张** —— `|upY| < 0.7` 即没躺平。目标 0（60 组允许 1~2）。
3. **正面朝上 N/M = P%** —— 目标 **~50%**（owner「一半正一半反」）。
4. **帧 Xms (p95 Yms) · 刚体 N · Zms/刚体** —— p95 >16.7 转红。

> ⚠ **「中心靠得近」≠「碰撞体接触」**。曾经仪表报「相遇 20/20」而物理上一次都没碰到（owner：「抛出力度和角度都 OK，但空中没有碰撞」），因为两牌垂直差 0.26 而碰撞盘各只有 0.05 半厚。**判据必须按碰撞体真实尺寸算。**

---

## §5 参数现值与调整边界（改之前先看这张表）

| 常量 | 现值 | 边界 / 为什么 |
|---|---|---|
| `CARD_W/H/T` | 1.55 / 2.15 / 0.085 | **别按组数缩牌**。缩牌会让碰撞盘退化成方块（引擎把盘厚钳到 `max(0.1,h)`，半高恒 0.05 不随缩放），「圆盘立不住」的性质直接失效。多组要看清就**拉远镜头**（`layoutFor` 已这么做·`scale ≡ 1` 由测试钉死）。 |
| `Y_STAGGER` | 0.05 | **必须 < 2×0.05 = 0.1**（两盘合厚），否则牌从对方上方掠过。旧值 0.26 = 「空中没有碰撞」的真因，测试⑦钉死。 |
| `Z_SPREAD` | 0.82 | 必须 `hypot(Y_STAGGER, Z_SPREAD) < 1.2R`。给撞击横向分量，让两牌撞完往两侧分开落地。测试④⑧钉死。 |
| `CARD_RESTITUTION` | 0.34 | 别调高到 0.5+：两牌会**弹回原处**叠在一起，未躺平反而恶化（1/2 → 2/2 实测）。分离靠偏心擦碰，不靠回弹。 |
| `friction` | 0.45 | 别调高。0.72 试过：未躺平 3/40 → **8/40**——高摩擦让牌**卡在倾斜姿态里不倒**。已回退。 |
| `SPIN_FLIP_MIN/MAX` | **7 / 18**（2026-08-10 owner「太强了一点点」从 9/24 收） | 下限不能再降：最慢的牌也要转过 ≥1 个半圈，否则慢牌恒正面落地。相位跨度 ≥1 半圈由测试钉死（`flipPhaseSpanHalfTurns`）。**每张牌独立随机**——镜像会让一对的结果相关。 |
| `SPIN_SELF` | 4 | 纯观感（绕牌面法线·不改变正反）。 |
| `LANE_SPAN` | 3.2 | 别加宽（4.4 试过，配合高摩擦一起恶化）。 |
| `GRAVITY` | 20 | 抛高 `vy ∈ [12.4, 13.6]`、`tMeet ≈ 0.85×vy/g` → 撞在滞空顶点附近，看得见也测得准。 |

---

## §6 待办（按优先级·**第 3 条是阻塞项**）

### 1) 360 人大地图原型（owner 明确要的下一步·主体工作量）

owner 原话：大平板地图；每队 **36 人排成阵列**；红蓝各 **5 个小队** → **360** 个单位；以小队为单位做**群组自由运动**；两队距离够近时打一场 **36:36 抛牌对决**；打完**互相免疫**、继续运动。

已经备好的地基：

* **调度**：`duel-scheduler.ts` 直接用。`planDuelStarts(state, cfg)` 返回本 tick 该开哪几对 pairKey。
  `DEFAULT_SCHEDULER = { maxConcurrent: 2, startGapTicks: 45, maxStartsPerTick: 1 }` —— 这就是 owner 要的「不要互相同时开始」。
  并发 2 不是拍脑袋：`safeMaxConcurrent(36, 150) === 2`，因为 3 对 = **216 刚体 ≈ 15ms+**，物理单项吃光整帧。
* **对决本身**：`duel-spike.ts` 的抛掷/判定逻辑可复用（**36:36 = 72 刚体/对**，正好在实测 2.9~3.3ms 档）。

**还没写的**：

* **行军单位的渲染** —— owner 指定「非刚体、Instance 方法渲染」。行军中的 360 个单位**不是刚体**（sim 侧只有 Transform + 群组转向），只有进入对决的那 72 张才生成真刚体。参考 `src/renderer/webgl/`（`drawArraysInstanced` 原型·1000 精灵 1 次 draw）与 three 侧按材质签名合批的 `InstancedMesh`。**动之前先读 `docs/playbooks/index.md` 找对应生产线手册**。
* **群组运动（flocking）** —— 5v5 小队各自成组移动、互相接近。查 `wiki/skills/index.md` 有没有现成 capability，**查得到的用现成的，查不到走 requests.md 报单，绝不自造**（这是硬规矩）。
* **接线** —— 每 tick 算小队间距 → 填 `SchedulerState.candidates` → `planDuelStarts` → 对返回的每个 pairKey 生成 72 张牌跑对决 → 落定后销毁刚体、`immune.add(pairKey)`、`lastStartTick = tick`。
* **⚠ 开工前**：新玩法要先更新 `games/game211/design/capability-plan.md`（能力总览铁律：plan 未过审不写游戏层 system 代码），并跑 `node scripts/game-skill-audit.mjs game211` 体检。

### 2) 扑克牌贴图（owner 要的·还没做）

红牌贴红色扑克牌贴图、蓝牌贴**黑色**扑克牌贴图。
现在是纯色 tint：`FRONT_TINT = { a: 0xd2453c, b: 0x3d6fd0 }`（正面=阵营色=活）、`DEATH_TINT = 0x5b6068`（反面=双方同一个灰=死）、`EDGE_TINT = 0x2a2e34`。
**语义别改**：死就是死、不分敌我（这是 owner 纠正过一次的）。
走资产管线：`assets/index.json` 是单一真相，贴图要填 `usage`/`colorSpace`，然后接到 `Material3D`。可以直接派 **`asset-manager` 子代理**做。

### 3) 🔴 审计裁决（阻塞门禁·**不可自行解决**）

`node scripts/game-skill-audit.mjs game211` 现在是 `AUDIT: FAIL` + `RATCHET: FAIL`：

```
game211: 裸Math.random×8 · innerHTML×29 · createElement×34 · React屏×1
新游戏带红旗即 FAIL——豁免不自写基线
```

**⚠ 2026-08-10 复查更正（原文写「全部是 fork 存量」，差 3 处·已核实）**：逐文件对 game-g 数过之后，口径是——

| 指标 | game211 | game-g 基线 | 差 |
|---|---|---|---|
| 裸 Math.random | 8 | 8 | 0 → **全继承** |
| innerHTML | 29 | 29 | 0 → **全继承** |
| React 屏 | 1 | 1 | 0 → **全继承** |
| createElement | **34** | **31** | **+3 → 是本原型新写的** |

那 3 处新增在 `duel-spike.ts:224/226/229`（wrapper / stage / uiHost 三个挂载脚手架 div，即 §8 坑②③④ 对应的那段）。**不是存量**。

裸随机与 innerHTML 确实全部继承：`duel-spike.ts` / `duel-scheduler.ts` 里出现的 `Math.random` 只在注释里、写的正是「禁用它」，实际走引擎种子 PRNG（`RandomSeed` + `nextRandom`）。8 处裸随机全在局外元层：卦象、抽卡、生肖、战斗种子、UI 延时、增益洗牌、牌组 id、Boss 抽取。

**这条更正会改变裁决**：「给 game211 和 game-g 同等豁免」若按 game-g 字面计数写（createElement **31**），**门禁仍然红**——实测 34。裁 A 必须写 34 且给那 3 处单独具名批注。

工单：**`REQ-3D-G211-HARDLINE`**（`docs/workflow/requests-3d.md`·P1）的 ① 已完成 → 池子建在 **`docs/design/game211/requests.md`**，裁决细节（A/B/C 三条路 + 先查留痕 + Lead 推荐 A）全在那条 **`REQ-G211-HARDLINE`** 里，**别在本文件重复维护**。

**红线：豁免不得自写基线**（`audit-baseline.json` 的 `_doc` 明文·点名过历史自写事故）。三条路都要先拿裁决。

---

## §7 门禁（推之前必跑·退出码核对）

```bash
node scripts/scoped-gate.mjs --run           # 按改动面缩范围：单游戏 → 该游戏 vitest + tsc + build
node scripts/game-skill-audit.mjs game211    # 见 §6-3，目前红着且不是你的锅
npx vitest run games/game211/duel-spike.test.ts games/game211/duel-scheduler.test.ts
```

* **别用管道吞退出码**（`vitest | grep` 会吃掉失败码）。
* 推送：`claude/mainbranch` 直推不开 PR，每次 `fetch → rebase → push -u origin claude/mainbranch`。
* 共享工作树：提交前 `git status` 只提自己的文件，**绝不 stash / 挪动别人在途的改动**。

---

## §8 几条不要复踩的（头注里有全量·这里挑最贵的）

1. **重掷必须换实体 id** —— `PhysicsSystem` 只在 `!bodies.has(id)` 时建刚体。复用 id ⇒ 旧刚体赖着不走、新初速不施加。**地台/围栏重建同理**（`arenaGen` 后缀就是为这个；忘了会导致「多组乱飞」——牌生在上一档的墙体内部被弹开）。
2. **叠加层根节点用 bare `Panel`，不能用 `Screen`** —— `Screen.bg` 缺省铺主题底色，会把 3D canvas 整块盖黑。
3. **`stage` 别用 `position:absolute;inset:0`** —— 容器未定位时塌成 0 高 ⇒ canvas 不可见 ⇒ 渲染器不画 ⇒ 物理也不步进。
4. **HUD 宿主别铺满 + `pointer-events:none`** —— 那一步一旦没命中就成透明挡板，点击全被 canvas 吃掉（Playwright 实证 `<canvas> intercepts pointer events`）。现在贴角、自身可点。
5. **`upYOf` 的公式必须跟着 `faceAxis` 走** —— 法线 +Z 时是 `2(yz−xw)`，+Y 时是 `1−2(x²+z²)`。用错的后果实测过：HUD 判「双方都反面」，画面却一灰一蓝。
6. **别信「我觉得改好了」** —— 本文件里每条护栏测试背后都是一次实测事故。改完**跑一遍、读 console 四行数据**再说。
