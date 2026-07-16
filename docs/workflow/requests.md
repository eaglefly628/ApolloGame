# 引擎需求池 · Requests

> **10 硬槽铁律（owner 2026-07-15 拍板）**：本池只放 **owner 级需求·最多 10 条**——**10 条做不完不许加新的，必须清掉（做完归档/降级）才能加**（机器守卫 `context-budget-guard` 卡条数+字符数·超=红灯拦推送）。
> 各角色（按 `docs/roles/index.md` 名录）提需求前先看槽位；游戏级工作票（G/D/Q/I 的 bug/战斗/演出/平衡单）**不占槽**——写**该游戏自己的需求单** `docs/design/<game>/requests.md`（工单随游戏走·游戏可暂停）；3D 线写 `requests-3d.md`；已完结全文在 `requests-archive.md`。
> 状态：`open` / `in-progress` / `done`（附 commit·**标 done 同提交迁归档腾槽**）/ `wontfix`（附理由）。差需求（"不行"）会被打回。
>
> **（2026-06-15 清理：本池仅保留 Game E/F/G 需求；非 F/G 条目已移除，见 git `41ace96`。）**
> **（2026-06-26 Token 清理：已结案条目（done/wontfix）正文压成一行摘要，完整论证/接线契约见各 commit。open/进行中条目保留全文。）**

---

## 待处理 / 进行中

### REQ-QC-UI-工坊生产板显示「复查门」+ 评分卡摘要 · [2026-07-15] · Lead（REQ-QC-三门接续·全文回执在 archive）→ **指派：PST** · status: open · 优先级: P1 · 类型: 工坊 UI（数据已通·只差显示）
> 三门制已上线（`game-pipeline.mjs`·板 JSON 已带 `review` 字段+scorecard·端点自动透传），工坊生产板 UI 现只画机器门/人门两行——请 PST 在 GamePipelinePanel 补第三行「复查门」+ S7 评分卡判词（`VISUAL: n/24 · PREMIUM`）显示，照 CLI 版式（`board <slug>` 输出）。参考手册 `docs/playbooks/review-gates.md`。

### REQ-DEMO-T3-批量吞吐冒烟 · 周产 30 款的机器证据 · [2026-07-07] · Lead 图纸 → **指派：Opus 档 session/子代理** · status: open（T1 完工后接） · 优先级: P1 · 期限: 7/20 · 类型: 冲刺 QA
> **spec**：① 新建批量冒烟脚本（scripts 下·batch-gen-smoke）：mock LLM+mock 美术连出 N=10 款 e2e——生成→美术编排→parseManifest 零 error→audit 无新红旗；判词 token `BATCH: PASS|FAIL`+退出码；fail-fast（哪款第几步死点名）。② 真 key 抽 3 款全真跑通，记录单款耗时/成本/token 写进回执（demo 出示件·折算周产能）。③ 照 `docs/playbooks/testing.md` 三禁（mock 路径零外部 IO·种子固定）。完工标 ✅ 待 Lead 验收。

### REQ-AIGEN-软件内文本生成资产 · Tripo(3D)+千问(2D) 接入创作台 · [2026-07-04] · owner 拍板 → **PA 已建生成框架(资产侧)· 待主程/PE 做运行时+设置UI** · status: **框架 ✅ done(PA·mock 全绿)；运行时/设置UI 待主程裁域派工** · 类型: 新能力(外部 AI 服务·表现层旁路)
> **owner 愿景**：软件内用自然语言描述 → 生成资产（3D 用 **Tripo**·2D 用 **千问/DashScope 万相**），落进资产库。先 mock 打通全框架。
> **PA 已交付（资产侧·`scripts/ai-gen.mjs` + `ai-gen.test.mjs`·mock 全绿）**：厂商无关生成框架 = 适配器注册表（`tripo` 文本→glb·`qwen` 文本→png）+ mock 产合法资产（glb/png·prompt 播种）+ **连库**（落 `assets/index.json` 或游戏本地 `art/index.json`·带 provenance 厂商/prompt/模型/mock/日期）+ 真调门控（fetch Tripo v2 openapi / DashScope 万相·密钥走 env `TRIPO_API_KEY`/`DASHSCOPE_API_KEY`·**绝不入库**·本环境 GitHub-only 真调被挡→`--mock`）+ 设置视图 `providerSettings()`（envKey/是否已配/打码·可被 server/UI 复用）。哲学同 `src/services/aigp`（非确定性旁路·不碰 sim/hash）。
> **待主程/PE（跨域·非 PA）**：① **设置 UI + server**——把 Tripo/DashScope key 接进 `apollo.py` 设置系统（现 `LLM_PROVIDERS` 是 chat 域·生成域另起一套或并入）+ 创作台设置屏（LayoutNode·UI铁律·复用 `providerSettings()` 形状与 `apiKeyMasked` 打码）。② **运行时生成 UI**——创作台输入 prompt→调生成→资产入本地库→即时可用（异步任务·pending/进度·参照 aigp 视频端口 handle 模式）。③ 浏览器侧直调需把生成逻辑做成 `src/services/ai-gen/` 端口（node 侧 `ai-gen.mjs` 是 authoring-time 参照）。
> **真调前置**：放宽网络的环境/session（Tripo/DashScope 域名本环境 403）+ 用户付费 key（owner 已购）。许可按各家订阅商用条款（provenance 已记）。
> **+ meshy 适配器接入（PST 2026-07-07·owner 直接要「接入 meshy 顺便接菜单」）**：`ai-gen.mjs` ADAPTERS 加第三家 `meshy`（文本→3D glb·kind:mesh·envKey `MESHY_API_KEY`·mock→cube.glb 占位·真调走 Meshy v2 openapi `POST /openapi/v2/text-to-3d` mode:preview → 轮询 `model_urls.glb`·门控同 tripo）；apollo.py 白名单 `GEN_ADAPTERS=('tripo','meshy','qwen')`（新增 provider 两处同改=脚本注册+此白名单）；创作台 `AssetGenPanel` 适配器菜单加 🗿 Meshy(3D) 一档 + provider key 状态自动列出。测试：`ai-gen.test` 注册表 + meshy mock glb·render 测断言菜单含 Meshy。门禁 tsc0/vitest2318/build0。**ai-gen.mjs=PA 框架·此 provider 扩展请 PA 会审**（真调端点/字段是否随 Meshy-6 漂移）。

### REQ-PUBLISH-创作台一键发布 · player 模式内「打包→上传 Steam」一键流水线 · [2026-07-04] · owner 口头指派 → PS 转呈（跨 PS↔PST 域） · status: **裁决完毕（Lead 2026-07-04·见文末）·PS 先行硬化契约·PST 排队接 UI** · 优先级: P2（产品体验·非阻塞） · 类型: 产品化·发行管线接入创作台（后端多已存在·主要是接线）
> **源起**：owner 2026-07-04：创作台 **player 模式**下把发布按钮/路口接好——一键打包、填自己的 Steam ID/AppID，让用户「一条流水线产出游戏」。**范围裁决（owner 当面答 PS 二选）**：① 承载面 = **创作台 player 模式（网页）**；② 深度 = **尽量一路到 Steam 上传**（能自动的自动到 steamcmd upload 为止）。
>
> **后端多已存在（接线，非造轮子）**：`steam-publisher/serve.py`（HTTP API：配置→build 裸目录→生成 VDF→steamcmd 上传·含实时日志轮询）、`scripts/dist.py`（打包菜单）、`electron-builder.yml`、平台接线（成就/云/富状态）均就绪。缺的是①把它接进 studio player 模式 UI ②一条 studio 能稳定调的发布 API。
>
> **PS 提议域切分（请 Lead 裁）**：
> - **PST 域（UI）**：player 模式内「发布」区——选游戏/平台、填 AppID/DepotID/builder 账号（=用户 Steam ID）、进度与日志展示。走 studio 现有 React 产品面（非游戏 UI 铁律范畴）。
> - **PS 域（管线契约）**：提供 studio 可调的稳定发布 API/CLI：`package(game,platforms)`→`genVDF(appId,depots)`→`upload(builder)`，带进度/日志流。由现有 `steam-publisher/serve.py` 端点收敛/硬化而来（apollo.py 转发 或 studio 直连本地端口）。= PS 施工物。
>
> **必须显式标给用户的「不能自动」三步（architect 诚实·Valve 无 API）**：① 用户自己的 $100 合作伙伴账号 + 真 AppID/DepotID；② 本机装 steamcmd + 首次缓存登录（Steam Guard 令牌需终端手输一次）；③ 上传后后台 **Set Live**（防误推线上·故意手动）。故「一路到 Steam」= 自动到 upload 为止 + 向导显式引导这三步，非黑箱全自动（细节 `steam-publisher/RELEASE-PROCESS.md`）。
>
> **请 Lead 裁**：a) 域切分是否如上（PST 接 UI / PS 供管线 API）；b) 接入形态——studio 直连 steam-publisher 本地端口 vs 经 apollo.py 转发 vs 内嵌重写；c) 派工。
>
> **Lead 裁决（2026-07-04）**：
> a) **域切分照准**——与角色卡边界严丝合缝（PST=studio 前端+apollo.py 服务面；PS=steam-publisher 管线），无需调整。
> b) **接入形态=经 apollo.py 转发**（薄代理 `/api/publish/*` → steam-publisher serve.py）。理由：①studio 前端现在只认一个后端缝（`/api/*` 相对路径），M5 Electron 打包正靠这条缝换传输层——直连第二个本地端口会破缝+引 CORS+双服务生命周期；②发布是危险面操作，收进 apollo.py 统一走已有的路径防护/审计口；③内嵌重写=造第二套管线，回驳。转发层**只透传不塞逻辑**（进度/日志流原样代理）。
> c) **派工**：PS 先行（自请照准）——serve.py 编排 API 硬化成稳定契约（`package→genVDF→upload` 三段 + 进度/日志 + 判词 token 收口）+ mock/480 冒烟；PST 随后接 player 模式发布区 UI（**「三步不能自动」必须做成显式向导页**，不许藏在文档里）；两段各自门禁绿，联调验收=Lead。P2 维持（各自接在当前核心工作之后）。status 更新 → **裁决完毕·PS 可先行**。
>
> **PS 契约硬化完成（2026-07-04·owner「可以先做」+ Lead 裁准 PS 先行）**：`serve.py` 按 Lead c) 硬化成稳定契约——**三段命名** `stage_package/stage_genvdf/stage_upload` + `plan_pipeline` 组合 + additive `POST /api/plan`；**判词 token 收口**（段判词 `ST_OK/ST_BLOCKED`、任务判词 `JOB_IDLE/RUNNING/DONE/ERROR`·`job_status()`，接进 `/api/state`+`/api/log`，消费端不 scrape 日志）；无真账号冒烟 `scripts/steam-publish-smoke.py`（480·**24 断言**·退出码门禁·自证可红·登记 testing 手册）。apollo.py 薄代理 `/api/publish/*` 透传即用。**余：apollo.py 代理（服务面域）+ PST 接向导页 UI**。详见 `finish/PS-steam-finish-list.md`。


### REQ-PA-工坊工位四件 · PA 已做批对齐认定 + 后续任务（owner「直接给他分派」）· [2026-07-04] · Lead 裁决派单 → **指派：PA** · status: open · 优先级: P1 · 类型: 资产治理与数据面（工坊分工=主责 PST·副责 PA）
> **对齐认定（Lead 2026-07-04）**：PA 近批（`d4a38341`→`b34ba961`：mesh/材质货架·程序化贴图+天空盒·9 品类 PBR 材质库·vendor 数据型扩展·右键 copy 入口）**全部落在愿景 M0 + M2 接线器切片上，方向零偏差**。边界更新：owner 已开 PST 角色——**工坊 UI/apollo.py 端点自此归 PST**（`b34ba961` 的右键入口移交 PST 维护）；PA 专注资产逻辑/CLI/契约（`assets/**`·`scripts/` 资产线·index 规范）。
> **① REQ-PA-3D 收尾**：③ 本地目录标准 `public/games/<game>/art/{textures,models,materials,env}/` 回填 `docs/playbooks/assets.md` 一节；①②④a 完成态在原单回标（④b P3D 切换催 P3D）。
> **② M2.5 登记契约（PST 的图纸补件·先行）**：出 ≤1 页「pending 清单 + provenance/license 硬字段」契约（字段名/必填/校验规则/示例条目），供 PST 照抄实现；M2.5 完工时 PA 会审登记面 diff。
> **③ 三方对账 CLI（M1 数据面前置）**：`scripts/asset-reconcile.mjs`——引用（各游戏 manifest/代码里的资产 key）↔ 登记（index）↔ 磁盘 三方对账；孤儿登记/悬空引用各成一类 finding（行 schema：位置|期望|实际）；判词 token `RECONCILE: PASS|WARNINGS|FAIL`+退出码（照 docs-ref-guard 模式）；M1 报表直接吃它的 `--json` 输出。
> **④ 配方格式草案（M2/M3 前置）**：把 gen-textures/pack-atlas 收编为「recipe 纯数据」的格式草案 ≤2 页（op 闭集/参数 schema/可重跑语义）交 Lead 审——过审前不动现有 CLI。

### REQ-UI-锚定与绑定层 · UI 声明化二期（REQ-ARCH-ANCHOR 历史欠账收账） · [2026-07-04] · owner 亲派 → **指派：UI 程序员（owner 直辖·UI 库域授权施工·Lead 图纸+验收）** · status: **open（①锚定立即施工·②绑定设计稿先行）** · 优先级: **P1（弱 LLM 产完整游戏的最大单一杠杆·底座终审 🔴#3）** · 类型: 引擎 UI 库能力（render-only）
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
> 门禁全绿直推；①②各自独立提交；完工标 ✅ 待 Lead 对抗性验收（真浏览器 demo 必查）。

### 📦 3D 渲染线需求 → 已移至 `docs/workflow/requests-3d.md`（owner 2026-06-28 立独立池）

> Mesh3D/Transform3D/Camera3D/Sky3D/Model3D/Light3D/Post3D 等 **3D 盒庭渲染线 + Game Z** 的需求 / 工单（含 `REQ-3D-W1高效引擎`·实例化绘制、`REQ-3D-Model导入`·glTF）**全部移至 [`requests-3d.md`](./requests-3d.md)**。新 3D 需求进那里、不进本文件；本文件留通用 UI 库 / 其它游戏需求。

## 已结案条目 → 全文见 `requests-archive.md`

> 所有 done/wontfix/作废 条目（含裁决理由与完工摘要）已归档到 `requests-archive.md`；查旧单先 grep 它。本池只留活跃 open/in-progress/排队 条目（防每读付历史 token·owner 2026-07-04 token 底盘优化）。

## 需求模板（复制这段填写）

```
### [YYYY-MM-DD] · [提出人 PA/PB] · [游戏名] · status: open
- 想实现的游戏行为：
- 已经试了什么（哪些原子 / 怎么拼）：
- 卡在哪 / 缺什么（引擎做不到的点）：
- 建议方案 / 伪代码 / 补丁（可选）：
- 最小复现（若是 bug）：
```

---
