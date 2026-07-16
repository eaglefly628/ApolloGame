# game-t 关卡表 Schema + 验证环（Lead 定稿 v1·GD 照此产 30 关）

## 一、单关 schema（纯数据·一关一条）

```jsonc
{
  "no": 1,                        // 关号 1..30（稳定主键·保号）
  "type": "score",               // 关型闭集: score | collect | jelly | blocker | mixed
  "cols": 7, "rows": 9,          // 竖屏板型（cols∈[6,8] rows∈[8,10]）
  "kinds": 4,                     // 色数 4..6（墨玉/朱砂/缃金/竹青[/天青/藕紫]）
  "moves": 30,                    // 步数上限
  "goals": [                      // 目标闭集（mixed=多条）
    { "kind": "score", "n": 12000 },
    { "kind": "collect", "color": 2, "n": 20 },
    { "kind": "jelly" },          // 洗净全部墨渍（数量由 layout 推导）
    { "kind": "blocker" }         // 破尽冰纹瓷（同上·砚石不计入）
  ],
  "stars": [12000, 18000, 26000], // 1/2/3 星分数阈（1 星须 ≥ 达标线）
  "seed": 10001,                  // 本关确定性种子（补块/洗砚）
  "layout": {                     // 字符画·每行一串·长度=cols·行数=rows（GD 手写友好）
    "board": [".......", ...],   //  .=随机补  0-5=指定色摆盘（教学关保 4/5 连必现）
    "jelly": [".......", ...],   //  .=无  1/2=墨渍层数
    "blockers": [".......", ...] //  .=无  1-3=冰纹瓷 hp  S=砚石(不可动)
  },
  "note": "教学：首次 4 连必现局"
}
```

- **装配映射**（PE·纯转换零逻辑）：字符画 → `t3-match3-board` config 的 cells 摆盘 / `jelly[]` / `blockers[]`（S=-1）；goals → `jellyResource`/`blockerResource`/`kindResource`/`movesResource` + `event-when`/`effect-apply` 胜负链；stars → 结算数据。
- 30 关分布框架与通关率目标带见 GDD §三、§四——**逐关 moves/stars 数值必须过 sim 定标，不许拍脑袋**。

## 二、验证环（GD 的 balance-sim·关卡表的机器门）

1. **确定性 bot**：贪心策略（枚举全部合法交换→优先"达成目标增量最大"，平手取 index 序）——不追求最优，模拟中位玩家。
2. **跑法**：每关 × 200 seeds（`seed+i`）→ 输出：通关率 / 平均剩步 / 分数分布 P50·P85 / 目标达成曲线。
3. **定标**：moves 定为「bot 平均所需步 × 裕度」（GDD §四·1.4→1.1 递减）；2/3 星阈=分数 P50/P85；通关率落 GDD 目标带外=改 moves/layout 重跑。
4. **报表落档**：`docs/design/game-t/balance-report.md`（sim 版本+日期+逐关表）——关卡表变更必须重跑（陈旧报表=过期信号）。
5. bot/sim 全用引擎导出的纯函数（findMatches/resolveClear/applyGravity/refillEmpty/classifySpawns）——**零自写规则副本**（防 sim 与引擎口径漂移）。

## 三、GD 交付清单

- `docs/design/game-t/levels.jsonc`（30 行·本 schema）+ balance-sim 脚本 + balance-report。
- 摆盘教学关（3/7/12）人工验证特殊棋子必现。
- 文案表：关名（水墨意象·原创）+ 目标描述短句（UI 直用）。
