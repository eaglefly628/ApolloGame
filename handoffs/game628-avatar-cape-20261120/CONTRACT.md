# G628-AVATAR-CAPE · 编辑器交换契约草案 v1

状态为 proposed / blocked，待编辑器侧确认字段及共享能力 A/B 裁决。隔离落点为本目录。编辑器侧只写 `handoffs/game628-avatar-edit-20261120`，本票只写 `handoffs/game628-avatar-cape-20261120`。

## 编辑器提供给布料侧

| 字段 | 约定 |
| --- | --- |
| version | 1 |
| avatarId | 场景中角色实体 ID |
| bodyId | slim / regular / full，与已有预设 ID 同名 |
| cape.enabled | 明确试穿/脱下状态 |
| cape.tier | normal / low / off |
| root.positionMeters | 世界坐标 [x,y,z]，米 |
| root.rotation | 世界四元数 [x,y,z,w] |
| shoulders.left / right | 角色根局部 XYZ，米，经过当前动作取样及体型变换，不重复乘骨架原始缩放 |
| poseRevision | 当前渲染帧或采样序号，只作变更识别 |
| action | idle / walk / wave，共用已有角色片段 |
| actionTimeSeconds | 当前片段采样时间，秒 |

坐标采用角色前方 +Z、右手坐标和 Y-up。角色后方为 -Z。编辑器拥有体型与实时肩部挂点权威，布料消费当前帧姿态。现有模型候选挂点为 LeftUpperArm / RightUpperArm 近端，测量文件记录来源 SHA。挂点还需要编辑器/美术确认是否加披风扣局部偏移。

## 布料侧提供给编辑器

- 每个 bodyId 的 capeProfile，包含长度、宽度、两肩固定点、材质、模拟档位和代理形状。当前矩形布候选长度 0.75 m，宽度取测量肩距，pins=topCorners，plain。正式披风版型、领口和肩扣尚未验收。
- 简化身体代理以 ClothCollider3D 的 sphere / capsule 闭集表达。体型变化要重新拟合躯干和上臂并核对动作包络。运行时代理需按同一 root/poseRevision 转换，当前没有完成此项运动披风验收。
- 实时运动挂接需保持既有顶点/速度历史并更新双肩固定点。当前 Cloth3D 对 Transform3D 变化会重建，此字段交换目前只是协议草案。

## 显式预算降级

| 层级 | 数据目标 | 玩家可见行为 |
| --- | --- | --- |
| normal | medium，63 顶点 / 96 面，4 次迭代 | 正常真实模拟 |
| low | low，35 顶点 / 48 面，2 次迭代 | 保留真实模拟，减少折面精度 |
| off | 移除 Cloth3D 及该披风实例 | 明确关闭披风，并显示关闭原因 |

预检已验证 low 建立 35 顶点，以及通过增加/移除组件完成试穿实例生命周期。编辑器的手动切档及预算提示尚待 A/B 通过后消费。慢设备自动控制建议使用连续超预算样本，按 normal→low→off 单向降级，恢复由玩家明确操作，避免频繁反复重建。具体阈值需在真实披风路径上测量后确定，当前没有用窗帘耗时自动推导阈值。

## 验收输入与目标

至少 slim、full 两种体型各跑 idle / walk / wave，直行、停步和转向，试穿、脱下、再次试穿，并重放 normal→low→off。走路对照同时记录根轨迹和片段时间。

暂拟目标为肩扣误差 ≤5 mm、低速接触的粒子最大穿入 ≤10 mm、单块披风更新 p95 ≤0.75 ms。它们是目标，不是已实测承诺。三角面内部穿插还需实际渲染目击。当前只完成静止双肩固定测试和运动重建缺口复现。

肩点采样的前三种动作均只测前 1 秒的五个离散时间点，不能当作全片段最大误差或完整动作包络。后续验收应覆盖整个片段及方向切换。慢设备和 GPU 范围仍未验收。
