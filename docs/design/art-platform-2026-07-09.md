# 美术平台·终态一页（2026-07-09 · Lead 亲手收口 · **全员必读**）

> owner 授权 Lead 一次性收口（R1/R2/R3 三单合并落地后撤单）。本页=美术管线现状的**唯一权威描述**；
> 上游设计=`docs/design/art-replacement-workflow.md`（五步流程/schema 全文），冲刺纲领=`docs/design/demo-sprint-2026-07-29.md`。
> 有出入以本页+代码为准；发现漂移提 `docs/workflow/requests.md`。**分角色交接（PST/透视器/game-q/PA 各自要看的）=`docs/workflow/finish/art-platform-handoff-2026-07-09.md`。**

## 一、现在的样子（一句话）

**一个平台（ArtLedgerPanel·双数据源）+ 一个大脑（`scripts/art-replace.mjs`）+ 一份台账（每游戏 art-ledger.json）**——
从「游戏要哪些美术」到「批量/单张生成、真调或 mock、写回上画面」全在一条路上；cockpit 已退役。

## 二、入口

| 入口 | 打开什么 |
|---|---|
| 主屏 🎨 美术平台（game-q）按钮（dev 模式） | 编译期游戏线台账（game-q） |
| 游戏库卡带操作条 「🎨 美术台账」 | library 卡带线台账 |
| 设置面板 「🎨 美术生成 API Key」区 | 配 DASHSCOPE / TRIPO / MESHY key（存 .apollo-config.json·打码回显） |

## 三、双数据源（同一个面板·差异只在写回）

| | library 卡带（studio 产出） | 编译期游戏（src/games·如 game-q） |
|---|---|---|
| 台账来源 | `derive`（扫 manifest art: 槽位） | `deriveRequirements`（扫蓝图视觉实体·`scripts/game-q-art-requirements.mjs`） |
| 写回机制 | 按编号**重钉 manifest 引用**（落盘前 parseManifest 零 error 铁律） | **skinKey 别名登记**进本地 index（蓝图零改动·见 §五） |
| 可用动作 | 重生成 / 库选换 / 上传 / 一键全量 / 一键换皮 | 重生成 / 上传 / 一键全量（无 manifest 可钉→换库与换皮隐藏） |

## 四、台账=唯一真相（canonical 行 schema）

`public/games/<slug>/art/art-ledger.json`，行=`{no, kind, slot, query, prompt?, skinKey?, placeholder, spec, context, status, gen, provenance, history?}`。

- **编号 append-only（owner 07-09 定案）**：重跑推导走 `mergeLedger`——已有槽位**保原 no**（连同状态/生成/prompt/history），新槽位取 max+1 顺延，消失槽位标 `status:'retired'` **墓碑保号永不复用**。「art-03」今天明天都是同一个东西。
- `prompt` = 人工精调提示词（game-q 的 7 个主角面已从 art-list.md 回填），有则整体替代 query 作生成主体；docs 下两份 md 已降级只读视图，**勿再手改 md 当真相**。
- `status` 流转：`needs-art|placeholder → generated → replaced/filled → approved`；`retired`=墓碑。

## 五、写回=怎么让生成的图真出现在游戏里

- **library 线**：`applyReplacements` 把 art: 引用钉成 `gen/art-NN` 本地资产 id → parseManifest 校验 → 落盘。
- **编译期游戏线**：蓝图视觉实体带 `Sprite:{textureKey:'q/xxx'}` 皮肤槽（与 Shape 并存）；引擎 `chooseRenderMode`
  规则=**贴图就绪盖过 Shape、未就绪回退 Shape**——所以没美术时观感一字不变。生成/上传时按 `skinKey`
  把产物**别名登记**进 `public/games/<g>/art/index.json`；游戏 mount 拉本地 index（`registerAssetIndex`），
  资产就绪自动换装。**给新编译期游戏接美术=给视觉实体加 Sprite 皮肤槽一行，别的全免。**（样板：game-q `theme.ts` SKIN / `blueprint.ts` / `game-q.ts` skinAssets）

## 六、真调 / mock 语义（demo 死穴已除）

- **mock 只在显式勾选**（平台「mock 试跑」勾选框）或显式 env 才走；服务端已无任何硬编码 `--mock`。
- 真调 key 顺序：进程 env > 设置面板 genKeys（.apollo-config.json）> 千问聊天 key 复用（DASHSCOPE 一 key 两用）；由 `_gen_env()` 注入生成子进程，key 绝不落日志。
- **无 key 不阻塞**：自动探针输出（缺哪个 env）+ mock 占位 + MOCK 标——绝不静默顶替（`docs/playbooks/testing.md` 凭证探针红线）。
- 成本闸：内容寻址缓存 hash(provider+prompt+model+seed)——命中不重扣费；断点续跑以 status 为断点。

## 七、风格与人审

- 风格包=**纯数据文件 `scripts/style-packs.json`**（3 包·中英双方言+palette+负面词+钉死 provider/model/seed）；扩包=加一条 JSON，不改代码。refImage 参考图字段保留，adapters 参考图入参待真 key 验证（blocker 已记）。
- 人审姿态（按 owner 07-07 归置闭环）：**单行生成=预览→人点确认**（这就是人审）；**批量/换皮=快速通道**直落+unreviewed 标+台账墙可见；**进共享货架仍必须 M2.5 pending 人审**（`/api/assets/generate`+`/api/assets/review` 保留原样服务共享货架与 AssetGenPanel）。上传一律 magic-bytes 内容嗅探。

## 八、退役与废弃（再引用=过期信号）

- ❌ `GameQArtCockpit`（组件+测试已删）——功能全部并入平台。
- ❌ `/api/art/needs-fill` 端点（已删）——填回由 fill/upload 流程自带。
- ❌ `public/games/game-q/art/game-q-art-ledger.json`（已删）——唯一台账=art-ledger.json。
- ❌ art-list.md 的 q-spr-NN 私有编号——以台账 art-NN 为准。

## 九、验证记录（2026-07-09 收口时）

tsc 0 · vitest 2358（313 文件·含 mergeLedger 编号三测/皮肤槽写回三测）· build 0 · `art-replace-smoke.py` 33/33 ·
`art-review-smoke.py` 17/17 · game-q RATCHET PASS（AUDIT FAIL=存量 createElement×5 基线债·未新增）·
mock 单槽 fill 全链自证（prompt 回填生效/gen+皮肤别名双登记/provenance 全）。
**真 key 端到端待 owner key 到位**（清单=冲刺纲领 §六）：填设置面板→平台不勾 mock→一键全量即真图。
