# game-q《Neon Siege》资产需求规格表（对 PST 美术自动生成管线 · REQ-DEMO-T1）

> 立：LEAD（game-q 建造者本人）· 2026-07-08 · 应 owner「出需求表·分 UI/2D/3D/粒子·**要具体美术规格/提示词/尺寸/细节**」。
> 用途：给 REQ-DEMO-T1 美术编排步一份 game-q **可直接喂管线**的皮肤槽规格——每槽含 目标 slot·资产 type/usage/colorSpace/wrap·尺寸/tiling·**完整英文提示词**·管线路径·优先级。
> 现状基线：game-q 3D 版**全程序化**（Mesh3D 图元 + Material3D 预设 + 程序化 surface·零真资产·零 art: 引用）。

## 0. 管线能力实况（先钉死·免规格开脱离实现）

> 读 `scripts/ai-gen.mjs` + `src/assets/asset-index.ts` 定死，规格按此裁：

- **千问 wanx（`wanx2.1-t2i-turbo`）= 一次一张 1024×1024 sRGB PNG。** 不产 PBR 套图、不产真切线空间法线、不产 HDRI、**文字会糊**（diffusion 通病）。
- ⟹ **每个 PBR 材质槽拆成：albedo（wanx 生）+ emissive（wanx 生·可选）+ normal/roughness（引擎 `Material3D.surface` 程序化·非 wanx）。** 别让 wanx 出「法线图」（它只会出一张蓝调装饰画·渲染错）。
- ⟹ **normal/rough 程序化与 albedo 图案不对齐**（surface 是通用噪声/凸点·非跟随 albedo 的格线）——demo 可接受；要对齐得有「albedo→normal 派生」工具（管线暂无·记 §7 gap）。
- ⟹ **envMap(HDRI) 不能 wanx**（需 equirect 2:1 HDR·wanx 只出方图 LDR）→ 天空走程序化 `Sky3D` 或 vendor `env/*` HDRI（见 §3C·降优）。
- ⟹ **UI 文字/logo 不宜 wanx**（糊字）→ 标题保留 display 艺术字（现已好）·图标类走纯图形（可 wanx）。
- **Tripo/Meshy = 文本→`.glb`**（spec `{scale, genCollision}`）·分钟级·**T4 非关键路径**。
- **texture spec 闭集**：`usage`∈{albedo,normal,roughness,metalness,ao,orm,emissive,sprite}；`colorSpace` 按 usage 自动派生（颜色类 srgb·数据类 linear·**别手设**）；`wrap`∈{clamp(sprite/图标),repeat(材质平铺)}；`tiling`=平铺次数。

## 1. Lead 判读（评判结论·CORE RULE）

1. **接受**（非回驳）：零皮肤槽 = 换皮前提缺失·定义槽位是正题。
2. **最大杠杆＝给现成图元贴 albedo+emissive（wanx 2D·T1 关键路径）**，不是 bespoke glTF（Tripo·T4）。修正 capability-plan §8.3「英雄模型 blocker」：blocker 只卡 glTF·真**贴图**在 T1 够得着。
3. **「粒子」多为摆 `Vfx3D` 数据（PE 接线·非资产生成）**·诚实归类。
4. **音频照纲领压后。**

## 2. 统一风格锚（一致性五层防线 层1+层2·`artStyle`）

- **stylePack**：`neon-synthwave`（霓虹合成波 / Tron）。
- **stylePrompt 前缀（注入每条 prompt 前）**：
  `neon synthwave sci-fi game asset, Tron-like, dark background, emissive glowing edges, high contrast, clean, flat even lighting,`
- **调色板 hex（写进 prompt·palette-snap 后处理量化到它）**：青 `#33c2e8`/`#38bdf8` · 品红 `#f472b6` · 玉绿 `#2fbf87` · 敌粉红 `#ff5c7a` · 敌琥珀 `#ffd23f` · 敌紫 `#c084fc` · 暗底 `#05080f` · 道蓝 `#1c3a5c`。
- **统一负向 prompt**：`text, watermark, signature, people, hands, realistic photo, muted colors, cluttered, busy background, drop shadow`
- **钉死**：全款同一 `provider=qwen · model=wanx2.1-t2i-turbo`（+seed 若 adapter 加）。台账记录。

---

## 3. 3D 资产（关键区）

### 3A. PBR 贴图 —— `Material3D` 贴图槽（**wanx 2D · T1 关键路径 · 最高杠杆**）

> 贴现成 Mesh3D 图元·不换几何。`art:` 引用进 `Material3D.map`(albedo)/`emissiveMap`。normal/rough 用 `surface`（本列已给参数）。

| 编号 | 目标 slot（blueprint.ts） | 图·type/usage/wrap | 尺寸·tiling | normal/rough(surface) | 优先 |
|---|---|---|---|---|---|
| q-3dtex-01 | `ground` · `Material3D.map`+`emissiveMap` | texture / albedo+emissive / repeat | 1024² · tiling 6 | `{pattern:'noise',tiles:16,normal:0.28,rough:0.7}`（现值·保留） | **P0** |
| q-3dtex-02 | `track-seg-*`(车道) · map+emissiveMap | albedo+emissive / repeat | 1024² · tiling 4（沿长） | `{pattern:'scratches',tiles:3,normal:0.4,rough:0.5}` | **P0** |
| q-3dtex-03 | `tower_pulse/cannon` body · map（**共用中性钢甲**·发光靠 `Material3D.emissive` 各自色） | albedo / repeat | 1024² · tiling 1 | `{pattern:'bumps',tiles:4,normal:0.5,rough:0.4}` | **P0** |
| q-3dtex-04 | `enemy_*` body · map（三型共一套甲·发光靠 emissive 各色） | albedo / clamp | 1024² · tiling 1 | `{pattern:'bumps',tiles:5,normal:0.5,rough:0.35}` | P1 |
| q-3dtex-05 | `base-tier/spire` · map+emissiveMap | albedo+emissive / repeat | 1024² · tiling 2 | `{pattern:'scratches',tiles:3,normal:0.4,rough:0.5}` | P1 |
| q-3dtex-06 | `pad-*-p`(建造位) · map+emissiveMap | albedo+emissive / clamp | 1024² · tiling 1 | 无（薄盘·免） | P1 |

**提示词库（前缀 §2·下为主体串·emissive 另起）**：
```
q-3dtex-01/albedo : seamless tileable top-down floor, dark navy #0a1428 hexagonal tech panels, faint cyan #33c2e8 grid seams, subtle wear
q-3dtex-01/emissive: seamless tileable, pure black background, thin glowing cyan #33c2e8 hexagonal grid lines only
q-3dtex-02/albedo : seamless tileable energy conduit strip, dark #14243f brushed metal, cyan #33c2e8 circuit data-stream lines along one axis
q-3dtex-02/emissive: pure black background, glowing cyan #33c2e8 flowing data-stream lines, seamless tileable
q-3dtex-03/albedo : sci-fi tower armor plating, brushed dark steel #444a55, panel lines, rivets, neutral (no colored glow)
q-3dtex-04/albedo : alien drone carapace, dark faceted crystalline alloy #2a2333, subtle iridescence, neutral
q-3dtex-05/albedo : energy fortress wall panel, dark jade-green #1c6f52 metal, reactor-core seam channels
q-3dtex-05/emissive: pure black background, glowing jade-green #8effc9 reactor seam lines
q-3dtex-06/albedo : top-down circular holographic build pad, dark center, cyan #33c2e8 ring hud markings, radial
q-3dtex-06/emissive: pure black background, glowing cyan #33c2e8 concentric ring + tick marks, radial, centered
```
> 接线：T1 落地把对应字段改 `art:<query>`（如 `ground.Material3D.map: "art:q-3dtex-01 albedo"`）；normal/rough 保留现 `surface`。**共用甲（03/04）省生成量**——一张钢甲 + 一张敌甲，塔/敌各色靠 `Material3D.emissive`（已在数据里）。

### 3B. bespoke glTF 模型 —— `Model3D.modelKey`（**Tripo · T4 · 非关键·优选升级**）

> 替图元升辨识度（评分卡维2 从 2→3）。Tripo 分钟级·非冲刺关键路径。3D 展示位拉动再做，否则停在图元+贴图。

| 编号 | 目标 slot | spec.scale（对齐现图元世界尺寸） | 优先 |
|---|---|---|---|
| q-mdl-01 | `tower_pulse` body `+Model3D` | 落地高 ≈52u（导入后按包围盒缩） | P2·T4 |
| q-mdl-02 | `tower_cannon` body | 高 ≈42u·径 ≈40u | P2·T4 |
| q-mdl-03/04/05 | `enemy_basic/fast/tank` body | 径≈26 / 高≈32 / 径≈40u | P2·T4 |
| q-mdl-06 | 大本营（合并 tier+spire+core） | 高 ≈100u | P2·T4 |

**提示词库（Tripo·text_to_model）**：
```
q-mdl-01 : low-poly neon sci-fi pulse tower, tall glowing cyan spire, tron style, clean topology, game asset
q-mdl-02 : low-poly sci-fi rail cannon turret, magenta energy coils, heavy base, tron style, game asset
q-mdl-03 : small hostile drone orb, hovering, neon red-pink accents, low-poly, game asset
q-mdl-04 : fast dart drone, sharp arrow shape, amber neon, low-poly, game asset
q-mdl-05 : heavy armored tank drone, purple neon, bulky, low-poly, game asset
q-mdl-06 : energy core fortress, layered spire with glowing green reactor orb on top, tron style, game asset
```

### 3C. 天空 / 环境 —— `Sky3D.envMap`（**HDRI·非 wanx**）

| 编号 | 目标 slot | 现状 | 方案 | 优先 |
|---|---|---|---|---|
| q-env-01 | `sky` · Sky3D.envMap | 程序渐变 + env 0.2 中性影室（暖·我压低了） | **vendor `env/sky-gradient`（货架·重着色冷调）** 或采一张冷夜 equirect HDRI（out of wanx）；不接则保程序化 | P2 |

> 修正前版：**wanx 出不了 HDRI**（方图 LDR·非 equirect）。故此槽不占 T1 关键路径；要冷调金属反射就 vendor 货架 env 或另采 HDRI。

---

## 4. UI 美术（LayoutNode `Image`/`Avatar` 的 `src` · wanx 2D · T1）

> UI 铁律内：只进 `Image`/`Avatar` 的 `src`（`art:` 引用）·绝不手写 DOM。透明底图标·`usage:'sprite'`·`wrap:'clamp'`·srgb·1024²（UI 侧缩放）。

| 编号 | 目标 slot（hud.ts） | 现状 | 尺寸/usage | 优先 |
|---|---|---|---|---|
| q-ui-02 | 顶栏状态图标 ♥/⬡/⚔ ×3 | emoji/字形 | 1024² sprite clamp（透明底·三图） | P1 |
| q-ui-03 | 底栏买钮缩略图 ×2（pulse/rail） | 纯文字钮 | 1024² sprite clamp（透明底） | P1 |
| q-ui-05 | 胜负浮层主视觉 ×2 | 纯文字屏 | 1024² sprite clamp | P2 |
| q-ui-01 | 标题 logo | display 艺术字（**保留**） | — | **不做**（wanx 糊字·艺术字已好） |
| q-ui-04 | HUD 面板/边框纹 | 主题色板 | 1024² sprite repeat | P2 |

**提示词库（前缀 §2·加 `transparent background, centered, single icon`）**：
```
q-ui-02a : glowing heart shield icon, cyan #2fbf87, flat, simple
q-ui-02b : glowing hexagon coin icon, gold #fbbf24, flat, simple
q-ui-02c : crossed energy swords icon (wave counter), cyan #33c2e8, flat, simple
q-ui-03a : small icon of a neon cyan #38bdf8 spire tower, flat, simple
q-ui-03b : small icon of a magenta #f472b6 rail cannon turret, flat, simple
q-ui-05a : VICTORY banner emblem, jade-green #2fbf87 laurel + energy burst (no text)
q-ui-05b : DEFEAT emblem, cracked red #ff5c7a core (no text)
q-ui-04  : seamless tileable dark sci-fi hud panel frame with thin cyan #33c2e8 trim
```
> 「无文字」硬写进 05 prompt（否则 wanx 塞糊字）。

---

## 5. 2D 精灵（`Sprite.textureKey` · billboard · wanx 2D）

> 3D 盒庭 play-field 几乎不用 2D sprite。仅：

| 编号 | 用途 | 尺寸/usage | prompt（前缀 §2） | 优先 |
|---|---|---|---|---|
| q-2d-01 | 软粒子贴图（供 §6 Vfx3D） | 512² sprite clamp（透明底·加性） | `soft radial glow particle, white core fading to transparent edges, circular` | P2 |
| q-2d-02 | 远景霓虹广告牌 billboard（可选新实体） | 1024² sprite clamp | `neon holographic billboard, glitch, sci-fi cityscape silhouette` | P3·可不做 |

---

## 6. 粒子 VFX（`Vfx3D` · **引擎能力接线·PE 活·非资产生成**）

> `Vfx3D`=引擎程序化粒子（闭集发射器 + 闭集颜色/曲线）·**摆数据即可·不需生成图**（可选挂 q-2d-01 软粒子贴图提质感）。本节=能力接线需求（PE-Q / 我），非美术管线台账。

| 编号 | 关键时刻（现状） | Vfx3D 数据要点 | 类型 |
|---|---|---|---|
| q-vfx-01 | 命中（落地淡出球） | `shape:'sphere'`·add·lifetime 0.3·speed 6·color=塔 zapTint·rate 0（爆发） | 能力接线 |
| q-vfx-02 | 死亡（淡出球） | `shape:'sphere'`·add·gravity 8·color=敌 emissive·爆发 ~24 粒 | 能力接线 |
| q-vfx-03 | 大本营（静态 Glow3D） | 常驻 `shape:'cone'`·rate 60·上喷·colorGradient 绿→青 | 能力接线 |
| q-vfx-04 | 出生门（静态盘） | 脉冲 `shape:'sphere'`·emitRadius 20·color 敌粉 | 能力接线 |

---

## 7. 音频（**冲刺后**·纲领已压后 B 件）

| 编号 | 用途 | 现状 | 优先 |
|---|---|---|---|
| q-aud-01 | SFX（建/火/中/亡/胜/负 ×6） | synth 端口（sounds.ts·可用兜底） | 冲刺后 |
| q-aud-02 | BGM synthwave 循环 | 无 | 冲刺后 |

---

## 8. 汇总 · 生成清单（管线一眼可执行）

| 优先 | 编号 | 管线 | 产物件数 |
|---|---|---|---|
| **P0** | q-3dtex-01/02/03（地台/车道/塔甲·albedo+部分 emissive） | **wanx T1** | 5 张（01/02 各 albedo+emissive·03 albedo） |
| P1 | q-3dtex-04/05/06 · q-ui-02/03 | wanx T1 | ~9 张 |
| P1 | q-vfx-01..04 | **引擎接线（PE·非资产）** | 0 张（摆数据） |
| P2 | q-mdl-01..06 | Tripo T4（非关键） | 6 glb |
| P2 | q-env-01 · q-ui-04/05 · q-2d-01 | vendor / wanx | ~5 |
| 冲刺后 | q-aud-01/02 | — | — |

> **P0 全真资产化 game-q 只需 ~5 张 wanx 图**（1024²·成套同风格锚）+ 保留现 surface/emissive/preset。换皮=换 artStyle 前缀重跑这批 → 新皮卡带。

## 9. 未决 / 需 PST·PA 会审

- **一材质多贴图槽的本地索引登记**：一个 slot 要 albedo+emissive 两条 texture 条目（+material 条目引它们）——PA 定登记形制（一次生成两图 vs 分次）·进 REQ-DEMO-T1「PA 会审契约」。
- **normal/rough 与 albedo 不对齐**（surface 通用噪声）：要对齐需「albedo→normal 派生」工具·管线暂无 → 记 gap（demo 可接受）。
- **wanx seamless 不保证**：地台/车道靠 `tiling` + 大面 + 暗底藏缝；翻车则单槽点名重生成（T2 闭环）。
- **接不接 T4 Tripo**：本表押「T1 贴图优先·glTF 押后」；owner 要 demo 直上真模型则拉 T4（成本/时延见纲领 §五）。
