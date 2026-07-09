# game-q《Neon Siege》资产需求表（对 PST 美术自动生成管线 · REQ-DEMO-T1）

> 立：LEAD（game-q 建造者本人）· 2026-07-08 · 应 owner「看 PST 新管线 → 重 review game-q 需求资产 → 出需求表（分 UI/2D/3D/粒子）」。
> 用途：给 **REQ-DEMO-T1 美术编排步**一份 game-q 的**皮肤槽清单**——每行=一个 `art:` 可钉死的槽位 + 查询词 + 风格锚 + 管线路径 + 优先级。
> 现状基线：game-q 3D 版**全程序化**（Mesh3D 图元 + Material3D 预设 + 程序化 surface·**零真资产·零 art: 引用**）——正是纲领点名的「有皮肤槽才换得了皮」的反面，本表即其整改单。

## 0. Lead 判读（先说结论·CORE RULE 评判）

1. **接受本需求**（非回驳）：game-q 当前零皮肤槽，管线无处施力 → 定义槽位是「换皮前提」的正题，不是过度设计。
2. **最大杠杆＝2D PBR 贴图（T1/千问 wanx·关键路径），不是 bespoke glTF（T4/Tripo·非关键）。** 理由：game-q 是 3D，但冲刺主力管线是 **2D**；`Material3D` 早有 `map/normalMap/roughnessMap/emissiveMap` 槽，给现成图元**贴真贴图**即从「精修图元组合(评分卡维2底线)」升到「图元+真材质」，且**走 T1 千问 2D 关键路径**——比等 Tripo 出模型便宜一个量级。**这也修正了我在 capability-plan §8.3 记的「英雄模型 blocker」**：blocker 只卡 glTF；真**贴图**在 T1 路上够得着。
3. **「粒子」多数是引擎能力接线（摆 `Vfx3D` 数据·PE 活），不是资产生成需求**——诚实归类，别混进美术管线台账充数。
4. **音频照纲领压到冲刺后**（现 synth 兜底可用）。
5. **风格锚统一钉死**（一致性五层防线 层1+层2）：`stylePack=霓虹合成波`（neon synthwave / Tron）· 冷青-品红-绿 on 暗底 · 自发光辉光 · **全款同一 provider+model+seed**。下表每行 query 只写主体词，风格前缀由 artStyle 注入。

## 1. UI 美术（LayoutNode `Image`/`Avatar` 的 `src` · 千问 2D · T1）

> UI 铁律内：资产只进 `Image`/`Avatar` 控件的 `src`（或做主题令牌），**绝不手写 DOM**。现状=艺术字/emoji 字形兜底（可用底线），下列为 polish。

| 编号 | 槽位（hud.ts） | 现状 | 目标资产 | query | 优先级 |
|---|---|---|---|---|---|
| q-ui-01 | 顶栏标题 `NEON SIEGE` | display 艺术字 | logo 图（横版发光字标） | `neon siege wordmark logo, glowing` | P2·polish |
| q-ui-02 | 顶栏状态图标 ♥/⬡/⚔ | emoji/字形 | 图标三件（生命/金币/波次·统一描边） | `hud icon set: heart shield, hex coin, wave` | P1 |
| q-ui-03 | 底栏买钮 PULSE/RAIL | 纯文字钮 | 塔缩略图标（两塔剪影） | `tower thumbnail icon, {pulse spire / rail turret}` | P1 |
| q-ui-04 | 顶/底栏底 + 胜负浮层底 | 主题色板 | 面板/边框纹理（发光电路边） | `sci-fi hud panel frame, circuit trim` | P2 |
| q-ui-05 | 胜负浮层 Screen | 纯文字屏 | victory/defeat 主视觉图 | `victory / defeat banner art, neon` | P2 |

## 2. 2D 精灵（`Sprite.textureKey` · billboard · 千问 2D）

> game-q 是 3D 盒庭，play-field **几乎不用 2D sprite**（主体走 3D 图元）。仅少量 billboard 装饰有价值。

| 编号 | 槽位 | 现状 | 目标资产 | query | 优先级 |
|---|---|---|---|---|---|
| q-2d-01 | 远景/氛围 billboard（可选新增实体） | 无 | 漂浮碎片/霓虹广告牌 billboard | `floating neon billboard, holo debris` | P3·可不做 |
| q-2d-02 | 软粒子贴图（供 §4 Vfx3D 用） | 加性球 | 柔光粒子 sprite（radial soft） | `soft glow particle sprite, additive` | P2（连 §4） |

## 3. 3D 资产（关键区·两条路：3A 贴图=T1 主力 / 3B 模型=T4 可选）

### 3A. PBR 贴图 —— `Material3D` 的 map/normalMap/roughnessMap/emissiveMap（**千问 2D · T1 关键路径 · 最高杠杆**）

> 给现成 Mesh3D 图元贴真贴图·不换几何。`art:` 引用直接进这些字段（resolveArtRefs 遍历全字段·field-agnostic）。**这是 game-q 真资产化的主力路。**

| 编号 | 槽位（blueprint.ts 实体·Material3D 字段） | 现状 | 目标贴图集 | query | 优先级 |
|---|---|---|---|---|---|
| q-3dtex-01 | `ground`（地台）·map+normal+rough(+emissive) | matte + 程序 noise | 霓虹科技地砖（六边格纹+发光缝） | `sci-fi hex floor panel, glowing seams, top-down tileable` | **P0** |
| q-3dtex-02 | `track-seg-*`（车道）·map+emissive | steel + 低自发光 | 能量电路道面（数据流纹·可平铺） | `energy circuit road, data stream, tileable` | **P0** |
| q-3dtex-03 | `tower_pulse/cannon` body·map+normal+rough+metal | steel 预设 | 科幻塔装甲（拉丝金属+发光条） | `sci-fi tower armor plating, brushed metal, emissive strips` | **P0** |
| q-3dtex-04 | `enemy_basic/fast/tank` body·map+normal | plastic/steel | 敌甲壳（三型可共一套调色·晶体/合金） | `drone carapace, crystalline alloy` | P1 |
| q-3dtex-05 | `base-tier/spire`（大本营）·map+normal+emissive | steel | 要塞面板（核心堡·发光核纹） | `energy fortress panel, reactor core glow` | P1 |
| q-3dtex-06 | `pad-*-p`（建造位）·map+emissive | steel + 边光 | 全息建造台（环形 HUD 纹） | `holographic build pad, ring hud` | P1 |

### 3B. bespoke glTF 模型 —— `Model3D.modelKey`（**Tripo 3D · T4 · 非关键路径·优选升级**）

> 用真模型替图元·辨识度 +1（评分卡维2 从 2→3 的路）。但 Tripo=T4/P1、**不在冲刺关键路径**；3A 贴图已够 demo。**3D 展示位被拉动时再做**，否则记 blocker 停在图元。

| 编号 | 槽位（*_body·加 Model3D） | 现状 | 目标模型 | query | 优先级 |
|---|---|---|---|---|---|
| q-mdl-01/02 | 两塔身 | cone/cylinder 图元 | 脉冲尖塔 / 轨道炮台 glTF | `{neon pulse spire tower / rail cannon turret}, low-poly sci-fi` | P2·T4 |
| q-mdl-03/04/05 | 三敌身 | sphere/cone/cylinder | 无人机/飞镖/重装 glTF | `hostile drone {orb / dart / heavy tank}, neon` | P2·T4 |
| q-mdl-06 | 大本营 | box 堆叠 | 能量核心堡 glTF | `energy core fortress, reactor` | P2·T4 |

### 3C. 天空/环境 —— `Sky3D.envMap`（HDRI · 全景图·千问 2D 可近似）

| 编号 | 槽位 | 现状 | 目标资产 | query | 优先级 |
|---|---|---|---|---|---|
| q-env-01 | `sky`·Sky3D.envMap | 程序渐变 + env 0.2 中性影室 | 冷调霓虹夜 HDRI/equirect | `night neon city skybox, cool tone, equirectangular` | P1 |

> **为何 P1**：我为消暖染把 env 压到 0.2（RoomEnvironment 是暖影室·掠射角把地台反成橄榄）。一张**冷调** HDRI 既修金属反射又不带暖污 → 直接抬维4材质 + 维5渲染。

## 4. 粒子 VFX（`Vfx3D` · **引擎能力接线·PE 活·非资产生成**）

> 诚实归类：`Vfx3D` 是引擎程序化粒子（闭集发射器 + 闭集颜色/曲线）——**摆数据即可，不需生成图**。仅"软粒子贴图"(q-2d-02) 是可选 2D 资产。故本节主体是**能力接线需求**（PE-Q / 我），非美术管线台账。

| 编号 | 关键时刻（现状） | 目标（Vfx3D 数据） | 类型 |
|---|---|---|---|
| q-vfx-01 | 命中闪（现落地淡出球） | 命中火花迸射（add·短寿·青/品红随塔） | 能力接线 |
| q-vfx-02 | 死亡爆闪（现淡出球） | 碎裂爆发粒子（按敌色·gravity 下坠） | 能力接线 |
| q-vfx-03 | 大本营（现静态 Glow3D） | 核心能量喷泉（常驻 cone 发射·氛围） | 能力接线 |
| q-vfx-04 | 出生门（现静态盘） | 传送涌出粒子（sphere·脉冲） | 能力接线 |

> 落地：把 `zapTemplate/burstTemplate` 的淡出球升成 `Vfx3D`；base/portal 加常驻发射器。**零外部资产**（可选挂 q-2d-02 软粒子贴图提质感）。

## 5. 音频（**冲刺后**·纲领已压后 B 件）

| 编号 | 用途 | 现状 | 优先级 |
|---|---|---|---|
| q-aud-01 | SFX（建塔/开火/命中/死亡/胜/负） | synth 合成端口（sounds.ts·可用兜底） | 冲刺后 |
| q-aud-02 | BGM synthwave 循环 | 无 | 冲刺后 |

## 6. 汇总 · 优先级与管线路径

| 优先 | 条目 | 管线路径 | 一句话 |
|---|---|---|---|
| **P0** | q-3dtex-01/02/03（地台/车道/塔·PBR 贴图） | **T1 千问 2D** | game-q 真资产化主力·最大观感杠杆·关键路径 |
| P1 | q-3dtex-04/05/06 · q-env-01(HDRI) · q-ui-02/03(图标) | T1 千问 2D | 成套铺满·修 env 暖染取舍 |
| P1 | q-vfx-01..04 | **引擎接线（PE·非资产）** | Vfx3D 数据·关键时刻反馈 |
| P2 | q-mdl-01..06（bespoke glTF） | T4 Tripo（非关键） | 辨识度升级·3D 展示位拉动再做 |
| P2 | q-ui-01/04/05 · q-2d-02 | T1 千问 2D | UI polish + 软粒子 |
| 冲刺后 | q-aud-01/02 | — | 音频 B 件 |

**换皮就绪度**：本表 = game-q 的 `artStyle` 皮肤槽清单。全部走 `art:` 引用钉死 → 换风格锚(如「像素」「水墨」)重跑美术编排即出新皮卡带（纲领「同玩法×新风格锚=新卡带」）。**T1 落地时按本表把 blueprint.ts 对应字段改成 `art:<query>`、每游戏本地目录出 art-ledger.json（编号 q-3dtex-01… 与本表对齐·重跑不漂移）。**

## 7. 未决 / 需 PST·PA 会审

- **art: 引用进 `Material3D` 贴图字段的端到端**：resolveArtRefs 是 field-agnostic（遍历全字段），但需 PA 确认本地索引/asset-index 对「一个材质多贴图槽(map+normal+rough+emissive 同题一组)」的登记形制（一次生成出一套 PBR 图 vs 分四次）。→ 走 REQ-DEMO-T1 的「PA 会审契约」。
- **3D 图元 + 贴图 vs bespoke 模型的取舍**：本表押注「T1 贴图优先、glTF 押后」。若 owner 要 demo 直接上真模型，则拉 T4/Tripo（成本/时延见纲领 §五）。
