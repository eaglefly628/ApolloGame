# game115《最后的火柴》· 能力总览 Capability Plan

> **模板**：`docs/design/capability-plan-template.md`（代码游戏·过审才动工）
> **立项卡**：[`brief.md`](./brief.md)
> **状态**：S2 初稿（2026-10-16）·待 Lead 签。**零新增引擎缺口**（`capability-gaps.json` = `[]`）。
> **实查口径**：§2 每个能力名已对 `src/assembly/capability-registry.gen.ts` 逐条核对存在；关键语义对 describe 原文核过：
> `t3-timeline`（cue 四闭集 signal/flag/resource/spawn·`timeline:done:<id>`）· `t3-flow`（`when` 读 Resource/Flag/State/Timer）·
> `t2-over-time`（每 period 改自身 resource）· `t2-clickable`（`onlyFlag` 相位门）· `t2-event-when`（条件树叶 = resource/flag/state，**不读 Signal**）·
> `t3-dialogue` · `t2-gauge` · `l7-vfx2d`（`stream`/`burst`/`trail`）。

---

## 1. 游戏一句话

你是卖火柴的小女孩手里的火柴：每根火柴是一条有限的火苗寿命，在它熄灭前照见幻象里「美丽的东西」、护住火苗不被风吹灭；7 个场景，同一核心动词，每章只换数据。

参照物：*The Little Prince: Across the Stars*（名著 × 安静留白 × 网页即玩）× 倒计时点选（无失败惩罚）。

## 2. 消费的引擎能力（✅ 全部现有）

| capability（注册名） | 用来做什么 |
|---|---|
| `t3-flow` | 章节相位：街角 → 擦亮 → 幻象 → 熄灭 → 下一章；`flame lte 0` 转「熄灭」 |
| `t3-timeline` | 每章演出 cue：擦亮火花 · 幻象淡入 · **寒风时刻表**（flag cue）· 终章整把火柴同燃 · 尾声 |
| `t2-over-time` | 火苗衰减：火柴实体 `OverTime{effects:[{resource:"flame",amountPerTick:-1,period:N,duration:∞}]}` |
| `f1-resource` | `flame`（火苗寿命）· `warmth`（她的暖意·只增）· `seen_count`（照见计数） |
| `f2-flag` | `flame.lit` · `gust.active` / `gust.check` · `seen.<chapter>.<item>`（相册收录） |
| `x3-string-variable` | 章节游标 · 当前幻象 id |
| `t2-clickable` | 擦火柴（火柴盒）· 照见热点（`onlyFlag:"flame.lit"`·火灭不可点）· 护火（`onlyFlag:"gust.active"`） |
| `t2-event-when` | 寒风结算：`and(gust.active, gust.check)` edge → `gust_hit`；火苗阈值 60/30/10 → 幻象变淡信号 |
| `t2-effect-apply` | 照见：`set-flag seen.*` + `modify-resource warmth/seen_count` + `destroy @signal-source`（热点只收一次）· 护火：`set-flag gust.active false` · 风害：`modify-resource flame` |
| `t2-keybind` | UI action（开始/继续/跳过演出/相册）→ Signal |
| `t3-dialogue` | 旁白与奶奶的话（原著文本改编·line 节点为主·无分支数值） |
| `t2-gauge` | 火苗条（可选·默认只靠画面亮度表达，条仅辅助功能模式显示） |
| `t1-tween` · `l5-camera` | 幻象淡入淡出 · 镜头缓推 |
| `l1-sprite` · `l2-color` · `h1-visibility` · `l6-text` | 场景/热点/幻象层投影 |
| `l7-vfx2d` | 火苗 `stream` · 擦亮 `burst` · 雪 `stream`（向下）· 烛光升星 `trail`（`NON_DETERMINISTIC`·纯表现） |
| `l4-sound` | 擦火柴 · 噼啪 · 风 · 钟声 |
| `w1-random` | 唯一随机源（雪粒等纯表现走 vfx 自身；sim 内首版无随机需求） |

### 2.1 共享模块（非注册 capability·不冒充）

| 模块 | 用途 |
|---|---|
| `services/save` · `services/persist` | 局外进度：已通章节 · 相册收录（`seen.*` 投影） |
| `engine/host`（`mountHost`/`createRunLoop`）· `net/host/queued-input` | 宿主骨架 · UI action 确定性入队 |
| `@ui/starters`（`buildStarterHome` / `buildStarterResult` / `buildStoryStarter`） | §4.6 |
| `src/skills/debug-trace.ts` | §5 trace 落点 |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| `CHAPTERS` | 7 场景：id · 背景 skinKey · 火苗寿命 · 衰减 period · 幻象层 · 旁白 DialogueScript 引用 | `t3-flow` + 装载期展开（§4②） |
| `VISION_ITEMS` | 每章「美丽的东西」：id · 热区矩形 · 暖意增量 · 相册文案 · 皮肤槽 | `t2-clickable` → `t2-effect-apply` |
| `GUSTS` | 每章寒风时刻表：起风 tick · 窗口长度 · 风害量 | `t3-timeline`（flag cue）+ `t2-event-when` + `t2-effect-apply` |
| `FADE_STEPS` | 火苗阈值 → 幻象透明度档（60/30/10） | `t2-event-when` → 表现层 tween |
| `NARRATION` | 原著改编旁白 · 奶奶的话 · 尾声（中/英） | `t3-dialogue` |
| `ALBUM` | 尾声相册：按 `seen.*` 列出她看到过的美丽东西 | LayoutNode `visibleWhen` 读 Flag |
| `UI_SCREENS` | 标题 · 章节过场 · 幻象 HUD · 相册 · 设置 | `mountUI` · `t2-keybind` |

**等价写法自证（防虚胖）**：
- 寒风判定 `event-when` 不读 Signal → 用两枚 Flag：timeline 在 `t` 置 `gust.active=true`，在 `t+窗口` 置 `gust.check=true`；`and(active,check)` edge → `gust_hit`；`t+窗口+1` 两旗复位。护火点击只清 `gust.active`。**零新件。**
- 热点不可重复收：`destroy @signal-source`，不写去重逻辑。
- 「火灭不可点」：`Clickable.onlyFlag:"flame.lit"`，flow 进「熄灭」态 `set-flag flame.lit false`。
- 终章「整把同燃」= 同一火柴模板 `spawn` 多根（timeline spawn cue），各自 `OverTime`，**不是新机制**。

## 4. 申请的游戏层代码例外

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| ① 宿主会话驱动 `game115.ts`：建 Engine · 读档 → 蓝图初值 · UI action → `QueuedInputSource` · 章节切换重装载 · 存档 | 宿主契约明许的 sim 外胶水（game112 例外② 同形） | ~150 | ⬜ | 非规则 |
| ② 装载期展开：`CHAPTERS`/`VISION_ITEMS`/`GUSTS` → 蓝图实体与 Timeline cues | 表展开 ≠ 解释器（game-103 `ringSpawnerEntities()` 先例） | ~100 | ⬜ | 无 |

**没有第三条**：不申请自写状态机 / 计时器 / 命中测试 / 手写 DOM。审计红旗零申报。

## 4.5 美术接入

| 视觉实体 | 槽 | 载体 |
|---|---|---|
| 场景背景 ×7 | `game115/scene/<chapterId>` | Sprite / `Panel.skin` |
| 幻象层（火炉/烤鹅/圣诞树/奶奶…） | `game115/vision/<chapterId>` | Sprite（高 zOrder·tween 透明度） |
| 照见热点物件 | `game115/item/<itemId>` | Sprite |
| 小女孩（剪影为主·3–4 姿态） | `game115/girl/<pose>` | Sprite |
| 火柴 · 火柴盒 | `game115/match` · `game115/matchbox` | Sprite |
| 相册卡 | `game115/album/<itemId>` | `Image` |

- 台账推导脚本：`scripts/game115-art-requirements.mjs`（照 `game-g-art-requirements.mjs` 样板·S3 落地）。
- 风格锚：2D 绘本 · 冷蓝雪夜 vs 暖橙火光 · 大面积留白；**只从原著文本出发，不借改编版造型**。不申请全程序化例外；S3 用成形矢量占位。

## 4.6 UI 呈现 · 华丽起手

- **house 主题**：`apolloOnyx`（深色·贴雪夜；暖色强调走主题 accent，不自写皮）。
- **起手包**：标题 `buildStarterHome`；尾声相册 `buildStarterResult`（`stars` 不用·本作不评星）；旁白 `buildStoryStarter`（`portrait` 用奶奶/剪影）。
- **成熟件**：`Particles`（雪·`sparkle` 环境微光）· `Image`（相册卡）· `sheen-hover` + `Panel.skin`（主 CTA）· `Toast`（「她看到了…」收录提示）· `Label.format`（照见计数）· `Modal`（跳过演出确认）。

## 4.65 对手/敌人 AI 设定

**无 AI**：没有对手、敌人或 NPC 决策；寒风是时间线编排（数据），不是决策者。

## 4.7 代码准入阶梯申报

| 规则 | 落级 | 说明 |
|---|---|---|
| 章节 / 热点 / 风表 / 旁白 / 相册 / 页面 | **L0** 纯数据 | 无 |
| 火苗衰减 · 熄灭转章 | **L1** `over-time` + `flow` | 无 |
| 照见收录 · 暖意 | **L1** `clickable` + `effect-apply` | 无 |
| 寒风护火 | **L1** `timeline` + `event-when` + `effect-apply` | 两旗写法见 §3 |
| 幻象变淡 | **L1** `event-when` 阈值 → tween | 无 |

无 L2/L3/L4。

## 5. 确定性声明

- 随机源：sim 内首版**无随机**（风表为编排数据）；如后续加随机风，走 `w1-random` + 章节 seed。
- 回放 / lockstep：不需要（单人叙事）；仍守确定性：同输入序列同结果（验收剧本可复现）。
- 纯表现：`l7-vfx2d`、tween、镜头不进 sim 判定。
- trace（`debug-trace`·opt-in）：`transition` 章节相位跳转 · `reject` 火灭/风窗外的点击被拒 · `commit` 照见收录 · `decision` 风害结算命中/护住。

## 6. 评审记录

- 提交人 / 日期：Claude（owner 立项指令）/ 2026-10-16
- Lead 裁决：⬜ 待签
