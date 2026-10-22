# Review 单 · `REQ-AIFLOW-DSYNC`（U1）控件库导出为 Claude Design 设计系统

| | |
|---|---|
| 工单 | `docs/workflow/requests.md` · REQ-AIFLOW-DSYNC（owner 2026-10-16 判 A；2026-10-22 当面解除暂缓并令开工） |
| 施工 | Claude（本会话）。复查人须另派，不得是本会话 |
| 改动面 | 新 `scripts/lib/design-system-pack.mjs`（+test）· 新 `scripts/design-system-export.mjs`（CLI）· `src/ui/components/server.ts`（`APOLLO_KEYFRAMES` 加 `export`，无行为变化）· 流程文档一处 |
| 依赖 | U3 风格令牌（`src/ui/components/style-tokens.ts`）用于 Brand 卡 |

## 一、做了什么

`npx vite-node scripts/design-system-export.mjs [--out <dir>]` 生成设计系统包（缺省 `dist/design-system/`，已 gitignore，可随时重生成）：

| 文件 | 内容 | `@dsCard` 组 |
|---|---|---|
| `README.md` | 出稿规则：只用本包控件；元素标 `data-ui="<控件>"`、可点的标 `data-action`（与 `ui-brief` 动作清单对账）；颜色字体只用令牌；复刻按 S4 结构 1:1 / S5 视觉 1:1 | — |
| `catalog.json` | 控件闭集机读表（类型 / 说明 / 何时用 / 子节点 / 字段与闭集值） | — |
| `components/<控件>.html` × 42 | 用**引擎自己的 `renderNode`** 在三套 house 主题（玄曜 / 锦霞 / Apollo Toon）下渲染该控件的标准示例 + 字段表 | Components |
| `foundations/colors.html` · `type.html` | house 主题色板与字体槽 | Colors · Type |
| `brand/<slug>.html` | 每个有风格令牌的游戏（当前 game628）：令牌生成的主题色板 + Button / Panel / Label 预览 | Brand |

- 每张卡首行是 `<!-- @dsCard group="…" -->`，Claude Design 设计系统面板据此自动建卡，不需要另行注册。
- **预览自包含**：示例里引用站内路径的图片（`src`、`poster` 等，含嵌套字段）换成内联占位图并去掉帧动画；站内音视频路径清空。全包无外链脚本、无外部请求。
- 推送到 Claude Design：**需 owner 在会话里启动 `/design-sync`**（`DesignSync` 工具只能由该技能在 owner 发起时使用，本会话不能代为推送）。

## 二、请逐条核

| # | 核什么 | 怎么验 |
|---|---|---|
| 1 | 闭集逐卡 + 首行标记 + data-ui 规则 | `npx vitest run scripts/lib/design-system-pack.test.mjs` 第 1–3 例 |
| 2 | 确定性 | 第 4 例（两次构建逐字节相同） |
| 3 | 自包含 | 第 5 例（无外链脚本、无站内路径图片）；第 6 例占位替换规则 |
| 4 | 非法令牌不导出且告警 | 第 7 例 |
| 5 | 真浏览器 | 生成后用 Chromium 逐卡打开：施工方实测 45 张 HTML，pageerror 0，外部请求 0；空舞台仅 `Divider`（1px 线，是检测阈值的假阳性） |

## 三、撤修验红（施工方已跑·请另选锚点）

| 撤法（锚点唯一命中） | 结果 |
|---|---|
| S1 组件卡不经 `previewSample` | 1 红（自包含） |
| S2 出稿说明不写 `data-ui="…"` | 1 红（逐卡规则） |
| S3 非法令牌不告警（静默跳过） | 1 红（非法令牌告警） |

施工中测试抓到并已修：站内图片不只在 `src`（NativeCharacter 用 `poster`），Video 示例引用站内 `.mp4`——占位替换改为递归扫描所有字段，并区分图片 / 音视频。

## 四、请重点判

- 包内预览是**静态 HTML**：交互态（悬停流光、粒子循环）只保留 CSS 关键帧能表达的部分，依赖 `mountUI` 运行时的动效不在预览里。
- 未做：从设计系统项目**反向拉取**（Claude Design 改了组件后回写引擎）。当前方向只有「引擎 → Claude Design」，引擎控件闭集仍是唯一真相。
