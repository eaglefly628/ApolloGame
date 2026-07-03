# 地煞能力词汇 v3 · 想象力 op 收敛 + 评判（design G 2026-06-21）

> 关11-52 三批想象力设计共提 **~38 个新 op**（owner：每关像新游戏·先想象后落地）。本档把它们**收敛成 ~8 个通用原语**，做 Lead 评判（重组/已覆盖 vs 真缺口），给甲一份**优先级实装清单**——owner 要的「对应能力好好探讨」。
> 原则（manifesto §4 / CORE RULE）：**先重组、再下沉**；一个通用 op 覆盖多关 > 一堆专用 op。每条想象 op 都已带「现有 op 降级映射」→ **sim 现在就能跑·不阻塞**。

## 一、~38 想象 op → 8 通用原语（收敛）
| 通用原语 | 收编的想象 op | 语义 | 评判 |
|---|---|---|---|
| **A. `terrain` 棋盘几何改写** | laneLock(锁路压缩为1路)·chokepoint(瓶颈限路)·noRetreatForPlayer(封退路)·routeDivert(强制移线)·minefield(雷区走廊)·slope(反斜面伏击) | 改这一关的"路"怎么走 | 🔴**真缺口·最高价值**（laneLock=李舜臣窄海峡·最强"新游戏感"通用 op）|
| **B. `phase` 相位机** | phase.cycle(风林火山四相轮转) | Boss 周期切换自身规则·一关多形态 | 🔴**真缺口·最高价值**（武田信玄·一关像四关）|
| **C. `control` 操控你的牌** | disarmStrongest(点杀你最强)·sever(取消你连携)·defect(你的兵倒戈)·panicBeast(驱散你最强)·freeze(冻动作∗)·intimidate(吓退前锋∗) | 直接动玩家的兵/动作/连携 | 🟡部分 v2 已提(freeze/intimidate)；disarm/sever/defect 是真缺口 |
| **D. `aura` 无敌/复生窗口** | invulnerable(周期无敌)·bannerRevive(战旗复活退兵)·immortals(编制恒满) | 周期性不可破/回血/补满 | 🔴真缺口（巴巴罗萨无敌窗口/贞德复生/大流士不死队）|
| **E. `offense` 递进突进** | deepDecay(纵深−N)·breakthrough(胜后连推)·nightCharge(跳格夜袭)·siegeRamp(攻城递增)·volleyRelay(轮射)·barrage(弹幕梯度)·battery∗ | 越打越猛/穿插/跳格 | 🟡battery/deepDecay 已设计；breakthrough/jump 是真缺口 |
| **F. `reinforce` 援军补充** | waveReinforce(登陆潮)·teleportReinforce(驿传)·rearDeploy(后排偷家)·lane.reinforce∗ | 周期/异位补兵 | 🟡lane.reinforce 已设计；rearDeploy(凭空后排)是真缺口 |
| **G. `economy/action` 经济动作** | extraAction(双动作∗)·withdrawRefundMul(撤退返泉∗)·bloodlessWin(经济压)·bonusMana∗ | 多动作/多源泉/经济压制 | 🟡v2 已提(extraAction/withdrawRefundMul)·bonusMana 已实装 |
| **H. `info/fog` 信息战** | fog∗·mirage(假兵)·perfectInfo(AI全知)·foreknowledge·searchlight(冻+雾) | 你看不清/AI 看得清 | 🟡fog 已设计·mirage/perfectInfo 是表现+AI 调参 |
（∗ = v2 或现有已覆盖）

## 二、给甲的优先级实装清单（高杠杆通用 op 优先）
> 不必实装全部 38——**实装这 6 个通用原语 = 覆盖关11-52 绝大多数"新游戏感"**；长尾用降级映射兜底。
1. **🥇 `terrain.laneLock` / `terrain.chokepoint`**（A）—— 一个 op 给 N 关"地形改写"·最高复用。`DishaFx.laneAvail[3]` / `forcePlayerLane`。
2. **🥇 `phase.cycle`**（B）—— Boss 每 K 回合切换一组 fx·"一关多形态"。`DishaFx.phases[]` + 周期切换（仿 batteryEveryTurns）。
3. **🥈 `aura.invulnerable{everyTurns,dur}` + `rally.revive`**（D）—— 周期无敌/复生窗口·终章压迫感。
4. **🥈 `control.disarm` / `control.sever`**（C）—— 点杀/废连携·逼玩家变阵；+ v2 的 freeze/intimidate。
5. **🥉 `offense.breakthrough` / `offense.jumpAdvance`**（E）—— 胜后连推/跳格·配 deepDecay。
6. **🥉 v2 四件**（extraAction/freeze/intimidate/withdrawRefundMul·`REQ-G-地煞新op`）。
> 长尾（mirage/minefield/bloodlessWin/volleyRelay…）→ 先用降级映射上线·验证后再按需下沉。

## 三、sim 现状（关11-52 难度曲线·已验证可达）
design G 跑采样验证（玩家进度爬·N=400·甲已实装留场硬币·地煞用可跑映射近似）：
| 关 | 目标WR | 命中 bossFav |  | 关 | 目标WR | 命中 bossFav |
|---|---|---|---|---|---|---|
| 11 | 58% | +6 |  | 35 | 37% | +5 |
| 15 | 54% | +8 |  | 40 | 34% | +5 |
| 20 | 49% | +5 |  | 45 | 32% | +8 |
| 25 | 44% | +8 |  | 50 | 30% | +8 |
| 30 | 40% | +8 |  | 52 | 30% | +5 |
> **结论：58%→30% 曲线可达**·每关 sweep bossFavorBias(+5~+8) 即命中目标·玩家天罡/地支进度已计入。具体每关精确值待甲实装上述 op + 接 campaign loader 后用各关真地煞重标（现为映射近似·出方向）。

## 四、级联（下一步）
1. 甲：按 §二 优先级实装通用 op + v2 四件（`REQ-G-地煞新op` 扩条）。
2. design G：op 实装后把想象版接回·每关用真地煞重跑 sim 定稿 bossFavorBias/disha 值。
3. 甲：campaign-data 关11-52 boss 序列(见 campaign-11-52-skeleton.md) + disha 落 DISHA_SPECS + 16牌组 loader。
4. 旧 `pack-*-stages-*.md` / `pack-N.md` 与本想象版二选一·Lead 裁定（建议：想象版为愿景·上线版按甲实装能力取子集）。
