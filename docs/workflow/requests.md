# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-CONVEYOR-CAP-传送带容量+拥堵+空槽分配（本作核心难点·原 REQ-G102-BURST 升级）· [2026-07-25] · PE-game102 报（owner 定稿「Traffic Management 死锁」为核心）→ Lead 裁 · status: **open** · 优先级: P1（game102 核心难点·非可选·传送带/队列调度类通用） · 类型: 引擎能力缺口（主程域·先重组已证不可得）
> **想实现的行为（core-experience-v2 §2.2 权威机制）**：炮进**环绕图案的传送带**（有序移动·**严格容量上限 N**）→ ① 带上炮数达 N 时**新部署被拦/排队**（不硬塞）② 带上炮**有序占位不重叠**（拥堵=可见排队而非叠一起）③ 炮绕完带弹→**落到 5 等待槽中的空槽**（占位分配·满则拦）④ **死锁判定真相**：带满 且 5 槽满 → 无处可去 → 判负。**这是本作核心难点**（动态流量管理），非边角。
> **已试（PE 源码复核）**：`group-count` 能**数**带上炮（`conveyor.count`）/槽中炮（`tray.count`）✅，`flow` 能据两数判负 ✅——但**只能读数、不能约束**：① `caster`/`tapSupply` 部署**无容量门**（带满照生成→超员）；② `PathFollow` 各炮独立进度**不互避**（超员=叠在一起·非有序拥堵）；③ `tray_` 炮落点是**固定 spawn 位·非「5 槽第一个空位」**（无空槽分配器）。无任一能力表达「容量约束 + 有序占位 + 空槽分配」。
> **卡在哪 / 缺什么**：缺**「有限容量的有序队列/传送带」原语**——带上按序占位（容量满→拦入/排队）+ 缓冲槽空位分配（满→拦）。**禁游戏层自写队列/容量散逻辑**（红线·且须确定性进 hash）→ 下沉引擎。
> **建议方案（Lead 裁）· 边界**：下沉 **`conveyor-queue`**（或复用/扩 `t2-zone-occupancy` 的容量+队首语义）——组件 `ConveyorQueue{capacity, slots?}`：入队满则拒（发 `full` 信号供 flow/部署门读）·带上有序占位（沿 PathFollow 进度排布·不重叠）·缓冲槽 `firstFreeSlot` 分配。确定性（id/序 tie-break·无随机·进 hash）。**触碰范围**：`src/skills/**`（新件或扩 zone-occupancy + 测试）；game102 只经数据消费。撞墙实证＝`docs/design/game102/core-experience-v2.md §2.2/§3` + `src/games/game102/blueprint.ts`。**（原 `docs/design/game102/requests.md REQ-G102-BURST` 的「快连堆炮 5→10」即本缺口子集·并入此条。）**



### REQ-OVERLAP-LAYER-overlap-detect 碰撞分层（category+mask 宽相位过滤）· [2026-07-25] · PE-game-103 报（割草同屏几百怪 perf 刚需 + 障碍碰撞分层）→ Lead 裁 · status: **⚖ Lead 裁 ✅ 真缺口·准下沉（2026-07-25·排 conveyor-queue 之后建）** · 优先级: P1（game-103 割草 perf 阻断·碰撞类通用） · 类型: 引擎能力缺口（主程域·先重组已证不可得）
> **⚖ Lead 裁（2026-07-25·亲读 `src/skills/atoms/overlap-detect/index.ts`）：✅ 真缺口·下沉**——现 overlap-detect 宽相位=动态 AABB 树但**零分层**：所有 Transform+Shape 对只要 AABB 相交就窄相位 + 发 Overlap 实体。几百怪 enemy-enemy 对 O(局部²)·每帧造/毁几千无用 Overlap=ECS churn 热点。**下游 Tag 过滤在 Overlap 发出之后·省不掉 churn** → 要 perf 必须过滤进 overlap-detect 内部·非重组可得。category+mask=标准碰撞分层（通用：割草 perf + 障碍分层 + 子弹只打敌）·确定性（位运算）·加性零回归（缺省 collide-all）。
> **形（建时定死）**：`Shape` 加 `category?:number`/`mask?:number` 位掩码（或独立 CollisionLayer 组件）→ `queryPairs` 命中对仅当 `(A.category & B.mask) && (B.category & A.mask)` 才窄相位 + 发 Overlap；两边都不设=collide-all（零回归·既有测全绿）。3D `overlap-detect-3d` 镜像可选（本单先 2D）。**触碰范围**：`src/skills/atoms/overlap-detect/**` + `Shape` 组件 + 测试；game-103 只经数据挂 category/mask。**排期**：owner 定 SPENDONFIRE+CONVEYOR-CAP 第一优先 → 本条排 conveyor-queue 之后。落地后 game-103 恢复怪 cap。


### REQ-SPATIAL-QUERY-INDEX-空间查询索引（nearestByTag/queryRange O(N²)→O(N)）· [2026-07-25] · PE-game-103 报（割草同屏几百怪 perf 真瓶颈·逐系统剖析实证）→ Lead 裁 · status: **open** · 优先级: P0（game-103 割草 perf 头号阻断·比 REQ-OVERLAP-LAYER 更主因·索敌/群体类通用） · 类型: 引擎性能缺口（主程域·先重组已证不可得）
> **实证（PE 逐系统 CPU 剖析·cap150 horde·621 实体·49ms/帧）**：`aggro` **21.9ms(45%)** + `steering`(含 separation) **16.8ms(34%)** = **79%**；`overlap-detect` 仅 6.4ms(13%)。→ **真瓶颈是 AI 空间查询·不是碰撞配对**（REQ-OVERLAP-LAYER 只削 13%那块）。
> **根因（PE 亲读 `src/skills/atoms/spatial-query/index.ts`）**：`nearestByTag`（aggro 逐感知实体索敌）与 `queryRange`（steering 逐敌找分离邻居）都是**朴素全实体线性扫**（`for (const [id] of world.query('Transform'))`·每次 O(实体数)）。aggro=O(感知者×实体)、steering=O(敌×实体) → 整体 **O(N²)**。几百怪即爆（owner M5 都卡到玩不了）。
> **已试重组（不可得）**：游戏侧只能砍同屏 cap（150→46·5.8ms 临时可玩）缓解=牺牲割草初衷（几百怪）；无法在游戏层给 O(N) 扫加索引。`SpatialIndex` 组件(`spatial.ts:164`)与 `DynamicAabbTree`(overlap-detect 用)**已存在但 nearestByTag/queryRange 没用它们**。
> **建议方案（Lead 裁）· 边界**：让 `nearestByTag`/`queryRange`/`queryNearest` 走**共享空间索引**（均匀网格 hash 或复用现有 SpatialIndex/AabbTree·每帧建一次全体复用）→ O(N²)→O(N)。确定性（网格桶内按 id tie-break·同现 nearestByTag id 序·进 hash 不变）。加性零回归（索引仅加速·结果集与现全扫一致·既有测全绿）。**触碰范围**：`src/skills/atoms/spatial-query/**`（+ 可选 `src/engine/spatial/**` 复用 aabb-tree）+ 测试；game-103 等所有用 aggro/steering/spatial-query 的游戏**零改**自动提速。**落地后 game-103 恢复怪 cap 到几百·磁吸飞入动画复接**。**与 REQ-OVERLAP-LAYER 关系**：本条是主因(79%)、那条是次因(13%)；空间索引亦可顺带服务 overlap-detect 宽相位（可合并考量）。

### REQ-SCREENFILL-Screen 填满 mount-host 固定 scene 盒（去竖屏底部信箱空白） · [2026-07-25] · PE-101 报（owner「下面留这么大空」实测撞墙）→ PUI 裁 · status: **open** · 优先级: P2（所有 mountHost 竖屏游戏通用·非 game101 专属） · 类型: UI 基座缺口（PUI 域·`src/ui/components/render.ts`）
> **想实现的行为**：`mountHost` 建的是**固定 `fieldW×fieldH`（如 1080×1920）的 scene 盒**再整体 `transform:scale()` 信箱化。Screen 作为其直接子应**填满该盒高度**（`flex` 子撑满 → 内部 `flex:1` 区块吃满剩余空间）。
> **实测缺口**：`renderScreen`（`src/ui/components/render.ts:505`）写死 `min-height:100vh`——`100vh`=**真实浏览器视口**（本例 960px 缩放态）而非 scene 盒的 1920px；Screen 遂只长到**内容自然高**，盒底空出信箱条（game101 实测底部空 ~372px/19%）。且 Screen 节点自带的 `layout.height:1920` 被 renderScreen 完全忽略。
> **卡在哪**：游戏侧只能靠**把内容精确撑到 1920** 规避（game101 现已这么做·但脆——布局一动缝就回来），非真填充。Screen 的高度语义应绑 mountHost 盒而非视口。
> **建议方案（PUI 裁）· 边界**：renderScreen 用 `min-height:100%`（吃父 scene 盒的显式 1920px 高）替代/叠加 `100vh`，或加 `ScreenProps.fill?` 令牌显式启用「填满宿主盒」。**触碰范围**：`src/ui/components/{render.ts,types.ts}` + 点名测试 + `docs/playbooks/ui.md` 回填。撞墙实证＝`src/games/game101/s1.ts`（orders `height:530` 硬撑到 1920 的规避）+ `src/engine/host/mount-host.ts:104`（scene 固定 `height:${fieldH}px`）。

### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。
> **+ 三游戏风格锚条目 ✅ done（PA·2026-07-17·待 Lead 验收）**：`scripts/style-packs.json` 加 3 条（照 apollo-toon 样板全字段·无厂牌词·refImage:null·negative/post/params 同样板·seed 1776-78·各 8 色 palette）——`sakura-nijigen`（三游戏共用·女性向二次元人物锚·出处 game-b gdd §九+REQ-C-ART 修订①）·`vegas-victoriana`（game-c 场景锚·REQ-C-ART ① 原文锚+鎏金/呢绿/酒红等 8 色）·`modern-manor`（game-a 场景锚·brief §2.2 现代私宅夜局+暖木/夜蓝/灯金等 8 色）。门禁全绿（tsc+vitest 全量+build+双守卫）；art-replace pack 迭代校验绿。

<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结迁归档（requests-archive.md）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


### 📦 3D 渲染线需求 → 已移至 `docs/workflow/requests-3d.md`（owner 2026-06-28 立独立池）

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

## 已结案条目 → 全文见 `requests-archive.md`

> 所有 done/wontfix/作废 条目（含裁决理由与完工摘要）已归档到 `requests-archive.md`；查旧单先 grep 它。本池只留活跃 open/in-progress/排队 条目（防每读付历史 token·owner 2026-07-04 token 底盘优化）。

## 需求模板（复制这段填写·先确认：游戏级工单请写该游戏的 `docs/design/<game>/requests.md`，此处只收引擎级）

```
### [YYYY-MM-DD] · [提出人角色] · status: open
- 想实现的行为：
- 已经试了什么（哪些能力 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案（可选）· 边界（本单允许触碰的文件范围·复查门核对用）：
```

---
