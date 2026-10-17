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
