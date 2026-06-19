# 05 · 阶段路线 + 当前实现状态 + 演进史

> 承 `README`。本篇是"做到哪、下一步、踩过什么坑"的对账。
> **最后更新：2026-06-19**

---

## 一、阶段路线

| 阶段 | 切片 | 状态 |
|---|---|---|
| **MVP-0** | 3D 翻牌骨架 + `decideFaceUp` + `buildGameGDuel3D` | ✅ |
| **MVP-1** | 一局收口 `buildGameGMatch`（数存活→判胜负→结算掉材）| ✅ |
| **G2 · 战场结构** | 54/方·三路×18·军衔=点数·开局布阵·将领牵动全队·`standardArmy`/`armyFromFormation` | ✅ |
| **G3 · vs AI 对抗** | AI=数据配置军队·`pickAiFormation`·Boss roster（6 名）·对称干预 | ✅ |
| **G4 · 培养 + 功能牌** | 小丑（10 张）·星球（5 张）·干预卡·6 流派 + 克制网·流派激活质变 | ✅ |
| **Phase-3 · 干预系统** | `LEVER_CATALOG`·`applyInterventions`·`applyJokers`·`applyBuff` | ✅ |
| **WIRE-MARCH · 实时行军** | `live-combat`接入`showMatch`·逐拍 rAF 驱动·60s 一局·战潮脉冲抽牌·大厅忠实港 | ✅ |
| **Phase-2 · 局外** | 局外商城/改造台/大厅5屏（B1–B4+B6）**部分落地**；B5 待派 | 🔄 |
| **待做** | 3D-READ（胜率可读）·3D-JOKER（局内实时打出）·3D-SIM（蒙卡仿真台）·AI 反制布阵·foil 皮肤·「斩」死亡闪帧 | ⏳ |
| **Phase-4 · 多人** | 服务器权威·outcome-first 已扫清浮点债 | ⏳ |

---

## 二、当前实现状态（2026-06-19）

**目录（`src/games/game-g/`）**：

```
blueprint.ts       898 行  — 军队/布阵/小丑/流派/Boss/干预/march 全量数据
game-g.tsx         574 行  — 挂载 + showMatch（实时行军战斗）
battle-screen.ts   353 行  — 战场帧渲染（live-combat 驱动）
lobby-screen.ts    276 行  — 大厅5屏（港绿呢牌桌·忠实港）
live-combat.ts     150 行  — 实时行军引擎（纯函数·无副作用）
render-frame.ts    170 行  — 帧输出层
three-renderer.ts  364 行  — 3D 渲染后端（Three.js）
clash-resolve.ts    40 行  — 对决核（clash 计算）
scene.ts            68 行  — 场景管理
feel.ts             66 行  — 手感参数
index.ts             6 行  — 对外导出
```

**测试**：9 个测试文件 · 204 用例 · ~1,832 行 · vitest 约 1454+ 全绿

- `game-g.test.ts`（115 用例）：核心规则—`decideFaceUp`/军队/小丑/流派/干预/Boss/march
- `lobby-screen.click.test.ts`（30）/ `battle-screen.frame.test.ts`（11）/ 其余 7 个小测

**已实现功能摘要**：
- 确定性掷命内核（`decideFaceUp`·favor 权重·mulberry32 PRNG）
- 54 牌三路军（`standardArmy`·军衔=点数·将领·溃散级联）
- 4 种布阵预设 + `pickAiFormation`（AI 按 stage/deck/archetype 反制选阵）
- 干预卡 6 类（祝福/诅咒/护盾/斩首/增援/牌型羁绊）+ `applyInterventions`
- 10 张小丑·5 张星球·6 流派（双三环克制）·流派激活质变
- 6 Boss（开局干预·各有布阵·run 轮换）
- 实时行军战斗：逐拍 `stepLiveBattle`·接敌翻牌·战潮脉冲抽牌·3血大本营
- 大厅 5 屏（港绿呢牌桌·布阵展示·命牌战库构筑·新手指导）

---

## 三、数据 vs 代码占比（硬指标）

| 产物 | 性质 |
|---|---|
| `blueprint.ts` + 所有牌表/经济/干预/Boss/小丑目录 | **数据 + 确定性规则**（零 capability）|
| `live-combat.ts`·`clash-resolve.ts`·`scene.ts` | 纯函数解释器（游戏侧，零引擎改动）|
| `game-g.tsx`·`battle-screen.ts`·`lobby-screen.ts`·`render-frame.ts` | UI 层 / 渲染驱动（游戏侧）|
| `three-renderer.ts`·`feel.ts` | 3D 渲染后端（表现层，合宪）|
| 游戏专属 capability | **零** |

---

## 四、REQ-G 状态（缺口记账）

| 编号 | 名称 | 状态 |
|---|---|---|
| REQ-G-001 | `settle-read`（物理落定 → 离散结果）| **已回退**（outcome-first 不需要物理桥；留 git 史备查）|
| REQ-G-002 | `impulse`（接触 → 速度）| **已回退**（同上）|

---

## 五、演进史（教训留痕）

- **v0.1（物理决定胜负）**：曾下沉 `settle-read`/`impulse`，做了 1v1 决斗 + RTS 接触掷命。
- **反转**：用户指出"不是物理决定胜负，是先定胜负、反推物理表现"。
- **v2（outcome-first）**：`settle-read`/`impulse`/旧 builder 已回退。
- **2026-06-14**：接管 → 拆分 `DESIGN.md` → `design/`；Game G 切入 `mainbranch`，全绿。
- **2026-06-15–17**：G2/G3/G4/Phase-3 全部落地（军队·布阵·小丑·流派·Boss·干预）。
- **2026-06-17–18**：WIRE-MARCH — `live-combat` 接入·实时行军·战潮脉冲·大厅忠实港。
- **2026-06-19**：战斗 polish 三连（无迷雾·三路定位·提速）·B3 命牌战库构筑落地。

> 复诵：**gameplay 是确定性数据，表现是 3D 演出，单向不回灌。**

