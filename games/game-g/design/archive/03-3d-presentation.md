# 03 · 3D 表现层协议（严谨拓展）

> 承 `00` §二.6。**红线：3D 只活在表现层**。确定性 sim 不 3D 化、不做 3D 物理（R-3）。3D 物体 = render-only 数据（不进 hash、不被 Condition 读），由渲染后端（解释器）画。
> 实现参考：`../three-renderer.ts`、`../game-g.tsx`，组件定义 `src/engine/protocol/components/render.ts` 的 `Card3D`。

---

## 一、渲染后端 = 解释器（引擎码，合宪）

`ThreeRenderer implements RendererBackend{init/sync/destroy}`（`../three-renderer.ts`，gameG 自包含，已落地）：

- 与 `CanvasRenderer` 等价地位的**渲染后端**，但属 gameG 专属表现层。
- WebGL 仅 `init()` 在浏览器创建；**刻意不进 renderer barrel** → 只 `game-g.tsx` 引用 → `three` 隔离在 game-g **懒加载 chunk**（其它游戏 chunk 不变大、node 测试不加载 three）。
- 实测：game-g chunk ≈ 503kB（含 three），独立懒载，主包不受影响。
- **若将来多款 3D 游戏复用**，再升回 `src/renderer/` 作通用引擎后端（YAGNI，现在不做）。

---

## 二、"第一层对 3D 物体的表达" = render-only 组件（数据）

**最小落地（已实现）**：`Card3D{ frontTint, backTint, width, height }`（render 类组件）。

- 牌的 3D 位姿**复用现有 `Transform`**：`x,y`→3D 位置、`rotation`→绕 X 轴翻面角（0 = 正面朝镜头 / π = 反面）。
- → **翻牌 = 现成 `tween` 写 `Transform.rotation`，零新 capability、零改 tween/sim。**

**通用化提案（待真需要再加，YAGNI 守门）**——当出现多种 3D 物体（非卡牌）时，再加最小通用 render 词汇：

| 提案组件 | 用途 | 加之前必满足 |
|---|---|---|
| `Transform3D{x,y,z,rx,ry,rz}` 或复用 Transform+z | 3D 位姿 | 与 2D `Transform` 关系定清：建议 render-only、不与 sim Transform 混；**避免双份位姿真相** |
| `Mesh3D{geometryKey, materialKey}` | 任意网格 | 走 R9 资产清单硬校验（防 AI 编造 key）|
| `Light{kind,color,intensity}` / `Camera3D{fov,...}` | 光照/相机 | 单例/少量；缺省由后端兜底，数据可覆盖 |

> **本阶段结论**：翻牌玩法用 `Card3D` 足矣，**不预先加** Transform3D/Mesh（过度设计风险）。等"局外展示 3D 牌组/场景"等真需求出现，再按上表最小加、审计、进 component-map 闭集。

---

## 三、物理观感分档（都在表现层、不碰 sim/多人；可分阶段升级）

| 档 | 做法 | 观感 | 工程量 |
|---|---|---|---|
| **L0（已落地）** | tween 把 `Transform.rotation` 翻到既定面（+空翻圈数、easeOut）| 动画感翻牌 | 小 |
| **L1（可选未来）** | 接现成 3D 物理库（cannon-es/rapier）**只跑表现**：真翻滚/碰撞，末端 nudge 到既定面 | 真物理感 | 中（集成现成库，**非自研**；非确定性、客户端、可换）|
| ~~L2~~ | 自研确定性 3D 物理进 sim | — | 巨大，**不做**（R-3）|

---

## 四、表现细节（不进 hash）

- 拟人牌：`Card3D` 正反两面（正面金 = 活、反面石板 = 死）；3D 薄盒，`Transform.rotation` 绕 X 轴翻。
- 翻牌 = `tween`（空翻 2 圈 + easeOut 落定）。落定特效/碰撞火花 = 未来粒子（表现层）。
- **2D HUD / 商城** 可作 2D overlay 与 3D 场景共存（render 层分工）。

> 复诵：3D 是"演胜负"，不是"算胜负"。任何 3D 物理观感升级都不得回灌 gameplay、不得进 hash。
