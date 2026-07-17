# Game C ·《六人德州》美术台本 v1（1:1 复刻 Cloud Design · 台账建行底稿）

> GD-C · 2026-07-17。依据：`cloud-design/` 交付包 + `art-data-manual.md` + requests.md **REQ-C-ART-美术拍板包/修订①/owner 终字**。
> **双风格锚**：人物线=`sakura-nijigen` · 场景线=`vegas-victoriana`——台账**行只引风格包 id 不手抄锚文**（脚本拼接·防漂移）。
> **人物行 prompt 硬约束（行级写死）**：成年角色明示 · 着装完整 · 不露骨 · no text, no watermark。
> 尺寸=Cloud Design 基准；**建行前向 P3D 要俯视角消费分辨率口径**（拍板包⑤）。台账脚本照 game-d 样板（`scripts/game-c-art-ledger.mjs` 拟·mergeLedger 保号）。

## 一、五姨太人设五案（owner 终字：GD-C 按 sakura-nijigen 自设·性格对位=拍板包②固定）

| 座位 | 名 | 人设 | 策略模板 | 口头禅 | 头像 prompt 人设要素（EN·脚本再拼锚+硬约束） |
|---|---|---|---|---|---|
| P1 | 大姨太·沈玉容 | 淑女·端庄礼致 | 紧凶 | 「规矩，不能乱。」 | dignified first madam, elegant chignon, jade hairpin, composed gaze, adult woman, modest qipao fully clothed |
| P2 | 二姨太·金曼芝 | 富饶雍贵·珠光宝气 | 松凶 | 「小钱而已，跟了。」 | opulent second madam, gold jewelry, peony hair ornament, confident smirk, adult woman, luxurious dress fully clothed |
| P3 | 三姨太·白静漪 | 冷静·静水深流 | 岩石 | 「急什么。」 | serene third madam, sleek hair, pale elegant features, calm unreadable eyes, adult woman, plain refined dress fully clothed |
| P4 | 四姨太·苏甜甜 | 清纯可爱·天真烂漫 | 跟注站 | 「我就看看嘛。」 | sweet innocent fourth madam, round sparkling eyes, soft blush, braided hair ribbon, adult woman, cute modest dress fully clothed |
| P5 | 五姨太·柳月眉 | 狡猾狡诈·笑里藏刀 | 诈唬狂 | 「你猜呀。」 | sly fifth madam, fox-like narrow smile, crescent brows, playful sidelong glance, adult woman, stylish dress fully clothed |

- **表情 4 态/人**：常态 idle · 懊恼 vexed · 胜利 win · 犹豫思考 think（owner 口径「三种表情」——首批目检后定 3 或 5 态，行先按 4 态建）。
- 命名可由 owner 改（对位与人设锁定）；口头禅供 UI 气泡/演出文案用。

## 二、台账行清单（首版 ≈122 行 = 拍板包⑤快照 116 + 主角衣物 6（GD-C 补记·报 Lead/PA 增列））

### 人物线（行引 `sakura-nijigen`）

| 编号段 | 内容 | 规格 | 行数 | 状态 |
|---|---|---|---|---|
| `C-AVA-P{1..5}-{idle,vexed,win,think}` | 五姨太头像 4 态（§一 prompt 要素） | 方形·分辨率待 P3D 口径（Cloud Design 基准：圆框内切） | 20 | needs-art |
| `C-CHAR-HERO` | 主菜单主角立绘（tailored suit·waist-up） | 300×440 竖 3:4 | 1 | needs-art |
| `C-WARD-P{1..5}-{1..6}` | 姨太衣物图标·**个性化只画物件不画人身**（样式随各人设：如玉容=头面/披风/绣鞋…曼芝=金镯/璎珞…） | 128×128 透明 | 30 | needs-art |
| `C-WARD-HERO-{1..6}` | 主角衣物图标（男装六件：袖扣/怀表/领带/马甲/外套/衬衫） | 128×128 透明 | 6 | needs-art（快照未含·补记） |

### 场景线（行引 `vegas-victoriana`）

| 编号段 | 内容 | 规格 | 行数 | 状态 |
|---|---|---|---|---|
| `C-CARD-{52+back}` | 牌面 52 + 卡背 | vendored PD（`art-placeholders.md`） | 53 | **replaced**（不进生成预算） |
| `C-CHIP-{25,50,100,500,1000}` | 筹码面额贴图（贴 3D 圆柱面） | 圆形 | 5 | 货架 CC0 先用·风格化重绘 pending |
| `C-FELT-01` | 桌呢绒面（深呢绒绿+金边·manual §1） | 平铺 | 1 | needs-art |
| `C-BTN-D` | 庄家按钮 D | 圆片 | 1 | needs-art |
| `C-FRAME-AVA` | 头像金边框（manual §3 圆头像配方） | 方/圆 | 1 | needs-art |
| `C-BG-01` | 主菜单背景（walnut card-room, warm evening, bokeh） | 1280×720 | 1 | needs-art |
| `C-ROOM-{floor,wall,lamp,misc}` | 房间件贴图 ≈4 | 平铺 | ≈4 | needs-art |
| 凳 / 墙 / 地 程序化 | 盒庭几何生成 | — | 0 | **免槽例外=Lead 已准** |

### 挂起段（不建行）

- `C-CHAR-P{1..5}` 分层立绘（典当换装表现）——**挂起**，见 requests.md `REQ-C-立绘换装`（前置：分级口径/成年人设明示/层规格 spec/合规 prompt）。本期口径：头像不随典当变化（衣柜清单置灰+件数徽章）。

## 三、视觉常量与衣物面值（指针·不手抄防漂移）

- 色板/字体/组件配方/动效 → `art-data-manual.md` §1-4（**唯一权威**）；布局锚点/3D 映射/信号表 → 同 §5 + `ui-brief.md`。
- 衣物**面值**六档不变（GDD §3.5：100/150/200/500/500/1000·总 2450）；**件目名**个性化随人设（本台本 §二 编号即件位，显示名建行时随人设卡填）。

## 四、⚠ 程序 1:1 复刻铁律（owner 口径·抄送 PE-C）

1. `cloud-design/*.dc.html` 是**视觉验收基准**——最终画面以与它 1:1 对齐为目标（色/字/布局/动效基调）。
2. **实现禁止直接挪用该 HTML/CSS/JS**：界面全部用 **LayoutNode 控件闭集**重做（映射表=manual §5.4 + ui-brief §3）；色值走主题/custom 填充；动效对 `LayoutNode.fx` 闭集近似，缺 kind → requests.md 报 PUI，绝不手写逃生。
3. 3D 层照 manual §5.3 组件映射（盒庭线现货件·render-only）；台账真图未产出前程序化回退（观感承诺同 game-q/t）。
