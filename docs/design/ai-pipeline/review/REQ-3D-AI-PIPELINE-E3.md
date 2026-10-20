# REQ-3D-AI-PIPELINE · E3 骨骼挂点交付导航

> 施工主体：Codex；分段锁 d15dcef60（2026-10-21）。依赖E2已独立复查dd0374031；本段仅施工导航，不签人门、不自判PASS。未启动Blender、未调用付费接口，不改游戏/PUI/旧工单。

## 做了什么

`Attach3D{parentId,bone,offset,rot}` 接在骨骼动画之后，读取父模型当前具名Bone，合成局部偏移/旋转与原挂件缩放。实际绘制使用完整矩阵，保留非均匀父缩放造成的剪切，不把world位姿反写模拟。

父模型缺失/不可见/迟到时挂件隐藏且可恢复；骨骼缺失/歧义时一次WARN回父模型根。父模型本身可挂到更上一级；装载拒已知环，绕装载的坏图仍安全隐藏与诊断。移除挂点恢复原数据位姿，表现资源仍由原模型/mesh池持有，没有把子资源重挂进父模型的生命周期遍历。

ThreeRenderer沿原几何/材质工厂创建挂接Mesh3D单对象；退出挂点后恢复原实例化条件。单对象池改按本帧实际单对象集合清理，避免同id单体→实例批/模型后旧mesh残留。骨骼挂接后的位姿进入相机/阴影/拾取；隐藏挂件删旧拾取盒。模型池新增无加载/pin的实例查询。详细语义/实查/边界见 `docs/design/ai-pipeline/skeletal-attachments.md`。

## 改动面（文件清单）

- `src/engine/protocol/components/attach3d.ts`、`attach3d.test.ts`、`render.ts`；组件表 `src/assembly/component-map.ts`、`component-universe.gen.ts`、`scripts/component-manifest-baseline.json`（仅登记Attach3D）。
- `src/assembly/skeletal-attachments.ts`、`skeletal-attachments.test.ts`、`scene-import.ts`、`validate-manifest.ts`：sync/async/direct装载与展开完成后校验；不加sim system。
- `src/net/determinism.ts`、`skeletal-attachments.test.ts`：render-only组件hash排除与模拟敏感性。
- `src/renderer/three/skeletal-attachments.ts`、`skeletal-attachments.test.ts`；`src/renderer/three/models.ts`、`src/renderer/three-renderer.ts`。
- `src/renderer/three/batches.ts`、`batches.test.ts`、`geometry.ts`、`render-hygiene.test.ts`：本段回实例批路径实证出的自有纹理/原生实例buffer释放与材质数组去重；不改变共享资产缓存归属。
- `scripts/verify-skeletal-attachments-browser.mjs`、`scripts/fixtures/skeletal-attachments/browser-probe.mjs`；契约、3D手册、此Review与3D总单状态。

## 怎么自己验

1. `src/engine/protocol/components/attach3d.test.ts` 19项：四字段、纯数据/有界字符串、有限三元组、未知字段与type；`src/assembly/skeletal-attachments.test.ts` 11项：显式null、自环/链环、12k父链、sync/async/template/direct原子装载与E5展开前后，不要求动态父已存在。
2. `src/net/skeletal-attachments.test.ts` 6项：组件增加/替换/删除不改变完整/增量hash，Transform/Velocity/Flag/State仍敏感；两个实际World、Bone/Mixer和SkeletalAttachments共20k CPU更新，不同渲染输入产生不同真矩阵，每步snapshot/hash/writeSequence/dirty不变。该测试验证CPU helper边界，不冒充ThreeRenderer/GPU。
3. `src/renderer/three/skeletal-attachments.test.ts` 27项：原生Bone/Mixer最终姿势、局部XYZ/offset/scale、非均匀父完整剪切（含非零TRS反证）、native Raycaster、嵌套倒序/2000层、父缺失/迟到/换实例、精确唯一Bone与缺骨回根、隐藏/恢复/清除、坏数据/环/非有限矩阵、10k帧诊断/缓存有界。
4. `batches.test.ts` 新增7项与 `render-hygiene.test.ts` 新增1项：移空/grow/总dispose均释放自有纹理，重复face材质/跨材质同图只释放一次，共享PBR贴图不误毁；InstancedMesh本体的dispose事件在三路径仅一次（实际建立matrix与color属性）。原生buffer是否真删另由下面GPU探针实证。
5. `RENDER_PROBE_CHROMIUM=<固定Chrome> node scripts/verify-skeletal-attachments-browser.mjs <已有T5 run-1目录>`：8阶段真实浏览器，parent/child模型与图从正式AssetIndex/AssetManager加载。测试道具有静态GLB、plain/PBR outline/可归批PBR/透明/dice/voxel和嵌套挂件。完整骨骼矩阵与实际draw uniform/屏幕/阴影/拾取相互验证，缺父/缺骨/迟到诊断逐条精确匹配。移除Attach后plain/PBR/voxel回原批且旧single mesh消失，sameid Mesh→Model无ghost。无付费API/新Blender。

数据小块6文件73项、renderer纹理/原生owner两文件23项、合并8文件108项（加buffer前）均实跑通过，最终全量包含全部71个新增用例。

## 撤修验红

仅在额外临时副本撤修，所有定位锚点先断言命中1，baseline0→撤修1→恢复0；未撤正式施工源码或用户工作区。不是以编译失败/超时冒充验红。

| 范围 | 撤修与实际红灯 | 证据 |
|---|---|---|
| 数据/装载/hash 15处 | 去掉闭集/tuple/有限/周期/入口/无provider/hash排除等；19+11+6对应拒收、原子world与hash断言红，恢复36/36 | `/private/tmp/apollo-e3-data-red-9q4n5rf1/report.json` |
| 附件helper 12处 | 最终Bone、唯一Bone、乘法顺序、保剪切、禁auto覆盖、父先子、隐藏、base恢复、缓存/环、父逆矩阵、child scale；真实位姿/剪切/native Raycaster/有界断言红，恢复27/27 | `/private/tmp/e3-attachment-mutations-20261021/report.json` |
| 资源6处 | 撤batch owned texture释放、材质数组/跨材质纹理去重、三条InstancedMesh.dispose；对应0次释放/重复释放/owner事件断言红，恢复23/23 | `/private/tmp/apollo-e3-texture-red-uzl2h7ad/report.json` |
| ThreeRenderer对接3次 | 跳过附件消费、把动画挪到挂接之后、退回seen代替seenStandalone；真实GPU探针分别报 `Attachment lost full bone world matrix` 与 `standalone ghost`，每次恢复后8阶段重新退出0。顺序反转的两个不同定位点各命中1 | `/private/tmp/apollo-e3-renderer-red-db_o_nlm/report.json` |

### 实证发现后的资源修补

构造GPU最初销毁还剩2张texture；逐张inventory证实为归批voxel的128×128自有map从未dispose，不是模型或动作缓存。旧红 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e3-browser-XTH2Mc/report.json`，原nativeGPUAllocated=true/disposals0。复用原有独占/共享语义的disposeMeshMat，数组材质/纹理全局去重，避免voxel重复sideMat发5次释放；不扩大共享贴图销毁。

独立复查进一步以真实createBuffer/deleteBuffer实证：InstancedMesh本体没有dispose，移空20轮遗留20个instanceMatrix buffer，含instanceColor则遗留40个；geometry计数0不能证明该原生资源释放。三条batch释放路径补mesh.dispose，永久测试与原GPU反例由复查人再验，不以contextLost把泄漏当通过。最终施工探针也已加入原生buffer逐项句柄与总数断言。

## 门禁与真实证据

最终源码实际scoped --run：eslint0，depcruise1，仅已有 `games/game113/guide-art.ts → src/assets/asset-index.ts`；末行 `❌ 门禁失败于 depcruise（退出码 1）`。没有改game113或放宽基线。早期测试无参Date曾被墙钟eslint拒，已改固定Date(0)，规则未放宽。

| 步骤 | 退出码 / 实测 |
|---|---|
| eslint / depcruise | 0 / 1（指定基线） |
| sim-dom-fence | 0，lib不含DOM编译 |
| 原生spritegen node:test | 0，5/5；没让Vitest制造NoSuite |
| tsc | 0 |
| full Vitest | 1，**6809/6810**；647个实际文件仅depcruise-fence指定断言1例红，pending/todo0 |
| build / docs-ref / context-budget | 0 / 0 / 0 |
| art-ledger-guard | 2，既有game-a art-03 / game-c art-017缺文件WARN |

日志 `/private/tmp/aiflow-e3-final3-scoped.log`、`/private/tmp/aiflow-e3-final2-{complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native}.log`，机读 `aiflow-e3-final2-vitest.json`、`aiflow-e3-final2-steps.json`；完整续跑器自身0，末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。原测试/超时未改，Vitest maxWorkers4/minWorkers1，simDOM面另实跑。资源原生泄漏被独立复查发现后，修补源码再次完整重跑才得到此最终记录。

最终施工GPU证据 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e3-browser-P17wKk/report.json`、同目录load/follow/visibility/removal截图。Apple M5 Metal WebGL2，135组CPU矩阵误差0、GPU矩阵最大约3.19e-7；TRS丢剪切反证最大0.283。14帧屏幕hash14种、阴影13种；8阶段通过。2000tick完整双世界hash一致、2074次渲染只读检查；5轮驱逐重载资源有界。

原生buffer观察没有代替GL操作：createBuffer/deleteBuffer真实调用，204创建/204删除，destroy live0、geometry0/texture0；五轮Attach→batch真实上传instanceColor→18实例扩容→Attach，每轮live50→49→47，旧matrix/color/grownMatrix句柄gl.isBuffer=false，2000稳态buffer47不增、5reload34/42固定。12自有map（dice6、单体voxel4、batchvoxel2）各dispose1且nativeGPUAllocated=false。

缺骨/缺父/迟到drawable反例预期83行诊断、13种消息，均精确锚定白名单；steady无新增WARN，其余warning/error仍失败。来源明确generic-blender-fixture、ARP/Mixamo/Tripo false、blenderStarted=false，不把这些测试道具当真实生产来源或动作质量审批。

## 已知局限 / 细化口径

- 父是显示中的Model3D实例，骨骼字段指实际THREE.Bone精确名；缺父与缺骨的策略不同。挂点不生成道具资产、不改变模拟物理/VFX输入，也不替代后续IK。
- offset为骨骼局部米制、rot为XYZ弧度、挂件原渲染缩放保留；原世界位置/旋转由挂点替代。渲染矩阵与pose metadata区分，后者只供相机取景，不拿分解结果重建绘制矩阵。
- 来源为generic-blender-fixture，测试道具只作验证。ARP/Mixamo/Tripo真实输入/授权、动作质量与T5真实Smart/Remap仍待补，付费flag保持false。

## 交叉复查

待独立复查人对冻结提交执行独立复跑、撤修验红、实证和读取告警；施工方不填写自己的通过判词。
