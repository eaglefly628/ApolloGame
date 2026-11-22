# G628-CAPE-A-CLOTH · 契约刷新与原生回放阶段

2026-11-20。本阶段只写本目录，Engine DEV runtime 和编辑器输入只读。未修改编辑器、共享引擎、18848/RC1 或其他冻结包，未提交、推送或发布。

## 契约与六项测试

统一契约为 `../game628-cape-runtime-engine-20261120/CONTRACT.json` v2，SHA256 为 `d4fb612b2dc0bb91e7b96496ab426004690a5851272b8617a782371501fecaf6`。挂点为 LeftUpperArm / RightUpperArm，offsetM 均为 [0,0,-0.025]。新增 ownership 与 bounds 字段没有改变挂点选择。

更新前独立执行本目录输入测试，准确复现旧 SHA 快照失败：1 失败、5 通过（`evidence/input-tests-before-refresh.log`）。重新运行 `prepare-inputs.mjs` 后 fixtures/summary 与 profiles 同步刷新，六项全部通过（`evidence/input-tests.log`）。测试额外核对 profiles 的契约 SHA、三处代理绑定、两侧偏移和数据一致性，没有移除 SHA 校验。

## 真实 Jolt 回放诊断

直接消费 Engine DEV 已复查的隔离接口。每种体型/档位完整运行 idle、walk、wave，共 968 帧、60 Hz；walk 的第 598–682 帧以 0.25 m/s 平移，随后停止，从 wave 第 683 帧起用 120 帧转向 180°。姿态先更新一次，挂点及代理由 Engine DEV 的同一实例接口读取。全程一个 native 布体、三个动态代理；没有用重建恢复运动。初版根运动发生在 idle 内，独立复查发现后已修正；旧结果保存在 `evidence/runtime-contact-idle-root-motion.json`，不作为当前动作覆盖证据。世界自由点位移包含根运动，不单独作为相对摆动或速度历史的证据。

| 体型/档位 | 肩点误差最大值 | 自由顶点穿入 | 固定肩点穿入 | 三角面四点采样穿入 |
|---|---:|---:|---:|---:|
| slim / normal | <0.0001 mm | 0 mm | 21.1 mm | 22.0 mm |
| slim / low | <0.0001 mm | 8.0 mm | 21.1 mm | 48.5 mm |
| full / normal | <0.0001 mm | 0 mm | 49.6 mm | 26.8 mm |
| full / low | <0.0001 mm | 0 mm | 49.6 mm | 38.3 mm |

当前代理/挂点组合未达到 10 mm 目标，`proxyFitAccepted` 全部为 false。四项诊断测试通过只证明有限数、动态历史、肩点跟随和资源切换正常；并不把穿模判为通过。穿入相对本目录拟合候选胶囊测量，不等价于角色皮肤表面的精确距离。三角面只测四个重心权重点，不能证明整个三角面无穿入；自由顶点预热 60 帧后计入，固定肩点全程计入。夹住两肩的零质量点不能靠求解自动离开代理，需要接下来联合检查代理拟合和扣位。

真实 normal→low→off 消费预算状态机，切换后顶点数为 35→0，off 后无布体。触发输入是合成的连续 16 次 1 ms 超预算序列，只验证降档接线，不能称为慢设备实测。

计时为 Apple M5 / macOS arm64 / Node 22.22.3 中 `ClothSystem.sync` 的 CPU 时间，预热 60 帧，包含 Jolt 步进、挂点/代理采样、顶点复制与法线更新；排除动画、fixture 设置和测量检查。修正轨迹后施工者 p95：normal 约 0.16–0.20 ms，low 约 0.10–0.13 ms；独立复跑在同机负载下四组为 0.37–0.53 ms。逐项数值以 `evidence/runtime-contact.json` 与 `evidence/independent-review.json` 为准，差异说明测量受同机负载影响。尚未测浏览器 rAF、GPU 或移动设备，不能套用该 CPU 数值作最终设备预算。

## 浏览器隔离验证

18854 由捏脸席拥有。确认其真实布体开启后，本轮通过 CUA 新开独立 IAB 页，验证纤瘦、圆润两种体型穿脱、方向键行走与换向、松键停步、挥手、标准/低档/停用，并保存 `evidence/browser-*.jpg`、最终 AX 文本与控制台日志。本轮捕获 warn/error 日志为空。布面在转向前后有可见形变；停用和脱下后可见布面消失，重新穿上恢复。未给版型和接触签署通过。

源码只读核对发现，18854 使用 plain、无 wind；本目录原生压力回放使用 pleated、pleatDepth=0.045、wind={x:0.15,z:1.1,gust:0.25}。宽高、材质、质量和代理输入一致。上述穿入数值属于原生压力回放配置，不能直接标为编辑器画面的实测穿入；浏览器截图也不能反证这些三角面采样结果。当前画面的大块布面起伏可见，细褶皱尚未单独验收。

本轮没有从浏览器取得有效 CPU/rAF/GPU 计时，也未独立执行设备限速。编辑器另有全预览 CPU 自动降级，其阈值为 normal=12、low=16.7、hard=75 ms，预热 12 帧；它与布料侧每块 0.75 ms 目标的计时范围不同。离线合成降档测试不替代编辑器慢设备验证。编辑器席的报告与本轮独立证据分别保留。

独立复查最终完成：fixtures 6/6、原生 4/4；额外验明 low 为 35 顶点、1 mesh、3 代理、4 native bodies，off 后 solver/mesh/代理/native bodies 全部释放。详见 `evidence/independent-review.json`。

复跑原生诊断：

```sh
node_modules/.bin/vitest run --config handoffs/game628-cape-runtime-cloth-20261120/runtime-vitest.config.mjs
```
