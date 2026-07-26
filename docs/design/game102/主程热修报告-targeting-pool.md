# Game102 主程热修报告 · 索敌 + 弹库队列（owner 授权 PE 自查·2026-07-26）

> owner 授权：「有什么 bug 自己改，然后出一份报告给主程让他热修。」
> 本报告 = PE 已在游戏层用现有能力尽力拼到的边界 + **两个真·引擎能力缺口**（游戏层拼不出·需主程下沉）。
> 现状：`node scripts/scoped-gate.mjs --run` 全绿（game102 scope）；核心视觉 bug（空中开火/位置不对应）已用收紧
> 半径 + FaceRotate 缓解，但**多层像素画（含小黄鸭 L1）当前不可通关**——卡在缺口 ①。

---

## 缺口 ① REQ-EXPOSURE-TARGETING — 暴露 / 垂直扫描线索敌（P0·挡通关）

### owner 定义的机制（core-gameplay §2）
色炮沿**固定周界轨道**绕像素画一圈；行经某条边时，向**画面内侧垂直方向**逐格扫描，命中该扫描线上
**第一颗暴露（邻空）的同色格**（预计算无 miss·从外向里逐层剥）。ammo 每命中一发 -1，打光即消失。

### 为什么游戏层拼不出（已试到的墙）
现有索敌 = `aggro`（Perception{targetTag, sightRadius} → Relation.target = 半径内**最近**同色）。它的模型是
「圆形半径内欧氏最近」，与机制要求的「沿边垂直扫描线上第一颗暴露同色」根本不同：

| 试法 | 结果 | 为什么错 |
|---|---|---|
| 放宽 sightRadius（盖住全板） | 内层能打到，但 **①炮进场滑行/转弯时就在空中开火 ②打的是最近对角格·非正对内侧格** | 半径是圆·不分「在边上正对」还是「斜下方」；不看暴露·直接穿层打里面 |
| 收紧 sightRadius（1.9×格·当前） | 空中开火/位置不对应消失（贴边才够到直邻外层格） | **周界轨道离深内层格恒远 → 内层永远够不到 → 多层图不可通关** |

半径无论松紧都无解：一个是「圆 vs 扫描线」形状错配，一个是「距离 vs 暴露」语义错配。
`game102.walkthrough.test.ts` 的「深内层够不到」用例已把此真相钉死为回归。

### 建议下沉的能力（二选一或组合）
- **A·垂直扫描线索敌 `ScanTarget`**：给沿 PathFollow 跑的实体一个 `ScanTarget{ axis: 'perp-to-path', maxDepth, targetTag, requireExposed:true }`
  —— 每 tick 按当前**路径切线的法向**（内侧）投一条格对齐扫描线，取线上第一颗 `targetTag` 且**邻空(暴露)**的格写进 Relation.target。
  暴露判定 = 该格四邻至少一格为空（可复用 overlap/邻格查询）。确定性：整数格坐标 + 排序遍历·零 trig。
- **B·预计算清除序 `SweepPlan`**：部署时按「炮色 + 当前板暴露态」一次算出这一圈会清掉的格序列（无 miss），
  逐 reload 拍消一格。更贴 owner「预计算无 miss」原话，但需要一个板级求解器 capability。

PE 倾向 **A**（增量小·复用 PathFollow 切线 + aggro 的 Relation 写法·可确定性化）；B 留作 owner/主程裁。

### 影响面
- 命中/扣弹/消除/计数链路（Hitbox / ResourceModify source / group-count）**已就绪且正确**，只等索敌换成暴露扫描线即可直接消费。
- 小黄鸭 L1 及一切含内层的图，落地此能力后才可通关。

---

## 缺口 ② REQ-POOL-ADVANCE — 弹库双排递进队列的运行时上浮（P1·体验）

### owner 定义
弹库双排；**只有前排（队首）可点部署**，后排候补；前排某门被部署消费后，后排对应位**自动上浮一格**补进前排。

### 游戏层拼到的边界
- ✅ 双排布局 + 策划序展开（`deployQueue`·rows:2·每排居中·已落地）。
- ✅ 每门独立 `Clickable`+`Caster`+ 自毁 Effect（点→上带色炮 + 消费本槽）。
- ❌ **上浮/头可点** 拼不出：需要在「前排门被消费」后**运行时重构后排门的组件**（改 Transform 位置 + 给后排门加/去 Clickable = 组件的增删改）。
  现有 `effect-apply` 只有 set-flag/modify-resource/set-state/set-sensor/set-visible/destroy/destroy-tagged/reset-timer——**没有「移动实体到新锚点」也没有「运行时增删组件（Clickable）」**的 kind。

### 建议下沉
- 一个**队列布局 capability `QueueSlots`**：声明 `{ slots: [pos...], headCount:N, memberTag }` —— 成员按入队序占位，
  仅前 headCount 个带可点性（其余 Clickable 被系统屏蔽/开启），成员销毁时后续**整体前移一位并重算可点性**。
  等价于把「补给罐递进」做成 tray 的镜像（tray 是「空槽吸纳」·此为「队列前移 + 头部激活」）。
- 若嫌重：给 `effect-apply` 加 `move-to`（改 Transform）+ `set-clickable`（开关可点）两个 kind，游戏层用 event-when 边沿自拼。

### 现状降级
当前**全排可点**（功能可用·无死件），仅缺「头可点 + 上浮」的约束感。owner 明确点过此 bug（「点第二排也能点」），
落地 ② 前无法根治——已如实告知 owner。

---

## 已在游戏层完成的修复（本次提交）
1. **空中开火/位置不对应** → 收紧 `sightFor = 1.9×格`（贴边直邻才够到外层格·进场滑行/转弯不误触）。**缓解非根治**（根治等缺口①）。
2. **转弯炮头朝向** → 炮身挂 `FaceRotate{source:'target'}`（render-only·复用 aggro 的 Relation·炮头指向所锁同色格≈画面内侧）。
3. **弹库单排堆五六个不合理** → `deployQueue` 改**恰双排**布局（perRow=ceil(len/2)·每排居中·策划序）。
4. 回归测记录真相（`game102.walkthrough.test.ts`「深内层够不到」用例钉死缺口①）。

> 待主程落缺口 ①（挡通关·P0）后，PE 立即把 `Perception`→`ScanTarget` 换线并复通小黄鸭 L1。
