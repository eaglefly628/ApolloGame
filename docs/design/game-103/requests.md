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

## 分工小结（给 PE 的即刻队列）
- **PE ✅ 已修（2026-07-24）**：BUG-04（时停·根因=`engine.stop()` 从 listener 调被 loop 末尾 `rafId=RAF(loop)` 重挂覆盖→延 microtask 修·同修局终冻结）· BUG-01（世界空间地砖网格实体·随相机卷动）· BUG-03（撤 Launch/Steering 抵消→真飞穿透·干净往返=capgap）。16 测绿。
- **等引擎（Lead）**：BUG-02/05（群体分离 + 2D 批绘）——GD 已升级 `REQ-SURVIVOR群体`；PE 侧先降同屏 cap 缓解（后续）。
