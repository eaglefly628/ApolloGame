# 05 · 阶段路线 + 当前实现状态 + 演进史

> 承 `README`。本篇是"做到哪、下一步、踩过什么坑"的对账。

---

## 一、阶段路线

| 阶段 | 切片 | 新引擎面 |
|---|---|---|
| **MVP-0 ✅** | 3D 翻牌骨架（`ThreeRenderer`+`Card3D`+`buildGameG3DFlip`）+ 胜负规则 `decideFaceUp` + `buildGameGDuel3D`；headless 测（翻到既定面 / 规则确定性）| ThreeRenderer（render 后端）+ Card3D（render 组件）；**0 capability** |
| **MVP-1 ✅** | 一局收口（`buildGameGMatch`）：两队牌掷命 + `group-count` 数存活 + `Timer` 门（翻牌演完）+ `event-when`(vsResource 比存活, edge) 判胜负 → `set-state` winner + 结算掉材 `mats` | **0**（gameF 重组；Timer-gated banded 代 flow 机，单局更轻）|
| **G2 · 战场结构 ⭐（owner 愿景核心，下一步）** | `06`：54/方·三路×18·军衔=点数 + 开局布阵 + 将领牵动全队（`hierarchy-cascade`）+ 三路胜负（best-of-3）| 0 期望（重组；将领"集合写"优先重组，真缺口才 REQ-G）|
| **G3 · vs AI 对抗** | AI 对手 = 数据配置军队 + 布阵 + 功能牌出牌策略；竞争性闭环 | 0（AI=数据）|
| **G4 · 培养 + 功能牌** | `07`：牌面融合（小丑/星球）+ 功能牌目录（进攻/埋伏/特殊出现）+ 局外构筑 | 0（复用 Game E joker；D0 先核）|
| **Phase-2** | 局外：集材 / 改造（craft：升 favor / 换皮）/ NPC 商城 / 经济（见 `02`）| 0 |
| **Phase-3** | 干预系统（祝福/诅咒/重翻/护盾 = 改 favor 输入的数据目录，见 `01` §三）+ 牌组构建 / 羁绊 | 0 |
| **Phase-4** | 多人（服务器权威，见 `04`）——outcome-first 已扫清浮点障碍 | net/services 基建（非数据能力）|
| 表现升级 | L0 tween ✅ → L1 现成 3D 物理库（可选，看 playtest，见 `03`）| 0（集成现成库）|

---

## 二、当前实现状态（headless 绿；3D 画面仅浏览器）

**目录（全部自包含于 `src/games/game-g/`，仿 gameF）**：

```
src/games/game-g/
├─ DESIGN.md          ← 原 v2 单体设计案（历史底稿；维护入口已转 design/）
├─ design/            ← 本设计文档库（主策划单一真相）
├─ blueprint.ts       ← 数据装配 + 胜负规则(decideFaceUp/buildGameGMatch/Duel3D/3DFlip)
├─ three-renderer.ts  ← 3D 渲染后端(Three.js，gameG 专属表现层)
├─ game-g.tsx         ← 挂载(launcher 卡带槽 mount→cleanup)：跑一局 + 3D 演出 + 胜负显示
├─ game-g.test.ts     ← headless 测(11)
└─ index.ts           ← 对外导出
```

- 主页启动：`src/launcher.tsx` 已登记 Game G 条目（🎴 图标）→ 懒加载 `./games/game-g/game-g.js`。
- ✅ 已落：`decideFaceUp` / `buildGameGDuel3D` / `buildGameG3DFlip` / `buildGameGMatch`（blueprint）；`ThreeRenderer` / `Card3D`；`game-g.tsx` 挂载（跑一局）+ launcher 图标。
- ✅ `game-g.test.ts`（11 测）：3D 翻牌（翻到对的面/过程/确定性）+ 胜负规则（确定性/属性加权/回放）+ 一局（数存活 / 判胜负与规则回放一致 / 我胜掉材 / 演完才定 / 同 seed 逐拍 hash 一致）。
- ✅ **切入 mainbranch 后实测全绿**：tsc 0 / vitest **1181** / build 0。**3D 画面需浏览器**（`npm run dev` → Game G）；本仓库既有"无真浏览器帧验证"债。

---

## 三、数据 vs 代码占比（硬指标，manifesto §7）

| 产物 | 性质 |
|---|---|
| `blueprint.ts`（数据装配 + 胜负规则 helper）、牌表/经济/改造/干预目录 | **数据 + 一条小规则**（`.ts` 装配 = 既有债种）|
| `game-g.tsx`（挂载）、`three-renderer.ts`（渲染后端 = 解释器）| 表现/解释器层（既有债种 / 合宪引擎码）|
| 游戏专属 system | **零** |
| 新增 capability | **零**（3D = render 后端 + render 组件，非 capability）|

---

## 四、REQ-G 状态（缺口记账）

| 编号 | 名称 | 状态 |
|---|---|---|
| REQ-G-001 | `settle-read`（物理落定 → 离散结果）| **已回退**（v0.1 物理决定胜负时下沉，v2 outcome-first 后撤回；通用=掷币/骰子，留 git 史，未来"物理真决定离散结果"玩法可再起）|
| REQ-G-002 | `impulse`（接触 → 速度）| **已回退**（同上；通用=击退）|

> 二者撤回是为"保引擎瘦"——outcome-first 下不需要物理桥。**教训**：下沉"物理↔逻辑的桥"前，先与用户确认**物理是否决定 gameplay**。

---

## 五、演进史（教训留痕）

- **v0.1（物理决定胜负）**：曾下沉 `settle-read`/`impulse`，做了 1v1 决斗 + RTS 接触掷命。
- **反转**：用户指出"不是物理决定胜负，是先定胜负、反推物理表现" + "3D 表现（不是 3A）"。
- **v2**：outcome-first + 3D 表现层；`settle-read`/`impulse`/旧 builder 已回退。
- **2026-06-14（本次接管）**：拆分 `DESIGN.md` → `design/` 文档库；Game G 从 `peaceful-volta` 零冲突切入 `mainbranch`，全绿。

> 复诵：**gameplay 是确定性数据，表现是 3D 演出，单向不回灌。** outcome-first 往往更可控、更可多人。
