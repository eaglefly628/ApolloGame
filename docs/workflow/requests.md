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


### REQ-SPLIT-引擎内容分离 · src/games 整体迁出为顶层 games/（虚幻式 Engine/Content 分治·owner 拍板「引擎核与游戏完全解耦」） · [2026-08-01] · owner 令 → Lead 出图 → **指派：Opus（xhigh·正确性关键）** · status: **✅ done（2026-08-02·待 Lead 终审）** · 优先级: **P0（全库爆炸半径·冻结窗内一次落地）** · 类型: 架构重构（引擎/内容边界物理化）
> **⚖ Lead 图纸**：
> ① **布局**：`git mv src/games games`（顶层·保 git 历史）。游戏 import 引擎**只许走别名**（@engine/@skills/@ui/@renderer/@services/@assets/@atom-skills/@net·现有集·不新增语义）；新增别名 `@games/*` → `games/*` 供 launcher/装配层装游戏。**逐个改写游戏内现存的 `../` 越界相对引用为别名**（侦察实证 game-a/c/103 等均有）。
> ② **解耦守卫（本单真正的交付物·防回潮）**：新检查（并入 scoped-gate 或独立 `scripts/decouple-check.mjs`·退出码）——(a) `games/**` 禁相对路径逃出自己游戏目录；(b) `src/**` 禁 import `games/**`（运行时 URL 字符串 `/games/<g>/…` 与 public 资源路径**不算**·按 import 语句判）；引擎面测试文件若真 import 游戏→改本地 fixture 或迁到该游戏目录。
> ③ **配置与脚本全量更址**：tsconfig（paths+include）/vite/vitest/scoped-gate 范围判定（games/ 前缀=单游戏面）/game-pipeline（detectForm·gameHash 根·acceptance adapterPath）/game-skill-audit/export-game（导出树拷贝源）/美术脚本/audit-baseline/tools/audits——侦察计 72 文件，逐个过。
> ④ **文档清扫**：82 份含 `src/games` 的文档全量替换为 `games/`；CLAUDE.md 域边界行（P3D=games/game-z·PUI=games/game-i）、llm-onboarding、各手册同步；「文档与实现同一改动内同步」硬约束首次执行。
> ⑤ **预期涟漪据实报不救火**：gameHash 覆盖路径变更→全部游戏门证过期属预期（下次 gate 重戳）；勿为压过期去改指纹语义。
> ⑥ **验证**：全量门禁退出码全 0 + 三项冒烟=`board game-a`（能识别 compiled）+ `acceptance-run --game game-a`（8 剧本绿）+ 一次 dokiworld 导出真跑（tsc+build 通过）。**单一原子提交**（冻结窗口内落地·rebase 带新提交必须重跑全套）。
> **✅ done（Opus·2026-08-02·待 Lead 对抗性终审）**：626 文件 `git mv src/games → games`（保历史）；`src/games` 字面串全仓替换为 `games`（95 份 .md + 若干 .ts/.mjs/.py，4 处 `public/games/**/*.json` 溯源字段按「public/games 路径一律不动」明确排除·未碰）；games/** 内 88 个文件的 `../../{runtime,assembly,services,renderer,ui,net}` 越界相对引用改别名；src/ 内 12 个装配层/工具/测试文件的游戏 import 改 `@games/*`；scripts/tools 全量更址逐个验证（game-pipeline、game-skill-audit、acceptance-run、export-game、dokiworld 导出插件、emoji 系列、scoped-gate 等 20+ 文件，含数处 `join(root,'src','games',…)` 拆参写法与 `'..','..'` 深度计算·非字面串替换能覆盖·逐条人工核过）；新增 `scripts/decouple-check.mjs`（(a)(b) 双向守卫 + 3 例自测）并接入 `scoped-gate.mjs` 常驻守卫链。全量门禁复跑：tsc 0 · vitest 全量 425 文件/3749 测全绿（快车道，即 push 门禁实跑的那条）· `APOLLO_DEEP=1` 慢车道 444 文件/3950 测（2 个游戏另有 2 个 pre-existing 失败，见下）· build 0 · docs-ref-guard PASS(40 .md/345 路径) · context-budget-guard PASS · decouple-check 0 违规。三项冒烟：15 款游戏 `board` 全部正确识别 compiled 且不报错；`acceptance-run --game game-a` 8/8 绿；`export-game.mjs game-c --target dokiworld` 真跑 → 产物在独立环境 `npm install && tsc --noEmit && vite build` 全绿（224 源文件闭包·42 运行时资产·`src/game/{engine,runtime,assembly,…}` + `src/games/game-c/**` 双桶落位符合 `mapToOut` 预期）。gameHash 覆盖路径变更 → 全部游戏 S3+ 门证按预期过期（未动指纹语义）。
> **2 个 pre-existing 失败（非本单引入·已用 git stash 对比 origin/claude/mainbranch 原始 src/games 布局逐字节复现同一失败·仅在 `APOLLO_DEEP=1` 慢车道可见·push 门禁实跑的快车道不含它们）**：`scripts/audit-ratchet.test.mjs`（game102 innerHTML×2/createElement×4 超出 `audit-baseline.json` 基线，未经 Lead 批注）；`scripts/acceptance.test.mjs`/`acceptance-run.mjs`（game102 三个验收剧本步骤断言不过——像素消除计数/胜负判定与规则不符）。两者都是 game102 自身规则实现缺陷，与路径迁移无关，未动。
> **待 Lead 裁决清单（本单执行中拿不准、未自行拍板、如实留痕）**：
> ① **新增 `@runtime`/`@assembly` 两个别名**（图纸①写明「现有集·不新增语义」，但本条实测突破）——起因：games/** 内近 90 处越界引用里，`runtime/engine.js`（`Engine`）与 `assembly/demo.assembly.js`（`WorldBlueprint`/`EntityBlueprint`）占绝大多数，且两者在 tsconfig 现有 8 个别名里**都没有对应项**。若不给别名、只调整相对路径深度（`../../src/runtime/…`），tsc/vitest/build 在本仓能过，但**会让 `tools/export-game.mjs` 的导出拷贝映射算错目的地**（用真实 `--target dokiworld` 导出 + 独立 `tsc`/`vite build` 复验证实：不加别名会 ENOENT）。已在 tsconfig.json / vite.config.ts / vite.config.cartridge.ts / `tools/export-game.mjs` 的 `ALIASES` / `tools/export-targets/dokiworld.mjs` 的硬编码 alias 块五处同步加齐，游戏侧对应 import 全部改用新别名。请 Lead 裁：接受此扩展，还是要求改走别的机制（如把 Engine/WorldBlueprint 经 `@engine` 二次导出）。
> ② **`scripts/decouple-check.mjs` 白名单收窄为「精确文件」而非目录级**——实测发现图纸②给的白名单（仅 `src/launcher/**`、`src/cartridge*`）之外，还有 10 个 **既有**（非本次引入）`src/` 文件直接 import 具体游戏模块：`src/studio/{AssetLibrary,StudioInspector,assets-model,inspector.render.test,preview.integration.test}`（资产浏览/预览工具）、`src/bench/{games,zerocraft-bench.test}`（基准测试）、`src/assembly/{validate-manifest,validate-references}.test.ts`（引擎一致性测试）、`src/game-e.tsx`（game-e 独立入口，历史遗留不在 games/ 目录下）。为了让新守卫真正跑绿（图纸⑥要求全部门禁退出码 0）又不擅自开目录级口子放大回潮面，改成在 `decouple-check.mjs` 里按「精确文件路径」逐条 grandfather（`SRC_GRANDFATHERED` 常量·10 条）——**这仍是实质违规，只是先记账不拦停**。`games/**` 内另 2 处同理精确豁免（`A_GRANDFATHERED`）：`game-f/lobby.tsx` 内嵌教程 html（`?raw` 资产引用，非模块依赖）、`game-c/dokiworld-export.test.ts` 引用 `tools/export-targets/dokiworld.mjs`（测试自身要读导出插件做锚点守卫）。请 Lead 裁：这 12 条是否维持「记账不拦」、扩成正式目录白名单、还是要求重构消除。
> ③ **`main_entry/games_list.py`（`GET /api/games` 枚举 `ROOT/'src'/'games'`）与 `main_entry/packaging.py`（打包存在性判断同款路径）**——图纸①-⑥列出的文件范围未包含 Python 后端，但这两处若不改，迁移后会**静默**返回空游戏列表/打包判定失败（不在本单任何门禁/冒烟覆盖范围内，故顺手一并改为 `ROOT/'games'`）。请 Lead 复核这个越界改动是否妥当。
> ④ **4 处 `public/games/**/*.json` 内的 `"src/games/…"` 溯源字符串**（`game-a/pipeline.json` 1 处审计 note、`game-b/art/art-ledger.json` 8 处 `site`/`source`、`game-b/pipeline.json` 1 处 note、`game-i/art/index.json` 4 处 `source`）——按图纸「public/games 路径一律不动」严格未碰，字符串仍写着已不存在的旧路径（历史审计记录，非当前代码路径，不影响任何门禁/运行时）。请 Lead 裁是否需要在后续小单里同步刷新。

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
