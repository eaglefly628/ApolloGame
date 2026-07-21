# Game C · STORY-POKER V2 美术台本（定版·2026-07-21）

> **权威**：本档=game-c 美术唯一台本。**取代**旧档 `art-placeholders.md` / `art-data-manual.md` / `art-script.md`（改版前绿呢/六人夜宴·已过期·勿再引）。
> **管线**：一律走「台账→皮肤槽→平台出图→别名写回自动换装」（`docs/playbooks/art-pipeline.md`）。代码零改换皮；机读账落 `public/games/game-c/art/art-ledger.json`（接槽时填）。
> **owner 2026-07-21 拍板**：牌桌=隐形 3D 碰撞 + 2D 贴图呢面 + 3D 物理筹码；立绘=**外部角色卡传入·我方不出图**；数字字体=Bebas Neue；牌背/筹码=owner AI 定制（**必须照 §1 统一风格**）。

---

## §1 统一风格锚（⭐最重要·所有定制美术钉这段·出图前必读）

**一句话**：奢华夜场德州 · 紫金 noir · 电影感 · 都市悬疑恋爱。

**AI 出图统一前缀（EN·拼进每个 query 前）**：
```
luxury night poker parlor, violet-and-gold noir, cinematic rim light, moody purple palette,
painterly premium mobile-game art, refined tasteful, dramatic depth, story-driven romance-thriller mood
```

**调色板（钉死·照 theme 令牌·勿漂移）**：

| 角色 | 十六进制 |
|---|---|
| 暗影/底 | `#0b070d` · `#1c1422` |
| 绒紫（呢面/主面） | `#7d5570`（中亮）· `#5a3a52` · `#38222f` · `#281620`（边暗） |
| 金（描边/高光/数字） | `#d8b878` · `#ecca8a` |
| 紫辉（辅光/搭档/加注） | `#c9a9dd` · `#b98fd6` · `#8a5fa8` |
| 粉（胜利/高光点缀） | `#e6a0c4` |
| 危险红（All-in/失败） | `#d0483e` · `#a01e3a` |
| 暖木（桌栏） | `#6a4c38` · `#3e2c1e` |

**母题**：落地窗夜景 + 城市灯火景深光斑 · 绒面 + 金边 · 旗袍/西装剪影 · 都市夜。
**光**：暖顶光池打桌心，冷紫环境补，边缘 rim light；整体低调高对比、电影感。
**材质**：绒（呢面天鹅绒织纹）· 哑光皮革（按钮）· 胡桃木（桌栏）· 磨砂金属（金边）。
**构图**：主体隔离、透明底（立绘/牌面）；桌面俯视椭圆；背幕横构图景深。
**禁忌**：❌高饱和土色/艳绿艳蓝 ❌卡通描边廉价感 ❌杂乱多主色 ❌白亮背景（永远暗夜紫底）。

---

## §2 牌桌架构（owner 定·三层）

1. **碰撞层**：3D 椭圆呢面 + 一圈围栏墙 = `Visibility:false`（**只碰撞·不渲染**·筹码落此不滚出）。
2. **视觉层**：一张 **2D 贴图呢面**（`Material3D.map`+`normalMap`·画死绒面 + 暖光池 + 桌栏）——比纯色 tint 好看得多。
3. **筹码层**：3D 物理筹码照用（落在碰撞面·越赢越高）。

---

## §3 可替换美术总清单（尽量全·按"谁出/出不出"分档）

### A档 · 我方定制出图（游戏专属 · 走平台一键全量 · 照 §1 风格）

| # | 面 | 消费槽位 | 规格 | 备注 |
|---|---|---|---|---|
| A1 | 夜景背幕 | `renderer.setBackgroundTexture` | 2048×1152 png | 落地窗+城市夜景+景深光斑（ROI 最高） |
| A2 | 呢面绒布 albedo | `Material3D.map` | 1024² png | 紫绒+桌心暖光池 |
| A3 | 呢面 normal（织纹） | `Material3D.normalMap` | 1024² png(线性) | 天鹅绒纹理立体 |
| A4 | 木栏 albedo | `Material3D.map` | 1024×256 png | 胡桃木+皮革软边 |
| A5 | 弃牌 按钮皮 | `theme.buttonSkins` 或 `Button.skin`（9-slice） | 280×88 | 哑光深皮+金边·中性 |
| A6 | 跟注/过牌 按钮皮 | 同上 | 280×88 | 金边·主操作 |
| A7 | 加注 按钮皮 | 同上 | 280×88 | 紫辉·进攻 |
| A8 | All-in 按钮皮 | 同上 | 200×72 | 红渐变·警示 |
| A9 | 菜单键皮（开始/继续/设置） | `theme.buttonSkins.hero/ghost` | 560×96 9-slice | 一套皮全菜单键 |
| A10 | 顶带「返回剧情」键皮 | `Button.skin` | 可选·小 | 幽灵键 |

### A′档 · owner AI 定制（你出图 · 照 §1 统一风格 · 我留槽自动换装）

| # | 面 | 消费槽位 | 规格 | 风格要点（必守 §1） |
|---|---|---|---|---|
| A11 | **牌背** | `PlayingCard.backArt` | 240×336 png | 紫绒底+金饰纹章·中央 logo·夜金 noir |
| A12 | **筹码贴图 ×9 面额** | 贴 3D 筹码柱侧/顶面 | 256² png ×9 | 分面额配色但**统一夜金边框**·防花 |
| A13 | 牌面 52（若要定制而非货架） | `PlayingCard.art` | 240×336 ×52 | 白牌面+紫黑花色变体·可选 |

### B档 · 外部传入（**我方不出图**）

| # | 面 | 来源 | 已接？ |
|---|---|---|---|
| B1 | 立绘·陆时衍/谢经理/柯女士/林晚 | **平台角色卡 `Avatar.src`**（REQ-CHARCARD 已接） | ✅ 传进即显·`media.imageUrl` |

### C档 · 货架现货可 vendor（不定制就用这个·省工）

| # | 面 | 货架 id | 授权 |
|---|---|---|---|
| C1 | 52 牌面 | `card/<rank>-of-<suit>` | PD |
| C2 | 牌背 | `card/back` | PD |
| C3 | 9 面额筹码 | `chip/*` | CC0 |
| C4 | 庄家钮 D | 程序圆片 或 `Decal3D` | — |

### D档 · 不需美术（程序/数据/引擎·别浪费美术工时）

- 面板/席卡/顶带/行动条**底色渐变** = LayoutNode 主题令牌（换皮改一份数据）
- 状态牌/圆点/徽章/进度条/滑杆 = 控件闭集程序化
- **最优组合高亮圈 / 选中环 / 落点** = `Decal3D{ring/disc}` 程序遮罩
- 桌心**暖光池/夜景灯光** = `Light3D` 程序灯
- 发牌/下注/翻牌/收池**动效** = 引擎能力
- 文字 = §4 艺术字体（字体资源·非贴图）
- 衣物件图标 ×6 = 现 emoji（可选升级真图标·低优先）
- 音乐/音效 = 声音数据（另条线·可后续换真录音）

---

## §4 艺术字体（UI 内嵌 OFL·拉丁字形·中文自动回退 Noto）

| 用途 | 选定 | 槽位 |
|---|---|---|
| **大数字**（筹码/底池/加注/盲注/夺回进度） | **Bebas Neue**（owner 定·高瘦筹码计数感） | `theme.fontDisplay` → `Label.font:'display'` |
| 拉丁标题/Logo（TEXAS·STORY） | **Cinzel**（罗马大写·赌场奢华） | `theme.fontSerif` → `font:'serif'` |
| 中文标题/正文 | Noto Serif SC / Noto Sans SC（拉丁字体不覆盖 CJK） | 现状 |

> 铁律：Label 只填枚举槽名（`'display'/'serif'`），绝不写自由 font-family。需在 `theme.webfonts` 加载 Bebas Neue / Cinzel。

---

## §5 接入顺序 + 域边界

1. **台本定版**（本档）
2. **接槽**（占位回退·观感零变）：字体槽(Bebas/Cinzel) → buttonSkins → PlayingCard.backArt → Material3D.map(呢面/木栏) → setBackgroundTexture；同时落机读账 `art-ledger.json`。
3. **出图**：A档=平台一键全量（风格包=§1）；A′档=owner AI 出图别名写回。
4. **验收**：`visual-scorecard` 8 维·premium=全维≥2。

**域边界**：呢面/木栏 `Material3D` + 隐形碰撞 = **P3D 域**（提缺口协调）；`buttonSkins`/`PlayingCard.art/backArt` 槽 = **PUI 域**（消费）；出图 = **asset-manager/PST 平台**；立绘 = **外部角色卡**。

---

## §6 机读账（下一步接槽时落）

`public/games/game-c/art/art-ledger.json`（结构照 game-b/game-g）：每面一行 `{no,skinKey,kind,slot{entity,component,field},query(§1前缀+主体),prompt(中),spec,status}`。本台本 §3 A/A′ 档=待落行；B/C/D 档不占定制账（B 外部·C vendor·D 无美术）。
