# game102 · 像素画关卡「生成」研究 & 管线（owner 2026-07-24 命题）

> 命题：每关 = 一整幅**满格 cols×rows 像素画**，每格颜色 = power(补给罐)色之一；图上叠**南瓜头/钥匙/门**。
> 「这张像素图怎么低成本批产」= 本作内容引擎的核心。**owner 拍板：此算法 game102 本地化，别的游戏一时用不上、不下沉引擎。**
> 落点：`src/games/game102/pixelgen.ts`（PE 本地算法库·authoring-time 纯函数·确定性·零裸 Math.random）。

## 0. 内容模型（数据契约）

一关 = `Level`（`levels.ts`）：`{ cols, rows, palette[], bitmap[满格], keys[], door, pumpkins[], … }`。
- `palette` = 本关 power 色闭集（index 对齐 bitmap 数字·名对应 `theme.PALETTE`）。
- `bitmap` = rows 行 × cols 字符，**每格一个 palette index**（满格·`.`=可选透明格）。
- `keys/door/pumpkins` = 叠在图上的特殊件坐标（S4 玩法消费：钥匙收集 / 门开 / 南瓜头打碎掉落）。

棋盘落地 = **一格一实体 BoardCell**（`blueprint.boardCells`·非 tilemap·见 requests.md TILEMAP-VERDICT）——
现有 `group-count/launch/hitbox/effect-apply` 原生消费，纯组合表达。

## 1. 两条生成路径（都落同一份 `bitmap+specials` 数据）

### Path A · 图像量化（把「一张画」变成一关）
1. 目标画来源：美术手绘 / AI 出图（`scripts/ai-gen.mjs` qwen·seedream 文本→PNG）。
2. 降采样到 cols×rows（每格取源图对应区块**均值色**）。
3. 每格 → **最近 power 色**（`pixelgen.nearestPaletteIndex`·感知加权 RGB 距离 r3/g4/b2·比裸欧氏贴人眼·无需 LAB）。
4. alpha<128 → `.`（透明格）；可选有序抖动(dither)提观感。
5. 特殊件：author 叠层标注 或 特征检测（南瓜头/钥匙/门锚点）。
→ `pixelgen.quantizeToBitmap(rgbGrid, paletteNames)`（**纯函数·任意 RGB 网格皆可·已单测**）。
> 缺口：PNG→RGB 解码适配器（`ai-gen.mjs` 已有纯 Node PNG **编码器**·解码器为待补 adapter·zlib inflate+去 filter）。真画到手即接。

### Path B · 程序化（seed → 母题合成·无需外部图）
`pixelgen.genGarden(cols, rows, seed)`：确定性 PRNG(mulberry32) → 绿地底噪 + 掺黑泥斑 + N 个圆盘南瓜(橙身/黄高光/黑描边/绿蒂) + 红黄花 → 满格 bitmap + specials(南瓜头/钥匙/门)。**已单测·同 seed 同产物**。
→ L1《南瓜园》= `genGarden(22,22,20001)` 的 check-in 产物（`levels.ts`·game-t `levels.gen` 范式：生成器出数据、游戏读数据）。

## 2. 确定性与数据驱动

- 生成器 = **authoring-time 工具**，产物 = **check-in 的静态 bitmap 数据**（不在运行时生成 → 不碰 sim/hash/lockstep）。
- 重生成 = 改 seed/size 重跑覆写该关；批产 = N 图/N seed → N 关（`levels.jsonc` 追加）。
- 与宪法：level 仍 = 纯数据；生成器是 game102 本地 authoring 算法（owner 批·非引擎能力·非运行时游戏码）。

## 3. S4 玩法消费（本文只管「生成」·玩法后置）

- 南瓜头：`pumpkins[]` 锚点 → S4 接「打碎→掉落」（gravity/velocity + hitbox + mortal）。
- 钥匙：`keys[]` → 同色消除收集 → `gauge`；集齐 → 门 `event-when` 开。
- 门：`door` → render 装饰 + 目标计量 `gauge`。

## 4. 待 owner / GD 定的旋钮

| 旋钮 | 说明 | 暂定 |
|---|---|---|
| **power 色数** | palette 大小 = 补给罐色种数（越多越难/越像） | 6（green/black/red/orange/yellow/white） |
| **网格分辨率** | cols×rows：越大越像画、格越多（实体数↑） | 22×22（demo）·可调 |
| **Path A 出图源** | AI(ai-gen) vs 美术手绘 vs 参考照片 | 待定（先 Path B 程序化跑通） |
| **PNG 解码适配器** | Path A 接真图需补（现有 encoder·缺 decoder） | 待 owner 给真画文件即补 |

## 5. 现状

- ✅ `pixelgen.ts`（量化器 + 程序化生成器·纯函数·`pixelgen.test.ts` 覆盖）。
- ✅ L1《南瓜园》满格像素画 check-in + 沙盒渲染目击（三南瓜/绿地/花/门）。
- ⏳ Path A PNG 解码适配器（等真画文件）；20 关批产 + balance-sim 定标（GD·game-t 范式）。
