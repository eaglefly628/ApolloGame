# 三款新卡牌/麻将游戏 · 美术素材侦察 + placeholder 清单

> **分游戏独立文档（转对应 dev）**：`art-placeholders-texas-holdem.md` · `art-placeholders-guandan.md` · `art-placeholders-riichi-mahjong.md`（同目录）。本文=总览。
> PA 侦察产出（owner「德州扑克/掼蛋/日式麻将·帮我扒 placeholder·分游戏列」·2026-07-16）。
> **已拉进共享货架**（`assets/{cards,mahjong}/` + 登记 `assets/index.json`·授权已核）——各游戏建库时 `vendor-asset` 进本地。
> **拉取源均 GitHub raw 逐文件（本环境 codeload zip 被挡）·宽松授权**：扑克牌 = Public Domain，麻将 = CC0。
> **共同缺口**：2D 牌面（卡牌/麻将）已解决；**筹码/点棒/骰子/牌桌/一切 3D 模型 = GitHub 无宽松源** → 走程序化占位 或 AI 生成（qwen 2D / tripo·meshy 3D·走人审门入库）。

---

## ① 德州扑克 Texas Hold'em（3D）

| 需要 | 现状 | 来源 / 落点 |
|---|---|---|
| 52 张扑克牌 + 大小王 | ✅ **已拉** | `card/<rank>-of-<suit>`（52）+ `card/joker-red/black`·PD·`notpeter/Vector-Playing-Cards`·`assets/cards/*.svg` |
| 牌背 | ✅ **已拉** | `card/back`·PD·`hayeah/playing-cards-assets`·`assets/cards/back.png` |
| 筹码（白/红/蓝/绿/黑面额） | 🔴 **缺·无宽松 GitHub 源** | → AI 生成（qwen 顶视/等距筹码 sprite）或程序化（分色圆柱） |
| 3D 筹码/牌桌/发牌模型 (.glb) | 🔴 **缺·无宽松 GitHub 源** | → 程序化（圆柱筹码 + 绿呢平面）或 tripo/meshy AI 生成 |
| 庄家按钮 dealer button | 🔴 缺 | → 程序化/AI |
| 绿呢桌布 felt 贴图 | 🔴 缺 | → 程序化纯色/噪声 或 AI |
| **备注** | game-e 另有 `cards.png` 切图牌面（可复用/对比） | 3D 化=P3D 域·牌面用拉来的 SVG 贴片 |

## ② 掼蛋 Guandan（2D 卡牌）

| 需要 | 现状 | 来源 / 落点 |
|---|---|---|
| 2 副牌 = 标准 52×2 + 大小王×2 | ✅ **已拉**（引同一副两次） | `card/*`·PD·`assets/cards/`（54 张全）|
| 牌背 | ✅ **已拉** | `card/back` |
| 桌面/记分/等级 UI 底 | 🟡 少量 | → 程序化 或 AI（掼蛋主要就是标准牌·基本齐了） |
| **备注** | **无筹码/无 3D**（2D 卡牌游戏）——这款素材基本到位，缺口最小 | |

## ③ 日式麻将 Riichi Mahjong（3D）

| 需要 | 现状 | 来源 / 落点 |
|---|---|---|
| 136 张牌面 = 34 种×4（万/筒/条 1-9·东南西北·白发中） | ✅ **已拉全种**（游戏取 4 份/种） | `mahjong/{man,pin,sou}-1..9`·`mahjong/{ton,nan,shaa,pei,haku,hatsu,chun}`·CC0·`FluffyStuff/riichi-mahjong-tiles`·`assets/mahjong/*.svg` |
| 红五 dora（万/筒/条 5 红） | ✅ **已拉** | `mahjong/{man,pin,sou}-5-red` |
| 牌背 / 牌正面 / 空白 | ✅ **已拉** | `mahjong/{back,front,blank}` |
| 3D 麻将牌模型 (.glb) | 🔴 **缺·无宽松源** | → **程序化圆角盒 + 贴拉来的 CC0 牌面**（faces 已有·最省）·或 tripo/meshy |
| 点棒 scoring sticks | 🔴 缺 | → 程序化（分色长条 + 圆点）|
| 骰子 ×2（3D） | 🔴 缺 | → 程序化立方体 + 点数贴图 |
| 牌墙 / 牌桌 | 🔴 缺 | → 程序化 |
| **备注** | 2D 牌面 = **CC0 全套·双格式(SVG+PNG)·双配色**（FluffyStuff 是本批最佳源） | 3D 化=P3D 域 |

---

## 落点与后续

- **已拉 95 个文件**（54 扑克 + 1 背 + 40 麻将）已进共享货架 `assets/{cards,mahjong}/` + 登记 `assets/index.json`（`asset-reconcile --shared` PASS·授权/来源/provenance 硬字段齐）。拉取脚本 `scripts/pull-cardgame-art.mjs`（数据驱动源表·幂等·可重跑加源）。
- **各游戏建库时**：`node scripts/vendor-asset.mjs card/ace-of-spades <game>`（或整批）copy 进游戏本地 `art/` 再引——不直引货架。
- **缺口（筹码/点棒/骰子/桌/3D 模型）统一走**：AI 生成（软件内 ✨ AI 生成·qwen 2D / tripo·meshy 3D·人审门入库）或程序化占位；3D 模型归 P3D 域。
- 发行前 PA 复核最终所用素材授权（现 PD/CC0 均可商用·无署名硬性要求·仍在 provenance 留源）。
