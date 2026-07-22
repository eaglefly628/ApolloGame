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
| A12 | **筹码贴图 ×9 面额** | 贴 3D 筹码柱侧/顶面 | 256² png ×9 | 分面额配色但**统一夜金边框**·防花 |
| ~~A11 牌背 / A13 牌面 52~~ | — | ~~PlayingCard.backArt/art~~ | **移出台账**（owner 2026-07-22·见下 §扑克牌） |

### B档 · 外部传入（**我方不出图**）

| # | 面 | 来源 | 已接？ |
|---|---|---|---|
| B1 | 立绘·陆时衍/谢经理/柯女士/林晚 | **平台角色卡 `Avatar.src`**（REQ-CHARCARD 已接） | ✅ 传进即显·`media.imageUrl` |

### C档 · 货架现货可 vendor（不定制就用这个·省工）

| # | 面 | 货架 id | 授权 |
|---|---|---|---|
| C3 | 9 面额筹码 | `chip/*` | CC0 |
| C4 | 庄家钮 D | 程序圆片 或 `Decal3D` | — |

> **⛔ 扑克牌（52 牌面 + 牌背）= 引擎渲染原语·移出美术台账（owner 2026-07-22）**：`PlayingCard` 组件自绘牌面（红黑角标点数 + 中央花色）与牌背（`backPattern` 程序纹理），**不入 `art-ledger.json` 也不入 `index.json`，无任何贴图**。此前 vendored 全副 PD 牌 SVG（自带角标）叠在组件角标上 → 牌面「双重」重影；且扑克牌本身无美术修饰需求。将来若真要夜金定制牌面/牌背，走 `requests.md` 重开（重开时同步：ledger 脚本 ③ 段 + index.json + `cardNode` 接 art/backArt）。对手底牌指示也用 `PlayingCard` 牌背原语（在局=棋盘格微扇 / 弃牌=斜纹歪斜暗淡 muck）。

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
2. **接槽**（占位回退·观感零变）：字体槽(Bebas/Cinzel) → buttonSkins → Material3D.map(呢面/木栏) → setBackgroundTexture；同时落机读账 `art-ledger.json`。（~~PlayingCard.backArt~~ 扑克牌已移出台账·见 C 档下方铁律。）
3. **出图**：A档=平台一键全量（风格包=§1）；A′档=owner AI 出图别名写回。
4. **验收**：`visual-scorecard` 8 维·premium=全维≥2。

**域边界**：呢面/木栏 `Material3D` + 隐形碰撞 = **P3D 域**（提缺口协调）；`buttonSkins` 槽 = **PUI 域**（消费）；出图 = **asset-manager/PST 平台**；立绘 = **外部角色卡**；**扑克牌 = 引擎 `PlayingCard` 原语·不出图不接槽**（见 C 档铁律）。

---

## §7 动效台账（owner 2026-07-21「增加很多动效」·专业德州视角·**全走引擎数据化 fx·零手写 CSS**）

> 铁律：动效=引擎闭集 fx 数据（`fx:[{kind}]` / `layout.flyTo` / `Label.tween` / `Particles` / `PlayingCard.flipped` / `anim` / `ProgressBar.shape:'ring'` / 3D `Vfx3D`·`Material3D.uvAnim`）。**缺 juice → requests.md 加一个 kind/字段，绝不手写 CSS/setTimeout 动画**（手册 ui.md）。纯表现·不进 sim hash。

### A · 发牌 / 揭示（deal & reveal）
| 时机 | 动效 | 引擎能力 | 现状 |
|---|---|---|---|
| 开局发底牌 | 牌从荷官位飞向各座（错峰） | `layout.flyTo{to,ms,arc,delay}` 逐张错峰 | 待接 |
| 主角看底牌 | 底牌翻起 | `PlayingCard.flipped`（绕 Y 真 3D 翻） | 待接 |
| 翻牌 flop | 3 张翻开·错峰 + 金光 | `flipped` + `fx:[{kind:'glow',color:'gold'}]` 错峰 delay | 待接（现直显） |
| 转/河 turn/river | 单张翻 + 流光 | `flipped` + `fx:'sheen'` | 待接 |
| 街切换 | 公共牌区呼吸一下 | `fx:[{kind:'pulse'}]` | 待接 |

### B · 下注 / 筹码（betting & chips）
| 下注 | 3D 物理筹码抛向池 | `chip3d.throwBet`（RigidBody3D+Impulse） | **✅ 已有** |
| 筹码落定 | 落点火花/微尘 | 3D `Vfx3D` 发射器（fx 台账 `game-c/fx/chip-spark`） | 待接 |
| 底池累加 | 数字滚动上跳 | `Label.tween{from,to,ms}` + `format:'compact'` + `fx:'pop'` | 待接（现直改） |
| 收池 | 池筹码飞向赢家 | `layout.flyTo`（池→赢家席） | 待接 |
| 赢家筹码堆增长 | 堆升高 | `chip3d.setStack`（已有·可加 `pop`） | ✅ 部分 |
| All-in 推入 | 红闪 + 抖 + 全推 | `fx:[{kind:'flash',color:'danger',once},{kind:'shake'}]` + `game-c/fx/allin-flash` | 待接 |

### C · 轮转 / 状态（turn & state）
| 轮到谁 | 席卡呼吸金光 | `fx:[{kind:'pulse'},{kind:'glow',color:'gold'}]` | ✅ 有 glow·加 pulse |
| 读秒 | 头像环形倒计时 | `ProgressBar.shape:'ring'`（现直条·换环） | 待接（现直条） |
| 行动气泡出现 | 状态牌弹入 | `fx:[{kind:'pop'}]` | 待接 |
| 弃牌盖牌 | 底牌滑走淡出 | `anim:'popOut'`/`fadeOut` | 待接 |
| 庄家钮移动 | D 滑向下一座 | `layout.flyTo` | 待接 |

### D · 结算 / 演出（showdown & win）
| 逐家亮牌 | 依 last-aggressor 顺序翻 | `PlayingCard.flipped` 错峰 | ✅ 顺序有·翻待接 |
| 最优组合高亮 | 5 张脉冲圈入 | `fx:[{kind:'pulse'},{kind:'glow',color:'gold'}]`（现静态金边） | 待接 |
| 赢家庆祝 | 撒金币/彩带 + 光环 | `Particles{kind:'coins'/'confetti'}` + `game-c/fx/winner-ring`/`win-burst` | 待接 |
| 局终屏 | 砸入 + 胜=彩带/负=灰烬 | `fx:'pop'` + `Particles{kind:'confetti'/'stars'}` | 待接 |

### E · UI / 转场（UI & transitions）
| 按钮按压 | 下沉反馈 | `layout.press3d` + `fx:'ripple'` | ✅ press3d 有 |
| 屏切换 | 菜单↔牌桌 / 模态进出 | `anim:'fadeOut'/'popOut'` + panel-action-fade | 待接 |
| 加注滑杆 | 值滚动 | `Label.tween` on raiseValue | 待接 |
| 搭档旁白 | 台词打字机 | `Label.typewriter` | 待接 |
| 立绘反应 | 对手立绘轻摇（赢/输/偷鸡） | `fx:[{kind:'float'}]`/`shake`（剧情反应） | 待接 |

### F · 氛围（ambient·低频循环）
| 呢面暖光呼吸 | 桌心光池微脉 | 3D `Material3D.uvAnim` 或 Light3D 脉动 | 待接 |
| 背幕夜景闪烁 | 城市灯火微闪 | `bgScroll` 或背幕帧动 | 待接 |

**接入优先级（ROI）**：①翻牌/发牌 flip+flyTo（最有牌感）→②底池 count-up + 收池 flyTo →③赢家 Particles 庆祝 →④active pulse + 读秒环 →⑤All-in flash/shake →⑥氛围。**全部数据化 fx·缺 kind 提 requests**。对应**需美术的** fx 精灵 = §3/机读账 `game-c/fx/*` 6 张（chip-spark/allin-flash/win-burst/winner-ring/deal-glow/pot-shine）；其余（count-up/flyTo/flip/pulse/Particles）**零美术**（引擎程序化）。

---

## §6 机读账（下一步接槽时落）

`public/games/game-c/art/art-ledger.json`（结构照 game-b/game-g）：每面一行 `{no,skinKey,kind,slot{entity,component,field},query(§1前缀+主体),prompt(中),spec,status}`。本台本 §3 A/A′ 档=待落行；B/C/D 档不占定制账（B 外部·C vendor·D 无美术）。
