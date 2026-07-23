# game102《色流工坊 / Pixel Pour》· 游戏级工单池

> 游戏级工单随游戏走·**不占引擎 10 硬槽**（CLAUDE.md）。引擎级下沉一旦经 Lead 确认，升级进 `docs/workflow/requests.md`。
> 状态：`open` / `in-review` / `done`（附 commit）/ `wontfix`（附理由）。

---

## 待处理 / 进行中

### REQ-G102-CAPREVIEW · capability-plan 评审（提请 Lead）· [2026-07-23] · GD 提 → **Lead 评审** · status: **in-review** · 优先级: P1 · 类型: 能力评审 + 架构裁决
> **请 Lead 评审 `docs/design/game102/capability-plan.md`**（GD 草案·开工前必过审件）。核心待裁一条：
>
> **§4 首行——「传送带队列 + 自动同色开火」的编排怎么落？**
> - GD 初判：可由现有能力**组合表达**——`event-when`/`effect-apply`（到位→查同色→触发）+ `zone-occupancy`（容量/队首）+ `tray`（待命槽）+ `launch`（抛射）+ `group-count`（剩余同色）。即「排队→到位触发」的生产线管道，**非真缺口**。
> - 存疑点：有序编排（队首递进、突破态 6→10 切换、弹尽入槽的时序）若组合表达不了，倾向**下沉一个通用 `conveyor-queue` capability**（确定性·可复用于任何「队列到位触发」玩法），**绝不在游戏层写散逻辑**。
>
> **请 Lead 裁决**：① 准以「零运行时游戏层例外」立项（先按组合表达装配）？还是 ② 预先下沉 `conveyor-queue`？
> 若裁 ②（确认真引擎缺口），本条升级进引擎池 `docs/workflow/requests.md` 占槽走下沉流程；裁 ① 则 PE 落地实证表达不了时再回本表补申请。
>
> **附**：§4 另两条（中央方块「同色可消/隐藏图案层」视图路线；balance-sim 脚本例外）一并请一并过目。
> **边界自证**：本立项 GD 阶段零游戏层代码（`prototype.html`=设计参考 mockup·非引擎实现）；正式 UI 走 LayoutNode，play-field 走 render 组件。

---

## 已完结（附 commit·done 迁此）

（暂无）
