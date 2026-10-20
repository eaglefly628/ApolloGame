# REQ-3D-AI-PIPELINE · E2 外部动作与动画图交付导航

> 施工主体：Codex；分段锁 `28e384aa2`（2026-10-20）。本单仅施工自证，待另一位复查人独立执行四步；不签人门、不自判 PASS。T5 离线范围已独立复查，真实 ARP/Mixamo/Tripo 来源和整链动作质量仍待验证。本段没有启动 Blender。

## 做了什么

- AssetIndex 的骨骼 animation spec 桥接新的 `skeletal-animation` 物理描述符，沿现有字节加载器、正式 manifest 宿主、分组引用和驱逐路径。旧 2D AnimationDescriptor 与未声明 skeleton 的历史条目保持原有语义。
- `AnimGraph3D` 闭集数据声明外部/内置 clip、状态/数值 1D 混合、条件过渡和淡变；只读本实体 Velocity 与全局 Flag.active/State.current。执行状态在表现层，不写世界，不进模拟 hash。
- 原生 three AnimationMixer/Action 驱动真实骨骼采样；每实体独立 Action/Bone/Skeleton，别名不会共享一个可变 action。过渡从当时权重淡入，可中断；只混相邻两个动作。
- 新动作 GLB 在解析前快照与边界/自包含校验，解析后检查唯一 clip、采样时间、有限 TRS、有效默认场景 skin，以及实际名称/祖先/rest/inverse-bind。跨网格复用只接受同绑定骨架；不将仅同名的不同体型当作已重定向。
- 接入 ThreeRenderer，旧 AnimState3D 同实体优先且一次告警；异步就绪、动作最后帧、停止/清图均正确触发画面和阴影。模型池清理改按本帧模型集合判定，使同 id 从 Model3D 换成 Mesh3D 也释放旧实例/动作。

数据闭集、执行顺序、缺参、边界与兼容口径见 `docs/design/ai-pipeline/animation-graphs.md`，生产手册已加入口。

## 改动面（文件清单）

- `src/assets/asset-types.ts`、`skeletal-animation-data.ts`、`asset-index.ts`、`asset-manager.ts`、`model-loader.ts`、`index.ts`、`skeletal-animation.test.ts`。
- `src/engine/protocol/components/anim-graph.ts`、`anim-graph.test.ts`、`render.ts`；`src/assembly/component-map.ts`、`component-universe.gen.ts`；`scripts/component-manifest-baseline.json` 仅登记新组件。
- `src/assembly/animation-graphs.ts`、`animation-graphs.test.ts`、`scene-import.ts`、`validate-manifest.ts`：sync/async/direct Engine.load 入口与完成展开后验证，不新增 sim system。
- `src/renderer/three/animation-graph.ts`、`animation-graph.test.ts`、`animation-graph-params.ts`、`animation-graph-params.test.ts`、`skeletal-clips.ts`、`skeletal-clips.test.ts`、`models.ts`、`model-graphs.test.ts`；`src/renderer/three-renderer.ts`。
- `src/services/scene-game-assets.ts`、`scene-game-assets.test.ts`；`src/net/determinism.ts`、`animation-graphs.test.ts`。
- `scripts/verify-animation-graph-browser.mjs`、`scripts/fixtures/animation-graph/browser-probe.mjs`；契约、3D 手册、此 Review、3D 总单状态。未改游戏、PUI、已结案的第1波工单或真人名单。

## 怎么自己验

1. 数据闭集：`anim-graph.test.ts` 覆盖外部/内置引用、类型、未知字段/参数源（含未消费源）、状态 xor、严格递增混合点、转移类型与有限 fade/预算。装载边界 `animation-graphs.test.ts` 覆盖没有 provider 时仍校验、模板/sync/async/direct Engine.load 原子拒收、E5 展开前后、显式资产 key。
2. 资产：`skeletal-animation.test.ts` 覆盖 spec 四字段、直接注册绕过、旧条目不偷换、正式字节加载/组取消与驱逐/重载。`scene-game-assets.test.ts` 的 `the manifest host loads indexed skeletal animations as bytes without invoking the image loader` 专门守正式宿主分发（撤修以 resolves 断言即时红，不靠超时）。
3. 参数与确定性：`animation-graph-params.test.ts` 覆盖精确字段、首份语义 id、缺失不是零/false、溢出/坏 raw 数据、World/readView 不标脏；`src/net/animation-graphs.test.ts` 两个实际 World + 原生骨骼轨道、各10,000步不同渲染时钟/输入，每步 snapshot、完整/增量 hash、writeSequence、dirty 均不变；Velocity/Flag/State/Transform 真变化仍能改变 hash。
4. 混合：`animation-graph.test.ts` 覆盖三点速度混合、夹端、参数类型、初态、第一条转移、淡变/中断/动态目标、同源不同别名、缺失 numeric 的 bind/保持目标、LoopOnce 最后帧、20,000帧资源有界、dispose。原生 Mixer 负责轨道采样，没有用测试替身替代混合。
5. 骨架与模型池：`skeletal-clips.test.ts`、`model-graphs.test.ts` 通过真实 GLTFLoader 解析夹具。覆盖同骨架不同网格/同模型双实例实际蒙皮位移、骨骼 UUID 绑定与源 clip 不改写、祖先/rest/IBM、默认 scene/外部 URI/压缩扩展/预算、metadata 与轨道严格对应、迟到驱逐/失败/纹理 bitmap/Blob URL 释放、20,000帧卸载重载资源有界、旧 AnimState3D fallback/0.25秒淡变/同名 loop 行为。
6. 浏览器：`RENDER_PROBE_CHROMIUM=<固定Chrome路径> node scripts/verify-animation-graph-browser.mjs <已有T5 run-1目录>`。只读已有 GLB，不启动 Blender，入口要求明确的 `generic-blender-fixture` 来源。正式 createManifestAssets → AssetIndex → AssetManager → ModelPool → ThreeRenderer，真实 WebGL2 骨骼纹理上传、蒙皮顶点、三点 idle/walk/run 往返权重与独立动作时间、帧缓冲/阴影像素、停播最后帧、图/模型移除、Model→Mesh、模型 key 切换、2,400 tick 完整双世界 hash、五轮驱逐重载和 destroy GPU 资源归零。不同模型是同 bind 骨架下确实改过顶点宽度/材质的网格；不是相同字节换 key。run 明确复用 walk clip 的两倍速，只验证运行时三点混合，不声称额外真实跑步捕获。

## 撤修验红

仅在额外临时副本撤修，不破坏施工树或用户工作区。以下每项先断言唯一锚点命中1，baseline0 → 撤修1 → 恢复0；记录保留断言红灯，不把编译失败或超时冒充验红。

| 范围 | 唯一锚点撤修 / 真实红灯 | 报告 |
|---|---|---|
| 协议/正式宿主 9处 | 关闭未知字段/预算/引用/源词表/xor/混合点顺序/类型比较/fade 门、去掉 skeletal 字节路由；对应 `expected [Function] to throw`、`promise rejected ... instead of resolving` | `/private/tmp/apollo-e2-root-red-uxatjil3/report.json` |
| 资产 13处 | spec四字段、直接注册、分组、索引桥接/校验、字节加载/尺寸、旧语义与一次日志；对应精确入口断言变红 | `/private/tmp/apollo-e2-assets-red-g2ckk2aj/report.json` |
| 参数/装载 13处 | speed缺失/Math.hypot、readView、Flag/State字段、Model必需、图校验、展开前后、无provider/外部key、raw plain/source；对应 snapshot/writeSequence/拒收断言红 | `/private/tmp/apollo-e2-seams-red-aqvqwov7/report.json` |
| 图控制器 13处 | typed cmp、1D/淡变/中断、动态目标、逐帧一次转移、别名 clone、末帧、解绑和缺参策略、极端跨度与次正规数；实际权重/姿势/native资源断言红 | `/private/tmp/apollo-e2-final13-mutations-6zud1ec_/report.json` |
| 模型绑定 9处 | 唯一clip、rest/IBM、UUID、源clip clone、迟到代际、源场景资源释放、解析前快照、清图dirty、实际model kind；蒙皮/资源/拒收断言红 | `/private/tmp/e2-model-mutations-20261021/report.json` |
| hash排除 1处 | 从 NON_DETERMINISTIC 仅摘 AnimGraph3D，两例 hash 一致断言红，生产源码未撤 | `/private/tmp/apollo-e2-net-red-wfba4nz6/report.json` |

最终58处施工验红锚点；这是施工自证，不替代复查人自行选择锚点。

### 独立复查发现后的施工修补

复查方用闭集允许的有限端点 `[-Number.MAX_VALUE,+Number.MAX_VALUE]` 实证：原差商在速度0时错取端点、速度MAX/2时产生NaN。修为仅跨度溢出时的半尺度差商，普通有限跨度继续原式，防止次正规数端点被缩半丢失。

永久新增4例同时检查有限权重/和为1及实际骨骼位姿：两个MAX边界、`[0,2*Number.MIN_VALUE]` 中点和普通tiny区间。31项图控制器测试退出0。额外临时副本撤掉稳定式，2例断言红；无条件缩半则次正规数1例红；两次均唯一命中、baseline0→1→恢复0，证据 `/private/tmp/apollo-e2-extreme-blend-f_2fpzzn/report.json`。修补后的正式全量重跑，等待独立复查人复现其原反例；施工方不据此自行判通过。

## 门禁与真实证据

最终源码冻结后实际 `node scripts/scoped-gate.mjs --run` 退出1：eslint0，depcruise1，精确为既有 `games/game113/guide-art.ts → src/assets/asset-index.ts`。末行 `❌ 门禁失败于 depcruise（退出码 1）`。没有改 game113、吞退出码或扩大基线。

| 步骤 | 退出码 / 实测 |
|---|---|
| eslint / depcruise | 0 / 1（上述唯一允许基线） |
| sim-dom-fence | 0，lib不含DOM编译通过 |
| spritegen原生node:test | 0，5项；未让Vitest误跑产生NoSuite |
| tsc | 0 |
| vitest:full | 1，**6738/6739**；643个实际文件仅对应depcruise-fence的1文件/1断言失败，pending/todo0 |
| build | 0，仅既有chunk大小提示 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2，仅既有game-a art-03、game-c art-017缺文件WARN |

使用原门禁计划和原测试超时；Vitest maxWorkers4/minWorkers1，原生spritegen另跑。完整续跑器自身exit0，末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。日志 `/private/tmp/aiflow-e2-final2-{scoped,complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native}.log`，测试机读 `aiflow-e2-final2-vitest.json`，退出码 `aiflow-e2-final2-steps.json`。面触发simDOM另实跑 `/private/tmp/e2-sim-dom.log` exit0。初次eslint因测试的无参Date被墙钟规则拒，已改为固定Date(0)，没有放宽规则；早期全量6734/6735只有原基线，独立复查找到极端溢出后修补并完整重跑才取得上述最终数值。

定向初批20文件320项已通过，最终全量包含全部新用例（新组件33、资产27、参数20、装载13、混合31、骨架39、模型图12、hash6及正式宿主路由）。最终图控制器13锚点验红绑定最终源码/测试SHA，其他模块撤修报告保留其对应冻结输入与红灯。

最终施工GPU报告 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e2-browser-MHGqmA/report.json` 与 load/blend/once/removal截图同目录；Chrome真实 WebGL2/Apple M5。idle/walk/run六速度往返实际权重分别为idle1、idle.5+walk.5、walk.5+run.5、run1、walk1、idle1，6帧像素与阴影均变化；run来自walk speed2，原生动作时间增量walk.03125/run.0625。稳态GPU geometry3/texture6，三个controller各action4/binding51/interpolant0，2,400 tick完整sim hash与无图副本逐帧相等；5轮驱逐重载有界，销毁GPU0/0并contextLost=true，浏览器diagnostics为空。之后极端差商修补只改变溢出分支，独立复查人已在最终源码重跑其原2反例与新GPU，正式判词仍由复查人记录。

## 已知局限 / 细化口径

- 未获得或调用付费 Tripo/ARP，未下载/声称真实 Mixamo 来源。GPU来源是前段已实际 Blender 导出的自有测试 GLB；`realArpValidated/realMixamoValidated/realTripoValidated=false`，此段 `blenderStarted=false`。新流程真人门没有签字。
- 同骨架指实际名称/层级/绑定姿态/IBM兼容，不接受只同名的跨体型骨架。运行时只复用 clip，跨骨架重定向仍属 T5。动作 GLB 明确只收自包含、无扩展、单clip、无sparse/morph的已声明子集；旧 E1 模型 codecs 不受该新动作门限制。
- 首状态/首规则、fade上限60秒、别名/动作等有界预算、strict typed cmp 为 spec 未细写处的显式保守执行口径；没有增加自由表达式。缺 numeric 源从未有效则 bind pose，曾有效则保持该状态最后目标；不伪造速度0。实证未发现需要 owner A/B 改 spec 的表达缺口。
- AnimState3D 同实体优先；保留其现存 fallback/loop 不重设的兼容行为，不借此扩任务改变历史语义。新版图不回写 root motion、事件或模拟状态，动作事件/IK/挂件属后续段。

## 交叉复查

待独立复查人在冻结提交上复跑、撤修验红、实证与读告警。施工方不在此填写自己的 PASS。
