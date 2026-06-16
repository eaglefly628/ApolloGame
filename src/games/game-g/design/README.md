# Game G《翻命扑克 · Fateflip》· 设计文档库（主策划单一真相）

> 主策划 ｜ 2026-06-14 ｜ 本目录 = Game G 设计的**组织化单一真相**，由主策划维护。
> 宪法：`docs/design/data-driven-manifesto.md`｜规范：`CLAUDE.md`

---

## 这套文档的来历（"我们讨论的结果"）

- **方向已拍板**：Game G =《翻命扑克 Fateflip》，**outcome-first**（胜负先由确定性规则定、3D 翻牌是反推的表现、单向不回灌 gameplay）。该方向由项目 owner 在前序 session 拍板（详见 `05-roadmap-and-status.md` §演进史：v0.1「物理决定胜负」被纠正为 v2 outcome-first）。
- **本次动作（2026-06-14）**：接任主策划把原单体 `../DESIGN.md`（v2，由"策划兼程序"session 所写）**拆分组织**成本目录的主题文档库，并把整个 Game G **从 `peaceful-volta` 分支切入 `mainbranch`**（零冲突合并、tsc+vitest 1181+build 全绿）。
- **愿景升级（2026-06-14，owner 口述童年原型）**：Game G 的灵魂 = 童年"扑克翻转大战"——抛牌**正面活/反面死**、用手法改概率、把牌按**三三制**编成**三路军**列阵对砍。掷命内核已在（`01`），本次新增**战场结构层**（`06`：编制/军衔=点数/三路/布阵/将领牵动）+ **培养与功能牌层**（`07`：小丑/星球融牌面 + 功能牌改战场）。**已拍板**：54/方（52+2王）· 三路×18 · 军衔=点数 · **首发 vs AI**。
- **不改方向、只做组织**：本目录忠实承接 v2 outcome-first（结构层长在掷命内核之上、不改它），未推翻任何已定结论。原 `../DESIGN.md` 保留为历史底稿，**以本目录为后续维护入口**。

---

## 文档地图

| # | 文件 | 内容 |
|---|---|---|
| — | `README.md` | 本索引 + 接管说明 |
| 00 | `00-overview.md` | 一句话 + outcome-first 统一原则 + 数据驱动自检 + 架构师评审 + 回驳清单 + 核心循环 |
| 01 | `01-fateflip-combat.md` | 局内·掷命对决：`decideFaceUp` 规则 / favor / 数存活判胜负 / 一局收口 / 干预系统 |
| 02 | `02-meta-loop.md` | 局外·元循环：集材 / 改造 / 商城 / 出征（≈ gameF）+ 服务层边界 |
| 03 | `03-3d-presentation.md` | 3D 表现层协议：渲染后端=解释器 / Card3D / 翻牌 tween / 物理观感分档 |
| 04 | `04-multiplayer.md` | 多人：服务器权威 outcome-first（为何浮点债不再卡 gameplay）|
| 05 | `05-roadmap-and-status.md` | 阶段路线 + 当前实现状态 + 数据vs代码占比 + 演进史 + REQ-G 状态 |
| 06 | `06-army-and-formation.md` | ⭐ 战场结构（灵魂）：三三制编制 / 军衔=点数 / 三路军 / 开局布阵 / 将领牵动全队 |
| 07 | `07-cultivation-and-cards.md` | 培养牌组：小丑/星球融牌面 + 功能牌目录（进攻/埋伏/特殊出现）|
| 08 | `08-ui-implementation-spec.md` | ⭐ UI 实装策划案（给 program G）：MOBA 三路战场接 outcome-first / GameShell vs canvas / 逐屏规格 / 改进清单 / 开发队列 |
| 09 | `09-formation-and-deployment.md` | 开局布阵/分兵（田忌赛马）：预设+拖拽混合 / 弃一保二 / vs AI 暗布阵 |
| 10 | `10-intervention-cards.md` | 干预卡/功能牌目录（Levers）：能量经济 + 改命/斩首/增援/牌型羁绊/伏击 5 类 |
| 11 | `11-run-and-campaign.md` | 战役/run 结构（roguelike 元层）：5 场连战 + 命线 + 场间养成 + 终局 Boss |
| 12 | `12-cultivation-jokers-archetypes.md` | 培养：小丑牌(10)/星球牌(5)/附魔 + 6 流派 + 克制网（长期重玩层）|
| 13 | `13-boss-roster.md` | 终局 Boss 阵容（6 名拟人化扑克，每 run 轮换）+ 对称干预（Boss 起手干预）|
| 14 | `14-balance-and-tuning.md` | 数值平衡总表（所有 tunable 单一真相）+ 平衡意图 + 风险 + 调参纪律 |
| 15 | `15-feel-and-juice.md` | 掷命手感/演出/Juice（喂 U5）：命运一刻 5 拍 + 溃散级联 + 斩首聚焦 + Boss 入场 |
| 16 | `16-visual-screen-and-review.md` | ⭐ 画面/布局/视觉评审 + 离线看帧（让游戏看得见、能评、持续迭代变好玩）|
| 17 | `17-realtime-march-battle-correction.md` | ⛔ 战斗模型纠偏（TOP）：实时三路行军→遭遇掷命→攻克大本营（取代瞬间结算 best-of-3）|
| — | `PROGRAM-G-TASKS.md` | design G↔program G 循环任务板（当前任务/状态/回馈）|
| — | `UI/` | UI 设计稿（`大厅` / `三路战场`(推荐) / `对战`(参考) `.dc.html` + README）= `08` 的依据 |

---

## 一句话现状

**已实现**：MVP-1 一局收口（掷命→数存活→判胜负→结算掉材），全绿（tsc 0 / vitest 1181 / build 0），已落 `mainbranch`。3D 画面需浏览器跑（`npm run dev` → Game G）。
**设计目标（owner 愿景，下一步）**：补**战场结构层**（`06`：三三制/三路/布阵/将领）+ **vs AI 对抗** + 培养/功能牌（`07`）。路线见 `05`。

> 复诵：**gameplay 是确定性数据，表现是 3D 演出，单向不回灌。** 代码只属于引擎那台固定的解释器（含渲染后端）；游戏只多数据。
