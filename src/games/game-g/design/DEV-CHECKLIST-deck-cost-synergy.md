# 接入清单 · 牌组构筑 + 放牌费用 + 基础连携（给甲乙 · 函数/契约级 · 可直接开发）

> design G ｜ 2026-06-21 ｜ owner「把牌组库存注入甲乙清单、准备开发」。
> 上位正典：牌组结构 `doc20 §〇` · 放牌费用 `doc24 §4.1`+`doc14 §九` · 基础连携 `doc19 §4.1`+`doc14 §十`。
> 纪律：纯 game-side（`src/games/game-g/`）· 零引擎 · 真缺口才提 REQ-G · tsc+vitest+build 全绿才推 · 每项配测。

## 0. 决策定稿（owner 2026-06-21）
- **出战牌组 = 16 扑克（从 52 收藏池自选）+ 5 天罡（= loadout≤5）**。
- **放牌费用 4 档**：点 2-4 = **0** / 5-7 = **1** / 8-10 = **2** / J/Q/K/A(11-14) = **3**。（0 费 spam 暂放开·sim 退化再加每回合放牌软上限。）
- **基础连携（一条路内·自动·亮线）**：同点连线（≥2 同点 +`COMBO_PAIR` / ≥3 +`COMBO_TRIPS`）+ 同花连线（同花每张 +`SUIT_PER`·封顶 `SUIT_CAP`）。
- **一键自动构筑** + **每张牌画费用角标**。

## 1. 契约（甲乙解耦 · 三条）
- **契约 A · 牌组库存（16 选）** ⚠️最大件：`save` 每个牌组新增 `pokerPicks: string[]`（长度 16·卡 id 如 `'7S'`），从 52 收藏池选。**乙写**（构筑屏选牌）/ **甲读**（喂 pokerDeck）。养成（`save.inlays`/`dizhiOwned`/favor）仍按卡 id 挂。**迁移**：老 `save.deck:number[](52 favor)` 保留为收藏池 favor 源；新增 picks，缺省=自动构筑一副。
- **契约 B · `deployCost(rank): number`**：turn-combat 导出纯函数（查 4 档表）。**甲实现+用**（deployUnit/canAct）/ **乙读**（牌面画费用角标）。
- **契约 C · 基础连携**：在 turn-combat clash 内 base pass 算（甲）；`lastClash`/lane 暴露同点/同花成线信息 → **乙读**（战斗内亮连线）。

## 2. 甲（战斗）任务
| # | 任务 | 文件 · 函数 | 做什么 | 测试 |
|---|---|---|---|---|
| 甲1 | 放牌费用 | `turn-combat.ts` `DEPLOY_COST`→`deployCost(rank)` · 接 `deployUnit`/`canAct` | 常量 0 → 查 4 档表（点2-4=0/5-7=1/8-10=2/JQKA=3·读 cardPoints(rank)）；`canAct('deploy', deployCost(card.rank))` | 低费可放/源泉不足不可放/turn1 只放得起 0-1 费 |
| 甲2 | 基础连携 base 化 | `turn-combat.ts` L216-217（现 `fx.powerSameSuit`/`comboPair`/`comboTrips` 天罡门控） | 改：**无条件先加 base**（`COMBO_PAIR/TRIPS`·同点 ≥2/≥3；`SUIT_PER×(同花数−1)` 封顶 `SUIT_CAP`）；天罡（双锋/鼎立/同花魁/双锋印）**在 base 上叠加放大**。值读 doc14 §十 | 无天罡也吃 base 连携（路内对子/三条/同花各档加成 + 同点同花可叠 + 封顶） |
| 甲3 | 16 张喂入 | `game-g.tsx` `prepareArmies`/`toPoker` 喂 `initTurnBattle({a:{pokerDeck}})` | pokerDeck 由 `save.pokerPicks`（16 张·按卡 id 取 rank/suit/favor/inlay）折，**非整副 52** | 牌库=16 张·确定性·养成 favor 正确带入 |
| 甲4 | 连携信息暴露 | `turn-combat.ts` `lastClash`/lane 态 | 在 clash 态标该路同点/同花成线的牌（供乙亮线·纯表现位·不进 hash） | 出帧/字段断言 |

## 3. 乙（菜单）任务
| # | 任务 | 文件 · 函数 | 做什么 | 测试 |
|---|---|---|---|---|
| 乙1 | 牌组构筑屏 | `lobby-screen.ts` DECKS/CRAFT · `save.pokerPicks` | 从 52 收藏选 **16 扑克** + 选 **5 天罡**（已有 tiangangDecks）；写 `save` 契约 A | click 测：选/换牌→save 更新·16 上限 |
| 乙2 | 牌组预览 | `lobby-screen.ts` 预览面板 | **费用曲线柱**（0/1/2/3 各几张·提示"别全大点"）+ **连携高亮**（同花/同点成色）+ 总有效 favor★ | golden 帧 |
| 乙3 | 一键自动构筑 | `lobby-screen.ts` + 选牌器（纯函数·确定性） | 按钮建 16+5：①费用曲线铺开（各档 ~3 张·不全大点）②连携成形（优先同花/同点凑线）③偏好已拥有+已养成/附魔 ④补满 | 确定性（同存档同结果）+ 产出满足曲线/连携约束断言 |
| 乙4 | 费用角标 | `lobby-screen.ts`/牌面渲染 · 读 `deployCost` | 每张牌画 0/1/2/3 费角标（收藏/手牌/构筑屏一致） | 出帧 |
| 乙5 | 战斗内连携亮线 | `turn-battle-screen.ts` · 读契约 C | 同点/同花的牌连成一条线高亮（亮线提示·零心算） | 出帧 |

## 4. 数值单一真相（doc14·甲乙都读这里·勿散落）
- 费用：`doc14 §九`（0/1/2/3 + MANA_START/PER_TURN）。
- 连携：`doc14 §十`（`COMBO_PAIR=6 / COMBO_TRIPS=12 / SUIT_PER=3 / SUIT_CAP=12`·起手种子·sim 调）。

## 5. 验收
- headless 断言：甲1-3 + 乙3 选牌器（确定性）。出帧：构筑屏/费用角标/连携亮线。
- **全绿 tsc + vitest + build 才推**；完成在 `PROGRAM-G-TASKS.md` 翻棒回馈（提交号/测数）+ `PG-finish-list.md` 记日志。
- 数值 sim：3D-SIM 扫费用曲线 × 连携流 → 胜率矩阵 + 退化告警（全低牌 spam？高牌永不值？同花/同点流唯一最优？）·目标各流派对镜像 ~50%。
