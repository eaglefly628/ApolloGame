# game101《海港绯闻》· 美术台账（art ledger）

> **机器真相** = `public/games/game101/art/art-ledger.json`（工具读此路径·append-only 保号）。本 md = 人读视图，由 `scripts/game101-art-derive.mjs` 自动生成，**勿手改**（改台账改脚本/JSON）。
> 来源：`deriveRequirements` 扫 `buildBlueprint()` 全视觉实体（PrefabLibrary 物品模板 Sprite 皮肤槽）。
> 风格参照：Claude Design 稿 `MergeBeach.dc.html`（cozy 糖果感）。**美术全部原创·禁抠稿 PNG**（IP 铁律）。
> 消费槽：每行绑一个 `Sprite.textureKey` 皮肤槽（`ledger-audit` 零孤儿）；未填时回退 2D 色块占位。

## 概览

| 分组 | 项数 | 皮肤槽前缀 | 消费方 |
|---|---:|---|---|
| 食材链 | 6 | `item_food_*` | merge 板物品 sprite |
| 渔获链 | 6 | `item_fish_*` | merge 板物品 sprite |
| 薯条链 | 4 | `item_fries_*` | merge 板物品 sprite |
| 咖啡链 | 5 | `item_coffee_*` | merge 板物品 sprite |
| 工具链 | 5 | `item_tool_*` | merge 板物品 sprite |
| **合计** | **31** | | |

> 规格统一：**84×84px·透明底**（2D 俯视·棋盘格内 82% 显示）。状态：⬜ 待美术=当前全部（零真资产·待 S6 生成）。

## 食材链（`food`·6 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-12 | L1 | 番茄（售 3）| `item_food_1` | `#ff6b6b` | 84×84px·透明底 | ⬜ 待美术 |
| art-13 | L2 | 洗净番茄（售 7）| `item_food_2` | `#ff7b7b` | 84×84px·透明底 | ⬜ 待美术 |
| art-14 | L3 | 切片（售 16）| `item_food_3` | `#ff8c8c` | 84×84px·透明底 | ⬜ 待美术 |
| art-15 | L4 | 番茄酱（售 36）| `item_food_4` | `#ff9c9c` | 84×84px·透明底 | ⬜ 待美术 |
| art-16 | L5 | 意面（售 80）| `item_food_5` | `#ffacac` | 84×84px·透明底 | ⬜ 待美术 |
| art-17 | L6 | 招牌意面（售 180）| `item_food_6` | `#ffbcbc` | 84×84px·透明底 | ⬜ 待美术 |

## 渔获链（`fish`·6 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-06 | L1 | 小鱼（售 3）| `item_fish_1` | `#4da6ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-07 | L2 | 鲜鱼（售 7）| `item_fish_2` | `#61b0ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-08 | L3 | 处理好的鱼（售 16）| `item_fish_3` | `#74baff` | 84×84px·透明底 | ⬜ 待美术 |
| art-09 | L4 | 鱼柳（售 36）| `item_fish_4` | `#88c3ff` | 84×84px·透明底 | ⬜ 待美术 |
| art-10 | L5 | 香煎鱼（售 80）| `item_fish_5` | `#9bcdff` | 84×84px·透明底 | ⬜ 待美术 |
| art-11 | L6 | 主厨鱼料理（售 180）| `item_fish_6` | `#afd7ff` | 84×84px·透明底 | ⬜ 待美术 |

## 薯条链（`fries`·4 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-18 | L1 | 土豆（售 3）| `item_fries_1` | `#f4c04d` | 84×84px·透明底 | ⬜ 待美术 |
| art-19 | L2 | 薯块（售 7）| `item_fries_2` | `#f6cc6e` | 84×84px·透明底 | ⬜ 待美术 |
| art-20 | L3 | 薯条（售 16）| `item_fries_3` | `#f8d78e` | 84×84px·透明底 | ⬜ 待美术 |
| art-21 | L4 | 招牌薯条（售 36）| `item_fries_4` | `#fae3af` | 84×84px·透明底 | ⬜ 待美术 |

## 咖啡链（`coffee`·5 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-01 | L1 | 咖啡豆（售 3）| `item_coffee_1` | `#a9744f` | 84×84px·透明底 | ⬜ 待美术 |
| art-02 | L2 | 咖啡粉（售 7）| `item_coffee_2` | `#b58767` | 84×84px·透明底 | ⬜ 待美术 |
| art-03 | L3 | 浓缩咖啡（售 16）| `item_coffee_3` | `#c19a7f` | 84×84px·透明底 | ⬜ 待美术 |
| art-04 | L4 | 拿铁（售 36）| `item_coffee_4` | `#ccad98` | 84×84px·透明底 | ⬜ 待美术 |
| art-05 | L5 | 招牌特调（售 80）| `item_coffee_5` | `#d8c0b0` | 84×84px·透明底 | ⬜ 待美术 |

## 工具链（`tool`·5 级）

| 编号 | 等级 | 物品 | 皮肤槽 skinKey | 占位色 | 规格 | 状态 |
|---|:--:|---|---|---|---|---|
| art-22 | L1 | 螺丝（售 4）| `item_tool_1` | `#9b8cff` | 84×84px·透明底 | ⬜ 待美术 |
| art-23 | L2 | 扳手（售 9）| `item_tool_2` | `#a99cff` | 84×84px·透明底 | ⬜ 待美术 |
| art-24 | L3 | 工具包（售 20）| `item_tool_3` | `#b7acff` | 84×84px·透明底 | ⬜ 待美术 |
| art-25 | L4 | 电钻（售 45）| `item_tool_4` | `#c4bbff` | 84×84px·透明底 | ⬜ 待美术 |
| art-26 | L5 | 维修套装（售 100）| `item_tool_5` | `#d2cbff` | 84×84px·透明底 | ⬜ 待美术 |

---
共 31 项皮肤槽。生成/替换走 art-pipeline（`docs/playbooks/art-pipeline.md`）：台账→风格锚→一键全量→写回→人审。
