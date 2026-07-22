# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。

---

## 待处理 / 进行中

### REQ-ART-可消费槽铁律 · 美术台本只列「有消费槽」的行 + 程序化背景下沉成可替换槽 · [2026-07-22] · owner 拍板（game-c 素坯写不回暴露·「不想没消费槽的图列在台本·换了也白换」）→ Lead 出图 → **全游戏一体适用：Lead 供引擎件（审计+背景槽）· 各 PE 接自己游戏** · status: open · 优先级: P1 · 类型: 美术生产链铁律 + 引擎能力（跨全游戏）
> **owner 原则（一句话）**：美术台本（`art-ledger.json`）里**每一行都必须有真实消费槽**——生成/替换它，游戏里能真的换上。**没有消费槽的"孤儿行"禁止列进台本**（否则 owner 换了也白换=浪费+误导）。game-c 37 行素坯全 `skinKey:null`、游戏零引用=反面教材（REQ-C-112）。
> **消费槽的两种合法形态**：① 数据卡带=manifest 里的 `art:` 引用；② 编译期游戏=`skinKey`（游戏渲染代码按此 resolve 上画面）。两者皆无=孤儿=违规。
>
> **【Lead 供·引擎件·全游戏共享】**
> 1. **孤儿行审计**（机器守卫）：新增检查——台账行若既无 manifest `art:` 绑定、又无 `skinKey`（或 skinKey 无游戏侧消费）→ 报 `ORPHAN-LEDGER-ROW` 警告（列出 game+行号），让"生成了没处接"被机器抓到、不再静默坑 owner。挂进 `game-skill-audit` 或 art-replace 校验（Lead 定）。
> 2. **背景/场景皮肤槽能力**：程序化背景（如 game-c `theme.ts` 画的渐变、game-a `MANOR_BG`）目前是宿主层 CSS、skinKey 够不着 → 加通用 `mountHost` 背景皮肤槽：声明 `sceneBgSkin` 数据槽 → art-ledger 派生该行 → 生成图填入 → **有生成图用图·无图回退现程序化背景（兜底永不丢）**。红线：render-only·不碰 sim/hash·生成图过 M2.5 人审才覆盖（不自动拿 AI 图盖掉手绘背景·防质量倒退）。
>
> **【各 PE 接·自己游戏·可粘给 PE-A/PE-B/PE-C】**
> 逐行审自己游戏的 `art-ledger.json`：每行二选一——**(a) 接消费槽**（编译期加 skinKey + 游戏渲染消费之·背景类用上面的 sceneBgSkin·留程序化兜底）；**(b) 删/退役**（这行游戏根本不用→retire 或移出台本·别让它躺在台本里骗你去换）。**完工判据：孤儿行审计零告警**（台本每行都能真换上画面）。
> **边界**：引擎件（审计守卫 + mountHost 背景槽 + art-ledger 派生）=Lead 域；各游戏台账清理 + 渲染消费接线=各 PE 域（game 代码）。
> **Lead 落地状态**：**① 孤儿行审计 ✅ done**（`scripts/ledger-audit.mjs`+`.test.mjs` 8 测绿·`npm run ledger:audit`·契约=skinKey/manifest `art:`·顾问态不阻推送·PE 清完可 `--strict` 单游戏门禁）。**首轮普查（2026-07-22）**：221 行孤儿跨 8 款——game-a(23)·game-b(43)·game-c(37)·game-d(83)·game-q(23)·game-t(4)·sample-platformer(3)·smoke-test-game(5)；**唯 game-g 110/110 全净=样板**。各 PE 照此逐行清（接 skinKey 或退役）。**② mountHost 背景皮肤槽**待 Lead 施工/出 spec。owner 已拿本条分发各 PE。

### REQ-AIGEN-软件内文本生成资产 · Tripo(3D)+千问(2D) 接入创作台 · [2026-07-04] · owner 拍板 → **PA 建生成框架(资产侧)** · status: **框架 ✅ done(PA·mock 全绿)·运行时 UI+设置 UI ✅ 已随 Workshop/T1/T2 建成（Lead 2026-07-16 核账纠偏：原「未做」口径已过时）；剩=真 key(owner 采购) + 目标服务 adapter(仅 qwen 真实装·Seedance/NanoBanana/PixVerse 只有 key 槽) + 真调 e2e + 行规格执行——详 `docs/design/retro-workshop-drift-art-2026-07-16.md` §五** · 类型: 新能力(外部 AI 服务·表现层旁路)
> **owner 愿景**：软件内用自然语言描述 → 生成资产（3D 用 **Tripo**·2D 用 **千问/DashScope 万相**），落进资产库。先 mock 打通全框架。
> **PA 已交付（资产侧·`scripts/ai-gen.mjs` + `ai-gen.test.mjs`·mock 全绿）**：厂商无关生成框架 = 适配器注册表（`tripo` 文本→glb·`qwen` 文本→png）+ mock 产合法资产（glb/png·prompt 播种）+ **连库**（落 `assets/index.json` 或游戏本地 `art/index.json`·带 provenance 厂商/prompt/模型/mock/日期）+ 真调门控（fetch Tripo v2 openapi / DashScope 万相·密钥走 env `TRIPO_API_KEY`/`DASHSCOPE_API_KEY`·**绝不入库**·本环境 GitHub-only 真调被挡→`--mock`）+ 设置视图 `providerSettings()`（envKey/是否已配/打码·可被 server/UI 复用）。哲学同 `src/services/aigp`（非确定性旁路·不碰 sim/hash）。
> **待主程/PE（跨域·非 PA）**：① **设置 UI + server**——把 Tripo/DashScope key 接进 `apollo.py` 设置系统（现 `LLM_PROVIDERS` 是 chat 域·生成域另起一套或并入）+ 创作台设置屏（LayoutNode·UI铁律·复用 `providerSettings()` 形状与 `apiKeyMasked` 打码）。② **运行时生成 UI**——创作台输入 prompt→调生成→资产入本地库→即时可用（异步任务·pending/进度·参照 aigp 视频端口 handle 模式）。③ 浏览器侧直调需把生成逻辑做成 `src/services/ai-gen/` 端口（node 侧 `ai-gen.mjs` 是 authoring-time 参照）。
> **真调前置**：放宽网络的环境/session（Tripo/DashScope 域名本环境 403）+ 用户付费 key（owner 已购）。许可按各家订阅商用条款（provenance 已记）。
> **owner 2026-07-16 口径**：真 key 验证**等 owner 买到 key 再开**——「很多事情还没有完备，需要一次性把这事弄完」。在那之前本单挂起、任何 session 不催不动；REQ-STYLESET M1 同卡此口（连动启动）。
> **+ meshy 适配器接入（PST 2026-07-07·owner 直接要「接入 meshy 顺便接菜单」）**：`ai-gen.mjs` ADAPTERS 加第三家 `meshy`（文本→3D glb·kind:mesh·envKey `MESHY_API_KEY`·mock→cube.glb 占位·真调走 Meshy v2 openapi `POST /openapi/v2/text-to-3d` mode:preview → 轮询 `model_urls.glb`·门控同 tripo）；apollo.py 白名单 `GEN_ADAPTERS=('tripo','meshy','qwen')`（新增 provider 两处同改=脚本注册+此白名单）；创作台 `AssetGenPanel` 适配器菜单加 🗿 Meshy(3D) 一档 + provider key 状态自动列出。测试：`ai-gen.test` 注册表 + meshy mock glb·render 测断言菜单含 Meshy。门禁 tsc0/vitest2318/build0。**ai-gen.mjs=PA 框架·此 provider 扩展请 PA 会审**（真调端点/字段是否随 Meshy-6 漂移）。

### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: **M0 ✅ PASS + M0.5 ✅ PASS（Lead 对抗性验收 2026-07-16）；M1 试产 open·等真 key（连 REQ-AIGEN 卡口）** · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。
> **+ M0.6 主题指针（owner 2026-07-16·game-t 连带需求·指派 PUI）**：UITheme 加 `cursor?` 主题令牌（data-URI 图 + hotspot + 按压态·缺省无=老主题零变化·沿 panelTexture 先例：guard+点名测试+ui.md 回填）；apollo-toon 配墨笔尖造型指针（程序化 SVG 占位·台账行留真图位）；触屏无指针不受影响。"墨迹拖尾跟随"记二期候选不做。
> **M0 ✅ done（PA·2026-07-16·待 Lead 对抗性验收）**：`scripts/styleset-ledger.mjs`（静态枚举 §六 清单→art-replace `mergeLedger` 保号·mode:library）+ 库台账 `assets/styleset/apollo-toon/style-ledger.json`（**72 行**·ui 40/fx 12/3d 20）+ 风格包 `apollo-toon` 条目（`scripts/style-packs.json`·stylePrompt 锚 v2 原文·8 色·refImage:null·无厂牌词）+ mock 全链跑通（60 texture 程序化 PNG + 12 mesh cube.glb 占位·落 gen/mock 分域·登记共享 index provenance 硬字段 generator:mock+styleset）+ `asset-reconcile --shared` PASS + 测试 `scripts/styleset-ledger.test.mjs`（5 例·保号/顺延/风格包/reconcile）+ 手册 `docs/playbooks/assets.md ⑨` 回填。**偏差**：`scripts/asset-reconcile.mjs` NON_ASSET 加跳 `style-ledger.json`（库台账元数据非资产·同 art-ledger.json 口径·未碰 art-replace 本体）。真 key 批量生成=M1（PA+PST 会审 styleset 目标扩展）。
> **M0.5 ✅ done（PUI·2026-07-16·待 Lead 对抗性验收）**：新 UITheme `apollo-toon`「水墨玩趣」（`src/ui/apollo-toon-theme.ts`·全 token 覆盖·亮宣纸皮）——8 色板入 palette（文字色令牌取可读深变体·鲜色进皮/背景）+ 程序化 data-URI 皮 4 kind 糖果厚底唇钮（64×64·9-slice slice=12·顶高光+厚唇+墨笔触边）+ 程序化水墨远山背景（`texture`·cover）+ 柔光晕染（`wash`）+ 纸纹面（`panelTexture`）。**闭集扩展 1 处**：UITheme 加 `panelTexture?` 令牌（面板级底纹·`render.ts renderPanel` 消费·guard `!bare`·缺省字节不变）+ 回填 `ui.md`。game-i 换皮下拉接入并置顶 + 选单收敛 3 个（水墨玩趣/青瓷·墨蓝/紫·霓晶·余 5 隐藏不删码）。门禁全绿（tsc+2642 vitest+build）；check-ui：validate 零 issue + ui-audit 3 显式 tab（layout/3dui/shop）0 阻断；真浏览器截图 5 张（厚唇钮/纸纹面/水墨背景成立）。**记账**：程序化皮=占位真相（provenance:procedural·真 key 后 M2 逐行替换）。**已知缺口（提 Lead）**：①ui-audit 对 `border-image` 皮盲区——白字糖果皮在亮父面被判 1.21 假阳（真渲白字压深糖体可读）·仅「无 activeTab 全 tabpage 同显」非真状态触发·逐 tab 显式审全过；②默认 tab-layout 在**任何**亮主题（含既有 daylight）皆因 `dim` 段标题/皮 demo 白字判低对比——非本主题引入。
> **⚖ Lead 对抗性验收（2026-07-16·双线判 PASS）**：门禁独立复跑六项全绿（tsc·vitest 349 文件/2642·build·双守卫·reconcile 三方一致）；域界核对 M0=80 文件全 PA 域、M0.5=12 文件全 PUI 域（引擎域零触碰）；真浏览器亲验（swiftshader）——选单恰 3 项且水墨玩趣置顶、切主题后三签名成立（厚底唇糖果钮/纸纹面/水墨远山）。**偏差裁决**：M0 四条（reconcile 跳台账·风格包全字段·行数落点 72·kind 词表 texture/mesh）全 INTENTIONAL 准许——kind 词表在 M1 接链时须与 art-replace 词表映射对齐；M0.5 `panelTexture` 闭集扩展 INTENTIONAL 准许（沿 texture/wash 先例·guard+点名测试+手册回填齐）。**遗留**：①ui-audit border-image 盲区 + 亮主题 dim 假阳 = PUI 工具债（非阻断·随后续批修）；②换皮**置顶未改默认**（默认仍青瓷·墨蓝）——是否连默认切 apollo-toon 留 owner 拍板（M3 对齐时顺手做）。
> **+ 三游戏风格锚条目 ✅ done（PA·2026-07-17·待 Lead 验收）**：`scripts/style-packs.json` 加 3 条（照 apollo-toon 样板全字段·无厂牌词·refImage:null·negative/post/params 同样板·seed 1776-78·各 8 色 palette）——`sakura-nijigen`（三游戏共用·女性向二次元人物锚·出处 game-b gdd §九+REQ-C-ART 修订①）·`vegas-victoriana`（game-c 场景锚·REQ-C-ART ① 原文锚+鎏金/呢绿/酒红等 8 色）·`modern-manor`（game-a 场景锚·brief §2.2 现代私宅夜局+暖木/夜蓝/灯金等 8 色）。门禁全绿（tsc+vitest 全量+build+双守卫）；art-replace pack 迭代校验绿。

### REQ-ASSET-导入抠图 · 创作台导入时「背景移除→真 alpha」选项（选型 rembg） · [2026-07-16] · owner 拍板「搞起·用 rembg」→ **指派：PA（抠图能力 + 端点·✅ done）+ PST（创作台导入向导选项 UI·open）** · status: **PA ✅ done（PA 2026-07-16）；PST 导入向导 UI open** · 优先级: P1 · 类型: 资产线能力 + 创作台导入 UI（authoring-time·确定性/AI 二档·不碰 sim/hash）
> **PA 完工回执（2026-07-16）**：`scripts/asset-matte.mjs`（+`.test.mjs` 5 测绿·纯 Node·零依赖）——① **确定性主路 flood-fill**：纯 Node PNG 编解码（8-bit RGB/RGBA·非隔行）+ 从四角/种子灌水碰轮廓即停 → 真 alpha PNG。**实测真验「绿幕但主体也有绿」**：主体内部被轮廓包住的同色块 flood 进不去→保留 alpha 255（核心顾虑解决）；确定性（同输入两次 rgba 逐字节一致）。② **despill**（`--despill`·削边缘背景主色残留 halo）。③ **多种子**（`--seed x,y`·环形镂空）。④ **rembg 兜底档**（`--mode rembg`·subprocess 调 rembg·无 rembg→mock 门控·产合法 RGBA png 标 MOCK·**不静默顶替**）。⑤ provenance 记 matte 方式/tolerance/背景色/去背像素/model。**端点**：`POST /api/assets/matte`（`main_entry/assets.py` 薄胶水·base64 in→out+provenance·校验 mode/空图·防注入）——**注：走独立端点而非改 `/api/assets/import`**（后端已模块化·独立端点边界更干净·向导调它出 before/after 预览、再走既有 M2.5 pending 人审）。红线守：authoring-time·纯像素·不碰 sim/hash/LayoutNode。**PST 接**：`AssetImportWizard` 加「移除背景」勾选 + 模式选（flood/rembg）+ tolerance/despill + before/after 预览，调 `POST /api/assets/matte`；产物走 M2.5 pending 人审。**发行前 PA 复核 rembg 最终模型授权**（u2net=Apache-2.0 可商用）。
> **背景（PUI 2026-07-16 会诊落档）**：owner 让 Gemini 生「透明背景」牌背/图，拿到的是**画进像素的棋盘格假透明**（不是真 alpha），贴进 `bg:'transparent'`/`Button.skin`/`PlayingCard.backArt` 显成灰白格子。根因=图像模型输出真 alpha 不可靠。→ 在**导入**处加一道「背景移除→真 alpha」兜底选项。**我们无「透明色键」概念、也不该加**（宪法：非标准游戏专属特例）——统一走 PNG 真 alpha。
> **选型（owner 拍板 rembg）**：`rembg`（**MIT·可商用**·纯本地 CLI/Python 库·首下 u2net onnx ~176MB 后离线·**我们已有 `apollo.py` Python 侧最顺**）。**排除 `@imgly/background-removal`**（免费档 **AGPL 传染性**·发行红线·除非买商用授权）。**发行前 PA 复核最终所选 rembg 模型授权**（默认 u2net=Apache-2.0·可商用；其它模型逐个核）。
> **两档（都要·或先简后繁）**：① **确定性主路=边缘 flood-fill 连通区**（从四边灌水碰轮廓即停→主体**内部**同色/绿鳞不受损·天然免撞色·jimp MIT/sharp Apache 30 行·可单测）——解决「绿幕但主体也有绿」的核心顾虑；② **复杂图兜底=rembg**（AI 分割·毛发/软边）。边角必处理：**despill**（去边缘残留背景色 halo）、**封闭镂空多种子**（环形洞 flood 进不去→补种子）。
> **PA 活**：`scripts/asset-matte.mjs`（flood-fill + 调 rembg·产真 alpha PNG·确定性部分可测·rembg 部分 mock 门控同 ai-gen）+ `/api/assets/import` 加 `matte` 选项参数；产物**一律走 M2.5 pending 人审**（before/after 预览·不静默顶替·auto-matte 会留 halo/啃细节）；provenance 记抠图方式/模型/日期。
> **PST 活**：`src/studio/AssetImportWizard.tsx` 加「导入时移除背景」勾选 + 模式选（绿幕/纯色吸管/自动 flood/rembg）+ before/after 预览；调 PA 端点。
> **红线**：authoring-time·**不碰 sim/hash/LayoutNode**（同 ai-gen/import-art-pack 一类资产变换）；auto-matte **必过人审预览**、绝不导入即改。**验收**：PA rembg 接线 + 测（纯色 flood 确定性真验 + rembg mock）；PST UI 勾选出预览·门禁绿；一张真异形图端到端（生图→导入去背→真 alpha→接 `backArt`/`skin` 透见对）。**边界**：本条 spec 由 PUI 会诊出图·**PUI 不施工**（studio/资产线非 PUI 域）。

### REQ-EVENTLOG-下沉共享事件日志原子 · game-b + game-c 各造一份 → 引擎缺 log/journal 件 · [2026-07-21] · PE-B 报（数据驱动 review 档 B·owner 追问「能用积木就用」纠出）→ Lead 裁决 · status: open · 优先级: P2 · 类型: 引擎原子下沉（DRY·跨游戏复用）
> **缺口**：引擎无「流水事件日志/journal」原子（`tier3/timeline` 是**演出时序调度**·非流水日志）；而 **game-b（`core/game-log.ts` 的 `GameLog` 类）+ game-c（`game-log.ts`）两款各手写一份**「带 seq 的类型化事件流·供 HUD 显示 + 回放」——宪法 §2「真缺口·可复用」信号（rule-of-two 已成·第三款卡牌游戏必再造）。
> **建议方案**：下沉一个 headless `event-log`/`play-journal` 能力（纯数据·确定性·录放安全）：`append({seq,round,actor,kind,text})` / `recent(n)` / `dump()` / `size()`；kind 由消费游戏各填闭集枚举（能力只管容器骨架·不定义具体 kind）。两款迁移消费（game-b `LogKind/LogEvent/GameLog`→薄封装；game-c 内联 log→同）。红线：日志**正文**恒各游戏机读口径（能力不碰文案）。
> **边界**：新增 `src/skills/<tier>/event-log.ts`（或归 tier2 卡牌包）+ 测试；game-b/game-c 各改消费点。**属主程/引擎域·PE 不擅改引擎**——报 Lead 评审下沉粒度（值不值·放哪层·kind 泛型化）。证据全文 `docs/design/game-b/data-driven-review.md` §3 档 B。

### REQ-HANDPAT-歧义自洽 · t3-hand-pattern legalResponses 与 act/beats 判读口径一致化 · [2026-07-18] · PE-A 报（A-008）→ Lead 裁决 ✅ 接（引擎正确性 bug）→ **指派：Opus** · status: in-progress（已派工） · 优先级: P1 · 类型: 引擎 capability bug（正确性关键·不降档）
> **根因**：`legalResponses` 按「意图家族」枚举应对并以该家族比压制；`act`/`legalCheck`/`beats` 走 `matchPattern` **最强判读**——含逢人配的一手多判读时，最强判读落到另一普通型家族→跨家族压不过→legalResponses 承诺的牌 act 拒收（实证：墩=钢板 JJJ-QQQ，QQ+KK+两♥5 按钢板 QQQ-KKK 返回，规范判读=三连对 Q-K-A 更强→拒）。后果=提示按钮给「打不出去的牌」/AI 空过（game-a 已游戏层兜底滤除·引擎修好可退）。
> **⚖ Lead spec**：修 `legalResponses`——每个候选生成后用**规范口径自洽复核**：应对仅当 `beats(play.cards, target, cfg)`=true 才纳入；领出仅当 `matchPattern` 非空。**不改 beats/legalCheck 语义**（「任一判读能压」方向回驳=改判定语义·风险大）。测试点名：① A-008 实证例复现（修前红修后绿）；② **不变量测**=∀ legalResponses 返回项 legalCheck 必过（含逢人配多手枚举）；③ 既有 conformance 测零回归。game-a 兜底 filter 去留=PE-A 自裁（幂等）。

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
