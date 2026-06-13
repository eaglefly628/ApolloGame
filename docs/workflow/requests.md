# 引擎需求池 · Requests

> Game Creator（PA/PB）在此提需求；Lead 读取 → 收敛成通用原子 → 实现 → 标记状态。
> 状态：`open`（待处理）/ `in-progress`（Lead 在做）/ `done`（已实现，附 commit）/ `wontfix`（附理由）。
> 写法见 `game-creator-role.md`。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### R9 · [2026-06-03] · PB · 框架级 · status: **in-progress** · 优先级: 架构级 · 类型: 资产系统 review

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

### REQ-023 · [2026-06-09] · 主程4（Game F 拉动）· 框架级 · status: **open（不 greenlit·倾向先重组 YAGNI）** · 优先级: 低

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

---

### REQ-F-061 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **open** · 优先级: 中 · 类型: 真缺口（hitbox 缺血量条件门 + 处决）

**标题**：hp-条件伤害 / 处决（斩杀 / 残血加伤 / 狂暴）

- **想实现**：对 hp<X% 目标加伤/处决——玩家卡牌「白衣/攻心/渡江」+ 太阁 Boss 谦信/真田/立花/半藏（`game-f-deck-spec.md` §牌组10、`game-f-taikou-roster.md` §六）。
- **卡在哪**：`src/skills/tier2/hitbox.ts` 过滤只有 targetMask(Tag)/requireMask(Status)；伤害只有 amount+fracOfMax，**无「读目标当前 hp 比例做条件门」**。血量是连续 Resource 烘不成 Status；condition/event-when 是触发层，管不到命中那刻目标血量 → 真缺口。
- **建议**：`Hitbox` 加只读门 `requireHpFracBelow?`/`requireHpFracAbove?`（读 target current/max），不满足跳过；处决 `executeBelow?` 命中即清 0。**只读 hp 比例做 gate，不引入伤害分型/重定向**（守草船借箭回驳边界）。倍率走 REQ-012 mul、动态值走 REQ-013 valueFrom（均 done）。

---

### REQ-F-062 · [2026-06-13] · 主策划（Game F 卡牌系统 D0 拉动）· 框架级 · status: **open** · 优先级: 低-中 · 类型: 真缺口（aggro 索敌策略不可选，只能最近）

**标题**：aggro 索敌策略（最远 / 最高威胁 / 最低血，非只最近）

- **想实现**：刺客绕后锁后排、狙击锁最高威胁、嘲讽——玩家卡牌「绕后奇袭」+ 太阁 Boss 政宗/岛津。
- **卡在哪**：`src/skills/tier3/aggro.ts` 写死 `nearestByTag`；`Perception` 只有 targetTag/sightRadius，**无策略字段**，数据层无开关。
- **建议**：`Perception.policy?: 'nearest'|'farthest'|'highestStat'|'lowestHp'`（缺省 nearest，向后兼容）+ spatial-query 加对应变体（沿用 id tie-break 保确定性）。不改语义、不动定序。

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
