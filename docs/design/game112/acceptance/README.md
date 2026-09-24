# game112《星尾会客厅》验收剧本包（S4 玩法关裁判 · REQ-ACCEPT · Loop-0）

> 作者 = **GD-112**（懂规则方）。剧本 = **纯数据**，harness 驱动**真引擎**逐步对账，断言只读机读态（Resource/Flag/State 字段·**不读 DOM**）。
> PE 落薄适配 `games/game112/acceptance-adapter.ts`（`createWorld/applySignal/readWorld`·纯接线零规则）、不得改本目录剧本；剧本写错 = GD 改 + 记录。规则真相 = `docs/design/game112/gdd.md`（§3.4 离线小事件 · §6.2 关系四量 · §11 回忆 · §12 经济）。
> **步骤名一律用真 UI 动作名**（`games/game112/ui.ts` UI_ACTIONS·词表对齐律），带参动作与宿主 `routeAction` 同表。
> 跑：`npx vite-node scripts/acceptance-run.mjs --game game112`（并进 vitest `scripts/acceptance.test.mjs`·推送门禁自动咬）。**S4 门要 ≥3 剧本 conformance 绿。**

## adapter 投影键（本包断言依赖）

| 断言键 | 语义 | 引擎来源 |
|---|---|---|
| `res: stardust` | 星砂 | 实体 `res-stardust` Resource |
| `res: closeness.xuetuan` / `ease.xuetuan` / `heartlight.xuetuan` / `mood.xuetuan` | 关系四量 | `rel-xuetuan-<key>` Resource（id 全局唯一） |
| `res: item.<id>` | 物品计数 | `res-item-<id>` |
| `flag: own.<id>` / `placed.<id>` | 拥有 / 已放到馆里 | `flag-own-*` / `flag-placed-*` |
| `flag: chapter.xuetuan-1.unlocked` | 章节解锁 | `flag-chapter-*` |
| `comp: {dlg-xuetuan-1, State, current}` | 章节对话游标 | t3-dialogue 的 State |
| `res: offline.count` | 离线小事件在场数 | adapter 合成（Tag 位计数） |

动作词：`cat.greet` · `cat.sit` · `shop.buy{item}` · `decor.place{item}` · `memory.advance` · `memory.choose{index}` · `offline.ack` · `offline.short|long|days` · `restart`。`config.state` = 局外持久态初值（同宿主读档形状）。

## 剧本清单（4 份 · 覆盖 Loop-0 闭环）

| 文件 | seed | 查什么（gdd 依据） |
|---|---|---|
| `01-care-actions-and-mood` | 112 | **陪伴动作一拍反馈 + 兴致自然变化**（§4.1/§6.2）：呼唤/陪坐各自涨对应量、星砂随之来；空等 41 拍兴致 −1；心光/亲近不因空等下降 |
| `02-shop-atomic-and-place` | 112 | **杂货铺可负担才成交、否则整单不动**（§12.4）：星砂 10 买 30 的羽毛杆不动；星砂 50 买成 → 20、计数 1、own 旗；放到馆里 → placed 旗；再买 40 的软垫不动 |
| `03-heartlight-unlocks-memory` | 112 | **心光只增 → 阈值那一拍解锁章节 → 章节读到底**（§11.3）：心光 8 时未解锁；陪坐一次到 10 → 解锁；推进两步到选择、选第二项到 n4b（终节点） |
| `04-offline-event-and-restart` | 112 | **离线小事件恰展开一个、看过即回收；重开不带兴致**（§3.4/§6.2）：offline.long → count 1；offline.ack → 0；restart 后兴致回初值、心光按 config 带回 |

## 覆盖边界（诚实）

- 只验 Loop-0（主厅陪伴 → 星砂 → 杂货铺 → 放到馆里 → 心光解锁回忆）。**星爪牌**（牌规待 owner 对定）、**逗猫**（改视频形态重设计中）、**上传/生成**（引擎 REQ-112-ENG-05/06/11）均无剧本，落地后补 `05+`。
- 数值（+2/+6/+1、价格 30/20/40/50、阈值 10）是 S3 占位（`world-data.ts` 头注），改数只改剧本期望值，不改结构。
