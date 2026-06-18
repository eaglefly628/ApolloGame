# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。
>
> **（2026-06-15 用户清理：本池仅保留 Game F / Game G 需求；非 F/G 条目（R9 / REQ-ARPG / REQ-C-005·006·007 / REQ-010 / BUG-002 / REQ-018）已移除，完整内容与 Lead 判定见 git 历史 commit `41ace96`。）**

---

## 待处理 / 进行中

### REQ-E-021 · [2026-06-18] · PE（Game E 小丑牌 · 卡牌附魔/buff 拉动）· 框架级 · status: **done（引擎侧，2026-06-18，Lead）** · 优先级: 中 · 类型: 真缺口（逐张计分读不到「牌自带的修正」）

**标题**：`card-scoring` 逐张 pass 读取「牌自带的内禀修正」（per-card 附魔/buff）—— Card 携带 mods，迭代时套用

- **想实现（游戏行为）**：Balatro 的卡牌**附魔**——版式（foil +50筹码 / holo +10倍率 / poly ×1.5倍率）、增强（bonus +30c / mult +4m / glass ×2m / stone +50c）、红蜡封（该牌重触发）。本质：**一张特定的牌身上带着持久修正，在它计分时生效**——一个 per-card buff 系统。
- **已经试了什么 / 为何回驳「不加能力」的重组**：唯一的纯游戏侧路子是出牌时按附魔牌**落在出牌序列里的下标**临时注入 `PerCardRule{when:{index,eq}}`、tick 完移除。**这是牵强的**：
  - `PerCardRule`/`PerCardRetrigger` 的 `when` 只认 **suit/rank/index**（设计给**小丑规则**——扫描全手的外部规则，如"每张♦+3m"）；附魔是**某张牌的身份内禀**，不是位置/花色规则。
  - 用位置规则模拟身份附魔 → 游戏层每出一手都要**重新推算"我那张 foil 落在第几位"再注入规则**，这段绑定逻辑是**代码、每次动作重跑** → 过不了"最弱 LLM 一致产出数据"的尺子。错抽象（拿规则引擎模拟属性系统）。
- **卡在哪（引擎做不到的点）**：`Card = {suit, rank}`（`components/cardboard.ts:45`）**没有承载内禀修正的槽**；`card-scoring`（`tier3/card-scoring.ts`）的逐张循环已经**逐张拿到了 `c`**，但只累加 `baseChipsByRank[c.rank]` + 套外部 `PerCardRule`，**读不到"这张牌自带的修正"**。
- **建议方案（最小、与现有循环同构）**：
  1. `Card` 加可选 `mods?: Array<{ op:'add'|'mul'; target:string; value:number }>`（target=Resource id，如 chips/mult/money）。card-scoring 逐张循环里，在 baseChips 之后、按序套用 `c.mods`（与 baseChips 同一 `repeats` 重触发循环内，自然吃 retrigger），emit `appendScoreEvent(trace, 'percard-mod', …)`（UI 演出复用现有回放）。
  2. `Card` 加可选 `retrigger?: number`（红蜡封）：并进现有 `repeats = 1 + Σ…`（与 `PerCardRetrigger` 同算），让该牌连同其上 mods/小丑一起重复。
  - 版式/增强全是数据：foil=`{add,chips,50}`、holo=`{add,mult,10}`、poly=`{mul,mult,1.5}`、bonus=`{add,chips,30}`、mult=`{add,mult,4}`、glass=`{mul,mult,2}`、stone=`{add,chips,50}`。弱 LLM 可照填。
- **边界（守住，不外扩）**：① 只做**计分牌的内禀 mods + 内禀 retrigger**；② **不做**手牌内（held-in-hand）触发（steel/gold/blue/purple 蜡封那类——从手牌而非出牌结算，是另一条触发线，单提）；③ 不引入伤害分型/重定向/身份版 PerCardRule 匹配。
- **可复用性（非 Game E 专属）**：「实体携带修正、在被处理时套用」是通用 buff 原语——卡牌符文/装备词条/牌面状态跨卡牌游戏复用；与 REQ-F-061（命中那刻读目标 hp 做门）同类——都是**迭代/结算循环缺一处"读被处理对象的数据"**。
- **交付后游戏侧接线（PE，非引擎）**：数据 `Card`（`deck.ts`）带 `enchant` 字段 → `toEngineCard` 把它映射成引擎 `Card.mods/retrigger`；附魔**来源**用塔罗牌/卡包商店项（纯游戏侧数据 + 表现），给某张牌盖章。视觉徽标（角标/描边）游戏侧做。
- **请 Lead/主程裁决**：是否 ACCEPT 为 card-scoring 的最小扩展（同 REQ-F-061 纪律：迭代循环补"读被处理对象数据"）。
- **Lead 评判 + 落地（2026-06-18，引擎侧 done）**：核实 PE 全部论点属实（`Card={suit,rank}` 无槽 `cardboard.ts:45`；`PerCardRule/Retrigger.when` 只认 suit/rank/index 非身份 `card-scoring.ts:29`；模拟附魔需每手重算下标注规则=代码、过不了尺子）→ **真缺口，ACCEPT**。与 REQ-F-061/F-065 同纪律（结算循环补"读被处理对象自身的数据"）。
- **架构裁决（用户问：要不要扩成通用「Buff」抽象）→ 不扩，按窄做**：F-061/F-065/E-021 看着像一个东西，但**生效语境不同**（计分/伤害/命中各在自己循环）；统一 Buff 必逼出 trigger/context 规则引擎 = inner-platform 腐烂源、弱 LLM 更难一致产出、跨系统耦合、固化。正解：**语境=循环本身（隐式）**，各能力就地读相关数据；共性只收在小 shape `{op,target,value}`（PerCardRule/Effect 已用、Card.mods 复用）= 词汇复用非框架。真正跨语境、共享叠加/时长、≥2 游戏拉动时再议（现非）。
- **落地**：`Card.mods?: {op:'add'|'mul',target,value}[]` + `Card.retrigger?: number`（`cardboard.ts`）；`card-scoring` 逐张循环在 baseChips 后、`PerCardRule` 前按序套 `c.mods`，`repeats += c.retrigger`（连同 mods/小丑重复），emit `percard-mod` trace（UI 回放复用）。零迁移。测试：foil 异质 + 无 mods 不变 + add 先于 mul + 红蜡封重复。全绿（tsc + 1394 vitest + build）。
- **给 PE 的接线**：数据 `Card.enchant` → `toEngineCard` 映射成 `Card.mods/retrigger`；附魔来源(塔罗/卡包)、视觉徽标 = 游戏侧。

---

### REQ-F-065 · [2026-06-17] · 策划 PF（装备系统 atk 生效 · owner 2026-06-17 钦定路A）· 框架级 · status: **done（引擎侧，2026-06-17，Lead）** · 优先级: 中（装备武器线唯一阻塞）

**标题**：`scaleByResource` 支持「施法者本地资源」寻址（per-caster scaling），表达逐单位异质缩放

- **拉动（真实，已核代码）**：Game F 装备系统——武将拖装备（武器 +atk），**每个单位装备不同 → atk 加成异质**。现 `strike_${h.id}` 模板 `amount=finalAtk(h)` 是 build 期常量，星级靠预建模板族切换；伤害的 `scaleByResource`（hitbox.ts `findResourceById`）只查**全局**资源 → **无法逐单位缩放 atk**。HP 已能 live 生效（deploy override 写本单位 Resource），atk 不能。
- **想实现**：让 `scaleByResource`（或新增 `scaleByCasterResource`）解析时**先查施法者/spawn 源实体的本地资源，未命中再回退全局**（一处解析改动）。则：每将一个 per-unit 资源 `eq_atk`（deploy override 连续精确写），strike 按施法者 `eq_atk` 缩放 → 装备 atk 连续生效。
- **与 REQ-023 区别（不重复）**：REQ-023(group-effect) 被 wontfix 是因**同质**羁绊光环可走"全局 buff 资源 + 各单位读全局"重组；但它明确留口「**各单位状态异质、全局共享值表达不了**才下沉」。装备 atk 正是异质（每将不同装备不同加成），全局 buff 资源表达不了 → 命中该留口。
- **额外收益（manifesto 论据）**：现星级用"预建模板族 `_s{star}`"模拟逐单位缩放本身是 smell；此能力一并能让星级改用 per-unit 资源缩放，**退掉模板族爆炸**，净简化引擎而非加宽。
- **owner 决策**：2026-06-17 owner 在「路A(下沉小能力·连续精确·推荐) vs 路B(桶化模板·零引擎但量化+模板膨胀)」中**钦定路A**。
- **确定性**：deploy 拍写 per-unit `eq_atk`（构建快照 + 镜像关键帧均捕获，同 HP override 路径，安全）；纯整数/定点，回放不破。
- **交付后游戏侧接线（Program F，非引擎）**：deploy override 写 `eq_atk = Σ装备atk`；strike 模板 `scaleByResource: 'eq_atk'`（与全局 dmg_scale 叠乘）。
- **Lead 评判 + 落地（2026-06-17，引擎侧 done）**：缺口属实（异质 per-unit 缩放，全局 scaleByResource 表达不了，正中 REQ-023 留口；退星级/装备模板族 = 净简化）→ **ACCEPT**。**但原提案"scaleByResource 查施法者本地"漏了前提**：spawn 出的 strike 命中那刻**没有施法者实体链**（`PrefabOrigin`/`SpawnRequest` 只带 `originHex` 格、不带 source 实体）。故先补**源 threading**，再做本地解析：
  - `SpawnRequest.source` / `PrefabOrigin.source`（新 POD 字段）；`caster`(=`originEntity ?? 自身`) 与 `self-rule`(普攻=自身) 盖章 → `prefab` 转记到每个展开实体。
  - `hitbox.ts` 新 `findScaleResource`：`scaleByResource` **先查施法者本地**（源实体自身 + 其**同次展开的复合兄弟**，同 `templateId+seq`——因一实体一 Resource、main 占 hp，故 eq_atk 必在兄弟子件上）→ **未命中回退全局**（dmg_scale 等行为不变、零迁移）。
  - 测试：异质两将(eq_atk 3/5)同 amount 出不同伤 + 源自身快路 + 无 source 回退全局。全绿（tsc + 1375 vitest + build）。
- **给 PF 的接线契约**：① `eq_atk` 作 per-unit Resource 放在**棋子复合体的某个子件**（与 strike 的 `source`=棋子 main 同 `templateId+seq`；main 已占 hp），deploy override 连续写；② strike `scaleByResource:'eq_atk'`。**注意单 `scaleByResource` 只乘一项**——要 per-unit × 全局 dmg_scale 同乘，把 dmg_scale 折进 eq_atk（写时含团队系数），或单提"多段缩放"我再评（非本次最小下沉）。

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
