# 3D 渲染线 · 需求 / 工单池（owner 2026-06-28 立独立池）

> **这是什么**：Apollo「3D 盒庭」渲染线 + Game Z 的**需求 / 工单单一真相**（从主 `requests.md` 分出·避免 3D 条目淹没在通用 UI/游戏需求里）。
> **归属**：3D 渲染线由 **P3D** 主管（代码边界契约见 `docs/workflow/finish/P3D-game-z-handoff.md §0.1`）。本池由 owner/主程 派单、P3D 执行、Lead 评审标状态。
> **新 3D 需求都进这里**（不进 `requests.md`）；通用 UI 库 / 其它游戏需求仍进 `requests.md`。

---

## REQ-3D-RENDER-EFFICIENCY · 渲染效率提高（大规模同屏实体·批绘/实例化）· [2026-07-24] · **owner 拍板「先把渲染效率提高」** → P3D · status: **🚧 增量①✅（2D canvas 去每实体 save/restore）+ 3D-半✅（voxelTex 体素实例化·game102 大立方）done（P3D 2026-07-26·已推）；增量②WebGL2 批渲仅当仍不达标/上千实体再上** · 优先级: **P1（owner 明示先做·game-103 百敌卡顿实证）** · 类型: 渲染性能（2D 批绘 + 3D 实例化·render-only）
> **★ P3D 3D-半 回执（2026-07-26·voxelTex 体素实例化·owner「大立方上实例化才能又大又细」）**：诊断=game102 中央大立方每体素 = `Mesh3D{voxelTex}`（提速块贴图）→ three-renderer 走**单 mesh**（line 332 `ensureVoxelMesh3D`）→ 488 体素壳 = **488 draw call**·卡且做不大。修法=把不透明 voxelTex 体素**归批实例化**（按 `voxelMode` 签名分组→ 同款体素共享一个 `InstancedMesh`·六面贴图材质数组·per-instance 只上 instanceMatrix）：抽 `buildVoxelGeoMats`（单 mesh 与批共用几何+材质）·`InstancedBatches.ensure` 支持 voxelTex 批（材质数组）·three-renderer voxelTex 分支不透明→ instGroups(`voxelMode` key)。**488 体素 → 每款颜色/地形层 1 批 = ~4-8 draw call**（真浏览器截图自证 game102 4 色贴图立方渲染正确·纹理零丢失·旋转/Pivot3D 正常）。测试 `batches.test` 3 例（平色盒批 + 300 voxelTex→1 批 + 异签名分批）。透明 voxelTex 仍单 mesh（排序）。tsc0/vitest3639/build0。**又大又细达成**：立方可加体素数/细分而 draw call 只随「不同款式数」增长。
> **★ P3D 增量① 回执（2026-07-26·canvas2D 热路径·不上 WebGL2）**：诊断=`canvas-renderer` 实体循环对**每个**实体 `save/translate/rotate/scale/restore` + 独立 drawImage → 百级敌=百次状态栈压弹 + 百次冗余变换调用。修法=把 **DPR×相机×实体** 三层变换在 JS 合成一个 6 元仿射（新纯模块 `canvas-transform.ts`·`rot=0` 跳 trig 热路径），每实体一次 `ctx.setTransform` → **免每实体 save/restore**；相机也从 `ctx.save/translate/scale` 改成 base 仿射（瓦片同基变换按世界坐标画）；`globalAlpha/fillStyle` 冗余状态消除（无 save/restore 复位后仅变化才写）。DPR/相机零丢失（都折进矩阵）·headless dpr=1 无相机逐位等价旧行为。**保 FaceDir**（`resolveRotation2D` 喂 entityMatrix）。测试 `canvas-transform.test` 5 例（base/实体矩阵/三层合成等价）。**跨游戏真浏览器目击零回归**：game-103（tilemap+相机+精灵+shape+HUD 文本）、game-q NEON SIEGE（标题/HUD/折线路径/六边精灵/动作栏）。tsc0/vitest3606/build0。**增量②（WebGL2 批渲/离屏 atlas）**：只在 canvas2D 优化后实测仍到不了 60fps 或需上千实体时再上（大改·单开）——现按「数百」目标先交增量①。rigorous 前后 FPS bench 待真浏览器 100+ 敌场景实测补。
> **owner 指令（2026-07-24）**：**先把渲染的效率提高**。承 `REQ-SURVIVOR群体`（引擎池）② 半场——该条 ①群体分离仍归主程引擎（steering），**②渲染半场移入本单归 P3D 主理**。
> **缺口（实证）**：① 2D `CanvasRenderer` 逐实体 `ctx.drawImage`（`src/renderer/canvas-renderer.ts:153`）**无批处理**——game-103 幸存者百级同屏敌=百 draw call → overdraw 卡顿（owner 试玩 v1 BUG-05）；② 高效实例化绘制现**只在 3D `three-renderer`**，2D / 大规模实体场景无高效路径。
> **要什么（P3D 主理·框方向·技术路 P3D 定）**：给「大量同纹理实体」一条高效渲染路——**2D**=同 atlas 合批（减 draw call + 减状态切换）或大规模场景走 WebGL2 批渲/实例化；**3D**=复核 `three-renderer` 现有实例化绘制覆盖度（若某游戏走 3D 盒庭则直接用）。owner 指名参考「**Instanced Draw**」思路。**注（Lead）**：2D canvas 无 GPU instancing 语义——真解=合批 drawImage / 离屏 atlas / 转 WebGL 批渲，框定准确、别照搬 3D instancing 名词当 2D 用。
> **性能目标**：数百同屏实体流畅（60fps 目标·退档 30）；配对象池 + 同屏 cap（`spawn-director` 已界上限=缓解非根治）。验收=真浏览器目击百敌流畅 + `ApolloBench` 帧时对比（前后 delta）。
> **边界**：`src/renderer/**`（`canvas-renderer.ts`/`three-renderer.ts` + `three-projection.ts`）= **P3D 独占域**；Lead 评审标状态。**render-only 旁路·不进 sim/hash**（批绘不改玩法确定性/回放/balance-sim）。撞墙实证=`docs/design/game-103/requests.md BUG-05` + `REQ-SURVIVOR群体`②。

## REQ-3D-G102-DEBRIS · game102 消除→真3D 物理碎片 + 平台落地 · [2026-07-24] · GD-game102 提 → **P3D（Lead 裁架构）** · status: open · 优先级: P2（签名视觉·非玩法阻塞） · 类型: 3D 表现（物理碎片 + 舞台）
> **spec**：`docs/design/game102/fx-3d-debris.md`（owner 2026-07-24 拍板 B·真3D + 平台真物理·雕刻碎片落地感）。
> **要什么**：每消一像素 → 炸成同色小方块（`Mesh3D` box + `Material3D` toon/flat+surface 雕刻质感）+ `RigidBody3D`(cannon-es·mass/restitution) + `Impulse3D` 迸溅 → **真物理落到下方平台**（`Mesh3D`+静态 `RigidBody3D`/heightfield）弹跳/堆叠 → 落定超时 despawn。打击 = `Camera3D.shake`。**全 render-only**（不进 sim/hash·不影响玩法确定性/验收/balance-sim）。先例=game-d `throw3d.ts` / game-c `chip3d.ts`（cannon-es 已用）。
> **⚖ 请 Lead + P3D 裁的关键架构（spec §2）**：3D 碎片与当前 2D 棋盘怎么合成——**A** 2D 棋盘 + 3D 叠层（正交相机对齐像素格·screenToWorld 定位·改动小）；**B** 全 3D 盒庭棋盘（像素=薄 Mesh3D 瓦片·消除原地炸碎片落平台·物理最自洽+签名差异化·但棋盘渲染 2D→3D 迁移大）。**GD 倾向 B**（真物理落台需同一 3D 空间才自洽·且 3D 做卖点），最终 Lead/P3D 裁（涉棋盘渲染归属 + 性能）。
> **性能预算（P3D 主理·spec §3）**：并发刚体上限 ≤120·落定/超时 despawn（sleep 后 1.5-2.5s 回收）·对象池·连锁/激光碎片洪峰需节流（超上限退轻量 Vfx3D 替真刚体）·画质档可降 dpr/阴影/AO。
> **边界**：3D 渲染线 = P3D 独占·GD 只出 spec·PE 不碰 3D 线。验收走 `visual-scorecard.md`（真浏览器目击碎片落台弹跳堆叠）。
> **依赖/顺序**：非玩法阻塞（sim 层碎片=纯表现）——可待 PE 的 S3/S4 玩法核（2D 判定）落地后并行；若裁 B，需与 PE 协调棋盘渲染迁移排期。

## REQ-3D-RB-ANGFACTOR · RigidBody3D 角约束（angularFactor·锁转轴防圆盘立边）· [2026-07-23] · PE-C 提（game-c 筹码 bug）→ P3D · status: **✅ done（P3D 2026-07-26·已推·见回执）** · 优先级: P2（owner 报的可见 bug·game-c 已上游戏侧缓解·根治缺此能力）· 类型: 3D 线能力缺口（物理角约束）
> **★ P3D 落地回执（2026-07-26·照建议·additive·不改组件清单）**：`RigidBody3D` 加 `angularFactor?: readonly [number,number,number]`（缺省 `[1,1,1]`=现行自由翻）；`physics.ts spawn()` 里 `if (rb.angularFactor) body.angularFactor.set(...)`（cannon orientation 积分按 `角速度×angularFactor` → 锁轴姿态冻结·含被撞的碰撞扭矩）。测试钉死：薄圆盘带 `avx:8` 翻滚初速 + `angularFactor:[0,1,0]` → 落定后 quat 的 x/z 分量恒 ≈0、上向量 y>0.999（**永远平躺·不立边**·含初速也压不翻）。回填 `playbooks/3d.md` 物理行。**交 PE-C**：`chip3d.ts` throwBet+setStack 填 `angularFactor:[0,1,0]` 即 100% 根治立边（含被撞/堆边）。tsc0/vitest+2/build0。
> **触发（owner 2026-07-23 报 bug）**：game-c 3D 物理筹码（薄圆柱 r0.17×h0.06·cannon-es）落桌后**有时立在桌面上**（停在圆柱侧面=硬币立起）。根因：抛注给了三轴随机角速度（avx/avy/avz），翻着落地就可能停在侧面这个半稳态。
> **game-c 侧已缓解（已推·不阻塞）**：`chip3d.ts` 抛注改**只绕竖直 Y 轴平旋**（avx=avz=0·飞碟式平飞平落）+ 降 restitution 0.12 → 绝大多数不再立边。**但落地被别的筹码撞、或落在筹码堆边沿仍可能被顶立**——数据侧无法根治（Transform3D.quat 每帧被物理写回·游戏层改不动落定姿态）。
> **缺口**：`RigidBody3D` 无任何**角约束/锁转轴**字段（现只有初速 vx.. + 初角速 avx..）；cannon-es 本体支持 `body.angularFactor`（各轴角响应 0..1·0=锁该轴不转），但组件没暴露 → 游戏层锁不了「圆盘只许绕竖轴转、永不翻倒」。
> **建议（P3D 裁·opt-in·向后兼容）**：给 `RigidBody3D` 加 `angularFactor?: readonly [number, number, number]`（缺省 `[1,1,1]`=现行不变）；`physics.ts spawn()` 里 `if (rb.angularFactor) body.angularFactor.set(ax,ay,az)`（并 `body.angularFactor` 初值同步·防睡醒重置）。落地后 game-c 筹码填 `[0,1,0]`=**只准平旋·永不立边**（100% 根治·含被撞）。
> **复用面**：任何硬币/筹码/冰球/圆盘（保持平面）、或「只许绕某轴转」的门/轮/摆（等价 hinge 但免建约束体）、`[0,0,0]`=完全锁转（稳态骰子停面/招牌不晃）。标准物理引擎（Rapier/PhysX）都有 lockRotation·对齐 cannon API。
> **PE-C 侧就绪**：API 落地后 `chip3d.ts` throwBet + setStack 各加一字段即根治·测试同步钉 `[0,1,0]`。**非阻塞**：已上缓解版·观感基本无立边。

## REQ-3D-DECAL-TEX · 可换真图的「平贴 + alpha + 自定义贴图」贴花（Decal3D 无贴图槽）· [2026-07-22] · PE-C 提（game-c 下注线 REQ-C-113）→ P3D · status: **✅ done（P3D 2026-07-22·取方案①·已推·见回执）** · 优先级: P3 · 类型: 3D 线能力缺口（贴花贴图）
> **缺口**：想在呢面上平贴一张**可被工坊生成图替换**的下注线/发牌区贴花（台账槽 `game-c/table/betline`），闭集里没有干净件——`Decal3D`=**程序化**（kind blob/ring/disc·无贴图键·不碰 assets）→ 换不了真图；`Material3D.map` 平贴 mesh 有 map 但 **PBR 路无 alpha**（透明底 PNG 的透明区渲成不透明黑）；`Billboard3D.tex` 有贴图 + alpha 但**永远朝相机**（陡俯视下立起 ~26°·不平贴）。三者都缺「平 + alpha + 自定义贴图」这一交集。
> **建议（P3D 裁·二选一）**：① 给 `Decal3D` 加 `tex?` 贴图键（走 `pbrMapTexture`/assets 解析·decal 本就平 + alpha·最贴合）；或 ② 给 `Material3D` map 路加 `transparent`/`alphaMap`（平贴 mesh 就能透）。落地后 game-c betline 即从程序化金环换成台账真图（`build3d.ts` 已留位·现程序化 `Decal3D{kind:'ring'}` 占位）。**非阻塞**：betline 是次要贴花·现金环占位可接受。
> **game-c 现状**：chips（`Material3D.map` 顶盖）、fx（`Billboard3D.tex` 瞬时）已接真图；仅 betline 卡此缺口。
>
> **★ P3D 落地回执（2026-07-22·取方案① Decal3D.tex·PE-C 的三向缺口分析与我评判一致）**：`Decal3D` 加 `tex?`(texture 资产 id·alpha 走贴图自带通道·异步就绪前暂隐不显白块) + `width?/height?`(非等比长条·下注线是细长条) + `rotation?`(地面内 Y 朝向·对准座位)。DecalSystem 复用 Billboard 的 `ResolveTex`/`pbrMapTexture` 取图；有 tex 用真图、无 tex 走原程序化遮罩（向后兼容·additive·Decal3D 已在册不改组件清单）。测试 6 例（tex 就绪/未就绪暂隐/非等比/朝向）·回填 `playbooks/3d.md` 贴花行。**demo**：game-z Platform Three `p3-decal-rune`+`p3-decal-line`。**交 PE-C**：把 betline 从 `Decal3D{kind:'ring'}` 占位换成 `Decal3D{tex:<台账 betline key>,width,height,rotation}`（真图带 alpha 由 PA/PE-C 出）·API 已就绪。tsc0/vitest3004/build0 全绿·截图自证。

## REQ-3D-MAT-ALPHA · Material3D.map 透明贴图路（transparent/alphaTest opt-in）· [2026-07-22] · PE-C 提（game-c 顶视牌桌）→ P3D · status: **✅ done（P3D 2026-07-26·已推·见回执）** · 优先级: **P2（现在阻塞 game-c 顶视重构主桌面视觉）** · 类型: 3D 线能力缺口（材质 alpha）
> **★ P3D 落地回执（2026-07-26·照建议①·additive·不碰 🔒 assets 预设文件）**：`Material3D` 加 `alphaTest?`(cutout 阈值·硬边·无排序坑·首选) + `transparent?`(软混合)；在 `material.ts buildPbrMesh3D` 建完材质后按 `mat.alphaTest/transparent` 直接设 `material.alphaTest/transparent`（PBR MeshStandard 路 + 平涂/卡通路都吃·非只 transmission 玻璃路）；`pbrSig` 纳入两字段（改→重建）。缺省不设=现行不透明行为零变（向后兼容）。为何不走 PbrOverrides/resolvePbr：那在 `src/assets`(🔒 主程/PA)——改在 `material.ts`(我域)后置一行即可，零跨域。测试 4 例（缺省不透明/alphaTest 生效/transparent 生效/pbrSig 纳入）。回填 `playbooks/3d.md` 透明贴图行。**交 PE-C**：`build3d.ts` table-surface 的 `Material3D` 加 `alphaTest:0.5`（或 transparent），顶视牌桌透明底图即不再渲黑。tsc0/vitest+4/build0。
> **触发**：owner 上传了一张**带透明色**的顶视牌桌图，写回 `game-c/table/surface`（`build3d.ts` table-surface plane·`Material3D.map`）后，**透明区渲成黑**——正是本池早已顺记、当时判「眼下不催」的缺口（见下条 REQ-3D-资产就绪自动重渲「连带小缺口」+ REQ-3D-DECAL-TEX 建议②）。owner 大重构把牌桌改成「一张顶视整幅贴图盖住物理桌」后，这张 `Material3D.map` 平面**就是**当时说的「透明贴花面」——条件已满足，现在**是主桌面视觉、阻塞**。
> **缺口**：`material.ts buildPbrMaterial` 的 MeshStandard 路恒 `transparent:false`（只玻璃 transmission 路设 true）·`Material3D` 无 `transparent`/`alphaTest` 字段 → 贴图 alpha 通道被忽略·透明像素按 RGB(黑)渲出。台账 `spec.transparent` 声明**只 2D UI(img)吃·3D 材质不吃**（owner 敏锐指出「含/不含透明色要写清楚」——声明是有，3D 没接）。
> **建议（P3D 裁·opt-in·向后兼容）**：给 `Material3D` 加 `alphaTest?`(cutout·硬边·透明像素 discard·无排序问题·最适合桌面透明角/贴花) + 可选 `transparent?`(软混合·配 opacity)；`buildPbrMaterial` 据此设 `m.alphaTest`/`m.transparent`。缺省不设=现行不透明行为零变。**顺带**：可让台账 `spec.transparent:true` 在 3D 消费端自动置 `transparent`（对齐 owner 直觉·2D/3D 声明一致）。
> **PE-C 侧就绪**：`build3d.ts` table-surface 已在册；API 落地后我加 `alphaTest`（或 `transparent`）一字段即透。**workaround（不等 P3D）**：owner 改出**不透明**顶视桌图（四周深色/环境烤进图·填满 16:9），`spec.transparent:false` 即正常显（现台账已 false）。

## REQ-3D-资产就绪自动重渲 · 静态场景 × 异步贴图迟到 = 脏帧跳渲吞掉换图帧 · [2026-07-17] · PE-B 提 → P3D 评审 · status: open · 类型: 渲染健壮（W1-C 脏帧跳渲的盲区）

> **现象（game-b S3 实证）**：全静态 3D 场景（无动画/无相机动）+ Material3D.map 贴图异步 fetch 迟到——`ensurePbrMesh` 在贴图就绪后按 mode 正确重建了 mesh，但 `renderSig`（位姿/相机/灯/后处理…）不含资产就绪态 → 跳渲判「画面没变」→ 新贴图永不上屏（canvas 停在旧帧）。动态场景（game-z 恒动）撞不到此坑，纯静态陈列场景必撞。
> **game-b 侧 workaround 在案**：宿主胶水 `assets.loadAll()` 收尾后调公开 `renderer.invalidate()`（`src/games/game-b/{assets,game-b}.ts`·可参考）。
> **提议（P3D 裁决取一）**：① renderSig 折入 AssetManager 就绪版本号（资产每 ready 一枚 version++·最通用）；② attachRenderer 侧监听 loadAll 完成自动 invalidate；③ 维持宿主手动 invalidate 但回填 `playbooks/3d.md` 一行「静态场景+异步贴图必调」（最省·先堵手册）。
> **连带小缺口（同域顺记）**：Material3D.map 无 alpha 路（transparent/alphaTest 均不设）→ 透明底 PNG 透明像素渲黑。game-b 占位牌面已按「程序化出路」授权期合成不透明贴图绕开（`scripts/game-b-compose-tiles.mjs`）；若后续真有「透明贴花面」需求再议 `alphaTest?` opt-in，眼下不催。

## REQ-3D-程序化动画方法集 · Anim3D 扩为底层可组合运动原语（osc/noise/ease）· [2026-07-06] · owner → P3D · status: **✅ done（P3D 2026-07-06·已推·见回执）** · 类型: 渲染能力补全（程序化动画底座）

> **owner 2026-07-06**：「游戏若有程序化动画需求，开发一套底层的程序化动画方法」。
> **P3D 评判（CORE RULE）**：`Anim3D`(spin/bob + 同 field 叠加) 是好底子 → **扩成完整闭集方法集**，只补真缺口：
> - **真缺口·已加**：`osc{wave:sine|triangle|saw|square}`（bob 泛化·机械/摆动/闪烁·波形与 sine 同相）· `noise{amp,freq,seed}`（确定性 1D 平滑噪声·有机漂移·正弦重组不出来）· **`ease{from,to,dur,curve:linear|cubicOut|outBack,delay}`**（**一次性 once**·入场弹出/强调·当前最大缺口——之前全无一次性动画·绝对值不绕初值·播完保持终值）。
> - **回驳（现有叠加可重组·不加）**：orbit=x/z 双 osc 相位差 π/2；pulse 变速自转=spin+bob 叠加（骰盅 P18 已证）。
> - **保留**：spin/bob（向后兼容·bob=osc sine 简写）。**loop+once 共存**、**同 field 叠加**、帧率无关（壁钟绝对秒·不累积漂移）、render-only 不进 hash。
> **实现**：`render.ts`(Anim3DChannel 扩 osc/noise/ease + Wave/Curve 枚举)·`three-projection.ts`(anim3dField 全 kind + animWave/noise1 纯函数)·`anim3d.ts`(ease 播完不计活跃→渲染器可 idle)。**测试** +5（波形/噪声确定性/ease 进度·delay·hold·outBack 过冲/系统 idle）。**demo** game-z prim-* 入场弹出(错峰 ease)+ 三角波弹跳 + rune-slab noise 漂移。回填 `playbooks/3d.md`。tsc+vitest+build 全绿。
> **后续可长**（按需·不先造）：wave 更多（如 expo）、ease 更多曲线、`shake`（衰减振荡·冲击反馈）——有真需求再加。

## REQ-3D-货架接入 · game-z/game-d 3D 素材改从公用货架 vendor（停直引全局散落）· [2026-07-04] · PA → P3D · status: **✅ game-z 贴图收口（2026-07-04·P3D·见回执）；models 共享暂留 + gen-shelf 耦合转回 PA** · 类型: vendoring 收口（REQ-PA-3D公用货架 ④b）

> **★ P3D 回执（2026-07-04·全绿·观感不变）**：
> - **✅ game-z 自产贴图（plank/rune）停全局散落**：`public/textures/{plank_albedo,plank_normal,rune_emissive}.png` → `git mv` 进 `public/games/game-z/art/textures/`；`GAME_Z_INDEX` 路径改本地 `/games/game-z/art/textures/*`；删空 `public/textures/`；`gen-textures.mjs` 输出改本地目录。build 验证贴图进 `dist/games/game-z/art/textures/`、渲染观感不变、门禁全绿（2298 测）。**game-z 贴图无全局散落直引。**
> - **⚠️ 转回 PA·gen-shelf-3d 耦合**：`scripts/gen-shelf-3d.mjs`（PA 域）从 `public/textures/` 取 plank/rune 拷进货架——**源已移走**。但 plank/rune 是 **game-z 专属程序化art**（非通用货架素材），本就不该进公用货架 → 建议 PA **删 gen-shelf-3d 的 plank/rune 拷入段**（它们归 game-z 本地）。我为完成本单动了 `gen-textures.mjs`(PA 列表内工具·仅改输出路径 1 行)——知会 PA。
> - **models（duck/box/fox）暂留全局**：`public/models/*.glb` 被 **game-z/game-d/game-i 共享直引**（`game-i` 🔒 非我域·移动会破它）→ 单游戏 vendoring 需跨游戏协调，非本单「贴图散落」scope。**建议**：要么各游戏 vendor 各自本地副本（含 game-i·需 owner/PA 统筹），要么公认 `public/models` 为共享模型库（非「散落」）。留待 owner/PA 定。
> - **game-d**：grep 确认 game-d **无 `/textures/` 直引**（只 `/models/duck.glb` 共享模型）→ 贴图散落问题 game-d 不存在；其 models 同上共享项。**本单 game-d 侧无贴图待办。**

> **背景**：PA 已把公用 3D 基础素材（材质 `mat/*`、基础 mesh `mesh/plane|cube|sphere`、程序化贴图 `tex/plank_*`、天空盒 `env/sky-gradient`）备进共享货架 `assets/index.json`，并让 `scripts/vendor-asset.mjs` 支持 3D（数据型材质 + glb/贴图文件）。本地目录标准见 `docs/playbooks/assets.md ⑥`。
> **P3D 侧待办（🔒 game-z/game-d 域·PA 不越界）**：现 `game-z` diorama 等**直引全局散落目录 `public/textures/`**（plank/rune 贴图）——改为从货架 vendor 进 `public/games/game-z/art/{textures,materials,models,env}/` 再引本地索引（例：`node scripts/vendor-asset.mjs tex/plank_albedo game-z`）。切换后可删 `public/textures/` 直引 + 让 `gen-textures.mjs` 退役或改产进货架。**验收**：game-z 只引本地 `art/index.json`、无全局散落直引；渲染观感不变；门禁全绿。
> **不阻塞**：货架+工具已就绪，P3D 按 3D 线核心工作节奏排入即可。

## REQ-3D-卡通描边（toon outline）·暂缓 + Godot 调研文 · [2026-06-30] · owner → P3D · status: **⏸ outline 暂缓（深度边缘不可靠·待法线缓冲版）；Godot 对比文 ✅ 已出** · 类型: 渲染能力（NPR）+ 调研

> **owner 要「描边的卡通着色」**。P3D 试了**全屏深度边缘描边**（Post3D.outline·读深度纹理做二阶差分 Laplacian）：
> - **暂缓原因（诚实记录）**：深度-only 边缘在**透视斜面**上二阶差分非零（斜地面被误判成边）→ 整片压暗；调阈值压不住，且 SwiftShader 无头环境深度纹理采样行为不稳（疑 NaN→边=1 全黑）。**已全部回退**（无残留·树净）。
> - **正确做法（待做）**：要稳的卡通描边需**法线缓冲 + 深度**双判（法线折缝 + 深度轮廓），或逐物件反向壳（inverted hull·骨骼体麻烦）。需专门一轮 + 真 GPU 验证（非 SwiftShader）。**故暂缓·不硬推黑屏货。**
> - **toon ramp（MeshToonMaterial）** 单独可做但**与刚夸的 PBR/IBL 冲突**（toon 去掉金属反射）——需设计「全局 toon vs 保 PBR + 仅描边」取舍，一并待定。
>
> **✅ Godot 对比调研文（owner 授权调研·开 agent 调研）**：`docs/design/godot-vs-apollo.md`。结论：Godot 是好**设计参考**但代码/运行时与我们两条铁律（数据驱动 + lockstep）不同源 → 借**概念**非搬码。**最该借鉴**：① AnimationTree/状态机/BlendSpace 做成数据（接刚落地的骨骼动画·下一步）；② prefab 蓝图子树（接关卡加载线）；③ 资产 import 管线样板（接真实贴图）。**别借**：Godot 联机（权威+复制·非 lockstep）、非确定性物理、GDScript 运行时。owner 裁决。

---

## REQ-3D-骨骼动画（glTF skeletal animation） · [2026-06-30] · owner（渲染缺口评估→选做） → P3D · status: **✅ done（P3D 2026-06-30·已推）** · 类型: 渲染能力补全（最大缺口·角色动起来）

> **背景**：P3D 给 owner 做了「引擎还缺啥」评估，**骨骼动画 = 最大缺口**（导入 glTF 但不播自带动画·追逐游戏角色全程滑行）。owner 选做。
>
> **✅ 落地（全 render-only·P3D 渲染线域）**：
> - **数据** `AnimState3D`（`render.ts`·render-only·入 NON_DETERMINISTIC）：`clip`(动画名) + `speed` + `loop`。弱 LLM 只填 clip 名·填不了骨骼矩阵。登记 component-map。
> - **`ModelPool` 升级**：模板缓存 `{scene, clips}`（解析 glTF 同时存 `gltf.animations`）；实例化改 **`SkeletonUtils.clone`**（正确克隆骨架/蒙皮·每实例独立动画·共享几何）；挂 AnimState3D 的实体建 `AnimationMixer` 播指定 clip（`applyAnim` 换 clip 名=淡入淡出切动作·idle↔run 平滑）；`update(now)` 每帧推进混合器（壁钟 delta）。
> - **接入** `three-renderer`：model 分支读 AnimState3D → applyAnim；collect 后 `models.update` 推进；活跃混合器数折进 renderSig（持续重渲）+ 刷阴影（蒙皮影跟动）。
> - **资产**：新增 `fox.glb`（Khronos Fox·**CC0**·带 Survey/Walk/Run·登记 CREDITS）。**hero 换成奔跑的狐狸**（播 'Run'·`autoRun` 胶水设朝向跟跑动方向）——替原静态鸭，正配「跑酷主角」。
> - 测试 `models.test`(2·AnimState3D 不进 hash + ModelPool 无模型安全 no-op)；`diorama.test` 改测 hero=fox。tsc+vitest(1978)+build 全绿。截图：狐狸奔跑姿（骨骼蒙皮·非 T-pose）+ 连帧腿姿变（混合器在推进）。
> - **⬜ 待续**：① **动画状态机/混合树**（idle/walk/run 按速度 blend·Godot AnimationTree 思路·做成数据 = 下一步可借鉴点）；② 追兵也换骨骼模型；③ 根运动(root motion)开关（现假设原地循环）。

---

## REQ-3D-程序化 normal/roughness 贴图 · [2026-06-30] · owner（选「程序化生成」） → P3D（TA Phase 5） · status: **✅ done（P3D 2026-06-30·已推）** · 类型: 渲染能力补全（PBR 表面细节·零美术文件）

> **owner 选型**：normal/roughness 走**程序化生成**（非美术贴图资产）——同「天空盒按 Sky3D 数据程序化生成纹理」先例·零美术管线依赖·弱 LLM 能填参数。
>
> **✅ 落地（全 render-only·P3D 渲染线域）**：
> - **数据** `Material3D.surface?: SurfaceDetail`（`render.ts`·render-only·不进 hash）：闭集 `pattern`('bumps'|'noise'|'scratches') + `tiles`/`normal`/`rough`/`scale` 标量。
> - **生成器** `renderer/three/surface-tex.ts`：`buildSurfaceMaps` 据参数**确定性**生成 normal + roughness `DataTexture`（128²·value-noise/fbm/sin·无随机 → 同参数同图·稳定不闪）。法线由高度场环绕中央差分求（平铺无缝）；roughness 凸光凹哑×材质 base。线性数据贴图（非 sRGB）。
> - **接入** `material.ts`：`buildPbrMaterial(def, surface?)` 挂 `normalMap`/`normalScale`(=surface.normal·运行时可调不重生)/`roughnessMap`；`pbrSig` 纳入 surface；`disposeMesh` 释放生成贴图。
> - **demo**：陈列台给岩石(noise 凹凸)/土/木(scratches 木纹)/钢(拉丝)/金(bumps 锤打) 挂 surface → 截图明显浮雕，无 surface 的(哑光/塑料/铁/铜/玻璃)仍光滑。
> - 测试 `surface-tex.test`(4·尺寸/wrap/repeat·法线 Z 朝外·确定性逐字节·bumps 有浮雕)。tsc+vitest(1972)+build 全绿。
> - **⬜ 待续**：法线强度 `normal` 现走 normalScale（运行时调）；要更多图案（grid/voronoi 砖纹）或真实贴图按 key 加载（标准 PBR 工作流）按需再加。

---

## REQ-3D-真物理模拟（色子/表现物理·cannon-es） · [2026-06-30] · owner → P3D · status: **✅ done（P3D 2026-06-30·cannon-es·已推）** · 类型: render-only 表现能力（刚体物理）

> **owner 拍板（2026-06-30·提前到现在做·「马上要用」）**：做**色子真物理模拟**——**为表现非同步**（滚色子读朝上/画面用途·不需两边一致·要一致就单机）。**「用现成物理库·别自己开发·要简化点的」** → 选 **`cannon-es`**（纯 JS/TS·无 WASM 异步·three.js 圈轻量刚体标配·正好「简化」；Rapier 更强但 WASM 重·表现色子用不上）。
>
> **✅ 落地（全 render-only·P3D 渲染线域·cannon-es 仅在 renderer/three 下 import → 进 3D chunk·2D 游戏不连带）**：
> - **数据** `RigidBody3D`（`render.ts`·**render-only·入 NON_DETERMINISTIC·不进 sim/hash**）：shape/mass/restitution/friction/初速/初角速。体形尺寸取同实体 Mesh3D。+ `Transform3D.quat`（可选四元数·物理翻滚无万向锁）。登记 component-map。
> - **子系统** `renderer/three/physics.ts` `PhysicsSystem`：cannon `World`(重力-42)+静态地面 Plane·每帧步进 → 把刚体位置+四元数写回 `Transform3D`（render-only）→ 渲染器照常画（`applyPose` quat 路径）。睡眠优化（停稳就睡）。活跃刚体数折进 renderSig 持续重渲。
> - **接入** `three-renderer`：sync 顶部步进（collect 前）；`rollDice()`（按钮调·置位 → 下帧重掷=抬高+随机翻滚·render-only 随机自由）；destroy 释放。
> - **demo**：game-z 三颗塑料色子（红/蓝/绿·中心区）掉落翻滚停稳；调试面板「🎲 掷骰子（真物理）」按钮重掷。截图：色子从空中落定（随机朝向）→ 点按钮重掷→再翻滚落定。
> - 测试 `physics.test`(3·重力下落+落地不穿地+写 quat·无刚体返回 0·RigidBody3D/Transform3D 不进 hash)。tsc+vitest(1975)+build 全绿。**新依赖 `cannon-es@0.20.0`**（render-only·进 3D chunk）。
> - **✅ 追加（2026-07-03·owner「掷骰物理落地→给我确定点数」）**：读朝上面 = 确定点数落地。新 `three/dice.ts` `upFaceIndex(quat)`（纯函数·据朝向四元数算哪面朝上·面序 [+X,-X,+Y,-Y,+Z,-Z]·`dice.test` 5 例）；`ThreeRenderer.screenToWorld` 已有。消费 = game-d `throw3d.ts`（编排：每 loadout 骰生成带初始翻滚的 RigidBody3D·隐形围栏收住·落定 quat 静止后读朝上面 → RolledDie·头顶挂 `WorldUI3D` 大号点数·骰=玻璃 dieGlass 通透）。**初始翻滚参数全从游戏确定性种子 rnd 取**（owner 2026-07-03「用确定种子数据喂物理→物理由确定输入决定→天然支持 lockstep/回放」）→ 同种子同落定面·可回放/双端一致（cannon 同 build 一致；真跨平台定点需另换定点物理·此处不做）。
> - **⬜ 待续**：① 刚体间互撞堆叠调参（现围栏收住·可再调）；② reroll 也接物理（现 reroll 仍走 2D rollPool）；③ 若要进 sim（确定性物理）须换定点/同步方案——owner 言明暂不需要。

---

## REQ-3D-关卡重构「永远追逐」+ 杂项（去腐/大字/Toggle 绕过） · [2026-06-30] · owner → P3D（Game Z 域） · status: **✅ v1 done（P3D 2026-06-30·已推）** · 类型: 关卡数据重构 + 体验修

> **owner 拍板（2026-06-30·多条合并）**：把 game-z 关卡重设成「**永远追逐**」——鸭子 AI 在前面自动跑、追兵在后追逐、一切动态；缩小场景、去掉低画质绿尖塔林、材质陈列台字号放大；并复诉「所有开关型 UI 视觉点击不变」的 bug。
>
> **✅ v1 落地（纯数据 + 运行时胶水·零专属 system）**：
> - **永远追逐玩法**：鸭子(hero) **AI 绕环形赛道自动跑**（game-z.ts `autoRun` 胶水·每帧把 Velocity 设成赛道切线 + 拉回半径 TRACK_R=30·**同 WASD 输入胶水先例**·WASD 可接管）；**三只追兵**(`NavAgent` + `Relation target=hero`)循自动烘焙 NavGraph 一路追（速度略低 → 永远追不太上）；**相机跟随鸭子**(`mode:'follow'`)。截图验证：鸭子 t3→t8 绕跑移位、追兵尾随。
> - **关卡去腐 + 缩小**（owner「缩小一半 + 去绿尖塔林·画质 low」）：删 `forest()`(~320 尖塔)/蘑菇/鹅卵石径/Toad/静态鸭/平台/迷墙/斜墙等纯装饰；地台 240²→**160²**；保留**有碰撞体**的障碍（内圈三石墩 + 外圈四石柱·部分 PBR 钢/铜）+ 中心金属信标(gold)+魔法喷泉 VFX。
> - **材质陈列台**：保留（北侧·材质球·IBL 反射）；**标名字号 xs→md**（owner「字太小」）；「🔬 看材质陈列台」机位按钮照旧。
> - **⚠️ Toggle 视觉点击不更新——game-z 侧绕过**（根因是主程 UI 库 bug·已记 `requests.md` REQ-UI-BUG-Toggle视觉点击不更新）：点 Toggle 后其隐藏 checkbox 抢焦点 → UI 库 reconcile「焦点保护」误跳过重建。**绕过 = 改态后先 `document.activeElement.blur()` 再 `menuUi.update()`**（解焦 → 面板正常重建反映新 checked）。截图验证：点「AO 遮蔽」开关绿→灰、从属滑块随之显隐。**根治仍待主程改 server.ts。**
> - 测试：`diorama.test` 改测追逐关卡（鸭子胶囊 + 追兵 NavAgent/Relation + 障碍 box 碰撞 + 三追兵 target=hero + 信标 gold）。tsc+vitest(1968)+build 全绿。
> - **⬜ 待续**：① **关卡流式加载（streaming·往右动态加载）= owner 要的下一大块·真能力缺口·需设计**（见下「流式加载提案」）；② 程序化 normal/roughness 贴图（owner 已选「程序化生成」·排队中）；③ 鸭子自动跑现为运行时胶水（含 trig·单机测试台 OK·若上多人 lockstep 需下沉成确定性 capability）。

> **🔭 流式加载（streaming）提案（待 owner 确认再做）**：owner 以为「three 已有 streaming 能力」——**澄清：引擎暂无关卡流式能力，是真缺口**。按数据驱动宪法评判=**该做但需设计**（关卡块=数据·加载器=固定解释器）。关键设计点（**determinism**）：关卡块若带碰撞体/寻路体（sim·进 hash），流式增删实体必须**逐 tick 跨端一致**（否则 lockstep desync）——故触发条件须取**确定性 sim 量**（如鸭子前进距离），不能取 render-only 相机。建议形态：`StreamChunk` 数据（块蓝图 + 沿 +X 的区间）+ `chunk-stream` capability（按鸭子 X 距离确定性地 spawn 前方块 / despawn 后方块·对象池复用）。**先确认要不要做 + 单机够不够（单机可放宽 determinism）再开工。**

---

## REQ-3D-材质测试台（IBL 环境光 + 材质陈列板·「我怎么测材质」） · [2026-06-30] · owner → P3D（3D 渲染线·TA Phase 5） · status: **✅ done（P3D 2026-06-30·IBL + 11 预设陈列台·截图验证·已推）** · 类型: 渲染能力补全（金属反射缺 IBL）+ 测试台数据

> **背景**：owner 问「我怎么测这个材质？」。PBR 金属/玻璃**没有环境贴图就乌黑死板**（金属本色=反射环境·无环境可反射→近黑）——这是材质看不出效果的根因，不是预设数值问题。
>
> **✅ 落地（全在 P3D 渲染线域）**：
> - **IBL 环境光照（真能力补全）**：`Sky3D` 加 `env?: number`（IBL 强度·render-only·缺省 0=不装·向后兼容）。渲染器 `syncEnv`：`env>0` → 懒建一次中性影室 `RoomEnvironment` 烘成 PMREM → `scene.environment` + `scene.environmentIntensity`（数据驱动·变才写·destroy 释放）。金属/玻璃自此有反射成像。中性 studio 环境与 sky 色解耦·稳定可预期（材质测试要的是基准光照·非场景天色干扰）。
> - **材质陈列台（纯数据·测试台）**：`diorama` 加 `materialBoard()`——北侧独立石台一排 11 个样品块，每块挂一种闭集预设（哑光/塑料/岩石/土/木/钢/铁/金/铜/玻璃/自发光）+ 头顶飘字标名（WorldUI3D）。样品转 45° 让两面各吃一侧反射（更显金属/粗糙度差异）。零专属代码：样品 = `Mesh3D` box + `Material3D{preset}`。game-z 默认相机可拖向北看陈列台。
> - **验证**：临时把相机对准陈列台截图——金属（钢/铁/金/铜）IBL 下呈金属反射（金=金色、铜=铜色、钢/铁=暗金属），玻璃半透，介电（岩石/土/木）显本色；标名飘字到位。tsc+vitest(1967)+build 全绿。
> - **✅ 追加（owner 2026-06-30·同日）—— 材质球 + 实测参考值 + 看材质机位**：
>   - **`sphere` 基元（真能力补全·过 geometry 管线）**：`Mesh3D.shape` 加 `'sphere'`（box/plane→+sphere·width=直径）。接全管线：`geometry.ts`（`buildMesh3D`/`buildInstancedMesh3DGeometry` 新 `sphereGeo`·单色烤）、`three-projection`（`mesh3dDepth`/`mesh3dBatchKey` 认 sphere·同直径同色归一批）、`material.ts buildPbrMesh3D`（高段 SphereGeometry·反射顺滑）。+2 纯函数测（depth/batchKey sphere）。**球比方块显材质好得多**（高光/粗糙度/反射差异），业界材质球惯例。陈列台样品换成材质球。
>   - **金属 base color 换 Filament 实测 sRGB 参考值**（owner「从现代引擎里找」）：`pbr-materials.ts` 金 0xFFD991(1.00,0.85,0.57)·铜 0xF7BD9E(0.97,0.74,0.62)·钢 0xC4C7C7(Filament 铁色)·铁 0x9A9DA0(铸铁暗档)；介电 albedo 取实测（橡木/花岗岩/干土）。来源注 Filament Materials guide。截图：金/铜/钢/铁四金属在 IBL 下各自正确反射、玻璃透、介电哑光。
>   - **「看材质陈列台」机位按钮（render-only 写 Camera3D）**：调试面板加 `Button`「🔬 看材质陈列台」/「🏠 回总览」（UI 铁律·LayoutNode Button·action 经 handler 写 `Camera3D` 机位预设 `BOARD_CAM`/`HOME_CAM`·退 follow）。一键正对陈列台看清材质。截图验证 11 球清晰排开。
> - **⬜ 待续（按需·非本次）**：① IBL 来源可选 sky 派生（现中性 studio·够用）；② 法线/粗糙度/金属度贴图精修（现纯参数）；③ 调试面板加 PBR 参数实时调；④ 更多金属预设（银/铝/铬·Filament 表已有值·按需加）。

---

## REQ-3D-BUG-后处理黑屏（AO/分级脏数值） · [2026-06-30] · owner 报 → P3D（3D 渲染线·后处理域） · status: **✅ fixed（P3D 2026-06-30·根因定位 + 渲染器 finite 兜底 + 面板域修正 + 回归测试·已推）** · 类型: 渲染健壮性 bug（脏数值喂 shader → 整片黑屏）

> **现象（owner 2026-06-30）**：「AO 强度的时候，屏幕动一下，屏就全黑了」「要改任何东西都会改，对比改那个也会黑屏」。即调试面板拖滑块改后处理参数后 → 3D 画面整片黑（HUD/世界飘字等 DOM 叠层仍在·只 WebGL 黑）。
>
> **根因（无头 Chromium 稳定复现 + 逐层 bisect 定位·非 GPU 玄学）**：链条 = **UI 库 Slider 偶发回调 `undefined`（见 `requests.md` REQ-UI-BUG-Slider回调偶发undefined）→ `Number(undefined)=NaN` 写进 `Post3D.ao.intensity` → `PostPipeline` 直传 `gtao.blendIntensity=NaN` → GTAO blend `mix(1,ao,NaN)=NaN` → 整片黑**。
> - **次因（即便不 NaN 也危险）**：`blendIntensity` 是 AO 的**不透明度 [0,1]**（0=不施加·1=全施加），**非强度倍率**。GTAO blend = `1 − intensity·(1−ao)`，`intensity>1` 让有遮蔽处(ao<1)算出负值→钳 0→黑。原面板「AO 强度」滑块范围 0..3、默认 1.1，**本就探进危险区**。
>
> **✅ 修法（全在 P3D 渲染线域·`renderer/three/**` + `games/game-z/**`）**：
> - **渲染器 finite 兜底（真·能力修·健壮性铁律）**：新 `renderer/three/num-guard.ts`（`clamp01`/`posOr`/`fin` 纯函数）——`PostPipeline.render` 喂 GPU 前，AO `intensity` 钳 [0,1]·NaN→1，`radius`/`scale` 取正·NaN→缺省；分级 `exposure/contrast/saturation/brightness` 全 finite 兜底。**渲染器绝不把 NaN/超界喂进 shader**（弱 LLM 写脏数据 / UI 抖动都不黑屏）。
> - **面板域修正**：「AO 强度」滑块范围改 0..1（其合法域）、默认 0.85；`diorama` 初值 1.1→0.85；滑块 handler 只接受 `Number.isFinite` 值（脏回调丢弃·与渲染器兜底双保险）。
> - **回归测试** `num-guard.test.ts`（3·NaN/undefined/超界→安全回退）。tsc+vitest(1965)+build+无头截图全绿（拖滑块至上界 + 转相机不再黑）。
> - **连带产出**：定位过程挖出两个 UI 库（主程域）bug，已记 `requests.md`：① **Toggle 视觉点击不更新**（owner 同日另报·`reconcile` 焦点保护误伤 Toggle）；② **Slider 回调偶发 undefined**（本黑屏的上游触发源）。

---

## REQ-3D-Nav 导航网格自动烘焙（寻路数据 + 寻路碰撞·game-z 验证） · [2026-06-28] · owner → P3D（owner 授权跨界·**复用主程 pathfind**） · status: **✅ done（P3D 2026-06-28·自动生成·复用主程 NavGraph·端到端验证·已推）** · 类型: 真能力缺口（碰撞几何→可走拓扑**自动生成**）

> **⚠️ 知会主程（owner 2026-06-28 拍板·关于你的 `REQ-寻路`）**：owner 要 game-z 验证「寻路数据 + 寻路碰撞」。你的 `pathfind`（航点图 NavGraph + 通用 A* + 沿路跟随 + collision-resolve 避让）很好，**我全盘复用、一行没改**。唯一分歧：owner **不接受手摆 NavGraph**（「我摆这些东西太麻烦了，也没有手摆需求……一定要像 Recast 这样自动生成」）。结论 = **不取代你的 runtime，只在它上游加一层「自动生成 NavGraph」**：
> - **共存（owner「不能共存吗」）**：场上摆 `NavMesh`（范围+格边长+半径）→ `navmesh-bake` 自动烘 `NavGraph`；只摆手写 `NavGraph`（无 NavMesh）→ 烘焙不动、用你的手摆图。**二选一·同一下游 pathfind**。
> - 你那段 `NavGraph`/`NavAgent`/`NavPath`/`pathfind`/`astar.ts` **保持不变**；手摆路径仍可用（你若不需要可不管）。本 REQ 不动你的代码。
>
> **✅ 落地（P3D 2026-06-28·已推）—— 自动生成（Recast 思路·确定性轻量版）**：
> - **新组件** `NavMesh`（`spatial.ts`·烘焙配置·单例：范围矩形 + 格边长 + agentRadius·进 hash）。注册 `assembly/component-map.ts`。**作者零手摆航点**——只圈个范围。
> - **纯函数核** `engine/spatial/navmesh.ts`：`gridFromBounds` + `rasterizeBlocked`（障碍 AABB→封格·「寻路碰撞」）+ `bakeNavGraph`（可行走格→**主程 NavGraph 结构**：节点=空格中心、八向边·斜边防穿角）。整数化·跨端逐位确定。
> - **能力** `skills/atoms/navmesh-bake`：读 `NavMesh` + `Collider3D` → 写**主程的 `NavGraph`**（每帧重烘·rollback 安全）。排除 trigger / NavAgent。`runsBefore nav-follow + motion-apply`（图先就绪 + 破 Transform 环）。
> - **下游零改**：主程 `pathfind`(`nav-follow`) 照常读 NavGraph → A* → 写 Velocity → `motion-apply` 走动。
> - **debug 可视化（P3D 渲染线域）** `renderer/three/nav-debug.ts`（render-only）：青点=航点（没点处=被碰撞封住）+ 暗青线=连边 + 黄线=`NavPath` 规划路径。接入 `three-renderer`（`setDebugNav`）。
> - **game-z 验证**：`NavMesh` 罩草地台 + 三石墩障碍（`obstacle()`·碰撞+寻路双用）+ 橙盒追兵（**主程 `NavAgent` + `Relation(target=hero)` + `Velocity`**）→ 自动绕障碍逼近小黄鸭。菜单加「🧭 导航网格」+ N 键。截图：青点网格自动避开所有碰撞体、追兵沿黄线绕行。
> - **扩充关卡 + 多 agent 蛇形迷墙（owner 2026-06-28「扩充一倍 + 加寻路碰撞展示」）**：地台 70²→**100²**（NavMesh/相机随扩）；加四角石柱 + **两道交错长墙（各留缺口）的蛇形迷墙**；**第二个追兵**（蓝盒·从 100² 远端出发·必须穿迷墙两缺口）→ 展示长程绕路 + 多 agent 同时寻路。**烘焙器改进**：排除带 `Velocity` 的动态体（玩家/追兵不当静态障碍·不在自己导航上挖洞·`runsBefore motion-apply` 已保序）。+1 测（动态体不烘进图）。
> - **测试**：`navmesh.test`(5·栅格化/封格无节点/防穿角/确定性) + `navmesh-bake.test`(4·**端到端绕墙不穿墙**[配主程 pathfind] + **共存：无 NavMesh 不烘** + 两世界 hash 一致)。tsc+vitest+build+截图全绿（主程 `pathfind`/`astar` 测试一并跑绿·未碰你的代码）。
> - **⬜ 待续（按需）**：静态障碍只在变更时重烘（现每帧·盒庭够）；多边形 navmesh（现栅格·真要更强壮再升）；动态体避让走主程 collision-resolve（game-z 暂无 2D resolve·靠图拓扑静态避障已够）。

---

## REQ-3D-Collision 3D 逻辑碰撞（触发/重叠·升维 2D） · [2026-06-28] · owner+P3D → 主程（sim/能力域评审） · status: **🚧 P1 + debug 线框/可点击菜单 + P2(精简 hull·凸多面体 SAT) 已落（owner 2026-06-28 授权 P3D 跨界落·知会主程评审）；P3 物理表现轨待（YAGNI）** · 类型: 真能力缺口（3D 逻辑碰撞·升维复用）

> **⚠️ 知会主程（owner 授权 P3D 跨界落 sim·同资产层先例）**：本 REQ 的 sim 半边落在你的域（`engine/spatial` + `skills/atoms` + sim 组件 `spatial.ts`）——**owner 2026-06-28 当面授权 P3D 实现 P1**。改动**严格镜像 2D 碰撞**（同确定性纪律：只用 +−×÷/sqrt/min/max·无 sin/cos/hypot），**进 hash·rollback 安全**，不碰 2D 碰撞代码。请评审；如与并行改动撞 rebase 喊我。
>
> **✅ P1 已落（P3D 2026-06-28·已推）**：
> - **数据**：`Collider3D`（sphere/box/capsule·进 hash·`spatial.ts`）+ `Overlap3D`（重叠事件）。确定性位置模型：**planar 取 2D `Transform`(进 hash·x→X、y→Z)，垂直/形状取 `Collider3D`(进 hash)——不碰 render-only `Transform3D`**。胶囊限竖直(Y 轴·角色标准)→ 各测试退化「XZ 距离 + Y 区间」全解析。
> - **窄相位**：`engine/spatial/contact3d.ts`（纯函数·镜像 2D `contact.ts`·确定性）——球/盒(AABB)/竖直胶囊两两接触 + 法线/深度。
> - **能力**：`skills/atoms/overlap-detect-3d`——每帧重建（按 id 升序）+ **暴力 N² AABB 宽相位**（轻量盒庭够·升维树是 scale 路）+ 窄相位 → 产 `Overlap3D`。
> - **demo**：game-z 加 `overlapDetect3dCapability` + hero `Collider3D` 胶囊 + 触发区 zone（半透明绿垫 Mesh3D[render] + `Collider3D` box trigger[sim]·同 2D Transform 驱动渲染+碰撞）；HUD 读 `Overlap3D` 亮「🔔 触发区」。截图验证。
> - 测试：`contact3d.test`(7·含 **Y 分离不重叠** 真 3D + 确定性逐位) + `overlap-detect-3d.test`(3·含 **Collider3D 进 hash** 验证 + 触发进出) + diorama 碰撞。tsc+vitest(1886)+build+截图全绿。
> - **✅ debug 线框可视化（P3D 渲染线域·提案 §边界「P3D 天然拥有的那块 ①」已落）**：`renderer/three/collider-debug.ts`（新·`ColliderDebug` 类·render-only·池管理·只读 world 不写 sim）——读 sim `Collider3D`+2D `Transform` 画线框（box→Box·sphere→Sphere·竖直 capsule→Capsule·**位置映射严格同 `contact3d`**：planar 取 Transform、垂直取 Collider3D `baseY/height`）；trigger=绿、实心=黄；`MeshBasicMaterial wireframe`。接入 `three-renderer` `sync`（`setDebugColliders(on)` 开关 + renderSig 失效重渲）。**可点击菜单**（owner 2026-06-28 加需求）：game-z 左下 `pointer-events:auto` 独立宿主 + `LayoutNode` `Button`（action `toggleDebug` 经 mountUI handler 入队·**UI 铁律**·无自由 DOM/CSS 逻辑）+ `C` 键快捷。截图验证（hero 胶囊线框 + zone 盒线框 + 按钮 ON）。
>
> **✅ P2 已落（P3D 2026-06-28·owner 批「现在落精简 hull+3D SAT」·已推）—— 评审后大幅重定范围，回驳原 P2 三件中的两件半**：
> - **架构评审先行（CLAUDE.md 核心规则 #2）**：读 2D `contact.ts` 发现本引擎**从不在运行时旋转碰撞体**（`contact.ts:7`「无旋转」）——2D 表达「转过的盒」是用 `polygon` + **预烘焙顶点**（world 顶点 = 局部顶点 + 平移·不乘旋转矩阵），数据层就解了 sin/cos 确定性难题。据此回驳：
>   - **OBB（按角度）→ 回驳**：算朝向基底需 sin/cos → 破坏跨机逐位确定（2D 正为此绕开）；「转过的盒」功能上 = 凸包顶点 / 或 AABB 拆分（manifesto C-档），可重组。
>   - **cylinder → 回驳**：角色 XZ 阻挡上圆柱≈胶囊（只差平顶/圆顶）→ 功能等价 capsule·YAGNI。
>   - **GJK+EPA → 回驳为当前形态**：对「渲染轻引擎」过度复杂（owner：不要过度复杂·不能特别费）；SAT 对有界顶点凸包直接给穿透深度·复用 2D `satPolyPoly`/`satPolyCircle` 心智模型即可。GJK 是规模路·真撑爆顶点数再说。
> - **落地（唯一站得住的精简形态）**：新碰撞体档 `hull` = **预烘焙局部顶点 + 面法线轴**（`Collider3D.verts`/`axes`·照搬 2D `polygon` 套路·运行时只平移不旋转·无 sin/cos）。一举吃掉「OBB」的**正确**表达（转过的盒 = 8 顶点 hull）+ 任意凸关卡块/斜坡/斜墙。
>   - **窄相位**：`engine/spatial/sat3d.ts`（新·确定性 3D SAT）——`satPolyPoly3`（A 面法线 ∪ B 面法线 ∪ **边×边叉积轴** → 盒/OBB 精确 15 轴）+ `satPolySphere3`（面法线 ∪ 最近顶点→球心·镜像 2D `satPolyCircle`）。只用 +−×÷/sqrt + 叉积·**无三角函数**。
>   - **接入** `contact3d.ts`：hull 介入 → SAT 路；其余保持 P1 解析（**逐位不变**）。胶囊 vs hull = 段上取离 hull 心最近 Y 的单球（轻量·保守·够角色站台/撞墙）。
>   - **debug 线框**：`collider-debug.ts` 加 hull（`ConvexGeometry` 从顶点重建·render-only）。
>   - **demo**：game-z 加 `angle-wall`（绕 Y 转 30° 石板·Transform3D.rotY render + hull collision·**顶点由轴+半尺寸只用 ×/+ 生成→跨机确定**）。开菜单见斜置 hull 线框（黄）——证明 SAT 按真朝向判定·非轴对齐 AABB。
>   - **测试**：`contact3d.test` +5（轴对齐 hull·**转 45° 真旋转：球落 AABB 内但盒外→SAT 判分离**·hull-hull 15 轴·hull-胶囊·确定性）。tsc+vitest+build+截图全绿。
> - **✅ 3D 碰撞响应（owner 2026-06-28「鸭子穿墙·只检测没碰撞」→ 补响应）**：`skills/atoms/collision-resolve-3d`（镜像 2D `collision-resolve`·确定性 sim·进 hash·Resolve 阶段）——读 `Overlap3D` → 顺序冲量(速度) + NGS(位置)把动态体推出静态墙。**XZ 地面解算**（取接触法线水平分量·实体竖直锁 baseY·纯竖直接触跳过）；逆质量：无 Velocity=静态、有=动态；trigger 不解算（触发区可穿入）。game-z 接入 → 小黄鸭撞墙被挡、贴墙滑。测试 4（推出/速度清/trigger 跳过/两世界 hash 一致）。
> - **⬜ 待续**：动态-动态堆叠/质量分摊已支持(同 2D 核)·更复杂刚体走 P3 物理表现轨（纯表现·Rapier·YAGNI）。
> **架构守则（贯穿·下同）不变。**


> **owner 2026-06-28 拍板的架构分界（最关键·两套碰撞泾渭分明）**：
> - **逻辑碰撞（触发/重叠）= 确定性 sim**：「进区域 / 撞到 / 命中」喂玩法的事实 → 进权威主机/lockstep 状态 → **进 hash、必须确定性**。**本 REQ 只做这个。**
> - **物理模拟（刚体/弹飞/堆叠/布娃娃）= 纯表现**：**绝不喂逻辑、不进 lockstep/hash**。哪天做可随便用非确定性物理库（Cannon/Rapier 当特效）——**YAGNI·不在本 REQ**。
> 这一刀绕开 3D 物理最难的坑（跨端浮点确定性）：逻辑碰撞只做廉价解析重叠测试（**同 2D 先例·确定性边界不变**）。
>
> **结论：升维复用现成 2D 碰撞能力到 3D**（P3D + owner 评估·主程定夺）。2D 已有成熟确定性分层可直接镜像：
> | 2D 现成（主程域） | 3D 升维 |
> |---|---|
> | `Shape`(box/circle/polygon·进 hash) | `Collider3D`(sphere/AABB/capsule·进 hash·**数据组件**) |
> | `engine/spatial/aabb-tree.ts`(`DynamicAabbTree`·每帧重建·rollback 安全) | 升成 **3D AABB**（同结构·同确定性） |
> | `engine/spatial/contact.ts`(`contactBetween`/`aabbOf`) | 3D 解析窄相位（sphere/AABB/capsule 重叠 + 法线/深度） |
> | `overlap-detect`(atom·产 `Overlap`) | `overlap-detect-3d` 产 `Overlap3D`（法线+深度·或纯触发布尔） |
> | `collision-resolve`(tier2·推开) | 3D 推开（按需·触发区只需重叠事件不需推开） |
>
> **空间分割裁决**：用**升维的动态 AABB 树（BVH）**——不是四叉/八叉树（轻量盒庭几十~低百物体·现成树确定性+rollback 已验证）；物体特别少时暴力 N² AABB 亦可。八叉/网格 YAGNI。
> **碰撞体分档（封顶复杂度·owner「不能特别费」）**：A 解析图元 sphere/AABB/**OBB**/capsule/cylinder（覆盖 90%·角色 capsule + 关卡 box）；B 凸包 multi-convex（GJK·**封顶顶点/块数**）；C 任意三角网格**不做**（静态关卡拆凸块/AABB）。**先做 A 档的 sphere/AABB/capsule + 触发/重叠事件**。
>
> **分期**：
> - **P1（覆盖 90%·先做）**：`Collider3D` 数据(sphere/AABB/capsule) + 3D 动态 AABB 树宽相位 + 解析窄相位 + `Overlap3D` 触发/重叠事件 + （按需）3D 推开。够角色撞墙/落地/触发区。
> - **P2**：OBB + cylinder + 凸包(GJK·有界)。
> - **P3（仅当真要刚体·另起「物理表现轨」）**：堆叠/推/关节 = **纯表现**层·评估 Rapier·不进 hash。
>
> **数据驱动尺子**：`Collider3D` 弱模型填得了 `kind:'capsule', radius:2, height:7, offset:{...}`，**填不了物理引擎不透明 body 句柄**——过尺。碰撞=确定性解释器（能力）。
>
> **边界 / 分工**：碰撞 sim 全在 `engine/spatial` + `skills` + sim 组件 = **🔒 主程域**（§0.1）。**请主程评审本提案并定落点**（主程实现 / 或 owner 像授权资产层那样授权 P3D 跨界落）。**P3D 天然拥有的那块**：① 碰撞体 **debug 线框可视化**（render-only·新 3D render 组件或复用 Mesh3D wireframe·我的渲染线域）；② game-z 接碰撞能力做触发区 demo（小黄鸭进区域亮灯等）。
> **验收**：角色 capsule vs 关卡 AABB 触发/重叠事件确定性（进 hash·rollback 安全·node 单测同 2D `overlap-detect.test` 先例）；debug 线框渲出；tsc+vitest+build 全绿。
>
> **Lead 裁决（2026-07-04）：✅ 准 P1 范围**——提案质量高：数据组件过尺（弱模型填得了 Collider3D、填不了物理句柄）、镜像 2D 确定性分层（DynamicAabbTree 先例）、YAGNI 刀干净（八叉树不做/三角网格不做/刚体=表现轨另议均照准）。**落点**：碰撞 sim（engine/spatial+skills+组件）=主程域不外放——**Lead 已收编提案 P1 节为 spec → 指派：Opus（xhigh·正确性关键）施工引擎半**；**P3D 并行做自己那半**（debug 线框 render-only + game-z 触发区 demo），组件契约（`Collider3D{kind:'sphere'|'aabb'|'capsule',...}` / `Overlap3D`）以引擎半落地时的 component-map 为准、字段名先按提案冻结。开工时点=owner 排期（说一声即发工）。P2（OBB/cylinder/凸包）待 P1 消费方真出现再议。
> **Lead 顺手注（2026-07-04）**：上文 game-z「Toggle 绕过」注记已过期——根治已落 `src/ui/components/server.ts:64-68`（焦点保护只认文本控件·checkbox/radio 放行重建·2026-07-01），P3D 可撤 `blur()` 绕过并删该注。

---

## REQ-3D-W1高效引擎 · [2026-06-28] · owner → P3D（3D 渲染线）· status: **🚧 进行中（W1-A + W1-B + W1-C + W1-D ✅ 已落 + profiler + 模块化拆分；W1-E 健壮 ⬜ 下一增量）** · 类型: 设计纲领 + 真能力（实例化绘制）

> **进度（P3D 2026-06-28·已推）**：
> - **W1-A 实例化** ✅：同视觉签名(`mesh3dBatchKey`=shape+尺寸+逐面色)的 Mesh3D → 一个 `InstancedMesh`（1 draw call）。逐面色**烤进 `vertexColors`**（多色盒也能批·非仅单色）；复用单 dummy `Object3D` 合 instanceMatrix；超容量 ×2 扩容；空批移除；整体投/受软影；`frustumCulled=false` 防散布整批误剔；透明盒(alpha<1)走单 mesh fallback。验收：game-z 20 盒 → **11 批**（金阶梯 2→1·蘑菇茎 2→1·8 鹅卵石 8→1）。**Model3D 多 mesh 实例化 = W1-A 第二步（待）**。
> - **W1-B 零浪费** ✅：去每帧 `material.needsUpdate`（颜色/alpha 是 uniform）；仅贴图引用变才 needsUpdate；不透明走 opaque 管线。
> - **W1-C 低开销基线** ✅：① 静态帧**脏标跳渲**（渲染签名=位姿hash+相机+灯+后处理+云飘帧·不变则跳 instanceMatrix 上传+阴影+render）；② **阴影按需重算**（`shadowMap.autoUpdate=false`·仅投影体/灯变才 needsUpdate·相机转/云飘不触发阴影重算）；③ near/far 从 0.1–10000 收紧到 ~1–(dist+天空半径)。
> - **W1-D 快赢** ✅：`ACESFilmicToneMapping`+曝光（天空盒 `toneMapped:false` 保色）+ `setPixelRatio(min(dpr,2))`。
> - **profiler（owner「做个 profile state·像虚幻」）** ✅：`renderer.readStats()` 暴露 fps/cpuMs/drawCalls/triangles/programs/geo/tex/batches/instances/models/rendered；game-z LayoutNode HUD 显示（P 键开关·UI 铁律）。
> - **模块化拆分（owner「别全写一个文件·每文件<400 行」）** ✅：`three-renderer.ts` 832→392 行；拆 `renderer/three/{geometry,stats,lights,post,models,batches}.ts`（各 ≤146 行·按子系统分）。
> - **⬜ 待续**：W1-E（resize/模型自动贴地/.glb-only）；W1-A 第二步（Model3D 多 mesh 实例化）。
> - 测试：`mesh3dBatchKey` + `hashPoses/camSig/postSig`（脏标）纯函数单测；tsc+vitest+build+无头截图全绿。零数据改动（绝不加 instanced 旗标）。

> **设计纲领（owner 2026-06-28 拍板）**：要的是**高效率、低开销**的 3D 引擎——**性能是一等设计约束、写进架构，不靠后期优化补**（owner 明言「后期不会做什么优化」）。所以下面不是「以后再说的优化」，是**现在就该达到的基线**。**instanced draw（实例化绘制）是硬要求。**
> **数据驱动铁律不变**：W1 全是**渲染器内部**的事，**零数据 / 零组件 / 零接口改动**——游戏照旧摆 N 个 `Mesh3D`/`Model3D` 实体（纯数据），渲染器自己批。**绝不往数据里加 `instanced:true` 之类渲染旗标**（那是把渲染关切泄进数据，违 manifesto）。


## 已归档条目索引（2026-07-03 归档手术 · 全文见 `requests-3d-archive.md`）


### W1-A · 实例化绘制（headline · 必做）
目标：同一几何的多个实体 → **1 个 draw call**（`THREE.InstancedMesh`），对数据透明。
- **自动分批（batch key 从现有组件派生·不加字段）**：Mesh3D → key=`shape+尺寸(w/h/d)`（同几何）；Model3D → key=`modelKey`（同 glTF）。同 key 进同一 InstancedMesh，每实体一个 `instanceMatrix`（位姿合成 Matrix4）。
- **每帧**：每批只更新 `instanceMatrix`（一次 buffer 上传·`instanceMatrix.needsUpdate=true`）——**廉价 buffer 上传、非 shader 重编**（对照 W1-B#1）。复用单个 `Matrix4`/`Quaternion` 临时对象，**别每帧每实体 new**。
- **动态数量**：实体增减 → 预分配容量 + 设 `mesh.count=活跃数`；超容量再扩容重建；空批移出场景。
- **阴影**：InstancedMesh 整体 `castShadow/receiveShadow`（实例阴影 three 原生支持）。
- **⚠️ 逐面色的坑（务必处理对）**：InstancedMesh 共享**一个**材质，`instanceColor` 只给**每实例一个色**——表达不了 Mesh3D 的 front/back/edge 逐面分色。三选一：① **同色盒批**（front=back=edge 同色的盒子进实例批·`instanceColor` 上色——积木/体素世界大多如此·最划算）；② **逐面色烤进 `vertexColors`**（同图案盒可实例化）；③ **逐面异色盒不实例化**（少量走老单 Mesh 路·保留 `paintMesh3D` 作 fallback）。**建议默认 ①+③ fallback**。
- **Model3D 实例化（分期）**：glTF 是多 mesh 树。现 `clone(true)` 已**共享几何**（几何只传一次 GPU）→ 现状=「N draw call、几何不重传」；实例化要收的是那 **N 个 draw call**。**先把 Mesh3D 实例化做扎实**；多 mesh 模型实例化（每子几何一个 InstancedMesh：`instanceMatrix=实体世界矩阵×子mesh局部矩阵`，或本 three 版的 `BatchedMesh`）作 W1-A 第二步。
- **验收**：N 个同款盒/鸭 → `renderer.info.render.calls` ≈ 批数（非 N）·断言（无头截图脚本可读 `renderer.info`）；batch key 归并 + 矩阵合成抽 `three-projection` 纯函数单测。

### W1-B · 每帧零浪费（review 的性能项 · 现在是必做基线）
1. **去掉每帧 `material.needsUpdate=true`**（`paintMesh3D`/`paint`）——颜色/alpha 是 uniform、每帧本就重传，不需 needsUpdate；只在贴图引用变 / transparent 翻转时设。**这是「低开销」的地板，与实例化同等重要。**
2. **`transparent` 只在 `alpha<1` 时开**（`buildMesh3D` 现恒 true → 按 alpha）——不透明物体走 opaque 管线（early-z + 不排序）。
3. **sync 里别每帧每实体 new 临时对象**（Matrix4/Vector3/Euler 复用单例）。

### W1-C · 低开销基线（写进设计·非后补）
- **静态帧跳渲**：盒庭基本静态 → 维护 dirty 标志（world 版本变 / 相机动 / 云飘 / 有动画）；**没变就不 `gl.render`**。这是「低开销」最大单点（静态盒庭可从满载降到近 0）。云飘/角色走动时记得置 dirty。
- **阴影不动不重渲**：`key.shadow.autoUpdate=false` + 仅 dirty 时 `shadow.needsUpdate=true`。
- **相机 near/far 收紧**（现 0.1–10000=1e5 比·深度精度差）：near~1、far 从天空盒半径派生（顺带减 z-fighting）。

### W1-D · 观感快赢（owner 已「可以」）
- `gl.toneMapping=ACESFilmic`（或本版 AgX）+ `toneMappingExposure≈1.05`——PBR 不削顶、通透。
- `gl.setPixelRatio(Math.min(devicePixelRatio,2))`——retina 不糊。

### W1-E · 健壮（中·进清单）
- `ResizeObserver` → `setSize` + `camera.aspect`（容器变尺寸）。
- 模型自动贴地：`Box3.setFromObject` 算底面 minY、缓存偏移、抬到坐地（消「模型原点须在脚底」踩坑）。
- 文档写明 glTF **.glb / 内嵌资源 only**（`parse(bytes,'')` 不解外部 .bin/贴图）。

### 贯穿 W1 的数据驱动守则
- 实例化 / 批 / 跳渲 / tonemap 全是**渲染器内部**，**零数据改动**——游戏只摆实体数据，渲染器自动高效。
- 别为实例化让数据「迁就渲染器」（如强制同色）——**同色批是渲染器的选择**，数据照常可填逐面色，渲染器决定谁进批、谁走单 mesh fallback。
- 光照/曝光数据化（`Light3D`+曝光字段）**P3D 已超额做出**（见路线图记录）；W1 先把 tonemap 作渲染器默认值即可。

> **优先级**：W1-A 实例化 + W1-B 零浪费 = 第一梯队（效率纲领核心）；W1-C 静态跳渲 = 第二（最大低开销单点）；W1-D 快赢顺手；W1-E 中期。全程 tsc+vitest+build 全绿才推，跨出 3D 渲染线先报主程。

---

## REQ-3D-Camera相机参数补全 · [2026-06-28] · owner → P3D（3D 渲染线）· status: **✅ done（P3D 2026-06-28·三层落地·正交/跟随截图验证）** · 类型: 真能力扩增（3D 线·过四条尺子）

> **✅ 落地（P3D 2026-06-28·已推）**：严守三层铁律——数据补参数 / 解释器算矩阵 / 行为写态。
> - **① 数据层**：`Camera3D` 补 `projection('perspective'|'ortho')`/`fov`/`orthoSize`/`near`/`far`/`mode('orbit'|'follow')`/`target`/`pitchMin`/`pitchMax`（全语义参数·**无矩阵**·多模式用 `mode` 枚举）。
> - **② 解释器层**：新 `renderer/three/camera-rig.ts`（`CameraRig`·持透视+正交两台·按 `projection` 选 active·fov/ortho/near/far 全从数据读）；`mode:'follow'` 由渲染器把注视点解析成 `target` 实体位（收集期捕获位姿·不写 sim/不进 hash）；投影/正交视锥/夹角数学抽 `three-projection` 纯函数（`orthoFrustum`/`clampPitch`）+ node 单测。
> - **③ 行为层**：game-z 拖拽/滚轮写 `Camera3D`（运行时胶水·pitch 夹角读数据）；O 键切正交、F 键切跟随小黄鸭（只写数据·渲染器解释）。
> - 验收：截图确认**正交=等距盒庭**、**follow 相机注视小黄鸭**；fov/pitch 夹角/near-far 全从数据；`renderer.info` 无回归。`fov` 从 `ThreeRendererOptions` 迁到 `Camera3D` 数据。`camSig` 纳入全相机参数（改即重渲）。tsc+vitest+build+截图全绿。**未做（YAGNI·准则点名）**：震屏/镜头过渡（要做时是 render-only 行为写 `Camera3D`+tween·不塞字段）。

> **owner 2026-06-28**：3D 相机要像传统 3D 游戏那样有更多参数（投影 / fov / near-far / 跟随 / 约束）。这是「3D 线被证明的真缺口边」上的**正当扩增**。
> **架构铁律（贯穿）**：**相机 = 数据（`Camera3D`）+ 固定解释器（渲染器算矩阵）**。传统引擎是「Camera 对象带 lookAt/setFov/矩阵方法、游戏调它」；我们这套**反转**——游戏**永不调相机方法、永不持矩阵**，只填 `Camera3D` 数据，渲染器去 lookAt / 算 view·projection 矩阵。三层分工：

### ① 数据层（`Camera3D` 组件补字段 · render-only · 语义参数 · 弱模型能填）
- 现有：`yaw / pitch / distance / pivotX·Y·Z`（保留）。
- 补：`projection?: 'perspective'|'ortho'`（正交=等距微缩盒庭常用）；`fov?`（透视·从 `ThreeRendererOptions` 移到数据·per-scene）；`orthoSize?`（正交半高）；`near?` / `far?`（深度精度·配 W1-C 收紧）；`mode?: 'orbit'|'follow'`；`target?: string`（follow 时注视/环绕的实体 id）；`pitchMin?` / `pitchMax?`（俯仰夹角·game-z 现硬编码在 mount，挪成数据）。
- **绝不放矩阵**——弱模型 litmus：它填得了 `fov:50 / mode:'follow' / target:'duck' / near:1`，**填不了一个 4×4 矩阵**。**多模式用 `mode` 枚举，别开 N 个相机组件。**

### ② 解释器层（`three-projection` 纯函数 + `ThreeRenderer` · 引擎固定 · 算矩阵）
- `projection:'ortho'` → 运行时切 `THREE.OrthographicCamera`（按 orthoSize/aspect 定 frustum）；`'perspective'` → 现 `PerspectiveCamera` 用 `fov`。
- `fov / near / far` 从 `Camera3D` 读（不再写死在构造 option）。
- `mode:'follow'` → 渲染器每 sync 把 `pivot` 解析成 `target` 实体的世界位（Transform3D 或 2D-Transform 落地面位）——**这是「解释」（渲染器读世界），不是新 capability、不写 sim、不进 hash**。
- `pitchMin/Max` 夹 pitch。投影 / lookAt / ortho frustum 数学抽 `three-projection` 纯函数 + node 单测（同 `orbitCamera`/`fitDistance3D` 先例）。

### ③ 行为层（运镜 · 写 `Camera3D` 随时间变 · render-only）
- 输入运镜（拖拽转 yaw/pitch、滚轮改 distance）已是**运行时输入胶水**（game-z mount 先例）——保持；按需可抽成 render-only 小能力。
- 震屏 / 镜头过渡 = **暂不做（YAGNI）**；要做时是 render-only 行为（写 `Camera3D` + 用 `tween`），**不塞进 `Camera3D` 字段**。

> **尺子（别扩歪）**：① 矩阵留解释器、组件只存语义参数；② `mode` 枚举非 N 组件；③ 别投机搬电影机全套（景深 DOF 已是 `Post3D` 的活 / 镜头语言 YAGNI）；④ 运镜是「行为写态」不是 `Camera3D` 字段；⑤ render-only 出 hash（`Camera3D` 已在 `NON_DETERMINISTIC`）。
> **验收**：盒庭可切正交看等距；`mode:'follow', target:'hero'` 时相机跟鸭走；pitch 夹角 / near-far 来自数据；投影 / follow-pivot 纯函数单测；tsc+vitest+build 全绿。
> **这是「3D 线下一个正当扩增」的样板**：数据补参数、解释器算矩阵、行为写态——**三层不混**。跨出 3D 渲染线（如要动资产/核心 ECS）先报主程。

---

## REQ-3D-Model导入 · [2026-06-28] · P3D（3D 渲染线）→ 主程（资产层域）· status: **✅ done（端到端打通·owner 2026-06-28 当面授权 P3D 跨界把资产半边也落）** · 类型: 真能力缺口（box 原语表达不了圆润模型）

> **⚠️ 知会主程**：资产层（`src/assets/`·按契约 🔒 主程域）这次由 P3D 落了——**owner（junbai.li）2026-06-28 当面授权**「资产这块你也去，可以授权你动」。改动**极小且零 three 依赖**，不碰任何 2D 逻辑/现有 kind 行为，全绿。如与并行资产改动撞 rebase 请喊主程。
> **背景**：owner 2026-06-28 拍板做「轻量 3D 渲染场景」——模型导入打头阵（圆润真模型，box/plane 原语表达不了，是真缺口非重组）。纯 Three.js（零裸 WebGL），用 `three/addons` 的 `GLTFLoader`。
> **干净的边界切法（资产层零 three 依赖）**：glTF 解析产物是 three 场景图（渲染概念）。故**资产层只管「key → 取 `.glb` 字节(ArrayBuffer)」（零 three 依赖）**，`GLTFLoader.parse(bytes)` 留在 `ThreeRenderer`。
> **✅ 资产半边（`src/assets/`·owner 授权 P3D 落）**：`asset-types.ts` 加 `ModelDescriptor{kind:'model';key;src}`；`model-loader.ts`（新·`ModelAssetLoader` fetch→ArrayBuffer + `isModelHandle`·零 three）；`asset-manager.ts` 两处 exhaustive switch 补 `'model'`；`index.ts` 导出。测试 `model-loader.test.ts`。
> **✅ render 半边**：`Model3D` render-only 组件（`modelKey` + `scale?` + `tint?`·蓝图只持 key 不塞 URL/二进制）；登记三处（component-map / determinism `NON_DETERMINISTIC` / renderable）；`three-renderer` 按 modelKey 取 ArrayBuffer → `GLTFLoader.parse` 一次入模板缓存 → 多实例 clone（共享几何·每实例 clone 材质供染色/独立释放）→ 位姿走 Transform3D/盒庭落地面/2D 投影同套路 → 投/受软影；未就绪本帧不画（同 sprite 先例）。GLTFLoader 进 three-renderer code-split chunk。
> **✅ 端到端（game-z 真模型 + 截图回归）**：基础模型资产（Khronos glTF-Sample-Assets·`public/models/`·`duck.glb`+`box.glb`·许可见 `CREDITS.md`）；game-z 把方块换 `Model3D{modelKey:'duck'}`（可控）+ 静态 `duck-statue`（共享模板·多实例复用）；无头截图回归确认软影 + 自带材质渲出。**坑**：glTF 节点常带内建 scale，物体真实尺寸 ≠ 裸 accessor min/max → `Model3D.scale` 按**渲染后包围盒**定。

---

## 路线图记录（已做 / 待长）

- ✅ **数据组件基座**：`Mesh3D`/`Transform3D`/`Camera3D`/`Sky3D`（主程）+ `Model3D`（P3D·glTF 导入）+ `Light3D`（数据化光照·sun/ambient）+ `Post3D`（移轴/泛光后处理）——**P3D 已把光照 + 后处理数据化超额做出**。
- ⏳ **W1 高效低开销**（实例化 + 零浪费 + 静态跳渲）= 当前主线（见上）。
- 🔭 **待长**：可旋转交互（输入→`Camera3D.yaw/pitch`·render-only）；玩法（owner 解冻后）；UI↔世界锚（把世界特效锚到 UI 元素屏幕位·需要时一个通用 seam·别每游戏手写）。

## REQ-3D-PBR-IBL PBR 金属需环境贴图（无 IBL 纯金属发黑） · [2026-06-29] · PI → P3D（3D 渲染线·材质域） · status: **✅ done（P3D 2026-06-30·TA Phase5 IBL·Sky3D.env）** · 类型: 渲染正确性（PBR 金属可读性）

> **现象**：`Material3D` 的金属预设（`gold`/`steel`/`copper`·metalness:1）渲出来**发黑**——建 game-i「PBR 材质」展台时实测：纯金属盒几乎全黑，只有直接镜面高光一点。
> **根因**：`MeshStandardMaterial` metalness=1 **没有漫反射**，全靠**反射环境**。渲染器没设 `scene.environment`（无 IBL/PMREM env map）→ 金属反射的是黑色 → 发黑。介电材质（木/岩/玻璃/自发光）不受影响、渲得对。
> **建议**（P3D 定夺）：用 `PMREMGenerator` 从 **Sky3D 程序天空**生成一张 env map 设 `scene.environment`（盒庭天空当 IBL 源）——金属即反射天色、显出金属光泽；天变则重生成（脏标）。一处加、所有 PBR 金属受益。
> **展示台侧已绕**（不等修）：金属用 `Material3D` 的 `metalness` 覆盖压到 ~0.4 让基色显出来（合法数据·展台可读）；P3D 补 IBL 后即可回纯预设（metalness:1 显真金属反射）。
>
> **✅ P3D 已交付（2026-06-30·同日）**：`Sky3D.env?:number` 开 IBL（RoomEnvironment→PMREM→scene.environment）。展台 game-i 材质场景已用 `env:1` + 回退纯金属预设（去掉 metalness 绕法）→ 金属正确反射环境。结案。

---

## REQ-3D-骰盅 · 对决 3D 骰子（各自掷战力骰·两骰在牌下旋转） · [2026-07-02] · game-g（主程/Lead session）→ P3D（3D 渲染线） · status: **✅ P3D 评审收编（2026-07-04·裁决见下）** · 类型: 表现增强（owner 点名要 3D）

> **★ P3D 裁决（2026-07-04·评审 `game-g/clash-dice-3d.ts`）**：
> - **(a) 收编游戏层版为正解 ✅**：`clash-dice-3d.ts` 是**范本级数据驱动**——零渲染器改动、纯 ECS 数据声明（Transform3D/Mesh3D box+dieFaces/Vfx3D/Anim3D/Camera3D/Light3D/Sky3D）由公有 `ThreeRenderer` 解释、用 Anim3D 底座翻滚、headless 回退 emoji、全 render-only 不进 hash。守住了 owner「必须用底座别绕规则」。照用。
> - **UI↔世界锚 seam：暂不下沉 ⏸**（YAGNI）：game-g 的「量锚点 rect + 覆 fixed canvas」是为**其战斗屏 innerHTML 重建 + zoom 裁剪**这一 game-g 专属约束做的 plumbing，非通用 3D 需求；单一消费者 → 不够格下沉成 P3D 通用件。**有第二个同需求消费者再评**。现游戏层覆层照用。
> - **P18「摇骰手感」pulse：真缺口·已下沉 ✅**（`baa`→本次）：根因=`Anim3DSystem` 同 field 多通道**相互覆盖(clobber)** → game-g 只能靠**游戏层 rAF 逐帧改 spin.rate**（绕基座 bypass）。修法**照 CORE RULE 首选「重组现有原语」**：让**同 field 通道叠加(compose)** → `spin(rotY)+bob(rotY)` = 变速自转（加速→减速）纯数据可表达。已实现 `renderer/three/anim3d.ts`（异 field 单通道结果不变·向后兼容）+ 测试 + 回填 `playbooks/3d.md`。**→ game-g 可删 `clash-dice-3d.ts` 的 rAF pulse 循环，改在 Anim3D 加 bob(rotX/rotY) 通道达同效**（game-g 域·你改；我不碰你文件）。
> - **骰面 [1,power]>6 的映射**：game-g 用 `dieFaces[].src` 程序化数字面贴任意点数——**正解**（比 6 面 pip 更忠实战力值）·无异议。

> **⚠ 更新 [2026-07-03·程序B/game-g]**：owner 2026-07-03 当面反复点名要程序B（game-g session）**当场把 3D 骰加进去**（「必须得用我们的底座和 3D 基础去做，不要绕过我的规则」「里面有个 3D 色子旋转的地方，你帮我加进去」）——**晚于本单 07-02 的「转 P3D」路由**，owner 直接指令优先。已交**游戏层数据驱动版**（`src/games/game-g/clash-dice-3d.ts`）：
> - **零 P3D 文件改动**：只在 game 层声明 ECS 数据（`Transform3D`/`Mesh3D` box+dieFaces 数字骰面/`Vfx3D` 能量注入粒子/`Camera3D`/`Light3D`/`Sky3D`.env），由公有 `ThreeRenderer` 解释渲染——与 `game-d` Title 大骰同一条路子（game 层 new ThreeRenderer + createEntity/addComponent，不碰 three-renderer.ts）。**非 CSS 3D**（守数据驱动铁律 + 避战斗 zoom 画框放大 bug）。
> - **UI↔世界锚 seam**（本单 §集成难点点名的那个）：`mountTurnBattle.syncDice3D` 量 `#clash-die3d-m/f` 锚点屏幕 rect → 各覆一张 `position:fixed` canvas（逃 innerHTML 重建 + zoom 裁剪）。three 走**动态 import**（600KB 只在首次掷命拉·不压 game-g 首屏）；无 WebGL(headless)→ 回退 🎲 emoji 占位（测试绿）。双骰绕 X/Y 缓转 + 粒子上涌；掷值仍由 `clash-die-m/f` 文本显（3D 骰纯装饰旋转·不落特定面）。
> - **请 P3D 定夺**：(a) 认可这版游戏层覆层照用；或 (b) 把「UI↔世界锚 seam」下沉成 P3D 域通用能力（路线图「待长」项）、game-g 改消费那个通用件。当前已全绿上线（tsc+vitest+build），owner 要的「掷骰爽感」先满足；收编与否由你（P3D）评审。


> **owner 2026-07-02 原话**：「能不能做成 3D？因为我们 3D 引擎也有了嘛，你把这两个色子做成 3D 模型在那里旋转。」——game-g 对决「各自掷战力骰」的两颗骰子，希望做成 **3D 模型在对决画面旋转**。
> **边界**：3D 渲染（three-renderer / Mesh3D·Model3D / 3D 场景集成）是 P3D 独占域，game-g session 不擅入 → 按 §0.1 转工单给你评审/落地。sim/数据侧（掷值 rollA/rollB、战力范围）已是纯数据、现成可读。
>
> **现状（game-g 已铺好的 2D 过渡版 + 挂载锚点）**：
> - 对决特写（`turn-battle-screen.ts` `clashNode`）已把两颗骰子摆在**两张牌正下方**的 `clash-dicewrap` 面板里；每颗骰一列 `clash-diecol-m/f`：
>   - `clash-die3d-m` / `clash-die3d-f` = 🎲 **emoji 占位·即 3D 骰挂载锚点**（你把 3D 骰塞这两个屏幕位）。
>   - `clash-die-m` / `clash-die-f` = 掷值数字（驱动层 `game-g.tsx doClashRoll` 就地哒哒哒滚到掷值）。
> - 掷值数据：`ClashEvent.rollA`（我方掷值）/`rollB`（敌方掷值）、范围 = `a.pEff`/`b.pEff`（即 `[1,战力]` 上限）。我方=暖橙 `mine`、敌方=冷蓝 `foe`。
>
> **诉求（P3D 定夺实现）**：
> 1. 两颗 3D 骰（`Mesh3D` box 六面点数贴图 / 或导入 `Model3D` 骰模型），在 `clash-die3d-m/f` 两个屏幕位各自旋转。
> 2. 「掷」时旋转翻滚 → 落定停在**该骰掷出的点数面**（掷值来自 rollA/rollB；>6 的战力骰如何映射到 6 面骰的视觉——是显数字面还是多骰/自定义面，请你定，或回驳建议改表现）。
> 3. 我方橙 / 敌方蓝 区分；纯表现、**不进 hash**（determinism 红线：新 render-only 组件登记 `NON_DETERMINISTIC`）。
> **集成难点（需你评估）**：game-g 战斗屏走 `renderNode + innerHTML`（2D·不跑 mountUI、无 3D 画布）。把一个 three 画布锚到 UI 元素屏幕位＝路线图里记的「UI↔世界锚」seam（你 §路线图「待长」有列）。若这个通用 seam 值得先做，这单可当它的第一个消费者。
> **可回驳**：若「6 面骰表达 [1,30] 掷值」不成立 / 集成成本过高 → 请回驳并给替代（如 2D 骰面贴图升级、或战力骰改「转盘/进度条」表现）。owner 要的是「掷骰的爽感表现」，3D 是他提的实现手段、非硬指标。

---

## REQ-3D-Vfx3D 点吸引力场（粒子跟随鼠标聚集·加减速自然） · [2026-07-03] · game-d（我·P3D 转呈）→ P3D（3D 渲染线·粒子域） · status: **✅ done（2026-07-03·已推）** · 类型: render-only 粒子能力补全（点吸引子）

> **✅ 落地（全 render-only·P3D 渲染线域）**：
> - **能力** `Vfx3D.attractor?: {x,y,z,strength}`（`render.ts`·render-only·Vfx3D 本就在 NON_DETERMINISTIC）：`VfxSystem` 每帧对每颗粒子施弹簧力 `F=strength·(target−pos)`，配**现成 `drag` 阻尼** = 阻尼弹簧 = **先加速后减速**的自然收拢（零新缓动参·合 owner「不夸张」）。力积分抽成纯函数 `integrateParticle`（半隐式 Euler·稳定不炸）便于确定性单测。
> - **输入 seam** `ThreeRenderer.screenToWorld(clientX,clientY,worldZ)`（通用 screen→world·Raycaster+Plane·透视/正交都对）：与 WorldUI3D 的世界→屏互逆（路线图「UI↔世界锚」的输入向落地）。游戏层输入胶水/世界拾取共用。
> - **消费** game-d Title：`uiHost` mousemove → `screenToWorld` unproject 到尘埃平面 → 写各 dust 发射器的 `attractor`（离场撤力）。render-only 胶水（同 autoRun/WASD 先例）。截图 before/after 验：尘埃随光标聚拢（软聚非硬吸）。
> - 测试 `vfx.test`(4·弹簧收拢到目标 / 先加速后减速 / 无 attractor 向后兼容 / attractor 不进 hash)。tsc+vitest(2196)+build 全绿。

> **owner 原话（2026-07-03）**：Title 那片氛围粒子——「**鼠标在哪，粒子就往鼠标那里去聚集、follow 我这个鼠标**；但要有个**加速度、减速度的过程，不要太夸张**」。owner 明示这条按 3D 引擎需求提给 3D 引擎（不进 `requests.md`）。
>
> **我（game-d）已先做架构评判（CORE RULE·不照单转呈）——判定=真缺口·建议接受下沉**：
> - **能用现有 `Vfx3D` 字段重组表达吗？** 不能。现有 `Vfx3D` 有 `shape`/`gravity`/`drag`/`sizeCurve`/`colorGradient`/`blend`——`gravity` 是**全局常向量**、不是指向某动点的**点力**；`drag` 只给全局阻尼、没有把粒子拉向目标点的力。「向一个移动的点聚拢」现有字段表达不了。
> - **已被覆盖/功能等价？** 否，无任何点吸引子/磁吸语义。
> - **真缺口 → 下沉成通用能力**：`Vfx3D.attractor?: { x:number; y:number; z:number; strength:number }`（世界坐标点 + 力强）。每帧对每颗粒子施 `a += strength * normalize(target - pos)`（或按距离衰减的弹簧力 `strength * (target - pos)`）；**加减速天然来自「弹簧力 + 现有 `drag` 阻尼」**——趋近时力小、`drag` 拖尾 → 自动缓入缓出，正是 owner 要的「不夸张」的加速/减速，**零新缓动参数**。`strength=0`/`attractor` 缺省 = 现行为（向后兼容）。
> - **弱 LLM 尺子**：接受——只填 4 个数（x/y/z/strength）·填不了自由力场代码。**render-only**：`attractor` 是表现字段，`Vfx3D` 本就 render-only；须确保**不进 sim/hash**（determinism 红线·`Vfx3D` 应已在 `NON_DETERMINISTIC`·加字段不改归属）。
>
> **诉求（P3D 定夺实现）**：
> 1. `Vfx3D` 加可选 `attractor{x,y,z,strength}`，粒子积分里加点力项（弹簧力 + 复用现有 `drag` 阻尼 = 自然加减速）。登记/文档同步。
> 2. **鼠标屏坐标 → 世界坐标的接线（screen→world unproject）**：game-d 每帧把光标 unproject 到粒子所在平面、写进 `attractor.x/y/z`。这段是**运行时胶水**（同 game-z `autoRun`/WASD 胶水、game-g `syncDice3D` 先例·game 层可自理）。**但**：这与你路线图「待长」里记的「UI↔世界锚 seam」是**互逆的一对**（那条是 world→screen，这条是 screen→world 输入）——**请你定夺**：(a) 输入 unproject 就让 game-d 用现成相机 API 自己接；或 (b) 值得沉一个 P3D 域通用「屏↔世界」输入 seam（game-d 当第一个消费者）。
> 3. 纯表现、加减速由物理（弹簧+阻尼）自然给出，**不加夸张的吸附/弹射**（owner「不要太夸张」）。
>
> **可回驳**：若你认为点吸引子该并进未来更通用的「力场（force field·点/线/风场）」一起设计、或 unproject 该走别的 seam → 请回驳并给替代。owner 要的是「粒子温柔地跟手聚拢」，`attractor` 是我判的最小充分手段、非硬指标。

## REQ-3D-交互与材质补全批 · 对象拾取/图元/BlendSpace/贴图槽/HDRI 五件 + Tier3 不做清单固化 · [2026-07-03] · owner 提需 → 主程逐条裁决 → P3D · status: **①②④⑤ ✅ Lead 验收通过（2026-07-04·判决见下·偏离全裁）；③ 待拉动（角色步态成熟时开工）** · 类型: 3D 线能力补全（Lead 图纸）

> **P3D 完工回执（2026-07-04·请 Lead review）**——逐件全绿（tsc+vitest+build）、同提交回填 `docs/playbooks/3d.md`：
> - **①拾取**（`d33ad0b4`）：`Pickable3D` + `ThreeRenderer.pick(x,y)` + 纯函数 `rayAabbT`（6 无头测试）+ game-z 点选 HUD 自证。**两处偏离图纸请裁**：(a) 组件字段用 `signal`/`hover`（非图纸 `pickSignal`/`hoverSignal`·也未加 `enabled?`/`layer?`——无消费者·YAGNI）；(b) 射线对**世界 AABB 包围盒**求交（非逐三角 Mesh3D 几何）——换来**纯函数可无头测**且不依赖网格几何/WebGL，遮挡取最近盒。要精确到网格或改字段名我照办。hover 字段留了、发射待游戏在 pointermove 调 pick（demo 只做 click）。真浏览器点选自证待截图环境恢复。
> - **②图元**（`c77bbc08`）：`Mesh3D.shape` +cylinder/cone/capsule/torus（+torus `tube`）·单一 `roundGeo()` 工厂三路共用·批签名/深度扩档（球保持 height 无关）·碰撞体未动（遵裁决）·game-z 南侧四图元展示·纯函数测。
> - **④贴图槽**（`1c70a299`）：`Material3D`+`MaterialSpec` 加 `metalnessMap/emissiveMap/ormMap`+`tiling{repeat,offset}`；ORM 挂三槽·emissiveMap 置白基·tiling 进纹理+缓存键·pbrSig 纳入·跨界 asset-index（请一并 review）·game-z plank tiling 自证。**metal/emissive/orm 真图 demo 待 ORM 贴图资产**（槽已通·sig/catalog 已测）。
> - **⑤HDRI**（`fc2b56f4`）：`Sky3D.envMap`（图纸说「env 接 assetKey」→ 我判 env 保持强度语义·**新加 envMap 字段**接 .hdr key·更兼容·请认可）；HDRLoader.parse→PMREM→environment·缺省/未就绪/失败回退程序化影室·容错不崩。**渲染 WebGL 无法无头测**·真 HDRI 视觉 demo 待 ≤2k .hdr 资产（导入线 .hdr 识别=asset-manager 侧后续）。
> - **③BlendSpace**：按裁决「有真角色步态需求拉动时」开工·当前未拉动 → 未做（game-z 角色/追兵骨骼线成熟后接）。

> **Lead review 判决（2026-07-04·对抗性复核 4 个 diff + 独立复跑门禁全绿·偏差按三分法裁）**：**REVIEW: PASS**
> - **①(a) 字段名 signal/hover·省 enabled/layer** → INTENTIONAL·**接受**（组件命名空间内短名更干净；enabled/layer 无消费者=YAGNI，闭集加档随真需求）。
> - **①(b) AABB 求交（非逐三角）** → INTENTIONAL·**接受**（纯函数无头可测 > 精确度·盒庭图元场景够用）。边界记录：旋转体的世界 AABB 过覆盖（可点中「空角」）；精确网格拾取=将来真需求再开单。
> - **① determinism.ts 登记行** → 合规（handoff §0.1:37/76 明文授权 NON_DETERMINISTIC 加行·非越域）。
> - **④ asset-index 跨界** → **接受**（闭集 schema 扩展照图纸三槽·跟 roughnessMap/aoMap 先例同款·有测试·自曝请审姿势正确）。
> - **⑤ envMap 新字段（非复用 env）** → **图纸错误·P3D 修正正确**（`env` 既有语义=IBL 强度数字，图纸「env 接 assetKey」会砸兼容——记 spec 方失误，OUT-OF-SCOPE 类偏差回改图纸认定）。
> - **残项（不阻塞·MANUAL CHECK 池）**：ⅰ 真浏览器点选自证（P3D 待截图环境）；ⅱ hover 发射待 pointermove 消费者；ⅲ 真 ORM/emissive/HDRI 视觉 demo 待资产（asset-manager 线·.hdr 导入识别一并）；ⅳ pick→`enqueueAction`→sim 全链路尚无游戏 exercise（手册铁路径已写死·首个消费游戏接线时验）。

> owner 2026-07-03 提三档清单，主程逐条裁决如下（查重已做：接池内既有 seam/裁决，不重造）。
>
> **Tier1-① 对象拾取 Pickable3D（P0·最优先）**：✅ 接受。
> - 架构裁决：**照 2D `t2-clickable` 先例做 3D 对等件**——拾取属**输入层**（与鼠标点击同类外源输入，本地 raycast 合法，不碰 sim 确定性）；命中结果走既有 Signal 机制（`pickSignal`/`hoverSignal` 带实体 id arg）入队，sim 逻辑照常消费信号。
> - 实现：**扩展既有 seam `ThreeRenderer.screenToWorld`**（本池 UI↔世界锚条目已建 Raycaster 平面版）→ 对象级：射线对全部 `Pickable3D` 实体的 Mesh3D 求交，**最近命中优先**（遮挡序确定）。新组件 `Pickable3D{enabled?, layer?, pickSignal?, hoverSignal?}` 入闭集 component-map；describe/examples 达 registry 水准。hover 节流（每帧一次求交，命中变化才发信号）。
> **Tier1-② 渲染图元补全（P0·小活）**：✅ 接受。`Mesh3D.shape` 枚举加 cylinder/cone/capsule/torus（three 内建 Geometry 直映射，`geometry.ts` 加档；参数可选字段+合理默认）。**边界注意**：这是 render-only 视觉图元；**碰撞体维持池内既有裁决**（A 档 sphere/AABB/capsule·cylinder 碰撞≈capsule 等价已回驳），勿为新图元开碰撞档。
> **Tier2-③ 动画状态机/BlendSpace（P1）**：✅ 接受=**路线图"待续①"转正**（Godot AnimationTree 思路做成数据）。`AnimState3D{states:{名:{clip,speed?}}, blendParam:'speed'等, transitions}`——纯数据，混合权重由参数驱动。**开工时机：有真角色步态需求拉动时**（game-z 角色/追兵骨骼线成熟后），排 Tier1 之后。
> **Tier2-④ 材质贴图槽补齐（P1）**：✅ 接受。`Material3D` 加 `metalnessMap/emissiveMap(+emissiveIntensity)/ormMap`（ORM 打包图一图三通道 R=AO/G=Roughness/B=Metalness，three 三槽共享同图）+ `tiling{repeat,offset}`。资产侧配合：ORM/法线类 colorSpace=linear（asset-index spec 元数据字段已有，asset-manager 线知会）。
> **Tier2-⑤ 真环境贴图导入（P1·小活）**：✅ 接受=**REQ-3D-PBR-IBL（已✅）的资产入口扩展**：`Sky3D.env` 接受 assetKey（equirect .hdr/.exr 经 RGBELoader+PMREM）；资产导入线支持 .hdr（**包体预算：≤2k 分辨率提示**，掌机 cartridge 顾虑）；程序化天空盒保留为无资产 fallback。
> **Tier3 不做清单（owner 2026-07-03 YAGNI 判决·固化防自作主张）**：⛔ 视锥/遮挡剔除+LOD（场景规模未到·W1-E 域）、point/spot 阴影、真 DoF/vignette/SSR、NPR 描边（本池已有 ⏸ 条目·待法线缓冲版）。需求变化时 owner 重开，任何 session 勿擅启。
>
> 通用要求：逐件独立提交全绿（tsc+vitest+build）；新组件入闭集+registry describe；**每件落地同提交回填 `docs/playbooks/3d.md`**（手册铁律）；拾取件加无头测试（ray 求交纯函数部分）+ 真浏览器点选自证。完工逐件标 ✅。

## REQ-3D-像素断言 · shoot-game.mjs 从人审升级为机器断言（TGS 吸收 C 件·owner 2026-07-06 批） · [2026-07-07] · Lead 图纸 → **指派：P3D** · status: open（排 P3D 队·**7·29 冲刺后再动**——REQ-DEMO-0729 队列重排） · 优先级: P2 · 类型: 3D QA 基建

> **背景**：`docs/design/art-pipeline-vision-2026-07.md §八` 对照裁决——canvas 像素级 QA 是 TGS 四道门里我们缺的一道；现 `scripts/shoot-game.mjs` 截图只能人审，判定不进机器。
> **spec（Lead 图纸）**：
> 1. `scripts/shoot-game.mjs` 截图后读像素做三断言：**非黑占比**（渲染真出画·防黑屏假绿）、**对比度**（亮度直方图动态范围·防糊成一团）、**帧活动**（间隔两帧 diff 非零·防冻结假活）。
> 2. 阈值：先对存量 3D 场景（game-z + game-i three3d 展台各块）跑标定，取实测分布定草案值（标「草案·标定数据见本单回执」），**绝不拍脑袋写死**。
> 3. 判词 token `PIXELQA: PASS|FAIL` + 退出码（照 docs-ref-guard 模式）；FAIL 点名哪条断言 + 实测值 vs 阈值。
> 4. **先独立命令跑稳（全量并发下连过 3 次）再议进门禁**——吸取 flow-walk flaky 教训，不许一步塞进推送门禁。
> 5. 同提交回填 `docs/playbooks/3d.md` 一行 + `docs/playbooks/testing.md` 对拍行更新；证据挂 `docs/playbooks/visual-scorecard.md` 维 8（性能证据）。
> 6. 门禁全绿直推；完工标 ✅ 待 Lead 验收（我会拿一个故意黑屏/冻结的场景做红测）。

## REQ-3D-世界空间 UI 表达 · WorldUI3D 超越飘字（owner 2026-07-07「3D UI 表达·两者都要」） · [2026-07-14] · 提出：UI/game-i session → P3D · status: **✅ #1#2 done（P3D 2026-07-14）；#3 diegetic ✅ done（P3D 2026-07-15·消费方=展示台·CSS3D 路线）** · 优先级: P2 · 类型: 3D UI 能力

> **#3 diegetic 落地（P3D 2026-07-15·owner 点名 + 消费方=contents 展示台 → 解除"暂缓待消费者"）**：新组件 `Diegetic3D{node,pxWidth,pxHeight,worldWidth,worldHeight,bg}`。
> **实现选型经一次纠偏**：先按 owner 原话「LayoutNode→贴图→材质」走 foreignObject 栅格路线（26949c25）——**game-z 截图实证在 Chromium 渲空白**（浏览器安全限制·SVG foreignObject 画进 canvas 仅 Firefox 可用）。改用 **CSS3DRenderer 真 DOM 面片**（c5323dd9）：CSS3DObject 定位 Transform3D·同相机投影·文字锐利 Chromium 稳（截图实证渲出标题+进度条）。**代价**：DOM 叠层不进 WebGL 深度→不被遮挡/不吃后处理（适合"给人看的"面板·非需遮挡场景）。若日后要"可被遮挡的真贴图 diegetic"→ 需引擎为 LayoutNode 子集写 Canvas2D 解释器（另立单）。

> **★ P3D 裁决（2026-07-14·按 manifesto 尺子·能重组则重组·真缺口才下沉）**：
> - **#1 世界空间面板 + #2 屏幕锚定跟随单位 = ✅ 重组（不新建 Panel3D）**：`WorldUiLayer` 本就做「世界锚点→屏幕投影→挂 LayoutNode→随实体每帧跟随→背相机/出屏自动隐」——**#2 的机制已在**，#1 的「billboard 面板」也正是这条路。唯一缺口=`WorldUI3D` 只吃单 `text`。→ **加 `WorldUI3D.node?: LayoutNode`**（富内容·面板/血条 ProgressBar/名牌/多行·仍走 UI 库·UI 铁律），`text` 保留为简写。一处小扩展覆盖 #1+#2。**不新建 `Panel3D`**（会与 WorldUI3D 重复）。demo：game-z 狐狸名牌（Label+ProgressBar·随奔跑跟随）。测试 + 回填手册。全绿。
> - **#3 diegetic UI（UI 贴到 3D 面片·透视正确·可遮挡）= 真缺口·暂缓**：这是**另一条渲染路**（`LayoutNode→CanvasTexture→Material3D.map`），非 WorldUI3D 的屏幕叠层 billboard 能重组。**难点**：现 UI 库渲成 **DOM**，要上 Mesh3D 面片需把 DOM 光栅化成 canvas 纹理（html2canvas 级·重且不完美）或另造**canvas 版 LayoutNode 渲染器**——工程量大。**当前无具名消费者**（无游戏要控制台屏/桌上卡牌）→ 按 YAGNI **暂不造**，记设计待真需求拉动（那时评估 canvas-UI 光栅化路）。
> - **边界确认**：`WorldUI3D.node` 是 render-only 组件字段（住 render.ts·🔶 知会 Lead·type-only import LayoutNode·无运行时环）；world-ui.ts 是 P3D 域。**未越界 UI 库**（只消费 LayoutNode·不改控件闭集）。

> **背景**：owner 要「开发 3D UI 表达」，明确「两者都要」——① 2D LayoutNode 加 CSS-3D 变换（透视倾斜/景深叠层/悬停立体抬起）**已由 UI 域落地**（`LayoutConstraints.rotateX/rotateY/perspective/z/tilt3d`·game-i `t-3d` 段·见 transform3d.test）；② **世界空间 UI**=UI 面板/HUD 挂进真 3D 场景，属 P3D 独占域，本单提交 P3D 评估。
> **诉求（待 P3D 按 manifesto 评判：能否用现有 WorldUI3D 组合表达 / 真缺口才下沉）**：现 `WorldUI3D` 只有世界空间**飘字**（text/offsetY/size/glow）。商业 3D 游戏的「世界空间 UI」还含：
> 1. **世界空间面板**（3D 空间里的一块信息板/菜单·可 billboard 朝相机或固定朝向）——承载多行文字/图标/进度条，而非单行飘字。是否值得一个 `Panel3D{ layout 数据? / 贴图? }`，还是让 LayoutNode 渲成纹理贴到 Mesh3D 面片（UI-as-texture）？
> 2. **屏幕空间锚定到世界物件**（血条/名牌跟随 3D 单位、投影到屏幕叠 LayoutNode HUD）——本池 UI↔世界锚 seam（screenToWorld）是否已够，缺的是把 2D LayoutNode 定位到世界物件的屏幕投影点的桥？
> 3. **diegetic UI**（UI 是场景的一部分：控制台屏幕、卡牌摆在 3D 桌面上）——大概率 = LayoutNode→CanvasTexture→Material3D.map 的管线，值得评估。
> **边界**：这是 render-only 表现层（不进 sim/hash）。**不预设做法**——P3D 评估是重组现有能力还是下沉新组件；若下沉，闭集数据+registry describe+回填 `docs/playbooks/3d.md`（手册铁律）。owner 无 deadline，排 P3D 队自主定档。

## REQ-3D-震屏首见基线 · CameraShake 装载首帧白震一次 · [2026-07-15] · Lead 验收超休闲六连批时发现 → **指派：P3D** · status: **✅ done（P3D 2026-07-15）·连带修 flash/impulse 同类·Lead 复核 ✅（a2e161fe 修法/测试对版）** · 优先级: P2 · 类型: 小修（camera-rig.ts + 一条测试）

> **P3D 落地（2026-07-15）**：照 Lead 一行级修法落 `CameraShake.update`（首见=基线不注入）。**同类扩查**：`FlashDecay`（Post3D.flash）与 `Impulse3D`（physics·`impulseSeen` 首见 `undefined!==0` 同样自触发）是**同一 nonce 范式的孪生 bug**——一并修（各加首见基线分支）。impulse 语义定：出生初速用 `RigidBody3D.vx`·Impulse 只在 bump 时施力。三处各加钉死测试（静态 trigger 首帧不触发·bump 才触发）。game-z demo 静态带 `shake/flash:{trigger:0}` 装载不再白震/白闪。
> **Lead 复核备注（用法约定·防边角·不返工）**：首见=基线的代价——蓝图初始**不带** trigger、事件时才首次设值的话，第一次真 bump 会被当基线吞掉。约定：**要用 nonce 触发（shake/flash/impulse）的实体蓝图自带 `trigger:0` 起始**，事件 bump 到 1/2/…。孪生扩查做得好——正是该有的举一反三。

> **验收背景**：超休闲缺口批六连（手感三件套 778df8dd + Decal3D 5bb6409e + UI 三补 7c902aa0 + uvAnim f41b1b7e + Path3D 2ff1a909 + Billboard3D/tween 692024b7）Lead 对抗性验收 **✅ 全部放行**——render-only 纯净（新解释器零 world 回写·零裸 Math.random·震屏噪声=确定性 sin 合成可复现）、三个新组件 NON_DETERMINISTIC+component-map 成对登记无漏、协议扩展全 additive 闭集、件件带测试、合树 2588 测全绿。唯此一条真问题开单：
> **问题**：`CameraShake.update` 的 `lastTrigger` 初始 `undefined`——蓝图**静态带** `shake:{trigger:0,...}` 的场景，装载后第一帧 `0 !== undefined` 即注入 trauma=1 → **无事件白震一次**。语义应是「bump=变化才震」，首见值该只作基线。
> **修法（一行级）**：首见（`this.lastTrigger === undefined` 且 shake 在场）只记基线不注入：`if (this.lastTrigger === undefined) { this.lastTrigger = shake.trigger; return NO_SHAKE; }`。加一条测试钉死：静态 trigger 首帧 `active:false`、随后 bump 才震。
> **附 P3 备注（不挡·记档）**：① FollowDamper 速度估计=raw 帧差/壁钟 dt，sim tick 与渲染帧不同步时 lookAhead 速度在「阶跃/0」间抖（现被指数平滑吸收大半）——真游戏若见预读抖动，对速度也做一层平滑即可；② `camSig` 不含 `follow` 参数（改 lag 不触发重渲·收敛态视觉无差·接受）。
> **边界记录**：7c902aa0 动了 `src/ui/components/{types,render,server,catalog}.ts`（主程域）——实现合格照单全收（闭集+引擎注入 CSS+测试齐），但交验清单只报了 three*/render.ts/determinism/component-map 四处。**下回动 🔶/主程域文件请在知会里列全。**
