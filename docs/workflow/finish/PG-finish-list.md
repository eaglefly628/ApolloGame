# PG · Programmer G 工作清单 / 汇报（Game G《翻命扑克》）

> 程序 G（PG）维护。给**主策划**看进度、给**Lead/主程**看引擎触点供 review。
> 分支 `claude/mainbranch`；每条都 tsc + vitest + build 全绿才推。设计真相：`src/games/game-g/design/`。

---

## 一句话现状

G2 战场结构（军衔/三路/将领牵动/best-of-3）核心已落、已接入大厅出征、全绿（vitest **1195** / build 0）在 mainbranch。其余按 `design/05` 路线推进中。

---

## 已完成（✅）

| 块 | 内容 | 证据 |
|---|---|---|
| 表现·体量与撞击 | 52v52 牌阵；网格配对(A左/B右,同 pairKey)；渲染器抛飞弧+配对相撞+相机自适配 | `three-renderer.ts`/`blueprint.ts`；测：cardFace/配对/52v52 |
| 表现·牌面美术 | 纯色方块 → 真扑克牌面(点数+花色+红黑+背面菱格+队伍色描边)，canvas 纹理缓存 | `three-renderer.ts` faceTexture/backTexture |
| 玩法·闭环 | 大厅↔出征↔改造牌组(升 favor)↔关卡递增 + localStorage 存档 | `game-g.tsx` |
| **G2·战场结构** ⭐ | 54/方(52+2王)·三路×18·军衔=点数·主将牵动·best-of-3 | `blueprint.ts` standardArmy/buildGameGArmyMatch；测 3 例(结构/best-of-3 回放/确定性) |

### G2 实现要点（给主策划核对设计意图）
- **军衔=点数**：`standardArmy` 按军衔降序蛇形发三路(各18)，每路首张(最高军衔)=主将。favor：JOKER/K=80, Q/J=66, 10-7=56, A-6=46（高军衔更易活）。
- **将领牵动（§三 集合写）= build 时逐级掷命重组**（**守纪律，未下沉 group-effect**）：逐路先掷主将，**主将活→本路下属 +8 favor（士气）、主将亡→−14 favor（溃散连锁）**，再掷下属。擒贼先擒王 → 连锁溃散，机制成立。
- **三路 + best-of-3**：`group-count` 按 `队|路|ALIVE` 数三路存活 → `event-when`(vsResource 比) 累计各方赢几路 → 胜 2/3 路即赢。**零新 capability**（如 `design/06 §六` 预期）。
- **outcome-first 红线守住**：胜负 build 时即定（同军同 seed 逐拍 hash 一致已测）；3D 抛飞相撞为表现、不回灌。
- 大厅出征已切到军阵：改造升 favor→全军偏置↑；敌方偏置随关卡↑；结算显示"三路 X:Y / 存活 / 材料"。

---

## ⚠️ 给 Lead/主程 review 的引擎触点（我先做了，请过目）

> 按 owner 指令"有主程 block 先做、最后写文档他 review"。以下是 game-G 需要、我先落地的**引擎侧改动**，**均 render-only、零新 capability、零 sim/hash 影响**：

1. `src/engine/protocol/components/render.ts`：`Card3D` 加 render-only 字段 `side?/pairKey?/rank?/suit?`（供 3D 抛飞相撞配对 + 画牌面）。
2. `src/assembly/component-map.ts`：`Card3D` 已在闭集（字段为可选，无新增条目）。
- **判断**：这些是表现层数据字段，不是新词汇/能力，按 manifesto 属 render 组件扩展。如 Lead 认为该走 requests.md 流程，请示下，我补登记。
- **未碰**：任何 capability / sim 逻辑 / 其它游戏。G2 全部用现成 `group-count`/`event-when`/`effect`/`timer` 重组。

---

## 待办 / 下一步（按 `design/05` 路线）

- **G2 余项**：① 开局**布阵 UI**（玩家把将领/兵分三路、田忌赛马式分兵）——现为自动均衡发牌；② 主将阵亡的**视觉溃散**（`hierarchy-cascade` 表现，现为 build 时 favor 连锁，gameplay 已对、缺画面级联）。
- **G3 · vs AI**：现已有"敌方按关卡偏置"的雏形；可扩 AI 布阵策略（数据）。
- **G4 · 培养/功能牌**（`design/07`）：牌面融合(小丑/星球) + 功能牌目录。
- **手感调参**：渲染器 `APEX/COLLIDE/Z_POP/LANE_SEP` 等凭结构调，待真机观感反馈。

---

## 给主策划的反馈（供你迭代设计）

- `design/06` 的"将领牵动=集合写优先重组"落地顺利——**build 时逐级掷命**比运行时 group-effect 更干净、确定、可回放，建议设计就以此为准（已在 `01/06` 内核之上、未改内核）。
- best-of-3 首版已可玩；若要"分路推进/总存活"等替代判胜，给个数值意向我就改（纯 banded 调整）。
- 布阵 UI 需要你定**交互形态**（拖牌分路？预设阵型选择？）——给个 `design/06 §四` 的交互细化，我接。
