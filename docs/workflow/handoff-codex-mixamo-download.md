# Codex 派工单 · 在 owner 本机下载 Mixamo 动作库（2026-10-26）

> 派工：owner。施工：Codex（在 owner 的电脑上操作）。工具由 Claude 施工（`scripts/mixamo-fetch.mjs`，提交 `bcec0f01`）；若需要改工具，改完交 Claude 复查（复查人 ≠ 施工人）。
> 背景与用法全文：`docs/design/ai-pipeline/mixamo-library.md`。

## 指令全文

```text
你是 ApolloGame 引擎仓的 Codex，本单在 owner 的电脑上执行：用仓库里的 scripts/mixamo-fetch.mjs，把 Mixamo 动作下载到本机文件夹，建一个本地动作库。只下载、只存本机，不上传到任何地方。

【0. 先读】
1. AGENTS.md → CLAUDE.md
2. docs/design/ai-pipeline/mixamo-library.md（工具用法、风险、产物格式）
3. scripts/mixamo-fetch.mjs 与 scripts/mixamo-fetch.test.mjs（先读懂再跑）

【1. 硬规则（违反任何一条就停下报 owner）】
- 下载的 FBX、manifest.json 一律不进任何 git 仓库，不上传网盘或其它服务。输出目录固定为 ~/ApolloAssets/mixamo/（工具缺省值），必须在 ApolloGame 仓库外；工具会拒绝仓库内目录，不要绕过。
- token 只放环境变量 MIXAMO_TOKEN，不写进文件、命令参数、日志、提交信息或给 owner 的回复。
- 不改节流参数去「加速」：--delay-ms 不低于 4000，单轮 --max 不超过 40。遇到 401/403/429 工具会整轮停止；不重试、不换账号、不绕限流，停下报 owner。
- Mixamo 不对中国区 Adobe 账号开放。登录失败或接口返回无权限时，如实报告，不要尝试代理或换区。
- 不签任何人门，不把动作登记进 assets/index.json，不复制 FBX 进 ApolloGame 的 assets/ 或 public/。

【2. 准备】
1. cd 到 owner 本机的 ApolloGame 克隆，git fetch origin codex/mainbranch && git checkout codex/mainbranch && git pull --ff-only（工作树有别人未提交的改动就不要动它们；不 stash、不 reset）。
2. 跑工具自测：npx vitest run scripts/mixamo-fetch.test.mjs，核退出码为 0（不经管道吞退出码）。
3. 请 owner 在浏览器登录 mixamo.com，在角色页选中 Y Bot；然后请 owner 在该页开发者工具 Console 执行 localStorage.access_token，把值交给你。你只在当前终端 export MIXAMO_TOKEN='<值>'。

【3. 核对清单（只搜不下）】
node scripts/mixamo-fetch.mjs --search-only
- 清单是 docs/design/ai-pipeline/mixamo-list.json（47 项）。逐条看日志 `decision: <id> ← 「选中的动作名」（候选：…）`。
- 选错的（动作名明显不对）：改该项 query，或加 pick 写候选里的精确显示名；无匹配的（reject: … 无结果）：换搜索词再试。g628-* 是 game628 的动作候选，其中 g628-strike-match（擦火柴）大概率没有现成动作，选最接近的（如点火、拿起小物件），在 note 里写明「近似·需 E4 IK」。
- 反复 --search-only 直到每项都选得合理。清单只含搜索词，可以提交（见第 6 步）。

【4. 试下一个】
node scripts/mixamo-fetch.mjs --only idle --max 1
- 确认 ~/ApolloAssets/mixamo/idle.fbx 存在，文件头是 "Kaydara FBX Binary"，manifest.json 里有 idle 记录且不含 token。
- 本机有 Blender 的话：导入 idle.fbx，确认有骨架动作（action）且帧数大于 1；没有 Blender 就写「未用 Blender 验」。
- 下载结果是 .zip 的：手动解压看内容，报告 owner（工具目前不自动解压）。

【5. 正式下载】
node scripts/mixamo-fetch.mjs
- 一轮最多 40 个；跑完再跑一次补齐剩下的。中断后直接重跑，已下且 SHA 一致的会自动跳过。
- token 过期（401）：请 owner 重取 token 再跑，不要自己想办法。
- 单项失败（无匹配、导出失败、非 FBX）工具会记失败继续下一个；全部跑完后对失败项回到第 3 步调清单再补下。

【6. 只允许的仓库提交】
- 清单 docs/design/ai-pipeline/mixamo-list.json 的搜索词 / pick / note 调整：可以提交推送 codex/mainbranch（推前 fetch、必要时 rebase，跑 node scripts/scoped-gate.mjs --run 核退出码为 0）。
- 若真实接口形状与工具不符（例如搜索就报「返回形状不认识」，或导出返回结构不同）：最小改动修 scripts/mixamo-fetch.mjs，同时在 scripts/mixamo-fetch.test.mjs 的假服务里补上真实形状的用例（用脱敏后的响应，不含 token、账号信息），撤修验红一次，全量门禁绿再推；然后把 docs/design/ai-pipeline/mixamo-library.md 末尾加一节「真实接口实测（Codex · 日期）」，status 写「待 Claude 复查」。不改仓库内目录拒绝、token 不外泄、节流与 401/403/429 停止这四条安全行为。
- 除以上两类，不提交任何东西。FBX 与 manifest 永远不进仓库。

【完工回复（给 owner）】
- 成功下载数 / 跳过数 / 失败数；失败项各自原因。
- 清单改了哪些（id：旧搜索词 → 新搜索词 / pick）。
- idle 试下的验证结果（文件头、manifest、Blender 是否验过）。
- 是否碰到 401/403/429、是否改了工具（若改了：提交哈希、测试名、撤修验红结果、门禁退出码）。
- 本地库位置：~/ApolloAssets/mixamo/（总大小）。
回复里不得出现 token。然后停下。
```
