# G628-CAPE-A-ENGINE 隔离候选

2026-11-20，owner 已选择披风 A 并指定 Engine DEV 负责本票。交付为冻结的渲染引擎候选、基线受 SHA 约束的五文件补丁、统一交换契约及原生 Jolt 验证。当前阶段为隔离能力复查通过，等待 PM 联验和合法共享锁。本轮没有并入捏脸预览，也没有改变任何现有服务、RC、编辑器、店主对话或猫咖成果。

三线共同入口为 [CONTRACT.json](CONTRACT.json)，版本 2。它明确选择 `LeftUpperArm / RightUpperArm`，初始扣点偏移 `[0,0,-0.025]` 米。原编辑器的 `LeftShoulder / RightShoulder` 草案不再与本候选混用。原两份在途契约未被覆盖，PM 联验时以本票 v2 协调消费。25mm 后移是待拟合的扣点候选，尚无视觉贴合验收。

| 入口 | 内容 |
|---|---|
| `runtime/src/renderer/three-renderer.ts` | 正常 ThreeRenderer 路径，模型放置/Pivot 与 AnimationMixer 更新之后消费布料 |
| `ModelPool.clothSources(seen)` | 仅输出本帧可见、已实例化的角色对象，卸载/未就绪角色不继续提供旧挂点 |
| `ClothSystem.sync(scene,world,now,sources)` | 新的可选第四参是只读角色渲染实例映射；旧静态布调用兼容 |
| `runtime/src/renderer/three/cloth-attachments.ts` | 骨节点唯一性检查、物理米偏移、根局部/世界坐标转换与初始布面朝向 |
| `Cloth3D.attachment` | 明确角色 ID、generation、左右节点和米制偏移、maxStepMeters；只支持双顶角动态固定 |
| `ClothCollider3D.attachment` | 从同一动画实例读取 node 和 offsetM，复用现有 sphere/capsule 运动代理 |
| `ClothSystem.diagnostics()` | 创建、移除、步数、长帧裁剪和挂点拒收计数，供验收与调试 |

这是既有 render-only `Cloth3D / ClothCollider3D` 的字段与渲染消费扩展，没有新增模拟 Tier capability ID。它们已有 NON_DETERMINISTIC 归类保持。布体、速度、历史和 Three 对象仅存渲染侧，不写入模拟状态或哈希。

坐标始终是米制、右手系、Y-up、角色朝前 +Z。glTF 层级已经消费骨架原始 0.0086 缩放，采样骨世界位置后只用归一化骨旋转应用 offsetM，偏移不再乘该缩放。返回的 rootLocalLeft/rootLocalRight 用根刚体矩阵的逆计算。物理解算和布料网格使用世界空间，网格对象保持 identity；角色根移动不再对整个布面重复施加变换。顶点 0 绑定右肩，顶边末列绑定左肩，与当前模型的解剖节点名一致。

以下数据仅展示引擎接口，接入时 avatarId 使用场景的真实角色实体 ID。

```json
{
  "Cloth3D": {
    "width": 0.31, "height": 0.75, "quality": "medium", "iterations": 4,
    "style": "plain", "pins": "topCorners",
    "attachment": {
      "avatarId": "avatar", "generation": 0,
      "left": {"node": "LeftUpperArm", "offsetM": [0,0,-0.025]},
      "right": {"node": "RightUpperArm", "offsetM": [0,0,-0.025]},
      "maxStepMeters": 0.25
    }
  }
}
```

上例宽度是示例，正式消费需按已选体型配置肩宽。角色根、动作和姿态由现有角色表现入口驱动；布料侧不再另外运行一套角色动画。attachment 模式忽略披风实体自身的 Transform3D 位姿，挂点和根以实际角色实例为准；静态布保留原 Transform3D 重挂行为。不要同时用披风 Transform3D 给已采样的世界肩点再加角色根偏移。

连续移动与动作切换只更新两个零质量顶点，保持原 native body、自由顶点、mPreviousPosition 和 mVelocity。固定点按有限子步插值。代理形状不变时使用 MoveKinematic，形状/尺寸改变才重建代理。normal→low 是明确拓扑切换，允许一次布体重建；off 移除 Cloth3D 并释放 native 和几何。数据没有自动性能档位选择器。

挂点缺失、同名骨不唯一、角色未加载/卸载、非法偏移、根或肩点非有限或越出 ±1e6m 时撤下布面；下一个有效帧重建一次。角色实例 UUID 或显式 generation 变化也受控重建。若单帧任一肩点移动超过 maxStepMeters，先撤下，再从有效的新姿态恢复。突变恢复会丢弃旧模拟历史，连续动作路径才承诺历史保持。默认 0.25m 限值意味着某些瞬间大角度转身也会触发这一保护，联验需按动作包络决定合适上限，合法最大值为 2m。

长帧最多执行四个 1/60s 子步，超额时间丢弃并计入 clampedFrames，不做无界追帧。运动代理的插值时长使用同一个 stepCount，避免浮点边界导致代理比布料多前进一子步。世界上限沿用已有布料安全界限，毫米误差数据仅适用于本轮近原点测试场景。

验证结果如下，原始结果在 `evidence/runtime-results.json`，独立记录见 [INDEPENDENT-REVIEW.md](INDEPENDENT-REVIEW.md)。

| 验证 | 结果 |
|---|---|
| 施工与旧静态布回归 | 8 个施工用例、7 个既有 ClothSystem 用例通过 |
| 独立对抗复查 | 6 项通过，含重复骨、米制偏移/缩放、generation、卸载和巨大有限坐标拒收 |
| 最终组合 | 21/21 通过，TypeScript 检查通过 |
| 90 帧重建对照 | 旧基线完整 90 帧重建 90 次，候选 0 次；旧版替换后新历史用例实红 |
| 历史保留 | 零时间挂点/根更新前后，自由顶点的位置、上一位置、速度逐项一致 |
| 两种真实体型全片段 | slim/full 各连续 idle→walk→wave，30Hz 共采样每种体型 486 帧；每种体型全程只建一个布体 |
| 肩点和坐标 | 本轮采样肩点误差约 6e-8m，根局部/世界往返误差低于 1e-8m |
| 原生代理接触 | 独立运动胶囊案例记录 180 帧粒子近接触，最大粒子穿入为 0；这不是三角面无穿插结论 |
| 长帧 | 1 秒间隔仅执行至多 4 步，native 布体和运动代理保持同一实例 |
| 补丁闭环 | 独立临时基线副本执行正向检查、应用、反向检查，五个候选文件 SHA 一致；见 PATCH-VERIFY.json |

设备证据来自本机 Node 与已安装的 Jolt 1.1.1 WASM，单线程 CPU。耗时样本只在原始报告记录，不用作 GPU 或慢设备预算承诺。尚未做真实披风浏览器绘制、编辑器联验、任意快速转身、三角面与身体穿插或正式共享引擎全量验收。

复跑从 ApolloGame 根目录执行。

```sh
./node_modules/.bin/vitest run --config handoffs/game628-cape-runtime-engine-20261120/vitest.config.mjs
./node_modules/.bin/tsc -p handoffs/game628-cape-runtime-engine-20261120/tsconfig.json --noEmit
```

可依赖的冻结实现位于本目录 `runtime/src`。在自己的临时消费副本中，把 engineAliases 的 engineRoot 指向本目录 runtime，就能使用该 renderer；复用这里的 vitest.config.mjs 可核对解析方法。实际消费仍需要正常角色 Model3D / AnimState3D 与已有布料渲染场景。本票没有独立捏脸服务入口，也没有对既有端口做热替换。

补丁为 `engine-candidate.patch`，基线与候选逐文件 SHA 见 `PATCH-MANIFEST.json`。基线包含未提交 Cloth3D 实现，不能只凭 git HEAD `3e6569c26` 判断相同。独立消费副本的每个现有文件必须先匹配 baseSha256，新文件路径必须为空，然后才检查并应用补丁。任一 SHA 不符就停止应用，交由领域负责人对齐差异；不要对共享树强套补丁。原安装依赖、三种体型及 BIN 的校验信息见 baseline.json 和 fixture-sha.json。

回退时先移除使用 attachment 的披风实例，再在同一隔离副本以 candidateSha256 核对后反向应用补丁。SHA 不符或夹有他人变更时停止回退。不要将带 attachment 的数据喂给旧版解释器，因为旧版会忽略新挂点契约。

归属与待批项按 [WORK-ORDER.md](WORK-ORDER.md) 记录。three 渲染面属于 P3D，render.ts 是 P3D/LEAD 共享面。CLAUDE.md 要求正式共享施工先推远程施工锁，本次明确禁止 push，故本票未修改共享源码、未占远程锁、未提交/合并/发布。正式进入目标主干需合法锁及领域接入确认，随后对齐未提交基线、跑正式门禁，由 PM 联合编辑器线和披风线验收。owner 的 A 判词已经记录，不需要重新选择 A/B。
