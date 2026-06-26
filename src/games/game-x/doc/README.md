# Game X《残响 · Living Companion》— 文档目录

> 「一个住在你桌上的人。」LovePlus 在 AI 时代的复活。本目录是 game-x 的单一资料源。

## 资料

| 文件 | 是什么 |
|---|---|
| `GDD.md` | 策划案（由 docx 转写的可读 Markdown） |
| `LivingCompanionGDD.docx` | 策划案原件 |
| `design-ui.bundle.html` | Claude designer 出的 UI 设计稿（17 屏平铺画布·美术真相源） |

## 设计 → 实现 映射（框架逻辑 + 美术复刻）

数据驱动分层：**角色内容=数据** / **时间感知=纯函数派生** / **UI=LayoutNode 数据** / **场景像素图=宿主表现层 SVG** / **宿主胶水=渲染器侧**。

| 模块 | 文件 | 对应 GDD / 设计 |
|---|---|---|
| 角色数据（七月/Mika 作息表·缺席反应·问候） | `../characters.ts` | GDD §三 角色设计 |
| 时间感知派生（时刻→活动/场景/缺席/温度/关系阶段/见面第一句） | `../companion.ts` | GDD §四 时间感知系统（最重要底层系统） |
| 《残响》主题令牌（黄昏紫/琥珀/奶油/珊瑚 + 像素字体槽） | `../theme.ts` | design bundle 调色板 |
| 像素字体加载（VT323/DotGothic16/Silkscreen） | `../fonts.ts` | design bundle 字体 |
| 像素场景/角色 SVG（黄昏房间·Mika 房·雨天·sprite·开机·svgUri） | `../scenes.ts` | design DESK/SYSTEM frames（SMIL 动蒸汽/眨眼） |
| 设备外框 helper（统一 660×500 外框 + 640×480 内屏） | `../device-frame.ts` | design 卡片外框 |
| Desk Mode 屏（场景 + VT323 信息带 + 情感温度线 + **活动菜单**） | `../desk-screen.ts` | design FRAME: 七月 dusk (HERO) |
| 大厅：角色选择 Marketplace + 开机引导 | `../lobby-screen.ts` | design SECTION: SYSTEM |
| 12 复刻屏（缺席×3/Pocket×3/周末×3/事件×2/日记） | `../screens/*.ts` | design ABSENCE/POCKET/WEEKEND/EVENTS/SYSTEM |
| 宿主：条件驱动整合流转 + 实时时钟 + 关系记录持久化 | `../game-x.ts` | GDD §四/五/六/九/十 |
| Pocket 对话数据（dialogue 能力·测试用·非现行流程） | `../pocket.ts` | GDD §六（脚本对话原型） |

## 整合流转（所有画面由真实条件/菜单触发·无画廊）

- **Desk Mode 活动菜单**（画面内·直接激活）：拿起·和她说话 → Pocket / 一起活动 → 听歌·散步·猜你一天 / 日记收藏（Mika）。
- **缺席感知**（自动·按 hoursAway）：离开 24/48/72h → Desk 自动切暗化叙事屏，拿起即清。
- **特殊事件**（自动·按设备日历）：Mika 生日(4/20) → 生日屏；七月满一年 → 一周年屏。
- **Pocket 上下文**：拿起按 时段/角色 显示 晨间问候 / 记忆驱动 / Mika 复盘。

## 引擎下沉（为像素级复刻 chrome）

- `ui/components` Label 扩字段 `font`(具名字体槽 ui/mono/pixel/display) + `glow`(磷光) + `tracking`(字距)；UITheme 加 `fontPixel`/`fontDisplay` 槽。数据驱动、最弱 LLM 能填、全游戏复用。
