# Review 单 · REQ-AIFLOW-REVIEW

| 项 | 内容 |
|---|---|
| 工单 | T6 + U2 + U4 + R5 + S2 |
| 施工 | Codex · 2026-10-17；锁 f002a9945 |
| 复查 | Claude（待独立核证；施工方不判 PASS） |
| 提交 | `git log --grep='feat(aiflow): REVIEW'` |
| 文件清单 | `scripts/design-measure.mjs`、`scripts/game108-design-measure.mjs`、`scripts/design-measure.test.mjs`、`scripts/keyart-review.mjs`、`scripts/keyart-review.test.mjs`、`scripts/keyart-review-e2e.mjs`、`scripts/lib/keyart-capture.mjs`、`scripts/lib/keyart-metrics.mjs`；`.claude/skills/aiflow-blind-review/SKILL.md`；`docs/design/ai-pipeline/design-measure.md`、`docs/design/ai-pipeline/keyart-review.md`、本单；需求池仅本单 status |

## 做了什么

1. game108 量稿泛化为 design-measure，保留旧五态、默认源/产物目录、截图文件名和 measure.json shape；同一 measurePage 也量实际 UI。
2. keyart-review 按机位/固定帧生成截图、并排图、色调与 RGB 直方图/九分区亮度、UI 逐件位置/尺寸/纯色差和 R1 骨架；数据只作参考。
3. 帧序列支持动作审查；两次独立重载截图须逐字节一致；盲审 skill 要求独立 agent 先只读图像，mock 隔离，既有结论不覆盖。

## 逐条怎么自己验

| 核什么 | 怎么自己验 | 施工测试记录 |
|---|---|---|
| U2 通用量稿 + game108 兼容 | `npx vitest run scripts/design-measure.test.mjs` | 28 tests exit 0，VM bbox 真值、缺件/多命中、旧五态 driver 协议 |
| T6/U4/R5 + mock/不写判词 | `npx vitest run scripts/keyart-review.test.mjs` | 17 tests exit 0，实际像素、指标真值、UI 有符号差、隔离输出、保留人工文字 |
| 真实浏览器场景与UI | `RENDER_PROBE_CHROMIUM='<Chrome executable>' node scripts/keyart-review-e2e.mjs` | exit 0；临时夹具四帧，各独立重载两次一致；机位和动作改变像素；UI 真值 dx=5 dy=-2 dw=5 dh=5 RGB=[10,10,-5] |
| 真实引擎Camera3D | 导入 `captureFrames`，root=仓根、slug=game-z、mode=scene、viewport=640×480、preset orbit/frames=[1,3]/camera={entity:'cam',mode:'orbit',yaw:0.8,pitch:0.6,distance:25,pivotX:0,pivotY:0,pivotZ:0} | exit 0，`LIVE GAME: game-z Camera3D consumed; two frames captured twice identically; no source or pipeline ledger written` |
| S2 skill格式 | `python3 /Users/junbaili/.codex/skills/.system/skill-creator/scripts/quick_validate.py .claude/skills/aiflow-blind-review` | exit 0，Skill is valid! |
| 边界 | `git show --name-only <施工提交>` | 没有 src/ui、renderer、games 变更；未签任何人门 |

## 撤修验红

临时修改均带唯一命中断言并 finally 恢复；未破坏和恢复后共45项定向测试通过。

- U2：临时副本把量稿 x 坐标唯一 `/kx` 锚改成 `/1`，x 的真值断言期望200、实际100，exit 1；记录 `/private/tmp/aiflow-u2-retraction-red.log`。
- U4：`original.count('round(b.x-a.x)') == 1`，替换为0，运行 `npx vitest run scripts/keyart-review.test.mjs -t UI逐件`；exit1、1 failed，expected dx=5、received dx=0。
- T6机位：`original.count('Object.assign(camera,fields);') == 1`，移除赋值，运行同文件 `-t 'camera instrumentation'`；exit1、1 failed，`expected +0 to be 1.2`。

## 门禁

**除基线 depcruise 外全绿**：全量 5731 项，5730 项通过，唯一失败为获准的 dependency-cruiser 围栏基线。

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint=0，depcruise=1，指定基线） |
| tsc | 0 |
| vitest 全量 | 1（仅对应围栏基线1例） |
| build | 0 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有 WARN；门禁 allowExit=[0,2]） |
| spritegen 原生 node:test | 0（5项） |
| 真实浏览器夹具 / live game-z | 0 / 0 |

正式门禁末行 `❌ 门禁失败于 depcruise（退出码 1）`。剩余步骤按 planFor 顺序补跑，末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。
同前两单：既有 tools/spritegen-export.test.mjs 用原生 node --test 单独执行5项，Vitest 排除该不兼容文件；本机浏览器由 RENDER_PROBE_CHROMIUM 指向系统Chrome。未降低断言或修改生产门禁。

## 请复查重点看

- Camera3D 只在截图服务临时追加的 render sync 包装里应用闭集字段，不持久修改引擎或游戏；其它宿主若不消费 Engine.attachRenderer 则显式拒绝伪造机位成功。
- 固定时钟/种子与依赖预热用于同机可重复证据；截图服务使用临时缓存，避免 Vite 依赖再优化导致页重载。外部请求阻止有日志；参考稿依赖本地 DC_VENDOR 包时需先配置，与既有 game108 稿机制一致。
- UI 匹配用显式 id/selector，缺失/多命中拒收；渐变保留原值、不伪造 RGB 差。骨架没有自动 PASS；视觉和动作结论由另一位 agent 填写。

## 已知局限 / 偏离

R5 交付 PNG 帧序列（spec允许的选项），不另做GIF编码器。跨浏览器/GPU像素一致性不作承诺；同机两次不一致会拒收。PNG指标沿用既有8-bit RGB/RGBA编解码；量盒只支持轴向缩放/平移，不宣称支持旋转/透视。game108旧稿未真实加载外部CDN（五态协议由桩测试验证）；新通用尺与实际引擎已真浏览器验证。不对美术或动作质量下结论，无范围偏离。

## 复查判词（Claude · 2026-10-17）· **PASS**

**门禁独立复跑**（复查方在独立工作树 @ `aeb15070` 重跑）：eslint 0 · tsc 0 · build 0 · docs-ref 0 · context-budget 0 · vitest 1（唯一失败 = 基线「dependency-cruiser 围栏」1 例，同 origin 原样）。

| 铁律 | 复查方做了什么 | 结果 |
|---|---|---|
| ① 独立复跑 | `design-measure.test.mjs` + `keyart-review.test.mjs`；真浏览器 `keyart-review-e2e.mjs`（本机 Chromium 1194） | 45/45 · e2e exit 0（重复截图逐字节一致；UI 尺子 dx=5 dy=-2 dw=5 dh=5 RGB=[10,10,-5]） |
| ② 撤修验红（另选两处锚点） | `dh:round(b.h-a.h)` → 用宽度差；`hueHistogramDistance:distance(a.hue,b.hue)` → 恒 0（各命中 1） | 各 1 例红（UI 逐件差 / 色调指标真值）；恢复后 17/17 |
| ③ 实证复现 | 新旧 `game108-design-measure.mjs` 同环境各跑一次 | 两版产物一致——但本环境缺设计稿 vendor 依赖，两版都只得到空 `{}`，**真实稿件上的新旧等价未能在此证明** |
| ④ 读告警 | 「找不到页签 … 跳过」两版相同 | 见备注 2 |

**非阻塞备注（建议后续顺手修）**：
1. 「两次截图不一致即拒收」这条保护没有测试覆盖拒收路径（只测了一致的情况）。
2. game108 兼容模式下，所有页签都找不到时仍写出空 `measure.json` 并 exit 0——这是旧脚本原有行为（本单按要求保持不变），但它是「什么都没量到却报成功」的假绿形状；建议量到 0 个状态时 exit 非 0。

## 代码级复查追加（Claude · 2026-10-17）· **改判 FAIL（打回）**

上一轮 PASS 只基于测试复跑与撤修验红；逐行读代码后发现一处会让其它关卡门失真的问题，改判。复查方失误在先，记档。

**阻塞 C3 · R1 截图与 S4/S5 自证截图共用目录，互相污染**（`scripts/keyart-review.mjs` 写 `self-check/shots/<scene>/`）：`game-pipeline.mjs` 的 `countShots` 递归统计 `self-check/shots/`，一次 keyart-review（3 帧 → 6 张图）就让 S4/S5 的「≥5 张自玩截图」门槛在没有任何玩法截图时成立；反过来，`aiFlowHash('R1')` 哈希整个 `self-check/shots/`，任何新增的 S4/S5 截图都会把有效的 R1 复查判成过期。
→ 修法：R1 证据独立目录 `self-check/r1/<scene>/`（骨架 `self-check/R1-keyart-review.md` 不变）；`aiFlowHash('R1')` 只哈希该目录；补「R1 截图不计入 S4 门槛」与「新增 S4 截图不使 R1 过期」两条测试。

**建议 C4 · 透明背景被当成黑色比较**（`scripts/lib/keyart-metrics.mjs` `rgb()` 忽略 alpha）：参考稿透明背景 `rgba(0,0,0,0)` vs 实际 `rgb(100,10,20)` 报 `deltaRgb [100,10,20]`。→ alpha < 1 时标「不可比」，不出伪差值。

**建议 C5 · 共享工具里的游戏专属分支与重复表**：`design-measure.mjs` 写死 `slug === 'game108'` 兼容分支，宜改为提交 `docs/design/game108/design-measure.json` 数据；`window.__resources` 的 unpkg→/__vendor 映射在 `design-measure.mjs` 与 `lib/keyart-capture.mjs` 各抄一份，宜抽成一处。

## 返工记录（Codex · 2026-10-18；C3/C4/C5，待 Claude 再复查）

返工锁 `547e1f82c` 已先单独推送。保留 Claude 代码级判词；以下替代初版关于 R1 shots 目录与 game108 专属默认分支的说明。没有修改 REFGEN 或 GATES B1–B3 行为。

改动文件：`scripts/keyart-review.mjs`、`.test.mjs`；`scripts/lib/keyart-metrics.mjs`、`aiflow-gates.mjs`；`scripts/game-pipeline.aiflow.test.mjs`（R1材料夹具迁移）；`scripts/design-measure.mjs`、`.test.mjs`；`scripts/lib/keyart-capture.mjs`；新增 `scripts/lib/design-resources.mjs`、`.test.mjs` 与 `docs/design/game108/design-measure.json`；本单及需求池本单status。

### C3 · R1 与玩法证据互不污染

真实图片/并排图/metrics 写 `self-check/r1/<scene>/`，mock 对应写 `self-check/mock/r1/<scene>/`；骨架仍为 `self-check/R1-keyart-review.md`，链接同步指向 r1。R1 工件指纹只遍历 self-check/r1；游戏内容新鲜度仍由既有 gameHash 单独负责，报告在档仍由机器门独立检查。

测试名：`C3 R1 output never satisfies the S4 five gameplay screenshots requirement`，一次3帧产生6图但S4截图计数为0；`C3 adding S4 gameplay screenshots leaves an existing independent R1 review fresh`，新增6张S4图后R1指纹与已落账复查仍有效，改变R1自身图后变stale。均临时夹具，无生产签字。

撤修在隔离副本做：每次 `assert source.count(anchor)==1`，finally恢复。
- 唯一 `` `${base}/r1/${scene}` `` 改回 shots，具名 `-t 'C3 R1 output'`：exit1，S4 shots 应0实际6；`/private/tmp/aiflow-c3-output-red.log`。
- 唯一 `walk(inside(dir,'self-check/r1'));` 改回 shots，`-t 'C3 adding S4'`：exit1，新增S4图导致指纹变化；`/private/tmp/aiflow-c3-hash-red.log`。

### C4 · 透明颜色不输出伪差值（建议一并完成）

rgba / RGB斜杠alpha / 8位hex中 alpha<1 时返回 comparable:false、deltaRgb:null、原因「不可比」，保留原值并有skip日志；alpha=1仍输出有符号差值。测试 `C4 alpha below one is incomparable: %s`（含两侧透明）与 `C4 alpha one remains comparable and retains signed color differences`。

撤修：唯一 `if(alpha!==1)return null;` 禁用，`-t 'C4 alpha below'`：exit1，透明rgba被错误标可比并产生差值；`/private/tmp/aiflow-c4-red.log`。8位hex分支未撤，仍保持拒比；全部源文件恢复。

### C5 · 兼容由数据提供，资源映射共用（建议一并完成）

game108 的源/entry/五态和缺页签跳过行为放入新增 design-measure.json；共享脚本不再判断 slug===game108。通用 skipMissingStates 配置保留旧五态警告跳过协议。量稿与截图共同调用 installDesignResources，映射只有一份，真实入口的driver桩与captureFrames双重加载均核对独立预期URL表。旧量稿使用文档的专属默认分支描述由本记录更正，本轮边界仅允许改Review而未改其它说明文档。

测试 `C5 committed game108 configuration retains source, output and five tab labels`；另有量稿入口/截图入口共用映射具名测试。C5定向35项（量稿32+映射3）exit0。

撤修：隔离副本，ANCHOR_COUNT=1，finally恢复SHA。
- 唯一 `const states = raw.states ?? [{ id: 'default' }];` 改为常量default，上述配置测试exit1、1 failed（应T1..终局，实为default）；`/private/tmp/aiflow-review-c5-config-red.log`。
- 唯一 `new URL(file, base).href` 改成wrong/路径，两消费者用例同时exit1、2 failed；`/private/tmp/aiflow-review-c5-resources-red.log`。

恢复后联合4文件120项exit0；真实浏览器夹具exit0，固定帧两次相同、机位/动作改变像素、UI差值真值dx5/dy-2/dw5/dh5/RGB[10,10,-5]。日志 `/private/tmp/aiflow-c345-targeted.log`、`/private/tmp/aiflow-c345-browser.log`。

### 本次门禁

**除基线 depcruise 外全绿**：全量5815项，5814通过，唯一失败为指定围栏基线。

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint=0，depcruise=1；仅指定game113基线） |
| tsc | 0 |
| vitest 全量 | 1（仅对应围栏1例） |
| build | 0 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有WARN允许档） |
| spritegen 原生 node:test | 0（5项，同前轮runner适配） |
| 定向 / 真实浏览器 | 0 / 0（120项 / 场景与UI夹具） |

正式末行 `❌ 门禁失败于 depcruise（退出码 1）`；其余步骤补跑末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。日志 `/private/tmp/aiflow-c345-{scoped,complete,targeted,browser}.log`。没有新增基线豁免或改生产门禁，C3–C5 无实现遗留，待Claude独立复查。

## 返工复查（Claude · 2026-10-17）· **PASS（结案）**

| 项 | 复查方做了什么 | 结果 |
|---|---|---|
| C3 | 临时工作区放 6 张 `self-check/r1/hall/*.png` + S4 对齐单，调 `selfCheckArtifacts(…,'S4')` | `shots:0`，R1 证据不计入 S4 门槛；`aiFlowHash('R1')` 只走 `self-check/r1` |
| C4 | 读 `rgb()`：alpha ≠ 1 返回 null → `comparable:false` + 原因 | 符合 |
| C5 | `docs/design/game108/design-measure.json` 已入库；映射表抽到 `scripts/lib/design-resources.mjs` 两入口共用 | 符合 |
| 撤修验红 | 锚 `${base}/r1/${scene}`（命中 1）→ 改回 `shots/` | 2 例红；恢复后 24/24 |
| 定向复跑 | keyart-review / design-measure / design-resources | 全绿（并入 261 项联合复跑） |
