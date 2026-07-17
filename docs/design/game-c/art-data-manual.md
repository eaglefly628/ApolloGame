# 夜宴系 · 美术数据与交付手册（Game C 六人德州 / 掼蛋夜宴）

> **GD-C 录档（2026-07-17·Cloud Design 交付包·美术数据唯一权威）**
> 配套可运行界面稿在 `cloud-design/`（原名→录档名）：六人德州布局设计→`layout-boards.dc.html`（5 画板+工程标注层）·
> 六人德州主菜单→`main-menu-texas.dc.html`·掼蛋夜宴主菜单→`main-menu-guandan.dc.html`（含风格速查板）·`support.js`（画布运行时·生成物勿改）。
> 打开方式：`.dc.html` 与 `support.js` 同目录浏览器直开。掼蛋主菜单稿供 game-a 取用（跨游戏夜宴系规范·GD-A 自取）。
> **⚠ 程序接线铁律（owner 口径）**：`.dc.html` 只是**视觉基准（1:1 复刻目标）**——实现必须用 **LayoutNode 控件闭集重做**（映射表=`ui-brief.md` §3 + 本手册 §5.4），**禁止直接挪用这些 HTML/CSS/JS**；动效对 LayoutNode.fx 闭集近似，缺 kind 提 PUI，绝不手写逃生。
> **口径修订两处（录档后于本手册正文·以此为准）**：① §6 的 `C-CHAR-P1…P5` 分层立绘=**挂起**（requests.md `REQ-C-立绘换装`·owner「先记需求外面再做」·本期头像不随典当变化）；② 人物线（头像/立绘/衣物图标）风格锚改用 **`sakura-nijigen`**、场景线保留 vegas-victoriana（requests.md REQ-C-ART 修订①双锚制）——正文 §1 色板仍是**界面 UI** 唯一权威。
>
> 交付对象：程序 + 策划 · 参考用 · 2026-07-17 · Claude Design
> 本包含：3 份可运行界面文件（`.dc.html`，浏览器直接打开）+ 本手册（美术数据）+ 原始 brief。
> 所有界面同属一套「夜宴系」视觉规范；程序接线时以此手册的常量为准。

---

## 1. 色板（照抄十六进制 · 跨三款统一）

| 角色 | 名称 | 值 | 用途 |
|---|---|---|---|
| 背景底 | 暖夜黑 | `#160e0a` / `#0d0806` | 页面/画板最底色 |
| 背景光晕 | 胡桃暖棕 | `#33221a` / `#31201a` / `#2a1a12` | 径向渐变高光 |
| 面板 | 深胡桃 | `#1e140e` → `#160f0b` | 卡片/按钮底（线性渐变） |
| 强调（主） | 朱砂红 | `#c8352b`（备选 `#cf3b2e`） | 标题「夜宴」、级牌、ALL-IN、警示 |
| 金（主 CTA / 大数字） | 米金 | 渐变 `#f0c96a` → `#d3a247` | 主按钮、金钱 Badge、POT、筹码数 |
| 金（描边/次要） | 浅金 | `#ecca8a` / `#e0b458` / `#d8b878` | 次级按钮、标题描边、桌边金圈、级牌数字 |
| 正文 | 米白 | `#f3ece0` | 主要文字 |
| 弱文 | 灰驼 | `#b8a894` / `#8a7862` | 副标题、注释、版本号 |
| 队友 / LayoutNode 标注 | 翡翠绿 | `#7fd6b0`（衬底 `#0e2620`） | 队友 Tag、行动座位高光、控件标注 |
| 对手 | 陶橙 | `#e08a5a`（衬底 `#5a1a12`） | 对手 Tag |
| 牌桌呢绒 | 深呢绒绿 | `#166f4f` → `#0e5540` → `#093a2c` | 3D 桌面（配金边 `rgba(224,180,88,*)`） |
| 牌面红 | 桃心方块红 | `#c0392b` | 扑克红花色 |
| 出局/禁用 | 冷灰 | `#8a8a94` / `#55555f`（+`grayscale`） | 已弃/出局座位、已典当件 |

边框统一：`1px solid rgba(224,180,120,.25~.4)`（金色低透明）。

### 工程标注四色（仅布局图纸用，出货可关）
| 类别 | 色 |
|---|---|
| LayoutNode 控件 | 翡翠 `#7fd6b0` |
| 3D 组件 | 朱砂 `#c8352b` |
| 百分比锚点 | 金 `#ecca8a` |
| 写世界信号 | 绿 `#34d378` |

---

## 2. 字体

- **标题 / 艺术字 / 序列名**：`Noto Serif SC` 900，字距 `letter-spacing:2~8px`。
- **大数字 / HUD 数值**：`Bebas Neue`（POT、筹码、倒计时）——紧凑高辨识；正文标签 `Oswald` / `Noto Sans SC`。
- **正文 / UI**：`Noto Sans SC` 400/600/700。
- **工程标注**：`Share Tech Mono`（仅图纸标注层）。
- 载入：`Noto+Serif+SC:700;900` + `Noto+Sans+SC:400;500;700` + `Bebas+Neue` + `Oswald` + `Share+Tech+Mono`。

标题描边（照抄）：
```css
color:#f3e6cf; text-shadow:0 3px 0 #7a1a12, 0 6px 20px rgba(0,0,0,.6);
```
双色标题：主体米白 `#f3e6cf`，关键词朱砂 `#c8352b`（如「德州**夜宴**」）。

---

## 3. 组件配方（跨游戏统一）

**主 CTA 按钮**
```css
font:700 18px 'Noto Serif SC'; letter-spacing:3px; color:#241009;
background:linear-gradient(#f0c96a,#d3a247); border:none; border-radius:12px;
padding:15px 0; box-shadow:0 5px 16px rgba(0,0,0,.45);
/* hover: brightness(1.08)+translateY(-2px); active: translateY(1px) */
```
**次级按钮**
```css
font:700 16px 'Noto Serif SC'; letter-spacing:3px; color:#ecca8a;
background:rgba(30,20,14,.85); border:1px solid rgba(216,184,120,.4);
border-radius:12px; padding:13px 0;
```
- **金钱 Badge**：`◉` + 数字，`linear-gradient(#f0c96a,#d8a94e)` 底、深棕字 `#241009`、圆角 14px。
- **圆头像**：`linear-gradient(145deg,#5a3d2e,#39251b)` 底 + `2px solid #d8b878` 金边，内嵌 `Noto Serif SC` 单字。
- **身份 Tag**：队友=翡翠底 `#0e2620`/字 `#7fd6b0`；对手=陶橙底 `#5a1a12`/字 `#e08a5a`；圆角 8~10px，10~11px 字。
- **占位台账框**：金色虚线 `1.5px dashed rgba(216,184,120,.55)` + 45°斜纹底 + 居中【图标▤ / 标题 / 尺寸胶囊 / 英文提示词 / 风格锚】，左上角编号（如 `C-CHAR-HERO`）。

---

## 4. 动效基调（克制）

| 名 | 时长 | 用途 |
|---|---|---|
| `twinkle` | 2.4~4.5s | 背景金色星点明灭 |
| `bob` | 3s ±5px | 气泡/提示（如红包气泡） |
| `glow` | 2.4s | 级牌/盲注/焦点金光呼吸 |
| `neon`(柔光版) | 3~3.4s | 序列标题金/朱砂柔光（非霓虹） |
| `stoolGlow` | 1.6s | 当前行动座位凳前翡翠微光 |
| `dealIn` | .6s | 发牌/公共牌入场 |
| `flyChip` | .8s | 下注筹码抛入底池 |

主按钮无常驻动画，仅 hover/press。设置内「简化特效」总开关 → 关闭星点/呼吸类动画降档。

---

## 5. 牌桌主对局（Game C）美术 + 布局数据

### 5.1 屏幕分区（百分比锚点 · 固定相机=固定屏幕常量）
- 顶带：`top:0`，高 `12%`（86px）——左盲注牌、中 POT、右菜单/声音。
- 底带：`bottom:0`，高 ≈ 172px——左主角位、中底牌+牌型、右行动条。
- 3D 视口：全屏打底，固定斜俯视相机 `pitch≈46°`（不切换）；桌居中偏上，`perspective:1350px`，`perspective-origin:50% 30%`。

### 5.2 座位屏幕锚点（座位卡中心，%）
| 座位 | 方位 | left | top |
|---|---|---|---|
| P0 主角 | 正南（底中） | 底带左区 | — |
| P1 大姨太 | 东（右） | 87% | 38% |
| P2 二姨太 | 东北（右上）·当前行动 | 71% | 9% |
| P3 三姨太 | 西北（左上） | 22% | 8% |
| P4 四姨太 | 西（左） | 12% | 38% |
| P5 五姨太 | 西南（左下） | 20% | 66% |

座位环顺时针 东南→东北→北→西北→西南；6 张圆凳在 3D 平面上环桌，座位卡为屏幕锚定浮层（billboard）叠于凳投影上方。

### 5.3 3D 场景组件映射（盒庭线现货件）
| 件 | 组件 | 规格 |
|---|---|---|
| 相机 | `Camera3D` | ortho/透视 固定斜俯视 pitch≈46°，框住桌+六凳+溢出地板 |
| 牌桌 | `Mesh3D` box(圆角矮柱)+`Material3D` | 椭圆长桌 2.4×1.6，呢绒绿 `#166f4f→#093a2c`，木色包边+金圈 |
| 凳子 | `Mesh3D` ×6 | 圆柱矮凳；出局凳面变暗(grayscale) |
| 房间 | `Mesh3D` 地板+墙 + `Light3D` | 暖顶灯聚桌面、墙角暗；`Sky3D` 关 |
| 公共牌 | `Mesh3D` 薄片×5 + `Decal3D` | 桌心横排；未发=暗面；`dealIn` 滑弧+翻转 |
| 底池筹码 | `RigidBody3D`(cylinder) 堆 | 桌心偏北；下注 `Impulse3D` 抛入；收池推给赢家 |
| 座位下注区 | 各座位前小片 | 进街扫入底池 |
| 按钮标记 D | `Mesh3D` 小圆牌 | 随手轮转 |
| 焦点/收池 | `Glow3D` / `Post3D` | 行动者凳前微光、赢家聚光 |

### 5.4 UI 元素 → LayoutNode 控件 → 写世界信号
| 元素 | 控件 | 信号 |
|---|---|---|
| 座位卡 ×6 | Panel+Image+Label×n+衣物徽章 + Gauge(倒计时环) | 点卡 → `seat_view(座位号)` → 开衣柜 |
| 主角位 | 放大座位卡 | 同上（看自己衣柜） |
| 底牌区 | Panel+Image×2+Label(牌型) | 只读 |
| 行动条 | Button×3 + Slider(加注) + 快捷 Button(½/⅔/满池/全下) | `act_fold` / `act_check_call` / `act_raise(量)` |
| 行动倒计时 | Gauge(环，嵌座位卡) | 超时 → 自动弃/过 |
| 顶带盲注/POT | Panel+Label / Label(大字) | 无 |
| 顶带菜单/声音 | Button×2 | `menu_open` / `sound_toggle` |
| 衣柜面板 | Panel 两栏（左立绘区 / 右列表） | 自己行 → `pawn_item(件id)`；`panel_close` |
| 摊牌横幅 | Panel+Label+Image | 无（自动淡出） |
| 终局屏 | Panel 全屏 | `restart` / `exit` |

> UI 铁律：点击写世界一律 action 信号入队，零新控件（全部映射现有 LayoutNode 闭集：Panel/Label/Button/Slider/Gauge/Image）。

---

## 6. 立绘 / 美术资产台账（占位规格 · 待产出）

| 编号 | 名称 | 尺寸 | 英文提示词 | 风格锚 |
|---|---|---|---|---|
| `C-CHAR-HERO` | 主角立绘 | 300×440 竖幅 3:4 | protagonist, tailored suit, warm casino light, anime cel-shading, waist-up, confident, soft rim light | 二次元/柔光/暖夜/**不露骨** |
| `C-CHAR-P1…P5` | 姨太立绘（分层） | 同规格 | 逐件图层：底层剪影 + 可拆穿戴层（衣/头饰/配饰/鞋） | 同上；已当件对应层消失（**录档修订：挂起**） |
| `C-BG-01` | 主菜单背景 | 1280×720 | walnut card-room, warm evening, bokeh | 深胡桃基径向渐变 |
| 衣物图标 | 衣柜件图标 | 方形 | 旗袍/步摇/耳坠/绣鞋/披风/头面/玉镯… | 金饰质感，配面值 |

> 衣柜面板左栏=分层立绘区（面板宽 40%，竖幅 3:4），层图统一画布与锚点；未产出前用头像大图回退。尺度基线：不露骨（底层剪影/遮挡处理）。

---

## 7. 跨游戏复用清单

保持不变：**色板、双字体体系、金色 CTA + 胡桃描边次级、金币 Badge、金边圆头像、翡翠/陶橙身份色、占位台账框规范、克制动效**。
每款仅替换：序列标题（掼蛋夜宴 / 德州夜宴 …）、主角立绘占位内容、副标题定调句、背景径向渐变暖色微调（仍深胡桃基）、以及游戏专属 HUD（掼蛋=级牌位；德州=盲注/POT/行动条）。
