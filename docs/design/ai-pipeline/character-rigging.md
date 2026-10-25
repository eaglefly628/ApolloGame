# T5 绑骨、动作与 S3 人工回灌

施工锁：3D 总单 `REQ-3D-AI-PIPELINE` 的 T5(+S3) 分段。生产路线仍为 T4 → Auto-Rig Pro Smart → Mixamo 人工 FBX → Auto-Rig Pro Remap → E2。本机没有授权 ARP 或真实 Tripo/Mixamo 输入；owner 已授权先用 Mock 推进。**本批不宣称真实 Smart/Remap 完成**，不以普通 Blender 骨架替换生产路线。真实缺插件或没有受测的版本适配器时非零退出；安装检测也不等于实际执行成功。

本机 Codex macOS seatbelt 环境下的原生 Blender 启动已实证会崩在 Metal 初始化，业务脚本尚未开始。T7 和本批直接夹具入口共用启动前拒收守卫；真实验证仅用宿主授权的正常执行环境串行跑，缺权限先Mock，不在沙箱里反复启动，也不改环境变量规避权限。详见 `blender-jobs.md` 启动守卫。

## 标记点提案

```sh
node scripts/character-pipeline.mjs prepare /path/to/T4-character.glb /path/to/new-character-workspace --character hero --mock
node scripts/character-pipeline.mjs run /path/to/new-character-workspace/rig-job.json --mock
```

去掉 `--mock` 的 prepare 只调用 T7 的真实 render-views，无需 ARP。`--blender <固定LTS程序>` 或 `BLENDER_BIN` 指定程序，默认 PATH 的 blender；`--timeout-ms` 控制作业上限。workspace 父目录须存在，workspace 本身必须不存在；不覆盖旧提案或他人的文件。源模型显式指定、复制后不再读取可变原文件。

prepare 复用 E5 的本地 CPU 几何解码器（含 Draco/meshopt）读取实际三角网格，不相信 accessor 的 min/max；只收静态、Y-up、米制高 0.1..100、脚底中心原点的 T4 模型。拒收已有 skin、动画、morph。按实际包围盒生成固定四机位，T7 渲染四张 PNG，再投影 13 个编号标记点。四视图用于人工核对；**包围盒启发式没有解剖识别能力**，T/A-Pose、肢体位置、遮挡、非对称及手指细节均须人判断。

产物：`source.glb`、`render-views.json`、`refs/{front,back,left,right}.png`、`annotated/<role>-markers.png`、`markers.json`、`rig-job.json`、`proposal-report.json`。同环境同输入标注 PNG 字节一致，原始参考图不涂改。Mock 的原始渲染保留 T7 mock 证据路径，报告始终 `humanConfirmation:false`、`realArpValidated:false`。

marker JSON 闭集：`version:1, characterId, profile:"apollo-humanoid-v1", modelSha256, bounds:[min,max], state:"proposed"|"confirmed", method:"bbox-proposal", views, markers, confirmation?`。views 严格 front/back/left/right 顺序，每项为 `{role,path,sha256,width,height,camera:{position,target,fov}}`；markers 严格 `{id,position:[x,y,z]}`，顺序如下：chin、neck、hips、left-shoulder、right-shoulder、left-elbow、right-elbow、left-wrist、right-wrist、left-knee、right-knee、left-ankle、right-ankle。坐标是 glTF +Y-up 米制，左右是作者明确选择，不能根据屏幕左右自动确认解剖左右。

真人微调后保留提案数据、将 state 改 confirmed，附 `confirmation:{by,markersSha256}`。SHA 由 `markerDigest(sheet)` 计算，覆盖模型、参考图、标记点、机位及其它提案字段，排除 state/confirmation 自身。`by` 必须命中 owner 自填的 `docs/roles/humans.json`；模型、PNG、点位、机位改变使旧确认失效。没有自动确认命令；施工方不能填写姓名或确认。Mock 可消费 proposed，但不会把它改成 confirmed。

## T7 绑骨/重定向作业

Smart 新闭集入口：`{op:"rig-arp", inputs:[model.glb,markers.json,front.png,back.png,left.png,right.png], params:{profile:"apollo-humanoid-v1",markersInput:1}, outputs:[rig.glb]}`。

Remap 新闭集入口：`{op:"retarget-arp", inputs:[rig.glb,motion.fbx,provenance.json], params:{profile:"apollo-humanoid-v1",clipId:"walk",fps:30,frames:31,loop:true,inPlace:true,provenanceInput:2}, outputs:[walk.glb]}`。frames 包含两端采样点，时长 `(frames-1)/fps`；fps 为 1..120 整数，frames 为 2..36001 整数。无自由 Python/operator/表达式字段。

输入先快照再执行，校验模型、PNG/FBX 的实际 SHA。输出须为真实三角网格、skin、有效 JOINTS_0/WEIGHTS_0、有限且有效的 inverse-bind matrices 与骨架层级，不能是空 GLB。动作文件恰好一个 clip，统一从 0 开始的等距采样、帧数和 clipId 与作业一致；目标骨架必须连 bind/rest 指纹一致，不能只看同名。Mock 输出实际蒙皮/采样数据仅证明协议，留独立 mock 域；不能生成正式索引候选或覆盖真实路径。

17 个必要骨名：Hips、Spine、Chest、Neck、Head、LeftUpperArm、LeftLowerArm、LeftHand、RightUpperArm、RightLowerArm、RightHand、LeftUpperLeg、LeftLowerLeg、LeftFoot、RightUpperLeg、RightLowerLeg、RightFoot。允许额外唯一骨名与中间骨；必要祖先链必须正确。**这是导出骨架命名契约，不能在 ARP 工作骨架上直接乱改内部骨名**；须在受测导出映射上生成。骨架 SHA 覆盖名称、父链、local/world rest 与 IBM，不含网格或 clip。

当前校验器接受普通非 sparse、未压缩的自包含 GLB、最多一套 skin、4 权重、TRS 动画；LINEAR/STEP/CUBICSPLINE 通道形状会校验。morph、JOINTS_1、压缩动作等暂明确拒收，先在 DCC 导出受支持格式。T4 静态输入可压缩，prepare 仍实际解码量尺；不能把静态压缩输入支持误当动作压缩支持。

## 动作清单及下载记录

```sh
node scripts/character-pipeline.mjs motion-list docs/design/<slug>/motion-list.md
```

仅新建，不覆盖已有清单。初始 idle/Idle、walk/Walking、lift-kettle/Picking Up 都是搜索建议，提水壶明确需 E4 对手/壶把。人工按最终清单下载 FBX Without Skin 至 `assets/_inbox/mixamo/<clip-id>.fbx`。不自动登录或调用不存在的官方 API。（2026-10-25 owner 另令：本机建库可用 `scripts/mixamo-fetch.mjs` 批量下载到仓库外目录，见 `mixamo-library.md`；正式回灌仍按本节。）

每条 FBX 的 provenance 为：

```json
{"version":1,"source":"mixamo-manual","clipId":"walk","sourceSha256":"<FBX SHA256>","targetSha256":"<rig SHA256>","skeleton":"apollo-humanoid-v1","fps":30,"frames":31,"loop":true,"inPlace":true,"searchTerm":"Walking","download":{"format":"FBX","skin":false},"licenseUrl":"https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html"}
```

记录由下载者填写；SHA 绑定和 URL 不能证明购买、许可资格或实际使用了某插件。真实入口还解析 binary FBX 7.1..7.7 的结构、属性/偏移/压缩数组、动画曲线/时间与连接，拒绝文本改后缀、只有文件头的伪文件或无有效动画；ASCII/旧版明确拒收，请在DCC导出binary 7.x。该校验不执行Remap、不评判动作解剖质量；fps/frames/inPlace是本次制作目标，仍须人工检查实际重定向效果和根运动。Mock 测试来源可标 `mock-fixture`，仅显式 Mock 接受；Mock跳过FBX结构会明确留日志。返回候选保留该记录，不能洗掉模拟来源。

## S3 三处人工步骤怎么接回

1. **Tripo 网页局部重生成**：保留旧输出与 source record；将新 GLB 和网页任务/模型 ID、操作描述及许可来源记录放进该角色新的工作目录。走现 T3 人工样本导入与 T4 normalize，再重新 prepare。旧 modelSha256 不同，旧四视图/标记点确认全部失效，不只替换同名 GLB。
2. **ARP Smart 标记确认**：在固定 LTS 与授权插件机器中，按 annotated 图定位，人工核对 T/A-Pose 与朝向。glTF +Y 转 Blender +Z 后前方须符合 ARP 要求的 −Y；不要凭导出 metadata 猜脸朝向。在 Smart UI 微调标记、生成和蒙皮，人工检查关节，再以受测映射导出 bind-pose GLB。归档人工确认 sheet、真实 Blender/ARP 版本、输入/输出 SHA；禁止把插件、授权文件或 AI 权重提交仓库。
3. **Mixamo → Remap**：按清单下载后记录上面的 sidecar，在 ARP Remap 中指定 source、同一 target 和映射，烘焙每个动作。导出各一个 clip，确定 0 起点和 fps/frames，分别填回灌 manifest。无对应动作时保留近似来源与“需 IK 修正”，不能记成完美对齐。

人工输出可用 `return` 做格式/来源绑定校验并形成待审候选，**不要求本机伪装运行 ARP**：

```sh
node scripts/character-pipeline.mjs return /path/to/return.json /path/to/new-return-workspace
```

rig manifest：`{version:1,kind:"rig",id:"model/hero",servedPath:"models/hero.glb",sourceModel:"source.glb",result:"rig.glb",markers:"markers.json",provenance:"rig-provenance.json"}`。rig provenance：`{version:1,source:"arp-manual",sourceSha256,outputSha256,markersSha256,blenderVersion:"4.5.14",arpVersion:"<实际版本>"}`。真实 rig 须已有白名单真人确认、来源模型实际 bounds 与 sheet 一致、输出维持 T4 高度及脚底中心、没有动作。

animation manifest：`{version:1,kind:"animation",id:"motion/walk",servedPath:"motions/walk.glb",sourceModel:"rig.glb",result:"walk.glb",motion:"motion-bundle.json",provenance:"arp-return.json"}`。motion-bundle：`{fbx:"walk.fbx",provenance:<上面的Mixamo记录>}`；ARP return provenance：`{version:1,source:"arp-manual",sourceSha256:<FBX SHA>,targetSha256:<rig SHA>,outputSha256:<动作GLB SHA>,blenderVersion,arpVersion}`。所有输入路径相对相应 manifest/bundle/sheet 所在目录解释，先读成快照，验证和发布消费同一字节。

新 return workspace 中保留 `candidate/<kind>.glb`、`inputs/*.bin`、`report.json`、`asset-index-candidate.json`。animation 候选形状为 `type:"animation", spec:{skeleton,fps,frames,loop}`，sourceEvidence 是 `user-supplied-arp-export`，**realArpValidated/realMixamoValidated 仍为 false**，不能把格式校验当真实生产验收。进入现有资产待审/登记流程后才能写 `assets/index.json`，工具不自动批准、不签生产人门。`--mock` 的 return 留 mock 子目录，candidate 为 null。

## 验证与剩余真实验收

无 key/网络：`npx vitest run scripts/character-glb.test.mjs scripts/character-pipeline.test.mjs scripts/blender-character.test.mjs scripts/blender-job.test.mjs`。

离线 Blender：`BLENDER_BIN=<固定程序> node scripts/character-pipeline.integration.mjs --out-dir <新证据目录>`。它自造一套普通 Blender 人形测试骨架及 idle/walk/reach 三 clip，实际导出两轮，比较字节/语义 SHA，并用引擎同依赖的 GLTFLoader + AnimationMixer 采样骨骼与蒙皮顶点。source 为 `generic-blender-fixture`；realValidation 仅指该离线试验，ARP/Mixamo/Tripo 三项各自为 false。缺 Blender 明确 skipped，realValidation=false；`--mock` 同样不能冒充真实工具验证。

仍待 owner 具备授权安装后补：固定 ARP 版本的 Smart/Remap 无头适配器实测、一个真实 Tripo 人物与三个真实 Mixamo 动作、Blender 人工确认无穿模/翻折，以及 E2 的真实同骨架绑定。现阶段不会输出真实链路完成或人门通过结论。E2 可先用本批真实离线 clip 验证通用运行时，付费来源验收单独保留。

依据：[ARP Smart](https://www.lucky3d.fr/auto-rig-pro/doc/auto_rig.html)、[ARP Remap](https://www.lucky3d.fr/auto-rig-pro/doc/remap_doc.html)、[Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)。官方文档明确的 UI 操作不等于经过测试的稳定 bpy Smart/Remap API，本批不猜 operator 名称。
