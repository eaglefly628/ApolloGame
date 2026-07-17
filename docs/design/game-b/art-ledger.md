# 雀宴 · 美术台本（S6 台账源·GD-B 2026-07-17·⚖ owner 点名产出）

> **用法**：本档=美术生产的**行级台本**（件名/尺寸/用途/英文 prompt）。施工期由美术平台/PA 按 `docs/playbooks/art-pipeline.md` 转正式机读台账（`public/games/game-b/art/` · **保号 B-NN 不漂移**），批量生成等真 key（连 REQ-AIGEN 卡口）；占位先行（CC0 包+程序化）不阻塞 S3-S5。
> **风格锚**：全部行引风格包 **`sakura-nijigen`**（PA 已落 `scripts/style-packs.json`·女性向二次元人物锚·台账行**引锚不手抄** prompt 原文）；场景/道具行叠加场景基调词 `warm night japanese parlor, sakura pink & lantern amber palette`。
> **红线**：人物=**成年女性**、基準档着装完整；真 alpha PNG（假棋盘格拒收·可走导入抠图线）；prompt 禁真实厂牌/作品/人名。尺寸=生成口径，**消费分辨率终口径待 PUI/P3D 会审**（Lead S2-⑤）。
> 人名为 gdd 工作名（绫/莉世/小夜·待 owner 拍板——mockups 包候选名 紅葉/雪乃/椿）；**改名只改台账行文案，不动编号**。

## A. 人物组（真美术刚需·优先级最高）

| # | 件 | 尺寸 | 格式 | 英文 prompt（+锚 sakura-nijigen） | 状态 |
|---|---|---|---|---|---|
| B-01 | 大姨太·绫 头像 | 512×512 | png 方图 | adult elegant japanese woman, composed cool beauty, long black hair with kanzashi, deep plum kimono, bust portrait, soft lantern light, subtle confident smile | 待产 |
| B-02 | 二姨太·莉世 头像 | 512×512 | png 方图 | adult glamorous japanese woman, fiery confident smirk, wavy auburn hair, crimson kimono slightly loose at shoulder (tasteful), bust portrait, warm lamp glow | 待产 |
| B-03 | 三姨太·小夜 头像 | 512×512 | png 方图 | adult sweet-faced japanese woman, playful innocent expression, soft pink-brown hair with ribbon, sakura-pink kimono, bust portrait, gentle warm light | 待产 |
| B-04 | 绫 立绘·整齐档 | 1024×1792 | png 真alpha | full-body standing portrait, adult elegant japanese woman, immaculate deep plum kimono with obi, poised posture, hand near sleeve, cool graceful aura, true transparent background | 待产 |
| B-05 | 莉世 立绘·整齐档 | 1024×1792 | png 真alpha | full-body standing portrait, adult glamorous japanese woman, crimson kimono, hand on hip, teasing confident pose, true transparent background | 待产 |
| B-06 | 小夜 立绘·整齐档 | 1024×1792 | png 真alpha | full-body standing portrait, adult petite japanese woman, sakura-pink kimono, cheerful light pose, sleeves swaying, true transparent background | 待产 |
| B-07~B-12 | 三人换装档 ×2（微乱/最终档·点到为止不露点） | 1024×1792 | png 真alpha | 同 B-04~06 基底 + `kimono slightly loosened, obi undone draped over arm`（微乱）/ `underlayer nagajuban only, modest, shoulders covered by draped fabric`（最终档） | **v2 预留**（轻表示先行） |

## B. UI 组

| # | 件 | 尺寸 | 格式 | prompt / 做法 | 状态 |
|---|---|---|---|---|---|
| B-13 | 衣物图标·簪 | 128×128 | png 真alpha | ornate japanese hairpin kanzashi icon, sakura motif, flat elegant game icon | 待产 |
| B-14 | 衣物图标·打挂 | 128×128 | png 真alpha | luxurious uchikake kimono over-robe icon, folded, flat elegant game icon | 待产 |
| B-15 | 衣物图标·帯 | 128×128 | png 真alpha | silk obi sash bow icon, flat elegant game icon | 待产 |
| B-16 | 衣物图标·襦袢 | 128×128 | png 真alpha | white nagajuban under-kimono icon, folded, flat elegant game icon | 待产 |
| B-17 | 衣物图标·足袋 | 128×128 | png 真alpha | white tabi socks pair icon, flat elegant game icon | 待产 |
| B-18 | 风位牌 東南西北 ×4 | 96×96 ×4 | png | 程序化候选：主题色圆章+汉字（Label.font 和风字）；真图=lacquer seal stamp icon with kanji | 程序化先行 |
| B-19 | 立直棒/供托图标 | 128×32 | png 真alpha | white scoring stick with red dot, clean game icon | 程序化先行 |
| B-20 | 主菜单背景 | 1920×1080 | png | warm night japanese parlor interior, low mahjong table, shoji doors, hanging lanterns, moon window, empty room await guests, painterly anime background | 待产 |
| B-21 | 役种花体字头图（立直/满贯/跳满/役满…） | 512×192 ×N | png 真alpha | 可选：艺术字库先行（Label.font）；真图=brush calligraphy title card | v2 可选 |

## C. 桌面组（3D 贴图·占位/程序化先行）

| # | 件 | 尺寸 | 格式 | prompt / 做法 | 状态 |
|---|---|---|---|---|---|
| B-22 | 桌呢贴图（绯/樱双色候选） | 1024×1024 tileable | png | seamless felt fabric texture, crimson & sakura pink variants, fine fiber detail | 程序化占位先行 |
| B-23 | 桌体木纹 | 1024×1024 tileable | png | seamless dark lacquered wood grain texture, warm brown | 程序化占位先行 |
| B-24 | 牌面 34+赤3+背 | 图集（CC0 包现成） | png | **占位=终态候选**：`mahjong/tex/*`（CC0 可商用·B-007）；真美术重绘=v2 可选（樱色牌背纹样） | ✅ 占位齐 |
| B-25 | 点棒/座垫/骰 | — | — | 程序化+复用现成 3D 骰（P3D 会审） | 程序化 |

## D. 背景组（2.5D 舞台布景板）

| # | 件 | 尺寸 | 格式 | prompt | 状态 |
|---|---|---|---|---|---|
| B-26 | 障子门板 ×2 | 1024×2048 | png | japanese shoji sliding door panel, warm light through paper, night, anime background element | 待产 |
| B-27 | 灯笼 | 512×1024 | png 真alpha | hanging japanese paper lantern, warm amber glow, anime style | 待产 |
| B-28 | 月窗远景板 | 2048×1024 | png | round moon window view, night garden silhouette, sakura branches, anime background | 待产 |
| B-29 | 地席纹 | 1024×1024 tileable | png | seamless tatami mat texture, warm tone | 程序化占位先行 |

## 交付顺序建议

1. **第一批（S6 开门）**：B-01~06（三人头像+立绘·游戏辨识度所在）+ B-20 主菜单背景。
2. 第二批：B-13~17 衣物图标 + B-26~28 背景板。
3. v2：B-07~12 换装档、B-21 花体字、B-24 牌面重绘。
- 主角头像/立绘来自角色卡**不占台账**；台账进机读化时逐行核 `spec{w,h}` 消费口径（Lead S2-⑤·PUI/P3D 会审）。
