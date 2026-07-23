# game102《色流工坊 / Pixel Pour》· 游戏级工单池

> 游戏级工单随游戏走·**不占引擎 10 硬槽**（CLAUDE.md）。引擎级下沉一旦经 Lead 确认，升级进 `docs/workflow/requests.md`。
> 状态：`open` / `in-review` / `done`（附 commit）/ `wontfix`（附理由）。

---

## 待处理 / 进行中

（暂无·REQ-G102-CAPREVIEW 已裁决 ① 迁「已完结」）

---

## 已完结（附 commit·done 迁此）

### REQ-G102-CAPREVIEW · capability-plan 评审（提请 Lead）· [2026-07-23] · GD 提 → **Lead 评审** · status: **✅ done（⚖ Lead 裁决 ①·2026-07-23）** · 优先级: P1 · 类型: 能力评审 + 架构裁决
> **⚖ Lead 裁决（2026-07-23·核过 §4 组合路径 + registry 六件源码存在）：裁 ①——准以「先组合表达·零运行时游戏层例外」立项，不预下沉 `conveyor-queue`。**
> - **理由（manifesto §4 先重组 + YAGNI）**：GD 列的组合路径经核属实——`event-when` / `effect-apply` / `zone-occupancy` / `tray` / `launch` / `group-count` 六件 registry **全在**（已核 `src/skills/tier2/` 源码存在）。「排队→到位触发→查同色→抛射」是这些件的标准生产线管道编排，**非新形状**。预下沉 `conveyor-queue` 属「未撞墙先造」（过度设计·宪法反对）。
> - **三条时序疑点的组合摆法**：队首递进=`zone-occupancy` 队首 + `event-when` 到位边沿；突破态 5→10 切换=`event-when` 条件树切容量数据（数据表两档·非新逻辑）；弹尽入槽=`event-when`（`group-count`剩余=0 边沿）→ `tray` 待命槽。**先按数据编排试**。
> - **回补通道**：PE 落地若实证某条组合**真表达不了**（附最小复现 + 已试的拼法），再回本表升级进引擎池 `docs/workflow/requests.md` 占槽走下沉——那时 spec 由 Lead 亲笔、Opus 施工。**在此之前 game-102 零游戏层 system 代码红线不破**（散逻辑=违规·撞墙走缺口通道·绝不游戏层自写编排）。
> - **附两条**：中央方块「同色可消/隐藏图案层」=render 组件视图路线（play-field 走渲染器·不手写 DOM）✅ 准；balance-sim 脚本例外=authoring-time 工具（同各游戏 sim 脚本先例·不进 manifest/运行时·产物入库照登记）✅ 准。
> - **实机校准补充受理（2026-07-23）**：金钥匙收集件 + 宝箱门目标计量（100）= `event-when`+`resource`/`gauge`+`effect-apply` 表达（非新缺口）；中央棋盘位图像素画倾向 `tilemap`——**PE 落地时核对 `tilemap` 对「位图→带色格阵+特殊件坐标」的适配度**，不合再回本表报缺口。弹药 20 / 容量 5 均数据参数·不涉能力变更。
> **结论**：game-102 可开工 §1-3 数据面 + §4 组合装配；撞墙即回本表补申请。
> ——原评审请求全文——
> **§4 首行——「传送带队列 + 自动同色开火」的编排怎么落？** GD 初判：可由现有能力组合表达——`event-when`/`effect-apply`（到位→查同色→触发）+ `zone-occupancy`（容量/队首）+ `tray`（待命槽）+ `launch`（抛射）+ `group-count`（剩余同色）。即「排队→到位触发」生产线管道，非真缺口。存疑：有序编排（队首递进、突破态 5→10 切换、弹尽入槽时序）若组合表达不了，倾向下沉通用 `conveyor-queue`。**边界自证**：GD 阶段零游戏层代码（`prototype.html`=设计参考 mockup）；正式 UI 走 LayoutNode，play-field 走 render 组件。
