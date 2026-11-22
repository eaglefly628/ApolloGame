# Game 628 · 梧桐街行人步态与感知响应

[打开本机试玩](http://127.0.0.1:18856/?scene=crowd-street)。WASD 或方向键走近行人，站定后按空格招手，或点「鼓掌」。行人会继续原路线，也可能先停看一眼。两名行人相遇时可能停下来交谈，轮流做简短手势。挥手看朝向，鼓掌按距离感知。某位行人接受后，附近另一人有机会跟着回头。

## 已对齐的设计

- 四名现有 Avatar 由固定种子分配三款步态与四种起始相位。演员的模型、步态和反应倾向绑定到居民 ID。路径系统控制实际位移，表现按每个模型的标定步幅和实际地速播放。
- 居民大部分时间沿既有 A* 路线走。活动按固定模拟拍判断，停看约 1 秒，直接关注约 1.3 秒，两人交谈约 2.4 秒。结束后按居民自己的冷却在 7–14 秒间收敛，再允许下一次活动。
- 双人交谈需要双方都满足距离、角度、空闲和概率条件，在同一拍分配双向配对。行人被移除或距离拉开时释放配对。街边兴趣点是场景坐标，居民从当前路线上停看，再继续原目标。
- 主角动作由已有输入队列进入模拟。每次最多一名直接响应者。接受后约 0.3 秒做一次邻人传播判定。二级响应者无传播排程。距离、扇区与概率用场景数据配置。首版使用平面距离、朝向和动作类型，适用于开敞街道，街区视线遮挡、对话文本与语音留待扩展。
- 兴趣点、概率、冷却和传播范围见 [运行数据](street-response.json)。场景适配器只装入数据和预览系统。活动结果进入表现层，表现层没有写移动路径的权限。

## 能力实查与裁决

查了生产手册的 3D、运动寻路、事件逻辑、对手 AI、确定性，以及对应的 registry 和系统源码。街景直接复用 `t2-pathfind`、`t2-crowd-avoidance` 和 `t2-face-rotate`。行为候选复用 `w1-random` 的派生种子算法、固定拍、输入队列和状态停步位。动画沿现有 `AnimState3D` 接线。

`t3-aggro` 读取 `Perception{targetTag,sightRadius,lureTag}` 并只写最近目标 `Relation(target)`。它可表达距离筛选，缺观察方向、事件时间和回应结果。巡逻 `NavAgent` 优先取自己的航点。 `EventWhen`、`Effect.chance` 可以表达观察与概率响应的一部分。双方占用、伙伴销毁后释放、一跳传导需要共享的一次性判定与状态。将它们散放在多个效果或行为树自定义叶里会让配对与恢复跨多个写入者。

| 裁决 | 代价与适用面 |
| --- | --- |
| **A · 通用引擎能力，已确认** | 感知与活动归固定拍系统，游戏只声明事件和响应参数。目前候选需要正式 registry/schema、共享门禁和独立复查。可复用于村镇、旅店和其他开放街区。若范围定得过宽，维护成本会落到共享引擎，因此当前只保留三个活动及一跳响应。 |
| B · 仅 Game 628 游戏逻辑 | 单场景试错成本低。配对、状态恢复和防扩散会留在游戏脚本，下一个场景复用时需再次拆解，且更容易和导航争夺移动写入。 |

本次以 A 的接口实现隔离引擎候选，运行在真实街景的 World 调度器里。共享主线的施工锁、注册和独立复查尚未落地。无提交或推送。

## 资产与验证

[步态配置与实测](gait-report.json)记录来源、头像 GLB 与输出 SHA、相位和步幅。两条新步态复用 D2c 的 Y Bot 离线 IK 锁足候选，转到街坊约 0.86 缩放后重新测鞋底。四个模型匀速平地循环最低鞋底误差落在 −0.41 到 +1.65 mm。新动作在已标定的支撑窗口内，200 ms 内最大水平骨点位移约 2.96 mm。基准走路保留原配方，仅重新落地和错相。短交谈取本地 General Conversation 上半身片段，腿和髋保持原站姿。

这些数值覆盖输出 GLB 的独立匀速循环与平地。起停混合、急转、变化路面和实时 IK 未通过本轮接地验证。动作资产仅用于本机候选。

确定性用例包含真实导航定序、主角的方位及移动门槛、直接响应和一跳上限、双方同拍配对、伙伴消失、停后续走，以及挂起传播跨快照恢复后逐拍同 hash。90 秒无输入街景中共 6 次停看、6 场双人交谈，每人行走 49–56 m，8 个障碍的最大穿透为 0。浏览器回放结果在 `evidence/browser.json`。构建输出仍有 Jolt 浏览器兼容外置和大块提醒。

## 复跑

在 ApolloGame 根目录执行。

```sh
./node_modules/.bin/vite-node --config handoffs/game628-life-controls-20261117/vite.config.mjs handoffs/game628-pedestrian-life-20261121/build-gaits.ts
node handoffs/game628-pedestrian-life-20261121/assemble.mjs
./node_modules/.bin/tsc --noEmit -p handoffs/game628-pedestrian-life-20261121/tsconfig.json
./node_modules/.bin/vitest run --config handoffs/game628-pedestrian-life-20261121/vite.config.mjs
./node_modules/.bin/vite build --config handoffs/game628-pedestrian-life-20261121/vite.config.mjs
python3 handoffs/game628-pedestrian-life-20261121/serve.py
```

服务器启动后用 `node handoffs/game628-pedestrian-life-20261121/verify-browser.mjs` 复跑 Chrome 验证。预览使用已有 `game628-cat-turn-20261121/site` 的街景和贴图，本目录提供变体 GLB、场景数据与试玩宿主。
