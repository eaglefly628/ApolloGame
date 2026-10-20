# REQ-AIFLOW-GROUND · R2 施工交付导航

> 施工主体：Codex；锁 c33954665（2026-10-20）。依赖 E5 施工 f929ff38a、独立复查 d59cf0771。此处自证供独立复跑导航，不代替复查判词，不签人门。

## 做了什么

E5 场景声明显式加 `ground:{source:"navigation"}` 后，从最终 GLB 的 SHA 已验证三角派生整数高度表、真实支撑关联和同源导航；角色挂 `GroundWalker3D{surfaceId}` 即消费，不写游戏 system。显式 collision 来源只取凸体外侧可走上表面；多层冲突拒收，不自动选最高墙顶。

Q=10000/米；空间桶加 BigInt 重心采高、精确整段覆盖。台阶分片不插值，窄洞不能靠大步跨过，步高只检查不连续跳变而不限制缓坡总爬升。世界保存最后接受点/高度/三角，Input 初始化、Update 的 pre、碰撞解算后 final 提交，快照恢复无隐藏角色缓存。碰撞只过滤实际支撑上表面，以及真实连接的允许低阶立面；墙、同高侧壁、天花与高阶仍挡。表现单向读 sim 脚高，旧未启用的路径保留。

契约与实查：`docs/design/ai-pipeline/ground-walking.md`。未买 Tripo/授权插件不影响这张离线地形能力；自产夹具不冒称付费服务样本。

## 改动面

- `src/engine/protocol/components/ground.ts`、components 出口、SceneImport ground 可选字段：闭集数据与序列化状态。
- `src/engine/spatial/ground-surface.ts`、`ground-support.ts` 及测试：整数表、精确覆盖、预算与接触过滤。
- `src/skills/tier2/ground-walk-3d.ts` 及测试、tier2 出口：初始化/pre/final、拒移停速、trace；`collision-resolve-3d` 增支撑与步阶接线，原无Walker算序保留。
- `src/assembly/scene-import.ts`、`ground-walkers.ts` 及测试：原子展开、表完整性/引用/表现冲突校验、地形导航；注册表、component-map/universe 及生成物同步。
- `src/renderer/{renderable,three-projection,three-renderer}.ts`、`ground-projection.test.ts`、`three/lights.ts`及测试：Mesh/Model 实际脚底、批实例/PBR/普通路线、脚高脏标与 hash 单向性；torus tube 批签名及实际资源释放接缝修补。
- `scripts/ground-walking.integration.mjs`、`scripts/ground-walking-render.integration.mjs` 及自产夹具：真实 Blender/raw/Draco/Engine/Chrome 与明确 Mock/缺软件跳过。
- 新契约、3D/运动手册、Review、工单状态；组件清单只新增三个真实组件，phase 点名只新增 init(-20)/final(21)，**SCC 基线未扩大**。

## 怎么自己验

1. 无 key/网络/Blender：`npx vitest run src/engine/spatial/ground-surface.test.ts src/engine/spatial/ground-support.test.ts src/skills/tier2/ground-walk-3d.test.ts src/assembly/scene-ground.test.ts src/assembly/ground-walkers.test.ts src/renderer/ground-projection.test.ts`。含坏活表索引、负坐标、洞、高阶、初始/新生、相位/严格申报、恢复/hash/trace。
2. `node scripts/ground-walking.integration.mjs --mock`：明确跳过 Blender，以自产 GLB 真编解码、验证 SHA 和引擎闭环，不是跳过所有断言。缺 Blender 的 real 模式打印 skip 与 `realValidationPerformed:false`，不冒充真实验收。
3. `BLENDER_BIN=<固定4.5.14> node scripts/ground-walking.integration.mjs`：真实双导出字节一致、raw/Draco、sync/async/direct×trace 两档共12条180拍历史、90拍快照+snapshotOrder恢复。最新真实报告 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r2-ground-tqQcSS/report.json`：步阶半径0.3、上阶到x3.2/Y0.2，再准确回x-0.4/Y0；高台/洞大步保持x-0.4；碰墙最终x-0.25、同拍Y0.9375。table SHA `f7a24e39…e48cb7`、历史 SHA `a1816f08f8ce68c175c6d1251d7b17eba311fd319bcac1fa26b099e52388c6d8`、末 hash `49229f09`。真实日志 `/private/tmp/r2-real-final-integration.log`。任何新增 runtime/topology WARN 失败，仅记录既有表现组件 provider 提示。
4. `RENDER_PROBE_CHROMIUM=<Chrome> R2_RENDER_KEEP_EVIDENCE=1 node scripts/ground-walking-render.integration.mjs <真实CPU报告.json> raw`，再传 `draco`：实际导入文件→SHA目录→展开→Engine→ThreeRenderer，开发根/构建子路径；实际 GPU 几何底Y、截图/像素、静止XZ脚高改动重绘、render前后完整快照hash不变、销毁资源计数。raw报告 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r2-render-Zs7mQO/report.json`，Draco报告 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r2-render-qWotgv/report.json`。GPU脚底最大误差4.3836e-7米；模型/网格坡上1.2625米、合法阶0.2米后下降0；仅脚高编辑使像素hash2793618108→593396991，来源明确为sim输入编辑，并非静态地形自动变化。两部署/两压缩警告错误均空；它不是用手填等价数据代替导入链。
5. 资源清理修补后旧E1/R4真实脚本串行重跑均exit0：E1 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e1-real-97IcQY/report.json`（开发/构建压缩像素差0、两阶段取消workers/Blob0）；R4 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r4-real-OztAPv/report.json`（两路径各两代，共享保留，最终实例/geometry/texture/worker/Blob0、diagnostics空）。日志 `/private/tmp/aiflow-r2-render-{e1,r4}-final-regression.log`。

## 实证发现与必要修补

- 角色胶囊在真实0.2米台阶中心跨边之前已碰立面，原型卡在x=-0.2828422167、永远上不去。补有方向意图、足迹前缘的整段可达、实际支撑ID与步高约束；回程用下阶限额反验，避免后帽把角色水平推远。实际上下阶精确回原点。
- Update 新 writer 仅 after motion 会参与现有软环。显式列既有平面读者/意图顺序，strict 组合测试与全库 SCC 棘轮确认没有扩大旧 SCC。保留 detector 的旧 phase0，避免把旧 prefab 新生碰撞体提前一拍检测；新 init/final 是 opt-in 能力自己的成员。
- torus 管径原未参与几何批签名，会让两个管径共享首件几何，脚高偏移与真实几何不一致。普通/PBR 批及单件签名同步消费 tube，新增双件实际顶点断言。
- 真实 GPU 销毁检查发现原遗留三张纹理：主光阴影 color/depth 与 three r184 全局 DFG LUT。LightRig 释放自有 shadow targets；从实际已编译材质 uniform 捕获真实 LUT（不另导入另一份 three 单例），首次捕获后不再逐帧遍历。最后已初始化 renderer 在自身 WebGL dispose 前释放共享 LUT；仍有其他 renderer 时不广播全局 Texture.dispose，仅通过公开 forceContextLoss 关闭自己的上下文。真实A/B/C及同实例重新初始化验证：A关闭后原生handle失效、contextLost=true，A历史纹理counter1如实保留，不伪写为0；B共享handle/material/program不变，强制两次真draw像素1466462763→40202966→1466462763；最后B及新C/原A重开再销毁计数归零。未初始化/失败构造与重复destroy不多释放。单主画布geometries/textures/workers/Blob均0，全程WARN/error空。

## 撤修验红

父施工用 `/private/tmp/aiflow-r2-parent-red.mjs` 复制独立临时源码，均恰1锚点、exit1、AssertionError，finally 逐字恢复；施工树不撤改、不影响并行读取：

| 撤修 | 命中测试 | 红灯 |
|---|---|---|
| 关闭实际上支撑接触匹配 | `exempts the upward sloped support in either entity order` | expected false to be true |
| 去掉允许低阶立面接线 | `climbs a legal step with an actual vertical collision riser` | x=-0.282841094…不大于1 |
| 去掉final求高执行 | `walks the real convex ramp…` | expected 1.8 to be close to 1.75（误差0.05米） |
| 去掉落盘表canonical校验 | `rejects forged bucket entries…` | expected function to throw |

日志 `/private/tmp/aiflow-r2-parent-{upward-support,stair-riser,final-height,table-validation}-red.log`，汇总 `/private/tmp/aiflow-r2-parent-red-summary.json`。

几何另四处：去向上取整、去整段洞拒收、去多层重叠拒收、去canonical桶比对，均恰1锚点，分别1/2/1/1例AssertionError/exit1；日志 `/private/tmp/aiflow-r2-math-*-red.log` 与 `aiflow-r2-math-red-summary.json`。装载另三处 support/高阶barrier/墙投影分别唯一锚点变红，恢复29例绿：`/private/tmp/r2-scene-red-summary.log`。渲染torus普通/PBR tube键各唯一锚点撤修，批数断言exit1，恢复exit0：`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r2-render-torus-red-NxlAAu/report.json`。正式复查另选锚点，不采信自证替判词。

实时安全与runtime另五锚点：live-bucket/live-dimensions/init-before-motion/final-height/pre-reject-stop各恰1命中、AssertionError/exit1，恢复math26+runtime17绿；`/private/tmp/aiflow-r2-runtime-red-summary.json`。渲染生命周期另五锚点均恰1命中、目标红、恢复0：`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r2-render-lifecycle-red-RzHIY4/report.json`。只用独立副本或Vite transform，主源码没有撤改并行读者所见文件。

生命周期具体断言：删主shadow释放/删mapPass释放，dispose期望1实0；删幂等guard，gl.dispose期望1实2；删实际global LUT释放，真实GPU textures期望0实1；删自有forceContextLoss，真实失败构造的contextLost期望true实false。原始日志在RzHIY4的`{main-shadow,local-mapPass,idempotent,actual-global-lut,own-context}.log`，没有通过伪改计数器验红。

## 已知局限

- 可走面是单值高度场；桥上桥下正面积重叠拒收；坡度固定≤45°。collision 来源的多个上表面重叠同样拒收，不猜哪一层是路。
- 高度表最多4096三角、65536格、262144引用；装载匹配/分割/栅格各有800万操作上限，超限明确拒收，制作侧简化静态代理面。
- 默认导航占据高仍是E5的1.8米，图按默认上阶0.25米保守生成；角色单独收紧步高时，运行时会拒移，未声称自动生成每种步高专用导航图。角色贴地不包含重力、跳跃或落下模拟。
- 角色根只接受sim平面Transform与竖直sphere/capsule/box；表现驱动/Transform3D/Hierarchy/Pivot竞争装载拒收。Model使用T4脚底pivot规范。完整胶囊足迹支撑不在本轮保证内。
- 所有真实样本为自产离线几何；无付费API、无授权插件执行、无人门签字。

## 门禁记录

首轮完整Vitest6302/6304，除game113外，编排器旧双dispatch用例触发原5000ms超时；未改其源码/断言/超时，独立定向原42项通过（exit0，`/private/tmp/aiflow-r2-orchestrator-targeted.log`）。随后完整测试采用maxWorkers=4/minWorkers=1限制并行争用，仍保留原5秒超时；没有将此红灯加入基线。最终各步记录见下。

最终冻结源码6303/6304通过，pending/todo=0；唯一failed suite/断言为指定game113围栏。源码31文件逐字节指纹在完整门禁后核对不变（`/private/tmp/aiflow-r2-frozen-sources.json`）。**除基线 depcruise 外全绿**：

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint0、depcruise1，仅game113原越界） |
| skill-shape-guard / sim-dom-fence | 0 / 0（存量shape WARN，无新增；sim零DOM） |
| tsc / build | 0 / 0 |
| Vitest全量 | 1（6303通过，仅围栏基线1例） |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（存量允许WARN，无新增） |
| spritegen原生node:test | 0（5项；从Vitest排除交原runner，不接受NoSuite作基线） |
| R2真实Blender / Engine / raw+Draco Chrome | 0 / 0 / 0 |
| E1 / R4真实旧链回归 | 0 / 0 |

日志 `/private/tmp/aiflow-r2-final-{complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,native,skill-shape,sim-dom}.log` 与 `aiflow-r2-final-vitest.json`；实际scoped原始 `/private/tmp/aiflow-r2-delivery-scoped.log`。构建仅既有chunk>500k提示，台账仅game-a art-03/game-c art-017缺文件在案WARN。实际scoped末行 `❌ 门禁失败于 depcruise（退出码 1）`；余步骤末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。没有改game113、PUI或任何游戏层文件。

待独立复查另写最终判词；这里不自判通过。
