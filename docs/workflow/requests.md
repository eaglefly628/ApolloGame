# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结条目删除留 git 历史。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交删除条目腾槽·全文留 git 历史**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中



### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。
> **+ 三游戏风格锚条目 ✅ done（PA·2026-07-17·待 Lead 验收）**：`scripts/style-packs.json` 加 3 条（照 apollo-toon 样板全字段·无厂牌词·refImage:null·negative/post/params 同样板·seed 1776-78·各 8 色 palette）——`sakura-nijigen`（三游戏共用·女性向二次元人物锚·出处 game-b gdd §九+REQ-C-ART 修订①）·`vegas-victoriana`（game-c 场景锚·REQ-C-ART ① 原文锚+鎏金/呢绿/酒红等 8 色）·`modern-manor`（game-a 场景锚·brief §2.2 现代私宅夜局+暖木/夜蓝/灯金等 8 色）。门禁全绿（tsc+vitest 全量+build+双守卫）；art-replace pack 迭代校验绿。


<!-- REQ-UIRECON-换根重挂（P1·PUI）+ REQ-UIAUDIT-叠层与动效（①②③·PUI·Lead 验收 PASS）已完结（查 git 历史）；REQ-UIAUDIT 余 ④bounce+border-image 后置工具债（不占槽·要做时重开小条）。 -->


<!-- REQ-RETRO-引擎大扫除（P0·owner 全权授 Lead）已完结（查 git 历史）。 -->

<!-- REQ-RETRO2-能力库整理（P1·owner 三裁缩范围）已完结（查 git 历史）。 -->

### REQ-DIALOGUE-剧情基础线 · 剧情向 Dialogue 能力做成基础件+Sample+Template · [2026-08-03] · owner 令（约会性单机超休闲转型线·owner 同日令启动） → **图纸在档：`docs/design/dialogue-line-blueprint-2026-08.md`（派工唯一真相）** · status: **in-progress（M1 ✅ PUI done·待 Lead 对抗性验收；M2/M3 next）** · 优先级: P1（转型关键路径） · 类型: 能力线（引擎+UI 基座+样板）
> 四里程碑（详见图纸）：M1 闭集 VN 控件三件（dialog/choiceList/portrait·PUI·high·**第一步**·验收过即退役 ui/vn）→ M2 立绘/表情链（emotion→资产 key 纯数据表·PUI+PA）∥ M3 伴侣在场件（presence 起手模板+事件→反应数据表·PUI）→ M4 Sample 示范游戏 + `@ui/starters` 剧情起手包。t3-dialogue 已完备**不改**（输入接缝已为闭集 UI 预留 arg 通道）。悬置段=DokiWorld 数值双向契约，等 owner 三样材料（真卡 schema/宿主接口文档/双人确认）。每步 Lead 对抗性验收。
> **⚖ Lead 对抗性验收 M1（2026-08-04）：✅ PASS·带一条整改**——独立复核：tsc/VN 三测试文件/decouple 全 0；`resolveDialogue` 结构投影器亲读（DI 接口·ui 不碰 @skills=正确）；「另立投影器而非扩标量 UIDataSource」评判成立。**撞车留痕**：Lead 派的施工代理与本 PUI 会话双头同单（协同缺口·教训=开工先在池子标施工主体），代理版**未推**保留本地参考分支 `m1-alt`（739ea35dd·其 game-i 演示真跑 dialogueCapability 世界）。**整改（并入 M2 首项）**：正典展台是 literal props 静态摆拍（图纸要求真跑三控件·活范例纪律未达）——照 `m1-alt` 的真世界驱动方案改造 dialogue-demo（真 tick·真信号·真投影刷新）。**退役令随整改后触发**。**PUI 线施工主体自此=owner 的 PUI 会话**（Lead 不再派 UI 代理·防再撞）。
> **M1 ✅ done（PUI·2026-08-04·待 Lead 对抗性验收）**：catalog 闭集新增三控件 `dialog`/`choiceList`/`portrait`（沿 panelTexture 先例·types+render+catalog describe+validate 自动认+点名测试+ui.md 回填+house 主题取色可皮）。**投影读世界**=另立结构投影器 `resolveDialogue(tree, DialogueSource)`（bindings.ts·DI 接口·ui 不 import @skills）——因标量 UIDataSource 表达不了「变长选项+逐项 optionAvailable」这类结构投影；写世界=`dialogue.advance`/`dialogue.choose`+arg 下标（t3-dialogue 已认 arg 串·零游戏 handler）。守卫：`src/ui/components/dialogue.test.ts`（8 例·validate/渲染/投影/可选性门控/bind 未命中透传）+ catalog-coverage 41 型 + game-i `dialogue-demo.ts`（`💬 剧情·VN 对话三件` tab·+测试+audit 0 阻断）。scoped-gate 全绿。**Lead 评判**：M1 确为真闭集缺口（非可重组·游戏代码建选项列=「代码重建 UI 树」反模式）·PUI 独立复核同判接受。**退役令待触发**：M1 验收过→ PUI 出小单标 `ui/vn` deprecated 并删。

### REQ-PIPESOFT-管线软件 · 八步法软件化：一句话入口+向导壳+阶段编排器+IDE 接入 · [2026-08-03] · owner 批（四裁在图纸头）→ **图纸：`docs/design/pipeline-software-plan-2026-08.md`（唯一真相）** · status: **in-progress（P0 施工中·P1 待 Lead 出编排器细图）** · 优先级: P1（与剧情线并行·域不冲突） · 类型: 生产线基建（workshop 壳=PST 域·编排器/MCP=引擎 scripts）
> P0 规矩成文（代码准入五级阶梯进 capability-plan 模板 + S2 门措辞·低档施工中）→ P1 向导壳+编排器（自动起匿名无头会话·每步小上下文·人门真人点·600s 看门狗）→ P2 MCP 服务+斜杠命令+板红拦推 hook → P3 试点=owner 自派的 RPS 游戏走全程（Lead 只管软件不管游戏内容）。红线：无特权通道·代签禁止·阶梯降级留痕。

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

## 已结案条目 → 查 git 历史（owner 2026-08-03 拍板删除归档层·`git log --oneline --grep=REQ-XXX` 或按提交信息 grep·随时可恢复）

## 需求模板（复制这段填写·先确认：游戏级工单请写该游戏的 `docs/design/<game>/requests.md`，此处只收引擎级）

```
### [YYYY-MM-DD] · [提出人角色] · status: open
- 想实现的行为：
- 已经试了什么（哪些能力 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案（可选）· 边界（本单允许触碰的文件范围·复查门核对用）：
```

---
