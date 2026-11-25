# G628-CAPE-A-CLOTH · 实时披风数据与复验

**2026-11-21 当前状态：贴合修复阻塞。** 新回执见 [fit-20261121/README.md](./fit-20261121/README.md)。数值过线候选存在最大约 14–16 cm 的真实肩扣浮空，未作为贴合修订交给编辑器；原 profiles.json 保留。以下为上一阶段记录。

2026-11-20 接手。Jun 已选 A，本目录准备布料侧隔离输入，消费 Engine DEV 动态挂点隔离候选。只写本目录。18848 / LOCAL-FINAL / RC1、18851 编辑器、18847 对话与猫咖施工保持各自所有权。

## 唯一交换契约

直接引用 [Engine DEV 统一契约 v2](../game628-cape-runtime-engine-20261120/CONTRACT.json)，对照[运行时编辑器坐标说明](../game628-cape-runtime-editor-20261120/CONTRACT.md)。本目录的 fixtures 是该契约的测试输入，不另定义引擎接口。当前选择 LeftUpperArm / RightUpperArm 近端原点，沿各自归一化骨旋转的局部米制偏移为 [0,0,-0.025]。这是 Engine DEV 契约中的待拟合扣位，真实接触验证仍需检查。

旧编辑器草案 LeftShoulder / RightShoulder 是锁骨内侧原点，两肩距不同。旧骨架的 UpperArm 子节点局部位移约 12.9223 源单位，米制长度约 0.1111318 m。将这个偏移按 Shoulder 的归一化世界旋转转成米制位移，再加 Shoulder 世界原点，可以得到同一 UpperArm 近端位置。全部采样的最大换算误差约 1.53e-8 m。不可重复乘 0.0086 骨架单位缩放。

角色根局部点经当前根刚体变换转到世界。米制局部挂点偏移使用骨节点归一化旋转，Actor Model3D.scale 当前为 1。坐标为 Y-up、+Z 前、米。每帧先确定编辑器可见演员和姿态，完成模型/动画世界矩阵更新，再读取肩点与身体代理，以同一 poseRevision 更新动态布料后绘制。具体动态消费接口以 Engine DEV 实际交付为准。

## 数据

- `fixtures/slim.json` / `full.json` 读取现有角色的完整 idle、walk、wave 片段，以 60 Hz 采样。每种体型分别 598 / 85 / 285 帧，含近端肩点、锁骨原点与方向、躯干和上臂代理候选。模型与 BIN 的 SHA 记录在 summary 中。
- `profiles.json` 是待拟合的披风数据。normal 为 63 顶点 / 96 面、4 次迭代；low 为 35 顶点 / 48 面、2 次迭代；off 表示移除披风。宽度留有聚拢余量，长度 0.75 m，两个固定点消费共享肩点契约。
- 躯干和双上臂是简化胶囊代理。源数据给出角色根局部端点及半径，运行时须按同一 root pose 转到世界，再以胶囊本地 Y 轴对齐端点方向。它们仍为拟合候选，几何覆盖与穿模尚待实际动态求解和画面检查。

## 当前阶段

Engine DEV 隔离能力候选已交付并有 21/21 独立复查记录。本目录输入已重新生成，引用契约 SHA256 `d4fb612b2dc0bb91e7b96496ab426004690a5851272b8617a782371501fecaf6`。更新前确实因快照 SHA 漂移出现 1 失败 / 5 通过，日志为 `evidence/input-tests-before-refresh.log`；更新后六项输入与预算策略测试全部通过，日志为 `evidence/input-tests.log`。本轮保留同一契约，不建立另一个骨架运行时采样器。

编辑器侧 18854 已开启真实布体。本轮独立浏览器验证双体型穿脱、走停转、挥手和档位切换，截图在 evidence 中。版型接触未通过，尚无本轮浏览器 CPU/rAF/GPU 性能结果。旧预检的 90 帧重建 90 次仅作为旧路径问题证据。

当前阶段结果见 [STAGE1.md](./STAGE1.md)。真实 Jolt 双体型 normal/low 回放四项诊断通过，每组 968 帧只创建一次布体；当前代理/肩点组合的固定点穿入约 21–50 mm、三角面采样穿入约 22–49 mm，**版型接触验收未通过**。完整原始指标为 `evidence/runtime-contact.json`，独立复查为 `evidence/independent-review.json`。Node CPU 数据与浏览器/GPU 预算分开记录；原生压力回放与编辑器的布形/风配置差异在阶段说明中列明。

后续使用实际接口验证穿脱、走停转、摆动连续性、肩点误差、身体接触与 normal/low/off。CPU 更新、rAF 和 GPU 时间分别记录。测量硬件和软件渲染范围随最终浏览器证据附上。

## 复跑

在 ApolloGame 根目录运行。

```sh
node handoffs/game628-cape-runtime-cloth-20261120/prepare-inputs.mjs
node_modules/.bin/vitest run --config handoffs/game628-cape-runtime-cloth-20261120/vitest.config.mjs
```
