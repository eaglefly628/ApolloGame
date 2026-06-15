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
- **cycle#19 (T-G6 流派激活质变 · 闭合"选择即流派")** 🟡：接主策划 reply#16(`12`§四.5)"钥匙解锁招牌强度"。`activeArchetype(jokers)`=你的**主流派**(detectArchetype 多数决)且**集齐其 keyJokers** → `applyArchetypeActivation` 施招牌增益(只主流派激活·防混搭叠猛)：将领=士气×1.3 / 铺场=每路+2兵 / 牌型=阶梯+12(≈×2) / 概率=favor下限15 / 斩首=敌主将−12先怯 / 弃一保二=两强路集中+favor。入 prepareArmies(改 a/b + moraleMul→moraleA / tierAdd→flush)、大厅显"🔥招牌已激活"。全 build 时、outcome-first、复用现成、零新能力。+8 测(activeArchetype 集齐/部分/主流派、6 流派各激活效果、将领进 prepareArmies moraleA×1.3、激活+联动进 sim hash 一致)；总 **1288** 绿 tsc+build 0。
  - **⚠️ 报主策划 2 处与 reply#16 的差异(CORE RULE，待你核)**：① **阈值**：你写"≥3 keyJokers"，但现 keyJoker 数多为 2(decap/general/probability 各 2、cardtype 1、wide 3)——**≥3 只 铺场流可达**。我改为**"集齐主流派全 keyJokers"**(6 流派皆可触发、仍只主流派)。若你要真 ≥3，需先给每流派补到 ≥3 钥匙。② **3 个招式取 build-时近似**(原式需新机制/改核)：概率"改 decideFaceUp 下限 5%→15%"→我用 **favor 下限 15**(等价下限 15% 且不改确定性核)；弃一保二"弃路 favor 转移×1.5"→我用**两强路 +favor**(无"转移"机制，集中等价)；斩首"−1◈+溃散−20"(需 lever 费/ROUT 改动)→我用**敌主将 −12 先怯**(build 时·等价"擅斩者敌将先怯")。**都零新能力**；若要原招式精确语义(尤其 斩首 −1◈ 费率/弃一保二 真转移)，告诉我，我评估机制成本。**T-G6 余**：附魔、AI 按克制反制布阵。
- **cycle#18 (T-G6 星球·型 全局形 · 收口星球牌 4 张)** 🟡：主策划 reply#15 采纳我 CORE RULE 回驳——**星球·路 砍**(与军+布阵重叠且要选路 UI)、**星球·型 改全局**(原"+某档"要 UI → 整条牌型阶梯全局 +X/级，零目标 UI)。落地：`laneHandTier(cards, tierBonus=0)` 加参——成型(非高牌,base>0)才把整条阶梯 +bonus；`applyInterventions` 加 `tierBonus` 参(默认 0、行为不变)在 flush 分支吃；`effectiveTierBonus(planets)` + prepareArmies **只玩家干预吃型**(Boss flush 传 0、不吃玩家星球)。`星球·型`(mercury, +4/级)入 `GAME_G_PLANETS` → **星球 4 张定稿(命/能/军/型)**。+2 测(laneHandTier 成型吃/高牌不吃·effectiveTierBonus 叠加 / prepareArmies flush 受益)；总 **1280** 绿 tsc+build 0。**全游戏侧零引擎**。给主策划：谢复核——CORE RULE 对设计同样适用、你采纳回驳(砍路/改型)很干脆。**T-G6 余**：附魔(品质 +favor%/+触发)、6 流派"激活质变"(满 keyJokers→质变)。下轮我做**流派激活质变**(深化现有流派系统、复用 detectArchetype、零新机制)，除非你派更优先的。
- **cycle#17 (T-G6 星球牌·第二养成轴 + CORE RULE 回驳路/型)** 🟡：开第二养成轴(`12`§三)。**与小丑正交**：小丑=一次性·改规则·身份；星球=**可叠加升档**(买 N 级累加)。本批 **3 张**(皆**与大厅 deck-favor 商店不重叠**的新轴)：**命**`effectiveLives` run 命线上限 +1/级、**能**`effectiveLeverCap`/`effectiveLeverRegen` 干预能量上限+回能 +1/级、**军**`applyPlanetArmy` 军阵「兵」档(A–6) +3/级(进 prepareArmies, build 时变换)。Save `planets:Record<string,number>` 局外持久(跨 run,run 重开命线读 `effectiveLives`)；大厅星球升档区(Lv.N 叠买)；纯数据+派生纯函数、headless 可测。+4 测(池/effective 叠加/星球·军仅兵档升·军官不变/进 prepareArmies 兵档抬升)；总 **1278** 绿 tsc+build 0。**全游戏侧零引擎**。**⚠️ CORE RULE 回驳 星球·路/型 2 张**：① 路(选一路永久 favor)/型(牌型档加成) 都需**「目标选择 UI」**(选哪路/哪牌型档)，是交互缺口非数据缺口；② favor 类升档与大厅「强化全军/精炼弱牌」部分重叠。→ 报主策划：**请定 路/型 的目标交互**(布阵屏选路? 改造坊下拉选档?)或确认并入现成商店，再接；现 3 张已立第二轴。**T-G6 余**：路/型(待 UI)、附魔、流派激活质变(满 keyJokers→质变)。
- **cycle#16 (T-G6 斩首流族·督粮/影武者 → 小丑 10/10 全)** 🟡：补最后 2 张完成全 10 小丑。**督粮**(每胜一路→下场备战 +1◈)：`quartermasterEnergy(jokers,胜路数)` 纯函数，**post-resolve 在 onFrame 结算后**加 ◈ 入 `save.leverEnergy`(cap)——是 **run 经济、不破"本场揭晓前花能量"的相位**(§五.5)。**影武者**(我某路主将被斩→该路余部复仇)：`applyShadowRevenge(army)` 在 `prepareArmies` **Boss 起手干预之后**调用(此时被斩主将 favor=8 可侦测)→该路非主将 +12 favor；走 §五.5 **退路(复仇 buff)非重定向**(零缺口、不救主将)，build-时变换、outcome-first。两张归 **斩首流**(`decap` keyJokers 补齐 督粮/影武者)。+3 测(督粮算式/applyShadowRevenge 仅被斩路余部升·主将不变·他路不变/影武者经 prepareArmies+Boss 斩首三路复仇)；总 **1274** 绿 tsc+build 0。**全 10 小丑、零引擎触点**(quartermaster 在 onFrame 游戏层、shadow 在 prepareArmies 游戏层)。给主策划：① 影武者我选 §五.5 **退路(复仇)** 而非重定向——重定向需"捕获斩前 favor 还原主将 + 指定替身卡"、比复仇多耦合且你已批退路零缺口，故取退路；若坚持"主将留、替身死"的重定向观感，告诉我，我加(捕获 pre-decap favor)。② 督粮 +◈ 叠加在胜利 +2 回能之上(cap 6)，斩首流能量引擎可能偏强，待 playtest 调 `14`。**T-G6 余**：星球牌(升档·第二养成轴)、附魔、6 流派"激活质变"。
- **cycle#15 (T-G6 结局联动族·死士/连环=铺场流)** 🟡：主策划 reply#14 在 `12`§五.5 钉死语义后接此族。**死士**(本路首张兵死→该路余下**未翻**的兵 +10 报仇)、**连环**(本路首张兵活→牵起下一张**未翻**兵跳掷命必活)。落地=`resolveArmy` 加 `links` 参，在既有确定性单遍里**前向生效·只动未翻牌**——故无二次解析、单遍确定、**hash 稳**(纪律=`12`§五.5)。死士只升 favor(不改掷命次数)→存活单调；连环跳掷命(改后续 rng 序列但确定)。`jokerLinks(jokers)`、`prepareArmies` 带 `linksA`、`buildGameGArmyMatch` 加 `linksA` 参(敌方无)。小丑达 **8/10**，铺场流(`wide`)keyJokers 补齐(先登/死士/连环)。+4 测(jokerLinks/死士单调/死士+连环进 sim hash 一致/prepareArmies 带出 linksA)；总 **1271** 绿 tsc+build 0。**全游戏侧、零引擎**(resolveArmy 在 blueprint 游戏层)。**余**：督粮(活→+◈ 跨场 run 经济, post-resolve 在 onFrame 结算加)、影武者(优先 applyInterventions 斩首重定向/退路复仇 buff)、星球牌/附魔。给主策划：死士/连环我按"**本路首个事件触发·一次**"实现(非指定某张卡)——比"designate 某张是死士"更无歧义、玩家也好懂(首死/首活)，合 §五.5 前向纪律；若你要"具体某张牌=死士"的卡级绑定(更 Balatro)，需 save.jokers 卡级化，告诉我取向。
- **cycle#14 (U5 手感 L0 命门 · 滞空微停 + 正反金石对比)** 🟡：接主策划新出 `15`「手感/演出=有趣最后一公里」(回应 owner 最初"好简陋")。做 L0 两大**命门**(design/15 §一/§七)，**全表现层、⛔ 不进 hash、不回灌 gameplay**(各端可不同→多人安全)：① **顶点滞空微停**=`hangWarp(t)` 把匀速抛飞进度重映成"两端快·apex 中段慢"→ 牌抛到顶**屏息一拍**(`s=t+k·sin2πt/2π`,单调,leap=sin(π·s) apex 悬停)；② **落定正反金石对比**=`revealGlow(t)` 落地一刻 0→1，正面(活)=自队色 `emissive` 渐亮(立绘亮)、反面(死)=背面石板 `color` 压暗(沉灰)。新 `feel.ts`(纯函数·零 Three/DOM·**headless 可测**) + ThreeRenderer 消费(arc 用 hangWarp、新 `applyReveal` 每帧据 rev 设金/石)。**架构**：手感曲线=纯数据/纯函数(游戏侧)，渲染器=固定解释器，**零新引擎能力**；红线守死(渲染只演既定面 tw.to、不改 sim)。+6 测(clamp/smoothstep/hangWarp 端点·单调·apex 最慢/revealGlow/faceUpVisible)；总 **1267** 绿(161 文件) tsc+build 0(game-g chunk 编译过)。⚠️ 表现项**无法在 headless 看实际观感**——逻辑/曲线已测，真机观感待 owner/主策划反馈调 k/glow/dim。**余 L1**(下轮)：溃散级联波纹、斩首聚焦 hitstop、逐路揭晓 best-of-3 悬念、Boss 入场立绘台词。给主策划：`15` 命门已落，请真机看"屏息感/金石对比"是否到位，给 `hangWarp` k(滞空时长)与 `ALIVE_GLOW/DEAD_DIM` 数值意向，我调(纯表现、改 `feel.ts` 常量即可)。
- **cycle#13 (巩固/硬化 · prepareArmies 单一真相 + 全栈端到端测)** ✅：**领先 design 评审、且余项(结局联动族小丑/星球牌)有开放设计问题待答**——故按 SOP「领先则做一小步硬化」，不硬塞会拗 outcome-first 的新特性。把 showMatch 里**揭晓前完整编排**(成军→融小丑→玩家干预→Boss 起手干预→算士气倍率)抽成 `prepareArmies(MatchSetup)`：**showMatch 与测试共用单一真相、杜绝两路漂移**(纯函数、可重放)。+3 测：**全栈端到端**(融小丑+玩家干预+Boss 起手+士气 一锅，同 setup+seed 逐拍 hash 一致)、编排落实(旗手 ×1.5/Boss 斩首压三主将 favor=8/增援 +2 兵)、不卡 pending 出胜负。总 **1261** 绿 tsc+build 0。零行为变更(纯重构+测试)，showMatch 现 3 行调用。**待 design**：① 次 3-环克制校准 ② 流派"激活质变"/AI 反制做不做 ③ 结局联动族小丑(死士/连环/督粮)在 outcome-first 下=按 `12`§五"复仇 +favor"类重组(非真运行时联动)——我倾向这么做，确认取向 ④ 星球牌(升档,需几个 save 字段)优先级。
- **cycle#12 (T-G6 slice 4·6 流派 + 克制网 = 身份层)** 🟡：把 `12` §四的 6 流派落成数据 + 闭合 `选择即流派`。`ARCHETYPES` 6 流派(斩首/将领/铺场/牌型/概率/弃一保二)各 `{keyJokers,counters}`；**双 3-环克制网**(核心环 `12` 明示：斩首→将领→铺场→斩首；次环 牌型→概率→弃一保二→牌型 我合理映射、待 design 校准)；`detectArchetype(jokers)`(数 keyJokers 命中、多数决浮现主流派)、`archetypeMatchup(a,b)`(克制/被克/中立)。`Archetype` 类型对齐 6 流派 id(原 'card-type'/'vanguard'→'cardtype'/'wide')、6 小丑重打 archetype 标、`BossSpec` 加 `archetype`(6 Boss 各映一流派)。大厅新增**流派身份条**：显你的流派(由小丑浮现)+desc + **对终局 Boss 流派的克制提示**(克制绿/被克红/中立)——指导针对性布阵(克制网落到玩家决策)。**纯数据 + 复用既有 archetype 标/Boss 数据，零新能力**。+5 测(流派池/克制网每流派恰被1克+核心环、detectArchetype 多数决、matchup、Boss 流派合法)；总 **1258** 绿 tsc+build 0。给主策划：① 次 3-环(牌型/概率/弃一保二)克制我先按"牌型克概率克弃一保二克牌型"映，**请校准**；② 现流派=**识别+提示**(软身份)，若要"流派激活质变"(如将领流满 3 钥匙 → 士气再 ×1.2)或"AI 按克制反制布阵"，是下一层、告诉我做不做。**余**：结局联动族小丑(死士/连环/督粮)、星球牌/附魔。
- **cycle#11 (T-G6 slice 3·三选一流派钥匙=构筑分叉)** 🟡：接主策划 reply#10"场间选择做成 StS/Balatro 式构筑分叉、不只 +stat"。`BuffKind` 加 `'joker'`、`RunBuff` 加 `jokerId?`、`BuffTarget` 加 `jokers[]`、`applyBuff('joker')` 白嫖小丑(去重幂等)；`jokerKeyBuffs(owned)` 把**未拥有**小丑包成场间可选 RunBuff(`🃏钥匙·X`)；`showBetween` 池 = 资源增益(5) + 流派钥匙(未拥有小丑) → pick3 → 选钥匙=白嫖小丑定流派 vs 选 +stat。钥匙紫色卡区分。**纯数据扩 + 复用既有 applyBuff/showBetween/小丑目录、零新能力**。+2 测(jokerKeyBuffs 去已拥有/kind=joker/jokerId 有效、applyBuff joker 入 jokers 去重)；总 **1252** 绿 tsc+build 0。给主策划：现资源增益 5 + 钥匙 N(未拥有数)混选、等权随机；若要"钥匙稀有度/保底必出一张钥匙/流派定向 drop"可加权，告诉我取向(纯数据)。**余**：结局联动族小丑(死士/连环/督粮)、星球牌、6 流派网。
- **cycle#10 (T-G6 slice 2·士气放大族小丑=将领流)** 🟡：补 2 张**士气放大族**小丑 → 将领流成形。**旗手**(全路士气 ×1.5)、**枭雄**(顶级主将 K/王 所在路士气 ×2)。实现=**参数化既有 `06` 将领牵动士气**(非新机制)：`resolveArmy` 加 `moraleScale[lane]` 参(缺省 [1,1,1]，**仅放大士气/不放大溃散**)、`jokerMoraleScale(army,jokers)` 从小丑算每路倍率、`buildGameGArmyMatch` 加 `moraleA` 参；showMatch 出征算 `jokerMoraleScale(a,save.jokers)` 喂入。**关键不变量**：缩放只改下属 favor 值、**不改掷命次数(每牌 1 抽)→ PRNG 序列不变 → 确定性/可回放/hash 一致**(已测)。**全游戏侧、零引擎触点**(resolveArmy 在 blueprint.ts 游戏层)。+3 测(旗手全路 ×1.5/枭雄仅顶级主将路 ×2/低军衔主将路不放大、士气放大存活单调不减、缩放进 sim 逐拍 hash 一致)；总 **1248** 绿 tsc+build 0。改造坊自动列全 6 卡(map GAME_G_JOKERS)。给主策划：旗手/枭雄做成**deck-wide 光环**(非 lane-targeted)——比 `12` 的"这张所在路"略简化，但=将领流意图(放大士气=主将活则全路涌)；若要"把旗手指派到某一路"的 lane-targeted 版(更像布阵决策)，需 save.jokers 改 `{id,lane}[]`，我下轮可加，告诉我取向。**余**：结局联动族(死士/连环/督粮 需 resolve 后/能量钩子)、影武者、星球牌、6 流派网。
- **cycle#9 (T-G6 slice 1·小丑牌数据底座 + 改造坊 lite)** 🟡：T-G6 起步。**`GAME_G_JOKERS` 本批 4 张小丑**(同袍 suit-synergy/赌徒 polarize/先登 lane-pref/不屈 diehard)，每张 = `{kind,params,text}` 声明式数据 + `applyJokers(army,ids)` build 时解释器(与 `applyInterventions`/`applyBuff` 同族、揭晓前改 favor、**outcome-first 不破、零新引擎能力**)。Save 加 `jokers:string[]`(**局外持久·跨 run 不清零** = 牌组身份养成核，owner 愿景)；大厅 **改造坊 lite**(花材料融小丑·一次性·持久)、showMatch 出征先 `applyJokers(armyA,save.jokers)` 后干预。
  - **D0 核 Game E `jokers.ts`（重要架构判定，报 Lead/主策划）**：Game E joker = **运行时计分系统**(trigger `on_hand_scored`→Effect 改 chips/mult/money)；Game G 是 **outcome-first**——胜负 build 时由 favor 定、3D 不回灌——故 joker 必须是 **build 时军阵 favor 变换**(揭晓前)，**不能**是运行时触发。结论：**复用 Game E 的声明式数据哲学(`{kind,params}`+`text` 人话)、不复用其运行时**（与 D0 §同花"不复用 evaluateHand、按路语义自算"同理）。`applyJokers` 是游戏侧数据解释器、非引擎能力，零 REQ-G。
  - +8 测(目录/JOKER_BY_ID、空集复制、同袍计数、赌徒两极化、先登路偏好、不屈免死地板、**outcome-first 单调性**=融不屈同 seed 存活不减、融小丑进 sim 逐拍 hash 一致)；总 **1243** 绿 tsc+build 0。**余(后续切片)**：士气放大族(旗手/枭雄→需 `resolveArmy` 加 per-lane morale 钩子,游戏侧)、结局联动族(死士/连环/督粮 → 需 resolve 后/能量钩子)、影武者(斩首重定向 ⚠️待核)、星球牌/附魔、6 流派+克制网。给主策划：你 reply#10 的"三选一掺流派钥匙"——等小丑铺到能成流派(≥2 切片)我把 joker 加进 `BETWEEN_BUFFS` 池(给"流派钥匙"buff kind)，做成 StS 式构筑分叉；本切片先把"融小丑"机制 + 持久存档跑通。
- **cycle#8 (T-G5 收尾·6 Boss 阵容 + 对称起手干预)** ✅：完成 design/13 全部 + 收口主策划 reply#9。**`BOSS_ROSTER` 6 名拟人化扑克 Boss**(黑桃王·铁壁/红桃皇后·倾国/方块J·诡牌/梅花K·人海/大王·天命/小王·无常)，每 Boss 强度**全用 3 个数据杠杆**表达：`formation`(力压哪路)/`favorBias`(多强)/`openingLevers`(起手干预 `Intervention[]`)——persona/taunt 仅 UI flavor、无可执行逻辑，**守"整个游戏是数据"**。`bossFor(idx)` 每 run 轮换(freshSave/通关/命尽 重掷 `bossIdx`)，大厅预告 Boss 名+人格(供针对性布阵)、终局 showMatch 揭晓台词。
  - **对称起手干预（解我自己 T-G5 余项 + 主策划 reply#9）**：**核了 `applyInterventions` 确实写死玩家侧**(bless/shield/reinforce/flush→a、curse/decapitate→b) → 按主策划"加 side 参数的小接线"指引，加 `caster:'a'|'b'` 参(默认 'a'，**既有行为/测试零变**)。`caster='b'`(Boss)：增益落 Boss 己方(b)、诅咒/斩首落玩家(a)——**side 参数化、非两套算子、零新能力**(design/13 §二)。showMatch 终局**先玩家(caster='a')后 Boss(caster='b')链式施加**，都在揭晓前、outcome-first 不破。
  - +7 测(池 6 名/formation 和=30/openingLevers 合法、bossFor 轮换归一含负 idx、对称 caster=b 增益落己·诅咒落敌、默认 caster=a 行为不变、小王斩首反噬玩家主将 favor=8、梅花K 增援落 Boss+2、Boss 起手进 sim 同 seed 逐拍 hash 一致)；总 **1234** 绿 tsc+build 0。**T-G5 全部 ✅**。给主策划：数值(BOSS_BIAS=14、大王+6 等)是起步档、可调，等你的「平衡/数值总表」我接入 tunable；**下轮 T-G6 培养/小丑/流派**(`12`)。
- **cycle#7 (T-G5 余项·场间三选一增益)** ✅：T-G5 从 🟡 转 ✅。胜一场(非终局)后插入 **场间整备·三选一**窗——`showBetween`(Fisher–Yates 取 3 张增益,选一项强化 → 选择即流派,roguelike 养成核)。增益池 `BETWEEN_BUFFS`(整训全军+4 / 精兵最弱10+8 / 征兵+1命 / 囤能+3◈封顶 / 财源+25材料)=**纯数据**(最弱 LLM 能填 `{kind,amount,count}`)+ 小解释器 `applyBuff`(就地改存档子集 `BuffTarget`),与大厅商城同类的存档变更——**零新 capability、零引擎触点、headless 可测**。onFrame 结算路由重写：胜非终局→`showBetween('进军第N战')`→大厅、打穿 Boss=通关、负且有命→`重整再战`(回布阵重打本场)、命尽=回大厅。+5 测(池 5 张/各 kind 合法、整训钳95、精兵恰最弱10、征兵·囤能封顶·财源、applyBuff 纯函数式同入同出)；总 **1225** 绿 build 0。**T-G5 余(下轮)**：Boss 真起手干预(待对称干预模型)、融小丑(`12` 培养层)。给主策划：三选一我建模为**声明式增益数据 + 解释器**(非每卡写 apply 函数)——更合"布局即数据",新增益你只填一行 `{kind,amount}`、无需我改代码;若要更花哨效果(如"本路翻倍""复制最强牌")超出 5 个 kind,届时按缺口再下沉一个 kind、勿 hack。
