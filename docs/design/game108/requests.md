# game108《拳律 / Rule of Three》· 游戏级需求单

> 本单**不占引擎池硬槽**（`docs/workflow/requests.md` 的 10 槽铁律）。工单随游戏走。
> 引擎面改动条目在此登记 = **Lead 已裁但因引擎池满槽而降级存放**，派工时照本单的写死 spec 施工，边界不得扩。

## 待处理


### REQ-108-ENG-01-收益缩放（**owner 2026-08-06 判 A：补引擎缺口**·引擎面·降级存放） · `DuelPayoff.damage` 支持按资源线性缩放 · [2026-08-06] · game108 GDD v2 超休闲重构带出（owner 同日定「公开蓄力槽」机制） → **指派：Opus**（spec 写死·边界极窄） · status: **✅ 返工已交付（`perSide` 相对名组装·见下「返工交付」）·待复查侧验收**（打回原因与改判全文见下「复查侧验收（改判）」）（S1/S2 已 owner 签·本条 = game108 S3 唯一卡口·未落地不进玩法骨架） · 优先级: P1 · 类型: 既有能力扩写（`t2-matrix-duel`）
> **要什么**：`DuelPayoff.damage` 由固定整数扩为可选 `{base, scaleByResource, step}` → 伤害 = `base + 该侧该手资源当前值 × step`（game108 = `10 + 蓄力 × 10`）。资源按**侧 local 寻址**（同 `hpResource` 口径）；纯整数、无浮点；缺省仍收固定整数 = 零回归。
> **为什么不能重组**（Lead 评判·已走过「能否现有能力表达」）：穷举静态规则（「蓄力=1→10 / =2→20 / =3→30」×3 手×2 侧 = 18 条 `t2-event-when`）纸面可写，但**会被消费方自己的数据打碎**——game108 遗物「蓄海」把蓄力上限 3→4，**静态规则集无法预先穷举一个可被数据改写的上限**。这是「数据能改、规则集不能跟着改」的结构性矛盾，不是行数多少的问题。
> **通用性**：任何「同时决策 + 可变系数结算」同吃——蓄力/怒气/连击/加注倍率/兵力数值同一形状。
> **边界（防加宽·复查门核对用）**：只动 `DuelPayoff.damage` 类型与结算取值一处 + 落盘门校验（`scaleByResource` 须存在且非 `hpResource`）+ 点名测试（含「缺省固定整数零回归」一例）；**不碰**胜负判定 / 补丁 fold / 定序拆相位。允许触碰：`src/skills/tier2/matrix-duel.ts` + 其测试。
> 消费方与验收语义：`docs/design/game108/{gdd.md 【R-108-13】, capability-plan.md §4}`。

> **⚠ 施工主体锁（防双头同单·REQ-DIALOGUE 撞车事故教训「开工先在池子标施工主体」）**：
> 本条 2026-08-06 由 owner 直接推给**另一个 Lead session** 施工。
> **本策划 session（写 GDD/plan 的这个）不施工、不碰 `src/skills/tier2/matrix-duel.ts`**——
> 只在对方交付后按需做验收侧对账。任何第三个会话接单前先看这行。
>
> **降级留痕**：本条 2026-08-06 曾写入引擎池，因 `context-budget-guard` 判 11/10 超槽而按「满了先清后加·或降级」规则移到本单。
> 引擎池腾出槽位后可回迁；在此期间它仍是 **game108 S3 的唯一卡口**（未落地不进玩法骨架）。

---

## ⚖ 复查侧验收（策划 session·复查人 ≠ 施工人·2026-08-06）

**初判：✅ PASS** →（同日复核后）**❌ 改判：打回**。工程质量与边界都没问题，但**功能未达 spec 的核心要求**，见下「改判」。

| 核什么 | 怎么核的 | 结果 |
|---|---|---|
| 边界有没有被扩 | `git show --name-only e3a568fb` | ✅ 只碰 `matrix-duel.ts` + 其测试，与工单写死的允许范围一致 |
| 独立复跑 | 装依赖后 `vitest run matrix-duel.test.ts` | ✅ **38/38 绿**（33 旧 + 5 新·零回归） |
| 落盘门 | 读实现 + 测试 | ✅ 缩放式三字段校验齐、拒 `hpResource`、缺省固定整数零回归 |
| 不越权 | 读实现 | ✅ 未碰胜负判定 / 补丁 fold / 定序拆相位 |
| NaN 防线 | 读实现 + 测试 | ✅ 资源缺失退化 `base`、`Math.trunc` 取整，不让 NaN 进 hp 与快照 hash |

**施工方自陈的两处施工中自修（首版 local-only 寻址取不到蓄力、首版测试数值被 hp min=0 截断导致各档都=0 分辨不出真假）如实在案**——第二条尤其可贵，那是典型的「假绿」，自己逮出来并写进提交信息。

### 🔴 发现一：两侧用**同 id** 蓄力槽 → 静默取错侧（已实测复现）

`resolveDamage` 的寻址是 **local →（找不到）global 回落**。而引擎「一实体一组件」，出手方实体那份 `Resource` 已被 `hp` 占用，所以**蓄力槽必然另居实体 → local 永远落空 → 一律走全局回落 → 取到第一个同 id 的**。

**实测复现**（临时用例·跑完即删）：p1 石槽 3 / p2 石槽 0，**同 id** `charge_rock`；p2 以「自己蓄力 0」的石头取胜 → 期望伤害 `0+0×5=0`，**实得 15**（取了 p1 的 3），p1 血量 20 → 5。

- **不是引擎 bug**：施工方在提交信息里已写明契约是「蓄力用各侧唯一 id」，实现符合其自陈契约。
- **但它静默失败**：无报错、无警告，只是数字算错——正是 `matrix-duel` 自己文件头骂过的「最难查的一类 bug」。
- **对 108 的影响**：本作恰好是**六条槽（双方各三）**【R-108-03】，是这个坑的正命中形态。

**处置（按 owner 2026-08-05 漂移单路由铁律分流）**：

1. **游戏侧（必做·零成本·已落 `capability-plan.md §5`）**：六条槽一律用**各侧唯一 id**——
   `p1.charge.rock` / `p2.charge.rock` … 写成 game108 的**实现约定**，S3 骨架照此建资源。
2. **引擎侧 ✅ 已落地**（owner 2026-08-06 判「开单·现在做」·Lead 施工）：`resolveDamage` 的全局回落
   改为**必须唯一**——attacker 身上没有该 id 且全局命中 ≥2 份 → **点名硬抛**（报出份数 + 全部涉事实体 +
   改法建议），与本文件既有的「表外的手」「>2 份 DuelIntent」同口径：永不自愈的数据错不许静默。
   落盘门确实做不到（只看 `DuelMatrix` 数据、看不见世界里有几份同 id 资源），故只能在运行期。
   施工前先实证复现了复查方那个形态（p1 槽 3 / p2 槽 0 同 id → p2 以自身 0 取胜却结算 11 点、
   p1 血 20→9，静默多打 9 点），修后撤守卫转红 1 例；tier2 全域 640/640。
   **游戏侧第 1 条仍照做**：各侧唯一 id 是正解，硬抛只是防配错，不是替代品。

   > ⚠ **但这条只治「配错同 id」，不治下面那个结构性问题**——见「复查侧验收（改判）」。

---

## 🔴 复查侧验收（**改判·2026-08-06 同日**）

> **我先给了 PASS，是错的。** 第一轮只验到「同 id 会取错侧」，开的药方是「各侧唯一 id」；
> 第二轮实测发现**那条药方治不了**——问题比我说的深一层。**判词改为打回。**

### 结构性问题：payoff 缩放在「双方共用一张判定表」的对局里，无法按侧取值

1. `DuelMatrix.payoff` 是**双方共用一张表**，`payoff.rock.damage.scaleByResource` **只能填一个字符串**。
2. `resolveDamage` 的寻址是 local →（找不到）global：local 只看 **attacker 实体自己那一份 `Resource`**。
3. 但引擎**一实体一组件**，而 `hpResource` 要求「两侧各挂一份同 id 的 Resource」——
   **侧实体那唯一一个 `Resource` 槽已经被 hp 占死**。
4. ⇒ **local 分支永远落空 → 一律走 global → 取到某个固定实体，与出手方无关。**

**实测（临时用例·跑完即删）**：表里填 `p1.charge.rock`（p1 槽 3 / p2 槽 0），让 **p2** 用 rock 取胜——
按侧正确应为伤害 0（p2 自己槽=0），**实得 15**（取了 p1 的 3），p1 血量 100 → 85。
**换成同 id 也错、换成唯一 id 还是错**——因为表只能填一个，两条路都走不通。

### 定性

- 不是「契约没写清」，是**功能没达成**：工单 spec 原文写的是「伤害 = base + **该侧该手**蓄力资源 × step ·
  按侧 local 寻址」。施工方发现 local 取不到后改成 global 回落，**回落恰好把「按侧」这个唯一要点丢了**。
- 对 108 是**卡口级**：【R-108-13】伤害按**出手方**蓄力缩放，是本作核心规则之一；拿不到按侧取值，
  S3 骨架就没法照策划落地（写下去等于把错数字焊进骨架）。

### 建议的修法（Lead 举证·**A/B 由 owner 判**·依 CLAUDE.md 核心规则 3）

| | **A 引擎侧修**（推荐） | **B 游戏侧绕** |
|---|---|---|
| 做法 | `scaleByResource` 支持**按出手方组装**：表里填 `charge.rock`，运行期解析 `<attacker>.charge.rock`（游戏把槽命名为 `p1.charge.rock`/`p2.charge.rock`）。或等价的 per-side 前缀/映射字段 | 游戏层自己算伤害（= owner 已经否掉的原 B 案） |
| 代价 | 引擎一处解析 + 落盘门 + 测试（含「两侧各自取自己槽」对拍） | 两处结算并存·双真相（**owner 2026-08-06 已判不采**） |
| 通用性 | 高（任何双方对称的按侧缩放同吃） | 零 |

**Lead 推荐 A**，且这是**对既有工单的返工**（未达自身 spec），不是新需求。

### ✅ owner 2026-08-06 判 **A**——返工 spec（写死·施工主体仍 = 主程 Lead session）

- **要什么**：`scaleByResource` 支持**按出手方组装**。表里填**相对名**（如 `charge.rock`），
  运行期解析为 `<attacker>.<相对名>`（游戏把槽命名为 `p1.charge.rock` / `p2.charge.rock`）。
  具体用「前缀拼接」还是「per-side 映射字段」由施工方定，**但必须满足：同一张 payoff 表，
  两侧出同一手时各自按自己那条槽取值**。
- **兼容**：现有「绝对 id」写法与固定整数写法**都要继续работать**（零回归）——本次是加一条解析路径，不是改语义。
- **落盘门**：相对名同样不得指向 `hpResource`；解析不到时沿用既有「退化成 base·绝不 NaN」口径。
- **必须有的测试**（缺一不可）：
  1. **两侧对拍**——p1 槽=3 / p2 槽=0，同一张表、同一手，各自伤害只跟自己那条槽走（这条就是本次返工的验收核心）；
  2. 绝对 id 旧写法零回归；3. 固定整数零回归；4. 解析不到 → base 且非 NaN。
- **边界**：只动 `resolveDamage` 的解析 + 落盘门 + 测试；**不碰**胜负判定 / 补丁 fold / 定序拆相位 /
  上一轮刚落地的「≥2 份同 id 硬抛」。
- **消费方语义**：`gdd.md`【R-108-13】伤害 = `10 + 出手方该手蓄力 × 10`。

### 我自己的教训（记下来防再犯）

第一轮我验到「取错侧」就停了，**没有把「那条药方在真实数据形态下能不能成立」也验一遍**——
药方本身没过测试就写进了 `capability-plan §5` 当实现约定。**开药方也要有实测**，与找 bug 同一标准。

---

## ✅ 返工交付（主程 Lead session·2026-08-06）

**改判成立——我自己先复核过再动手**（没直接采信；上一轮复查方判过一次错，这轮不能靠信任过关）：
表填**唯一 id** `p1.charge.rock`（p1 槽 3 / p2 槽 0），让 p2 出手取胜 → p2 自己槽=0、按侧应打 0 伤，
**实得 15**（取了 p1 的 3），p1 血 20→5。且 `e06fb61c` 的「≥2 份同 id 硬抛」在此形态**不触发**
（唯一 id 只命中 1 份）。⇒ 根因与「同 id 还是唯一 id」无关，是**表只能填一个字符串**。

**解法（spec 把「前缀拼接 vs per-side 映射字段」留给施工方定，我选前者 + 显式开关）**：
`DuelDamage` 增可选 `perSide?: boolean`。`true` 时 `scaleByResource` 视为**相对名**，
运行期由纯函数 `scaleResourceId` 拼成 **`<出手方实体 id>.<相对名>`**（`p1.charge.rock` / `p2.charge.rock`），
再走原有寻址。缺省 = 绝对 id 原样，**零回归**。

**为什么用显式开关而不是「相对名找不到就试绝对名」**：这一整条线上的每个 bug 都出在静默回落上
（首版 local→global 回落丢了「按侧」· 全局回落取第一个静默算错侧）。再加一条隐式回落只会重蹈覆辙。
故 perSide 解析不到 = 直接退化成 base（绝不 NaN），**不去撞同名的绝对 id 槽**——这条有专门守卫。

**测试（spec 点名四条·缺一不可，全部在案）**：
1. ✅ **两侧对拍**（验收核心）：p1 槽=3 / p2 槽=0，同一张表同一手 rock，p1 出手打 15、p2 出手打 0；
   且把数值对调再验一遍，证明结果跟着数据走而非跟着实体创建序走
2. ✅ 绝对 id 旧写法零回归（共享池形态） 3. ✅ 固定整数零回归（既有用例） 4. ✅ 解析不到 → base 且非 NaN
+ `scaleResourceId` 纯函数三例 + 落盘门（`perSide` 非布尔拒收 · 相对名同样拦 hpResource · 合法写法零误报）
+ 「不做隐式回落」专项守卫。

**撤修复验红两轮**（均带锚点命中断言）：① 撤 `perSide` 组装 = **精确退回首版** → **3 红**，
其中就是「两侧对拍」——证明这条测试真咬得住被打回的那个缺陷；② 加一条隐式回落 → **1 红**。

**边界**：只动 `DuelDamage` 类型 + `resolveDamage` 解析 + 落盘门 + 测试。**未碰**胜负判定 /
补丁 fold / 定序拆相位 / 上一轮的「≥2 份同 id 硬抛」（后者仍在，只是作用域限定为同 id 配错的安全网）。

**验证**：`matrix-duel` 46/46 · **tier2 全域 646/646** · `scoped-gate` scope=full 全绿（退出码直核）。

**⚠ 游戏侧数据要跟着改**（`capability-plan §5` 已同步）：表里填**相对名** `charge.rock` + `perSide: true`，
槽命名 `p1.charge.rock` / `p2.charge.rock`。**只把槽改成唯一 id 而表里仍填绝对 id = 老毛病原样复发。**

---

### REQ-108-ENG-02-出招输入接缝 · `t2-matrix-duel` 补「信号 → DuelIntent」入口 · [2026-08-06] · **owner 判 A** · **施工主体 = 主程 Lead session**（本策划 session 不施工·防双头同单） · status: **✅ 已交付·待复查侧验收**（见文末「ENG-02 交付」）

> **要什么**：`DuelMatrix` 加可选字段 `intentSignals?: Record<手, 信号名>`。系统读本拍 `Signal`，
> 若信号名命中该表，则把 **`Signal.source` 那一侧实体**的 `DuelIntent.throw` 置为对应的手
> （已有 intent 则覆盖——同一时区内改主意是合法操作）。不填 `intentSignals` = 现状零回归。
>
> **为什么不能重组**（Lead 实查·留痕在 `capability-plan.md §4`「S3 实查发现」）：
> `Effect.kind` 闭集十项、`SelfAction.kind` 五项**都没有「加组件」**；`t3-prefab` 只新建实体、
> 不往已存在实体挂组件；`t2-weighted-spawn` 产 `SpawnRequest` 走 prefab 同上；
> `matrix-duel` 自己的 `describe` 原文是「给双方实体各挂 `DuelIntent`」= **假定别人挂好、自己不提供入口**；
> intent 也不能挪到别的实体——结算把**持 intent 的实体**当作该侧、伤害就扣它的 `hpResource`。
> ⇒ **UI 动作 / AI 决策 → intent 这条路，现有能力一条都走不通。**
>
> **定性**：`matrix-duel` 是解释器型能力，目前**有出口没入口**。先例 = `t3-dialogue`
> （自带 `dialogue.advance`/`dialogue.choose` 闭集输入接缝 + arg 通道，零游戏 handler）——
> 本条就是给 matrix-duel 补上同形的那一半。
>
> **一次解决两侧**：玩家点 UI 发信号、AI 由 `t2-event-when`→加权表发**同名信号**，走同一条缝。
>
> **必须有的测试**：① 玩家侧信号产 intent 并结算；② AI 侧同名信号产 intent（两侧同拍各自成立）；
> ③ 同一时区内改主意=覆盖；④ 不填 `intentSignals` 零回归；⑤ 落盘门：信号名非空、手必须在 `throws` 内。
>
> **边界（防加宽·复查门核对用）**：只加 `intentSignals` 的读信号置 intent 一处 + 落盘门 + 测试；
> **不碰** 判定 / 补丁 fold / 定序拆相位 / 伤害缩放（`REQ-108-ENG-01`）/ 「≥2 份同 id 硬抛」。
> 允许触碰：`src/skills/tier2/matrix-duel.ts` + 其测试。
>
> **消费方语义**：`gdd.md`【R-108-70】动作词表（`throw.rock`/`throw.paper`/`throw.scissors`/`throw.void`）+【R-108-30】AI 出招。

---

## ✅ ENG-02 交付（主程 Lead session·2026-08-06）

**三条「不能重组」的举证我逐条实查过**（不因上一轮你判对了就直接采信）：
`Effect.kind` **十项**（set-flag / set-flag-tagged / modify-resource / set-state / set-sensor /
set-visible / set-visible-tagged / destroy / destroy-tagged / reset-timer）— 无「加组件」✅；
`SelfAction.kind` **五项**（set-flag / modify-resource / set-state / destroy / spawn）— 同样没有 ✅；
全库唯一「组件类型名进数据」的是 `StatBind.bindings[].component`，但它是往**已存在组件**投影数值字段、
源是 ModifierTotals/Stats 不是信号 → 够不着 ✅。**举证成立，缺口是真的。**

**`t3-dialogue` 先例属实但形状不同**：它走 `InputQueue` 固定动作名 + `arg` 带可变部分。
我核过能不能照搬——**不能**：InputQueue 是全局输入、不带来源实体，而本件必须认侧；AI 也塞不进 InputQueue。
**所以你用 `Signal.source` 认侧、一条缝吃玩家 + AI 两侧，这个选择是对的**，照 spec 实现。

**实现**：第三个系统 `matrix-duel-intent`（**Commit 相位**）读本拍 `Signal` → 命中 `intentSignals`
→ 给 `Signal.source` 那一侧挂 `DuelIntent`（已有则覆盖）。落盘门四判：手须在 `throws` 内 ·
信号名非空 · 一个信号名不许映射两只手（同名两义）· 类型必须是对象。

### ⚠ spec 没提到的定序地雷（已实测·这是本条最需要交接的一点）

本系统读 `Signal`，而 `event-when` 是 Signal 写者且排在 `resource-apply` 之后。**放 Update 相位就闭合成环**——
实测把它改 Update，`topological-sort` 报：

```
环 [resource-apply, event-when, self-rule, matrix-duel, matrix-duel-intent]
（闭环组件 DuelIntent / Signal / Resource / ResourceModify / Flag / State）
```

**注意它不抛**：REQ-CYCLEHAZ B 之后是「告警 + 按注册序确定性裁决」，**落序不合语义但照跑**，
接缝**静默失效**（实测两条接缝用例转红、其余全绿）。⇒ 又一个只告警不拦的失败面，不能靠它兜底。
**解法 = 放 Commit**，走「标准离散反馈·一拍延迟」（同 `effect-apply` 口径），零定序改动（边界要求不碰拆相位）。

### 🎮 游戏侧要知道的两件事

1. **一拍延迟**：本拍发信号 → **下一拍** Update 结算。对局是秒级时区、一拍 = 一帧，无感知；
   但 **S4 验收剧本写步骤时要算上这一拍**（点击后立刻断言血量会失败）。
2. **`add-throw` 补丁增设的手，必须预先在 `intentSignals` 里留条目**才出得了——
   `intentSignals` 是基表字段、不参与补丁 fold（补丁三闭集改不到它）。
   108 的【R-108-70】动作词表已含 `throw.void`，**开局就把四条都填上**即可，别等拿到「第四指」遗物再想。
   （这是与 ENG-01 同类的「静态表被消费方数据打碎」形态，只是这次成本是**预先填满**而非改引擎，故不开新单。）

**测试（spec 点名五条 + 两条我加的）**：① 玩家侧信号产 intent 并结算 · ② AI 侧同名信号同拍各自成立 ·
③ 同一时区改主意 = 覆盖 · ④ 不填 `intentSignals` 零回归 · ⑤ 落盘门四判 ·
\+ 接缝只认对局侧（信号源不是挂 hp 的一侧 → 不产 intent）· + 系统契约（相位/reads/writes/runsAfter）· + 不成环回归。

**撤修复验红两轮**（带锚点命中断言）：① 相位改 Update → **3 红**（含两条接缝用例，即上文那个静默失效）；
② 撤核心写入 → **2 红**。

**边界**：只加接缝系统 + 落盘门 + 测试 + `reads` 申报补 `Signal`。**未碰**判定 / 补丁 fold / 定序拆相位 /
伤害缩放 / 「≥2 份同 id 硬抛」。新系统放 `systems` **末尾**，既有「两系统契约」测试的位置解构不受影响。

**验证**：`matrix-duel` 53/53 · **tier2 全域 653/653** · `scoped-gate` scope=full 全绿（退出码直核）。

---

## ⚖ 复查侧验收（两条返工·2026-08-06·**改判后的重验**）

**结论：✅ 双双 PASS。S3 两条卡口全部解除。**

这次我不只跑主程的单测——按 owner「**玩法验证完全依赖策划文档**」的口径，
用 **game108 真实数据形态**（双方 hp 100 + 六条 `p1.charge.rock` 式槽 + `perSide` 缩放 +
`intentSignals` 用【R-108-70】动作词表 + 真实通路 `EventWhen → Signal.source`）做**端到端条款对拍**：

| 验的条款 | 对拍场景 | 期望 | 实测 |
|---|---|---|---|
| **R-108-13** 蓄力缩放 | p1 石蓄 2 出石 vs p2 剪 | p2 −30 | ✅ 70 |
| **R-108-13 按侧** | p1 石槽满 3，但由 **p2** 用自己蓄力 0 的石头取胜 | 只打 10 | ✅ p1 90（**没取到 p1 那条 3** = 返工要点达成） |
| **R-108-15** 平局 | 双方同手 | 都不掉血 | ✅ 100 / 100 |
| **R-108-70** 动作词表 | 全程用 `throw.rock` 等真动作名驱动 | 能产 intent 并结算 | ✅ |

另：独立复跑主程单测 **53/53 绿**；边界核对两提交只碰 `matrix-duel.ts` + 其测试（+ 本目录文档），未越界。

### 📌 端到端对拍逼出的两条实现约束（S3 骨架必须照此建）

1. **接缝有一拍延迟**：`matrix-duel-intent` 在 **Commit 相位**（主程为避开 `event-when` 定序环而放的，
   实测放 Update 会合围成真环、且 `REQ-CYCLEHAZ` B 之后**只告警不拦**→ 接缝会静默失效）。
   ⇒ **点击当拍产 intent，下一拍才结算**。三时区的 T2→T3 转移必须 ≥1 tick，不能同拍收口。
2. **【R-108-14】出过即清零，引擎不负责**——实测结算后 `p1.charge.rock` 仍为 3。
   这与 plan §2 的判断一致（清零走游戏侧 6 条静态规则重组），**对拍留证，S3 必须真接上**，
   否则就是「策划写了、没人实现」的虚胖条款。

---

### REQ-108-ENG-03-结算副作用 · `t2-matrix-duel` 自带「清零 + 记本回合的手」 · [2026-08-06] · **owner 判 A1** · **施工 = 策划 session（owner 2026-08-06 授权自做自验）·复查 = 楚晨** · status: **✅ 已实现 + 自证在案·待复查**（Review 单：`review/REQ-108-ENG-03.md`）

> **要什么**：`DuelMatrix` 加两个可选字段，均在**结算末尾**生效（胜/负/平三态都要做）：
> 1. `clearOnSettle?: string`（**相对名**）—— 把双方**各自出的那只手**对应的 `<该侧>.<相对名>.<手>` 资源置 0。
>    本作填 `charge` → 结算后 `p1.charge.rock` / `p2.charge.scissors` 各自归零【R-108-14】。
>    **只清各自出过的那只手**，没出的手原样保留（这是【R-108-14】的要害，也是诈唬机制的支点）。
> 2. `lastThrowVar?: string`（**相对名**）—— 把双方本回合的手写进 `<该侧>.<相对名>` 的 `StringVar`。
>    本作填 `lastThrow` → `p1.lastThrow='rock'`。供【R-108-02】超时顺延与【R-108-30】AI「抄上一手」取用。
>
> **为什么不能重组**（Lead 实查·留痕 `capability-plan.md §7` 系统普查）：
> `t2-effect-apply` 的 `Effect` 只能写**数值/布尔/状态名**且 `targetId` **全局寻址**——
> ① 出招信号两侧**共用一个名**（靠 `Signal.source` 认侧），全局 `targetId` 分不清该清哪一侧的槽；
>    `@signal-source` 哨兵**只对物理 kind**（set-sensor/set-visible/destroy）生效，`modify-resource` 用不了。
> ② `StringVar` 只能由 `StringSet` 事件改，而**全库只有 `t3-poker-hand` 与 `x3-string-variable` 自己**产 `StringSet`；
>    `Effect.kind` 十项里没有「写字符串」。
> ⇒ **信号能改数字，改不了「按侧的数字」，也改不了字符串。**
>
> **为什么归 matrix-duel**（owner 判 A1 而非 A2 扩 `effect-apply`）：**它是唯一同时知道「谁出了什么」的地方**，
> 这两件事本就是它的**结算副作用**；而 `effect-apply` 是全库最核心的写入面，不该被一个游戏的需求推着改。
>
> **必须有的测试**：① 清零**按侧**（p1 出石 / p2 出剪 → 各自那只手归 0，**另外两只不动**）；
> ② 平局也清（双方同手 → 双方该手归 0）；③ `lastThrowVar` 按侧写对；
> ④ 两字段都不填 = 零回归；⑤ 落盘门（相对名非空、不得是 `hpResource`）。
>
> **边界（防加宽·复查门核对用）**：只在结算末尾加这两个可选字段的处理 + 落盘门 + 测试；
> **不碰** 判定 / 补丁 fold / 定序拆相位 / `perSide` 缩放 / `intentSignals` 接缝。
> 允许触碰：`src/skills/tier2/matrix-duel.ts` + 其测试。
>
> **消费方语义**：`gdd.md`【R-108-14】出过即清零 ·【R-108-02】超时顺延 ·【R-108-30】AI 抄上一手。

> **✅ 施工与自证（策划 session·2026-08-06·owner 授权自做自验）**：落点选在 `matrix-duel-announce`（Commit）——
> `ResourceModify` 只有加减没有 `set`，清零只能发「-当前值」故必须读 `Resource`，而结算系统（Update）
> **刻意不读 Resource**（读了与「排 resource-apply 之前」合围成环）；announce 排在 resource-apply 之后，
> 读到的正是扣血后的真值。自证：**撤修实测 3 红 → 复原 58 绿**；全量门禁绿（tsc + vitest 全量 + build + 守卫）；
> `announce` 的 `reads/writes` 声明如实更新并同步定序申报用例。**待楚晨照 Review 单复核。**

---

## REQ-108-UI-01 · ui-audit `solidBgUp` 遇渐变底跳过 → 渐变按钮全量假阳（报 PUI·非本 session 域）

**状态**：待 PUI 裁 ｜ **域**：`tools/ui-audit.mjs`（PUI 专职域·本 session 不擅改）
**提出**：策划 session 2026-08-07 · game108 S3 交付前跑 ui-audit 时撞到

**现象**：game108 对局屏三个 hero 键（`✊ 石` 及其副标）被判 `ratio=1.12` 硬失败（阻断），
但真渲染截图（`public/games/game108/probe/S3-render.png`）目击**清晰可读**。

**根因（实证·非推断）**：
- `src/ui/components/render.ts:288` —— hero 键 = `background:linear-gradient(180deg,t.gold,t.warn)`
  且 `color:t.bg0`（近黑字）。**渐变没有 `backgroundColor`**。
- `tools/ui-audit.mjs:102` `solidBgUp()` —— 逐层向上找第一个不透明 `backgroundColor`，
  **渐变底因为读不到 backgroundColor 被直接跳过**，一路落到兜底 `[6,8,13]`（近黑页底）。
- ⇒ 近黑字 vs 近黑兜底 = 1.12。字的**真实底**（金渐变）从来没被量到。

**影响面不止本游戏**：`game-c-play.audit.ts` 头注早已把同一形态记成「已知假阳」
（gold-sheen 加注键 + ink 暗字），`game-a` 亦有先例。即凡用 hero 键 / FillPreset 渐变面的暗色游戏
都会吃这一发，各自在审计入口写一段免责注释绕过——**假阳被分散消化掉了，阻断信号也就失效了**。

**建议解法（PUI 定夺）**：`solidBgUp` 在 `backgroundColor` 透明但 `backgroundImage` 是
`linear-gradient(...)` 时，**取首个色标当实底**，而不是跳过。
比「给每个 hero 键手标 `data-audit-skip-contrast`」更根治——后者是把检查关掉，前者是把底量对。

**本 session 已做的**：
- 真读不清的 8 处**已修**（`ProgressBar.showValue` 在暗底 = `t.dim` 11px → 实测 2.93，改自出高对比 Label）。
- 剩 6 处假阳按 game-c 先例在 `tools/audits/game108-duel.audit.ts` 头注留证据链，不掩盖。
- **边界声明**：本 session 只**新增**了 `tools/audits/game108-duel.audit.ts`（本游戏的审计入口·同各游戏惯例），
  **未改动** `tools/ui-audit.mjs` 或任何既有 PUI 文件。

---

## REQ-108-ENG-04 · 玩家出招接不进接缝：`Signal.source` 与房屋输入范式对不上（**缺口裁决协议·待 owner 判 A/B**）

**状态**：**owner 判 A（2026-08-07）· 施工中** ｜ **施工主体 = 策划 session（本单作者）**——按 owner 2026-08-06「引擎缺口自做自验 + Review 单」全库规矩认领，本行即占锁（先推一次再动手·防双头同单）｜ **复查 = 楚晨**（复查人 ≠ 施工人·红线不变）
**发现**：策划 session 2026-08-07 · S3 接线宿主时撞到 ｜ **阻断**：玩家三个出招键**接不上世界**（S4 玩法关的前置）

### ① 先查（协议第一步·留原文·禁凭印象）

| 查了什么 | 原文 | 结论 |
|---|---|---|
| 接缝怎么认侧 | `matrix-duel.ts:848-849` `const side = s.source; if (!side \|\| !world.hasComponent(side,'Resource')) continue;` | 只认**挂着 hp 的对局侧实体**做 `Signal.source` |
| keybind 怎么发信号 | `keybind.ts:83` `world.addComponent(id, {type:'Signal', name:kb.signal, source:id, ...(ev.arg!==undefined?{arg:ev.arg}:{})})` | `source` = **挂 KeyBinding 的那个实体**；已透传 `arg` |
| 房屋 UI 接线范式 | `game-f/blueprint.ts:287-294`、`game101:109`、`game-103:294/422` | 一律 **一动作一个专属 `kb-*` 实体** → `Signal.source='kb-throw-rock'` ≠ `p1` |
| 能不能把 3 份 KeyBinding 挂 p1 | **实测**（临时 vitest 探针）：连挂两份 → `getComponent` 只剩后一份、`query('KeyBinding').length===1` | **一实体一组件·第二份静默覆盖** ⇒ 挂不了 3 个 |
| 别的产 Signal 的件行不行 | `event-when.ts:92` `source:eid`（同样一实体一份）；`clickable.ts:113` `source:best.eid`（要 Shape/空间命中·UI 键不走空间） | 都是同一堵墙 |
| 有没有现成"代发"口 | `input.ts:49-54` `KeyBinding{key,signal,phase?}` —— **无 source 字段** | 没有 |
| 引擎里有没有 source≠宿主的先例 | `drag-place.ts:253` `addComponent(zid,{...,source:eid})`；`timeline.ts:27` `source:owner` | **有先例**：代发在引擎里是既成形态，不是新概念 |

**为什么重组不成**：房屋范式（一动作一 `kb-*` 实体）之所以对别的游戏都成立，是因为下游（`effect-apply`/`craft-recipe`/`event-when`）**按信号名 + 全局 `targetId` 消费，压根不看 `source`**。game108 是全库**第一个按 `Signal.source` 路由**的消费方（正是 owner 判过的 ENG-02 接缝），于是范式与消费方对不上。这不是我写错了接线，是两边范式的接缝没人对过。

> 补一句根因：这已是同一个病的**第五次**——前四次是「全局 id 路由分不清按侧」（伤害缩放 / 清零 / flow 胜负 / ProgressBar.bind），这次是反过来「按侧路由接不上全局范式的输入」。对称双方玩法碰全局 id 路由，默认要撞。

### ② 两条路（各附代价·影响面·通用性·选错要付什么）

**A · 补引擎缺口：`KeyBinding` 加可选 `source?: EntityId`（"代发"）**
- 改动面：`input.ts` 加一个可选字段 + `keybind.ts:83` 一处 `source: kb.source ?? id` + 落盘门 + 测试。**加法·不填=零回归**。
- 通用性：**高**。凡「谁做的这件事」要被下游认的场景（按侧/按座/按队）都吃这一口，不止 game108。
- 先例：`drag-place`/`timeline` 已在发 source≠宿主的信号，A 只是把这能力**开放给数据填**。
- 代价：碰的是**共享输入面**（`src/skills/tier2/keybind.ts`），按「引擎改动分两类」属 🔴（碰新增写目标语义）→ 归主程，或按「自做自验 + Review 单」由我做。**两条规矩打架，正是楚晨请你收口的那条。**
- 选错要付：几乎没有——可选字段不填即旧行为；真错了删字段即可。

**B · 游戏独有逻辑：宿主直接写 `DuelIntent`**
- 改动面：只动 `games/game108/game108.ts`，不碰引擎。**最快**。
- 代价：**破 UI 铁律**（"handler 里绝不塞自由逻辑·写世界一律经 action 信号"）+ 玩法逻辑从数据漏进宿主代码 = 数据驱动宣言的反面。且**帧同步/状态同步（【R-108-60~62】v2 联机）会当场废掉**——宿主写的组件不进输入流，回放/对帧全断。
- 通用性：零，纯游戏私货，还得记债。
- 选错要付：v2 联机时推倒重来。

**（另有一条 A′，供你一并看：让接缝改读 `Signal.arg`——一个 `throw` 信号 + arg 带手，KeyBinding 就能只挂一份在 `p1` 上。**只碰 matrix-duel 自己**、爆炸半径最小，且 `dialogue.choose`+arg 是现成先例。但它只修好 game108 这一处，下一个按 source 路由的消费方还得再撞一次。）**

### ③ 我的推荐（**只是推荐·不下裁决**）

**推 A**。理由：它把「代发」从两处硬编码（drag-place/timeline）提升成数据可填的通用能力，是**这五次同源事故里第一次能一次治本**的口子；代价是一个可选字段，选错成本几乎为零。A′ 更省事但等于承认「按 source 路由是 matrix-duel 的私事」，下次照撞。B 不建议——它省的那点工，要拿 v2 联机去还。

**请你判 A / A′ / B。** 判完我再改工单的「施工主体」并推一次占锁，然后动手。

---

## REQ-108-ENG-05 · AI 出招也接不进接缝：`EventWhen` 缺 `source`（owner 2026-08-07 判 **A**）

**状态**：**施工中** ｜ **施工主体 = 策划 session（本行即占锁）** ｜ 复查 = 楚晨
**由来**：S2 能力计划 §6 Lead 初裁挂的条件——「AI 两次决策【R-108-30】在开工首个验证项**先查**；
重组跑通即终止，跑不通则按协议摆 A/B 上报 owner，**Lead 不自裁**」。本单即那次先查的结论。
**阻断**：AI 出不了招 ⇒ 一整回合永远不结算 ⇒ **打不完一局**（S4 玩法关的核心循环）。

### ① 先查（留原文·禁凭印象）

AI 每回合要两个决策：**T1 蓄哪手** → 发 `ai.charge.<手>`；**T2 出哪手** → 发 `throw.<手>`。
**T1 通**（`effect-apply` 按信号名 + 全局 `targetId` 路由，与 `Signal.source` 无关）。**T2 不通**：

| 查了什么 | 原文 | 结论 |
|---|---|---|
| 接缝怎么认侧 | `matrix-duel.ts:848-849` `const side = s.source; if (!side \|\| !world.hasComponent(side,'Resource')) continue;` | 出招信号的 `source` **必须是 p2 本身** |
| `t2-self-rule` 能不能发信号 | `self-rule.ts:136` `SelfAction` 闭集 = `set-flag / modify-resource / set-state / destroy / spawn` | **没有「发信号」这一档** ⇒ 发不出 |
| `t2-weighted-spawn` 能不能 | `weighted-spawn.ts:82` `writes: ['Resource','RandomSeed','SpawnRequest']` | 只发 `SpawnRequest` ⇒ 发不出信号 |
| `t2-event-when` 能不能 | `event-when.ts:92` `addComponent(eid, {type:'Signal', name:ew.signal, source:eid})` | 能发信号，但 **`source` 恒为挂 `EventWhen` 的那个实体**、无字段可配 |
| 那把 `EventWhen` 挂 p2 上呢 | 一实体一组件（**已实测**：连挂两份 → `query` 只 1 条、后者静默覆盖前者） | p2 只放得下 **1 份**，而出招要 **3 手** ⇒ 不够 |
| `t3-timeline` 能不能（它发 `source: owner`） | `timeline.ts:21/27` `owner` = **挂 Timeline 的实体本身**，非可配字段；且 cue 按固定 tick 发 | 挂 p2 可得 source=p2，但 cue 是**写死的编排**，表达不了「按权重抽一手」 ⇒ 表达不了【R-108-30】 |
| 绕道：给 `EventWhen` 实体挂个 `Resource` 骗过接缝守卫 | 接缝只查 `hasComponent(side,'Resource')` | **实证否掉**：`DuelIntent` 会落到那个假实体上，matrix-duel 按 `DuelIntent` 持有者枚举双方 ⇒ 打的是假侧、真 p2 不掉血；且假实体要挂 id=`hp` 的 Resource，正好撞 `matrix-duel` 对「≥2 份同 id 资源」的**点名硬抛** |

**⇒ 重组不成**，且根因与 owner 已判过的 `REQ-108-ENG-04` **完全同一条**：
「**按 source 认人的消费方** vs **产信号的件把 source 写死成自己**」。
ENG-04 只给 `KeyBinding` 开了 `source`（玩家那条路），**AI 走的 `EventWhen` 那条路没开**。

### ② 两条路（Lead 举证·不下裁决）

**A · 给 `EventWhen` 加同款可选 `source?: EntityId`**
- 做法：与 ENG-04 **逐字对称**——`event-when.ts:92` 一处 `source: ew.source ?? eid` + 空串硬抛 + 测试。
- 改动面：`input.ts` 同级的组件定义 + 一个能力一处取值。加法·不填=零回归。
- 通用性：**高**。任何「条件成立 → 代表某个主体发信号」的场景（AI 行动、队友、召唤物、陷阱记账到布设者）。
- 代价：又一次加宽同一个概念。**这也正是它的好处——两处不对称才是真的坏**：玩家能代发、AI 不能，本身就是缺陷。
- 选错要付：几乎为零（可选字段不填即旧行为）。

**B · 游戏层写 AI**（宿主每回合算一手，直接往世界里挂 `DuelIntent`）
- 改动面：只动 `games/game108/`，最快。
- 代价：**AI 逻辑漏出数据层**；【R-108-60~62】v2 联机时服务器没有这套 AI；确定性/回放自负；
  且违背「人/AI 共用动作总线」（CLAUDE.md UI 铁律原话）。
- 通用性：零，记债。

**（附一条 A″ 供你一并看：把 `Signal.source` 的可配性**一次性**收敛成通用契约——凡产 `Signal` 的件
（`event-when`/`clickable`/`drag-place`/`timeline`/`keybind`）统一支持可选 `source`。
好处是**一次治完**不用再撞第三次；代价是一口气碰五个能力，面比 A 大得多，且 `clickable`/`drag-place`
的 source 有空间语义（命中谁就是谁），未必该开。**我不推 A″**——没有实证需求的那三个属于无脑加宽。）

### ③ 我的推荐（**只是推荐·不下裁决**）

**推 A**。理由：它是 owner 已经判过的 ENG-04 的**对称补齐**，不是新概念；面最小；
而「玩家能代发、AI 不能」这种不对称本身就是缺陷面。A″ 太贪，B 要拿 v2 联机去还。

**请你判 A / A″ / B。** 判完我改「施工主体」推一次占锁再动手。

---

## REQ-108-ENG-06 · 结算不认时区：出招当拍就扣血，条款要求在 T4（owner 2026-08-07 判 **A**）

**状态**：**施工中** ｜ **施工主体 = 策划 session（本行即占锁）** ｜ 复查 = 楚晨 ｜ **发现方式**：S4 验收剧本①（照条款写·不照实现写）当场红

### 现象（实测·非推测）

剧本①在 T2 出招后断言「血量不变」，实测 **p2.hp 已经是 70、石槽已经是 0、lastThrow 已写好**。
即：**双方 intent 一凑齐就立刻结算**，不管当时是哪个时区。

**数值全对，只有时机错**（伤害 30 / 清零 / 记手都符合条款）。其余 4 条剧本全绿。

### 为什么这是实现错而不是条款错

【R-108-01】的四拍表把职责写死了：**T2 = 同时提交·全程隐藏**；**T3 = 亮拳→判定→伤害演出**；
**T4 = 出过的手清零·扣血·判胜负**。现在扣血发生在 T2。

**玩家侧的实际后果**：先点先看见结果——你出招那一刻血条就掉了、槽就清了，
**"亮拳"那 2 秒变成播放已经发生过的事**。而亮拳正是本作的情绪核（§13 演出：亮拳三连 cue）。
按 owner 立的口径「实现与条款不符 = 实现错，改实现不改条款」，这条归实现。

### ① 先查（留原文）

| 查了什么 | 原文 | 结论 |
|---|---|---|
| matrix-duel 有没有结算门 | 结算系统 `const intentIds = world.query('DuelIntent')...` —— 全文无 `settleWhen`/`gate`/`onSignal` 任何门 | **无条件结算**，凑齐即算 |
| flow 能不能在进 T4 时发信号 | `FlowAction.kind` 闭集 = `set-flag \| set-state \| modify-resource`（`logic.ts:181`） | **发不了信号**，但 **set-flag 能置旗** |
| 那能不能延后产 intent | 接缝在收到出招信号当拍产 `DuelIntent`；玩家的点击就发生在 T2 | 要延后就得缓存「谁想出什么」到 T3——需按侧按手的信号，撞 `ENG-05` 同一堵墙 |

⇒ **重组不成**。但 `flow.onEnter` 的 `set-flag` 已经是现成的「现在是 T4」信号源，**只差消费端认它**。

### ② 两条路（Lead 举证·不下裁决）

**A · `DuelMatrix` 加可选结算门**（`settleWhen?: ConditionExpr`，或更窄的 `settleWhenFlag?: string`）
- 做法：结算系统开头求一次门，不成立就 `return`（intent 原样留着，等门开）。
  游戏侧：T4 状态 `onEnter:[{kind:'set-flag',targetId:'duel.settle',value:true}]`，转出时置回 false。
- 改动面：一个可选字段 + 结算系统一处早退 + 落盘门 + 测试。**不填 = 零回归**（凑齐即算，旧行为逐字节不变）。
- 通用性：**高**。凡「同时决策 + 有揭晓节奏」的玩法都要它——猜拳/押注/兵种相克/田忌赛马，
  没有这个门，`t2-matrix-duel` **只能表达"即时结算"，表达不了任何有揭晓节拍的对局**。这是解释器本身的表达力缺口。
- 选错要付：几乎为零。

**B · 游戏层自己控时序**（宿主/游戏层在 T4 才把 intent 挂上去）
- 代价：intent 何时成立 = 玩法规则，挪进游戏层就是**结算时序的第二个真相**；
  且宿主写组件不进输入流，【R-108-60~62】v2 联机对帧会断。
- 通用性：零，记债。

### ③ 我的推荐（**只是推荐·不下裁决**）

**推 A**。理由：这不是 game108 的偏好，是 `t2-matrix-duel` 作为"同时决策解释器"的**表达力缺口**——
一个连"揭晓节拍"都表达不了的对决解释器，只能服务即时结算这一种玩法。
而修法极窄：一个可选字段 + 一处早退，且 `flow.onEnter` 的置旗能力现成。

**请你判 A / B。** 判完我改「施工主体」推一次占锁再动手。

> **与 `ENG-05` 的关系**：两张单都卡在 S4，可一并判。
> ENG-05 = AI 出不了招（打不完一局）；ENG-06 = 出了招结算太早（打得完但节奏错）。

---

## REQ-108-ENG-07 · 结算门开了之后，`DuelIntent` 失去生命周期（owner 2026-08-07 判 **A**）

**状态**：**施工中** ｜ **施工主体 = 主程 Lead session（本行即占锁·先推再动手）** ｜ 复查 = 策划 session
｜ **发现方式**：主程复查 ENG-04/05/06 时的第③步实证探针（判词全文 `review/REQ-108-ENG-04-05-06.md`）

**现象（三探针实证·非推测）**：门开→两侧 `armed`；改主意（ENG-02 明许）会清掉 `armed`；
门关后这两份 intent **没人清**（结算是唯一清理点，而门关着不结算）→ 滞留到**下一回合**，门重开时
**用上一回合的手结算**：实测 p1 血 20→13，p2 本回合根本没出手却打出 7 点伤害。**零报错。**

**根因**：ENG-06 制造了「intent 可以长期不结算」的窗口；而 `DuelIntent` 从设计起就没有
「属于哪一回合」的概念——原本"凑齐即算"让它活不过一拍，问题不存在。**是两单的交叉，不是谁的实现错。**

**owner 判 A（引擎侧收口）**。施工口径见下方交付段。

### ✅ ENG-07 交付（主程 Lead session·2026-08-07）

**改法**：在 Commit 接缝的 arming 那一段加**过期回收**——门**关着**而某份 intent **已经 armed**
⇒ 它的揭晓窗口已经过去却没结算完（唯一成因：armed 后被 ENG-02 接缝改主意 / 单侧掉队，而结算要两侧齐）
→ **回收该 intent** 并留一条 `reject` trace。

**只回收 armed 的**，这是要害：没 armed 的是「本回合已提交、正等门开」的正常态（T2 出招 → T3 揭晓），
一并清掉就把玩法打断了。**这条有专门守卫。**

**为什么不做「回合标识」**（A 的另一种写法）：`DuelIntent` 没有回合号，要加就得让本件维护回合计数
= 新增跨拍状态，而本件文件头明写「不留任何跨拍状态」。过期回收只用**已有的 `armed` + 门的当前值**，
零新增状态、零新增读面（那段本来就在读 `Flag`），也不碰定序。

**测试 4 例**：
1. **【验收核心】** 滞留 intent 不再带进下一回合——原缺陷是 p1 血 20→13、p2 本回合根本没出手；现在双方都是 20
2. 只回收 armed 的：门关着提交的 intent 不许动（否则 T2 出招直接废掉）
3. 不设 `settleWhenFlag` → 整段不跑（零回归）
4. 回收留痕：trace 里有一条 `reject`（日志基准守则第 3 类）

**撤修验红**（带锚点命中断言）：撤掉过期回收 = **精确退回缺陷态** → **2 红**，其中就是验收核心那条。

**边界**：只动 Commit 接缝 arming 段 + 测试。**未碰**判定 / 补丁 fold / 定序拆相位 / `perSide` /
`intentSignals` 语义 / ENG-06 的门判本身。

**验证**：`matrix-duel` 68/68 · `scoped-gate` scope=full 全绿（退出码直核）。

**留给复查（策划 session）**：ENG-06 的门是**瞬时还是常真**由游戏数据决定。本次回收让「瞬时门 + 改主意」
不再错分，但那一回合会**无人出局**（双方 intent 都没了）——这是正确行为还是该补一条「本回合作废」信号，
是**玩法侧的判断**，不是引擎能替你定的。S4 剧本建议加一条覆盖这个形态。

## REQ-108-ENG-08 · 运行期改不了判定表：遗物/碎片当场生效没有通路（**待 owner 判 A/B**）

**状态**：**待 owner 判** ｜ **发现方式**：S4 自证对齐单第 10 行（`self-check/S4-alignment.md`）

### 现象

【R-108-41】局间二选一遗物、【R-108-42】局内逆转碎片——**都要求当场改写判定表**。
大师的**静态**改表已通（`patches` 写在蓝图里·剧本⑩绿），但**玩家选一张碎片让它当场生效**没有通路。

### ① 先查（留原文）

| 查了什么 | 结论 |
|---|---|
| `patches` 在哪 | `DuelMatrix.patches`——**对局实体上的组件数据** |
| 谁能在运行期写 `DuelMatrix` | 全库**无**：`Effect.kind` 十项只写数值/布尔/状态名；`FlowAction` 三项同理；`SelfRule.do` 五项同理；`craft-recipe` 只动 Resource/Flag/State |
| capability-plan 当时怎么说 | 「往 `DuelMatrix.patches` push 一条，下一拍结算即生效」——**那句话只说了"生效"，没说"谁来 push"**。这是我在 S2 写的，当时没查到写入侧 ⇒ **又一次「重组方案没查到字段级」** |
| 能不能预置全部碎片再用 flag 开关 | `patches` 是数组无条件 fold，**没有条件字段**（`DuelPatch` 三闭集都没有 `when`） |

⇒ **重组不成。**

### ② 两条路（Lead 举证·不下裁决）

**A · 给 `DuelPatch` 加可选 `whenFlag?: string`**（fold 时该 flag 为真才套用）
- 做法：预置全部碎片的 patch，选中即置对应 flag（`craft-recipe.grantsFlag` 现成）。
- 改动面：fold 处一个条件 + 落盘门 + 测试。**不填 = 零回归。**
- 通用性：高——「规则可被局内事件开关」是构筑类玩法的通用形状。
- 代价：fold 要读 Flag。**注意**：fold 发生在结算系统（Update·刻意不读 Resource），
  实测加 `Flag` 读面会成环 ⇒ 多半得走 ENG-06 同款套路（Commit 判、Update 认）。**这条我还没实测**，
  施工时必须先验，不能想当然。

**B · 宿主在选碎片时直接改 `DuelMatrix` 组件**
- 代价：规则改写这件事漏进宿主代码；v2 联机对帧断；且绕过落盘门（坏补丁不再被拒收）。

### ③ 推荐

**推 A**，但**附带一个诚实的不确定**：A 的定序可行性我还没实测（见上）。
若实测发现 fold 处加不了读面，A 要变形成「Commit 侧预解析」，那时我会回来重新摆路，不闷头改。

**请你判 A / B。**

---

## REQ-108-UI-02 · 「摇拳」动画表达不了：闭集缺「循环·旋转+放缩晃动」与「大幅度侧向伸入」（报 PUI）

**状态**：待 PUI/owner 裁 ｜ **域**：`src/ui/components`（PUI 专职域·本 session 不擅改）
**由来**：owner 2026-08-07 定 UI 方向——**横版**、中间走道空出来留给手、
**手从左到右伸出来展开**、**出招前上下晃 + 旋转性的放缩晃动**、其余控件围绕这只手展开。

### ① 先查（实查·闭集原文）

`layout.anim` 闭集（`types.ts:62-63`）：
一次性 `fadeIn/slideUp/pop/shake/dealIn/flyIn/fadeOut/popOut`；循环 `float/glow/pulse/spin/floatUp/marquee`。
关键帧实体（`server.ts:184-193`）：

| 要的效果 | 现有件 | 差在哪 |
|---|---|---|
| 手**从左到右伸出来展开** | `flyIn` = `translateX(-24px) → 0` | 方向对，**幅度只有 24px**——是"轻微入场"不是"伸入"。走道要多宽就得能位移多远，写死的 24px 表达不了 |
| 出招前**上下晃动** | `float` = `translateY(0→-12px→0)` 循环 | ✅ 有 |
| **旋转性的放缩晃动** | `pulse`(缩放) / `spin`(匀速自旋 360°) / `shake`(左右 4px·**一次性**) | **没有**「循环的 rotate+scale 摆动」。且**一个节点只能挂一个 `anim`**，三样叠不起来 |

⇒ **重组不成**：`layout.rotate/scale` 是**静态值**（每帧重渲可以自己算，但那等于游戏层手搓动画曲线 = 手写逃生，破铁律）。

### ② 为什么这条不能降级绕过

「摇拳」不是装饰——**它是石头剪刀布的节奏本体**（一、二、三、出）。
【R-108-01】把 T2 定为「同时提交」、T3 为「亮拳」，而玩家对这个玩法的肌肉记忆全在那三下摆动上。
没有它，横版走道做出来也是空壳：手瞬间出现在中间，跟现在的 emoji 切换没有本质区别。

### ③ 建议（PUI 定夺·我只举证）

**A · 扩 `anim` 闭集两项**（最小）：
- `wobble`：循环 `rotate(±8deg) + scale(1→1.08→1)`——摇拳/蓄势/紧张的通用件。
- `flyInFar`：或给 `flyIn` 加可选幅度（`animFrom?: number` px），让"伸入"的距离跟走道宽度对得上。

**B · 加一个 `anim` 的组合位**（`anim2?: string`）让循环动画可叠（float + wobble）。
代价：两条动画同时改 transform 会互相覆盖，得在关键帧层面合成——比 A 复杂得多。

**推 A**：两个关键帧 + 一个可选数字，加法零回归；且 `wobble` 是通用件（蓄力、紧张、待机都用得上），
不是 game108 专属。

### ④ 本 session 的边界

**未动 `src/ui/components` 任何文件**。横版重构等这两件到位再做——
先做布局、后补动画的话，中间那条走道会空着没东西可放，等于把返工排进计划里。

### REQ-108-UI-03 · 面板缺「平移投影」（卡通立体感的基件）· [2026-08-07] · owner 当场指出 · status: open（待 PUI/Lead 裁）

- **病**：owner 看图第一句——「你 / 蓄力 / 复读机 这三个牌**不是 3D 浮空的**，下面该有颜色和阴影」。
  设计定稿里这是全屏统一的语言：`box-shadow: 0 4px 0 #14776a`（身份牌）/ `0 5px 0`（相位牌）/
  `0 7px 0`（招式卡）/ `0 8px 0 #c9932a`（主 CTA）——**硬边偏移投影**，不是模糊阴影，
  卡通 UI 的「浮空感」全靠它。
- **查过了**：`PanelProps` 有 `bg / edge / accent / dashed / radius / shape / skin / glass / vignette`，
  **没有任何投影字段**；`layout` 里的 `press3d/tilt3d` 是交互态（:active/:hover）不是常态投影；
  `accent` 那条 `box-shadow` 是固定的柔光不可配。→ 现有闭集**表达不了**。
- **现在的做法（可用但是绕的）**：`games/game108/plate-art.ts` 生成一张画好了「面 + 墨边 + 偏移投影」
  的 SVG，用 `Panel.skin` 贴上去。像素对得上，代价是**每一块面都是一张生成图**，
  且尺寸一改就得重生成（源图尺寸必须等于盒子尺寸，否则 `<img>` 按固有比例反过来定尺寸——已踩过）。
- **两条路（Lead 给推荐·owner/PUI 裁）**：
  - **A 补引擎缺口**：`PanelProps.shadow?: { y: number; color?: SurfaceToken|string }`（闭集语义色优先）。
    代价：动 `src/ui/**`（PUI 域）+ 全库 render 面；收益：**这是商业卡通 UI 的通用件**，
    game-i 的糖果钮、apollo-toon 的厚唇皮都在手搓同一件事，下沉后一处配全库受益。
  - **B 维持贴图法**：game108 自持 `plate-art.ts`。代价：每个走卡通风的新游戏各抄一份；
    且「面」变成了美术资产，尺寸/圆角/描边改动都要过生成器。
  - **推荐 A**：判据是「最弱 LLM 能不能产出同样的数据」——`shadow:{y:4,color:'#14776a'}` 能，
    "去写个 SVG 生成器"不能。
- **验收**：`Panel{shadow:{y:4}}` 渲出硬边偏移投影；game108 的 `plate-art.ts` 能删掉投影那一支。

### REQ-108-UI-04 · 缺一款**卡通粗中文**字体槽 · [2026-08-07] · owner 当场指出 · status: open（待 PUI 裁）

- **病**：owner——「字体不够饱满，要一定的艺术粗体」。设计定稿指定 **ZCOOL KuaiLe（站酷快乐体）**
  作为全屏中文显示字，Fredoka 作为数字字。
- **查过了**：`Label.font` 的 CJK 艺术字槽只有四款——`cnbrush`(马善政毛笔行楷) / `cnwen`(站酷小薇文艺细宋) /
  `jpbrush`(筑紫日文毛筆) / `jppen`(Klee One 日文楷書)。**三款是毛笔/楷体、一款是细宋，没有一款是粗卡通体**。
  拉丁侧 `bubbly`(Baloo 2) 与 Fredoka 同族圆润，数字这一半已经能顶上（现用它）。
- **现在的做法**：中文走主字体 `ui` + `bold:true`。字重顶上来了，**字形还是系统黑体，不是卡通体**——
  与稿子的观感差在这一处，是本次复刻**最大的单项视觉偏差**。
- **一条路就够（不构成 A/B）**：ZCOOL KuaiLe 是 **SIL OFL**，与现有四款 CJK 艺术字同一许可、同一条产线——
  `scripts/cjk-art-font-vendor.py` 子集化 + `art-fonts-cjk.ts` 加一个枚举值（如 `cnkuai`）。
  这是**加一个槽**，不是放宽闭集，与手册「缺字体→提 requests 让主程加一个槽」的口径完全一致。
- **验收**：`Label{font:'cnkuai'}` 能渲汉字；game108 把 `design-tokens.ts` 的 `F.cjk` 从 `'ui'` 改成它，
  与稿子 `screens/*.png` 并排看字形一致。

### REQ-108-UI-05 · CJK 字体子集只扫 `src/**`，游戏层文案会逐字静默回退 · [2026-08-07] · status: open（PUI 工具债·低优先）

- **病**：`scripts/cjk-art-font-vendor.py` 的子集字符集来自 `src/**/*.ts(x)`（脚本第 31 行的 glob），
  **不含 `games/**`**。游戏层的文案只要用到一个 src 里没出现过的汉字，那个字就不在 woff2 里，
  浏览器**逐字**回退系统字——同一行里混两种字形，**不报错、不告警**。
- **实测**（game108 切到 `cnround` 时顺手量的）：本作屏上会出现的 91 个汉字里缺 3 个——
  `莽` `夫` `徒`，来自对手名「莽夫」「赌徒」（当前只上场「复读机」，所以这一版看不出来，
  等五名对手轮换上场就会露）。
- **建议**：glob 加一行 `games/**/*.ts(x)`（子集会略大，但 CJK 子集本来就是按字取，增量很小）；
  或更稳的做法是加一道**覆盖率检查**：扫 src+games 的汉字集，与生成的 woff2 cmap 对账，缺字报警。
- **为什么不是我改**：`scripts/cjk-art-font-vendor.py` + `art-fonts-cjk.ts` 属 PUI 域（UI 基座），
  按域边界报单不擅改。
- **绕过**：无需绕过——缺的 3 个字当前不上屏；上屏前 PUI 重跑一次 vendor 即可。
