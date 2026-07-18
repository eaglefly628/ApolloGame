# game-c《六人德州》· 验收剧本包（GD-C 作者 · REQ-ACCEPT S4 裁判）

> **制度**（`docs/playbooks/testing.md`「验收剧本」+ REQ-ACCEPT）：GD 写剧本 → harness 驱动真引擎逐步对账 → PE 照红单修。**剧本=GD 域·PE 不得写/改**。
> 本包 = `gdd.md` 德州规则的第三方可执行断言（S4 玩法关裁判·防「绿门不可玩」）。`npx vite-node scripts/acceptance-run.mjs --game game-c` → **4/4 PASS**。

## 1. adapter 契约（PE-C 已落 `src/games/game-c/acceptance-adapter.ts`·session 层门面·纯接线）

- **createWorld(seed, {smallBlind,bigBlind,startStack})** → 包 `HoldemSession`。
- **applySignal**：`hero_act{action:fold/check/call/raise, to?}` · `next_hand` · `pawn{seat,item}`。
- **`{tick:N}`** = 驱动 N 个待行动 AI（= 宿主 timer `stepAI` 同款真实路径）；主角轮/摊牌/局终则空转。
- **readWorld 机读态**（剧本断言只认这些）：
  - res：`button`/`sb-seat`/`bb-seat`/`actor`/`current-bet`/`pot`/`last-aggressor`/`community-count`/`hand-no`/`stack-<i>`/`commit-<i>`/`total-<i>`/`wardrobe-<i>`/`won-<i>`/`reveal-first`/`winner-count`/`showdown-pot`/`won-total`
  - flag：`hero-turn`/`pending-ai`/`phase-betting`/`phase-showdown`/`phase-gameover`/`folded-<i>`/`allin-<i>`
  - sv：`street`/`phase`/`hero-hole`/`reveal-order`/`winner-type`/`last-action-<i>`

## 2. 剧本清单（6·覆盖 owner ①②③ + 开局 + 典当续命·acceptance-run 全绿）

| 文件 | 覆盖（owner 要点） | 断言口径 |
|---|---|---|
| `01-button-blinds` | 开局庄位/盲注/UTG 首动 | 纯开局态·完全确定（不依赖 AI） |
| `02-showdown-settlement` | ①一手打到摊牌·比牌与结算**正确** | **精确**：三条胜两对(比牌)·底池 2351 全额推赢家·守恒(won-total==pot)·结算入栈 |
| `03-illegal-out-of-turn` | ②非法行动被拒（乱序） | 主角未轮行动→引擎 no-op→态一分不动 |
| `04-allin-showdown-pots` | ③all-in 摊牌·单主池 | **精确**：六家等栈全下→单层主池 6000→三条独收·守恒·出清 |
| `05-allin-sidepot-matrix` | ③all-in **边池矩阵**·逐层切池 | **精确**：跨手造短栈→真三层边池(972/3065/450)·逐层独立比牌+kicker·守恒 4487 |
| `06-inhand-pawn-conservation` | gdd §3.5 典当续命·**结算守恒** | **精确**：手内点当耳环(100)→栈即增 1100·弃牌→100 全额留栈不蒸发·全场守恒 6100（回归钉死 REQ-C-106） |

> 断言进化（本轮 GD-C 加固）：②③从「结构不变量（`gte 1`·有赢家池已派）」升级为**精确值钉死**——三条胜两对的**比牌**、底池的**逐层切分金额**、深栈 kicker 决胜（Q>10）、以及**守恒**（派出总额==底池）全部机读断死。确定性引擎（seed+占位 AI）令精确值可复现；`gte 1` 测不出「算错赢家/漏派池/切错层」，精确值能。代价：值钉死到 (seed 42 + M1 占位 AI)，M2 换真行为树后 GD 按同法重派（REQ-ACCEPT 分工·PE 不改剧本）。

## 3. ⚠ adapter 能力缺口（REQ-C-108·PE-C 域）——③已在域内闭合，仅剩②与便利项

原三项缺口本轮复盘：**①精确守恒 与 ③边池矩阵已用现有信号在剧本域内闭合**（不再等 adapter 扩），仅 ② 与「便利注栈」仍缺：

1. ~~**精确守恒断言**~~ ✅ **已闭合**：`won-total` 与 `showdown-pot` 各自都是**确定值**，无需 `res-vs-res`——两者同断成同一常量（02=2351/04=6000/05=4487）即钉死守恒。原以为要 `pot-conserved` 投影，实则确定性引擎让常量断言足矣。
2. **②下注不足态不变**（仍缺·**归 PE 引擎层**·非 adapter）：主角轮的非法加注（不足 min-raise）走 `betting-engine.act` **抛错** → runner 红，断不了「态不变」。
   - 复盘（acb5fb30 撤回）：PE 曾在 adapter 里 `try/catch` 吞非法错成 no-op（71481737），但 owner 定 adapter=纯接线零规则——「非法即 no-op」是**游戏规则决策**，不该藏在 adapter，已正确撤回。
   - GD 裁定：正解是**引擎层 `heroAct` 对非法动作防御性 no-op**（真 UI 里该键本就置灰不可点·`heroAct` 收到非法输入应如「非主角轮」一样静默拒绝，而非 `act()` 抛错）。这是 PE 引擎硬化（`game-session.ts`·非 adapter·非剧本），落地后 GD 补点名剧本断「下注不足→态不变」。→ 已回 `docs/design/game-c/requests.md`（REQ-C-108②）。
   - 现状：本包②由 03「乱序 no-op」覆盖（`heroAct` 非主角轮已正确 no-op·确定可断），下注不足待引擎硬化。
3. ~~**③gdd 边池矩阵**~~ ✅ **已闭合**（05）：不必 adapter 逐座注栈——**跨手**（`next_hand`）让牌局自然分化出短栈（座4→162），再全下即打出真·三层边池（帽 162/775/1000），逐层金额+kicker 全额对照。`setup_stacks`/`deal_scripted` 降级为**便利项**（直接造特定矩阵更省步），非正确性阻塞。

## 4. 制度记录（接管 PE 自写剧本）

本包**接管替换了 PE-C 自写的 4 本剧本**（`01-button-blinds-preflop`/`02-preflop-rotation-to-hero`/`03-hero-call-effect`/`04-showdown-reveal-order`）——剧本=GD 域，PE 自写违 REQ-ACCEPT 律（「作者=GD 非 PE」）。PE 版内容质量不差（已复核），其有效覆盖（开局/摊牌）由本 GD 集独立按 gdd 重写吸收；owner 明确要而 PE 漏的 ②非法/③边池由本集新增。本轮 GD-C 续把 ①②③ 从结构不变量升级为**精确结算断言**并新增 05（真三层边池矩阵），5/5 acceptance-run 绿。
> ⚠ **抽查机制盲点**：REQ-ACCEPT 律称「git blame 抽查 PE 自写=FAIL」，但全 Claude session 同署名 `Claude <noreply@anthropic.com>`——git blame 分不出 GD/PE 角色，该抽查在当前署名体制下失效，只能靠 session 纪律。建议 Lead 补一个非 git-blame 的作者归属机制（记 requests.md·REQ-C-108 附带）。
