# Mixamo 本地动作库 · 下载工具

> owner 2026-10-25 令：先把 Mixamo 动作下载到本机建库，**不入库、不上传**。本仓库是公开仓库；Mixamo 条款禁止把原始动作文件当独立文件再分发，所以原件只放仓库外。工具 `scripts/mixamo-fetch.mjs` 会拒绝写进仓库内的目录。

## 风险（先读）

- 走的是 mixamo.com 网页端同一组接口，**不是官方 API**，接口随时可能变；批量调用存在被 Adobe 限流或封号的风险。工具默认保守：串行、每个间隔 4 秒、一轮最多 40 个、遇 401/403/429 立刻整轮停止且不重试。
- 中国区 Adobe 账号用不了 Mixamo。
- 本工具只用假服务测过请求形状与流程，**真实 Mixamo 接口未验**。第一次请先跑 `--search-only`，再用 `--max 1` 试下一个。

## 用法（在你本机）

1. 浏览器登录 mixamo.com，在角色页选 **Y Bot**（全库统一一个骨架，后面才能批量 Remap）。
2. 打开开发者工具 Console，执行 `localStorage.access_token`，复制结果（token 几小时后过期，过期重取）。
3. 在仓库根目录：

```bash
export MIXAMO_TOKEN='<粘贴>'          # 只走环境变量，不写进命令参数和文件
node scripts/mixamo-fetch.mjs --search-only          # 只搜不下：逐条看每个 id 会选中哪个动作
node scripts/mixamo-fetch.mjs --max 1                # 先下 1 个，确认文件能在 Blender 打开
node scripts/mixamo-fetch.mjs                        # 正式下载；中断后重跑会跳过已下（按 SHA 核对）
```

| 参数 | 缺省 | 说明 |
|---|---|---|
| `--out <dir>` | `~/ApolloAssets/mixamo` | 必须在仓库外 |
| `--list <file>` | `docs/design/ai-pipeline/mixamo-list.json` | 下载清单（只有搜索词，不含 Mixamo 内容，可以入库） |
| `--only a,b` | 全部 | 只跑指定 id |
| `--max <n>` | 40 | 本轮最多导出几个（1–200） |
| `--delay-ms <ms>` | 4000 | 每个之间的间隔，最少 2000 |
| `--fps <n>` | 30 | 24 / 30 / 60 |
| `--character <id>` | 当前选中角色 | 一般不用填 |

下载格式固定为 **FBX Binary、Without Skin**；清单里 `inPlace: true` 的动作，若 Mixamo 支持 In Place 就开（不支持会打日志，按原位移下载）。

## 清单

`mixamo-list.json` 每项 `{ id, query, pick?, inPlace?, note? }`：`id` 就是本地文件名；`query` 是 Mixamo 搜索词；默认选搜索结果里第一个动作，`pick` 可按显示名精确指定。`--search-only` 会列出每项前 5 个候选，选得不对就改 `pick` 或 `query`。`g628-*` 是 game628 动作清单的候选，其中「擦火柴」大概率没有现成动作，要取最近似的再用 E4 IK 修正。

## 产物

`<out>/<id>.fbx` 加 `<out>/manifest.json`：每个动作记录 `file / sha256 / bytes / searchTerm / mixamoName / mixamoId / characterId / download{format,skin,fps,inPlace} / downloadedAt`，以及条款 URL。token 不落盘。

## 用进游戏时

按 `character-rigging.md` 的 Mixamo → Remap 步骤：把选中的 FBX 复制到 `assets/_inbox/mixamo/<clip-id>.fbx`，sidecar 里的 `searchTerm`、`download` 照 manifest 填。现有来源校验只收 `source:"mixamo-manual"`；用本工具下载的动作走正式回灌前，要先决定是否新增 `mixamo-fetch` 来源值（小改，届时另开单）。注意：复制进 `assets/` 就等于进了公开仓库，私有存储方案定下来之前不要提交。
