# 日式麻将 Riichi Mahjong · 美术 Placeholder 清单（转 GD/PE）

> PA 备料（2026-07-16）。**类型：3D 立体麻将**。素材=**共享货架 placeholder**（授权已核·带 provenance）——建游戏时 `vendor-asset` copy 进游戏本地 `art/` 再引，**不直引货架**。
> 缺口走：**程序化** 或 软件内 **✨ AI 生成**（人审门入库）。3D 建模/渲染=**P3D 域**。

## ✅ 已备（货架现成·CC0 全套·双格式）

牌面 34 种×4=136（游戏取 4 份/种）+ 红五 + 背/面/空。**SVG（2D UI 用）+ PNG（3D 立方体贴图用·usage albedo）双份**，同源 `FluffyStuff/riichi-mahjong-tiles`（**CC0 public domain**）。

| 类 | 货架 id（2D SVG） | 3D 贴图 id（PNG） | 明细 |
|---|---|---|---|
| 数牌 | `mahjong/{man,pin,sou}-1`…`-9` | `mahjong/tex/{man,pin,sou}-1`…`-9` | 万/筒/条 各 9 = 27 |
| 红五 dora | `mahjong/{man,pin,sou}-5-red` | `mahjong/tex/…-5-red` | 3 |
| 风牌 | `mahjong/{ton,nan,shaa,pei}` | `mahjong/tex/{ton,nan,shaa,pei}` | 东/南/西/北 |
| 三元牌 | `mahjong/{haku,hatsu,chun}` | `mahjong/tex/{haku,hatsu,chun}` | 白/发/中 |
| 背/面/空 | `mahjong/{back,front,blank}` | `mahjong/tex/{back,front,blank}` | 牌背/牌面白/空白 |

> **3D 牌 = 立方体贴牌面**：一个 box（象牙白牌身·压成牌比例）+ `Material3D` 正面贴 `mahjong/tex/<牌>`（PNG）。货架已有 `mesh/cube` 可缩放。

## ✅ 复用（不用扒）

| 需要 | 现成 |
|---|---|
| 骰子（3D） | `game-g/clash-dice-3d.ts` + `game-d/throw3d.ts` 已有 3D 骰·直接复用（P3D 域·摆数据） |

## 🔴 缺口（货架无·按下列出路补）

| 需要 | 出路 |
|---|---|
| 3D 麻将牌模型 (.glb) | **程序化圆角盒 + 贴上面 CC0 PNG 牌面**（faces 已有·最省）· 或 tripo/meshy · **P3D 域** |
| 点棒 scoring sticks（100/1000/5000/10000） | 程序化（分色长条 + 圆点）· P3D |
| 牌墙 / 牌桌 | 程序化（绿呢平面/矮盒 + 毛毡贴图）——GitHub 无宽松牌桌 GLB · P3D |
| 手牌/自风指示等 UI | LayoutNode + emoji→美术图 或 AI |

## 接法

- **vendor 一张牌面**：`node scripts/vendor-asset.mjs mahjong/tex/man-1 <你的游戏名>`（3D 贴图用 PNG）或 `mahjong/man-1`（2D UI 用 SVG）。
- 3D 牌 = box + 贴 PNG 面；骰子复用现成；牌桌/点棒程序化——**全不用外扒 GLB**。
- 发行前 PA 复核授权（现 CC0 可商用·无署名硬性要求）。
