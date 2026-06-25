# 转交文档 · Game G UI 数据驱动重构（接力新 session）

> 一句话：把 game-g 手写 DOM 的 UI **逐屏重写成「纯数据(`LayoutNode`) + 引擎 `mountUI` 解释器」**，趋近全数据驱动。
> **HOME 屏已打样跑通**（`src/games/game-g/home-screen.ts`·主干 `35dac967`），照此模式推广其余屏 + 集成进 live 大厅。

## 0. 红线 + 尺子
- 游戏层 UI = **纯数据**（`LayoutNode` 树）+ **信号**（`action` 字符串）；渲染/事件/换皮全由引擎 `src/ui/components/` 解释。**不写一行 HTML 模板 / DOM 操作**（红线·见 `types.ts` 头注 + game-i）。
- 尺子（宣言）：**最弱 LLM 能不能填出一模一样的 `LayoutNode` 数据？** 能 → 对路。

## 1. 已完成（本 session·主干）
- ✅ **HOME 屏打样** `src/games/game-g/home-screen.ts`：
  - `buildHomeScreen(view: LobbyView) → LayoutNode`（标题 / Boss 情报 / 今日卦象 / **出征 CTA** / 地煞列表·全数据）
  - `mountHome(host, getView, handlers)` 走引擎 `mountUI`（MVU·diff/patch）+ `GG_LOBBY_THEME` 换皮
  - 交互全走 action 信号：`play`(出征) / `man`(手册) / `lucky`(卦象)
  - 测试 `home-screen.test.ts` 钉死链路：数据 → 渲染 → 点出征 → 触发 `play` handler
  - **状态：已验·零手写 DOM·但未接进 live 大厅**（集成是 Step A）
- 前置去腐/AI 都在主干；快照 label = `build-2026-06-23-prephase3`。

## 2. Apollo UI 层速成（**新 session 最省时间的部分·照抄即可·别再重推**）
> 我已读全套，浓缩在此。深读源：`src/ui/components/{types.ts, server.ts, render.ts, layout-solver.ts, bindings.ts, index.ts}` + 范本 `src/games/game-i/`。

- **数据模型**（`types.ts`）：`LayoutNode = { type, id, props, layout?, children? }`。
- **30 控件闭集**：`Panel/Screen/Tabs · Label/Button/Card/Badge/Image/Divider/ProgressBar/Tag/Avatar · Table/VirtualList · Input/Dropdown/Checkbox/Toggle/RadioGroup/Slider/Stepper/Segmented/Rating/Combobox · Modal/Toast/Tooltip/Drawer/Accordion/ContextMenu`。各控件 props 见 `types.ts`（都有类型 + 注释）。
- **布局** `layout`：`direction(row/column/grid)/gap/padding/align/flex/width/height/x,y(绝对定位)/minCol(grid 自适应列宽)/rotate/scale/anim(fadeIn|slideUp|pop|shake|dealIn|flyIn)/animMs/animDelay/draggable/dropZone`。
- **挂载** `mountUI(host, tree, handlers, theme)`（`server.ts`）→ 返回 `ui`：`ui()` = teardown；`ui.update(newTree)` = **局部 diff/patch**（不整树重挂·切页/滚动/输入态不丢·抗闪屏）。
- **事件**：节点 props 里写 `action:'play'`（+可选 `actionArg`）→ 点击触发 `handlers['play'](actionArg)`。`HandlerMap = Record<string,(arg?:string)=>void>`。
- **换皮** `UITheme` 令牌（`types.ts` 尾）：game-g 用 **`GG_LOBBY_THEME`**（`ui-theme.ts`·令牌值是 `var(--ink)/var(--gold)…` 桥接大厅 CSS 变量 → 引擎渲染片段**自动随玄铁/锦霞皮走**）。
- **世界绑定** `resolveBindings(tree, dataSource)`：`Label/ProgressBar/Image` 的 `bind` 字段接 `Resource.current/max`（活 HUD·解耦 ECS）。
- **浮层**：`Modal/Drawer` 单独挂一个 overlayHost（开关不碰主树·不跳不黑）；`showToast(host, text, {tone, theme})` 飘字。
- **MVU 套路**（抄 `game-i/game-i.ts`）：`build tree from state → mountUI 一次 → 改 state → ui.update(buildTree())`。reducer 抄 `game-i/shop.ts`（纯函数 `apply(state,signal)→{state,toast}`）。

## 3. 可移植性地图（子代理实勘·诚实·不硬凑）
| 屏 / 片 | 可落数据 | 路径 |
|---|---|---|
| 大厅 **HOME** | ✅ 已打样 | `home-screen.ts` |
| 大厅 战役进度(52 关) | ~95% | `VirtualList`/`Card`/`Button`·照 home-screen |
| 大厅 收藏(英雄+天梯榜+地煞) | ~90% | `VirtualList`/`Table`/`Avatar`/`Card` |
| 大厅 牌组(天罡+扑克 52) | ~80% | `Panel grid`+`Card`+`Stepper`·翻牌用 `layout.scale` |
| 大厅 改造坊(附魔台) | ~75% | `Panel grid`+`Dropdown`/`Stepper`/`Combobox`/`Accordion` |
| 大厅 皮肤(`lobby-styles.ts`) | 100% | 已是 `GG_LOBBY_THEME` 令牌·直接用 |
| 浮层(帮助/设置/商城/抽卡/故事/引导) | ~85% | `Modal`/`Drawer`+`Label`(typewriter)/`Button`/`Input` |
| 战斗屏 棋盘 9×3 / 手牌坞 / HUD / 按钮 | ~60% 可移 | `Panel grid`+`Card`(draggable)+`ProgressBar`+`Segmented` |
| 战斗屏 **梯门SVG / 对决火花 / 掷币3D** | **(B) 不可约** | **留手写**或做 game-g 专属渲染能力 |
- 合计 **~78% 可落数据**。**别为「全数据化」口号硬凑** —— bespoke 世界渲染（梯门几何/掷币 3D/对决特写）留手写 = **关注点分离·正确**。

## 4. 推进顺序（新 session 照此做）
- **Step A · 集成 HOME 进 live 大厅**（最该先做·让真机看到）：
  - 现状：`mountLobby`（`lobby-screen.ts`）= `render()` 每次 `host.innerHTML = renderLobby(...)` **整屏重渲** + 事件委托。常驻 `mountUI` 区会被 innerHTML 冲掉 → 需改框架。
  - **方案**：把大厅外壳改成「tab 框架 + 每 tab 一个独立 mount 区」；HOME tab 用 `mountHome(homeHost, getView, handlers)` 挂一次、切走 destroy。把 `home-screen` 的 `play/man/lucky` 接到 `game-g.tsx` 现有 `onPlay/onHelp/onLucky` 等回调。
  - ⚠️ **动 `mountLobby` 框架 = 乙域** → owner 直派可动·**知会乙**（同掌机闪烁那次的跨域规矩）。
- **Step B · 逐屏推**：战役 → 收藏 → 牌组 → 改造坊。每屏一个 `*-screen.ts`(纯数据 + reducer) + `.test.ts`，照 `home-screen` 抄。
- **Step C · 浮层**：`Modal`/`Drawer` 组合（帮助/设置/商城/抽卡）。
- 每步：**视觉对标旧屏** · 门禁全绿(tsc+vitest+build) · 主干 fetch→rebase→push。

## 5. 不做 / 边界（CORE RULE 已评判）
- 🎵 **音乐层 = 已数据驱动·别动**：`src/services/audio/`（`SynthAudioPort`/`SynthMusicPort` 解释器）+ game-g `sound/sfx/bgm.ts` 纯 `SfxSpec`/`MusicTrack` 数据。已达标。
- 战斗屏 bespoke 渲染（梯门/掷币/对决特写）：**留手写**·不塞 LayoutNode。
- 真遇到缺口控件（如数字滚动 tween / 富文本着色）：**提给 UI 层程序员（隐形开发员）加通用控件**·别在 game-g 手写一次性 DOM。

## 6. 关键文件 + 归属
| | 文件 | 归属 |
|---|---|---|
| 引擎 UI 层 | `src/ui/components/`（types/server/render/layout-solver/bindings/index） | **UI 层程序员（隐形开发员）域**·要新控件找他 |
| 范本 | `src/games/game-i/{gallery,game-i,handlers,shop,pickcards}.ts` | 参考·照抄结构 |
| 打样 | `src/games/game-g/home-screen.ts` + `.test.ts` | 本 session 产出 |
| 主题 | `src/games/game-g/ui-theme.ts`（`GG_LOBBY_THEME`） | game-g |
| 待移 UI 源 | `lobby-screen.ts`(框架+HOME) / `lobby-{build,deck,collection,overlays,styles}.ts` / `turn-battle-screen.ts` / `game-g.tsx`(挂载) | **大厅/战斗屏 = 乙域**·owner 直派可动·知会乙 |
| 契约文档 | `docs/design/apollo-ui-{contract,porting-contract,migration-guide}.md` | 参考 |

## 7. 工作流约束（同主程规范）
- 分支 `claude/mainbranch`·直推不开 PR·每次 **fetch → rebase → 门禁(tsc+vitest+build 全绿) → push**；rebase 带进新提交必重跑门禁。
- 提交署名 `Claude <noreply@anthropic.com>`·footer 带 session URL·**不写任何模型标识**。
- 动乙域（mountLobby / 战斗屏）= owner 直派·**知会乙**。
- 起步先读：本文 §2（UI 层速成）+ `home-screen.ts`（已跑通的范式）+ `game-i/game-i.ts`（host/MVU 范本）。
