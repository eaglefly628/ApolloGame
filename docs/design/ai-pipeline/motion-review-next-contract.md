# M2 / M3 / M4 下一阶段契约草案

状态：设计与合成验收准备，未实现、未启用写入、后续接口未通过独立复查。原固定提交已获 Claude PASS，准确范围见交接单。施工归属沿用 REQ-MOTION-M2 的 Codex 锁，不新增需求池槽，不改既有 M1–M6 A 裁决。基线为固定待审提交 `1b87a04d5`；交接状态见 [复查交接单](../../workflow/motion-review-handoff-2026-10-29.md)。

## 实查与重组结论

已查 scripts/lib/motion-semantics.mjs、scripts/motion-classify.mjs、scripts/motion-match.mjs、scripts/motion-library.mjs、scripts/motion-compose.mjs，以及 docs/playbooks/ui.md。现有来源模块可提供同一份标签与证据，分类 CLI 只读；motion-match 仍读旧 catalog 类别/情绪，不能声称已消费新标签；ingest 的 saveCatalog 有锁和临时文件发布，但不是标签修订日志；compose 的 reviewedPreviewSha 是烘焙配方回执，不能拿来批准普通标签。M3 的 Input/Dropdown/Panel/Label/Button/Modal 足以组合核对和纠错界面，无须加 UI 控件或另写播放链。

结论：复用现有来源提取及原生播放链，扩写离线元数据契约；不提出新游戏 system，不建立第二套分类规则。下述是待复查接口边界，不是已上线功能。

## M2：来源草稿与修订分开

原 catalog、源 FBX、动作 GLB、Skin 与纹理不改。修订只进库内独立 semantic-review 侧车；真实侧车和其快照不进 Git。来源草稿可重算，人工记录不可被重算覆盖。

每个修订事件必须携带：schemaVersion、唯一 eventId、单调 revision、prevEventSha256、catalogSha256、dictionaryVersion、clipId、clipSha256、sourceFbxSha256、父标注快照 SHA、操作、目标标签/旧事件、替换提案（如有）、理由、作者归属和证据。字符串、字节数及事件总数有限额。原文证据继续使用 source、quote、start/end；视觉依据另列，不能伪装成原文或实测。时间只作审计显示，不用作冲突排序。

操作闭集：propose（新增/替换草稿）、flag（标记有疑问）、accept/reject（对精确标签修订的明确人审）、retract（撤回某个事件）。撤回追加新事件，不删除历史，不通过清空文件消除拒收记录。retract 只允许引用已存在且尚未被撤回、同 clipId / clipSha256 / sourceFbxSha256 / 标注谱系内的非 retract 事件；跨动作、跨素材修订、跨谱系、未来事件或重复撤回均拒收。禁止撤回 retract 事件；再次恢复同一内容须产生新的 propose/accept 事件，而不是嵌套撤回。两个不同标签的接受各自独立，不把整个动作或整库自动升级为 confirmed。撤回接受后回到可追溯的未接受状态；撤回替换后恢复前一有效版本，而不是重新生成一个无记录默认值。

AI 只能产生 propose/flag，不能因为生成成功、结构通过、作者字段写 human 或传一个任意 approved=true 就成为人审。M3 的明确接受动作须绑定当前呈现的精确标注快照/动作 SHA 与修订版本；陈旧回执拒收。该回执与动作播放的视觉验收、catalog assetStatus 分开。人审机制是工作流可追溯性，不声称单凭本机 JSON 字段即可证明人的身份。

冲突与恢复：提交携带 expectedRevision；过期就拒收并要求重新加载，不能静默覆盖。单写锁保护完整校验与追加；遇残留锁、半条日志、hash 链断裂或未知事件版本明确拒收，保留文件，不自动清锁、截断或跳过。实现时应先在合成临时库验证崩溃/重试，不直接用真实库试写。重试同 eventId 同内容返回同结果，不重复追加；同 ID 不同内容拒收。

待冻结的共享接口：现提供只读候选 `getSourceDictionary`、`getSourceTagDefinition` 和 `validateSourceEvidence`，由已有规则派生，仍须独立复查确认。新增标签提案的校验必须等共享字典公开接口确认，不能在修订器、UI、M4 各抄一份词表。未知新值保留为明确待处理提案，不能混入可检索的有效闭集标签。

## M3：核对与纠错衔接

继续消费 sourceSemantics 的同一份来源草稿，展示“原文提取 / 机器实测 / 人工核对”的不同依据；分开显示素材状态、标签状态和视觉状态。行为分组依有效标签投影，不再读取旧 category 作为真相。

选择具体标签后，既有 Input/Dropdown 收集提案与理由，Modal 展示原值、新值、原文和作用范围，明确操作才提交。离开动作、切 Skin、搜索、暂停都不隐式批准。来源说明和原 SHA 只读；修订完成不触发播放器重建。发生并发冲突时保留用户尚未提交的文字并显示冲突，不假装保存成功。

本机写接口固定启动时的库根，只监听 loopback；GET 无写副作用。POST 校验来源、内容类型、明确意图令牌、请求体预算及版本，不接受任意根目录/路径；ID 不直接拼未校验路径。不能将页面里的来源 Description 当指令执行。接口未启用前现有预览仍只读。

## M4：只消费共享标签，不重做分类

消费输入为：验证过的 catalog 身份、同源来源索引（schema/dictionaryVersion/catalogSha256/各动作 SHA）、可选的已验证侧车修订快照。旧索引、缺项、重复 ID、错误 SHA、未知 schema/dictionaryVersion 拒收，不静默回退旧情绪/category。M3 与 M4 调同一有效标注解析器；不另写动作词正则。

候选必须是当前 catalog 中实际存在的 clipId/file。返回每个约束的 supported / conflict / unknown、依据类型与具体证据、标签状态、索引/修订版本；按确定性得分和稳定 ID 排序。来源草稿能提供候选线索，但必须保留 requiresHumanConfirmation；素材 confirmed 不替代标签批准。

“没有提到”是 unknown。多动作可并存，找到 walk 不等于证明没有 run；未提情绪不等于 neutral。只有有明确、适用且足够的反证才记 conflict。严格模式可以排除 unknown 但必须说明原因；没有足够候选返回空结果，不返回伪造 ID。中文自然语言到闭集约束的解释属上游 AI 产出的受验证数据，不在 matcher 里偷偷增加第二套分类器。

M6 需要补全的部分作为 missingRequirements/补全建议单列；不得把尚未烘焙、尚未入 catalog 的“擦火柴”等建议装成现成动作。候选预览与烘焙产物仍走各自既有门。

## 合成验收设计（后续实现必须转为可执行测试）

| 场景 | 可检验结果 |
|---|---|
| 来源只有 Walking，旧 catalog 标 pose/neutral | 新分组按来源，情绪 unknown，旧默认不复活 |
| 同名动作而 ID/SHA 不同 | 只修改选中的精确 ID，另一个不变 |
| 明确 source description 与相反标题 | 主说明优先；标题补充必须标明依据 |
| quote 与 start/end 不一致 | 提案拒收，日志/原件不变 |
| 两帧静态 Pose | 动作上下文不作位移动作 |
| AI 起草或 flag 完成 | 不转 accepted/confirmed |
| 接受一个标签 | 其它标签、视觉状态、素材状态不变 |
| 在旧界面接受已被替换的标签 | 版本冲突，不覆盖新修订 |
| 相同 eventId/内容重试 | 一次写入，结果可复现 |
| 同 eventId 不同内容 | 拒收，无历史覆盖 |
| 撤回接受或替换 | 可追溯回前一有效状态，历史保留 |
| 撤回其它动作/素材/谱系的事件 | 拒收，不影响任何有效标签 |
| 撤回 retract、重复撤回或引用未来事件 | 拒收；恢复必须产生新提案/接受记录 |
| 双写者争同 expectedRevision | 只一方成功，另一方明确冲突 |
| 半条日志/断链/残留锁 | 保留数据并拒收，不自动清理 |
| 重算新字典版本来源草稿 | 旧人审记录不自动迁移到新值 |
| 新词不在共享闭集 | 标明未接受提案，不能进有效检索 |
| M3 保存修订成功 | 原目录滚动、播放及暂停状态保留 |
| GET / 非本机来源 / 路径穿越写请求 | 不产生写入 |
| M4 索引目录 SHA 或 clip SHA 过期 | 拒收，不混用多个版本 |
| 素材 confirmed、标签 draft | 候选仍要求确认，证据显示 draft |
| 描述缺 contact/emotion | unknown，不编造接触或中性 |
| 候选含 walk 与 run | 不按单值枚举制造冲突 |
| 全部候选不满足严格约束 | 空候选及明确原因 |
| 剧本要求尚不存在的复合动作 | 返回缺失需求，不伪造 catalog ID |
| 任意只读查询/标注操作 | 原 FBX/GLB/Skin/catalog 精确字节不变 |

## 本阶段的结论边界

目前完成实查、契约草案、合成场景设计及来源索引的全库只读一致性核对；没有实现持久化/HTTP 写入/标签批准/M4 新匹配 API。固定提交的 Claude PASS 已在 `5ae0ee47698d7f9b8f0e78bbbe2d69a49b0fe553` 核验；下一阶段仍须冻结共享字典公开接口，再分阶段实现与独立复查。本单不自签该门，也不把等待门扩大成停止所有可独立做的核对工作。

内部文档审阅已核对目标/父 SHA 和实现边界，并补齐撤回目标约束与嵌套撤回的合成场景。该审阅不代替 Claude 对 1b87a04d5 的最终判词。


## 共享字典候选：分阶段送审范围

`source-description-v2` 的共享词表候选为 `scripts/lib/motion-semantics.mjs`、同名类型声明及 `scripts/motion-source-dictionary.test.mjs`。词表由既有规则派生并深度只读；`defaultLabel/defaultGroup` 是规则默认元数据，不能替代来源提取中的上下文标签和分组；`validateSourceEvidence` 只校验原文切片，不证明语义正确或人工批准。未知值不注册。

请按用户指定的交叉复查流程，将本批准确提交 SHA 交 Claude 独立复跑、撤修验红、实证复现并读告警，明确“共享字典 API 是否可冻结”的判词。原 `1b87a04d5` 的 PASS 和后续 `f75e1dd9d` 的门禁不覆盖本候选。

草稿日志和 M4 影子查询已有仅供复查的候选源码；目录替换时日志可能写到库外的问题曾被独立复现，当前候选使用固定目录句柄并增加针对性故障测试。真实写回仍须完成针对本批准确 SHA 的独立复查。后续人审批准、正式 M3 保存及生产 M4 接线仍须分别完成并独立复查；Mink 样片仍待视觉验收。


## 草稿侧车与影子查询候选：分项送审

本批为可复查候选源码，未连接 CLI、HTTP、正式标签保存或生产匹配。请指定复查者对本批准确提交 SHA 分别给出草稿日志和 M4 影子查询的判词；共享字典接口另以 `1f4b3e9a8599152dac21d0bde8267d64628ea308` 的对应复查冻结，不能自签。

- 侧车 `scripts/lib/motion-semantic-drafts.mjs`、`.d.mts`、`motion-semantic-drafts-fs.py`、`motion-semantic-drafts-validate.mjs` 与 `scripts/motion-semantic-drafts.test.mjs`：仅 propose/flag，保持 draft；精确绑定目录、素材与来源证据；持锁快照、追加、锚点发布；异常与历史损坏拒收并保留诊断。Python 3 + POSIX 目录句柄和 flock 是本候选运行依赖，Windows 明确不支持。它只保证协作写者的串行和目录固定，不是对绕过锁的本机恶意进程或伪造人审的安全保证。
- 影子查询 `scripts/lib/motion-semantic-query.mjs`、`.d.mts` 与 `scripts/motion-semantic-query.test.mjs`：消费同一已验证来源草稿；提案不自动变为事实；支持/冲突/未知分别返回，严格查询对未知拒收；只校验所选动作文件 SHA，不冒充视觉或文件结构验收。旧 `motion-match` 未接线。

建议在合成临时库独立重跑两组测试、原五个故障探针、目录链和日志头锚点撤修验红并检查告警；不访问或上传真实目录。双方文件 hash、目标提交 SHA、机器与 Python 环境均应记入复查回执。任何通过都不代表 accept/reject/retract、标签级人审、M3 写回或生产 M4 已完成。
