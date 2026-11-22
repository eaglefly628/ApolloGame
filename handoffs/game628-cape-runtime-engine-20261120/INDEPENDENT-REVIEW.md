# G628-CAPE-A-ENGINE 独立能力复查

日期为 2026-11-20。复查者为独立子代理，未参与候选实现，仅写 independent-review.test.ts、本报告及自己的 /private/tmp 副本。范围是隔离 native 布料与矩阵契约，不包含捏脸 Preview、RC、正式共享层集成或浏览器视觉签署。

已独立复跑施工用例 8 项、旧静态布料兼容用例 7 项，并加入独立用例。独立用例检查 glTF 0.0086 缩放后按物理米制取偏移、根旋转只应用一次、重复命名骨拒收、generation 和实例 UUID 更换、非法偏移/固定模式/步长及有限数溢出边界。

初轮 20/20 通过。随后补充的有限巨大世界坐标用例实红，发现 attachment 路径只检查有限值，接受 1e40 m 的锚点。该数不能装入布面 Float32；旧 validClothTransform 的 |position|≤1e6 约束在新路径未消费。施工者收紧了锚点偏移后世界位置与根位置的上限，并在统一契约标明大世界精度边界。最终独立复跑 21/21 通过，退出码 0。TypeScript 检查亦通过。最终结果包含施工者随后统一 collisionDuration 与 fixed-step 浮点容差步数的修正。

独立撤修验红在 `/private/tmp/game628-cape-negative-control-20261120` 完成。先复制候选 runtime，再将且仅将 cloth.ts 替换成 baseline/src/renderer/three/cloth.ts 的精确字节，确认旧签名锚 `JSON.stringify([structure, transform])` 恰好命中一次。基线 SHA256 为 `13f7212990195ee7a31fd562d465209fc3978d58c35f9f2d6169ae26051c4de2`。

```sh
./node_modules/.bin/vitest run --config /private/tmp/game628-cape-negative-control-20261120/vitest.config.mjs -t '90 root and shoulder updates'
```

指定的新行为测试退出码为 1，准确失败在“每帧保持同一 panel/native body”断言。完整日志保存于该临时目录 negative.log。另在相同精确基线上写独立 90 帧旧行为诊断，逐帧比较实际 scene mesh identity，实际输出 `BASELINE_REBUILD_COUNT 90`，诊断退出码为 0。

当前候选完整 90 帧计数为 initial created=1、后续 rebuild=0，最大肩扣误差约 6.35e-8 m。零时间根/肩更新用例核对自由顶点的位置、previous position 和 velocity 逐字不变。slim/full 全部 idle/walk/wave 片段均使用同一拓扑/generation 连续运行，各仅创建一次 native 布面，且实际采样了当前角色节点。

运动 capsule 接触用例在预热后记录到实际接触带的帧数，并测量了粒子相对代理的穿入。它不证明三角面内部没有穿插，也不替代披风领口、肩扣和模型的视觉拟合验收。低帧率用例验证最多四次 fixed steps，未以 Node CPU 数据代替真实 GPU/设备预算。

预期告警包括挂点缺失、重复骨、非法固定模式和瞬移撤下，均属于本轮故障用例。没有把预期撤下当作静态披风成功。正式共享施工仍须合法领域归属与远程施工锁，复查不豁免该前置。

最终核验源码指纹如下，任一实现或契约改变后需重新核对受影响证据。

| 文件 | SHA256 |
|---|---|
| runtime/src/renderer/three/cloth.ts | `3b907b1351e1d1cacd9d3326e31f5f61594cb97d33cbe23b48d6bb4a484dde1e` |
| runtime/src/renderer/three/cloth-attachments.ts | `b481814315d63e57b9858082f8b8b66eab655e53e0515ebf5d5777771c19fd39` |
| runtime/src/renderer/three/models.ts | `fca50c6f1c9994d304b888a2b24d224fcc5c908f53aa5601e32064b9144504e7` |
| runtime/src/renderer/three-renderer.ts | `31f5f1866342f2e37b860b4faad0a95e2063b217f0500b2fee85b0bc9babb12d` |
| runtime/src/engine/protocol/components/render.ts | `474149133f33498c951fb2c3a6a8ce179c2d64e13f6fb912b1b9391aad09f86f` |
| CONTRACT.json | `d4fb612b2dc0bb91e7b96496ab426004690a5851272b8617a782371501fecaf6` |

结论为隔离能力候选独立复查通过，正式共享引擎验收和编辑器实机联验保持待办。
