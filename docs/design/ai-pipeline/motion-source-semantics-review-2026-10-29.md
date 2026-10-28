# M2 / M3 阶段复查：来源分类草稿与全目录预览

施工主体：Codex。最终独立复查：Claude，未签结论。owner 已授权上传阶段代码；真实数据仍只在本机。

## 本批解决的问题

旧预览每组三个动作，类别沿用旧默认值，不能直观浏览完整目录，也无法分辨某个标签是来源文字还是推测。本批复用 LayoutNode VirtualList、Engine、ThreeRenderer 与 AnimGraph3D：完整目录滚动、稳定全库序号、按 ID 选择一个动作，在两个 Skin 上对照；可搜索来源 Description、标题、标签和 ID。行为分组为多标签投影，分组数相加可能超过总数。选择不重置目录滚动，暂停/同动作筛选不重建播放器；加载失败保留错误并允许同动作重试。

## 共享来源契约

入口 `scripts/lib/motion-semantics.mjs`（类型声明 `.d.mts`）。`sourceSemantics(row)` 输出 `version=1`、basis、原 Description、groups、claims、unknownFacets、warnings、`status=draft`。每条 claim 有闭集 facet/value、显示名、原文 quote、start/end 字符索引、source 与 `status=source-derived`。字典版本 `source-description-v1` 单独由模块/索引保存。

Description 优先用 `source.description`；兼容旧目录时只接受带精确 source title 和固定后缀的来源说明封装，不能把自由生成的 descEn 当原始说明。明确行为优先；只有说明缺行为、无否定/受方警告时，标题可补 action，并明确记录 source=title。说明缺失时显示标题降级。原 catalog 的分类、情绪与批准状态不参与自动推断。

闭集覆盖行为、运动项目、施受角色、姿态、身体部位、方向、道具提及及明确情绪/风格。接触、起止姿态、阶段等缺证据就保持未知；无情绪不填 neutral；两帧且标题明确 Pose 的条目单列静态姿势，其上下文不当成移动动作。道具提及不代表握持/必需道具/接触已证实。否定、受击、闪避对方攻击、球类射门、俯卧撑、翻书页、walking stick 与局部肩部滚动有反例测试。

**这是一份确定性文字匹配草稿，不是通用自然语言理解器。** 复杂主体归属、隐喻、时序/并列与隐含接触仍可能漏标或误标；规则覆盖率不等于准确率。完整标签审核、人工修订持久化、标签级批准与 M4 消费升级不在本批实现内，M2 不结案。

## 只读工具与本地验证

```sh
node scripts/motion-classify.mjs --lib ~/ApolloAssets/motion-lib-full-frames
node scripts/motion-classify.mjs --lib ~/ApolloAssets/motion-lib-full-frames --json
node scripts/motion-preview.mjs --lib ~/ApolloAssets/motion-lib-full-frames
```

分类工具只输出 stdout，不写目录或改 catalog。JSON 索引包含字典版本、目录精确字节 SHA、每条动作 ID、GLB/源 FBX SHA、原素材状态与独立草稿标注。若重定向 JSON，只能落到本机资产目录；逐动作输出不能进 Git。预览启动后使用终端给出的本机地址。

本机真实目录读取成功，完整原始说明可恢复，个别说明缺失会显式降级；不上传真实目录、逐动作分类、模型、纹理、截图/视频或本机证据。项目测试只用合成文字与合成目录。

## 复跑与撤修验红导航

```sh
node node_modules/vitest/vitest.mjs run scripts/motion-semantics.test.mjs scripts/motion-classify.test.mjs tools/motion-preview scripts/motion-preview.test.mjs
node node_modules/typescript/bin/tsc -p tools/motion-preview/tsconfig.json
node tools/ui-audit.mjs tools/audits/motion-preview.audit.ts --w 676 --h 900
node tools/ui-audit.mjs tools/audits/motion-preview.audit.ts --w 1280 --h 900
node tools/ui-audit.mjs tools/audits/motion-preview-daylight.audit.ts --w 676 --h 900
node tools/ui-audit.mjs tools/audits/motion-preview-daylight.audit.ts --w 1280 --h 900
node scripts/scoped-gate.mjs --run
```

UI 审计按环境设置已有的 UI_AUDIT_CHROMIUM。亮暗审计均使用合成 2445 行，不依赖真实素材。

请复查人独立运行，再在隔离副本撤修验红，断言确实命中锚点：移除 staticPose 的 action→poseContext 转换，应让静态姿势反例转红；把列表行名重新加随 selectedId 变化的标记，应让真实 mountUI 500 项滚动保持测试转红；移除 failed 时 playbackKey 失效，应让同动作重试测试转红；破坏 CLI approval 不变/只读行为应触发 CLI 证据测试。恢复后再跑绿。不要修改冻结转换器或真实母版。

本批内部独立复核实证发现并修复了语义反例、目录滚动丢失和失败重试；这不是 Claude 最终复查，也不是 2445×108 的视觉验收。真实宽窄窗口和最终门禁结果在施工回报中交代。

## 施工方验证记录（非独立签字）

- 联合针对性回归 7 文件、64 项通过；预览工具 tsc 通过。内部独立复核额外重跑语义反例、失败重试及真实 mountUI 的 2445 行滚动反例。
- 真实本机浏览器：目录显示全量；搜索可区分同名动作；选择 Female 180 Turn 的 ID 与说明一致；两个 Skin 可播放；暂停可用；360 像素窗口的 document 宽度等于 viewport，无横向溢出；默认与 daylight 均真渲染。
- 676/1280 × 默认/亮色四次 UI 审计退出 0，重叠、硬性低对比、边框前提缺失均为 0。审计提示没有华丽件及 house 主题未命中为非阻断启发式：该工具没有卡牌、选关或庆祝场景；实际使用 apolloOnyx/apolloBrocade house 主题，并以主题正文色改善亮色控件可读性，不另写皮肤。
- 初次全量门禁有三个环境失败：未配置本机浏览器路径，以及 macOS /var→/private/var 临时路径导致既有 CLI 主入口判断未执行。在测试进程环境设置 `RENDER_PROBE_CHROMIUM` 为已有浏览器、`TMPDIR=/private/tmp` 后，三个原测试均通过；未修改或跳过原测试。
- 依赖链接 node_modules 是本机既有未跟踪链接。仅在门禁进程设置 core.excludesFile 忽略该链接，不改仓库忽略配置，不提交链接。

全量测试阶段实测：700 个测试文件、7746 项通过，2 项按既有配置跳过；本批不新增跳过项。最终完整门禁 scope=full 退出 0，eslint、depcruise、tsc、全量测试、build 和文档/预算守卫通过。已读存量告警：大 bundle 警告、game-a/game-c 美术文件缺失 WARN（门禁允许退出 2）；不把存量告警描述为零问题。

## 独立复查判词（Claude · 2026-10-29）

**PASS（目标 `1b87a04d5d032b472cd789382a78c79895eb9c75`）。** 接单即开始，复查人未参与施工；在隔离 worktree 检出目标提交执行，结束后已移除。范围只限本提交的 Description 来源草稿与完整目录预览；不是 4077 条语义结论的准确性验收，也不是 2445×108 的视觉验收。

### ① 独立复跑

- `node node_modules/vitest/vitest.mjs run scripts/motion-semantics.test.mjs scripts/motion-classify.test.mjs tools/motion-preview scripts/motion-preview.test.mjs` → 7 文件 **64/64**，exit 0。
- `node node_modules/typescript/bin/tsc -p tools/motion-preview/tsconfig.json` → exit 0。
- UI 审计（本容器 Chromium `/opt/pw-browsers/chromium-1194`）：默认 / daylight × 676 / 1280 共 4 次全部 exit 0，重叠 0、对比硬失败 0、对比警告 0。
- 全量门禁 `node scripts/scoped-gate.mjs --run --base 3b07d6366c01963beb02fcdc1575c91c092a9630`：scope=full，**exit 0**，700 文件，**7746 通过 / 2 跳过**（既有配置），末行 `✅ 门禁全绿（scope=full）`。本环境未出现施工方提到的三项浏览器 / 临时路径环境失败。

### ② 撤修验红（4 处；前 2 处为我自选、后 2 处取自复查单导航；均断言锚点命中 = 1，恢复后 cmp 一致）

| 锚点 | 撤法 | 红灯 |
|---|---|---|
| 否定跳过整句 `if(/\b(?:no\|not\|without…)…/i.test(prefix)) {warnings.push('negated-mention-skipped');continue;}` | 删除 | exit 1：否定反例、标题不压否定、否定后肯定子句 3 例 |
| 标题补位守卫 `&&!warnings.length&&!RECIPIENT.test(text))collect(title,'title',true);` | 去掉两个守卫 | exit 1：`uses a title to supplement absent behavior but not an explicit negation` |
| 静态姿势 `facet:staticPose&&facet==='action'?'poseContext':facet` | 改为 `facet:facet` | exit 1：`never treats a two-frame static pose as moving exercise` |
| 失败重试 `  if(failed)playbackKey='';` | 删除 | exit 1：`retries a failed selection…` 等预览生命周期 3 例 |

### ③ 实证复现

- **CLI 只读**：自造 3 条目录跑真实入口 `node scripts/motion-classify.mjs --lib <临时目录> --json` → exit 0；`catalog.json` 字节 SHA 前后一致，目录内只有原文件；资产原状态 `confirmed` 原样输出，标注一律 `draft`；未知参数 exit 1。
- **语义反例 26 条**（合成文字）：否定、否定后肯定子句、受方、闪避对方攻击、球类射门、步枪射击、翻书页、拐杖、静态姿势、缺说明降级为标题，均与复查单承诺一致；原文切片 `start/end` 与 quote 一致。

### ④ 读告警

topological-sort 只有既有 `[L,P]` fixture 一条；art-ledger-guard 为既有 WARN；与本批相关文件无新增 warn / error / reject 输出。

### 非阻断观察（交给 M2 标签审核，不影响本判词）

确定性文字规则的已知局限，复查单已声明「规则覆盖率不等于准确率」，这些是实测到的具体样例，建议进反例集：
- 误标：`Standing close to a table` → `action:close`；`At this point he waves` → 多出 `action:point`；`Nobody walks here; he dances` → 多出 `action:walk`（`nobody` 不在否定词表）。
- 漏标：复数 `push ups`（`Doing push ups on the floor`）描述侧不命中 `exercise`（正则 `push[ -]?up\b` 不收复数），此时只能靠标题补位；若标题也是复数则归入待分类。`Receiving a strong kick to the stomach` 只得 `role:recipient`，没有 `hit-reaction` 行为（受击行为正则只认 `hit`）。
- 以上均为 `draft`，不影响资产批准状态；正式 M3 写回、标签级批准、M4 新契约接线仍需各自复查，本判词不覆盖。
