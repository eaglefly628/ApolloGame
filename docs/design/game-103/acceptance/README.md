# game-103《幸存者》验收剧本包（S4 玩法关裁判 · REQ-ACCEPT）

> 作者=GD-103（懂规则方）。剧本=**纯数据**，harness 驱动**真引擎**逐步对账，断言只读机读态（Resource/Flag/StringVar/Component·**不读 DOM**）。
> PE 落薄适配 `src/games/game-103/acceptance-adapter.ts`（`createWorld/applySignal/readWorld`·**纯接线零规则**）、**不得改本目录剧本**；剧本写错=GD 改+记录。规则真相=`docs/design/game-103/gdd.md`。
> 跑：`npx vite-node scripts/acceptance-run.mjs --game game-103`（并进 vitest `scripts/acceptance.test.mjs`·推送门禁自动咬）。**S4 门要 ≥3 剧本 conformance 绿。**

## PE 需落的 adapter 投影键（本包断言依赖）

| 断言键 | 语义 | 引擎来源（PE 接） |
|---|---|---|
| `res: hp` | 玩家生命 | 实体 `player` 的 `Resource` current |
| `res: xp` | 当前经验 | 实体 `collector` 的 `Resource` current |
| `res: level` | 等级 | 实体 `level` 的 `Resource` current |
| `res: clock` | 存活秒数 | 实体 `clock` 的 `Resource` current |
| `res: kills` | 累计击杀 | 实体 `killbox` 的 `Resource` current |
| `sv: status` | 局态 | `flow` 的 `GameFlow.current`（`playing`/`victory`/`defeat`）投成 StringVar |

> `applySignal` 需转发：`pick_<key>`（三选一选项）、`restart`。移动**非必需**（本包剧本让敌自来·玩家不动即可触发核心循环）；若后续要走位剧本，adapter 补转发方向输入。

## 剧本清单（5 份 · 覆盖已实现核心）

| 文件 | seed | 查什么（gdd 依据） |
|---|---|---|
| `01-core-loop-kill-xp` | 7 | **核心循环**：武器自动索敌开火→击杀→掉经验被拾（§一/§四）→ kills≥1 且 xp≥1（不靠走位） |
| `02-levelup-advances` | 7 | **升级触发**：经验累计过 LEVEL_XP=5 → 等级≥2（§五/§八·升级三选一入口） |
| `03-survival-clock-advances` | 7 | **存活计时**：clock 每秒+1 稳定推进、开局可活（§九）→ 10s 后 clock≥9 且 hp≥1 且 status=playing |
| `04-levelup-pick-consumed` | 7 | **三选一 draft 接线**：升级后发 `pick_shock` → 信号被消费、sim 不炸、局面继续（§八·draft-offer E1） |
| `05-victory-survive-to-clock` | 7 | **胜负判定·胜**：活满 MATCH_SECONDS → status=victory（§九）。**需 config 短局**（见下） |

## 覆盖边界（诚实·随实现推进补）

- **本包只验已实现的核心循环**（走位免·自动攻击·经验·升级入口·计时·胜判）。
- **未覆盖（因功能未落地·见 `../requests.md` 符合度 review）**：
  - **进化系统**（gdd §4.2 头号爽点·**未实现**）→ 无剧本，实现后补 `06-evolve-*`。
  - **被动多样性效果**（移速/攻速/范围等·卡引擎 `REQ-被动轴` 桥）→ pick 的**属性效果**当前在 world 态不可断言，故 04 只验"信号消费不炸"；被动轴桥通后补"pick_blade→伤害提升→击杀更快"式行为剧本。
  - **失败判定**（status=defeat）：需玩家确定性被打死——当前自动攻击会清场、静止玩家未必死；待加 `config` 弱化档或高密度档后补 `07-defeat-*`（先不硬凑脆剧本）。
- **config 依赖**：`05` 需 adapter 支持 `config:{matchSeconds}` 覆盖缩短单局（否则需 tick 到 54000=15min·CI 太重）。PE 若一时不接 config，`05` 暂标 skip、以 01–04（≥3）过 S4 门；config 接上再纳入。

## seed 说明

全部 seed=7（引擎种子 PRNG·同 seed 同轨）。剧本用 `gte/lte` 阈值断言（非钉死绝对值·对实时轨迹稳健）；若某 seed 下敌群轨迹不触目标（如 10s 内零击杀），GD 换命中该线的 seed（同 game-a 先例·机制不弱化）。变异自查：改坏对应逻辑应打红目标剧本——去掉武器开火→01 红；升级不记账→02 红；clock 不推→03 红；draft 信号未接→04 红；胜判失效→05 红。
