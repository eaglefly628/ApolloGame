# 能力总览 Capability Plan — game-c《六人德州》（草案 v1）

> GD-C 2026-07-17 提交 · **⏳ 待 Lead 评审备案**。
> **⚖ owner 口径（2026-07-17 拍板·本项目专用）：本次开发允许用 TS 写游戏层代码**——四缺口中 ①摊牌比较 ②下注圈/边池 ③行为树
> 依此落为 **game-c 内 TS 模块**（§4 例外表逐条列明·测试钉死），不占引擎池槽（池现 10/10 满）；④角色卡通道仍需跨域（PST）。
> **不因 TS 口径放松的硬线**：种子 PRNG（禁裸 Math.random）、禁手写 DOM（UI=LayoutNode）、sim 确定性、零测试不出货、render-only 不回流。
> 依据：owner brief（`README.md`）+ GDD v0（`gdd.md`）+ 引擎现货盘点（本日全库探查，文件:行号见各条）。
> 落地后 `node scripts/game-skill-audit.mjs game-c` 核偏差。

## 1. 游戏一句话

单人 vs 五位姨太 AI 的六人桌**标准德州扑克·现金局**（owner 拍板）：俯视固定 3D 牌房（牌桌+六凳），筹码 render-only 物理落桌；
**衣物典当续命·剥光才出局**（每件衣物=一条 craft-recipe 配方）；AI=行为树，难度=读牌误差 %（简单档禁读）。参照 Prominence Poker 单机局。

## 2. 消费的引擎能力（对照 `capability-registry` 实名）

| capability（注册 id）/ 组件 | 用来做什么 | 状态 |
|---|---|---|
| `w1-random`（`RandomSeed`+`seededShuffle`/`nextRandom`） | 洗牌、AI 混合策略掷点、oracle 噪声（**游戏层禁裸 Math.random**） | ✅ 现有 |
| `t2-card-pile`（`CardPile` 预洗牌码+手牌） | 牌库→发底牌/公共牌（lockstep 安全；牌码沿 `suit*100+rank`,A=14） | ✅ 现有 |
| `t3-poker-hand`（`PlayedHand`→判型·`HAND_TYPE_ORDER`） | 摊牌时对"7 张中选出的 5 张"判型；强弱枚举复用 | ✅ 现有·需扩展（缺口①） |
| `t3-flow`（`GameFlow` 数据 FSM） | 两级流程：局级（SNG 级别/淘汰/冠军）+ 手级（deal→preflop→flop→turn→river→showdown→payout→rotate）——照 game-f 两级先例（`game-f/blueprint.ts:94`） | ✅ 现有 |
| `e1-timer`（`Timer`/`TimerDone`） | 行动倒计时、盲注升级计时 | ✅ 现有 |
| `resource-apply`（`Resource`） | 六家筹码栈、底池/边池、当前注、盲注级别、加注增量 | ✅ 现有 |
| flag / string-variable / state | 行动轮状态、按钮位、AI 性格/难度参数、当前牌型名 | ✅ 现有 |
| `event-when` + condition | 阶段触发接线（如全员行动毕→进下一街的信号面） | ✅ 现有 |
| `t2-effect-apply` / `t2-craft-recipe` | 盲注扣缴、原子多项筹码结算；**衣物典当=每件一条配方**（信号→原子扣衣物+加筹码·§3.5 机制零新代码） | ✅ 现有 |
| `t2-clickable` + keybind + LayoutNode 信号 | 行动条输入（fold/check/call/raise+尺度） | ✅ 现有 |
| UI：LayoutNode 34 控件闭集 | 行动条/座位铭牌/底池/结算面板（PUI 域·缺件报 PUI） | ✅ 现有 |
| 3D：`Mesh3D`+`Material3D`(preset)+`Transform3D`+`Light3D`+`Sky3D` | 房间/牌桌/六凳/筹码堆几何生成（game-z 路 `game-z/diorama.ts:22`） | ✅ 现有·render-only |
| `Camera3D`（ortho 俯视配方 `game-d/rooms.ts:231`） | 固定俯视相机（pitch≈0.99·不切视角） | ✅ 现有·render-only |
| `RigidBody3D`(cylinder)+`Impulse3D`+`Joint3D` | **筹码抛掷落桌物理**（懒加载 cannon-es·`renderer/three/physics.ts:29`） | ✅ 现有·render-only |
| `Vfx3D`/`Trail3D`/`Decal3D`/`Billboard3D`/`WorldUI3D` + `LayoutNode.fx` + prefab+caster+tween | 发牌滑弧/翻牌/胜者聚光/座位世界铭牌/UI 特效 | ✅ 现有·render-only |
| `AudioPort`（`SynthAudioPort`+`SfxSpec`·`SynthMusicPort`） | 洗牌/发牌/筹码/翻牌/allin/胜利音 + BGM（声音=数据·样例 `game-g/sfx.ts:35`） | ✅ 现有 |
| **德州摊牌比较**（7 选 5 最优 + 同型 kicker 全序值·复用 `HAND_TYPE_ORDER`） | 六家摊牌定胜负/平分 | 🟢 game-c TS 模块（owner TS 口径·§4-a）；攒出第二消费方再议下沉 |
| **下注圈/边池状态机** | 轮转/min-raise/all-in 关圈/边池切层 | 🟢 game-c TS 模块（§4-b） |
| **行为树**（节点=数据·条件叶复用 ConditionExpr 语汇） | AI 下注决策骨架（owner 点名 BT） | 🟢 game-c TS 模块（§4-c） |
| **角色卡 player 通道**（meta→蓝图→Text/Sprite） | 外部带入主角姓名+头像（立绘字段预留） | ⏳ 唯一跨域缺口（REQ-C-104·PST 协同·本目录 `requests.md`）；游戏侧先留注入点不阻塞 |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| 盲注级别表（SNG） | 级别→(小盲,大盲,升级手数/分钟) | `flow`+`timer`+`resource`（现成） |
| 桌面轮转/座位表 | 6 座、按钮轮转、死按钮规则 | game-c TS 模块 §4-b（config 驱动） |
| 下注规则 | min-raise、不足额 all-in 不重开、行动闭合 | game-c TS 模块 §4-b（config 驱动） |
| 摊牌/平分规则 | 7 选 5、kicker、奇数筹码给前位、muck | game-c TS 模块 §4-a（纯函数） |
| AI 性格表 ×5 | 进池率/激进度/诈唬频率/oracle 权重（紧凶/松凶/岩石/跟注站/诈唬狂） | game-c TS 模块 §4-c（BT 数据 config） |
| 难度表 | easy=oracle off · normal=±30% · hard=±10%（owner 可调） | 同上（oracle 输入=§4-a 的强度百分位+种子噪声，**不做蒙特卡洛**） |
| 加注尺度表 | 1/2 池 · 2/3 池 · 满池 · all-in | BT 动作叶参数 |
| 衣物典当表（每角色：件目/面值/初始状态） | 耳环/手套/袜子/上衣/裙子/内衣…（GDD §3.5·数值待调） | `t2-craft-recipe`（每件=一条配方·现成）+ UI 信号（现成）；AI 典当阈值=BT config §4-c |
| 音效表 | `SfxSpec` 闭集数据 | `SynthAudioPort`（现成） |
| 特效库 | `PrefabTemplate` 组 + `LayoutNode.fx` | prefab+caster+tween / UI 渲染器（现成） |
| 房间布局 | 桌/凳/灯坐标 + Material3D preset | 蓝图实体数据（现成） |

> 红线自检：表中三个解释器为**游戏层 TS 模块**——依 owner 2026-07-17「本项目允许 TS」口径入 §4 例外表逐条记账（**非**默认「数据表+游戏层解释器」违宪形态；口径见文件头）。其余表的解释器全部是现成引擎能力。

## 4. 申请的游戏层代码例外（逐条记账·owner TS 口径下放行，Lead 备案）

| # | 例外 | 归属与纪律 | 预计行数 | 裁决 | 偿还计划 |
|---|---|---|---|---|---|
| a | `holdem-eval.ts`——7 选 5 最优 + kicker 全序值 + 平分（**纯函数**·复用 poker-hand `HAND_TYPE_ORDER`/牌码） | sim 内确定性纯函数·测试点名全牌型/kicker/平分边角 | ~100 | 🟢 owner TS 口径 | 攒出第二消费方（如 game-g）再议下沉引擎 |
| b | `betting-engine.ts`——下注圈状态机（轮转/min-raise/不足额 all-in 不重开/行动闭合/边池切层/死按钮） | sim 内确定性·config 驱动·测试点名多 all-in 边池矩阵 | ~250 | 🟢 owner TS 口径 | 同上（德州二作再下沉） |
| c | `poker-bt.ts`——行为树微解释器（节点=数据：selector/sequence/条件叶/动作叶）+ 性格/难度 config + oracle（强度百分位+种子噪声） | sim 内确定性（掷点全走 RandomSeed）·AI 对 AI 万手 sim 验非退化 | ~150 | 🟢 owner TS 口径 | BT 若被第二游戏要→提 Lead 下沉通用 capability |
| d | 薄 session 编排脚本（照 game-e/d 先例：仅编排「发牌→行动信号→tick→读结果」接线，不含规则/比牌/AI） | 线性编排=宣言明许形态 | ~120 | 🟢 先例 | 常驻·同 game-e |
| e | 3D 表现驱动（`engine.subscribe` 内 render-only：底池变化→筹码 `Impulse3D` 抛掷/发牌滑弧/胜者聚光） | render-only（P3D 域件消费·NON_DETERMINISTIC·不进 hash）；game-d 同款先例 | ~150 | 🟢 先例 | 常驻·渲染线 |

> 审计红旗自检：裸随机=无（全走 w1-random）；手写 DOM=无（LayoutNode）；零能力接入=本 plan 即防；测试=M1 起逐阶段钉死（边池/kicker/轮转边角全点名）。

## 4.5 美术接入

- **3D 主体（桌/凳/筹码/房间）**：game-z 几何生成路（`Mesh3D`+`Material3D` preset+`SurfaceDetail`）起步——此为**程序化回退基线**；桌面呢绒/木纹等贴图槽后补真图即换装。
- **皮肤槽清单（主体视觉必有槽）**：52 张牌面 + 卡背（`Decal3D`/`Sprite.textureKey`）、筹码面额贴图 ×5、头像框、主角头像（角色卡带入）、五名姨太头像、**衣物件目图标 ×6 类**（典当面板用）。
- **台账**：`public/games/game-c/art/art-ledger.json`（requirements 模式起步·推导脚本拟 `scripts/game-c-art-ledger.mjs`·照 game-q 样板）。
- **程序化例外申请**：凳子/房间墙地不设贴图槽（几何+preset 已达盒庭观感·贴图收益低）——Lead 裁。

## 5. 确定性声明

- 随机源：`RandomSeed` 世界单例·run-seed 开局播种；洗牌 `seededShuffle`；AI 混合策略与 oracle 噪声同源同序。
- 单人无 lockstep 需求，但 **sim 全确定**（回放/测试/bench 双跑 hash）；AI 决策在 sim 内全种子化。
- render-only 旁路（不进 hash、不回流 sim）：筹码物理（落点纯表现，**筹码数量永远是 sim Resource**）、特效、相机、音频。

## 6. 评审记录

- 提交人 / 日期：GD-C / 2026-07-17
- Lead 裁决：⏳ 待审
