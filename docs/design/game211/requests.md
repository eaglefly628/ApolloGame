# game211《翻命扑克》· 游戏级工单池

> 游戏级工单随游戏走·**不占引擎 10 硬槽**（CLAUDE.md）。引擎级下沉一旦经 Lead 确认，升级进 `docs/workflow/requests.md`；3D 面走 `docs/workflow/requests-3d.md`。
> 状态：`open` / `in-review` / `done`（附 commit）/ `wontfix`（附理由）。
> **注**：本游戏其余设计文档现落在 `games/game211/design/`（`capability-plan.md`、`HANDOFF-duel-physics.md`），与全库 `docs/design/<game>/` 约定不一致。**未擅自搬迁**（会断已有引用）；如需归位另开工单。

---

## 待处理 / 进行中

### REQ-G211-HARDLINE · 硬红线红旗无基线条目（裸Math.random×8 · innerHTML×29 · createElement×34 · React屏×1）· [2026-08-10] · 承 `REQ-3D-G211-HARDLINE` 工单①建池 → **待 owner/Lead 裁决** · status: open · 优先级: P1 · 类型: 治理缺口（红旗棘轮/硬红线）

> **本工单只登记事实，不代拍**（同 `REQ-G102-HARDLINE` 体例）。

**实测**（`node scripts/game-skill-audit.mjs game211`·2026-08-10 于 `0746cda2`·退出码 1）：

```
🔴 未覆盖红旗（判 FAIL·新游戏）: game211(裸Math.random×8, innerHTML×29, createElement×34, React屏×1)
AUDIT: FAIL   /   RATCHET: FAIL（新游戏红旗·无基线条目）
```

**归属逐条核过（与 game-g 非测试文件逐文件对数·game211 系 game-g fork）**：

| 指标 | game211 实测 | game-g 基线 | 差 | 结论 |
|---|---|---|---|---|
| 裸 Math.random | 8 | 8 | 0 | **全部继承**。分布：`game211.tsx` 166/179/188/358/536 · `game211-build.ts` 26 · `game211-save.ts` 56/58，逐行与 game-g 同名文件一致 |
| innerHTML | 29 | 29 | 0 | **全部继承** |
| React 屏 | 1 (`game211.tsx`) | 1 (`game-g.tsx`) | 0 | **全部继承** |
| document.createElement | **34** | **31** | **+3** | **31 继承（逐文件相等：clash-dice-3d 1 · coin-flip 2 · game211.tsx/game-g.tsx 24 · turn-battle-screen 4）；3 新增** |

**⚠ 那 3 处新增是本次物理原型写的**，不是存量：

```
games/game211/duel-spike.ts:224   const wrapper = document.createElement('div');
games/game211/duel-spike.ts:226   const stage   = document.createElement('div');
games/game211/duel-spike.ts:229   const uiHost  = document.createElement('div');
```

用途 = **3D 试验台的挂载脚手架**（wrapper 定位盒 / stage 收紧包 canvas / uiHost 贴角 HUD 宿主），非游戏 UI 屏。三行各自对应 `duel-spike.ts` 头注记录的一次实测事故（坑②③④：`Screen` 会盖黑 canvas · `stage` 用 `absolute;inset:0` 会塌成 0 高 · HUD 宿主铺满会吃掉点击）。

**先查结论（缺口裁决协议第①步·实查留痕）**：

* `docs/playbooks/ui.md` §禁 与 `casual-toolkit.md:62` 的 `createElement` 禁令，指向的是**游戏层手写 UI 屏**；play-field 走 render 组件 + 渲染器，**未覆盖「3D canvas 宿主怎么挂」**。
* **无基座件**：`src/ui/components` / `src/renderer` 下未检出 3D stage 挂载 helper。
* **既有先例同形**：P3D 域参考实现 `games/game-z/game-z.ts` 用的是同一模式（`document.createElement` ×4：wrapper 46 / stage 48 / hudHost 69 / menuHost 108），且**已持 Lead 批准的基线豁免**（`audit-baseline.json` → `game-z: createElement 4, approvedBy LEAD, reason 存量既往不咎·P3D 域`）。

**⚠ 对裁决的直接影响（此前口径有误·已更正）**：

交接单原写「DOM 红旗也全是 fork 来的存量」，**差 3 处**。因此「**给 game211 与 game-g 同等豁免**」若按 game-g 的字面计数写（createElement **31**），**门禁仍红**——game211 实测 34。裁 A 必须写 34，且这 3 处要单独具名批注，否则等于把 3 行新债静默混进「既往不咎」（`audit-baseline.json` `_doc` 点名过的历史事故正是此形：`PE-T 6142237d 自写 createElement:5`）。

**待裁（三选一·本工单不预设）**：

* **A｜补基线豁免**：给 game211 建条目 `nakedRandom 8 · innerHTML 29 · createElement 34 · reactScreen 1` + `approvedBy:"LEAD"` + `date` + `reason`；reason 须**两段分写**——「31 = game-g fork 存量既往不咎」+「3 = duel-spike 3D 台挂载脚手架·同 game-z 已批先例」。
* **B｜先还一部分债**：清掉 8 处裸 `Math.random` 走引擎种子 PRNG（机械活·全在局外元层：卦象/抽卡/生肖/战斗种子/UI 延时/增益洗牌/牌组 id/Boss 抽取）→ 条目降为 `nakedRandom 0`；DOM 侧仍须 A 式豁免。
* **C｜消解那 3 处**：把 3D 台挂载脚手架下沉成基座件（引擎面·会同时惠及 game-z 的 4 处），game211 DOM 计数即回落到与 game-g 完全相等。**代价**：属引擎级下沉，须升级进 `docs/workflow/requests.md` 占硬槽，且改动 P3D 域参考实现。

**红线**：`audit-baseline.json` 的豁免 **须 Lead 亲批·不得自写条目**（`_doc` 明文）。故 A/B/C 三条**都不能由施工方自行落地**。

**Lead 推荐（不下裁决）**：**A**，reason 两段分写。理由：3 处新增与 game-z 已批先例同形同域，C 的下沉代价（占引擎硬槽 + 动 P3D 参考实现）与收益（消 3 行）不成比例，属过度设计；B 可作为独立还债单择期做，不必阻塞当前门禁。

---

## 已完成

（暂无）
