# 《掼蛋夜宴》美术台本 v1 — demo 版（外围打牌优化）

> 2026-07-20 · PE-A 出案（owner 口述范围 + 子代理视觉普查 + characters.md/ui-scene-design §5/art-pipeline 合并）。
> **本台本 = 一份 demo 可直接跑的美术+观感清单**：① 风格总纲 ② 需生成资产台账 ③ 牌面方案 ④ 全部按钮/UI 处理表 ⑤ 优化清单（分「PE 可即改 / 需生成 / 报 PUI」）⑥ 两天 demo 排期。
> 数字口径以机读为准（theme.ts / hud.ts / art/index.json）；本文手抄数字=过期信号。

## 0. 范围（owner 2026-07-20 拍板 · 最高优先）

- **立绘 = 外部角色卡传入**（SessionIn·avatar/portrait media·**REQ-CHARCARD 已接线**：`toSeatCard.avatar` → `Avatar src`）→ **本台本不产任何人物立绘/头像图**；卡就绪即自动填，占位（首字圈）是无卡兜底，勿动其内容。
- **5 档服饰阶梯 = 暂缓**（依赖立绘 + 量大 ~15 张/组 · v2 服饰经济重头 · demo 后再启）。
- **聚焦 = 「外围打牌」**：人物立绘**以外**的一切——背景 / 牌桌 felt / **牌面·牌背·王** / 按钮 / 图标 / HUD chrome / 标题 / 演出——的观感做到位。
- 人物**框/描边/席位卡 chrome** 属外围（在范围）；框里的**头像/立绘图**属角色卡（不在范围）。

## 1. 风格总纲（已定稿 · 直接喂 prompt）

- **世界观**：现代私宅夜局——豪宅牌室、暖夜灯光、落地窗夜景，松弛而非写实赌场。「姨太」称谓作设定趣味。
- **画风**：二次元向，高饱和 + 柔光渐变，现代时装。
- **风格锚（已选·喂生成 prompt 的三把锚）**：场景 `modern-manor` · 人物 `sakura-nijigen`（三游戏共用·owner 终字）· 控件皮 `apollo-toon`。
- **夜宴配色（`GAME_A_THEME`·机读真相 theme.ts）**：

| 令牌 | hex | 角色 |
|---|---|---|
| bg0 / bg1 / bg2 / bg3 | `#160e0a` / `#241812` / `#2c1f16` / `#37271a` | 暖夜黑阶梯（底→抬升） |
| text / sub / dim | `#f3ece0` / `#c3b39c` / `#8a7862` | 米白 / 次级 / 静默 |
| gold | `#f0c96a` | 米金（高亮·CTA 意图） |
| danger | `#c8352b` | 朱砂红（级牌/警示） |
| jade / ok | `#7fd6b0` | 翡翠（队友/正向） |
| warn | `#e0b458` | 琥珀（警告） |
| line | `rgba(224,180,120,.30)` | 暖金细线边 |
| 陶橙（**蓝本定义·未接线**） | `#e08a5a` | **对手身份色（应用缺·见 §5）** |

- **参考词（拼 prompt 用）**：`warm night mansion parlor, soft rim light, cel-shaded, high-saturation, silk/velvet/marble, cinnabar-and-gold accents, no realistic casino`。
- **字体**：UI `Noto Sans SC` · 标题 `Noto Serif SC`（**统一用它**·勿混 Playfair `elegant`——latin-only·CJK 会退化，见 §5）。

## 2. 美术台账（需生成的「外围」资产 · 接编译期美术管线）

> 台账制（art-pipeline.md）：每行 = 一种素材 · 带 `spec{w,h}` + 英文提示词（主体+特征+颜色+视角·4-10 词·禁裸名词）+ 风格锚。生成走平台「⚡一键全量」→ palette-snap → 落 `public/games/game-a/art/`。MOCK 不上画面。

| 台账 id | 主体 | 英文提示词（4-10 词·喂生成） | spec | 优先 | 锚 |
|---|---|---|---|---|---|
| **A-BG-01** | 主菜单背景 | `luxe mansion night parlor, floor-window city glow, warm bokeh, empty` | 1280×720 | **P0** | modern-manor |
| **A-BG-02** | 牌桌场景背景 | `mahogany card room, night, warm downlight, marble floor, deep vignette` | 1280×720 | **P0** | modern-manor |
| **A-FELT-01** | 酒红牌呢桌面纹理 | `deep wine felt table texture, subtle gold rim, soft center light` | 900×380 | P1 | modern-manor |
| **A-CARD-BACK** | 夜宴牌背 | `art-deco card back, cinnabar and gold filigree, dark, symmetric` | 168×240 | P1 | apollo-toon |
| **A-CARD-JOKER-R/B** | 大/小王面 | `ornate joker card, red/black, gold crown motif, night palette` | 168×240 | P1 | apollo-toon |
| **A-LOGO-TITLE** | 「掼蛋夜宴」标题字 | `chinese calligraphy logotype, gold on wine, 3d bevel, banquet` | 680×180 | **P0** | apollo-toon |
| **A-ICON-PACK** | 图标集（见 §4b） | 逐图见 §4b（金币/级牌/名次/墩型/菜单/记牌/复制/警示/箭头） | 各 48×48 | P1 | apollo-toon |
| **A-FX-WIN** | 通关/胜利演出 | `golden confetti burst, silk ribbons, warm glow, celebratory` | 序列/贴图 | P1 | apollo-toon |
| **A-FRAME-ORN** | 装饰边框（立绘框/席位/结算卡） | `carved gold banquet frame, thin, corner ornament, dark inset` | 9-slice | P2 | apollo-toon |

（人物类 A-CHAR-HERO / A-CHAR-NPC / 5 档服饰 = **本台本删除**·归外部角色卡 + v2 后启。）

## 3. 牌面方案（外围打牌核心 · 现 55 张真图闲置）

**现状（子代理普查·headline）**：`public/games/game-a/art/cards/` 有 **52 面 + 2 王 + 1 牌背** 真 SVG/PNG（PD·已 vendor·`index.json` 55 条 filled），但 **0/55 上画面**——`hud.ts` 全用 `PlayingCard face:'light'` **文字牌**（点数字形 + 花色符号画在白渐变上）；`theme.cardAssetUrl`/`CARD_BACK_ID` 已备且单测过，**零调用点**。牌背 `back.png` + 双王 SVG 全休眠（王现为文字「小王/大王」+ 字形 🂿/🃏）。

**方案（demo·二选一·PE 可即改）**：
- **A｜接线真图（推荐·出效果快）**：`PlayingCard` 消费 `cardAssetUrl(code)`（或加 `Image` 牌面层）→ 55 张真牌上桌；牌背/双王接 `back.png`/joker SVG。**级牌/逢人配高亮 = 运行时描边流光叠加**（不烤进牌面·A-CARD-FACE 台账口径）。
- **B｜保留文字牌 + 夜宴描边**：文字牌白底与酒红 felt 冲（A-007 已记）→ 给牌加暖金描边/圆角阴影、级牌镶金边，弱化白。
- ⚠ **真图白底同样与深酒红 felt 撞色**：接线后若太亮，台账重绘夜宴版牌面（二次元·非阻塞）或运行时压一层暖色蒙版。demo 先接 PD 真图看整体，再决定重绘。

## 4. 全部按钮 & UI 处理表（owner 要的「按钮整理」）

### 4a. 按钮总表（每屏·id · label · 现 kind → 目标处理）

> **核心问题（§5-1）**：主 CTA 全用 `kind:'primary'`，共享渲染器把 primary 画成**翡翠**（jade 字 + jadeWash 底）——夜宴的招牌**金色 CTA 缺席**。蓝本主按钮 = 米金渐变 `#f0c96a→#d3a247` + 深字 `#241009`（= 引擎 `kind:'hero'`·现从未用·hud 注「hero 金字金底糊」）。**目标：主 CTA 走金**（hero kind 若糊则报 PUI·见 §5）。

| 屏 | id | label | 现 kind → 渲染 | 目标 |
|---|---|---|---|---|
| SC-1 | `a-menu-start` | 开始上桌 | primary → **jade** | **金 CTA**（招牌·最大按钮） |
| SC-1 | `a-menu-resume` | 继续上局 | ghost | ghost（无存档=同 start·或灰禁用更诚实） |
| SC-1 | `a-menu-settings` | 设置·规则 | ghost | ghost |
| SC-2 | `a-sel-seat` | 入座开局 | primary → jade | **金 CTA** |
| SC-2 | `a-sel-back` | 返回 | ghost | ghost |
| SC-3 | `a-p-commit` | 出牌 | primary → jade | **金 CTA**（压不过时降 ghost·现有逻辑保留） |
| SC-3 | `a-p-pass` | 过 | quiet / **primary+glow**(压不过) | 压不过=金 CTA+呼吸（现逻辑对·随金修一致） |
| SC-3 | `a-p-hint` | 提示 | ghost | ghost |
| SC-3 | `a-p-counter` | ▤ 记牌器 | quiet | quiet + 图标转真图（§4b） |
| SC-3 | `a-p-menu` | ☰ 菜单 | quiet | quiet + 图标转真图 |
| SC-3 | `a-p-back` | 返回 | ghost | ghost |
| SC-4 | `a-r-next` | 下一盘 | primary → jade | **金 CTA** |
| SC-4 | `a-r-home` | 回主菜单 | primary → jade | **金 CTA** |
| SC-4 | `a-r-copylog` | 📋 复制本盘记录 | ghost | ghost + 图标转真图 |
| 菜单 | `a-menu-log-copy` | 📋 复制本盘记录 | quiet | quiet + 图标 |
| 全局 | `*-lang-en/zh` | EN / 中 | primary(档)/ghost | 保持（段控·当前档高亮）·勿混金 CTA |
| 段控 | `a-sel-diff` `a-sel-stake` `a-p-sort` | 难度/底注/理牌 | jade-active | 保持 |

### 4b. 图标集（emoji → 真图·A-ICON-PACK·统一走 `theme.emoji` 皮）

> **问题（§5-3）**：无 `theme.emoji` 皮 → 💰🏆🎴📋☰▤▼⚠🃏 全渲染系统 emoji，混在雕琢的金/serif chrome 里出戏；**金币图标还内部不一致**（SC-1 用 `◉`，选桌/牌桌/菜单用 `💰`）。

| 图标 | 现字形 | 出现处 | 目标 |
|---|---|---|---|
| 金币 | `◉` / `💰`（**不一致**） | `a-menu-player-money`(◉) · `a-sel-buyin-v` `a-p-wallet` `a-menu-set-wallet`(💰) | **统一**一枚夜宴金币图标 |
| 名次奖杯 | `🏆` | `a-p-holder` 暂大 | 金奖杯图标（或并入「谁大」箭头·§5-8 去重） |
| 进贡 | `🎴` | `a-p-tribute` | 礼盒/牌图标 |
| 复制 | `📋` | 复制记录按钮 ×2 | 剪贴板图标 |
| 菜单 | `☰` | `a-p-menu` | 汉堡图标 |
| 记牌器 | `▤` | `a-p-counter` + 立绘占位 icon | 计数板图标 |
| 谁大箭头 | `▼` | `a-p-bigarrow-a` | 弹簧箭头（+scale 弹跳·A-011 已报 PUI） |
| 警示 | `⚠` | 宗师偷看 hint | 警示图标 |
| 花色/王 | `♠♥♦♣` `🃏🂿` | 规则表 / 日志 / 王牌 | 与真牌面同源花色 |

## 5. 外围打牌优化清单（分三类 · 可执行）

> 子代理普查出的 12 处糙点 → 按「谁改」分类。**多数是 PE 代码即改·当天出效果**，无需等美术。

**【A｜PE 可即改·代码·当天见效】**
1. **接线 55 张真牌面 + 牌背 + 双王**（§3·`cardAssetUrl` 已备·最大观感提升）。
2. **主 CTA 转夜宴金**（§4a·若 game 层能用 `kind:'hero'` 直接换；渲染糊则报 PUI）。
3. **背景统一**：SC-1 现用 hud-local `MENU_BG`（`radial 78%,30%`），SC-2/3 用 theme `MANOR_BG`（`50%,18%`）——两张不同豪宅底 → **统一走 MANOR_BG**（或 A-BG-01 就位后统一换）。
4. **对手身份色接线**：蓝本定义 **陶橙 `#e08a5a`** 为对手色，现对手 tag 灰(normal) + 环红——不一致 → 对手统一陶橙（tag+环），队友保翡翠。
5. **去重「谁大」标记**（§5-8）：`🏆` 名前缀（`a-p-holder`）与浮动 `▼` 箭头（`a-p-bigarrow`）重复指同一态 → 留弹簧箭头一处。
6. **硬编码 custom 渐变收敛**：`a-menu-level-v`/`a-seat-*`/`a-seat-*-ring`/`a-p-info`/`a-p-tribute`/`MENU_BG` 等一次性 `{custom}` → 尽量归主题令牌/预设（便于换皮·保留 FELT_RED/MANOR_BG 合法者）。
7. **金币图标统一**（§4b·`◉`→`💰` 或反之·先统一字形·真图待台账）。
8. **标题字体统一**：SC-2/SC-4 标题的 `elegant`(Playfair·latin-only) → `serif`(Noto Serif SC·真 CJK)，三屏标题一家。
9. **头像首字对比**：占位首字现 `sub #c3b39c` 画在 `bg3 #37271a` 上偏暗、下方名却 gold → 首字提亮/加权重（占位期观感·真头像来自卡后此条自然消解）。

**【B｜需生成·台账·喂管线】**：A-BG-01/02 背景、A-FELT 桌纹、A-CARD-BACK 牌背、双王、A-LOGO-TITLE 标题字、A-ICON-PACK 图标、A-FX-WIN 演出、A-FRAME 边框（§2）。

**【C｜报 PUI·src/ui 缺口】**：
- `kind:'hero'` 金 CTA 渲染「糊」（金字金底 1.05）——若要招牌金按钮，报 PUI 修 hero 档渲染（对比度/描边）。
- `theme.emoji` 图标皮槽——LayoutNode 要能挂图标资产集（现无 → 图标只能 emoji 或 Image 硬塞）。
- `elegant` 字体 latin-only——若要 CJK 优雅标题字，报 PUI 补 CJK display 字族。
- 弹簧箭头 scale 弹跳（A-011 已报）· 扇形/旋转卡 audit 盲区（A-007 已报）。

## 6. Demo 两天排期

**Day 1（PE 代码·当天出效果·不等美术）**：§5-A 全部——接 55 牌面 + 金 CTA + 背景统一 + 对手陶橙 + 去重箭头 + 渐变收敛 + 图标/字体统一。**门禁全绿 + 截图对比**。同时**起台账**：A-BG-01/02 + A-LOGO-TITLE + A-CARD-BACK 先出「定调图」喂管线。
**Day 2**：台账「⚡一键全量」出背景/牌背/logo → 接线换装（编译期线别名登记·玩法零改）；A-ICON-PACK + A-FX-WIN 有余力则上；报 PUI 的 §5-C 缺口列单等裁决（不阻断 demo·占位不降格）。

## 7. 落地路径（编译期美术线 · art-pipeline §编译期）

- **三行接入**：theme 定 skinKey → 蓝图/hud 视觉实体加 `Sprite/Image{textureKey}`（**与现渲染并存**·未就绪回退观感零变）→ 照样板写 requirements 推导。mount 拉本地 `art/index.json` 注册 AssetManager。
- **写回**：不钉 manifest——按 skinKey **别名登记**进 `art/index.json`，资产就绪自动换装；**绝不改蓝图代码换皮**。
- **红线**：禁纯色块（视觉实体必带皮槽）· MOCK 不上画面（无 key=探针·不静默顶替）· 写回过校验门 · 台账编号 append-only。
- 查不到的做法 → `requests.md` 提缺口等裁决，绝不自造旁路。
