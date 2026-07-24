# game-103 · 开发整改 Review 清单（GD→PE · 2026-07-24）

> 依据：核心玩法符合度 review（`requests.md`）+ owner 试玩 5 bug + S4 验收门。**目标=从"能跑的壳"到"过 S4 + 好玩"。**
> 勾选制：每项列 做什么 / 为什么(gdd·门依据) / 归属 / 完成判据。**PE 从上往下做·P0 先。**

## 🔴 P0 — 不做就过不了 S4、也不好玩

### R1 · 落 acceptance-adapter + 跑验收剧本绿（S4 机器门的一半）
- [ ] 建 `src/games/game-103/acceptance-adapter.ts`（`createWorld/applySignal/readWorld`·**纯接线零规则**·照 `src/games/game-a/acceptance-adapter.ts` 样板）。
- [ ] 投影 6 键（README 表）：`hp/xp/level/clock/kills` res + `status` sv(GameFlow.current)；转发 `pick_<key>`/`restart`。
- [ ] `npx vite-node scripts/acceptance-run.mjs --game game-103` → **01–04 绿**（05 待 config）。
- 判据：`gate game-103 S4` 机器门 ≥3 剧本 conformance 绿。
- 依据：`acceptance/` 5 剧本（GD 已交）+ `playbooks/testing.md` REQ-ACCEPT。**PE 不改剧本·剧本错报 GD。**

### R2 · 进化系统落地（gdd §4.2 · 头号爽点 · 现完全缺失）
- [ ] 武器 lv5 且携带对应被动 → 触发进化替换（`t2-event-when` 条件门 → `t3-merge-rule`/prefab 换成进化体·Lead 已判"走重组"）。
- [ ] 5 进化体数据（gdd §4.2：万镖穿心/无限回环/恒星轨道/黑洞脉冲/死亡射线·质变 flag）。
- 判据：一条 build 满级+带钥匙被动 → 进化体上场、DPS 质变（2.5–4×）；补 `acceptance/06-evolve-*` 剧本（GD 随后补）。
- 依据：`gdd §4.2`·`capability-plan §4 E2`。**没它=不算幸存者。**

### R3 · 被动轴 modifier 桥（引擎·催 Lead·当前只 2 种被动效果）
- [ ] 催 `REQ-被动轴`（Lead 域）：`Stats.effective → Controllable.speed / 武器 Timer.duration / Shape.radius / Resource.max` 消费桥。
- [ ] 桥通后：接齐 gdd §五 9 被动（移速/攻速/范围/棱镜/磁石/经验加成），draft 池补全。
- 判据：三选一能选出 ≥6 种**不同效果**的被动；补"pick_blade→击杀更快"行为剧本。
- 依据：`gdd §五`·符合度 review「build 多样性≈0」。**引擎不通 PE 先接不了·先催。**

## 🟠 P1 — 好玩度与完整度

### R4 · 敌人补 3 型（gdd §六 · 现 4/7）
- [ ] 爆裂者（死亡自爆 AoE）· 精英（强化+掉宝箱）· 远程射手 E7（保持距离射弹·敌挂 `caster`+`launch`）。
- 判据：4 型 → 7 型上场；远程敌打破"纯近战被追"。

### R5 · 经验真曲线 + 回旋镖回旋段
- [ ] `LEVEL_XP` 占位 5 → 真曲线 `expToNext=5+lvl×10`（gdd §五）。
- [ ] 回旋镖往返时序（Timer 飞出→撤 Launch→切 Steering 拉回·或 capgap `Launch.bounce`）。

### R6 · 群体分离 + 2D 批绘（引擎·催 Lead）
- [ ] 催 `REQ-SURVIVOR群体`：steering separation / 2D collision 推开（敌环绕不叠点）+ 2D 批绘/实例化（overdraw）。
- [ ] PE 侧临时：降同屏 cap 缓解（已做 aeb9fd19）。
- 判据：数百敌不叠一点、不卡顿。

## 🟡 P2 — 后续里程碑（M3–M4）

- [ ] 弹射/诱饵武器（capgap `REQ-SURVIVOR武器缺口`·Lead triaged·M3 建）。
- [ ] 融合内容：地形障碍/可交互物/护甲蓝图 meta/击杀数通关双轨（`reference-solo-survivor-io.md`）。

## ⚙️ 环境阻塞（报主程·非 game-103 引起）

- [ ] **build 红**：`src/ui/vn/VNStage.tsx` TS7026（VN 待退役模块）阻全库 `npm run build` → **截图 harness / S8 终检都过不了**。报主程清（或排除 vn 于 build）。

---

## 完成度快照（对 owner）
- 现状：**S3 骨架人门 ✓ · S4 未过**（R1 未做 + 核心 R2/R3 缺）。板不全绿=只能说"做到 S3"。
- 过 S4 最短路径：**R1（adapter+剧本绿）+ R2（进化）** → 玩法门绿；R3 被动轴并行催 Lead。
- 变"好玩"：R2 进化 + R3 被动多样性 是分水岭。
