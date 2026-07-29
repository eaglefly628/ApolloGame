# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中



### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。
> **+ 三游戏风格锚条目 ✅ done（PA·2026-07-17·待 Lead 验收）**：`scripts/style-packs.json` 加 3 条（照 apollo-toon 样板全字段·无厂牌词·refImage:null·negative/post/params 同样板·seed 1776-78·各 8 色 palette）——`sakura-nijigen`（三游戏共用·女性向二次元人物锚·出处 game-b gdd §九+REQ-C-ART 修订①）·`vegas-victoriana`（game-c 场景锚·REQ-C-ART ① 原文锚+鎏金/呢绿/酒红等 8 色）·`modern-manor`（game-a 场景锚·brief §2.2 现代私宅夜局+暖木/夜蓝/灯金等 8 色）。门禁全绿（tsc+vitest 全量+build+双守卫）；art-replace pack 迭代校验绿。


<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结迁归档（requests-archive.md）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


### REQ-SELFCHECK-自证门牙 · S4/S5 机器门加自证产物存在性检查 + 复查清单抽查行 · [2026-07-29] · owner 拍板「自己玩自己看对照策划」→ Lead 出图 → **指派：Opus** · status: **✅ done（Opus 2026-07-29·待 Lead 对抗性验收）** · 优先级: P1（工作流基建） · 类型: 生产流程板门禁（scripts 域）
> **⚖ Lead 图纸**：手册已立 `docs/playbooks/self-check.md`（真渲染自玩+截图序列+策划对齐单·零未解释偏差才送复查门）。给它加牙：
> ① `game-pipeline.mjs` S4/S5 gate 前置存在性检查：`docs/design/<slug>/self-check/S4-alignment.md`（S5 同名）在档 且 `self-check/shots/` 内 ≥5 张图（png/jpg 计数）——缺=gate 拒（点名「自证未做·见 self-check.md」·照 acceptanceScenarioCount 先例做纯函数可测·<门槛在 spawn 前拒不空转）。
> ② 对齐单新鲜度绑 gameHash（照既有证据过期机制口径·陈旧对齐单=⚠过期提示，不硬拦——图可能真没变）。
> ③ REVIEW_CHECKLISTS S4/S5 各加一行「对齐单抽样重走 ≥3 条（含 ⚠降格行的裁决去向核对）+ 好玩三问已作答非敷衍」。
> ④ 测试照 acceptance 存在性门先例：计数纯函数/板提示/CLI 拒过路径/清单行断言。**不碰 src/games、src/ui**。
> **✅ done（Opus 2026-07-29·待 Lead 对抗性验收）**：`scripts/game-pipeline.mjs` 加 `MIN_SELFCHECK_SHOTS=5` + `selfCheckArtifacts/selfCheckBlock/selfCheckNote` 三个导出纯函数（截图递归计 png/jpg/jpeg——按轮分子目录 `shots/r2/` 也算，手册要求「每轮都做」）。① S4 门在**验收剧本计数之后、conformance spawn 之前**拒（保留既有剧本判词优先），S5 门在 spawn audit 之前拒（cart 的 S5 本就免审计→不设自证前置；cart 的 S4 与 compiled/builtin 同受约束，同 acceptance 口径）；判词点名「SN 自证未做（见 docs/playbooks/self-check.md）· 缺策划对齐单 SN-alignment.md · 截图 n/5 · docs/design/<slug>/self-check/」。② 新鲜度：gate 跑时产物齐活即在 pipeline.json 记 `selfCheck.SN={at,shots,gameHash}` 快照，board 的 S4/S5 机器门详情尾追自证态（✗未做 / ⚠可能过期 / ✓对齐单+N 图）——**⚠ 只提示不硬拦**（图可能真没变）。③ `REVIEW_CHECKLISTS` S4/S5 各加「自证对齐单抽样重走 ≥3 条（含 ⚠降格行的裁决去向核对）+ 好玩三问已作答非敷衍」。④ 测试 +6 例（`scripts/game-pipeline.test.mjs` 32 例全绿·慢车道 `APOLLO_DEEP=1`）：计数/递归/逐关独立·判词点名·新鲜度三态·板提示（含 cart S5 不加提示）·清单行·CLI 真拒（S4 剧本够但自证缺=拒且**不进 conformance**、S5 拒后补齐放行并落 gameHash 快照）。手册回填：`self-check.md` 红线改为「机器卡已落地」+ 规格（≥5 图·可分子目录·过期语义），`game-production.md` S4/S5 机器门列前置自证。**据实偏差**：(a) 既有 CLI 测例「3 场景无 adapter → conformance 真判红」的 fixture 补加自证产物（否则被新门先拦·测的是 conformance 根对齐、非本门）；(b) 手册只说 `shots/`，实现放宽为递归计数（不罚按轮归档）；(c) 现有 8 款游戏均无自证产物 → **S4/S5 gate 从此为红是预期诚实态**（照 REQ-ACCEPT 先例·板上点名缺件，各 PE 补自证产物即转绿）。门禁：tsc=0·vitest 快车道=0·`APOLLO_DEEP=1` 流程板测=0·build=0·context-budget=0·docs-ref=0。

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
