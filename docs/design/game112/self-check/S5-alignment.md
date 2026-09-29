# game112《星尾会客厅》· S5 UI 自检对齐单

> 范围：巡游版 v3 的十房画内交互舞台、00 全馆预览和叠层 Drawer。运行环境为 1280×800 真 Chrome；主题由游戏 mount 传入现有 house 主题 `apolloBrocade`，没有自写 CSS、DOM 或 UITheme。

## 结果

| 检查 | 结论 | 证据 |
|---|---|---|
| LayoutNode 纪律 | ✅ | `games/game112/ui.test.ts` 对全部屏与十房逐一执行 `validateLayoutNode`，零 issue；交互只发闭集 action。 |
| 防重叠 | ✅ | 永久审计入口 `tools/audits/game112-scene.audit.ts` 与 `game112-map.audit.ts` 均为 0 overlap。图内热区明确使用 `allowOverlap:true`，因为它们按设计覆盖在房间画与剖面图上。 |
| 对比度 | ✅ | 主程复查首跑抓到主场景 7 处、馆图 11 处硬性低对比；改为 `raised + gold edge` 实底标签与正文色后，两入口均为 0 hard contrast、0 warning。 |
| 透明度与边框卫生 | ✅ | 两入口均为 0 border issue；热区命中面可透明，但所有文字都由不透明实底标签兜住。 |
| 可发现性 | ✅ | 门与物件热区有实底小木牌、`sheen-hover` 悬停流光和 `press3d` 按下反馈；馆图十房直接可点，当前房显示“雪团在这里”并发金光；沉浸模式与回忆终点均保留唯一明确出口。 |
| 拓扑一致 | ✅ | 所有相邻门来自 `ROOMS.adjacent`；00 热区来自同表 `mapRect`；单测验证唯一、对称、全连通和逐房按钮精确相等。 |
| 真浏览器 | ✅ | `scripts/game112-playthrough.mjs` 59/59，38 张截图，全程零 console error / 未捕获异常；十房全部沿画内门走通，馆图图内热区也真点进入房间。 |

## 目击样本

- `shots/S4-play-03-map-cutaway.png`：00 全馆预览、十个图内热区和当前主厅高亮。
- `shots/S4-play-04-room-orbs.png`：从剖面图直接进入 02 晶球厅。
- `shots/S4-play-06-room-attic.png`：04→08 的单向空间末端与返程门。
- `shots/S4-play-12-room-pantry.png`：03→07 茶水间支路。
- `shots/S4-play-16-room-shopfront.png`：09→10 室外到商店支路。
- `shots/S4-play-33-gallery-stage-only.png`：沉浸模式仍可恢复 UI。

## 视觉判断

00 总览不是独立重绘，而是以 01–10 已批准房间图确定性拼合；因此总览与单房不会发生 AI 版本漂移。各房保持共同的旧木、灰泥和琥珀过渡，同时保留珠光蓝、森林绿、灰玫瑰、月夜钴蓝等房间个性色。巡游 UI 全部依附画内门、物件、猫和木牌；子功能只以 Drawer 覆盖当前房间，不再另起画面外菜单页。

除主厅/馆图/通用房间外，沉浸模式与回忆终点也有独立临时入口复审：同为 0 overlap、0 hard contrast、0 contrast warning、0 border issue。`ui-audit` 临时入口对 house theme 的静态识别显示“否”，原因是临时审计入口在 mount 时传入 `apolloBrocade`，没有在入口源码声明主题常量；真实游戏 mount 和截图都使用该主题。这是审计识别限制，不是运行时回退主题。
