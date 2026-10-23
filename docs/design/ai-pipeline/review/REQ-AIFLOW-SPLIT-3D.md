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
