# Codex 派工单 · AI 协同生产流程 第 1 波（2026-10-16）

> 派工：owner。施工：Codex。复查：Claude（交叉复查·复查人 ≠ 施工人）。
> 本单是 owner 复制给 Codex 的指令全文的存档版，内容与之逐字一致。

## 指令全文

```text
你是 ApolloGame 引擎仓的施工方（Codex）。任务：实现「AI 协同生产流程」第 1 波引擎/工具能力。做完交给 Claude 交叉复查，你不做自我复查、不给自己判 PASS。

【0. 先读（按顺序，读完再动手）】
1. AGENTS.md → CLAUDE.md（项目规则，全部适用；尤其「施工与复查」「推送门禁」「日志基准守则」「缺口裁决协议」）
2. docs/workflow/ai-production-flow.md（新流程图：K1/K2/D1/R1 + §7 设计定稿线）
3. docs/design/ai-pipeline-engine-roadmap-2026-10.md（写死 spec：§1 各项、§3.5 残余缺口、§3.7 施工波次）
4. docs/workflow/requests.md 里的四张工单：REQ-AIFLOW-REFGEN、REQ-AIFLOW-SPLIT、REQ-AIFLOW-REVIEW、REQ-AIFLOW-GATES（工单正文里有「并入 / 同单交付」的追加项，同样是必做范围）
5. docs/design/game108/review/REQ-108-ENG-03.md（Review 单格式样板）

【1. 分支】
- 主干 = codex/mainbranch（claude/mainbranch 已废弃，不读、不推、不合并）。
- 直接在主干上工作，按项目惯例直推、不开 PR：
  git fetch origin codex/mainbranch && git checkout -B codex/mainbranch origin/codex/mainbranch
- 推送：git push -u origin codex/mainbranch。每张工单的提交保持独立，方便复查方按提交区间核。

【2. 抢锁（每张工单开工的第一个动作）】
把该工单标题行里的「施工主体：待 Codex 抢锁」改成「施工主体 = Codex（2026-10-xx 抢锁·本行即锁）」，单独提交并推送一次，然后才写代码。除锁行与完工时的 status 字段外，不改需求池里任何别的内容。

【3. 做什么（严格按顺序，一张一张做完再下一张）】
① REQ-AIFLOW-REFGEN = 路线图 T1 + R1
   - scripts/ai-gen.mjs 加 --ref <png>...（参考图）与 --edit <png>（图生图）；参考图 sha256 写进 provenance
   - 新增 GPT Image 2.5 生图适配器（与现有 qwen/seedream 同形态；key 走 env；缺 key 或 --mock 走 mock）
② REQ-AIFLOW-SPLIT = 路线图 T2 + S1
   - docs/design/<slug>/keyart/ 工作区约定；机读拆层单 asset-split.json（字段见 spec）
   - 脚本：由拆层单画标注图 keyart/<scene>-split.png（同输入同图）；只把 state:"approved" 且有 skinKey 的行推导进美术台账；无 skinKey 行拒收
   - S1：写拆层操作规程 skill（.claude/skills/ 下新建一份，格式参照现有 skill），讲清 agent 看图时「给 Tripo / Blender 搭 / 2D 切图」的判据和输出格式
③ REQ-AIFLOW-REVIEW = 路线图 T6 + U2 + U4 + R5 + S2
   - U2：把 scripts/game108-design-measure.mjs 泛化为 scripts/design-measure.mjs <slug>（game108 行为不变，原脚本可改为调用新脚本）
   - T6：scripts/keyart-review.mjs <slug> <scene>：机位预设截图 → 与关键图并排对比图 + 客观指标 → 生成 self-check/R1-keyart-review.md 骨架
   - U4：同一 harness 支持 UI 模式：用 U2 的同一把尺子量我们的屏 vs Claude Design 稿，逐件出位置/尺寸/颜色差
   - R5：支持按机位录帧序列 / 短 GIF（给动作审查用）
   - 指标只作参考，不当通过阈值
   - S2：写盲审操作规程 skill（比对清单：构图/色调/光源/比例/动作；复查 agent 只拿参考图 + 截图，不读施工方自陈）
④ REQ-AIFLOW-GATES = 路线图 P1 + 原 PIPELINE-GUARDS ①
   - scripts/game-pipeline.mjs 生产板加 K2「画面定稿」、D1「拆层确认」两道人门 + R1 复查门；机器态从工件推导（keyart/ 在档、asset-split.json 全 approved、R1-keyart-review.md 在档）
   - signoff --by 只收真人白名单 docs/roles/humans.json，agent 名一律拒。该文件目前不存在：你只建结构（如 {"humans":[]}）和校验逻辑，名单本身由 owner 填，你不许往里写任何名字；名单为空时 signoff 一律拒并提示「请 owner 填 docs/roles/humans.json」

【4. 边界（越界 = 打回）】
- 允许改：scripts/**（含测试）、.claude/skills/ 新增的两份 skill、docs/workflow/requests.md 的锁行与 status、本波新增文档、docs/roles/humans.json
- 不许改：src/ui/**（PUI 域）、src/renderer/three-*、src/renderer/three/**、games/game-z/**（P3D 域）、任何 games/<slug>/ 游戏层、引擎 sim 核心
- spec 写不通 / 有歧义：停下来在该工单下追加一段「施工方疑问」，写清查了什么、为什么不通、两条可选路，推送后等裁决。不许自行改 spec，不许先写代码再补申请。

【5. 硬规则】
- 不把任何 API key 写进仓库；全部能力必须有 mock 路径，门禁在无 key、无网络环境下也能全绿
- 非 sim 面日志用 console 分级；凡「什么都没发生」的分支（拒收、跳过、降级）都要打一行
- 每张工单独立提交；每次推送前跑 node scripts/scoped-gate.mjs --run，用退出码判断（不要经管道吞掉失败码），全绿才推
- 已知基线红（2026-10-16 实查·origin/codex/mainbranch 原样即红·非本波范围）：depcruise 报 games/game113/guide-art.ts 相对导入越界，以及 vitest 里对应的「dependency-cruiser 围栏」1 例。这两项视为基线，不许为过门禁去改 game113；其余步骤必须全绿，Review 单里写明「除基线 depcruise 外全绿」并附各步退出码
- 推送前 git fetch origin codex/mainbranch，如有新提交就 rebase 到它上面再跑门禁
- 只提交自己的文件；不 stash、不挪动、不覆盖任何别人的改动
- 不签任何人门（signoff），不给自己写复查 PASS

【6. 每张工单的完工交付】
1. 代码 + 测试，门禁全绿，已推送到 codex/mainbranch
2. 自证「撤修验红」：撤掉关键修复，确认对应测试真变红，且断言命中锚点；把撤修方式和红灯输出写进 Review 单
3. Review 单：docs/design/ai-pipeline/review/REQ-AIFLOW-<名>.md，格式照 REQ-108-ENG-03.md：做了什么 · 改动面（文件清单）· 逐条「怎么自己验」· 撤修验红记录 · 已知局限
4. 工单 status 改为「已交·待复查（Claude）」

【7. 全部做完后】
回复一段总结：四张工单各自的提交哈希、Review 单路径、门禁输出末行、所有偏离 spec 的地方和理由、还没做的或有疑问的点。然后停下，等 Claude 交叉复查。
```

## 复查约定（给复查方 Claude）

- `git fetch origin codex/mainbranch`，按 Codex 总结里给的提交哈希区间，在独立工作树（临时 clone）里复查，不动别人的现场。
- 按 CLAUDE.md「review 四步铁律」逐张核：独立复跑 · 撤修验红（带锚点断言）· 实证复现 · 读告警。
- 每张出判词 PASS / FAIL（附复现步骤），写回对应 Review 单末尾并推到 codex/mainbranch；FAIL 的打回 Codex 修，修完再复查。
