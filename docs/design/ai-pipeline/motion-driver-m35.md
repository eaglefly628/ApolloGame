# M3.5 · 影视角色动画驱动系统

施工主体：当前 Codex motion-semantics-next session。2026-10-31 owner 明确授权扩展引擎，参考 Unreal 动画系统；目标是影视叙事可复用完整 Locomotion 和表演驱动。状态：架构实查与验收契约施工中，尚未实现新运行时。

## 已核实现状

- AnimGraph3D 已有 clip 状态、speed 一维混合、Flag/State 条件淡变，位于 src/engine/protocol/components/anim-graph.ts 和 src/renderer/three/animation-graph.ts；不再重复实现一套旧能力。
- E2 契约为 render-only，不允许从 three AnimationMixer 帧/回调写 sim。现 speed 读 Velocity 平面长度，单位 world/tick，不能直接当米/秒。
- motion-apply、jump、GroundWalker3D、碰撞和时间线须按实际坐标/阶段接口接入；2D jump 的负 y 向上不能当作 3D Y-up 跳跃使用。
- M1 重定向、E3 Attach3D、E4 IK、M6 烘焙继续复用；原始素材与已记录标签版本不改写。

完整合同与逐批验收补在本文件；先登记施工归属，不以本声明代表实现完成。
