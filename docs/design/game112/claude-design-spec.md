# Game 112《星尾会客厅》· Claude Design 设计文档（UI 与流程规格 · v2）

> **给谁**：Claude Design。**要什么**：按本稿逐屏出 `.dc.html`，放 `docs/design/game112/cloud-design/`，一屏一文件，多状态同文件切换。
> **与 v1 对齐稿的关系**：[`claude-design-brief.md`](./claude-design-brief.md) 是任务书（约束闭集、第一轮范围、交稿格式），**本稿是逐屏规格**：每一屏画什么、信息层级、组件映射（连工程里的节点 id 一起给）、状态矩阵、文案、现况截图、已知观感债。两稿冲突以本稿为准；本稿与 `gdd.md` 冲突以 `gdd.md` 为准。
> **为什么现在出**：Loop-0 竖切（陪伴 → 星砂 → 杂货铺 → 放到馆里 → 心光 → 回忆 → 离线小事件 → 只看它）已在工程里跑通并过 S4 复查，**每一屏都有真渲染截图**（§0.2）。设计不再对着空白想象，而是对着「已经能玩的素坯」做 1:1 复刻基准。
> **作者**：GD/PE-112 · 2026-09-25。

---

## 0. 现况基线（先看这节，再动笔）

### 0.1 工程已落什么（可直接复刻）· 什么是占位（只画构图）

| 屏 | 工程状态 | 设计任务 |
|---|---|---|
| S01 标题 | ✅ `@ui/starters` 起手包 | 换皮 + 视觉锚落地（不改结构） |
| S10 主厅 | ✅ 五态中三态可验：正常 / 回馆小事件 / 只看它 | **高保真**·补「生成任务完成未确认」「离线模式」两态 |
| S20 晶球厅 | ✅ 当前猫晶球 + 空晶球 | 高保真·「进入空间」而非卡墙 |
| S70 星砂铺 | ✅ 四件商品 · 可负担才成交 · 已拥有徽标 | 高保真 |
| S73 玩具篮（仓库） | ✅ 放到馆里 / 已在馆里 | 中保真 |
| S60 回忆廊 | ✅ 章节卡 · 已发光 / 心光 N 时发亮 · 敏感徽标 | 高保真·「不规则光带」 |
| S61 章节阅读 | ✅ dialog + choiceList 三态（台词 / 选择 / 终节点） | 高保真 |
| S66 敏感章节前控制层 | ⬜ 数据位有，屏没有（`REQ-112-GAME-02`） | **设计定稿** → 工程按稿做（dialog + choiceList 三选一，零新控件） |
| S40 星牌桌 | 🟡 接口位（牌规待 owner） | 只画构图与信息层级，**不画规则与牌面数值** |
| S50 逗猫角 | 🟡 owner 判「改视频实现」，重设计中 | 只画「选玩具 → 看它怎么玩（视频片）→ 自然收尾」形态 |
| S90 设置 / 关于 | ✅ 文案页 | 中保真·可信优先 |
| S30～S38 上传相认 · S13 生成托盘 · S94/95 隐私 | ⬜ 等引擎媒体线（ENG-05/06/11 · UI-07） | 按 v1 §4 出稿，标「等引擎」 |

### 0.2 真渲染截图基线（`self-check/shots/`·1280×800·house 主题 `apolloBrocade` 素坯）

| 图 | 屏与状态 | 看什么 |
|---|---|---|
| `S4-play-01-title.png` | S01 标题 | 起手包三键：hero「回到星尾馆」+ ghost「关于」+ quiet「回游戏库」 |
| `S4-play-02-hall-first.png` | S10 空档首进 | 猫画面层 + 三热点 + 两陪伴键 + 五导航；星砂 0 |
| `S4-play-03-hall-after-care.png` | S10 陪坐十次后 | 猫台词换「靠了一点」·晶球卡副标「心光 20」 |
| `S4-play-04/05-shop*.png` | S70 浏览 / 买后 | 羽毛杆禁用「星砂不够」·纸袋「已拥有 ×1」 |
| `S4-play-06-toys.png` · `07-hall-placed.png` | S73 → S10 | 「放到馆里」→ 纸袋标签出现在猫画面下方 |
| `S4-play-08-memory.png` | S60 | 章节「已发光」金徽标 |
| `S4-play-09/10/11-reading-*.png` | S61 三态 | 台词 / 选择列 / 终节点「到这里」 |
| `S4-play-12-hall-again.png` | S10 呼唤后 | 猫图切「注意」态（眼睁大）+ 台词「抬起头看了你一眼」 |
| `S4-play-13-hall-stage-only.png` | S10 只看它 | 只剩猫画面 + 台词 + 「显示界面」+ 已放置标签 |
| `S4-play-14-orbs.png` · `15-table.png` | S20 · S40 | 晶球卡（亲近/安心条 + 心光）· 牌桌接口位 |
| `S4-play-16/17-hall-return-*.png` | S10 回馆 | 「你不在的时候」一句 + 「看过了」→ 收起 |

**素坯 ≠ 设计**。素坯证明结构与状态都在；观感债见 §10，设计稿要解决它们。

### 0.3 引擎硬约束（v1 §3 全文有效·此处只重申最常撞的六条）

1. 只用 41 个控件（v1 §3.1）+ 排布参数闭集（v1 §3.2）；没有 flex-wrap，自适应用 grid+minCol；Screen 不接排布，内容放内层 Panel。
2. 只用 `apolloBrocade` 令牌与语义面（v1 §3.3），不自由取色；纹理/磨砂在 S5 精修阶段以主题实现，稿子标「暖光面 / 冷光面」。
3. 每个可点元素标 action 名（§6 词表）；没有 action 的装饰不做成按钮形。
4. 猫画面 = 一块矩形（Image → 将来 Video）；按钮不插进猫的像素。
5. 右上角 ≈120×56 px 是壳层 ⚙ 保留区，不放本游戏按钮。
6. 条件显隐只有一种机制：`visibleWhen: '<flag>' | '!<flag>'`（整棵子树剔除）。「只看它」就是这么做的（§4.2）。

---

## 1. 设计原则（十条·从 GDD / menu-flow 收敛·每屏对照）

1. **猫先于菜单**：任何屏首先看见猫或猫的痕迹，不先看见货币/任务/弹窗。
2. **主厅即首页**：物件是入口（晶球/牌桌/玩具篮），不做九宫格。
3. **一次只做一件事**：牌局、逗猫、回忆、布置各自固定镜头，不堆面板。
4. **随时安全退出**：每屏有且只有清晰的回主厅路径；阅读/上传随时能停，进度不丢。
5. **生成不阻塞**：媒体任务进后台，玩家立刻回到陪伴；就绪用一枚柔和星光提示，不弹窗。
6. **敏感可跳过**：高情绪内容播放前先给控制权（S66）。
7. **无红点绑架**：无倒计时、无稀缺额度、无欠账文案。
8. **不做第二次失去**：没有死亡/饥饿/断签/告别的任何视觉隐喻；「离开」只用「你不在的时候」。
9. **不卖关系**：心光永不出现在任何价格旁；星砂只换物件。
10. **有生活痕迹**：允许歪斜、磨损、不成套、遮挡；反对对称、成套、AI 豪华咖啡厅。

---

## 2. 视觉系统

### 2.1 令牌与暖冷面分配（`apolloBrocade`·值见 v1 §3.3）

| 面 | 用哪块 | 令牌 | 备注 |
|---|---|---|---|
| 页底 | 整屏背景 | `bg0` #ecd6cf | 暖光面·锦缎纹理由主题给 |
| 猫画面层容器 | `hall-stage` / `table-stage` | `sunken` + vignette | **暖光面**（旧木桌边）。当前素坯用 `sunken` 偏粉灰，设计稿请给出「燕麦旧木」倾向的暖色建议，PUI 落成主题变量 |
| 抬升卡 | 热点卡 / 商品卡 / 章节卡 / 晶球卡 | `raised` #fffaf3 | 暖光面·旧纸卡 |
| 玻璃面板 | 离线小事件 / 阅读框 / 牌桌 | `glass` | **冷光面**（喵星雾青）。⚠ 素坯里 glass 在 brocade 底上渲成深灰块（§10-①），设计稿要给出冷光面的正确样子（雾青偏亮·可读） |
| 强调 | 胭脂玫瑰 `jade` #d8607b | 主按钮 / 当前导航 | 用量克制 |
| 心光 · 星砂 | 金 `gold` #cf9a3f | 数字药丸 / 已发光徽标 / hero 钮 | 心光=淡金偏乳白倾向，星砂=黄铜倾向——同一令牌两种材质感由纹理区分 |
| 语义 | ok / warn / danger | 已在馆里 / 可跳过 / 仅删除确认 | 不做装饰 |

### 2.2 字体槽

- 标题 `cnround`（中文卡通粗圆·素坯已用于猫名与页标题），可在设计稿建议改为「轻手写/旧书感」但必须落在引擎字体槽内（`cnround` / `serif` / 正文 Noto Serif SC / 数字 `mono`）。
- 正文 md 14–16px；副文 sm；**敏感说明不用 xs 浅灰**。
- 数字（星砂/心光）不做竞技仪表感：Tag 药丸 + 常规字重即可。

### 2.3 材质与形态

- 面板 = 半透明磨砂晶片或旧纸卡，边可不完全闭合；信息布局精准。
- 主按钮 = 触摸后亮起的晶石 / 布面标签（引擎：`kind:'hero'` + `fx:sheen-hover`；`Panel.press3d` 给卡片按压感）。
- 卡牌（S40）= 厚无涂层纸、卷角（引擎：`PlayingCard.faceArt`）。
- 图标少：物件即入口；猫爪只用于「回到猫身边」；生成任务用缓慢星点，不用机器人。

### 2.4 动效预算（引擎能做的 = 这些）

| 动效 | 引擎表达 | 用在哪 |
|---|---|---|
| 悬停流光 | `layout.fx: sheen-hover` | hero CTA / 选项 |
| 按压下陷 | `layout.press3d` | 卡片 / 热点 |
| 打字机台词 | `dialog.typewriter` | S61 |
| 克制星光 | `Particles(sparkle)` 低密度 | 章节解锁那一拍 / 生成完成提示 / 晶球内 |
| 进度环 | `ProgressBar(ring)` | 晶球厅 / 猫详情 |
| 屏间切换 | 无过场（重挂） | 全部 |

**减少动态**：粒子停、打字机关、流光关、视频换关键帧；信息与操作等价。

---

## 3. 全局框架

### 3.1 画布与安全区

- 主稿 1440×900；最小 1024×640 可用；素坯截图为 1280×800。
- 内容最大宽 1180（`page()` 外壳 `maxWidth:1180 · padding:22 · gap:14`），居中。
- **右上角 ⚙ 壳层保留区**：120×56。素坯把星砂药丸放在它左侧，勿再往右挤。
- **首屏可见性**：主厅所有常驻元素须在 1024×640 内不滚动可见（素坯在 1280×800 下离线面板出现时导航被挤出首屏，§10-②）。

### 3.2 常驻 HUD（menu-flow §1.3 五件·全部已接线）

| 件 | 工程节点 | 控件 | 设计要求 |
|---|---|---|---|
| 猫名 + 情绪短语 | `hall-cat-name` · `hall-mood` | Label(xxl,cnround) · Tag(accent) | 左上；情绪短语随兴致三档换（今天有点想玩 / 安静地待着 / 有点困了） |
| 星砂 | `hall-stardust` | Tag(size lg, accent) | 右上（⚙ 左侧）；黄铜感 |
| 生成任务状态 | `hall-gen` | Badge(dim)「离线陪伴」占位 | 设计稿给出「缓慢星点」形态的最小图标 + 就绪态（柔和星光）；等 ENG-11 才有任务 |
| 隐藏 UI（只看它） | `hall-stage-hide` | Button(quiet)「只看它」 | 与星砂同排；建议眼睛/月牙形小钮；**点后整屏只剩猫画面层 + 一枚「显示界面」** |
| 主导航 | `navbar` | 五 Button：猫咪 / **回到猫身边**(hero) / 回忆 / 星砂铺 / 设置 | 底部居中；当前屏高亮；牌桌与逗猫**不进**导航 |

### 3.3 猫画面层分层（v1 §3.4·每镜头一张安全区图）

```
前景遮挡：桌沿 / 纸袋 / 窗帘              ← 高层 Image（可挡猫·可选）
实时交互：台词 / 已放置标签 / 显示界面钮   ← UI（画面层下缘的安全带·不进猫像素）
猫画面层：420×300 矩形（主厅）· 320×220（牌桌） ← Image → Video（ENG-11）
空间轻动态：晶球微光 / 尘埃               ← Particles 克制
静态背景：星尾馆                          ← Screen 背景
```

猫画面三态已接线：`rest`（趴）/ `notice`（注意·呼唤后或兴致 ≥70）/ 将来 Video 按状态换片。四档回退各一张稿态：个性片 → 通用片 → 基础活照片 → **静态锚图 + 轻微光效**。

### 3.4 返回与退出（menu-flow §11）

- 一级页（猫咪/回忆/星砂铺/设置/玩具篮/牌桌）→「回到猫身边」回主厅。
- 阅读屏 → 唯一出口「回到回忆廊」（**终局出口**·工程试玩必点项）。
- 只看它 → 唯一出口「显示界面」。
- 主厅 → 不直接退出；「回游戏库」只在标题页（嵌壳层时）。

---

## 4. 逐屏规格（Loop-0 已落七屏 + 两屏待设计定稿）

> 每屏五段：**目的 · 线框 · 组件映射（节点 id 照抄，复刻时不改 id）· 状态矩阵 · 文案与缺口**。

### 4.1 S01 标题页

- **目的**：一眼是这只猫的馆；一键进。
- **线框**：起手包结构（标题 / 副题 / 三键纵列）。设计任务 = 背景视觉锚（旧木桌 + 窗外喵星冷光）+ hero 钮质感。
- **组件映射**：`buildStarterHome`（标题「星尾会客厅」· 副题「在记忆发亮的地方，再陪它坐一会儿」· `home.enter` hero「回到星尾馆」sub「雪团在旧木桌边等你」· `home.about` ghost · `home.exit` quiet（仅嵌壳层））。
- **状态**：默认 / 嵌壳层（多一键）/ 减少动态（无粒子）。
- **文案**：不出现「复活」「回来了」；副题可换但保持「再陪它坐一会儿」的语气。

### 4.2 S10 星尾馆主厅（最高优先·六态）

**目的**：猫先于菜单；三个物件入口；两个陪伴动作；一眼看见「我刚做的事有回应」。

**线框（正常态·1280 宽素坯实测比例）**
```
┌ 雪团 [安静地待着]                         [星砂 20] [离线陪伴] [只看它]  (⚙) ┐
│ ┌──────────────────── hall-stage 420×300 猫画面层 ─────────────────────┐ │
│ │                          （猫）                                     │ │
│ │              它挪了挪，把身子往你这边靠了一点。                       │ │
│ │                          [纸袋]                                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
│        [忆光晶球]          [星牌桌]           [玩具篮]                  │
│     心光 20·还差 0 就发光    和它打牌            1 件                     │
│                  [轻声呼唤]   [陪它坐坐]                                │
│        猫咪   【回到猫身边】   回忆   星砂铺   设置                       │
└─────────────────────────────────────────────────────────────────────────┘
```

**组件映射**

| 元素 | 节点 id | 控件 | visibleWhen |
|---|---|---|---|
| 顶栏 | `hall-top` → `hall-top-left` / `hall-top-right` | Panel(bare,row,between) | `!ui.stageOnly` |
| 猫名 / 情绪 | `hall-cat-name` / `hall-mood` | Label(xxl) / Tag | — |
| 星砂 / 生成 / 只看它 | `hall-stardust` / `hall-gen` / `hall-stage-hide` | Tag(lg) / Badge / Button(quiet, `ui.hide`) | — |
| 回馆小事件 | `hall-offline` → `hall-offline-cap`「你不在的时候」· `hall-offline-0..n` · `hall-offline-ack` | Panel(glass) · Label · Button(ghost,`offline.ack`)「看过了」 | 有事件时才在树里；`!ui.stageOnly` |
| 猫画面层 | `hall-stage` → `hall-cat` · `hall-cat-line` · `hall-stage-show` · `hall-placed` → `hall-placed-<item>` | Panel(sunken,vignette) · Image 420×300 · Label(sub) · Button(ghost,`ui.show`) · Tag ×n | `hall-stage-show` 仅 `ui.stageOnly` |
| 三热点 | `hall-hotspots` → `hot-orbs` / `hot-table` / `hot-toys`（各含 `-img` 64² · `-lbl` · `-sub`） | Panel(raised, action, press3d, width 150) | `!ui.stageOnly` |
| 陪伴动作 | `hall-care` → `care-greet` / `care-sit` | Button(primary, sub) `cat.greet` / `cat.sit` | `!ui.stageOnly` |
| 导航 | `navbar` → `nav-orbs` / `nav-hall`(hero) / `nav-memory` / `nav-shop` / `nav-settings` | Button ×5 | `!ui.stageOnly` |

**状态矩阵（六态·每态一张）**

| 态 | 触发 | 屏上差异 | 素坯图 |
|---|---|---|---|
| ① 正常陪伴 | 默认 | 如线框 | 02 |
| ② 刚回馆 | 离开 ≥5 分钟再进 | 猫画面层**上方**多一块 glass：「你不在的时候」+ 一句 + 「看过了」；点后收起不追弹 | 16 → 17 |
| ③ 操作有回应 | 呼唤 / 陪坐 | 台词换姿态句；呼唤后猫图切「注意」态；晶球卡副标心光数字动 | 03 · 12 |
| ④ 只看它 | `ui.hide` | 只剩 `hall-stage`（猫 + 台词 + 已放置标签）+ 「显示界面」+ 壳层 ⚙ | 13 |
| ⑤ 生成任务完成未确认 | ENG-11 交付后 | `hall-gen` 变柔和星光态；**不弹窗**；点它去托盘（S13·待设计） | ⬜ 设计定 |
| ⑥ 离线模式 | 无网 | 主厅完整；只 `hall-gen` 显离线标；玩法不变 | ⬜ 设计定 |

**设计要点**
- ② 的位置：设计稿可把小事件改成**猫画面层内的一枚可展开说明**（menu-flow §3「场景变化 + 一句可展开说明」），前提是它仍是一块 Panel + Label + Button，不插进猫像素；若保留独立面板，须保证 1024×640 下导航不出首屏。
- ③ 的姿态句是**唯一即时反馈**（视频到来前），请给台词一个视觉位（旧纸条 / 淡字幕带），并留「注意态」图与「趴态」图的两张锚。
- 三热点的副标是活的：晶球卡「心光 N · 还差 M 就发光 / 看它的过去」；玩具篮「还是空的 / N 件」；牌桌「和它打牌」。

**文案（现行）**：陪坐 sub「什么都不做也可以」· 呼唤 sub「它会抬头看你一眼」· 姿态句「它挪了挪，把身子往你这边靠了一点。」「它抬起头看了你一眼，耳朵转过来。」· 离线句四条（纸袋藏牌 / 玩具叼到桌边 / 压平的毛 / 打翻杯垫）。

### 4.3 S20 晶球厅

- **目的**：进入一个空间；当前猫的晶球更近；「接回自己的猫」是一颗空的柔光晶球。
- **组件映射**：`orbs-title` · `orbs-sub`「每一颗晶球都是一个记忆入口，不是囚禁灵魂。」· `orbs-row`(grid minCol 260) → `orb-xuetuan`(raised, press3d) 内 `orb-xuetuan-av` Avatar(56, ring=亲近) · `-name` · `-breed` Tag「布偶 · 官方猫」· `-closeness` / `-ease` ProgressBar(bar) · `-heart` Label「心光 N」· `-go` Button(primary,`hall.back`)「去陪它」；`orb-empty`(sunken, dashed) → `orb-empty-title`「接回自己的猫」· `orb-empty-sub` · `orb-empty-later` Button(quiet,`later`)「稍后再说」；`navbar`。
- **状态**：只有官方猫（现况）/ 有私有猫（隐私标识·地位相同）/ 生成中（Avatar ring 换星点·Badge「它的更多动作还在准备」）。
- **设计要点**：不做 SSR 卡墙；晶球 = 磨砂 + 内部微光 + 照片残影（`Avatar` 圆形 + `Particles` 低密度）；空晶球不是加号框。
- **缺口**：上传入口（`upload.start`）等 UI-07；本轮画占位并标注。

### 4.4 S70 星砂杂货铺

- **目的**：展示「它会怎样改变互动」，不展示属性；不卖关系。
- **组件映射**：`shop-top` → `shop-title` · `shop-stardust` Tag(lg)；`shop-sub`「不卖关系，不卖回忆。换来的东西会留在馆里。」；`shop-grid`(grid minCol 220) → `shop-<item>`(raised, press3d) 内 `-name`(cnround) · `-blurb` · `-row`（`-price` Tag「星砂 30」· `-own` Badge(ok)「已拥有 ×1」）· `-buy` Button：可负担 primary「用星砂交换」/ 不可 ghost disabled「星砂不够」；`navbar`。
- **四件商品**：羽毛杆 30（新互动）· 纸袋 20（新互动）· 软垫 40（装饰）· 月相牌背 50（牌具外观）。
- **状态**：浏览 / 不够（禁用态要清楚但不刺眼）/ 买后（已拥有徽标 + 主按钮可变「放到馆里看看」→ 需新增 action `shop.place`，标「新增」）/ 分类标签（装饰 / 新互动 / 牌具外观·现用 Tag 三值）。
- **设计要点**：物品摆在货架里（Panel skin 旧木格），详情才用面板；无折扣角标、无倒计时。

### 4.5 S73 玩具篮（仓库）

- **组件映射**：`toys-title`；空态 `toys-empty` + `toys-shop` Button(primary,`shop.open`)「去星砂铺」；有物 `toy-<item>`(raised,row,between) → `-name` · `-kind` Tag · `-n` Badge「×1」· 右侧 `-place` Button(primary,`decor.place`)「放到馆里」或 `-placed` Badge(ok)「已在馆里」；`toys-back`「回到猫身边」。
- **状态**：空 / 有物未放 / 已放。
- **设计要点**：放到馆里后自动回主厅目击物件（工程已做）；篮子本身可做成 `Panel.skin` 藤篮。

### 4.6 S60 回忆廊

- **目的**：不是章节进度条，是一条不规则光带；未解锁只有旧物轮廓 + 一句线索。
- **组件映射**：`memory-title` · `memory-sub`「心光会让晶球里的片段慢慢发亮。今天不想看的，可以先不看。」· `memory-list` → `chap-<id>`（已解锁 raised / 未解锁 sunken）内 `-title` · `-hint`（线索句）· `-badges`（`-state` Badge：金「已发光」/ dim「心光 10 时发亮」· `-sensitive` Badge(warn)「可能触动情绪·可跳过」）· `-read` Button(`memory.read`)「看它的回忆」（未解锁 ghost disabled）；`navbar`。
- **状态**：未解锁 / 已发光 / 敏感 / 私有（上传猫·锁标不用红）。
- **设计要点**：光带可用 `LevelPath` 变体或竖排卡 + `Connector` 表达；暗一些但不是悲伤黑幕。

### 4.7 S61 章节阅读

- **组件映射**：`reading-title`；`reading-body`(glass) → `reading-dialog` dialog(speaker/text, typewriter 18, edge gold, kind line|choice) · 选择态 `reading-choices-wrap` → `reading-choices` choiceList(pill, primary, hoverSheen, `memory.choose`) · 终节点 `reading-end`「（这段回忆到这里。它还在你身边。）」；`reading-foot` → `reading-next` Button(hero,`memory.advance`)「继续」（仅 line 态）· `reading-back` Button(ghost,`memory.back`)「回到回忆廊」（**常在**）。
- **状态**：台词 / 选择 / 终节点。
- **设计要点**：终节点态 dialog 不应再显示推进箭头（§10-③，需 PUI 给 dialog 一个「无推进」外观或 kind）；结语不用 xs 浅灰；猫立绘可占 `portrait` 槽但 Loop-0 没接。

### 4.8 S66 敏感章节前控制层（**本轮设计定稿·工程等稿做**·`REQ-112-GAME-02`）

- **触发**：`memory.read` 命中 `sensitive:true` 的章节。
- **形态（零新控件）**：一块 glass Panel：dialog(kind choice, speaker 旁白)「这一段可能会触动情绪。」+ choiceList 三项：「继续看」→ 进阅读 · 「静音看」→ 进阅读（静音标记）· 「今天只想陪它坐坐」→ 回主厅（`later` 语义）。
- **要求**：三项同等易点；不用红/警告图标；「今天只想陪它坐坐」不放最下最小。
- **action**：`memory.read` 复用 + 新增 `memory.readMuted`（标「新增」）+ `hall.back`。

### 4.9 S40 星牌桌（只画构图·牌规待 owner）

- **现况**：`table-title` · `table-stage`(glass) → `table-cat` Image 320×220（注意态）· `table-note`「星爪牌的规则还在对，牌桌先留着。」· `table-sub`；`table-back`。
- **构图要求**：猫在对面、脸与前爪始终可见 → 三个星盘 → 玩家手牌（`PlayingCard` 卷角厚纸）→ 双方星光/回合 → 暂停。**不画数值、不画规则文字**。
- **状态**：准备 / 对局中 / 暂停 / 结算（不评星·猫的反应）。

### 4.10 S50 逗猫角（形态稿·owner 判「视频实现」）

- 「选玩具（玩具篮里已有的）→ 看它怎么玩（视频片·猫画面层）→ 玩累了（两个柔和选择：再玩一会 / 收起玩具）」。
- 玩具选择区与猫画面层分离；**不画拖拽轨迹、不画羽毛棒跟手**。
- 视频四档回退各一张态。

### 4.11 S90 设置 / 关于

- 现况文案页（`settings-title/sub/note` · `about-title/1/2/3` + `about-back`「回到标题」）。
- 设计：标准全屏面板、可信优先；隐私中心/导出删除（S94/95）按 v1 §4 画，删除确认 = Modal 分级，无情绪勒索。

---

## 5. 组件表（可复用件 → 控件映射）

| 组件 | 出现在 | 控件组合 | 备注 |
|---|---|---|---|
| 顶部轻 HUD | S10 | Panel(bare,row,between) + Label + Tag + Badge + Button(quiet) | §3.2 |
| 场景热点卡 | S10 | Panel(raised, action, press3d, 150 宽) + Image 64² + Label ×2 | 副标是活文案 |
| 猫画面层 | S10 / S40 / S50 | Panel(sunken, vignette) + Image/Video + Label(sub) + Tag ×n + Button(ghost) | 矩形·安全带在下缘 |
| 回馆小事件 | S10 | Panel(glass) + Label(sub) + Label ×n + Button(ghost) | 冷光面·可折进画面层 |
| 晶球猫卡 | S20 | Panel(raised) + Avatar(ring) + Label + Tag + ProgressBar ×2 + Button | 空晶球 = Panel(sunken, dashed) |
| 星砂物品卡 | S70 | Panel(raised, press3d) + Label(cnround) + Label + Tag + Badge + Button | 禁用态 ghost |
| 仓库行 | S73 | Panel(raised,row,between) + Label + Tag + Badge + Button/Badge | |
| 回忆节点 | S60 | Panel(raised/sunken,row) + Label ×2 + Badge ×1–2 + Button | 光带 = LevelPath/Connector |
| 台词框 + 选项列 | S61 / S66 | dialog + choiceList(pill) | 敏感前控制层同件 |
| 主导航 | 全部一级页 | Button ×5（当前 primary / 主厅 hero + sheen） | 牌桌逗猫不进 |
| 生成任务状态 | S10 / S13 | Badge → 设计定「星点」形态 | 等 ENG-11 |

---

## 6. 动作词表（工程已接线 22 个 + 待接线）

| 动作 | 玩家看到 | 屏 | 状态 |
|---|---|---|---|
| `home.enter` / `home.about` / `home.exit` | 回到星尾馆 / 关于 / 回游戏库 | S01 | ✅ |
| `hall.back` / `later` | 回到猫身边 / 稍后再说 | 全部 | ✅ |
| `orbs.open` / `table.open` / `toys.open` / `shop.open` / `memory.open` / `settings.open` | 猫咪 / 和它打牌 / 玩具篮 / 星砂铺 / 回忆 / 设置 | S10 导航与热点 | ✅ |
| `cat.greet` / `cat.sit` | 轻声呼唤 / 陪它坐坐 | S10 | ✅ 姿态 + 数值 |
| `offline.ack` | 看过了 | S10 | ✅ |
| `ui.hide` / `ui.show` | 只看它 / 显示界面 | S10 | ✅ |
| `shop.buy`+item / `decor.place`+item | 用星砂交换 / 放到馆里 | S70 / S73 | ✅ |
| `memory.read`+chapter / `memory.advance` / `memory.choose`+index / `memory.back` | 看它的回忆 / 继续 / 选项 / 回到回忆廊 | S60 / S61 | ✅ |
| `shop.place`+item · `memory.readMuted`+chapter | 放到馆里看看 · 静音看 | S70 · S66 | **新增（稿里标）** |
| `upload.*` · `gen.pause/retry` · `privacy.delete.*` · `play.*` | 上传链 / 托盘 / 删除 / 逗猫 | 二轮 | 等引擎 |

---

## 7. 横切状态（每个关键组件各一张）

| 态 | 主厅 | 晶球厅 | 回忆 | 商店 |
|---|---|---|---|---|
| 生成中 | `hall-gen` 星点缓动；猫可用则如常 | 晶球 ring 换星点 | — | — |
| 离线 | 完整；`hall-gen` 离线标 | 私有猫「已缓存」标 | 已下载章节可读 | 可用 |
| 失败可回退 | 不浮在猫脸前；托盘里「这一段没有生成好」 | — | 播放失败回上一版 | — |
| 减少动态 | 无粒子/流光；猫静帧 + 淡入淡出 | 同 | 打字机关 | 同 |
| 大字号 200% | HUD 换行不遮猫；导航仍在首屏 | 卡片纵排 | 同 | grid 单列 |

---

## 8. 文案库（现行·可改·改后回填 `world-data.ts`）

- 标题副题：「在记忆发亮的地方，再陪它坐一会儿」
- 主厅台词：趴「它趴在旧木桌边，尾巴尖偶尔动一下。」· 靠「它挪了挪，把身子往你这边靠了一点。」· 抬头「它抬起头看了你一眼，耳朵转过来。」
- 情绪短语：今天有点想玩 / 安静地待着 / 有点困了
- 回馆：「你不在的时候」· 「它趁你不在，把三张牌藏进了纸袋。」「玩具被叼到了桌边，歪着。」「你常坐的位置上，有一小圈压平的毛。」「杯垫被打翻了，它若无其事地在舔毛。」· 「看过了」
- 商店：「不卖关系，不卖回忆。换来的东西会留在馆里。」· 「用星砂交换」「星砂不够」「已拥有 ×N」
- 回忆：「心光会让晶球里的片段慢慢发亮。今天不想看的，可以先不看。」· 「已发光」「心光 10 时发亮」「可能触动情绪·可跳过」· 「（这段回忆到这里。它还在你身边。）」
- 禁用语（GDD §2.3）：复活 / 灵魂 / 它回来了 / 连续 N 天没来 / 付费解锁记忆 / 删除后永远离开 / 创建猫咪失败

---

## 9. 交稿与复刻流程

1. **文件**：`cloud-design/S10-hall.dc.html`（六态同文件切换）、`S20-orbs`、`S70-shop`、`S73-toys`、`S60-memory`、`S61-reading`、`S66-sensitive-gate`、`S40-table-comp`、`S50-play-form`、`S01-title`、`S90-settings`；`cloud-design/README.md` 用 v1 §8 模板。
2. **每屏必附**（v1 §6）：组件映射表（**沿用本稿节点 id**）、动作标注、状态矩阵、安全区图（猫矩形 / 前景层 / UI 带 / ⚙ 保留区）、令牌标注（暖冷面）、缺口清单。
3. **工程复刻**：`.dc.html` 在档即 1:1 基准 → 真渲染目击（附图）→ 视觉规格全消费 → 差异逐条报 PUI 裁决。设计稿里凡「引擎表达不了」的点，**不要自造控件**，列缺口，由 PUI 判是否加件。
4. **复查**：S5 UI 关三门（`ui-audit` 四关 + 复查人 ≠ 施工人 + 人门），布局在 S4 已冻结，S5 只换皮；**要动布局的设计变更须在稿里单独标「布局变更」并说明理由**。

---

## 10. 已知观感债（素坯截图里看得见·设计稿要解决）

| # | 现象 | 图 | 期望 |
|---|---|---|---|
| ① | glass 面板在 brocade 底上渲成深灰块，「你不在的时候」小字与「看过了」ghost 钮对比低；星牌桌同款 | 16 · 15 | 冷光面 = 雾青偏亮、可读；或改暖纸卡 |
| ② | 离线面板出现时导航被挤出 800px 首屏 | 16 | 小事件折进猫画面层或缩高；1024×640 导航必在首屏 |
| ③ | 阅读终节点 dialog 仍显示推进 ▶；结语 xs 浅灰 | 11 | 终节点无推进外观（报 PUI）；结语 sm 正文色 |
| ④ | 主厅整体偏「表单」：三热点是等宽白卡、两陪伴键是并排药丸，缺生活痕迹 | 02 | 热点 = 场景里的物件（skin 贴图 + 歪斜/遮挡）；陪伴键像布面标签 |
| ⑤ | 猫画面层是纯色 sunken 矩形 + vignette，没有旧木桌 / 窗 / 光 | 02 | 暖光面背景（静态背景层）+ 前景遮挡层 |
| ⑥ | 晶球厅是两张卡，不是空间 | 14 | 进入感（景深 / 不同亮度 / 空晶球柔光） |
| ⑦ | 星砂 / 心光 / 已发光 都是同一种金 Tag，材质无差 | 03 · 08 | 星砂黄铜 vs 心光乳白金 |

---

## 11. 不由设计决定的事（开放问题·owner 判）

- 星爪牌规则（`REQ-112-GAME-01`）→ S40 只画构图。
- 逗猫的视频形态与玩具集 → S50 只画流程形态。
- 游戏定名（《星尾会客厅》为工作名）→ 标题页文字留可替换。
- 媒体线三单（ENG-05/06/11）与上传控件（UI-07）→ 上传链 / 托盘 / 视频层按「等引擎」出稿。

---

## 附：屏与节点 id 速查（复刻时不改 id）

```
S01  starter-home（起手包内部 id）
S10  hall-top{-left,-right} hall-cat-name hall-mood hall-stardust hall-gen hall-stage-hide
     hall-offline{-cap,-0..n,-ack} hall-stage hall-cat hall-cat-line hall-stage-show hall-placed{-<item>}
     hall-hotspots hot-{orbs,table,toys}{,-img,-lbl,-sub} hall-care care-{greet,sit}
     navbar nav-{orbs,hall,memory,shop,settings}
S20  orbs-title orbs-sub orbs-row orb-<cat>{,-head,-av,-id,-name,-breed,-closeness,-ease,-heart,-go}
     orb-empty{,-title,-sub,-later}
S40  table-title table-stage table-cat table-note table-sub table-back
S73  toys-title toys-empty toys-shop toy-<item>{,-l,-name,-kind,-n,-place|-placed} toys-back
S70  shop-top shop-title shop-stardust shop-sub shop-grid shop-<item>{,-name,-blurb,-row,-price,-own,-buy}
S60  memory-title memory-sub memory-list chap-<id>{,-l,-title,-hint,-badges,-state,-sensitive,-read}
S61  reading-title reading-body reading-dialog reading-choices-wrap reading-choices reading-end
     reading-foot reading-next reading-back
S90  settings-title settings-sub settings-note · about-title about-1 about-2 about-3 about-back
```
