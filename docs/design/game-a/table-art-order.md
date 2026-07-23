# game-a《掼蛋夜宴》牌桌面 · 美术台账（art order）

> owner 2026-07-22 拍板：牌桌面=**长方形圆角**（退 2D 长方桌）。本页=该桌面的美术生产单，供工坊/美术出真图。
> 机读真相=`public/games/game-a/art/art-ledger.json`（本页人读摘要·数字/prompt 以台账为准）。
> **接入铁律**：真图入库（工坊 art-replace 按 **skinKey** 写 `index.json` 别名·或落 servedPath）→ mount 期 `loadArtOverrides` 拉到 → 消费点热替换上画；**真图未到=程序 SVG 占位兜底永不丢**（观感零字节变化）。render-only·不进 sim/hash。

## 主体：桌面呢面（tabletop felt）

| 字段 | 值 |
|---|---|
| **台账号 / 状态** | `art-03` · `pending-art`（待真图·当前程序 SVG 占位） |
| **消费槽 skinKey** | `game-a/felt/table`（`a-felt` 面板 bg·`theme.feltTexture()`） |
| **当前占位** | `felt/table.svg`（圆角矩形·酒红径向渐变 + 桌心光池 + 细金边） |
| **目标观感** | 长方形圆角（rx≈28·对齐面板）酒红**天鹅绒**呢面 + 跟随圆角矩形的**细金边框** + 桌心暖光池；夜宴华贵·深压四角暗角·**桌外透明** |
| **尺寸** | 1632×644 px（=面板 816×322 的 2×·长方比 2.53:1）·**透明 PNG** |
| **风格锚** | modern-manor 夜宴华贵（非写实赌场）·压深让白扑克不刺眼（A-007） |
| **Gen prompt（EN）** | top-down deep wine-red velvet felt card table surface, long rounded-rectangle shape, ornate thin gold trim following the rounded rectangle edge, soft warm central light pool, subtle plush velvet weave, luxurious chinese night-banquet mood, dark vignetted corners, transparent background outside the table, high resolution, clean game art |
| **Gen prompt（CN）** | 掼蛋夜宴·长方形圆角呢桌面·酒红天鹅绒 + 细金边框（跟随圆角矩形）+ 桌心暖光池·俯视·透明背景·高清 |

## 场景底：牌室背景（room behind·同屏·衬桌面）

| 字段 | 值 |
|---|---|
| **台账号 / 状态** | `art-02` · `pending-art`（待真图·当前程序 SVG 占位） |
| **消费槽 skinKey** | `game-a/bg/table`（`a-play` / `a-result` 屏满幅底图·`hud Screen.image`） |
| **当前占位** | `bg/table.svg`（径向渐变 MANOR_BG #4a3020→#160e0a） |
| **视角（关键）** | **俯视=正上方垂直往下看地面**（与桌面同机位·非平视墙面内景）——画的是**牌室地面**（大理石/木地板 + 地毯 + 地纹），**不是墙/灯笼/家具立面** |
| **目标观感** | 俯视深胡桃木/大理石牌室**地面**·桌心暖金光池 + 四周淡雅地毯/金地纹 + 柔反光·**中心留空给牌桌**·四角压深暗角；**虚化不抢桌面**（酒红桌 + UI 压在其上·地面只作氛围） |
| **尺寸** | 2560×1440 px（=屏 1280×720 的 2×·16:9 满幅）·**不透明**（满幅底图） |
| **风格锚** | modern-manor 夜宴华贵·与 SC-1 主菜单同调 |
| **Gen prompt（EN）** | top-down overhead view looking straight down at a luxurious chinese night-banquet card room floor, dark polished marble and mahogany wood flooring, warm golden light pool glowing at the center, faint ornamental rug and gold floor pattern around the edges, soft warm reflections, empty darkened center reserved for the card table, deep vignette toward the corners, moody opulent atmosphere, flat-lay top-down perspective, high resolution, painterly game background, no people, no furniture in center |
| **Gen prompt（CN）** | 俯视（正上方垂直往下看）·掼蛋夜宴牌室地面·深色抛光大理石 + 胡桃木地板·桌心暖金光池·四周淡雅地毯/金地纹·柔反光·中心留空给牌桌·四角压深暗角·华贵夜宴调·平铺俯视·高清·无人物·中心无家具 |

> **两图配合铁律**：**同一正上方俯视机位**——牌室地面（bg/table·俯视·压深虚化）+ 桌面呢面（felt/table·俯视·酒红实体）叠层，视角一致才不穿帮。背景**别画墙/灯笼/家具立面、别在中心画桌子**（会和 felt 打架且视角错）；felt 透明桌外露出地面暗调即可。

## 特效美术（owner 2026-07-22「特效需要的美术出美术台」·逐条评过）

> 评判口径（资深架构）：**特效大多是程序/CSS 闭集件（无美术文件）——不为纯程序特效虚造台账槽**（虚胖）。只有**真正显示图片**的特效槽才入台账。

**① 需真图（显示 Image 的特效槽·已入台账·studio-ready）**

| 槽 | 台账号/状态 | 用处 | 尺寸 | prompt 摘要 |
|---|---|---|---|---|
| `game-a/fx/win` | `art-05` · `pending-art` | 通关胜利演出满幅底图（其上再叠程序彩纸+金币 Particles） | 2560×1440 透明 | 金光径向爆发 + 丝带 + 落金币 + 暖庆典辉光·透明·高清 |
| `game-a/icon/coin` | 已在台账 | 钱包/金币记号（套装图标·非特效专属） | 见台账 | 金币图标 |

**② 纯程序/CSS 特效（闭集件·无美术文件·无需台账）**

席位金光呼吸 `fx:glow+pulse`、中央提示 `glow`、呢面微光 `Particles{sparkle}`、按钮 `press3d`、胜利彩纸/金币雨 `Particles{confetti,coins}`、标题流光 `fx:sheen`、**炸弹彩虹箔 `fx:holo`**、**发牌错落 `anim:fadeIn`**——全是渲染器程序生成（同 Sky3D 程序纹理先例·零美术文件·确定式），**无真图可换、也无需台账**。

**③ 基座缺口（想给"程序粒子"换真图 sprite→报 PUI·不游戏层自造）**

`Particles`（彩纸/金币/星光/微光）当前=程序 span 形状·**无 `sprite`/art 字段**，喂不了真美术图。若 owner 要"真金币贴图/真彩纸贴图"级粒子，属基座能力缺口 → 走 `docs/workflow/requests.md` 报 PUI 扩 `Particles.sprite`（闭集加一个字段），**游戏层不手写粒子**。现阶段程序粒子已够观感。

## 交付后自检

- 真图入库后：桌面比例须贴 **2.53:1**（透明区=桌外·避免方图硬边露白）；金边跟圆角矩形走（非椭圆）。
- 跑 `npm run ledger:audit game-a --strict`（非孤儿）+ 真机目击（`node scripts/shoot-game.mjs game-a … 开始上桌,入座开局`）对比本单目标观感。
