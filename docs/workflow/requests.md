# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。
>
> **（2026-06-15 用户清理：本池仅保留 Game F / Game G 需求；非 F/G 条目（R9 / REQ-ARPG / REQ-C-005·006·007 / REQ-010 / BUG-002 / REQ-018）已移除，完整内容与 Lead 判定见 git 历史 commit `41ace96`。）**

---

## 待处理 / 进行中

### REQ-023 · [2026-06-09] · 主程4（Game F 拉动）· 框架级 · status: **wontfix（2026-06-15 结案 · 重组覆盖）** · 优先级: 低

**标题**：`group-effect` —— 把效果 fan-out 到一组实体（集合写）

- **想实现**：羁绊光环——"3 战士羁绊 → 所有战士 +10 攻"。
- **建议**：`GroupEffect{ filter, action }` 把 action 施给每个匹配实体。
- **Lead 裁决（不 greenlit）**：多数逐单位羁绊光环可用 **group-count（数羁绊层数）→ 写一个全局 buff 资源 → 各单位 stat/hitbox 读该全局 buff** 重组绕过，不必逐单位 fan-out。只有"各单位状态异质、必须逐个写、全局共享值表达不了"的羁绊时才下沉。待真实拉动再评估。

---

### REQ-F-057 · [2026-06-10] · 策划 PF（「孙刘抗曹」合作 C0 前置）· 框架级 · status: **open（提主程；随时可做，不阻塞单机主线）** · 优先级: 中（联机唯一未证风险）

**标题**：战斗跨端确定性验证探针

- **要证的命题**：连续战斗 SIM（overlap 碰撞/aggro 距离/坐标投影中的浮点）在两个独立实例间逐拍 hash 一致。离散域（卡牌/经济/流程）已被 REQ-016/017 双端 lockstep 证过；HexPos 整数化（F-024/037）已把位置真相挪出浮点——剩这一根骨头。
- **建议形态**：扩 `src/net/lockstep` 既有 2 实例对拍：跑同一份 game-f 战斗蓝图（含 grid-move/滑行/hitbox/DoT/冰冻/大招全链）N=3000 拍，逐拍比 `world.hash()`；绿=联机地基就绪；红=输出首个发散拍+组件 diff 定位。
- **失败退路**：战斗浮点整数化/定点化（成熟技术）；探针本身就是在给这笔账定价。
- **范围注**：纯测试/工具，不动引擎语义。详见 `docs/game-design/game-f-coop-sunliu.md` §四.3/§五 C0。
- **Lead 注（2026-06-15）**：用户拍板 game-f 战斗用**整数 HexPos** → 同进程双实例探针即足（无需跨架构定点）；定点退路已在分支 `festive-planck` 实装备用。探针仍待建（game-f 联机真拉动时）。

- **PF 调查定论（2026-06-15，owner 裁决「探针=回归守卫，非命门」后核实）**：
  - **探针现状必假绿**：`determinism.ts:18` `NON_DETERMINISTIC={Camera,ScoreTrace}`，战斗 `Transform`(浮点)仍在 hash(:25)，:37 全精度入串 → 同进程同 FMA 必逐位相同 → 必绿；换端才发散。证实 owner 判断。
  - **整数 vs 浮点 = 混合**：移动是整数（`grid-move.ts` 自注「HexPos 永远 SIM 真相（占位/寻路/hash），Transform 是视觉投影、不被 Condition 读」），但命中结算/弹道/主角吃浮点（overlap-detect 经 `contact.ts` Math.sqrt 读浮点 Transform；steering 弹道；motion-apply 主角）。**裸 lockstep 跨端命中时序发散。**
  - **Math.random 附雷已排除**：全库仅 `mp-client.ts:13`（peerId 连接用），战斗路径 0 处 → 不需 seeded RandomSeed。
  - **关键收敛**：命门只在 **lockstep**（重演+hash 比对）下成立；而 game-f 既定同步是 **mirror**（`state-sync.ts` 关键帧+增量，权威端跑自己 PvE、对端只还原显示、不重演）—— owner 早先「核心战斗=各自 PvE，信息在玩家间传递」即此。**mirror 下战斗永不被对端重演 → 浮点命门不参与跨端比对 → 自动消解；`hashSnapshot` 仅 lockstep 调用。**
  - **结论**：game-f 战斗走 mirror（既定），浮点确定性**不阻塞** 三人；lockstep 仅承载离散跨玩家命令（卡牌/连携，整数/枚举，天然确定）。若未来要 lockstep 重演战斗，前置 = 命中结算整数化(combat.ts, PF) + Transform 移出 hash(determinism.ts, Lead) + 跨平台 CI。边界：`src/net/*` 属主程，PF 不碰。

---

### REQ-F-061 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **done**（2026-06-13，Lead）· 优先级: 中 · 类型: 真缺口（hitbox 缺血量条件门 + 处决）

**标题**：hp-条件伤害 / 处决（斩杀 / 残血加伤 / 狂暴）

- **想实现**：对 hp<X% 目标加伤/处决——玩家卡牌「白衣/攻心/渡江」+ 太阁 Boss 谦信/真田/立花/半藏（`game-f-deck-spec.md` §牌组10、`game-f-taikou-roster.md` §六）。
- **卡在哪**：`src/skills/tier2/hitbox.ts` 过滤只有 targetMask(Tag)/requireMask(Status)；伤害只有 amount+fracOfMax，**无「读目标当前 hp 比例做条件门」**。血量是连续 Resource 烘不成 Status；condition/event-when 是触发层，管不到命中那刻目标血量 → 真缺口。
- **建议**：`Hitbox` 加只读门 `requireHpFracBelow?`/`requireHpFracAbove?`（读 target current/max），不满足跳过；处决 `executeBelow?` 命中即清 0。**只读 hp 比例做 gate，不引入伤害分型/重定向**（守草船借箭回驳边界）。倍率走 REQ-012 mul、动态值走 REQ-013 valueFrom（均 done）。
- **Lead 评判（ACCEPT·已落地）**：真缺口核实——hitbox 结算循环只有 Tag/Status 门，命中那刻读不到目标 hp 比例；C→E→E 是触发层，够不到命中那刻目标血量。是**通用战斗原语**（处决/残血加伤跨 ARPG/自走棋复用，与 `fracOfMax`/`requireMask` 同类），数据**扁平**弱 LLM 可填——不是臃肿配置。落地：`Hitbox.requireHpFracBelow?/requireHpFracAbove?/executeBelow?`（乘法比较保确定性、缺省零迁移），`hitbox.ts` 加「②.5 血量门/处决」+ 3 守护测。关羽斩杀 = `Hitbox{ amount, targetMask:ENEMY, executeBelow:0.15 }`；残血加伤 = 第二个 `requireHpFracBelow` 门的打击区（重组）。

---

### REQ-F-062 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **open（Lead 打回细化，暂不实现——见评判）** · 优先级: 低-中 · 类型: 真缺口（aggro 索敌策略不可选，只能最近）

**标题**：aggro 索敌策略（最远 / 最高威胁 / 最低血，非只最近）

- **想实现**：刺客绕后锁后排、狙击锁最高威胁、嘲讽——玩家卡牌「绕后奇袭」+ 太阁 Boss 政宗/岛津。
- **卡在哪**：`src/skills/tier3/aggro.ts` 写死 `nearestByTag`；`Perception` 只有 targetTag/sightRadius，**无策略字段**，数据层无开关。
- **建议**：`Perception.policy?: 'nearest'|'farthest'|'highestStat'|'lowestHp'`（缺省 nearest，向后兼容）+ spatial-query 加对应变体（沿用 id tie-break 保确定性）。不改语义、不动定序。
- **Lead 评判（打回细化，暂不实现）**：① 核心 policy enum（nearest/farthest/lowestHp）确是真缺口（`aggro.ts` 写死 nearest、`Perception` 无策略字段）；但 ② **「嘲讽」不属本能力**——嘲讽是**目标侧**强制他人改指向，`Perception.policy`（攻击者侧）实现不了张飞嘲讽，混入是误判，须另案（目标侧机制）；③ **「最高威胁 highestStat」欠定义**——项目无"威胁"Resource，缺 stat 来源字段；④ **未被真实数据拉动**——关羽斩杀/张飞嘲讽仅在设计稿 HTML，实装数据零引用。按「不为想象需求拓宽引擎」（REQ-023 同纪律）**暂不实现**；待真实单位钉死具体策略需求，再落 nearest/farthest/lowestHp（嘲讽另案）。

---

### LEAD→PF · [2026-06-14] · Game F · status: **open** · 类型: 去腐交办（game-f 由「程序」变回「数据」；游戏侧执行）

**背景（Lead review 实测，跨游戏对比）**：game-f 不是"被描述成数据的游戏"，是一段 TS 程序——非测试码 **2658 行**、生成器构造（`for/map/Math/…spread`）**56 处**、**两段脉冲标记 114 个（其余 5 游戏合计 0）**、EventWhen×39 / Effect×115 / Flag×78（对照 game-b：0 / 6 / 5）。过不了"最弱 LLM 一致产出"尺子。**病灶单一、是"在数据里编程"，非架构问题**——`game-b` 已证纯数据可行。

**交办（全部游戏侧；引擎已备齐，Lead 不为此加任何能力）**：
1. **blueprint.ts → 纯数据 manifest**：照 `game-b`（`data/game-b.manifest.json` + 85 行薄 loader `parseManifest`，零工厂/闭包）把 `buildGameFBlueprint()` 的生成器（`band/visSwap/chrome/makeRoundFlow` + 循环 + 算术）展平成 JSON 实体表；算出来的值（CD_TICKS / income 档 / hp 计算）直接写定值。
2. **采用 GameShell（已落地 `@ui/shell`）**：DOM 壳层写成一份 `GAME_F_UI: UILayout` 数据（stat/bar/button→signal/tabs），**删** 697 行手写 `game-f.tsx` 壳 + canvas 隐形按钮 + DOM 假点击桥（x=2000）。
3. **商店两段脉冲（shop_marks→shop_marks2 等 114 个）→ 由 GameShell 数据 UI 取代**：面板不再靠多拍 destroy/重铺脉冲，改 GameShell 按 `CardPile.hand` 声明式渲染 → 脉冲标记清零。
4. **valueFrom 经济链（10 处）保留**（合法跨游戏能力，game-e 亦用），不必动。

**边界**：纯游戏侧。引擎该有的都有（manifest loader=game-b 证、valueFrom、flow、prefab、GameShell）。**Lead 明确回驳"把 game-f 脉冲下沉成引擎能力"**——脉冲 114 vs 全员 0 = 一个游戏的特有玩法，下沉会把 game-f 的臃肿注入共享引擎 = 腐蚀架构（同 REQ-F-062 / REQ-023 纪律）。

**验收**：blueprint 生成器构造 → ~0（展平为数据/JSON）；脉冲标记 → ~0；`game-f.tsx` 收敛成 ~30 行薄 mount（如 `game-b.tsx`）；过"最弱 LLM 能照填吗"尺子；tsc + vitest + build 全绿。

**Lead 裁决（2026-06-14 复核 PF 回报）**
- ✅ **band/visSwap/chrome 展平：验证通过**——调用/定义 →0、片0 快照守证 **byte 等价**、引擎零污染、1160 绿。真收益，收下。
- ⛔ **回驳"字面化 makeRoundFlow/templatesFor"（修正本交办原措辞）**：二者是**薄确定性展开器**（`makeRoundFlow`=pacing 配置；`templatesFor`=roster 数据→prefab + 阵营选择），与 game-b 的 `manifest.json + 85 行 loader` **同类**——**"数据驱动 ≠ 零函数"**，判据是"内容扁平 + 展开器薄/固定/确定"。硬字面化会砸 36 处测试快进 + 多阵营，得不偿失。**保留为"扁平数据 + 薄展开"。** PF 这条线划对了。
- ✅ **③ 解锁：Lead 已给 GameShell 加通用 `image` 节点**（静态 src / 绑 StringVar 动态 src；rule-of-three 远超：VN 立绘/换装/卡牌/商店；**非 game-f 脉冲下沉**）。商店=**固定 3 槽** → 3×(`image`+`stat`+`button`) 即可，**不需 `list`**（避模板化 DSL 腐烂高风险区，YAGNI 暂不加；真有干净跨游戏拉动再议）。**棋盘拖拽/点将台留 canvas（drag-place 能力），不归 GameShell。**
- **修订验收**：band/visSwap/chrome→0 ✅已达；makeRoundFlow/templatesFor 保留（不计入"生成器构造"目标）；脉冲清零 = PF 用 GameShell（HUD/tabs/buttons 用现有节点 + 商店用新 `image`）重写壳层 + 退役假点击桥。**引擎侧到此为止（image 已加，不再为 game-f 加任何能力）。**

**进度 + owner 裁决（2026-06-15，Program F 记账）**
- ✅ **脉冲清零**：商店两段脉冲（shop_marks/shop_marks2）+ 大卡模板 + 占位框全删，114→0（商店改 GameShell `image` shop_face / 后被 owner 调整，见下）。
- ✅ **band/visSwap/chrome 展平**（Lead 已确认）。
- ✅ **派生去腐（顺手）**：商店卡/名牌从 ROSTER 派生，删手抄 `HEROES`/`HERO_NAMES`（「加英雄=一条 HeroSpec」，过尺子）。
- ⛔ **②「game-f.tsx → 完整 GameShell / ~30 行 mount」= owner-overridden，标 wontfix（暂）**：owner（2026-06-15 真机复核）**明确撤掉 GameShell 与 canvas 并存**（报「棋盘下方堆出第二套点将台/主公卡」重复 bug），**钦定保留手写 DOM HUD**（主公信息卡复位左下角、右栏改盟友布阵预览）。GameShell 蓝本（`GAME_F_UI`）保留作数据壳层参考 + 测试，但**不在局内并存渲染**。
  - → **designer-loop「去腐 T-F4 硬优先」与 owner 决定冲突 → 以 owner 为准、暂挂**。若 owner 日后要全 GameShell 化（需 GameShell 长出 modal/drag-slot/动态 list 等通用节点，属 Lead），再重启。
- 余项（非 owner-blocked，按 Lead 裁继续）：blueprint→manifest 全量展平（大、低优先；makeRoundFlow/templatesFor 按 Lead 保留）。

---

### REQ-F-064 · [2026-06-15] · game-f（Boss 技能拉动，经用户转 Lead）· 框架级 · status: **wontfix / done-covered（2026-06-15 结案）** · 类型: 现有能力重组（非缺口）

**标题**：太阁 Boss 技能（信长全军 buff / 秀吉·本愿寺援军 spawn / 真田自残血加伤 等）

game-f 报「多数需新引擎能力」。Lead 实测：**三个已点名技能全部现有能力可表达 → 回驳；引擎冻结成立**。等价数据写法：
1. **信长·全军 buff** = `group-count`/触发信号 → `Effect{modify-resource dmg_scale_boss, valueFrom}` → 全 Boss 方 `Hitbox.scaleByResource` 读它。**game-f 自己已实装同款**（`decks.ts` synergy/threshold/round-buff 写 `dmg_scale_a`，`combat.ts:27` hitbox 读），Boss 版对称。
2. **秀吉·本愿寺援军 spawn** = Boss 技能信号 → `Caster{onSignal, template:'honganji_*', at:'self'}` → `SpawnRequest` → `prefab` 展开援军队。`caster.ts` 自陈「信号→生成桥…召唤」，示例含召唤/掉落。
3. **真田·自残血加伤**（注意：自身 hp，**非** F-061 的目标 hp）= `Condition(自身 hp < 阈值=frac×已知 maxhp)` → `Event`→`Signal` → `Effect{modify-resource dmg_scale_sanada}` → 其 `Hitbox.scaleByResource` 读它（Condition→Event→Effect + scaleByResource 重组）。

**流程纠正**：笼统「多数需新能力」不达需求模板「试了什么/卡在哪」的标准 → 一律回驳。某技能数据**确实**表达不了（如需连续反比血量、阈值+valueFrom 线性都不够）就**单提那一个**附失败重组，逐个评。

---

## 需求模板（复制这段填写）

```
### [YYYY-MM-DD] · [提出人 PA/PB] · [游戏名] · status: open
- 想实现的游戏行为：
- 已经试了什么（哪些原子 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案 / 伪代码 / 补丁（可选）：
- 最小复现（若是 bug）：
```
