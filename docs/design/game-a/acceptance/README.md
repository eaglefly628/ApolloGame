# Game A ·《掼蛋夜宴》验收剧本包（S4 裁判 · REQ-ACCEPT）

> 作者=GD-A（懂规则方）。剧本=纯数据，harness 驱动**真引擎**（`GuandanSession`）逐步对账，
> 断言只读机读态（Resource/Flag/StringVar·不读 DOM）。PE 落薄适配 `src/games/game-a/acceptance-adapter.ts`
> （纯接线零规则）、**不得改本目录剧本**；剧本写错=GD 改 + 记录。规则真相=`docs/design/game-a/gdd.md`。

跑：`npx vite-node scripts/acceptance-run.mjs --game game-a`（全部进 vitest `scripts/acceptance.test.mjs` 推送门禁自动咬）。

## 剧本清单（8 份 · S4 门要 ≥3）

**核心循环（①~④）**

| 文件 | seed | 查什么（gdd 依据） |
|---|---|---|
| `01-round-settle-tribute` | 16 | ① 一整盘打到**头游判定与结算** + **进贡/还贡口径**（§2.4 结算·R3 升级·§2.3 G1 单下：进最大牌/还≤10/进贡者先出） |
| `02-illegal-plays-rejected` | 1 | ② **非法出牌被拒·状态不变**：牌型不合法 / 压不过上家 / 乱序 / 无牌（§2.2 牌型闭集+压制序·R6 行牌序） |
| `03-level-advance-restart` | 42 | ③ **重开/下一局·级牌推进正确**：对方连续双上 2→5→8（R3 双上+3·盘循环重开纪律） |
| `04-run-terminates-opponent-passes-ace` | 42 | ④ run **终局**：对方过 A → 游戏结束（§2.4 A1/A3·run-lost） |

**节奏 + 深逻辑（⑤~⑧·「节奏和逻辑」轮）**

| 文件 | seed | 查什么（gdd 依据） |
|---|---|---|
| `05-round-tempo-flow` | 42 | ⑤ **节奏**：盘必在有限步**收束**（无死循环/活锁）+ 手牌单调递减 + 轮转恒合法（§1 墩圈轮转·「治卡死根因」） |
| `06-resist-tribute-exempt` | 4 | ⑥ **抗贡 G3**：应贡方持双大王 → 免贡（tribute_count=0）·头游先出（§2.3 G3） |
| `07-double-down-tribute` | 2 | ⑦ **双下 G2**：一队一二 → 双进贡·大者(大王)归头游·次者(小王)归二游·进大贡者先出（§2.3 G2·含 tribute1 断言） |
| `08-run-won-we-pass-ace` | 1 | ⑧ run **终局**：我方过 A → 通关（run-won·A2·与 ④ 成镜像） |

每份头注列了「对抗目标」：改坏对应被测逻辑时哪条断言会变红（假信心自查）。全部剧本用固定 seed，
`GuandanSession` 种子 PRNG 保证同 seed 同轨（②全程只用显式出牌驱动·与 AI 逻辑解耦，最稳健）。

> ⚠ **AI 出牌线耦合（PE 2026-07-18·A-013）**：①③④⑤⑥⑦⑧ 用 `play-round`/`play-run` 全自动打，落到哪个
> 名次/进贡/过 A 分支**取决于 AI 出牌线** + 种子 PRNG 消耗步数——AI 策略一改（如本轮「不拆炸+保留大牌」），
> 这些 seed 会漂离目标分支、断言值过期。本轮 PE 已按新 AI 重选 seed 命中各分支（01→16·06→4·07→2·08→1）并
> 重钉值（分支真被走到·非弱化）。**GD-A 长期建议**：把分支断言（抗贡/双下/过 A）迁到 walkthrough 单测
> （`forceRanking` 直接摆名次·与 AI 解耦），acceptance 只留②式「显式出牌驱动」的稳健剧本，免每次 AI 改都追种子。

### 变异测试留痕（断言有牙·非常量）

对每份剧本对应的引擎逻辑做定点变异，均精确打红目标剧本、还原后全绿：
进贡取最小→①红 · 去压制校验→②红 · 级牌不推进→③红 · 过A失效→④红 ·
抗贡阈值失效→⑥红 · 双下判定失效→⑦红。（⑤节奏的牙=轮转死循环时 playRound 守卫耗尽→settled 红·结构性保证。）

### 已加固（闭环）

- **`tribute1_*` 投影缺口 → ✅ 已闭环**（A-010·PE 2026-07-18）：薄适配已加 tribute1_from/to/card/return（纯读镜像 tribute0_*）；
  ⑦ 已回收次贡断言 `tribute1_from=partner`、`tribute1_to=west`、`tribute1_card=15`（小王），双下「次者归二游」半句现已机读钉死。

## 适配契约（PE 域·参考）

`acceptance-adapter.ts` 把 `GuandanSession` 公有态投影成引擎协议标量、并转发信号（零规则）：

- 信号：`play`（by=座位·args.cards=牌码）/ `pass`（by=座位）/ `ai-step` / `auto` / `play-round` / `next-round` / `play-run`。
- 关键标量：`res` round·level_ours/theirs·hand_*·trick_size·tribute0_card/return·result_*·winners_team；
  `flag` last_act_ok·has_trick·turn_is_hero·settled·run_won/lost·resisted；`sv` phase·turn·combo·a_result·winner·tribute0_from/to。
- `last_act_ok`=上一条 play/pass 是否被引擎接收——配「机读态一分不动」表达「非法被拒」（schema 无 expect_error 算子）。

## 偏差归档（已闭环）

- **`RoundResult.levelUp` 派生字段仅双上算对**（A-009·**已修**·PE bd53fc2f）：
  曾实测一三/一四胜时该字段恒报 `0`（表达式退化成 `x - x`），仅双上=+3 正确。
  PE 改为捕获 `levelBefore`、`levelUp = levels[winnersTeam] - levelBefore`（双上+3/一三+2/一四+1/打A局=0/封顶取实增 全对）。
  → GD 已回收断言：剧本 ① 加回 `result_level_up eq 1`（一四升 +1），与 `level_ours` 2→3 交叉印证；③ 的双上 +3 仍押。
