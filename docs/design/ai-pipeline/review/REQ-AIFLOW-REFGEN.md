# Review 单 · REQ-AIFLOW-REFGEN

| 项 | 内容 |
|---|---|
| 工单 | T1 + 残余 R1；owner 已裁 A |
| 施工 | Codex · 2026-10-16 |
| 复查 | Claude（待独立复跑、待判词；施工方不作复查结论） |
| 提交 | `git log --grep='feat(aiflow): REFGEN'`；抢锁 `7304e4bab` |
| 改动面 | `scripts/ai-gen.mjs`、`scripts/ai-gen-inputs.mjs`、`scripts/ai-gen.test.mjs`；`docs/design/ai-pipeline/refgen.md`、本单；需求池仅本工单锁行/status |

## 做了什么

1. CLI 接 `--ref <png>...` / 重复 `--ref` / `--edit <png>`，图片原字节 SHA256、输入角色与路径写入待审 provenance。
2. Seedream 接参考图；新增 GPT Image 2.5 provider（OPENAI_API_KEY、固定 2.5 Sunburst snapshot、JSON generations / multipart edits）；不支持参考图的旧 provider 拒收。
3. 缺 key/显式 mock 响亮降级，mock 图随提示词和输入图变化；所有生成仍先落待审区。

## 逐条怎么自己验

| 核什么 | 怎么自己验 | 施工测试记录 |
|---|---|---|
| 参数、哈希、入账闭环 | `npx vitest run scripts/ai-gen.test.mjs`；看 T1/R1 组与 T1 CLI 用例 | 27 tests；均退出 0 |
| 真实协议形状 | 同组的 fetch 替身测试：断言 Seedream image data URL、GPT 两端点、multipart 两张图、HTTP401 拒收 | 不发网络、不需 key |
| mock 与拒收 | 缺 OPENAI_API_KEY、显式 mock；同 prompt 换参考图字节；qwen 带图与坏 PNG | 验 mock 标记、不同字节、异常与日志 |
| 旧路径不回归 | 同文件既有 tripo / meshy / qwen / seedream、人审门与 provenanceMissing 用例 | 均退出 0 |
| 改动边界 | `git show --name-only <施工提交>` | 未改 src、games、main_entry；未签人门 |
| 门禁 | `node scripts/scoped-gate.mjs --run`；因已知 depcruise 基线中止后，按 `planFor({scope:'full'})` 顺序补跑剩余步骤 | 各步退出码见下 |

## 撤修验红记录

临时修改隔离副本，`try/finally` 恢复；不碰共享工作区。

- 前置：26 tests 通过（随后追加 CLI 闭环测试，恢复后为 27 tests 通过）。
- 锚点断言：`original.count('...(references.length ? { references } : {})') == 1`，输出 `ANCHOR HIT: provenance references = 1`。
- 撤修：把该锚替换为 `...(references.length ? { references: [] } : {})`。
- 命令：`npx vitest run scripts/ai-gen.test.mjs`，exit 1。
- 红灯：`PNG 原始字节 sha256 进入待审 provenance…`，`AssertionError: expected [] to deeply equal [ { …(3) } ]`；`1 failed | 25 passed (26)`；断言位置为 `entry.provenance.references`。
- 恢复后：同文件 `27 passed (27)`、exit 0。

## 门禁记录

**除基线 depcruise 外全绿**（对应 vitest 围栏 1 例同源基线）。

| 步 | 退出码 |
|---|---:|
| `node scripts/scoped-gate.mjs --run` | 1（eslint=0，止于 depcruise=1） |
| tsc | 0 |
| vitest 全量 | 1（仅 `scripts/depcruise-fence.test.mjs`「绿腿：真仓零违规」1 例） |
| build | 0 |
| docs-ref / context-budget | 0 / 0 |
| art-ledger-guard | 2（既有 WARN；scoped-gate 自带 allowExit=[0,2]） |
| `node --test tools/spritegen-export.test.mjs` | 0（5 项） |

正式门禁末行：`❌ 门禁失败于 depcruise（退出码 1）`；补跑末行：`除基线 depcruise 外全绿（含对应 vitest 围栏基线 1 例；其余退出码 0，台账 WARN=2 为既有允许档）`。

补跑保持 planFor 的剩余步骤顺序；本机 `RENDER_PROBE_CHROMIUM` 指向系统 Chrome，测试需要允许本地监听。既有 `tools/spritegen-export.test.mjs` 使用 node:test，与 Vitest 不兼容，因此 Vitest 用 `--exclude=tools/spritegen-export.test.mjs`，另用原生 runner 执行全部 5 项；未修改任何断言或生产门禁脚本。可复跑：`npx vitest run --exclude=tools/spritegen-export.test.mjs` + 上述 node --test。

## 请复查方重点核

- 编辑底图置于 multipart 第一张，其余为参考图；提示词编辑语义由 provider 执行，本波未增加蒙版接口。
- API 家族名 GPT Image 2.5 对应默认 `gpt-image-2.5-sunburst-2026-09-08`；配置覆盖仅经 env。该选择是否满足定调用途，请复查。
- 原生适配器注册/CLI 可用；创作台 server 自有白名单不在授权范围，本波未改它。

## 已知局限 / 偏离

真实付费 API 未调用；只验证官方协议形状和离线全链。PNG 输入做签名/头/大小校验；不声称完整图片解码安全检查。qwen/3D 旧适配器没有参考图协议，显式拒收，不静默忽略。无 spec 范围变更。

## 复查判词（Claude · 2026-10-17）· **PASS**

**门禁独立复跑**（复查方在独立工作树 @ `aeb15070` 重跑）：eslint 0 · tsc 0 · build 0 · docs-ref 0 · context-budget 0 · vitest 1（唯一失败 = 基线「dependency-cruiser 围栏」1 例，同 origin 原样）。

| 铁律 | 复查方做了什么 | 结果 |
|---|---|---|
| ① 独立复跑 | `npx vitest run scripts/ai-gen.test.mjs` | 27/27 · exit 0 |
| ② 撤修验红（另选锚点） | 锚 `inputs.length && !['seedream', 'gpt-image-2.5'].includes(name)`（命中 1）→ 换成 `false`，即拆掉「不支持参考图的 provider 必须拒收」 | 1 例红：`promise resolved "{ …(5) }" instead of rejecting`；恢复后 27/27 |
| ③ 实证复现 | CLI 把提示词写在 `--ref` 后面 | 明确拒收「缺 prompt（提示词放在 --ref 前）」，不吞成路径 |
| ④ 读告警 | mock / 缺 key 降级均有 `[ai-gen] downgrade` 日志 | 无静默分支 |

**非阻塞备注**：默认模型 `gpt-image-2.5-sunburst-2026-09-08` 复查方只在第三方页面查到「Flare（默认·快）/ Sunburst（慢·精）」两档的说法，未能在 OpenAI 官方文档核实快照名；首次真调前请 owner 用真 key 确认，必要时用 env `OPENAI_IMAGE_MODEL` 覆盖。
