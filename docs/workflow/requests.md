# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-FACE-ROTATE-实体按运动/目标方向旋转 Transform（表现层·rotor 无 atan2）· [2026-07-25] · PE-game-103 报（子弹朝向 + 巨长激光贯穿方向）→ Lead 裁 · status: **open** · 优先级: P2（割草子弹/激光观感·俯视有向物通用·非阻塞玩法） · 类型: 引擎能力薄缺口（表现层·主程域）
> **想实现的行为**：俯视有向物（子弹/飞刀/激光条/箭）**贴着运动方向或 Relation(target) 方向旋转** `Transform.rotation`——让「子弹朝向它飞的目标」「巨长激光沿开火方向贯穿屏幕」成立。owner 两条实测：① 子弹发出不朝向目标 ② 激光要「长得像激光·顺方向贯穿」而非横条。
> **已试重组（不可得）**：`t2-facing` **只做水平镜像**（Transform.scaleX 符号·`facing.ts:73`），**不能任意角度旋转**；sim 禁 atan2/sin/cos（确定性）→ 游戏层算不出朝向角。当前激光只能画**轴对齐长条**（横向发射最像·斜向变横条）·子弹无朝向。
> **建议方案（Lead 裁）· 边界**：加一个「face-rotate」表现能力（或给 facing 扩 `mode:'rotate'`）——从 Velocity/Relation 方向用**rotor 手法**（同 orbit-motion 的 dirX/dirY 单位向量→Transform.rotation·或直接存朝向向量供渲染器旋转）写 rotation，**运行时零 atan2/trig**（方向向量已有·归一化用 sqrt 同 steering 类）。表现层只写 rotation、不驱动逻辑（同 facing 铁律）·Commit 相位·确定性 lockstep 安全。**触碰范围**：`src/skills/tier2/facing.ts`（扩 mode）或新薄件 + 测试；game-103 只经数据挂。**（注：回旋镖「飞出→回旋返回」是另一缺口=`t2-launch` 的 out-return 弹道段·属 `REQ-SURVIVOR武器缺口` 已归档条·M3 武器时重开·与本旋转条不同。）**

### REQ-PATHEND-DROP-PathFollow 绕完一圈自动落件（belt→缓冲槽 handoff·CONVEYOR-CAP 收尾）· [2026-07-25] · PE-game102 报（接完整循环撞墙）→ Lead 裁 · status: **open** · 优先级: P1（game102 核心循环收尾·传送带/巡逻类通用） · 类型: 引擎能力薄缺口（主程域·先重组已证不可得）
> **想实现的行为**：色炮沿传送带 `PathFollow{loop:false}` **绕完一圈到末点** → 若还带弹（ammo>0·选错色/够不到没打）→ **自动离带、落到 `t2-tray` 缓冲槽的空位**（成为待命炮·点击可复部署）；打光(ammo=0)的走 `Mortal→消失`。这两条一起 → 传送带/缓冲区**双 full → 死锁判负**（M2/M4 已可组合）。
> **已试（PE 源码复核·已接 per-shot 扣弹 + queueId 有序带 + Mortal 打光消失·commit 56d7a564）**：belt→tray 的**转换本身**表达不了——① `effect-apply` 无「换 Tag 位/增删组件」kind（`set-flag/modify-resource/set-state/set-sensor/set-visible/destroy/destroy-tagged/reset-timer`），**无法把 BELT_BIT 成员变成 TRAY_BIT 成员**（tray 靠 requiredTag 含齐认成员）；② `PathFollow` **无「绕完/到末点」信号或条件**（`index` 到 `len-1` 停·但无 event/condition 可读）→ 无法在 lap-end 触发；③ **一实体一 Mortal**（已被 ammo≤0→消失占用）+ 一 Timer（reload 占用）→ 无第二退场槽；④ `Mortal.dropTemplate` 固定模板·不带 ammo（本作「带弹返回」恰是没开火=满弹·故 drop 满弹 tray_ 反而对·ammo 携带非阻塞）。
> **卡在哪 / 缺什么**：缺「**PathFollow 绕完一圈→落一件 + 自毁**」的路径终点触发（=Mortal 的 path-完成版）。有它即可：belt 炮 loop:false 绕完 → 落 `tray_`(满弹·tray 自动落空槽) + 自毁离带；打光消失仍走 Mortal。两独立触发、无冲突。
> **建议方案（Lead 裁·择一·都薄）· 边界**：① **`PathFollow` 加 `onEnd?:{dropTemplate?:string, destroy?:boolean}`**——loop:false 到末点时（同 Mortal 语义）发 SpawnRequest(dropTemplate@自身位) + 自毁（最贴本用例·最薄）；或 ② `effect-apply` 加 `set-tag{setMask,clearMask}` kind + `PathFollow` 加 `onEndSignal` → 组合换 Tag（更通用但两件）。**触碰范围**：`src/skills/tier2/path-follow.ts`(+组件字段) 或 `effect-apply.ts` + 测试；game102 只经数据消费（`cannon_*` 挂 onEnd:{dropTemplate:tray_<color>,destroy:true}）。撞墙实证＝`src/games/game102/blueprint.ts`（cannon body Mortal 打光消失已接·缺 lap-end→tray）+ `conveyor-queue-compose.test.ts`（M3 tray 落座证明·但未证 belt→tray 转换）。




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
