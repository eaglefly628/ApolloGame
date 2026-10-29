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
