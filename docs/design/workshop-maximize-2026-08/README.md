# 工坊壳「界面最大化」真渲染目击（owner 2026-08-11 令 · 施工 2026-08-12）

改动对象：`workshop/index.dc.html`（工坊壳=工具线自由 HTML）。四件：①侧栏手动收缩（◂/左缘浮动 ▸）
②顶栏可藏（▴/顶缘把手 ▾·沉浸态藏顶栏时留浮动「← 返回」替身）③⛶ 专注模式（一键全收·Esc 或 ▣ 复原·
另有浏览器真全屏第二档）④各屏大块就地可收（编辑左列 / 资产浏览器左右两栏 / 素材库我的分组 / 美术库封面·风格工具卡）。

持久化（全部新键·未动任何既有键）：`zc.workshop.sidebarCollapsed` · `zc.workshop.topbarHidden` ·
`zc.workshop.focusMode` · `zc.workshop.editLeftCollapsed` · `zc.workshop.abLeftCollapsed` ·
`zc.workshop.abRightCollapsed` · `zc.workshop.mlGroupsCollapsed` · `zc.workshop.assetsToolsCollapsed`（'1'/'0'）。

目击方式：起 `main_entry.server.start_api_server()`（:4000 伺服 /workshop/ + /api/*）+ chromium
（/opt/pw-browsers/chromium-1194·playwright；沙箱无外网 → unpkg 的 React 18.3.1 UMD 由本地
node_modules 同版本直供路由拦截）。逐态点击 + DOM 断言 + localStorage 断言 + 刷新持久化断言 +
Esc 复原断言，共 **30 项全 PASS**（编辑屏用临时探针卡带进入·目击完已删）。

| 截图 | 态 |
| --- | --- |
| 01-normal.png | 缺省全展开（与改前一致·顶栏右端新增 ⛶/▴ 两钮） |
| 02-sidebar-collapsed.png | 侧栏收起·左缘浮动 ▸ 可再展开 |
| 03-topbar-hidden.png | 顶栏藏起·顶缘把手 ▾ 可召回 |
| 04-focus-max.png | ⛶ 专注模式：侧栏+顶栏全收·右上浮动「⛶ 真全屏 / ▣ 复原」 |
| 05-browser-columns-collapsed.png | 资产浏览器左右两栏收成 26px 窄条·网格吃满 |
| 06-edit-left-collapsed.png | 编辑工坊左列收起（窄条 ▸）·对话区吃满·沉浸自动藏侧栏零回归 |
| 07-edit-topbar-hidden-float-back.png | 编辑态藏顶栏：浮动「← 返回」最小替身（不把人困死在屏里） |

零回归要点：`chromeOn`（2026-08-04 沉浸模式）原语义不动——侧栏可见性改为 `sbOn = chromeOn && !手动收 && !专注`，
缺省（全展开·非专注）逐位等于原条件；专注是「盖层」不改各面板底值，退出即原样复原。
