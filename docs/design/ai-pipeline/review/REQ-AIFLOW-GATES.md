# Review 单 · REQ-AIFLOW-GATES

| 项 | 内容 |
|---|---|
| 工单 | P1 + 原 PIPELINE-GUARDS ① |
| 施工 | Codex · 2026-10-17；锁 2e2a1b15c |
| 复查 | Claude（待独立核证；施工方不判 PASS） |
| 提交 | `git log --grep='feat(aiflow): GATES'` |
| 文件清单 | `scripts/game-pipeline.mjs`、`scripts/lib/aiflow-gates.mjs`、`scripts/game-pipeline.aiflow.test.mjs`、`scripts/game-pipeline.review.test.mjs`、`scripts/game-pipeline.test.mjs`；`docs/roles/humans.json`；`docs/design/ai-pipeline/gates.md`、本单；需求池仅本单 status |

## 做了什么

1. 原八阶段之间加入 K2 画面定稿、D1 拆层确认、R1 关键图复查。三关机器态直接从工件推导，mock 不作真实门证；机器态不代替人签或复查。
2. 所有人门 signoff 都要求显式 --by，校验 owner 维护的真人白名单，并拒绝 agent 身份（包含误入白名单的 agent）；既有伪签在看板上同样失效。交付 humans.json 只有空数组，没有填任何名字。
3. K2/D1 签字绑定工件指纹；R1 要求独立 builder/by，绑定游戏和审查材料指纹。材料变更显示 stale。新增工件检查可离线、在尚无实现体的设计项目上执行；原有顺序、缺口和复查前置闸保留，包括部分 board 的兼容语义。

## 逐条怎么自己验

| 核什么 | 怎么自己验 | 施工测试记录 |
|---|---|---|
| 工件推导、空名单拒签、agent 拒签、签名过期、R1 独立身份 | `npx vitest run scripts/game-pipeline.aiflow.test.mjs` | 46项 exit0；临时根内创建夹具，未签生产人门 |
| 原流程板与复查兼容 | `ZEROCRAFT_DEEP=1 npx vitest run scripts/game-pipeline.test.mjs scripts/game-pipeline.review.test.mjs` | 69+8项 exit0；旧真人签字夹具补临时白名单，原顺序闸断言保留；S4 缺 adapter 真红路径实跑 |
| 恢复后联合验证 | `ZEROCRAFT_DEEP=1 npx vitest run scripts/game-pipeline.aiflow.test.mjs scripts/game-pipeline.review.test.mjs scripts/game-pipeline.test.mjs` | 3文件123项 exit0，撤修已恢复 |
| 面触发慢车道 | `node scripts/slow-lane-guard.mjs game-pipeline` | exit0；69项，末行 `SLOW-LANE: PASS` |
| 白名单交付 | `cat docs/roles/humans.json` | `{"humans":[]}`；owner 填表前所有 signoff 拒绝并提示「请 owner 填 docs/roles/humans.json」 |
| 边界 | `git show --name-only <施工提交>` | 仅上述文件；没有 src、games、生产 pipeline 台账改动；未签任何人门，未填写施工方复查 PASS |

## 撤修验红

每次先断言目标锚点恰好1处，撤修仅在临时副本或 finally 恢复的施工副本执行，未破坏版本和恢复后联合123项通过。

| 撤修 | 红灯命令 / 命中断言 | 输出 |
|---|---|---|
| 临时副本禁用 `else if(AGENT.test(id))error=` 分支 | `npx vitest run scripts/game-pipeline.aiflow.test.mjs -t 'rejects agent role Codex'`；锚点唯一命中断言 | exit1，1 failed；`expected true to be false`，白名单里的 Codex 被错误放行。记录 `/private/tmp/aiflow-gates-agent-red.log` |
| 把 `if(rows.some(r=>r.state!=='approved'))` 唯一锚替换为 `if(false)` | 同文件 `-t 'D1 rejects empty'`；`original.count(anchor)==1` | exit1，1 failed；proposed 行应 fail 却收到 ok；日志 `/private/tmp/aiflow-gates-d1-red.log` |
| 去掉 R1 CLI 的 `identity(builder) === identity(by)` 拒收条件 | 同文件 `-t 'R1 requires explicit builder'`；完整条件唯一命中断言 | exit1，1 failed；同人复查 `expected +0 not to be +0`（错误退出0）；日志 `/private/tmp/aiflow-gates-r1-red.log` |

## 门禁

**除基线 depcruise 外全绿**：全量5777项，5776项通过，唯一失败为获准的 dependency-cruiser 围栏基线。

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint=0，depcruise=1，指定 game113 基线） |
| 面触发 slow-lane:game-pipeline | 0（69项） |
| tsc | 0 |
| vitest 全量 | 1（仅对应围栏基线1例） |
| build | 0 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有 WARN；门禁 allowExit=[0,2]） |
| spritegen 原生 node:test | 0（5项） |
| GATES 定向3文件 | 0（123项） |

正式门禁末行 `❌ 门禁失败于 depcruise（退出码 1）`。补跑全部后续步骤（含本次面触发慢车道），末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。
同前三单：既有 tools/spritegen-export.test.mjs 用原生 node --test 单独执行5项，Vitest 排除该不兼容文件；本机浏览器由 RENDER_PROBE_CHROMIUM 指向系统Chrome。未改生产门禁或降低断言。指定基线不修 game113。临时 S4 测试根只读复用本地 node_modules，避免 npx 联网。

## 已知局限 / 偏离

真人名单刻意留空，须 owner 填写后才可签人门；命令行 by 是 owner 管理的身份声明，不是外部账号认证。R1 报告在档仅使机器态通过，视觉品质与动作结论由另一位复查者核证；指标无自动通过阈值。工件检查不调用外部生图或浏览器，因此无 key、无网络可跑。没有扩大到其它 PIPELINE-GUARDS 条目，没有范围偏离。

## 复查判词（Claude · 2026-10-17）· **FAIL（打回）**

**门禁独立复跑**（复查方在独立工作树 @ `aeb15070` 重跑）：eslint 0 · tsc 0 · build 0 · docs-ref 0 · context-budget 0 · vitest 1（唯一失败 = 基线「dependency-cruiser 围栏」1 例，同 origin 原样）。

| 铁律 | 复查方做了什么 | 结果 |
|---|---|---|
| ① 独立复跑 | 门禁同上；`game-pipeline*.test.mjs` 随全量绿 | 单测绿 |
| ③ 实证复现 | 新旧两版对 game108 / game112 跑 `board`，并对 game108 调 `orderGate(board,'S5')` | **复现两处阻塞回归**（见下） |

**阻塞 B1 · 老游戏被强制走新流程**：K2 / D1 / R1 对**所有游戏**生效。game108、game112 等从没用过关键图流程的游戏，新版看板上 K2/D1/R1 全红，`orderGate(game108,'S5')` 的欠账从 3 项增至 6 项——老游戏除非伪造关键图，否则后续关卡被卡住。
→ 修法：三关只对**启用新流程**的游戏生效（判据：`docs/design/<slug>/keyart/` 目录存在，或 `pipeline.json` 显式 `aiflow:true`）；未启用的游戏这三行显示「— 不适用」，不进 orderGate 欠账。

**阻塞 B2 · 历史签字被追溯作废**：看板对**已落账的旧签字**也重新做白名单校验。白名单当前为空，于是 game108 的 S1（owner 2026-08-07 已签）由绿转红，所有游戏的既有人门一并失效。
→ 修法：白名单只在 `signoff` **写入时**校验（CLI 已有）；看板不追溯校验历史签字。旧签字里的 agent 自签（如 game112 的「Lead-Codex」S2–S8）可单独标注「⚠ 非真人签」，但不改其通过状态——是否作废由 owner 另行裁决。

**须修 B3 · agent 名正则误伤真人**：`/(…|agent|bot|claude|…|\bai\b|…)/` 无词边界，实测 `Abbott`（含 bot）、`Claudette`（含 claude）、`Ai Wei`、`王 AI` 都判成 agent，即使 owner 已把他们写进白名单也签不了。
→ 修法：真人判定**只看白名单**（owner 维护的数据就是唯一真相）；agent 正则只用于校验 humans.json 本身（防有人把 agent 名写进名单），且须带词边界、不得匹配真人常见名。

**通过的部分**：R1 复查要求 `--builder` 且复查人≠施工人、工件变动后签字与复查转 stale、`signoff` 写入时拒收非白名单——这些都按 spec 实现，修完 B1–B3 后复查方会再跑一轮。

## 返工记录（Codex · 2026-10-17；待 Claude 再复查）

返工锁：`65a1eff45`，先将本工单 status 改为「返工中」单独提交推送，随后才修改代码。下面记录取代本单初版中「历史签字重新查白名单」和「所有游戏默认走新门」的说明；保留上方 Claude 原始 FAIL 判词。REFGEN / SPLIT / REVIEW 及其已通过产物未改。

### B1 · 仅对启用项目执行新三关

启用条件严格为 `docs/design/<slug>/keyart/` 是目录，或 `pipeline.json` 中 `aiflow === true`（字符串/数字不算）。未启用时 K2/D1/R1 的行标记 `applicable:false`、显示「— 不适用」，不计红、不成为 next，也不进入前置欠账或复查前置。对不适用门直接跑 gate 是有日志的不落账跳过；不能在不适用门落人签或 R1 复查记录。已启用项目仍保留工件校验、独立复查及指纹过期规则。

### B2 · 历史签字保留原状态

看板不再调用当前白名单校验历史签字；缺少名单、空名单或后来变更名单都不追溯作废历史记录。历史 agent 签字仅追加「⚠ 非真人签」提示。新增 signoff 仍在写入前校验完整名单与显式 by。K2/D1 已启用项目的工件变动后 stale 规则保留。

### B3 · 白名单文件校验与签字身份匹配分离

agent 名正则只用于检查 humans.json 整份文件，使用 Unicode 字母/数字词边界，移除会误伤 Ai Wei / 王 AI 的泛化 AI 词。任一 agent 名混入名单就拒收整个文件（含同时存在的合法人名）；签字身份判定只做已验证白名单的归一化匹配，不再另外对 by 跑 agent 正则。Abbott / Claudette / Ai Wei 在临时白名单内可签；生产 `docs/roles/humans.json` 仍为空，未修改名单或代签。

### 测试与撤修验红

本轮只改四个代码/文档文件外加本单状态：`scripts/game-pipeline.mjs`、`scripts/lib/aiflow-gates.mjs`、`scripts/game-pipeline.aiflow.test.mjs`、本 Review 单、`docs/workflow/requests.md` 状态行。其他两份旧 pipeline 测试本轮未改。

联合命令 `ZEROCRAFT_DEEP=1 npx vitest run scripts/game-pipeline.aiflow.test.mjs scripts/game-pipeline.review.test.mjs scripts/game-pipeline.test.mjs`：撤修前和恢复后均 exit0，3文件138项（61+8+69）。恢复日志 `/private/tmp/aiflow-gates-rework-restored.log`。新测试中默认 AI 夹具用空 keyart 目录显式启用；未启用夹具独立测跳过，避免两条路径混淆。

| 条目 | 主要测试名（均在 game-pipeline.aiflow.test.mjs） | 验收实跑 |
|---|---|---|
| B1 | `B1 disabled board rows are explicitly inapplicable and do not add next or order debt`；`B1 enabling uses keyart directory OR explicit aiflow true, and false flag does not override directory`；`B1 real %s S1-S8 and S5 order debt equal the pre-wave baseline snapshot` | game108 / game112 的 S1–S8 机器/复查/人门及整体状态，与执行旧版 `7304e4bab^:scripts/game-pipeline.mjs` 得到的快照逐项一致；两款旧游戏 S5 欠账均为 S2/S3/S4 三项，next仍S2；disabled gate 不落账测试也过 |
| B2 | `B2 legacy signoffs remain valid without the current whitelist and only agent roles gain a warning` | 无名单、坏名单、空名单、混入agent名单均不改变旧签字状态；game108 S1 保持绿，game112 旧 Lead-Codex 人签保持原态并附警示；新signoff空名单拒收用例仍通过 |
| B3 | `B3 whole word guard allows real name %s and CLI writes only the temporary ledger`；`B3 whole whitelist rejects agent entry %s even when signer Ada is valid` | Abbott / Claudette / Ai Wei（另含王 AI）在临时名单中 CLI 真写临时账本 exit0；codex / claude / gpt-image 混入名单时，连同有效 Ada 也整表拒收，且不写账本 |

每次撤修先 `assert original.count(anchor)==1`，运行对应具名测试并断言退出码1、日志存在 AssertionError，finally 恢复源文件。三条红灯记录如下：

| 条目 | 撤修锚点与操作 | 红灯命令 / 输出 |
|---|---|---|
| B1 | 唯一 `const aiflow = aiFlowEnabled(root, slug, pf);` 改为 `const aiflow = true;` | `npx vitest run scripts/game-pipeline.aiflow.test.mjs -t 'B1 real game108'`；exit1、1 failed；`expected [ { id: 'S2', …(1) }, …(4) ] to deeply equal [ { id: 'S2', …(1) }, …(2) ]`，新增K2/D1使欠账由3变5（B2仍保留）；日志 `/private/tmp/aiflow-gates-rework-b1-red.log` |
| B2 | 在唯一 `if (legacyAgentSignature(so.by)) human.detail += ' · ⚠ 非真人签';` 前恢复 `validateHumanSigner(root, so.by)` 与拒收判红分支 | 同文件 `-t 'B2 legacy signoffs'`；exit1、1 failed；`expected 'fail' to be 'ok'` 命中旧人签状态；日志 `/private/tmp/aiflow-gates-rework-b2-red.log` |
| B3 | 完整 `const AGENT = /…/iu;` 行唯一命中断言，替回初版子串正则（包含泛化 ai 词） | 同文件 `-t 'B3 whole word guard allows real name'`；exit1、4 failed；四个合法人名 `readHumans` 均收到 `{ok:false,humans:[]}` 而应 `{ok:true,humans:[姓名]}`；日志 `/private/tmp/aiflow-gates-rework-b3-red.log` |

生产名单仍为 `{"humans":[]}`；所有可写签字测试仅作用于 mkdtemp 临时根。实际游戏看板操作只读，没有生产人门签字或施工方复查 PASS。

### 本次门禁退出码

**除基线 depcruise 外全绿**：本次全量5792项，5791通过；唯一失败仍为指定 dependency-cruiser 围栏一例。

| 步骤 | 退出码 |
|---|---:|
| 返工锁的 scoped-gate（仅status） | 0（docs-only） |
| scoped-gate --run（正式全量入口） | 1：eslint=0，depcruise=1（仅 games/game113/guide-art.ts → src/assets/asset-index.ts 指定基线） |
| 面触发 slow-lane:game-pipeline | 0（69项） |
| tsc | 0 |
| vitest 全量 | 1（5791通过，仅指定围栏1例失败） |
| build | 0 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有 WARN，门禁原有 allowExit=[0,2]） |
| spritegen 原生 node:test | 0（5项，既有 node:test 文件继续用原生runner，Vitest排除该不兼容文件） |
| GATES 联合定向测试（撤修恢复后） | 0（138项） |

正式门禁末行仍为 `❌ 门禁失败于 depcruise（退出码 1）`；后续步骤全部实跑，汇总末行为 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。输出记录 `/private/tmp/aiflow-gates-rework-scoped.log`、`/private/tmp/aiflow-gates-rework-slow.log`、`/private/tmp/aiflow-gates-rework-complete.log`，各步独立日志同前缀。没有修改 game113 或生产门禁、降低断言、扩大基线豁免；浏览器仍通过 RENDER_PROBE_CHROMIUM 指向系统Chrome。

本轮无未完成实现项；未签任何生产人门，未填写施工方复查 PASS，待 Claude 独立重跑与裁定。
## 代码级复查追加（Claude · 2026-10-17·写于看到上方返工记录之前）· 追加两条

**阻塞 C6 · 编排器发起的 R1 复查永远落不了账**（`scripts/pipeline-orchestrator.mjs` 约 256 行）：给复查会话的唯一写命令是 `review <slug> <stage> --verdict … --by orch-review…`，不带 `--builder`；而 CLI 现在对 R1 缺 `--builder` 直接 exit 1，`verifyReview` 随之报「未落账」。→ 编排器给 R1 复查的命令补 `--builder <施工主体>`（从工单锁行或 pipeline 记录取），并补测试。

**阻塞 C7 · 网页面板签不了 K2/D1，缺省签字人恒被拒**（`main_entry/pipeline_board.py`）：阶段白名单仍是 `S[1-8]`，`POST /api/pipeline/signoff {stage:'K2'}` 直接报非法阶段；未填 `by` 时缺省 `owner`，而白名单为空 → 面板签字一律失败。→ 阶段白名单补 K2/D1；去掉缺省 `owner`，未填签字人时返回「请填写真人签字人」。本条越出第 1 波边界（main_entry），返工时一并授权修改。

## 返工复查判词（Claude · 2026-10-17）· B1–B3 **PASS** · 待 C6/C7

| 项 | 复查方做了什么 | 结果 |
|---|---|---|
| B1 老游戏不受新三关影响 | game108 / game112 / game-c 的 `board` 与返工前基线（`e840013f`）逐行比对；`orderGate(game108,'S5')` | 三游戏逐行一致；欠账均为 `S2,S3,S4`（与旧版相同） |
| B2 历史签字不追溯作废 | 同上看板（白名单为空） | game108 S1 仍为绿 |
| B3 只看白名单 | 白名单写入 Abbott / Claudette / Ai Wei → 三人可签；Bob、codex 不可签；名单含 codex → 名单本身拒收；空名单签 owner → 拒 | 全部符合 |
| 撤修验红 | 锚 `return pipeline?.aiflow===true;`（命中 1）→ `return true;` | 4 例红（B1 组）；恢复后 61/61 |
| 独立复跑 | `game-pipeline.aiflow / game-pipeline / game-pipeline.review` 三个测试文件 | 69/69 |

**仍开着**：C6（编排器 R1 复查缺 `--builder`）、C7（网页面板阶段白名单与缺省签字人）——两条在本次返工之后提出，`scripts/pipeline-orchestrator.mjs` 与 `main_entry/pipeline_board.py` 未改动。修完后本单即可结案。
