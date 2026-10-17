# Review 单 · REQ-AIFLOW-SPLIT

| 项 | 内容 |
|---|---|
| 工单 | T2 + S1；owner 已裁 A |
| 施工 | Codex；锁 `b68e658c2`（2026-10-16），实现 2026-10-17 |
| 复查 | Claude（待独立复跑；施工方不判 PASS） |
| 提交 | `git log --grep='feat(aiflow): SPLIT'` |
| 文件清单 | `scripts/asset-split.mjs`、`scripts/asset-split.test.mjs`、`scripts/lib/aiflow-paths.mjs`、`.claude/skills/aiflow-split/SKILL.md`、`docs/design/ai-pipeline/asset-split.md`、本单；需求池仅本单 status |

## 做了什么

固定 keyart 工作区和拆层单字段，输出可重跑的编号标注 PNG 与清单。仅 approved 且带 skinKey 的行导入现有美术台账体系，复用 artRoot/mergeLedger 保编号与人工历史；拆层批准不会冒充资产批准。交付 Tripo/Blender/2D 切图判据 skill。

## 逐条怎么自己验

| 核什么 | 怎么自己验 | 施工测试记录 |
|---|---|---|
| 无槽拒收、proposed 不入账 | `npx vitest run scripts/asset-split.test.mjs`，看契约与导入用例 | 22 tests，exit 0 |
| 编号/历史/真实资产保留，撤回批准退役 | 同文件合并与撤回用例 | filled/gen/history 保留；新槽从 max+1 追加 |
| 标注图不是空跑 | 像素断言检查 bbox 下边框确为路线色；同输入 SHA256 一致 | 真实 PNG 产物字节断言 |
| 工作区重跑与卡带落点 | 同文件完整落地/幂等/卡带用例 | PNG/台账逐字节不变；library 线不写 public |
| 拒收零输出 | 无槽/缺 refs/越界 bbox/符号链接逃逸用例 | 文件验证完成前不写输出 |
| mock | 同文件 mock 用例；命令可带 `--root` 指临时根 | 只出 keyart/mock 预览，不写真实台账/清单，不改 state |
| S1 skill | `python3 /Users/junbaili/.codex/skills/.system/skill-creator/scripts/quick_validate.py .claude/skills/aiflow-split` | exit 0，Skill is valid! |
| 边界 | `git show --name-only <施工提交>` | 未改 games/src，不签人门 |

## 撤修验红

均在隔离副本 `try/finally` 恢复，改前及恢复后 22 tests 通过。

1. 断言 `original.count("row.state !== 'approved'") == 1`，输出 `ANCHOR HIT=1`；将其替换 `false`，运行 `npx vitest run scripts/asset-split.test.mjs -t '仅 approved 导入'`，exit 1、1 failed。命中：`expected ['example/lamp','example/wall'] to deeply equal ['example/lamp']`。
2. 断言 `original.count('if (!nonempty(row.skinKey))') == 1`，输出 `ANCHOR HIT=1`；替换 `if (false)`，运行 `npx vitest run scripts/asset-split.test.mjs -t '无 skinKey 行拒收'`，exit 1、4 failed。命中：`AssertionError: expected [Function] to throw an error`（undefined/null/空串/空白四边界）。

## 门禁

**除基线 depcruise 外全绿**。全量 5686 项，5685 通过，唯一失败为已批准的 depcruise 围栏基线。

| 步 | 退出码 |
|---|---:|
| scoped-gate --run | 1（eslint=0，depcruise=1，获准基线） |
| tsc | 0 |
| vitest 全量 | 1（仅同源围栏基线 1 例） |
| build | 0 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有 WARN，门禁 allowExit=[0,2]） |
| spritegen 原生 node:test | 0（5 项） |

正式门禁末行 `❌ 门禁失败于 depcruise（退出码 1）`；剩余步骤按 planFor 顺序实跑，补跑末行 `除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。
本机浏览器通过 RENDER_PROBE_CHROMIUM 指向系统 Chrome；测试在允许本地端口的环境运行。既有 tools/spritegen-export.test.mjs 为 node:test，Vitest 单独排除该文件后用 node --test 执行全部断言（同 REFGEN 验证方式，未改生产门禁/断言）。

## 请复查重点看

- bbox 使用原图左上角为原点的整数像素；编号与 asset-split.md 对应，路线色区分 generate/build/character。
- 相同 skinKey 跨行共用一项台账，splitIds/refs 合并；不虚构游戏组件槽位，skinKey 的真实消费由拆层确认人核对。
- 拆层 state=approved 只批准生产方案；台账初态 needs-art，真正资产仍经原有美术批准门。

## 已知局限 / 偏离

标注编解码复用 asset-matte 的 8-bit RGB/RGBA 非隔行 PNG 实现；其它 PNG 编码需先规范化。工具不能从图片判断真实消费槽，skill 明确人工确认；无自动视觉拆层模型。mock 只出隔离预览，避免假资产或假批准。无 spec 范围变更，未写任何真实游戏工件。

## 复查判词（Claude · 2026-10-17）· **PASS**

**门禁独立复跑**（复查方在独立工作树 @ `aeb15070` 重跑）：eslint 0 · tsc 0 · build 0 · docs-ref 0 · context-budget 0 · vitest 1（唯一失败 = 基线「dependency-cruiser 围栏」1 例，同 origin 原样）。

| 铁律 | 复查方做了什么 | 结果 |
|---|---|---|
| ① 独立复跑 | `npx vitest run scripts/asset-split.test.mjs` | 22/22 · exit 0 |
| ② 撤修验红（另选锚点） | 锚 `if (row.state !== 'approved') {`（命中 1）→ `if (false) {`，即 proposed 行也进台账 | 2 例红（「仅 approved 导入」「撤回批准的行不再活跃」）；恢复后 22/22 |
| ③ 实证复现 | 对无拆层单的 game628 跑 CLI | 明确拒收并 exit 1，不产出任何文件 |
| ④ 读告警 | skip / downgrade / commit 日志齐全 | — |

**非阻塞备注**：台账行 `kind` 一律写 `sprite`，`route:"build"`（Blender 搭）与 `character` 行进 3D 项目时需要区分资产类型——留到第 2 波（T7/T4）接 3D 时再定，不阻塞 2D 项目。

## 代码级复查追加（Claude · 2026-10-17）· **改判 FAIL（打回）**

上一轮 PASS 只基于测试复跑与撤修验红；逐行读代码后发现两处实伤，改判。复查方失误在先，记档。

**阻塞 C1 · 拆层推导会把游戏已有台账行打成作废**（`scripts/asset-split.mjs` `deriveSplitLedger` → `mergeLedger(safePrevious, fresh)` 未传 manifest）：`mergeLedger` 对「上一版有、本次 fresh 没有、状态为 needs-art/placeholder/generated」的行一律写 `retired`。拆层的 fresh 只含拆层行，于是同一 `art-ledger.json` 里由 manifest / 游戏推导脚本产生的未完成行全部作废；下次 `art-replace derive` 又把拆层行作废——两条工具互相抹掉对方的行。
复现：上一版台账一行 `game628/scene/stove`（needs-art·无 splitIds）+ 一条 approved 拆层行 → 输出 `art-01 game628/scene/stove retired | art-02 game628/item/lamp needs-art`。
→ 修法：拆层推导**只增改带 `splitIds` 的行**，不经全量 `mergeLedger` 收尾；非拆层来源的行原样保留。`art-replace derive` 侧同样不得作废带 `splitIds` 的行。补两条双向测试。

**须修 C2 · 悬空符号链接绕过越界保护**（`scripts/lib/aiflow-paths.mjs` `inside()`）：`existsSync` 对悬空链接返回 false，祖先回溯越过链接本身，realpath 校验通过，随后 `mkdirSync`/`writeFileSync` 顺着链接写到工作区外。
复现：`keyart/mock` 为指向外部不存在目录的悬空链接，`inside(base,'keyart/mock/x.png')` 被放行。
→ 修法：回溯时用 `lstatSync` 识别链接（含悬空），遇到任何解析出界或悬空的链接一律拒收；补测试。
