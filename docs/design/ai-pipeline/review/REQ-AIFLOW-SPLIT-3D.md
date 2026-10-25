# Review 单 · REQ-AIFLOW-SPLIT-3D

| 项 | 内容 |
|---|---|
| 工单 | REQ-AIFLOW-SPLIT-3D；既有拆层能力扩写（G3） |
| 施工 | Codex；2026-10-23 抢锁；锁提交 `e61c3cc4b` |
| 复查 | **Claude，待独立复查**；本单无施工方 PASS 判词 |
| 实现提交 | 见 `git log --oneline --grep='feat(aiflow): type split assets'` |
| 改动面 | `scripts/asset-split.mjs`、`scripts/asset-split.test.mjs`、`.claude/skills/aiflow-split/SKILL.md`、`docs/design/ai-pipeline/asset-split.md`、本 Review、`docs/workflow/requests.md` 本单锁 / status |

## 一、做了什么

拆层行可选 `asset:'sprite'|'model3d'`，缺省 sprite，显式非法类型拒收。生成行将该字段投影到台账 kind；build 行记 skip 并留给搭建 / 切图，不参与批量生成。保留现有 C1/C8 所有权合并、撤回和编号语义；文档同步类型 / 路线的区别，不改 Blender、供应商选择器或游戏。

已有能力检查：`art-replace.mjs::provFor / genRowAsset / batchGenerate` 已会按 model3d 选择 Tripo / Meshy 并产 GLB；`blender-job.mjs::checkSplit` 已要求 build 使用 primitive。因此只补拆层数据的缺口，不新增建模或路由系统；G1/G2（GAP-628-04/05）未动。

## 二、请逐条自己验

先跑（离线、无需 API key）：

```bash
TMPDIR=/private/tmp npx vitest run scripts/asset-split.test.mjs scripts/art-replace.test.mjs scripts/blender-job.test.mjs --maxWorkers=4 --minWorkers=1
node scripts/scoped-gate.mjs --run
```

| # | 怎么自己验（测试名位于 asset-split.test.mjs） | 施工方实际结果 |
|---|---|---|
| 1 | `SPLIT-3D accepts optional asset=%s without mutating input` + `rejects explicitly invalid asset %j` | 两个闭集值可用，输入不变；null / 显式 undefined / 空串 / mesh / 对象 / 数组拒收并报日志；字段省略正常 |
| 2 | `SPLIT-3D model3d prop reaches Tripo batch as mock GLB while legacy sprite stays 2D` | 道具 generate 与人物 character 为 model3d；实际 batchGenerate 显式 provider:tripo、mock:true，两行 gen.provider=tripo、后缀.glb、磁盘文件头 glTF；同批 sprite 仍为 qwen PNG |
| 3 | `SPLIT-3D build rows never create generation entries and log skip even when approved` | sprite / model3d 的 approved build 全部不入生成台账，磁盘count=0；每行有 `[asset-split] skip: <id> route=build`；仍产标注图和人读清单，输入批准态不变 |
| 4 | `SPLIT-3D rerouting to build withdraws only split ownership and preserves game rows` | 以前的纯拆层行 retired；并入原游戏行的拆层字段摘掉，原编号 / kind / gen / refs / prompt 恢复，原行不退役 |
| 5 | `SPLIT-3D legacy fixture produces byte-identical pre-change ledger and explicit sprite is equivalent` | 使用施工前从原有 fixture 录下的完整 JSON 字面量（不在测试中调用旧推导生成 expected），磁盘 JSON Buffer（排版及末尾换行）逐字节相同；显式 sprite 等价 |
| 6 | `SPLIT-3D conflicting types for one skinKey reject instead of silently generating the wrong asset` | 同槽出图项类型冲突，或显式类型与原游戏台账 kind 冲突，拒收并提示消费槽；不覆写原游戏类型，不生成两行，输入台账不变 |
| 7 | `SPLIT-3D Blender still requires primitive for build even when asset is model3d` + 原 Blender 90例 | build+model3d 的 primitive 可跑 mock 作业；改成有效 GLB input 仍明确拒收 `route=build 与source不符`。没有改 checkSplit 或其安全边界 |
| 8 | 其余原 asset-split / art-replace 用例 | C1双向保护、C8同槽并入 / 撤回 / 幂等 / 保号、mock 隔离均保留 |

定向最终 **3文件209测试通过，exit 0**（split44、art-replace75、Blender90）。新增14例。为补 Blender 接缝用例，首次误用 source.input 路径串，第二次误指向 mock 不会发布的真实输出路径，两次夹具错误都已改为索引1和读取隔离 mock 产物；原日志保留，不冒充产品缺陷或撤修红灯。

## 三、撤修验红记录（施工自证，复查人须另选锚点）

仅在本聊天隔离 clone 操作自己的文件，先对原串唯一命中断言 `count == 1`。每次绿 → 撤 → 真实具名 AssertionError → 精确恢复 → 绿，未用编译错误、超时或缺 Chrome 当红灯。

| 锚点与撤法 | 对应测试与真实红灯输出 | 退出码 |
|---|---|---|
| `kind: row.asset ?? 'sprite'` → `kind: 'sprite'`，hit=1 | `model3d prop reaches Tripo batch ...`：`expected ['sprite','sprite','sprite'] to deeply equal ['model3d','sprite','model3d']` | 0 → **1** → 0 |
| 整行 `if (row.route === 'build') { console.info(...); continue; }` 删除，hit=1 | `build rows never create generation entries ...`：`expected [{ no:'art-01', … }, …] to deeply equal []`，误进2行 | 0 → **1** → 0 |

两次恢复的 `scripts/asset-split.mjs` SHA256 都是 `74c226aeb3c4eaad864585a689f8c67ca468b08f783d97f4cf71662c0e9a0c49`。撤修前后整个 tracked diff 逐字节相同；原地恢复后重新跑过具名测试。完整锚点串、命令、红灯与恢复日志在下方 `withdraw-summary.json`。

## 四、请重点复查的取舍 / 已知局限

- asset 管类型、route 管生产路线。一个 skinKey 不能同时要求 sprite 和 model3d；已有游戏台账持有自己的 kind，显式矛盾时拒收而不把消费槽默默改类型。未声明 asset 的旧单仍沿旧行为保留游戏行，避免破坏 C8；新3D单应显式声明且使用真实 Model3D 槽。
- 旧 approved build 行误入台账者会撤出活跃生成需求；这是本单要求的有意行为变化，不承诺旧错误台账字节不变。其它旧 fixture 固定字节不变。历史行仍可能以 retired 保留，非拆层游戏行绝不因此退役。
- 本单不改供应商政策：已有 3D 默认可能为 Meshy；Tripo 验收使用既有显式 provider 覆盖，不把默认 Meshy 偷改为 Tripo。只验证 Mock GLB 容器与选择路径，不证明真实模型几何、贴图或生产质量。
- **真实 Tripo / Auto-Rig Pro / Mixamo 链路未验**；无付费服务请求。Blender 用例为 mock / 假可执行协议测试，不声称新跑真实 Blender 建模。
- 不生成真实游戏资产，不签 D1 / K2 / R1，施工方不对本单作复查判词。

## 五、门禁与证据

2026-10-23 在宿主授权环境实际执行 `node scripts/scoped-gate.mjs --run`，scope=full；真实 Chrome 路径显式传入，原 sandbox 标识保留，没有改门禁范围。共享依赖仅以逐包链接引用，自己的 node_modules/.vite 缓存隔离，不写共享工作区。

| 步骤 | 退出码 |
|---|---|
| eslint | 0 |
| depcruise | 0（1474模块 / 5317依赖，无违规） |
| tsc | 0 |
| vitest:full | 0（673文件 / **7268测试通过**） |
| build | 0 |
| docs-ref | 0 |
| context-budget | 0 |
| art-ledger-guard | **2**（门禁允许的旧WARN：黑户5 / 死账2 / 缺来源0） |
| **scoped-gate 总退出码** | **0** |

末行：`✅ 门禁全绿（scope=full）`。定向测试 exit0；锁行提交前文档门禁 docs-ref=0、context-budget=0、art-ledger=2、总0。

完整 stderr 的233块 /225去重行已读，和 DSYNC 固定版全量日志比：唯一 topological-sort 仍是 system-graph.test 的 `[L,P]` 负例 fixture，原文相同，无新增环、无 Unhandled。新增 asset 类型非法 / 同槽冲突拒收是本单新增负例；字段列表告警更新为可选 asset；PNG格式 / 20MiB日志差异来自不变的 ai-gen / tripo 负例与临时路径。happy-dom 旧 localhost拒连、build大块提示、game-a / game-c 两张旧缺图都保留，未冒称告警清零。没有修 game113 或其它游戏来过门禁。

施工前后的旧夹具台账均581字节，已另存 `legacy-before.json` / `legacy-after.json` 并实比相同；源码、既有 REFGEN / STYLE / DSYNC / RB / art-replace 与 G1/G2 相关文档共9个受保护文件 SHA 与开工前相同。

证据根（本机持久目录）：
`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/review-trio-split3d-20261023/split-3d/`：`targeted.log`、`targeted.exit`、`withdraw-summary.json`、`W1-asset-kind-*.log`、`W2-build-skip-*.log`、`scoped-gate-full.log`、`scoped-gate-full.exit`、`scoped-gate-exit.json`、`warning-audit.json`、`warning-messages.txt`、`legacy-comparison.json`。

## 独立复查判词（Claude · 2026-10-24）

**FAIL（1 条 P2），退 Codex 返工。** 其余验收全部复现通过。固定审查 `2c9dae03`，在隔离 worktree 内跑，共享依赖只读链接，未改产品代码；恢复后 worktree clean。

### SP1（P2）：纯拆层行生成后改 asset，类型被静默改写，旧 2D 生成物冒充 3D 已完成

位置 `scripts/asset-split.mjs` `deriveSplitLedger` 纯拆层行合并分支（`merged.push({ ...p, ...f, … status: p.status …, gen: p.gen ?? null })`）。显式类型冲突的拒收只写在「并入游戏行」分支（`explicit.asset !== p.kind`），纯拆层行没有同等保护。

最小复现（隔离 worktree 内临时测试，跑完即删）：
1. `deriveSplitLedger([row()], 'example')`，得 sprite 行；把它置 `status:'filled'`、`gen:{servedPath:'games/example/art/lamp.png', provider:'qwen'}`（即已出过 2D 图）。
2. 同一行改 `asset:'model3d'` 再推导，传入上一步台账。
3. 实得：`{"kind":"model3d", …, "status":"filled", "gen":{"servedPath":"games/example/art/lamp.png","provider":"qwen"}}`，**没有拒收，也没有任何日志**。

后果：`batchGenerate` 跳过 filled 行，该 3D 槽永远拿着一张 PNG，台账却显示「已完成」。这违背本单文档自己写的不变量（「一个出图槽的 asset 必须一致……显式矛盾时拒收」「不把消费槽默默改类型」）。场景现实：game628 正是 2026-10-22 从 2D 改 3D，先出过 2D 图的拆层行改 asset 就会撞上。

修复归属：Codex，本单范围。纯拆层行 kind 变化时，与游戏行同口径拒收（或显式重置为 needs-art、gen 置 null 并记 transition 日志，二选一，写进文档）。补「生成后改类型」用例并撤修验红。复查不代修。

### 其余验收（独立复跑）

- **定向**：`npx vitest run scripts/asset-split.test.mjs scripts/art-replace.test.mjs scripts/blender-job.test.mjs` → 3 文件 **209/209**，exit 0（与施工自陈一致，但为自跑结果）。
- **全量**：`node scripts/scoped-gate.mjs --base de12c3e8 --run`（scope=full）→ **exit 0**，673 文件 / **7268** 测试，末行 `✅ 门禁全绿（scope=full）`。
- **撤修验红**（避开施工方两个锚点；均先断言原串命中 = 1，撤后真红，恢复后 SHA 相同、exit 0）：

| 锚点 | 撤法 | 红灯 |
|---|---|---|
| `if (explicit && explicit.asset !== p.kind) reject(` | → `if (false) reject(` | exit 1：`SPLIT-3D conflicting types for one skinKey reject instead of silently generating the wrong asset` |
| `if (Object.hasOwn(row, 'asset') && !['sprite', 'model3d'].includes(row.asset))` | → `if (false)` | exit 1：`rejects explicitly invalid asset` null / undefined / "mesh" / "" 等 |

- **实证**：未声明 asset 时并入 model3d 游戏行，保留游戏行 kind，这是文档写明的行为，接受。旧夹具字节不变用的是施工前录下的字面量，不是用实现生成的 expected，接受。
- **读告警**：topological-sort 仍只有 `system-graph` 的 `[L,P]` 负例 fixture；`[blender-job] reject: Blender退出码 …` 均为假可执行文件负例；art-ledger-guard 为既有 WARN。无新增环，无 Unhandled。

### 非阻断观察（不算 FAIL）

- model3d 拆层行的 `spec` 仍是 2D 的 `{w,h,transparent:true}`（来自 bbox），游戏推导的 model3d 行是 `{polyBudget, scale}`。已核 `dialectPrompt` 不读 spec，不影响提示词，只是字段语义不一致。可随 SP1 一并改，也可不改。
- 拆层行带的 `refs`（关键图）在生成路径上无人消费，3D 行只走文生 3D。这不是本单 spec 的范围，已作为新缺口 **GAP-AIFLOW-REFS** 报 owner（`docs/design/ai-pipeline/gap-review-2026-10-24.md` §二）。
- **真实 Tripo / Blender / Auto-Rig Pro / Mixamo 链路未验。**


## 返工记录（Codex · 2026-10-25）

**SP1 已修，待 Claude 独立复查；施工方不判 PASS。** 返工锁 `a5ec52d44` 已先单独推送；基线 Claude 返工/判词提交 `e89b51508441cac15cc0c59a3eeeeb6029e2dc93`。本轮仅改 asset-split 脚本及测试、拆层契约与 skill、本 Review 与本工单 status；未修参考图接缝、G1/G2 或其它游戏。

### 复现与修法

先在未修实现上原样复现 Claude 的输入：sprite 拆层行已 `filled`、`gen.servedPath=games/example/art/lamp.png`；把 asset 改 model3d 后，确实得到 kind:model3d + filled + 原PNG，且无拒收日志。新用例在修前 **7红/2绿**，均真实 AssertionError，原输出已保存。

选择 Review 允许的**拒收**方案：纯拆层来源行只要原台账含 kind，重推导的 kind 不同就 `[asset-split] reject` 并抛错；在修改状态、生成物、历史或落盘前停止。双向 sprite↔model3d 都一致，needs-art / filled / retired 都拒收；省略 asset 仍按 sprite 参与比较，不能让 model3d 静默降级。已有游戏行的保护与 C8 所有权策略不变，历史不含 kind 的部分旧台账仍按既有逻辑合并。

这是类型不变量修复，不提供自动重置或迁移工具。真正改消费类型时需由游戏制作者落实新的真实消费槽、新 skinKey 后重新登记，旧行按既有撤回机制停用。没有清空旧生成物、偷偷把已有资产标成待做，也没有替 owner 改游戏。

### 怎么自己验

```sh
TMPDIR=/private/tmp npx vitest run scripts/asset-split.test.mjs scripts/art-replace.test.mjs scripts/blender-job.test.mjs --maxWorkers=3 --minWorkers=1
node scripts/scoped-gate.mjs --run
```

| 测试名（asset-split.test.mjs） | 断言 / 最终施工自证 |
|---|---|
| `SP1 refuses pure split kind changes %s -> %s even when status=%s`（6例） | sprite/model3d 双向 × filled/needs-art/retired；明确拒收，含原/新类型与 art 编号的日志；输入台账 JSON 不变 |
| `SP1 same-kind %s refresh retains approved asset and history without mutation`（2例） | 同类型可更新 refs，保留 approved、gen、provenance、history；输入不变 |
| `SP1 legacy partial split row without kind keeps previous merge behavior` | 旧无 kind 行仍能保号、保生成物 / 状态并刷新拆层来源，不误伤旧单 |
| `SP1 workspace type change rejects before disk output and preserves the prior ledger bytes` | 真实临时工作区调用拒收，磁盘台账 Buffer 不变，未写标注 PNG / 人读清单 |
| 原有 SPLIT-3D / C1 / C8 / Tripo Mock / Blender 测试 | 原209项通过；新10项通过，总 **3文件219/219，exit0** |

### 两处撤修验红（均先断言唯一命中1，复查请另选）

| 锚点 / 撤法 | 真实红灯 | 恢复 |
|---|---|---|
| `p.kind !== f.kind` → `false` | 6个类型变更用例 exit1：`AssertionError: expected [Function] to throw an error`；重新允许 PNG 冒充完成模型 | 0→1→0 |
| `Object.hasOwn(p, 'kind')` → `true` | 旧无 kind 用例 exit1：`expected [Function] to not throw an error but Error: art-19 ... kind=undefined ... was thrown` | 0→1→0 |

恢复源码 SHA256 两次均 `3d505fac8a3f41687f59fda91bf277b71dbbf475118cc756a9eddd3a007f706e`；撤修前后整个 tracked diff 原样，未动别人文件。两次红均具名行为断言，不用编译错误或环境失败代替。

### 门禁与告警

宿主授权、canonical TMPDIR、真实Chrome显式路径下，实际执行 `node scripts/scoped-gate.mjs --run`（原 sandbox 标记保留，缓存隔离在自己的 clone）。scope=full，总 **exit0**；**673文件 /7304测试通过**（Claude返工基线7294 + 本轮10）。eslint、depcruise、tsc、vitest:full、build、docs-ref、context-budget 各 **0**；art-ledger-guard **2**（门禁允许的旧黑户5 /死账2 /缺来源0）。末行 `✅ 门禁全绿（scope=full）`。

242个stderr块与同基线ST1完整门禁234块对账：新增仅本单双向类型冲突负例的reject诊断，以及既有happy-dom卸载stack中的runNextTicks一行。唯一topological-sort仍是既有 `[L,P]` fixture，原文未变；无Unhandled汇总。保留旧大chunk、台账缺图与happy-dom告警，不声称警告归零、不将其作为产品修复。收据 `scoped-gate-full.log` / `.exit`、`scoped-gate-exit.json`、`warning-audit.json`。

证据（本机持久目录）：`/Users/junbaili/.codex/visualizations/2026/10/16/01a1423a-1952-7952-a2c0-8ae2faac621b/rework-review-20261025/split-3d/`，含 `before-reproduction.json`、`before-tests.log`、`targeted-final.log` / `.exit`、`withdraw-summary.json` 与两锚点原文日志。

### 仍在范围外

SP1 不改变 model3d spec 中的 bbox 信息（Claude 已判非阻断），不补 GAP-AIFLOW-REFS、G1/G2 的未裁能力。真实 Tripo / ARP / Mixamo 链路仍未验；已有本地 Blender 自有夹具与真实 GPU 技术验证不能被概括为全是 Mock，也不能替代付费生产链来源验收。未签真人门。
