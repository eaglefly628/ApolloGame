# PG · Programmer G 工作清单 / 汇报（Game G《翻命扑克》）

> 程序 G（PG）维护。给**主策划**看进度、给**Lead/主程**看引擎触点供 review。
> 分支 `claude/mainbranch`；每条都 tsc + vitest + build 全绿才推。设计真相：`src/games/game-g/design/`。

---

## 一句话现状

G2 战场结构（军衔/三路/将领牵动/best-of-3）核心已落、已接入大厅出征、全绿（vitest **1195** / build 0）在 mainbranch。其余按 `design/05` 路线推进中。

---

## 已完成（✅）

| 块 | 内容 | 证据 |
|---|---|---|
| 表现·体量与撞击 | 52v52 牌阵；网格配对(A左/B右,同 pairKey)；渲染器抛飞弧+配对相撞+相机自适配 | `three-renderer.ts`/`blueprint.ts`；测：cardFace/配对/52v52 |
| 表现·牌面美术 | 纯色方块 → 真扑克牌面(点数+花色+红黑+背面菱格+队伍色描边)，canvas 纹理缓存 | `three-renderer.ts` faceTexture/backTexture |
| 玩法·闭环 | 大厅↔出征↔改造牌组(升 favor)↔关卡递增 + localStorage 存档 | `game-g.tsx` |
| **G2·战场结构** ⭐ | 54/方(52+2王)·三路×18·军衔=点数·主将牵动·best-of-3 | `blueprint.ts` standardArmy/buildGameGArmyMatch；测 3 例(结构/best-of-3 回放/确定性) |

### G2 实现要点（给主策划核对设计意图）
- **军衔=点数**：`standardArmy` 按军衔降序蛇形发三路(各18)，每路首张(最高军衔)=主将。favor：JOKER/K=80, Q/J=66, 10-7=56, A-6=46（高军衔更易活）。
- **将领牵动（§三 集合写）= build 时逐级掷命重组**（**守纪律，未下沉 group-effect**）：逐路先掷主将，**主将活→本路下属 +8 favor（士气）、主将亡→−14 favor（溃散连锁）**，再掷下属。擒贼先擒王 → 连锁溃散，机制成立。
- **三路 + best-of-3**：`group-count` 按 `队|路|ALIVE` 数三路存活 → `event-when`(vsResource 比) 累计各方赢几路 → 胜 2/3 路即赢。**零新 capability**（如 `design/06 §六` 预期）。
- **outcome-first 红线守住**：胜负 build 时即定（同军同 seed 逐拍 hash 一致已测）；3D 抛飞相撞为表现、不回灌。
- 大厅出征已切到军阵：改造升 favor→全军偏置↑；敌方偏置随关卡↑；结算显示"三路 X:Y / 存活 / 材料"。

---

## ⚠️ 给 Lead/主程 review 的引擎触点（我先做了，请过目）

> 按 owner 指令"有主程 block 先做、最后写文档他 review"。以下是 game-G 需要、我先落地的**引擎侧改动**，**均 render-only、零新 capability、零 sim/hash 影响**：

1. `src/engine/protocol/components/render.ts`：`Card3D` 加 render-only 字段 `side?/pairKey?/rank?/suit?`（供 3D 抛飞相撞配对 + 画牌面）。
2. `src/assembly/component-map.ts`：`Card3D` 已在闭集（字段为可选，无新增条目）。
- **判断**：这些是表现层数据字段，不是新词汇/能力，按 manifesto 属 render 组件扩展。如 Lead 认为该走 requests.md 流程，请示下，我补登记。
- **未碰**：任何 capability / sim 逻辑 / 其它游戏。G2 全部用现成 `group-count`/`event-when`/`effect`/`timer` 重组。

---

## 待办 / 下一步（按 `design/05` 路线）

- **G2 余项**：① 开局**布阵 UI**（玩家把将领/兵分三路、田忌赛马式分兵）——现为自动均衡发牌；② 主将阵亡的**视觉溃散**（`hierarchy-cascade` 表现，现为 build 时 favor 连锁，gameplay 已对、缺画面级联）。
- **G3 · vs AI**：现已有"敌方按关卡偏置"的雏形；可扩 AI 布阵策略（数据）。
- **G4 · 培养/功能牌**（`design/07`）：牌面融合(小丑/星球) + 功能牌目录。
- **手感调参**：渲染器 `APEX/COLLIDE/Z_POP/LANE_SEP` 等凭结构调，待真机观感反馈。

---

## 给主策划的反馈（供你迭代设计）

- `design/06` 的"将领牵动=集合写优先重组"落地顺利——**build 时逐级掷命**比运行时 group-effect 更干净、确定、可回放，建议设计就以此为准（已在 `01/06` 内核之上、未改内核）。
- best-of-3 首版已可玩；若要"分路推进/总存活"等替代判胜，给个数值意向我就改（纯 banded 调整）。
- 布阵 UI 需要你定**交互形态**（拖牌分路？预设阵型选择？）——给个 `design/06 §四` 的交互细化，我接。

---

## 自动工作循环约定（PG auto-loop SOP）

> owner 指令：PG 每 ~4 分钟跑一个自主工作周期，与主策划并行迭代，不打断用户。
> 本环境无 cron/ScheduleWakeup → 用 **persistent Monitor 心跳**（每 4 分钟一 tick）唤醒。
> **每次被 `PG-tick` 唤醒，照此 SOP 跑一个周期：**

1. `git fetch origin claude/mainbranch && git rebase origin/claude/mainbranch`（拉主策划最新设计 + 他人提交）。
2. 读 `src/games/game-g/design/`（重点 `05-roadmap-and-status.md` + 新/改的特性文档），找下一个**未实现**任务，优先主策划最近细化的那条。
3. 在 game-g 层实现一个自包含切片：数据驱动、outcome-first；优先重组、零新 capability——真缺口才自己以 Lead 身份做并在本文件标注供 review。
4. 保持 tsc + vitest + build 全绿；新逻辑加 headless 测。
5. 提交（署名 `Claude <noreply@anthropic.com>`，信息以 session URL 结尾）→ fetch→rebase→（带进新提交则重跑全绿）→ push。
6. 回填本文件：本周期做了什么 + 状态 + Lead review 触点 + 给主策划的反馈。
7. 都实现完则做小步打磨/测试加强，标 `idle—待下一轮设计迭代`。**绝不留红、绝不留未推送、不问用户。**

> 停止循环：`TaskStop` 掉 `PG Game G 心跳` monitor（用户喊停时）。

---

## 循环日志

- **cycle#1 (T-G3 开局布阵/分兵)** ✅：`Formation` 数据模型 + 4 预设(均衡/锋矢/两翼/田忌,军官分布) + `armyFromFormation`(按阵型发三路,兵补平18/路,无阵型→回退蛇形=均衡,零迁移) + `laneEstimates`(三路预估)。大厅出征→**布阵屏**(4 预设一键切+三路预估条)→**AI 暗布阵**(低关均衡/中关变化/高关克制你上局阵型,开战才揭晓=田忌猜心)。零新 capability。game-g 22 测绿(总 **1204**)，build 0。**下轮**：军官卡拖拽跨路微调(drag-place 集成)。给主策划反馈见 PROGRAM-G-TASKS 状态表。
- **cycle#2 (T-G3 余项 自定义分兵 + 智能 AI)** ✅：布阵屏加 **± 自定义分兵**（军官跨路调、总数恒 30、兵自动补平 18/路、三路预估实时刷新）——预设之外的自由布阵，决策权与拖拽等价、DOM 更稳。AI 升级：**高关猛攻你最弱一路**（读 lastOfficers 最小路）→ 惩罚套路化布阵、强化猜心。存档 lastFormation→lastOfficers。+1 测(任意合法分布含 0 路/满 18)。总 **1205** 绿。**注**：字面 drag-place 拖拽手感留作可选后补。**下轮**：等主策划补 G4 干预卡详规，或 T-G1 GameShell 架构收口。
- **cycle#3 (T-G4 干预卡/功能牌 首发)** 🟡：能量◈经济(开局3/每胜+2/上限6) + `applyInterventions`(揭晓前改 favor/斩将/加兵→喂 build-时定胜负，**outcome-first 红线守住**) + 首发 4 卡(祝福+20/诅咒−20/**斩首令**敌主将favor=8必掉→该路−14溃散复用06/增援+2兵 go-wide) + **备战相位屏**(布阵→备战选卡×目标路→出征,能量取舍)。胜利回能。pairKey 改 lane*100+i 容增援后路>18。game-g +4 测(目录/applyInterventions/斩首减员/同序列 hash 一致)；总 **1209** 绿 build 0。**余(下轮)**：同花/顺子(⚠️ D0 先核 Game E poker-hand)、护盾/重翻(status/reroll)。给主策划：斩首"对主将单掷"我用"压 favor 到 8(p=8%)+既有将领牵动溃散"重组实现，未加单掷信号(够擒贼先擒王效果、零新机制)；如需真·独立单掷再说。
- **cycle#4 (T-G4 首发 6 卡完成 + D0)** ✅：补 **护盾**(本路最弱牌 favor→92≈反面免死) + **同花**(数本路同花色多数→全路 +favor)，首发 6 卡齐(祝福/诅咒/护盾/斩首/增援/同花)。ArmyCard 加 suit(同花数花色用)；备战屏自动列全 6 卡。+4 测；总 **1213** 绿 build 0。
  - **D0 核 Game E `poker-hand` 结论**：它评 **特定 5 张手牌**的牌型(`evaluateHand`→flush/straight,Balatro 式)；gameG 同花是"某路 18+ 张里**同花色最多**"=数花色多数，**两码事**。→ 同花用**简单数花色**实现、**不复用 poker-hand、零新能力、零 REQ-G**。顺子(若做)同理(数连续点数)，亦不需 poker-hand。
  - **余**：仅 **重翻**(揭晓后再 roll)——它是揭晓后交互，与 build-时定胜负有张力；拟实现为"该牌 2 次机会(预 commit,消 2 次 rng)"保 outcome-first，待主策划确认形态。**下轮**：重翻 或 主策划新派 **T-G5 战役结构(`11`)**。
- **cycle#5 (T-G4 牌型阶梯卡)** ✅：按主策划 refine，把"同花"升级为**牌型阶梯**——`laneHandTier` 评本路凑成的最高扑克牌型(对子→两对→三条→顺子→同花→葫芦→四条→同花顺)→逐级 +favor(3→18)。**复用 Game E poker-hand**：`isStraightRanks` 真算法 + `HandType` 枚举；按"路(18+张)"语义算特征(同花=≥5 同色/顺子=路含 5 连点，因 evaluateHand 限定恰 5 张/全同花不适用整路)。ArmyCard.suit 贯通。+2 测(牌型阶梯/laneHandTier 构造同花路·顺子路)；总 **1214** 绿 build 0。给主策划：D0 你判"复用 evaluateHand"——核实后 evaluateHand 要求恰 5 张/全同花，整路不适用，故复用其 isStraightRanks+HandType+阶梯思想、按路语义算，效果=牌型阶梯、零新能力。**余**：护盾真免死(status 免死位 vs 现 favor→92 近似)、重翻(reroll)。
- **cycle#6 (T-G5 战役/run 结构 骨架)** 🟡：`battleSpec(i)` 战役曲线(敌 favor 偏置逐场升 -10/-5/0/5，第 5 场=牌王座 **Boss** +8=18) + `RUN_BATTLES=5/RUN_LIVES=3`。mount run 循环：save 加 lives、stage 复用作当前战(1..5)；胜→进军下一战/打穿 Boss=**通关**(+50 材料,重开 run)、负→**扣命**/命尽=战役结束(重整)；大厅=场间窗(改造升 favor + 回◈ + 续战)，战斗 HUD 显示 第N/5战·曲线 label·❤命。+2 测(曲线逐场升/Boss更强)；总 **1217** 绿 build 0。**余(下轮)**：场间**三选一增益**(复用 card-pile 三选一)、Boss 真起手干预(需对称干预模型,现 Boss=高敌偏置已够挑战)、融小丑(培养层 `12`)。给主策划：干预 side 是玩家中心(bless→我/curse→敌)，Boss 自增益/对你 debuff 需要"对称干预"(−A favor/+B favor)算子,若要真·Boss 起手压你三路,我加一组对称算子(零新能力,纯 favor)再说。
