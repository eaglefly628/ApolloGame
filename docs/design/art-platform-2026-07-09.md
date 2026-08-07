# 美术平台·终态一页（2026-07-09 · Lead 亲手收口 · **全员必读**）

> ⚠ **2026-08-06 更新**：本页是 **07-09 当时的收口快照**。此后有 ARTPIPE2 四翼（台账守卫/资产浏览器/
> 历史回滚/消费方反查）与卡带美术归位（REQ-CARTART）等变更——**管线现状以 `docs/design/art-pipeline-asbuilt-2026-08.md` 为准**，本页留作历史。
>
> owner 授权 Lead 一次性收口（R1/R2/R3 三单合并落地后撤单）。本页=07-09 时点的权威描述；
> 上游设计=`docs/design/art-replacement-workflow.md`（五步流程/schema 全文），冲刺纲领=`docs/design/demo-sprint-2026-07-29.md`。
> 有出入以本页+代码为准；发现漂移提 `docs/workflow/requests.md`。**分角色交接（PST/透视器/game-q/PA 各自要看的）=`docs/workflow/finish/art-platform-handoff-2026-07-09.md`。**

## 一、现在的样子（一句话）

**一个平台（ArtLedgerPanel·双数据源）+ 一个大脑（`scripts/art-replace.mjs`）+ 一份台账（每游戏 art-ledger.json）**——
从「游戏要哪些美术」到「批量/单张生成、真调或 mock、写回上画面」全在一条路上；cockpit 已退役。

## 二、入口

| 入口 | 打开什么 |
|---|---|
| 主屏 🎨 美术平台按钮（dev 模式） | **游戏选择器**（owner review ③）：内置+library 全列·每游戏一个美术资料库·点进即该游戏台账（library 缺台账自动初始化） |
| 游戏库卡带操作条 「🎨 美术台账」 | library 卡带线台账 |
| 设置面板 「🎨 美术生成 API Key」区 | 配 DASHSCOPE / TRIPO / MESHY key（存 .apollo-config.json·打码回显） |

## 三、双数据源（同一个面板·差异只在写回）

| | library 卡带（studio 产出） | 编译期游戏（games·如 game-q） |
|---|---|---|
| 台账来源 | `derive`（扫 manifest art: 槽位） | `deriveRequirements`（扫蓝图视觉实体·`scripts/game-q-art-requirements.mjs`） |
| 写回机制 | 按编号**重钉 manifest 引用**（落盘前 parseManifest 零 error 铁律） | **skinKey 别名登记**进本地 index（蓝图零改动·见 §五） |
| 可用动作 | 重生成 / 库选换 / 上传 / 一键全量 / 一键换皮 | 重生成 / 上传 / 一键全量（无 manifest 可钉→换库与换皮隐藏） |

## 四、台账=唯一真相（canonical 行 schema）

`public/games/<slug>/art/art-ledger.json`，头带 `artStyle:{stylePrompt?, packId?}`（**每游戏整体风格锚**·owner review ②·平台头部可编辑·自动拼进每行生成 prompt），行=`{no, kind, slot, query, prompt?, desc, skinKey?, placeholder, spec, context, status, gen, provenance, history?}`。

- **编号 append-only（owner 07-09 定案）**：重跑推导走 `mergeLedger`——已有槽位**保原 no**（连同状态/生成/prompt/history），新槽位取 max+1 顺延，消失槽位标 `status:'retired'` **墓碑保号永不复用**。「art-03」今天明天都是同一个东西。
- `prompt` = 人工精调提示词（game-q 的 7 个主角面已从 art-list.md 回填），有则整体替代 query 作生成主体；docs 下两份 md 已降级只读视图，**勿再手改 md 当真相**。
- `desc` = **机器推导的详细描述**（owner review ①）：形体/主色 hex/行为角色（塔=索敌炮台·NavAgent=沿路移动敌·lives=大本营…全从 sim 组件推）/画面占比/视角/透明底——无手拼 prompt 时自动拼进生成主体。生成主体优先级：`prompt` > `query+desc` > `query`。
- 生成 provider：默认=风格包钉死（成套保证）；平台「模型」菜单可点名覆盖 千问万相/Tripo/Meshy（owner review ④·3D 行只认 tripo/meshy·2D 行只认 qwen·覆盖记进 gen.provider）。
- `status` 流转：`needs-art|placeholder → generated → replaced/filled → approved`；`retired`=墓碑。

## 五、写回=怎么让生成的图真出现在游戏里

- **library 线**：`applyReplacements` 把 art: 引用钉成 `gen/art-NN` 本地资产 id → parseManifest 校验 → 落盘。**prefab 模板内的 art: 同样解析/登记/钉回**（路径=prefab:宿主:模板:实体·game-m 换装撞出后补齐）——spawn 出来的实体（衣服/技能特效/掉落物）也有皮；已钉死槽位重推导不墓碑。
- **编译期游戏线**：蓝图视觉实体带 `Sprite:{textureKey:'q/xxx'}` 皮肤槽（与 Shape 并存）；引擎 `chooseRenderMode`
  规则=**贴图就绪盖过 Shape、未就绪回退 Shape**——所以没美术时观感一字不变。生成/上传时按 `skinKey`
  把产物**别名登记**进 `public/games/<g>/art/index.json`；游戏 mount 拉本地 index（`registerAssetIndex`），
  资产就绪自动换装。**给新编译期游戏接美术=给视觉实体加 Sprite 皮肤槽一行，别的全免。**（样板：game-q `theme.ts` SKIN / `blueprint.ts` / `game-q.ts` skinAssets）

## 六、真调 / mock 语义（demo 死穴已除）

- **mock 只在显式勾选**（平台「mock 试跑」勾选框）或显式 env 才走；服务端已无任何硬编码 `--mock`。
- **mock 永不上画面（owner 2026-07-10「Mock 数据不该这样做」·三道闸+一条沟）**：mock 产物**只落独立命名空间
  `public/games/<g>/art/gen/mock/`（gitignored）**供平台墙预览（⚙MOCK 标·台账 `gen.mock:true` 明标）。
  闸① 写回：`applyReplacements` 默认跳过 mock 行（返回 `skippedMock` 明数·manifest 保持原始 art:/placeholder 引用）；
  闸② 别名：mock 不登记 skinKey 皮肤别名（编译期游戏画面不吃 mock）；
  闸③ 人门：`/api/art/approve` 拒 mock 行（真图生成后才过复核）。
  沟=命名空间：mock 文件/index id 绝不与真图 `gen/art-NN` 同名——已钉死真图的游戏跑 mock 批**不会被覆盖**（后门已封）。
  机械验证走 CLI `--allow-mock`（冒烟/测试专用·端点永不传）。**真图到位前，游戏观感=原始 placeholder，一字不变。**
- 真调 key 顺序：进程 env > 设置面板 genKeys（.apollo-config.json）> 千问聊天 key 复用（DASHSCOPE 一 key 两用）；由 `_gen_env()` 注入生成子进程，key 绝不落日志。
- **无 key 不阻塞**：自动探针输出（缺哪个 env）+ mock 占位 + MOCK 标——绝不静默顶替（`docs/playbooks/testing.md` 凭证探针红线）。
- 成本闸：内容寻址缓存 hash(provider+prompt+model+seed)——命中不重扣费；断点续跑以 status 为断点。

## 六五、五步流程条（owner 2026-07-10「工作流进 UI·每步 double verify」）

平台顶部常驻流程条：**①需求台账 → ②风格锚 → ③批量生成 → ④写回替换 → ⑤人审复核**——状态与证据全部从台账推导（灰=未到·黄=进行中/带 MOCK·绿=完成），LLM 长流程漂移由 UI 结构钉死。double verify=每张图两道门：机器门（③探针/④parseManifest）+ **人门（⑤ `approved`·平台「☑ 复核通过」单行/全部·POST /api/art/approve·只许已写回行复核）**。

## 七、风格与人审

- 风格包=**纯数据文件 `scripts/style-packs.json`**（3 包·中英双方言+palette+负面词+钉死 provider/model/seed）；扩包=加一条 JSON，不改代码。refImage 参考图字段保留，adapters 参考图入参待真 key 验证（blocker 已记）。
- 人审姿态（按 owner 07-07 归置闭环）：**单行生成=预览→人点确认**（这就是人审）；**批量/换皮=快速通道**直落+unreviewed 标+台账墙可见；**进共享货架仍必须 M2.5 pending 人审**（`/api/assets/generate`+`/api/assets/review` 保留原样服务共享货架与 AssetGenPanel）。上传一律 magic-bytes 内容嗅探。

## 八、退役与废弃（再引用=过期信号）

- ❌ `GameQArtCockpit`（组件+测试已删）——功能全部并入平台。
- ❌ `/api/art/needs-fill` 端点（已删）——填回由 fill/upload 流程自带。
- ❌ `public/games/game-q/art/game-q-art-ledger.json`（已删）——唯一台账=art-ledger.json。
- ❌ art-list.md 的 q-spr-NN 私有编号——以台账 art-NN 为准。

## 九、验证记录（2026-07-10 mock 政策收口时）

tsc 0 · vitest 全绿（art-replace 27 测：编号三测/皮肤槽三测/review 四条修正三测/mock 政策三测含覆盖后门回归）· build 0 ·
`art-replace-smoke.py` 45/45（含 mock 三道闸腿）· `art-review-smoke.py` 17/17 · game-q RATCHET PASS（AUDIT FAIL=存量 createElement×5 基线债·未新增）。
**真 key 端到端待 owner key 到位**（清单=冲刺纲领 §六）：填设置面板→平台不勾 mock→一键全量即真图。
