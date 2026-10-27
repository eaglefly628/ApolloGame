# 动作补全 · 用相近动作 + IK 补出库里没有的动作（2026-10-28）

> owner 目标：以后做《最后的火柴》这类演绎内容时，系统**自动选动作**，库里没有的（如「擦火柴」）用**相似动作 + IK 调整**补出来，并把补出来的动作**沉淀回库**，逐步补全。
> 口径：先查现有能力能否重组表达，查不到的才报缺口。

## 一、运行时补全：现有能力重组即可（不报缺口）

以「擦火柴」为例，拆成四件，每件都有现成组件：

| 要表达的 | 用什么（已核） |
|---|---|
| 身体大致姿态（低头、双手在胸前） | M4 在库里找最近的动作（如「点烟」「看手里的东西」「拿起小物件」），`AnimGraph3D` 播放；体型不同时 `retarget:'humanoid'`（M1） |
| 火柴盒在左手、火柴在右手 | `Attach3D{ parentId, bone:'LeftHand' / 'RightHand', offset, rot }`（`src/engine/protocol/components/attach3d.ts`） |
| 右手贴到火柴盒侧面、做出划的轨迹 | `IK3D.chains[{ kind:'two-bone', root:'RightUpperArm', mid:'RightLowerArm', end:'RightHand', target:{ entity:<火柴盒或其上的辅助点>, offset }, weight:{ param, fade } }]`（`ik3d.ts`）；划的轨迹由挂在火柴盒上的辅助点做小幅往复（`Anim3D`）给出 |
| 何时贴上、何时划、何时离开 | 时间线 cue 写 flag → `AnimGraph3D.params` 的 `flag:<id>` → IK 权重淡入 / 淡出（IK 权重读的就是动作图参数，`src/renderer/three/ik-params.ts`）；火苗亮起用渲染参数绑定（REQ-3D-RENDER-BIND） |

数据形状示意（具体数值由 S3 骨架期定，并补用例钉住）：

```json
{ "AnimGraph3D": { "clips": { "base": { "asset": "motion/look-at-hands", "clip": "look-at-hands", "retarget": "humanoid" } },
                   "states": { "s": { "clip": "base" } }, "params": { "strike": "flag:strike_on" }, "transitions": [] },
  "IK3D": { "chains": [ { "kind": "two-bone", "root": "RightUpperArm", "mid": "RightLowerArm", "end": "RightHand",
                          "target": { "entity": "matchbox_striker", "offset": [0, 0, 0] }, "pole": [0, -1, -1],
                          "weight": { "param": "strike", "fade": 0.15 } } ] },
  "Timeline": { "cues": [ { "at": 30, "do": { "kind": "flag", "flagId": "strike_on", "value": true } },
                          { "at": 54, "do": { "kind": "flag", "flagId": "strike_on", "value": false } } ] } }
```

结论：**一次性用在某个游戏里，现在就能做**，不需要新引擎能力。缺的是下面两件。

## 二、缺口 M6 · 把补出来的动作烘焙成库里的新动作（⚖ 待 owner 判 A/B）

**实查**：IK 只在渲染时实时作用（`IK3D` 注释：render-only，动画之后施加）；没有任何工具能把「基础动作 + IK + 挂点 + 时间线」算一遍，写成一个新的动作 GLB。所以运行时补出来的动作**留不进库**：预览台看不到，M4 匹配不到，每个游戏都要重新拼一遍。

| | A · 补「动作烘焙」工具（🟢 工具链） | B · 只在运行时拼 |
|---|---|---|
| 做法 | `motion-library compose`：输入一份补全配方（基础动作 id、目标 Skin、挂点、IK 链与目标轨迹、权重时间表），在 Node 里用与引擎同一套动画与 IK 代码逐帧求解，烘焙成单 clip 的标准骨架 GLB，写进目录（`derivedFrom` 记基础动作与配方 SHA，`status: draft`），之后和别的动作一样能预览、匹配、重定向 | 每个游戏自己写 IK3D / Attach3D / 时间线数据 |
| 代价 | 约同 M2 一半；复用引擎 IK 求解代码，需从渲染器中把求解函数做成可在 Node 调用的纯函数（不改行为） | 零代码 |
| 影响面 | 只加工具和目录条目；运行时不变 | 无 |
| 选错的代价 | 若烘焙结果与运行时 IK 不一致：以测试钉住「烘焙后播放 = 运行时 IK 结果」，不一致即红 | 库永远补不全；同一个「擦火柴」在每个游戏里重拼一遍，AI 也学不到 |

**Lead 推荐 A**：这是「补全所有动作」能成立的前提。

### 自动化（随 M4 / M6 的 skill，不另报缺口）

M4 的 skill 加一节「补全」：库里匹配分数都低于阈值时，agent 选最近的动作，按配方模板写出 IK 目标与时间表（只能用目录里的动作 id 和标准骨架骨名），先运行时预览，人确认后用 M6 烘焙入库。复查人核对配方与预览截图。

## 三、本作需要补的动作（game628 动作清单候选）

| 动作 | 最近基础动作（下载后由 M4 实测确定） | 补全要点 |
|---|---|---|
| 擦火柴 | 看手里的东西 / 点烟 | 右手 IK 贴火柴盒侧面 + 往复轨迹；火苗亮起用渲染绑定 |
| 伸手取暖 | 伸手 / 烤火 | 双手 IK 指向火苗位置 |
| 缩坐发抖 | 坐地 + 发抖 | 可能需要两段混合（M5 / 动作图 blend） |
| 奶奶抱起 | 抱起 / 拥抱 | 双手 IK 贴小女孩腋下挂点；两人时间线同步 |
