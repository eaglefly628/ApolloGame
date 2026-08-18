# game-103《幸存者》· 游戏级工单池（bug / 迭代）

### [2026-08-01] · Lead 终审发现 · **acceptance-adapter 从未落地**——5 份 GD 剧本无适配可跑·S4 门红 · status: 🔴 **in-progress（施工主体 = Lead 派工 agent·2026-08-18 本行即锁·连带 VBUG-02 撤回退真接 orbit）** · 优先级: P1
> 实证：`games/game-103/acceptance-adapter.ts` 无 git 历史（从未存在）；GD 已落 5 份剧本（e5c4bf536）。照 `docs/playbooks/testing.md` 验收剧本节落薄适配（createWorld/applySignal/readWorld=passthrough·纯接线零规则），落完 `npx vite-node scripts/acceptance-run.mjs --game game-103` 全绿再推。此红藏于慢车道多日=双车道「定期跑」未接线的实证（已修=巡检改跑完整网）。

> owner 试玩反馈驱动 · GD-103 triage（读源码定位根因·非施工）。游戏级工单随游戏走·不占引擎池槽（CLAUDE.md）。
> 状态：`open` / `in-progress` / `done`（附 commit）。归属：**PE**=游戏层（`games/game-103/`）；**引擎**=Lead 域（升级到 `docs/workflow/requests.md`）。

---

## owner 试玩 v1 反馈（2026-07-24 · "拖拉机/垃圾"·5 bug）

### BUG-01 · 无相对位移背景·看不清在动 · [P0·PE] · ✅ done（PE·世界空间地砖网格）
- **现象**：移动时没参照物，玩家像没动。
- **根因**（GD 读码）：`game-103.ts:20 FIELD_BG` = **静态 CSS 网格**（`radial-gradient`+`repeating-linear-gradient` 贴宿主 div），**不随相机卷动**。相机跟随玩家（Camera.offset）、世界实体在动，但这层网格屏幕固定 → 玩家居中看着静止。
- **修向（PE）**：把地面网格/地砖做进**世界空间**——用渲染器已支持的 **Tilemap 世界地砖**（`canvas-renderer.ts:180` 已有 tilemap 绘制）铺一张够大的重复地砖（或世界坐标重复 ground sprite），随相机卷动 → 相对位移立现。CSS 宿主背景仅留作视口兜底。

### BUG-02 · 敌人重合成一点 + Overdraw 卡顿 · [P0·引擎] · **①群体分离 ✅ done（Lead 2026-07-24）·②2D批绘 → P3D**
- **现象**：敌人接近时挤成一点、严重 overdraw、卡顿；owner 指名"该用 Instanced Draw"。
- **根因**（GD 读码·**真引擎缺口**）：① `t2-steering` **只有 seek/flee·无 separation/避让** → 全体朝玩家同一点挤 = 重合（BUG-05 同根）。② `CanvasRenderer` 逐实体 `ctx.drawImage`·**2D 无批绘/实例化** → 百敌=百 draw call。
- **①群体分离 ✅ 已建（Lead 2026-07-24·`REQ-SURVIVOR群体`①归档）**：`t2-steering` 加加性 `separation?:{radius,weight,tagMask?}`——seek 时 `queryRange` 取半径内同群邻居→线性衰减斥力叠加转向→clamp。**PE 接线**：敌 `Steering` 加 `separation:{radius:~28, weight:~1.5, tagMask:敌 tag}` → 敌群互斥环绕、不叠一点（可撤 stopRange=18 缓解 hack、回真贴身）。
- **②2D 批绘/实例化 → P3D**：`REQ-3D-RENDER-EFFICIENCY`（`requests-3d.md`·P1·owner 优先）。PE 侧同屏 cap（spawn-director）继续缓解 overdraw、待 P3D 批渲根治。
- **PE 缓解已上（2026-07-24·纯数据·非根治）**：① 敌 `Steering.stopRange` 0→18（贴身即停=**环绕玩家成圈**而非全叠一点·接触伤害照常）；② 降同屏数量（开局圈 22→16·加压流 150→90/慢一倍）减 overdraw。真解（boid separation 敌间互斥 + 2D 批绘）仍等 Lead/P3D，`steering.ts` 现只有 seek/flee、`src/skills`/`src/renderer` 非 PE 域不碰。

### BUG-03 · 回旋镖武器停在原地 · [P1·PE] · ✅ done（PE·撤 Steering 抵消·真飞穿透；干净往返段=capgap 待 Lead）
- **现象**：boomerang 不飞出/返回。
- **根因**（GD 读码）：`blueprint.ts:59-68` 弹体**同时挂** `Launch{toward:'target'敌}` + `Steering{seek 玩家}`——两者每 tick 都写 `Velocity`、**方向相反 → 抵消停原地**；注释设想的"Launch 飞出→self-remove→steering 拉回"**时序未实现**（Launch 不自除、两组件并存打架）。`Perception.sightRadius:0` 也可能取不到玩家目标。
- **修向（PE）**：真做"往返"时序——Launch 定时飞出（`Timer` 到点）→ 撤 Launch、切 Steering seek 玩家拉回（或用一个带 return 段的弹道）。若现有能力表达不了干净往返，走 capgap（弹道 out-return 段）。

### BUG-04 · 升级时敌人仍在 tick·未时停 · [P0·PE] · ✅ done（PE·根因=stop() 被 loop 重挂覆盖·延 microtask 修）
- **现象**：升级三选一弹出时，敌人仍在动，应时停待选完再继续。
- **根因**（GD 读码）：时停**已写**（`game-103.ts openLevelUp→sim.engine.stop()`·`onPick→engine.start()`），但 owner 报无效。疑点：① `engine.stop()` 是否真 halt 了 update 循环（还是只停渲染/RAF、fixed-step 仍跑）？② `offers.length===0` 早退路径（全满级）→ 不 stop 也不弹窗、继续 tick。
- **修向（PE）**：核 `engine.stop()` 语义确保 update 循环停；若 stop 只停渲染，改用 time-scale=0 / 门控 tick（showingLevelUp 时 dt=0）。补测：升级弹窗期间敌人 Transform 不变。

### BUG-05 · 敌人 follow 最近路径挤成一点 · [P0·引擎] · =BUG-02 群体分离根
- 同 BUG-02 ① 根：缺群体分离/局部避让。**原生幸存者做法**=boid separation（邻居斥力）或软碰撞推开，让敌群**环绕**玩家而非叠一点。→ 升级 Lead（`REQ-SURVIVOR群体`）。

---

## owner 试玩 v2 反馈（2026-07-24 · 5 项）

### VBUG-01 · Lv8 就没敌人了·应无限流 + 难度递增 · [P0·PE] · ✅ done
- 现象：打完一批敌人、Lv8 就结束；理论上无限流、敌人越来越多、越来越硬（一发打不死）。
- 修（PE·纯数据）：① 有限生怪表→**跟随玩家的环形 spawner**（Timer loop 永不停=无限·`ringSpawnerEntities`）；② **同屏 cap**（`GroupCount` 计活敌 → spawner `whenGlobal` 门 `enemies_alive<48`·无限但有界·防实体爆炸/卡顿）；③ **难度分层**（疾行者 25s / 胖子 55s 后经 `SelfRule.whenGlobal` clock 门加入·胖子 hp90=飞镖 7-8 发才死）。

### VBUG-02 · 护盾不绕我转 · [P1·引擎] · 🔴 **回退（PE 接线撞调度环·回报 Lead 补 orbit-motion 定序）**
- **⚠ PE 接线撞墙（2026-07-24·回报 Lead）**：`t2-orbit-motion` 只声明 `runsAfter:['motion-apply']`。本游戏把它与 `hierarchy-cascade`+`camera-follow`（都读改写 Transform）一起装载 → 调度器**硬成环**（"Circular dependency detected among systems: …motion-apply, hierarchy-cascade, …, orbit-motion, …"）→ 蓝图无法 load。**首个真消费者暴露 orbit-motion 定序不全**。裁向（Lead）：给 orbit-motion 补定序（如 `runsBefore:['camera-follow','hierarchy-cascade']` 或明确 phase）使其能与标准 motion/hierarchy/camera 栈共存。PE 暂回退静态环（Hierarchy child·仍造伤·绕转待补定序）。20 测绿。
- 现象：护盾环光球是静态的、不绕玩家旋转。
- 根因（**引擎缺口**）：`hierarchy-resolve.ts:23` 明写「子本地偏移**不随父旋转旋转**（避免 sin/cos）」；`rotation-apply` 只转朝向不移位。真·圆周运动 = `pos=center+r·(cos,sin)`·需 sin/cos·sim 禁（确定性）。→ PE 表达不了。
- **✅ Lead 裁决 + 施工（2026-07-24·裁向②）**：下沉 **`t2-orbit-motion`**（`src/skills/tier2/orbit-motion.ts`·已建+测+登记 registry）——`Orbit{centerId?,radius,dirX,dirY,cosStep,sinStep}` 绕 centerId(缺省原点) 匀速环绕·每 tick 写 Transform.x/y。**运行时零 sin/cos**（rotor 状态 dirX/dirY + 常量步 cosStep/sinStep 旋量乘 + sqrt 归一防漂移·确定性 lockstep 安全；四 trig 常量=数据·`orbitAt` authoring 期一次性算）。10 测（半径守恒/双球对位/跟随移动圆心/确定性/orbitAt）。裁向① hierarchy 旋转子偏移=否（会给核心 hierarchy 加每 tick sin/cos·orbit-motion 用常量 rotor 绕开·更干净）。
- **PE 接线**：护盾环光球 child 换成挂 `Orbit`（`orbitAt(radius, startAngle, angularStep, 'player')` 生成数据·多球用相位差 startAngle）——静态环 → 真绕转。造伤 Hitbox 随 Transform 走·环绕位置即命中位置。

### VBUG-03 · 敌人无头顶血条·看不出打了多少伤害 · [P0·PE] · ✅ done
- 修（PE）：敌 prefab 加**头顶 `Gauge`（绑 hp·`fromParent`）** → 受击即缩短=伤害反馈可见。

### VBUG-04 · 全程仍没有背景 · [P0·PE] · ✅ done
- 修（PE·v2⑤）：世界空间 faint 点太淡→改**贯穿全场的网格线**（长细 box·横竖各一组·世界坐标）→ 相机跟随时线条卷动=清晰地面参照/相对位移。

> v2 PE 三项（VBUG-01/03/04）✅ 已修·19 测绿；VBUG-02（护盾旋转）=引擎 sin/cos 缺口·已报 capgap 等 Lead。

## 核心玩法符合度 Review（GD·2026-07-24·vs gdd 核心设定）

> 判：**核心循环骨架满足；Roguelite 深度内核不满足**——两根支柱塌了（进化 + 被动多样性），当前=「能跑但不够好玩的割草壳」。

| 玩法要素（gdd） | 当前实现 | 判定 |
|---|---|---|
| 核心循环 走位/自动攻击/杀→经验/升级三选一/结算 | 全通（draft-offer 接线·活满 15:00 胜 / HP0 败） | ✅ 满足 |
| 武器 8（5 核+3 融合） | 6 射法 straight/nova/beam/boomerang/orbit/pet | ⚠ 缺弹射/诱饵（M3·capgap）；回旋镖回旋段待 capgap |
| **进化系统（gdd §4.2 头号爽点）** | **完全未实现**（blueprint:14 自认"进化未接"·grep 零) | ❌❌ **核心缺失** |
| **被动 9（build 多样性核心）** | 只 4 条·**只 2 种效果（伤害%×2 / 回血×2）** | ❌ 移速/攻速/范围/棱镜/磁石/经验加成 全缺（卡引擎 modifier 桥 REQ-被动轴）→ build 多样性≈0 |
| 敌人 7（E1-E7） | 4：蹒跚/疾行/胖子/Boss | ⚠ 缺爆裂/精英/远程射手 |
| 波次结构 15min 结构化+精英节点 | 无限流 escalation + 周期 Boss（owner v2 改） | ⚠ 差异（owner-driven·非 bug） |
| 经验曲线 expToNext=5+lvl×10 | LEVEL_XP=5 平（M2 占位） | ⚠ 占位 |
| HUD/三选一/结算 | LayoutNode·check-ui 门过 | ✅ |

**根因分层（诚实）**：进化未做=PE 排期（E2 判"重组"但没落地·且未当核心爽点对待）；被动瘫=**引擎缺口**（REQ-被动轴 modifier 桥未下沉·移速/攻速/范围类游戏层表达不了）。后者印证"通用税+引擎首趟此品类"——卡牌引擎轻松的属性叠加，在实时属性轴上卡住了引擎桥。

**要"好玩"必补（优先级）**：① **P0 进化系统**（E2 重组落地·头号爽点）② **P0 被动轴 modifier 桥**（REQ-被动轴·Lead·解锁 build 多样性）③ P1 敌人补 3 型 + 经验真曲线 ④ P1 群体/性能（REQ-SURVIVOR群体）。

## 分工小结（给 PE 的即刻队列）
- **PE ✅ 已修（2026-07-24）**：BUG-04（时停·根因=`engine.stop()` 从 listener 调被 loop 末尾 `rafId=RAF(loop)` 重挂覆盖→延 microtask 修·同修局终冻结）· BUG-01（世界空间地砖网格实体·随相机卷动）· BUG-03（撤 Launch/Steering 抵消→真飞穿透·干净往返=capgap）。16 测绿。
- **引擎已交付（Lead 2026-07-24·PE 即刻接数据·PE 两处回报已修）**：**①群体分离**=`t2-steering.separation{radius,weight,tagMask?}`（敌挂→环绕不叠一点）· **护盾绕转**=`t2-orbit-motion`（护盾挂 `Orbit`/`orbitAt('player')`→真绕转）。
>   - **↳ 回 PE 报#1（orbit 装一起拓扑成环 load 不了·20 测红）**：真定序缺陷·已修——`t2-orbit-motion` 补 `phase: PostResolve` + `runsAfter:['motion-apply','hierarchy-resolve']`（orbit=RMW Transform·本质「基于已解算再定位」同 hierarchy 跟随·落 PostResolve→自动排在 motion/camera-follow 后、bounds-clamp 前=无环）；加回归测（与 motion/hierarchy-resolve/hierarchy-cascade/camera-follow/bounds-clamp 同装可 tick 不抛）。**PE 可撤回退、真接 orbit。**
>   - **↳ 回 PE 报#2（separation 代码没进来·grep 空）**：属实·**我的锅**——separation 首提 `67de3897` 被并发提交 `d47ee942`（PE 加 Boss·从旧基 combat.ts 覆盖）回退掉、我后续 orbit 提交没察觉。**2026-07-24 已重贴恢复**（combat.ts `Steering.separation` + steering.ts applySeparation + 6 测·门禁全绿）。**PE 现可 grep 到、真接 separation。**
> **仍等**：②2D 批绘=P3D `REQ-3D-RENDER-EFFICIENCY`（owner 优先）· 被动 Stats 桥=`REQ-SURVIVOR被动轴`（owner 排期 **R3** 建·stat-bind spec 已备）· 弹射/诱饵/pull=`REQ-SURVIVOR武器缺口`（M3 triaged）。

## owner 试玩 v3 反馈（2026-07-25 · 经 PE-101 session 转录·待 GD-103/PE-103 triage 施工）

> owner 在别的 session 报的 7 条·转录到此归队。**多数已在册**（下方标对应）；真新增 2 条（RBUG-04/05）。**归属=game-103 线（PE-103/GD-103），非 PE-101 域。**

### RBUG-01 · 子弹不朝要攻击的敌人 + 无旋转 · [P1] · 部分已在册
- **现象**：发出的子弹不朝目标敌人飞；子弹不旋转/不朝向。
- **triage**：① 朝目标=`Launch toward:'target'` 靠 `Perception` 索敌·无目标那刻冻结 → **已在册 `REQ-SURVIVOR被动轴` 的 Launch `fallbackDir`**（引擎·owner 已排 R3）。② 无旋转/朝向=弹体缺 `t2-facing`（sprite 朝速度方向）→ **PE 可接**（游戏层数据·非引擎缺口）。

### RBUG-02 · 10 级封顶不再升级 + 敌人无更强威胁 · [P1] · 已在册
- **现象**：升到 10 级后不再升级；敌人也没变更强。
- **triage**：LEVEL_XP=5 占位（Review 已记「经验曲线占位」）+ 难度 scaling 缺 → **PE 排期**：经验真曲线（无上限）+ 敌人随时间/等级加压。对应 Review「P1 经验真曲线 + 敌人补 3 型」。

### RBUG-03 · 升级曲线奇怪·经验值需规定·太快到 10 级然后无事可干 · [P1] · 已在册（同 RBUG-02 根）
- **triage**：`balance-design.md` 定真经验曲线（expToNext 递增）+ 掉落经验值分档 → **PE game-layer**（纯数据）。

### RBUG-04 · 敌人掉的经验都一样大小·应按价值掉不同大小 · [P2·新] · PE game-layer
- **现象**：所有经验宝石一样大。**应**：小怪掉小经验、精英/Boss 掉大经验（大小/颜色分档）。
- **triage**：经验宝石 prefab 按 xp 值分档（`Shape` 尺寸/`Color` 分级·或多模板）→ **PE 纯数据/render**（无引擎缺口）。

### RBUG-05 · 被打中无反馈效果 · [P2·新] · 可特效实现（非纯美术）
- **现象**：玩家被击中时没有任何视觉反馈。
- **triage**：**能用引擎 VFX 闭集做**（非只靠美术）——受击 `VisualEffect{kind:'flash'/'shake'}`（红闪+抖屏）+ 可选 `Particles`。owner 归为"美术的事"，但基座 EffectKind 闭集已可表达 → **PE 接线**（rendering-fx.md）。

### RBUG-06 · 有些效果能否用特效实现 · [P2·新·泛] · 复用 VFX 闭集
- **triage**：受击/暴击/拾取/升级/进化等强调统一走基座 `VisualEffect`（pulse/float/shake/pop/glow/flash）+ `Particles` → **PE 逐点接**（缺 kind 才报 requests）。

### RBUG-07 · P3D 已做的 2D 渲染优化没接进来·以产生更多敌人 · [P1] · 已在册（引擎/P3D）
- **triage**：**已在册 BUG-02② → `requests-3d.md REQ-3D-RENDER-EFFICIENCY`**（2D 批绘/实例化·owner 优先·P3D 域）。落地后同屏敌数上限可大幅抬高。PE 侧 spawn cap 现为缓解。

> **归属提示（PE-101 转录）**：以上 7 条均属 game-103 线。RBUG-01②/02/03/04/05/06 = PE-103 游戏层可做；RBUG-01①/07 = 引擎/P3D（已在册·已排期）。**建议由 game-103 session 施工**（该线正活跃·PE-101 跨改会撞车）。

---

## 壳件迁移 + 未报备游戏层代码销账（Lead 2026-07-29 派单）

### REQ-103-壳件迁移 · 换用引擎公共壳三件（host-runloop / game-art-load / local-store） · [2026-07-29] · Lead 派单（引擎池 `REQ-SHELL-公共壳三件` 已落地）→ **指派：PE-103** · status: open · 类型: 壳层去重（render-only·观感零变化）
> **件已在库**（带测·引擎侧同日落地）：`@engine/host/run-loop.js` `createRunLoop` · `@assets/index.js` `createArtAssets`/`loadGameArtInto` · `@services/persist/index.js` `localStore`/`jsonCodec`/`insertRanked`。
> **本游戏替换点**（file:line = 2026-07-29 基线）：
> - `game-103.ts:157-186`（refreshHud 的 lastSig 差分 + 局终首见门 `showingResult` + 记成绩 + `pauseSim()`）+ `199-238`（startSim/stopSim/restart）→ 一个 `createRunLoop`：`over: st => st.status !== 'playing'`、`onOver` 里记成绩并**就地把 board/rank 挂回 state**（本件把同一个 state 对象交给随后的 paint，故结算字段不会丢）、`overlay` 缺省不用（103 的结算是同一 hudUi 换树 → 走 `paint` 即可）、`reset` 收 restart 的那堆局内态清零（连杀窗/成就横幅/draft/榜展示态）。
> - `game-103.ts:93-96` 的 `pauseSim()`（BUG-04 microtask 兜法）**可整段删**——本件冻结默认就走 `queueMicrotask`，同一坑已内建（时停 `openLevelUp` 用的那处若仍需手动暂停，保留一个私有 pauseSim 或改调 `loop.session` 的引擎面）。
> - `game-103.ts:188-197`（皮肤索引 fetch）→ `const skinAssets = createArtAssets(); void loadGameArtInto(skinAssets, 'game-103');`
> - `achievements.ts:38-54`（`game103-ach-v1` 解锁集）→ `localStore<string[]>('game103-ach-v1', () => [], jsonCodec(数组校验))`（Set ⇄ 数组转换留在游戏层一行）。
> - `leaderboard.ts:17-22 recordScore` → `insertRanked(entry, prev, cmp, BOARD_MAX)`（同语义·同名次口径）；`24-40`（`game103-leaderboard-v1` 读写）→ `localStore<ScoreEntry[]>(…, () => [], jsonCodec(条目校验))`。
> **验收**：观感/交互零变化 + game-103 vitest 绿 + `node scripts/scoped-gate.mjs --run`。红线：不碰 sim/蓝图/hash 面，不趁迁移调数值。

### REQ-103-未报备代码销账 · achievements.ts + leaderboard.ts 94 行 · [2026-07-29] · Lead 记账（图纸 ④）→ **指派：PE-103（补 plan）** · status: open · 类型: 治理欠账（capability-plan 偏差）
> **事实**：`games/game-103/achievements.ts`（54 行）+ `leaderboard.ts`（40 行）= **94 行游戏层代码，capability-plan 未报备**（plan §4 只裁了 E1–E4 编排三处，成就/排行榜两块从未进过例外表）。且二者与引擎既有件**功能重叠**：成就解锁/统计 = `services/platform` 的 `AchievementSync`+`ACHIEVEMENTS`+`PlatformPort.unlockAchievement/setStat`；排行榜上传 = `PlatformPort.uploadLeaderboard`；本地持久化 = 新落地的 `services/persist`。
> **要求（两步·随上面的迁移单一起做完）**：
> 1. **补 plan §4 条目**：在 `docs/design/game-103/capability-plan.md §4` 表后加一行例外记账（"E5 成就/本地榜 = 局外壳层表现件"），写清**为何当时没走 AchievementSync/PlatformPort**（可能的正当理由：无平台壳时的纯本地展示层），交 Lead 复裁。
> 2. **随迁移消解**：持久化那半（`achievements.ts:38-54`+`leaderboard.ts:24-40`）改用 `services/persist`；判定/排序那半（`newlyUnlocked`/`recordScore`）——**排序并入 `insertRanked`**；`ACHIEVEMENTS` 阈值表 + `newlyUnlocked` 若与 `services/platform` 的 `AchievementSync` 语义等价则改接端口（`NullPlatformPort` 下自动静默降级=现有纯本地行为），**不等价再回报 Lead 留作已报备的游戏层例外**。
> **红线**：这是治理欠账不是功能单——**不许借机加成就/改阈值**；消解后 plan 与实现零偏差，`node scripts/game-skill-audit.mjs game-103` 保持零红旗。

### REQ-103-测速 · game-103.test.ts 14.5s/37 测=快车道最慢件 · [2026-08-03] · Lead 巡检发现（REQ-RETRO2 施工回执带出）→ **指派：PE-103** · status: open · 优先级: P3 · 类型: 测试性能优化（PE 域·非功能）
> **背景**：`games/game-103/game-103.test.ts` 现耗时 14.5s/37 例，是快车道全套里最慢的单文件，拖慢日常 `scoped-gate` 单游戏面反馈环。
> **修法方向**：排查是否每例都重新起一遍完整引擎/世界（`createWorld`+装配整套蓝图），若是→改共享 world 搭建（`beforeAll`/`beforeEach` 复用已装配好的骨架，各例只重置需要变化的那部分状态）+ 减少重复引擎起动开销；避免不必要的真实 tick 循环跑满整局。
> **验收**：37 例断言语义不变（零回归）；耗时显著下降；`node scripts/scoped-gate.mjs --run`（game-103 面）绿。
