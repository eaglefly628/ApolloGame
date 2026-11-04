# 动画生产线阶段报告

## 当前权威状态（2026-10-29）

- None 完整帧母版 2445/2445、动作 GLB 2445/2445、复用 Skin 108/108；最终全库验证退出 0，缺文件、来源 SHA 失配及转换失败均为 0。真实素材与逐文件证据仅留本机。
- owner 已确认当前播放样本不再歪斜；这是样本视觉反馈，不代表全部动作 × Skin 组合已验收。
- 当前同时推进 M2 的 Description 主导标签分类和 M3 的完整目录、分类核对与预览优化；首批只读来源草稿索引与全目录界面已实现，等待 Claude 独立复查。标签修订持久化、全库语义精度复核和 M4 消费升级尚未完成。
- 六模块范围、当前状态与阶段复查入口：[`motion-line-scope-2026-10-29.md`](../design/ai-pipeline/motion-line-scope-2026-10-29.md)。下文保留历史阶段记录，旧库/旧批次数量不得当作当前 None 库进度。

## owner 顺序与裁决

先完成全部角色下载并回报，再推进动画生产线。M1～M5 已选 A；M6 本会话明确选 A。后续顺序：M1 独立复查及全骨骼映射 → M2 → M4 → M5 剩余 → M3（依赖 M1 PASS）→ M6。各单仍有独立复查门及人工预览、标签确认门。

## 下载阶段：完成

| 类别 | 实测数量 | 主文件总字节 | 复核 |
|---|---:|---:|---|
| 官方角色（T-pose，无动作） | 108 | 3,836,034,336 | 全部文件存在、FBX 头、大小、SHA-256、JSON/CSV/中文索引通过 |
| 动画（无 Skin） | 2445 | 1,206,956,368 | 全部文件存在、FBX 头、大小、SHA-256、JSON/JSONL 目录数量通过 |

角色目录：`~/ApolloAssets/mixamo/characters_mesh/`。另保留此前 Amy 的一份重复原件，因此实际 109 个角色 FBX、3,865,014,448 字节。角色完整保留网格、权重、骨架、材质与纹理原始字节；不把结构检查当作全部视觉导入验收。本轮续传没有遇到网站限流或安全拦截。

实际动作数是 2445；派工单中的约 2500 不作为已下载总数，也不据此证明已覆盖网站全部动作。未改动画文件或原清单。未为本次全量下载修改仓库下载工具，采用用户要求的官方网页逐项点击。

## M1：已修复并独立复查 PASS

`21ad2afa9` 保留 STEP/LINEAR 插值，拒收需要离线归一的曲线；共享采样时间核验已补齐。原约17.7°提前转动复现消失，两处独立撤修验红通过。M1 已从需求池删除。

## 实施进展（2026-10-27）

- 骨骼数据：108个角色、7298根骨骼、40类骨骼组合已提取；全部可对应17根必备骨。17个角色的静止手臂姿态仍需复核，不把请求T-pose当成实测T-pose。
- M2：Y Bot / X Bot 及首个呼吸待机动画已真实转为GLB，原件SHA不变。真实FBX常量曲线等导出差异已修复；2445个原件结构全库扫描全部通过，SHA失配/缺文件/拒收均为0。完整360度转身回归独立复查PASS。全量转换尚未完成。标签来源与默认值在本机旁证中明确标注，尚未人工确认。
- M3：首版只读预览台已显示真实角色并经引擎原生链播放呼吸待机。筛选/分页/暂停、任意Skin选择与亮暗主题审计已验收，两个Skin×三个动作实机可播，13项独立复跑与两处锚点验红通过。
- M4：确定性元数据检索与skill独立复查PASS，25项复跑与两处锚点撤修验红通过。语义/视觉准确性不在该结论内。
- M5：本地裁剪、镜像、补循环与Blender作业接线已完成。独立复跑23项（含2项真实Blender），骨架保护/待审状态两处撤修均转红，恢复后全绿。远端滑杆协议尚未核实，未进行远端接口下载。
- M6：原生IK与挂点烘焙首版已完成，独立复查PASS；真实idle×YBot右臂IK候选31帧与运行时偏差小于1e-7米/弧度。无人工配方回执仅产生候选，不自动批准动作。M3/M4/M6工具验收通过并出池，M2全量转换及M5未核实部分仍保留。

## 本地文件整理

Downloads中的109份已核实重复角色移入可恢复废纸篓；16个额外FBX原件移入 `~/ApolloAssets/mixamo/unreviewed-downloads/`，独立清单记录SHA，未混入已验收库。Downloads已无FBX。其它下载文件未动。

## 验收边界

新工具仍需通过最终全量门禁、复查与真实组合验收后才能宣称整体完成。每项完成验收后在同一提交从需求池移除。原始素材和转换库不进入仓库；Git只保留工具、测试、骨架数值与文档。

## 本轮代码门禁

最终scope=full退出0：695测试文件，7606通过、2默认跳过；两个真实Blender变体专项此前单独启用通过。tsc/build/守卫通过。已读告警：大bundle警告、game-a/game-c两条存量美术死账WARN（门禁允许退出2）；不把这些告警隐藏为零问题。

## 整库执行接续（2026-10-27）

整合版 a4bef4211 已经新的独立复查：368项focused通过，另单独启用实际Blender23项全过，两处隔离撤修验红且恢复。批次包装器的旧报告误计数问题已实证修正并通过七项报告边界探针，才启动转换。

全量本地转换现已实际启动，单进程、每批40项，先108个Skin（跳过验证通过的已有项），再2445个动画。所有新标签固定draft；失败项单列，不自动批准M6视觉或动作质量。

- 本机实时入口：`~/ApolloAssets/motion-lib/.batch-runs/current.json`，指向本次独立运行目录及status.json。
- 每批JSON/日志、执行器源码快照SHA、启动前catalog精确字节快照、最终validate日志均保存在该运行目录，不进Git。
- 全局runner锁与现有ingest锁防碰撞。恢复前先查进程；已有输出须整库校验后才跳过，不自动删除残留锁。
- 每批核对来源清单与标签文件SHA，报告的成功/跳过/拒收ID必须恰覆盖本批且无重复；旧报告或进程/报告不一致立即停止。
- 磁盘启动时约484GiB可用；低于20GiB则在下一批前停止。原始FBX不覆盖、不删除。

静态文档不冒充实时完成数。当前进度以本机status、catalog和批次报告为准；只有全批技术转换和最终validate都成功，才可称转换阶段完成，人工标签与动作质量批准另行保留。

## 转换中发现的补齐项

- 当前活跃转换持续固定使用motion-line工作树的已审代码；新增兼容/预览/下载保护补丁在motion-compat独立工作树验证，未热切换转换器代码。
- 108个角色的标准化首轮结果为107成功、1拒收。拒收官方名称Ty（内部材质/对象名Boy01），原因为合法KHR_texture_transform贴图UV偏移。受限静态Skin补丁已独立复查通过，原FBX与GLB SHA未变；独立样片脸部贴图可见，但Ty尚未补入主库，等待当前批处理释放所有权后显式重试。
- 真实Ty预览发现固定镜头裁头，已补真实restmesh包围盒取景；复用Camera3D字段，未改引擎。独立32项复跑、两处撤修验红、实际Ty样片通过。动画根位移后的跟随及resize重新取景尚未提供。
- 未发布M6候选原先不能直接用M3查看，已补只读review catalog准备及命令，主库/回执/ingest锁不动；独立复查通过。
- M5下载工具四项安全承诺已补硬边界（min4000ms/max40、各下载阶段401/403/429立即停、物理仓库与路径别名拒写、诊断不回显凭据），60项测试及独立对抗/两锚验红通过。未执行真实网络下载或读取真实凭据。远端滑杆范围及导出协议仍未核实，不能宣称该子项已完成。

另制作了实际“擦火柴”IK候选：3秒、30fps、91帧，基于已入库idle+YBot，用左手持盒锚及右手约5.6cm短划轨迹，原生淡入淡出。仅CPU烘焙，原生/烘焙偏差小于1e-5，无receipt、未发布。配方范例见 `docs/design/ai-pipeline/examples/match-strike.recipe.json`；未做手指捏握、腕朝向约束、道具几何或火花，不称艺术动作已合格。素材和样片保持在本机review目录。

本轮补齐门禁：独立motion-compat工作树scope=full退出0，697个测试文件、7695项通过、2项环境开关默认跳过；TypeScript和构建通过。告警仍为大bundle及game-a/game-c既有两条美术死账WARN，已读取。代码合入主线后，不在运行中更换motion-line转换器；Ty重试及最终全库计数必须等当前批处理结束后执行。

## 2026-10-28 · 减帧对照组收尾与完整帧重建

- 旧批次进程已退出但锁/状态遗留；独立核实两个PID均不存在后，锁与原状态移入恢复证据，不删除原件。43项接续成功，sumo长动作以600000ms预算成功；Ty兼容修复补入。最终原始动作2445、派生1、Skin108，validate计2554项通过。旧组保留draft，不代表视觉质量通过。
- 本次发现非均匀减帧的关键间姿态明显失真。男118900901在同一转换/引擎下，Non-uniform最大躯干48.1677度，None10.0934度，Uniform10.0499度；Uniform相对None仍有右趾端约4.37cm、右脚约11.62度最大误差。Uniform原FBX只省0.687%，三GLB大小相同；不以单样本背书整库Uniform安全。完整对照证据在本机 `/private/tmp/motion-briefcase-three-way-summary.json`，三列冻结第49帧预览仅在本机review库。
- owner决定：None、Without Skin、30FPS重新获取全体动作并转换；108Skin复用。已核验的2份原None直接复用，男转身新None已入独立库；其余继续逐项官方UI下载。先完成None母版，M7内部自适应减帧后置。
- 隔离：旧原FBX `~/ApolloAssets/mixamo/`及旧GLB `~/ApolloAssets/motion-lib/`；None源 `~/ApolloAssets/mixamo/full-frames/`，None库 `~/ApolloAssets/motion-lib-full-frames/`；Uniform试验 `~/ApolloAssets/mixamo/uniform-review/`及 `~/ApolloAssets/motion-review/uniform/`。不覆盖旧源，不把减帧文件当None母版；每项有设置/源SHA/作业和输出SHA。
- 工具补可选超时预算，独立62项复跑及两处唯一锚点撤修验红通过；完整门禁7716通过、2跳过，全部guard/build通过。原默认临时目录的macOS别名与缺省Linux浏览器路径造成3个环境失败，改用真实Chrome和规范/tmp复现79项通过；高负载下单个已有实算测试5000ms超时，降低并行度后全量通过，未放宽断言/超时。既有bundle体积与game-a/game-c两条死账WARN已读。
- 持续任务已由应用保存为 `mixamo-none`，只推进本轮None重建，读取外部断点并避免重复启动；普通超时先查落盘再退避，401/403/429/验证码/安全拦截不绕过。

## 2026-11-01 · M3.5运行接线与节省上下文断点

本轮owner授权新增完整影视Locomotion/动画驱动，范围与分批验收见 `docs/design/ai-pipeline/motion-driver-m35.md`。D1代码已推 `3758f5240`，D2纯混合/步态/扫掠及线性XZ派生工具已推 `c54c1155b`，D2运行接线已推 `22e2b25a2`，该运行批已过独立CPU/GPU与scope=full（8523通过、2跳过，exit0）。完整D2及D3–D6未标完成。

- 活跃代码目录：`/private/tmp/motion-mink-stage-20261029`，分支 `codex/mainbranch`。注入的旧motion-semantics-next工作树有他人在途修改，不checkout/reset/stash/clean；只有当前stage做发布。`node_modules`只是本机未跟踪symlink，不提交。
- 运行合同与局限：`docs/design/ai-pipeline/motion-driver-d1.md`、`motion-driver-d2.md`。phase -1将motor与可选动画一起原子提交；22诊断晚期外写。仅单motor+静态AABB，真实脚滑、坡阶、分层、通用根运动、交互足锁、导演/工作台仍须接续，不重复索取已授权引擎A。
- 精确运行复核：`/private/tmp/m35-d2-runtime-root-freeze.json`与`m35-d2-runtime-review/verdict.json`；renderer复核`m35-loco-render-independent.json`；GPU`m35-locomotion-gpu-independent.json`。依赖各自冻结独立签署，不能以一份PASS代全部范围。生产源码冻结后完整门禁`m35-d2-runtime-full-gate.log`已exit0。
- D2c校准：`/private/tmp/m35-d2c-calibration/freeze.json`、`trial-v006/report.json`；最终独立数值审`/private/tmp/m35-d2c-calibration-independent/final/review.json`。13作者测试、100独立仿射对照；修低fps空pair、预算、路径别名漏洞。8真实小样本5数值过、3失败；Foot/Toe四骨位置回放不是全骨/mesh/接触/循环批准，原catalog/None/Skin不改。
- D2c绑定：`/private/tmp/m35-d2c-binding/CONTRACT.md`及`freeze.json`，非施工人报告`/private/tmp/m35-d2c-binding-review/verdict.json`。32测试窄PASS，仍只有校准artifact声明，缺真实bounded读取/SHA/scope验收，不能接成已审核质量或当作已注册能力。
- D2c地形：`/private/tmp/m35-d2c-ground/DESIGN.md`、`report.json`和Python原型。11自测、2自撤修；凸prism半空间包络，面内可认证、棱角uncertain拒支撑，不代精确capsule-hull通用CCD；尚待异人审，不进生产。保留exact AABB fastpath。
- D2c足锁：`/private/tmp/m35-d2c-footlock/`，native E4原型处理中，失败版本保留。原3脚滑FAIL可被端点锁降到2cm门内，但reach/fade、toe相邻角及loop seam尚未全部通过，不能发布为ready。先读最新report与作者freeze，不盲用旧结果。

接续优先：先把已验运行批推送给Claude复查并保护本地断点；再闭合target绑定的实际artifact校验、源接触/循环审查、足锁/真实多Skin画面、坡阶体积碰撞。随后做D3分层/动作段、D4根运动、D5影视交互、D6导演与工作台。临时试验没有独立门或真实质量凭据的一律留candidate，不以整理清单冒充完成。数据只留本机ApolloAssets/仓库外，不上传或覆盖母版。

## 2026-11-02 · D2c源素材、足锁与审核文件实证

本批只推进仓库外离线候选；生产运行源码仍为 `22e2b25a2`，未注册新组件或把候选自动入库。原2445个None动作、108个Skin及catalog均不修改。账户额度余量按owner指明为使用额度，复用不变范围的既有证据，不重复整库门禁或下载。

- **源问题已追溯**：`walk-forward-128620917`的LeftToeBase在offset26/27分别约1.97762/1.96541rad突跳。Blender真实导入原FBX（SHA匹配catalog，action帧1–31）与None GLB、planar派生、M1目标派生同帧复现；不是后面几步新引入，不能因此断言所有源素材有问题。证据 `/private/tmp/m35-d2c-source-audit/{fbx-report.json,report.json,freeze.json}`。Blender受限启动曾崩溃，本机权限重跑exit0；仅读原件、输出临时报告。
- **替代行走8份数值候选**：筛查16条短Walking GLB后，`walking-100460901`与`walking-117840901`各在Y Bot/Claire/Amy/Sporty Granny上经原根分离→标定→原生E4足锁。8份均通过原2cm/200ms、相邻角、接缝数值条件，最差1.464cm/200ms；不删帧、不放宽阈值。源文字分别为Male Happy Walk、Walking With A Swagger，不能当中性行走已审标签。报告 `/private/tmp/m35-d2c-walk-alternative/compact-report.json`。根分离全骨世界位置重建误差<1.57e-7m，不等于全TRS/mesh/视觉批准。
- **独立复跑与撤修**：固定v1足锁副本的8个真实输出SHA及完整数值结果与作者逐项一致；独立副本禁用E4配置后比较转红，恢复后绿，原始资产SHA不变。判词 `/private/tmp/m35-d2c-walk-independent/verdict.json`只签数值复跑。作者另以v2重算8份仍为候选，见 `trial-fixed-v001/report.json`，该增量未冒称独立视觉/全流程复审。
- **稀疏轨道残留已修**：独立复查先以真实E4复现缺旋转轨道骨骼保留IK修改，旧判词FAIL保留。v2在首次采样前捕获全Bone静态TRS/matrix，每次源采样先还原，再让native动画写有轨道属性。9作者+4独立测试通过，同帧及前进帧均恢复，撤掉新增还原步骤转红/恢复绿。判词 `/private/tmp/m35-d2c-footlock-independent/v2/verdict.json`，core SHA `75f524cb56f06d0edd8c5c53ef2a0ffdfb3369be749bbb7beebc718ef188e6cf`。原8样本v007对v006状态/滑移/输出SHA不变，4条旧walk失败没有被提升。
- **实际审核文件校验已补**：`/private/tmp/m35-d2c-binding/calibration-artifact.ts`使用同FD、256KiB限制、前后stat及同字节SHA读取闭集规范JSON；绑定实际profile/skin/selector/scale/rest/source身份。numerical/loop/visual各scope凭据须来自调用方独立可信SHA pin并实读核验，draft/fail/unknown不能升审核通过；外部可信审核台账仍是信任根，工具不产生质量审批。独立50测试（44原+6新增）、源码类型检查、两处唯一锚点撤修红/恢复绿通过。判词 `/private/tmp/m35-d2c-artifact-independent/verdict.json`；reader SHA `241fb31367b10799bf73b951ce0d54c513f33fe0c49dafee2aaef2d2d77483da`。旧identity gate仍只作身份诊断，不能代新审核入口。

**持久断点**：已创建 `~/ApolloAssets/motion-review/m35-checkpoint-20261102-d2c/`，376文件、137758281字节，`checkpoint.json`逐文件SHA核对；包含本批工具、旧FAIL、新判词及候选。之前标定输入保留在 `m35-checkpoint-20261101-runtime8523`。不复制node_modules/.git/symlink；部分脚本保留绝对tmp导入，恢复时须还原对应路径或显式重绑并重算冻结。全部仅本机，未上传数据。

**尚未验收**：真实多Skin画面/mesh/解剖与接触质量、可信审核台账及生产renderer绑定、一般坡阶碰撞；D3–D6仍未完成。数值候选不是完整D2或M3.5完成。接续时从本批新冻结与独立判词读起，不能复用旧足锁FAIL版本充当已修版本。

## 2026-11-02 · M3.5 联合接线

本批已施工：D2c实际模型SHA/静止骨架/选择器/比例绑定；D1参数AND/优先级/真实clip完成转换；D3权威蒙太奇与native骨骼分层；D4纯根轨迹与motor原子接受、配对资产实际SHA；D5具名手Socket、Socket目标IK/LookAt、performance槽位权重及真实morph表情接口；D6同World导演会话与`/driver/`工作台；动画事件通过独立Cue→Signal桥接既有效果系统。新组件完整进入protocol/组件映射/capability registry/导入、直接载入与快照恢复校验。

独立范围复核：D3原生分层83项与4次定点撤修；D4纯核26项加独立有符号分数位移oracle2项；D4/D5/Face原生接缝109项；box-step/Face辅助逻辑118项与3次定点撤修。独立GPU覆盖根位移受墙阻、实际morph变化、双演员Socket目标及恢复一致性，未从renderer写World。撤去Socket末端朝向后CPU现有集未检出，独立GPU检出实际grip位移/朝向错误，恢复后GPU通过；只计后者为该检查的有效验红。所有本机判词/截图/素材仍为本地证据，不入Git。

真实Y Bot/Claire/Amy/Sporty Granny的6秒连续走/停/挥手profile与原始资源严格隔离；工作台实际浏览器完成播放、暂停、单帧、定位、reset、换profile，每次保留一个canvas。真实GPU通过只证明该有限样本的加载和操作链，不升级标签审核或全体型艺术质量。

总项仍in-progress：完整坐下/起身/交互场景、多Skin足部/穿插画面、已制作双人抱持动作及一般斜坡尚未整体验收。共享锚不代替双人承重求解。全门禁与提交编号以随后追加的实际结果为准，不能把这些范围测试加总冒充全量测试结果。

本批最终共享门禁退出0：782测试文件、8929测试通过、2跳过，类型检查、lint、依赖/模拟域围栏和build通过。已读告警：能力形状为存量在案、既有game-a/game-c美术台账缺件，以及构建大chunk提示；未出现新定序环或依赖越界。阶段源码复查入口见 [M3.5联合接线复查单](review-m35-driver-joint-20261102.md)。最新源码、四角色候选和逐项判词已保存至 `~/ApolloAssets/motion-review/m35-checkpoint-20261102-driver-joint/`，真实数据不入Git；全项保持in-progress。

## 2026-11-04 · 原作故事预演与 Seedance 参考包

owner确认视频平台为Seedance／即梦。复用D6导演台与现有动画能力，新增可选故事章节元数据及逐章连播；原生动作未就绪时不推进、手动操作/错误取消连播，切章重建Engine，属于硬切预演。未新增游戏层系统，也未将全M3.5或完整电影标为完成。

本机 `~/ApolloAssets/motion-workbench/match-girl-story-20261104-v001/` 保存10章75秒草模、9份GLB派生/副本、10张逐章初始姿态构图图、来源校验记录与8项未提交的Seedance作业，23份文件15862922字节经复制SHA核对（另附package-verification.json）。2445份None母版、108份Skin、原catalog不改；Git只提交代码、测试与文档。构图图不等于动作视频参考，referenceVideo仍为空。浏览器实际从第一章连播至第十章末并停下，逐章原生基础就绪；LookAt两章与双角色两章亦装载。

按安徒生原作保留火炉、烤鹅、圣诞树、流星、奶奶与清晨离世结局。Claire是成人占位，快乐行走并非悲伤表演，坐地并非冷颤，奶奶站立并非抱起/升空，场景为白模。擦火柴v022仍保留candidate-rejected-technical及碰撞失败，不能从表意认可提升为接触批准。初版树Mesh宽度缺失导致NaN，v004已修并在真实浏览器重新渲染；装载瞬间附件/IK等待模型的告警保留，原生就绪后才播放。

独立builder复核含源目录写入防护修复、11测试与两次唯一锚点撤修红/恢复绿，v004全部10profile及12输入/9资产SHA核对。连播独立32测试、nativeReady和暂停取消两处撤修均红/恢复绿；另检出加载中暂停按钮禁用，作者已补条件和回归，由非作者复验。完整门禁/最终判词以本轮随后实际结果为准。

即梦创作页已核实为未登录，已交用户登录；未上传原FBX/GLB，未提交生成、付费或声称视频已完成。最终小女孩造型一致性、生成视频审核、镜头转场与成片回接仍待实际完成。

本轮最终门禁 scope=full exit0：784测试文件、8960通过、2跳过，tsc/lint/依赖围栏/build及文档守卫均通过。首轮默认环境有浏览器探测/临时目录错误与worker超时，保留失败日志；改为本机Chrome、TMPDIR=/private/tmp及4线程后原检查原断言全绿，无放宽。已读存量构建大chunk、game-a/game-c美术台账死账WARN，以及测试happy-dom关闭期间的本地3000端口fetch/abort stderr，未计为未处理测试错误。最终连播独立34项（33作者+1独立回归）通过，加载暂停修复撤掉红/恢复绿；技术限定PASS，不签艺术/成片。源码将随本轮提交推送codex/mainbranch供复查，数据保持本机。
