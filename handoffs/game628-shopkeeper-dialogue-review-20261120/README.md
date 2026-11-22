# Game628 面包房店主对话接线审查

日期为 2026-11-20。施工/评估主体为当前 engine dev 会话，仅持有本目录。依据委派要求，保留生活街区的宿主、人物、场景和其他在途成果。此目录交付只读能力差距说明与独立可运行的契约探针，没有修改共享能力，没有提交推送，没有创建可见聊天。

结论为完整交互门禁尚不能由已核对的闭集数据直接表达。本轮采用委派允许的差距说明路径。已有对话图、选项和 UI 投影可以复用，但“靠近且面朝指定店主”中的实际朝向判定缺少条件消费端。单靠区域占据会允许背对店主交谈。因此没有把不满足朝向验收的按钮对话标为可玩试点。

核对对象是 `/Users/junbaili/Documents/GitHub/ApolloGame` 的 `codex/mainbranch` 本地在途工作树，HEAD 为 `3e6569c26`，不是最新远端的全新检出。相关功能逐项查了本地静态和生成注册表、events-logic / UI / movement 手册、组件契约和实际消费代码。缓存远端注册入口亦未查到通用交互目标或对话会话锁。本轮不把缺失字段或未接入的宿主桥接当作能力已交付。

| 需求 | 准确能力或模块 | 实际消费位置 | 判断与验证入口 |
|---|---|---|---|
| 靠近一位固定店主 | Tier2 `t2-zone-occupancy`，Zone.requiredEntities / requiredTag → Flag | `src/skills/tier2/zone-occupancy.ts`，区域比较读取 Transform | 固定单店主的范围门可用。`zone-occupancy.test.ts` 与本目录 probe 的超距测试 |
| 读取空间邻居 | 原子 `w2-spatial-query` | `src/skills/atoms/spatial-query/index.ts` | 是空间查询底件，不能据其存在推断具备面朝目标选择、遮挡或交互优先级解释器 |
| 玩家朝向 | Tier2 `t2-facing`、`t2-face-rotate` | `src/skills/tier2/facing.ts` 写 Transform.scaleX；`face-rotate.ts` 写 FaceDir | 均从速度或 Relation 推导方向。ConditionExpr 不读这些字段。方向变化而 Zone 保持成立已实证 |
| 条件组合 | `t2-event-when`、`t3-flow`、`t2-effect-apply`、原子 `j1-state` | tier2/event-when.ts、effect-apply.ts，tier3/flow.ts；`src/engine/logic/index.ts` 求值 | 可组合距离 Flag、待机/交谈 State 和确认意图。条件叶只含 resource/flag/state/timer/string/cooldown，缺实际朝向叶子 |
| 移动和动作输入 | 原子 `i1-input-capture`、`i2-action-map`、`i3-controllable`；Tier2 `t2-keybind` | `src/net/host/local-input.ts`、queued-input.ts → commands.ts 的 applyMovement/applyRawActions → tier2/keybind.ts | action-map 与 controllable 是声明面，不能把它们当对话锁。KeyboardInputSource 的离散动作是 phase=down；对话消费者仅认 phase=action。仅把按键命名为 dialogue.advance 不会推进 |
| 对话行、选项、条件选项 | Tier3 `t3-dialogue`，DialogueScript + State，DialogueAdvance/Choose | `src/skills/tier3/dialogue.ts:readDialogueActions` 与 dialogue system | `dialogue.advance`、`dialogue.choose` 读取单例 InputQueue，后者读 x 或 arg。没有 NPC 目标参数，同动作会推进所有当前节点有效的对话机 |
| UI 桥接 | LayoutNode `dialog`、`choiceList`、`portrait`，resolveDialogue，mountUI ActionSink | `src/ui/components/bindings.ts`、render.ts、server.ts；实际示范 `games/game-i/dialogue-world.ts` | 有真数据投影和可用按钮，UI → QueuedInputSource.enqueueAction → action 队列可用。属于 UI/宿主模块，没有独立 Tier capability ID |
| 移动锁、镜头保持 | 未找到统一对话会话锁能力；现有 modifier-stack/stat-bind 可投影 Controllable.speed，原型 host 有 view.enabled 换街门 | `src/net/commands.ts:applyMovement`、`src/skills/tier2/stat-bind.ts`、生活原型 host.ts | 对话不会自动锁移动。原型 view.enabled=false 会连取消输入也挡掉，不能直接整段复用。静止时 Camera3D.follow 可保持视角，但无本轮对话镜头恢复证据 |
| 取消、结束及再次交谈 | `t3-flow` + `t2-keybind` + `t2-effect-apply` 可声明专属状态及复位 | `dialogue.ts` 的 next=null 不改游标，也不发关闭信号；没有内建 dialogue.cancel 消费 | 有条件重组空间，必须显式编排。终端行、取消、重复会话不能靠运行器自动完成，见探针 |
| 焦点接管与归还 | mountUI 的已有事件桥；未找到对话专属 focus ownership 协议 | `src/ui/components/server.ts` 有文本输入焦点保留及 modalClose；render.ts 的 dialog 是可点击 div | dialog 自身无 tabindex。choiceList 使用真按钮，但更新布局后的焦点接管/归还与 Escape 路径仍需验证，没有统一能力 ID |

一位面包房店主可用单一 DialogueScript，未交谈时将 State 置于脚本外的 inactive 游标，确认后置 greeting，取消/结束显式复位。这样可以利用现有图解释器，避免另外写节点运行器。仍需证明确认动作在开始那一拍不会同时消费为 advance，并让下一个会话必须等按键释放后重新确认。加入第二位店主前要证明唯一活动对话约束；本轮没有扩第二位。

本地行为探针中使用面包房三节点数据 greeting → ask(choice) → goodbye，但它是无头契约测试，不是已接入街区的试玩入口。测试了下面七件事实。

1. phase=down 的同名键盘动作不会推进，phase=action 可以推进。
2. 同一 tick 的两条 advance 合并成一次推进。此事实不代表跨 tick 自动去重或会话启动去重。
3. 两个有效对话机收到同一 advance 会同时推进，证明 NPC 目标隔离要额外建立。
4. next=null 的行保持当前节点；无专门数据接线时 dialogue.cancel 不生效。
5. 固定位置反转 FaceDir 和 scaleX，Zone 仍为 true；走出范围后才变 false。
6. 有有效对话节点时 applyMovement 仍写出非零速度，证明不存在自动移动锁。
7. dialog 生成带 data-action 的 div，无 tabindex 或 button，证明不能依赖它天然完成键盘焦点接管。

可复跑命令如下，全部操作位于本评估目录及只读引擎代码。

```sh
./node_modules/.bin/vitest run --config handoffs/game628-shopkeeper-dialogue-review-20261120/vitest.config.mjs
./node_modules/.bin/vitest run src/skills/tier3/dialogue.test.ts src/ui/components/dialogue.test.ts src/skills/tier2/keybind.test.ts src/skills/tier2/zone-occupancy.test.ts src/net/host/local-input.test.ts src/skills/tier2/facing.test.ts --exclude 'handoffs/**'
```

已有模块测试用于核实可复用底件，不能当作实际街区的玩家行为验收。按键启动、按错 NPC、取消释放、重进会话、焦点归还和镜头恢复的街区端到端验收尚未完成。没有浏览器试玩 URL，没有交易、任务、奖励或存档改动。

实际运行结果为本目录 7/7 契约探针通过，以及排除 handoffs 历史镜像后 src 下 6 个文件共 58/58 通过，两条命令退出码均为 0。探针通过表示记录的现有行为被复现，包括能力边界，不能解释为对话需求的七项验收通过。未跑全库构建，也没有将此单记成独立产品复查通过。

按 CLAUDE.md 缺口裁决协议，下面两条是待 owner 裁决的路径，没有先行施工或替 owner 判词。

| 路径 | 具体内容 | 成本、影响与选错代价 |
|---|---|---|
| A，推荐 | 由引擎线提出最小通用空间交互契约，读取玩家实际朝向与候选目标，按距离/朝向输出唯一可交互事实及目标 ID；会话与输入桥尽量复用现有图、flow 和 UI | 相比宿主特例需要共享契约、调度/确定性和多目标回归审查，但可复用于邻居、门、招牌。范围应保持单店主验证所需，避免预做完整 NPC 框架。新能力名称/ID 尚未分配 |
| B | owner 明确批准一个仅限本地 Game628 的宿主交互适配例外，处理实际距离/朝向、输入 phase、会话持有和焦点，剧本仍用 DialogueScript | 首个本地演示通常接线较少，但游戏规则下沉到宿主后增加重复实现、录放与后续移植债务。此项属于原规则下的例外，需要明确批准，不能仅凭“隔离”视为已授权 |

本轮未占用共享需求池槽位、未变更已有工单锁。确需集成时，只需 PM/场景线提供当前可冻结的入口与场景数据、面包房店主实体 ID/站位/正面方向、互动半径和现有动作键占用。然后对本单的输入、目标事实、会话 State 和 UI 投影接口做一次合并。本轮不另发重复施工单。
