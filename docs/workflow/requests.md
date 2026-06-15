# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。

---

## 判定摘要（2026-06-15 · Lead 清理基线）

> 供清理：「结案」可归档移出本池；「转移」移交对应 owner 的 finish-list；「仍开」保留。

| REQ | Lead 判定（2026-06-15） | 处置 |
|---|---|---|
| R9 资产系统 | 引擎侧 **done**（06-07 全落地）；PB 槽位实例非阻塞 | 结案（PB 余项转 PB） |
| REQ-ARPG game-d | 引擎能力**已足**；余项全 Programmer D 自营（VFX/dungeon/掉落/AI 数据） | 转 game-d 自营清单 |
| REQ-C-005 组合特殊棋子 | **真缺口**（算法，C→E→E 表达不了）→ match3-board 扩展 | 仍开（待 PC 排期） |
| REQ-C-006 防死局重排 | **真缺口**（算法）→ match3-board 扩展 | 仍开（待排期） |
| REQ-C-007 三消特效 | 表现层；先用现成 **Tween** 重组；通用 VFX 待 rule-of-three | 仍开（倾向重组） |
| REQ-010 定点数 | **已实装**于分支 `festive-planck`（`@engine/math` 定点+RNG+浮点子集）；待并入 | 待并入→done |
| BUG-002 game-e 弃牌 | game-e 侧 ~15 行 | 转 PE |
| REQ-018 传输层 | 仍开 **P3**（真远程才做，排 F-057 后） | 仍开 |
| REQ-023 group-effect | **wontfix**——重组覆盖（group-count→全局 buff 资源→scaleByResource）；Boss 全军 buff 复用同款坐实 | 结案 |
| REQ-F-057 确定性探针 | 仍开；用户定 game-f 战斗=**整数 HexPos**→同进程探针即足；定点退路已分支实装 | 仍开（待联机拉动） |
| REQ-F-061 hp 门/处决 | **done**（06-13） | 结案 |
| REQ-F-062 aggro 策略 | **暂不实现**（打回）；未被真实数据拉动 | 仍开（待拉动） |
| REQ-F-064 Boss 技能 | **wontfix/covered**——全部现有能力重组（见下条 recipe） | 结案 |
| LEAD→PF 去腐交办 | game-f 侧进行中；**引擎侧到此为止**（重申）；GameShell 采用未完 | 转 game-f finish-list |

---

## 待处理 / 进行中

### R9 · [2026-06-03] · PB · 框架级 · status: **done（引擎侧，2026-06-07）** · 优先级: 架构级 · 类型: 资产系统 review

> ✅ **引擎侧全部落地（2026-06-07，全量 621 绿）**：资产 key 硬校验 / 命名动画 clip 层 / AOT pack-atlas 工具 / Gemini 代码审计 4 修复 / 蓝图自动派生资产清单（甲）/ generate→热载 AI 闭环（乙）。
> - **PB 仍可做（非阻塞）**：Game B 槽位契约实例 + procedural 占位 provider（见 `docs/design/asset-manifest-and-manager.md` §8）。

---

### REQ-ARPG · [2026-06-07] · 用户 · Game D（ARPG PoC） · status: **in-progress** · 优先级: 高（投资路演垂直切片）

> ✅ **七批已落（2026-06-08，Programmer D，660+ 绿）**：关系型战斗（hitbox）/ 数据级 prefab / game-d 纯数据切片 / NL→热载闭环 / aggro+steering+mortal+over-time / caster / keybind / Canvas 渲染 / tilemap / anim-state / 攻击动画+朝向。
>
> **仍 open（Programmer D 自营）**：
> - VFX 打击感（粒子/抖屏/闪白/击退）。
> - Dungeon 生成（Hades 式手工房间拼接）。
> - 掉落/装备（红黄绿，需 `derived-stat`）。
> - `stats.effective` 三路消费接线（见 `docs/workflow/finish/PD-req-stats-wiring.md`）。
> - 真浏览器渲染验证（当前离线帧代理）。
> - 怪物 AI 深度（巡逻/警戒/攻击模式，靠 state+condition+aggro 数据，非新代码）。

---

### REQ-C-005 · [2026-06-05] · PC · Game C · status: **open** · 优先级: P1 · 类型: match3-board 算法扩展

**标题**：糖果传奇式组合消除 / 特殊棋子

- **想实现**：4 连→条形棋子（消整行/列）；5 连/T/L→更强；特殊×特殊组合效果。
- **卡在哪**：「按连线形状生成特殊棋子 + 范围消除 + 组合效果」是算法扩展，Condition→Event→Effect 表达不了。
- **建议**：扩 `match3-board`，config 驱动的组合规则表——`matchShape(line4|line5|T|L) → spawnSpecial(kind)`；`special → effect(clear-row|clear-col|area(r)|same-color)`；`special×special` 组合表。确定性（整数+RandomSeed）。

---

### REQ-C-006 · [2026-06-05] · PC · Game C · status: **open** · 优先级: P2 · 类型: match3-board 健壮性

**标题**：无可行步 → 自动重排（防死局）

- **想实现**：全盘没有任何可消除交换时自动洗牌到「有解且无连线」，不卡死。
- **卡在哪**：`match3-board` 稳定后只保证无连线，不检测是否存在可行步；补块/连锁后仍可能死局。检测可行步+重排是算法，游戏层不写。
- **建议**：`match3-board` 进 idle 时扫所有相邻交换均无连线 → 用 `RandomSeed` 重排到「有解且无连线」。确定性。

---

### REQ-C-007 · [2026-06-05] · PC · Game C · status: **open** · 优先级: P2 · 类型: 特效组件（表现层）

**标题**：三消手感特效组件 —— 消除迸裂 / 下落 / 连锁强调

- **想实现**：消除时棋子迸裂/粒子高光、空位上方棋子平滑下落、连锁逐级强调。交换滑动已做基础版。
- **卡在哪**：重的迸裂/下落/连锁特效若游戏层各自硬写 = 表现层负债。用户已明示「特效组件可向主程要」。
- **建议**：可复用「棋盘 juice/特效」约定——`match3-board` 在消除/下落时产出 `Tween`（现成 Tier1）驱动视图格 `Transform/Color.alpha`，渲染器照画；或通用 particle/VFX 能力。表现层，不进 sim/hash。

---

### REQ-010 · [2026-06-08] · Lead（Gemini 复审）· 框架级 · status: **open** · 优先级: P3 / future · 类型: 确定性增强

**标题**：浮点 → 定点数 / 整数运算，根除跨架构 1-ULP desync

- **背景**：steering/launch 的 `Math.sqrt` 归一、以及一切 IEEE 浮点，在不同 CPU 架构（ARM vs x86）或 JIT 激进优化（FMA）下存在 1-ULP 差异，经积分进 Transform → 有几率引发跨端 desync。
- **现状**：MVP 可容忍，标 tech-debt。单机/同构端 lockstep 无碍。
- **何时必须做**：要做跨架构帧同步联机（Windows x86 ↔ Mac ARM P2P lockstep）才需。方案：关键运算换定点数+整数平方根/LUT 查表。**不阻塞 Steam 单机发布。**
- **Lead 注（2026-06-15）**：定点数已在分支 `claude/festive-planck-9gnv8q` **实装**（`@engine/math`：Q16.16 定点 + RNG 下沉 + 确定性浮点子集 + determinism-lint 守卫），tsc+vitest+build 全绿；**待并入 mainbranch** 即可标 done。

---

### BUG-002 · [2026-06-08] · PE（Game E 试玩复现）· `src/game-e.tsx` · status: **open** · 优先级: P2（缺玩法）

**标题**：缺「弃牌」操作 —— 选牌后无法弃掉换新牌

- **现象**：Game E 只有「出牌/新一局」，没有弃牌按钮。`discards_left=3` 资源已存在但无入口。
- **建议**：`game-e.tsx` 加 `discard()`：选中≥1 张且 `discards_left>0` 时 → `discards_left -= 1`、移除选中牌、`drawTo` 补到 8 张、不耗 hands_left/不计分；加「♻ 弃牌（n）」按钮 + HUD 显示弃牌次数。PE 已实现过一版可直接参考（约 15 行）。

---

### REQ-018 · [2026-06-08] · PE（联机评审）· 框架级 · status: **open** · 优先级: P3（真·远程对战才需，最后做）· 类型: 网络传输层

**标题**：真·跨设备远程传输 + 延迟处理（现 lockstep 仿真核已就绪，只差传输/缓冲）

- **现状**：确定性 lockstep 仿真核已落地（`FixedStepClock` + 命令排序 + `hashSnapshot` + `LockstepSession`）。传输层只有 `lockstep-tab.ts`（BroadcastChannel 同机两标签），无真·互联网传输（WebSocket/WebRTC）。
- **缺什么**：① 传输：WS/WebRTC 信令 + 帧/命令收发；② 延迟处理：input-delay 缓冲或 rollback。
- **优先级**：同机两标签已可验共鸣；**真·远程对战才提上日程**，建议排在最后。卡牌计分纯整数，跨平台确定性已在 coop-cards.test 坐实。

---

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
