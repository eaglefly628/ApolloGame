# game112《星尾会客厅》· S5 UI 自检对齐单

> 范围：十房巡游增量的主厅、00 全馆预览、通用房间页。运行环境为 1280×800 真 Chrome；主题由游戏 mount 传入现有 house 主题 `apolloBrocade`，没有自写 CSS、DOM 或 UITheme。

## 结果

| 检查 | 结论 | 证据 |
|---|---|---|
| LayoutNode 纪律 | ✅ | `games/game112/ui.test.ts` 对全部屏与十房逐一执行 `validateLayoutNode`，零 issue；交互只发闭集 action。 |
| 防重叠 | ✅ | `ui-audit` 分别渲染主厅、00 馆图、通用房间：三屏均 0 overlap。馆图热区明确使用 `allowOverlap:true`，因为它们按设计覆盖在剖面图对应房间上。 |
| 对比度 | ✅ | 三屏均 0 hard contrast、0 warning；房间说明、活动入口和相邻门在真渲染目击后由低对比玻璃改为 `raised + gold edge`。 |
| 透明度与边框卫生 | ✅ | 三屏均 0 border issue；没有透明文字、透明边框或不可见点击层。 |
| 可发现性 | ✅ | 馆图顶部明确提示“直接点图里的房间”；图内十热区有房号标签，下面另有十个文字快跳；当前房显示“雪团在这里”并发金光。沉浸模式的唯一恢复入口与回忆终点唯一出口均使用 `raised + gold edge`，不再以低对比 ghost 隐没在背景中。 |
| 拓扑一致 | ✅ | 所有相邻门来自 `ROOMS.adjacent`；00 热区来自同表 `mapRect`；单测验证唯一、对称、全连通和逐房按钮精确相等。 |
| 真浏览器 | ✅ | `scripts/game112-playthrough.mjs` 49/49，32 张截图，全程零 console error / 未捕获异常；馆图的图内热区与文字快跳分别至少真点一次。 |

## 目击样本

- `shots/S4-play-03-map-cutaway.png`：00 全馆预览、十热区、当前主厅高亮和文字快跳。
- `shots/S4-play-04-room-orbs.png`：从剖面图直接进入 02 晶球厅。
- `shots/S4-play-06-room-attic.png`：04→08 的单向空间末端与返程门。
- `shots/S4-play-12-room-pantry.png`：03→07 茶水间支路。
- `shots/S4-play-16-room-shopfront.png`：09→10 室外到商店支路。
- `shots/S4-play-28-hall-stage-only.png`：沉浸模式仍可恢复 UI。

## 视觉判断

00 总览不是独立重绘，而是以 01–10 已批准房间图确定性拼合；因此总览与单房不会发生 AI 版本漂移。各房保持共同的旧木、灰泥和琥珀过渡，同时保留珠光蓝、森林绿、灰玫瑰、月夜钴蓝等房间个性色。通用 UI 只占画面上下安全带，房间主背景仍是视觉主体。

除主厅/馆图/通用房间外，沉浸模式与回忆终点也有独立临时入口复审：同为 0 overlap、0 hard contrast、0 contrast warning、0 border issue。`ui-audit` 临时入口对 house theme 的静态识别显示“否”，原因是临时审计入口在 mount 时传入 `apolloBrocade`，没有在入口源码声明主题常量；真实游戏 mount 和截图都使用该主题。这是审计识别限制，不是运行时回退主题。
