# Review 单 · REQ-MOTION-M1 · 一库多 Skin：同名骨骼、不同身材的动作重定向

| 项 | 内容 |
|---|---|
| 工单 | REQ-MOTION-M1（GAP-MOTION-LIB 的 M1；owner 2026-10-27 判 A） |
| 归属 | 🔴 引擎 render-only（`src/renderer/three/`，主程面）；施工 Claude；**复查 Codex**（复查人 ≠ 施工人） |
| 改动面 | `src/renderer/three/skeletal-clips.ts`、`src/engine/protocol/components/anim-graph.ts`、`src/renderer/three/models.ts`（一行透传）、新测试 `src/renderer/three/skeletal-retarget.test.ts`、`src/renderer/three/model-graphs.test.ts` 新用例、`docs/playbooks/3d.md` 一行 |

## 一、做了什么

- `AnimGraph3D.clips[*]` 新增可选 `retarget: 'humanoid'`（必须同时有 `asset`；其它值拒收）。**不写时行为不变**：仍走 `assertSameSkeleton` 严格同骨架。
- `bindSkeletalClip(source, clip, target, rest, retarget?)`：`'humanoid'` 时改走新函数 `retargetHumanoidClip`。
- 算法（只在绑定时算一次，产出普通 `AnimationClip`，每帧零额外开销）：
  - 共享骨 = 目标与来源同名的骨。对每帧，按层级顺序算来源各骨的**世界旋转**；目标世界旋转 = 来源世界旋转 · 来源静止世界旋转⁻¹ · 目标静止世界旋转；再换回目标局部旋转。世界空间增量使两边骨骼局部轴（roll）约定不同也正确。
  - 目标独有的中间骨（如 `UpperChest`）保持静止局部旋转并参与链计算；来源独有骨（手指等）丢弃。
  - 位移只传 `Hips`：来源相对静止的位移 → 来源父空间到世界 → 乘髋高比（目标静止髋高 / 来源静止髋高）→ 目标父空间。其它骨的位移和所有缩放轨丢弃（保持目标自己的骨长）。
  - 每次绑定打一行 `[ModelPool] decision: humanoid retarget "<clip>" · N shared bones · hip scale r · K source tracks dropped`。
- 前提（写在函数注释里）：两边静止姿态同为 T-pose、朝向一致。A-pose 对 T-pose 不在本单范围，结果会偏。

## 二、请逐条自己验

```bash
npx vitest run src/renderer/three/skeletal-retarget.test.ts src/renderer/three/model-graphs.test.ts src/renderer/three/skeletal-clips.test.ts src/engine/protocol/components/anim-graph.test.ts
node scripts/scoped-gate.mjs --run
```

| # | 测试 | 验什么 |
|---|---|---|
| 1 | `strict default is unchanged: a taller skin is still rejected without retarget` | 不写 retarget 仍拒收（`rest/bind differs`）；未知模式拒收 |
| 2 | `identical skins: retargeted pose equals the original pose` | 同骨架重定向 = 原动作（4 个时刻、17 骨世界旋转差 < 1e-5 rad，髋位置差 < 1e-5） |
| 3 | `taller skin with different bone roll: …` | 1.5 倍高 + 每骨不同 roll：世界旋转 = 来源世界 · 目标静止（< 1e-4 rad）；上臂段长度 = 0.45；段方向与来源一致；髋位移 = 1.5 × 来源；头颈距离与胸缩放不受被丢弃的轨影响 |
| 4 | `extra and missing bones: …` | 来源多手指骨、目标多 `UpperChest` 中间骨：17 骨世界旋转一致；日志「17 shared bones · hip scale 1.200 · 3 source tracks dropped」 |
| 5 | `rejects a rest pose with hips at or below the model origin` | 髋高 ≤ 0 拒收 |
| 6 | `accepts humanoid with an external asset; rejects other modes and retarget without asset` | 组件闭集校验 |
| 7 | `M1: a motion authored on a skin with different proportions is rejected strictly but plays with retarget humanoid, hip travel scaled`（model-graphs） | 真 GLTFLoader + ModelPool：严格模式拒收一次告警；加 retarget 后建出控制器、无新告警、日志 hip scale 0.500；0.5 秒时髋位置 = (0.0125, 0.475, 0) |

**施工中三处测试本身的错误（已改，如实记录）**：① 参考姿态最初直接播放含「胸部非均匀缩放」轨的来源动作，缩放使来源世界矩阵倾斜，读出的世界旋转失真；改为参考姿态只播应传递的轨（旋转 + 髋位移）。② `Quaternion.angleTo` 用 `2·acos(|dot|)`，在接近 0 时病态，会把 three.js 动画轨 float32 存储的舍入放大到 1e-4 rad 级（误差孤立出现在个别骨、不随链累积即为特征）；改用 `2·atan2(|v|, |w|)`。③ ModelPool 每步最多推进 0.1 秒，集成用例改成 0.1 秒步进。三处都不是被测代码的缺陷，被测代码未因此改动。

## 三、撤修验红（施工自证，复查人请另选锚点）

| 锚点（均断言命中 = 1） | 撤法 | 红灯 |
|---|---|---|
| `const world = sWorld.get(name)!.clone().multiply(sPose.get(name)!.worldQ.clone().invert()).multiply(pose.worldQ);` | 改为直接用来源世界旋转 | exit 1：用例 3（roll 不同时错） |
| `const ratio = tHipY / sHipY;` | 改为 `1` | exit 1：用例 3、4、7 |
| models.ts `template.rest, entry.graph.clips[alias].retarget)` | 去掉透传 | exit 1：用例 7 |

三次均恢复原文件，恢复后 91/91 通过。

## 四、性能

本机实测：300 帧 × 60 骨（17 必备 + 43 额外）一次重定向约 **36 ms**，只在 `buildGraph` 绑定时发生一次，播放期与原外部动作同成本。库大时若一次挂很多角色，可考虑缓存（同一 clip × 同一 Skin 模板），本单未做（YAGNI，待预览台实测再定）。

## 五、已知局限

- 只处理 T-pose 对 T-pose；A-pose 资产需在入库（M2）时统一。
- 极端体型（Q 版大头短手）手脚可能穿插，用 E4 IK 兜底。
- 髋部父骨若本身带动画（少见，例如有 Root 骨），父空间用静止值近似。
- **真实 Mixamo 动作 × 真实 Skin 未验**（本机无 Mixamo 原件）；本单只用自造骨架与 mock GLB 验证。
