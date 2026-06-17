# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。
>
> **（2026-06-15 用户清理：本池仅保留 Game F / Game G 需求；非 F/G 条目（R9 / REQ-ARPG / REQ-C-005·006·007 / REQ-010 / BUG-002 / REQ-018）已移除，完整内容与 Lead 判定见 git 历史 commit `41ace96`。）**

---

## 待处理 / 进行中

### REQ-F-065 · [2026-06-17] · 策划 PF（装备系统 atk 生效 · owner 2026-06-17 钦定路A）· 框架级 · status: **open（提主程）** · 优先级: 中（装备武器线唯一阻塞）

**标题**：`scaleByResource` 支持「施法者本地资源」寻址（per-caster scaling），表达逐单位异质缩放

- **拉动（真实，已核代码）**：Game F 装备系统——武将拖装备（武器 +atk），**每个单位装备不同 → atk 加成异质**。现 `strike_${h.id}` 模板 `amount=finalAtk(h)` 是 build 期常量，星级靠预建模板族切换；伤害的 `scaleByResource`（hitbox.ts `findResourceById`）只查**全局**资源 → **无法逐单位缩放 atk**。HP 已能 live 生效（deploy override 写本单位 Resource），atk 不能。
- **想实现**：让 `scaleByResource`（或新增 `scaleByCasterResource`）解析时**先查施法者/spawn 源实体的本地资源，未命中再回退全局**（一处解析改动）。则：每将一个 per-unit 资源 `eq_atk`（deploy override 连续精确写），strike 按施法者 `eq_atk` 缩放 → 装备 atk 连续生效。
- **与 REQ-023 区别（不重复）**：REQ-023(group-effect) 被 wontfix 是因**同质**羁绊光环可走"全局 buff 资源 + 各单位读全局"重组；但它明确留口「**各单位状态异质、全局共享值表达不了**才下沉」。装备 atk 正是异质（每将不同装备不同加成），全局 buff 资源表达不了 → 命中该留口。
- **额外收益（manifesto 论据）**：现星级用"预建模板族 `_s{star}`"模拟逐单位缩放本身是 smell；此能力一并能让星级改用 per-unit 资源缩放，**退掉模板族爆炸**，净简化引擎而非加宽。
- **owner 决策**：2026-06-17 owner 在「路A(下沉小能力·连续精确·推荐) vs 路B(桶化模板·零引擎但量化+模板膨胀)」中**钦定路A**。
- **确定性**：deploy 拍写 per-unit `eq_atk`（构建快照 + 镜像关键帧均捕获，同 HP override 路径，安全）；纯整数/定点，回放不破。
- **交付后游戏侧接线（Program F，非引擎）**：deploy override 写 `eq_atk = Σ装备atk`；strike 模板 `scaleByResource: 'eq_atk'`（与全局 dmg_scale 叠乘）。

---

### REQ-023 · [2026-06-09] · 主程4（Game F 拉动）· 框架级 · status: **wontfix（2026-06-15 结案 · 重组覆盖）** · 优先级: 低

**标题**：`group-effect` —— 把效果 fan-out 到一组实体（集合写）

- **想实现**：羁绊光环——"3 战士羁绊 → 所有战士 +10 攻"。
- **建议**：`GroupEffect{ filter, action }` 把 action 施给每个匹配实体。
- **Lead 裁决（不 greenlit）**：多数逐单位羁绊光环可用 **group-count（数羁绊层数）→ 写一个全局 buff 资源 → 各单位 stat/hitbox 读该全局 buff** 重组绕过，不必逐单位 fan-out。只有"各单位状态异质、必须逐个写、全局共享值表达不了"的羁绊时才下沉。待真实拉动再评估。

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
