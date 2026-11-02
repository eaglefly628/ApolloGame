# M3.5 联合接线阶段复查

本批基于 `11b274bc2`，目标是让固定时钟、移动、分层表演、根运动和交互约束在同一个 World 中工作，并能在导演台检查。属于阶段源码交付；REQ-3D-MOTION-DRIVER-M35 继续 in-progress。

## 主要入口

| 范围 | 源码入口 | 需要复查的行为 |
|---|---|---|
| D1 条件转换 | `src/engine/animation/driver.ts` | AND、优先级、最短停留和实际非循环 clip 完成；保留旧配置行为 |
| D2c 身份 | `src/engine/host/locomotion-character.ts` | 实际模型字节、rest、selector、scale、profile 与来源 SHA 绑定；身份通过不批准美术 |
| D3 表演 | `src/engine/animation/performance-driver.ts` | 槽位、段落、打断、显式 mask、override/additive 顺序、实例事件身份 |
| D4 移动 | `src/skills/tier2/root-motion-plan.ts` | 同 tick source/motor 事务、碰撞接受量、无受阻债务、配对去根 clip；拒绝混合中的根来源 |
| D5 交互 | `src/renderer/three/bone-sockets.ts` | rest 标定的掌坐标、道具 Socket 端点和朝向、动态 IK、显式不支持状态 |
| 表情 | `src/renderer/three/facial-animation.ts` | 实际 morph、演员隔离、base 恢复、资源释放和复用；缺 morph 拒收 |
| 事件 | `src/skills/tier2/animation-cue-signals.ts` | Cue→既有 Signal/Effect 系统，确定性身份、清理与分阶段投递 |
| D6 导演 | `src/runtime/cinematic-preview.ts`、`tools/motion-workbench/driver-client.ts` | 整个 World 暂停/步进/重放、拒收回滚、切角色及原生就绪诊断 |

## 已复现并修复的接缝

- 多次 `Engine.load` 重复安装 Cue 系统会使定序成环；同引擎只安装一次，独立演员仍有各自事件。
- 字典继承的 `constructor` 等名称不能冒充已声明的 Socket。
- 根来源快照在访问字段前拒绝 getter 与额外字段；原生调用方仅传声明的四种快照。
- incoming 权重为零而 outgoing 根动作仍有权重时，不能静默当成根动作已退出。
- `ModelPool.dispose` 后复用需要新的 Face helper；GLB 解析使用字节快照，测试比较内容而非旧 buffer 身份。
- 390px 导演面板的 padding 与宽度叠加曾造成横溢，已用实际浏览器复验关闭。

## 复查与证据范围

独立复查覆盖 D3/D4/D5 原生接缝、D4 World 事务、Cue 桥和 D6 UI/server；复查包含独立复跑、带唯一命中断言的撤修验红、恢复和告警检查。源码冻结与逐项判词保存在本机 `~/ApolloAssets/motion-review/m35-checkpoint-20261102-driver-joint/`，不把不同冻结版本的结果混为当前全量门禁。

实际 GPU 有限样本：Y Bot、Claire、Amy、Sporty Granny 各 181 帧的走/停/挥手；1440px 与 390px 视口，播放、暂停、逐帧、定位、复位和换角色。另有合成 GLB 的受墙阻根位移、实际 morph 和 Socket 端点/朝向探针。它们分别证明对应的技术行为，不签全体型美术、穿插、接触或脚滑质量。

全量执行入口为 `node scripts/scoped-gate.mjs --run --base HEAD`；定向入口为相关模块 `.test.ts`、`tools/motion-workbench/driver-server.test.mjs`，以及 `scripts/verify-{animation-performance,bone-sockets,root-face,locomotion-character}-browser.mjs`。推送前必须取得共享引擎全量门禁退出 0；本文件不以专项测试总和代替全量结果。

## 留在当前总项中的验收

1. 连续场景：走入、停稳、坐下、擦火柴/取暖、起身离开；多 Skin 逐帧检查脚底、手部、道具和身体穿插。
2. 已制作双人抱持动作的共享时间、锚点及支撑/穿插检查；缺动作回 M6 制作，共享锚本身不产生承重动画。
3. 真实素材标定的可信审核与使用闭环，以及 M4/M6 对导演模板的消费。当前本机 profile 仍为候选。
4. 一般斜坡不在可选静态 AABB box-step 的证明范围；不能把有限台阶策略写成通用地形验收通过。

真实 FBX、GLB、截图和预览数据均仅在本机，不随代码提交。
