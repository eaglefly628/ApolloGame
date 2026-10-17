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
