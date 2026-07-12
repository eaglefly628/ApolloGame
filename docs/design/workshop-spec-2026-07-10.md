# Workshop 统一工作台 + 整链打通 · 规范（**已定稿 2026-07-10·owner 三问已拍板** → PST 施工）

> owner 2026-07-10 三条口径：①把整套东西打通（创作台→卡带库→八阶段生产板→美术平台→换皮量产，评委路径单人单屏全 UI 无 CLI）；②把创作台收进 Workshop 做成**完整编辑器**（状态机：未创建=对话生成模式·已创建=对白编辑模式·内嵌美术台等·延续 SHELL 风格）；③编辑对话「跟平常对话框一致·接 Claude Message」，且 **Claude 通道=订阅 + setup-token + Agent SDK 原封不动——不买 API、不花新钱**（owner 07-10 追加拍板）。
> 流程：Lead 出本规范 → owner 讨论定稿 → PST 施工（REQ-WORKSHOP）→ Lead 对抗性验收。
> 已拍板：生产板全模式可见；退役旧 GameCreator。

## 〇、打通的断点清单（三路探索核实·本规范的靶子）

| # | 断点 | 位置 |
|---|---|---|
| 1 | generate 纯函数不落盘；「一句话玩法」无持久位 | apollo.py:999,611；_write_meta:2277 无 description |
| 2 | S1 立项卡只能 CLI 填（无端点无 UI） | game-pipeline.mjs concept 段；GamePipelinePanel 无表单 |
| 3 | manifest 落盘后台账不自动重 derive（靠美术面板打开兜底） | library_put_manifest:2441；ArtLedgerPanel.tsx:113 |
| 4 | 保存成功后无「下一步」引导；卡带操作条无 🏭 | onWizardSaved launcher:922；LibActionBar |
| 5 | 生产板→美术平台单向（回不来） | launcher:991 |
| 6 | cart 的 S8 终检=全仓 tsc+vitest+build 过重·证据绑 git HEAD 易过期 | game-pipeline.mjs gateRun S8 |
| 7 | dev 旧 GameCreator 生成不入库=迷途点 | launcher:1284 起 |
| 8 | llm-onboarding 五步与八阶段流程板互不引用 | llm-onboarding §2 |
| 9 | anthropic 供应商配的 `claude-sonnet-4-20250514` 已弃用（2026-06-15 退役） | apollo.py:235 |

## 〇.五、与既有 Workshop 壳的对齐（2026-07-11 rebase 增补·载体修正）

另一施工 session 已落 Workshop 地基（`c3dd4743`/`69e2f849`/`66744bea`）：**Workshop=`workshop/index.dc.html`+`support.js` 原版设计壳**（Claude Design 产出·apollo.py `/workshop` 静态伺服·同源免跨域·`python apollo.py workshop` 一键启动），owner 已拍板**豁免 LayoutNode 铁律**（开发工具/展示台非游戏 UI）。游戏库屏已接真 `/api/games`。据此修正本规范：

- **§一 的载体改为 workshop/ 壳**：A 批=在壳上接线，**不新建 src/studio/Workshop.tsx**；「ChatPane 从 DesignStudio 抽取」作废——对话 UI 用壳的原版对话屏（「跟平常对话框一致」即指它），共享的是 §二服务端协议。
- **端点命名对齐**：壳侧待接线清单叫 `/api/agent/chat`——即本规范 §2.3 的 revise-chat 编排层，**统一用 `/api/agent/chat`**（携带 mode/role/messages 字段语义照 §2.3）。
- **切换按钮的实现形态**：旧 launcher 货架照旧可起（完整 launcher）；workshop 壳内放「⇄ 旧工作台」链接、launcher 放「⇄ Workshop」——两入口并存即 owner 要的过渡对比。
- **素材库屏**（owner 07-10 点名）：壳的素材库屏接 `/api/art/ledger`+共享货架端点（壳侧清单已列）。
- **测试口径修正**：壳是独立 HTML/JS（不进 vitest jsdom）——A 批验收改为**端点级测试 + curl 自证**（照 `c3dd4743` 门禁先例）+ 真浏览器走查；§五的 render 测试项仅保留 launcher/studio 侧改动部分。
- launcher 侧原 A 批项（LibActionBar 加 🏭、保存态导流、生产板↔美术平台返回栈）**不变**——旧视图过渡期仍在用，两边都要通。

## 一、Workshop 统一工作台（A 段·载体=workshop/ 壳，见 §〇.五）

**状态机（每游戏推导·不另存真相·判据=`library/<slug>/manifest.json` 是否存在，复用 detectForm 口径）**：

```
[未创建] --对话生成（design-chat 讨论流 / 快速向导流·二选一收编现有回路）--> [已创建·placeholder 可玩]
[已创建] --对白编辑（revise-chat 多轮·§二）--> 迭代循环
              每次「应用改动」= PUT manifest（parseManifest 零 error 门 + git 版本化）
        └-- 旁路入口（顶部工具条）：🎨 美术台账 · 🗃 素材库(共享货架 AssetLibrary·owner 07-10 点名接上) · 🏭 生产板 · 🩺 体检 · ⟲ 历史 · ▶ 试玩 · ⤓ 导出(禁用占位)
```

- **布局**（全屏编辑器·SHELL 主题延续，禁自造色/字）：左=游戏上下文栏（卡带名/立项卡/八阶段状态灯摘要——GET /api/pipeline 推导，只读摘要，详情跳生产板）；中=预览区（DataCartridgeRunner 嵌入试玩 / ManifestPreview）；右=对话栏（ChatPane·双角色）。
- **入口形态（owner 已拍板）**：**主进入接口直接走 Workshop**（Workshop=未来主界面）；旧卡带货架视图**保留**，顶部一颗「⇄ 切回货架视图」切换按钮供过渡期对比（美术库等链路跑顺前不删旧视图）；旧视图里对应加「⇄ 进 Workshop」。
- **双角色对话（owner 已拍板·对应现有 GD/PE 分工搬进产品）**：ChatPane 顶部两个入口 tab——**「🎨 策划」**与**「🔧 程序」**，各自独立消息流（两份 transcript）、共享同一工件真相（同一 manifest/台账）。
  - 策划：玩法/数值/内容/关卡口径，**兼管美术更换**——系统提示词含美术台账上下文（编号/状态/风格锚），v1 可发起「跳美术平台并带定位」（点名 art-NN/风格锚建议），对话直接驱动美术端点记 v2；**素材库接通（owner 07-10 点名）**：工具条 🗃 直开共享货架 AssetLibrary；策划对话的「库选换」建议引导到美术平台既有 swap 三式（不另造第二条换图通道）；
  - 程序：manifest 结构/组件接线/能力使用（catalog 注入为主）；
  - **不多开**：同一时刻仅一个对话请求在飞、仅一条「应用改动」通道（两 tab 共用同一 PUT 门串行化）——防并发改稿互踩。
- **ChatPane 共用组件**：从 DesignStudio 聊天 UI（ChatMsg[]·DesignStudio.tsx:36,201-269）提炼 `src/studio/ChatPane.tsx`——消息列表+输入框+busy 态+滚动锚。创建模式与两个编辑角色共用（「跟平常对话框一致」的机械保证）。
- **收编与退役**：CreationWizard/DesignStudio 的生成与保存回路**复用不重写**（save 流 CreationWizard.tsx:160-188 原样迁移）；旧 GameCreator 删除，dev 模式接「＋新建游戏」同一入口；dev 的 continueCreate 旧 seed 分支（launcher:913-920）改走统一路径。
- 「应用改动」（owner 已拍板·与现流程一致）：**显式按钮确认**后落盘，不随对话每轮自动直写——对话是入口，工件是唯一真相（§四红线）。

## 二、对话协议（B 段·接 Claude Message·apollo.py）

### 2.1 Claude 通道 = 订阅 + setup-token + Agent SDK（主通道·owner 拍板「不买 API·不花新钱」）

- **机制原封不动**：owner 机器上 `claude setup-token` 产出长期 OAuth token（`sk-ant-oat01-…`）→ 存 `.apollo-config.json`（gitignored）新字段或 env `CLAUDE_CODE_OAUTH_TOKEN`；apollo.py 新增 provider **`claude-code`**：`_llm_call` 分支 spawn 子进程调 Claude Agent SDK / Claude Code CLI headless（`claude -p --output-format json --model <档位>`），token 经环境注入——**走订阅额度，零 API 计费**。
- **安全铁律（必须写死）**：该子进程只当**纯文本生成器**用——**工具面全禁**（`--tools ""`/`--disallowedTools` 全量禁用，工作目录指向空目录）；绝不许它读写仓库文件。token 同 key 纪律：打码回显、不落日志、不入库。
- **多轮**：v1 把 messages 数组转写为 transcript 文本拼进 prompt（确定性·好测）；SDK session/resume 机制记 v2。
- **档位（owner 已拍板）**：默认 **Opus 4.8**（订阅版主力档）；菜单可切 **Fable 5**（展示档·现场 demo 更强）与 **Sonnet**（量产批量档）——档位名走 Claude Code 的模型别名（opus/fable/sonnet），不硬编日期型号；订阅套餐没有该档时网关明报错回落默认档（不静默降级不提示）。
- **限流语义**：订阅额度窗（5h 窗）用尽→网关明报错透传 UI（「订阅额度暂满·N 分钟后重试」），绝不静默兜底。
- **超时**：该通道 300s（opus+大 manifest）。
- **采购清单联动**：demo-sprint §六 的 `ANTHROPIC_API_KEY` P0 条目改为「**不采购**——LLM 出 manifest 走订阅通道（setup-token）」；美术 API（DASHSCOPE P0 / TRIPO P1 / MESHY P2）**照旧采购**（那些不是 Claude）。

### 2.2 BYO-key 备用通道（raw API·存量 bug 修复，不新增面）

- anthropic raw-API 供应商保留给 BYO key 用户；**修存量弃用型号**：models 列表 `claude-sonnet-4-20250514` → `claude-opus-4-8`（默认）/`claude-sonnet-5`/`claude-haiku-4-5`。
- **当前代次合规（4.7+ 硬约束·发错即 400）**：不发 temperature/top_p/top_k（网关按 provider 剥离）；加 `thinking:{"type":"adaptive"}`；响应**遍历 content blocks 取 type=="text"**（不再假设 content[0]）；`stop_reason=="refusal"` 明报错；system catalog 尾块打 `cache_control:{type:"ephemeral"}`（多轮编辑省输入费）；max_tokens 16000 起步、超时 300s；流式 SSE=v2。

### 2.3 revise-chat 模式（两通道共用的编排层·双角色）

- 新 mode `revise-chat`：请求 `{mode, slug, role: 'gd'|'pe', messages:[{role,content}…], provider, catalog}`；服务端按 `role` 拼系统提示词（`pe`=catalog 注入为主·manifest 结构域；`gd`=玩法/数值/内容+美术台账上下文注入——读该游戏 art-ledger 的编号/状态/风格锚拼进 system）+ 全量 messages 调网关；响应 `{reply, manifest?, artHints?}`——manifest 仅在过 `_run_manifest_check` 自动修正环后返回；`artHints`（gd 角色可选）=结构化美术建议（点名 art-NN/风格锚文案），前端渲染为「跳美术平台」引导。前端「应用改动」→ PUT manifest。
- 地基已在：网关已消化 anthropic messages 形态（apollo.py:438-460）；design-chat 已传多轮（DesignStudio.tsx:257）。**这是扩展不是新建。**

## 三、数据桥与语义修正（C 段·apollo.py + scripts/game-pipeline.mjs）

1. **meta.description**：`_write_meta`（apollo.py:2277）加默认字段；前端 library-model.ts:54 已备好消费，零改。
2. **建库自动写立项卡**：`library_create` 收 `description`（≤300）→ 写 meta + 传 `_scaffold(pitch=…)` → `_pipeline_cli(['concept', slug, '--name', …, '--pitch', …])` best-effort（照 :2318-2321 derive 先例）；`library_install_sample` 传 `preset.description`。**不走 PUT 捎带**（revise 不该反复动立项卡）。
3. **`POST /api/pipeline/concept`**：字段 name/pitch/refs/style/planWaiver（≥1 个·name≤80 其余≤300·slug/长度守门照 signoff 先例）；`boardFor` 返回体加 `concept`；生产板 S1 侧栏加 name/pitch 编辑（签核表单保留——机器绿≠人门绿）。
4. **manifest 落盘自动重 derive 台账**：`library_put_manifest` 与 `_put_manifest_anywhere` builtin 分支各加 best-effort `_art_replace_cli(['derive', slug])`。安全前提=mergeLedger append-only（编号保号/replaced 不墓碑/artStyle 保留）已有测试钉死；**回归硬门=art-replace-smoke 45 断言整跑**（防美术写回链二次 derive 互踩）。
5. **换皮谱系立项卡**：`handle_art_reskin` 成功后对新 slug 写 concept（pitch=`源pitch（换皮·<pack>·源 <slug>）`；源无 concept 则 `换皮自 <slug>（<pack>）`）。
6. **cart-S8 轻量终检**：cart 形态门=manifest-check 零 error ∧ bench 五轴 pass ∧ **mock 债=0**（新导出纯函数 `mockDebt(root,slug)`=live 行 gen.mock 计数·口径同 artSubState）；证据绑 gameHash 非 git HEAD（evalEvidence 双轨已自适应）；**不含「全行 approved」**——逐行复核是 S6 人门职责，机器门不越权；builtin/compiled 保持全仓三绿。
7. **导流补线**：保存成功态双按钮（「下一步→🏭 生产板」/「回卡带架」）；LibActionBar 加 🏭（**全模式**·owner 拍板）；生产板↔美术平台返回栈（launcher:991 的 onOpenArt 去掉 `setPipeGame(null)`——渲染优先级 artLedger>pipeGame 天然成栈；ArtLedgerPanel 加 `backLabel` prop 显「← 生产板」）。

## 四、防漂移红线（D 段）

- **不做一键全自动跑八关**——板是编排器，人门必须真人签（不许代签红线见 game-production.md）。
- Workshop 对白编辑每次落盘必过 parseManifest 零 error 门 + git 版本化——**对话是入口，工件是唯一真相**。
- mock 永不上画面（三道闸+gen/mock 命名空间沟）不因 Workshop 改变。
- claude-code 子进程工具面全禁（§2.1）——LLM 通道绝不获得本地文件读写。
- 引擎目录（src/{engine,skills,assembly,renderer,services,net}）零触碰；全部改动限 studio/launcher/apollo/scripts/docs。

## 五、测试与验收（E 段·PST 交付门）

- **`scripts/pipeline-smoke.py`** 新冒烟（照 art-replace-smoke 进程内起服模式·finally 清理零污染）：①create 带 description→meta+concept 落盘+board S1 机器绿；②PUT manifest→免手动 derive 台账即在·再 PUT 编号不漂移；③concept 端点合法改写/非法拒（坏 slug/超长/零字段）；④reskin mock→新卡带 concept 带谱系；⑤install-sample 幂等带 concept；⑥cart-S8：带 mock 台账 gate→fail 且 summary 点名 MOCK·清债→pass 且证据带 gameHash。
- **`game-pipeline.test.mjs` 扩**：mockDebt 三例（无台账/有 mock/retired 不计）·writeConcept 字段合并·cart-S8 证据 gameHash 过期与 builtin head 双轨回归。
- **revise-chat/claude-code 通道**：网关分支单测（claude-code spawn 参数含工具全禁·anthropic raw 分支请求体无采样参数·content blocks 遍历·refusal 分支）；smoke 一腿用 local/mock provider 走 revise-chat 全链（不依赖真订阅）。
- **render 测试**：Workshop 两态渲染、策划/程序双 tab 切换（transcript 隔离·busy 单飞）、货架⇄Workshop 切换按钮、ChatPane 共用、保存成功态双按钮（creation-wizard/design-studio 各一条）。
- **全门禁**：tsc/vitest/build/art-replace-smoke/art-review-smoke/pipeline-smoke/docs-ref-guard 全绿；真浏览器评委路径走查：一句话→可玩→板 S1 绿→S6 进美术→返回板→换皮→新卡 S1 绿。
- **文档回填**：playbooks/game-production.md（S8 cart 口径+立项卡自动化+Workshop 入口行）；llm-onboarding §2 加八阶段回指（禁单会话跑完五步）；SESSION-HANDOFF 刷新冲刺指针。

## 六、分工与批次（F 段）

| 批 | 内容 | 依赖 |
|---|---|---|
| C1 | 数据桥（§三 1-5,7）+ pipeline-smoke 骨架 | 无 |
| C2 | cart-S8 语义（§三 6）+ 单测 + smoke S8 腿 | 无（与 C1 并行） |
| B | claude-code 订阅通道 + raw 通道合规修 + revise-chat | 无（与 C 并行） |
| A | Workshop UI（状态机/ChatPane/收编/退役旧面板/导流） | B、C1 |
| E | 测试补全 + 文档回填 + 评委路径走查 | 全部 |

- **PST 施工**（本规范即 spec）；**Lead**：cart-S8 语义裁决（已下）、对抗性验收 diff、订阅通道首跑护航。
- **不并入本单**：批处理进度灯（PST 既有心跳队列单）、T3 吞吐（Opus 单）、美术真 key/refImage（owner 采购）、电子导出（原 M5 后置）。

## 七、定稿记录（owner 2026-07-10 三问拍板）

1. **入口形态**：主进入接口直接走 Workshop（未来主界面）；旧货架视图保留，顶部「⇄」切换按钮过渡期对比，链路跑顺后再议退役。
2. **应用改动**：显式按钮确认落盘（与现流程一致）；**不多开**——同一时刻单对话请求、单落盘通道；对话编辑分**策划/程序两个入口**（策划兼美术更换）。
3. **档位策略**：默认 Opus 4.8（订阅版）；Fable 5 作展示档可选；Sonnet 作量产档可选。
4. **Claude 通道**：订阅 + setup-token + Agent SDK 原封不动——不买 API、不花新钱（§2.1）。

## 八、验证记录（Lead 亲手施工·2026-07-11 完工）

- **owner 07-11 改派+追加**：授权 Lead 亲手施工（「有足够 token…不要留下 bug」），完工移交 PST 维护；追加三条已并入——
  ①发布=**下载包**（非 iOS/Web 上架）→ `GET /api/library/<slug>/export`；②设置收编**文生图 API**（千问万相/Tripo/Meshy 三把 genKeys）；
  ③壳内新 UI **风格保持与壳一致**（延续原版设计语言·非 SHELL 主题）。
- **落地与 spec 的偏差（三处·均有由）**：A 批载体=壳 `workshop/index.dc.html` 上接线（§〇.五载体对齐·非新建 React Workshop.tsx 一族）；
  对话端点=`/api/agent/chat`（双角色 gd/pe·统一取代 revise-chat mode 命名·语义同 §2.3）；ChatPane 抽件不再需要（壳自带对话 UI）。
- **门禁实数**：tsc 0 err；vitest 318 文件/2398 测试；build 绿；pipeline-smoke **44 断言**（⑧=壳伺服面：/workshop/ 端出壳·/games/* 静态
  200/403/404·export zip 头+排除 mock/.git/snapshots·/api/catalog 形状）；art-replace-smoke 45 断言；壳 Component node 冒烟
  （8 屏×空/满态+provider 决策+事件处理器）；服务端 curl 自证 10 腿（mock 生成链→create→PUT→board→双角色 chat→applyPending→ledger→export→settings 打码/清除）。
- **维护交接**：`docs/workflow/finish/PST-workshop-handoff.md`（部件地图/接口契约/红线/验证方法/已知债）。

### §八.5 验收批 14（owner 2026-07-11 续·「能存必须能跑」定则）

owner 实证：AI 卡带对话改稿后「无法加载游戏」且无原因——「它对自己能加载起来的检查是不存在的」。三刀：
① **落盘装载门**：`scripts/manifest-check.mjs` 升级为 JSON→parseManifest→**真引擎 Engine.load+空跑2tick**
（实证坏稿类：Tilemap 缺 layers——parse 全绿、首 tick 炸）；一切落盘口（PUT/生成/对话应用/板 S3·S8 gate）自动同步。
② **运行器明报**：`RunOnly` 同款装载探针+try——「卡带装入失败」+原因明文+修复建议（粘给「程序」对话/历史回滚），
预览（ManifestPreview）同享；fetch 非 200 也明说。③ **agent House Rules**：`AGENT_CHAT_COMMON` 注入准则摘要
（游戏=纯数据/词表封闭/能存必须能跑/组件=对象非数组/嵌套结构写全/art: 槽/改值优先）——三角色每轮自带，
正面回答 owner「他们会不会 follow 我们的文档」：agent 不读仓库文档，靠**每轮注入的准则+硬门禁**保证遵守。

### §八.6 验收批 15（owner 2026-07-11 双拍板·REQ-ARCH 受控落地）

背景：owner 把「能出复杂的东西」升为第一要素（弱模型尺子降级），怕 7·29 前词表累积不够。两件：
① **capgap 快速通道**（features.capgap 可关）：agent 表达不了 → ```capgap 提案围栏 → cap-gaps 台账 +
`GET /api/capgaps` + 对话留痕——「发现缺口→立单」机器直达，下沉仍归 Lead 裁决。② **TS 例外开关**
（features.tsCarts **默认关=隐藏**）：卡带 ⚡ 打勾（POST flags）→ pe 对话可提议 logic.ts（cartCapability
契约·系统词带世界 API 样例与确定性红线）→ **cart-logic-check 装载门**（模块+契约+合体 2 tick）→
✔ 应用 PUT logic（版本化·空串撤除）→ 运行器 hasLogic 合体装载（dev 线）。记债明示（列表旗+勾旁红字）。
manifest 仍纯数据；自由 TS（代码进 JSON/绕门）仍是禁区。冒烟 ⑬ 16 断言（101→117）。
同批追加 **全库装载体检**（owner「把加载失败的错误都 log 出来」）：`GET /api/library/doctor` +
`scripts/library-doctor.mjs`（逐盘 JSON→parse→引擎 load+2tick+logic 合体·坏盘 [DOCTOR] 台账日志）+
壳游戏库屏 🩺 按钮报告卡（坏盘=红行原因·好盘只计数·告警黄行）。冒烟 ⑭ 3 断言（117→120）。

### §八.7 验收批 17（owner 07-11「按箭头/AD 不动」·输入链双修）

实测根因**双杀**（「程序」agent 的壳层假设对了一半、manifest 假设错了）：
① **运行器无输入**：`RunOnly` 建引擎从没传 `input`——一切数据卡带天生收不到键盘（编译游戏线走
StudioInspector 的 makeInput 才有）。修：`cartInputFor(bp)` 按 Controllable.playerId 自动接
KeyboardInputSource（单人=方向键+WASD+空格；双人=玩家1 方向键+Space、玩家2 WASD+左Shift·
MultiInputSource 合并；无 Controllable 不挂监听器）。② **词表盲区**：把键盘变移动的真契约是运行时
applyMovement 路由 `Controllable{playerId,speed}`，但该组件此前无任何 capability 提供——目录查不到、
推断推不出，AI 只能瞎猜 i1/i2（纯契约原子·声明不产行为）。修：新契约原子 **`i3-controllable`**
（provides Controllable·systems:[]·describe 写明运行时语义与键位约定）+ House Rules 第 7 条输入接线
规则。测试：i3 provider/推断/告警消除 + playerIds 发现 5 断言。

### §八.8 验收批 18（owner 07-12 三连·美术工作流重设）

① **台账按素材去重**（「100 平台共图却 40 行」）：deriveLedger 按 (kind·组件·字段·query) 归并——
一行=一种素材、slots[] 记全部槽位、applyReplacements 扇出写回、mergeLedger 自动吸收旧重复行
（零资产零人工的直接删不留墓碑·有 history/资产的保留）；工坊素材屏打开即 derive 自愈（旧账免手术）。
② **工坊美术一站式**（「占位/提示词/模型/替换都在这个软件里」）：台账卡可点开详情卡——提示词全文
（修截断）/改词/风格包 chips/文生图模型 chips（/api/assets/generate/providers·未配 key 标 ⚠）/
⚡ 单张重生成 / ▶ 批量生成 / ⤵ 替换写回，全走既有 /api/art/* 端点。③ **art-ops 执行器**
（「工作流要重新设计」——美术 agent 只会「给建议叫用户去旧台手动」=废话产能）：美术角色可产
```art-ops 围栏（regen/batch/replace ≤10 条·服务端只校验形状回 artOps），壳出「🎨 美术操作提议」
确认卡 → ✔ 逐条串行执行 → 完成刷新台账/八关灯。冒烟 ⑮ 6 断言（120→126）+ art-replace.test 34。

### §八.1 验收修订（owner 2026-07-11 真机验收六条·当日落地）

1. **三对话入口**：策划(gd)/**美术(art·新)**/程序(pe)——改写 §一「两入口·策划兼美术」定稿；美术角色系统词以台账 digest 为核、点名 art-NN、皮肤槽/风格锚归它。
2. **对话持久化**：每卡带每角色历史存 `.apollo/workshop-chats/<slug>.json`（GET/PUT `/api/agent/chats`·进工坊自动恢复）——对齐 Claude Code 的 session 体验。
3. **模型/思考档可调**：对话屏 chips——模型 Opus 4.8（默认·订阅）/Fable 5（**另计费**·usage credits）/Sonnet 5；思考 high（默认）/xhigh/max（CLI `--effort`）。
4. **debug 日志对齐**：传输层 `[LLM] →/←` 控制台打点 + `GET /api/llm-logs`（度量行·不出全文）+ 壳设置页🐞调试日志块；全文=`APOLLO_LOG_VERBOSE=1` 落 `.apollo/llm-logs/`。
5. **games filter**：全部/卡带/引擎内置三 chips（不影响素材库页签与发布列表）。
6. **生成进度真话**：阶段文案跟真实链路步骤走（读目录→生成→建库→落盘）+秒表——治「卡在 92%」误导（假进度封顶时真相是 Opus 深思考中）。
   另：编辑工坊项目卡显示落盘路径（library/<slug> + public/games/<slug>）。

### §八.4 验收批 5-8（owner 2026-07-11 续·摘要）

用量可见（气泡下 ⏱/↑↓tok·🐞日志带 tokens）。LLM TRACE 滚动窗（所有打字点下方 30 行·完成保留·新轮清）。
底案卡直改（选篇+一句话修订→落盘）。/bench 智能跳转修 ▶ 空页根因（壳硬编 :3000 vs vite :5173·探活 302/提示页）。
launcher URL 直启回归测试。**方案 A·原生 session resume 落地**（§2.1 的 v2 提前）：每卡带每角色绑 CC session，
续轮 --resume 只发增量、manifest 变更指纹注入、失败回落全量——对话体验与 Claude Code session 同构。

### §八.3 验收批 3-4（owner 2026-07-11 续测·当日落地·摘要）

对话区：自动滚底 + textarea（Enter 发送/Shift+Enter 换行）+ 修订实况行 + 「等模型必挂心跳」立规（交接档 §2.5）。
模型选择全局化：CREATE/编辑双处 chips + 设置页持久默认（providers.claude-code.model）。
原型 job「prompt 必填」卡死修复（mode=prototype 走 slug 校验）。设计现场草稿（/api/workshop/draft·杀服可续）。
底案=活工件：gd 注入设计稿全文 + ```design 围栏提议 → 确认落盘；编辑工坊左列底案卡。
▶ 运行直达（壳→旧工作台运行器·from=workshop 返回创作台·launcher 扩 ?game=lib:<slug>）。
中文名 slug 编号兜底 game-NNN。旧版 CLI 自动降级非流式（升级 CLI 恢复实况）。design-chat/revise 思考档 medium。

### §八.2 验收批 2（owner 2026-07-11 续测四条·当日落地）

1. **生成=服务端后台任务**：`POST /api/generate/job {prompt|mode:'prototype'+slug}` → 线程跑
   目录→生成→建库→落盘全链；`GET /api/generate/job?id=`/`/jobs` 看板轮询——**切屏/刷新/关页不丢，完成自动入库**
   （状态放在会话之外·与八阶段板同一防漂移纪律）。壳启动自动恢复活跃任务看板。
2. **订阅通道两个实证修复**：①300s 超时掐（llm-logs 抓到 300.0s error）→ **心跳看门狗**（owner 追加拍板：只要还在吐流就不杀——180s 零输出=停滞收割·1800s 绝对上限只作跑飞保险）；
   ②`stop_reason=tool_use + error_max_turns`（CLI 代理人格想调工具吃掉唯一回合）→ 三刀根治：
   `--append-system-prompt` 钉纯文本生成器 + 禁用名单补全（AskUserQuestion/EnterPlanMode/SlashCommand/Skill/Agent…）+ 流式打捞正文。
3. **思考实况可见**：通道改 `stream-json --include-partial-messages` 流式读——thinking/text delta 进
   `_LLM_LIVE` 注册表（`GET /api/llm-live`）；生成看板显示「🧠 已流出 N 字 + 尾巴」，对话「思考中」带实况字数——治「卡 82% 不知道在干什么」。
4. **设计先行流上壳**（owner「先提纲→对齐→再生成」）：CREATE 屏双模式——**设计先行（默认）**=
   聊想法(design-chat)→起名出提纲(建库+design-breakdown→`library/<slug>/design/*.md` 壳内可见)→逐篇对话修订
   (design-revise+PUT 落盘)→生成可玩原型（prototype 后台任务）；**快速直出**=原一句话链（也走后台任务）。
   服务端四模式零新建——纯壳上编排（manifesto §4 先重组）。
