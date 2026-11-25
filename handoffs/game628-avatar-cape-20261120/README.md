# G628-AVATAR-CAPE · 披风接入预检

2026-11-20，布料侧隔离目录。基线为 ApolloGame `3e6569c26` 加现有未提交 Cloth3D 和编辑器候选。当前阶段为能力预检，状态为 **BLOCKED / 等待 A/B 裁决**，未完成运动披风验收。

本目录只写自己的文件。输入只读来自 `handoffs/game628-avatar-edit-20261120`，原 `18848 LOCAL-FINAL`、RC1、共享引擎及其他候选均未改动，没有推送或发布。

## 已验证

使用编辑器候选的三种原创体型 glTF 和同一共享 BIN，离线采样 idle / walk / wave 各五个时间点，记录模型 SHA、坐标、肩部运动包络。候选挂点选择 `LeftUpperArm` / `RightUpperArm` 的近端位置，供编辑器侧确认。坐标为角色根局部空间，米制、Y-up、朝前 +Z。原模型 Armature 的 0.0086 缩放已由 glTF 世界矩阵消费，禁止再次把原始骨架平移直接当作米。

真实 Jolt ClothSystem 在两种体型上运行。slim 肩距约 0.30657 m，full 约 0.42609 m。静止根位姿下，顶边两角固定误差小于 0.0001 mm，风中自由顶点最大变形约 0.268 m。这仅验证两点固定和真实布面求解，不代表已贴合身体。

试穿生命周期可通过增加/移除 Cloth3D 表达，切 low 可实际建立 35 顶点布网，移除实例会清理几何和 native body。该生命周期已经复验。慢设备低档与停用策略见 CONTRACT.md，自动预算控制尚未接到编辑器。

## 阻塞实证

共享 `src/renderer/three/cloth.ts` 把整个 Transform3D 放进结构签名。变化时 removePanel → makePanel，会重置 native 顶点及速度。在两种体型的行走/转向输入中，90 次根位姿更新各导致 90 次布面重建。

共享 `cloth-data.ts` 只提供顶边或顶角静态固定点，没有每帧肩点输入。Model3D / AnimState3D 可以播放已有角色动画，当前生产手册及本工作树没有向 Cloth3D 输出骨骼挂点的接口。Pivot3D 的现有父子变换应用于普通渲染收集路径，独立 ClothSystem 尚未消费。即使固定根不移动，离线采样中的肩点也随站立/走路/挥手改变。

所以当前无法同时兑现“肩部跟随动作、运动历史连续、方向变化响应”。这次没有以静态披风或原地走动画替代这三项验收。

## 裁决候选

| 路线 | 工作和影响面 | 选错代价 |
| --- | --- | --- |
| A · 领域负责人补通用挂点能力 | 最小范围包括可更新的固定点、保持速度/顶点历史的根运动、角色骨骼挂点输出及与运动身体代理的一致坐标。补正常入口、卸载和长帧回归后，本票只消费数据。需另行授权共享引擎施工。 | 进入共享渲染面，需要跨场景回归；若最终只需要装饰静态挂布，会多承担维护成本。 |
| B · 本作限定为离线烘焙披风动画 | 每种体型与站立/走路/挥手提供明确片段，按现有 Model3D + AnimState3D 消费。现有静态 Cloth3D 可以继续用于窗帘等场景物。 | 动态接触与转向不会任意实时响应，需要调整本票原实时披风验收，动作与体型组合增加素材成本。 |

建议 A，但本票没有共享引擎修改授权，因此仅提供缺口、实证和契约草案。方向裁决前尚无运动披风的可玩入口、验收录像或 GPU 性能结果。

## 复跑

在 ApolloGame 根目录执行，Node 和 Jolt 均使用项目已安装版本。

```sh
node handoffs/game628-avatar-cape-20261120/measure-shoulders.mjs
node_modules/.bin/vitest run --config handoffs/game628-avatar-cape-20261120/vitest.config.mjs
```

`evidence/shoulder-candidates.json` 含体型与动作采样，`evidence/preflight.json` 含诊断结果。预检测试通过表示现有行为被复现，其中运动历史连续验收明确为 false。

设备范围是本机 Node 22.22.3、CPU 原生 WASM 求解，未用浏览器绘制本候选，未测 GPU。以前窗帘 demo 的 Chrome/M5 开销不作为本披风的性能证据。

## 独立复查

复查人在临时副本独立复跑预检，并加入 Pivot 对照，共两文件六条诊断通过。slim/full 的肩点误差与 90 帧重建 90 次均被重现。把 avatar Model3D 与 cape 放入同一 Pivot3D.children 后，父根平移 2 m，披风针脚实际移动 0 m，目标位置相差 2 m。

这与 ThreeRenderer 当前先执行 cloth.sync、再构建仅供普通 Model3D/Mesh3D 使用的 pivotMap 相符。独立结论为共享能力缺口，当前数据重组无法保持运动披风历史及骨骼肩点绑定。肩点测量的输入模型/BIN SHA 与原始采样亦独立核对一致。复查日志保存在本目录 evidence/independent-*.log。
