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


## 独立复查判词（Codex · 2026-10-23）

**FAIL，两条 P2；退 Claude / DSYNC 导出器返工。** 固定审查 `cafa0c60e7ae73e86311d9f6666ee3dc510b6187`，施工为 Claude，本复查未参与。隔离 fixed / withdraw clone，恢复后均 clean，未修产品。以下均实际复现，未用施工自陈代替证据。

### DS1（P2）：NativeCharacter 三套主题的预览均坏图

新接缝 `scripts/lib/design-system-pack.mjs:21–34` 将本地 poster 换为 data SVG；现有 `render.ts:594–595` 仍用 `nativeLocalPath`（`native-character-data.ts:8–12`）拒收带 URI scheme 的路径。结果导出 `<img data-native-poster src="">`，三张舞台图像 naturalWidth / naturalHeight 均0。

最小复现：`npx vite-node scripts/design-system-export.mjs --out /private/tmp/dsync-repro`，真实 Chrome 打开 `components/NativeCharacter.html`，逐个 `[data-native-poster]` 读取 src、currentSrc、complete、naturalWidth；三份均 src/currentSrc空、complete=true、naturalWidth=0，截图有坏图图标。没有外部请求不代表图片有效。

修复归属：导出器的预览适配；可用现有 Image 的 export-only 静态 fallback 或兼容本地路径约束的自包含占位方案。不要为了导出放松 NativeCharacter 生产路径安全。补最终 HTML / 真浏览器 naturalWidth 验收，不能只检查输入 props 被替换。

### DS2（P2）：一个 JSON 语法错阻断所有正常游戏出包

`gameTokenThemes` 注释承诺非法令牌跳过并告警，但 `scripts/lib/design-system-pack.mjs:96` 的 JSON.parse 在拒收分支之外。

实跑 CLI：仅合法 game628 时 exit **0**；增加 `public/games/zz-review-bad-json/art/style-tokens.json` 内容 `{"version":1,` 后，同命令 exit **1**，`SyntaxError: Expected double-quoted property name in JSON at position 13`，无 slug reject 日志，输出目录和合法 Brand 都不存在。删除坏 fixture 后 exit **0**，game628 Brand 与先前逐字节相同。独立2条缺陷契约断言均真红，exit1。

修复归属：逐文件捕获读取 / JSON parse 错误，记录 slug 的 reject 并继续正常游戏导出。语法错也属于非法文件；现有单测只覆盖 JSON 对象 schema 非法，未覆盖语法错误。

### 独立复跑与浏览器逐卡结果

- `npx vitest run scripts/lib/design-system-pack.test.mjs`：7/7、exit0；额外独立结构测试3/3、exit0。
- 真正跑 `npx vite-node scripts/design-system-export.mjs --out <临时目录>`：exit0，47文件、45张HTML（42控件、2基础、1游戏Brand）。不是仅调用内存构造函数。
- 真实已安装 Google Chrome 逐一打开全部45张：pageerror **0**、外部请求 **0**、failed request **0**、首行 `@dsCard` 不合格 **0**、空body **0**。126组件舞台均有子节点；Divider为374×1正常线。6张 img 中 **3坏图**，全是 DS1；因此浏览器过程脚本 exit0 不表示图像验收通过。
- 外链 script / CSS 为0；未定义 CSS 动画名为0。APOLLO_KEYFRAMES 与父版内容8478字节相同，SHA `ef10644d85fe82dab9620f5bb4ea60adddec20f66c0af78751034deaa041a294`，仅增加导出声明。
- README 确有只用包内闭集控件、data-ui、data-action 对账、令牌颜色字体、S4结构 / S5视觉1:1规则；每卡首行标记完整。仅审静态出包，不冒充 mountUI 交互运行时审查，也未替 owner 执行 `/design-sync`。

### 独立撤修验红（不同于施工方 S1–S3）

先断言锚点原串唯一命中1；仅在 withdraw clone 动手，逐次恢复：

| 锚点 / 撤法 | 测试 | 真红与恢复 |
|---|---|---|
| `if (Array.isArray(value)) return value.map(swapImages);` → 原样返回数组 | `nested arrays replace image fields and clear media fields without mutating input` | 真 AssertionError exit1，恢复 exit0；撤前独立3例绿 |
| `const SITE_MEDIA = /^\/(?!\/).*\.(mp4|webm|ogg|mp3|wav|m4a)$/i;` → 永不匹配 `/$^/` | `media cleanup clears nested audio and video paths for every supported format` | 音视频路径未清空 AssertionError exit1，恢复 exit0 |

恢复源码 SHA256 均 `9622efe4d6e19d5eab6ccddd5426c4fdaf2cded6f6d964d3ec583ede93962e8a`，工作树 clean。两次红灯不是编译 / Chrome 缺失 / 超时；原始输出与 unique-hit JSON 均保存。

### 全量门禁、告警与证据

实际宿主运行 `node scripts/scoped-gate.mjs --run --base cafa0c60^`，显式真实 Chrome 路径：总 exit **0**，673文件 / 7254测试通过；eslint、depcruise、tsc、vitest:full、build、docs-ref、context-budget 各 **0**；art-ledger **2**（允许的旧WARN：黑户5、死账2、缺来源0），末行 `✅ 门禁全绿（scope=full）`。新增缺陷不在既有全量测试断言内，故全绿不改变 FAIL。

读完228个stderr块，226归一行；与既有完整基线比较，新增仅负例拒收与令牌优先决策。唯一 topological-sort 是既有 system-graph 的 `[L,P]` fixture，无新增环；无 Unhandled 汇总。构建3大chunk与台账旧WARN均已读。**真实 Tripo / ARP / Mixamo 链路未验**。

完整证据 `/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/review-trio-split3d-20261023/dsync/review-summary.json`、`browser.json`、`browser-summary.json`、`screenshots/components-NativeCharacter.html.png`、`bad-json-cli-summary.json`、`defect-contracts.log`、`withdraw-summary.json`、`scoped-gate-full.log`。证据根见本节末。

证据根（本机持久目录）：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/review-trio-split3d-20261023`。

## 返工（Claude · 2026-10-24）· DS1 / DS2 → 待独立复查（复查人 ≠ Claude）

**DS1**：`previewSample` 遇到 `NativeCharacter` 时，整节点换成同 id、同 layout 的 `Image`（`src` = 内联占位 SVG，保留 alt，fit 取 cover|contain|fill 之一，默认 contain），并打 `[design-system] decision` 日志。这等价于它的海报静态兜底；`render.ts` 与 `nativeLocalPath` 一字未动，生产安全边界不放宽。卡片仍标 `data-ui="NativeCharacter"`（由卡片外壳打，现有用例钉住）。原用例断言「poster 变 data:」，钉住的正是这个缺陷，已改为断言换成 Image。

**DS2**：`gameTokenThemes` 逐文件 `try { JSON.parse } catch` → `[design-system] reject: <slug> style-tokens JSON 解析失败（…），不导出` 后继续。

**新增用例**（`scripts/lib/design-system-pack.test.mjs`，9/9 exit 0）：
- `最终 HTML：所有 <img> 都有可显示的内联 src…`：扫整包最终 HTML，每个 `<img>` 的 src 必须是 `data:image/`，NativeCharacter 卡必须含占位 img。这检查的是最终产物，不是输入 props。
- `风格令牌 JSON 语法错只跳过该游戏并告警，其余游戏照常导出`：broken（`{ "version": 1, `）+ good 两个游戏，结果只剩 good，告警含 `reject: broken` 与 JSON，整包含 `brand/good.html`。

**真浏览器**（Playwright Chromium 逐张 file:// 打开，检查脚本在 scratchpad，不入库）：

| 版本 | 卡 | img | naturalWidth=0 | pageerror | 外部请求 |
|---|---|---|---|---|---|
| 修前 2c9dae03 | 45 | 6 | **3**（全在 NativeCharacter） | 0 | 0 |
| 修后 | 45 | 6 | **0**（NativeCharacter 三张均 160） | 0 | 0 |

**施工自证撤修验红**（复查人请另选）：

| 锚点（命中 = 1） | 撤法 | 红灯 |
|---|---|---|
| `if (node.type === 'NativeCharacter') {` | → `if (false) {` | exit 1：替换用例 + 最终 HTML 用例 |
| `try { raw = JSON.parse(readFileSync(file, 'utf8')); } catch (e) {` | 去掉 try 与 catch | exit 1：语法错用例 |

两次均 cmp 恢复、exit 0。

**全量门禁（STYLETOKENS + DSYNC 返工同一提交）**：`node scripts/scoped-gate.mjs --run`，scope=full，**exit 0**；673 文件 / **7294** 测试（基线 7268 + 本次新增 26）；docs-ref PASS、context-budget PASS、art-ledger-guard 为既有 WARN；topological-sort 仍只有 `[L,P]` 负例 fixture 一条，无新增环。
