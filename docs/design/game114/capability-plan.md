# game114 导航演示能力总览

状态：2026-10-09 owner 已判引擎方案 A；当前会话负责实现与消费，独立代理负责复查。此文仅覆盖既有3D演示的导航接入，不定义正式游戏玩法。

- 共享地图：`t2-navigation-grid` 解释 `NavigationGrid`（格角原点、行主序 blocked/cost）和 `NavigationProfile`（地图引用、净空半径、目标）。输出兼容 `NavGraph`、`FlowField`。
- 个体路线：`t2-pathfind` 解释 `NavAgent.graphId` 和 `Relation(target)`；每只机关牛有自己的目的地。
- 局部避让：`t2-crowd-avoidance` 解释 `CrowdAvoidance`；复用既有 ORCA 核。
- 移动与碰撞：`t1-motion-apply`、`d1-overlap-detect`、`t2-collision-resolve`。静态障碍 Shape 与寻路阻挡来自同一份场景足迹定义；碰撞体只参与模拟，隐藏其独立绘制。
- 表现：现成 `Model3D` + `AnimState3D`，`Transform` 通过已有地面投影显示；动态单位去掉 `Path3D`，避免两套坐标同时驱动。

游戏层无新增 system、无自写 A*/ORCA/位置积分。演示宿主仍保留交接样例的场景组装与资源加载代码；导航数据落在 `handoffs/game114/mechanism-sample/navigation.json`，不是正式 launcher 游戏注册。

初始地图：64×64 世界单位，128×128 格，每格0.5；小型净空1.45，大型净空4.1。净空使用整格保守膨胀，过粗的格子会关闭实际上勉强可过的通道。后续正式地图按关卡需要调数据。

限制：ORCA 无可行解可能重叠、对称迎面可能停住；碰撞是离散检测，高速一步跨薄墙仍可能穿透。演示速度0.025–0.05单位/tick，障碍最小厚度0.8；不把这些参数外推成连续碰撞保证。模型朝向与步频仍是表现演示配置，尚未增加导航速度驱动的转向/步频同步能力。
