# Apollo 3D 引擎 + Game Z 程序员 · 交接 / 开工清单

> 角色（owner 2026-06-27 设立）：**Apollo「3D 盒庭」渲染线工程师 + 兼职 Game Z 程序员**。
> 本文件 = 主程（Lead）转交给你的 base 清单 + 必读文档 + 路线图。先读完「必读」再动手。

---

## 0. 你是谁 · 边界在哪（先读这条，别越界）

- 你**主管两块**：① 引擎 **3D 盒庭渲染线**（`src/renderer` 的 3D 部分 + 几个 render-only 3D 组件）；② **Game Z**（`src/games/game-z`，纯数据盒庭游戏）。
- **数据驱动宣言是最高纲领**（`docs/design/data-driven-manifesto.md`）。尺子：「最弱的 LLM 能不能也产出一模一样的数据？」能→数据接口；不能→拒绝/下沉成 capability。**整个游戏是数据；代码只属于引擎这台固定的确定性解释器。**
- **UI 铁律**：Game Z 的 HUD/菜单/面板必须用引擎 UI 库 `ui/components` 的 `LayoutNode` 纯数据（控件=闭集，写世界=action 信号入队）。**盒庭/战场本体走 render 组件 + 引擎渲染器**（也是数据，非 UI 库）。**禁止手写 React 屏 / 自由 CSS·DOM**。
- **确定性红线**：所有 3D「观感」（相机/光/阴影/材质/后处理/天空盒/3D 位姿）是**纯表现**——**绝不被 sim 逻辑(Condition)读、绝不进 lockstep hash**。新增的 render-only 组件必须登记进 `src/net/determinism.ts` 的 `NON_DETERMINISTIC`。

### 0.1 代码边界契约（主程 ⇄ 3D/Z 程序员 · 双方认这一张表）

> 起因：你是 owner 特设的 3D 引擎工程师，会碰到引擎里 `renderer`。但引擎按规矩默认只归主程，且有些文件**2D 与 3D 混居**。为免互踩，**白纸黑字划清**。三档：✅ 你独占（自由改·全绿即推） / 🔶 共享（改前在 `requests.md` 知会主程一句·只动 3D 相关行·别碰 2D） / 🔒 主程独占（你只能走 `requests.md` 提需求·不直接改）。

| 路径 | 归属 | 说明 |
|---|---|---|
| `src/renderer/three-renderer.ts` | ✅ 你 | 3D 后端解释器。改前提：无 `Camera3D` 必退回原 2D 行为（别破坏 three-lab/2D 后端）。 |
| `src/renderer/three-projection.ts` | ✅ 你 | 3D 纯函数（无 three）。新几何先在这写 + 单测。 |
| `src/renderer/three-camera3d.test.ts` | ✅ 你 | 3D 渲染测试。 |
| `src/games/game-z/**` | ✅ 你 | Game Z = **3D 渲染线实验台/提需求载体**（owner 2026-06-29 定·不再做玩法）。 |
| `src/games/game-d/**` | ✅ 你 | 整个 Game D《骰途》——双人骰子 Roguelike（owner 2026-06-29 授权 P3D 用 game-d 槽位承载·D=Dice）。设计见 `docs/design/game-d/{gdd,combat-design}.md`。骰子/buff/meta 等 sim 系统落地时若需新能力走 `requests.md` 报主程。 |
| `scripts/shoot-game.mjs` | ✅ 你 | 截图 harness（工具）。 |
| `wiki/skills/rendering.md`（3D 章节） | ✅ 你 | 补 3D 渲染知识库（现仅 2D）。 |
| `src/engine/protocol/components/render.ts` | 🔶 共享 | **2D+3D 组件混居**。你只加/改 **3D render-only 组件块**（Mesh3D/Transform3D/Camera3D/Sky3D/未来 Model3D/Light3D）；**绝不碰** Sprite/Camera/Text/Tween/Gauge 等 2D/sim 组件。 |
| `src/engine/protocol/camera-view.ts` | 🔶 共享 | `getCamera3D`/`getSky3D` 是你的；`getCameraView`/`screenToWorld`(2D 投影) 别动。 |
| `src/renderer/renderable.ts` | 🔶 共享 | 2D+3D 后端共读的 `Renderable`/`collectRenderables`。改它影响所有后端 → **改前知会主程**（如加 render 字段）。 |
| `src/assembly/component-map.ts` | 🔶 共享 | 主程维护的组件闭集登记。你**只加 3D 组件那一行**（import + ComponentDataMap），别动别人。 |
| `src/net/determinism.ts` | 🔶 共享 | 你**只往 `NON_DETERMINISTIC` 加 3D render-only 组件名**，别动哈希逻辑。 |
| `src/launcher.tsx` | 🔶 共享 | 你**只加 game-z 的 `GAMES`/`loaders` 两行**，别动壳层逻辑。 |
| `src/engine/core/**`、`src/skills/**`、`src/services/**`、`src/net/**`(除上行)、`src/assembly/**`(除上行) | 🔒 主程 | 核心 ECS/能力/服务/网络/装配。**走 `requests.md`**。 |
| `src/renderer/canvas-renderer.ts`·`ascii-renderer.ts`·`frame-svg.ts`·`index.ts` | 🔒 主程 | 2D 后端 + barrel。**走 `requests.md`**。 |
| `src/ui/**` | 🔒 主程 | UI 库。你**消费** `LayoutNode` 搭 game-z HUD，但**不改库**；缺控件 → `requests.md`。 |
| `src/launcher.tsx` 的 game-d 两行 | ✅ 你 | 同 game-z：只加 game-d 的 `GAMES`/`loaders` 注册两行。 |
| 其它游戏 `src/games/game-{a..c,e..i,x}/**` | 🔒 别人 | 不碰（game-d 已划归 P3D·见上）。 |

**三条总纲**：① 跨出「✅+🔶」范围的引擎改动 = 一律 `requests.md` 报主程评审，别直接动；② 改 🔶 共享文件**只动 3D 相关那部分**、且**改前知会**（多 session 并行，避免 rebase 互踩）；③ 任何改动**向后兼容**——不破坏 2D 后端 / three-lab / 现有游戏，**全绿才推**。

---

## 1. 必读（按顺序，别跳）

1. `docs/design/data-driven-manifesto.md` —— 宪法。**最重要**。
2. `CLAUDE.md`（仓库根）—— 项目规则：核心评审规则、引擎归属、UI 铁律、分支/门禁/署名。
3. `docs/workflow/SESSION-HANDOFF.md` —— 全局现状 + 机制 + TODO 审计。
4. `docs/workflow/requests.md` —— 需求池（你提需求/被评审都在这；搜「3D」「Mesh3D」看 3D 线的历史评审）。
5. `wiki/skills/index.md` + `wiki/skills/rendering.md` —— 渲染知识库。**注意：`rendering.md` 目前只覆盖 2D 相机（zoom/offset）。3D（轨道相机/光/阴影/后处理/导入）这条知识库章节还没写——你长这条线时顺手补它**（CLAUDE.md：开发新 capability 前必查知识库）。
6. 本文件 §2–§7。

---

## 2. 3D 盒庭渲染线 —— 现有 base（文件清单 + 机制）

> 一句话：现状 = 「per-object Mesh3D 体块混进 2D 场景」已升级为「**真 3D 盒庭场景**」——靠几个 **render-only 数据组件 + 升级版 ThreeRenderer 解释器**。全部纯表现、可复用、不进 hash。

### 2.1 数据组件（render-only · `src/engine/protocol/components/render.ts`）
| 组件 | 作用 | 关键字段 |
|---|---|---|
| `Mesh3D` | 3D 体块原语（box/plane·正反/边分色） | shape, width/height/depth, frontTint/backTint/edgeTint, flipAxis |
| `Model3D` | **导入式 glTF 模型**（圆润真模型·box 表达不了） | modelKey(资产 key), scale?, tint? |
| `Transform3D` | **真三维位姿**（地面=XZ、Y=高度、三轴欧拉） | x,y,z, rotX/Y/Z?, scale? |
| `Camera3D` | 盒庭**轨道相机**单例（在场=「盒庭模式」·运行时可拖拽改 yaw/pitch） | yaw, pitch, distance?, pivotX/Y/Z? |
| `Light3D` | **数据化光照**（可多盏·替写死的灯） | kind(directional/ambient), color, intensity, dirX/Y/Z?, castShadow? |
| `Sky3D` | **天空盒**单例（程序化渐变 + 云） | top, bottom, clouds?, cloudTint?, scroll? |
| `Post3D` | **后处理单例**（移轴景深 + 泛光·微缩感） | tiltShift?{focus,intensity}, bloom?{strength,radius,threshold} |
| `Card3D` | game-g 专属扑克牌 3D（**别动**，是 game-g 私货） | — |

- 登记三处（加新 3D 组件照做）：① 此文件加 `interface ... extends Component`；② `src/assembly/component-map.ts` 加 import + `ComponentDataMap` 一行（闭集牙·拼错组件名编译期报错）；③ 若 render-only → `src/net/determinism.ts` 的 `NON_DETERMINISTIC` 加一行。
- 读取：`src/engine/protocol/camera-view.ts` 的 `getCamera3D` / `getSky3D` / `getLights3D` / `getPost3D`（镜像 2D `getCameraView`）。
- 模型资产：`Model3D.modelKey` → `AssetManager`（`ModelAssetLoader` 取 `.glb` 字节）；模型文件在 `public/models/`（出处见 `CREDITS.md`）。

### 2.2 解释器（`src/renderer/`）
- **`three-renderer.ts`**（`ThreeRenderer implements RendererBackend`）——核心。`sync(world)` 每帧：
  - `getCamera3D` 在场 → **盒庭模式**：① `Transform3D` 实体走真三维位姿；② **无 Transform3D 的 2D 实体落到地面**（`groundPose`·见下）；③ 轨道相机按 yaw/pitch 环绕注视点；④ 柔和**动态阴影**（PCF shadow map·主光每帧 `placeShadow` 随场景重定位·~34°仰角拉长接触阴影）；⑤ 暖白主光 + 冷蓝补光 + 哑光材质。
  - 无 `Camera3D` → 退回**原俯视自适配**（`fitPerspective`·向后兼容·`game-i/three-lab` 不受影响）。
  - `syncSky` → 有 `Sky3D` 建内面大球 + 程序化云画布纹理（`buildSkyTexture`）。
  - **刻意不进 `renderer/index.ts` barrel**（静态 import three·避免 2D 消费者连带打包）；要 3D 的入口直接 `import { ThreeRenderer } from '@renderer/three-renderer.js'`（进各自 3D code-split chunk）。
- **`three-projection.ts`**——**纯函数（无 three / 无 WebGL → node 可测）**。易错几何都抽这：`renderablePose` / `transform3dPose` / `groundPose`（2D→地面）/ `orbitCamera`（球面相机位）/ `poseBounds3D`·`bounds3DCenter`·`bounds3DExtent`·`fitDistance3D` / `flipEuler` / `mesh3dDepth`。**新几何先在这写纯函数 + 单测，three-renderer 只剩薄 WebGL 胶水。**
- **`renderable.ts`**——`collectRenderables(world)` 提取可渲染项：收 `Transform` 实体（带可选 `mesh3d`/`transform3d`）+ **纯 3D 实体（只挂 `Transform3D`）**。任何后端（Canvas/Ascii/Three）读同一份 `Renderable`。

### 2.3 测试 / 工具
- `src/renderer/three-camera3d.test.ts` —— 3D 纯函数 + 收集 + 「不进 hash」红线。
- `src/games/game-z/diorama.test.ts` —— 盒庭蓝图/世界/角色走动。
- `scripts/shoot-game.mjs` —— **无头 Chromium(SwiftShader WebGL) 截图 harness**（出真 3D 预览图/回归图）。

---

## 3. Game Z —— 现状（`src/games/game-z/`）

- `diorama.ts` —— **纯数据盒庭蓝图**：草地台 + 抬升石台站 Toad（红帽白身）+ 金阶梯 + 终点宝石 + 蘑菇 + 板条箱 + 天空盒 + **可控角色**。每物 = `Transform3D`(或角色用 2D `Transform`) + `Mesh3D`；一个 `Camera3D` + 一个 `Sky3D`。`capabilities:[motionApplyCapability]`（角色走动复用现成能力·无专属 system）。
- `game-z.ts` —— 挂载：`Engine` 装载蓝图 → `ThreeRenderer` 渲染；HUD 走 `mountUI`(LayoutNode·含实时 FPS)；键盘（WASD/方向键）= 运行时输入胶水设角色 `Velocity`（`motion-apply` 每 tick 累加进 `Transform`·纯数据 sim·确定性）。
- 已注册进 `src/launcher.tsx`（`GAMES` 数组 + `loaders` 映射·id `game-z`）。
- **玩法暂缓**（owner「先放玩法·先长 3D 线」）。现状 = 可走动的盒庭底座。

---

## 4. 怎么跑 / 怎么出预览图

```bash
# 开发跑（浏览器看）
npm run dev            # 浏览器开 → 进 Game Z(🧊) → WASD/方向键 控蘑菇人

# 出真 3D 预览/回归截图（无头 WebGL）
npm run build
node scripts/shoot-game.mjs game-z /tmp/game-z.png    # 任意 game id 都行
```

---

## 5. 铁律（这条线特有 + 通用·违反不准推）

1. **3D 观感全 render-only**：相机/光/阴影/材质/后处理/天空盒/3D 位姿——绝不进 sim/hash（Three 浮点/阴影/后处理跨 GPU 非确定）。新 render-only 组件登记 `NON_DETERMINISTIC`。
2. **不每游戏手写 Three.js**：通用几何/相机/光/阴影/后处理/导入 → 做成**数据组件 + 引擎解释器**；game 专属 juice（如 game-g 的牌面纹理/抛飞编排）才留游戏层。
3. **导入走 asset key**：模型/纹理在数据里放**资产 key**，loader 在引擎（sim 持 key 保纯·同 sprite 先例）——别在蓝图里塞 URL/二进制。
4. **向后兼容**：改 ThreeRenderer 别破坏 2D 后端 / `three-lab` / 现有游戏（无 `Camera3D` 必须退回原行为）。
5. **纯函数优先**：几何先进 `three-projection` 写 node 可测纯函数，再在 renderer 接 WebGL。
6. **UI=LayoutNode**：HUD 别手写 DOM。
7. **先查手册 + 改动回填手册**：动手任何 3D 生产任务前先读 **`docs/playbooks/3d.md`**（本线接线图·查得到必用基座件·查不到去 `requests-3d.md` 提缺口·**绝不绕基座手写 three/自由 system**）；**每次 3D 改动（新 render 组件 / 新能力 / 新约定 / 新工具）在同一提交里回填 `docs/playbooks/3d.md` 对应一行**——手册与代码同步是本线活的一部分（遵 `docs/playbooks/index.md` 维护铁律）。手册答不上、requests-3d 里同类问题出现 ≥2 次 → 该册记 bug 待重写。

---

## 6. 路线图 / 待长出（预演已点名的缺口 · 按性价比）

> 背景：奇诺比奥队长（Captain Toad）风盒庭。预演结论=可实现、增量非重写。已落 v0（位姿/相机/阴影/光/材质/天空盒/可控角色）。往后：

- **✅ owner 已拍（2026-06-28）**：做「轻量 3D 渲染场景」，**模型导入打头阵**；技术栈维持**纯 Three.js**（确认零裸 WebGL·用 `three/addons` GLTFLoader）；规模上限**暂不硬限**（先做功能·预算校验以后加）。
- **✅ 模型导入(glTF) 端到端打通**：`Model3D` 组件 + ThreeRenderer `GLTFLoader.parse(ArrayBuffer)`（模板缓存·多实例 clone·材质/贴图/软影） + 资产层 `model` kind + `ModelAssetLoader`（取字节·零 three·owner 2026-06-28 授权 P3D 落资产层） + game-z 换真模型（小黄鸭·`public/models/duck.glb,box.glb`）+ 截图回归。详见 `requests.md` REQ-3D-Model导入。**坑**：glTF 节点常带内建 scale，真实尺寸≠accessor min/max → Model3D.scale 按渲染后包围盒定。
- **✅ 已落（owner 2026-06-28 点名 1+2+3）**：
  - ~~**模型导入** `Model3D`~~ ✅ 端到端打通（glTF·小黄鸭·见上）。
  - ~~**数据化光照** `Light3D`~~ ✅（kind directional/ambient·color/intensity/dir/castShadow·替写死的灯·多盏池管理·无则退回默认暖冷光）。
  - ~~**可旋转交互**~~ ✅（game-z.ts 输入胶水：拖拽→`Camera3D.yaw/pitch`·滚轮→distance·render-only 不进 hash）。
  - ~~**移轴景深 / 后处理** `Post3D`~~ ✅（EffectComposer：水平+垂直 tilt-shift + UnrealBloom·Captain Toad 微缩感·无则直渲）。
- **🔜 当前优先级 = 工单 W1（见 §9）**：高效低开销引擎 + 实例化绘制（owner 2026-06-28·主程派）。
- **⏸ 已录档·优先级靠后**：
  - **烘焙数据管线**（owner 2026-06-28「先录档·优先级往后排」）——设计结论见 `docs/design/3d-baking-pipeline.md`（轻量/稳定/高效尺子·推荐确定性 CPU AO 烘 + Blender 高质量逃生口·回驳自研 GPU 路径追踪）。待 W1 后 + 有大静态场景需求再启。
  - **动态日夜 `DayNight3D`**（render-only 周期·纯氛围；要玩法再转 sim 时钟）——咨询已出·待 owner 拍 A/B 后启。
- **P-next 候选**（每条：数据组件 + 引擎解释 + 纯函数测 + 截图回归）：
  - **Mesh3D 逐面材质**（解决下面 §7 的 box 着色尴尬·亦与 W1-A 实例化逐面色坑相关）。
  - **IBL 环境图 `Env3D` / gltf-transform 资产压缩**（轻量管线性价比最高的两件·见 `wiki/skills/rendering.md`）。
  - **更多模型 / 角色模型**（替小黄鸭 hero·skinned/动画是更大一步）。
  - **玩法**（最后·owner 解冻后）。

---

## 7. 已知坑 / 技术债（接手要知道）

- **Mesh3D box 着色尴尬**：BoxGeometry 顶面(+Y) 用的是 `edgeTint`，朝镜头面(+Z)用 `frontTint`。盒庭里「顶=edgeTint、侧=frontTint」是将就——**逐面材质**是正解（列入 §6）。
- **`PCFSoftShadowMap` 在本 three(0.184) 已弃用** → 现用 `PCFShadowMap`。想要更软的接触阴影可评估 VSM。
- **阴影靠 `placeShadow` 每帧按包围盒摆光 + 调正交视锥**：场景特别大/特别扁时可能糊或漏，留意。
- **天空盒云是程序化画布**（无图片资产）——要真云照片贴图等「模型/纹理导入」线落地。
- **相机自适配距离**靠包围盒（`fitDistance3D`），但 `poseBounds3D` 取的是物体**中心点**（half=0.5），不含物体真实尺寸→大物体可能取景偏近；盒庭里建议像 game-z 那样**显式给 `Camera3D.distance`**。
- **截图 harness**：playwright 装在**全局** node_modules（非本地），`shoot-game.mjs` 经 `createRequire` 全局根加载；浏览器在 `/opt/pw-browsers`（SwiftShader 软件 GL）。

---

## 8. 工作规范

- 分支 **`claude/mainbranch`**，直推不开 PR；每次提交前 `fetch → rebase → push`（多 session 并行）。
- **tsc + vitest + build 全绿才推**；rebase 带进新提交后**必须重跑全套再推**（陈旧基线测的绿不算绿）。
- 提交署名 `Claude <noreply@anthropic.com>`，提交信息以 session URL 结尾；不在产物里写模型标识。
- 你的需求/被评审记 `docs/workflow/requests.md`；开工清单（本文件）随进度更新。
- **跨出 3D 渲染线的引擎改动先报主程评审**（§0 边界）。

---

## 9. 工单 / 需求池 → `../requests-3d.md`

> **3D 渲染线的需求 + 工单（含 W1「高效低开销 + 实例化绘制」完整规格）= 单一真相在 [`../requests-3d.md`](../requests-3d.md)**（owner 2026-06-28 立独立池·避免与通用 UI/游戏需求混淆）。
> 本交接文档管「你是谁 / 边界 / base 清单 / 怎么跑」；**具体派单看 requests-3d.md**。当前主线：**REQ-3D-W1**（✅ W1-A 实例化 + W1-B 零浪费 + W1-D 快赢 已落；⬜ W1-C 静态跳渲 + W1-E 健壮 下一增量）。
