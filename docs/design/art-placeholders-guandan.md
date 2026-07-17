# 掼蛋 Guandan · 美术 Placeholder 清单（转 GD/PE）

> PA 备料（2026-07-16）。**类型：2D 卡牌**（两副牌 108 张 = 标准 52×2 + 大小王×2）。素材=**共享货架 placeholder**（授权已核）——建游戏时 `vendor-asset` copy 进游戏本地 `art/` 再引，**不直引货架**。
> **这款素材基本到位·缺口最小**（无筹码、无 3D）。

## ✅ 已备（货架现成·直接 vendor）

| 类 | 货架 id | 数量 | 授权 / 源 |
|---|---|---|---|
| 标准 52 张 | `card/<rank>-of-<suit>`（rank=ace/king/queen/jack/ten…two·suit=spades/hearts/diamonds/clubs） | 52 SVG | Public Domain · `notpeter/Vector-Playing-Cards` |
| 大小王 | `card/joker-red`（大王）·`card/joker-black`（小王） | 2 SVG | 同上 |
| 牌背 | `card/back` | 1 PNG | Public Domain · `hayeah/playing-cards-assets` |

> **两副 = 108 张**：引同一副牌两次即可（掼蛋两副同花色·美术不必区分两副）。

## 🟡 缺口（少量·可选）

| 需要 | 出路 |
|---|---|
| 桌面/牌局背景底 | 程序化纯色/纹理 或 AI 生成（qwen） |
| 等级/记分/贡牌 UI 图标 | 走 emoji→美术图（REQ-UI-emoji图渲）或 AI |
| 头像/座位标 | 可选 · AI 或 emoji |

## 接法

- **vendor 一张**：`node scripts/vendor-asset.mjs card/king-of-hearts <你的游戏名>`。
- **整副 52**：写个小循环 vendor（或建库时批量），52 张 + 2 王 + 牌背。
- 无 3D、无筹码——掼蛋纯 2D 卡牌，牌面齐了基本就能搭。
- 发行前 PA 复核授权（现 PD 可商用）。
