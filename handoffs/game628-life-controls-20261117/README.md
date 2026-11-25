# Game 628 · 横街控制与人物构造原型

本目录是 2026-11-17 新生活模拟方向的本地独立草案，不覆盖或接管 `game628-goose-playable-20261109`。没有修改共享引擎、K 美术线、其他游戏或 launcher，没有提交、推送或发行。

## 试玩

- 街道：<http://127.0.0.1:18829/>
- 人物：<http://127.0.0.1:18829/?scene=people>
- 左右方向键 / A D 横向行走。在 x=-6、x=6 的路牌附近，按一下上 / W 或下 / S 换街。第一街没有更前一街，第三街没有更后一街。
- 人物页对照左侧“嘴巴＋眉毛”和右侧“嘴巴＋眼睛＋眉毛”，各有三种头型、耳朵、衣着比例。1–5 或下方按钮切换平静、开心、难过、生气、惊讶。

双击本目录 `start-preview.command` 可启动当前构建并打开本机浏览器（18829 端口，关闭缓存）；试玩期间保留启动终端。也可从仓库根目录运行 `python3 handoffs/game628-life-controls-20261117/preview.py`。

开发模式（仓库根目录，18828 端口，与上述试玩入口分开）：

```sh
./node_modules/.bin/vite --config handoffs/game628-life-controls-20261117/vite.config.mjs
```

## 当前版本的表现

同一时刻只加载一条街；另外两条街不在本场景中。镜头为小角度透视，跟随角色左右移动；建筑有真实墙体厚度、侧窗、屋檐和台基，正面贴原创 SVG 立面草图。远处仅有植被和天空。

2026-11-18 更新：现有 Zone + KeyBinding + EventWhen + Effect 判定路口与换街意图，置具名 Flag。宿主先预取下一街数据与资产，在隐藏渲染面完成模型解析、着色器准备和首帧渲染；旧画面始终保留。角色沿 Path3D 进入入口、Camera3D 跟随推进，到机位对齐后以 320ms 画面叠接切至下一街，随后角色走出、镜头拉开。全程不跳转或重载页面，地址仅由 history.replaceState 更新；到达侧保持一致。输入锁定期间清空离散输入，结束后恢复。

这是无黑屏的同页切场表现原型，采用预加载与画面叠接；并未把三条街合成一个连续开放世界。三条街暂时复用店面类型以隔离镜头与控制变量。人物为原创程序化体块候选，步态为简单节点动画，尚非正式角色或完成的骨骼动画。五官方案、美术路线均未定稿。

## 能力与数据边界

依据 `CLAUDE.md`、manifesto、movement-pathfinding / events-logic / 3d / UI 手册及 capability registry 实查，接受现有能力重组：

| 需求 | 现有能力或组件 |
|---|---|
| 横向输入与限界 | `i3-controllable`、`t1-motion-apply`、`t2-bounds-clamp` |
| 路口与一次换街请求 | `t2-zone-occupancy`、`t2-keybind`、`t2-event-when`、`t2-effect-apply` |
| 相机跟随定位 | `t1-hierarchy-resolve`、`Camera3D.follow` |
| 入巷/出巷与推拉镜头 | `Path3D`、`Transform3D`、`Camera3D.tween`（纯表现） |
| 建筑与贴面 | `Mesh3D`、`Material3D.shading/map` |
| 人物及步态 | `Model3D`、`AnimState3D.speedAtVelocity` |
| 表情对照 | `KeyBinding` + `Effect.set-visible-tagged` |
| 所有 UI | `LayoutNode` + `mountUI`，house `apolloOnyx`，成熟 `sheen-hover` / `glass` |

玩法都在 `public/scenes/*.json`，无游戏层 system。纯 JSON 场景依 capability-plan 模板的适用范围免正式代码游戏 plan。`host.ts` 是独立本地宿主：装载 manifest、混合资产加载、输入入队、同页双缓冲换场、读取 Flag 以及闭集的 Camera3D / Path3D 纯表现配方；没有改共享能力。`transition-layout.ts` 保持两个 LayoutNode 渲染面结构稳定；SceneCompositor 仅在渲染面做浏览器合成动画，不用 UI.update 改其布局属性，避免 LayoutNode 重建 WebGL 画布。所有 HUD 和按钮仍为 LayoutNode。`produce.mjs` 仅离线生成 GLB、SVG 和场景 JSON，不参与运行期规则解释。

资产来源和候选状态见 `public/art/provenance.json`。30 个原创 GLB、5 张原创矢量立面，无第三方人物、地图或贴图，无 AI 位图。本地候选不提升为正式美术库资产。

## 验证与证据

```sh
./node_modules/.bin/vitest run --config handoffs/game628-life-controls-20261117/vitest.config.mjs
./node_modules/.bin/tsc -p handoffs/game628-life-controls-20261117/tsconfig.json --noEmit
./node_modules/.bin/vite build --config handoffs/game628-life-controls-20261117/vite.config.mjs
```

9 项测试覆盖：渲染面结构稳定与两方向不透明覆盖不变量，以及全部视图装载和 LayoutNode 校验、纵轴锁定、路口门控和拒收请求失效、两侧往返、单街实体隔离、世界边界、五表情同步切换。另有浏览器实际试玩和 `evidence/` 截图；具体复查与最终命令退出码见 `verification.json`。

构建目前保留共享 Jolt 的 node:module 浏览器外部化提示和大块体积提示，不等于正式发行门禁通过。本目录仅交付本机原型。

## 2026-11-18 无黑屏验收

正反向各连续采样 70 帧，共 140 帧；实际有画布的合成覆盖率始终为 1，街景区域最大暗像素占比 0.125%，未出现黑屏。浏览器记录同时保留 ready / departure / arrival / seamless，未出现 warn / error；实际试玩包括两方向换街、人物表情及返回街道。证据：`evidence/seamless-20261118/`。

独立复查通过 404、无效 manifest、WebGL 构造失败、模型预热超时、departure 拒收、arrival 完成阶段拒收等故障注入；失败保留当前画面和控制，禁止同一失败旗标自动重试循环，正确释放隐藏渲染面及键盘监听。底层不透明、失败旗标锁定及监听释放均经锚点命中的内存撤修验红。

## 2026-11-18 · K 线城市美术样景

入口：<http://127.0.0.1:18829/?scene=art-overview>。顶部切换「漫游 / 全景 / 拆件」，漫游中左右行走、镜头跟随。底部早晨、白天、傍晚、夜晚（键盘1–4）在1.8秒内插值太阳、环境光、天空与少量窗光；夜间仅三处店铺点光源。

读取本地 K 线 `closure-review-20261117/ASSETS-614.json` 的14类模型，经源SHA校验后复制至本目录；没有改K源文件、生产状态、台账或预览服务。按 apollo-prop-modeling 的米制模块、先声明接缝、最终GLB重导入、几何与多角度复查流程补建阳台、空调、雨棚、招牌、自行车、树6类独立模型。花槽发现共面角落黑斑，标记needs_review并排除出全部场景。

场景包含果蔬铺、面包房、面馆、猫咖、修车铺及楼上住宅，是概念参考下的模块化3D草案，尚未达到概念图材质/细节质量；招牌文字、室内、动态树、宠物行为未制作。人物继续用原控制原型候选。原横街换街原型保留，当前美术样景单独演示。

- `art-production-20261118/k-sources.json`：源路径、源ID、SHA、原复查状态、实际包围盒。
- `art-production-20261118/scene-decomposition.json`：各物件、模块变换、建筑分区、接触规则与有意开口。
- `art-production-20261118/custom/README-REVIEW.md`：新增模型制作源、Blender源文件、最终GLB检查与未验收项。
- `art-production-20261118/verification.json`：最终资产SHA与检查结果。
- `evidence/art-20261118/`：实际引擎截图。

新增RenderEnvironment只解释闭集渲染字段，未改共享引擎或模拟规则。独立review修复了货箱悬空、路面被底板覆盖、跨场景按钮和白名单原型继承问题；数值/接触复查通过。已跑13项测试、TypeScript与Vite构建。保留既有bundle体积/Jolt模块告警；未提交、推送或发布。

## 2026-11-19 · 每栋不同材质的实机候选

新增独立入口 <http://127.0.0.1:18829/?scene=material-street>：五间店分别使用暖橘灰泥、奶油灰泥、红砖、柔绿灰泥、灰蓝漆面。原K模型位置、索引、法线与节点保持，材质副本不覆盖源。顶部「单栋对照」「材质近景」可查看同机位同光照的白天/傍晚原版和实验版；「原街区」返回旧成果。制作源、限制与验证见 [material-study-20261119/README.md](material-study-20261119/README.md)。五件最终资产与dist哈希一致，772个primitive几何保留，13项测试、tsc、build与独立复查通过。未提交推送。

## 海滨预览

从街坊首页点「海滨」，或打开 <http://127.0.0.1:18829/?scene=seaside>。同页换场，点「回街坊」返回。海水颜色由近岸浅青过渡到远海深蓝，三道浪线使用 GLB 内置动画错峰推进。沙丘树木采用 K 线技术候选，来源见 `public/art/seaside-v1/k-provenance.json`。

## 2026-11-20 · 按用户原参考图重新搭建

新版入口 <http://127.0.0.1:18829/?scene=reference-street>，也可双击 `start-reference-preview.command`。五家开敞店铺、低层宽窗住宅、阳台/窗帘/绿植、真实树影、巷口远城、街道与原创居民按选定概念方向另建；人物接入本地库的idle/walk/wave，左右行走、Space招呼。晴日/黄昏/入夜及并行天气工作保留。旧K库/原材质/旧换街成果未覆盖，未提交推送。

本地美术候选与全部实证/源文件见 [reference-rebuild-20261120/README.md](reference-rebuild-20261120/README.md)。当前不是逐像素复刻或用户最终验收；实时灯预算与全局光照边界在该说明中明确。当前v4包含五户室内/23盆栽差异、三只动画猫、主角浮脚校准与相机白线修复。最终31项测试、tsc、build通过；7份public/dist资产哈希一致；最新实机证据在 `evidence/render-fixes-20261120/`。


## 街道纵深与居民捏脸原型（2026-11-20）

- `?scene=reference-walk`：WASD/方向键在街道地面前后左右走。W/↑朝店面，S/↓朝街边；8个有限几何碰撞代理与现有引擎约束阻挡路边物件，仍不是店内/楼梯玩法或完整对话系统。
- `?scene=face-studio`：原创眼睛、眉毛、鼻子、嘴巴各3样式，81种有限组合；单项选择、种子随机整脸、重置重放。可双击 `start-face-preview.command`。
- `?scene=face-gallery`：五位店员用同一套faceDNA，街景也接入五张不同的脸；主角v4保持。独立编辑器81小glTF共用binary，主街只接自包含NPC GLB，不预取编辑器。
- 控制能力组合见 `movement-review/capability-plan.md`；真实几何代理见 `reference-rebuild-20261120/model/movement-review/obstacle-proxies.json`；脸部数据见 `face-studio-20261120/face-contract.json`。
- 当前是有限捏脸验证原型，未宣称无限组合/运行时骨骼Socket或任意滑条变形。保留既有脚底动画混合局限；现有键盘斜向速度比直向快sqrt(2)。

该轮最终45/45测试、类型检查与构建通过；源文件与试玩包哈希一致，实机证据见 `evidence/depth-and-faces-20261120/`，验证明细见 `reference-rebuild-20261120/depth-faces-verification.json`。


## Game114 能力复用：街坊人群与真实路网（2026-11-20）

- 入口 `?scene=crowd-street`，也可双击 `start-crowd-preview.command`；原reference页面顶部已有「街坊人群」。WASD/方向键控制玩家，8名行人自动往返、ORCA互让，5名店员和3只动画猫保留。
- 顶部「路网与权重」切到 `crowd-navigation`：显示同一半径烘焙图的实际边、规划净空格与通行成本，黄色线为巡逻目标示意。权重确实影响现有A*路径，不仅绘图。
- 复用来源见 `crowd-review/history.md`；当前数据/生成器见 `crowd-prototype-20261120/`；54项测试、tsc与build通过。最终纯render调整后追加2项场景/图加载检查，原长时仿真不做无效重复。
- 独立300秒测试每人到达9～13次端点，站定玩家位移0、8障碍穿透0；NPC间/与玩家仍可能有亚毫米短暂接触，不宣称任意密度下绝对无重叠。完整对称等速条件仍可能僵持，此局限未用修改共享引擎或缩小人物半径隐藏。
- 最新实机截图在 `evidence/crowd-20261120/`，最终source/dist哈希与验证在 `crowd-review/delivery-verification.json`。旧原型、捏脸、天气、K库和其他会话工作保留，未提交推送。
