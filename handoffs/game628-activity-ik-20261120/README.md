# Game 628 武术表演与猫咪脚掌对照

本机独立候选，基于 628-WUTONG-20261120-LOCAL-FINAL 的解压运行包。冻结 ZIP、18848 及 RC1 保留。没有提交、推送或发布。

## 试玩和 UI 接线

```sh
python3 handoffs/game628-activity-ik-20261120/serve.py
```

- [整合入口](http://127.0.0.1:18849/) 可走「游客进入 → 确认角色 → 梧桐街」。
- [直接进入梧桐街](http://127.0.0.1:18849/prototype?scene=reference-walk)。在「主角表演」一行点「武术表演」或「停止」。按 WASD 或方向键可打断。
- [猫咪脚掌对照](http://127.0.0.1:18849/prototype?scene=cat-ik-comparison) 也可由「猫咪脚掌对照」按钮进入，并用「返回梧桐街」回到原入口。
- `site/` 已含 UI 静态入口、`prototype/index.html` 和原有绝对资源路径。外壳仍加载同源 `/prototype?scene=reference-walk`。新增控件走现有 LayoutNode 和动作名，未改外壳或共用引擎。

## 武术表演

复用 18839 验证过的相同主角 GLB 与 Mixamo Ginga Variation 3（`ginga-variation-3-121180901`），含素材来源、SHA 和本机用途记录 `martial-source.json`。原地片段约 2.9 秒，衍生 GLB 保留 idle、walk、wave、dance、clap、bow。仅作本机候选，素材发行审批仍待核定。

21:9 同源 iframe 实测视口 3440×1440、画布 3440×1200 CSS px。点播期间角色 X 保持 −1.6。停止和自然播完均回 idle，移动信号使状态转 walk，松开回 idle。招手、拍手、鞠躬、跳舞都在浏览器中进入原片段。Vitest 回归 1/1 通过。游客入口实测完成捏脸到街景、点播、进入猫咪对照、返回街景。见 `evidence/martial-wide-runtime.json`、`evidence/embedded-roundtrip.txt` 和实机截图。

## 猫咪样例

原街景地板猫只有两块刚性可见爪网格，缺少可直接使用的四足腿链。比较场景取用原猫，增加两对局部刚性两节腿链，复用爪部网格。左右同一角色、相同 7.2 秒根轨迹与步序，左侧由局部关节轨迹驱动，右侧逐帧调用 Apollo 双骨求解，针对左右各一条前腿和后腿的脚掌目标。先原地转约 19°，再上、下 6.5 cm 台阶。锁地、摆动净空和台面接触来自独立脚掌目标。原街景三只猫仍播放原分别的待机动作。

- 本地现行应用检出的组件映射没有 `IK3D`。离线生成器直接复用 motion-line 检出的 `src/renderer/three/two-bone-ik.ts`（源 SHA 见 `evidence/solver-source.sha256`），生成 60 Hz GLB 动画。浏览器走现有 AnimState3D 播放通路。比较的是同一段动画在开启和关闭离线修正时的差异。
- 独立验证重新导入 GLB，用 Three.js AnimationMixer 以 120 Hz 播放并检查实际脚掌网格顶点。IK 版最大穿入 0.235 mm，循环首末脚掌误差小于 0.001 mm。左侧无地形约束，是有意保留的 FK 对照，最大穿入约 131 mm。上述只覆盖该样例的平面、小台阶和脚掌，不等于全身网格或任意地形通过。
- 如果下一步要让猫在店里边走边读任意地形，需要 A/B 裁决。A 由共享引擎负责人评估已有 E4 动作线合入整合分支并验证四链目标、支撑权重、地面采样和跨前后腿约束。B 继续使用指定台阶路径的离线动作，接线小，可复用同一姿态与台阶高度，其他地形需重烘焙。当前候选是 B 的演示，现有包没有街区实时 IK。

## 复跑

在 ApolloGame 根目录运行：

```sh
node handoffs/game628-activity-ik-20261120/bake-cat.mjs
node handoffs/game628-activity-ik-20261120/verify-cat.mjs
./node_modules/.bin/vitest run --config handoffs/game628-activity-ik-20261120/vitest.config.mjs
```

`assemble.py` 从原 18848 解压目录重建局部场景配方。服务器、静态资源和候选试玩都不依赖该解压目录。归档 `site/` 即可取用整合样例。
