# 雀宴 game-b · 数据驱动 / 积木库消费 review

> owner 2026-07-21 提问：「这个麻将游戏的数据驱动成分在哪里？多少用积木库、多少自己写？希望大多数来自积木库。」
> 追问：「能用积木就用·不能才写 TS——你写的这些 TS 真都不能用积木吗？有没有能形成基础积木的？」
> 本 review = PE-B 据真实代码（`games/game-b`·3617 行非测试）+ `game-skill-audit` + 引擎积木注册表 + 红线 grep 的证据化回答。数字口径以 git 现状为准。

## 0. 一句话结论

**表现层（UI/渲染/缩放/随机）= 100% 积木库，零手写逃生**。规则核**不是铁板一块**：真麻将规则（役/符/和了形）该自写；但**事件日志确是欠账·该下沉共享积木**（跨 game-b/game-c 重复造），**回合流程与引擎 `card-pile` 大面重叠**（被绕过·搬不搬是策略题）。**owner 追问是对的，初版把整个 core 判为"该自写"太宽松，已纠正。**

## 1. 从积木库拿了什么（消费·非自写）

| 积木库件 | 用途 | 证据 |
|---|---|---|
| `@ui/components`（LayoutNode 闭集） | **全部 UI**：牌桌/HUD/菜单/结算/日志/i18n | 10 处 import·128 节点全闭集（Panel/Label/Button/Tag/Image/Modal/Avatar·ProgressBar/fx）·**零 innerHTML/DOM** |
| `@engine/host/mount-host` | 定尺场景等比缩放（响应式「不乱位」） | 三分辨率目击相对位恒定 |
| `@atom-skills/random` | 洗牌/发牌/AI tiebreak 种子 PRNG | **零裸 `Math.random`**·同 seed 复现整局 |
| NIGHT 主题 token | 皮/取色 | `theme.ts` 纯数据令牌 |

**红线自检（grep 全绿）**：game-b 游戏代码里 `innerHTML|createElement|document.|Math.random|eval` = 0 命中（仅注释声明"禁裸随机"）。→ 表现层是宪法理想态。

## 2. 自己写了什么（游戏层代码·3617 行）

| 面 | 行数 | 性质 |
|---|---|---|
| **规则核** `core/*.ts` | ~1900 | 纯函数确定性解释器（详见 §3 分档） |
| UI 投影 `play-ui/menu/menu-settings` | ~670 | 代码把状态**投影成闭集 LayoutNode**（只吐积木库数据·无逃生） |
| 纯数据 `theme.ts`/`strings.ts` | ~334 | 主题令牌 + 日/中 i18n 字典 |
| 3D 氛围 `blueprint`+`acceptance-adapter`+`tiles` | ~330 | render-only 3D 场景 + 验收适配 |

## 3. 规则核逐档复核（owner 追问核心·分三档）

### 档 A · 真麻将专属·该自写 TS（保持·~1500 行）
`yaku.ts` 役种识别 / `fu-score.ts` 符算 / `hand-eval.ts` 和了形分解 / `calls.ts` 鸣牌合法 / `meld.ts` / `tiles-def.ts` 牌码 / 王牌·宝牌结构。
= 真规则逻辑，积木表达不了（硬做数据=虚胖数据·沉引擎=无脑加宽麻将专用件）。宪法尺子对**这些**成立。

### 档 B · 通用 + 已跨游戏重复 → **该下沉共享积木**（清晰欠账·初版漏判）
- **事件日志 `game-log.ts`**：引擎**无** log/journal 原子（`tier3/timeline` 是**演出**时序·非流水日志）；而 **game-b（`GameLog` 类）+ game-c（`game-log.ts`）两款各造一份**「带 seq 的类型化事件流·供显示/回放」。
- → 宪法 §2「真缺口·可复用」信号：**应下沉一个共享 `event-log`/`play-journal` 引擎原子，两款都消费**（~48 行 ×2 的 DRY 债）。**属主程域·PE 提 requests.md 报 Lead。**

### 档 C · 与既有 `card-pile` 大面重叠 → 战略取舍（owner/Lead 定夺·非急）
- 引擎 **`tier2/card-pile` 就是为「发牌→选牌→出/弃→补牌 全进 sim」造的**回合流程数据状态机（自述："回合流程下沉数据状态机 + lockstep 的共同前置"）。
- **game-b 的 `game-state.ts`（792 行）把这套写成了 sim 外独立 TS 状态机**（不进 World tick·靠 seed 回放而非 sim-hash lockstep）。
- 收敛到 card-pile = 把 game-b 核**搬进 ECS sim**（大改·换来 lockstep/sim 录放·当前只有 seed 复现）。TS 卡带式（现状）对复杂单机可接受，但确实绕过专用积木。**报 Lead + owner 拍板是否值得搬。**

## 4. 与「美术替换」的关系（owner 下一步）

美术已是数据：牌面/立绘 = PNG 资产（引路径）、皮 = 主题令牌 → **换美术 = 换资产文件/asset-index 条目，零改代码**。
**缺口（audit 🟡）**：game-b 资产**未登记美术台账/asset-index**（现本地 vendor 占位）。要让美术替换走统一资产管线（去背/授权/风格包），需补 game-b 美术台账（走 PA/asset-manager）。这是 art-replace 前置。

## 5. 建议动作

1. **下沉 `event-log` 共享原子**（game-b+game-c 共用）——PE 报 requests.md 给 Lead（档 B·清晰 DRY 欠账·低风险）。
2. **card-pile 收敛评估**——报 Lead/owner 拍板 game-b 核是否搬进 ECS sim（档 C·大改·策略题）。
3. **补 game-b 美术台账**——接资产管线，为美术替换铺路（走 PA）。
4. 档 A（麻将专属规则）保持 TS 不动。
