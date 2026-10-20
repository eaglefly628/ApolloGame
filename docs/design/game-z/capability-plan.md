# Game Z · V1「提水壶」离线整链预验能力计划

提交：Codex，2026-10-21；分段抢锁deb7e4024。此计划只覆盖隔离的技术预验夹具与工具，现有Game Z五个平台不改、不部署发售游戏。正式V1仍要求真实Tripo人物/水壶、Blender院落、授权动作来源及真人R1；本段不能替其结案。owner已授权缺凭据先用Mock/其它离线方法推进。

## 1. 一句话与架构判断

在已验证的场景GLB上，人物先idle、经真实寻路贴地走到站位，再伸手对准水壶把手，接触时显隐交接给预挂手骨的同资产实例，最后持壶并切到结束镜头。全部流程由现有capability与render-only闭集数据表达；不申请新system/组件或游戏自由代码。优先现有能力重组，拒绝另写“提水壶解释器”。

## 2. 实查能力实名

| 已有provider | 数据职责 |
|---|---|
| a-scene-import-3d | SHA已验证SceneImport3D展开场景、碰撞、导航与出生锚 |
| a1-transform / b1-velocity / g2-relation | 平面sim位置、速度与具名目标 |
| f2-flag / h1-visibility / t2-hitbox | 既有Flag、Visibility与Status provider；不造替代状态容器 |
| t2-navigation-grid / t2-pathfind | 场景NavigationGrid供A*；NavAgent.patrol给独立站位 |
| t1-motion-apply / t2-ground-walk-3d | 积分与量化GroundContact3D高度，角色不用冲突的Transform3D |
| d1-overlap-detect-3d / d-collision-resolve-3d | 原3D碰撞与地形pre/final接线 |
| t2-over-time | 初始idle后移除NavAgent的halt Status位 |
| t2-zone-occupancy / t3-flow | 真到站Flag后推进idle/walk/reach/contact/held阶段 |
| t2-event-when / t2-effect-apply | edge Signal与Commit显隐交接，不在渲染/handler改世界 |
| t2-face-rotate | FaceRotate.source=target，Relation指把手，patrol导航独立，停止后保持正确面对道具 |

表现由现有ThreeRenderer解释Model3D、AnimGraph3D、Attach3D、IK3D、Camera3D/CameraShot3D、Light3D等数据；不是新增capability。当前manifest对部分render组件的既有“无provider”提示必须保留并解释，不能造空provider只为消警。

实查入口：registry及上述provider、movement-pathfinding/events-logic/3d/assets手册；先行CPU证据 `/private/tmp/v1-preflight-research.report.json`。规范JSON→parseManifest→AssetManager的SHA已验证scene目录→Engine，strict=throw三路各360tick，无拓扑/运行时WARN。Zone半宽.03在133tick触发flow.current=reach时仍可能有本拍速度，134tick先停再发布reach Flag/Signal；因此动画与IK读Flag，不能把phase字符串当停止证据。

## 3. 数据规则与解释器

| 规则表/数据 | 现有解释器与边界 |
|---|---|
| 规范manifest（显式capability IDs） | parseManifest，先验闭集/引用，Engine.load不注入私有system |
| SceneImport3D + 验证后的spec.scene | E5/R2，真实GLB碰撞与导航；不从renderer追加sim实体 |
| NavAgent.patrol + Zone + OverTime | 站位和朝向分离，走近不是逐帧手改坐标；到达判据验证实际速度为0 |
| GameFlow + EventWhen + Effect | reach/contact/held具名旗标与信号；接触时隐藏桌面壶、显示已Attach3D的同key手持壶 |
| AnimGraph3D | idle/walk按speed混合，reach Flag进入外部reach clip并保持末姿；不从动画帧反向触发sim |
| IK3D | RightUpperArm→RightLowerArm→RightHand，独立world把手锚；接触后reach链渐退、后列carry链渐入到较高的独立持壶锚，使用既有顺序求解 |
| Attach3D | 手持壶预挂RightHand，开始隐藏；接触前后核实际把手/原生矩阵连续性，不临时挪壶制造通过 |
| CameraShot3D | 既有Signal切场景全景/接触近景/持壶镜头，保持同一原生相机 |

两条手臂链均使用既有闭集weight参数（reach/carry Flag），目标都是独立world锚，不从手持壶反向推目标；持壶锚较初始把手高，需实测真实末端抬升。把手锚保留至IK渐退结束；不随桌面壶隐藏而消失，不将同一条手臂的挂件当其自己的追逐目标。骨骼/把手几何可在离线制作阶段量测并写成固定数据，运行期禁止在renderer里据骨骼反写sim或改流程。测试替身不具备弯腰动作时把水壶放在台面，不伪称已验证地面捡拾；正式动作质量另验。

CPU研究发现zone/event/timeline的组合形成既有软环，选用已实跑无环的t3-flow组合；不压制WARN、改strict或修改引擎定序。数据来源/每个演出阶段、Signal和显隐实际生效tick都要在正式CPU/GPU中重新验证，不直接采信研究报告。

## 4. 代码准入与美术

玩法规则全部L0规范JSON/L1现有capability重组；游戏自由代码例外为零。不改games/game-z、PUI、任何sim/provider、资产公共schema或已结案能力。新增工具只能装载/采样/断言/输出证据，不藏新规则解释器；若确有缺口，先实查并提A/B等owner裁决。

技术预验资产走独立临时目录的AssetIndex→AssetManager→ModelPool，model/hero、motion/idle、motion/walk、motion/reach、model/kettle、scene均是真实消费key。沿resource-manager统一路线，不运行时引共享索引，不写生产skinKey/人审批准。复用已有T5自产17骨GLB与既有Blender场景；可用three已有TeapotGeometry离线导出可辨认的壶作为显式测试替身，来源/哈希/许可记录，不能冒称Tripo或生产美术。真实生产目录、D1拆层和M2.5入库留待真实素材，不捏造approved人门。

本段无主菜单/HUD/结算/新UI：只拍真实3D画面与技术记录，不手写DOM游戏界面。正式Game Z若增加UI，另按house主题/成熟控件方案经PUI复查。无敌人/NPC决策，无对手AI；既定流程不是自建AI。

## 5. 确定性与验收

无新增随机源。sim按固定tick，只使用已有确定性能力；表现采用独立render时钟，双World对照snapshot/full与incremental hash/writeSequence/dirty，不能把tick version冒称写序。使用实际原生骨骼/蒙皮GPU、E3矩阵、IK误差、接触前后连续性、真实像素与公开pick证据；覆盖删/换场景、重复运行、资源归零。不能只检查配置字段或截图不黑。

三层结果分开：①CPU数据接线；②真实GPU技术预验；③真实付费来源/人审与R1。每层报告标明实际完成项，报告不得输出正式V1通过或代签人门。必须提供源码冻结、独立复跑和唯一锚点撤修；给owner可见的真实阶段图/动作序列，清楚标注测试替身。

## 6. 计划评审

待未参与本计划施工的独立评审人核现有组合可表达性、数据边界与验收条件；未获计划评审结论前不写本段实现。


### V1 离线能力计划独立评审（2026-10-21）

复查人：独立复查代理，未参与本计划施工。审查分段锁 `deb7e4024` 下的计划草稿，SHA-256 `c8dbc29a1770ba1b6318ad20b06f5931b096c59abaeb70bb9d20223714cfe10c`；包含 reach/carry 两条同臂链与独立目标锚的最终澄清。结论：现有能力组合可表达此隔离技术预验，方案可进入施工，未发现需先提新增引擎能力的实证阻塞。本结论仅为计划评审，不是整链 GPU 通过、正式 V1 结案或真人 R1 签字。

已实查 registry、实际 provider、movement-pathfinding/events-logic/3d/assets 手册及 IK 契约。19 个显式 ID 为 12 个行为/解释器能力加 7 个场景/基础 schema provider，不存在自动补依赖的假设；Status、Flag、Visibility、Relation 等均使用真实 provider，render-only 组件不补空 provider。

在自有副本 `/private/tmp/apollo-v1-plan-independent-20261021` 独立新写采样断言；施工树 src/scripts 共 1167 文件逐项指纹一致。真实场景 GLB 经 AssetManager SHA 校验，strict=throw 的双 World 连续 360 tick，snapshot、full/incremental hash、writeSequence、dirty 均一致。第133 tick 到区时 speed=.03、reach Flag=false；第134 tick 停步并发布 reach；第195 tick contact Signal 先发布，随后 Commit 完成桌面壶隐藏/手持壶显示。更换面对目标不改变 patrol 全程位置，最终朝向相反；宽 Zone 在131 tick 尚行进时就 reach，证明不能以阶段字符串替代停步证据。

独立原生 Bone 简化试验确认两条同臂链按既有数组顺序生效：30/120Hz 的 reach→carry 切换边界 dt=0 无末端位移，最终独立目标令手端 y=.5→1.1，误差低于 1e-6，无运行时 WARN。这只证明既有求解器组合可行，不冒称真实 GLB、Mixer、Attach 或视觉动作已通过。

对本计划的停步数据保护独立做撤除验红：唯一锚点断言 hit=1，将自有 manifest 的到区半宽 .03 改为 .1，原时序断言确实失败（exit 1，133 tick 已 reach=true）；恢复原始字节并核 SHA 后，最终 1 file/4 tests 全通过（exit 0，failed/pending/todo 均0）。已读完整绿/红日志：保留并解释 parser 的 Transform3D/Model3D/Pickable3D 无 provider 提示，运行时/拓扑 WARN 为0，无压制告警或改 strict。

准入范围保持隔离夹具、规范数据、采样/断言脚本与文档；既有 Game Z/PUI/引擎不改。资产走独立 AssetIndex→AssetManager→ModelPool；可用 TeapotGeometry 离线壶替身，但须记录实际来源/哈希/许可，不冒称 Tripo、生产美术或 approved 人审。桌面取壶与固定离线标定合法；运行时骨骼不得回写 World，目标不得依赖自身手持挂件。本次 paid provenance=false，真实付费来源、授权动作、生产质量与真人 R1 仍未验证。

后续整链验收须兑现计划已有边界：在多个 render 时钟及多 tick 追赶下，实际 GLB 动作末姿、IK 抬升、同 key 双实例首次显现、接触前/当帧/后的原生把手与挂件矩阵及像素必须证明连续，禁止接触时挪壶补齐；同时验证世界只读、生命周期与资源收敛。若实证无法用现有数据达成，先报告具体反例并由 owner 裁 A/B，不能在工具里藏规则或先修引擎。本评审未启动 Blender、付费服务、GPU 或全量门禁，也未修改施工/用户树或提交推送。

独立证据：`/private/tmp/apollo-v1-plan-independent-cpu.json`、`/private/tmp/apollo-v1-plan-independent-cpu.log`、`/private/tmp/apollo-v1-plan-independent-red.json`、`/private/tmp/apollo-v1-plan-independent-red.log`；锚点与恢复指纹为独立副本中的 `v1-independent-anchor.json`，源对账为 `v1-independent-source-fingerprints.json`。

施工细化：场景资产统一使用既有研究数据的key `scene`（导入实体id仍为courtyard）；计划初稿的model/courtyard仅为键名，所有实际消费同步使用scene，不增加语义或能力。
