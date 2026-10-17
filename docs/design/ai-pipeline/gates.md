# AI 协同生产板：K2 / D1 / R1

入口仍为 `scripts/game-pipeline.mjs`。生产板现在按 11 阶段排列：

`S1 → S2 → K2 画面定稿 → D1 拆层确认 → S3 → S4 → S5 → S6 → R1 关键图复查 → S7 → S8`

K1 出关键图属于 K2 的前置制作活动，不另加板上阶段。K2 / D1 是两道人门，R1 是独立复查门；工件机器检查通过只说明材料在档，不代替真人确认或独立复查。

## 离线看板与工件检查

```bash
node scripts/game-pipeline.mjs board <slug>
node scripts/game-pipeline.mjs board <slug> --json
node scripts/game-pipeline.mjs gate <slug> K2
node scripts/game-pipeline.mjs gate <slug> D1
node scripts/game-pipeline.mjs gate <slug> R1
node scripts/game-pipeline.mjs checklist <slug> R1
```

新增三关只读本地工件推导机器态，不需要 API key、网络、浏览器或游戏实现体；gate 会将检查结果记入该项目流程账本。board 只读，`--json` 在整板未完成时退出 1，普通看板用于展示，不以其退出码代替全部阶段判定。

| 门 | 机器检查 | 还缺哪道确认 |
|---|---|---|
| K2 | `docs/design/<slug>/keyart/` 顶层有 PNG 关键图；检查 PNG 头，排除 `-split.png` 标注图；mock 子目录不算 | 真人画面定稿 signoff |
| D1 | `asset-split.json` 满足拆层 schema、每行有 skinKey，且全部 approved | 真人拆层确认 signoff；approved 数据本身不是签字 |
| R1 | 非空 `self-check/R1-keyart-review.md` 在档；`self-check/mock/` 不算 | 非施工者独立 review；生成骨架不等于完成复查 |

缺工件或不合法会显示机器红态并输出原因。K2 / D1 不设重复独立复查门，R1 不另签人门；S6 仍走美术平台逐行人审。

## 真人白名单由 owner 维护

本波交付的 `docs/roles/humans.json` 保持：

```json
{"humans":[]}
```

由 owner 将实际真人姓名填入 humans 字符串数组，施工 agent 不填任何名字。姓名须非空，经过 NFKC、去首尾空格和转小写后不得重复。文件缺失、无法解析、格式错误或名单为空都会拒绝签字；空名单明确提示“请 owner 填 docs/roles/humans.json”。

所有 signoff 都必须显式提供非空 `--by` 和 `--note`，by 必须命中白名单；Codex、Claude、agent、bot 等 agent 身份即使被误写入名单也会拒收。旧有签字在看板上同样重新校验名单。白名单是 owner 管理的人门身份约束，不授权 agent 借真人姓名代签。

真人完成实际确认后的命令形状如下，施工方不得代执行：

```text
node scripts/game-pipeline.mjs signoff <slug> K2 --by "<白名单真人姓名>" --note "<画面定稿依据>"
node scripts/game-pipeline.mjs signoff <slug> D1 --by "<白名单真人姓名>" --note "<逐项拆层确认依据>"
```

K2 / D1 签字前会再次校验工件。签字保存 artifactHash：K2 覆盖关键图及可选 `keyart/README.md`，D1 覆盖 `asset-split.json`。相应工件变化后看板显示签字过期，须真人重新确认；重跑机器 gate 不会替真人续签。

## R1 由独立复查者落账

先按 `.claude/skills/aiflow-blind-review/SKILL.md` 仅用参考图与截图 / 动作帧完成盲判，再以指标辅助定位；指标没有自动通过阈值。需要修改参考图则回 K2 由真人重新确认。

独立复查者完成核证后的命令形状：

```text
node scripts/game-pipeline.mjs review <slug> R1 --builder "<实际施工主体>" --by "<实际复查主体>" --verdict <PASS|CONCERNS|FAIL> --note "<逐项核证与图片位置/帧号>"
```

R1 要求非空 builder 和 by，两者按同一身份归一化后必须不同；该约束不允许施工方另取名字自审。review 允许独立 agent 作为复查主体，与 signoff 的真人白名单分开。判词必须来自复查者自己的核证，本施工交付不填写任何复查 PASS。

落账时要求真实 R1 单在档，并保存 gameHash 与 artifactHash。R1 工件 hash 覆盖关键图、可选关键图说明、拆层单、R1 复查单及 `self-check/shots/` 下工件；图片、报告或相应设计材料变更后复查过期，须独立重查。新截图不能沿用旧判词，mock 工件不能补真实门证。
