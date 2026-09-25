# 星尾馆 · 空间框架与美术设定（hall-framework v1）

> **owner 2026-09-25 口述**：「最需要改进的是我的营业场所——喵星馆。它本身的美术设定、馆里的互动按钮；可以设成**可扩展的多房间**，很多房间去扩建；所以要有**地图**；先把外面的框架形态设定清楚。」另：「需要一个非常强的美术设计风格，接纳这些喵星宝宝，需要美术出图。」
> **本稿三件事**：① 馆的**形态框架**（房间 · 地图 · 热点 · 扩建循环 · 能力映射）② 馆的**美术设定**（art bible + 风格包 + 提示词模板）③ **出图清单**（有槽即入台账，无槽的按框架落地顺序排队）。
> **上位文档**：`gdd.md`（世界观 §3 · 场景 §13）· `menu-flow.md` · `ui-visual-handoff.md` · `claude-design-spec.md`（逐屏规格）。GDD §16.2 把「复杂房间自由装修」列为延后项——本框架**不是自由装修**，是「房间解锁 + 固定位摆放」，与 GDD 不冲突；多房间本身是 owner 2026-09-25 直令，压过 §13.1「首版六场景」的单厅假设。
> **作者**：GD/PE-112 · 2026-09-25。

---

## 0. 先评判：该不该做 · 能不能用现有能力表达

| 需求 | 判定 | 怎么表达（对 registry 实名） |
|---|---|---|
| 多房间 | ✅ 做·纯数据 | 房间 = `world-data.ts` 一张表（id/镜头/热点/解锁条件）；每房一屏（`buildRoom(roomId)` 查表出 LayoutNode）；当前房间 = `x3-string-variable`（同 `activeCat`） |
| 房间解锁/扩建 | ✅ 做·纯数据 | `t2-craft-recipe`（costs 星砂 → grantsFlag `room.<id>.open`）+ `t2-event-when`（心光/前置房间门槛·edge）——**与杂货铺同一条路** |
| 地图 | ✅ 做·纯数据 | 一屏：`Screen.image`（手绘馆图）+ 每房一块 `Panel{skin, action:'room.enter', x,y}` 绝对定位热点；锁态 = `visibleWhen` 切轮廓皮 |
| 房间里的互动按钮（热点物件） | ✅ 做·纯数据 | 现有 `hotspot()` 升级：`Panel{skin:<物件图>, action, x,y}` 叠在 `Screen.image` 房间背景上；「物件即入口」 |
| 房间美术可换 | ✅ 有槽 | `Screen.image` / `Panel.skin` 走 `SKIN_OVERRIDES[skinKey]`（art-pipeline「皮肤槽」铁律） |
| 猫在哪个房间·离线事件按房间 | ✅ 纯数据 | 离线事件表加 `room` 字段；`t2-weighted-spawn` 按房间取表（同现在按档取表） |
| 自由拖拽装修 | ⏸ 延后（GDD §16.2） | 真要做时 `t2-drag-place` + `t2-drop-zone` 已在 registry，不是缺口 |

**结论：零引擎缺口，零游戏层 system。** 全部落在数据表 + 现有能力 + LayoutNode 闭集。不上引擎池。

---

## 1. 形态总述

**星尾馆是什么**：喵星上一栋被很多猫住过的老房子。不是天堂，不是咖啡店搬到太空——是「被记住的猫回来住的地方」。玩家是这栋房子的看馆人：把房间一间间收拾出来，猫就多一处可以待的地方；每间房都有它留下的痕迹。「接纳」的意思是：**每一只喵星宝宝到这里都有一个位置，不用争、不用养、不会失去。**

**空间层级（五层·每层一种数据）**

```
馆（1 栋）
 └ 房间（可扩展·表驱动·v1 十间）
    └ 固定镜头（每房一张背景插画 + 一块猫画面层矩形 + 安全区）
       └ 热点物件（每房 2–5 个·物件即入口·绝对定位·三态）
          └ 猫画面层（趴 / 注意 / 将来视频·随房间换锚图）
```

**导航形态**
- 主厅仍是首页（menu-flow §0.2）；底栏五入口不变。
- **馆图入口**放在左上角「猫名」旁的**房间名标签**（`room-label`「星尾馆 · 主厅 ▾」·`map.open`）——点它开馆图；不占底栏、不占右上 ⚙ 区。
- 房间之间**只经馆图**切换（一次只做一件事·固定镜头不做平移）；例外：主厅三热点直达晶球厅/牌桌/玩具篮（沿用）。
- 「只看它」在每个房间都有效（同一 Flag）。

---

## 2. 馆图（S15）

**形态建议 A · 手绘剖面图**（推荐）：像绘本的房子剖面——两三层楼、房间并排、能看到每间房里的一点点摆设和猫的剪影；未解锁的房间是**铅笔轮廓 + 一句线索**（「这里以前是……」）。
**形态 B · 平面图**：俯视格子图。信息效率高但没有「家」的感觉。**推荐 A**，等 owner 判。

**屏结构**（LayoutNode）
```
Screen{image: game112/map/hall}                      ← 手绘剖面（1920×1080 cover）
  Panel(bare, 绝对坐标层)
    Panel{skin: game112/map/room-<id>, action:'room.enter', actionArg:<id>, x,y,w,h}  ×N  ← 开放房：亮
    Panel{skin: game112/map/room-<id>-locked, action:'room.peek', x,y}                ×M  ← 锁房：轮廓 + 线索
    Float{anchorTo: 当前房} → Tag「雪团在这里」                                          ← 猫的位置
  navbar
```
**房间三态**
| 态 | 画面 | 点了发生什么 |
|---|---|---|
| `locked` | 铅笔轮廓 + 一句线索 + 「星砂 N · 心光 M」 | `room.peek` → dialog 一段介绍 + 「收拾出来」（`room.unlock`·可负担才成交） |
| `open` | 满色插画缩略 + 房名 | `room.enter` → 进房 |
| `open + 有新东西` | 缩略角落一枚柔和星光（不是红点） | 同上 |

---

## 3. 房间表 v1（十间·前四间 = Loop-0 已有场景归位）

| # | id | 房名 | 用途 · 主活动 | 固定镜头 | 热点物件（→ action） | 解锁 | 猫在这里会…（离线事件池） |
|---|---|---|---|---|---|---|---|
| 1 | `hall` | 主厅 | 回馆问候 · 陪伴 · 三入口 | 中景·旧木长桌 | 忆光晶球→`orbs.open` · 牌桌→`table.open` · 玩具篮→`toys.open` · 门→`map.open` | 开局即开 | 藏牌进纸袋 · 叼玩具到桌边 · 打翻杯垫 |
| 2 | `orbs` | 晶球厅 | 遇见猫 · 相认 · 进记忆 | 缓慢展示镜头（不可自由转） | 每颗晶球→`orb.pick` · 空晶球→`upload.start` | 开局即开 | 蹭晶球底座 · 看着某颗晶球发呆 |
| 3 | `cardroom` | 星牌室 | 星爪牌 | 桌面略俯视 | 牌桌→`table.open` · 牌背架→`shop.open`(牌具) | 开局即开（牌规待 owner） | 压牌 · 把牌推乱 · 趴在牌堆上 |
| 4 | `gallery` | 回忆廊 | 章节 · 相册 | 稍暗·一条光带 | 每颗记忆晶球→`memory.read` · 相册→`album.open` | 开局即开 | 在光带下打盹 |
| 5 | `playroom` | 玩具间 | 逗猫（视频形态）· 玩具收纳 | 低机位（`scene-cat-play` 锚） | 玩具篮→`toys.open` · 纸袋/羽毛杆/纸箱→`play.start`+玩具 | 星砂 40 · 心光 4 | 伏击 · 钻纸袋 · 把毛线球滚到门口 |
| 6 | `sunroom` | 窗台 | 安静陪伴 · 观星 · 睡 | 侧光·大窗·软垫 | 软垫→`cat.sit`(变体「陪它晒一会儿」) · 窗→`sky.watch` | 星砂 60 · 心光 10 | 睡出一圈压平的毛 · 盯窗外的星轨 |
| 7 | `pantry` | 茶水间 | 主人的痕迹（杯印故事线）· 布置 | 近景·橱柜 | 杯子→`memory.read`(杯印章) · 橱柜→`decor.place` | 星砂 60 · 首章读完 | 把杯垫叼走 · 蹲在橱柜顶 |
| 8 | `attic` | 阁楼 | 旧物 · 记忆线索 · 未解锁章节的「轮廓」 | 仰视·斜顶·灰尘光 | 旧箱→`memory.clue` · 旧照片→`album.open` | 星砂 80 · 心光 20 | 从阁楼带回一枚无价值小物件 |
| 9 | `garden` | 星庭 | 室外 · 夜 · 多猫将来同场 | 远景·星轨·月相 | 石凳→`cat.sit` · 猫爪星座刻纹→`sky.watch` | 星砂 100 · 心光 30 | 在星轨下追影子 |
| 10 | `shopfront` | 星砂杂货铺 | 交换玩具/家具/牌具 | 场景化货架 | 货架→`shop.open` | 开局即开（馆门外） | —（店主是另一只猫·将来） |

**扩建循环**：陪伴 → 星砂 + 心光 → 收拾一间房 → 新热点 / 新互动 / 新离线事件 / 新章节入口 → 猫有更多地方可以待 → 回到陪伴。**永不**：房间退化、灰尘惩罚、过期。

**数据形状（`world-data.ts` 预演·纯数据）**
```ts
interface Room {
  id: string; name: string; camera: 'mid' | 'low' | 'top' | 'wide';
  unlock: { stardust: number; heartlight: number; after?: string } | 'start';
  hotspots: { id: string; label: string; action: string; arg?: string; x: number; y: number; w: number; h: number }[];
  clue: string;               // 锁态一句线索
  offlinePool: string[];      // 离线事件 id
  skin: { scene: string; mapThumb: string; mapLocked: string };   // skinKey ×3
}
```

---

## 4. 热点与交互按钮的语言

- **物件即入口**：不做悬浮大按钮；热点 = 房间里本来就有的东西（晶球、牌桌、篮子、杯子、窗）。悬停/聚焦时物件**微亮 + 抬起 3px**（`press3d` + `sheen-hover`），不加描边框。
- **三态**：可点（正常）· 待解锁（物件在但蒙一层薄灰纱 + 一句「还差 N」）· 有新内容（角落一枚柔和星光·`Particles(sparkle)` 极低密度）。
- **安全区**：每房背景插画在出图时**留出**——上 12% 顶栏带、下 18% 导航与陪伴键带、右上 120×56 壳层 ⚙ 区；猫画面层矩形位置每房固定（表里给 x,y,w,h）。
- **动作词表新增**（工程扩表时标「新增」）：`map.open` · `room.enter`+id · `room.peek`+id · `room.unlock`+id · `orb.pick`+cat · `sky.watch` · `play.start`+toy · `memory.clue`+id · `album.open`。

---

## 5. 美术设定（art bible）

### 5.1 一句话

**「被很多猫住过的老房子，窗外是喵星的夜。」** 高保真的猫 + 轻绘本的空间；暖实用灯光 × 雾青星光；每一处都有磨损、歪斜、遮挡、不成套。

### 5.2 五条支柱

1. **猫是真的，房子是画的**：猫走高保真（毛、眼、鼻、肉垫可信），空间走轻度风格化（笔触可见、透视略松、边缘不精确）。两者靠**同一套光**缝合。
2. **有人生活过**：杯印、划痕、卷角的牌、陷下去的软垫、贴歪的照片、磨白的门槛。反对：全新、成套、对称、样板间。
3. **暖冷两种光，不是蓝橙滤镜**：室内是琥珀灯与旧木的暖；窗外与晶球是雾青月白的冷。冷光**只从窗和晶球来**，不铺满。
4. **喵星只做刻纹**：猫爪星座是刻在门楣/杯底/牌背上的稀疏纹样；月相与星轨在窗外和牌面；磨砂晶球内有流动微光和照片残影。**不做霓虹、不做太空酒吧、不做天堂符号。**
5. **接纳**：每间房都有「给猫留的位置」——软垫、窗台、纸箱、椅子上的毯子。空的位置也画出来（它随时可以来）。

### 5.3 调色板（写进风格包·palette-snap 可选）

| 角色 | 色 | hex |
|---|---|---|
| 燕麦（墙/纸/布） | 暖米 | `#e9dcc3` |
| 旧木（桌/地板/梁） | 中木 | `#8c6a4e` |
| 深木（阴影/家具腿） | 深棕 | `#5a4032` |
| 琥珀灯 | 灯光 | `#e0a94e` |
| 布面墨绿（毯/椅） | 墨绿 | `#4f6b5a` |
| 格纹红（毯/杯） | 砖红 | `#a8503f` |
| 雾青（窗外/晶球） | 冷 | `#9fb4b8` |
| 灰蓝（夜空/远景） | 冷深 | `#6f86a3` |
| 月白（高光/星） | 亮 | `#f4f1ea` |
| 心光（乳金） | 关系/回忆 | `#efd9a0` |
| 黄铜（星砂） | 经济 | `#b8892f` |
| 磨砂晶（晶球体） | 淡蓝白 | `#c9d6e6` |

### 5.4 材质 · 光 · 镜头

- 材质：粗纹旧木、亚麻与格纹毛毯、无涂层厚纸、磨砂晶体、黄铜小件、藤篮、旧照片（边缘发黄）。
- 光：主光 = 桌灯/壁灯（暖·3200K 感），辅光 = 窗外星光（冷·低强度），**无标准电影轮廓光**；允许一角过曝、一角黑。
- 镜头：每房**一个固定机位**（表 §3）；透视略松（绘本感）；地平线偏低使家具有体量；猫画面层区域**留白干净**（猫是另一层贴上去的）。
- 尺寸：房间背景 **1920×1080**（`Screen.image` cover · 安全区见 §4）；馆图 1920×1080；热点物件 **512×512 透明底**；馆图房间缩略 **480×320**；猫锚图 **840×600 透明底**。

### 5.5 反面清单（提示词 negative 直接用）

AI 豪华咖啡厅 · 粉色霓虹猫爪 · 太空酒吧 · 天堂/十字/翅膀/光环 · 完全对称 · 样板间软装 · 每个角落都清晰的景深 · 完美轮廓光 · 飞散细毛的离线渲染感 · 红点/角标/货币图标 · 文字与水印。

### 5.6 风格包（导入创作台·本地风格）

文件：`docs/design/game112/style-pack.starlit-lived-in.json`（形状同 `scripts/style-packs.json` 内置包）。导入：
```bash
node -e "import('./scripts/style-packs.mjs').then(m=>console.log(m.saveLocalStyle(JSON.parse(require('fs').readFileSync('docs/design/game112/style-pack.starlit-lived-in.json','utf8')))))"
```
参考图（`refImage`）= `visual/cat-art-direction-ragdoll-v2-lived-in.png`（供应商支持参考图时挂上，保证猫的身份与房子的质感一致）。

### 5.7 提示词模板（四类·中英各一·platform 拼装：`prompt` > `query+desc`）

**A · 房间背景**（1920×1080·cover·留安全区）
> EN: `storybook interior of an old house on Cat Star, {room}, {camera}, warm amber lamplight from the left, faint cool starlight through the window, worn oak table with cup rings, plaid blanket, frosted memory orb glowing softly, visible brushwork, slightly loose perspective, lived-in imperfections, empty cushion left for a cat, clean empty rectangle at {cat-area} for compositing, no cat, no text`
> ZH: `喵星上一栋老房子的绘本风室内，{房间}，{镜头}，左侧琥珀灯暖光，窗外透进微弱雾青星光，旧橡木桌带杯印，格纹毛毯，磨砂忆光晶球微亮，笔触可见，透视略松，有人生活过的痕迹，给猫留的空软垫，{猫区}留白干净供合成，无猫，无文字`

**B · 热点物件**（512×512·透明底·单体）
> EN: `single {object}, well used, slightly crooked, warm lamplight, storybook painterly, cozy old house prop, isolated on transparent background, no text`
> ZH: `单个{物件}，用旧了，略歪，暖灯光，绘本笔触，老房子里的旧物，透明底，无文字`

**C · 馆图**（1920×1080·手绘剖面）
> EN: `hand-drawn cutaway illustration of a two-story old house on Cat Star at night, rooms side by side each with a tiny scene and a cat silhouette, some rooms only pencil outlines, warm windows against a misty teal starry sky, moon phases and a faint paw-print constellation, storybook map, no text`
> ZH: `喵星夜里一栋两层老房子的手绘剖面图，房间并排各有一个小场景和猫的剪影，部分房间只有铅笔轮廓，暖窗对着雾青星空，月相与淡淡的猫爪星座，绘本地图，无文字`

**D · 猫锚图**（840×600·透明底·身份稳定）
> EN: `photoreal {breed} cat, {markings}, {eye color}, {pose}, warm practical light with faint cool starlight rim, slightly asymmetric face, calm, isolated subject, transparent background`（保留现台账 art-01/02 的写法）

---

## 6. 出图清单

### 6.1 立即可出（**有消费槽·已在台账**·创作台「一键全量」即可）

| 台账 | skinKey | 用途 | 规格 |
|---|---|---|---|
| art-01/02 | `game112/cat/xuetuan-{rest,notice}` | 猫画面层锚图（趴 / 注意） | 840×600 透明 |
| art-03/04/05 | `game112/icon/{orb,table,basket}` | 主厅三热点物件 | 192² 透明（建议升 512²） |
| **art-06（本次新增槽）** | `game112/scene/hall` | **主厅定调图**：猫画面层背景（`hall-stage` Panel.skin·猫叠其上） | 1680×1200 cover（当前层 420×300 的 4×） |

> art-06 = **整个美术方向的定调图**（先例：game-a「P0 先出定调图」）。它出来、人审过、上画面，其余房间照它的光和笔触批量出。

### 6.2 随框架落地即入账（**槽随房间表一起进代码后才列**·art-pipeline 孤儿行铁律）

| 预留 skinKey | 用途 | 规格 | 模板 |
|---|---|---|---|
| `game112/map/hall` | 馆图剖面 | 1920×1080 | C |
| `game112/map/room-<id>` ×10 · `-locked` ×10 | 馆图房间缩略 / 铅笔轮廓 | 480×320 | A 缩略 / 线稿 |
| `game112/scene/<id>` ×9（hall 已有） | 房间背景 | 1920×1080 | A |
| `game112/icon/<hotspot>` ×~25 | 各房热点物件 | 512² 透明 | B |
| `game112/cat/<cat>-<state>` 随猫 | 每只猫 ×2 态（将来 ×房间变体） | 840×600 | D |

### 6.3 出图顺序（建议）
1. art-06 主厅定调图 → 人审 → 上画面（同时验证 Panel.skin 叠猫的层关系）。
2. 馆图剖面（形态 A/B owner 先判）。
3. 主厅 → 玩具间 → 窗台（前三间新房）背景 + 各自热点。
4. 其余房间按解锁顺序。

---

## 7. 施工顺序（Loop-1·游戏端）

| 步 | 做什么 | 门 |
|---|---|---|
| ① | owner 审本框架（§8 四问）| — |
| ② | art-06 定调图出图 + 人审（创作台）| 台账 approved |
| ③ | `world-data.ts` 房间表 + `blueprint.ts` 解锁配方 + `ui.ts` 馆图屏与 `buildRoom` + 离线事件加 `room` | vitest + 剧本（房间解锁整单不动 / 进房换镜头 / 锁房 peek 不扣钱）|
| ④ | 台账入 §6.2 行（有槽即入）· `ledger-audit --strict` 零孤儿 | S6 |
| ⑤ | 一键全量出图 → 人审 → 换装 | S6 |
| ⑥ | Claude Design 按 `claude-design-spec.md` + 本稿出馆图与房间屏 `.dc.html` | S5 |

---

## 8. 待 owner 判（四问·一次答完）

1. **馆图形态**：A 手绘剖面（推荐）还是 B 平面图？
2. **房间清单**：十间里砍谁、加谁？（茶水间/阁楼/星庭是我按「主人的痕迹 / 旧物线索 / 室外多猫」补的三条叙事线）
3. **扩建门槛**：只用星砂 + 心光门槛（现稿），还是再加「修缮需要陪伴时长」这种时间门？（时间门能表达但会像欠账，我倾向不加）
4. **定调图先行**：是否同意先只出 art-06 主厅定调图、人审定风格后再批量？
