# 本机执行与证据流程

此参考用于运行前核对和每版评估。工具实现与配方 schema 以发现的项目根目录内文件为准；本文不复制一套可能漂移的 schema。

## 项目与接口核对

在用户指定目录或当前 ApolloGame 检出中定位项目根目录，核对：

- `tools/motion-mink-validation/recipe.mjs`：本轮配方闭集、必填参数、单位及验证器。
- `tools/motion-mink-validation/run.mjs`：本轮统一执行入口、依赖探测、输出及失败行为。
- `tools/motion-mink-validation/preview.mjs` 与 `preview.ts`：现有引擎的多角度 review 预览。
- `socket-runtime-run.mjs` / `socket-runtime.mjs` / `socket-attach.mjs`：擦火柴实时 Socket 原型、逐 Skin Grip 适配、端点实测与失败保留。
- `runtime-controls.ts`：Socket 报告身份核验、运行时目标与交互 Flag/动画图控制。
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

## Mink 离线生成范围

下列要点已对当前 `recipe.mjs` 核对；实际 schema 仍是唯一执行依据，不复制另一套验证器：

- `kind` 仅为 `simple-hand-action`，`mode` 仅为 `match-strike` 或 `hand-targets`。
- `source` 绑定 `skinId`、`baseClipId`、`atS`。躯干和腿固定在基础 clip 的这一时刻，只求解上肢；不保留原 clip 全时序，不支持走路或全身平衡。
- `version` 固定 1，`label` 为生成意图说明；`durationS` 为 0.5–8 秒并对齐 30 FPS 样本边界，`fps` 固定 30。`source.atS` 还必须落在所选基础 clip 实际时长内。
- `handTargetsM` 的 `Left` / `Right` 为相对 Hips 的米制目标；`handOrientations` 的左右手各由 `fingers`、`normal` 定义。具体向量约束由 schema 验证，不猜轴向或转换比例。
- 可选 `curvesM.Left` / `Right` 为 `[[time, dx, dy, dz], ...]`，时间与米制偏移、预算和覆盖条件以实际验证器为准。
- 新增可选 `contactStroke` 仅用于 `match-strike`：`startS` / `endS` 指定接触时段，`fromZM` / `toZM` 为盒侧局部 Z 行程，`clearanceM` 为接近/离开间隙。实际边界以 schema 为准。火柴头 site 与持盒手之间使用相对任务，盒侧和火柴头的实际尺寸决定接触偏移；当前只支持此模板，不声称任意道具交互已经实现。
- 新增可选 `headFollowWeight` 为 0..0.25：报告指定运行时 Head look-at 跟随附着的 match-head。它未烘焙进 GLB，也不单独驱动眼球。改变跟随强度但复用相同动画时，应另存预览报告/变体记录，不覆盖原生成配方或硬检查。
- 肘引导和 `qualityThresholds` 与完整配方一同绑定 `recipeHash`。不得为了显得通过而悄改硬门或沿用旧 hash / 旧回执；新的目标/轨迹调整须保存新版本及其真实身份。
- `match-strike` 使用后端默认道具与捏持模板。这不是从参考图学习手指，也不证明实际握持或火焰已实现。

独立检查拒收和较早阶段错误的退出码/产物范围按上节区分；允许展示实际存在的失败候选，但不能自动写正式库。图片监督目前是 Codex 通过可见浏览器工具查看参考图和多角度截图；没有安装关键点估计器，不可称自动姿态识别或客观图片评分已经存在。

## 输入与来源

确认本次目标、项目、素材库、generated 输出根目录、基础候选及目标 Skin。能从已授权项目配置发现的参数直接读取；只询问不可推断且会影响结果的信息。读 catalog 与素材元数据时不改原文件。

优先按来源 Description、已有来源标签和可证明的技术元数据检索基础动作。旧 `category` / `neutral` 默认值不是行为事实；不要借旧 matcher 的结果掩盖其未消费新标签的限制。保留精确 ID 和 SHA，同名动作不能互换。

来源不足保持未知。配方里的中文目标是生成意图，不能在求解后自动变成肯定行为标签。提及公文包、火柴等物体，不等于证明握持、左右手接触或情绪。派生动作继承的来源只能标作 `base-reference`。

## 单位、求解与产物

Mink 离线生成按实际 schema 的闭集字段设置目标、轨迹和允许的参数；此路径根/躯干/腿固定于基础 clip 单个时刻，仅上肢求解。不能把这一约束描述成原 clip 的动态足接触或全身平衡能力，也不自行扩展配方字段。

核对输入骨架层级、静止姿态与逆绑定、实际世界缩放、轴向以及米制校准证据。10 厘米探针应在报告中真实测得对应位移，容差取实际后端契约；不得凭文件后缀假定米制，或在视图中反复乘 100。道具 offset/size 若已由校准转换为骨局部单位，直接消费其数值，不再换算。

runner 必须将失败退出与候选输出状态区分。读取真实退出码及报告，不把“生成了文件”当成检查通过。独立检查程序须消费实际烘焙结果，而非仅复述求解器自己的残差；骨架/GLB、关节限位、代理几何、原始蒙皮采样分别记录覆盖范围、数值和未检部分。代理间隔不是网格无穿插证明，采样通过也不覆盖连续所有时刻。

每版在新的 generated 子目录保留实际配方、基础与 Skin 身份、校准、GLB、检查报告、预览证据和状态。文件名以 runner 实际输出为准，不虚构必然存在的报告文件。若 wrapper 未保存某项且当前范围不允许补工具，记录缺失并保留其它证据；不篡改报告使它看似齐全。

## 视觉对照与调整

用项目已有 Engine / ThreeRenderer / AnimGraph3D 预览；不另写播放链。至少看正面与侧斜上半身；涉及根位移、脚部或全身表意时另加全身视角；对双手、胸腹、骨盆及脚部选取接近/接触/离开等关键时刻。道具只作尺寸和接触参考，火焰表现、精细抓握及手指姿态不是自动完成项。

有用户提供或明确指定的有效参考图时，记其来源、适用目标及可比较视角，在同阶段对照；没有图就直说无图。可以列“已观察到 / 未观察到 / 无法判断”，不生成伪客观视觉分数或假称与不存在的参考匹配。

每次调整由明确问题驱动，例如手穿胸、目标位置偏离、限位超出或动作表意不清；只动本次配方可表达的参数。最多五版含初稿，逐版保存；同关键问题连续两版无可验证改善即报告停滞。缺依赖、单位校准失败、无法表达的硬约束或预算用尽时停止相应生成并交代原因，不持续修改未知参数。

## 按指定关节驱动动作

用户要求手腕主导的划擦时，不能只移动手部位置目标并固定朝向。当前本地候选工具新增可选 `rotationCurvesRad`：按 Left/Right 给出 [秒, 世界轴角向量 x/y/z] 关键点，分量以弧度计、向量长度最多 0.8，首尾为零且覆盖整个 durationS；在中性手部世界朝向前乘旋转，平滑插值。使用前核对当前检出 schema 是否已支持，旧检出不可填入该字段。对应前臂使用预热后的位姿约束，减少肘部代偿；不承诺肘部完全不动。

用原生回放实测指定骨骼相对父骨骼的旋转、肘部位置摆幅、道具端点在目标方向的行程，对比上一候选。数字改善不代替语义验收：划擦必须看出接近、划过和离开，不是来回挠手；此控制不解决未实现的分组手型，也不认证道具接触。

## 简化手型与每个 Skin 的核对

用户确定自生成动画优先采用三组控制：

- **拇指独立**：控制对掌与捏持方向。
- **食指独立**：优先表达捏持、指向与按压。
- **中指、无名指、小指一组**：并拢、协调开合，形成稳定握持轮廓，不做独立细微指节表演。

若工具能力或实际效果不足，降为两组：拇指独立，其余四指一组；交付明确本版使用几组及降级原因，不把两组结果称为三组。分组不改变原 Skin 网格、骨链和绑定，也不代表所有指节套同一旋转值；各指仍要按实际骨链映射，避免明显逆弯和扭曲。手型可优先复用已验证的张开、半握、握持姿态；当前无此预设或控制接口时，不能虚构已存在。

验收重点是动作语义、握持轮廓、食指/拇指的关系和明显穿插。细微指间差异、精细指节表演不列为本轮目标；这项简化不豁免明显反折、严重指掌穿插、道具漂离或“擦火柴变挠手”的问题。擦火柴仍应看出接近盒侧、沿盒侧划过、离开三个阶段，不能用简化手型替代划擦运动。

当前 `solve.py` 的右拇指和食指仍使用宽范围 ball 关节，其它手指也不是完整主动求解；尚无完整的三组/两组手型控制或逐 Skin 手部校准。`check.py` 的 hinge 限位指标主要对应肘/前臂，不能当成手部质量证明。更新本 Skill 不会自动修好现有候选；不添加 schema 不支持的分组/手型字段，不改旧报告为通过。实现分组控制仍需实际工具支持和预览实证。

换 Skin 后重新核对手型和接触，不继承另一个 Skin 的通过状态。使用可见浏览器工具暂停观察接近、接触、划擦、离开等时刻，保留候选/目标 Skin 身份和多角度证据；以“已观察到 / 未观察到 / 无法判断”记录，不能捏造客观分数。技术检查、简化手部视觉验收和用户表意确认分别记录，未完成分组控制或明显不合格时保留 warning / 未完成 / 拒收。

## 实时 Socket 擦火柴原型

当前已实现的 `socket-runtime-run.mjs` / `socket-runtime.mjs` 是 **runtime-socket-draft-only** 原型，限于 match interaction。它消费一个已有基础候选的 `review/catalog.json`（恰好一个 Skin 和一个 clip）及 `validation.json`，读取目标素材库，以目标 Skin 掌骨与静止姿态生成 Grip 候选，再准备每 Skin 内嵌基础动画和实时控制元数据。此入口不使用 Mink 的 `recipe.mjs` schema，也不调用离线互动 IK 烘焙来伪装实时求解。

已核对 CLI：

```sh
node tools/motion-mink-validation/socket-runtime-run.mjs --source "$SOURCE_CANDIDATE_DIR" --lib "$MOTION_LIB" --out "$NEW_RUNTIME_DIR" --skins "$TARGET_SKIN_ID"
```

必填仅 `--source` / `--lib` / `--out`；可选 `--skins` 为 `all` 或以逗号分隔的精确 Skin ID/唯一来源名称，省略时有工具内置样例选择，不应误当全部角色。优先指定精确 ID，重名名称、缺失项或重复身份拒收。可选 `--offline "$OFFLINE_COMPARISON_DIR"` 只读取已有逐 Skin `props.json` 与 `recipe.json` 的对照标定，不执行离线求解；两者必须齐全。没有 `--help`、`--recipe` 或任意 runtime JSON 配方开关。输出必须是父目录已存在、规范路径、尚不存在且位于全部 Git 仓库外的新目录。

四个新增虚拟骨及实际关系：

- `LeftHand` → `LeftGripSocket`：持盒握持层；盒与摩擦条通过 `Attach3D` 跟随。
- `RightHand` → `RightGripSocket`：持火柴握持层；火柴杆通过 `Attach3D` 跟随。
- `LeftGripSocket` → `LeftHandContactSocket`：盒侧局部接触轨迹。
- `RightGripSocket` → `RightHandMatchHeadSocket`：火柴头活动端点，火柴头道具挂接此骨。

基础 clip 只进行对目标 Skin 的人体基础重定向，再追加接触 Socket 的局部位置轨迹；准备阶段记录 `maxHumanLocalChangeDuringPreparation`，不能靠改人体基础轨迹修饰此指标。`interactionIkBaked=false`，交互修正发生在运行时。生成的同 Skin 内嵌动画必须直接播放，**不能再次经 M1 humanoid 绑定/重定向**，否则辅助 Socket 的位置轨迹会丢失。保留人体基础轨迹不意味着承诺任意基础 clip 的走路或全身平衡正确。

交互使用现有 E4 `InverseKinematics` / `IK3D`：右臂 root=`RightUpperArm`、mid=`RightLowerArm`、end=`RightHandMatchHeadSocket`，目标是 actor 的 `LeftHandContactSocket`；左臂链以 `LeftHand` 为端点，可跟随 `SocketLeftHandMover`。道具通过现有 `Attach3D` 挂接，不另写播放器或 UI 求解器。每帧先更新基础动画，再求左臂、按最新盒目标求右端点；动态移动盒目标应改变当帧右端点修正，而不是重播一段烘焙 IK。

`runtime-controls.ts` 验证 `runtimeSockets.version=1`、`bySkin`、内嵌 Skin SHA、坐标空间和链；`preview.ts` 消费同一份元数据。`Flag` 的 `socket-interacting` 驱动 `AnimGraph3D` 在 idle/interact 间切换，当前两向 fade 均为 0.15 秒；退出时交互链与头跟随权重关闭。动画图 fade 与 IK 权重开关不是同一认证，不宣称已经保证无跳变。预览提供进入/退出、盒子左右/上下移动、复位、实时 IK 开关；播放时操作、暂停后多视角检查。Head look-at 当前指向盒接触 Socket，权重最高 0.25，只是头部控制，没有眼球控制。

读取 `runtime-report.json` 的真实 `counts`、逐 Skin `reports` 和 `sourcesUnchanged`。每 Skin 同时测 regular 与 dynamicLeft：当前通过条件为端点最大误差小于 1e-5 m、inactiveSamples=0、rightUnreachableSamples=0；实际阈值仍以当前源码为准。状态分开保留 `runtime-coupled-draft`、`runtime-endpoint-failed-draft` 和 `failed-retained`，检查失败 `stage`、不可达、TRS/缩放拒收或缺掌骨原因。全库一次试验的数量仅是该批次快照，不能固化为永久支持角色数或通过率；复跑必须读取新报告。

准备成功的产物保留在 `review/skins`、`review/clips`、`static-skins`；`reports/<sourceSkinId>.json`（缺失身份时用实际 fallback key）保存逐 Skin 结果。后续检查失败也保留已产生的候选，较早失败可能只有失败报告。汇总含 `review/catalog.json`、`runtime-report.json`、`validation.json`；后者继承来源技术状态并追加独立 runtime 信息，不能把来源 fail 改成 pass。CLI 仅在来源未改且所有所选 Skin 端点耦合通过时退出 0，否则已完成的混合批次退出 2；更早抛错不保证完整产物。退出 0 仍是 draft，不是抓握、碰撞或发布批准。

预览只用已存在的输出：

```sh
node tools/motion-mink-validation/preview.mjs --lib "$NEW_RUNTIME_DIR/review" --report "$NEW_RUNTIME_DIR/validation.json"
```

端点耦合不认证末端朝向、摩擦、指掌接触、关节解剖限位、碰撞或蒙皮穿插；原候选的旧几何报告也不覆盖新增实时修正。三组/两组手型控制尚未实现，Grip 自动标定不等于手指控制。缺少掌骨或不可达/非刚性 TRS 的角色按真实失败保留，不跳过守卫后宣称全角色支持。

`socket-frames.mjs` 的 `composeSocketFrames` / `handPoseForContact` 仍是米制刚性位置/单位四元数的制作数学工具，不代替上述运行时链。自动选择交互资产应检查基础 ID/SHA、目标 Skin 适配与逐项验收，保留“基础动作＋Socket/道具关系＋目标 Skin 适配＋验收记录”，不能仅凭一份 GLB 或端点通过升级为正式 AI 可选素材。

## 接触、重定向及注意力的实证门

在指定接触时间窗，从原生回放恢复道具实际世界变换，把活动端点转到参考物体局部坐标，测量法向误差、切向轨迹误差和实际行程。不能仅消费求解器目标或残差，也不把点锚认证升级为完整网格接触、摩擦、握持认证。当前 contact.py 生成模板轨迹，check.py 从实际烘焙回放独立重建测量；后端报告仍是实际结论。

持物手要检查是否被相对约束拖动。接触优先级提高后，工作区可能需要重新安排以满足臂长、身体间距和肘部姿态；不能一边固定超出可达范围的腕距，一边假称四厘米道具仍能接触。

每次换 Skin 都重新测道具端点。普通人体重定向可能保持播放却失去接触；实时 Socket 路径须另查逐 Skin regular/dynamic 报告，因此“可切换全角色”和“所有角色交互通过”必须分别标注。目标 Skin 有额外扭转骨、不同权重分布或体型时，应按其实际骨架/蒙皮重算并复验。若所需代理缺少权重表面，不可跳过碰撞；采用明确的实际表面回退或拒收，并记录覆盖范围。全身凸包等保守检查与目视不符时记录疑点，不能直接删掉失败点或换绿报告。

Head look-at 先用低权重并目视核对，再按反馈调整；离线候选的目标是附着的火柴头；实时 Socket 原型目标为盒侧接触 Socket。按实际路径核对，不能泛称统一目标，不能替换成固定世界点或手腕中心。可用原生 CPU 探针核对实际 active 帧数与角度变化；数值非零仅证明功能生效，不证明视觉够自然。眼球、头部、颈部及身体跟随是不同范围，当前只接入已有 Head look-at。

## 候选及批准

本次目标是保存可展示的本地 `draft`，包括失败样例的透明记录。技术检查、手部质量、表意确认、指定 Skin 确认、正式入库分别记录。用户说“够像”仅记录相应版本/Skin 的表意确认，不能移除失败硬门；没有用户确认也不能从几何通过推导批准。

正式库写回只走实际存在且另有授权的数据/批准门。若 sidecar 仅支持 propose/flag，不能发 accept/reject 或自写 human 字段伪造人审。未经批准的候选和各类检查报告都留本机 generated 范围，不覆盖 None 母版或原素材，不把数据上传 Git。
