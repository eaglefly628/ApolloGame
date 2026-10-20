# Review：REQ-3D-AI-PIPELINE · T4 模型规范化

施工锁`1d0f56ada`（2026-10-20先独立推送再施工）；施工方只交自证，独立复查方另写判词，不自判PASS、不签人门。3D总单继续开放，后续E1/R4及其它波次未在此冒称完成。

## 做了什么

接受路线图既定T4：实查registry不执行DCC，资产手册/3D资产标准§1.4仅手估scale、无模型规范化；T7原normalize是明确未就绪的桥入口。现有capability不能组合出离线网格变换、贴图处理与压缩编码；owner已在路线图§1/§3判A并派Codex施工，按resource-manager走统一资产候选数据，不修改游戏逻辑或sim。

在T7纯数据job扩写normalize：显式源Y/Z及目标米制高度，真实Blender烘焙世界变换到顶点，+Y朝上/底面中心原点/scale=1；超面数预算拒收、贴图保比例缩小≤2k、固定Draco编码并实际重导入解码量测。GLB与spec JSON先交叉核验再一起发布；mock只作协议模拟、不伪造实测spec。候选合并保留原id/license/source/provenance.mock，不自动写index或批准资产。

## 改动面

- `scripts/blender-job.mjs`：normalize闭集params及GLB+JSON输出、mock隔离、发布前交叉校验。
- `scripts/blender/worker.py`：真实规范化/贴图/Draco/解码量测，前置拒动画/骨架/形态键及非三角拓扑，T7建场景/预览保持兼容。
- `scripts/lib/model-normalization.mjs`：实际字节/压缩/索引面数与元数据、米制底中轴心、贴图尺寸一致性校验。
- `scripts/model-normalize.mjs`：数据入口、候选合并API；无索引写入。
- `scripts/model-normalize.test.mjs`、`scripts/model-normalize.integration.mjs`：普通离线边界与另行真实Blender/本地WASM解码验收。
- `scripts/blender-job.test.mjs` / `scripts/blender-job.integration.mjs`：原T7 normalize未就绪预留测试改交T4，rig/retarget仍必须未就绪明确拒收。旧91项中的normalize预留案例由T4替换，T7其余90项保留。
- `src/assets/asset-index.ts` / `src/assets/asset-index.test.ts`：增量可选规范化spec字段及校验，旧scale/genCollision条目兼容；无运行时尺度语义变化。
- `docs/design/ai-pipeline/model-normalization.md`、`docs/design/ai-pipeline/blender-jobs.md`、`docs/design/m2.5-registration-contract.md`、资产/3D手册：先定数据契约、同提交回填入口。
- 最终真实集成证据`/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-normalize-real-mQQbQL`；日志`/private/tmp/t4-normalization-sampler-real.log`；T7真实回归证据`/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-blender-real-B9SWtX`。
- 本Review及`docs/workflow/requests-3d.md`阶段status。未改游戏、UI、renderer或sim。

## 怎么自己验

1. `npx vitest run scripts/model-normalize.test.mjs scripts/blender-job.test.mjs src/assets/asset-index.test.ts`：161项exit0（41+90+30）。覆盖必填/闭集/预算、mock空spec不伪测量、真实子程序边界、所有产物有效后发布、坏JSON/字节/面数/压缩/高度/贴图保持旧文件与失败证据、缺Blender不静默mock、CLI单JSON、来源/许可/原mock不丢、旧mesh spec兼容。
2. 固定4.5.14 LTS的`BLENDER_BIN`运行`node scripts/model-normalize.integration.mjs`，保留证据用`BLENDER_KEEP_EVIDENCE=1`。三个不同离线形状各双跑GLB+JSON哈希；使用本地Draco WASM实际解码顶点/索引，经场景矩阵量测Y-up目标2.4米、底中轴心、三角计数及全节点identity烘焙。Z-up不对称模型的Y层必须含0.8，能分辨倒置。
3. 实读压缩GLB中的PNG宽高，3072×768→2048×512，检查材质贴图仍内嵌。真实超面数预算、非法源轴、缺Blender、动画、骨架、静态形态键、混合线面几何及非默认纹理采样均以具名原因拒收，禁止崩溃冒充拒收。
4. `node scripts/blender-job.integration.mjs`真实T7回归exit0，保留build/render两跑字节一致、机位截图及四类节点证据。
5. 独立早期复查另写层级旋转/非均匀父缩放/负子缩放、Z→Y手性与法线绕序、多PBR同图跨albedo/normal/ORM/emissive槽、四象限RGBA与UV绑定实证。其正式结论由复查方追加。

## 早期独立复查打回与修补

- 无骨架/动画但含静态morph targets/weights时，evaluated mesh会悄悄烘焙默认形态，形态键丢失。改在烘焙前明确拒shape_keys；永久真实夹具明确无animations/skins，含非零weights和顶点位移，不能借别的守卫遮盖。
- 混合TRIANGLES+LINES被Blender只导出三角，三角预算仍正常，线静默丢失。改在导入前检查原GLB primitive.mode，只收4（省略默认4）；其余拓扑明确拒收。永久真实混合夹具保证无动画/骨架/形态键。
- 同图不同sampler的ORM/AO会被Blender合并，某些非mipmap过滤也会被改变。不能把Warning笼统当无害：首版明确只接引擎默认REPEAT/LINEAR/LINEAR_MIPMAP_LINEAR（字段省略可），其他显式采样及错类型导入前拒收、导出后再核验；不做脆弱按材质名事后猜配。补显式默认正例和非默认真拒收。
- authored NORMAL在`mesh.transform`时会被重算：独立分阶段实证import/new_from_object仍正确，transform后分化为面法线。修复先保存(poly,vertex)角点normal，按baked逆转置变换，flip后按新loop身份恢复；正负/非均匀父层级缩放都保留。永久真实断言读本地Draco NORMAL，不以几何生成法线或输出声明代替。

## 撤修验红（施工自证）

在隔离副本每轮精确锚点命中1次，finally恢复原字节，主施工树未被撤改。`/private/tmp/aiflow-t4-red.mjs`的五项真实结果：

| 撤修 | 测试锚点 | 结果 |
|---|---|---|
| 去掉正整数面数预算守卫 | `zero triangle budget` | exit1 / AssertionError |
| 去掉metadata.compression必须draco | `rejects child metadata defect compression` | exit1 / AssertionError |
| 候选合并去掉原provenance展开 | `preserves identity, licensing` | exit1 / AssertionError，原mock来源丢失 |
| 去掉资产索引up闭集校验 | `T4 normalized mesh spec validates` | exit1 / AssertionError |
| 将源Z到Y旋转改成相反方向 | 真实integration的`source +Z must map to +Y, not upside down` | exit1 / AssertionError，不对称Y层断言命中 |

日志`/private/tmp/aiflow-t4-{budget,compression,provenance,index,zup}-red.log`与汇总`/private/tmp/aiflow-t4-sabotage.log`。另在隔离副本撤掉shape_keys守卫、非三角mode守卫、sampler闭集校验（共享函数提前return），每项锚点恰1次；三轮真实Blender integration均exit1、AssertionError: Missing expected exception，分别命中morph、lines、sampler具名拒收断言。主树不撤改，副本finally恢复。脚本`/private/tmp/aiflow-t4-data-loss-red.mjs`；日志`/private/tmp/aiflow-t4-{morph,topology,sampler}-red.log`及汇总`/private/tmp/aiflow-t4-data-loss-sabotage.log`。另在隔离副本把唯一`if corner_normals is not None:`改为false（锚点1），真实Draco解码断言`authored NORMAL must survive inverse-transpose world bake`命中exit1/AssertionError，finally恢复原字节。脚本`/private/tmp/aiflow-t4-normal-red.mjs`，日志`/private/tmp/aiflow-t4-normal-red.log`。修前自然验红与修后回归也有实证：四个错误方向恢复为相同方向，与独立逆转置期望dot全部0.99999917，阈值未放宽。最终T4真实证据`/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-normalize-real-bHDE8M`，T7真实回归`/var/folders/v7/ly_tktgs5qs_fn3kc0b_yfvh0000gn/T/apollo-blender-real-hAOdfJ`；日志`/private/tmp/t4-normalization-authored-normal-{red,green,t7-real,unit}.log`。

## 已知局限 / 偏离

- 真实Blender和Draco编解码已离线实测；三个模型是明确标识的模拟夹具，不是Tripo真实样本。owner明确尚无Tripo凭据，并授权缺API先mock/其它方法持续推进；路线图要求的三个真实Tripo样本待凭据/样本就绪补验，不伪称整波真实生产链已验。
- sourceUp及目标米制高度必须显式提供，工具不推测造型语义。只接静态三角网格；骨架/动画走T5，形态键、其它拓扑或非默认纹理采样须先由DCC显式处理，不宣称T5已支持morph。
- 不自动减面、不做LOD，不用压缩牺牲未知质量来硬凑预算；Draco有固定量化误差，几何校验使用小容差，字节复跑固定同一版本/环境。
- 仅返回待审字段或候选条目，不替人审入库；scale=1因为已烘焙，未改原MeshSpec.scale无运行期消费者的历史语义。
- 缺程序明确失败、mock产物隔离且spec=null，不把mock包装成几何验收。T5授权插件尚未配置，本单不采购授权、不造绑骨成功。

## 最终门禁

**除基线 depcruise 外全绿**。最终冻结源码（含法线修复）在2026-10-20完整复跑：5996/5997通过、0 pending/todo；唯一失败是指定game113围栏。定向161项、新旧T7/T4共131项及T4/T7真实集成均exit0。

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint0、depcruise1，仅game113/guide-art.ts） |
| tsc / build | 0 / 0 |
| vitest全量 | 1（仅对应围栏基线1例） |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有允许WARN，无新增棘轮） |
| spritegen原生node:test | 0（5项，单独原生runner，不减少断言） |
| T4+T7+资产索引定向 | 0（41+90+30=161） |
| T4真实Blender/Draco及T7真实回归 | 0 / 0 |

本面未触发其它face guards。正式末行`❌ 门禁失败于 depcruise（退出码 1）`；余计划实际逐步补跑末行`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。最终日志`/private/tmp/aiflow-t4-final4-{scoped,complete}.log`、各步日志及Vitest JSON；较早轮次不冒充法线修复后的最终证明。只缺真实Tripo三样本另补，未调用付费服务或签任何生产门；正式独立判词另填。
