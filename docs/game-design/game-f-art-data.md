# Game F 美术数据映射 —— 《像素三分天下》自走棋

> 负责人：Programmer F。配套策划案：`game-f-auto-chess.md`（设计/数据映射/分阶段；在 `claude/sharp-curie-hr606s` 分支）。
> ⛔ 宪法 `docs/design/data-driven-manifesto.md`：游戏=数据。美术是**可热插拔的皮**（`Sprite.textureKey` 只引用 id），换皮零逻辑改。
> 本文件 = 用户已拍板的美术方向 + 起手棋子的真实 asset id 映射，单一真相源。

---

## 一、方向（用户拍板 2026-06-10）：**混合 = DCSS 皮 + 三国命名**

| 决策 | 结论 | 理由 |
|---|---|---|
| 棋子/特效/棋盘/UI 美术 | **现成 DCSS 库**（`assets/FreeArtLib/`，CC0，一款真 roguelike 的完整出货美术，2063 角色 + 83 特效 + 834 地块 + 492 UI + 799 道具，**一个画风到底**） | 完整自洽、零采购、立刻能用、重心放逻辑 |
| 三国感 | 靠**命名 + 分色 + 技能名**（头顶名字精灵 = 赵云/关羽…；技能名 七进七出…）。**名牌颜色 2026-06-10 用户拍板改读队伍**（我方红/敌方蓝）——实测三势力色（蜀红/魏蓝/吴绿、两边各一吴）看不出谁打谁；势力色降级为羁绊期徽记/描边通道（数据 tint 已留） | 投资人认知主要来自主题可读 + **阵营可读优先于势力风味** |
| 真三国美术 | **后续整套换皮目标**（每英雄 key → 真三国 sprite），纯数据替换 | 数据驱动架构使美术是单行道之外的可换皮层 |

> 三国头像（用户曾下载的 4 张）方案**暂缓**：4 张静态脸 ≠ 一局棋的美术（缺战斗精灵/特效/棋盘/UI、且补齐全套难统一）。留作未来换皮素材。

## 二、分势力换色的工程事实（落地约束）

渲染器 `canvas-renderer.ts:137` 的 `drawImage` **不应用 `Color.tint`**（tint 只染**无贴图**时的占位方块 fillStyle / 以及 `Text` 的 fillStyle）。因此：

- **MVP-0 占位阶段**：棋子用势力色占位 token（内联 SVG，红蜀/蓝魏），一眼分阵营，零外部图。
- **头顶名字**：`Text` + `Color{tint:队伍色}` → 名字着色承担**阵营**分色（Text 走 fillStyle，吃 tint）。（原势力色方案 2026-06-10 经实测回退：吴绿横跨两队，阵营不可读；势力分色待羁绊期换徽记/描边通道。）
- **真 DCSS 皮阶段**：换色**不能**靠 tint。两条路 → **(a) 每势力一张预染 sheet**（纯数据，多几个 key，推荐）｜(b) 提引擎需求给渲染器加 sprite 染色（`globalCompositeOperation:'multiply'`/离屏，**交主程**）。

## 三、起手棋子映射（MVP-0 骨架，6 英雄两队）

> 占位 textureKey 已在 `games/game-f/assets.ts` 声明（势力色 token）。**真皮列**= 将来 1:1 换的 FreeArtLib DCSS id（已在货架核实存在）。

| 英雄 | 势力(队/色) | 职业 | 占位 textureKey | 真皮 DCSS id（FreeArtLib） | 技能名(后续) |
|---|---|---|---|---|---|
| 关羽 | 蜀 / TEAM_A / 红 | 武将 | `f.hero.guan_yu` | `monster/death_knight` | 青龙偃月 |
| 赵云 | 蜀 / TEAM_A / 红 | 武将 | `f.hero.zhao_yun` | `monster/deep_elf_knight_new` | 七进七出 |
| 诸葛亮 | 蜀 / TEAM_A / 红 | 谋士 | `f.hero.zhuge_liang` | `monster/deep_elf_mage` | 八阵图 |
| 张辽 | 魏 / TEAM_B / 蓝 | 武将 | `f.hero.zhang_liao` | `monster/hell_knight_new` | 突阵 |
| 许褚 | 魏 / TEAM_B / 蓝 | 武将 | `f.hero.xu_chu` | `monster/deep_elf_soldier` | 虎痴 |
| 司马懿 | 魏 / TEAM_B / 蓝 | 谋士 | `f.hero.sima_yi` | `monster/necromancer_new` | 鹰视狼顾 |

**特效**：普攻打击 = `f.fx.strike`（占位斩光）→ 真皮 `effect/cloud_fire`/`effect/crystal_spear` 等。
**棋盘**：竞技场背景 → 真皮 `dungeon/floor/*`（暖色 `cobble_blood` / 冷色 `black_cobalt`）。
**扩充羁绊样本（后续阶段）**：黄忠`deep_elf_master_archer`(弓·蜀)、周瑜`naga_mage`(谋·吴)、甘宁`deep_elf_soldier`(刺·吴)。

## 四、入库路径（真皮接线，后续做）

1. DCSS 图实体在 `assets/FreeArtLib/{cat}/`（已在仓库）；`src/assets/artlib.ts` 提供货架 id → descriptor 的桥。
2. 选中的 DCSS id 落进 game-f 的资产清单（替换占位 src，key 不变）→ `Sprite.textureKey` 引用即穿皮，**逻辑零改**。
3. 走 R9 asset-flow（`docs/workflow/asset-flow.md`）：声明 key → 占位先跑 → 后填真图。

## 五、美术不阻塞逻辑

MVP-0 验收靠 vitest 确定性 + 离屏看帧；占位 token 已够验证战斗闭环。真 DCSS 穿皮是独立的后续增量（换 `assets.ts` 里的 src，或接 artlib 桥）。
