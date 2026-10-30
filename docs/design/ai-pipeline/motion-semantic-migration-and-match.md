# M2 标签迁移与 M4 剧本匹配

施工主体：当前 Codex motion-semantics-next session。2026-10-31，owner 授权继续第 2 项。状态：本轮工具实现、自证与内部独立复核完成，待 Claude 对最终提交复核；真实标签没有逐项人审。

## 实查与范围

实查现有 motion-semantics / motion-semantic-drafts / motion-semantic-query、motion-match、motion-review-next-contract 与资产手册。复用共享来源词典和提取器、POSIX 固定目录事务、已复核查询；不增加游戏 system 或第二套分类器。Q1 由 owner 确认已复核。

- M2：显式从旧有效库迁移到已准备新 catalog 的独立新版库，默认只读预演。旧 catalog、日志、head 和原始资产不改不删。完整保留历史字节；只转移完全一致的动作行事件，变化/移除动作列待重审。propose/flag 仍不是批准，不实现伪造 human accept。新侧车原子发布；冲突、中断、残留暂存拒收并保留现场，不自动清锁。
- M4：显式 JSON 闭集约束消费共享来源标签和证据，查询纯只读。必需条件、禁止条件未知、疑问标签、明确冲突、组合不匹配各自返回原因；缺口不伪造成现成 clip。保留原 motion-match 兼容入口，新增显式语义/剧情入口供 AI 使用，不靠中文正则偷做分类。
- 真库验收：只读生成本地审计和剧本匹配报告；迁移写入只在合成临时库及隔离副本验证，真实数据和报告不上传。

代码/合成测试/文档可上传；真实 catalog、模型、标签侧车与生成报告不进 Git。完成需专项、独立复核、撤修验红与完整门禁。

## 使用入口（离线工具）

原 `motion-match.mjs` 保留兼容，不再作为新 M4 来源标签匹配的默认依据。新入口不读旧 emotion/category 作事实，也不对剧情文字再写一套正则。

```sh
node scripts/motion-story-match.mjs dictionary
node scripts/motion-story-match.mjs snapshot --lib <当前库根>
node scripts/motion-story-match.mjs labels --lib <当前库根>
node scripts/motion-story-match.mjs match --lib <当前库根> --input <本机剧情请求.json>
```

所有结果 JSON 在 stdout，decision/reject 摘要在 stderr；真实请求、labels 与匹配结果保存在仓库外。labels 返回同源草稿、精确原文证据、疑问标记、待定提案与审核原因；只读元数据，不验证资产文件。没有 action 标签可能是静态姿势、抽取未覆盖或无相关文字，不表示没有动画。素材 confirmed 不升级标签。当前只支持 propose/flag，approvedLabels 固定为 0，不把机器结果冒充人审。

### 可复制的最小请求

先运行 snapshot；将整个返回值填入以下 `binding`。零 SHA 是防误用占位，直接运行会明确拒收为 stale。`text` 仅用于显示，AI 必须另写忠实的闭集 constraints；词典没覆盖的词仍可作为 pending-vocabulary，不擅自注册成有效标签。

```json
{
  "schemaVersion": 1,
  "storyId": "simple-walk-and-warm",
  "title": "慢走与伸手取暖候选",
  "binding": {
    "catalogSha256": "0000000000000000000000000000000000000000000000000000000000000000",
    "dictionaryVersion": "source-description-v2",
    "head": {"revision": 0, "eventSha256": null}
  },
  "beats": [
    {
      "id": "walk",
      "text": "女孩缓慢行走，不要跑步",
      "kind": "motion",
      "constraints": [
        {"facet": "action", "value": "walk"},
        {"facet": "style", "value": "slow"},
        {"facet": "action", "value": "run", "mode": "forbidden"}
      ],
      "verificationNeeds": ["visual-expression", "retargeting"]
    },
    {
      "id": "warm",
      "text": "女孩将双手伸向火炉取暖",
      "kind": "interaction",
      "constraints": [
        {"facet": "action", "value": "reach"},
        {"facet": "bodyPart", "value": "both-hands"},
        {"facet": "action", "value": "warm-hands"},
        {"facet": "propMention", "value": "stove"}
      ],
      "verificationNeeds": ["contact", "collision", "fingers"]
    }
  ]
}
```

更完整的故事草案见 [18 项请求模板](examples/match-girl-semantic-request.json)。它是对已有 game628 原作设计的显式检索约束，不含真实动作数据，也不是对完整分镜的约束证明；没有把“烤鹅”换成烤鸭。

请求闭集：1–32 beats，总约束不超过 64、单拍 1–32 条；kind 为 motion / interaction / scene / multi-character。人体拍必须至少有一条 required；strict 默认 true，top 默认 5（上限 20）。scene / multi-character 不接受人体 constraints，单列制作。verificationNeeds 可选 contact、collision、fingers、balance、visual-expression、retargeting、timing，只是待验证项目。未知字段、可执行属性、稀疏数组、陈旧绑定均拒收。

### 如何读结果

| 字段/状态 | 含义与下一步 |
|---|---|
| source-candidates-only | 当前来源证据符合查询条件；标签仍 draft，必须预览核对，不能宣称整拍通过 |
| needs-tag-review | 候选证据有 flag；不丢标记，不自动批准 |
| uncertainConstraints | 包括禁止条件未提到的 unknown；没有文字反证不能证明动作没有发生 |
| partialReferences | 不满足整组严格约束的局部参考，不能作为整拍可用动作 |
| pending-vocabulary | 词表尚未支持该语义；先审词表，不等于库中没有该动作 |
| no-source-evidence | 当前来源草稿没有支持；先核对原文/预览/提案，不能直接认定资产缺失 |
| combination-unproven / constraints-not-jointly-satisfied | 各条件单独有支持，但没有同一候选满足整组，或存在明确禁止冲突 |
| separate-authoring | 场景、非人道具或双人制作，不冒充单人 IK 能力 |

返回真实 catalog ID/file、SHA、source quote、每条 supported/conflict/unknown 与排除原因统计。原文派生/静态姿势/否定语义来自同一提取器。批量查询内部只加载一份可信快照；最终复核 revision 和 catalog，所选完整及局部候选核验真实文件 SHA。没有进行 FBX/GLB 结构或视觉验收。verifiedStoryBeats 始终为 0；authoring 仅是审核建议，不调用求解器、不烘焙、不入库。不要把“候选数大于 0”当作 M4 制作验收。

## 目录升级与标签迁移

```sh
node scripts/motion-semantic-migrate.mjs plan --source <旧有效库> --target <新目录库>
node scripts/motion-semantic-migrate.mjs apply --source <旧有效库> --target <新目录库> --plan <本机保存的dry-run结果.json>
```

plan 默认不写入。apply 必须显式提供 plan 的完整身份绑定，持两库锁重新验证，不信任 plan 中列出的迁移结果。两个库必须已存在、互不包含且为真实目录；新库 catalog 和资产由既有入库/备份流程预先准备，这个工具不复制或检查动画文件。只要新库已有 semantic-review 或残留 migration 暂存就拒收，保留现场，不覆盖、不清锁、不自动重试清理。

- 完整动作行一致才转移该动作的 propose/flag；同名不代替同 ID，GLB 一致也不代替 Description/来源信息一致。新增、变化、删除动作分别列出；变化/删除动作的事件进入 needsReview，原记录保留。
- 新事件重绑新 catalog/base/tag ID 并重新构造 hash 链，eventMap 保留旧/新事件与标签映射；源请求的作者归属保留，不产生批准。旧 catalog、log、head 精确字节保留在 migration-archive，receipt 记 SHA 与映射。连续升级时，parent-migration 完整携带前代归档，逐代重建 receipt 与当时迁移日志前缀，允许其后合法追加；有祖先历史时 binding 额外绑定 sourceHistorySha256。lineageVersion 必须为 1，旧无版本原型回执明确拒迁，不猜测是否已丢历史。谱系含当前最多 8 代，继承材料最多 64 MiB / 32 文件，超预算拒收而非裁剪。
- catalog 先被原地覆盖且没有旧副本时，无法凭事件 SHA 恢复旧原文。不要删日志或手改绑定绕过；需要先取得原 catalog 快照。推荐升级始终在新库准备完成后迁移，而非覆盖旧库。
- 依赖本机 POSIX Python 3、dir_fd/flock，以及 Darwin/Linux 的不覆盖原子目录发布原语；不支持则明确拒绝。中断现场保留，无自动恢复策略。此为合作写者事务，不能证明 human 身份，不能防御所有同 UID 恶意并发。
- 真库的既有 `.semantic-tags` 等旧实验标记不在这个 propose/flag 协议内，不自动转换或宣称已经迁移；原件保留。本轮真实库无 semantic-review，未进行真实写回。

## 本机只读核对记录

None 库：2445 动作、108 Skin；2444 条 Description、1 条标题回退。来源 action 覆盖 1842 个动作，其中 461 个有多个 action；603 个没有 action claim，不能称作 603 个动作缺失。来源情绪覆盖 31 个动作，而旧目录全填 neutral。propMention/posture/direction 分别覆盖 558/499/280 个动作；当前来源未提供 contact、startPosture、endPosture、phases 证据。

18 项故事查询用当前词表得到 3 项有来源候选，7 项属于独立场景/双人制作，8 项是词表或组合证据问题；这不是“15 项动画缺失”。报告及详细标签队列仅存本机 `/private/tmp/m4-match-girl-result-local.json`、`/private/tmp/m2-labels-current-local.json`（新 labels 命令产物），旧只读统计保留在 `/private/tmp/m2-source-label-audit-local.json`。新审核清单列出 635 个需关注动作（603 无 action 和 507 条目带来源警告的并集），不是 635 个错误动作。本机这次约 4 秒完成查询，实际耗时依机器、库和文件检查而变；原 catalog 字节校验值前后一致。


## 验证与交接（不代签 Claude 判词）

- 独立复核实际通读本轮生产源码：迁移 API/声明/Python/helper、共享 validator 全文件、query/声明、迁移 CLI、story matcher 与 labels/CLI、motion-match Skill。未全量重读未修改的 motion-semantics / motion-catalog / 原 draft-fs，仅核对相关接口；测试夹具重点读故障、谱系、锁、并发、预算、输入边界，不能把测试通过说成所有测试逐行审阅。
- 固定版本独立专项共 159 项通过（M2 82、原 draft 45、story 15、query 15、迁移 CLI 2），日志 `/private/tmp/m2m4-independent-final-fixed.log`。曾在编辑交叠期间出现一项历史写中变化夹具失败；混版日志 `/private/tmp/m2m4-independent-final-focused.log` 保留，不充作固定版判词。最终固定版该项已通过。
- 真实 2445 条目录数据的隔离副本 A→B→C→D 连续三代迁移成功，原始 catalog/log/head 字节、flag 和事件映射保留。证据 `/private/tmp/m2-real-metadata-smoke-report.json`；此为目录数据规模测试，没有复制或验证模型文件、没有写真实库。完整真实库标签/查询均只读，原 catalog SHA 未变。
- Skill 独立前向试用目录 `/private/tmp/m4-forward-skill-20261031`：慢走返回来源候选；禁止跑步保持 unknown；取暖只有 partialReferences；flag 后 needs-tag-review。没有伪造资产 key/播放配置、烘焙或视觉批准。初次发现使用文档缺 JSON 示例，补齐后直接复制文档请求实际执行通过，无需再读代码。
- 本轮不关闭整个 REQ-MOTION-M2：真实标签尚未逐一审核、M3 人审保存与整库语义准确率没有验收，也未接游戏运行时。Q2 的同词典目录升级保留路径与离线 M4 的显式证据查询已有实现；跨词典版本迁移明确拒收，不能冒充已解决所有标签演进问题。

- 全量门禁（基线 605d8bcb1）：退出码 0，724 文件通过、8033 项通过、2 项既有跳过；eslint、依赖、类型、构建、文档与预算守卫通过。保留既有大包提示、美术台账 game-a art-03 / game-c art-017 WARN 和 happy-dom teardown 日志。日志 `/private/tmp/m2m4-full-gate.log`。
- 独立复核完整 SHA 与阅读边界：`/private/tmp/m2m4-independent-final-verification.json`；完整行门撤修/恢复 `/private/tmp/m2-migration-final-withdraw-red.log` / `/private/tmp/m2-migration-final-restore-green.log`；数组门 `/private/tmp/m4-hidden-hook-withdraw-red.log` / `/private/tmp/m4-hidden-hook-restore-green.log`。本机是 Darwin，不声称 Linux 实机通过。

- 接入最新主干 71fc652a6（创作平台独立启动入口）后，本批代码字节与冻结清单完全一致；再次全量门禁退出码 0，725 文件通过、8037 项通过、2 项既有跳过，日志 `/private/tmp/m2m4-rebased-full-gate.log`。并行入口另跑 `python3 -B -m unittest main_entry.test_platforms -v`，6 项通过，日志 `/private/tmp/m2m4-upstream-platform-compat.log`。原有告警边界不变。
- 给 Claude：以本功能提交及其父提交为边界，复查迁移/多代归档/完整行与物理祖先拒收、闭集输入、批量同快照、flag/unknown/partial/组合缺口语义；按上方固定测试和独立撤修证据自行复跑。静态示例不是实际模型数据，真实库与报告未上传。
