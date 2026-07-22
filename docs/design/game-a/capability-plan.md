# 能力总览 Capability Plan —《掼蛋夜宴》game-a（S2 送审稿）

> GD-A · 2026-07-17 · 形态=**编译期 TS 游戏**（owner 拍板·brief §2）。规则语义=`gdd.md`；UI=`ui-scene-design.md`+蓝本 1:1。**plan 未过审不写游戏层系统代码**（A-S1 条件①）。

## 1. 游戏一句话

四人两副牌传统掼蛋（淮安全套）——快局金钱/服饰罚×二次元人设×BT 对手 AI；参照物=斗地主类出牌循环 + game-e 的「牌与效果全数据」路线。

## 2. 消费的引擎能力（对照 registry 实名）

> **⚠ 记账诚实校正（PE-A·A-020·2026-07-20·Lead 评审代跑）**：本表原「状态」列 `✅ 现有` 只表「引擎在册」，被误读为「已消费」。逐条实测（grep 游戏层引用）后，把**列了但零消费**的降级为「⚠ 未消费·偿还计划」——**modifier-stack / event-when / effect-apply / timeline / tween 实测 0 引用**（结算番数/彩头倍率=`settleRound` 内联算，入场动效走 `LayoutNode.anim` 非 timeline/tween）；`t2-card-pile` 蓝图装了 5 份组件但发牌走 `session.hands[]` 私有数组、组件 load 后不更新=**骨架占位/影子态**。真消费的（hand-pattern/behavior-tree/clickable/flow/RandomSeed/LayoutNode/services）保持 ✅。偿还=攒 b/c 同构后随例外①债一并下沉（§4）。

| capability | 用来做什么 | 状态 |
|---|---|---|
| `t2-card-pile` | 108 张牌库→四家手牌·确定性发牌 | ⚠ 骨架占位·影子态（A-020：蓝图装 5 份·真发牌在 `session.hands[]` 私有数组·组件不更新） |
| `t2-card-play` | 「出哪几张」命令流（选牌→出牌/过） | ✅ 现有 |
| `t3-hand-pattern` | 掼蛋判型+压制序+逢人配（数据表驱动） | ⏳ 下沉中（REQ-GUANDAN-牌型·Lead spec 亲笔·A-S1 条件②） |
| `t2-behavior-tree` | AI 外层策略树（档位×性格权重） | ✅ 现有（`0c021546` 新落地） |
| `t2-clickable` | 选牌/按钮→action 信号 | ✅ 现有 |
| `t2-tray` | 手牌排布（弧形参数是否够→PE 施工对照·不够提 PUI） | ✅ 现有 |
| `flow` | 盘间状态机（发牌→进贡→打牌→结算→run 判定） | ✅ 现有·表达力 S3 对照（A-004·不够提单） |
| `event-when`/`condition`/`effect-apply` | 事件链（炸弹演出触发/结算脉冲/服饰-1） | ⚠ 未消费·偿还计划（A-020：实测 0 引用·结算/演出散在 session 过程码·effect 链待下沉） |
| `modifier-stack` | 彩头倍率叠加（抗贡/天王炸/封顶） | ⚠ 未消费·偿还计划（A-020：实测 0 引用·倍率=`settleRound` 内联算·未走 modifier-stack） |
| `RandomSeed`+`nextRandom` | 洗牌/首盘定家/AI tie-break/表情触发 | ✅ 现有（裸 Math.random=红线） |
| `timeline`/`tween` | 发牌瀑布/牌飞行/结算演出 | ⚠ 未消费·偿还计划（A-020：实测 0 引用·入场动效走 `LayoutNode.anim`·发牌/结算演出未接 timeline/tween） |
| LayoutNode 34 控件（UI 铁律） | 全部 UI·蓝本 1:1 复刻·缺口 PE 提 requests.md 报 PUI | ✅ 现有 |
| SynthAudioPort/SfxSpec（services） | BGM 1 首舒缓循环 + SFX 表 | ✅ 现有（game-g 正样例） |
| storage/platform-hooks（services） | 生涯钱包/run 快照/统计/设置存档 | ✅ 现有（save-platform 线·不埋平台钩子） |
| VoicePort（services·可选） | 姨太语音气泡（后议·非首发） | ✅ 现有·暂不消费 |

## 3. 摆成数据的规则面

| 数据表 | 内容 | 谁解释它 |
|---|---|---|
| 掼蛋牌型表 | T1~T8 定义+压制序+逢人配（gdd §2.2） | `t3-hand-pattern`（下沉件·**禁游戏层自写判型**） |
| 规则参数表 | gdd §2 R/G/A 各默认值 | flow/事件链配置消费 |
| AI 策略树 ×4 档 | BT 节点数据+性格权重（characters.md） | `t2-behavior-tree` |
| 出牌估值表 | 拆牌代价/牌型权重/让牌系数 | BT action + 候选枚举 glue（§4-2） |
| 服饰阶梯表 | 3+1 人 ×5 档（characters.md） | 游戏状态+SC-7b UI 绑定 |
| 经济表 | 底注/倍率/彩头/封顶（gdd §4） | 结算 effect 链 |
| SFX/BGM 表 | gdd §7 | SfxSpec/SynthAudioPort |
| 文案表 | 称谓/气泡/结算文案 | UI Label 绑定 |

## 4. 申请的游戏层代码例外（TS 形态·逐条过审）

| 例外 | 为何现有能力表达不了 | 预计行数 | Lead 裁决 | 偿还计划 |
|---|---|---|---|---|
| ①盘间流程编排 | 掼蛋轮转（墩/圈/盘+进贡分支+run 判定）若 `flow` 表达不了树状条件轮转 | ~200 | ✅ 有条件准（Lead 2026-07-17）：**先重组**——墩/圈/盘轮转先用 flow/event-when 摆数据（A-004 对照结论写进 S4 回执）；仅 flow 真表达不了的进贡分支/run 判定可进宿主编排，硬顶 ~200 行；结算数值一律走数据表+effect 链不得散码。**S4 复查补正（Lead 2026-07-17）**：落地版未走 flow 重组、取 game-e session.ts 线性过程化先例（419 行）——Lead 事后准许该形态（规则语义全在引擎件/数据表·脚本纯编排·27 测含逐字节确定性复现），**超预估 219 行记债**，随偿还计划一并清（A-004 有完整对照结论） | 攒同构（b/c 牌桌游戏同需）后议下沉 turn-flow |
| ②AI 候选枚举+估值 glue | 合法牌组枚举调 hand-pattern·查估值表·喂 BT action；数据全在表、代码只做枚举/查表 | ~150 | ✅ 收窄准（Lead 2026-07-17）：候选枚举**必须消费引擎 `legalResponses`**（禁游戏层重实现枚举）；估值=纯数据表；glue 只做查表接线 | 若 b/c 同构→下沉 card-ai-candidates |
| ③UI 装配 mount + handler 入队 | 编译期游戏惯例（game-g/t 同例）；handler 零逻辑 | ~100 | ✅ 准（Lead 2026-07-17·mountHost 公用件+handler 零逻辑·S3 骨架已按此立） | 无 |
| ④记牌器统计装配 | 出牌历史→13×4 计数视图数据 | ~40 | ✅ 准（Lead 2026-07-17·render-only 纯读投影·不写 sim·记忆分档语义归 AI 数据表不在此件） | 无 |

> 未列出的游戏层自由代码=违规；audit 红旗（裸随机/innerHTML/createElement/零能力/零测试）不受理为例外。

> **⚠ 行数记账·实测校正（PE-A·A-020·2026-07-20·`wc -l`）**：预估 vs 实测过程化码——
> ①盘间流程编排 `guandan-session.ts` 预估 ~200 → **实测 571**；②AI glue `ai.ts` 预估 ~150 → **实测 261**；③UI 装配 `game-a.ts`（宿主）预估 ~100 → **实测 423**；④记牌器统计已并入 `hud.ts` 数据（不单列）。
> **过程化码合计 ~1255 行（预估 490·约 2.6×）**（`hud.ts` 919 + `rules.ts` 161 = LayoutNode/纯数据·不计过程化）。Lead 评审快照测 ~1160（ai 227+session 563+host 370·2026-07-20），本轮 A-019 施工后增至 ~1255。**A-004 债线「419 行」（game-e session 先例）已过时**——真实超支债=①②③三例外合计超预估 ~765 行，随 b/c 牌桌同构攒齐后一并下沉偿还（turn-flow / card-ai-candidates / mountHost 泛化）。诚实记债不洗白：超支主因=掼蛋规则面（进贡矩阵 G1-G4/逢人配/彩头倍率）确比通用桌游复杂，但**结算数值散码**（modifier-stack 未消费·见 §2）确有可下沉空间，非全属不可避免。

## 4.5 美术接入（必填）

- 皮肤槽：牌面 54+牌背（PD 货架 vendor 起步·`art:` 引用）、背景 2、三姨太头像/立绘 5 档/表情 3（占位→S6）、主角头像（外部角色卡）、图标 ~10、FX 贴图 4 组、控件皮——全表=`ui-scene-design.md` §5+§5.1。
- 台账：照 game-q 样板写推导脚本 `scripts/game-a-art-ledger.mjs`（S6 建行·**每行 spec{w,h}**·A-S1 条件③；底线档逐张内容复核）。
- 风格锚：场景=`modern-manor`·人物=`sakura-nijigen`（style-packs 已备）；纯程序化不申请（真图路线已定）。

## 5. 确定性声明

- 随机源：单一 `RandomSeed`（每 run 一种子·存档随 run 快照）；洗牌/发牌/首盘定家/AI tie-break/表情触发全走 `nextRandom`。
- AI 决策确定性：记忆=推导状态（无隐藏随机）；宗师偷看=开局按种子定牌；同局同种子=同过程（可回放·bench 双跑）。
- 拟人延迟=表现层计时不进 sim；无双人同步/lockstep（单机）。

## 6. 评审记录

- 提交人/日期：GD-A · 2026-07-17（与 gdd.md 同批）
- Lead 裁决：**✅ 过审（Lead-Fable 2026-07-17·S2 复查门 PASS 落账）**——能力清单逐条核真（hand-pattern/behavior-tree/VoicePort 均已落库验收·其余 registry 实名在册）；规则面无虚胖（各表解释器闭环）；§4 例外①-④裁决落列（①先重组有条件准 ②收窄准 ③④准）；§4.5 已答。owner 人门（CLI signoff）待签。
