# 本机执行与证据流程

此参考用于运行前核对和每版评估。工具实现与配方 schema 以发现的项目根目录内文件为准；本文不复制一套可能漂移的 schema。

## 项目与接口核对

在用户指定目录或当前 ApolloGame 检出中定位项目根目录，核对：

- `tools/motion-mink-validation/recipe.mjs`：本轮配方闭集、必填参数、单位及验证器。
- `tools/motion-mink-validation/run.mjs`：本轮统一执行入口、依赖探测、输出及失败行为。
- `tools/motion-mink-validation/preview.mjs` 与 `preview.ts`：现有引擎的多角度 review 预览。
- `scripts/lib/motion-semantics.mjs`：唯一来源分类及原文证据模块。
- `scripts/lib/motion-extra-tags.mjs`：来源/基础参考/目录技术标签的依据边界。
- `docs/design/ai-pipeline/motion-review-next-contract.md`：当前 draft、审批及写回范围。

已核对当前 `run.mjs` / `recipe.mjs` 及校准、求解、烘焙、检查链。它们是 **experimental-candidate-only**；接口存在及某个样例跑通，不证明所有动作、Skin、手指或视觉质量均通过。

当前命令：

```sh
cd "$PROJECT_ROOT"
node tools/motion-mink-validation/run.mjs --recipe "$RECIPE_FILE" --out "$NEW_OUT_DIR" --lib "$MOTION_LIB" --python "$PYTHON_EXECUTABLE"
```

`PROJECT_ROOT` 从本次项目发现；`MOTION_LIB` 是只读来源库；`PYTHON_EXECUTABLE` 是核实含 `numpy`、`scipy`、`mujoco`、`mink` 与 `daqp` 的本机 Python 环境，不照搬个人默认路径。运行还需本项目 Node 依赖。缺依赖时按当前授权处理或明确回报，不默改全局环境。`NEW_OUT_DIR` 的父目录须存在，目标必须尚不存在，位于所有 Git 仓库之外并避免路径别名。新版本换新目录，不覆盖旧版。

parser 当前仅接受 `--recipe`、`--out`、可选 `--lib` / `--python`；没有 `--project`、`--help` 或假想的预检开关。配方可通过实际导出的 `loadMotionRecipe` / `validateMotionRecipe` 做只读验证。需要参数时读当前源码，而不是盲试未知开关。

runner 按 `export.mjs` → `solve.py` → `bake.mjs` → `check.py` 顺序执行，不手工跳阶段。前者读取精确来源与校准数据；求解器以 Mink/MuJoCo 生成米制姿态；烘焙桥接原生骨架、生成 GLB 并重放；独立检查使用实际原生重放数据。下层脚本仍有实验默认路径，不绕过 runner 直接调用。

当前输出应据实际阶段核对：`recipe.json`、`.workflow/run.json` 与 `.workflow/source/` 工具快照；校准输入 `input.json`，求解 `solution.json` / `model.xml`，烘焙 `candidate.glb` / `playback.json` / `review/catalog.json` / `report.json`，独立检查 `collision-report.json`，汇总 `validation.json`。检查 `recipeSha256`、来源身份、工具 SHA 与 stages；若运行中源码发生漂移，不能把混合版本的结果当可复现实证。以 runner 当前实际 guard 和报告为准，不假称保存起始 SHA 已证明全程无变化。

退出码 **0** 仅为 `candidate-needs-visual-review`；仍是 draft，待视觉及手部核对。完成烘焙但独立检查失败为退出 **2**，状态 `candidate-rejected-technical`，保留候选和报告供展示。配方、依赖、校准、求解、烘焙等更早异常为退出 **1**，只保证保留已产生的输出和阶段记录，不保证已有 GLB 或完整报告；配方/路径预检失败甚至可能没有输出目录。不得把缺少的产物说成已生成。

仅当 review 库及报告确实存在时启动原生多角度预览：

```sh
node tools/motion-mink-validation/preview.mjs --lib "$NEW_OUT_DIR/review" --report "$NEW_OUT_DIR/validation.json"
```

若前期异常没有 `validation.json`，先核对已有 `report.json` 与阶段记录，不能编造最终报告或成功状态。预览服务把指定报告和 bundle 作为启动时快照；换候选/报告后重启相应预览，避免看着旧版本判断新版。此技能不重启旧下载任务。

## 本轮已确定的后端范围

下列要点已对当前 `recipe.mjs` 核对；实际 schema 仍是唯一执行依据，不复制另一套验证器：

- `kind` 仅为 `simple-hand-action`，`mode` 仅为 `match-strike` 或 `hand-targets`。
- `source` 绑定 `skinId`、`baseClipId`、`atS`。躯干和腿固定在基础 clip 的这一时刻，只求解上肢；不保留原 clip 全时序，不支持走路或全身平衡。
- `version` 固定 1，`label` 为生成意图说明；`durationS` 为 0.5–8 秒并对齐 30 FPS 样本边界，`fps` 固定 30。`source.atS` 还必须落在所选基础 clip 实际时长内。
- `handTargetsM` 的 `Left` / `Right` 为相对 Hips 的米制目标；`handOrientations` 的左右手各由 `fingers`、`normal` 定义。具体向量约束由 schema 验证，不猜轴向或转换比例。
- 可选 `curvesM.Left` / `Right` 为 `[[time, dx, dy, dz], ...]`，时间与米制偏移、预算和覆盖条件以实际验证器为准。
- 肘引导和 `qualityThresholds` 与完整配方一同绑定 `recipeHash`。不得为了显得通过而悄改硬门或沿用旧 hash / 旧回执；新的目标/轨迹调整须保存新版本及其真实身份。
- `match-strike` 使用后端默认道具与捏持模板。这不是从参考图学习手指，也不证明实际握持或火焰已实现。

独立检查拒收和较早阶段错误的退出码/产物范围按上节区分；允许展示实际存在的失败候选，但不能自动写正式库。图片监督目前是 Codex 通过可见浏览器工具查看参考图和多角度截图；没有安装关键点估计器，不可称自动姿态识别或客观图片评分已经存在。

## 输入与来源

确认本次目标、项目、素材库、generated 输出根目录、基础候选及目标 Skin。能从已授权项目配置发现的参数直接读取；只询问不可推断且会影响结果的信息。读 catalog 与素材元数据时不改原文件。

优先按来源 Description、已有来源标签和可证明的技术元数据检索基础动作。旧 `category` / `neutral` 默认值不是行为事实；不要借旧 matcher 的结果掩盖其未消费新标签的限制。保留精确 ID 和 SHA，同名动作不能互换。

来源不足保持未知。配方里的中文目标是生成意图，不能在求解后自动变成肯定行为标签。提及公文包、火柴等物体，不等于证明握持、左右手接触或情绪。派生动作继承的来源只能标作 `base-reference`。

## 单位、求解与产物

按实际 schema 的闭集字段设置目标、轨迹和允许的参数；本轮根/躯干/腿固定于基础 clip 单个时刻，仅上肢求解。不能把这一约束描述成原 clip 的动态足接触或全身平衡能力，也不自行扩展配方字段。

核对输入骨架层级、静止姿态与逆绑定、实际世界缩放、轴向以及米制校准证据。10 厘米探针应在报告中真实测得对应位移，容差取实际后端契约；不得凭文件后缀假定米制，或在视图中反复乘 100。道具 offset/size 若已由校准转换为骨局部单位，直接消费其数值，不再换算。

runner 必须将失败退出与候选输出状态区分。读取真实退出码及报告，不把“生成了文件”当成检查通过。独立检查程序须消费实际烘焙结果，而非仅复述求解器自己的残差；骨架/GLB、关节限位、代理几何、原始蒙皮采样分别记录覆盖范围、数值和未检部分。代理间隔不是网格无穿插证明，采样通过也不覆盖连续所有时刻。

每版在新的 generated 子目录保留实际配方、基础与 Skin 身份、校准、GLB、检查报告、预览证据和状态。文件名以 runner 实际输出为准，不虚构必然存在的报告文件。若 wrapper 未保存某项且当前范围不允许补工具，记录缺失并保留其它证据；不篡改报告使它看似齐全。

## 视觉对照与调整

用项目已有 Engine / ThreeRenderer / AnimGraph3D 预览；不另写播放链。至少看正面与侧斜上半身；涉及根位移、脚部或全身表意时另加全身视角；对双手、胸腹、骨盆及脚部选取接近/接触/离开等关键时刻。道具只作尺寸和接触参考，火焰表现、精细抓握及手指姿态不是自动完成项。

有用户提供或明确指定的有效参考图时，记其来源、适用目标及可比较视角，在同阶段对照；没有图就直说无图。可以列“已观察到 / 未观察到 / 无法判断”，不生成伪客观视觉分数或假称与不存在的参考匹配。

每次调整由明确问题驱动，例如手穿胸、目标位置偏离、限位超出或动作表意不清；只动本次配方可表达的参数。最多五版含初稿，逐版保存；同关键问题连续两版无可验证改善即报告停滞。缺依赖、单位校准失败、无法表达的硬约束或预算用尽时停止相应生成并交代原因，不持续修改未知参数。

## 每个 Skin 的手部独立核对

当前 `solve.py` 为肘部屈伸/前臂扭转使用双 hinge；右手拇指和食指的活动指骨仍是宽范围 ball 关节。它没有逐 Skin 的手指解剖轴、正常屈伸方向或精细抓握校准；其它手指也不是完整主动求解。`check.py` 的 hinge 限位指标主要对应肘/前臂模型，其代理和蒙皮采样不认证 finger grasp / match-box contact。不能将这些现有指标改名为“手指正常”或杜撰自动 hinge 指骨能力。

换 Skin 后，即使大动作方向对、同一个人体骨架可重定向，也必须重新核对以下项目，不能继承旧 Skin 的手部通过状态：

- **每指每节局部轴**：核对实际骨名、静止旋转、轴向和骨链；左右手与不同 Skin 的局部 roll 不能按名称或镜像猜定。缺骨或未知轴明确标未检查。
- **屈伸方向与范围**：分别看拇指、食指、中指、无名指、小指各节，观察是否逆弯、横向扭转或超出合理范围；缺少逐关节解剖校准时不能给自动数值通过。ball 的宽范围限制不是已证实的生理限位。
- **拇指区别**：单独核对拇指根部运动、对掌及捏持方向，不能直接套食指屈伸轴或称已完成拇指专用校准。
- **穿插**：近景观察同手指间、指掌、双手之间的接近与离开时刻。现有手掌 hull 或左右手代理通过，不能证明同手逐指无穿插。
- **道具接触**：核对指腹/火柴/盒子的相对位置、握持方向、接触阶段和滑动；可见道具是尺寸参考，火焰与可信握持仍待确认。无可用接触测量时只作明确限定的视觉观察，不捏造客观分数。

使用可见浏览器工具逐帧或暂停核对适当时刻，保存目标 Skin/候选身份与多角度证据。在独立的补充 review 记录中标注手部 `warning`、`未检查` 或 `拒收`，不要往闭集 recipe 填假字段或篡改后端报告为通过。需要精细抓握却出现反向弯曲或明显指间穿插时，该手部质量不合格；用户先前只认可“大动作表意足够”不能覆盖它。

当前配方没有逐指解剖轴/hinge 或自动抓握参数。若这一缺口阻止改善，应保留失败候选并报告未完成能力，不能靠反复调手掌目标、降低阈值或五版凑次数宣称修好。后续实现需另有工具支持及实证；本技能本身不补造引擎能力。

## 候选及批准

本次目标是保存可展示的本地 `draft`，包括失败样例的透明记录。技术检查、手部质量、表意确认、指定 Skin 确认、正式入库分别记录。用户说“够像”仅记录相应版本/Skin 的表意确认，不能移除失败硬门；没有用户确认也不能从几何通过推导批准。

正式库写回只走实际存在且另有授权的数据/批准门。若 sidecar 仅支持 propose/flag，不能发 accept/reject 或自写 human 字段伪造人审。未经批准的候选和各类检查报告都留本机 generated 范围，不覆盖 None 母版或原素材，不把数据上传 Git。
