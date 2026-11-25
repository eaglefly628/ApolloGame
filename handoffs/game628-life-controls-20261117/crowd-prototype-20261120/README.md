# Game 628 街坊人群原型 · 2026-11-20

独立场景 `crowd-street` 与 `crowd-navigation`，从最新 `reference-walk.json` 深拷场景，保留原玩家、5店员、3猫、环境资源与原8障碍几何，增加8居民。仅现有数据能力组合，无共享引擎修改，无新人物资产，无提交/推送。

## 重生与验证

```sh
node handoffs/game628-life-controls-20261117/crowd-prototype-20261120/assemble-crowd.mjs
npx vitest run --config handoffs/game628-life-controls-20261117/crowd-prototype-20261120/vitest.config.mjs
```

生成器每次重新读取当前reference-walk，幂等覆盖本原型的两个JSON与合同；不修改源scene/main generator。network-plan.json来自model/crowd-review的实际8代理未膨胀栅格，真实bakeNavigationProfile(.25)验证输出；保留该计划作为离线输入。源街景SHA写入合同。若8障碍几何改动，需要重新生成network-plan，不能仅重生scene。

## 实际能力与数据流

- `NavigationGrid`: .2m格，94×19，raw blocked为原8代理占据，成本1为中间通行区；门前、路肩与两端为2~4。`NavigationProfile`半径.25，实际派生1058节点/3865边，所有出生与端点同连通分量。
- 离线将相同真实烘焙节点/边写入**显式NavGraph crowd-routing**，边cost=`worldLength × mean(endpoint source-cell costs)`。`NavAgent.graphId`指向它，实际A*消费加权边。NavigationProfile仍存在于运行world供debug/对照，但居民不走grid metadata的精确逐格中心模式。
- 原grid模式在ORCA侧移后反复拉回格中心、吞吐低；显式图允许现有waypointRange .15生效。300秒实际每人9~13次到达端点、173~193m，原grid组合约2~5次到达、50~80m；未增自动回归runtime。
- `NavAgent.patrol`: 每位两个跨向往返端点；speed .012~.015m/tick（.72~.9m/s），arriveRange .16，repathPeriod90。
- `CrowdAvoidance`: 同street组，radius.25，horizon35 ticks，maxNeighbors12，neighborDistance2，yieldAfter90/minRadiusScale1（不缩身体），zeroEscape。无FlowAgent双重避让。
- `FaceRotate`根据真实Velocity；已有CharacterPresentation根据碰撞/Bounds后实际XZ位移控制idle/walk与速率，复用原库clip与nominal .015369101474231043m/tick。
- 居民复用原玩家街道Bounds（包围整个Shape）：X[-9.2,9.2], Z[.55,4.05]。显式图允许侧移后从邻近图节点重新规划，无需窄的保守profile围栏；早期窄Bounds造成侧让受限和接触持续，已去除。
- 硬碰撞分层：player category1/mask2、居民category4/mask6、原8静态category2/mask5。玩家保持Mass1、原静态碰撞；居民彼此与静态硬碰撞。玩家/居民以ORCA互避，**无双方硬位置推挤**，故停站玩家不被挤走。玩家主动移动时也进入ORCA，不能将其描述为不可穿越的硬实体。

## 真实导航图可视化

`crowd-navigation`是同模拟、俯视camera。红格为半径扩展后的规划禁入/净空余量格（含真实物理障碍格与半径余量），图节点不含红格；红格不等于物理硬墙，ORCA可以暂侧让进保守余量区，最终硬碰撞仍由8真实代理执行，绿成本1、橙高成本。细蓝线通过真实NavGraph边的DFS双向遍历组成单条Line3D，不包含连接非邻接节点的跳线；每条真实边均显示。黄/蓝粗线连接patrol端点，仅是巡逻目标示意，不冒称A*实时路线。两页可互换并返回散步。

## 验证与已知限制

4项测试覆盖场景/原角色保留与实际网格、真实A* via差异及加权代价降低、动作切换、18000tick长仿真和8个手动玩家撞墙探针。simulation-report.json记录300秒每居民转向/累计实际路程/末态free及精简NavPath，不输出巨大graphKey。cost-report.json中resident01加权路径16.8142，平成本路线按原成本重算16.8971；05为12.4485 vs12.6142，证明权重影响真实路线。

300秒player无输入位移精确0、8静态最大穿透0；NPC互相接触的最大解算残差0.0715mm（resident01/08，186.25秒，约X-2/Z3.3），最长大于1微米的连续接触18tick/.3秒，无超过1mm的接触帧。现有硬碰撞为3次位置迭代，不宣称所有帧绝对零重叠；测试1mm阈值，实际最大残差远低于该值。ORCA并非无解情况下的绝对无接触保证。此为8名自动居民的有限街道原型，未实现跨街传送、日程/工作AI或无限人数系统。

独立长仿真/主动玩家冲居民由review_game628_prototype复查；浏览器实景与最终build由主代理统一执行，避免占用其他工作线服务。
