# Codex 派工单 · 动画生产线：复查 M1 + 施工 M2–M5（2026-10-27）

> 派工：owner（2026-10-27 M1–M5 全部判 A）。流程图与字段口径：`docs/workflow/motion-production-line.md`；方案与实查：`docs/design/ai-pipeline/motion-library-plan.md`。
> M1 由 Claude 施工，Codex 复查；M2–M5 由 Codex 施工，完工后交 Claude 复查。owner 最后按流程图 §4 自己验收。

## 指令全文

```text
你是 ApolloGame 引擎仓的 Codex。本单两部分：先复查 Claude 施工的 M1（你是复查人），再按顺序施工 M2 → M4 → M5 → M3（每单完工交 Claude 复查）。

【0. 先读】
1. AGENTS.md → CLAUDE.md（施工与复查第 2–4 条；日志基准守则；收工律）
2. docs/workflow/motion-production-line.md（标准骨架、改名表、目录字段与闭集词表、顺序）
3. docs/design/ai-pipeline/motion-library-plan.md
4. docs/design/ai-pipeline/review/REQ-MOTION-M1.md（M1 Review 单：导航不是证据）

【1. 分支与规则】
- 主干 codex/mainbranch，直推不开 PR；推前 fetch、必要时 rebase，按实际改动跑 node scripts/scoped-gate.mjs --run，核退出码（不经管道）。
- 只提交自己的文件；不 stash、不强制重置；复查在隔离副本里跑。
- 开工每一单的第一个动作：把 requests.md 该单「施工主体：待抢锁」改成「施工主体 = Codex（日期·本行即锁）」，单独提交并推送。
- 版权：Mixamo 原件和由它转出的 GLB 只放本机 ~/ApolloAssets/，绝不进仓库；测试一律用自造假骨架 / 假 FBX 夹具。
- 不签人门；真实 Mixamo / Blender / ARP 链路未跑的结论标「真实链路未验」。

【第一部分 · 复查 M1（REQ-MOTION-M1）】
改动：src/renderer/three/skeletal-clips.ts（retargetHumanoidClip、bindSkeletalClip 新可选参数）、src/engine/protocol/components/anim-graph.ts（clips[*].retarget）、src/renderer/three/models.ts（透传）、测试 skeletal-retarget.test.ts 与 model-graphs.test.ts 新用例。
- ① 独立复跑：npx vitest run src/renderer/three/skeletal-retarget.test.ts src/renderer/three/model-graphs.test.ts src/renderer/three/skeletal-clips.test.ts src/engine/protocol/components/anim-graph.test.ts；全量 node scripts/scoped-gate.mjs --run。
- ② 撤修验红：至少两处、与 Review 单不同的锚点，先断言唯一命中。
- ③ 实证复现：重点核（a）不写 retarget 时行为与改动前逐位一致（严格同骨架拒收原样）；（b）「世界空间增量」公式在骨骼 roll 不同的 Skin 上是否正确；（c）只传髋部位移、按髋高缩放是否合理；（d）性能：一个 300 帧、60 骨的动作重定向耗时（buildGraph 时一次性计算，不在每帧）；（e）若本机有 Blender，可把一个真实 Mixamo 动作改名到标准骨架后，在两个身材不同的 Skin 上目视对比。
- ④ 读告警：新增 console.info 决策行每次绑定一条，不应每帧出现。
判词写回 Review 单末尾「独立复查判词（Codex · 日期）」。PASS → requests.md 删除 REQ-MOTION-M1 条目（done 同提交删除）；FAIL → 写最小复现与归属，不代修。

【第二部分 · 施工】

■ M2 · 入库与目录（REQ-MOTION-M2）
- 新 scripts/motion-library.mjs，子命令：
  · ingest --from <mixamo 下载目录> [--lib ~/ApolloAssets/motion-lib]：读 manifest.json 与 FBX；经既有 Blender 无头作业桥（scripts/blender-job.mjs，新增作业类型或复用其校验）把 FBX 转成单 clip、无皮、标准骨架命名的 GLB（改名表见流程图 §2）；GLB 必须通过引擎 snapshotSkeletalGlb / extractSkeletalClip 同口径校验（17 根必备骨、单 clip、帧数 = fps × 时长 + 1）。
  · 自动测量：fps、frames、durationS、loop（首尾姿态差阈值）、rootMotion（髋部位移判 none/forward/turn/vertical）、inPlace。
  · 标签与描述：category / emotion / intensity / contacts / descZh / descEn / tags 由 agent 起草，status 固定 draft；人确认后改 confirmed。工具只校验闭集，不自己编词。
  · skin-ingest：角色 FBX/GLB → 改名 → 骨架校验（必备骨、T-pose、髋高 > 0）→ skins/<id>.glb。
  · validate：整库校验（文件 SHA、闭集、字段齐全、无重复 id），退出码 = 结果。
- catalog.json 字段与闭集词表照流程图 §2；闭集写成可导出常量并有测试钉住。
- 日志：[motion-library] decision / reject / commit；每个跳过或拒收都打 reject。
- 测试：假骨架夹具（不含 Mixamo 内容）覆盖改名、测量、闭集拒收、重复 id、SHA 失配；Blender 用既有假可执行文件协议。至少两处撤修验红。

■ M4 · 匹配（REQ-MOTION-M4）
- 新 scripts/motion-match.mjs "<剧本一拍>" [--emotion x] [--contact y] [--max-duration s] [--top N]：只读 catalog.json，确定性打分（关键词与 descZh/descEn/tags 命中、情绪 / 接触 / 类别过滤、时长约束），同输入同输出，并列按 id 排序；输出候选及得分理由。
- 新 skill .claude/skills/motion-match/SKILL.md：agent 先跑命令拿候选，只能在候选里选；产出 AnimGraph3D clips（含 retarget:'humanoid'）与时间线 flag cue 数据；写明「选这个的理由」供复查。
- 测试：固定小目录夹具，排序确定、过滤正确、无命中时明确返回空并打 reject。

■ M5 · 扩展与 Skin 下载（REQ-MOTION-M5）
- mixamo-fetch：清单项可选 params 覆盖（只允许 Mixamo 详情里已存在的滑杆名，数值范围按详情给的范围校验），同一动作派生多档变体，id 区分；新增 --skins 模式下载带皮角色（T-pose），落 ~/ApolloAssets/mixamo/skins/。不改四条安全行为（仓库内目录拒绝、token 不外泄、节流、401/403/429 停止）。
- motion-library variant <id> --trim a,b | --mirror | --loop-fix：经 Blender 作业派生新条目，derivedFrom 记来源。
- 其它来源（CC0 动捕等）：ingest 支持 --source-kind 与许可字段，许可缺失拒收。
- 测试：假服务 / 假 Blender，覆盖参数越界拒收、变体 derivedFrom、许可缺失拒收。

■ M3 · 预览台（REQ-MOTION-M3·M1 PASS 后再开）
- 新 scripts/motion-preview.mjs：本机起静态页（不上传），读 catalog.json、skins、clips；Skin × 动作网格，按 category / emotion / tags 筛选，点开播放；用引擎同一渲染器与 AnimGraph3D（retarget:'humanoid'），不另写播放逻辑。
- 浏览器验收：Playwright 打开页面，无 pageerror、无外部请求；至少 2 个 Skin × 3 个动作的截图交 Claude 复查。

【完工回复（每单各一份）】
提交哈希、改动面、测试名、撤修验红结果、门禁各步退出码、真实链路是否验过；然后把该单 status 改「施工完·待独立复查（Claude）」并停下等复查。M1 复查的判词与关键复现输出也一并回报。
```
