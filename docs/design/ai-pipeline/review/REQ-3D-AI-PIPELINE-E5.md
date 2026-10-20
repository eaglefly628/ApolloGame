# Review：REQ-3D-AI-PIPELINE · E5 场景 GLB 拆实体

施工锁`d9c2d6e36`（2026-10-20先独立推送后施工）。前置T7/T3/T4/E1/R4均已获独立复查，R4判词`08ba7e0ac`。本单只交施工自证，正式判词由另一复查方追加；不自判PASS、不签人门。

## 做了什么

接受路线图E5既定判A：实查现有Collider3D、NavigationGrid/Profile→NavGraph/pathfind、Pickable3D输入通路、prefab/Caster出生锚点均可复用；缺的是最终GLB节点→装载实体接线。Model3D原来不能选节点且跳过拾取表；旧navmesh-bake会把整幅col_floor挡成零导航点。没有新增游戏自由脚本或逐帧导入system。

最终自包含GLB经真实CPU几何解码（raw/Draco/meshopt，跳过图片）生成带SHA的spec.scene候选，仍由原资产人审登记；装载真实字节验SHA后给出catalog。作者只填`SceneImport3D{modelKey,rules:"default"}`；同步/异步manifest和直接Engine装载共用纯函数，创建首个实体前原子展开。节点index路径决定稳定id，不靠重名字符串。

凸col生成现有逻辑碰撞，nav真实三角并集烘导航网格，pick独立模型接真实AABB拾取与ActionSink，spawn成为现有prefab可用的锚点。背景排除独立pick，销毁后不留残像。Model3D选择保留完整祖先矩阵与origin，R4按key共享/释放语义保留。通用manifest宿主等待场景硬依赖验证后开局，自动选ThreeRenderer；旧无SceneImport游戏仍Canvas与非阻塞美术装载。

## 改动面

- `scripts/scene-import.mjs`、`scripts/lib/scene-geometry.mjs`、`scripts/scene-import.test.mjs`：闭集候选生成、严格容器/accessor/压缩/层级校验、真实文件快照，不自动入库。
- `scripts/fixtures/scene-import/`：自产CC0场景/共享accessor与真实Draco编码辅助；`scene-import.integration.mjs`：固定Blender双作业与双烘焙。
- `src/assets/scene-import-data.ts`及测试、`asset-types.ts`、`asset-index.ts`、`asset-manager.ts`、`index.ts`：闭集schema复制冻结、spec桥、实际字节SHA、过期结果隔离、只交已验证catalog。
- `src/assembly/scene-import.ts`及测试、`entity-templates.ts`、`manifest-{core,async}.ts`、`manifest.ts`、`src/runtime/engine.ts`：模板先展开、通用原子装载、导航几何并集/凸碰撞派生与稳定id。模板模块抽取保留旧API出口，避免新循环依赖。
- `src/engine/protocol/components/scene-import.ts`、components出口、component-map/universe及capability-registry生成表、`src/skills/atoms/scene-import-3d/`：配置能力登记（无tick systems）。
- `src/engine/protocol/components/render.ts`、`src/renderer/three/models.ts`、`three-renderer.ts`、`model-selection.test.ts`：原节点选择/子树排除/真实拾取/阴影资源归属。
- `src/engine/spatial/{sat3d,contact3d}.ts`及测试、`src/assembly/scene-import-adversarial.test.ts`：真实凸网格接入暴露的既有SAT边候选、完整胶囊线段和深穿退出距离修复；不是放宽碰撞契约或改基线。
- `src/skills/tier3/caster.ts`及测试：补登记protocol/execute原已支持的originEntity字段，消除真实出生闭环的伪unknown-field告警。
- `src/services/{scene-game-assets,manifest-game}.ts`及新测试：硬依赖开局、旧路径兼容、真实拾取入队及卸载取消/释放。
- `scripts/scene-import-engine.integration.mjs`、`scene-import-render.integration.mjs`：同一真实raw/Draco文件，装载验证/引擎双跑和Chrome开发/构建子路径验证。
- `scripts/component-manifest-baseline.json`仅登记本次真实新增SceneImport3D，清单计数+1；同目录能力测试补共享schema/资产链接/首tick前展开验证。没有放行任何额外失败。
- 新契约`docs/design/ai-pipeline/scene-import.md`、资产/3D手册、本Review与3D总单status。

## 怎么自己验

1. 普通无key/无网络：`npx vitest run scripts/scene-import.test.mjs src/assets/scene-import-data.test.ts src/assembly/scene-import.test.ts src/assembly/scene-import-adversarial.test.ts src/services/scene-game-assets.test.ts src/services/manifest-game.scene.test.ts src/renderer/three/model-selection.test.ts src/engine/spatial/sat3d.test.ts src/engine/spatial/contact3d.test.ts src/skills/tier3/caster.test.ts`。实际压缩小夹具、本地WASM，无下载或付费API。
2. `BLENDER_BIN=<固定4.5.14> SCENE_IMPORT_KEEP_EVIDENCE=1 node scripts/scene-import.integration.mjs`：approved拆层/闭集job真正进Blender，含col_floor/col_wall/nav/pick/spawn、父层旋转/非等比缩放；场景与候选双跑一致，同场景实际Draco再编码，节点/矩阵/几何逐值等同raw。生成helper可复跑，不依赖固定临时路径。当前证据`/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-scene-import-real-43kUQk/measurements.json`，同目录保留两次Blender日志与全部GLB/JSON。
3. `node scripts/scene-import-engine.integration.mjs <scene.glb> <scene.json>`，再对Draco重复：从真实字节验SHA，到sync/async/direct各两世界，180tick全部history相同；实际wall推开0.1m、末穿透0；绕障相对直线额外偏移1m、到达误差0；Caster按真实spawn(-1,1)产生prefab一次。输入不变，runtime/topology WARN为0。两种文件最终hash均`16ca5bb2`，historySHA`21e4a70ba79393d6d48c1141b1b99839bffa4d1c35bbd7de79e2f50069adea6c`；原始`/private/tmp/e5-engine-{raw,draco}.json`。故意拿Draco文件配raw候选：SHA mismatch、exit1。
4. `RENDER_PROBE_CHROMIUM=<Chrome> E5_KEEP_EVIDENCE=1 E5_SCENE_FIXTURE=<GLB> E5_SCENE_DATA=<JSON> node scripts/scene-import-render.integration.mjs`：每种文件实际走descriptor.scene→SHA→catalog→同一expand，再ThreeRenderer。开发根与build子路径都真拾取，arg为稳定node id；CPU对GPU世界bounds误差4.970043e-5m、顶点5.223514e-5m（在1e-4m烘焙量化内）。销毁独立pick后图像改变、背景只留地板/墙；最后逐key驱逐归零。永久脚本同时捕获warning与error，均必须空。 本次完整链证据：raw `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e5-render-8aluxu/report.json`，Draco `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e5-render-lHtab0/report.json`。两部署/两压缩版本的载入像素hash均1162324544、销毁后均4208641605。
5. 旧E1压缩与R4分组真实脚本回归：保证像素、worker/Blob清理与共享资源生命周期未回退。 阴影修补后重新串行回归均exit0：E1 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e1-real-z1qSKk/report.json`，R4 `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-r4-real-6vIQEV/report.json`。全部工具不需要Tripo/API；不把自产小夹具冒称真实Tripo样本。

## 早期独立复查实证与修补

- 重叠、内嵌与T形接缝导航网格被错误地当成外边界。改为边交点切段及两侧半平面覆盖求真实并集外边；保留小洞与0.1mm窄缝，不能用固定距离probe吞缝。
- 实际CPU烘焙tetra暴露SAT旧缺口：sphere边附近误碰depth0.02、AABB误碰depth0.06、capsule底帽真碰却null。改从支持平面重建真实边、edge×edge/最近feature候选、完整胶囊段投影；深包含用最小退出距离。未扩大公共Collider3D字段，未tetra特判；测试含翻序、旧盒/OBB、零长胶囊、端帽/侧面、切触和rollback。独立又用父旋转/非均匀缩放tetra的500 sphere+500 box固定样本，对真实Triangle最近点/三角×AABB参照分类一致。
- 真实浏览器切换时，正常释放旧bitmap后，three r184共享阴影材质残留旧map uniform，下一张无贴图场景上传已关闭图片。改为实例自有Depth/Distance材质，归入同一清理表；多材质组shader flags变化才失效。没有延迟回收或修改node_modules，新增单位测试及全WARN断言；独立原始诊断脚本复跑告警消失。
- 真出生闭环发现Caster.originEntity只有protocol/execute，没有schema；补原字段登记，禁止把这条新实证告警白名单掉。

## 撤修验红

父施工在隔离副本执行`/private/tmp/aiflow-e5-red.mjs`，每处源码锚点恰1命中、每轮finally逐字恢复、未改测试断言。六处均exit1且AssertionError：

| 撤修 | 命中测试 | 红灯输出（均AssertionError/exit1） |
|---|---|---|
| 去掉最终GLB SHA比较 | `verifies the exact GLB and rejects a changed file...` | promise resolved instead of rejecting |
| 去掉实际顶点父矩阵应用 | `bakes full parent affine matrices...` | `[0,0,0,2,0,0,0,0,3]`不等于世界顶点`[5.6,9,3,7.2304,...]` |
| 把union两侧过滤改为所有边均外界 | `uses triangle union...` | expected length128, got120 |
| 去掉完整排除子树移除 | `removes complete excluded subtrees...` | expected length2, got3 |
| 去掉实例阴影材质/失效桥 | `owns depth/distance materials per instance...` | expected undefined not to be undefined |
| 场景开局不等待catalog | `does not construct any world before verified scene data resolves...` | expected ['parse','engine','load',...] to deeply equal [] |

原始`/private/tmp/aiflow-e5-{source-sha,geometry,nav-union,exclude,shadow,startup}-red.log`与汇总`/private/tmp/aiflow-e5-red-summary.log`。

碰撞施工另四个恰1锚点撤修：sphere恢复depth0.02误碰、poly恢复depth0.06误碰、capsule恢复null漏碰、深穿退出退回交集宽度（2例红）；均exit1/AssertionError，最后源码逐字恢复。日志`/private/tmp/apollo-e5-collision-red-{sphere-real-edge,poly-real-edge-cross,capsule-complete-segment,contained-depth}.log`。该次在协作读取明确暂停的碰撞专属文件进行，事先通知、finally恢复后才继续复验；父施工六项使用独立副本。正式复查仍另做自己的撤修，不采信此自证替判词。

## 已知局限 / 偏离

- E5装载导航暂限同一水平面，坡面/不同高度明确拒收；工具仍保留全部地形三角，紧接R2扩写确定性高度表和贴地。不能声称第3波全完成。
- col必须闭合凸体；凹体制作侧拆多个col。导航cell0.5米、点半径0、占据高1.8米为default固定协议，不猜角色尺寸或支持多层导航。
- 动画/skin/morph语义子树不作为静态几何烘焙；T5角色与动作链另交。GLB外部buffer/未知必需几何扩展等明确拒收，不静默少导。
- 真实Engine脚本如实记录仅3个原有render-only provider缺登记提示（Model3D/Transform3D/Pickable3D）；任何schema/reference/sim/topology新WARN立即失败。
- 新增碰撞核修补与Caster schema登记源于E5真实接入暴露的已有契约错误，是完成既定碰撞/出生验收所必要，未改game113、PUI或游戏层。
- 复杂凸体成本需制作预算：本机tetra胶囊7.59µs/次、1032顶点共面盒194.4µs、128顶点柱对4.84ms；不宣称任意高面碰撞体免费。计时仅在测试侧，sim无墙钟或裸随机；凸体输入验证有8,000,000点×三角预算。
- 未购买Tripo/Auto-Rig Pro仍不阻塞离线施工，真实服务/授权插件验收未冒充完成；资产人审名单与生产签字未改。

## 最终门禁

首轮全量另报两处本次新增登记遗漏：组件清单缺SceneImport3D、能力目录缺同伴测试（功能测试原在assembly侧）。已按守卫规定同步新增组件清单与有意义的同目录测试，不扩失败白名单。最终冻结全量6211/6212通过、pending/todo=0，唯一失败为指定game113依赖围栏。**除基线 depcruise 外全绿**：

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint0、depcruise1，仅game113原越界） |
| skill-shape-guard / sim-dom-fence | 0 / 0（shape为存量WARN、无新增；sim零DOM） |
| tsc / build | 0 / 0 |
| vitest全量 | 1（仅对应围栏基线1例） |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有允许WARN，无新增棘轮） |
| spritegen原生node:test | 0（5项原runner全断言） |
| 真实Blender / raw+Draco Engine / raw+Draco Chrome | 0 / 0 / 0 |
| 阴影修后E1 / R4真实回归 | 0 / 0 |

构建仅既有chunk>500k提示；资产台账仅game-a art-03/game-c art-017在案缺文件WARN，未忽略其它失败。实际scoped末行`❌ 门禁失败于 depcruise（退出码 1）`；余计划实际补跑末行`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。完整输出`/private/tmp/aiflow-e5-delivery-{scoped,complete,tsc,vitest-full,build,docs-ref,context-budget,art-ledger-guard,skill-shape,sim-dom,native}.log`及Vitest JSON。所有恢复后的源码已冻结，正式复查另写判词。

## 独立复查判词（2026-10-20）

**E5 PASS；整体门禁仍被既有 game113 依赖围栏阻断，不能称全库全绿。** 复查方未参与施工，从精确提交 `f929ff38a85da8d3ea2eb80a6486a838a3bb9d84` 新建 `/private/tmp/apollo-e5-formal-review-f929ff38a`，撤修另用 `/private/tmp/apollo-e5-red-f929ff38a`。以下均为自行运行和读取的证据；未以施工自陈代替复跑，未改施工源码、工单状态或生产人门，本次提交只追加本节。

1. **独立复跑与门禁**：14文件 **164/164**，包含154项永久测试及10项独立对抗；撤修恢复后再次164/164。独立对抗保留早期真实失败输入，覆盖重叠/内嵌/T形导航接缝、tetra球/盒/胶囊接触、SHA计算期间clear重载及metadata重登记；另外500个sphere和500个AABB固定样本，与经父旋转及非均匀缩放后的真实三角形最近点/相交参照分类一致。
   正确双runner的新进程完整Vitest **6211/6212**、pending/todo均0，唯一failed suite为 `scripts/depcruise-fence.test.mjs` 的game113绿腿；原生 `node --test tools/spritegen-export.test.mjs` **5/5、exit0**。首轮误让Vitest收集该原生文件，另报NoSuite，属于运行方式错误，未作为可放行基线；已保留首轮日志并完整重跑。核对HEAD^确认game113导入、依赖规则及原生文件均未被E5修改。

   | 独立门禁 | 实际退出码 |
   |---|---:|
   | scoped-gate FULL | 1：eslint0，depcruise1且仅game113旧越界 |
   | tsc / build | 0 / 0 |
   | skill-shape / sim-dom | 0 / 0：shape存量WARN无新增，sim零DOM |
   | docs-ref / context-budget | 0 / 0 |
   | art-ledger | 2：存量WARN |
   | 正确runner完整Vitest / 原生node:test | 1（上述唯一围栏）/ 0 |

   日志及JSON：`/private/tmp/e5-formal-f929ff38a-{scoped,complete,targeted,restored,vitest-correct-runner,native}.log`、同前缀 `complete.json` 与 `vitest-correct-runner.json`。首轮错误runner记录为同前缀 `vitest.log/json`，未覆盖。

2. **带锚点命中的撤修验红**：12处源码锚点均断言恰命中1次，每轮finally逐字恢复；未修改测试断言，成功计入的变体均exit1且包含AssertionError。

   | 独立撤修 | 实际红灯 |
   |---|---|
   | 去掉GLB SHA比较 / 去掉SHA完成后的request identity | 坏字节被接纳 / 旧代覆盖新代 |
   | 去掉真实顶点父矩阵应用 | 世界顶点不再符合实际父层变换 |
   | 把导航所有候选边当外边界 | 原重叠、内嵌、T形样例重新封路 |
   | 去掉排除子树移除 / 去掉实例阴影材质归属 | 背景多出独立pick / 两实例不再拥有独立shadow材质 |
   | 去掉启动catalog等待 / 去掉Engine装载前展开 | 首世界提前创建 / 未满足导入未原子拒收 |
   | 球恢复旧nearest-vertex候选 / 去掉poly真实edge叉积 | 原tetra边外球、AABB分别恢复误碰 |
   | 胶囊恢复centroid球近似 / 深穿退成交集宽度 | 原底帽接触恢复漏碰 / 包含形状退出深度错误 |

   单独删除一组edge候选时，剩余候选仍覆盖该球样例，未转红，因此该尝试未计入有效撤修；随后撤回旧nearest-vertex候选集合才实红。脚本 `/private/tmp/e5-formal-f929ff38a-red.py`，有效12项汇总 `red.json`，逐项 `*-red.log`，原始过程 `red.log` 与 `red-last4.log`。恢复后源码tracked diff为0，并已重跑上述164项。

3. **真实接缝复现**：在本独立副本重新运行固定Blender 4.5.14，两次真实作业GLB字节一致、两次候选字节一致，raw/真实Draco节点、矩阵及几何一致。新证据 `/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-scene-import-real-oMk9Kc`；raw SHA `5c78102c4184f39e4887021a0164c38e8095edbb6c02aaf23854b9e2dd6c6f66`，Draco SHA `e459eb269f7520d60779b951181989327c8041774e748e26574876f0616ba141`。
   同两份文件各经真实bytes SHA→catalog→sync/async/direct各两世界，**12路×180tick** historySHA均 `21e4a70ba79393d6d48c1141b1b99839bffa4d1c35bbd7de79e2f50069adea6c`，末hash `16ca5bb2`。墙体首tick推出0.1m、末穿透0，路径额外绕行1m且到达误差0，真实spawn(-1,1)生成prefab一次，输入不变。错配Draco文件与raw候选明确SHA拒收、exit1。报告为同前缀 `engine-{raw,draco,stale-sha}.log`。
   Chrome **155.0.8059.85** 在开发根路径和生产子路径分别运行raw及Draco，均用已验证catalog和同一expand产物；真实拾取arg固定 `imported-background/node-5`。载入/销毁后的像素hash分别为1162324544/4208641605，已实际查看前后截图；背景只留地板与墙，最终驱逐模型和几何均归零。四路CPU/render bounds误差约4.97e-5m、顶点误差约5.22e-5m，**warning/error均为空**。独立报告：raw `/private/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-e5-render-3Zb0oq/report.json`，Draco同父目录 `apollo-e5-render-u59I2s/report.json`。
   阴影修补后的既有真实E1及R4也自行重跑exit0：`apollo-e1-real-REgPAY/report.json`、`apollo-r4-real-2NZucf/report.json`（同上述临时父目录）。E1三种压缩对raw像素差0，故障/取消后worker与Blob归零；R4两代共享组释放及几何/材质/纹理恰释放一次，最终memory归零，正常diagnostics为空。

4. **读告警与成本核验**：已读取定向、完整测试、真实脚本、构建和守卫输出。完整测试的 `[L,P]` 成环来自点名system-graph成环fixture；happy-dom的localhost:3000拒连与teardown AbortError仍保留。实际Engine仅有原有Transform3D/Model3D/Pickable3D缺provider登记提示，runtime/topology新WARN为空；早期Caster.originEntity伪unknown-field已不出现。E1主动KTX2失败/取消仍有原生 `Couldn't load texture`，没有把它冒充正常路径告警。构建保留chunk>500kB提示，shape保留在案大壳/底层回收WARN，台账保留game-a/game-c死账及既有黑户，未扩大白名单。
   独立测试侧还核验136/520/4104点的等价共面盒，SAT接触不变，坐标读取分别20268/71100/545532，均低于150次/点；没有退回所有顶点对的组合爆炸。该机观测约0.27/0.46/3.21ms每对，tetra胶囊约16µs；只是有限样本成本记录，不宣称高面碰撞体免费。脚本与日志为 `/private/tmp/e5-formal-f929ff38a-budget.ts`、同前缀 `budget.log`，sim未加入计时或随机。

真实样例为自产离线Blender/Draco夹具，未消费付费Tripo，亦未代验Auto-Rig Pro授权插件或真实服务。结论限于已写E5契约：最终静态GLB确定性导入、已验证资产接线及碰撞/水平导航/拾取/出生/显示闭环。导航仍是同一水平面、cell0.5米、radius0、占据高1.8米；坡面和多层导航明确拒收，真实三角留给R2，不宣称贴地或第3波全部完成。本复查不签资产/生产人门，不关闭3D总单；R2由主程依据本独立结论另行抢锁。
