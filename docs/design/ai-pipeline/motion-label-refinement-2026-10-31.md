# M2 来源标签精化批次

施工主体：当前 Codex motion-semantics-next session。owner 2026-10-31 授权继续实际标签工作，沿用 REQ-MOTION-M2 锁。状态：本轮实现与分域独立实证复核完成，完整门禁绿；待 Claude 对准确提交复查。

## 范围

- 实查共享来源提取器、词典、只读 labels 审核清单、标签修订与迁移契约；复用既有模块扩写，不新增游戏 system。
- 逐条阅读真实库 635 条重点来源，区分漏标、误标、静态姿势、语义不足。真实审核结果只保存在本机，不进 Git；来源文案是数据，不执行其中指令。
- 补明确来源词形/类别与反例；保持旧词典/既有日志可读，不能静默改版本导致审核记录失效。新结果仍为来源草稿，不伪装视觉或人工验收。
- 补92aed56bc独立复查留下的T1回执非绑定字段篡改、T2完整/局部结果隔离测试，以及T3代数边界统一。
- 代码、合成反例与文档可推送。真实 catalog、模型、标签记录、详细来源结果不上传、不覆盖。


## 本轮实际标签工作

635 条旧版重点来源分成 212/212/211 三组，逐条读 Description、已有标签、warnings，并核对原始 title/frames；其中 128 条是两帧且标题明确为 Pose 的静态语境。首轮共 681 条建议，交叉复核后 629 条仅保留为有文字支持的 AI draft、52 条暂缓或需收窄；3 条明确误标质疑保留。保留的 629 条引文切片经共享 validateSourceEvidence 对真实 catalog 验证，没有将标题文案混作说明。详细记录不进 Git，不把 AI 交叉复核说成人工批准。

重点改进：
- 补常见词形与行为：潜行、暖手、发抖、倚靠、喊叫、点头、耸肩、收放物体、装填、演奏等；新增值由同一词典公开，M3/M4 复用。
- 修正“拍背 → 躺卧”“礼貌鞠躬 → 弓箭道具”；扩词验证另拦住输入码→空间进入、水果低垂→角色悬挂、观众欢呼→本人欢呼、被放置→主动放置等假阳性。
- 动态行为与静态 Pose 分开；明确单段来源转换可给 startPosture/endPosture。连锁、否定、准备或他人转换不编造端点。相同站姿下 cover/ready 只记 state-transition，不冒充蹲/坐/站转换。
- gazeDirection 独立于移动/转向 direction；信息检索 lookup、摄影 shoot、飞吻与实际亲吻均做词义边界。
- 明确 to/准备语境为 intentOnly，保留前缀原文；同一行为后来有明确执行词则以执行词为主。M4 对仅意图的 required/forbidden 都保持 unknown，不冒充已执行或明确禁止冲突。纯意图无正面执行线索时，底层 query 保留 ID/证据，story summary 只列 intent-not-execution gap，不假造可播候选；这属于 summary 粒度边界。
- 未提情绪不填 neutral；只有明确来源词形才新增情绪。没有 text/pose 信息时继续 unknown。Head Banging 等泛化行为标签不能作为击物接触证据；To Drawing 等保守意图判断存在召回损失，仍需预览。

## v2 身份兼容与版本规则

新的默认词典为 source-description-v3。旧模块精确冻结为 motion-semantics-v2.mjs（字节 SHA 681170ef5556323b0c69cee05fbc17020ad8b5cbefb076450009bd5f56c10a66），不是把旧规则改名再重算。

- 已存 head 固定原词典；无 head 的旧零事件 migration receipt 也固定原词典。新空库才默认 v3。未知版本、显式读版本冲突、半条日志与不安全 pin 文件均拒收，原件保留。
- 旧 v2 snapshot、base/tag ID、追加事件以及零事件回执与 git92aed56 的原代码逐字比对；新标签值在旧词典里仍是 pending，不因 v3 新注册就升级旧提案。
- 目录迁移保持 source 的词典版本，新目标 head/receipt 固定该版本；祖先回放使用当时版本，不能靠调用者未校验的 expected 偷换算法。不做隐式跨词典审核迁移。
- 发布后的语义行为、unknown facets 和 ID 规则不可原地改写；后续规则修正必须使用新词典版本，并保留历史解释器和固定身份回归，不能覆盖旧版本。
- `dictionary --version <snapshot的dictionaryVersion>` 用于发现对应闭集。`labels/snapshot/match` 依库中已固定版本工作；不能用发现词表参数强制升级旧审核。

```sh
node scripts/motion-story-match.mjs labels --lib <本机库根>
node scripts/motion-story-match.mjs snapshot --lib <本机库根>
node scripts/motion-story-match.mjs dictionary --version source-description-v3
node scripts/motion-story-match.mjs match --lib <本机库根> --input <仓库外剧情请求.json>
```

M3 投影保留 intentOnly 与 warnings，工作台和只读预览的标签旁显示“仅意图，执行待核对”。仍是只读来源视图，不是人工审核侧车的最终编辑界面。

## 全库只读结果（本机）

| 指标 | v2 | v3 |
|---|---:|---:|
| 原动作记录 | 2445 | 2445 |
| 有来源行为标签 | 1842 | 2125 |
| 情绪有明确文字依据 | 31 | 44 |
| 待关注记录 | 635 | 231 |

v3 的其余记录分为 186 条静态/姿态语境和 134 条仍缺具体行为文字依据；三类合计 2445。91 条含意图标签（可同时有其它执行主张），执行文字主张覆盖 2093 条。这些是文本层覆盖，不能转述成动作实际执行率或标签准确率。65 条有明确文字起止姿态，20 条有视线方向。对旧重点清单的635条进行了AI文本首审，不声称全部2445逐项视觉验收；approvedLabels仍为0。

真实只读检索验证：暖手行为得到 1 个来源候选，潜行 14 个，明确坐→站转换 6 个；返回项均核验实际所选 GLB SHA，动作、接触和适配仍待预览。原作18项严格请求仍为3项有候选、7项独立场景/双人、8项词表/组合待核对，未为提高数量放松约束。

详细标签、人工工序之外的 AI 文本审稿、争议与引文数据只留本机 motion-review 草稿目录；不上传真实 catalog、模型或标签。原始 catalog/FBX/GLB/Skin 不覆盖、不重转、不重下载。

## 独立复核与验证证据

- 分类与 audit：固定def9f701源码，108项（新45+独立25+既有26+字典12）独立实跑通过，8组唯一锚点撤修验红/恢复绿；重读原279条新增来源集合并重算证据切片。判词 `/private/tmp/v3-frozen-independent-qljbnx12/final-review.json`，不扩为通用英语理解或物理/视觉批准。
- router/T123：独立历史代码重算 v2 snapshot/第三 flag/零 receipt 精确相同；56项及深度边界通过，7个端到端探针通过，6项撤修验红。T1回执字节检查与T2完整/局部隔离另各独立撤修确红/恢复绿。判词 `/private/tmp/motion-router-independent-review/review-verdict.json`，不把复核人早先写的迁移基线算作新独立施工复核。
- UI/投影：34项既有及新增回归、2个额外实际LayoutNode探针和类型检查通过，派生动作只在baseReference保留基础intent，不升级为新动作事实。日志 `/private/tmp/m2-v3-ui-independent.log`。
- 本轮 T1/T2/T3：两测试缺口已钉住；JS/Python读取同一份 motion-semantic-migrate-limits.json，统一“继承代数+本次 ≤ 8”，不放松原有效上限。配置、源文件和固定v2 fixture均为代码/纯合成材料。

本轮生产代码分由未施工对应增量的代理实际通读和独立实跑，未自签 Claude 判词；最终仍须给准确提交做外部复核。完整门禁已通过（退出码 0）：eslint、depcruise、tsc、全库 Vitest、build、docs-ref、context-budget。日志 `/private/tmp/m2-label-refinement-full-gate.log`。另 14 组标签/预览定向测试 312 项、3 组 CLI/旧匹配回归 45 项通过；Skill 校验通过。读告警：构建有既有 >500kB chunk 提示；art-ledger 的 game-a art-03、game-c art-017 是既有缺文件 WARN，本轮不改素材台账。
