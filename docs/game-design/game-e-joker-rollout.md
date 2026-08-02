# Game E · 小丑牌 Rollout 清单（150 全表 → 按能力分桶）

> 配合 `docs/workflow/requests.md` 的 **REQ-E-023**。主程按「能力」实现，**每个能力的验收 = 下面对应分组里的小丑都能用纯数据表达并生效**。
> 数据/型号源：`games/game-e/joker-catalog.ts`（150 全表元数据）。可执行子集见 `jokers.ts` 的 `STARTER_JOKERS`。
> 标注：`[chips/mult/money]` = 作用目标；`add/mul` = op；`per-card` = on_scored 逐张；`indep` = on_hand_scored 整手一次。

---

## A. 已可玩（31 张，`STARTER_JOKERS` 已接线 + 测试）
joker, greedy/lusty/wrathful/gluttonous_joker, jolly/zany/mad_joker, crazy/droll_joker, sly/wily/clever/devious/crafty_joker, half_joker, fibonacci, scary_face, even_steven, odd_todd, gros_michel(无自毁), banner, bull, cavendish(无自毁), the_duo/trio/family/order/tribe, hanging_chad, golden_joker※。
> ※ golden_joker 在池中但 `on_round_end` 未接线（见 G 组），目前**不生效**——属游戏侧补接，不占引擎。

---

## B. 游戏侧「现在就能加」（0 引擎工，PE 立即做）—— 用现有 capability 即可
这些只是还没写进 `STARTER_JOKERS`，能力早就够：

| id | 效果 | 数据写法 |
|---|---|---|
| smiley_face | 计分人头 +5 倍率 | per-card `card_face` → add mult 5 |
| arrowhead | 计分 ♠ +50 筹码 | per-card `card_suit:spades` → add chips 50 |
| onyx_agate | 计分 ♣ +7 倍率 | per-card `card_suit:clubs` → add mult 7 |
| rough_gem | 计分 ♦ +$1 | per-card `card_suit:diamonds` → add **money** 1 |
| triboulet(传奇) | 计分 K/Q 各 ×2 倍率 | per-card `card_rank_in:[12,13]` → **mul** mult 2 |

外加两个**极小游戏侧扩展**（仍非引擎）：
- **`resource_cmp` 条件**（读某 Resource 比较）→ 解锁 **mystic_summit**（0 弃牌时 +15 倍）、**acrobat**（最后一手 ×3，hands_left=1）、**card_sharp**（本回合重复牌型 ×3，用已track 的 playedTypes）。
- **多效果小丑**（一张映射成 2 条 PerCardRule）→ 解锁 **scholar**（A +20 筹 +4 倍）、**walkie_talkie**（10/4 +10 筹 +4 倍）。

→ B 组合计约 **10 张**，PE 不等引擎先做。

---

## ① `valueFrom.countOf` 计数缩放（验收清单）
| id | 效果 | countOf | op | coeff |
|---|---|---|---|---|
| abstract_joker | +3 倍/每小丑 | jokers | add mult | 3 |
| blue_joker | +2 筹/每副牌剩余张 | deck_cards | add chips | 2 |
| joker_stencil | ×1 倍/每空槽 | empty_joker_slots | mul mult | 1 |
| erosion | +4 倍/每张低于起始牌库 | cards_below_start | add mult | 4 |
| bootstraps | +2 倍/每 $5 | money_div5 | add mult | 2 |
| swashbuckler | +倍 = 其它小丑售价和 | other_joker_sellsum | add mult | 1 |
| steel_joker | ×0.2 倍/每钢铁牌 | steel_cards_in_deck | mul mult | 0.2(+1基) |
| stone_joker | +25 筹/每石头牌 | stone_cards_in_deck | add chips | 25 |
| cloud_9 | 回合末 $1/每张 9 | nines_in_deck | add money | 1 |
| drivers_license | ≥16 附魔牌 → ×3 | (阈值型,可 countOf+门) | mul mult | — |
| fortune_teller | +1 倍/每用过塔罗 | tarots_used | add mult | 1 |
| satellite | 回合末 $1/每种用过行星 | unique_planets_used | add money | 1 |

> 注：steel/stone/钢铁牌依赖「C 手牌内 + 牌增强」；cloud_9/satellite/fortune_teller 依赖 G(回合末) + 计数源。countOf 枚举建议可扩展，集合解析在引擎。

## ② 确定性概率 roll（验收清单）
| id | 概率 | 命中效果 |
|---|---|---|
| misprint | — | +0~23 倍随机（区间 roll） |
| bloodstone | 1/2 每张♥ | ×1.5 倍 |
| business_card | 1/2 每张人头 | +$2 |
| reserved_parking | 1/2 每张留手人头 | +$1（+③held） |
| 8_ball | 1/4 每张 8 | 造塔罗（+OUT 塔罗系统） |
| space_joker | 1/4 | 升当前牌型等级 |
| gros_michel/cavendish | 1/6、1/1000 回合末 | 自毁（+⑥销毁自身） |
| lucky 牌增强 | 1/5、1/15 | +20 倍 / +$20 |
> 建议：Effect/PerCardRule 加 `chance:{num,den}`，命中条件后世界种子 PRNG roll；`oops_all_6s` = 全局翻倍该概率。

## ③ 逐张「手牌内」结算 pass（验收清单）
| id | 效果 |
|---|---|
| baron | 每张留手 K ×1.5 倍 |
| shoot_the_moon | 每张留手 Q +13 倍 |
| raised_fist | 留手最小牌 rank×2 → 倍率 |
| blackboard | 留手全 ♠/♣ → ×3 倍 |
| mime | 重触发留手牌效果（+条件重触发） |
| **Steel 牌增强** | 留手时 ×1.5 倍（补 REQ-E-021 留口） |
| **Gold 牌增强** | 回合末留手 +$3（+G 回合末） |

## ④ 小丑「自增长」可变状态（验收清单）
累加+重置型，需 per-joker `Counter` + 声明式 `on:signal, delta, resetWhen?`：
| id | 累加 | 重置 |
|---|---|---|
| ride_the_bus | +1 倍/手(无人头) | 出到人头清 0 |
| green_joker | +1 倍/手, −1/弃 | — |
| obelisk | ×0.2/连续非最常打 | 打出最常打清 |
| supernova | = 本局出手数 | （只增） |
| square_joker | +4 筹/手(恰 4 张) | — |
| runner | +15 筹/手(含顺子) | — |
| ice_cream | −5 筹/手(初 100) | — |
| popcorn | −4 倍/回合(初 20) | — |
| ramen | −0.01 倍/弃(初 ×2) | — |
| wee_joker | +8 筹/每张计分 2 | — |
| spare_trousers | +2 倍/手(含两对) | — |
| hit_the_road | ×0.5/弃 J(本回合) | 回合 |
| loyalty_card | ×4 每 6 手 | 周期 |
| seltzer | 重触发，剩 N 手计数 | — |
| constellation/hologram/glass_joker/campfire/lucky_cat/flash_card/madness/throwback/red_card | ×/+ 累加(行星用/加牌/碎玻璃/卖牌/lucky/重摇/选盲/跳盲/跳包) | 部分 boss 重置 |
| canio/yorick(传奇) | ×1/(面牌毁 / 23 弃) | — |

## ⑤ 被动改判型规则（验收清单）
| id | 规则修饰 |
|---|---|
| four_fingers | 4 张可成顺/同花 |
| shortcut | 顺子允许隔 1 |
| splash | 每张牌都计分 |
| pareidolia | 所有牌算人头 |
| smeared_joker | ♥♦同色算同花、♠♣同色 |
| flower_pot | 含四种花色 → ×3（派生事实：花色种数） |
| seeing_double | 含♣+另一花色 → ×2 |
| photograph | 首张人头 ×2（首个匹配，非 index0） |

## ⑥ 跨实体：复制 / 改牌 / 改其它小丑（验收清单，体积最大）
| id | 效果 |
|---|---|
| blueprint / brainstorm | 复制右/最左小丑能力 |
| invisible_joker | 2 回合后卖出复制随机小丑 |
| baseball_card | 每张 uncommon 小丑 ×1.5 |
| dna | 首手单张 → 复制进牌库 |
| hiker | 计分牌永久 +5 筹（改牌数据） |
| midas_mask | 出的人头 → 黄金牌 |
| vampire | 吸附魔 +×0.1，去附魔 |
| ceremonial_dagger / madness | 毁右侧/随机小丑并吸收 |
| marble_joker / certificate | 加石头/带封牌进牌库 |

---

## OUT（需另起系统，不在 REQ-E-023 内 —— 塔罗/异色/卡包/Tag/凭证/商店元）
塔罗·异色生成类：8_ball, superposition, vagabond, séance, sixth_sense, hallucination, cartomancer, diet_cola, perkeo。
卡包/跳过/商店元：chaos_the_clown, red_card, throwback, showman, astronomer, riff_raff, golden_ticket(需金牌), to_do_list, mail_in_rebate(econ-rank), matador/luchador/chicot/mr_bones(boss 交互), credit_card(负债)。
手数/弃牌/手牌容量被动（小游戏侧改资源，多数可 G 类做）：juggler, drunkard, turtle_bean, troubadour, merry_andy, stuntman, burglar, egg, gift_card, rocket, to_the_moon, golden/delayed_gratification, faceless/trading_card, castle, mystic_summit※(已在 B)。

> 经济/手数/弃牌这批大多是 **G 组（游戏侧：脚本发 on_round_end/on_discard/on_blind_selected 信号 + jokerToEntities 接线 + 少量资源改动）**，PE 可在引擎工之外并行消化，不属引擎缺口。

---

## 建议落地序（与 REQ-E-023 一致）
B(PE 现在) → ① countOf → ② 概率 → ③ 手牌内(带 steel/gold) → ④ 自增长 → ⑤ 规则 → ⑥ 跨实体；G(经济/触发) PE 并行。
每落一项引擎能力，PE 把对应分组的小丑从 catalog 接成可玩并补测试。
