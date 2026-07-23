# game101 · 配置表结构与默认数值 (Config Schema v1)

> 数据驱动落地文档。所有玩法内容走这些表，逻辑层只读表、由现有能力解释（见 `capability-plan.md`），不硬编码。
> 默认值供 M1 灰盒直接用，后续按功率曲线/留存/体力墙触发率灰度调优。
> 格式以 JSON 描述玩法数据；接线时转为引擎 manifest（entities/components）+ 现有 capability 的 config 组件。

---

## 1. 全局 `game.json`

```json
{
  "board": { "cols": 7, "rows": 7 },
  "mergeNeed": 2,
  "seed": "injected-per-run",
  "startEnergy": 100
}
```

## 2. 物品链 `chains.json`（→ `merge-rule`：每链每级一条 MergeRule need:2 into 次级）

```json
[
  {
    "id": "food",
    "name": "食材链",
    "levels": [
      { "lvl": 1, "item": "food_1", "name": "番茄",       "sell": 3,   "sprite": "item_food_1" },
      { "lvl": 2, "item": "food_2", "name": "洗净番茄",   "sell": 7,   "sprite": "item_food_2" },
      { "lvl": 3, "item": "food_3", "name": "切片",       "sell": 16,  "sprite": "item_food_3" },
      { "lvl": 4, "item": "food_4", "name": "番茄酱",     "sell": 36,  "sprite": "item_food_4" },
      { "lvl": 5, "item": "food_5", "name": "意面",       "sell": 80,  "sprite": "item_food_5" },
      { "lvl": 6, "item": "food_6", "name": "招牌意面",   "sell": 180, "sprite": "item_food_6" }
    ]
  },
  {
    "id": "fish",
    "name": "渔获链",
    "levels": [
      { "lvl": 1, "item": "fish_1", "name": "小鱼",       "sell": 3,   "sprite": "item_fish_1" },
      { "lvl": 2, "item": "fish_2", "name": "鲜鱼",       "sell": 7,   "sprite": "item_fish_2" },
      { "lvl": 3, "item": "fish_3", "name": "处理好的鱼", "sell": 16,  "sprite": "item_fish_3" },
      { "lvl": 4, "item": "fish_4", "name": "鱼柳",       "sell": 36,  "sprite": "item_fish_4" },
      { "lvl": 5, "item": "fish_5", "name": "香煎鱼",     "sell": 80,  "sprite": "item_fish_5" },
      { "lvl": 6, "item": "fish_6", "name": "主厨鱼料理", "sell": 180, "sprite": "item_fish_6" }
    ]
  },
  {
    "id": "coffee",
    "name": "咖啡链（owner 举例）",
    "levels": [
      { "lvl": 1, "item": "coffee_1", "name": "咖啡豆",   "sell": 3,   "sprite": "item_coffee_1" },
      { "lvl": 2, "item": "coffee_2", "name": "咖啡粉",   "sell": 7,   "sprite": "item_coffee_2" },
      { "lvl": 3, "item": "coffee_3", "name": "浓缩咖啡", "sell": 16,  "sprite": "item_coffee_3" },
      { "lvl": 4, "item": "coffee_4", "name": "拿铁",     "sell": 36,  "sprite": "item_coffee_4" },
      { "lvl": 5, "item": "coffee_5", "name": "招牌特调", "sell": 80,  "sprite": "item_coffee_5" }
    ]
  },
  {
    "id": "tool",
    "name": "工具链",
    "levels": [
      { "lvl": 1, "item": "tool_1", "name": "螺丝",     "sell": 4,   "sprite": "item_tool_1" },
      { "lvl": 2, "item": "tool_2", "name": "扳手",     "sell": 9,   "sprite": "item_tool_2" },
      { "lvl": 3, "item": "tool_3", "name": "工具包",   "sell": 20,  "sprite": "item_tool_3" },
      { "lvl": 4, "item": "tool_4", "name": "电钻",     "sell": 45,  "sprite": "item_tool_4" },
      { "lvl": 5, "item": "tool_5", "name": "维修套装", "sell": 100, "sprite": "item_tool_5" }
    ]
  }
]
```
> 展开成 MergeRule：`{template:"food_1", need:2, into:"food_2"}` … 到 `food_5→food_6`；`food_6` 不写规则=封顶。价值曲线 `sell` 每级 ≈×2.2（往高合更划算）。

## 3. 生成器 `generators.json`（→ `prefab-spawn`+`w1-random`+`clickable`+`f1-resource`·门控 G1；`cooldownSec`→`timer-advance` G4）

```json
[
  {
    "id": "gen_coffee", "name": "咖啡机", "energyCost": 1, "cooldownSec": 0, "sprite": "gen_coffee",
    "dropTable": [ { "item": "coffee_1", "w": 65 }, { "item": "coffee_2", "w": 35 } ]
  },
  {
    "id": "gen_fridge", "name": "冰箱", "energyCost": 1, "cooldownSec": 0, "sprite": "gen_fridge",
    "dropTable": [ { "item": "food_1", "w": 60 }, { "item": "food_2", "w": 30 }, { "item": "food_3", "w": 10 } ]
  },
  {
    "id": "gen_fishbox", "name": "渔获箱", "energyCost": 1, "cooldownSec": 0, "sprite": "gen_fishbox",
    "dropTable": [ { "item": "fish_1", "w": 60 }, { "item": "fish_2", "w": 30 }, { "item": "fish_3", "w": 10 } ]
  },
  {
    "id": "gen_toolbox", "name": "工具箱", "energyCost": 1, "cooldownSec": 8, "sprite": "gen_toolbox",
    "dropTable": [ { "item": "tool_1", "w": 70 }, { "item": "tool_2", "w": 30 } ]
  }
]
```
> `咖啡机/冰箱`=owner 举例。`cooldownSec`>0 = owner「生成器冷却 CD」：产出后冷却 N 秒才能再点（工具箱示例 8s·促碎片化）。免体力生成器（M4·G4）追加 `"energyCost": 0, "capacity": 10, "regenSec": 30`（产能条）。`w` = 权重（种子 PRNG 加权抽样）。

## 3.5 泡泡 `bubbles.json`（owner「泡泡购买」·金币回收/变现·→ `resource-apply`+`f2-flag`+`clickable`·G3）

```json
{
  "coinCostByLevel": { "1": 8, "2": 16, "3": 40, "4": 90, "5": 200 },
  "note": "新产出物被临时泡泡包住=locked flag；点泡泡→按物品等级扣金币→清 flag（可合并/可拖）。金币不足=拒绝。这是官方金币回收出口。"
}
```

## 4. 体力 `energy.json`（→ `f1-resource`+`timer-advance`）

```json
{
  "cap": 100,
  "regenPerTick": 1,
  "regenIntervalSec": 120,
  "overcapAllowed": true,
  "sources": { "orderReward": "见 orders.json", "storyReward": "见 story.json" }
}
```
> 空→满 ≈ 200min ≈ 3.3h。`overcapAllowed`=奖励/充值可临时超 100。

## 5. 订单 `orders.json`（→ `drop-zone`+`event-when`+`effect-apply`；G2 待裁 craft-recipe 适配）

```json
[
  { "id": "o_latte", "char": "sudarling", "needItem": "coffee_4", "qty": 1, "reward": { "exp": 12, "coins": 70,  "energy": 0, "stars": 2 } },
  { "id": "o_pasta", "char": "sudarling", "needItem": "food_5",   "qty": 1, "reward": { "exp": 15, "coins": 90,  "energy": 0, "stars": 2 } },
  { "id": "o_fish",  "char": "zhouhang",  "needItem": "fish_4",   "qty": 1, "reward": { "exp": 8,  "coins": 45,  "energy": 5, "stars": 1 } },
  { "id": "o_fix",   "char": "laochen",   "needItem": "tool_4",   "qty": 1, "reward": { "exp": 10, "coins": 60,  "energy": 0, "stars": 2 } },
  { "id": "o_combo", "char": "ayana",     "needItem": "food_6",   "qty": 1, "reward": { "exp": 30, "coins": 200, "energy": 0, "stars": 3 } }
]
```
> 交付=拖 needItem 到订单区消耗→按 reward 发**经验+金币+星星(+能量)**（`effect-apply`）。经验累积升等级（见 §4.5）。订单随时刷新、可跳过。

## 4.5 玩家等级 `levels.json`（经验→等级·→ `f1-resource`）

```json
{ "expToNext": "40 + level * 25", "unlocksByLevel": { "3": "gen_fishbox", "5": "gen_toolbox", "8": "board_expand_1" } }
```
> 订单产出经验；满级阈值解锁新生成器/扩板等（数据驱动·`event-when`/`effect-apply`）。

## 6. 剧情/天 `story.json`（→ `event-when`+`effect-apply`+`f2-flag`；演出走 `dialogue`）

```json
[
  {
    "day": 1, "title": "回到汐味馆",
    "tasks": [
      { "id": "d1_clean",  "desc": "打扫后厨的狼藉", "costStars": 3, "renovate": "kitchen_clean" },
      { "id": "d1_bar",    "desc": "修好破损的吧台", "needItem": "tool_4", "renovate": "bar_fix" },
      { "id": "d1_talk",   "desc": "和苏晴谈谈",     "costStars": 2 }
    ],
    "onComplete": { "dialogue": "script_day1_end", "unlockDay": 2 }
  }
]
```

## 7. 装修 `renovation.json`（→ `f2-flag` 解锁 + Sprite 皮肤槽切换）

```json
[
  {
    "id": "bar_fix", "scene": "restaurant", "region": "前厅", "action": "fix", "costStars": 5,
    "name": "吧台", "story": "script_day1_bar",
    "styles": [
      { "id": "wood",   "name": "温馨木质", "sprite": "reno_bar_wood" },
      { "id": "modern", "name": "现代简约", "sprite": "reno_bar_modern" },
      { "id": "ocean",  "name": "复古海洋", "sprite": "reno_bar_ocean" }
    ],
    "default": "wood", "changeable": true
  }
]
```
> `action` ∈ 清洁 clean / 修复 fix / 装修 decorate（owner 三类动作）；破败建筑按 `region` 分多区域；`styles` = **3 选 1** 外观（owner·可回改 `changeable`）；花 `costStars` 完成 → 解锁 flag + 切皮肤 + 触发 `story` 一段主线剧情。

## 8. 剧情脚本 `dialogue/script_day1_end.json`（→ `dialogue`）

```json
{
  "id": "script_day1_end", "bg": "cg_restaurant_night",
  "lines": [
    { "who": "林夏", "portrait": "linxia_calm",    "text": "总算把后厨清出来了……妈，我会把汐味馆撑起来的。" },
    { "who": "周航", "portrait": "zhouhang_smile",  "text": "刚靠岸，给你留了最新鲜的一批鱼。" },
    { "who": "林夏", "portrait": "linxia_surprise", "text": "（这箱鱂里……怎么有张纸条？）" }
  ],
  "choices": []
}
```
> `choices` 留空=线性；M2 可加二选一弱分支（代入感·不做重分叉）。

## 9. 演出 juice `juice.json`（→ `timeline`+`effect-apply`）

```json
{
  "merge":   { "fx": "burst_star",   "durMs": 300 },
  "deliver": { "fx": "fly_to_hud",   "durMs": 400 },
  "popBubble": { "fx": "bubble_pop", "durMs": 200 },
  "genTap":  { "fx": "press_pop",    "durMs": 180 }
}
```

---

*配套：`gdd.md`（策划案）、`capability-plan.md`（能力映射与缺口）、`ui-brief.md`（设计稿规格）。数值均为 M1 起点。*
