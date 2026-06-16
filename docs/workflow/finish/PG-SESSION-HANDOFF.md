# Programmer G · Session 移交文档（Game G《翻命扑克 Fateflip》）

> 维护：program G（程序）。给**下一个 program G session** 一上来就能接着干。
> 最后更新：2026-06-16 · HEAD `ff9904f` · **1324 测全绿**（tsc + vitest + build 0）· 分支 `claude/mainbranch`。

---

## 0. TL;DR（30 秒上手）

你是 **Programmer G**，单干 Game G 的程序实现，分支 **`claude/mainbranch`**（直推、不开 PR）。搭档是 **design G（策划）**——他派单 / 评审，你实现。
**当前阶段 = 视觉打磨（owner 转向"把画面做出来、看一看、迭代变好玩"）。**
- **玩法逻辑全做完**（T-G2~T-G6 + U6 AI + foil）；**画面也已从"有牌没战场"做成三路战场 + 命运一掷的戏 + 逐路揭晓 + 主将♔/斩，且全港进真 3D 渲染器**（VIS-1/2/2b/4 ✅）。
- **下一步 = VIS-3 HUD 布局 / VIS-5 美术 / VIS-4 余(斩首聚焦·Boss入场)**——design G 定性"锦上添花·非阻塞"，等他派单或 owner 真机反馈。
- **每完成一项：第一时间在 `src/games/game-g/design/PROGRAM-G-TASKS.md` 状态/派单表标 ✅ + 回馈**（循环协议第 3 条——别只记 finish-list，否则策划不知道你做完了，这是 owner 反复强调的）。

---

## 1. 工作 SOP（每个工作周期）

1. `git fetch origin claude/mainbranch && git rebase origin/claude/mainbranch`（拉 design G 最新派单/评审 + 他人提交）。
2. 读 `src/games/game-g/design/`（重点 `PROGRAM-G-TASKS.md` 派单表 + `16-visual-screen-and-review.md` 评审）→ 认领下一个**未做**任务。
3. **纯游戏侧实现**（`src/games/game-g/` + 既有 ThreeRenderer/@ui）。**不改引擎**；真缺口→`requests.md` 提 REQ-G、勿 hack。**全表现层不进 hash、不破 outcome-first。**
4. **tsc + vitest + build 全绿才推**；rebase 带进新提交必须重跑全套。
5. 提交署名 `Claude <noreply@anthropic.com>`、信息以本 session URL 结尾、**不在产物写模型标识**。
6. **完成后：① `PROGRAM-G-TASKS.md` 标 ✅ + 回馈（提交号/测试数）② 追加 `docs/workflow/finish/PG-finish-list.md` 周期日志。** 两处都写。
7. `git push -u origin claude/mainbranch`（失败仅网络错才指数退避重试）。

**CORE RULE（评判每条需求）**：能用现成 capability 重组→回驳；已被覆盖→回驳；真缺口才下沉成通用 capability；警惕 YAGNI/过度设计。**对 design G 的设计也跑 CORE RULE**（我回驳过 星球·路/附魔，design G 都采纳了——纪律对每个人适用）。

---

## 2. 自主心跳循环（owner 设的）

- owner 要"维持 **15 分钟**为检查的循环、和搭档一起持续干"（节奏 15min/次=**省 rate limit**，4min 太频会撞限额）。
- 机制：无 cron/ScheduleWakeup 可用 → 用 **persistent Monitor 心跳**：`while true; do sleep 900; echo "PG-tick ..."; done`。每 tick 唤醒你跑一个周期。
- **Monitor 有 30min 寿命上限** → 收到 `[Monitor timed out]` 就**重挂一个新的**（编号递增）。
- **循环为何会断**：① **rate limit**（重周期烧配额快）② **会话被环境挂起/回收**（Monitor 随之死、无服务端唤醒源）。断了 = owner 发消息才复活。**缓解**：15min 节奏 + 周期轻 + 玩法已做完自然变轻。
- **被 `PG-tick` 唤醒**：fetch→rebase→看 design G 有无新派单/评审→有则接、无则轻 idle（别churn/烧配额）。**绝不留红、绝不留未推送、不问 owner**（除非真需决策）。

---

## 3. 和 design G 的评审环（视觉阶段核心）

```
program G 做出画面 + 出帧(render-frame→SVG) → design G 读图+读码评(四把尺) → 提改进 → 再迭代
```
- **四把尺（design G 每轮量）**：① 博弈悬念演出来没 ② 可读性(三路谁赢/主将/流派) ③ 美术基调(古风+拟人扑克) ④ 布局顺手。
- **高效套路**：**先在便宜的 SVG 评审帧里迭代到 design G 批准，再港进昂贵的 3D ThreeRenderer**（避免反复改 3D）。已跑通 3 轮（`16` §八/九/十全通过）。
- design G 评审写在 `16-visual-screen-and-review.md`（§八/九/十…递增）。**他在忙 game-f 时轮询慢**——你别傻等，有派单backlog(VIS-3/5/余)就接，但盲做 render 的(斩首聚焦/HUD)最好等他评或 owner 真机反馈（你 headless 看不到 3D）。
- **出帧给 owner 看**：用 `SendUserFile` 发 `doc/screenshots/*.svg`，owner 也能评。

---

## 4. ✅ 已完成清单（别重做）

| 模块 | 状态 | 关键提交 |
|---|---|---|
| T-G2 战场核（军衔/三路/将领/best-of-3）| ✅ | `c88908a` |
| T-G3 开局布阵/分兵（4 预设 + ±自定义 + AI 暗布阵）| ✅ | — |
| T-G4 干预卡 6 张 + 能量◈ + 备战相位 | ✅ | — |
| T-G5 战役/run（5 场+命线+曲线）+ 6 Boss 轮换 + 对称起手干预 | ✅ | `cd5fa7c` |
| T-G6 培养：**10 小丑** + **4 星球** + 改造坊 + 三选一流派钥匙 + 6 流派/克制网 + **激活质变** | ✅ | 见 finish-list cycle#9–19 |
| U6 AI 按克制反制布阵（`pickAiFormation`，committed→反制）| ✅ | `b0d6d86` |
| foil 闪艺收集（纯表现·附魔回驳后的替代）| ✅ | `d1d0556` |
| **VIS-1 离线看帧 enabler**（`render-frame.ts`→SVG）| ✅ | `c6cc704` |
| **VIS-2/2b 三路战场 + 命运一掷加戏** + 抽 `scene.ts` 单一真相 + **港 ThreeRenderer** | ✅ | `b46e0de`/`ace922b`/`0c1cc2a` |
| **VIS-4 逐路揭晓**（`feel.laneRevealProgress`）+ **主将♔/斩** + **港 ThreeRenderer** | ✅ | `0dcf358`/`5b2cfc1`/`e8507cc` |

**结果**：浏览器真 3D 画面 = design G 批过的帧（三路战场 + 老家牌王座♔ + 哨塔 + 三路比分 + 金辉光/石碎裂 + 逐路揭晓 2:1 悬念 + 主将♔牵动/阵亡红斩溃散）。**全单一真相、帧=游戏不漂移。**

---

## 5. ⬜ 待做 / 下一步（接这些）

design G 定性**全是"锦上添花·非阻塞·按你节奏"**（`16` §十）；优先看 design G 有没有新派单，没有就按下面挑：

| 任务 | 内容 | 注意 |
|---|---|---|
| **VIS-3 HUD 布局** | 按 `UI/三路战场.dc.html`：左干预·能量◈ / 右三路战况 / 底选路派牌 / 顶对手+目标 / 中战场 | DOM(game-g.tsx)、headless 不可验、大改 |
| **VIS-4 余** | 斩首聚焦 hitstop（斩首令命中→镜头/高光定格一拍）/ Boss 入场台词仪式 | render 动画、盲做、tied to event |
| **VIS-5 美术** | 占位→真资产（玄铁/锦霞双皮）、古风拟人扑克氛围 | 需资产清单(防编造 key) + 美术方向 |
| 次环克制校准 | `ARCHETYPES` 次 3 环克制(牌型/概率/弃一保二)我合理映射、待 design 数值意图 | — |

**接法**：能在 `render-frame.ts`(SVG) 里成形先成形(可验、给 design G/owner 评)，批准再港 ThreeRenderer；纯 feel.ts 时序函数优先(可测)。

---

## 6. 架构 & 红线（务必守）

- **outcome-first（最高纲领）**：胜负 **build 时**由确定性数据(decideFaceUp 属性加权种子硬币 + resolveArmy 将领牵动)定；**3D/SVG 全是反推的表现、单向、不回灌 gameplay、不进 hash**。→ 跨端浮点不影响胜负、多人安全。
- **零新引擎能力**：所有玩法 = 游戏侧数据解释器（`applyJokers`/`applyInterventions`/`applyBuff`/`applyArchetypeActivation`/`prepareArmies` 同族），不改 `src/engine`。唯一引擎触点=`Card3D` render-only 字段(side/pairKey/rank/suit)，早经 design G/Lead 认可。
- **单一真相**：① **`prepareArmies(MatchSetup)`** = 揭晓前完整 build 编排（成军→星球→融小丑→玩家干预→Boss 起手→影武者→士气倍率→联动），showMatch 与测试共用。② **`scene.ts`** = 三路战场布局（`cardScreenPos`/老家/哨塔/比分），render-frame(SVG) 与 ThreeRenderer(3D) 共用。③ **`feel.ts`** = 手感曲线（hangWarp 滞空/revealGlow/laneRevealProgress 逐路揭晓/easeOutCubic），两个渲染器共用。**改布局/手感只改这三处、帧=游戏自动一致。**
- **测试纪律**：headless（无 WebGL）。**血泪教训**：读存活资源用**实体 id `res_a0`** 不是资源 id `a_l0`（曾 4 条测空过=`>=0` 永真）；hash 一致性测=同 setup+seed 逐拍 `e1.hash()===e2.hash()`；存活单调用 `res_aN`。**"空过的测=没有的测"。**
- **WebGL 不可 headless**：node 无 GL 上下文跑不了真 ThreeRenderer → **看帧用 SVG 投影**(render-frame.ts，复刻同一套 feel/scene)。3D 实际观感**只能 owner 真机看**——别假装验证了。

---

## 7. 关键文件地图

| 文件 | 是什么 |
|---|---|
| `src/games/game-g/blueprint.ts` | 玩法数据 + build 编排核心（decideFaceUp/resolveArmy/armyFromFormation/applyJokers/applyInterventions/applyArchetypeActivation/prepareArmies/BOSS_ROSTER/GAME_G_JOKERS/GAME_G_PLANETS/ARCHETYPES/pickAiFormation…）|
| `src/games/game-g/game-g.tsx` | 挂载编排（大厅/布阵/备战/出征/场间）·DOM·存档 |
| `src/games/game-g/three-renderer.ts` | **真 3D 渲染器**（消费 scene.ts 摆三路 + buildScenery 老家/哨塔 + applyReveal 金石 + 逐路揭晓 + 主将♔/斩 markers）|
| `src/games/game-g/render-frame.ts` | **离线看帧**（跑一局→投影 SVG 落 doc/screenshots/，评审介质）|
| `src/games/game-g/scene.ts` | 三路战场布局单一真相（render-frame ↔ ThreeRenderer 共用，scene.test.ts 测）|
| `src/games/game-g/feel.ts` | 手感曲线单一真相（feel.test.ts 测）|
| `src/games/game-g/index.ts` | barrel 导出 |
| `src/games/game-g/design/16-visual-screen-and-review.md` | **视觉规格 + design G 评审（§八/九/十…）** |
| `src/games/game-g/design/PROGRAM-G-TASKS.md` | **任务板/派单/状态（design G 维护派单，你标 ✅ 回馈）** |
| `src/games/game-g/design/00–15、UI/` | 正典设计（玩法/Boss/平衡/手感/UI 稿）|
| `docs/workflow/finish/PG-finish-list.md` | **你的周期日志 + 自动循环 SOP**（cycle#1–30）|

---

## 8. 常用命令

```bash
# 全绿三件套（推前必跑）
npx tsc --noEmit && npx vitest run && npm run build
# 只跑 game-g 测
npx vitest run src/games/game-g/game-g.test.ts src/games/game-g/scene.test.ts src/games/game-g/feel.test.ts
# 出帧（看画面）→ doc/screenshots/*.svg
npx vite-node src/games/game-g/render-frame.ts
```
出帧后用 `SendUserFile` 发 `src/games/game-g/doc/screenshots/*.svg` 给 owner / 供 design G 评。

---

> 复诵：玩法全 ✅、画面三路战场也 ✅ 港进真 3D；现做视觉锦上添花。**纯表现、不进 hash、守 outcome-first；改布局/手感只动 scene.ts/feel.ts/prepareArmies 三处单一真相；每完成必在 PROGRAM-G-TASKS 标 ✅ 让 design G 知道；先 SVG 帧迭代批准再港 3D；headless 看不到 3D 别假装验。**
