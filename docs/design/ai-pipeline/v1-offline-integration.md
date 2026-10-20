# V1「提水壶」离线整链预验

分段锁deb7e4024，能力计划 `docs/design/game-z/capability-plan.md` 已在12fa38b7b附独立评审。目标是验证既有能力的真实接线，不把测试替身当生产美术或正式V1结案。原Game Z展台无需为本段增加自由逻辑。

## 三层证据

1. **CPU数据接线**：规范JSON通过parseManifest，显式声明现有provider；从真实SHA已验证的场景目录展开导航/碰撞/地面，strict模式实跑。证据看实际位置、停步、Flag、Signal与Commit后显隐，不只看流程阶段名。
2. **真实GPU技术预验**：同一份固定manifest与隔离AssetIndex，经AssetManager、ModelPool和ThreeRenderer播放；实际骨骼、蒙皮上传、把手、挂件、相机、拾取及像素都要观测。独立render时钟、多tick追赶、重复运行、世界纯读和资源收敛分别验。
3. **正式V1与人审**：仍需真实Tripo人物/水壶、授权绑骨/动作、生产院落与真人R1；本段无这些输入时只记未验，不代填来源、不自动approve、不签人门。

## 数据接线

- 角色由NavAgent.patrol走到固定站位，Relation另指把手，FaceRotate负责面对目标。Zone到区后GameFlow推进；动画和IK读下一拍停稳时发布的reach Flag，避免边走边抓。
- 初始桌面壶与隐藏手持壶消费同一model/kettle。手持壶预挂RightHand；contact Signal只由既有Effect切换Visibility，不临时改Transform或Attach3D。
- 两条现有同臂IK链按数组顺序工作：reach对独立把手锚；contact后reach渐退、carry渐入对较高的独立持壶锚。目标保留至渐退完成，不能指向当前手的挂件反向自追逐。
- 外部idle/walk按速度混合，reach Flag进入单次reach clip；原生动画和IK仍只属表现，不从动作帧改sim或产生玩法完成事件。镜头用既有信号触发CameraShot3D。

固定夹具数据允许在离线制作时量测骨骼与把手并填offset/rot；最终验证必须重载冻结数据独立重跑。接触边界不得挪壶补齐误差；既要看零时间边界的空间连续，也要看正常帧率下实际位移与抬升。只有测试替身时采用台面取壶，不声称地面弯腰动作已验证。

## 素材与边界

自产T5 generic Blender字节保留实际骨架/动画；壶可由现有three TeapotGeometry离线导出，明确记录源/许可/哈希与真实handle点。最终仍通过统一AssetIndex路线消费，不将geometry构造塞进游戏或渲染器。场景使用已经烘焙并SHA绑定的GLB候选，不用空壳mock充当可走导航。

测试工具只能装载、采样、断言及输出证据，不含私有玩法system，不改引擎/provider、PUI、已结案能力或游戏层。普通门禁无需Blender、凭据和外网；真实GPU需本机Chrome与显式离线素材。缺输入时应明确拒收并说明，不能输出整链已通过。

## 复现入口

先准备自产T5的idle/walk/reach GLB及fixture-source.json，和已烘焙的scene.glb/scene数据（含原GLB SHA）。输出使用独立空目录；工具拒绝覆盖、源目录重叠和链接绕行，不将测试包写入生产游戏目录。

```sh
node scripts/prepare-v1-teapot-fixtures.mjs --out <新目录> --character-dir <T5目录> --scene-glb <scene.glb> --scene-data <scene.json>
node scripts/verify-v1-teapot-browser.mjs <上述输出目录>
```

真实GPU入口需可用Chrome，可用RENDER_PROBE_CHROMIUM指定本机可执行文件。默认消费仓内固定manifest；`--manifest <path>`只供独立对抗副本，`--calibrate`仅输出制作期测量，不回写manifest，不生成最终验收结果。普通Vitest的24项仅使用明确的合成单元输入，不依赖上述外部目录、Chrome、Blender、网络或凭据；完整浏览器证据另跑，不以单元绿灯代替。

当前夹具包只有6项，group=v1：scene、model/hero、motion/idle、motion/walk、motion/reach、model/kettle。英雄模型只去掉内嵌动画，保留骨架/rest与二进制；外部动作原始字节保留。水壶来自three的MIT TeapotGeometry，4032三角形、高.35m，实际把手顶点与源码/许可SHA落入fixture-inputs.json。付费来源与productionApproved均false。

## 实测边界与发现

首轮manifest制作期标定：SHA从f91e2bac3e4526b18b737072dfde0003b28261168724d84e7ac0079e5fff6392变为76f12f3fbc29d40bdb22589b028f391d8e8cc5fff92285871379116a60cb9045。只填桌面/手持壶静态位姿与Attach offset/rot、移除可选Sky；原生手端对把手误差4.174e-8m。capability、sim、流程、目标与时序未改；首轮CPU8项已按新SHA重跑。第二次只更正方向光单位向量后，最终SHA为2cede7f38b4b283580b136e46cd401ba1a84fe519d8bc4ac770c7a96ed18308a，不能称为只有一次标定。实时探针不写World或临时改Attach补齐交接。

本配置保留方向光sun和环境fill。首轮五节奏重放读数发现sun方向y=+6使原生灯位落在地面下方、动作阶段阴影不变；第二次把三分量静态单位化并令y向下发光，独立临时变体证明PCF深度hash由6798b29f变为8c0a75e3，再将这三个数写进固定数据；最终清单重新五节奏重放。早期读取阴影color attachment恒hash不是深度阴影证据，已改为原生PCF depthTexture采样，不能据旧色缓冲读数声称没有阴影。首次带Sky3D.env=.6真实运行暴露旧天空资源生命周期问题：destroy遗留1texture/1native buffer；env=0时虽GPU归零，天空渐变贴图dispose仍2次。两份失败证据保留，未将其当基线豁免或已修复。V1固定配置不启用Sky，此旧缺陷另锁单修，禁止为本段偷改已结案引擎或放宽资源断言。

本机另实跑既有T4规范化：自产水壶132728字节→23024字节，4032三角形，Draco，Blender宿主后台退出0；但本段资产工具消费的是原始未压缩水壶，不能把旁证当作完整演示已使用压缩模型。普通测试/浏览器入口均不启动Blender；该次原生T4旁证单列，非真实Tripo来源验证。
