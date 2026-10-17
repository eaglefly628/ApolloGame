# D1 关键图工作区与拆层单

本约定实现路线图 T2 / S1。拆层方法见 `.claude/skills/aiflow-split/SKILL.md`，人门规则见 `docs/workflow/ai-production-flow.md` §3。

## 工作区

```text
docs/design/<slug>/
  keyart/
    README.md                 # K1 提示词、模型、种子；记录定稿依据
    <scene>.png               # 该场景原始关键图
    <scene>-<view>.png         # K2 补视角 / 状态变体
    <scene>-split.png          # 脚本生成的编号标注图
    mock/<scene>-split.png     # --mock 独立预览，不作为人门工件
  asset-split.json             # D1 机读真相，人工维护
  asset-split.md               # 脚本生成的人读清单，不手改代替 JSON
```

关键图作为设计参考留在设计目录；实际运行资产与台账遵循 `scripts/art-paths.mjs::artRoot`：卡带为 `library/<slug>/art/`，内置游戏为 `public/games/<slug>/art/`。

## JSON 契约

顶层数组，每行字段固定为 `{id, scene, bbox, route, skinKey, prompt, refs, state}`。

| 字段 | 含义 |
|---|---|
| `id` | 稳定且唯一的拆层项标识，修改描述时不换号 |
| `scene` | 关键图文件名主体，对应 `keyart/<scene>.png` |
| `bbox` | `[x,y,w,h]`；原始 PNG 左上为原点的整数像素，x/y 非负，w/h 正数，整个框在图内；不是归一化坐标，也不是缩略图坐标 |
| `route` | `generate` / `build` / `character`；分别为单独生成、直接搭建、三维人物线。二维切图用 build，prompt 写清工具目标；二维重生成用 generate |
| `skinKey` | 必填且非空的真实运行时消费槽；任何行缺失都会拒收，proposed 也不例外 |
| `prompt` | 主体、特征、颜色、视角与制作要求；区分 Tripo、Blender 和二维切图，避免只写物件名 |
| `refs` | 已存在的本地参考文件路径数组，相对 `docs/design/<slug>/`；无额外参考可为 `[]`；不得用远程 URL、绝对路径或逃出设计目录 |
| `state` | `proposed` / `approved`；新提案默认 proposed，由真人确认后记录 approved；脚本不自动改变状态 |

每项都要对应真实消费点。非空 key 的机器校验不能证明游戏已消费它，提交 D1 给人确认时仍须逐行展示消费文件与槽位置；未落实的提案不能靠杜撰 key 进账。

## 生成标注图与台账

```bash
node scripts/asset-split.mjs <slug>
node scripts/asset-split.mjs <slug> --root <fixtureRoot> --mock
```

默认从仓库工作区读取，正常路径本身就是纯离线。`--root` 指定含 `docs/design/<slug>/` 的独立测试根。`--mock` 只写 `keyart/mock/<scene>-split.png`，不写真实 `art-ledger.json`、不写 `asset-split.md`、不改 state；缺主图时输出降级日志并合成明确的 mock 预览，不能作为实际设计定稿或资产人审证据。refs 校验不降级：若 refs 指向缺失主图，仍拒收；空 refs 可以测试缺主图 mock。先在测试根准备拆层单再运行。

正常路径校验 JSON、场景 PNG、框与引用后，生成各场景 `-split.png` 和人读清单；图上编号对应 `asset-split.md` 标号，框色 generate=黄、build=青、character=粉。相同输入产生相同 PNG 字节，可直接比较文件哈希；脚本不执行切图、建模或生成资产。

仅 `state:"approved"` 且有 skinKey 的行可推导为美术需求，proposed 不入台账并有跳过日志；缺 skinKey 的输入拒收并报错。台账通过既有 `mergeLedger` 合并，编号 append-only，原编号、状态与历史按既有合并规则保留；重跑不重新编号。D1 approved 只确认“要做这一项”，新资产仍是待配需求，不能因此标成资产 approved 或签人门。

先由 owner 确认关键图 K2，再核对 D1 标注、路线与消费槽并确认拆层。改关键图需回 K2，改拆层范围或路线需回 D1；agent 不代签。实际资产生成、可见占位、写回与人审继续遵守 `docs/playbooks/art-pipeline.md`。
