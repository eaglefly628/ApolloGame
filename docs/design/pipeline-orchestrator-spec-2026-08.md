# P1 编排器 + 向导壳 · 施工图纸（REQ-PIPESOFT · Lead 2026-08-04）

> 上位案：`docs/design/pipeline-software-plan-2026-08.md`（owner 四裁已批）。本图纸把 §三 的 1、2 层写到可派工。
> 分两单：**P1a 编排器核**（引擎 scripts 域·正确性关键·先行）、**P1b 向导壳**（workshop UI·PST 域·后行）。

## P1a · 编排器核 `scripts/pipeline-orchestrator.mjs`

### 命令面

| 命令 | 语义 |
|---|---|
| `dispatch <slug> <SN>` | 为该游戏该阶段起一个匿名无头会话（见会话契约）；同库同刻只许一个在跑（锁） |
| `status [slug]` | 各在跑会话：阶段/起始时刻/最近心跳/状态（running·stalled·done·failed） |
| `abort <slug>` | 终止该游戏的在跑会话并把该阶段标「中止·需人工」 |

### 会话契约（防漂移三律的软件化）

1. **喂料只有三样**：该阶段手册那一本（八阶段表「手册」列）+ `board <slug>` 实时输出 + 游戏目录路径。
   附一段固定尾注：完成动作 = 跑该阶段机器门（退出码直接量）→ 停；**禁**跨阶段抢跑、禁碰他人文件、禁代签人门。
2. **落地方式**：shell 出 `claude -p`（无头·`--max-turns` 按阶段封顶）。**先探测**：CLI 不存在/未登录 →
   dispatch 报「本机无编排运行时」优雅拒绝，板照常手动用（**编排器是加速器不是依赖**·远程/CI 无 CLI 属预期）。
3. **档位与预算**（CLAUDE.md effort 阶梯）：S1/S8=low；S2/S3=medium；S4/S5=high。S6 走美术平台非 LLM 会话；S7=人门无会话。
4. **看门狗**：600s 无输出=stalled → 杀进程 → 自动重派**一次**；再停=failed，板上该阶段标红「需人工」。
5. **绿不靠嘴**：会话退出后编排器**独立重跑**该阶段 gate（`game-pipeline.mjs gate`），以自己量到的退出码落证据——
   会话自称完成不算数。
6. **串行锁**：`.zerocraft/orchestrator.lock`（含 slug/SN/pid/起始时刻）。有锁再 dispatch = 拒绝并显示占用方
   （M1 撞车事故律：同库双头施工=浪费+冲突）。锁进程死亡（pid 无效）= 自动清锁。
7. **会话产出纪律**：阶段会话按现行推送门禁自己提交推送（全套 gate 走 scoped-gate）；编排器不代提交。

### 测试（点名·假信心自查必做）

锁互斥（双 dispatch 第二个必拒）；看门狗（stub 慢进程→stalled→重派一次→failed）；gate 独立重验（会话谎报完成
→ 编排器落 FAIL 证据）；CLI 缺失优雅拒绝。全部用替身进程，不真烧 token。

## P1b · 向导壳（workshop 生产板「向导模式」·PST 域）

1. **一句话入口**：输入框 → `POST /api/pipeline/wizard-concept`：有编排运行时→派一个 S1 微会话把一句话扩成立
   项卡草稿（名字/一句话玩法/参考）落 concept CLI；无运行时→原样落一句话为 pitch，其余人填。
2. **步进器**：只亮第一个非绿阶段；行内三钮=「▶ 开工（派会话）」（转圈显示 running/stalled/failed·读
   orchestrator status）「跑机器门」「☑ 请人门」（永远真人点·现签核语义不变）。其余阶段折叠显示证据摘要。
3. **锁可视**：库级「施工中」横幅（谁·哪阶段·多久了）+ abort 按钮（人操作）。
4. 现有生产板两模式不动；向导=第三入口。API 全部薄封装现有 CLI（concept/gate/signoff/orchestrator），**不造第二真相**。

## 派工与顺序

P1a：指派 Opus 档子代理（xhigh·正确性关键——锁/看门狗/独立重验是纪律执法点，错了=假绿通道）。
P1b：P1a 落地后派 PST 档（medium-high）。P1c 一句话入口含在 P1b。
每单完成 = Lead 对抗性验收（突变探针：谎报完成必须被拦；双 dispatch 必须被拒）。

## ⚖ P1a 终审（Lead 2026-08-04·✅ PASS·commit `5f070a4ed`）与偏差裁决

九条据实偏差**全部照准**：②max-turns 默认（25/60/120/40·P3 试点再调）③.gitignore 补三行（图纸「已盖」系误记·以实测为准）④运行台账 `orchestrator-runs.json`（运行时域·不在 pipeline.json 造第二真相=正确）⑤abort=failed+aborted+needsHuman（闭集不外扩）⑥S1/S2 重验走 `board --json` 推导 machine.state（同「自己量」精神）⑦锁键名 stage ⑧退出码分档 0-4（P1b 回落手动所需）⑨编排器测试留快车道（纪律执法点·每推必跑）。
**①会话权限口径（Lead 裁）**：默认组合=`--permission-mode acceptEdits` + 仓内 settings 允许清单；**禁止**把 `--dangerously-skip-permissions` 写死为代码默认——操作者要放权自担，经 `ZEROCRAFT_ORCH_FLAGS` 注入并留痕。真机联调归 P3 试点首项。

## 红线（继承上位案）

无特权通道（编排会话与手动会话同门同板）；人门不可代签不可 API 绕过；token 档位不越级；
锁文件属 `.zerocraft/` 运行时域（gitignore 已盖·不进库）。
