# 简单上肢动画候选工具复查单

施工主体：当前 Codex motion-semantics-next session。范围为 tools/motion-mink-validation；不修改引擎求解系统、渲染器或正式动作库。

## 行为与边界

以闭集 JSON 配方指定基础动作单帧、左右手目标及轨迹，经米制骨架校准、Mink/MuJoCo 离线求解、原生 GLB 烘焙和独立检查生成本地 draft。入口 run.mjs；Skill 分发源码在 skill/。输出目录必须新建且位于 Git 仓库外；原素材不改，副本不共享 inode。过程记录配方、工具快照与校验；共享引擎依赖未传递冻结。

只支持固定躯干/腿的简单上肢动作；不保留基础动作整段时序，不认证全身平衡。几何通过、AI 视觉核对和用户表意认可分别记录；技术失败不可升为正式素材。旧实验报告保持原判定，新阈值不得追溯改变旧结论。

## 手部尚未完成

宏观表意不证明指骨正确。当前右拇指/食指仍使用宽范围 ball 关节，其他指骨没有完整主动求解；缺逐 Skin 的指骨局部轴、屈伸方向与限位、拇指对掌及指间/指掌/道具接触校准。肘部 hinge 限位报告不能替代手指验收。Skill 要求逐指核对，未校准维持 not-calibrated 或 needs-refinement，不能自动批准或声称该问题已修复。

## 独立复跑

```sh
node node_modules/vitest/vitest.mjs run tools/motion-mink-validation/recipe.test.mjs tools/motion-mink-validation/run.test.mjs tools/motion-mink-validation/review-assets.test.mjs
node node_modules/typescript/bin/tsc -p tools/motion-mink-validation/tsconfig.json
```

使用本机合法素材及 Mink 环境时，按 skill/references/workflow.md 的真实 schema 在仓库外创建配方及全新输出目录运行 run.mjs。技术失败退出 2，执行错误退出 1，通过也只给 candidate-needs-visual-review。不得把当前环境素材或完整实验报告提交。

内部独立复核验证 19 项合成用例；故障探针覆盖工具漂移拒收与技术失败不升主库。外部 Claude 尚未批准本批。真实简单伸手候选完成离线链和独立回放检查，只证明该样例技术可跑；不构成手指、跨 Skin 或所有动作认证。多视角图像对照目前由 Codex 观察，无自动关键点估计器或客观图像评分。


## 实时手部 Socket 交互原型（本轮）

复用 Attach3D、IK3D 和 AnimGraph3D，不修改共享渲染器或新增游戏专用求解器。每个角色独立校准握持框架，加入无蒙皮权重的 Grip/Contact 虚拟骨：左右 Grip Socket、左接触 Socket、右火柴头 Socket。道具随握持 Socket；右端点通过原生双骨 IK 跟随当前左接触 Socket。移动盒子的左链先执行，再求右链。互动 IK 未烘焙到基础 clip。辅助 Socket 位移轨迹必须直接作为内嵌动画播放，不可再次经过会丢弃非髋平移的 humanoid 重定向。

预览的“进入/退出交互”以 Flag 驱动原生动画状态转换，同时启用/释放接触链；移动盒子和关闭 IK 可比较实时响应。暂停切角色采用单次解析的内嵌模型和动画，零速准备首帧后才交给播放控制，防止等待外置动画期间出现空画面。候选失败不隐藏；缺少掌骨的角色仅提供基础播放。

完整本地试验 108 个角色：72 个端点检查通过，26 个端点不可达或链拒收，10 个缺掌骨无法校准。通过仅限采样端点、激活和可达性，不认证手指、抓握、身体穿插、道具朝向或任意交互。来源候选原技术失败保留；用户接受的是简单手部动作的表意方向。头部跟随属于运行时 Head look-at，非眼球控制、非烘焙。所有角色/动作/纹理/实测报告均不入 Git。

新增独立复跑入口：

```sh
node node_modules/vitest/vitest.mjs run tools/motion-mink-validation
node node_modules/typescript/bin/tsc --noEmit -p tools/motion-mink-validation/tsconfig.json
python3 -m unittest discover -s tools/motion-mink-validation -p '*_test.py'
```

真实运行命令和闭集参数见 skill/references/workflow.md；socket-runtime-run.mjs 支持 --skins all 或精确角色 ID。失败退出 2，源素材不变，不因端点通过自动入正式库。请独立复跑和撤修验红；本轮外部 review 尚未完成。

## 独立复查判词（Claude · 2026-10-29）

**FAIL（1 条 P2，可移植性），其余全部通过。** 目标 head `058ffd6aa592a6d1519ce6c4450ed08adb9e2047`；范围 = 来源语义后续 `f75e1dd9` / `1f4b3e9a` / `a39aa8c2` + Mink / Socket / 工作台 `5c3892f2` / `1c8ab9d8` / `058ffd6a`（`5f30bdf5` 为他线文档锁，不在范围）。复查人未参与施工；Linux 云端隔离 worktree 执行，`package.json` / 锁文件在 base 与 head 间无变化，故以既有依赖链接等价 `npm ci`；结束后 worktree 与临时目录均已移除。之前对 `1b87a04d` 的 PASS 不扩大到本批。

### MK1（P2）：三个测试文件写死 macOS 专有路径 `/private/tmp`，在 Linux / CI / 云端必红

- 位置：`scripts/motion-semantic-query.test.mjs:9`（`a39aa8c2`）、`tools/motion-mink-validation/run.test.mjs:7–8` 与 `tools/motion-mink-validation/review-assets.test.mjs:7`（`5c3892f2`），均为 `mkdtempSync('/private/tmp/…')`。
- 最小复现（Linux，无 `/private/tmp`）：交接单给的定向命令 → **22 文件中 3 个失败、16 / 219 例失败**，全部为 `Error: ENOENT: no such file or directory, mkdtemp '/private/tmp/…'`。
- 交接单写明「Linux/POSIX Python3 支持」，而这三处使测试只在 macOS 能跑；任何非 Mac 的门禁都会红。
- 修复归属：施工方。改用 `realpathSync(tmpdir())`（保留 macOS `/var → /private/var` 别名被规范化的原意）下的 `mkdtempSync`；修后在 Linux 重跑这三个文件即可复核。复查不代修。
- 旁证：仓库里另有若干非测试脚本把 `/private/tmp` 作缺省参数（如 `scripts/verify-*-browser.mjs`、`scripts/*.integration.mjs`），不在本批范围，不计入本判词。

### 其余验收（为看清逻辑，我临时建了真实目录 `/private/tmp`，不用符号链接以免干扰「拒绝别名」测试；复查后已删除）

- **独立复跑**：定向 22 文件 **219 / 219**；三个工具 `tsc --noEmit`（mink-validation / workbench / preview）均 exit 0；Python `unittest` 3 例 OK（本机无 mink / mujoco，真实求解未跑，只验合成接触测试）。全量门禁 `RENDER_PROBE_CHROMIUM=<容器 Chromium> node scripts/scoped-gate.mjs --run --base 5ae0ee47…`：scope=full **exit 0**，717 文件，**7910 通过 / 2 跳过**。
- **撤修验红（5 处，均为我自选、命中 = 1、恢复后 cmp 一致）**：

| 锚点 | 撤法 | 红灯 |
|---|---|---|
| `run.mjs` 祖先目录 `.git` 检查 | 删除 | `refuses any repository and symlink alias…` |
| `socket-runtime.mjs` 动态左链顺序 `[leftMoverChain, rightChain]` | 对调为右先左后 | `changes the box live through a left external-target IK chain…` |
| `catalog.mjs` `if(status==='fail')return 'failed';` | 删除 | 3 例（失败不得显示为 ready 等） |
| `server.mjs` 初始化后四个输入 SHA 复核 | 删除 | `refuses startup when a catalog or either evidence snapshot changes…` |
| `catalog.mjs` 运行时 Skin SHA 绑定检查 | 删除 | `rejects stale identity bindings/duplicates…` |

- **按审查重点逐项读码**：
  - 来源说明与生成意图分离：派生条目 `description=null`、意图单列 `intent`，基础动作标签降为 `base-reference`。✅
  - 原始 SHA 绑定：Skin / 片段 SHA 不符直接抛错，`identityBound` 不成立时 pass 降为 unknown。✅
  - 失败不升 ready：`ready` 只给「库动作 + 资产 confirmed + 无失败证据」；候选流程通过也只到 `candidate-needs-visual-review`，失败为 `candidate-rejected-technical`；查询时再次重算状态。✅
  - 直接内嵌 Socket 动画：校验阶段直接播内嵌片段，不再经 humanoid 重定向（重定向只传髋位移，会丢 Socket 平移，注释写明）。✅
  - 左链先于右链：动态模式链序为左先右后（撤修已证）。✅
  - 输出隔离：拒绝别名、任一祖先含 `.git`、项目内、已存在目录。✅
  - 本机服务：只监听 `127.0.0.1`、只接受 GET / HEAD、分页与过滤参数严格校验，资产走既有 SHA 校验的预览处理器。✅
- **语义后续实测**：我上轮报告的漏 / 误标中，`Nobody walks`、复数 `push ups`、`Receiving a … kick`、`At this point` 已修正。

### 非阻断观察

- **本机服务未校验 Host 头**：只监听回环地址，但无 Host 校验时，恶意网页理论上可借 DNS 重绑定读到目录 JSON（只读、不含凭据）。建议加 Host 白名单（`127.0.0.1:<port>` / `localhost:<port>`），成本一行。
- **草稿侧车的设计分量偏重**：238 行 Python 目录描述符事务 + 文件锁，用于单用户本机的「标签草稿」文件，且为 JS 工具链引入 Python 依赖。实现严谨、局限写得诚实，但维护成本高于收益；后续若扩展，建议先评估能否改为 Node 单进程「临时文件 + 原子替换」。
- 真实 2445 动作 × 108 Skin、72 / 26 / 10 端点结果、手指 / 抓握 / 穿插与表意，云端均无素材，**未复验**。


### 施工方 MK1 修复交回（2026-10-29，待独立复核）

仅修复上述三个合成测试的临时目录创建：统一使用 `join(realpathSync(tmpdir()), prefix)`，保留 macOS 临时目录别名规范化，同时不依赖 `/private/tmp`。生产工具、求解、素材和原判词均未改；Host 白名单与侧车架构观察仍保留。本机按自定义规范临时根复跑三文件17项（实际16个临时目录创建）与完整门禁，结果见此次交接；不能替代 Cloud 在无 `/private/tmp` 的 Linux 上独立复跑。


非阻断 Host 观察的处置：三个本机预览入口现校验 Host，仅接受 `127.0.0.1`/`localhost` 与实际监听端口；工作台内部转发沿用已检查的外层端口。新增合成 HTTP 测试覆盖外域 Host、错端口、独立预览和嵌套资源拒收。仍不把只读本机服务当作对外发布的认证服务。待 Cloud 独立复核，原 FAIL 不改。


修复批实证（施工记录，不是新独立判词）：三文件在自定义规范 TMPDIR 下17项通过，独立拦截确认16次目录创建全走该根且清理无残留；macOS实测，未伪称Linux通过。Host相关六文件28项和独立Mink HTTP 25条断言通过。完整门禁首轮在既有 `motion-library.test.mjs` 的真实子进程5000ms重试断言失败1例；单文件60项通过后，以两worker降低负载复跑，不改断言或超时，最终719文件、7914通过、2跳过，scope=full退出0。既有构建分块体积、game-a/game-c美术台账缺文件WARN及happy-dom AbortError日志保留。

## 逐行补审与 MK1 复核（Claude · 2026-10-30）

owner 追问「代码是否都看过」。上一轮判词只逐行读了审查重点涉及的约四成文件，其余靠测试、撤修与门禁间接覆盖。本轮把 `058ffd6a` 批次剩余文件全部逐行读完，并复核修复提交 `2eac57e6`。

### MK1 复核：PASS

- `2eac57e6` 三个测试改为 `mkdtempSync(join(realpathSync(tmpdir()), …))`。在**不存在 `/private/tmp`** 的 Linux 上重跑定向 24 文件 **227 / 227** 通过。
- 同提交新增 Host 白名单 `scripts/lib/local-preview-host.mjs`（只认 `127.0.0.1` / `localhost` 加实际监听端口；嵌套处理器依赖外层校验），三个预览服务均已接入。撤修验红：删掉工作台的 Host 检查 → `rejects foreign Host names before serving workbench or nested assets` 变红，恢复后绿。
- 全量门禁 `--base 058ffd6a`：**7913 通过，1 失败**，失败项不在本批，见文末「另报」。

### 逐行补审发现

| # | 级别 | 位置 | 问题 | 复现 / 依据 | 建议 |
|---|---|---|---|---|---|
| Q1 | **P2（接 M4 前必修）** | `scripts/lib/motion-semantic-query.mjs`（`a39aa8c2`） | 默认 `strict=true` 下，任何 `forbidden` 约束都会让候选全被排除。标签来自文字，永远无法证明「没有」，所以 forbidden 只能是 conflict 或 unknown，而 strict 把 unknown 一律排除 | 合成目录 walk / run，查询「要 walk、禁 run」，默认模式 → `candidates: []`、`missingRequirements: []`、walk 被判 `strict-unknown`。调用方看到「什么都不缺、却一个都没有」 | strict 只作用于 required；forbidden 的 unknown 不排除，或强制调用方显式选择。现有测试只覆盖 `strict:false`，需补默认模式用例 |
| Q2 | P3 | 草稿日志（`motion-semantic-drafts-validate.mjs`） | 日志头绑定目录 SHA，目录任何变动（新增一个动作）后整份日志读不出（`head catalog changed`），无迁移路径 | 读码 | 正式让人工审核写入前，先定「目录升级时如何迁移草稿」 |
| Q3 | P3 | `tools/motion-mink-validation/export.mjs:181` | 仓库隔离只判断路径字符串是否含 `/ApolloGame/`；克隆或 worktree 改名就失效。`bake.mjs` 无输出校验，依赖 `run.mjs` 先校验 | 读码 | 独立入口复用 `validateCandidateOutput` |
| Q4 | P3 | `tools/motion-mink-validation/socket-run.mjs` | 按角色显示名 `find` 取第一个，同名角色静默取第一个；本机库确有重复的 Amy。新的 `socket-runtime-run.mjs` 已报「名字有歧义」，旧的没跟上 | 读码 | 与 `selectRuntimeSkins` 统一 |
| Q5 | P3 | `recipe.mjs` `motionRecipeSha` | 用普通 `JSON.stringify`，同一配方键顺序不同 → SHA 与候选 ID 不同 | 读码 | 用规范化序列化（仓库已有 canonical 实现） |
| Q6 | P3 | `tools/motion-mink-validation/preview.ts:50` | 窗口跨过列数断点时整页 `location.reload()`，丢失选中项与播放位置 | 读码 | 布局改响应式，不重载 |
| Q7 | P3 | `export.mjs` | 无配方时写死回落到 Y Bot / `texting-119350901` | 读码 | 无配方即报错 |

### 逐行读过、未发现问题的部分

`socket-attach.mjs`（Socket 骨插入只追加、原二进制前缀不变；握点按掌型比例映射、道具保持米制尺寸；回放复核含帧间采样）、`socket-frames.mjs`、`socket-runtime-run.mjs`（失败保留并单列、源技术状态不被覆盖、名字歧义报错、ID 截断不超 120）、`bake.mjs`（桥接误差阈值 1e-5、输出排他写）、`review-assets.mjs`（目标复核 SHA，防篡改）、`contact.py` / `check.py`（皮肤穿插取保守下界；接触必需却无样本时判失败；平滑曲线与 `contact.py` 一致）、`solve.py`（无随机、输出排他写；本机无 mink / mujoco 未运行）、工作台前端 `client.ts` 与预览 `preview.ts` / `runtime-controls.ts` / `paused-frame.ts`（全部 LayoutNode、文字经 `Label` 无注入、换角色用代次计数丢弃过期加载、暂停时交互被拦）、`motion-semantic-drafts.mjs`、`motion-semantic-query.mjs` 的路径部分（`id` 闭集 `[a-z0-9-]`，无穿越；候选读文件前拒符号链接并核 SHA）。

### 本批最终结论

**PASS（附条件）**：MK1 已修复并复核；Q1 不阻断本批（影子查询未接线），但**接入 M4 前必须修复并补默认模式测试**；Q2–Q7 为 P3，随后续批次处理。真实素材相关结论仍未复验。

### 另报（不属本批）：主干在 Linux 上全量门禁为红

`tools/asset-vault/vault.test.mjs`（`666e4476`，资产保管库）中 `test_casefold_and_unicode_normalization_collisions_refused` 在 Linux 失败：macOS 文件系统会把 `é` 与 `é` 归一成一个文件，该用例被跳过；Linux 上两个文件并存，保管库先以「source name must already be NFC」拒绝（行为正确），而测试只接受「collision」字样。建议施工方让断言同时接受两种拒绝原因。该提交未交我复查，此处只报告。


## Q1 与保管库跨平台断言返工（2026-10-30）

施工主体：当前 Codex motion-semantics-next session。状态：施工中，独立复核待进行。
范围：影子查询 strict 仅约束 required；forbidden 未知保留 unknown 和人工确认，明确冲突继续排除。补默认/显式严格模式反例。保管库仅修正测试平台假设，不放宽生产拒收。Q2–Q7 不在本次修改范围。
