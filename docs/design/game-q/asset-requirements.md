# game-q《Neon Siege》资产需求规格表（2D 版 · 对 PST 美术自动生成管线 · REQ-DEMO-T1）

> 立：LEAD（game-q 建造者本人）· 2026-07-08 · owner「先解决 2D 资产描述 + 把游戏变回 2D」。
> **game-q 已变回 2D**（CanvasRenderer·俯视·Shape/Color 图元·commit 见 git log）——3D 盒庭版停在历史（`git show 8de5a11c`），本表是 2D 版的资产皮肤槽规格。
> **为何 2D 更贴管线**：冲刺主力=2D wanx。2D 塔防每个主体=**一张俯视精灵**（`art:`→`Sprite.textureKey`·单图·无 PBR 套图/无法线/无 HDRI）——这才是「有皮肤槽→换皮」的教科书样例。3D 版逼着做 PBR 贴图落在关键路径外，故退回。

## 0. 管线能力实况 + 接线法（先钉死）

- **千问 wanx（`wanx2.1-t2i-turbo`）= 一次一张 1024×1024 sRGB PNG**（读 `scripts/ai-gen.mjs`）。2D 精灵正好一物一图·**天生契合**（不像 3D 要拆 albedo/normal/emissive 套图）。
- **接线（fail-soft·红线内）**：给主体实体**加** `Sprite:{textureKey:'art:<query>', anchorX:.5, anchorY:.5, zOrder:n}`，**保留现有 `Shape`+`Color`**。CanvasRenderer 的 `chooseRenderMode`：精灵就绪→画精灵；未就绪/`art:` 解析失败→回退画 Shape 占位（`resolveArtRefs` fail-soft·不炸加载）。⟹ **零资产时游戏照现样跑，有资产时自动升级**·且 `Shape` 还兼碰撞体（enemy/base/pad 的 sensor 命中仍靠 Shape）。
- **透明底**：精灵 prompt 必写 `transparent background`·`usage:'sprite'`·`wrap:'clamp'`·srgb（自动派生）。
- **俯视！** 2D 版是**正俯视**（世界坐标=屏幕·无相机）——所有精灵 prompt 必写 `top-down view`（区别于 3D 版的 3/4 盒庭）。
- **尺寸**：wanx 恒 1024²·据实体现有半径缩放显示（下表给「显示足印 px」定长宽比与锚点）。
- **texture spec 闭集**（`src/assets/asset-index.ts`）：`usage:'sprite'`·`colorSpace` 自动 srgb·`wrap:'clamp'`。

## 1. Lead 判读（评判结论·CORE RULE）

1. **接受**·非回驳：零皮肤槽是换皮前提缺失·补槽=正题。
2. **2D 版最省最贴管线**：主体精灵单图·`art:` 直接钉进 `Sprite.textureKey`·换皮=换风格锚重跑同一组精灵。
3. **车道/命中闪/死亡爆闪保留程序化**（Shape+Color+Tween·**由 `TINT` 主题色驱动·换皮时随调色板走**）——不必逐帧生成资产，省生成量、且天然成套。仅**演员 + 地板 + 出生门**上真精灵。
4. **HUD 照旧 LayoutNode**（图标可选精灵·标题保艺术字·wanx 糊字）。

## 2. 统一风格锚（一致性五层防线 层1+层2 · `artStyle`）

- **stylePack**：`neon-synthwave`（霓虹合成波 / Tron·**俯视 2D 游戏精灵**）。
- **stylePrompt 前缀（注入每条 prompt 前）**：
  `top-down 2D game sprite, neon synthwave sci-fi, Tron-like, dark background, emissive glowing edges, clean vector shapes, high contrast, centered, transparent background,`
- **调色板 hex**（写进 prompt·palette-snap 后处理量化到它）：青 `#33c2e8`/`#38bdf8` · 品红 `#f472b6` · 玉绿 `#2fbf87` · 敌粉红 `#ff5c7a` · 敌琥珀 `#ffd23f` · 敌紫 `#c084fc` · 暗底 `#05080f`。
- **统一负向 prompt**：`text, watermark, signature, people, hands, 3/4 view, isometric, perspective, realistic photo, muted colors, cluttered, drop shadow, background scenery`
- **钉死**：全款同一 `provider=qwen · model=wanx2.1-t2i-turbo`（+seed 若 adapter 加）。台账记录。

---

## 3. 演员精灵（P0·`Sprite.textureKey` · wanx 2D · 俯视·透明底）

> 接线：`blueprint.ts` 各模板 `body` 加 `Sprite:{textureKey:'art:<编号>', anchorX:.5, anchorY:.5, zOrder}`·保留 `Shape`+`Color`（碰撞+占位）。

| 编号 | 目标 slot（blueprint.ts 模板·body） | 显示足印(px·据现半径) | anchor/zOrder | 优先 |
|---|---|---|---|---|
| q-spr-01 | `tower_pulse` body（现 hex r15） | ~44×44 | .5/.5·z 5 | **P0** |
| q-spr-02 | `tower_cannon` body（现 hex r18） | ~52×52 | .5/.5·z 5 | **P0** |
| q-spr-03 | `enemy_basic` body（现 circle r12） | ~30×30 | .5/.5·z 4 | **P0** |
| q-spr-04 | `enemy_fast` body（现 diamond r10） | ~26×26 | .5/.5·z 4 | **P0** |
| q-spr-05 | `enemy_tank` body（现 hex r16） | ~38×38 | .5/.5·z 4 | **P0** |
| q-spr-06 | `base`（现 box 56×120·竖向） | ~64×128 | .5/.5·z 3 | **P0** |
| q-spr-07 | `pad-*-p` 建造位（现 hex r18） | ~46×46 | .5/.5·z 2 | P1 |

**提示词库（前缀 §2·下为主体串·全部 `top-down`）**：
```
q-spr-01 : top-down neon tower, cyan #38bdf8 glowing hexagonal turret with a bright core, sci-fi, symmetrical
q-spr-02 : top-down heavy rail cannon turret, magenta #f472b6 glowing, twin barrels, bulky base, symmetrical
q-spr-03 : top-down small hostile drone, round pink-red #ff5c7a glowing orb with a darker core, simple
q-spr-04 : top-down fast scout drone, amber #ffd23f glowing diamond/dart shape, sleek, pointed
q-spr-05 : top-down heavy tank drone, purple #c084fc glowing hexagonal armored hull, chunky
q-spr-06 : top-down energy core base, jade-green #2fbf87 glowing reactor structure, protective, hexagonal, imposing
q-spr-07 : top-down circular build pad, dark hexagon platform with cyan #33c2e8 glowing rim and center node
```
> 注：`base` 现为竖长方（56×120）→ 显示 ~64×128·prompt 里说 `vertical structure`；若管线只出方图 1024²，`base` 用居中竖构图、两侧留透明。

## 4. 场景精灵（P1·地板 + 出生门）

| 编号 | 目标 slot | 类型/尺寸 | 说明 | 优先 |
|---|---|---|---|---|
| q-spr-10 | 新增 `field-bg` 实体（Sprite·z 0·铺满场） | sprite / 960×560 显示（gen 1024²·裁/贴） | **暗霓虹地板**（网格/电路底纹）·**车道保留程序化画在其上**（NavGraph 数据驱动·换关不重画） | P1 |
| q-spr-11 | `spawn-portal`（现 circle r18） | sprite / ~40×40 · z 1 | 俯视发光传送门 | P1 |

**提示词**：
```
q-spr-10 : top-down seamless dark sci-fi arena floor, faint cyan #33c2e8 tech grid, subtle circuit etching, neon synthwave, even lighting (NO path drawn)
q-spr-11 : top-down glowing portal, swirling pink-red #ff5c7a energy ring, radial
```
> **地板不画路**（`NO path drawn`）：车道由程序化 Shape 叠在地板上（`laneTrackEntities`·随 `TINT` 换色）→ 换皮换地板+调色板即换整场观感·不锁死关卡几何。**背景方图 vs 场地 16:9**：wanx 恒 1024² → 取中心 960×560 裁，或给 adapter 加 `size` 参（PST 小改·见 §7）。

## 5. 命中/死亡 特效（**保留程序化·非资产**）

> 现 `zapTemplate.flash`/`burstTemplate` = Shape 圆 + `Tween(alpha)` 淡出·**由塔/敌的 `TINT` 色驱动**·换皮随调色板自动成套。**不必生成精灵**（省量·天然一致）。可选升级见下。

| 关键时刻 | 现状（保留） | 可选升级（资产） | 优先 |
|---|---|---|---|
| 命中闪 | zapTint 圆淡出 | q-spr-20 火花精灵表（4 帧·`Frame`+`AnimState`） | P3·可不做 |
| 死亡爆闪 | 敌色圆淡出 | q-spr-21 爆炸精灵表（6 帧） | P3·可不做 |

## 6. UI 美术（P1-P2·LayoutNode `Image`/`Avatar` 的 `src` · wanx）

> 同 3D 版·UI 铁律内·透明底 sprite·1024²（UI 侧缩放）。标题**保留 display 艺术字**（wanx 糊字）。

| 编号 | 目标 slot（hud.ts） | 现状 | 优先 |
|---|---|---|---|
| q-ui-02 | 顶栏图标 ♥/⬡/⚔ ×3 | emoji/字形 | P1 |
| q-ui-03 | 底栏买钮缩略图 ×2 | 纯文字钮 | P1 |
| q-ui-05 | 胜负浮层主视觉 ×2 | 纯文字屏 | P2 |
| q-ui-04 | HUD 面板/边框纹 | 主题色板 | P2 |

**提示词库（前缀 §2·加 `single icon, centered`）**：
```
q-ui-02a : glowing heart-shield icon, jade-green #2fbf87, flat, simple
q-ui-02b : glowing hexagon coin icon, gold #fbbf24, flat, simple
q-ui-02c : crossed energy swords icon, cyan #33c2e8, flat, simple
q-ui-03a : icon of the cyan #38bdf8 pulse tower (reuse q-spr-01 look), flat
q-ui-03b : icon of the magenta #f472b6 rail cannon (reuse q-spr-02 look), flat
q-ui-05a : VICTORY emblem, jade-green #2fbf87 laurel + energy burst, no text
q-ui-05b : DEFEAT emblem, cracked red #ff5c7a core, no text
q-ui-04  : seamless tileable dark sci-fi hud panel with thin cyan #33c2e8 trim
```

## 7. 音频（**冲刺后**·纲领已压后 B 件）

| 编号 | 用途 | 现状 | 优先 |
|---|---|---|---|
| q-aud-01 | SFX（建/火/中/亡/胜/负 ×6） | synth 端口（sounds.ts·兜底） | 冲刺后 |
| q-aud-02 | BGM synthwave 循环 | 无 | 冲刺后 |

---

## 8. 汇总 · 生成清单（管线一眼可执行）

| 优先 | 编号 | 管线 | 产物件数 |
|---|---|---|---|
| **P0** | q-spr-01..06（两塔+三敌+大本营·演员精灵） | **wanx T1** | **6 张** |
| P1 | q-spr-07(pad) · q-spr-10(地板) · q-spr-11(门) · q-ui-02/03 | wanx T1 | ~8 张 |
| P2 | q-ui-04/05 | wanx T1 | ~3 张 |
| 保留程序化 | 车道 · 命中闪 · 死亡爆闪 · HUD 主体 | 引擎/主题色 | 0 张 |
| 冲刺后 | q-aud-01/02 | — | — |

> **P0 全真皮化 game-q 只需 6 张 wanx 精灵**（1024²·透明底·同风格锚·俯视）。**换皮**=换 `artStyle` 前缀（像素/水墨/卡通厚涂…）重跑这 6 张 → 新皮卡带；车道/特效随 `TINT` 调色板自动成套。

## 9. 未决 / 需 PST·PA 会审

- **背景 16:9 vs wanx 1024²**：给 `qwen` adapter 加可选 `size` 参（如 `1024*576`）比裁剪更好——PST 小改（`ai-gen.mjs` 的 `parameters.size` 现硬编码 `1024*1024`）·或先裁中心用。
- **精灵透明底**：DashScope wanx 透明 PNG 支持度需真调验（prompt 写 `transparent background`·翻车则加抠底后处理·记 blocker）。
- **`base` 竖长比**：方图里居中竖构图·两侧透明·显示 64×128。
- **接不接 FX 精灵表**：本表押「特效保留程序化」（省量·成套）；要更炸再上 q-spr-20/21 帧表。
