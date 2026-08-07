# game108 验收剧本 · 动作词表与机读态

**剧本作者 = GD**（条款出处 `gdd.md §15` 表·S2 时已写定）；**PE 修码不改剧本**——
剧本错 = GD 改并留痕（owner 2026-07-17「绿门不可玩」复盘立的循环律）。

## 动作名（`signal`）——就是屏上的 `data-action`【R-108-70·词表对齐律】

| 动作 | 含义 |
|---|---|
| `charge.rock` / `charge.paper` / `charge.scissors` | T1 蓄该手（+1·封顶 3） |
| `throw.rock` / `throw.paper` / `throw.scissors` | T2 出该手 |
| `smoke.use` / `shard.pick` / `duel.next` | 烟雾 / 选碎片 / 下一场（**尚未接线**·S4 后续） |

唯一真相 = `games/game108/theme.ts` 的 `ACT`。屏上按钮的 `action`、DOM 的 `data-action`、
本目录剧本的 `signal`，**三处同一串字符**——机器才点得动（game-a 曾因两套词表各写各的，可驱动率 0/19）。

`by:"p2"` = **剧本指定对手这回合出什么**，等价于人类对手按了那个键；
**不是 AI 决策**（AI 自己选哪只手 = 【R-108-30】·见 `requests.md REQ-108-ENG-05`）。

## 机读态（断言目标）

| 名字 | 是什么 |
|---|---|
| `res: p1.hp` / `p2.hp` | 双方血量（**投影**：两侧 Resource 同 id `hp`，全局断言分不清侧，故适配层投成各侧唯一名） |
| `res: <侧>.charge.<手>` | 六条蓄力槽（本就各侧唯一·直读） |
| `sv: flow` | 当前时区（**投影**：`GameFlow.current` 不是标量组件） |
| `sv: <侧>.lastThrow` | 该侧本回合出的手 |
| `flag: <侧>.dead` | 该侧是否已倒下 |

## 跑法

```
npx vite-node scripts/acceptance-run.mjs -- --game game108
```

## 当前状态（2026-08-07）

**4 绿 / 1 红**。红的是剧本①的**时序断言**，不是数值——伤害 30、诈唬不清零、平局、封顶全对，
问题是**结算发生在 T2 而条款要求在 T4**（`requests.md REQ-108-ENG-06`·待 owner 判 A/B）。
**剧本不改**：条款是裁判，红着等实现追上来。

`gdd.md §15` 还有 6 条（改表 / 增维 / 逆转 / 烟雾 / 超时顺延 / 确定性）尚未转成文件——
它们依赖遗物、烟雾、超时顺延这些还没接线的玩法面，S4 后续补。
