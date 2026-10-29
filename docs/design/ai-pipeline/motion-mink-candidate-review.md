# 简单上肢动画候选工具复查单

施工主体：当前 Codex motion-semantics-next session。范围为 tools/motion-mink-validation；不修改引擎求解系统、渲染器或正式动作库。

## 行为与边界

以闭集 JSON 配方指定基础动作单帧、左右手目标及轨迹，经米制骨架校准、Mink/MuJoCo 离线求解、原生 GLB 烘焙和独立检查生成本地 draft。入口 run.mjs；Skill 分发源码在 skill/。输出目录必须新建且位于 Git 仓库外；原素材不改，副本不共享 inode。过程记录配方、工具快照与校验；共享引擎依赖未传递冻结。

只支持固定躯干/腿的简单上肢动作；不保留基础动作整段时序，不认证全身平衡。几何通过、AI 视觉核对和用户表意认可分别记录；技术失败不可升为正式素材。旧实验报告保持原判定，新阈值不得追溯改变旧结论。

## 手部尚未完成

宏观表意不证明指骨正确。当前右拇指/食指仍使用宽范围 ball 关节，其他指骨没有完整主动求解；缺逐 Skin 的指骨局部轴、屈伸方向与限位、拇指对掌及指间/指掌/道具接触校准。肘部 hinge 限位报告不能替代手指验收。Skill 要求逐指核对，未校准维持 not-calibrated 或 needs-refinement，不能自动批准或声称该问题已修复。

## 独立复跑

```sh
node node_modules/vitest/vitest.mjs run tools/motion-mink-validation/recipe.test.mjs tools/motion-mink-validation/run.test.mjs tools/motion-mink-validation/review-assets.test.mjs
node node_modules/typescript/bin/tsc -p tools/motion-mink-validation/tsconfig.json
```

使用本机合法素材及 Mink 环境时，按 skill/references/workflow.md 的真实 schema 在仓库外创建配方及全新输出目录运行 run.mjs。技术失败退出 2，执行错误退出 1，通过也只给 candidate-needs-visual-review。不得把当前环境素材或完整实验报告提交。

内部独立复核验证 19 项合成用例；故障探针覆盖工具漂移拒收与技术失败不升主库。外部 Claude 尚未批准本批。真实简单伸手候选完成离线链和独立回放检查，只证明该样例技术可跑；不构成手指、跨 Skin 或所有动作认证。多视角图像对照目前由 Codex 观察，无自动关键点估计器或客观图像评分。


## 实时手部 Socket 交互原型（本轮）

复用 Attach3D、IK3D 和 AnimGraph3D，不修改共享渲染器或新增游戏专用求解器。每个角色独立校准握持框架，加入无蒙皮权重的 Grip/Contact 虚拟骨：左右 Grip Socket、左接触 Socket、右火柴头 Socket。道具随握持 Socket；右端点通过原生双骨 IK 跟随当前左接触 Socket。移动盒子的左链先执行，再求右链。互动 IK 未烘焙到基础 clip。辅助 Socket 位移轨迹必须直接作为内嵌动画播放，不可再次经过会丢弃非髋平移的 humanoid 重定向。

预览的“进入/退出交互”以 Flag 驱动原生动画状态转换，同时启用/释放接触链；移动盒子和关闭 IK 可比较实时响应。暂停切角色采用单次解析的内嵌模型和动画，零速准备首帧后才交给播放控制，防止等待外置动画期间出现空画面。候选失败不隐藏；缺少掌骨的角色仅提供基础播放。

完整本地试验 108 个角色：72 个端点检查通过，26 个端点不可达或链拒收，10 个缺掌骨无法校准。通过仅限采样端点、激活和可达性，不认证手指、抓握、身体穿插、道具朝向或任意交互。来源候选原技术失败保留；用户接受的是简单手部动作的表意方向。头部跟随属于运行时 Head look-at，非眼球控制、非烘焙。所有角色/动作/纹理/实测报告均不入 Git。

新增独立复跑入口：

```sh
node node_modules/vitest/vitest.mjs run tools/motion-mink-validation
node node_modules/typescript/bin/tsc --noEmit -p tools/motion-mink-validation/tsconfig.json
python3 -m unittest discover -s tools/motion-mink-validation -p '*_test.py'
```

真实运行命令和闭集参数见 skill/references/workflow.md；socket-runtime-run.mjs 支持 --skins all 或精确角色 ID。失败退出 2，源素材不变，不因端点通过自动入正式库。请独立复跑和撤修验红；本轮外部 review 尚未完成。
