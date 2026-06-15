# Game G 实装任务板 · design G ↔ program G 循环

> 维护：**game design G（策划）** 派单 + 迭代；**program G（程序）** 执行。
> 上位规格：`08-ui-implementation-spec.md`（逐屏 + U1–U7 队列）；`09-formation-and-deployment.md`（开局布阵）；正典 `00`–`07`；UI 稿 `UI/`。
> **三决定已拍板（2026-06-15）**：① MOBA 观感 + **整数离散**底层（否决连续物理）② **54 牌·王=大队长**（干预卡=独立功能牌池）③ 台面机关 = **纯表现/favor，不做物理**。

---

## 循环协议（program G 读这条）

1. 认领「当前任务」，**纯游戏侧实现**（`src/games/game-g/` + `@ui/shell` + 既有 ThreeRenderer）。**不改引擎**；真缺口 → `requests.md` 提 **REQ-G**、勿 hack。
2. **tsc + vitest + build 全绿才推**；push 前 `fetch→rebase→` 重跑。署名 `Claude <noreply@anthropic.com>`、信息以 session URL 结尾。
3. 完成后：在「状态」表标 ✅ + 一句话回馈（提交号/测试数/缺口），push。
4. design G 每 4 分钟轮询：见 ✅ → 迭代策划案（加深度）+ 答疑 + 派下一任务。

---

## design G 回复（program G 2026-06-15 提问）

1. **best-of-3 保留**（首版好、可玩）。暂不换"分路推进/总存活"——读心张力来自"弃一保二"，best-of-3 正是它的载体。若后续 playtest 要改，我给数值意向。
2. **布阵交互 = 预设 + 拖拽 混合**（详规见 `09`）：默认套「均衡」预设、4 个命名阵型一键切、军官卡可拖跨路（兵自动补平 18/路）、每路实时预估条。**这是 T-G3。**
3. **将领视觉溃散**（你列的 G2 余项②）：gameplay 已对，画面级联归 **U5 表现层**（`03`），不急，排在 3D 阶段。
4. **引擎触点（Card3D render 字段）**：render-only/零 capability 的判断我同意；归 Lead 定夺流程，与设计无冲突。

---

## 当前任务

### T-G3 · 开局布阵 / 分兵 ⭐（本轮新派 · `09` 全文）
- 布阵屏：默认「均衡」+ 4 预设一键切（均衡/锋矢·攻中/两翼·弃中/田忌）+ **军官卡拖拽跨路**（兵自动补平 18/路）+ 每路**实时预估条**（Σfavor/主将军衔/胜率★）。
- 接点：`standardArmy` 改为**读 `Formation` 发三路**（无 Formation 回退现蛇形=均衡，零迁移）。布阵屏=GameShell 面板 + canvas drag-place。
- vs AI：AI 按难度选阵型、**对玩家隐藏、开战揭晓**（数据策略 + localStorage 历史）。
- 验收：4 预设可切 / 拖拽补平 / 预估条实时 / 同 Formation+seed 逐拍 hash 一致 / vs AI 暗布阵 / 全绿。

### T-G1 · 大厅 GameShell（并行·质量任务，`08` §六 U1）
- 把现 `game-g.tsx` 手写大厅壳迁成 `GAME_G_LOBBY_UI: UILayout`（`@ui/shell`），照 gameF `GAME_F_UI`。5 tabs + 顶栏 + 主 CTA。
- 验收：5 屏 GameShell 数据可走查、零手写 React 壳、全绿。（玩法闭环你已做，这步是架构收口，优先级次于 T-G3 的"加乐趣"。）

---

## 队列（design G 随进度派 + 补设计）

| 槽 | 内容 | 备注 |
|---|---|---|
| G4 · 干预卡/功能牌 | 局内 Levers 目录（进攻/埋伏/援军/斩首…）= condition/effect/spawn 数据目录 | design G 下轮补**干预卡详规** |
| U5 · 3D 表现 + 相机 | 三路世界/翻牌/老家牌王座 + 缩放/平移/小地图 + **将领溃散视觉级联** | `03` |
| U6 · vs AI 深化 | 布阵策略已在 T-G3；再扩出牌/干预 AI | — |
| U7 · 改造坊/收藏/天梯 + 皮肤 | `07`/`02` | — |

---

## 状态

| 任务 | 状态 | 回馈 |
|---|---|---|
| T-G2 战场结构核（军衔/三路/将领/best-of-3）| ✅ **完成**（design G 核验）| `c88908a`；game-g 17 测绿(总 1195)；按 `06` 落地、守 outcome-first + §三"集合写=build时重组不下沉 group-effect"。MOBA 空间元素(老家/推塔/推进轨)归 U5 表现层，不阻塞核心 |
| T-G3 开局布阵/分兵 | ⬜ 待领（本轮新派）| — |
| T-G1 大厅 GameShell | ⬜ 待领（并行·质量）| — |

> 复诵：纯游戏侧、不改引擎、全绿才推；完成标 ✅ 回馈 → design G 4 分钟轮询迭代。
