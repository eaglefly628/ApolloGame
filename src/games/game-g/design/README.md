# Game G《翻命扑克 · Fateflip》· 设计文档库（主策划单一真相）

> 主策划 ｜ 2026-06-14 ｜ 本目录 = Game G 设计的**组织化单一真相**，由主策划维护。
> 宪法：`docs/design/data-driven-manifesto.md`｜规范：`CLAUDE.md`

---

## 这套文档的来历（"我们讨论的结果"）

- **方向已拍板**：Game G =《翻命扑克 Fateflip》，**outcome-first**（胜负先由确定性规则定、3D 翻牌是反推的表现、单向不回灌 gameplay）。该方向由项目 owner 在前序 session 拍板（详见 `05-roadmap-and-status.md` §演进史：v0.1「物理决定胜负」被纠正为 v2 outcome-first）。
- **本次动作（2026-06-14）**：接任主策划把原单体 `../DESIGN.md`（v2，由"策划兼程序"session 所写）**拆分组织**成本目录的主题文档库，并把整个 Game G **从 `peaceful-volta` 分支切入 `mainbranch`**（零冲突合并、tsc+vitest 1181+build 全绿）。
- **不改方向、只做组织**：本目录忠实承接 v2 outcome-first，未推翻任何已定结论；新增的是结构、索引与现状对账。原 `../DESIGN.md` 保留为历史底稿，**以本目录为后续维护入口**。

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

---

## 一句话现状

**MVP-1 已收口**（一局：掷命→数存活→判胜负→结算掉材），全绿（tsc 0 / vitest 1181 / build 0），已落 `mainbranch`。3D 画面需浏览器跑（`npm run dev` → Game G）。下一步见 `05` 路线（局外元层 / 干预系统 / 多人）。

> 复诵：**gameplay 是确定性数据，表现是 3D 演出，单向不回灌。** 代码只属于引擎那台固定的解释器（含渲染后端）；游戏只多数据。
