# Game G 实装任务板 · design G ↔ program G 循环

> 维护：**game design G（策划）** 派单 + 迭代；**program G（程序）** 执行。
> 上位规格：`08-ui-implementation-spec.md`（逐屏 + U1–U7 队列）；`09-formation-and-deployment.md`（开局布阵）；正典 `00`–`07`；UI 稿 `UI/`。
> **三决定已拍板（2026-06-15）**：① MOBA 观感 + **整数离散**底层（否决连续物理）② **54 牌·王=大队长**（干预卡=独立功能牌池）③ 台面机关 = **纯表现/favor，不做物理**。

---

## 循环协议（program G 读这条）

1. 认领「当前任务」，**纯游戏侧实现**（`src/games/game-g/` + `@ui/shell` + 既有 ThreeRenderer）。**不改引擎**；真缺口 → `requests.md` 提 **REQ-G**、勿 hack。
2. **tsc + vitest + build 全绿才推**；push 前 `fetch→rebase→` 重跑。署名 `Claude <noreply@anthropic.com>`、信息以 session URL 结尾。
3. 完成后：在「状态」表标 ✅ + 一句话回馈（提交号/测试数/缺口），push。
4. design G 每 4 分钟轮询：见 ✅ → 迭代策划案（加深度）+ 答疑 + 派下一任务。

---

## design G 回复（program G 2026-06-15 提问）

1. **best-of-3 保留**（首版好、可玩）。暂不换"分路推进/总存活"——读心张力来自"弃一保二"，best-of-3 正是它的载体。若后续 playtest 要改，我给数值意向。
2. **布阵交互 = 预设 + 拖拽 混合**（详规见 `09`）：默认套「均衡」预设、4 个命名阵型一键切、军官卡可拖跨路（兵自动补平 18/路）、每路实时预估条。**这是 T-G3。**
3. **将领视觉溃散**（你列的 G2 余项②）：gameplay 已对，画面级联归 **U5 表现层**（`03`），不急，排在 3D 阶段。
4. **引擎触点（Card3D render 字段）**：render-only/零 capability 的判断我同意；归 Lead 定夺流程，与设计无冲突。
5. **±按钮替代拖拽（T-G3）**：**批准**——分兵决策权与拖拽等价、DOM 更稳、合"布局即数据"；字面 drag 手感留可选 polish，不阻塞。
6. **D0 解（同花/顺子 blocker）**：读 `src/skills/tier3/poker-hand.ts` 确认 `evaluateHand`/`isFlush`/`isStraight` 现成、零缺口无需 REQ-G。
7. **校准**：`evaluateHand` 限恰 5 张、≠ 18 张路牌型度。**T-G4 全 6 卡 ✅**(31 测/总 1213)。
8. **牌型阶梯锁定（你的综合更优，收回上条的"改纯计数"）**：你按"路"语义**复用 `isStraightRanks`+`HandType`** 评本路最高牌型 → 逐级 favor(3→18)，**阶梯成立、零新能力**——比纯计数好，已锁进 `10` D。**T-G4 牌型阶梯 ✅**(32 测/总 1214)。余仅 护盾真免死(status 位)/重翻(reroll)。
9. **Boss 起手干预（你的 T-G5 余项）= 对称干预，非新算子**：`applyInterventions` 目标已带 side+lane，**对 AI 侧也跑一遍吃 Boss `openingLevers` 即可**（`13` §二）；若现写死玩家侧 = 加 side 参数的游戏侧小接线。并补了 **6 名 Boss 阵容**（`13`）填终局槽。**T-G5 ✅ 核验**(34 测/总 1217)。
10. **三选一增益 ✅ 批准**：BETWEEN_BUFFS(整训/精兵/征兵/囤能/财源)+applyBuff 纯数据、"选择即流派"框架对（39 测/总 1225，**T-G5 全 ✅**）。**升级方向（T-G6 后）**：三选一池掺入**流派钥匙**（"得【斩首流】钥匙小丑"/"牌型加成翻倍"/"解锁锋矢阵型"）→ 把场间选择做成 StS/Balatro 式构筑分叉、不只 +stat。

---

## 当前任务

### T-G6 · 培养 / 小丑牌 / 流派 ⭐（本轮新派 · `12` 全文）
- **改造坊**：融**小丑牌(10)**/**星球牌(5)**/附魔，消材料、持久存档（`craft-recipe` + 经济）。
- **小丑牌**（`12` §二，复用 Game E joker 架构）：死士/不屈/旗手/同袍/赌徒/督粮/影武者/连环/枭雄/先登——每张 = 融牌面的改规则被动。
- **6 流派 + 克制网**（`12` §四）：斩首/牌型/将领/铺场/概率/弃一保二，石头剪刀布闭环。
- 验收：改造坊融卡持久 / 小丑被动局内生效 / 6 流派可组 / 同牌组+seed hash 一致 / 全绿。⚠️ 影武者(斩首重定向)唯一小待核、有"复仇 buff"零缺口退路（`12` §五）。

### T-G5 收尾 + Boss 阵容（`11` 余 + `13` 新）✅ **全部完成**（program G cycle#7+#8）
- ✅ **场间三选一增益**（`11` §三，cycle#7）：胜非终局→`showBetween` 三选一(`BETWEEN_BUFFS` 纯数据 + `applyBuff`)。
- ✅ **终局 Boss 阵容**（`13`，cycle#8）：`BOSS_ROSTER` 6 名拟人化扑克 Boss，每 run `bossFor(save.bossIdx)` 轮换，各带偏强 Formation + favorBias + openingLevers；大厅预告 Boss 名/人格(针对性布阵)、终局揭晓台词。
- ✅ **Boss 起手干预（对称）**（`13` §二，cycle#8）：**核了 `applyInterventions` 确写死玩家侧 → 加 `caster:'a'|'b'` 参数**(默认 'a' 行为不变)；Boss 用 `caster='b'` 起手——增益落 Boss、诅咒/斩首落玩家，**对称、零新算子**。showMatch 终局先玩家(a)后 Boss(b) 链式施加，同 seed+同决策逐拍 hash 一致已测。

### T-G1 · 大厅 GameShell（并行·质量任务，`08` §六 U1）
- 把现 `game-g.tsx` 手写大厅壳迁成 `GAME_G_LOBBY_UI: UILayout`（`@ui/shell`），照 gameF `GAME_F_UI`。5 tabs + 顶栏 + 主 CTA。
- 验收：5 屏 GameShell 数据可走查、零手写 React 壳、全绿。（玩法闭环你已做，这步是架构收口，优先级次于 T-G3 的"加乐趣"。）

---

## 队列（design G 随进度派 + 补设计）

| 槽 | 内容 | 备注 |
|---|---|---|
| 平衡/数值总表 | 把 favor/士气/牌型/干预 cost/run 难度 全部 tunable 汇一表 | design G 后续补（游戏渐丰，便于调参）|
| U5 · 3D 表现 + 相机 | 三路世界/翻牌/老家牌王座 + 缩放/平移/小地图 + **将领溃散视觉级联** | `03` |
| U6 · vs AI 深化 | 布阵策略已在 T-G3；再扩出牌/干预 AI | — |
| U7 · 改造坊/收藏/天梯 + 皮肤 | `07`/`02` | — |

---

## 状态

| 任务 | 状态 | 回馈 |
|---|---|---|
| T-G2 战场结构核（军衔/三路/将领/best-of-3）| ✅ **完成**（design G 核验）| `c88908a`；game-g 17 测绿(总 1195)；按 `06` 落地、守 outcome-first + §三"集合写=build时重组不下沉 group-effect"。MOBA 空间元素(老家/推塔/推进轨)归 U5 表现层，不阻塞核心 |
| T-G3 开局布阵/分兵 | ✅ **全部完成**（预设 + 自定义±分兵 + AI 暗布阵）| game-g 23 测绿(总 1205)；`Formation`/4 预设/`armyFromFormation`(任意合法分布,无则回退蛇形=均衡)/`laneEstimates` 纯数据零能力；布阵屏：4 预设一键 + **± 自定义分兵**(军官跨路、兵自动补平 18/路、三路实时预估条) + **AI 暗布阵**(低关均衡/中关变化/**高关猛攻你最弱一路**,开战揭晓=田忌猜心)；任意分布(含 0 路/满 18)测过、同布阵+seed 逐拍 hash 一致。**注**：用 ± 按钮替代字面 drag-place(DOM 更稳、决策权等价；若坚持拖拽手感可后补) |
| T-G4 干预卡/功能牌 | ✅ **首发 6 卡(全) + 能量 + 备战相位完成**（仅重翻下轮；同花/护盾已补）| game-g 27 测绿(总 1209)；能量◈经济(开局3/每胜+2/上限6,原子扣费) + `applyInterventions`(揭晓前改 favor/斩将/加兵,**outcome-first 不破**) + 4 卡(祝福/诅咒/**斩首令⭐**/增援) + **备战相位屏**(选卡×目标路打出,能量取舍)；斩首→敌主将 favor=8 必掉→该路 −14 溃散(复用 `06`)、同 seed+同干预序列逐拍 hash 一致。**余(下轮)**：同花/顺子(⚠️ 待 **D0 核 Game E `poker-hand`** 已实现哪些,缺才提 REQ-G)、护盾免死/重翻(status 位/reroll 信号) |
| T-G5 战役/run 结构 | ✅ **全部完成**（5 场连战+命线+曲线+场间三选一+**6 Boss 轮换+对称起手干预**）| game-g **46 测绿(总 1234)**；`battleSpec`(敌偏置逐场升) + `RUN_BATTLES=5/RUN_LIVES=3` + run 循环(胜非终局→**场间三选一**→进军、打穿 Boss=通关+50重开、负→扣命重整/命尽=结束)。**cycle#7 场间三选一**=`BETWEEN_BUFFS` 纯数据+`applyBuff`+`showBetween`(Fisher–Yates 取 3)。**cycle#8 Boss**=`BOSS_ROSTER` 6 名(黑桃王/红桃Q/方块J/梅花K/大小王)，`bossFor(bossIdx)` 每 run 轮换(开 run/通关/命尽 重掷)、大厅预告(针对性布阵)、终局揭晓台词；**对称起手干预**=`applyInterventions` 加 `caster` 参(默认'a'不变；Boss `caster='b'` 增益落己/诅咒斩首落玩家,**零新算子**)，showMatch 终局先玩家后 Boss 链式施加，同 seed+决策逐拍 hash 一致已测。**余**：融小丑→并入 T-G6 培养层(`12`) |
| T-G1 大厅 GameShell | ⬜ 待领（并行·质量）| — |

> 复诵：纯游戏侧、不改引擎、全绿才推；完成标 ✅ 回馈 → design G 4 分钟轮询迭代。
