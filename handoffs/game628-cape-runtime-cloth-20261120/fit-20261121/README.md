# G628-CAPE-A-CLOTH · 2026-11-21 贴合修复回执

**BLOCKED_PHYSICAL_FIT。未交付可接入编辑器的贴合修订。** 本轮只写布料隔离目录，未修改共享源码、Engine DEV 冻结 runtime、编辑器、18854 服务或冻结包；未提交、推送、合并或发布。原 `../profiles.json` 与本目录 `original/profiles.json` 的字节 SHA 相同，原候选保留。

## 当前结论

已在同一冻结 Jolt 接口内联合调整挂点、代理与版型，保存 r1–r9 数据/诊断。r7 数值子门过线，但肩扣实际离开皮肤最大约 140–158 mm，不能作为贴合完成。靠近袖面的 r8 保持 UpperArm 节点，实际皮肤间隙约 34 mm，却重新出现初始重叠和运动穿入。r9 改为躯干挂点仍有约 105–158 mm 的间隙，未采纳。

不能用 r7 的 `numericGatePassed=true` 代替贴合验收。最终回放结果显式写 `releaseAccepted=false`。不要求捏脸席把浮空数据接入 18854；该服务保留既有候选。没有本轮修订的已部署浏览器验收。

## r7 · 同一数据的最终回放

候选文件 `profiles-r7.json`，SHA256：

`b350bbd3b1ea23ff585d939902bcdad351306bb99bff36bf63796fac3844b3e3`

回放直接调用冻结 `ModelPool.ensure/applyAnim/update`、`ClothSystem.sync` 和挂点采样接口。解析后的原角色夹具注入模型模板缓存，动画实现未改。idle/walk 循环、wave 一次播放并停在末帧，切换使用引擎原有 0.25 秒淡入淡出。每组 968 帧、60 Hz，walk 的第 598–682 帧平移 0.25 m/s，之后停步，第 683 帧开始以 120 帧转向 π。normal=63 顶点/96 面/4 次迭代，low=35 顶点/48 面/2 次迭代。

| 体型/档位 | 固定点最大穿入 | 自由点最大穿入 | 三角采样最大穿入 | 三角峰值时间码 | 原生接触回调/自由粒子接触数 |
|---|---:|---:|---:|---|---:|
| slim / normal | 0 mm | 0 mm | 0 mm | 全样本为零，含初始 frame 0 / idle 0 s | 71 / 163 |
| slim / low | 0 mm | 0 mm | 2.285 mm | frame 617，walk 0.316667 s，全局 10.283333 s | 54 / 82 |
| full / normal | 0 mm | 0 mm | 0 mm | 全样本为零，含初始 frame 0 / idle 0 s | 105 / 323 |
| full / low | 0 mm | 0 mm | 7.215 mm | frame 679，walk 1.350000 s，全局 11.316667 s | 102 / 256 |

固定/自由点为零时，表中 frame 0 是全样本均为零所推出的最早最大值时间，不是遗漏初始重叠。非零峰值的世界点、代理 ID、三角编号和重心权重见 `evidence/profiles-r7-pool-results.json`。

在 `makePanel` 返回时直接捕获原生顶点、**尚未进行首步求解**，核对其与冻结 `clothBuffers/clothRestPose` 完全一致并测初始穿入。随后测量每个渲染固定步结束的所有原生固定/自由点，每三角使用阶数 8 的重心网格，共 45 个含边/顶点样本；没有预热后才开始接触统计。记录的是离散实际采样最大值，不是连续三角面或求解迭代内的严格上界。

Jolt 工厂通过测试拦截保存同一模块引用，以 `SoftBodyContactListenerJS` / `SoftBodyManifold.HasContact` 核对自由粒子实际接触；未改求解器逻辑。记录具体代理 ID、接触点、法线、帧和当前动画时间。监听在首步后安装，接触计数不包含第 0 步；穿入测量包含。几何“靠近代理”另列，不作为支持接触证明。

每组只创建一次布体。第 598、683、773 帧 native body ID 一致，涵盖连续 90 帧转向；全序列每帧核对同一 panel。没有以重建、瞬移整个自由布面或删除代理恢复。

## 代理与实际皮肤

固定要求检查 12 类实际网格：shirt-body、trouser-seat、head、back-hair、左右 sleeve、arm-upper、forearm、thigh。代理附着在相应实际网格骨节点的物理米制坐标，不重复乘 0.0086。slim 为 42 个、full 为 58 个，全部实际安装；未删除后脑、袖子或身体代理来取得零值。

每帧用这些网格的顶点及四阶三角重心点（含边）检查其各自对应代理，而不是任意其他代理；968 个姿态中，全部被测皮肤点覆盖率为 100%，最大未覆盖距离为 0。每帧核对缓存骨局部采样与当前真实网格变换的一致性，拒绝非有限数据。此结论限于明确列出的网格及采样点，不覆盖耳朵、面部配件、手和足部，也不宣称连续全体表体积认证。

另外采样代理 union 暴露表面，对实际闭合网格三角面求最近点并用射线奇偶判断内外。静止姿态测得 **slim 外扩最大至少 82.917 mm，full 至少 89.615 mm**，不是贴皮代理。详见 `evidence/profiles-r7-proxy-surface.json`。独立复查用四个射线方向核验两个最大点，确认该外扩不是开口网格或奇偶判断假象。

实际肩扣到皮肤的最近距离最大值：

| 体型 | 左肩最大间隙 | 右肩最大间隙 |
|---|---|---|
| slim | 139.606 mm，wave 1.883333 s / frame 796 | 141.575 mm，wave 1.516667 s / frame 774 |
| full | 157.844 mm，idle 5.316667 s / frame 319 | 155.130 mm，wave 1.450000 s / frame 770 |

该距离直接对实际三角面求得，独立世界空间复算与骨局部缓存法仅差约 5–7 nm。r7 存在真实接触，但这不能抵消挂点浮空和保守外扩。

## 基础契约与数据差异

冻结 v2 契约 SHA 为 `d4fb612b2dc0bb91e7b96496ab426004690a5851272b8617a782371501fecaf6`。本轮没有修改它，也没有建立新的引擎 API。字段结构、米制/Y-up/+Z、归一化骨旋转及有界步进规则保留。

**r7 的描述值并不等于该契约**：它把挂点节点从 UpperArm 改成 Shoulder，并使用分体型非零物理偏移。r9 使用 Spine，也未采纳。它们是有明确差异的隔离诊断，不得凭“基础契约 SHA 一致”宣称描述值兼容。r8 保留 UpperArm，但仍未过线。由于没有同时满足真实安装位置和接触的修订，不产生可部署契约更新，不修改编辑器副本。

## 开销与表达限制

最终 r7 `ClothSystem.sync` CPU p95 四组约 0.64–0.98 ms，Apple M5 / Node 22.22.3，同机负载可变。此处还包含测试原生接触监听的开销，排除动画、皮肤距离/覆盖检查，不能作生产设备预算。代理数量较原候选 3 个显著增加。未测本轮浏览器 CPU/rAF/GPU 或慢设备，不能将这些数据标为 GPU 成本。

已查冻结组件与消费代码：Cloth3D 只接受矩形 plain/pleated 的宽高、褶皱和两挂点，没有自定义静止布网/领口形状；attached ClothCollider3D 只接受 sphere/capsule 和骨局部位置，胶囊沿骨本地 Y，缺少独立局部旋转。贴近源袖面的挂点使矩形初始布网穿过身体，保守胶囊又造成外扩；本轮九版数据未同时解开这些限制。

这是当前已测方案的阻塞，**不是“现有接口在数学上无解”的证明**。若继续，应由 Engine DEV 与 PM 核对是否补可贴肩的静止布网/领口及代理局部朝向，或另给经过视觉确认的可接受挂点与代理误差范围；布料席本轮不越界修改冻结引擎。

## 复跑

从 ApolloGame 根目录运行：

```sh
node_modules/.bin/vitest run --config handoffs/game628-cape-runtime-cloth-20261120/vitest.config.mjs
FIT_PROFILE=profiles-r7.json FIT_TRI_ORDER=8 FIT_STRICT=1 node_modules/.bin/vitest run --config handoffs/game628-cape-runtime-cloth-20261120/fit-20261121/vitest.config.mjs
node handoffs/game628-cape-runtime-cloth-20261120/fit-20261121/proxy-surface-audit.mjs profiles-r7.json
FIT_PROFILE=profiles-r8.json FIT_TRI_ORDER=8 FIT_STRICT=1 node_modules/.bin/vitest run --config handoffs/game628-cape-runtime-cloth-20261120/fit-20261121/vitest.config.mjs
```

前两项应通过（6 项输入、4 项数值子门）；最后一项是预期失败的贴近袖面压力对照，不能作为产品贴合通过。最终冻结源码、候选和测量文件哈希集中在 `MANIFEST.json`。独立复查证据仅由复查人写入 evidence。

## 最终独立复查

`evidence/independent-final-physical-fit-review.json` 已完成，结论同为 **BLOCKED_PHYSICAL_FIT / releaseAccepted=false**。复查人独立重跑 r7 四组，核对 profile/harness/冻结源码相同 SHA，额外逐帧断言 native BodyID 不变；确认初始原生位置捕获、12 类网格各 968 姿态覆盖与实际 HasContact。r8 full/low 在当前实际 ModelPool 下，保留完全相同的 58 个代理，严格负对照按目标退出 1：固定点 60.993 mm、自由点 95.130 mm、三角采样 103.891 mm。两侧节点/偏移数据锚点恰好命中 2 项，失败来自穿入断言，没有崩溃或删除碰撞代理。
