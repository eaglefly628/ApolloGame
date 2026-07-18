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

## 2. 剧本清单（4·覆盖 owner ①②③ + 开局·acceptance-run 全绿）

| 文件 | 覆盖（owner 要点） | 断言口径 |
|---|---|---|
| `01-button-blinds` | 开局庄位/盲注/UTG 首动 | 纯开局态·完全确定（不依赖 AI） |
| `02-showdown-settlement` | ①一手打到摊牌·比牌与结算 | 到摊牌·有赢家·池已派（结构不变量·不预演具体牌） |
| `03-illegal-out-of-turn` | ②非法行动被拒（乱序） | 主角未轮行动→引擎 no-op→态一分不动 |
| `04-allin-showdown-pots` | ③all-in 边池结算·分池 | 主角全下→摊牌→有赢家池已派（降级·见 §3） |

## 3. ⚠ adapter 能力缺口（REQ-C-108·PE-C 域·限制 owner ②③ 的完整版）

现 adapter 是 **session 层门面·只控主角 + 统一起始栈 + 3 个信号**，撑不起 owner 要的完整②③，本包已覆盖各自的确定可绿子集，完整版待 adapter 扩：

1. **精确守恒断言**（`won-total == showdown-pot` 两机读态相等）：Lead schema 断言只支持 `res-vs-常量`，表达不了 `res-vs-res`。→ adapter 加 `pot-conserved` 布尔投影（`won-total===showdown-pot`），02/04 即可断精确守恒。现退守「有赢家且分池非空」。
2. **②下注不足态不变**：主角轮的非法加注（不足 min-raise）现走 `betting-engine.act` 抛错 → runner 红，断不了「态不变」。→ adapter 对主角非法行动 catch 成 no-op。本包②先覆盖「乱序」（非主角轮 no-op·确定可断）。
3. **③gdd 边池矩阵**（900/100/300 逐层分池金额对照）：session 层 config 只有统一 `startStack`·无法逐座注入不同栈构造确定三层边池。→ adapter 加 `setup_stacks`/`deal_scripted` + `hero_act{action:"allin"}` 信号。本包④先覆盖「主角全下走到边池摊牌」·逐层金额待扩。

## 4. 制度记录（接管 PE 自写剧本）

本包**接管替换了 PE-C 自写的 4 本剧本**（`01-button-blinds-preflop`/`02-preflop-rotation-to-hero`/`03-hero-call-effect`/`04-showdown-reveal-order`）——剧本=GD 域，PE 自写违 REQ-ACCEPT 律（「作者=GD 非 PE」）。PE 版内容质量不差（已复核），其有效覆盖（开局/摊牌）由本 GD 集独立按 gdd 重写吸收；owner 明确要而 PE 漏的 ②非法/③边池由本集新增。
> ⚠ **抽查机制盲点**：REQ-ACCEPT 律称「git blame 抽查 PE 自写=FAIL」，但全 Claude session 同署名 `Claude <noreply@anthropic.com>`——git blame 分不出 GD/PE 角色，该抽查在当前署名体制下失效，只能靠 session 纪律。建议 Lead 补一个非 git-blame 的作者归属机制（记 requests.md·REQ-C-108 附带）。
