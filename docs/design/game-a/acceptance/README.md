# Game A ·《掼蛋夜宴》验收剧本包（S4 裁判 · REQ-ACCEPT）

> 作者=GD-A（懂规则方）。剧本=纯数据，harness 驱动**真引擎**（`GuandanSession`）逐步对账，
> 断言只读机读态（Resource/Flag/StringVar·不读 DOM）。PE 落薄适配 `src/games/game-a/acceptance-adapter.ts`
> （纯接线零规则）、**不得改本目录剧本**；剧本写错=GD 改 + 记录。规则真相=`docs/design/game-a/gdd.md`。

跑：`npx vite-node scripts/acceptance-run.mjs --game game-a`（全部进 vitest `scripts/acceptance.test.mjs` 推送门禁自动咬）。

## 剧本清单（4 份 · S4 门要 ≥3）

| 文件 | seed | 查什么（gdd 依据） |
|---|---|---|
| `01-round-settle-tribute` | 7 | ① 一整盘打到**头游判定与结算** + **进贡/还贡口径**（§2.4 结算·R3 升级·§2.3 G1 单下：进最大牌/还≤10/进贡者先出） |
| `02-illegal-plays-rejected` | 1 | ② **非法出牌被拒·状态不变**：牌型不合法 / 压不过上家 / 乱序 / 无牌（§2.2 牌型闭集+压制序·R6 行牌序） |
| `03-level-advance-restart` | 42 | ③ **重开/下一局·级牌推进正确**：对方连续双上 2→5→8（R3 双上+3·盘循环重开纪律） |
| `04-run-terminates-opponent-passes-ace` | 42 | run **终局判定**：对方过 A → 游戏结束（§2.4 A1/A3·run-lost） |

每份头注列了「对抗目标」：改坏对应被测逻辑时哪条断言会变红（假信心自查）。全部剧本用固定 seed，
`GuandanSession` 种子 PRNG 保证同 seed 同轨（②全程只用显式出牌驱动·与 AI 逻辑解耦，最稳健）。

## 适配契约（PE 域·参考）

`acceptance-adapter.ts` 把 `GuandanSession` 公有态投影成引擎协议标量、并转发信号（零规则）：

- 信号：`play`（by=座位·args.cards=牌码）/ `pass`（by=座位）/ `ai-step` / `auto` / `play-round` / `next-round` / `play-run`。
- 关键标量：`res` round·level_ours/theirs·hand_*·trick_size·tribute0_card/return·result_*·winners_team；
  `flag` last_act_ok·has_trick·turn_is_hero·settled·run_won/lost·resisted；`sv` phase·turn·combo·a_result·winner·tribute0_from/to。
- `last_act_ok`=上一条 play/pass 是否被引擎接收——配「机读态一分不动」表达「非法被拒」（schema 无 expect_error 算子）。

## 已知偏差（交 PE / Lead·非 GD 域）

- **`RoundResult.levelUp` 派生字段仅双上算对**：实测一三/一四胜时该字段恒报 `0`（应为 +2 / +1），
  仅双上=+3 正确（`guandan-session.ts` 的 `levelUp` 表达式对非双上退化成 `x - x = 0`）。
  级牌**实际推进正确**（`levels`/`level_ours` 权威资源无误），仅这个展示用派生计数错。
  故剧本 ① 以 `level_ours` 2→3 断言「一四升 +1」，**不押** `result_level_up`；③ 的双上 +3 仍押 `result_level_up`（该分支正确）。
  → 建议 PE 修 `levelUp` 计算（`levelAfter[winnersTeam] - levelBefore`）；修好后可在 ① 加回 `result_level_up eq 1`。
