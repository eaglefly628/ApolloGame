# G628-CAPE-A-AVATAR 联合试玩

[打开 18854 本机候选](http://127.0.0.1:18854/?scene=avatar-studio)。先选「纤瘦」或「圆润」，点「试披风」和「试穿披风」。方向键行走，松键停步，换方向转身。向画面深处走，再松键，可以从背面看披风。「挥手」使用同一角色已有的挥手片段。标准、低档、停用会分别选择 96 面、48 面或移除布体。脱下后可以重穿。匀称体型的版型待拟合。

脸部、体型、帽子、手形及草稿预览、应用、重置沿用 18851 候选。试穿台与外观编辑在同一个场景内，切换时保留外观数据。运行时、布料版型及装配均由本目录的隔离快照构建。

## 联合结果

| 检查 | 结果 |
| --- | --- |
| 真实布面与生命周期 | Chrome 在两种体型均测到标准布增加 96 个绘制面、低档增加 48 个、脱下和停用回到零。验证了重新试穿。 |
| 走、停、转、挥手 | 两种体型均实际行走，松键后根停止，反向和背向转身正常。动作中布面持续被绘制，编辑器挂接 generation 保持。引擎的独立原生验收另核对了 Jolt 实例和历史。 |
| 慢档 | 320 px 的 Chrome 预览在 16 倍 CPU 限速下因持续超预算自动进入低档，Chrome 实测绘制 48 面。编辑器还用受控采样测试了再次超预算退到停用、重新明确选择标准后的恢复。 |
| 肩部与坐标 | 三种体型各全量采样 968 帧，覆盖 idle、walk、wave。引擎在动作完成后为同一帧消费双上臂近端扣点。 |
| 贴合 | 布料侧的 10 mm 接触目标仍未通过。详见布料报告，Chrome 中也能看见部分姿态的布边穿入。此版供联验。 |

自动降档读取现有 ThreeRenderer 的**整帧 CPU 平滑值**。标准档连续 8 次超过 12 ms 转低档，低档连续 8 次超过 16.7 ms 停用，单次超过 75 ms 直接停用。切档和重穿后的前 12 个有效样本用于预热。界面勾选显示实际档位，主动选择可重新尝试。Chrome CPU 限速用于测试策略，布料单独的 CPU 时间见布料线 Node 记录，GPU 时间待实机测量。

- [共同交换契约与坐标说明](CONTRACT.md)
- [快照指纹](inputs/source-fingerprints.json)
- [两种体型走停转及档位的浏览器记录](evidence/joint-browser.json)
- [肩点米制复测](evidence/shoulder-space.json)
- [引擎候选原生验收](../game628-cape-runtime-engine-20261120/README.md)
- [布料接触诊断与 10 mm 目标](../game628-cape-runtime-cloth-20261120/evidence/runtime-contact.json)
- [纤瘦标准档](evidence/slim-normal.jpg)、[圆润标准档](evidence/full-normal.jpg)、[圆润挥手](evidence/full-wave.jpg)、[限速低档](evidence/slow-device-tier.jpg)

## 复跑

双击 [启动本机候选](start-face-preview.command)。从 ApolloGame 根目录执行下面的检查。

```sh
node handoffs/game628-cape-runtime-editor-20261120/measure-cape-contract.mjs
node_modules/.bin/vitest run -c handoffs/game628-cape-runtime-editor-20261120/face-studio-20261120/vitest.config.mjs
node_modules/.bin/tsc -p handoffs/game628-cape-runtime-editor-20261120/tsconfig.json --noEmit
node_modules/.bin/vite build -c handoffs/game628-cape-runtime-editor-20261120/vite.config.mjs
node handoffs/game628-cape-runtime-editor-20261120/verify-joint.mjs
```

浏览器检查需要 Chrome 及本机 18854 服务。正式共享落地仍需共享施工锁和布料贴合复验。
