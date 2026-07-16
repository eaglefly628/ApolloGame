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
> **+ meshy 适配器接入（PST 2026-07-07·owner 直接要「接入 meshy 顺便接菜单」）**：`ai-gen.mjs` ADAPTERS 加第三家 `meshy`（文本→3D glb·kind:mesh·envKey `MESHY_API_KEY`·mock→cube.glb 占位·真调走 Meshy v2 openapi `POST /openapi/v2/text-to-3d` mode:preview → 轮询 `model_urls.glb`·门控同 tripo）；apollo.py 白名单 `GEN_ADAPTERS=('tripo','meshy','qwen')`（新增 provider 两处同改=脚本注册+此白名单）；创作台 `AssetGenPanel` 适配器菜单加 🗿 Meshy(3D) 一档 + provider key 状态自动列出。测试：`ai-gen.test` 注册表 + meshy mock glb·render 测断言菜单含 Meshy。门禁 tsc0/vitest2318/build0。**ai-gen.mjs=PA 框架·此 provider 扩展请 PA 会审**（真调端点/字段是否随 Meshy-6 漂移）。

### REQ-PA-工坊工位四件 · PA 已做批对齐认定 + 后续任务（owner「直接给他分派」）· [2026-07-04] · Lead 裁决派单 → **指派：PA** · status: open · 优先级: P1 · 类型: 资产治理与数据面（工坊分工=主责 PST·副责 PA）
> **对齐认定（Lead 2026-07-04）**：PA 近批（`d4a38341`→`b34ba961`：mesh/材质货架·程序化贴图+天空盒·9 品类 PBR 材质库·vendor 数据型扩展·右键 copy 入口）**全部落在愿景 M0 + M2 接线器切片上，方向零偏差**。边界更新：owner 已开 PST 角色——**工坊 UI/apollo.py 端点自此归 PST**（`b34ba961` 的右键入口移交 PST 维护）；PA 专注资产逻辑/CLI/契约（`assets/**`·`scripts/` 资产线·index 规范）。
> **① REQ-PA-3D 收尾**：③ 本地目录标准 `public/games/<game>/art/{textures,models,materials,env}/` 回填 `docs/playbooks/assets.md` 一节；①②④a 完成态在原单回标（④b P3D 切换催 P3D）。
> **② M2.5 登记契约（PST 的图纸补件·先行）**：出 ≤1 页「pending 清单 + provenance/license 硬字段」契约（字段名/必填/校验规则/示例条目），供 PST 照抄实现；M2.5 完工时 PA 会审登记面 diff。
> **③ 三方对账 CLI（M1 数据面前置）· ✅ done（PA 2026-07-16）**：`scripts/asset-reconcile.mjs` + `.test.mjs`（4 测·全绿）。三类 finding（行 schema 位置|期望|实际）：**dangling-file**（FAIL·登记 filled 有 path 但磁盘无文件·site-absolute 路径解析到 public/·相对解析到 assets/·tbf/placeholder 合法无文件不误报）、**orphan-file**（WARN·磁盘有文件但无登记·跳过 index/台账/pending/dotfile/FreeArtLib）、**dangling-key**（FAIL·材质/贴图 spec 的 map/normalMap… 或 vendoredFrom 指向不在册 id）。判词 `RECONCILE: PASS|WARNINGS|FAIL`+退出码（FAIL=1·照 docs-ref-guard）；`--json` 出结构化（M1 报表吃）。scope：`[<game>|--all|--shared|--games]`（默认 all）。实测：共享货架 30k 条 PASS·各游戏本地 70 孤儿 WARN（game-g/k placeholder·game-z shelf 贴图）。
> **④ 配方格式草案（M2/M3 前置）**：把 gen-textures/pack-atlas 收编为「recipe 纯数据」的格式草案 ≤2 页（op 闭集/参数 schema/可重跑语义）交 Lead 审——过审前不动现有 CLI。

### REQ-ART-TGS吸收四件 · threejs-game-skills 对照吸收（视觉评分卡/音频线/像素QA/手册红线） · [2026-07-06] · owner 给源 → Lead 调研裁决（`art-pipeline-vision §八`）→ **owner 已批（2026-07-06）** · status: **落地中：A+D ✅ done（Lead 亲笔 2026-07-07）· B spec 就绪→指派 PST（**冲刺后**·被 REQ-DEMO-0729 队列重排压后）· C spec 已移 `docs/workflow/requests-3d.md`（P3D 域·同被压后）** · 优先级: P2 · 类型: 质量护栏吸收（不采其代码生成路线·宪法相反）
> 一句话：他家"AAA"不是描述词，是四道门（评分卡全维≥2/证据台账/反捷径工艺律/canvas 像素断言）——护栏纪律照单吸收，代码生成路线回驳。详见愿景稿 §八对照表。
> **A ✅（Lead 亲笔）**：新 `docs/playbooks/visual-scorecard.md`（8 维 0-3 分·premium=全维≥2·证据台账+资产来源台账+凭证探针·反捷径工艺律·判词 `VISUAL: n/24 · PREMIUM: YES|NO`）；挂点=playbooks/index 一行 + P3D 视觉验收（3d.md 红线区指回）+ PS 出货内门（PS-steam-finish-list 阶段区一行）。
> **D ✅（Lead 亲笔·手册回填）**：`docs/playbooks/3d.md` 红线区加工艺顺序律（先造型→材质→光照→特效·禁 glow 冒充）+ 主角面禁纯程序化（无 blocker 记录不豁免）；`docs/playbooks/testing.md` 红线区加凭证探针（空口 skip 不采信）+ 做X表挂评分卡行。
> **B spec（Lead 图纸·指派 PST·工坊 M3.5·与其他 studio 单碰 `apollo.py`/`scripts/ai-gen.mjs` 须串行——排 REQ-STUDIO 心跳余项之后）**：① `scripts/ai-gen.mjs` 加 audio adapter：类型闭集 `sfx|ambience|ui`；BYO-key provider（有 key 走真调，无 key→**先贴凭证探针输出**再走 mock 兜底=确定性占位 wav+MOCK 标记，绝不静默顶替）。② 产物一律落待审区（**复用 M2.5 人审门** writePending/reviewPending·绝不直登 index），provenance 硬字段同 2D/3D（model/prompt/date/license 缺一拒登）。③ 定位：`SynthAudioPort`/SfxSpec 合成=数据仍是首选路（见 `docs/playbooks/audio.md`）；工坊采样线只补合成表达不了的（音乐床/环境底噪）——声音货架从现存 1 条起步。④ 测试：`scripts/ai-gen.test.mjs` 增音频四例（pending/approve/reject/provenance 缺字段拒）+ `scripts/art-review-smoke.py` 扩音频类型断言。⑤ 门禁全绿直推；完工标 ✅ 待 Lead 验收 + PA 会审登记契约。

### REQ-UI-emoji图渲 · 文本里的 emoji 自动渲成库里美术图（Twemoji·render-only） · [2026-07-16] · owner「emoji 直接用库里美术 emoji 替换·别逐个手转槽」→ PA 出映射底座 → **指派：PUI（UI 库渲染线域）** · status: **open（PA 底座 ✅ 已交·待 PUI 建渲染层）** · 优先级: P1（game-g 456 处 + 全线通用·省掉逐处 icon 槽手转） · 类型: 引擎 UI 库能力（render-only）
> **owner 意图**：UI 文本里大量用 emoji 当图标（game-g 光运行时 UI 就 456 处）；不必逐个手转 Image 槽——**我们有 4871 张 Twemoji 美术图**（共享货架 `assets/emoji/<码点>.png`·CC-BY·category:emoji），让渲染器**自动把文本里的 emoji 换成对应美术图**（像 Discord/Twitter twemoji-parse）一次覆盖全线 + 以后所有 emoji。
> **PA 已交付底座（`b34ba961` 之后·本单）**：`scripts/emoji-resolve.mjs`（+`.test.mjs` 4 测绿）——`resolveEmoji(char)` → `{cp, id, path, match:'exact'|'alias'|'none'}`，码点算法与 `import-emoji.mjs` 一致（严丝合缝库内文件名）；`exact`=库直中 `assets/emoji/<cp>.png`，`alias`=Unicode 符号就近替（`★→⭐`·`SYMBOL_ALIAS`·可逐个否决）。`coverage(game)` 出覆盖表。**game-g 实测 74 种/456 处=直中 68/415 + alias 6/41 + 无 0（100% 可映射）**；映射表 `docs/design/game-g/emoji-art-mapping.md`、emoji 清单 `docs/design/game-g/emoji-icon-inventory.md`。
> **PUI 施工 spec**：① 渲染层（`Text`/`Label`/`spans`/`Button.label` 等文本路）渲染时扫文本 emoji 码点 → 内联替换成 `<img src=已解析资产>`（1em·baseline·随字号）；非 emoji 照旧、缺省零回归。**复用现有「URL 按图渲」机制**（批32：`Button.icon`/`Tag.icon`/`Label.spans[].img`/`Card.media` 已支持已解析 URL 内联图渲·`icon-slots.test.ts`）——本单是把「手动填 URL 槽」升级成「文本 emoji 自动解析」。② 取图=调 PA `resolveEmoji`。③ **资产可达（PUI+PA 会审二选一）**：(a) 直引共享 served `/assets/emoji/<cp>.png`（简单·但破本地 hermetic）；(b) build 期按游戏扫用到的 emoji → 只 vendor 那批进本地（干净·PA 可给"游戏 emoji 清单→vendor 列表"）。**(b) 机制 PA 已建**：`scripts/emoji-vendor.mjs`（+`.test.mjs` 2 测·默认 dry-run·`--apply` 才写）——扫游戏 UI emoji→去重解析→copy 进 `public/games/<g>/art/emoji/<cp>.png` + 登记本地 index（id=`emoji/<cp>`·码点键·带 `vendoredFrom`）。**game-g dry-run=71 张唯一美术图待 vendor**；PUI 定 (b) 就 `--apply` 一下即可。倾向 (b)、可先 (a) 打通。④ **opt-out**：某处要保字形（代码块/刻意）给转义开关。⑤ 红线：render-only·不进 sim/hash·尺寸/对齐走令牌·不新增控件（是渲染器增强·catalog 描述回填一行）。⑥ 测试：含 emoji 文本→渲 img src=对应资产 + 非 emoji 零变 + alias 生效 + opt-out + `/check-ui` 过 + **game-i 展示台活范例一段**。完工标 ✅ 待 Lead 真浏览器验收 + PA 会审映射接线（`resolveEmoji` 用对）。
> **边界**：`src/ui/**` 渲染器 = PUI 独占（PA 不碰）；映射底座 `scripts/emoji-resolve.mjs` + `SYMBOL_ALIAS` + emoji 货架 = PA 维护（alias 调整/新符号 PA 会审）。**落地后 game-g 456 处 emoji 无需逐个转槽**——批32 的手动 icon-槽路只留给"非 emoji 的专属美术图标"。

### REQ-UI-锚定与绑定层 · UI 声明化二期（REQ-ARCH-ANCHOR 历史欠账收账） · [2026-07-04] · owner 亲派 → **指派：PUI（UI 基座 + 展示台程序员）** · status: **①锚定 ✅ PASS（PUI 2026-07-16·Lead 验收 CONCERNS→偏差B 文档诚实化已修·转 PASS 关账）；②绑定层 设计稿已交·待 Lead+PST 共审（PUI 2026-07-16·`docs/design/ui-binding-layer-2026-07-16.md`·过审才施工）** · 优先级: **P1（弱 LLM 产完整游戏的最大单一杠杆·底座终审 🔴#3）** · 类型: 引擎 UI 库能力（render-only）

> **✅ ①锚定完工回执（PUI·2026-07-16·请 Lead review·真浏览器 demo 已截图自证）**：
> - **闭集新件两枚**：`Float{anchorTo:{kind:'entity'/'node',id,at?,offset?},ttlTicks?}`（children 每帧钉目标 live rect·头顶名牌/血条/伤害数）+ `Connector{from,to:anchorRef,style:solid/dashed/arrow,tone令牌,label?}`（「谁打谁」连线）。进 `ComponentType` 闭集 + `catalog`(38 覆盖门) + 校验器同步。
> - **锚源两路**：`node`=同 mountUI 树 LayoutNode id（`host.querySelector('#id')`）；`entity`=渲染层给实体 DOM 盖统一锚标 `data-entity-anchor="<id>"`（**契约·渲染器出·非游戏自造 `u-<id>`**）。`at`=center/top/bottom/left/right + `offset`。
> - **定位机制**：`mountUI` 起 rAF 跟随循环（`ensureAnchorLoop`·mount + 每次 update 幂等启动·无锚定件自停省帧·teardown 取消）——每帧读目标 `getBoundingClientRect` 摆 Float(fixed·跟随滚动) / 连 Connector 两端；**目标消失/隐藏(rect 0)→自隐**（不悬空不报错）。**render-only·不进 sim/hash**·线色走令牌非裸 hex。
> - **消灭的病**：game-g `game-g.tsx:372/411-413/440` 手写 `getElementById('u-'+id)`+`getBoundingClientRect`+`createElement`（createElement×27 红旗大源）现有数据退路——战场替换由甲/程序B 随战斗 UI 批消费（不在本单强做）。
> - **测试与自证**：`anchor-float.test.ts`（5·渲染标记/箭头虚线/mountUI 挂载+teardown 不抛/校验器）+ `/check-ui` 过（ui-audit tabnew 0 阻断）+ **game-i「🆕 新控件/特性」`t-anchor` 段活范例**（战场三单位 + 名牌 Float + HP 条 Float + 攻击箭头 Connector + 关系虚线·swiftshader 截图已验各就位）。回填 `docs/playbooks/ui.md`「锚定层」行。tsc+vitest(2629)+build 三绿。
> - **②绑定层**：按 spec「设计稿先行·不许直接开写」——**未动**（需与 PST 共审绑定语法闭集设计稿·过 Lead 审才施工）。
>
> **⚖ Lead 对抗性验收（2026-07-16·Fable 亲验）：①判 CONCERNS——实现放行，entity 路两尾巴（B 修完本条 ① 转 PASS）。**
> - **独立复跑**（非采信自报·本容器 npm ci 全新装）：tsc ✅ · vitest 345 文件/2633 全过 ✅ · build ✅ · context-budget/docs-ref PASS。
> - **真浏览器行为探针**（swiftshader·hub→UI 控件→新控件 tab）：名牌 Float transform=(327,245) 恰=目标 rect(286,251,82×116) 顶中点+offset(−6) ✓；HP Float (327,379)=底中点+12 ✓；Connector line (368,309)→(408,309)=赵右缘→关左缘 ✓；−120 箭头/关系虚线目检 ✓。5 点名测试/catalog 38 门/校验器/ui.md 回填/②正确克制/rebase 保 REQ-ART-TGS 均核实 ✓。
> - **偏差A · OUT OF SCOPE（回改 spec §1·Lead 自领）**：「渲染层给实体 DOM 盖 `data-entity-anchor`」在现引擎不成立——2D play-field 是 canvas-renderer（无逐实体 DOM），3D 是 WebGL 同理；全库该属性**零生产者**（唯一消费点 `src/ui/components/server.ts:295`）。且现病灶不需要它：game-g 战场单位本身是 LayoutNode（`turn-battle-screen.ts:253`·id=`u-<id>`）→ node 路已对症。裁决：**entity 路降级为预留契约**（YAGNI·出现 canvas/WebGL 实体锚定的真消费者时再开引擎单——rect 注册表或 DOM 代理·Lead 域设计；CSS3D/Diegetic3D 面归 P3D）。spec §1 前半句作废，以本裁决为准。
> - **偏差B · ERROR（打回一行·指派 PUI·P2 小活）**：回执/手册把 entity 路写成已通路径——`docs/playbooks/ui.md` 锚定行「游戏战场用这个」+ `catalog.ts:147` describe + `gallery.ts:847` 注记会引弱 LLM 走死路（浮层永远自隐·零报错·正是手册铁律要防的坑）。修法：三处改注「**entity=预留·生产端未接·现一律用 node 路**」。
> - **✅ 偏差B 修复回执（PUI 2026-07-16·关 CONCERNS）**：Lead 点名三处 + 我自查出第 4 处（`types.ts` AnchorRef JSDoc 同样把 entity 写成已通）——**四处全改注**「entity=预留契约·生产端未接（2D canvas/3D WebGL 无逐实体 DOM·全库零生产者）·别用·现一律 node 路」：① `ui.md` 锚定行 ② `catalog.ts` Float.anchorTo describe ③ `gallery.ts` t-anchor-note ④ `types.ts` AnchorRef JSDoc。**代码零改**（entity 分支保留为预留契约·符合偏差A裁决·真消费者出现再开引擎单）。门禁全绿（tsc+vitest+build+docs-ref+budget）。**本条 ① 转 PASS 关账**；②绑定层照旧等设计稿共审。
> **owner 2026-07-04**：「UI 锚定点加绑定层，派给 UI 程序员做，我让 UI 程序员查。」出处：底座终审 `docs/design/base-capability-review-2026-07-03.md §二🔴#3 + §四.3`（锚定与绑定**分两步**·锚定先行）。
> **要消灭的病（现状证据）**：game-g 战场徽标/VS 连线/胜负挂牌全靠手写 `getElementById('u-'+id)` + `getBoundingClientRect` + `createElement`（`game-g.tsx:372/411-413/440`）——正是 audit 红旗 createElement×27 的一大来源；每个游戏都会再犯，因为**引擎没给「把浮层钉在活动目标上」的数据说法**。
>
> **① 锚定（立即施工·范围收窄）——spec（Lead 图纸）**：
> 1. **锚源契约**：渲染层给每个实体 DOM 节点盖统一锚标（如 `data-entity-anchor="<entityId>"`·引擎渲染器出，非游戏自造 `u-<id>`）；LayoutNode 控件沿用既有 `anchor` 键位（引导锚与浮层锚同一注册表，语义不混：引导=spotlight，浮层=定位基准）。
> 2. **浮层控件（闭集新成员）**：`Float{ anchorTo:{kind:'entity'|'node', id, at?:'center'|'top'|'bottom'|'left'|'right', offset?:{x,y}}, children, ttlTicks? }`——引擎渲染循环每帧读目标 live rect 定位（纯表现·不进 sim/hash）；目标消失→浮层随之隐藏（不悬空、不报错）。
> 3. **连线控件**：`Connector{ from:anchorRef, to:anchorRef, style:令牌闭集(实线/虚线/箭头), label? }`——「谁打谁」连线的数据说法。
> 4. **红线**：render-only（sim/Condition 绝不读浮层位置）；定位计算不进 lockstep hash；样式走令牌不收 raw hex；控件进 component 闭集 + catalog + 校验器同步。
> 5. **测试与消费自证**：控件级点名测试（锚定/偏移/目标消失回收）+ `/check-ui` 过 + **game-i 展示台加一个锚定 demo 页**（活范例铁律）；game-g 战场替换由甲/程序B 随战斗 UI 批消费（不在本单强做，但本单落地后其红旗 DOM 有了退路）。
>
> **② 绑定层（设计稿先行·不许直接开写）**：目标=LayoutNode 属性可声明绑定世界状态（如 `text:{bind:'resource:gold', format:'金 {v}'}`·闭集表达式：resource/flag/stringVariable+格式化，**不是**自由表达式语言），让弱 LLM 不写 TS builder 也能交付活 UI。**约束**：必须与创作台 UI 生成（PST）共审设计——绑定词汇会直接进生成 prompt 词汇表；先交 ≤2 页设计稿（绑定语法闭集+更新时机+与现有 visibleWhen/tween 的关系）给 Lead 审，过审才施工。
> **✅ ②设计稿已交（PUI 2026-07-16·待 Lead + PST 共审·未写一行代码）**：`docs/design/ui-binding-layer-2026-07-16.md`（≤2 页）。要点：**绑定层已有一半**（`resolveBindings` + `bind` 字段 + `visibleWhen`）——本设计在其上①源前缀闭集 `resource:/flag:/string:`（裸 id 向后兼容按 resource）②**可绑属性白名单**（每控件哪些 prop 可绑配哪种源·生成器只能对表内组合填 bind·校验器挡表外）③格式化=复用 `Label.format` + 模板占位闭集 `{cur}{max}{v}`（非自由插值）。**三处待 Lead 裁**：(a) 统一 `bind` 字段 vs spec 的 `text:{bind,format}` 对象形态（PUI 倾向前者·与既有一致）(b) 模板占位范围 (c) `enabledWhen` 本单纳入还是 P2。**PST 共审点**：可绑白名单表直接进生成 prompt·源 id 词表 = 游戏 capability-plan 资源/旗标清单。过审后按设计稿 §7 P1 施工。
> 门禁全绿直推；①②各自独立提交；完工标 ✅ 待 Lead 对抗性验收（真浏览器 demo 必查）。

### REQ-STYLESET-风格库 apollo-toon · 迪士尼×Supercell×中国水墨混风·全类型 house style · [2026-07-16] · owner 拍板（全形态换装非调色·先现装可视版·其他风格收敛）→ **指派：PA（M0 台账底座）+ PUI（M0.5 现装可视版·先行）** · status: open（双线已派工 2026-07-16） · 优先级: P1 · 类型: 引擎级风格资产库 + UI 基座消费
> 图纸唯一真相=`docs/design/styleset-artlib-plan-2026-07-16.md`（§二 三增量·§六 首批清单 spec + M0/M0.5 交付边界·风格锚 v2 单一真相在风格包·**IP 红线：锚用描述词不写厂牌词**）。M1 试产/M2 建库等真 key（连 REQ-AIGEN 卡口）；M3 对齐（examples 进 game-i）；M4 D/G 出口游戏换装。完工各标 ✅ 待 Lead 对抗性验收（真浏览器截图必查）。

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
