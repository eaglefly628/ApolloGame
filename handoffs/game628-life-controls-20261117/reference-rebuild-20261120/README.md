# Game 628 · 按参考图重建的生活街区

目标是用户明确选中的 `generated_images/exec-e200c4ec-58a4-40bd-a8e6-2c5cfc5b3c19.png`。本次不再受旧 K 线窄窗楼轮廓限制；另外制作低层宽窗住宅、五间开敞店面、可见的店内与住宅陈设、街道植物、远巷和人物。旧K库、旧材质实验和换街原型保留；没有提交、推送或发布。此为本地美术重建候选，不登记为用户已验收或逐像素复刻。

## 运行

- 重建街景：<http://127.0.0.1:18829/?scene=reference-street>
- 跟随散步：<http://127.0.0.1:18829/?scene=reference-walk>
- 人物动作：<http://127.0.0.1:18829/?scene=reference-characters>
- `start-reference-preview.command` 双击直接打开新版；旧 `start-preview.command` 默认入口保留。
- 左右/A D行走，Space招呼；晴日、黄昏、入夜按钮平滑切换；顶部可返回上一版。

四个新场景均由 `assemble-reference.py` 离线生成JSON，继续由现有Apollo manifest、LayoutNode、Model3D、AnimState3D、Light3D、Post3D等解释。新增host表现适配只写AnimState3D，按实际接受的Transform位移/world tick标定走路、停步、招呼和移动打断；不是新模拟系统，也未修改共享渲染器。新quality预设消费既有4096阴影图和dpr2选项，旧场景仍1024/1.5。

## 场景与材质

`public/art/reference-rebuild-20261120/scene/street-reference-v4.glb` 为当前静态近景，114,632三角形、原创建筑与陈设；材质使用正确sRGB→线性因子及26张共享512px微表面图，不烘焙太阳光或树影。各店分别保留果蔬货架、面包陈列、面馆锅具红帘、猫咖猫树和猫、修车道具及自行车。上层有窗框、窗帘、书架、阳台、藤蔓、空调与晾衣；街道含树、花、砖缝、盲道和路桩。

`model/` 保留制作脚本、可编辑Blender源、接合声明、v1/v2/v3候选及最终GLB的几何/接触复查报告。v3仅把三只静态猫整组下移至实际支撑面，生产报告相对名义支撑高度误差≤3.34e-8m；独立实际表面射线复查发现地面猫约2mm间隙（平台猫贴合），不冒称三只均零间隙，索引/法线/UV/切线/材质/节点保持，受影响POSITION min/max已更新；v2保留。

## 光影与已知边界

- 真实方向光投影，晴日去向(.65,-1,-.75)，黄昏换方向/色温，入夜换月光与环境色；树、阳台、雨棚、家具和人物参与投影/接影。
- Post3D AO用于接触与缝隙，非把日光画死进颜色；相机、演员行走两端及三个时段已进行实际LightRig阴影视锥覆盖检查。当前基座按实体原点框阴影，不读取GLB尺寸，故以透明1mm渲染锚点声明真实近景范围。
- 四处实时室内灯：面包房/面馆为有遮挡阴影的point，半径3m；猫咖/修车为受限spot，range2.3/angle.58，灯位与模型合同配准。当前基座上限4盏局部光/2盏局部投影；其余可见灯具是装饰性发光材质，未独立求光。没有完整全局光照/逐灯间接反弹，不能据此宣称所有光照物理精确。
- `background-reference-tintable.glb` 独立原创远城/山体，原色转顶点COLOR_0、白色KHR_unlit材质，昼夜Model3D.tint乘色。当前Model3D不支持关闭cast/receive，未虚填无效字段；背景Z≤-20.81、近景Z≥-9，且所有太阳dirZ<0，几何上不能向近景投影，局部灯也够不到它。原背景文件保留。
- 后面、底面与每件小饰物未做穷尽视觉验收。独立闭合零件有受控隐藏搭接；分析副本焊接后的多流形/重复面数不冒充实际资产已布尔消除。

## 人物与动作库

`character/README-REVIEW.md`、`character-contract-v2.json`、`character-verification-v2.json`记录原创rigid分段造型与真实本地完整帧库的来源。使用站立/行走/招呼三段，65条源旋转轨道保留。原Skin、FBX及原始动作包没有复制进项目，动画库原件未改。

当前角色 `traveler-v4.glb` / `shopkeeper-v2.glb`，身高约1.737m，Yup/+Z朝前；帽子、头发、眉眼鼻嘴、长袖、鞋、背包/围裙。名义步速.922146m/s，60Hz为.01536910147m/tick，主角以.02m/tick行走时按实际位移调整播放倍率。静止播idle；撞Bounds没有实际位移即停步；招呼完整4.733秒且重复触发不延期，移动可打断。离线前掌低位200ms窗口最大滑移左1.70cm/右.67cm，未把离线样本冒充所有转向/坡阶/复杂互动已验。

## 并行天气工作保留

共享目录的 `weather/assemble.mjs`、host天气保持逻辑、environment扩展、天气测试和海边场景是已有并行工作，本次未删除/重写其源码。基准场景重生后，`refresh-weather.mjs`读取既有producer并在本目录生成适配副本：仅把碰撞输入改为当前实际GLB，内存碰撞副本删除材质绑定以支持Node GLTFLoader，但几何与节点原样；随后恢复3场景的天气实体/按钮/预设。自己的碰撞证据存本目录，原weather/collision-samples.json保留。当前雨线220条，叠加全部效果260个，雪/覆雪122个。天气结果继承既有范围：静态三角面遮挡，不包含移动人物的雨滴碰撞。

## 验证

- 主会话：实际Apollo浏览器晴日/黄昏/入夜、人物v2站立/招呼、散步与停步；最终18829构建截图见 `../evidence/reference-20261120/`。
- 独立复查：`reference-review.test.ts`、本目录 `review-*.py`；实际资产、JSON合同、开口、行走脚掌支持、演员净空、阴影范围、昼夜背景与动画不改模拟。
- TypeScript、完整当前原型+独立reference测试、Vite build均以最终运行记录为准，写入 `delivery-verification.json`。Vite既有Jolt模块外部化与bundle体积告警保留。
- 不包含室内可行走玩法、猫AI、真实买卖或Steam发行；这些没有因静态陈设或动作库接入被宣称已实现。

前一轮v3验证：28/28测试、TypeScript退出0、Vite构建退出0；4个实际接入模型public/dist SHA一致。最终18829晴日/黄昏/入夜/雨/雪、跟随行走停步已目击，最终观测窗口无新console警告或错误。前景增加道路延伸至画外，天气碰撞副本同步包含其真实box；旧模型原件保持。

前一轮v3独立复跑同样28/28与tsc退出0；v3猫地面实际2mm精度备注已保留，不登记为严格全场零间隙。


## 2026-11-20 局部修复与差异化

- 白线实机根因是跟随镜头使用的4.6m透明细杆camera-anchor；同角色同路线A/B中原杆可见白线，10μm立方体加现有Pivot3D高度偏移后消失，关注点仍为2.3m。没有修改共享渲染器或骨骼。对照截图见 `../evidence/render-fixes-20261120/follow-a.jpg` / `follow-b.jpg`。
- traveler-v4继承v3按实际鞋底顶点240Hz重算的Hip竖向轨道；960Hz复测正常行走悬空最大约0.52mm（原约10.48mm）。帽檐另修真实自交和8条裸边，其他动画与源模型前缀保留。合同为 `character/character-contract-current.json`。此为离线接触校准，不是真实运行时IK；原有idle/walk跨淡混合约5.8cm瞬时穿地限制仍在，不能宣称所有混合姿势脚底约束已解决。
- v4移除原静态三猫，改为3个独立GLB与AnimState3D(cat_idle)，8/7.2/9秒循环，包含轻呼吸、眨眼、转头/耳动/尾摆。根与爪不动画，120Hz全周期检查固定承托，无移动/寻路AI。
- 五户上层改为园艺、用餐、阅读喝茶、客厅、手工五套组合。23盆栽slot持久化种类、花盆材质、朝向、位置和尺度；偏航限±12°、尺度.85–1.15，底面遵循支撑，不每帧随机。配置见 `public/art/reference-rebuild-20261120/scene/variation-plan-v4.json`，固定seed6281120。
- 原v2/v3模型、旧场景、K库与并行天气工作保留；本次未提交推送。

本轮v4最终验证：TypeScript退出0、31/31测试、Vite构建退出0，7份接入模型public/dist SHA一致；最终实机街景、随行移动/停步、猫姿态、黄昏与雨已目击，观测窗口console warn/error为空。详见delivery-verification.json与review-v4-*.json。


## 当前新增原型：街道纵深与居民五官

当前reference街景支持WASD/方向键的XZ地面行走，中心范围X±8.95m、Z.8～3.8m；8个真实几何来源的有限代理阻挡低物件，最大全扫街接触残差.414mm，未宣称精确网格碰撞。camera-anchor同时受有效中心Bounds约束，避免hierarchy先于Bounds造成2cm偏移。Space仍是招呼动作。

独立 `?scene=face-studio` / `?scene=face-gallery` 验证眼、眉、鼻、嘴各3样式共81种有限组合、单项修改及种子随机重放；五位店员在街景也使用不同faceDNA。动作与五官均属同一Head层级，源角色和主角v4保持。脸部说明见 `../face-studio-20261120/README.md`，不把有限原型当成无限捏脸系统。

最终冻结验证：45/45测试、tsc0、build0，12个街景资产、81个脸部glTF配方、共享BIN和6个场景JSON的public/dist SHA全部一致。当前真实引擎证据在 `../evidence/depth-and-faces-20261120/`。详见 `depth-faces-verification.json` 与独立 `review-depth-faces-summary.json`。已知斜向速度sqrt(2)倍及既有脚底混合穿地限制保留。
