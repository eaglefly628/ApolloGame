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

## 独立复查判词（本会话）

**FAIL，需原施工方返工。** 基线为 `b0965fc26`（含 M1 提交 `9d003301`）；在独立工作树复跑。

- 原指定 4 个测试文件：91/91 通过，退出码 0。
- 新增独立实证：`extractSkeletalClip` 接受 STEP 旋转/位移轨；同骨架、不启用 retarget 时 0.25 秒姿态保持正确；启用 humanoid 后，左上臂世界旋转误差 **0.3094216623 rad（约 17.7°）**。复现退出码 1。
- 原因位置：`retargetHumanoidClip` 输出所有旋转及髋位移轨时新建轨道而未保留插值语义，默认变成线性；因此原本应保持到下一采样点才跳转的动作会提前过渡。现有用例只覆盖线性输入，未覆盖该路径。需定义并测试 STEP / CUBICSPLINE 的帧间语义，不能把采样点一致等同播放一致。
- 最小复现附件：[STEP 复现源码](REQ-MOTION-M1-step.repro.ts.txt)（自造骨架，无 Mixamo 内容）。将附件复制为 `src/renderer/three/skeletal-retarget.review.test.ts`，执行 `node node_modules/vitest/vitest.mjs run src/renderer/three/skeletal-retarget.review.test.ts`，可得到上述失败。附件本身不加入正常测试扫描；不把已知红测试推入 CI。
- 独立撤修验红（与施工自证不同）：① 删除目标父坐标的逆旋转；② 禁用髋部位置通道。两处均断言锚点命中恰好 1 次，原 M1 用例各退出 1；之后恢复原文件。
- 基线全量门禁：`node scripts/scoped-gate.mjs --run --base 9d003301^` 退出 1；eslint、depcruise、sim-dom-fence、tsc 均过；7482/7485 测试过，3 项失败：golden-shot 与 render-probe 的浏览器环境对照，以及 style-tokens 的 pending.json 缺失。未改被审实现，此为该隔离环境的基线结果；没有把全量结果报绿，后续 build / 文档守卫未在这次 full 运行中执行。告警中另有 happy-dom AbortError，未将其隐去。真实 Mixamo × 两个 Skin 的视觉播放尚未验证；本轮已下载真实素材，不据此冒称导入或视觉通过。

后续：保持原施工归属，不在复查中代修；M3 的 M1 PASS 依赖未满足。M2、骨骼提取等独立路径不能伪称已完成。

## 本会话返工与再次独立复查

owner 本会话授权继续执行 M1～M6，施工锁由本会话接管；另由未参与修复的独立复查 agent 复验。历史 FAIL 保留，当前代码复查结论为 **PASS（以下明确边界）**。

- 修复：输出保留旋转 STEP/LINEAR 模式，髋位移单独保留自身模式；核对共享采样时间戳而非只比数量；不加每帧重定向计算。
- 支持边界：同一动作的旋转轨须统一为 STEP 或 LINEAR；髋位移可独立选择这两者。cubic/smooth 或混合旋转显式 reject 并记原因，需在 M2 离线规范化；不声称任意曲线或不同层级在帧间完全等价。
- 原四文件独立复跑 94/94；旧 STEP 复现误差 0 rad；加入边界时刻、目标独有中间骨、独立髋模式、拒收及不同时间轴等独立对抗用例，共 100/100 通过。
- 独立双锚点撤修：去掉旋转输出模式 → 旧 0.309421662276 rad 问题复现；髋误用旋转模式 → 位置偏差 0.1216038921。各锚点命中 1，退出 1，恢复后 100/100；原文件字节恢复已核实。
- 完整独立判词另附 [返工复查记录](REQ-MOTION-M1-interpolation-review.md)。全量门禁与真实素材视觉验收分别记录，不用单测代替两角色实播。

本次返工全量门禁：`TMPDIR=/private/tmp RENDER_PROBE_CHROMIUM=<本机 Chrome 程序> node scripts/scoped-gate.mjs --run` 退出 0；eslint、depcruise、tsc、全量测试、build、文档引用/预算守卫通过。此前三项基线失败分别由显式本机浏览器路径和规范化临时目录消解，没有修改相关工具或测试。构建大 chunk 提示及既有美术台账 WARN 仍保留。门禁运行包含同期 M2 工作树，仅本次 M1 文件进入本次提交。
