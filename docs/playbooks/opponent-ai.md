# 对手 AI 手册（opponent-ai）

> AI = 数据：决策=条件树/行为树 · 性格=状态机 · 概率=种子骰 · 记忆=资源台账——游戏层零 AI system（BT 叶是唯一过审例外）。
> **⚖ owner 规矩（2026-08-10）：有对手/敌人/NPC 决策的游戏必须有 AI 设定**——初版可基本（性格一句话+决策口径+难度阶怎么爬），**随迭代同步更新，不许没有**。放哪：`capability-plan.md` §4.65 写摘要 + 详设落 `docs/design/<slug>/`（gdd「对手 AI」章或独立档）；S4 复查清单点名查这一条。
> 机读真相：各能力 `describe`；正样例 = game108 大师 v5（`games/game108/blueprint.ts`【R-108-34】六步链注释）· game-a 掼蛋 BT（`games/game-a/ai.ts`）。

## ① 做 X → 用什么

| 任务 | 能力实名 | 怎么接（一句） |
|---|---|---|
| 外层优先级策略（每 tick 重评估·牌桌/NPC） | `t2-behavior-tree` | selector/sequence/invert/condition/action 五节点纯数据树 + `registerBTLeaves(gameId,{...})` 注册叶（叶=过审 TS 例外）；黑板复用 Resource/Flag/StringVar；随机全经传入 RandomSeed |
| 回合制「读局面→决策→出手」 | `t2-event-when` + `t2-effect-apply` | 决策=`EventWhen{mode:'edge',when:条件树}` 抬信号 → `Effect` 落旗/出招；每级决策各占一拍（见坑⑧） |
| 决策窗口/相位门 | `t3-flow` | 相位态 onEnter 开关门旗，AI 规则的 when 与门旗取 and——**读公开信息的决策面只准开一拍**（见坑①） |
| AI 性格/心态 | `j1-state` + `Effect{kind:'set-state'}` | 心态=FSM（game108 四态 probe/press/bluff/finish），切态条件按局面查表；性格差=数据不改结构 |
| 概率行为（诈唬/沉默/失误率） | `Effect.chance{num,den}` | 走引擎种子 PRNG（`chancePass`·无 seed 不中=fail-closed）；BT 叶内用 `nextRandom(RandomSeed)`（`atoms/random`） |
| 对手记忆/玩家画像 | `f1-resource` 台账 | 逐手计数/风格指针=Resource，入账挂结算门（见坑②）；跨局由宿主从 localStorage 灌回初值 |
| 空间索敌（动作/波次） | `t3-aggro` | `Perception{targetTag,sightRadius,lureTag}` → 写 `Relation(target)`，steering 追/caster at:target 消费 |
| 对抗出招与判定 | `t2-matrix-duel` | AI 与玩家共用 throw 信号名，接缝靠 `Signal.source` 认侧（REQ-108-ENG-02）；判定表可带 patches（见坑⑦） |
| 难度阶/多对手 | 纯数据查表 | game108 五档对手=同一套规则骨架查 plan 表；心情→AI 查 `MOOD_AI` 表（`card-character.ts:44`），换对手=改一个字段 |

## ② 八件坑（每条都是 game108 实撞·出处可复查）

1. **定手窗防赖皮**——AI 出招规则挂整段相位门（`THROWING_GATE`）：edge 触发的输入中途一变=新上升沿，AI 在玩家出手**之后**改手、零报错（2026-08-08 实测：玩家出布→hist 变→大师改出剪刀，玩家永远输）。防：「读公开信息+决定」压进**只亮一拍**的窗（flow 两态相接，`{when:'always'}` 下一拍才走）。`games/game108/blueprint.ts:36`
2. **账期推迟到结算**——玩家画像出手当拍入账 = AI 同一回合读到玩家刚出的手（自我喂招，赖皮的另一半）。防：台账入账的 EventWhen 与结算门旗取 and，揭晓之后才记账。`blueprint.ts:395`
3. **心态机四态**——AI「性格」写成代码分支=改不动也测不了。防：心态=State FSM，切态条件+各态概率（`BLUFF_ODDS`/`SILENT_ODDS`）全查表；「它在适应我」的体感来自读准度驱动切态。`blueprint.ts:518`·`games/game108/theme.ts:189`
4. **种子骰**——AI 掷骰裸 `Math.random`=不可回放（红线）。防：`Effect.chance{num,den}`（`effect-apply.ts:123`·`chancePass` fail-closed）；BT 树内随机经传入 seed。`src/skills/atoms/random/index.ts`
5. **握手旗**——多级决策各占一拍，缺「前级已落地」旗=骰子拿**上回合**的心态摇、蓄力在沉默判出来之前抢跑，两处都零报错。防：每级完成落一面旗（`p2.moodSet`/`p2.diceDone`），下级 when 里等它。`blueprint.ts:455`·`theme.ts:223`
6. **冗余闸配结构测试**——双闸并存时行为测试只咬得住 B 闸（账期），A 闸（定手窗）零覆盖=裸防御，将来动 B 时 A 无人看守。防：**行为测不到就测结构**——断言决策规则必须含一拍窗旗、不许含整段相位门、窗口态禁 `after`；三种拉宽方式各自撤修即红。REQ-108-PE-01·`games/game108/game108.test.ts:878`
7. **判定表同源**——AI 的克星表与它实际对局用的表各写一份=静默反向：大师按标准表算克星、打的却是自己的反转表→玩家一只手 100:0 打穿，回顾还给自己读准度 +1（自我认知与战果相反，四道门全绿）。防：克星表从对局用的那份数据**现推**，测试判据同样现推不抄答案；整局 sim 对账。提交 891f33d89
8. **一级一拍**——同一拍里写旗又读旗，读到的必然是上一回合的值（引擎离散节律：信号→置旗→**下一拍**条件才读到）。防：每级决策各占一拍摊开（game108 摊成六步不是啰嗦）。`blueprint.ts:50`

## ③ 本线红线

- 游戏层**禁裸 `Math.random`**——一切 AI 概率走种子 PRNG（randomness.md）。
- AI 决策**接 DebugTrace 落痕**：`decision`（选了哪条路）/`reject`（拒了什么·「什么都没发生」的分支必须记）——`src/skills/debug-trace.ts`·日志基准守则。
- **AI 行为要点名测试**（含撤修即红的 sabotage 锚点）；行为测不到的保护测结构（坑⑥）。
- **难度阶/性格 = 数据不是代码**：档位差走查表/黑板值/FSM 态，不许一档一套 if。
- BT 叶=TS 例外，须 capability-plan 过审记债；简单平铺分支用 event-when/condition 就够，**别上 BT**（`t2-behavior-tree` describe 原话）。

## ④ 正样例 / 反面教材

- ✅ game108 大师 v5：四态心态机+两级决策+两枚种子骰，六步全数据、目录零 AI 代码（`blueprint.ts` masterRules）。
- ✅ game-a 掼蛋：一棵 BT 纯数据树，档位/性格差全走黑板值不改树（`games/game-a/ai.ts`）。
- ✖ 「大师一直在用别人的判定表」（提交 891f33d89）：两表各走各的，零报错地把 AI 打成送分机——修法与防复发见坑⑦。
- ✖ 决策规则挂整段相位门=赖皮（坑①）；出手当拍入账=自我喂招（坑②）；缺握手旗=静默错拍（坑⑤）。

## ⑤ 查不到怎么办

现有能力真表达不了的 AI 机制 → `docs/workflow/requests.md` 提缺口走 ⚖ 缺口裁决协议（先查 registry+本手册留原文 → 摆 A/B → owner 判）；词表小缺口走 `scripts/capgap.mjs add`。**不在游戏层写 AI system 逃生。**
