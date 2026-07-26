# game101《海港绯闻》· 美术台账（art ledger）

> **机器真相** = `public/games/game101/art/art-ledger.json`（工具读此路径·append-only 保号）。本 md = 人读视图，由 `scripts/game101-art-derive.mjs` 自动生成，**勿手改**（改台账改脚本/JSON）。
> 来源：`deriveRequirements` 扫 `buildBlueprint()` 全视觉实体（PrefabLibrary 物品模板 Sprite 皮肤槽）。
> 风格参照：Claude Design 稿 `MergeBeach.dc.html`（cozy 糖果感）。**美术全部原创·禁抠稿 PNG**（IP 铁律）。
> 消费槽：每行绑一个 `Sprite.textureKey` 皮肤槽（`ledger-audit` 零孤儿）；未填时回退 2D 色块占位。

## 概览

| 分组 | 项数 | 皮肤槽前缀 | 消费方 |
|---|---:|---|---|
| 粮食链 | 9 | `item_food_*` | merge 板物品 sprite |
| 渔获链 | 9 | `item_fish_*` | merge 板物品 sprite |
| 蔬果链 | 7 | `item_fries_*` | merge 板物品 sprite |
| 饮品链 | 8 | `item_coffee_*` | merge 板物品 sprite |
| 甜点链 | 8 | `item_tool_*` | merge 板物品 sprite |
| **合计** | **48** | | |

> 规格统一：**84×84px·透明底**（2D 俯视·棋盘格内 82% 显示）。状态：⬜ 待美术=当前全部（零真资产·待 S6 生成）。

## 粮食链（`food`·9 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-12 | L1 | 稻谷（售 3）| `item_food_1` | `#ff6b6b` | 84×84px·透明底 | ⬜ 待美术 |
| art-13 | L2 | 米饭（售 7）| `item_food_2` | `#ff7575` | 84×84px·透明底 | ⬜ 待美术 |
| art-14 | L3 | 面包（售 16）| `item_food_3` | `#ff7f7f` | 84×84px·透明底 | ⬜ 待美术 |
| art-15 | L4 | 可颂（售 36）| `item_food_4` | `#ff8a8a` | 84×84px·透明底 | ⬜ 待美术 |
| art-16 | L5 | 蛋糕（售 80）| `item_food_5` | `#ff9494` | 84×84px·透明底 | ⬜ 待美术 |
| art-17 | L6 | 华丽蛋糕（售 180）| `item_food_6` | `#ff9e9e` | 84×84px·透明底 | ⬜ 待美术 |
| art-39 | L7 | 派（售 400）| `item_food_7` | `#ffa8a8` | 84×84px·透明底 | ⬜ 待美术 |
| art-40 | L8 | 圣代（售 880）| `item_food_8` | `#ffb2b2` | 84×84px·透明底 | ⬜ 待美术 |
| art-41 | L9 | 盛宴（售 1900）| `item_food_9` | `#ffbcbc` | 84×84px·透明底 | ⬜ 待美术 |

## 渔获链（`fish`·9 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-06 | L1 | 小鱼（售 3）| `item_fish_1` | `#4da6ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-07 | L2 | 鲜鱼（售 7）| `item_fish_2` | `#59acff` | 84×84px·透明底 | ⬜ 待美术 |
| art-08 | L3 | 鲜虾（售 16）| `item_fish_3` | `#65b2ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-09 | L4 | 寿司（售 36）| `item_fish_4` | `#72b8ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-10 | L5 | 鱼板（售 80）| `item_fish_5` | `#7ebeff` | 84×84px·透明底 | ⬜ 待美术 |
| art-11 | L6 | 海鲜便当（售 180）| `item_fish_6` | `#8ac5ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-36 | L7 | 炸虾（售 400）| `item_fish_7` | `#96cbff` | 84×84px·透明底 | ⬜ 待美术 |
| art-37 | L8 | 关东煮（售 880）| `item_fish_8` | `#a3d1ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-38 | L9 | 海鲜锅（售 1900）| `item_fish_9` | `#afd7ff` | 84×84px·透明底 | ⬜ 待美术 |

## 蔬果链（`fries`·7 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-18 | L1 | 土豆（售 3）| `item_fries_1` | `#f4c04d` | 84×84px·透明底 | ⬜ 待美术 |
| art-19 | L2 | 胡萝卜（售 7）| `item_fries_2` | `#f5c65d` | 84×84px·透明底 | ⬜ 待美术 |
| art-20 | L3 | 沙拉（售 16）| `item_fries_3` | `#f6cc6e` | 84×84px·透明底 | ⬜ 待美术 |
| art-21 | L4 | 蔬菜煲（售 36）| `item_fries_4` | `#f7d17e` | 84×84px·透明底 | ⬜ 待美术 |
| art-42 | L5 | 玉米（售 80）| `item_fries_5` | `#f8d78e` | 84×84px·透明底 | ⬜ 待美术 |
| art-43 | L6 | 炖菜（售 180）| `item_fries_6` | `#f9dd9f` | 84×84px·透明底 | ⬜ 待美术 |
| art-44 | L7 | 咖喱（售 400）| `item_fries_7` | `#fae3af` | 84×84px·透明底 | ⬜ 待美术 |

## 饮品链（`coffee`·8 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-01 | L1 | 咖啡豆（售 3）| `item_coffee_1` | `#a9744f` | 84×84px·透明底 | ⬜ 待美术 |
| art-02 | L2 | 咖啡（售 7）| `item_coffee_2` | `#b07f5d` | 84×84px·透明底 | ⬜ 待美术 |
| art-03 | L3 | 拿铁（售 16）| `item_coffee_3` | `#b78a6b` | 84×84px·透明底 | ⬜ 待美术 |
| art-04 | L4 | 冰饮（售 36）| `item_coffee_4` | `#bd9578` | 84×84px·透明底 | ⬜ 待美术 |
| art-05 | L5 | 奶茶（售 80）| `item_coffee_5` | `#c4a086` | 84×84px·透明底 | ⬜ 待美术 |
| art-33 | L6 | 果汁（售 180）| `item_coffee_6` | `#cbab94` | 84×84px·透明底 | ⬜ 待美术 |
| art-34 | L7 | 花茶（售 400）| `item_coffee_7` | `#d2b6a2` | 84×84px·透明底 | ⬜ 待美术 |
| art-35 | L8 | 鸡尾酒（售 880）| `item_coffee_8` | `#d8c0b0` | 84×84px·透明底 | ⬜ 待美术 |

## 甜点链（`tool`·8 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-22 | L1 | 巧克力（售 4）| `item_tool_1` | `#9b8cff` | 84×84px·透明底 | ⬜ 待美术 |
| art-23 | L2 | 糖果（售 9）| `item_tool_2` | `#a395ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-24 | L3 | 甜甜圈（售 20）| `item_tool_3` | `#ab9eff` | 84×84px·透明底 | ⬜ 待美术 |
| art-25 | L4 | 纸杯蛋糕（售 45）| `item_tool_4` | `#b3a7ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-26 | L5 | 华夫饼（售 100）| `item_tool_5` | `#bab0ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-46 | L6 | 棒棒糖（售 220）| `item_tool_6` | `#c2b9ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-47 | L7 | 曲奇（售 480）| `item_tool_7` | `#cac2ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-48 | L8 | 蜜罐（售 1050）| `item_tool_8` | `#d2cbff` | 84×84px·透明底 | ⬜ 待美术 |

---
共 48 项皮肤槽。生成/替换走 art-pipeline（`docs/playbooks/art-pipeline.md`）：台账→风格锚→一键全量→写回→人审。
