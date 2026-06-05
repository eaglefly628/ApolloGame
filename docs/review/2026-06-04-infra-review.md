# Batch I+II 基础设施 · 外部 Review 结论与处置（2026-06-04，Gemini）

> 评审对象：`review-for-gemini-infra.txt`（视图/存储/音频/输入/文本）。本文记 7 问结论 + 已做处置。
> 总评：严格遵守 functional core / imperative shell，确定性隔离典范；已具备成熟商业 2D 引擎雏形。

| # | 结论 | 处置 |
|---|---|---|
| Q1 分层确定性隔离 | **完全正确、典范**：端口 + Sync 协调器/输入队列单向同步，`tick()` 保持纯函数。 | 维持 |
| Q2 相机进哈希 | 🚨 **致命**：Camera 浮点 zoom/offset 进 hashSnapshot → 跨端 1 ULP 漂移会误判 desync。 | **已修**：`determinism.ts` 加 `NON_DETERMINISTIC={'Camera'}`，hashSnapshot 跳过纯表现组件（方案A）。 |
| Q3 applyCommands 拆分 + RawInput 实体狂欢 | ⚠️ 必须拆 SRP；**强烈反对**每 tick destroy/create RawInput 实体（GC 碎片）。 | **已修**：拆成 `applyMovement`+`applyRawActions`；离散事件改写**单例 `InputQueue{actions}`**（实体 `global-input`，每 tick 整体覆写，零实体分配）。 |
| Q4 音频同名实例覆盖（金币问题） | 🚨 **立刻撞墙的 bug**：AudioSync 以 clipId 为 key → 多实例覆盖、生命周期错乱。 | **已修**：AudioSync 改 **按 EntityId 追踪** + clipId 引用计数（最后一个实例消失才 stop）。 |
| Q5 屏幕→世界逆投影 | **必须引擎提供**，否则各游戏自己复制逆矩阵、易因 margin 错位。 | **已修**：`renderable.ts` 加纯函数 `screenToWorld(sx,sy,cam,canvasW,canvasH)`。 |
| Q6 存储原子性 | ⚠️ LocalStorage 两步写非原子 → QuotaExceeded 致索引与数据脱节、毁档。 | **已修**：`save` 加 try-catch + 失败回滚数据写（保持一致）。IndexedDB 后端列为后续。 |
| Q7 多行排版 | **当前贪心+空格足够**，别在初期手写 Text Shaping 深渊。 | 维持；硬核排版后续接外部富文本布局数据。 |
| 亮点 | CanvasRenderer 以屏幕中心为锚的 translate→scale→translate 仿射变换"数学直觉很准"。 | 保留 |

## 验收
全部修复后：**372 passed，tsc 干净，build 通过**。Gemini 三条"立即修"（Q4/Q3/Q2）均已落地。
