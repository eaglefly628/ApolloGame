# 引擎通用 · 数据驱动新手引导（Coachmark / Spotlight）能力 · 策划案

> 作者：design G（策划）｜ 2026-06-21 ｜ 提给：主程（Lead·引擎归主程）
> 宪法：`docs/design/data-driven-manifesto.md`｜规范：`CLAUDE.md`
> 上游需求（owner 2026-06-21 口述）：
> 1. **首次使用任何一个功能时**，自动弹出教学：**高亮那个框 + 指示你去点哪里**。
> 2. **不是 game-g 专属流程，而是整个引擎通用的、数据驱动的新手引导方式**——任何游戏、任何功能，只填数据，零手写 UI。

---

## 〇、一句话

> **新手引导 = 一张数据表（步骤/触发/锚点/文案），由引擎一台固定的 coachmark 渲染器解释。**
> 流程驱动**全用现有能力重组**（clickable / event-when / flag / flow / save）；只**下沉一个最小的 render-only 高亮渲染器**——因为"半透明遮罩 + 镂空指向某框 + 气泡"是表现层，手写它就是游戏代码、违宪。

---

## 一、数据驱动自检（那把尺子：最弱 LLM 能否产出一模一样的东西？）

| 维度 | 结论 |
|---|---|
| 一条引导是数据吗？ | ✅ 每步 = `{ id, trigger, anchor, text, advanceOn, once }` 填空式数据。最弱 LLM 照填即可 |
| 解释器固定确定性吗？ | ✅ 流程状态机（flow/flag）确定性、进 hash + 存档；高亮渲染是表现层（不进 hash、不回灌） |
| 需要新代码吗？ | ⚠️ **逻辑层零新增**（重组）；仅 **render 层**下沉一个通用 coachmark 渲染器（=解释器，manifesto §2 允许） |
| 游戏目录会出现手写 UI 吗？ | ❌ 不允许。引导数据进蓝图，遮罩/镂空/气泡由引擎渲染器画。游戏侧零 React/DOM |

**反例（违宪·必须杜绝）**：游戏侧写「画一个全屏黑遮罩、中间镂空成圆形对准那个按钮、再画个气泡」——那是代码不是数据（§6 尺子：最弱 LLM 写不出这段 sim/DOM）。正确写法见 §四。

---

## 二、架构师评审（CORE RULE：先判该不该做 · 分两层裁决）

| 子系统 | 裁决 | 依据 |
|---|---|---|
| **首次检测**（某功能第一次出现/被用） | ♻️ **重组·回驳新能力** | `Flag{seen_<feature>}` + `save`（world.snapshot 持久化）。"未 seen 且功能可见"= `EventWhen{when: and(not flag(seen_x), <feature 可见条件>)}` |
| **步骤序列 / 推进** | ♻️ **重组·回驳** | `GameFlow{states: coach_steps}`：每步 onEnter 亮高亮、transition `when` 命中即跳下一步。已有 round_flow 同款 |
| **"点对了才推进"** | ♻️ **重组·回驳** | `Clickable{action, onlyFlag:'step_i'}` → Signal → flow transition。点错的框无 onlyFlag 门、不响应 |
| **看过不再弹** | ♻️ **重组·回驳** | 步骤完成 `Effect{set-flag seen_x}`；存档保存 → 跨会话不再触发 |
| **高亮该框 + 遮罩 + 指向气泡** | 🔧 **真缺口·下沉**（render-only 解释器，合宪） | 现有组件无 overlay/spotlight/tooltip；无法优雅重组（Sprite 拼镂空遮罩=复杂且丑）。≥2 游戏（F+G）拉动 → 满足下沉 trigger |
| **锚点定位（指到某个具体 UI 元素）** | 🔧 **下沉·薄约定** | 统一 `data-anchor` 键（见 §四.3），让渲染器能找到 GameShell 与手写 DOM 两套 UI 的任意元素 |

### 回驳清单（防过度设计）

| 编号 | 项 | 理由 | 替代 |
|---|---|---|---|
| **R-1** | ~~新建"Tutorial 系统/能力"做流程~~ | 流程 = flow + flag + event-when + clickable + save 已能表达 → 再造是重复 | 用现有 5 件套接线（§四.1） |
| **R-2** | ~~每游戏手写 coachmark DOM~~ | 手写 UI = 游戏代码、违 §3 分层 | 下沉**一个**通用渲染器，全游戏共用 |
| **R-3** | ~~把高亮状态塞进 sim/hash~~ | 高亮是纯表现、各端可不同（同 outcome-first） | render-only 组件，不进 hash、不回灌 gameplay |
| **R-4** | ~~富文本/分支教学树/视频脚本~~ | YAGNI；首版只需"高亮+一句话+点击推进" | 文案=字符串数据；分支留待真需求 |

---

## 三、神圣的线（什么进引擎代码 / 什么是数据）

```
┌── 数据（游戏蓝图·最弱 LLM 可填·无限多）─────────────────────────┐
│  OnboardingFlow{ steps:[ {id, trigger, anchor, text, placement,   │
│                            advanceOn, once, gate} ] }             │
│  + 复用 Flag/EventWhen/Clickable/GameFlow 接线（已有数据形）       │
└──────────────────────────────────────────────────────────────────┘
                              │ 解释
┌── 代码（引擎·固定·确定性·只加这一次）──────────────────────────┐
│  ① Coachmark render-only 组件（POD 数据·不进 hash）               │
│  ② OnboardingOverlay 渲染器（遮罩+镂空+气泡·SVG/Canvas/DOM 三端） │
│  ③ anchor 解析（按 data-anchor 键定位目标 rect）                  │
│  ④ GameShell UINode 加 overlay/anchor 字段                         │
│  —— 逻辑层零新增（流程全用现有 capability）                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 四、能力设计（数据形 + 引擎触点）

### 4.1 流程层 = 现有能力重组（零新代码）

一条引导 = 一个 `GameFlow` + 若干 `Flag` + `EventWhen`/`Clickable`，全是已有数据形：

```jsonc
// 游戏蓝图数据（示意）—— 首启线性教学
GameFlow{
  id: 'onboarding',
  states: [
    { id: 'step_buy',
      onEnter: [ {kind:'set-flag', targetId:'coach_active', value:true} ],   // 亮高亮(见 4.2 coachmark 读 current)
      transitions: [ { when: signal('clicked_buy'), to:'step_deploy',
                       do:[ {kind:'set-flag', targetId:'seen_buy', value:true} ] } ] },
    { id: 'step_deploy',
      transitions: [ { when: signal('clicked_deploy'), to:'done',
                       do:[ {kind:'set-flag', targetId:'seen_deploy', value:true} ] } ] },
    { id: 'done', onEnter:[ {kind:'set-flag', targetId:'coach_active', value:false} ] }
  ]
}
// 首次检测（按功能·情境触发·非线性）：
EventWhen{ signal:'coach_buy', mode:'edge',
           when: and( not(flag('seen_buy')), flag('shop_open') ) }   // 第一次开商店才教买
```

- **首次检测**：`not(flag(seen_x))` + 功能可见条件。`seen_x` 由 `save`（world.snapshot）持久化 → 看过永不再弹。
- **两种形态同一套基元**：
  - **线性强制**（doc28 首启教学关）：一个 GameFlow 串起步骤、每步 gate 全屏。
  - **情境首触**（owner 主诉求："首次使用任何功能"）：每功能一条独立 `EventWhen{not seen_x ...}` → 触发自己的 coachmark、完成即 set seen_x。互不依赖、懒触发。

### 4.2 表现层 = 下沉一个 render-only 组件（真缺口）

```ts
// 引擎新增·POD·render-only·不进 hash·不被 Condition 读
interface Coachmark {
  type: 'Coachmark';
  anchor: string;                 // 目标 UI 元素的 data-anchor 键（§4.3）
  shape: 'rect' | 'circle';       // 镂空形
  pad?: number;                   // 镂空外扩像素
  dimColor?: number;              // 遮罩色 0xRRGGBB（缺省黑）
  dimAlpha?: number;              // 遮罩透明度 [0,1]（缺省 0.6）
  text: string;                   // 气泡文案（一句话）
  placement?: 'top'|'bottom'|'left'|'right'|'auto';  // 气泡相对锚点位置
  arrow?: boolean;                // 气泡指向箭头
  visibleWhen?: string;           // 绑定一个 flag（如 coach_active）/ 由当前 step 驱动可见
}
```

- **渲染器 `OnboardingOverlay`（=解释器·合宪）**：读当前激活的 Coachmark → 画「全屏 dim + 在 anchor rect 处镂空 + 气泡(text+arrow) 贴 placement」。三端各实现（DOM overlay / Canvas / SVG 出帧），同一份数据。
- **render-only**：它只**读** UI 几何（anchor rect）+ flag/step 决定可见；**绝不写 sim、不进 hash**（同 outcome-first：各端遮罩略不同不影响逻辑/多人）。

### 4.3 锚点寻址（统一两套 UI · 薄约定）

> 调研发现：现有有**两套 UI**——GameShell（数据描述 UINode，靠 Resource id/signal 寻址）与 game-g 手写 DOM 屏（靠 `data-act` 属性）。引导要能指向**任意一个**元素。

**统一约定 = `data-anchor="<key>"`**：
- **GameShell**：UINode 加可选 `anchor?: string` 字段，渲染时落成 `data-anchor` 属性。
- **手写 DOM 屏**（game-g lobby/battle）：在要被引导的元素上加 `data-anchor="buy_btn"`（与现有 `data-act` 并存，零重构）。
- **渲染器解析**：`root.querySelector('[data-anchor="'+key+'"]')` → 取 `getBoundingClientRect()` → 定位镂空与气泡。键是普通字符串 → **过弱-LLM 尺子**（数据只引用一个名字，不写坐标/代码）。

### 4.4 触发模型（覆盖 owner 主诉求"首次使用任何功能"）

| trigger | 含义 | 数据形（复用） |
|---|---|---|
| `firstVisible` | 该功能第一次出现在屏上 | `EventWhen{ when: and(not flag(seen_x), <anchor 可见/屏激活>) }` |
| `firstClickAttempt` | 第一次想点该功能 | `Clickable{action:'coach_x', onlyFlag:'!seen_x'}`（首点先教再放行） |
| `onSignal` | 由某游戏事件触发 | `EventWhen{ when: signal(...) }` |
| `gate` | 教学期间**只允许点高亮处** | 其它 `Clickable.onlyFlag = 'coach_idle'`（coach_active 时为假→不可点） |

---

## 五、为什么是"引擎通用"（不是 G 专属）

- 任何游戏只新增**数据**：一张 `OnboardingFlow` 步骤表 + 在被引导元素上标 `data-anchor`。**零游戏代码**。
- 同一台 `OnboardingOverlay` 渲染器 + `Coachmark` 组件服务全部游戏（A–H 及未来）。
- 两个现成拉动点直接受益、即为验收样例：
  - **game-g**：`doc28` 首启教学关（线性强制）+ owner 主诉求"首次用某功能即教"（情境首触）。把 doc28 §二的脚本改写成 `OnboardingFlow` 数据即可，删 game-g 侧任何手写引导。
  - **game-f**：`game-f-onboarding-spec.md` 的 10 步 coachmark（`OnboardingStep{id,scene,target,text,advanceOn}` 已是数据形）→ 直接映射到本能力，`target`→`anchor`、`advanceOn`→transition `when`。

---

## 六、确定性 / 多人（同 outcome-first）

- **进 hash + 存档**：`seen_x` flags、`GameFlow` current step = 逻辑状态，确定性、随 world.snapshot 存档 → 看过的引导跨端/跨会话一致不再弹。
- **不进 hash**：Coachmark 高亮/遮罩/气泡 = 纯表现，各端可不同（粒子级差异），不影响 gameplay/lockstep。
- 单机优先即可用；多人下 coachmark 是各 client 本地表现，天然不冲突。

---

## 七、最小下沉包（给主程 · 不阻塞其它）

1. **`Coachmark` render-only 组件**（`src/engine/protocol` render 域 + `src/skills` 渲染解释）—— POD，字段见 §4.2。
2. **`OnboardingOverlay` 渲染器**：DOM overlay 优先（覆盖现有 React/手写屏）；Canvas/SVG 出帧次之（headless 看帧验收）。
3. **anchor 解析**：`data-anchor` 查询 → rect → 镂空 + 气泡定位。
4. **GameShell `UINode` 扩** `anchor?: string`（落 `data-anchor`）。
5. **逻辑层零新增**——流程全用 flow/flag/event-when/clickable/save。

> 体积：小-中（一个 render 组件 + 一个表现渲染器 + 一个 DOM 查询 helper + GameShell 一字段）。**不碰 sim 结算、不碰多人**。

---

## 八、验收 / 测试

- **headless（逻辑层·可断言）**：构造 `not(seen_x)` → 触发 → flow 进 step → 模拟 `clicked_x` 信号 → 断言跳下一步 + `seen_x` 置真 + 存档后重载不再触发。**确定性 hash 一致**。
- **表现层（出帧）**：渲染器对给定 Coachmark + 锚点 rect 出一帧（SVG/Canvas），断言"遮罩存在 + 镂空框落在 anchor rect + 气泡在 placement 侧"。真实观感 owner 真机看（WebGL/DOM）。
- **回归**：seen flag 持久化（存档往返）；gate 期间非高亮 Clickable 不响应。

---

## 九、入池需求（REQ · 派主程）

> 见 `docs/workflow/requests.md` 新增 **REQ-ARCH-COACH**（引擎通用·框架级）。逻辑层标"重组·已覆盖、无需引擎"；仅表现层（Coachmark 组件 + OnboardingOverlay 渲染器 + anchor 解析 + GameShell anchor 字段）为真缺口请主程实现。

> 复诵：**引导是数据（步骤/锚点/文案），流程靠现有能力重组，只下沉一台通用高亮渲染器；高亮是表现、不回灌 gameplay。代码只属于引擎那台固定解释器；游戏只多一张引导数据表。**
