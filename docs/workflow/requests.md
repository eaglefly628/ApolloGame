# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-QC-UI-工坊生产板显示「复查门」+ 评分卡摘要 · [2026-07-15] · Lead（REQ-QC-三门接续·全文回执在 archive）→ **指派：PST** · status: open · 优先级: P1 · 类型: 工坊 UI（数据已通·只差显示）
> 三门制已上线（`game-pipeline.mjs`·板 JSON 已带 `review` 字段+scorecard·端点自动透传），工坊生产板 UI 现只画机器门/人门两行——请 PST 在 GamePipelinePanel 补第三行「复查门」+ S7 评分卡判词（`VISUAL: n/24 · PREMIUM`）显示，照 CLI 版式（`board <slug>` 输出）。参考手册 `docs/playbooks/review-gates.md`。

### REQ-AIGEN-软件内文本生成资产 · Tripo(3D)+千问(2D) 接入创作台 · [2026-07-04] · owner 拍板 → **PA 建生成框架(资产侧)** · status: **框架 ✅ done(PA·mock 全绿)·运行时 UI+设置 UI ✅ 已随 Workshop/T1/T2 建成（Lead 2026-07-16 核账纠偏：原「未做」口径已过时）；剩=真 key(owner 采购) + 目标服务 adapter(仅 qwen 真实装·Seedance/NanoBanana/PixVerse 只有 key 槽) + 真调 e2e + 行规格执行——详 `docs/design/retro-workshop-drift-art-2026-07-16.md` §五** · 类型: 新能力(外部 AI 服务·表现层旁路)
> **owner 愿景**：软件内用自然语言描述 → 生成资产（3D 用 **Tripo**·2D 用 **千问/DashScope 万相**），落进资产库。先 mock 打通全框架。
> **PA 已交付（资产侧·`scripts/ai-gen.mjs` + `ai-gen.test.mjs`·mock 全绿）**：厂商无关生成框架 = 适配器注册表（`tripo` 文本→glb·`qwen` 文本→png）+ mock 产合法资产（glb/png·prompt 播种）+ **连库**（落 `assets/index.json` 或游戏本地 `art/index.json`·带 provenance 厂商/prompt/模型/mock/日期）+ 真调门控（fetch Tripo v2 openapi / DashScope 万相·密钥走 env `TRIPO_API_KEY`/`DASHSCOPE_API_KEY`·**绝不入库**·本环境 GitHub-only 真调被挡→`--mock`）+ 设置视图 `providerSettings()`（envKey/是否已配/打码·可被 server/UI 复用）。哲学同 `src/services/aigp`（非确定性旁路·不碰 sim/hash）。
> **待主程/PE（跨域·非 PA）**：① **设置 UI + server**——把 Tripo/DashScope key 接进 `apollo.py` 设置系统（现 `LLM_PROVIDERS` 是 chat 域·生成域另起一套或并入）+ 创作台设置屏（LayoutNode·UI铁律·复用 `providerSettings()` 形状与 `apiKeyMasked` 打码）。② **运行时生成 UI**——创作台输入 prompt→调生成→资产入本地库→即时可用（异步任务·pending/进度·参照 aigp 视频端口 handle 模式）。③ 浏览器侧直调需把生成逻辑做成 `src/services/ai-gen/` 端口（node 侧 `ai-gen.mjs` 是 authoring-time 参照）。
> **真调前置**：放宽网络的环境/session（Tripo/DashScope 域名本环境 403）+ 用户付费 key（owner 已购）。许可按各家订阅商用条款（provenance 已记）。
> **owner 2026-07-16 口径**：真 key 验证**等 owner 买到 key 再开**——「很多事情还没有完备，需要一次性把这事弄完」。在那之前本单挂起、任何 session 不催不动；REQ-STYLESET M1 同卡此口（连动启动）。
> **+ meshy 适配器接入（PST 2026-07-07·owner 直接要「接入 meshy 顺便接菜单」）**：`ai-gen.mjs` ADAPTERS 加第三家 `meshy`（文本→3D glb·kind:mesh·envKey `MESHY_API_KEY`·mock→cube.glb 占位·真调走 Meshy v2 openapi `POST /openapi/v2/text-to-3d` mode:preview → 轮询 `model_urls.glb`·门控同 tripo）；apollo.py 白名单 `GEN_ADAPTERS=('tripo','meshy','qwen')`（新增 provider 两处同改=脚本注册+此白名单）；创作台 `AssetGenPanel` 适配器菜单加 🗿 Meshy(3D) 一档 + provider key 状态自动列出。测试：`ai-gen.test` 注册表 + meshy mock glb·render 测断言菜单含 Meshy。门禁 tsc0/vitest2318/build0。**ai-gen.mjs=PA 框架·此 provider 扩展请 PA 会审**（真调端点/字段是否随 Meshy-6 漂移）。

### REQ-PA-工坊工位四件 · PA 已做批对齐认定 + 后续任务（owner「直接给他分派」）· [2026-07-04] · Lead 裁决派单 → **指派：PA** · status: open · 优先级: P1 · 类型: 资产治理与数据面（工坊分工=主责 PST·副责 PA）
> **对齐认定（Lead 2026-07-04）**：PA 近批（`d4a38341`→`b34ba961`：mesh/材质货架·程序化贴图+天空盒·9 品类 PBR 材质库·vendor 数据型扩展·右键 copy 入口）**全部落在愿景 M0 + M2 接线器切片上，方向零偏差**。边界更新：owner 已开 PST 角色——**工坊 UI/apollo.py 端点自此归 PST**（`b34ba961` 的右键入口移交 PST 维护）；PA 专注资产逻辑/CLI/契约（`assets/**`·`scripts/` 资产线·index 规范）。
> **① REQ-PA-3D 收尾**：③ 本地目录标准 `public/games/<game>/art/{textures,models,materials,env}/` 回填 `docs/playbooks/assets.md` 一节；①②④a 完成态在原单回标（④b P3D 切换催 P3D）。
> **② M2.5 登记契约（PST 的图纸补件·先行）**：出 ≤1 页「pending 清单 + provenance/license 硬字段」契约（字段名/必填/校验规则/示例条目），供 PST 照抄实现；M2.5 完工时 PA 会审登记面 diff。
> **③ 三方对账 CLI（M1 数据面前置）· ✅ done（PA 2026-07-16）**：`scripts/asset-reconcile.mjs` + `.test.mjs`（4 测·全绿）。三类 finding（行 schema 位置|期望|实际）：**dangling-file**（FAIL·登记 filled 有 path 但磁盘无文件·site-absolute 路径解析到 public/·相对解析到 assets/·tbf/placeholder 合法无文件不误报）、**orphan-file**（WARN·磁盘有文件但无登记·跳过 index/台账/pending/dotfile/FreeArtLib）、**dangling-key**（FAIL·材质/贴图 spec 的 map/normalMap… 或 vendoredFrom 指向不在册 id）。判词 `RECONCILE: PASS|WARNINGS|FAIL`+退出码（FAIL=1·照 docs-ref-guard）；`--json` 出结构化（M1 报表吃）。scope：`[<game>|--all|--shared|--games]`（默认 all）。实测：共享货架 30k 条 PASS·各游戏本地 70 孤儿 WARN（game-g/k placeholder·game-z shelf 贴图）。
> **④ 配方格式草案 → wontfix·已覆盖（Lead 裁决 2026-07-16·owner 认可）**：「程序化贴图=纯数据」已由 REQ-VECTOR-ART 生成器注册表落地（asset-index `spec.generator{name,params}`·params=纯数据·确定性纯函数·game-g 索引已在用）——再立 recipe 格式=同一概念两套词汇（口径漂移温床·宪法反对）。gen-textures/pack-atlas 保持为 authoring-time 作坊工具（产物入库照登记）；未来若真要数据化 → 收敛到既有 generator 词汇，不另立格式。PA 免写草案，本单收窄为 ①②（③已 done）。

### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。

### REQ-ASSET-导入抠图 · 创作台导入时「背景移除→真 alpha」选项（选型 rembg） · [2026-07-16] · owner 拍板「搞起·用 rembg」→ **指派：PA（抠图能力 + 端点·✅ done）+ PST（创作台导入向导选项 UI·open）** · status: **PA ✅ done（PA 2026-07-16）；PST 导入向导 UI open** · 优先级: P1 · 类型: 资产线能力 + 创作台导入 UI（authoring-time·确定性/AI 二档·不碰 sim/hash）
> **PA 完工回执（2026-07-16）**：`scripts/asset-matte.mjs`（+`.test.mjs` 5 测绿·纯 Node·零依赖）——① **确定性主路 flood-fill**：纯 Node PNG 编解码（8-bit RGB/RGBA·非隔行）+ 从四角/种子灌水碰轮廓即停 → 真 alpha PNG。**实测真验「绿幕但主体也有绿」**：主体内部被轮廓包住的同色块 flood 进不去→保留 alpha 255（核心顾虑解决）；确定性（同输入两次 rgba 逐字节一致）。② **despill**（`--despill`·削边缘背景主色残留 halo）。③ **多种子**（`--seed x,y`·环形镂空）。④ **rembg 兜底档**（`--mode rembg`·subprocess 调 rembg·无 rembg→mock 门控·产合法 RGBA png 标 MOCK·**不静默顶替**）。⑤ provenance 记 matte 方式/tolerance/背景色/去背像素/model。**端点**：`POST /api/assets/matte`（`main_entry/assets.py` 薄胶水·base64 in→out+provenance·校验 mode/空图·防注入）——**注：走独立端点而非改 `/api/assets/import`**（后端已模块化·独立端点边界更干净·向导调它出 before/after 预览、再走既有 M2.5 pending 人审）。红线守：authoring-time·纯像素·不碰 sim/hash/LayoutNode。**PST 接**：`AssetImportWizard` 加「移除背景」勾选 + 模式选（flood/rembg）+ tolerance/despill + before/after 预览，调 `POST /api/assets/matte`；产物走 M2.5 pending 人审。**发行前 PA 复核 rembg 最终模型授权**（u2net=Apache-2.0 可商用）。
> **背景（PUI 2026-07-16 会诊落档）**：owner 让 Gemini 生「透明背景」牌背/图，拿到的是**画进像素的棋盘格假透明**（不是真 alpha），贴进 `bg:'transparent'`/`Button.skin`/`PlayingCard.backArt` 显成灰白格子。根因=图像模型输出真 alpha 不可靠。→ 在**导入**处加一道「背景移除→真 alpha」兜底选项。**我们无「透明色键」概念、也不该加**（宪法：非标准游戏专属特例）——统一走 PNG 真 alpha。
> **选型（owner 拍板 rembg）**：`rembg`（**MIT·可商用**·纯本地 CLI/Python 库·首下 u2net onnx ~176MB 后离线·**我们已有 `apollo.py` Python 侧最顺**）。**排除 `@imgly/background-removal`**（免费档 **AGPL 传染性**·发行红线·除非买商用授权）。**发行前 PA 复核最终所选 rembg 模型授权**（默认 u2net=Apache-2.0·可商用；其它模型逐个核）。
> **两档（都要·或先简后繁）**：① **确定性主路=边缘 flood-fill 连通区**（从四边灌水碰轮廓即停→主体**内部**同色/绿鳞不受损·天然免撞色·jimp MIT/sharp Apache 30 行·可单测）——解决「绿幕但主体也有绿」的核心顾虑；② **复杂图兜底=rembg**（AI 分割·毛发/软边）。边角必处理：**despill**（去边缘残留背景色 halo）、**封闭镂空多种子**（环形洞 flood 进不去→补种子）。
> **PA 活**：`scripts/asset-matte.mjs`（flood-fill + 调 rembg·产真 alpha PNG·确定性部分可测·rembg 部分 mock 门控同 ai-gen）+ `/api/assets/import` 加 `matte` 选项参数；产物**一律走 M2.5 pending 人审**（before/after 预览·不静默顶替·auto-matte 会留 halo/啃细节）；provenance 记抠图方式/模型/日期。
> **PST 活**：`src/studio/AssetImportWizard.tsx` 加「导入时移除背景」勾选 + 模式选（绿幕/纯色吸管/自动 flood/rembg）+ before/after 预览；调 PA 端点。
> **红线**：authoring-time·**不碰 sim/hash/LayoutNode**（同 ai-gen/import-art-pack 一类资产变换）；auto-matte **必过人审预览**、绝不导入即改。**验收**：PA rembg 接线 + 测（纯色 flood 确定性真验 + rembg mock）；PST UI 勾选出预览·门禁绿；一张真异形图端到端（生图→导入去背→真 alpha→接 `backArt`/`skin` 透见对）。**边界**：本条 spec 由 PUI 会诊出图·**PUI 不施工**（studio/资产线非 PUI 域）。

### REQ-VOICE-语音输出端口 · TTS 即时档 + 采样档同接口（game-b 立项刚需·新游戏 a/c 可共用） · [2026-07-17] · GD-B 提（owner 指令「需求池提给主程执行」；⚖ 游戏要语音+owner 无音源包→语音合成先发声）→ **LEAD 出图/施工（或派 Opus）** · status: open · 优先级: P1 · 类型: 引擎能力（services 音频线扩展·表现层旁路）
> **需求面契约（GD 口径·架构 Lead 终裁）**：游戏侧只发语音事件 `{charId, event, text(日文台词), params?}`（事件键闭集=`docs/design/game-b/voice-pack-spec.md` §2·17 键）；端口一个接口两档实现——
> ① **TTS 档（v1 默认·零资产零 key）**：浏览器 speechSynthesis·per-char 参数 `{lang:'ja-JP', voiceHint?, rate, pitch}`（spec §0 有三姨太参数草案）；无 ja 音色→降级③。
> ② **采样档（将来配音）**：按 spec §1 命名 wav 资产·同事件键查台账播放；缺文件→降级①。
> ③ **兜底**：SynthAudioPort 合成提示音+字幕（现有·零改动）。
> **红线**：表现层非确定性旁路（不进 sim/hash/回放）；headless/SSR 静默 no-op（同 SynthAudioPort 哲学）；同 char 新事件顶掉旧朗读；**游戏层不直调 speechSynthesis**（端口=src/services 引擎域）。
> **验收**：端口单测（事件→调用形状/降级链①→③/headless no-op）+ 试听入口（建议 game-i sounds 台加一行·PUI 会审）+ `docs/playbooks/audio.md` 回填一行。消费方=game-b（gdd §十）；game-a/c 立项案语音位可共用。
> **腾槽记录**：REQ-VN-退役（P3 去腐·同为 GD-B 所提）撤回让位入档（先清后加·档内可重提）。

### REQ-GUANDAN-牌型 · 掼蛋判型+压制序+逢人配（先裁 poker-hand 可否重组） · [2026-07-17] · 提出人 GD-A（《掼蛋夜宴》game-a S2 前置·owner 07-17 清池授权入池）→ 待 Lead 裁决 · status: open · 优先级: P1 · 类型: 能力缺口候选（正确性关键·不降档）
> - 想实现：掼蛋牌型闭集判定（单/对/三同张/三带二/顺5/三连对木板/钢板二连三/炸弹4-10张/同花顺/四大天王）+ 压制比较序（天王炸>6+张炸>同花顺>5炸>4炸>普通牌型·同型比大·级牌>A）+ **红桃级牌逢人配**（除大小王外百搭）。
> - 已有能力对照：`t3-poker-hand` 有 rankingTable+wild——但掼蛋型（变长连对/钢板/变长炸弹族/跨型压制序）疑似超出扑克 ranking 表达力；请 Lead 先裁**可否重组**，不能再下沉（建议 `guandan-hand` 或泛化表驱动 hand-pattern）。
> - 要求：纯函数判型·种子确定性·可回放；消费方=game-a《掼蛋夜宴》（编译期 TS·capability-plan 随 S2 送审）；设计档 `docs/design/game-a/`。
> - 边界：`src/skills/tier3/**`+registry 注册（Lead 域）；游戏层绝不自写判型解释器（虚胖数据禁令）。

### REQ-BT-行为树 · 通用行为树能力（纯数据树+确定性解释器·先裁 condition/flow 可否重组） · [2026-07-17] · 提出人 GD-A（《掼蛋夜宴》AI·owner 意向 BT）→ 待 Lead 裁决 · status: open · 优先级: P1 · 类型: 能力缺口候选（通用向·非单游戏拓宽）
> - 想实现：AI 外层策略=**纯数据行为树**（selector/sequence/condition/action 节点闭集）+ 通用确定性解释器。掼蛋消费面：记牌四档（记忆保真度分档）、宗师开局偷看 2 张、性格标签（稳健/激进/多变）→ 行为权重；内层出牌=候选生成+估值表（数据）。
> - 已有能力对照：condition/flow/event-when 可表达简单分支——「树形优先级+运行时黑板+跨游戏复用」疑似缺口；请 Lead 裁①重组是否够②不够则通用下沉（独立于掼蛋·NPC/敌 AI 皆可复用）。`wiki/skills/ai-behavior.md` 有行业知识。
> - 要求：全种子 PRNG·无裸随机·AI 决策进确定性轨可回放；spec 细化随 game-a S2 capability-plan。
> - 边界：`src/skills/**`+registry（Lead 域）；游戏层只产 BT 数据与估值表。

### REQ-BT-行为树能力 · 通用 BT 解释器下沉（game-b/c 双消费方·实战暴露的首个隐形能力） · [2026-07-17] · Lead S2 评审改判（两游戏各建 BT=同概念两份·宪法先重组）→ **指派：Opus（随两游戏 M2 节奏派工）** · status: open · 优先级: P1 · 类型: 引擎 AI 能力（tier2·确定性）
> **spec（Lead 图纸）**：①树=纯数据（节点闭集 `selector/sequence/condition/action` + 参数包·装载期校验）；②解释器=引擎确定性代码（tick 制·无时间依赖·随机一律经调用方传入 RandomSeed）；③条件/动作叶=**消费方注册表**（游戏按名注册叶函数·名单声明进 config·未注册名装载即错）；④参数包/难度包=数据覆盖层（game-b 三姨太人设+难度三档、game-c 五性格模板即此形态）；⑤测试点名：各节点语义/深树有界/同 seed 复现/未注册叶报错/两游戏形状用例各一。消费方=game-b（gdd §五）+ game-c（plan §4c）；落地前两家可本地薄实现但树数据结构照本 spec（迁移零改数据）。完工标 ✅ 待 Lead 对抗性验收。

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
