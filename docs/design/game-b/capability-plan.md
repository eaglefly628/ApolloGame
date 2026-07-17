# Game B ·《雀宴》能力总览 Capability Plan（S2 送审稿）

> GD-B 2026-07-17 交（模板=`docs/design/capability-plan-template.md`）。**⚖ owner 2026-07-17 拍板：本项目允许 TS 写 code**——游戏层例外仍逐条列（§4）、审计红线一体适用；Lead 复核记档后 S2 关灯。
> 能力实名以 `capability-registry` describe/examples 机读为准，本表不手抄字段。

## 1. 游戏一句话

俯视 3D 和风日麻陪打局（东风战·直击脱衣·金钱带进带出），参照物=雀魂式规则完整度 × 陪打小游戏体量。

## 2. 消费的引擎能力（对照 registry 实名）

| capability | 用来做什么 | 状态 |
|---|---|---|
| 种子 PRNG（RandomSeed/nextRandom/seededShuffle） | 洗牌/掷骰/AI 犯错注入——**一切随机** | ✅ 现有 |
| 3D 渲染线组件（Mesh3D/Model3D/Transform3D/Camera3D/Light3D/Vfx3D + 实例化） | 桌/136 牌/骰/点棒/背景件/灯光 | ✅ 现有 |
| Camera3D 运镜过渡（设目标机位+bump trigger→渲染器平滑切） | 机位表演出（主机位/立直推近/和牌俯冲/脱衣特写/掷骰特写） | ✅ 现有（2026-07-17 核实 `components/render.ts` Camera3D） |
| Pickable3D + pick() 射线拾取（render-only 输入层·信号名·照 2D clickable 先例） | 3D 手牌/牌河点击出牌 | ✅ 现有（2026-07-17 核实 three-renderer） |
| LayoutNode UI 闭集 + sakura-otome 主题 | 全部 HUD/面板/按钮/字幕（§场景交接档 §四） | ✅ 现有 |
| timeline（t3） | 掷骰/和牌/脱衣演出编排（机位+立绘+粒子时序） | ✅ 现有 |
| dialogue（t3·DialogueScript） | 姨太台词/闲聊触发的声明式脚本 | ✅ 现有 |
| event-when/condition/effect-apply/flag | 脱衣状态机/结算钩子/局面旗标 | ✅ 现有 |
| l4-sound + SynthAudioPort/SynthMusicPort | SFX/BGM（和风音色表）+语音占位提示音 | ✅ 现有 |
| storage | 局设置/会话结果本地持久化 | ✅ 现有 |
| EffectKind 粒子（樱瓣等） | 脱衣/和牌演出点缀 | ✅ 现有 |

### 2.5 缺口（需下沉/新增·S2 过审后由 Lead 开引擎单裁槽）

- **a. 语音输出端口（两档同接口）**——⚖ owner 2026-07-17：音源包暂无，先用语音合成发声。档① TTS=speechSynthesis 朗读日文台词（ja-JP·零资产即时可用）；档② 采样播放=将来配音 wav（现音频线纯合成，采样=audio 手册明示缺口）。两档一个接口（事件键→发声），表现层非确定性旁路、不进 sim、headless/无音色时静默降级（同 SynthAudioPort 哲学）；**做成引擎 services 端口，不在游戏层手写**。端口未落地前以合成提示音+字幕占位，不阻塞 S3-S5。**→ 已提主池 `REQ-VOICE-语音输出端口`（2026-07-17·P1·LEAD）。**
- **b. 行为树解释器**——引擎无 BT；v1 按 §4 在游戏层 TS 实现（记下沉债·将来泛化为通用 AI 能力·**不占主池槽**——成熟后走 capgap 提案）。
- ~~c. 机位表切换语义~~ **回驳·已覆盖（GD-B 2026-07-17 核实）**：Camera3D 自带运镜过渡（目标机位+bump trigger 平滑切）+ Pickable3D 射线拾取——机位表=Camera3D 预设参数组（纯数据），无需新能力、不提单。

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| 规则 config（gdd §四） | 规制/起点/击飞/赤宝牌/食断等开关 | 游戏层麻将核（§4 例外·记下沉债） |
| 役表+符番计分表 | 全役种判定参数与计分 | 同上 |
| BT 节点表 ×3 人设 + 难度参数表（信息面/犯错率） | AI 行为 | 游戏层 BT 解释器（§4 例外） |
| 衣物表（5 件×角色）+脱衣触发表 | 脱衣系统 | event/effect + 结算钩子 |
| 机位表/演出时序表 | 镜头与演出 | timeline + Camera3D |
| 音色表/音符表/语音事件表 | 音频 | Synth 端口 + 采样端口(缺口 a) |
| 会话契约 SessionIn/Out | 局外接口 | 游戏层 adapter（§4 例外） |
| 内置角色卡 ×3 | 姨太人设/头像/立绘/牌风参数 | 角色卡 adapter（同上） |

> 红线自查：以上"游戏层解释"的三处全部在 §4 逐条申请（TS 已获 owner 授权）——不存在"数据表+无人解释"的虚胖数据。

## 4. 申请的游戏层代码例外（⚖ TS 授权下仍逐条记账）

| 例外 | 为什么现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| 日麻规则核（洗/配/摸打/鸣牌/立直/和了判定/符番计分/流局/连庄） | 引擎零麻将能力；规则复杂度=真缺口非重组可得 | ~2500+测试 | 待审 | 验证成熟后按 capgap 提案下沉 t3-riichi-core |
| BT 解释器（节点闭集：selector/sequence/condition/action） | 引擎无 BT | ~300 | 待审 | 下沉通用 AI 能力（game-d/g 可复用） |
| 会话契约 adapter（角色卡入/金钱衣着出） | 共享卡格式未定稿·需吸收层 | ~200 | 待审 | 格式定稿后评估是否泛化为引擎"外部会话"能力 |
| 场景装配/手牌交互胶水（3D 布局计算·选牌信号） | 装配层惯例（对齐 game-t mountHost 先例） | ~600 | 待审 | 持续瘦身·可下沉件随缺口单走 |

> 审计红线照守：**禁裸 Math.random**/禁 innerHTML·createElement/禁零能力接入/禁零测试；`game-skill-audit game-b` 交付必跑。

## 4.5 美术接入（必填）

- 皮肤槽：3D 件走 Model3D/材质资产 key；牌面=图集；立绘/头像/衣物图标=art: 资产引用——**主体视觉实体全部有槽**，程序化仅作占位回退。
- 台账：编译期游戏·照 game-q/g 样板写推导脚本（`scripts/game-b-art-ledger.mjs`·S6 前由施工侧落）；清单见场景交接档 §六。
- 不申请"全程序化"例外——本游戏必须吃真美术（女性向二次元锚）。

## 5. 确定性声明

- 随机源：SessionIn.seed → 引擎种子 PRNG 派生（洗牌/骰/AI 全部）；表现层（语音/镜头/粒子）不进 sim。
- 回放/同步：单机无 lockstep；walkthrough vitest 以同 seed 复现整圈为准。

## 6. 评审记录

- 提交：GD-B · 2026-07-17。
- ⚖ owner 2026-07-17：允许本项目 TS 写 code（会话记录）。
- Lead 裁决：待审（S2 门）。
