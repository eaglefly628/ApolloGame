# 德州扑克 Texas Hold'em · 美术 Placeholder 清单（转 GD/PE）

> **GD-C 录档（2026-07-17·自 docs/design/ 根迁入·文档随游戏走）**：已对照 GDD §7 / capability-plan §4.5——
> 货架现货（52 牌+卡背+筹码 9 面额）**全部采用**（vendor 流）；3D 模型缺口出路（程序化圆柱/绿呢）与本游戏盒庭几何生成路线一致 ✅。
> 本单未含的 game-c 特色资产（五位姨太头像、衣物件目图标 ×6、**分层立绘 ≈35 层**、头像框）→ ✨AI 生成 + 台账建行（GDD §7）。
>
> PA 备料（2026-07-16）。**类型：3D 扑克**。素材=**共享货架 placeholder**（授权已核·带 provenance）——建游戏时 `vendor-asset` copy 进游戏本地 `art/` 再引，**不直引货架**。
> 缺口统一走：软件内 **✨ AI 生成**（qwen 2D / tripo·meshy 3D·人审门入库）或**程序化占位**。3D 建模/渲染=**P3D 域**。

## ✅ 已备（货架现成·直接 vendor）

| 类 | 货架 id | 数量 | 授权 / 源 |
|---|---|---|---|
| 扑克牌 52 | `card/<rank>-of-<suit>`（如 `card/ace-of-spades`·rank=ace/king/…/two·suit=spades/hearts/diamonds/clubs） | 52 SVG | Public Domain · `notpeter/Vector-Playing-Cards` |
| 大小王 | `card/joker-red`·`card/joker-black` | 2 SVG | 同上 |
| 牌背 | `card/back` | 1 PNG | Public Domain · `hayeah/playing-cards-assets` |
| **筹码**（标准面额） | `chip/1-white`·`chip/5-red`·`chip/10-blue`·`chip/25-green`·`chip/50-orange`·`chip/100-black`·`chip/500-purple`·`chip/1000-yellow`·`chip/5000-gray` | 9 SVG | **CC0 自产**（程序化·`scripts/gen-chips.mjs`）|

## 🔴 缺口（货架无·按下列出路补）

| 需要 | 出路 |
|---|---|
| 3D 筹码/牌/牌桌模型 (.glb) | GitHub 无宽松现成源 → **程序化**（圆柱筹码 + 绿呢平面）或 tripo/meshy AI 生成 · **P3D 域** |
| 庄家按钮 dealer button | 程序化圆片 或 AI 生成 |
| 绿呢桌布 felt 贴图 | 程序化纯色/毛毡噪声 或 AI |
| 发牌/下注动效 | 引擎能力（非美术资产） |

## 接法

- **vendor 一张**：`node scripts/vendor-asset.mjs card/ace-of-spades <你的游戏名>`（copy 进 `public/games/<game>/art/` + 登记本地 index）。
- **筹码 3D**：2D 筹码图可贴在圆柱侧/顶面，或程序化分色圆柱；3D 归 P3D。
- 备注：`game-e` 另有 `cards.png` 切图牌面可参考对比。
- 发行前 PA 复核最终所用素材授权（现 PD/CC0 均可商用）。
