# Game F · 新手引导（FTUE）策划案

> Designer F ｜ 2026-06-17 ｜ owner 要：第一次玩的人点「确定/开始」时，若是新手 → 弹页面 + **一步步手把手引导**怎么打第一局。
> 与「教程页」分工：**教程页**（`game-f-tutorial.html`）= 一眼看懂全局（静态）；**新手引导**（本案）= 首玩**分步手把手**（交互、gate 进度）。二者配合：先看一眼总览，再手把手实战。
> ⛔ 数据驱动：引导步骤 = 扁平数据；coach 解释器 = 薄确定性函数。表现层 DOM（game-f 已是手写 DOM HUD）。倾向零引擎。

---

## 〇、目标
新玩家第一次进入 → **30 秒看懂在玩什么 + 手把手走完第一局的关键动作**（组牌→买将→布阵→装备→开战→锦囊→结算→养成），无挫败、可跳过、可重看。

## 一、触发与判定（account 层）
- 持久 flag **`onboarding_done`**（localStorage，account 层，与现有 collection/段位同管道）。
- **首次进入**（flag 未置）→ 点「确定/开始」时自动触发引导。
- **老手**（flag 已置）→ 不弹；但 **设置/帮助** 永远有「重看教程」「重玩引导」入口（教程页那个按钮 + 本引导）。
- 可中途「跳过引导」→ 置 flag。

## 二、两段式结构
- **A 段 · 总览页**：先弹 `game-f-tutorial.html`（两环循环 + 流程图），让新手秒懂"租武将/养小丑牌/攻岛"。底部「▶ 开始上手」→ 进 B 段。可「跳过」。
- **B 段 · 分步实战引导（coach marks）**：进入真实第一局，**半透明遮罩 dim 全屏 + 镂空高亮当前 target + 气泡文案**，每步 **gate**（玩家做了要求动作才 advance）。

## 三、分步引导脚本（数据驱动 step 列表）
每步数据结构：
```ts
interface OnboardingStep {
  id: string;
  scene: 'lobby' | 'prep' | 'battle' | 'settle'; // 在哪个界面触发
  target: string;        // 高亮哪个 UI（DOM 选择器 / 已声明的 UI key）
  text: string;          // 气泡文案
  advanceOn: string;     // 完成条件 = 监听的 signal（玩家做了这个动作→进下一步）
  skippable?: boolean;   // 默认 true
}
```
**首局建议脚本（10 步，文案可调）**：
| # | scene | 高亮 target | 文案 | 完成条件 advanceOn |
|---|---|---|---|---|
| 1 | lobby | 出战按钮 | 「点这里，带你的牌组出战攻岛」 | `start-run` |
| 2 | prep | 金币 + 商店 | 「花金币买一个武将（武将每局清零、人人平等）」 | `buy-hero` |
| 3 | prep | 棋盘格 | 「把武将拖到场上布阵」 | `deploy-hero` |
| 4 | prep | 装备/战利品栏 | 「拖一件装备到武将身上，让他更强」 | `equip-item`（无装备则跳过） |
| 5 | prep | 开战/Ready | 「准备好了，开战！」 | `ready-combat` |
| 6 | battle | 锦囊条 | 「战局吃紧时点锦囊放技能（火烧/定身/空城…）」 | `cast-jinnang` |
| 7 | battle | 贡献度/攻岛条 | 「击杀守军攒贡献度，攻岛进度上涨」 | 自动（攻岛条涨）|
| 8 | settle | 战功 + 掉卡 | 「赢了！赚战功、Boss 宝箱掉小丑牌进收藏」 | `settle-done` |
| 9 | lobby | 抽卡/组牌 | 「用战功抽卡、附魔、组更强的牌组」 | `open-collection` |
| 10 | — | （收尾气泡） | 「教程完成！武将是租来的，小丑牌牌组才是你的灵魂——去打更深的岛吧」 | 置 `onboarding_done` |

> 文案/步数后续按真机手感调；步骤是**数据**，改引导=改这张表，不改代码。

## 四、交互形态（表现层）
- **遮罩**：半透明 dim 全屏，仅镂空高亮当前 target（spotlight）。
- **气泡**：指向 target，含文案 + 「下一步 / 跳过引导」。
- **gate 推进**：监听该步 `advanceOn` 信号（复用现有 signal/clickable 事件）→ 自动进下一步；非目标操作不推进（也不卡死，给软提示）。
- **防卡死**：每步有「跳过此步」兜底；全程有「跳过引导」。

## 五、数据驱动 / 重组分析（先重组纪律）
| 件 | 怎么做 | 引擎? |
|---|---|---|
| 引导脚本 | `OnboardingStep[]` 扁平数据 | 纯数据 |
| coach 解释器 | 薄确定性函数：读当前 step → 布高亮/气泡 → 监听 advanceOn → 进下一步 | 薄函数（游戏侧） |
| 遮罩/镂空/气泡 | DOM 浮层（game-f 已手写 DOM HUD） | 表现层 |
| 完成条件监听 | 复用现有 signal/clickable | 重组 |
| 新手 flag | account 层 localStorage（同 collection 管道） | 纯数据 |
> **倾向零引擎、纯游戏侧**。唯一可议：是否抽一个**通用 coach-overlay 组件**跨游戏复用——⚠️ **暂不下沉**（YAGNI）：先在 game-f 侧用 DOM 做；若 game-g/其他也明确要新手引导（≥2 拉动）再议下沉为通用 UI capability。

## 六、验收
1. 首次进入点确定 → 弹总览页 → 「开始上手」→ 分步引导高亮+气泡逐步走完首局关键动作（每步 gate）。
2. 走完置 `onboarding_done`；二次进入不弹。
3. 「跳过引导」可用并置 flag；设置/帮助「重看教程 / 重玩引导」可重触发。
4. 引导脚本是数据（改表即改引导）；tsc + vitest + build 全绿、零引擎（或最小游戏侧 DOM）。

---

> 复诵：新手引导=首玩手把手（区别于静态教程页）；account flag 判新手→两段式（总览页 + 分步 coach marks）；步骤=扁平数据、解释器=薄函数、遮罩气泡=DOM 表现层；gate 复用现有 signal；倾向零引擎；通用 coach-overlay 暂不下沉（YAGNI，待 ≥2 游戏拉动）。
