# 共享美术库 · 分类 Tag 标准（FreeArtLib）

> `assets/FreeArtLib/` = **Dungeon Crawl Stone Soup（DCSS）32×32 tiles**，**CC0（公共领域，可商用，署名从优）**。6029 张 PNG → **4761 个逻辑资产**（同 subject 的变体合一），全 32×32。供**所有游戏 ref/copy**。
> 索引：`assets/FreeArtLib/index.json`（`scripts/build-artlib-index.mjs` 生成）；助手：`src/assets/artlib.ts`。
>
> **数字为建库快照（2026-06）——实时资产数以 `assets/FreeArtLib/index.json`（`.assets.length`，现约 4.9k）为准；本文下方分类占比同为快照，不逐次追平（机读真相铁律：手抄会动的数必漂）。**

## 1. Tag 标准 = 5 个结构维度（其余标签由它们派生，不冗存）
| 维度 | 含义 | 取值 |
|---|---|---|
| `cat` | 顶层分类（=顶层目录） | dungeon · monster · player · item · gui · misc · effect · emissaries |
| `sub` | 子目录路径 | 如 `weapon`/`armor/torso`/`undead/spectrals`/`spells/necromancy`（'' = 直属 cat） |
| `subject` | 主题名（文件名去掉 `_<数字>` 变体） | 如 `axe`/`acidic_floor`/`skeleton_warrior` |
| `slot` | **怎么用**（看样图定，见 §2） | tile · sprite.character · sprite.paperdoll · icon.item · icon.ui · fx · decal |
| `variants` | 变体张数 | 如 floor 4 张随机平铺、arrow 8 向 |

**搜索标签（tag）= `cat + sub 各段 + subject 各词 + slot 词根`**，由 `artlibTokens()` 现算（不入库，省 ~半体积）。例：`monster/undead/skeleton_warrior` → `[monster, undead, skeleton, warrior, sprite, character]`。

## 2. slot → 各游戏怎么消费（核心：ref/copy 的对接表）
slot 是从**看样图**定的语义（名字看不出"透明/可平铺/分层"）：
| slot | 是什么（样图特征） | 透明 | Apollo 怎么用 | 来自 cat |
|---|---|---|---|---|
| `tile` | 不透明、可平铺地形 | 否 | **Tilemap 瓦片** / 背景 | dungeon |
| `sprite.character` | 透明居中的生物/角色 | 是 | `Sprite.textureKey`（怪/NPC/英雄） | monster · emissaries |
| `sprite.paperdoll` | 纸娃娃**分层**（base+body+head+hands 叠合成一个角色） | 是 | 多 Sprite 叠合，或取单层当整图 | player |
| `icon.item` | 透明物品图标 | 是 | 拾取物 / 背包 Sprite | item |
| `icon.ui` | UI/法术/技能图标 | 是 | 技能栏/按钮（表现层） | gui |
| `fx` | 透明特效/投射物（常带方向变体） | 是 | caster/prefab 生成的投射物 Sprite | effect |
| `decal` | 血迹/铭牌/旗帜等叠加 | 是 | 装饰叠加 Sprite | misc |

## 3. 分类汇总（4761 资产）
| cat | 资产数 | slot | 子类示例 |
|---|---|---|---|
| monster | 1207 | sprite.character | animals · demons · undead · unique · panlord · statues · nonliving |
| player | 856 | sprite.paperdoll | base · body · head · hand_left · hand_right |
| dungeon | 834 | tile | floor · wall · water · altars · gateways · statues · sigils |
| item | 799 | icon.item | weapon · armor · ring · potion · book · food |
| gui | 492 | icon.ui | spells/* · skills |
| misc | 478 | decal | blood · brands · banners |
| effect | 83 | fx | arrow · bolt · 各类投射/爆 |
| emissaries | 12 | sprite.character | — |

## 4. 怎么 ref/copy（数据驱动对接）
- **稳定 key = `id`**（=`cat/sub/subject`，如 `item/weapon/axe`、`dungeon/floor/grass`）。游戏 manifest 里 `Sprite.textureKey = id`（或 Tilemap 引 tile id）即"引用"；资产系统按 id 找文件。
- **检索**：`searchArtlib(index, '剑', {slot:'icon.item'})`、`searchArtlib(index, 'undead', {cat:'monster'})` → 返回候选资产，挑一个填进数据。
- **取文件**：`artlibDir(index,a)` = 文件夹；`artlibGlob(index,a)` = `<dir>/<subject>*.png`（变体编号**非 0 基连续**，用 glob 找真实文件，别假设 0..n-1）。
- 与现有 `assets/index.json`（AssetIndex：filled/tbf + AssetManager 注册 + R12 `validateAssetRefs`）互补：FreeArtLib 是**素材货架**（按 tag 选），选中后把 id 落进游戏的资产清单即纳入加载/校验闭环。

## 5. "从图像 + 从名字"的分工（诚实说明）
- **从名字**（自动、覆盖全部 4761）：`cat/sub/subject/variants` 全由目录+文件名派生 → `scripts/build-artlib-index.mjs`。
- **从图像**（人工看代表样图，编码进规则）：`slot` 语义、`transparent`、风格(32px DCSS) —— 这些名字看不出，靠看 floor/monster/item/effect/player/gui 各取样确认（如 `player/body/aragorn` 是**纸娃娃躯干层**不是整角色、dungeon 是**不透明可平铺**、effect 带**方向变体**）。逐资产的视觉精标（"这把是火剑"）未做，需要时按 slot 二次人工/VLM 标注。

## 6. 维护
库增删后重跑：`node scripts/build-artlib-index.mjs` → 刷新 `index.json`。新顶层分类需在脚本 `SLOT` 表登记其槽位。
