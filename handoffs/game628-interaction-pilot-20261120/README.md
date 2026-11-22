# Game628 梧桐街面包房交互试点

2026-11-20，owner 已判 A。交付范围为通用交互能力的隔离本地候选、两个近邻目标的契约验证和可玩的面包店场景。正式共享层尚未接入。

试玩入口为 <http://127.0.0.1:18847/>。服务仅监听本机。方向键或 WASD 行走，E 确认与推进，Esc 取消，Tab 和 Enter 选择按钮。初始位置面向面包房店主。向右经过他后会朝向隔壁店主，可以验证两位近邻的选择。店主站在店前是本试点的明确布置，不代表已回写原街区或正式 RC。

| 产物 | 位置 |
|---|---|
| 本地候选能力 | `interaction.ts`，ID `t2-interaction`，版本 `0.1.0` |
| 实际执行源码副本 | `runtime/src/skills/tier2/interaction.ts`，与候选逐字一致 |
| 隔离注册 | runtime 内静态 `capability-registry.ts` 和异步 `capability-registry.gen.ts` |
| 游戏数据 | `scene.json`，包含两位店主、三个/四个对话节点及独立 State |
| UI、输入与焦点桥 | `host.ts`，消费原有 LayoutNode、resolveDialogue 和 QueuedInputSource |
| 冻结基线 | `snapshot.json`，记录源 HEAD `3e6569c26` 及所复制的本地源码指纹 |
| 自测与独立用例 | `interaction.test.ts`、`independent-review.test.ts` |
| 独立复查记录 | [INDEPENDENT-REVIEW.md](INDEPENDENT-REVIEW.md) |
| 最终画面 | `evidence/dialogue.jpg` |
| 命令结果与交付指纹 | `verification.json` |

最小契约如下。

- 玩家实体挂 `InteractionAgent`、`Transform`、`FaceDir`、`Velocity`。radius 使用世界坐标单位，minDot 为 0..1 的面向余弦阈值。本试点采用二维模拟平面，表现层映射到三维街区地面；没有扩展遮挡检测或任意三维交互。
- 目标实体挂 `InteractionTarget` 和真实模拟位置。它声明 enabled、priority、dialogueEntity、entry、inactive。候选必须有有效接收者、脚本自有 entry 节点，并位于半径与朝向范围内。不可见/禁用目标不入选。
- 多目标按 priority 降序、距离平方升序、实体 ID 字符串升序确定唯一目标，创建顺序不参与裁决。
- `interaction.confirm`、`interaction.choose`、`interaction.cancel` 进入原有 InputQueue。仅匹配所属玩家 source。物理确认使用 down/up 持有锁，UI 使用 action，同 tick 多次确认合并一次。UI 的独立点击仍是独立动作。
- Intent 阶段选目标并打开会话，首个确认只设置起始 State。后续确认在选中接收者上创建 `DialogueAdvance`，选择创建 `DialogueChoose`，由原有 `t3-dialogue` 消费。不发送全局 dialogue.advance/choose，因此附近另一个对话机不会被此路径推进。
- 有会话时，在 motion-apply 前清零玩家本拍速度，取消或结束当拍也保持锁定，下一拍恢复连续输入。没有改玩家原速度配置。结束需对 goodbye 再次确认，让最后一句可读。
- 会话保存接收者 ID 与 inactive 游标，目标被销毁后仍能释放旧对话机。目标被隐藏、禁用、移出半径、接收者消失或当前节点失效时关闭会话。取消和关闭不会在同一 tick 重新打开别的店主。
- UI 只读 State/候选并发送具名动作。KeyboardInputSource 继续产生 down，宿主的通用 keyup 桥补 up。对话首句的推进按钮接管焦点，选项出现时聚焦首个按钮。结束归还原可用焦点或交谈按钮；目标失效导致交谈按钮不可用时兜底可聚焦场景面板。

角色、建筑与纹理从当前生活街区候选复制到本目录的忽略目录，保留原来源，不覆盖原始资产。本轮不含买卖、库存、任务、好感奖励和存档产品接线。

测试和复查结果如下。

| 验证 | 实际结果 |
|---|---|
| 最终组合测试 | 21/21，通过；含 13 个施工用例与 8 个独立用例 |
| TypeScript | 本地候选与宿主检查通过 |
| Vite production build | 本地试点构建通过；保留既有 Jolt node:module 浏览器外部化和大 chunk 警告 |
| 独立对抗复查 | 先复现并修复继承节点误收、目标销毁后旧接收者未释放、空选项误选 0；补 inactive 原型链回归 |
| 撤修验红 | 独立副本精确撤掉朝向守卫，背向用例实红；没有改施工目录 |
| 浏览器实际操作 | E 首句、运动锁期间推进、Tab/Enter 选择、终端确认结束、焦点归还、再次交谈、Esc 取消、背向 E 拒收、移动至另一近邻并只显示其台词 |
| 布局目击 | 1280×720；最终根面板下沿 720，确认按钮下沿 640，焦点为 talk-confirm |

目标销毁和远距离释放主要由真实引擎无头测试覆盖，没有在浏览器中增加破坏 NPC 的调试按钮。浏览器移动锁也由模拟测试核对无位移。独立复查签署能力层，实际浏览器操作与截图由施工主控记录，未冒充另一人已做整场视觉复查。未做全库门禁、正式 Steam/RC 构建或广泛设备适配验收。

复跑时从仓库根目录执行。

```sh
./node_modules/.bin/vitest run --config handoffs/game628-interaction-pilot-20261120/vite.config.mjs
./node_modules/.bin/tsc -p handoffs/game628-interaction-pilot-20261120/tsconfig.json --noEmit
./node_modules/.bin/vite build --config handoffs/game628-interaction-pilot-20261120/vite.config.mjs
./node_modules/.bin/vite --config handoffs/game628-interaction-pilot-20261120/vite.config.mjs
```

正式集成的具体阻塞是 CLAUDE.md「抢锁者做」要求新增共享 system 开工先修改工单施工主体并推送一次。本次委派明确不含 Git 推送，同时明确允许权限不足时做隔离本地试点，所以所有候选实现和注册发生在冻结副本，未修改共享 src、原生活街区或 RC，未擅占共享需求池槽位。正式共享层施工需要远程工单占用授权及确认主程归属，然后在目标主干对齐版本，补齐组件映射/生成守卫并跑项目要求的全量门禁。局部结果不能替代这一步。

PM/场景线届时只需确认当前生活版目标入口、店主实体及站位、实际朝向约定、互动半径和动作键占用，再把本试点的数据接入正式版本；无需另造对话运行器。本单没有重复派发其他施工任务。
