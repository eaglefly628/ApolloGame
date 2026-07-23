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

## 场景底：牌室背景（room behind·同屏但非桌面本体）

| 字段 | 值 |
|---|---|
| **台账号 / 状态** | `art-02` · `filled`（程序占位·可后补真图） |
| **消费槽 skinKey** | `game-a/bg/table`（`a-play` / `a-result` 屏满幅底图） |
| **目标观感** | 胡桃木夜宴牌室·暖夜私宅·牌桌四周环境（虚化·不抢桌面） |

## 交付后自检

- 真图入库后：桌面比例须贴 **2.53:1**（透明区=桌外·避免方图硬边露白）；金边跟圆角矩形走（非椭圆）。
- 跑 `npm run ledger:audit game-a --strict`（非孤儿）+ 真机目击（`node scripts/shoot-game.mjs game-a … 开始上桌,入座开局`）对比本单目标观感。
