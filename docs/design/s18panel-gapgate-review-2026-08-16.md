# REQ-S18PANEL ②③ 独立复查报告（2026-08-16 落地 / 2026-08-17 复查·判 FAIL 打回）

> 复查人 = 另派的独立复查 agent（复查人≠施工人成立·未参与 `48817307`/`828ce031` 任何一行）。
> 全部验证在**临时 clone**（`git clone /home/user/ApolloGame` → `checkout 7574e8ca` → `npm ci`）内完成；主仓未改一行源码、未 commit、未 push、未 stash。本文是唯一写进主仓的产物。
> 四步铁律全走：独立复跑（退出码不经管道）/ 撤修验红九轮带锚点命中断言 / 实证复现 / 读告警。

## 判词：**FAIL（打回·非判据层，判据层 ①②③ 是成立的）**

**判据 ①②③ 本身全部成立且经得起撤修**：台账七键闭集、`S2.gate: null → 'gap-check'`、`orderGate` 缺口锁「`--out-of-order` 也不放行」，我逐条独立复现，九轮 sabotage 中 R1–R6 锚点全中、红在恰好该红的断言上（明细见下）。跨侧 route 对账测试是**真对账**（改 `projects.py` 一个词、或把 tuple 改写成 frozenset，都恰红那一条）。这些我照实认。

**打回的理由是三条判据外的实测伤**，其中两条是**对既有行为的回归**，而工单条目里写的是「零回归 / 更严不更松」：

1. **P0 · 施工方自己点名的接缝 (b) 是真回归，而且伤到现役游戏。** `S2` 进 `GATE_STAGES` 后，`pipeline-orchestrator.mjs:310` 的 `verifyStage(S2)` 从只读的 `board --json` 推导改走 `gate <slug> S2`，于是**顺带套上了阶段顺序闸**。实测 `game-d` / `game102` 的 S2 独立重验从 `exit 0` 翻成 `exit 1`，红因与缺口台账毫无关系（「S1 立项卡 欠：人门(dim)」）。声称的「未改编排器一行·更严不更松」里，「更严」这个词掩盖了「**这一严不是本单要的严，且是存量游戏当场变红**」。
2. **P0 · 判据外顺手的 (c) 把两条存量红变成了推送硬闸。** `scoped-gate.mjs:111` 的 `DEEP_LANE_TESTS` 里，`acceptance.test.mjs` 与 `audit-ratchet.test.mjs` **今天在 HEAD 上就是红的**（各 exit 1）。端到端实证：在 clone 里给 `scripts/acceptance-run.mjs` 加一行注释跑 `scoped-gate --run` → `❌ 门禁失败于 deep:acceptance.test.mjs`、`GATE_EXIT=1`，且这一步排在 `tsc` 之前，人还没看到自己的改动就被别人的存量红挡住。这条改动是**自我声明「非追认」而未经裁决**地动了全库共享的推送门（🔴 归属面），代价没摆过。
3. **P1 · 接缝 (a) 的「排除出 gameHash」在 S3/S4/S5 上讲得通，唯独在 S2 自己身上讲不通。** 缺口台账正是 S2 复查门的**审查对象**，把它排除出指纹 ⇒ 台账怎么改，S2 的复查记录都不会 stale。实测：复查 PASS + 人门签核后把一条 P0 `accepted` 手改成 `delivered`，S3 的 🔒 当场消失，而 S2 三门仍 `ok/ok/ok`、`gameHash` 一字未变。锁的完整性挂在一个「删了就等于全清」的文件上。

方向对、代码干净、测试写得比多数单子扎实——但这三条里有两条是回归、且都写在了「零回归」的自陈旁边。为了绿而绿正是这套门要治的病，故打回。

---

## 复跑与验红记录

### 独立复跑（退出码直接量·`cmd; echo EXIT=$?`·绝不经管道）

| 门 | 结果 |
|---|---|
| `ZEROCRAFT_DEEP=1 npx vitest run scripts/game-pipeline.test.mjs` | **EXIT=0** · Test Files 1 passed · **Tests 55 passed (55)** |
| `npx vitest run scripts/scoped-gate.test.mjs` | **EXIT=0** · Tests 28 passed (28) |
| `node scripts/scoped-gate.mjs --run`（默认基线） | EXIT=0 但 **`判定=none（无改动）`——空跑，不作数**（clone HEAD ≡ origin/claude/mainbranch） |
| `node scripts/scoped-gate.mjs --base 48817307^ --run`（复现本单真改动面） | **EXIT=0** · `判定=full` · 计划 `deep:game-pipeline.test.mjs → tsc → vitest:full → build → docs-ref → context-budget → decouple-check → art-ledger-guard` · **vitest:full 495 files passed** |

**「不带 `ZEROCRAFT_DEEP=1` 会 0 tests + exit 0 假绿」——我亲自确认：这个说法不成立。**
实测 `npx vitest run scripts/game-pipeline.test.mjs`（无 env）输出 `No test files found, exiting with code 1`，**EXIT=1，是硬红不是假绿**（vitest 2.1.9 默认 `--passWithNoTests=false`）。真实风险是另一个形状：**不带过滤的 `vitest run`（即 `vitest:full` 那一步）按 `vite.config` 的 `exclude` 把这个文件整个跳过**，静默漏跑。方向的修是对的，**但提交信息与测试标题里「假绿 / No test files found 的假绿」是不实措辞**（`scripts/scoped-gate.test.mjs` 那条用例的标题原文即如此），按本仓「日志说了什么就得真是什么」的口径应更正。

### 读告警（绿灯不等于没话说）

full 跑的 stderr 里有三处非零噪声，**逐一核过均为存量、与本单无关**，但记在这里以免下一轮被当成本单引入：
`ENGINE-RANDOM: WARNINGS`（`src/net/mp-client.ts:13` 白名单）· `HYGIENE: WARNINGS`（`src/debug/debug.test.ts:70` 白名单）· `ART-LEDGER-GUARD: WARN`（game-a/game101 黑户 5 + 死账 2）。三者都只打 stderr 不改退出码。

### 撤修验红（九轮·每轮先断言文件真被改到，再量恰好哪几条红）

| 轮 | sabotage（锚点） | 锚点命中 | 恰好红了 |
|---|---|---|---|
| R1 | `game-pipeline.mjs:118` `gate:'gap-check'` → `null` | ✔ 2 行 | **3 例**：阶段表 `GATE_STAGES` 断言 · `S2 gate 无 plan→红/有 plan→绿` · `S2 gate 有未裁决缺口→真红` |
| R2 | `game-pipeline.mjs:504` 删缺口锁早退 | ✔ 2 行 | **2 例**：`缺口锁 --out-of-order 也不放行` · `gate CLI 缺口锁 S3` |
| R3 | `game-pipeline.mjs:102` 撤 `capability-gaps.json` 排除 | ✔ 2 行 | **1 例**：`缺口台账不入 gameHash` |
| R4 | `game-pipeline.mjs:190` 撤「`≠open` 必带 ticket」 | ✔ 2 行 | **2 例**：`已裁决却无 ticket→红` · `台账不合法→S2 红 + 板带 gapErrors` |
| R5 | `projects.py:41` `_GAP_ROUTES` 改一个词（`'pui'→'ui'`） | ✔ 2 行 | **1 例**：`route 闭集与 projects.py::_GAP_ROUTES 逐字相同` — **跨侧对账是真在对，不是抄常量** |
| R6 | `projects.py:41` tuple → `frozenset([...])`（正则抠不到） | ✔ 2 行 | **1 例**：同上（`expect(m).toBeTruthy()` 兜住了改写法） |
| R7 | `scoped-gate.mjs:123` 撤 `deepTests` 注入 | ✔ 2 行 | **2 例**：`facesOf 命中` · `deepTests 步带 ZEROCRAFT_DEEP=1` |
| R8 | `scoped-gate.mjs:180` 撤步骤 `env` | ✔ 2 行 | **1 例**：`deepTests 步带 ZEROCRAFT_DEEP=1` |
| R9 | `scoped-gate.mjs:207` 撤 armed 空数组特判 | ✔ 2 行 | **0 例·全绿 exit 0 —— 该修复无任何测试** |

R9 的假日志我另行实证复现：`facesOf(['games/game-d/x.ts'])` 下，旧逻辑 `armed = ['deepTests','dokiApps']`（两个空数组被当命中），新逻辑 `armed = []`。**修得对，但撤了没人叫**（`scoped-gate.test.mjs` 里 `armed` 出现 0 次）。

复位核对：九轮跑完 `git status --porcelain` 空（clone 工作树干净）。

---

## 逐条核对（判据 ①②③）

### ① 台账 `docs/design/<slug>/capability-gaps.json` — **成立**

裸数组 + 七键归一（`game-pipeline.mjs:180-193` 只吐 `{id,title,priority,route,state,ticket,blocks}`，多余键丢弃）。四闭集实测逐条点名：`priority 非法 "P9"` / `route 非法 "game"` / `state 非法 "待定"` / `blocks 含未知阶段 "S9"` / `id 重复` / `缺 title`；`state≠open` 缺 ticket 红（`:190`）、`open` 免 ticket。坏 JSON 与非数组顶层各出一条点名错、不抛不崩。`GAP_ROUTES`（`:156`）已与端点逐字对齐为 `engine|requests-3d|pui`——`828ce031` 修得对，且**修的是判门端而不是端点**，符合工单「以 `projects.py` 归一后形状为准」。

### ② `S2.gate: null → 'gap-check'` — **成立（board 现算已实证）**

`gate <slug> S2` 有 `open` 缺口 → exit 1 并点名；逐条判完 → exit 0。板上同一只嘴出 `⚠`（`evalCapabilityGaps` 单一实现，board 与 gate 共用）。

**重点怀疑面 (a) 的前半问「S2 机器态是不是真的每次 board 现算」——是，实证过**：`game-pipeline.mjs:371` 在 `boardFor` 里直接 `readCapabilityGaps`，不读 `pf.evidence`。我手改台账文件、**一次 gate 都不跑**，下一条 `board --json` 立刻从 `ok` 变 `warn`（S2 machine），证明不是读陈旧证据。顺带发现：`gate S2` 仍照常往 `pipeline.json` 写 `evidence.S2`，而 board 的 S2 分支**从不读它**——这条证据是死账（只有一条测试 `game-pipeline.test.mjs:585` 在断言它）。无害，但下一轮要么读它要么别写。

### ③ `orderGate` 缺口锁 — **成立，且 `--out-of-order` 确实不放行**

实测同一状态下三种调用：无 `--out-of-order` / 带理由 / 带空理由，**全部 exit 1**，且 `pipeline.json` 的 `outOfOrder` 数组**保持空**（不留假放行痕）。P0/P1 且未 `delivered`/`wontfix` 且 `blocks` 含本关才锁；`delivered` 后当场放行。P2/P3 不锁（`blockingGaps` 的 `GAP_BLOCKING_PRIORITIES` 过滤实测生效）。

### 零回归锚 — **半成立，措辞需更正**

全库 `find -name capability-gaps.json` = **0 个**，属实。5 款现役游戏（game-d/game-g/game108/game-i/game102）before↔after 的 `board --json` 对拍：**八关的 machine/review/human/status 四元状态串逐字相同、`gameHash` 相同**。但「**逐字节**同旧版」不成立：顶层新增 `gaps`/`gapErrors`、每关新增 `blockedBy`（加性字段，消费方安全，但那是「加性兼容」不是「逐字节相同」）。**真正不成立的是「门逐字节同旧版」**——见下面 P0-1。

---

## 问题清单

### P0-1 · S2 进 `GATE_STAGES` 是对现役游戏的真回归，且自动化流程被卡死

**证据（before/after 对拍·`verifyStage(root, slug, 'S2')`）**

```
game-d   BEFORE: board exit=0 | 板推导 S2 机器门=ok
         AFTER : gate  exit=1 | ✗ 阶段顺序闸：S2 前置阶段未全绿…· S1 立项卡 欠：机器门(dim) / 人门(dim)
game102  BEFORE: board exit=0 | 板推导 S2 机器门=ok
         AFTER : gate  exit=1 | ✗ 阶段顺序闸：S2 前置阶段未全绿…· S1 立项卡 欠：人门(dim)
game108  BEFORE: board exit=0    AFTER: gate exit=0（S1 已签·唯一没翻的）
```

**为什么这是死结而不只是「更严」**：`gate` 子命令在跑 `gateRun` 之前先过 `orderGate`（`game-pipeline.mjs:794` 起），而 S1 的人门是 `signoff`——`pipeline-orchestrator.mjs:220` 的固定尾注白纸黑字写着「**禁代签：人门 signoff 永远真人点**」。于是编排器派出去的 S2 会话：① 被喂的完成动作变成 `gate <slug> S2`（`finishCmdFor` 走 `GATE_STAGES` 分支）；② 它把 plan 写好、缺口判完，跑那条命令**照样 exit 1**；③ 它**没有任何合法手段**让它转绿。编排器随后独立重验也 exit 1 → 台账落 `failed` + `needsHuman`。**S2 从「会话能自己做完的一关」变成「会话必然失败的一关」。**

**唯一的绕法反而制造假信号**：带 `--out-of-order` 能过（exit 0），但会往 `pipeline.json` 永久写一条 `{"stage":"S2","reason":…}`，板上此后长期显 `● ⚠乱序 S2 能力计划`——**一个根本没有乱序的关被永久盖上乱序章**。

**这不是我推理出来的，施工方的测试自己承认了**：`scripts/game-pipeline.test.mjs:578` 与 `:582`，两处 S2 gate CLI 用例**全都要塞 `--out-of-order '测 S2 门'` 才跑得到门**。也就是说「S2 的 gate 撞顺序闸」在写测试时就撞到过，被在夹具里绕过去了，而没有回头看真实调用点（`pipeline-orchestrator.mjs:310`）根本不会传这个旗。

**顺带的副作用**：`verifyStage(S2)` 从**只读**变成**会写盘**——我这次复查跑了几次就在 clone 里给 `public/games/game108/pipeline.json` 写进了 `evidence.S2`（已 `git checkout --` 复位）。编排器的「独立重验」此前对 S1/S2 是无副作用的探测，现在不是了。

**口径已成谎话（读告警项）**：`pipeline-orchestrator.mjs:206`「S1/S2 无机器门 → 以板上机器态转绿为准」、`:302`「S1/S2（无机器门命令）→ `board --json` 重新推导」、`pipeline-orchestrator.test.mjs:223` 用例标题「S1/S2 无 gate 命令 → 重验改用 board --json」——三处全错。**那条测试之所以还绿，是因为它只断言了 S1、一个字没碰 S2**：标题覆盖了 S2，断言没有，于是回归从测试里穿了过去。

**修法（二选一，请 owner/Lead 裁）**
- **A（小）**：`verifyStage` 与 `finishCmdFor` 对 S2 显式走 board 推导（S2 是纯 fs 判词，不需要顺序闸把关）；同步改正上述三处口径，并给 `pipeline-orchestrator.test.mjs:223` 补上 S2 的断言。
- **B（正）**：让 `gate` 的顺序闸对「纯推导型门」（`gap-check`）免检——S2 的语义是「缺口裁决对不对」，与「前置关是否全绿」正交；顺序闸本来就该管重活门（S3/S4/S5/S8）。
无论选哪条，**都要有一条测试锚在「S1 未签 → gate S2 的行为」上**，否则下次照样穿过去。

### P0-2 · `deepTests` 面把两条存量红变成推送硬闸（判据外·未经裁决）

**证据（HEAD 原样跑五条深车道测试）**

```
scripts/manifest-check.test.mjs  → EXIT=0 ·  7s · 3 passed
scripts/acceptance.test.mjs      → EXIT=1 ·  7s · 2 failed | 37 passed  ← game-103 缺 adapter · game102 三剧本
scripts/audit-ratchet.test.mjs   → EXIT=1 ·  1s · 1 failed | 4 passed   ← RATCHET 未 PASS
games/game-g/flow-walk.test.ts   → EXIT=0 · 16s · 1 passed
```

这两条红**与本单无关**（`git diff --name-only 48817307^ HEAD` 对这四个文件为空），是 `REQ-ENGINEAUDIT` 条目里已在案的存量红。但 `scoped-gate.mjs:123` 让它们成了推送门的第一步：

```
$ printf '\n// review probe\n' >> scripts/acceptance-run.mjs
$ node scripts/scoped-gate.mjs --base HEAD --run ; echo GATE_EXIT=$?
[scoped-gate] 计划：deep:acceptance.test.mjs → tsc → vitest:full → build → …
❌ 门禁失败于 deep:acceptance.test.mjs（退出码 1）
GATE_EXIT=1
```

**判：改动方向对（「写了测试没人跑」确实是真病，7s/16s 的时长也确实没拖累无关改动——`facesOf` 只在被测脚本或测试自身被改时才点名，我逐面验过 `src/engine/**`、`games/game-d/**` 均不触发）。但落地方式不对**：把两条**已知红**的慢车道测试直接接成硬闸，没有 `allowExit`、没有棘轮基线、没有先清红。后果是「谁下次碰 `acceptance-run.mjs`/`game-skill-audit.mjs`，谁替存量红买单」——本仓治的就是这种病。

**并且这条改动的归属不对。** 施工方写的是「边界外顺手（**提前声明·非追认**）」。但 `scoped-gate.mjs` 是全库共享的推送门，属 🔴 面；按 CLAUDE.md 的缺口裁决协议，该走「摆 A/B → owner 判」，**声明不等于裁决**，先写了再声明与「先写了代码再补申请」是同一形状。

**修法**：① 先清 `acceptance.test.mjs`/`audit-ratchet.test.mjs` 两条存量红，或给这两项挂棘轮基线（红数不增即过），再接硬闸；② 这条越界改动补一次正式裁决（A 收进本单追认 / B 拆成独立工单），别以「顺手」结账。

### P1-3 · 台账排除出 `gameHash` ⇒ S2 复查记录永不过期，锁可被无痕解开

**证据一（复查 PASS 后偷改台账，S2 仍全绿、S3 锁自解）**

```
起手            : S2=[ok,dim,dim,warn] · S3.blockedBy=["GAP-01"] · hash=43fe62dd…
复查 PASS+签核后: S2=[ok,ok,ok,ok]     · S3.blockedBy=["GAP-01"] · hash=43fe62dd…
                  gate S3 → exit 1（缺口闸拦住·正确）
手改 accepted→delivered（能力并没真交付）:
                  S2=[ok,ok,ok,ok]     · S3.blockedBy=[]        · hash=43fe62dd…（一字未变）
                  gate S3 → 顺序闸放行，真跑了门
```

**证据二（对照组，证明机制确实是指纹）**：改一个**入指纹**的文件（`capability-plan.md`）→ `hashChanged=true`、S2 复查门当场 `stale`。改台账 → `hashChanged=false`、复查门恒 `ok`。

**证据三（fail-open 两态）**

```
② 台账被截断（半截 JSON）: S2=fail · S3.blockedBy=[]  → gate S3 --out-of-order 放行（顺序闸过了，真跑门）
③ 台账被删              : S2=ok   · S3.blockedBy=[]  → gate S3 无需任何旗即放行
```

**判**：施工方的理由「标 `delivered` 不该让 S3/S4/S5 的证据过期」**对**，我不推翻。**但它对 S2 自己不成立**——缺口台账正是 S2 复查门审的那份东西，把它排除出指纹，等于「S2 的复查记录审的是哪一版台账」永远无法机器判定。合起来：**③ 号锁的完整性挂在一个不入指纹、删掉即全清、改一个词即解锁、且全程不亮任何红灯的文件上。**

`--out-of-order` 拦得住诚实的人，拦不住一次 `rm`；而本仓的纪律一向是「跳关可以，但从悄悄跳变记录在案」——这里连案都没有。

**修法（低成本）**：S2 的复查记录不绑 `gameHash`，改绑**台账自身的哈希**（`gapsHash`，无台账时记 `absent`）落进 `pf.reviews.S2`；board 的 S2 复查门比对该值，不等即 `stale`。既不牵连 S3/S4/S5 的证据（施工方的原始诉求保住），又让「改台账 → S2 需重查」成立，顺带把「删台账」变成一次可见的过期而不是静默全清。

### P1-4 · 端点宽、判门严 —— 面板上的合法操作会落成判门端的「台账不合法」

我直接 `import` 了 `main_entry/projects.py::_norm_gaps` 做真归一（非手写夹具），把归一结果落盘再跑板/门：

| 面板流程 | 端点 | 判门端 |
|---|---|---|
| **A** owner 判 `accepted`，ticket 留空（端点 `projects.py:68-72` 明确允许空串） | `ok=True` 收下并落盘 | S2 machine=**fail** ·「`#1(GAP-01) state=accepted 却无 ticket`」· `gate S2` exit 1 |
| **B** 写成 `state:"pending"`（端点 `projects.py:44` 只校验「小写 token」形状） | `ok=True` 收下并落盘 | S2 machine=**fail** ·「`state 非法 "pending"（闭集 open/accepted/in-progress/delivered/wontfix）`」· `gate S2` exit 1 |
| C 全合法（对照） | `ok=True` | S2 machine=ok · `gate S2` exit 0 |

**判：这不是假红——两条红在语义上都站得住**（没有 ticket 的已裁缺口，裁词确实无处可查；`pending` 确实不在闭集内），**判词也是可照做的**（点名到条目 id、给出闭集全文）。但**这是一次可以避免的坏体验，根因在契约分叉的方向**：写入端宽、判定端严，于是「面板一路绿灯完成的操作」在流程板上直接现红。owner 在面板上看到的是自己刚刚正常判完的缺口，板上说「台账不合法」。

补充两点实测：
- **两种非法态都仍然参与锁**：`state:"pending"` 的 P0 条目照样进 `blockedBy`（不在 `GAP_SETTLED` 里），`gate S3` 被缺口闸拦且 `--out-of-order` 不放行。方向上是 fail-closed（好），但「因为一个拼错的状态词而锁死 S3、报错却指向台账合法性」对使用者是两次绕路。
- **可恢复性没有想象中糟**：`projects.py:201-204` 对 `capability-gaps.json` 是**直接覆盖写**（不像 `gdd.md` 有 skip 分支），所以重新 POST 一次整包即可修正，不必手改文件。这一点我一开始怀疑是死锁，实查后不成立，据实记下。

**修法**：单一真相收在端点——把 `_GAP_STATE_RE` 换成与 `GAP_STATES` 逐字相同的五元闭集，并把「`state≠open` 必带非空 ticket」的规则前移到 `_norm_gap`；同时把现有的跨侧对账测试从只对 `route` 扩到对 `state` 闭集与 ticket 规则（现在 `game-pipeline.test.mjs:346` 那条只是写死断言 `GAP_STATES` 等于五元组，**并没有真去对 Python 那头**——R5/R6 能红是 route 那条的功劳，state 那条撤了 Python 侧不会叫）。

### P2 清单

1. **`blocks:['S2']` 自锁**：端点允许 `blocks` 取 S1–S8，实测一条 `P0/blocks:['S2']` 的缺口会把**裁决缺口用的那一关自己**锁死（`open`/`accepted` 均 exit 1，`--out-of-order` 不放行，只有 `delivered`/`wontfix` 解得开）。不是死结但语义打转，无测试覆盖。建议 `blocks` 的合法域收成 `S3–S8`，或对含 S2 的条目给专门判词。
2. **「假绿」措辞不实**：提交信息与 `scoped-gate.test.mjs` 用例标题都写「不带 `ZEROCRAFT_DEEP=1` 跑出来是 `No test files found` 的假绿」，实测是 **exit 1 硬红**。真实风险是 `vitest:full` 静默跳过。按本仓读告警口径应更正。
3. **`armed` 修复零测试**（R9 撤了全绿）：`scoped-gate.test.mjs` 里 `armed` 出现 0 次。日志类修复也该有一条锚。
4. **`evidence.S2` 是死账**：`gate S2` 写入但 `boardFor` 的 S2 分支从不读（`game-pipeline.mjs:371-390` 全程现算）。要么读、要么别写。
5. **「逐字节同旧版」需改口**：board 的 JSON 形状有加性变化（顶层 `gaps`/`gapErrors`、每关 `blockedBy`）。状态语义零回归属实，措辞过头。

---

## 流程账

- **归属**：判据 ①②③ 全落在 `scripts/game-pipeline.mjs`（🔴 主程面·工单已指派），归属正确。**`scripts/scoped-gate.mjs` 的 `deepTests` 面越界**——工单边界原文只写 `scripts/game-pipeline.mjs`，而推送门是全库共享面，属需裁决项。「提前声明·非追认」不是裁决通道；请 owner/Lead 补判 A（追认并入本单，附清红或棘轮方案）/ B（拆独立工单、本单先回退这段）。
- **抢锁**：工单条目 `requests.md:47` 的「②③ 施工主体 = 抢锁 session（本行即锁）」在动手前已改并推，符合抢锁者做的规矩。
- **自陈与实测的差**：Review 导航里的「撤修验红五轮锚点全中」我复跑属实（我扩到九轮，R1–R8 全中，R9 无覆盖）；但「零回归」「更严不更松」两句与 P0-1 的实测冲突，条目需按实修订。
- **本次复查的边界**：全部验证在临时 clone 内完成；主仓自始至终 `git status --porcelain` 为空（另一 session 的 `games/game108/**`、`dokiworld/**` 在途改动一律未碰）。clone 里因 `verifyStage` 副作用产生的 `public/games/game108/pipeline.json` 改动已 `git checkout --` 复位并核对干净。
- **下一步**：P0-1、P0-2 修完后**重跑本报告的 before/after 对拍与 `--base HEAD` 推送门实证**，再交复查；P1-3、P1-4 建议同批处理（两条都是接缝契约，分批修会再撞一次）。
