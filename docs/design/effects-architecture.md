# 特效架构 · 两个正交的特效库（owner 2026-06-27）

> 一句话：**UI 通用特效**（UI 元素的自我动画·CSS·LayoutNode 层）与 **战场/实体特效**（世界里生成的特效实体·render 组件层）是**两个正交的库**——各自闭集、各自防膨胀、**可叠加**。别混成一坨，也别每效一个布尔开关（恶性膨胀）。

## 0. 为什么是两个、为什么正交

owner：战斗要一堆特效。有的是 **UI 通用**（放缩/重点/受击闪/低血量呼吸），有的是 **游戏专属实体特效**（牌面爆炸/粒子/火花）。这两类沿三条轴正交：

| 轴 | 库 A·UI 特效 | 库 B·战场/实体特效 |
|---|---|---|
| 作用对象 | **UI 元素**（卡/血条/HUD·LayoutNode） | **世界实体**（粒子/爆炸/飘字·ECS 实体） |
| 表达机制 | **CSS 动画/滤镜/叠层** | **ECS prefab 生成 + tween + lifetime** |
| 归属 | 引擎 **UI 库**（通用·主程维护·游戏消费） | **游戏特效库**（内容=游戏层数据·机制=引擎现成能力） |

正交 = 互不依赖、各自演进；**可叠加** = 同一处可同时挂两层（见 §4）。

## 1. 库 A：UI 特效库（`LayoutNode.fx`）

- **是什么**：UI 元素的**自我动画**。`layout.fx: VisualEffect[]` —— **一个字段**表达一串特效（而非每效一个布尔旗标）。
- **闭集 kind**（`EffectKind`）：`pulse`(呼吸) / `float`(浮动) / `shake`(抖·intensity/once) / `pop`(弹) / `glow`(发光·color) / `sheen`(流光) / `flash`(闪色·color/once)。参数：`color`(语义色→主题令牌·闭集) / `ms` / `intensity` / `once`。
- **性质**：render-only CSS、**可叠加**（`fx:[{kind:'glow',color:'gold'},{kind:'shake'}]`）、**闭集受控合成**（校验器 `validate.ts` 把关 kind/color·防拼错/注入）、**可参数化**。
- **防膨胀铁律**：**新特效 = 加一个 `kind`（评审过的确定性 CSS），绝不再加布尔旗标。** 旧 `sheen?`/`glow?` 已并入 fx（保留作向后兼容别名）。
- **实现**：`src/ui/components/render.ts` `fxToCss`（kind→animation/filter/data-fx 叠层）+ `server.ts` 关键帧（`apollo-fx-shake`/`apollo-fx-flash` + 复用 `apollo-pulse/float/pop` + sheen sweep）+ `validate.ts` 闭集校验。验收 `ui-fx.test.ts`。
- **叠加约束（老实说）**：不同组自由组合（transform 动画 + filter 发光 + 叠层闪色）；同为 transform 的动作（float/shake/pop）同时只取一个即可（一个元素一个主要动作）。
- **典型战斗用途**：卡牌选中放缩、buff 发光、低血量呼吸、受击冒红（flash danger·once）、暴击闪白（flash white·once）、错误抖动（shake·once）。

## 2. 库 B：战场/实体特效库（prefab + caster + tween + lifetime）

- **是什么**：世界里**生成的特效实体**（粒子/爆炸/闪光/拖尾/飘字）。
- **机制已全在引擎现成能力里——零新系统**（CORE RULE：已覆盖→不加）：
  - `PrefabTemplate`：特效模板 = 数据（精灵 + Velocity + Tween 淡出 + Timer 寿命）。
  - `caster`：Signal/事件 → 从 `PrefabLibrary` 生成实例。
  - `tween`/`motion-apply`（飞/淡/缩）、`lifetime`（Timer 到期自毁）、`Timer`/`event-when`（触发）。
  - 参照活样例：`game-i/spawn-lab.ts`（`Timer(loop)→event-when→caster→prefab + Tween + lifetime`）、`combat-lab.ts`（命中/hitbox/DoT）。
- **游戏的「特效库」** = 一组 `PrefabTemplate` 数据（每个特效 = 现成能力的组合），**per-game**。**不是 N 个硬编码特效 system**。
- **性质**：在 sim/render 世界里、引擎渲染器画；游戏专属**内容**、通用**机制**。
- **典型战斗用途**：命中爆炸/火花、技能粒子、屏震（相机抖）、飘伤害字（Text 实体 + tween 上飘淡出）。

## 3. 正交 + 叠加（核心）

- **正交**：库 A 管「UI 元素怎么动」；库 B 管「世界里生成什么特效实体」。互不依赖、各自闭集、各自演进。
- **叠加**：一张牌被击中 →
  - 库 A：牌自己 `fx:[{kind:'shake',once:true},{kind:'flash',color:'danger',once:true}]`（抖 + 冒红）。
  - 库 B：同时在牌的世界位 `caster` 一个「爆炸」prefab（火花四溅 + 淡出自毁）。
  - 两层各管各、视觉**叠**出来 —— 这就是「战场特效库叠加在 UI 特效库之上」。

## 4. 组合点 / 未来 seam（暂不需要·需要时下沉）

- 库 B 的特效实体生成在**世界坐标**（战场实体所在）。若要把一个世界特效**锚到某个 UI 元素的屏幕位**（如在某 HUD 按钮上爆一下），是「UI↔世界锚」组合点。
- **现在不做**（YAGNI）。需要时作**一个通用 seam** 评审下沉（屏幕↔世界投影已有 `camera-view.screenToWorld`），**绝不每游戏手写**。

## 5. 治理（两库共用的防膨胀纲领）

1. **闭集优先**：能力是闭集词汇（kind 枚举 / 现成 capability），不是自由开关、不是 JSON 里写自由代码。
2. **先过尺子**（manifesto）：能重组现成？→重组（库 B 几乎都能）。已覆盖？→回驳。真缺口？→下沉成**一个**通用能力（库 A 加一个 kind / 引擎加一个 capability），**不是一堆旗标/system**。
3. **render-only 红线**：两库都纯表现，不进 lockstep hash（库 A=CSS；库 B 的纯特效实体不被 Condition 读、不进逻辑）。

## 6. 边界归属

- **库 A（UI fx）**：引擎 UI 库 `src/ui/components`，**主程维护**；游戏**消费** `fx` 数据。缺 kind → `requests.md` 提，主程评审后加（一个 kind，不是一个旗标）。
- **库 B 机制**：引擎现成能力（`prefab`/`caster`/`tween`/`lifetime`/`Timer`），**主程维护**。
- **库 B 内容**：`PrefabTemplate` 特效定义 = **游戏层数据**，游戏程序员写（如 game-z 的战场特效、game-g 的牌面 juice）。
