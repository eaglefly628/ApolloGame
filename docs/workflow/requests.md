# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中


### REQ-EXPOSURE-TARGETING-暴露/垂直扫描线索敌（周界轨道逐层剥内层）· [2026-07-26] · PE-game102 报（owner 授权）→ 主程裁 · status: **open** · 优先级: P0（挡 game102 通关·多层像素画不可解） · 类型: tier2/3 索敌能力缺口
> **想实现**：沿 PathFollow 周界轨道跑的色炮，向**路径切线法向（画面内侧）**投格对齐扫描线，命中线上第一颗**暴露(邻空)同色**格（逐层从外剥到里·预计算无 miss）。
> **已试**：`aggro`（Perception 半径最近同色）——放宽半径=空中开火/打对角非正对格/穿层；收紧半径=周界轨道离内层恒远够不到。半径「圆 vs 扫描线·距离 vs 暴露」双重错配·无解。
> **缺什么**：建议 `ScanTarget{axis:'perp-to-path',maxDepth,targetTag,requireExposed}`（每 tick 投内侧扫描线取首颗暴露同色写 Relation.target·整数格+排序·零 trig 确定性），或板级 `SweepPlan` 预解清除序。命中/扣弹/消除链已就绪只等换索敌。
> **全文 + 影响面**：`docs/design/game102/主程热修报告-targeting-pool.md §缺口①`。

### REQ-POOL-ADVANCE-弹库队列头可点+上浮 · [2026-07-26] · PE-game102 报（owner 授权）→ 主程裁 · status: **open** · 优先级: P1 · 类型: tier2 队列布局能力缺口
> **想实现**：双排弹库仅前排（队首）可点·消费后后排自动上浮补位并激活可点。
> **已试**：双排布局 + 每门 Clickable/Caster/自毁已就绪；「上浮 + 头可点」需运行时**移动实体 + 增删 Clickable 组件**——`effect-apply` 无 move-to / set-clickable kind。
> **缺什么**：`QueueSlots{slots,headCount,memberTag}`（成员按序占位·仅头 N 可点·销毁后整体前移重算），或给 effect-apply 加 `move-to`+`set-clickable` 两 kind。
> **全文**：`docs/design/game102/主程热修报告-targeting-pool.md §缺口②`。现状降级=全排可点（功能可用·缺约束感·owner 已知）。

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
