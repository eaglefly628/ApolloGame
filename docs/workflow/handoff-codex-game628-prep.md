# Codex 派工单 · game628 开工前：三单交叉复查 + 拆层单进 3D（2026-10-23）

> 派工：owner。复查人与施工人：Codex。三张待复查的单由 Claude 施工，Codex 复查（复查人 ≠ 施工人）；`REQ-AIFLOW-SPLIT-3D` 由 Codex 施工，完成后交 Claude 复查。
> 盘点依据：`docs/design/game628/engine-readiness-2026-10-23.md`。G1 / G2 待 owner 判 A/B，**本单不含**。

## 指令全文

```text
你是 ApolloGame 引擎仓的 Codex。本单两部分：先复查 Claude 施工的三张单（你是复查人），再施工一张小单（之后交 Claude 复查）。

【0. 先读】
1. AGENTS.md → CLAUDE.md（尤其「施工与复查」第 3、4 条：复查人≠施工人；review 四步铁律：独立复跑 · 撤修验红（带锚点命中断言）· 实证复现 · 读告警）
2. docs/design/game628/engine-readiness-2026-10-23.md（为什么要做这些）
3. 三张 Review 单（导航不是证据，每条都要自己复跑）：
   - docs/design/ai-pipeline/review/REQ-3D-RB-MATERIAL.md（提交 e5ef0095）
   - docs/design/ai-pipeline/review/REQ-AIFLOW-STYLETOKENS.md（提交 8a94300f）
   - docs/design/ai-pipeline/review/REQ-AIFLOW-DSYNC.md（提交 cafa0c60）

【1. 分支】主干 codex/mainbranch，直推不开 PR：
git fetch origin codex/mainbranch && git checkout -B codex/mainbranch origin/codex/mainbranch
复查在隔离副本（git worktree 或临时 clone）里跑，不动共享工作区里别人的未提交改动；不 stash、不强制重置。

【第一部分 · 复查三张单】
对每张单：
- ① 独立复跑：该单定向测试 + 全量门禁 node scripts/scoped-gate.mjs --run（看退出码，不经管道吞失败码）。
- ② 撤修验红：自选至少两处、且不同于施工方已用的锚点；锚点必须唯一命中；撤掉后对应测试真红，恢复后绿、工作树干净。
- ③ 实证复现：
  · RB-MATERIAL：未声明弹性/摩擦的场景是否与改动前逐位一致（Review 单有金标准用例）；另跑一次 node scripts/game211-throw-lab.mjs（若可运行）看 game211 手感是否在 2026-08-10 对照实测范围内；判断「对世界直用声明值 + 声明体之间 √f / max r」的组合规则是否合理。
  · STYLETOKENS：令牌文件放在美术根 public/games/<slug>/art/ 而非 docs/design/（施工方的刻意偏离，理由在 Review 单一、1）是否接受；ai-gen --game 与台账批量出图是否真拼入风格段；两侧键表是否真被测试钉住。
  · DSYNC：npx vite-node scripts/design-system-export.mjs --out <临时目录> 出包；用浏览器逐张打开卡片，查 pageerror、外部请求、坏图；首行 @dsCard 标记；README 出稿规则。
- ④ 读告警：全量日志里的 WARN、topological-sort 告警是否有新增。
判词写回各自 Review 单末尾「独立复查判词（Codex · 日期）」：PASS 或 FAIL，每条附复现步骤与输出。PASS 的在 requests.md / requests-3d.md 把该条状态改为结案并按规矩删除条目（done 同提交删除）；FAIL 的写清最小复现与归属，不要替施工方修。

【第二部分 · 施工 REQ-AIFLOW-SPLIT-3D】（spec 全文见 docs/workflow/requests.md 该条）
- 开工第一个动作：把该条「施工主体：待抢锁」改成「施工主体 = Codex（日期·本行即锁）」，单独提交并推送。
- 拆层行加可选字段 asset: 'sprite' | 'model3d'（缺省 sprite）；model3d 行推导进台账为 kind:'model3d'（art-replace 会选 tripo/meshy）；route:'build' 行不进出图台账（打 [asset-split] skip 日志），blender-job 校验口径不变。
- 验收：3D 道具行进台账为 model3d 且 art-replace 选 tripo；build 行不进台账；旧拆层单的推导结果逐字节不变（用现有测试夹具钉住）；aiflow-split skill 文档同步说明 asset 字段；至少两处撤修验红。
- 边界：scripts/asset-split.mjs 及其测试、.claude/skills/aiflow-split/SKILL.md、docs/design/ai-pipeline/asset-split.md、requests.md 该条状态行、新 Review 单 docs/design/ai-pipeline/review/REQ-AIFLOW-SPLIT-3D.md。
- 完工：status 改「施工完·待独立复查（Claude）」；不签人门、不给自己判 PASS。

【规则】
- 推送前 fetch、必要时 rebase、按自己实际改动跑 scoped-gate 并核退出码；只提交自己的文件。
- 不签任何真人门；不改 G1 / G2（GAP-628-04 / 05，待 owner 判 A/B）。
- 真实 Tripo / Auto-Rig Pro / Mixamo 服务未配置：涉及真实链路的结论一律标「真实链路未验」。

【完工回复】
三张单各自的判词与关键复现输出；SPLIT-3D 的提交哈希、测试名、撤修验红结果、门禁各步退出码；任何你认为 Claude 施工中有问题但未判 FAIL 的观察。然后停下。
```
