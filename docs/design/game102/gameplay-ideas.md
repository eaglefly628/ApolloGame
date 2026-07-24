# game102 · 新玩法讨论 & 可行性评审（PE/架构 ⇄ GD·2026-07-24）

> owner「和策划讨论新玩法、看能不能实现」。判据（CLAUDE.md 核心规则）：能**组合现有 capability** 表达→✅ 做；
> 需小扩/换核→🔶 报 Lead 走下沉；要写游戏层自由代码/neighbor 自由逻辑→❌ 倾向回驳。
> 底盘（实名·已核源码）：`t3-match3-board`(重力/补块/连锁/格层/特殊件) · `t3-block-grid`(连通消/整行列) ·
> `t2-group-count/launch/hitbox/mortal/collision-resolve` · `b2-acceleration`+`motion-apply`(物理) ·
> `t2-event-when/effect-apply` · `t3-flow` · `t2-tray/zone-occupancy` · `t3-timeline` · `w1-random` · `t2-gauge`。

## 0. 一个必须先拍的架构岔口（决定一半玩法可行性）

**棋盘核跑在哪套能力上？**
- **① 裸 BoardCell + group-count（现状）**：我 S3 建的一格一实体。消同色=group-count+effect-apply。
  重力/连锁/隐藏层要**另接物理或自写**→ 部分 🔶。
- **② 换核 `t3-match3-board`**：**白拿** 重力下沉/补块/连锁/格层(隐藏图案)/特殊件/目标——全 config 数据。
  代价：它是**交换找连**式相位机，我们是**倒色消同色**，clear 触发方式要对接（match3-board 能否「按色整清」＝待验，可能小扩）。

> **建议**：核心循环若要「消除→坍塌→连锁」的爽感，倾向 ② 换核 match3-board（省掉自造重力/连锁）；
> 撞到「按色整清」表达不了再报 Lead 小扩。此岔口请 owner/GD 先定，我据此定 S4 装配。

## 1. 玩法清单 × 可行性

| # | 玩法 | 可行性 | 用什么能力 / 缺口 |
|---|---|---|---|
| 1 | **倒色消同色**（点补给色→整幅画里该色格清除、逐步显图） | ✅ | `group-count`(按色数)+`effect-apply`(清除)+视图同步 |
| 2 | **传送带自动开火**（色炮到发射位自动喷同色·GDD 原案） | ✅ | `zone-occupancy`+`event-when`+`launch`+`group-count`（Lead 裁①已准组合） |
| 3 | **重力坍塌 + 连锁**（清一片→上方落下→触发新消除） | 🔶→✅(换核) | `t3-match3-board` fall/refill/cascade **白拿**；裸核则需下沉 gravity-settle |
| 4 | **南瓜头打碎掉落**（南瓜清除→碎块下落砸开下方） | ✅ | `spawn/prefab`(碎块)+`b2-acceleration`(重力)+`motion-apply`+`collision-resolve/hitbox`(落地清) |
| 5 | **钥匙路径解谜**（钥匙嵌画里·选对色/顺序打通→命中钥匙） | ✅ | 消除+`event-when`(钥匙格清→`gauge`+1)+`flow`；可解性=authoring balance-sim 校验(game-t 范式) |
| 6 | **宝箱门目标**（集齐钥匙→门开→过关） | ✅ | `event-when`(钥匙 gauge==needKeys)→开门信号+`gauge`+`flow` |
| 7 | **硬块多血**（cell hp>1·需多发同色） | ✅ | 每格 `Resource(hp)`（schema 已有 hp 层） |
| 8 | **隐藏图案层**（清表层→露出底层图案/收集画） | 🔶→✅(换核) | `t3-match3-board` 格层(cell-layer) 原生；裸核=game-t LayerCell 路线 |
| 9 | **道具·炸弹**（清一片区域） | ✅ | `launch/hitbox` AOE + `effect-apply` |
| 10 | **道具·彩虹炮**（打任意色） | ✅ | 色炮 Tag 掩码=全色位（含齐语义天然匹配所有） |
| 11 | **道具·刷新补给** | ✅ | `w1-random` `seededShuffle` 重排补给队列 |
| 12 | **限色预算 / 限步 / 限时** | ✅ | 每色 `Resource(ammo)` + `limit`(moves/time) schema 已有 |
| 13 | **图鉴收集**（通关得整幅像素画收藏） | ✅ | 元层 meta（localStorage·非 sim） |
| 14 | **连击/突破**（快连续 combo·临时容量 5→10） | ✅ | 消除边沿续 `gauge` + `event-when` 条件树切 `zone-occupancy` 容量数据 |
| 15 | **颜色混合**（倒 A 于 B→邻格混成 C） | 🔶/❌ | 需**读邻格**转换；`self-rule` 只读自身→缺口。倾向回驳，除非下沉一个 neighbor-transform 通用件 |
| 16 | **杂草蔓延**（未清色每回合向邻格扩散·施压） | 🔶/❌ | 元胞自动机(读邻格)→无现成 CA 件·`self-rule` 读不了邻格→缺口。倾向回驳或明确下沉一个 neighbor-rule cap |

## 2. 建议的 MVP 玩法脊（全 ✅ 组合·守 Lead 裁①）

**核心循环**：倒色消同色(1) → 钥匙路径解谜(5) → 集齐开门过关(6)，配 硬块(7) + 连击突破(14) + 道具三件(9/10/11) + 限步/限时(12)。
**高价值 ✅ 加料**：南瓜头打碎掉落(4·物理链) + 图鉴收集(13)。
**待岔口定**：重力坍塌连锁(3) + 隐藏层(8) —— 换核 `t3-match3-board` 即白拿；否则走裸核 + 小下沉。**请 owner/GD 先拍 §0 岔口。**
**倾向回驳**：颜色混合(15) / 杂草蔓延(16) —— 需 neighbor 自由逻辑，现有能力表达不了；真要做走 requests.md 报缺口、由 Lead 裁是否下沉一个通用「邻格规则」件（服务本类+未来 CA 玩法），**绝不游戏层自写**。

## 3. 下一步

1. owner/GD 拍 §0 棋盘核岔口（match3-board 换核 or 裸核）。
2. GD 出 S4 验收剧本(≥3 场景·纯数据·gate 卡)，PE 据选定脊装配玩法链。
3. 🔶 项（3/8/15/16）如要做，回 `docs/design/game102/requests.md` 报缺口→Lead 裁下沉。
