# REQ-3D-AI-PIPELINE · E4 IK 交付导航

> 施工主体：Codex；分段锁8e225687d（2026-10-21）。依赖E2独立复查dd0374031、E3独立复查34199bb4f。本页是施工导航，不是复查判词；不签真人门、不自判PASS。未启动Blender、未调用付费API，不改游戏/PUI或旧工单。

## 做了什么

`IK3D{chains,lookAt?}` 为动画后的纯表现修正：双骨解析解对准实体/骨骼局部偏移，lookAt使用骨骼局部+Z。weight可以是0..1常量，或同实体AnimGraph3D的speed/Flag参数与线性fade；目标变化可从当前权重中断过渡。装载拒未知字段、坏链/权重、无有效Model3D的载体与不存在/State字符串参数绑定，允许目标动态迟到。

每帧恢复上一帧IK私有四元数，再采样原生动画，刷新E3挂点，先lookAt再按数组顺序解链，逐链读取目标前重算挂件，最后刷新挂件、拾取与相机。第二只手可对准第一只手持物上的把手；不将上帧IK累计成下帧动画，不反写sim，不动共享模板/另一实例。共同祖先可非均匀/剪切，双骨本地路径要求正均匀TRS；在root.parent共同坐标系求解，不用world TRS近似替代完整矩阵。

目标支持具名唯一Bone、实际drawable矩阵、实例批最终pose及无绘制Transform3D点锚。拒隐藏/缺失目标、失效Attach目标的旧base回退、自追逐骨骼后代与非有限/投影矩阵；同实体其它骨骼分支可用。缺失与拒收一次WARN，不逐帧刷屏；状态按实体/实例代际与最多16链收敛。常量0逐字段保留原动画，不正规化原四元数；不可达取可达域最近点。静止最终姿态收敛后停止重绘，恢复最后一帧仍更新画面/阴影。详细闭集与实查见 `docs/design/ai-pipeline/inverse-kinematics.md`。

## 改动面（文件清单）

- `src/engine/protocol/components/ik3d.ts`、`ik3d.test.ts`、`render.ts`；`src/assembly/component-map.ts`、`component-universe.gen.ts`、`scripts/component-manifest-baseline.json`仅登记IK3D。
- `src/assembly/inverse-kinematics.ts`、`inverse-kinematics.test.ts`、`scene-import.ts`、`validate-manifest.ts`：装载前后、sync/async/direct、无provider提示；不加sim system。
- `src/net/determinism.ts`、`inverse-kinematics.test.ts`：NON_DETERMINISTIC与完整/增量hash、真实Bone/Mixer CPU边界。
- `src/renderer/three/{two-bone-ik,inverse-kinematics,ik-params,ik-targets}.ts`及四份同名测试；`src/renderer/three-renderer.ts`最终时序、签名、拾取与销毁。
- `scripts/verify-inverse-kinematics-browser.mjs`、`scripts/fixtures/inverse-kinematics/browser-probe.mjs`；本页、IK契约、3D手册与3D总单状态。

## 怎么自己验

1. `ik3d.test.ts`20项：闭集对象/tuple、访问器、洞/超16链、同名骨、type、weight与fade有限范围、空chains须lookAt。`assembly/inverse-kinematics.test.ts`14项：有效Model3D、同体Graph speed/Flag引用、迟到目标、sync/async/template/direct原子拒收与E5前后校验。
2. `two-bone-ik.test.ts`15项：可达误差与段长/pole、近/远不可达、退化平面/同点、1e-200..1e200与1e308可表示重建；`three/inverse-kinematics.test.ts`17项：真实Bone/Mixer、非均匀共同祖先、静态中间节点、局部坏尺度/剪切拒收、精确weight0、渐入中断、移除恢复、代际缓存、独立实例、双手E3更新、自追逐拒收、lookAt和10k帧有界。
3. `ik-params.test.ts`10项复用E2读取speed/Flag，不重新定义参数语义；`ik-targets.test.ts`11项检查局部offset/完整剪切、唯一Bone、实例批/无绘制点、隐藏/失效不回base、原生父可见性与传递Attach依赖、非有限/投影/getter。原始World调用也不污染dirty。
4. `net/inverse-kinematics.test.ts`6项：IK增加/改写/删除不改完整/增量hash，实际sim字段仍敏感；双World各10k真实Bone/Mixer/IK与参数桥/目标解析CPU更新，每步snapshot/hash/writeSequence/dirty不变。这是CPU边界，不冒充完整GPU。
5. `RENDER_PROBE_CHROMIUM=<固定Chrome> node scripts/verify-inverse-kinematics-browser.mjs <已有T5 run-1目录>`：十阶段正式AssetIndex→AssetManager→ModelPool→ThreeRenderer实际GPU，运动walk/reach、lookAt、weight0/Flagfade、双手道具目标、不可达、隐藏/换代/驱逐与销毁。用真实boneTexture RGBA/FLOAT读回、实际上传矩阵/像素/阴影/拾取交叉验证，不仅查询handle。

新增7测试文件共93项全部通过；数据接缝/已有回归8文件98项、解析/适配2文件32项、目标11项分别实跑退出0，重叠项不累加为新增数量。

## 撤修验红

只撤额外临时副本，每处先断言唯一锚点hit=1。baseline0→撤修1→恢复0，红灯来自具体断言，不把编译失败/超时当验红；正式施工树和用户工作区未撤修。

| 范围 | 撤修与实际红灯 | 证据 |
|---|---|---|
| 数据/装载/hash/参数桥25处 | 闭集/tuple/有限/数量/不同骨、参数源、入口前后、hash排除、raw getter/readView/共用E2投影等；对应拒收/原子world/参数与hash断言红，恢复50/50 | `/private/tmp/apollo-e4-data-red-j1_qb3l2/report.json` |
| 解析/原生适配16处 | 可达域、极值归一化/1e308重建/pole、0weight、共同父逆、本地尺度、依赖、+Z、逐链E3、恢复/fade/mid坐标/slerp/代际；真实AssertionError及failedTestNames齐全，逐次恢复32/32 | `/private/tmp/e4-ik-mutations-20261021/report.json` |
| 目标解析8处 | world Visibility、局部offset、原生父隐藏、失效model不回退、唯一Bone、传递Attach依赖、投影矩阵、raw getter；逐次恢复11/11 | `/private/tmp/apollo-e4-target-red-ihko931w/report.json` |
| ThreeRenderer真实GPU3处 | 取消IK消费：RightHand误差0.886411m；取消最后E3sync：`attachment lagged final IK bone: grip matrixError=2.018432...`；取消点锚Visibility：`Hidden point target did not restore native pose`。各撤修退出1、各恢复完整十阶段退出0 | `/private/tmp/apollo-e4-renderer-red-ymeanrkj/report.json` |

### 实证发现后的修补

首轮GPU报告 `apollo-e4-browser-1nfza0/report.json` 已真实发现：无绘制点锚挂Visibility false，手臂仍朝旧点求解。入口补沿只读World的Visibility判断；CPU永久回归与GPU同一隐藏→显示恢复场景重新通过，并做上述独立副本撤修0→1→0。纯解析极值自证发现root=-1e308/mid=1e308/end=target=0的可表示结果在中间位移溢出被误拒，补溢出时缩放域重建，常规路径不变；对应永久回归及撤修锚点在16处记录内。

## 门禁与真实证据

实际scoped --run：eslint0，depcruise1，仅已有 `games/game113/guide-art.ts → src/assets/asset-index.ts`；末行 `❌ 门禁失败于 depcruise（退出码 1）`。没有改game113或扩大基线。

| 步骤 | 退出码 / 实测 |
|---|---|
| eslint / depcruise | 0 / 1（指定基线） |
| sim-DOM fence | 0 |
| 原生spritegen node:test | 0，5/5，不用Vitest制造NoSuite |
| tsc | 0 |
| full Vitest | 1，6902/6903，654个实际文件仅指定depcruise-fence断言1例红，pending/todo0 |
| build / docs-ref / context-budget | 0 / 0 / 0 |
| art-ledger-guard | 2，既有game-a art-03/game-c art-017缺文件WARN；旧黑户基线未变 |

完整续跑器退出0；末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。日志 `/private/tmp/aiflow-e4-final2-{complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native}.log`、机读`-vitest.json`/`-steps.json`；maxWorkers4/minWorkers1、原断言/超时未改。首轮忘设本机Chrome路径，多出golden-shot/render-probe两项NO_BROWSER环境对照失败，未豁免；固定实际Chrome后重新跑完整计划才得到上述结果。告警另存`/private/tmp/aiflow-e4-warning-inventory.txt`；已有故意topo环、Vite大chunk、HappyDOM本地连接拒绝保留，未出现Unhandled Errors汇总。

最终施工GPU报告 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e4-browser-mw4Via/report.json`，同目录load/reachable/targets/unreachable实机PNG。静态末端误差3.535e-8m，原生walk/reach各6帧最大4.631e-8m，真实boneTexture调色板读回误差0；lookAt +Z dot1。零权重全部骨骼position/quaternion/scale与无IK精确一致，40暂停帧无积累，12帧无Graph旧AnimState3D也相同。Flagfade `.25/.5/.375/.53125/.84375/1` 原生四元数误差全0；局部offset、先右后左的Attach把手及Bone目标约3e-8m。不可达方向dot≥.999999976，有限且邻近目标无翻折。

最终骨骼之后的30次挂件完整矩阵误差0，GPU矩阵最大2.222e-7；15次独立原生几何世界AABB/公开pick均通过。2k完整sim hash一致，2148次渲染纯读检查，静止2k帧实际绘制0次；steady9geometry/13texture/nativebuffer42不长，5轮重载7/13/buffer32有界。销毁前91createBuffer/91deleteBuffer、live0，12自有map各dispose1且nativeGPUAllocated=false；destroy geometry0/texture0/contextlost=true。47条诊断8种精确预期消息，steady无新增，其余WARN/error仍失败。

冻结23个本段源码/测试/脚本SHA清单 `/private/tmp/aiflow-e4-frozen-sources.json`；最终探针SHA verify `ee03fe51f2f95e86fb64b6491364f6023dddb768768e1a0c318062ec455da76e`、fixture `e19d1ac8d5fc9b6116e2867c721bb0febdc341980d81713645326a159ddbdc29`。

## 已知局限 / 细化口径

- 使用现有T5 generic-blender-fixture与简化道具/把手，非生产人物或水壶。ARP/Mixamo/Tripo真实来源/授权/质量均待验，三个paid flag保持false、blenderStarted=false，不以Mock冒充真实付费链路或V1结案。
- 双骨仅支持正均匀本地TRS；共同模型祖先非均匀/剪切可用。lookAt局部+Z，不带自由轴/表达式；参数binding与fade是既定E2驱动weight的闭集细化，不扩sim能力。
- 未增加肌肉/关节角限制、全身IK/脚底锁定/多轮迭代；不可达取最近可达点，动作自然度与正式角色仍需R1盲审。E6/V1另段施工；人门未签。

## 交叉复查

待另一位独立复查人对冻结提交执行独立复跑、撤修验红、实证与读告警；施工方不填写通过判词。
