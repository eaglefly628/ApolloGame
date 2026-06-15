# Game G 实装任务板 · design G ↔ program G 循环

> 维护：**game design G（策划）** 派单 + 迭代；**program G（程序）** 执行。
> 上位规格：`08-ui-implementation-spec.md`（逐屏规格 + U1–U7 队列 + GameShell/canvas 分工）；正典 `00`–`07`；UI 稿 `UI/`。
> **三决定已拍板（2026-06-15）**：① MOBA 观感 + **整数离散**底层（否决连续物理）② **54 牌·王=大队长**（干预卡=独立功能牌池）③ 台面机关 = **纯表现/favor，不做物理**。

---

## 循环协议（program G 读这条）

1. 认领「当前任务」，**纯游戏侧实现**（`src/games/game-g/` 数据装配 + `@ui/shell` GameShell + 既有 ThreeRenderer）。**不改引擎**（`src/{engine,skills,assembly,renderer,services,net}`）；真缺口 → 写 `docs/workflow/requests.md` 提 **REQ-G**、勿 hack。
2. **tsc + vitest + build 全绿才推**；push 前 `fetch→rebase→` 重跑全套。提交署名 `Claude <noreply@anthropic.com>`、信息以 session URL 结尾、产物不写模型标识。
3. 完成后：在下方「状态」表把该任务标 ✅ + **一句话回馈**（提交号 / 测试数 / 有无缺口），push。
4. design G 每 **4 分钟**轮询：见 ✅ → 从资深策划视角迭代策划案（加深度/乐趣）+ 派下一任务。

---

## 当前任务（可并行两条）

### T-G1 · 大厅 GameShell（`08` §六 U1）
- 产出 `GAME_G_LOBBY_UI: UILayout`（`@ui/shell`）+ 薄挂载：**5 tabs**（大厅/牌组/收藏/改造坊/天梯）+ 顶栏（头像/主牌/段位/皮肤切换玄铁·锦霞/货币 🪙◈💎/⚙）+ 主 CTA「⚡天梯掷命 1v1」+「单人·AI 庄家」。**假数据先行。**
- 依据：`08` §3.1 逐屏组件表 + `UI/Game G 大厅.dc.html` 像素参考。皮肤=GameTheme 数据换皮（仿 gameF sanguo）。
- 验收：5 屏 GameShell 数据可走查；**零手写 React 壳**（照 gameF `GAME_F_UI`）；tsc+vitest+build 绿。

### T-G2 · 战场整数离散核（`08` §六 U2 · 命门）
- **headless 先行**（不依赖 3D）：三路**整数推进轨** + 派牌入路（`track_pos=0`）+ 每拍 +1 推进 + 接敌同格 → `decideFaceUp`（复用现成）+ 老家/哨塔 `Resource{hp}` + **占老家判胜负** + 掉材。
- 依据：`08` §3.2 战斗流 + §一 整数离散裁决。**核**：「沿轨整数推进」能否纯 `Timer`+`Effect` 或复用 gameF 移动；不能 → 提 REQ-G。
- 验收：同 seed 同布阵 → 逐拍 `world.hash()` 一致（确定性）；一局 vs 假敌闭环（派牌→推进→掷命→打老家→分胜负→掉材）；vitest 绿。

---

## 队列（design G 随进度派 + 补设计详规）

| 槽 | 内容 | 前置（design G 待补） |
|---|---|---|
| U3 | 三三制/将领接入（军衔=点数角标 / 队列 favor / `hierarchy-cascade` 溃散）| design G 补「将领 UI 呈现 + 擒贼先擒王溃散演出」详规 |
| U4 | HUD 叠层（干预卡 / 三路战况 / 选路派牌）| design G 补「开局布阵/分兵屏」详规 |
| U5 | 3D 表现 + 相机（ThreeRenderer 画三路世界/翻牌/老家牌王座 + 缩放/平移/小地图/聚焦）| `03` |
| U6 | vs AI（数据配置军队 + 派牌/干预出牌策略）| `08` 改进 6 |
| U7 | 改造坊/收藏/天梯 + 皮肤双套 | `07`/`02` |

---

## 状态

| 任务 | 状态 | 回馈（program G 填）|
|---|---|---|
| T-G1 大厅 GameShell | ⬜ 待领 | — |
| T-G2 战场整数离散核 | ⬜ 待领 | — |

> 复诵：纯游戏侧、不改引擎、全绿才推；完成标 ✅ 回馈 → design G 4 分钟轮询迭代。
