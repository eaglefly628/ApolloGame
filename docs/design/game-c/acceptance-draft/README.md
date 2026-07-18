# game-c《六人德州》· 验收剧本包（GD-C 作者 · REQ-ACCEPT 循环）

> **⏳ 暂存 `acceptance-draft/`（2026-07-18）**：REQ-ACCEPT harness（`scripts/acceptance.test.mjs`）已落地并动态扫 `acceptance/` 目录——**有剧本无 adapter=红且阻塞全库推送门禁**。故 GD-C 剧本先放本 `-draft/`（harness 不扫）。**PE-C 落 adapter（REQ-C-107）时把本目录转正为 `acceptance/` 同批推**（此时 adapter 在→conformance 咬）。剧本内容已终稿、schema 合法，转正即用。

> **制度**：`docs/workflow/requests.md` REQ-ACCEPT——GD（懂规则方）写剧本 → harness 驱动真引擎逐步对账 → PE 照红单修。
> **剧本=GD 域纯数据，PE 不得改**（剧本错=GD 改并记录）。本目录 `*.scenario.jsonc` = GDD 规则的第三方可执行断言，专治「S4 绿门却不可玩 / PE 自写自测理解错则测码同错」。
> **现状（2026-07-18）**：harness runner（`scripts/acceptance-run.mjs`·REQ-ACCEPT 派工 Opus 中）+ game-c adapter（PE-C 落 `src/games/game-c/acceptance-adapter.ts`）**尚未落地**——本包为「GD 先写剧本」，两者到位即激活并进 S4 门（≥3 场景 conformance 全绿才放行）。

## 1. adapter 契约（GD→PE 接口 · PE-C 落 `acceptance-adapter.ts` 照此映射，纯接线零规则）

玩法真相源 = `HoldemSession`（`game-session.ts`）。adapter 三函数：

- **`createWorld(seed, config)`** → `new HoldemSession(seed, {smallBlind,bigBlind}, config.startStack)`。
- **`applySignal(session, signal, args, by)`** → 映射到 session 方法：

  | signal | 映射 | 说明 |
  |---|---|---|
  | `hero_fold`/`hero_check`/`hero_call` | `session.heroAct({kind})` | 主角行动（fold/check/call）·session 内部自动推进 AI 到下一主角决策点或摊牌 |
  | `hero_raise` (args.to) | `session.heroAct({kind:'raise', to:args.to})` | 加注到 args.to（本街 committed 目标值） |
  | `pawn` (args.item) | `session.pawn(0, args.item)` | 主角典当某件衣物 |
  | `next_hand` | `session.nextHand()` | 摊牌屏「继续」→ 开下一手 / 局终 |

- **`readWorld(session)`** → 机读态快照（下表语义名 → 值）。runner 断言只认这些名：

  | 类 | 名 | 取值 | 定义 |
  |---|---|---|---|
  | res | `total_chips` | `Σ session.seats[i].stack` | 全场局级筹码总额（syncStacks 后为真相）。**典当会注入**（衣物→筹码，见 §3） |
  | res | `chips_injected` | `Σ_seat Σ_{item∈pawned} value` | 已典当注入累计（衣物面值转成的筹码） |
  | res | `chips_net` | `total_chips − chips_injected` | **守恒不变量·哨兵**：扣除典当注入后全场筹码，恒 = 初始（6 人×startStack）。下注/结算漏一分即 < 初始 → 逮 P0 |
  | res | `pot` | `session.pot()` | 当前底池（Σ 本手 total） |
  | res | `hero_chips` | `session.stackOf(0)` | 主角手内实时筹码（⚠ 见发现①：与典当的手内歧义） |
  | res | `hero_wardrobe` | `session.wardrobeLeft(0)` | 主角剩余未典当衣物件数（6→0） |
  | res | `hand_no` | `session.handNo` | 当前手序号（1 起） |
  | res | `alive_count` | 未淘汰座位数 | `session.seats.filter(!eliminated).length` |
  | sv | `phase` | `session.phase` | `betting`/`showdown`/`gameover` |
  | sv | `winner_side` | `session.winnerSide ?? ""` | 局终赢家：`hero`/`opponents`/`""` |
  | flag | `hero_turn` | `session.isHeroTurn` | 是否轮到主角 |
  | flag | `hero_folded` | `session.seatState(0).folded` | 主角本手已弃 |
  | flag | `hero_allin` | `session.seatState(0).allIn` | 主角本手全下 |
  | flag | `hero_eliminated` | `session.seats[0].eliminated` | 主角剥光出局 |

## 2. 守恒锚点纪律（GD 写断言的约定）

- 守恒断言用 **`chips_net`**（=`total_chips − chips_injected`），**只放手间/showdown 锚点**（session `syncStacks` 已把结算写回 `seats.stack`）——下注进行中手内栈在 `hand.players`，不在 `seats`，不锚定。
- `chips_net` **恒 = 初始**（6 人×startStack），不受典当注入干扰：这是唯一能在 AI 自动典当续命的多手局里仍逮住「下注/结算蒸发筹码」的探针（P0 REQ-C-105 的 session 层哨兵）。`total_chips` 会随典当上涨，故不直接锚它守恒。

## 3. 典当=筹码注入（非守恒·GDD §3.5 设计）

衣物典当是**注入续命筹码**：点一件 → `total_chips` +该件面值、`hero_wardrobe` -1。面值表（`wardrobe.ts`·owner 拍板）：耳环100/手套150/袜子200/上衣500/裙子500/内衣1000（总 2450）。二次典当同件=不可负担不重复入账。

## 4. ⚠ 复查发现清单（本包写作中暴露 · 驱动 PE-C 迭代 · 见 requests.md）

1. **REQ-C-105（P0·边池筹码蒸发）**：大盲短缴 all-in + 弃牌 → `potLayers` refund 仅取 live top → 未跟注差额蒸发（heads-up 复现漏 15）。剧本 `03/04` 的守恒探针是它在 session 层的哨兵。
2. **REQ-C-106（典当手内歧义）**：`session.pawn` 只加 `seats[seat].stack`，不同步当前手 `hand.players[seat].stack`——**手中间典当的筹码当前手用不上**（下注读 hand.players）。剧本 `02` 因此只断言 `hero_wardrobe`+`total_chips`（局级），不断言手内 `hero_chips`。PE-C 需裁定：典当是否该手内即时生效（若是→同步 hand.players；若只手间生效=设计如此→GD 记录、剧本维持）。

## 5. 剧本清单（≥3·S4 门要求）

| 文件 | 验什么 | 关键断言 |
|---|---|---|
| `01-hero-fold-flow.scenario.jsonc` | 玩法闭环：弃牌→AI 自动打完→摊牌→下一手 | 守恒 6000·phase 推进·hand_no 递增 |
| `02-pawn-rule.scenario.jsonc` | 典当规则：换筹码/件数减/不重复 | hero_wardrobe·total_chips 注入 |
| `03-allin-showdown-conservation.scenario.jsonc` | 主角全下→真实边池+摊牌→守恒 | 全下后 showdown·total_chips 守恒 |
| `04-multihand-conservation.scenario.jsonc` | 多手循环筹码不漏（P0 哨兵） | 连打数手每手后 total_chips=6000 |
