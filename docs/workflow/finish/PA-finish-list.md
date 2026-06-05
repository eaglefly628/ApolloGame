# PA Finish List · 你等的引擎需求都落地了 —— 可以继续开工

> 给 **PA（Game A 双人协作平台跳跃）**。本程 Lead 把你阻塞的需求全部下沉为通用引擎能力并落地（全绿：446 passed / tsc 干净 / build 通过）。
> 分支 `claude/mainbranch`，已推。拉最新即可用：`git fetch origin claude/mainbranch && git rebase origin/claude/mainbranch`。
> ⛔ 守 `docs/design/data-driven-manifesto.md`：你的活是**填数据**（蓝图/关卡），不写游戏专属系统代码。

---

## ✅ 已落地（你的三条）

### REQ-006 · 通关条件下沉为 `zone-occupancy`（已替你迁完）
- **`coop-goal.ts` 已删除**。通关条件现在是蓝图里一个**纯数据 `Zone` 组件**（不再是手写胜负系统）。
- 你的 `blueprint.ts` 已接好：`Zone{ outFlag:"coop-clear", 目标矩形, requiredEntities:[playerA,playerB] }` + `zoneOccupancyCapability`。语义与原"中心在框内、缺一不可"完全一致，`coop-clear.integration.test.ts` 验证通过。
- **新玩法你直接填数据**：到达点 = `Zone{outFlag, 矩形, requiredEntities:[hero]}`；压力台需 N 人 = `Zone{outFlag, 矩形, requiredTag:玩家位, count:2}`；收集齐/区域占据同理。outFlag 接 `event-when`/`condition` 下游（开门/过关/演出）。

### REQ-004 · `Tween` 加 loop/pingpong（连续往复平台）
- `Tween` 新增可选 `loop:'none'|'restart'|'pingpong'` + `loops?`（程数，缺省∞），**向后兼容**（不写 loop = 原一次性行为）。
- **移动平台/电梯/巡逻台直接填数据**：`level.ts` 的 `Mover` 想连续往复，给它的 Tween 数据加 `loop:'pingpong'` 即可（`from↔to` 来回）。一次性升降仍是不写 loop。
  ```ts
  // 例：巡逻平台（蓝图里给 mover 的 Tween 数据）
  Tween:{ target:'Transform.x', from:300, to:600, duration:120, easing:'easeInOut', loop:'pingpong' }
  ```
- 提醒：`loop` 只驱动表现/软逻辑字段（Transform/Color），逻辑数值仍走整数分步（纪律不变）。`Mover` 类型若要暴露 loop，自己在 `level.ts` 加个可选字段透传即可（纯数据）。

### REQ-005 · 渲染器让 Sprite 给可碰撞实体"穿皮"
- 原来 Shape 排在 Sprite 前 → 带碰撞的实体只画几何方块。现在**优先 Sprite**：贴图就绪即画贴图（盖过 Shape 几何），未就绪退化几何，仅 Sprite 未就绪→占位。
- **玩家/箱子/敌人直接穿皮**：给可碰撞实体（已有 Shape）**再挂一个 `Sprite{textureKey,...}`**（纯数据），资产就绪就显示美术、Shape 只管碰撞。无需双实体 kludge。

---

## ▶️ 建议下一步（全是填数据）
1. 给 `LEVEL_SCROLL` 的移动平台加 `loop:'pingpong'` → 真·连续巡逻台（验证 REQ-004 端到端）。
2. 给玩家 A/B、箱子挂 `Sprite`（配资产清单 textureKey）→ 角色美术皮（验证 REQ-005）。
3. 用 `Zone` 加更多关卡目标（多目标区/分段通关），全数据。
4. 仍按数据驱动纪律：发现"只能写代码"的地方 → 提 request 让 Lead 下沉，别在 game 层写 system。

可用能力一览见 `docs/apollo-engine-overview-for-planner.md` 与 `src/skills/tier2`、`src/skills/tier1`。
