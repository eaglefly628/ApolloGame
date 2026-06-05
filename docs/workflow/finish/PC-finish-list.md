# PC Finish List · 四条需求全落地 —— 可玩棋盘可以装配了

> 给 **PC（Game C《缝纫物语》换装三消）**。你提的 REQ-C-001~004 **全部**下沉为通用引擎能力并落地（全绿：446 passed / tsc 干净 / build 通过）。
> 分支 `claude/mainbranch`，已推。拉最新：`git fetch origin claude/mainbranch && git rebase origin/claude/mainbranch`。
> ⛔ 守 `docs/design/data-driven-manifesto.md`：棋盘/按钮/视频全是蓝图数据装配，**不写游戏 system**。

---

## ✅ 已落地（你的四条）

### REQ-C-001 (P0) · `match3-board` 三消棋盘机制 → `@skills/tier3/match3-board`
印证并补上了引擎缺失的「算法/解释器型机制」大类。config 驱动 + 确定性相位状态机：
`idle(读选格)→swapped(首扫,无连线回退)→match(找≥3)→clear(产料+币,置-1)→fall(下沉)→refill(确定性补块)→连锁→idle`。
- **消除产出走现成 `ResourceModify` → `resource-apply` → 你已装配好的升级/换装/展示链自动点亮，游戏数据不动一行。**
- **怎么装配（全是蓝图纯数据）**：
  1. 一个棋盘单例实体：`MatchBoard{ cols,rows,kindCount, cells:[...初始网格], kindResource:[6 材料 id], matAmount, coinResource, coinPerTile, kindTint:[...], kindLabel:[...], phase:'idle', selIndex:-1, swapA:-1, swapB:-1, stepTimer:0, stepDelay:8, selectAction:'cell' }` + `RandomSeed{seed,sequence:0}`（确定性补块）。
  2. `cols*rows` 个视图格实体（静态建好，capability 只改外观不增删）：每个挂 `BoardCell{boardId, index}` + `Transform`(格子摆位) + `Shape`(box) + `Color` + `Text` + `Clickable{action:'cell'}`。
  3. 把 `match3BoardCapability` 加入 `GAME_C_CAPABILITIES`，并确保有 `clickableCapability`（命中选格）+ `resourceCapability`（结算产料）。
- 点相邻两格 → `clickable` 在格子上发 `Signal'cell'` → match-resolve 选/换/消。`stepDelay` 控制连锁可见节奏。
- 参考：`src/skills/tier3/match3-board.ts`（含纯算法 helper）、`match3-board.test.ts`（12 测试，含"消除产料接 resource-apply""点击驱动交换""确定性"）。

### REQ-C-002 · `clickable` 通用可点击实体 → `@skills/tier2/clickable`
- 任意实体挂 `Clickable{action, phase?}` + `Transform` + `Shape` → 指针命中（逆投影 + AABB，取最上层）在该实体上产出 `Signal{name:action}`。下游按名消费。
- **棋盘格选中、缝纫店按钮、配饰拖拽起点都用它**，不再各写命中测试。确定性（读 InputQueue + 几何比较）。

### REQ-C-003 · `craft-recipe` 主动缝制/经济 → `@skills/tier2/craft-recipe`
- 「可负担才成交、否则整单不动 + 原子扣多料 + 置 flag/state」：`CraftRecipe{ onSignal, costs:[{id,amount}], gains?, grantsFlag?, grantsState? }`。
- **主动缝制**：缝制按钮挂 `Clickable{action:'craft_apron'}` → `CraftRecipe{ onSignal:'craft_apron', costs:[{id:'cloth',amount:8}], grantsFlag:'apron_unlocked' }`。够料→扣料+解锁，不够→不动。（区别于你 v0.1 的被动阈值解锁——主动养成现在能表达了。）

### REQ-C-004 · 爱诗(AIGP)视频后端 → `src/services/aigp`
- 表现层旁路端口（**不进确定性 sim**）。`AishePort.generate(prompt, opts) → 视频句柄`。
  - `NullAishePort`：即时占位句柄（无后端 MVP / 测试），先把"输出点"跑起来。
  - `HttpAishePort`：provider 无关真后端骨架（端点+鉴权可配、注入 fetch），接真视频 API 时适配字段。
- **怎么接（表现/UI 层，不在 sim）**：你的 `theme.composeFullLook(lookId, 已解锁配饰)` 已是纯数据提示词 → UI 点"生成爱诗"时调 `aishePort.generate(composeFullLook(...), {aspect:'9:16'})` 拿句柄展示。

---

## ▶️ 建议下一步（全是蓝图/UI 数据装配）
1. **装配 v0.2 可玩棋盘**：按上面 REQ-C-001 的 1/2/3 在 `game-c/blueprint.ts` 加棋盘单例 + 视图格 + RandomSeed，`kindResource` 指向你那 6 个材料 id → 消除直接喂现有升级链。建议先 `stepDelay:0` 写一个 `game-c` 集成测试（点击交换→材料增长→某件衣服解锁），证端到端，再调 `stepDelay` 做可见连锁。
2. **缝纫店按钮**：每件衣服一个 `Clickable`+`CraftRecipe`（主动缝制），与现有被动阈值链并存。
3. **爱诗输出点**：`AtelierStage.tsx` 加"生成爱诗"按钮 → `NullAishePort`（先占位），后续换 `HttpAishePort`。
4. 守纪律：棋盘布局/材料映射/按钮配方/提示词全是数据；遇到表达不了的再提 request。

参考：`src/skills/tier2/{clickable,craft-recipe}.ts`、`src/skills/tier3/match3-board.ts`、`src/services/aigp/`。
