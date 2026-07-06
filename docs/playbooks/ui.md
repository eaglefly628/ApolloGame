# UI / HUD / 菜单手册（接线图·薄壳）

> **本页是薄壳。做任何 UI 前先读 `docs/design/ui-playbook.md`**（黄金流程 + 防重叠/对比度/透明度/布局卫生四准则 + 自检清单——schema 之外的合理性靠它）。
> **UI 铁律**：所有游戏 UI/HUD/菜单/面板/VN chrome **必须用 `LayoutNode` 数据描述**（控件=闭集 `ComponentType`；显示绑定=resourceId/StringVar id；写世界=`action` 信号名入队）。play-field 走 render 组件（rendering-fx.md）。本页只补**引擎接线**。

## ① 引擎接线链（LayoutNode → 世界）

| 环节 | 机制实名 | 一句 |
|---|---|---|
| 描述界面 | `LayoutNode` 树 | 闭集 `ComponentType` 控件；数据，非 React |
| 挂载/渲染 | `mountUI(...)` | `src/ui/components/server.ts`——把 LayoutNode 渲成 DOM |
| 写世界 = 信号 | `ActionSink` + `action` | 无本地 handler 的 `action` 经 `ActionSink` **入队成 `Signal`**（可带 `arg`）→ 由 sim 能力消费（events-logic.md）；人/AI 共用动作总线 |
| 控件自描述 | `UI_CATALOG` | `src/ui/components/catalog.ts`——有哪些控件/prop/闭集枚举（机读真相，不手抄） |
| 校验树合法 | `validateLayoutNode` | `src/ui/components/validate.ts`——交付前零 issue |
| 新手引导件 | `Coachmark`（组件）+ overlay | `src/renderer/coachmark.ts` + `src/ui/onboarding-overlay.ts`（spotlight 高亮·纯表现不进 hash） |
| 主题令牌 | `UITheme` | `src/ui/components/types.ts`——语义色/字体槽，换皮 |
| 字体（含艺术字） | `Label.font`（闭集槽·非自由 font-family） | 基础 ui/mono/pixel/display/serif；**艺术字 10 款**：impact(Bebas Neue)/heavy(Anton)/epic(Cinzel)/fantasy(MedievalSharp)/elegant(Playfair)/script(Pacifico)/hand(Caveat)/scifi(Orbitron)/terminal(VT323)/comic(Bangers)——Google Fonts·OFL 开源·base64 内嵌 `art-fonts.ts`·离线自带·中文自动回退。`mountUI` 自动注入(`ensureArtFonts`)。缺字体→提 requests 让主程加**一个槽**，绝不塞自由 font-family/扒付费字 |
| 面颜色（底/背景） | `Panel.bg` / `Screen.bg`（三态 `PanelFill`·**色库优先·非裸 hex**） | ①语义令牌 `SurfaceToken`：panel/raised/sunken/jade/gold/ok/warn/danger/ink（映射 UITheme·**换皮自适应**）②预设配色 `FillPreset`：jade-sheen/gold-sheen/ink-deep/steel/blood/frost/ember/void（引擎内建渐变·**固定观感**·`render.ts PRESET_FILL`）③`{custom:'#hex'}`（**创作者特别指定才用**·显式逃生）。**默认从色库选，别裸写 hex**——裸 hex/gradient 串仍收(back-compat)但 `game-skill-audit` ⚠ 标记建议迁。文字色早已闭集（`Label.color` 11 令牌）。缺色→提 requests 让主程扩令牌/加预设，绝不裸写。样例=game-i `t-fill-preset`/`t-fill-token` 段·mmo-hud（token+preset+custom 混用范例） |
| 异形按钮 | `Button.shape`（闭集 `ShapeToken`·非自由 clip-path） | **8 款**：pill(胶囊)/hexagon(六边)/diamond(菱形)/shield(盾徽)/ribbon(绶带)/chevron(箭头)/tag(标签)/cut(八边切角)——引擎预置 clip-path·`render.ts SHAPE_CSS`。缺省不填=矩形。**异形须给足 width/height**（六边/菱形尤其）避免裁掉文字。命中区=元素包围盒（透明角不可点是二期）。缺形状→提 requests 让主程加**一个枚举**，绝不塞自由 clip-path 坐标。矩形切角另有 `layout.chamfer`（八边形单值）。样例=game-i `t-shape` 段 |
| 贴图按钮（自定义皮） | `Button.skin`（**已解析图 URL**·同 `Image.src` 约定） | 按钮底=该图 cover + 白字投影保可读；配 `shape` 或透明 PNG 可做任意异形贴图键。**sim 持资产 key·游戏经 `resolveAsset` 解析后填**（key 不进画面·保 sim 纯）——同 Image.src/Avatar.src/PlayingCard.art 一脉。命中区=包围盒（alpha 命中是二期）。贴图资产走**资产手册**（asset-manager agent），**绝不把 base64/外链二进制塞进 sim** |

## ② 样例指针

- **活范例**：`src/games/game-i/gallery.ts`（全控件 + 艺术字体墙 + 特效/纹理/大标题等新 prop 全覆盖）+ `mmo-hud.ts`（最复杂 HUD·纯数据复现 WoW）。
- **达标大厅**：`src/games/game-g/lobby-dd.ts` + 六屏 `home/campaign/collection/craft/deck/turn-battle-screen.ts`（LayoutNode 纯数据）。
- 控件目录/形状：`src/ui/components/catalog.ts` + `types.ts`；渲染 debug：`render.ts`。

## ③ 本线红线（其余合理性准则见 ui-playbook）

- **禁**：游戏层手写 React 屏 / 自由 CSS·DOM（`innerHTML`/`createElement`）；直用 `ui/shell`(UINode) / `ui/vn`（待退役）。
- **handler 里绝不塞自由逻辑**：`action` 只发信号名，世界改动入 sim 能力层。
- LayoutNode 表达不了的 → 走 requests.md 让主程扩控件（下沉成通用 UI 能力），**绝不手写 React 逃生**。
- **红旗棘轮（owner 2026-07-04 拍板·复查规则）**：每游戏的裸随机/innerHTML/createElement 计数**只许降不许升**（机读基线文件=`scripts/audit-baseline.json`·随 REQ-QA-红旗棘轮 已落地·超基线=门禁红）。真表达不了的先提缺口单，抬基线必须在 baseline 条目挂 `reason:"REQ-xxx"`。浮层/连线/钉实体特效的基座件=REQ-UI-锚定（Float/Connector·施工中），落地前忍住别自造。

## ④ 正样例 / 反面教材

- ✅ game-i（LayoutNode 纯数据展示台）、game-g 大厅六屏（达标）。
- ✖ 手写 React UI 屏两例勿模仿：`src/game-e.tsx`（1163 行·**注意入口在 src 根目录不在 games/game-e/——查它状态别掉这个坑**）与 `src/games/game-f/game-f.tsx`（970 行·冻结）。

## ⑤ 交付前 + 查不到怎么办

- 做完/改完任何 LayoutNode UI → 跑 `/check-ui` 仪式（防重叠/对比度/透明度/布局卫生 + `validateLayoutNode` 零 issue + ui-audit 归零）。
- 控件闭集里没有需要的控件 → `docs/workflow/requests.md` 提缺口，等主程扩 LayoutNode。**不手写 React。**
