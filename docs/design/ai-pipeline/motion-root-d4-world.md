# D4 World 根运动事务接线

`t2-root-motion` 提供三个同源 schema 组件；真实推进由 `t2-character-motor` 的 phase -1 事务拥有。普通无根运动的 D1 仍在 phase21。含 RootMotion3D 的 actor 在 phase-1 先准备 D1 与 Performance，再按 RootMotionSource3D 选真实来源，提议根位移，经同一胶囊 CCD 通道接受后，一次提交 motor、environment、Transform/Collider、D1/Performance/Root playback。任何校验、预算或反馈失败均在提交前抛出，不制造半推进。

`prepareAnimationDriverStep(world,id)` 返回 `{previous,playback}`，没有 World 写入；`prepareRootMotionWorldStep` / `acceptRootMotionWorldStep` 做提议和接受；载入/导入/恢复共同调用 `validateRootMotions(entities,tickRate?)`。这不读取真实资源字节，不是素材质量批准。

来源约束：D1 必须是有显式外部 asset 的准确 alias，duration/loop/tickRate 匹配；正权重必须为1且无 crossfade。Performance 必须是准确 slot/clip、完整 weightQ=1000000、override、明确列出17个标准身体骨；同槽根段必须覆盖整个 clip 且入/出淡变为0。实际模型的完整骨覆盖由 renderer 另验；不能把17骨最低结构门冒充实际全骨架验收。另一个 Hips 层或混合根来源明确拒收。

每次提议取同事务的新 source cursor/instance/cycle/driverTick，没有第二个根时钟。inactive 保留已消费游标，并通过 core seek/rebase 消费 driverTick、清余数/旧 warp，不生成 RootMotionRequest；物理仍用显式零根位移通道，避免速度惯性补债。未进入过 alias 的 D1 instance=0，纯 core 不支持0：idle root 暂存保留/占位 instance1，**这不是源存在的证明**，不生成请求；实际正权重激活必须按真实 source instance 重建。重新播放按来源新实例从0开始，不归还被墙挡住的位移。once Performance 段同 tick 清槽时，可信源 complete/相邻段事件允许消费最后区间。

preview seek 无根位移/根 yaw、不重新发源 cue；下一个正常 tick 从目标游标继续。Y、重力、跳跃由 motor 保持；RootMove 与旧 Velocity/Walker、move/facing intent 排他。直立胶囊 yaw 不改变形状，因此根 yaw 无独立旋转扫掠。

warpAnchorId 只读模拟 Transform：`x→world X`、`y→world Z`，须在 Q10000 网格上。锚有 CharacterMotorPlayback3D 时用其整数 yaw；其它锚本批**只位置 warp，yaw=0**。不读 Transform3D，不猜 State 字段或从视觉旋转取朝向，也不把 Transform.rotation 当 warp yaw。窗口开始冻结锚；窗口中锚变化/跳过准确起点/超界均拒收。

Root core 的完整 requestId 绑定源 SHA、实例、cursor 和身体/锚；接受反馈使用原完整身份。胶囊原语的 requestId 是局部诊断标记且仅允许512字，因此传 actor/instance/epoch/tick 的紧凑元组；不截断或替换 root 接受反馈身份，不以短摘要认证来源。

Root/motor/environment/来源 playback 的 snapshot tuple 必须同时恢复；pending 提议不能存入已提交世界。活动源实例/游标/host tick、Root.accepted pose 与 motor 当前位置/yaw 逐项一致。Model/旧 render-only 动画排他由 assembly 与 renderer 守卫，不能作为根模拟输入。D1 缺少实际 SHA 字段：原生 renderer 必须用 RootMotion.inPlaceClipSha256 核验真实选中 GLB，并核对 source 引用；World 的结构通过不冒充真实字节已核验。

Trace 关闭时不计算事件汇总/移动摘要；开启时记录拒收、碰撞约束、事件与接受位置摘要。此竖切不支持混合根提取、任意部分蒙太奇根段、动态追锚、垂直根运动或绕过碰撞。
