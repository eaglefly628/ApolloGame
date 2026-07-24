# game-103《幸存者》· 游戏级工单池（bug / 迭代）

> owner 试玩反馈驱动 · GD-103 triage（读源码定位根因·非施工）。游戏级工单随游戏走·不占引擎池槽（CLAUDE.md）。
> 状态：`open` / `in-progress` / `done`（附 commit）。归属：**PE**=游戏层（`src/games/game-103/`）；**引擎**=Lead 域（升级到 `docs/workflow/requests.md`）。

---

## owner 试玩 v1 反馈（2026-07-24 · "拖拉机/垃圾"·5 bug）

### BUG-01 · 无相对位移背景·看不清在动 · [P0·PE] · ✅ done（PE·世界空间地砖网格）
- **现象**：移动时没参照物，玩家像没动。
- **根因**（GD 读码）：`game-103.ts:20 FIELD_BG` = **静态 CSS 网格**（`radial-gradient`+`repeating-linear-gradient` 贴宿主 div），**不随相机卷动**。相机跟随玩家（Camera.offset）、世界实体在动，但这层网格屏幕固定 → 玩家居中看着静止。
- **修向（PE）**：把地面网格/地砖做进**世界空间**——用渲染器已支持的 **Tilemap 世界地砖**（`canvas-renderer.ts:180` 已有 tilemap 绘制）铺一张够大的重复地砖（或世界坐标重复 ground sprite），随相机卷动 → 相对位移立现。CSS 宿主背景仅留作视口兜底。

### BUG-02 · 敌人重合成一点 + Overdraw 卡顿 · [P0·引擎] · open→升级 Lead
- **现象**：敌人接近时挤成一点、严重 overdraw、卡顿；owner 指名"该用 Instanced Draw"。
- **根因**（GD 读码·**真引擎缺口**）：① `t2-steering` **只有 seek/flee·无 separation/避让**（`steering.ts:42`）→ 全体朝玩家同一点挤 = 重合（BUG-05 同根）；且 2D 只有 `collision-resolve-3d`·**无 2D 推开**。② `CanvasRenderer` 逐实体 `ctx.drawImage`（`canvas-renderer.ts:153`）·**2D 无批绘/实例化**（实例化只在 3D 渲染器/P3D 域）→ 百敌=百 draw call。
- **修向**：**升级 Lead**（引擎域·见 `requests.md REQ-SURVIVOR群体`）——群体分离 capability + 2D 批绘/实例化路径。PE 侧临时可减同屏 cap（spawn-director）缓解，非根治。
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

### VBUG-02 · 护盾不绕我转 · [P1·引擎] · 🔴 engine-blocked（capgap）
- 现象：护盾环光球是静态的、不绕玩家旋转。
- 根因（**引擎缺口**）：`hierarchy-resolve.ts:23` 明写「子本地偏移**不随父旋转旋转**（避免 sin/cos·后续刚体阶段补）」；`rotation-apply` 只把 angular 累加到 `Transform.rotation`（转朝向）、**不移动位置**。真·圆周运动 = `pos=center+r·(cos,sin)`·需 sin/cos·**sim 禁**（确定性）。→ PE 表达不了。
- 裁向（Lead）：① hierarchy 补「本地偏移随父 rotation 旋转」（刚体阶段·`hierarchy-resolve` TODO 明写）→ 旋转 hub + 环上 child 即绕转；② 或下沉 `orbit-motion` 薄件（确定性增量旋转·免每 tick sin/cos）。**已并进 capgap**（`.apollo/cap-gaps.jsonl` + 下方 REQ 备注）。PE 侧先留静态护盾（仍造伤·观感待旋转）。

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
- **等引擎（Lead）**：BUG-02/05（群体分离 + 2D 批绘）——GD 已升级 `REQ-SURVIVOR群体`；PE 侧先降同屏 cap 缓解（后续）。
